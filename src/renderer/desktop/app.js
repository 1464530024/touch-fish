/* touch fish · 虚拟桌面主逻辑 */
(function () {
  const TF = window.TF;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  window.addEventListener('error', (e) => {
    console.error('[tf-error]', e.message, `${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    console.error('[tf-promise]', r && (r.stack || r.message || String(r)));
  });

  let config = null;
  let meta = null;
  let items = [];
  let wm = null;
  let pool = null;
  let poolMode = false;
  let busyOn = false;
  let busyTimers = [];

  const APP_TPL = {
    'app-chrome': 'browser',
    'app-edge': 'browser',
    'app-wechat': 'chat',
    'app-dingtalk': 'chat',
    'app-netease': 'media',
    'app-word': 'doc',
    'app-notepad': 'doc',
    'app-explorer': 'explorer'
  };

  const TILE_COLORS = [
    'linear-gradient(135deg,#0a5ca8,#1f8fe0)',
    'linear-gradient(135deg,#1f6f43,#35a35f)',
    'linear-gradient(135deg,#7a3fb0,#a666d8)',
    'linear-gradient(135deg,#a8452c,#d9694a)',
    'linear-gradient(135deg,#1c6b78,#33a3b3)',
    'linear-gradient(135deg,#8a6b13,#d0a92c)',
    'linear-gradient(135deg,#3d4a58,#6d7d8e)',
    'linear-gradient(135deg,#8c1f4a,#c93f7a)'
  ];

  /* ------------------------------------------------------------ 工具函数 */

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.classList.add('hidden'), 200);
    }, 2200);
  }

  function iconFor(id) {
    const it = (TF.icons || []).find((i) => i.id === id) || TF.icons[0];
    if (it.file) return '../../../' + it.file;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg || '');
  }

  function buildItems() {
    const list = TF.baseItems.map((it) => ({
      ...it,
      icon: (config.icons.desktop && config.icons.desktop[it.id]) || it.icon
    }));
    (config.sites || []).forEach((s) => {
      list.push({
        id: 'site-' + s.id,
        name: s.name,
        icon: s.icon || 'link',
        type: 'site',
        role: 'ball',
        url: s.url,
        siteId: s.id
      });
    });
    return list;
  }

  /* -------------------------------------------------------------- 壁纸 */

  function applyWallpaper() {
    const el = $('#wallpaper');
    if (!el) return;
    const p = (config.desktop && config.desktop.wallpaper) || '';
    if (p && p !== 'hero') {
      el.style.backgroundImage = `url("tfwall://wallpaper/?v=${Date.now()}")`;
    } else {
      el.style.backgroundImage = '';
    }
  }

  async function chooseWallpaper() {
    const res = await TF.chooseWallpaper();
    if (!res || res.canceled) return;
    if (!res.ok) return toast(res.message || '壁纸设置失败');
    toast('壁纸已更换');
  }

  /* -------------------------------------------------------------- 图标渲染 */

  function renderIcons() {
    const layer = $('#desktop');
    layer.innerHTML = '';
    items = buildItems();

    items.forEach((it, idx) => {
      const el = document.createElement('div');
      el.className = 'icon';
      el.dataset.id = it.id;
      const pos = (config.layout || {})[it.id];
      if (pos) {
        el.style.gridColumn = pos.col + '';
        el.style.gridRow = pos.row + '';
      }
      el.innerHTML = `<img class="glyph" src="${iconFor(it.icon)}" alt="" draggable="false" />
        <span class="label">${it.name}</span>`;
      layer.appendChild(el);

      el.addEventListener('mousedown', (e) => onIconMouseDown(e, it, el));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectIcon(el);
        showIconMenu(e.clientX, e.clientY, it);
      });
      el.addEventListener('dblclick', () => openItem(it));
      el.addEventListener('click', () => selectIcon(el));
    });
  }

  function selectIcon(el) {
    $$('.icon').forEach((n) => n.classList.remove('selected'));
    if (el) el.classList.add('selected');
  }

  function onIconMouseDown(e, it, el) {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let raf = 0;

    const move = (ev) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) {
        moved = true;
        el.style.zIndex = 40;
        el.style.position = 'relative';
      }
      if (moved) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
        });
      }
    };

    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      cancelAnimationFrame(raf);
      if (!moved) return;
      const rect = el.getBoundingClientRect();
      const col = Math.max(1, Math.round((rect.left - 4) / 84) + 1);
      const row = Math.max(1, Math.round((rect.top - 6) / 96) + 1);
      el.style.transform = '';
      el.style.gridColumn = col + '';
      el.style.gridRow = row + '';
      el.style.zIndex = '';
      saveLayout();
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  function saveLayout() {
    const layout = {};
    $$('.icon').forEach((el) => {
      layout[el.dataset.id] = {
        col: parseInt(el.style.gridColumn, 10) || 1,
        row: parseInt(el.style.gridRow, 10) || 1
      };
    });
    TF.saveLayout(layout);
    config.layout = layout;
  }

  /* ---------------------------------------------------------- 内置浏览器 */

  function defaultSiteUrl() {
    const s = (config.sites || [])[0];
    return (s && s.url) || 'https://www.qidian.com';
  }

  /** 在虚拟桌面里打开内置浏览器窗口（可拖拽缩放） */
  function openWebWindow(url, opts = {}) {
    const target = url || defaultSiteUrl();
    const key = 'web-' + (opts.id || target);
    const availW = window.innerWidth;
    const availH = window.innerHeight - 40;
    const w = Math.max(560, Math.min(1180, Math.round(availW * 0.72)));
    const h = Math.max(400, Math.min(820, Math.round(availH * 0.76)));
    wm.open(key, {
      title: opts.name || '属性',
      icon: opts.icon || 'link',
      tpl: 'web',
      url: target,
      width: w,
      height: h,
      left: Math.round((availW - w) / 2),
      top: Math.max(8, Math.round((availH - h) / 2)),
      minW: 520,
      minH: 340
    });
    return key;
  }

  /* ---------------------------------------------------------------- 打开项 */

  function openItem(it) {
    closeMenus();
    if (it.type === 'site') {
      openWebWindow(it.url, { id: it.id, name: it.name, icon: it.icon });
      return;
    }
    if (it.id === 'this-pc') {
      wm.open('this-pc', { title: '此电脑', icon: 'this-pc', width: 960, height: 600, tpl: 'explorer' });
      return;
    }
    if (it.id === 'recycle-bin') {
      wm.open('recycle-bin', { title: '回收站', icon: 'recycle-bin', width: 860, height: 520, tpl: 'recycle' });
      return;
    }
    const tpl = APP_TPL[it.id] || 'chat';
    const sizes = {
      browser: { width: 1000, height: 660 },
      chat: { width: 880, height: 580 },
      media: { width: 900, height: 600 },
      doc: { width: 880, height: 680 },
      store: { width: 980, height: 620 }
    };
    const s = sizes[tpl] || { width: 880, height: 580 };
    wm.open(it.id, { title: it.name, icon: it.icon, tpl, ...s });
  }

  /* -------------------------------------------------------------- 右键菜单 */

  let subEl = null;

  /** 关掉主菜单 + 子菜单 + 触摸鱼菜单（唯一出口，避免残留孤儿菜单） */
  function closeMenus() {
    const main = $('#ctxMenu');
    if (main) main.classList.add('hidden');
    if (subEl) {
      subEl.remove();
      subEl = null;
    }
    const tf = $('#tfMenu');
    if (tf) tf.classList.add('hidden');
  }

  function showMenu(x, y, rows) {
    closeMenus();
    const menu = $('#ctxMenu');
    menu.innerHTML = '';
    rows.forEach((r) => {
      if (r === '-') {
        const sep = document.createElement('div');
        sep.className = 'ctx-sep';
        menu.appendChild(sep);
        return;
      }
      const item = document.createElement('div');
      item.className = 'ctx-item' + (r.disabled ? ' disabled' : '');
      item.innerHTML = `<span>${r.label}</span>${r.children ? '<span class="arrow">▸</span>' : ''}`;
      if (!r.disabled) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          if (r.children) {
            const rect = item.getBoundingClientRect();
            showSubMenu(rect.right - 4, rect.top - 3, r.children);
            return;
          }
          closeMenus();
          r.action && r.action();
        });
        if (r.children) {
          item.addEventListener('mouseenter', () => {
            const rect = item.getBoundingClientRect();
            showSubMenu(rect.right - 4, rect.top - 3, r.children);
          });
        }
      }
      menu.appendChild(item);
    });
    menu.classList.remove('hidden');
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    menu.style.left = Math.min(x, window.innerWidth - mw - 6) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - mh - 46) + 'px';
  }

  function showSubMenu(x, y, rows) {
    if (subEl) subEl.remove();
    subEl = document.createElement('div');
    subEl.className = 'ctx-sub';
    subEl.style.cssText = `position:fixed;min-width:150px;background:#f2f2f2;border:1px solid #cfcfcf;
      box-shadow:0 6px 22px rgba(0,0,0,.28);padding:3px 0;z-index:901;font-size:12px;`;
    const inner = document.createElement('div');
    rows.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'ctx-item';
      item.textContent = r.label;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenus();
        r.action && r.action();
      });
      inner.appendChild(item);
    });
    subEl.appendChild(inner);
    document.body.appendChild(subEl);
    subEl.style.left = Math.min(x, window.innerWidth - subEl.offsetWidth - 6) + 'px';
    subEl.style.top = Math.min(y, window.innerHeight - subEl.offsetHeight - 46) + 'px';
  }

  function showDesktopMenu(x, y) {
    showMenu(x, y, [
      {
        label: '查看',
        children: [
          { label: '大图标', action: () => setIconSize(56) },
          { label: '中图标', action: () => setIconSize(46) },
          { label: '小图标', action: () => setIconSize(38) }
        ]
      },
      {
        label: '排序方式',
        children: [
          { label: '名称', action: () => resetLayout() },
          { label: '项目类型', action: () => resetLayout() },
          { label: '项目', action: () => resetLayout() }
        ]
      },
      { label: '刷新', action: () => { document.body.style.opacity = '.86'; setTimeout(() => (document.body.style.opacity = ''), 90); toast('已刷新'); } },
      {
        label: '新建',
        children: [
          { label: '文件夹', action: () => toast('已创建「新建文件夹」') },
          { label: '文本文档', action: () => toast('已创建「新建文本文档.txt」') }
        ]
      },
      '-',
      { label: poolMode ? '退出台球模式' : '台球模式（摸鱼小游戏）', action: () => togglePool(!poolMode) },
      { label: busyOn ? '关闭忙碌模式（收起工作页）' : '忙碌模式（铺满工作页面）', action: () => toggleBusy() },
      '-',
      { label: '更换壁纸…', action: () => chooseWallpaper() },
      { label: '显示设置', action: () => TF.openSettings() },
      { label: '个性化', action: () => chooseWallpaper() },
      '-',
      { label: '关于 touch fish', action: () => toast('touch fish 1.0 · 摸鱼专用虚拟桌面') }
    ]);
  }

  function resetLayout() {
    config.layout = {};
    TF.saveLayout({}).then(() => {
      renderIcons();
      toast('已重新排列桌面图标');
    });
  }

  function setIconSize(px) {
    document.documentElement.style.setProperty('--glyph', px + 'px');
    $$('.glyph').forEach((g) => (g.style.width = px + 'px'));
    $$('.glyph').forEach((g) => (g.style.height = px + 'px'));
  }

  function showIconMenu(x, y, it) {
    const rows = [
      { label: '打开', action: () => openItem(it) },
      { label: '属性（内置浏览器）', action: () => openProperty(it) }
    ];
    if (it.type === 'site') {
      rows.splice(1, 0, { label: '打开网页（内置浏览器）', action: () => openWebWindow(it.url, { id: it.id, name: it.name, icon: it.icon }) });
      rows.push({ label: '在系统浏览器中打开', action: () => TF.openExternal(it.url) });
      rows.push('-');
      rows.push({ label: '删除此收藏', action: () => removeSite(it.siteId) });
    }
    rows.push('-');
    rows.push({ label: '更换图标…', action: () => { TF.openSettings(); toast('已打开设置 · 图标库'); } });
    showMenu(x, y, rows);
  }

  /**
   * 「属性」统一走虚拟桌面内置浏览器：
   * 收藏站点直接打开自己的网址；普通图标打开第一个收藏（默认起点中文网）。
   */
  function openProperty(it) {
    if (it.type === 'site') {
      openWebWindow(it.url, { id: it.id, name: it.name, icon: it.icon });
      return;
    }
    const site = (config.sites || [])[0];
    openWebWindow(site ? site.url : defaultSiteUrl(), {
      name: site ? site.name : '网页',
      icon: site ? site.icon : 'link'
    });
  }

  async function removeSite(siteId) {
    const sites = (config.sites || []).filter((s) => s.id !== siteId);
    await TF.saveSites(sites);
    toast('已删除该收藏');
  }

  /* -------------------------------------------------------------- 忙碌模式 */

  const BUSY_WINDOWS = [
    {
      key: 'busy-word', title: '2026年第四季度经营分析报告.docx - Word', icon: 'word', tpl: 'word',
      w: 0.49, h: 0.465, x: 0.006, y: 0.008
    },
    {
      key: 'busy-vscode', title: 'touch-fish - Visual Studio Code', icon: 'vscode', tpl: 'vscode',
      w: 0.49, h: 0.465, x: 0.502, y: 0.008
    },
    {
      key: 'busy-pr', title: '宣传片_v7.prproj - Premiere Pro', icon: 'video', tpl: 'premiere',
      w: 0.49, h: 0.484, x: 0.006, y: 0.49
    },
    {
      key: 'busy-ps', title: '主视觉_终稿.psd @ 66.7% - Photoshop', icon: 'photos', tpl: 'photoshop',
      w: 0.49, h: 0.484, x: 0.502, y: 0.49
    }
  ];

  function deployBusy() {
    const availW = window.innerWidth;
    const availH = window.innerHeight - 40;
    busyTimers.forEach(clearTimeout);
    busyTimers = [];
    BUSY_WINDOWS.forEach((cfg, i) => {
      busyTimers.push(setTimeout(() => {
        if (!busyOn) return;
        wm.open(cfg.key, {
          title: cfg.title,
          icon: cfg.icon,
          tpl: cfg.tpl,
          width: Math.round(availW * cfg.w),
          height: Math.round(availH * cfg.h),
          left: Math.round(availW * cfg.x),
          top: Math.round(availH * cfg.y)
        });
      }, i * 120));
    });
  }

  function closeBusy() {
    busyTimers.forEach(clearTimeout);
    busyTimers = [];
    BUSY_WINDOWS.forEach((cfg) => wm.close(cfg.key, false));
  }

  function syncBusy(want) {
    if (want === busyOn) return;
    busyOn = want;
    if (want) deployBusy();
    else closeBusy();
  }

  async function toggleBusy() {
    const next = !busyOn;
    syncBusy(next);
    await TF.patchConfig({ desktop: { ...(config.desktop || {}), busyMode: next } });
    toast(next ? '忙碌模式已开启：桌面上已铺好工作页面' : '忙碌模式已关闭：工作页面已收起');
  }

  /* -------------------------------------------------------------- 开始菜单 */

  function buildStartMenu() {
    const apps = items.filter((i) => i.id !== 'recycle-bin');
    const recent = apps.slice(0, 5);

    $('#smRecent').innerHTML = recent
      .map((i) => `<div class="sm-item" data-id="${i.id}"><img src="${iconFor(i.icon)}"/><span>${i.name}</span></div>`)
      .join('');

    const extra = [
      { id: '__pool', name: '台球模式', icon: 'games' },
      { id: '__busy', name: '忙碌模式', icon: 'word' },
      { id: '__settings', name: 'touch fish 设置', icon: 'settings' }
    ];
    const all = apps.concat(extra);
    $('#smApps').innerHTML = all
      .map((i) => `<div class="sm-item" data-id="${i.id}"><img src="${iconFor(i.icon)}"/><span>${i.name}</span></div>`)
      .join('');

    const tiles = [
      { id: 'this-pc', name: '此电脑', icon: 'this-pc', color: 0 },
      { id: '__pool', name: '台球模式', icon: 'games', color: 3 },
      { id: '__busy', name: '忙碌模式', icon: 'word', color: 4 },
      { id: 'app-chrome', name: '浏览器', icon: 'chrome', color: 1 },
      { id: 'app-wechat', name: '微信', icon: 'wechat', color: 2 },
      { id: 'app-netease', name: '音乐', icon: 'netease', color: 7 },
      { id: '__settings', name: '设置', icon: 'settings', color: 6 }
    ].concat((config.sites || []).slice(0, 2).map((s, i) => ({
      id: 'site-' + s.id, name: s.name, icon: s.icon || 'link', color: (i + 2) % 8, url: s.url
    })));

    $('#smTiles').innerHTML = tiles
      .map((t, idx) => `<div class="tile ${idx === 0 ? 'wide' : ''}" data-id="${t.id}" style="background:${TILE_COLORS[t.color]}">
          <img src="${iconFor(t.icon)}" /><b>${t.name}</b></div>`)
      .join('');

    $$('#smTiles .tile, #smApps .sm-item, #smRecent .sm-item').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        closeStart();
        if (id === '__pool') return togglePool(true);
        if (id === '__busy') return toggleBusy();
        if (id === '__settings') return TF.openSettings();
        const it = items.find((i) => i.id === id);
        if (it) openItem(it);
      });
    });

    $('#smSearch').oninput = (e) => {
      const q = e.target.value.trim().toLowerCase();
      $$('#smApps .sm-item').forEach((el) => {
        el.style.display = !q || el.textContent.toLowerCase().includes(q) ? 'flex' : 'none';
      });
    };
    $('#smPower').onclick = () => toast('摸鱼模式下已禁用电源操作，安心摸鱼');
  }

  function openStart() {
    buildStartMenu();
    $('#startMenu').classList.remove('hidden');
    $('#startBtn').classList.add('active');
    setTimeout(() => $('#smSearch').focus(), 60);
  }
  function closeStart() {
    $('#startMenu').classList.add('hidden');
    $('#startBtn').classList.remove('active');
  }
  function toggleStart() {
    if ($('#startMenu').classList.contains('hidden')) openStart();
    else closeStart();
  }

  /* ---------------------------------------------------------------- 台球 */

  function togglePool(on) {
    if (on && !poolMode) {
      const list = items.map((it) => ({
        id: it.id,
        role: it.role,
        name: it.name,
        iconUrl: iconFor(it.icon)
      }));

      poolMode = true;
      document.body.classList.add('pool-mode');
      $('#poolHud').classList.remove('hidden');
      closeStart();
      closeMenus();

      pool = pool || new PoolGame($('#poolCanvas'));
      pool.onScore = (n) => {
        $('#hudScore').textContent = `进球 ${n}`;
        if (n > 0) TF.stats('pockets');
      };
      pool.onHint = (kind) => {
        if (kind === 'aim') toast('松开击球 · 拖动越远力度越大');
      };
      pool.onPower = (p) => {
        const fill = $('#powerFill');
        if (fill) fill.style.width = Math.round(p * 100) + '%';
      };
      pool.mount(list);
      $('#hudReset').onclick = () => {
        pool.reset();
        pool.preloadIcons();
        toast('已重新开局');
      };
      $('#hudExit').onclick = () => togglePool(false);
      toast('台球模式：长按【此电脑】白球，向后拖拽蓄力');
    } else if (!on && poolMode) {
      poolMode = false;
      document.body.classList.remove('pool-mode');
      $('#poolHud').classList.add('hidden');
      if (pool) pool.unmount();
    }
  }

  /* ------------------------------------------------------------ 任务栏等 */

  function updateClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    $('#clockTime').textContent = `${hh}:${mm}`;
    $('#clockDate').textContent = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
  }

  function bindTaskbar() {
    $('#startBtn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleStart();
    });
    $('#searchBox').addEventListener('click', (e) => {
      e.stopPropagation();
      openStart();
    });
    $('#taskViewBtn').addEventListener('click', () => {
      const keys = Array.from(wm.wins.keys());
      if (!keys.length) return toast('当前没有打开的窗口');
      keys.forEach((k, i) => setTimeout(() => (wm.wins.get(k).minimized ? wm.restore(k) : wm.focus(k)), i * 40));
    });
    $('#showDesktopBar').addEventListener('click', () => {
      wm.wins.forEach((rec) => wm.minimize(rec.key));
    });
    $('#notifyBtn').addEventListener('click', () => toast('通知：今天也要开心摸鱼 🐟'));
    $('#trayExpand').addEventListener('click', () => toast(`touch fish · ${meta ? meta.hotkeyLabel : ''} 可切换桌面`));
    $('#clock').addEventListener('click', () => toast(new Date().toLocaleString('zh-CN')));

    $('#tfTray').addEventListener('click', (e) => {
      e.stopPropagation();
      const m = $('#tfMenu');
      const willShow = m.classList.contains('hidden');
      closeMenus();
      if (willShow) {
        m.classList.remove('hidden');
        $('#tfStatus').textContent = busyOn ? '摸鱼模式：忙碌伪装中' : '摸鱼模式：已开启';
        $('#kbdHotkey').textContent = meta ? meta.hotkeyLabel : '';
      }
    });

    $$('#tfMenu button').forEach((b) => {
      b.addEventListener('click', async () => {
        const act = b.dataset.act;
        closeMenus();
        if (act === 'hide') {
          await TF.hideDesktop();
        } else if (act === 'panic') {
          await TF.hideAll();
        } else if (act === 'pool') {
          togglePool(true);
        } else if (act === 'busy') {
          toggleBusy();
        } else if (act === 'settings') {
          TF.openSettings();
        } else if (act === 'quit') {
          TF.quit();
        }
      });
    });
  }

  function bindGlobal() {
    // 菜单关闭统一放在 mousedown 捕获阶段：click 可能被拖动/默认行为吞掉
    document.addEventListener('mousedown', (e) => {
      const t = e.target;
      if (!t.closest('#ctxMenu') && !t.closest('.ctx-sub')) {
        const main = $('#ctxMenu');
        if (main) main.classList.add('hidden');
        if (subEl) {
          subEl.remove();
          subEl = null;
        }
      }
      if (!t.closest('#tfMenu') && !t.closest('#tfTray')) {
        const tf = $('#tfMenu');
        if (tf) tf.classList.add('hidden');
      }
    }, true);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#startMenu') && !e.target.closest('#startBtn') && !e.target.closest('#searchBox')) closeStart();
      if (e.target.id === 'desktop' || e.target.id === 'wallpaper') selectIcon(null);
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target.closest('#taskbar') || e.target.closest('#startMenu')) return;
      if (e.target.closest('.icon')) return;
      showDesktopMenu(e.clientX, e.clientY);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenus();
        closeStart();
      }
    });

    // 失焦（比如切到真实桌面）时把菜单全部收掉，避免残留
    window.addEventListener('blur', () => {
      closeMenus();
      closeStart();
    });

    document.addEventListener('tf:shown', () => {
      if (!localStorage.getItem('tf-hint-shown')) {
        localStorage.setItem('tf-hint-shown', '1');
        setTimeout(() => toast('已进入虚拟桌面 · 连按两次 Ctrl 或点右下角鲸鱼图标返回'), 600);
      }
    });

    document.addEventListener('tf:web', (e) => {
      const d = e.detail || {};
      openWebWindow(d.url, { id: d.id, name: d.name, icon: d.icon });
    });
  }

  function applyConfig(payload) {
    config = payload.config;
    meta = payload.meta || meta;
    applyWallpaper();
    renderIcons();
    $('#kbdHotkey').textContent = meta.hotkeyLabel;
    if (poolMode) $('#hudExit').textContent = '退出台球';
    syncBusy(!!(config.desktop && config.desktop.busyMode));
  }

  async function init() {
    const res = await TF.getConfig();
    config = res.config;
    meta = res.meta;
    wm = new WindowManager({ layer: $('#windowLayer'), taskbarEl: $('#tbApps') });
    pool = new PoolGame($('#poolCanvas'));

    applyWallpaper();
    renderIcons();
    bindTaskbar();
    bindGlobal();
    updateClock();
    setInterval(updateClock, 15000);
    $('#kbdHotkey').textContent = meta.hotkeyLabel;

    TF.onConfigChanged((payload) => applyConfig(payload));

    document.addEventListener('tf:shown', () => {
      closeStart();
      closeMenus();
      // 从真实桌面回来时，忙碌模式的窗口要重新铺上去
      if (busyOn) deployBusy();
    });

    document.addEventListener('tf:pool', () => togglePool(true));

    if (config.desktop && config.desktop.busyMode) syncBusy(true);

    setTimeout(() => {
      if (!localStorage.getItem('tf-hint-shown')) {
        localStorage.setItem('tf-hint-shown', '1');
        toast('已进入虚拟桌面 · 连按两次 Ctrl 或点右下角鲸鱼图标返回');
      }
    }, 900);
  }

  init();
})();
