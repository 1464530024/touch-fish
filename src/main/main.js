/**
 * touch fish · 主进程
 * 负责：虚拟桌面窗口、设置窗口、属性窗口、托盘、全局快捷键、本地配置与打包信息。
 */
const {
  app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen, shell,
  dialog, protocol
} = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const store = require('./store');
const { KeyWatcher, formatLabel } = require('./hotkey');

// 自定义协议：把用户自选壁纸暴露给渲染进程（避免 file:// 跨目录限制，也不必把图片塞进 JSON）
protocol.registerSchemesAsPrivileged([
  { scheme: 'tfwall', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

const WALLPAPER_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif'
};


const ROOT = path.join(__dirname, '..', '..');
const RENDERER = path.join(ROOT, 'src', 'renderer');
const ASSETS = path.join(ROOT, 'assets');
const PRELOAD = path.join(ROOT, 'src', 'preload');

// 自检产物目录：开发态写项目根，打包后写 userData（asar 内只读）
const OUT_DIR = app.isPackaged ? app.getPath('userData') : ROOT;

const isDev = process.argv.includes('--dev');
const isSilent = process.argv.includes('--silent');

let desktopWin = null;
let settingsWin = null;
let tray = null;
let watcher = null;
let isShown = false;
let fadeTimer = null;
const propertyWins = new Map();

app.setAppUserModelId('com.touchfish.desktop');
app.disableHardwareAcceleration === undefined; // noop guard

/* ------------------------------------------------------------------ 图标 */

function trayImage(iconId) {
  const p = path.join(ASSETS, 'tray', `${iconId || 'whale'}.png`);
  if (fs.existsSync(p)) return nativeImage.createFromPath(p).resize({ width: 16, height: 16 });
  const fallback = path.join(ASSETS, 'logo.png');
  if (fs.existsSync(fallback)) return nativeImage.createFromPath(fallback).resize({ width: 16, height: 16 });
  return nativeImage.createEmpty();
}

function appIcon() {
  const p = path.join(ASSETS, 'logo.png');
  return fs.existsSync(p) ? nativeImage.createFromPath(p) : undefined;
}

/* ------------------------------------------------------------------ 壁纸 */

function wallpaperFile() {
  const p = (store.get().desktop || {}).wallpaper;
  return p && p !== 'hero' && fs.existsSync(p) ? p : null;
}

function registerWallpaperProtocol() {
  try {
    protocol.handle('tfwall', async () => {
      const p = wallpaperFile();
      if (!p) return new Response('', { status: 404 });
      try {
        const data = await fs.promises.readFile(p);
        const mime = WALLPAPER_MIME[path.extname(p).toLowerCase()] || 'image/jpeg';
        return new Response(data, {
          headers: { 'content-type': mime, 'cache-control': 'no-cache' }
        });
      } catch {
        return new Response('', { status: 404 });
      }
    });
  } catch (e) {
    console.warn('[wallpaper] 协议注册失败', e.message);
  }
}

function removeOldWallpapers(keep) {
  const dir = app.getPath('userData');
  try {
    for (const name of fs.readdirSync(dir)) {
      if (/^wallpaper\.[a-z0-9]+$/i.test(name)) {
        const full = path.join(dir, name);
        if (keep && path.resolve(full) === path.resolve(keep)) continue;
        try { fs.unlinkSync(full); } catch {}
      }
    }
  } catch {}
}

/* -------------------------------------------------------------- 虚拟桌面 */

function createDesktop() {
  if (desktopWin && !desktopWin.isDestroyed()) return desktopWin;
  const { bounds } = screen.getPrimaryDisplay();

  desktopWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    frame: false,
    backgroundColor: '#0a4e8f',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(PRELOAD, 'desktop.js'),
      contextIsolation: true,
      sandbox: false,
      spellcheck: false,
      backgroundThrottling: false,
      // 虚拟桌面内置浏览器（属性窗口）需要 webview 标签
      webviewTag: true
    }
  });

  desktopWin.setMenu(null);
  desktopWin.setAlwaysOnTop(true, 'screen-saver');
  desktopWin.loadFile(path.join(RENDERER, 'desktop', 'index.html'));

  desktopWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hideDesktop();
    }
  });

  if (isDev) desktopWin.webContents.openDevTools({ mode: 'detach' });

  if (process.argv.includes('--smoke')) {
    desktopWin.webContents.on('console-message', (_e, level, message, line, source) => {
      try {
        fs.appendFileSync(path.join(ROOT, 'smoke.log'), `[${level}] ${message} (${source}:${line})\n`);
      } catch {}
    });
    desktopWin.webContents.on('preload-error', (_e, p, err) => {
      try {
        fs.appendFileSync(path.join(ROOT, 'smoke.log'), `[preload-error] ${p} ${err && err.message}\n`);
      } catch {}
    });
  }

  return desktopWin;
}

function fadeTo(target, done) {
  if (!desktopWin || desktopWin.isDestroyed()) return;
  clearInterval(fadeTimer);
  const start = desktopWin.getOpacity();
  const steps = 8;
  let i = 0;
  fadeTimer = setInterval(() => {
    i += 1;
    if (!desktopWin || desktopWin.isDestroyed()) return clearInterval(fadeTimer);
    const v = start + ((target - start) * i) / steps;
    try {
      desktopWin.setOpacity(Math.max(0, Math.min(1, v)));
    } catch {}
    if (i >= steps) {
      clearInterval(fadeTimer);
      done && done();
    }
  }, 16);
}

function showDesktop() {
  createDesktop();
  if (!desktopWin || desktopWin.isDestroyed()) return;
  const { bounds } = screen.getPrimaryDisplay();
  desktopWin.setBounds(bounds);
  desktopWin.setOpacity(0);
  desktopWin.show();
  desktopWin.focus();
  desktopWin.setAlwaysOnTop(true, 'screen-saver');
  fadeTo(1);
  isShown = true;
  refreshTray();
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide();
  store.patch({ stats: { ...store.get().stats, toggles: (store.get().stats.toggles || 0) + 1 } });
  desktopWin.webContents.send('desktop:shown');
}

function hideDesktop() {
  if (!desktopWin || desktopWin.isDestroyed() || !isShown) return;
  isShown = false;
  fadeTo(0, () => {
    if (desktopWin && !desktopWin.isDestroyed()) {
      desktopWin.hide();
      desktopWin.setOpacity(1);
    }
  });
  refreshTray();
}

function toggleDesktop() {
  if (isShown) hideDesktop();
  else showDesktop();
}

/* ---------------------------------------------------------------- 设置窗口 */

function createSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) return settingsWin;
  settingsWin = new BrowserWindow({
    width: 1040,
    height: 740,
    minWidth: 900,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#f3f3f3',
    title: 'touch fish 设置',
    icon: appIcon(),
    webPreferences: {
      preload: path.join(PRELOAD, 'settings.js'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  });
  settingsWin.setMenu(null);
  settingsWin.loadFile(path.join(RENDERER, 'settings', 'index.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
  if (process.argv.includes('--smoke')) {
    settingsWin.webContents.on('console-message', (_e, level, message) => {
      try {
        fs.appendFileSync(path.join(ROOT, 'smoke.log'), `[settings:${level}] ${message}
`);
      } catch {}
    });
    settingsWin.webContents.on('preload-error', (_e, p2, err) => {
      try {
        fs.appendFileSync(path.join(ROOT, 'smoke.log'), `[settings-preload] ${err && err.message}
`);
      } catch {}
    });
  }
  if (isDev) settingsWin.webContents.openDevTools({ mode: 'detach' });
  return settingsWin;
}

function openSettings() {
  const win = createSettings();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/* ---------------------------------------------------------------- 属性窗口 */

function openProperty(payload) {
  const key = payload.id || payload.url;
  let win = propertyWins.get(key);
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    win.webContents.send('property:reload', payload);
    return;
  }

  const w = Math.min(1280, Math.round(screen.getPrimaryDisplay().workAreaSize.width * 0.72));
  const h = Math.min(860, Math.round(screen.getPrimaryDisplay().workAreaSize.height * 0.8));

  win = new BrowserWindow({
    width: w,
    height: h,
    show: false,
    frame: false,
    backgroundColor: '#ffffff',
    title: `${payload.name || '网站'} - 属性`,
    icon: appIcon(),
    webPreferences: {
      preload: path.join(PRELOAD, 'property.js'),
      contextIsolation: true,
      sandbox: false,
      webviewTag: true
    }
  });
  win.setMenu(null);
  win.loadFile(path.join(RENDERER, 'property', 'index.html'), { query: { data: JSON.stringify(payload) } });
  win.once('ready-to-show', () => win.show());
  if (process.argv.includes('--smoke')) {
    win.webContents.on('console-message', (_e, level, message) => {
      try { fs.appendFileSync(path.join(ROOT, 'smoke.log'), `[property] ${message}
`); } catch {}
    });
  }
  win.on('closed', () => propertyWins.delete(key));
  propertyWins.set(key, win);
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

/* -------------------------------------------------------------------- 托盘 */

function refreshTray() {
  if (!tray) return;
  const cfg = store.get();
  const busy = !!(cfg.desktop || {}).busyMode;
  const status = isShown
    ? (busy ? '摸鱼中（忙碌模式已开启）' : '摸鱼中（虚拟桌面已开启）')
    : '待命（虚拟桌面已隐藏）';
  tray.setToolTip(`touch fish · ${status}`);
  tray.setImage(trayImage(cfg.icons.app));

  const sites = (cfg.sites || []).slice(0, 12);
  const template = [
    { label: `状态：${status}`, enabled: false },
    { type: 'separator' },
    {
      label: isShown ? '返回真实桌面' : `打开虚拟桌面（${formatLabel(cfg.hotkey)}）`,
      click: () => toggleDesktop()
    },
    {
      label: `一键隐藏（${cfg.panic.label || cfg.panic.accelerator}）`,
      click: () => hideAll()
    },
    { type: 'separator' },
    {
      label: busy ? '关闭忙碌模式（收起假工作页）' : '开启忙碌模式（铺满工作页）',
      click: () => toggleBusyMode()
    },
    {
      label: '网站收藏',
      submenu: sites.length
        ? sites.map((s) => ({
            label: s.name,
            click: () => openSiteInDesktop(s)
          }))
        : [{ label: '（暂未收藏，去设置里添加）', enabled: false, click: () => openSettings() }]
    },
    { type: 'separator' },
    { label: '设置…', click: () => openSettings() },
    { label: '打开配置目录', click: () => shell.openPath(app.getPath('userData')) },
    { type: 'separator' },
    {
      label: '退出 touch fish',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

/** 托盘里点网站收藏：直接在虚拟桌面内打开内置浏览器 */
function openSiteInDesktop(site) {
  showDesktop();
  setTimeout(() => {
    if (desktopWin && !desktopWin.isDestroyed()) {
      desktopWin.webContents.send('web:open', {
        id: 'site-' + (site.id || ''),
        name: site.name,
        url: site.url,
        icon: site.icon || 'link'
      });
    }
  }, 440);
}

/** 忙碌模式开关（虚拟桌面会跟随配置变化自动铺/收假工作页） */
function toggleBusyMode() {
  const next = !(store.get().desktop || {}).busyMode;
  store.patch({ desktop: { ...(store.get().desktop || {}), busyMode: next } });
  if (next) showDesktop();
  broadcastConfig();
}

function createTray() {
  tray = new Tray(trayImage(store.get().icons.app));
  tray.on('click', () => toggleDesktop());
  tray.on('double-click', () => openSettings());
  refreshTray();
}

/* ---------------------------------------------------------------- 快捷键 */

function stopWatcher() {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
}

function startHotkey() {
  const cfg = store.get();
  stopWatcher();
  globalShortcut.unregisterAll();

  if (cfg.hotkey.mode === 'combo') {
    const ok = globalShortcut.register(cfg.hotkey.accelerator, toggleDesktop);
    if (!ok) console.warn('[hotkey] 组合键注册失败', cfg.hotkey.accelerator);
  } else {
    watcher = new KeyWatcher({
      sequence: cfg.hotkey.sequence,
      gap: cfg.hotkey.gap,
      onMatch: toggleDesktop,
      onError: (msg) => {
        console.warn('[hotkey]', msg);
        const ok = globalShortcut.register(cfg.hotkey.accelerator, toggleDesktop);
        if (ok) console.log('[hotkey] 已启用兜底组合键', cfg.hotkey.accelerator);
      }
    });
    const ok = watcher.start();
    if (!ok) globalShortcut.register(cfg.hotkey.accelerator, toggleDesktop);
  }

  const panicOk = globalShortcut.register(cfg.panic.accelerator, hideAll);
  if (!panicOk) console.warn('[hotkey] 一键隐藏快捷键注册失败', cfg.panic.accelerator);
}

/** 一键隐藏：立即收起虚拟桌面与所有属性窗口，只留托盘 */
function hideAll() {
  if (isShown) hideDesktop();
  for (const [, w] of propertyWins) {
    if (w && !w.isDestroyed()) w.hide();
  }
  if (settingsWin && !settingsWin.isDestroyed()) settingsWin.hide();
}

/* -------------------------------------------------------------------- IPC */

function broadcastConfig() {
  const cfg = store.get();
  const meta = {
    hotkeyLabel: formatLabel(cfg.hotkey),
    panicLabel: cfg.panic.label || cfg.panic.accelerator,
    version: app.getVersion(),
    userData: app.getPath('userData'),
    isShown
  };
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('config:changed', { config: cfg, meta });
  }
  refreshTray();
}

function registerIpc() {
  const metaOf = () => ({
    hotkeyLabel: formatLabel(store.get().hotkey),
    panicLabel: store.get().panic.label || store.get().panic.accelerator,
    version: app.getVersion(),
    userData: app.getPath('userData'),
    isShown,
    exe: process.execPath
  });

  ipcMain.handle('config:get', () => ({ config: store.get(), meta: metaOf() }));

  ipcMain.handle('config:patch', (_e, part) => {
    store.patch(part);
    if (part.hotkey || part.panic) startHotkey();
    broadcastConfig();
    return { config: store.get(), meta: metaOf() };
  });

  ipcMain.handle('config:reset', () => {
    store.reset();
    startHotkey();
    broadcastConfig();
    return { config: store.get(), meta: metaOf() };
  });

  ipcMain.handle('icons:set', (_e, { scope, itemId, iconId }) => {
    const cfg = store.get();
    if (scope === 'app') store.patch({ icons: { app: iconId } });
    else store.patch({ icons: { desktop: { ...cfg.icons.desktop, [itemId]: iconId } } });
    broadcastConfig();
    return store.get();
  });

  ipcMain.handle('sites:save', (_e, sites) => {
    const clean = (sites || []).map((s) => ({
      id: s.id || 's-' + Math.random().toString(36).slice(2, 8),
      name: String(s.name || '未命名').slice(0, 40),
      url: String(s.url || '').slice(0, 500),
      icon: s.icon || 'link'
    }));
    store.patch({ sites: clean });
    broadcastConfig();
    return store.get();
  });

  ipcMain.handle('layout:save', (_e, layout) => {
    store.patch({ layout: layout || {} });
    return true;
  });

  ipcMain.handle('wallpaper:choose', async (e) => {
    const parent = BrowserWindow.fromWebContents(e.sender) || desktopWin || settingsWin;
    const res = await dialog.showOpenDialog(parent, {
      title: '选择壁纸图片',
      buttonLabel: '用作壁纸',
      properties: ['openFile'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'] }]
    });
    if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
    const src = res.filePaths[0];
    const ext = (path.extname(src) || '.jpg').toLowerCase();
    if (!WALLPAPER_MIME[ext]) return { ok: false, message: '不支持的图片格式' };
    const dst = path.join(app.getPath('userData'), 'wallpaper' + ext);
    try {
      removeOldWallpapers(dst);
      fs.copyFileSync(src, dst);
    } catch (err) {
      return { ok: false, message: '复制图片失败：' + err.message };
    }
    store.patch({ desktop: { ...(store.get().desktop || {}), wallpaper: dst } });
    broadcastConfig();
    return { ok: true, path: dst };
  });

  ipcMain.handle('wallpaper:reset', () => {
    removeOldWallpapers(null);
    store.patch({ desktop: { ...(store.get().desktop || {}), wallpaper: 'hero' } });
    broadcastConfig();
    return { ok: true };
  });

  ipcMain.handle('desktop:toggle', () => {
    toggleDesktop();
    return isShown;
  });
  ipcMain.handle('desktop:show', () => {
    showDesktop();
    return true;
  });
  ipcMain.handle('desktop:hide', () => {
    hideDesktop();
    return true;
  });
  ipcMain.handle('desktop:state', () => isShown);

  ipcMain.handle('desktop:pool', () => {
    showDesktop();
    setTimeout(() => {
      if (desktopWin && !desktopWin.isDestroyed()) desktopWin.webContents.send('pool:start');
    }, 320);
    return true;
  });

  ipcMain.handle('settings:open', () => {
    openSettings();
    return true;
  });

  ipcMain.handle('property:open', (_e, payload) => {
    openProperty(payload || {});
    return true;
  });

  ipcMain.handle('shell:external', (_e, url) => {
    if (/^https?:\/\//i.test(url || '')) shell.openExternal(url);
    return true;
  });
  ipcMain.handle('shell:open-userdata', () => shell.openPath(app.getPath('userData')));
  ipcMain.handle('shell:open-install-dir', () => shell.openPath(path.dirname(process.execPath)));

  ipcMain.handle('app:hide-all', () => {
    hideAll();
    return true;
  });
  ipcMain.handle('app:quit', () => {
    app.isQuitting = true;
    app.quit();
    return true;
  });

  ipcMain.handle('app:uninstall', async () => {
    const base = path.dirname(process.execPath);
    const candidates = ['Uninstall touch fish.exe', 'uninstall touch fish.exe', 'Uninstall touch-fish.exe'];
    for (const name of candidates) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) {
        await shell.openPath(p);
        app.isQuitting = true;
        setTimeout(() => app.quit(), 800);
        return { ok: true };
      }
    }
    shell.openPath(base);
    return { ok: false, message: '未找到卸载程序（开发模式下没有安装包），已为你打开安装目录。' };
  });

  ipcMain.handle('app:set-login', (_e, enabled) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!enabled,
        path: process.execPath,
        args: ['--silent']
      });
      store.patch({ tray: { startWithWindows: !!enabled } });
      broadcastConfig();
      return true;
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('app:stats', (_e, key) => {
    const stats = { ...store.get().stats };
    stats[key] = (stats[key] || 0) + 1;
    store.patch({ stats });
    return stats;
  });

  ipcMain.handle('window:minimize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.minimize();
  });
  ipcMain.handle('window:maximize', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (w.isMaximized()) w.unmaximize();
    else w.maximize();
  });
  ipcMain.handle('window:close', (e) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (w) w.close();
  });
}

/* ------------------------------------------------------------------- 启动 */

/** 开发自检：自动截图虚拟桌面 / 台球 / 设置页，便于回归检查 */
async function runSmokeTest() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (win, name) => {
    try {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(OUT_DIR, name), img.toPNG());
      fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[shot] ${name}\n`);
    } catch (e) {
      fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[shot-error] ${name} ${e.message}\n`);
    }
  };
  try {
    fs.writeFileSync(path.join(OUT_DIR, 'smoke.log'), '--- smoke start ---\n');
    await sleep(1600);
    showDesktop();
    await sleep(1400);
    await shot(desktopWin, 'smoke-desktop.png');

    try {
      const crop = await desktopWin.webContents.capturePage({ x: 0, y: 0, width: 210, height: 430 });
      fs.writeFileSync(path.join(OUT_DIR, 'smoke-zoom.png'), crop.toPNG());
    } catch {}

    await desktopWin.webContents.executeJavaScript(
      `document.querySelector('.icon[data-id="this-pc"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true})); true`
    ).catch(() => {});
    await sleep(800);
    await shot(desktopWin, 'smoke-window.png');

    await desktopWin.webContents.executeJavaScript(
      `document.querySelectorAll('.t-btn.close').forEach(b=>b.click()); document.getElementById('startBtn').click(); true`
    ).catch(() => {});
    await sleep(700);
    await shot(desktopWin, 'smoke-start.png');
    await desktopWin.webContents.executeJavaScript(`document.getElementById('startBtn').click(); true`).catch(() => {});

    desktopWin.webContents.send('pool:start');
    await sleep(2700);
    await shot(desktopWin, 'smoke-pool.png');
    await desktopWin.webContents.executeJavaScript("document.getElementById('hudExit').click(); true").catch(() => {});
    await sleep(400);

    // 忙碌模式：假工作页
    await desktopWin.webContents.executeJavaScript(
      `(() => { document.getElementById('tfTray').click();
        const b = document.querySelector('#tfMenu button[data-act="busy"]');
        if (b) b.click(); return true; })()`
    ).catch(() => {});
    await sleep(2900);
    await shot(desktopWin, 'smoke-busy.png');

    const busyText = await desktopWin.webContents.executeJavaScript(
      `(() => { const w = document.querySelector('.win[data-key="busy-word"] .of-page');
        return w ? w.innerText.replace(/\\s+/g, ' ').slice(0, 90) : 'NO-WORD-WINDOW'; })()`
    ).catch((e) => 'ERR ' + e.message);
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[busy-word] ${busyText}\n`);

    await desktopWin.webContents.executeJavaScript(
      `(() => { document.getElementById('tfTray').click();
        const b = document.querySelector('#tfMenu button[data-act="busy"]');
        if (b) b.click(); return true; })()`
    ).catch(() => {});
    await sleep(700);

    // 右键菜单回归：子菜单不能残留
    const menuCheck = await desktopWin.webContents.executeJavaScript(`(async () => {
      const ctx = document.getElementById('ctxMenu');
      const desktop = document.getElementById('desktop');
      const fire = (el, type, x, y) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x || 100, clientY: y || 100 }));
      const itemsOf = () => Array.from(ctx.children).filter((n) => n.classList.contains('ctx-item'));
      const out = {};

      fire(desktop, 'contextmenu', 320, 320);
      out.menuOpen = !ctx.classList.contains('hidden');
      fire(itemsOf().find((n) => n.textContent.includes('排序方式')), 'mouseenter');
      out.subOpen = !!document.querySelector('.ctx-sub');

      // ① 点主菜单里的叶子项（刷新）——子菜单必须一起消失
      fire(itemsOf().find((n) => n.textContent.includes('刷新')), 'click');
      out.afterLeafClick = { main: ctx.classList.contains('hidden'), sub: !!document.querySelector('.ctx-sub') };

      // ② 右键 + 悬停子菜单 + 点空白 —— 两者都必须消失
      fire(desktop, 'contextmenu', 380, 380);
      fire(itemsOf().find((n) => n.textContent.includes('排序方式')), 'mouseenter');
      fire(document.getElementById('wallpaper'), 'mousedown', 900, 620);
      out.afterBlank = { main: ctx.classList.contains('hidden'), sub: !!document.querySelector('.ctx-sub') };

      // ③ 右键菜单悬停后点「查看 → 大图标」子菜单项
      fire(desktop, 'contextmenu', 400, 400);
      fire(itemsOf().find((n) => n.textContent.includes('查看')), 'mouseenter');
      const sub = document.querySelector('.ctx-sub');
      out.subHasView = !!sub && sub.textContent.includes('大图标');
      return out;
    })()`).catch((e) => ({ error: e.message }));
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[menu-check] ${JSON.stringify(menuCheck)}\n`);

    // 右键菜单外观截图（含二级子菜单）
    await desktopWin.webContents.executeJavaScript(`(() => {
      const desktop = document.getElementById('desktop');
      desktop.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 200 }));
      const rows = Array.from(document.getElementById('ctxMenu').children).filter((n) => n.classList.contains('ctx-item'));
      const sort = rows.find((n) => n.textContent.includes('排序方式'));
      sort.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      return true;
    })()`).catch(() => {});
    await sleep(400);
    await shot(desktopWin, 'smoke-menu.png');
    await desktopWin.webContents.executeJavaScript(
      `document.getElementById('wallpaper').dispatchEvent(new MouseEvent('mousedown',{bubbles:true})); true`
    ).catch(() => {});
    await sleep(200);

    // 右键图标 →「属性」→ 虚拟桌面内置浏览器（真实链路）
    const propCheck = await desktopWin.webContents.executeJavaScript(`(() => {
      const icon = document.querySelector('.icon[data-id="this-pc"]');
      icon.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 60, clientY: 80 }));
      const ctx = document.getElementById('ctxMenu');
      const row = Array.from(ctx.children).find((n) => n.textContent.includes('属性'));
      if (!row) return { ok: false, reason: 'no-property-row' };
      row.click();
      return { ok: true };
    })()`).catch((e) => ({ ok: false, reason: e.message }));
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[prop-check] ${JSON.stringify(propCheck)}\n`);
    await sleep(6500);
    await shot(desktopWin, 'smoke-web.png');

    const webInfo = await desktopWin.webContents.executeJavaScript(`(() => {
      const w = document.querySelector('.win[data-key^="web-"]');
      if (!w) return { found: false };
      const url = (w.querySelector('.wb-url') || {}).value;
      const v = w.querySelector('webview');
      return { found: true, url: url, title: (w.querySelector('.t-title') || {}).textContent };
    })()`).catch((e) => ({ error: e.message }));
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[web-info] ${JSON.stringify(webInfo)}\n`);

    // 窗口拖拽缩放回归：右下角把手 +120 / +90
    const resizeCheck = await desktopWin.webContents.executeJavaScript(`(() => {
      const w = document.querySelector('.win[data-key^="web-"]');
      if (!w) return { ok: false };
      const grip = w.querySelector('.rh-se');
      if (!grip) return { ok: false, reason: 'no-handle' };
      const b = w.getBoundingClientRect();
      grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: b.right - 3, clientY: b.bottom - 3 }));
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: b.right + 117, clientY: b.bottom + 87 }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      const a = w.getBoundingClientRect();
      return { ok: true, before: [Math.round(b.width), Math.round(b.height)], after: [Math.round(a.width), Math.round(a.height)] };
    })()`).catch((e) => ({ ok: false, reason: e.message }));
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[resize-check] ${JSON.stringify(resizeCheck)}\n`);

    hideDesktop();
    await sleep(500);
    const s = createSettings();
    s.show();
    s.focus();
    await sleep(1500);
    await shot(s, 'smoke-settings.png');

    const clickRes = await s.webContents.executeJavaScript(
      `(() => { const b = document.querySelector('.nav-item[data-page=icons]'); if(!b) return 'no-button';
        b.click(); return (document.querySelector('#content h1') || {}).textContent; })()`
    ).catch((e) => 'ERR ' + e.message);
    fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[icons-click] ${clickRes}\n`);
    await sleep(1200);
    await shot(s, 'smoke-icons.png');

    await s.webContents.executeJavaScript(
      `(() => { const b = document.querySelector('.nav-item[data-page=personalize]'); if (b) b.click(); return true; })()`
    ).catch(() => {});
    await sleep(1200);
    await shot(s, 'smoke-wallpaper.png');
  } catch (e) {
    try {
      fs.appendFileSync(path.join(OUT_DIR, 'smoke.log'), `[fatal] ${e.message}\n`);
    } catch {}
  } finally {
    app.isQuitting = true;
    setTimeout(() => app.exit(0), 200);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (isShown) return;
    openSettings();
  });

  app.whenReady().then(() => {
    store.init();
    registerWallpaperProtocol();
    registerIpc();
    createTray();
    startHotkey();
    createDesktop();

    if (!isSilent) {
      if (store.get().tray.startWithWindows) {
        // 开机自启时静默驻留
      } else {
        openSettings();
      }
    }

    if (process.argv.includes('--smoke')) runSmokeTest();

    screen.on('display-metrics-changed', () => {
      if (desktopWin && !desktopWin.isDestroyed()) desktopWin.setBounds(screen.getPrimaryDisplay().bounds);
    });

    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createDesktop();
    });
  });

  app.on('window-all-closed', (e) => {
    if (!app.isQuitting) e.preventDefault && e.preventDefault();
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
    stopWatcher();
    globalShortcut.unregisterAll();
  });
}
