/* touch fish · 设置窗口逻辑 */
(function () {
  const TF = window.TF;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  window.addEventListener('error', (e) => {
    console.error('[tf-settings-error]', e.message, `${e.filename}:${e.lineno}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    console.error('[tf-settings-promise]', r && (r.stack || r.message || String(r)));
  });

  const ICONS = TF.icons || [];
  const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]));
  const iconUrl = (id) => {
    const it = ICON_MAP[id] || ICON_MAP.link;
    if (it.file) return '../../../' + it.file;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg);
  };

  let config = null;
  let meta = null;
  let page = 'general';
  let capture = null;
  let iconTarget = 'app';

  const PRESETS = [
    { id: 'ctrl2', label: '连按两次 Ctrl', desc: '最顺手，双手不用离开键盘', mode: 'sequence', sequence: ['CTRL', 'CTRL'] },
    { id: 'alt2', label: '连按两次 Alt', desc: '避开部分输入法的 Ctrl 占用', mode: 'sequence', sequence: ['ALT', 'ALT'] },
    { id: 'shift2', label: '连按两次 Shift', desc: '低调安静，适合开放工位', mode: 'sequence', sequence: ['SHIFT', 'SHIFT'] },
    { id: 'f9x2', label: '连按两次 F9', desc: '功能键，几乎零冲突', mode: 'sequence', sequence: ['F9', 'F9'] },
    { id: 'csq', label: 'Ctrl + Shift + Q', desc: '组合键一次到位', mode: 'combo', accelerator: 'Control+Shift+Q' },
    { id: 'altTick', label: 'Alt + `', desc: '手感接近传统老板键', mode: 'combo', accelerator: 'Alt+`' }
  ];

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function isPresetActive(p) {
    if (!config) return false;
    if (config.hotkey.mode !== p.mode) return false;
    if (p.mode === 'combo') return config.hotkey.accelerator === p.accelerator;
    return JSON.stringify(config.hotkey.sequence) === JSON.stringify(p.sequence);
  }

  /* ------------------------------------------------------------ 页面渲染 */

  function renderGeneral() {
    const hk = meta.hotkeyLabel;
    return `
      <h1 class="page-title">常规</h1>
      <div class="page-sub">touch fish · 一套能随时切走的 Windows 10 伪装桌面</div>

      <div class="card">
        <h3>当前切换方式</h3>
        <p class="desc">在任何程序中都能触发，不会打断你正在做的事。</p>
        <div class="row">
          <span class="kbd">${hk}</span>
          <span class="muted">进入 / 返回虚拟桌面</span>
          <span class="grow"></span>
          <button class="btn" data-goto="hotkey">修改快捷键</button>
        </div>
        <div class="row">
          <span class="kbd">${meta.panicLabel}</span>
          <span class="muted">一键隐藏（桌面 + 所有内嵌窗口）</span>
        </div>
      </div>

      <div class="card">
        <h3>摸鱼模式一览</h3>
        <p class="desc">虚拟桌面里包含真实的 Win10 桌面图标、任务栏、开始菜单与可拖拽窗口。</p>
        <div class="row">
          <div class="grow">
            <div class="label">台球小游戏</div>
            <div class="muted">此电脑 = 白球，应用图标 = 彩球，回收站 = 球洞</div>
          </div>
          <button class="btn primary" id="btnPool">开始台球</button>
        </div>
        <div class="row">
          <div class="grow">
            <div class="label">网站收藏</div>
            <div class="muted">小说 / 视频站点放进虚拟桌面，右键「属性」用内置浏览器打开</div>
          </div>
          <button class="btn" data-goto="sites">去添加</button>
        </div>
        <div class="row">
          <div class="grow">
            <div class="label">忙碌模式</div>
            <div class="muted">一键在桌面上铺开 Word / 剪辑 / PS / 代码 四个假工作窗口</div>
          </div>
          <button class="switch ${(config.desktop || {}).busyMode ? 'on' : ''}" data-busy="1"></button>
        </div>
        <div class="row">
          <div class="grow">
            <div class="label">桌面壁纸</div>
            <div class="muted">${((config.desktop || {}).wallpaper || 'hero') === 'hero' ? '当前为 Windows 10 默认壁纸' : '当前为自定义图片'}</div>
          </div>
          <button class="btn" data-goto="personalize">更换壁纸</button>
        </div>
        <div class="row">
          <div class="grow">
            <div class="label">图标伪装</div>
            <div class="muted">主程序与桌面图标都能换成 Windows 10 原生图标</div>
          </div>
          <button class="btn" data-goto="icons">打开图标库</button>
        </div>
      </div>

      <div class="card">
        <h3>使用提示</h3>
        <ul class="note-list">
          <li>连按两次 <b>Ctrl</b> 进入虚拟桌面，再连按两次返回真实桌面。</li>
          <li>右下角托盘鲸鱼图标里可以随时「返回真实桌面 / 一键隐藏 / 退出」。</li>
          <li>窗口支持拖拽、最小化、最大化、关闭，双击标题栏最大化。</li>
          <li>桌面图标可以拖动位置，松手后自动记忆。</li>
        </ul>
      </div>`;
  }

  function renderHotkey() {
    return `
      <h1 class="page-title">快捷键</h1>
      <div class="page-sub">设置进入 / 返回虚拟桌面的组合键。修改后立即生效，无需重启。</div>

      <div class="card">
        <h3>当前生效</h3>
        <div class="row">
          <span class="kbd" style="min-width:auto">${meta.hotkeyLabel}</span>
          <span class="muted">按一次进入，再按一次返回</span>
          <span class="grow"></span>
          <span class="tag">运行中</span>
        </div>
      </div>

      <div class="card">
        <h3>选择切换方式</h3>
        <p class="desc">连续按同一个键更隐蔽；组合键响应更直接。</p>
        <div class="preset-grid">
          ${PRESETS.map((p) => `
            <button class="preset ${isPresetActive(p) ? 'active' : ''}" data-preset="${p.id}">
              <span class="check">✓</span>
              <b>${p.label}</b>
              <small>${p.desc}</small>
            </button>`).join('')}
          <button class="preset" data-preset="custom">
            <span class="check">✓</span>
            <b>自定义…</b>
            <small>连续按 2—3 次任意键，或按一个组合键</small>
          </button>
        </div>
        <div id="captureArea"></div>
      </div>

      <div class="card">
        <h3>连击间隔</h3>
        <p class="desc">两次按键之间允许的最长间隔，越小越不容易误触。</p>
        <div class="row">
          <input type="range" id="gapRange" min="200" max="800" step="20" value="${config.hotkey.gap}" style="flex:1" />
          <span class="kbd" id="gapLabel">${config.hotkey.gap} 毫秒</span>
        </div>
      </div>

      <div class="card">
        <h3>一键隐藏</h3>
        <p class="desc">紧急情况下立刻收掉虚拟桌面与所有内嵌窗口，只留下托盘图标。</p>
        <div class="row">
          <span class="kbd">${meta.panicLabel}</span>
          <span class="grow"></span>
          <button class="btn" id="btnCapturePanic">修改组合键</button>
        </div>
      </div>`;
  }

  function renderSites() {
    const rows = (config.sites || [])
      .map((s, i) => `
        <div class="site-row" data-idx="${i}">
          <img class="s-ico" src="${iconUrl(s.icon)}" />
          <input type="text" data-field="name" value="${escapeAttr(s.name)}" placeholder="站点名称" />
          <input type="text" data-field="url" value="${escapeAttr(s.url)}" placeholder="https://example.com" />
          <select data-field="icon">
            ${['novel', 'video', 'bilibili', 'youtube', 'music', 'link', 'chrome', 'edge']
              .map((id) => `<option value="${id}" ${s.icon === id ? 'selected' : ''}>${ICON_MAP[id].label}</option>`)
              .join('')}
          </select>
          <div class="ops">
            <button class="mini" data-op="up" title="上移">↑</button>
            <button class="mini" data-op="down" title="下移">↓</button>
            <button class="mini" data-op="del" title="删除">✕</button>
          </div>
        </div>`)
      .join('');

    return `
      <h1 class="page-title">网站收藏</h1>
      <div class="page-sub">把你常看的小说 / 视频站点塞进虚拟桌面，右键「属性」就能内嵌打开，也能直接跳浏览器。</div>

      <div class="card">
        <h3>已收藏（${(config.sites || []).length}）</h3>
        <p class="desc">名称与 URL 会自动保存并同步到虚拟桌面、开始菜单与托盘「网站收藏」菜单。</p>
        <div class="site-head"><span></span><span>名称</span><span>网址 URL</span><span>图标</span><span style="text-align:right">操作</span></div>
        <div id="siteList">${rows || '<div class="muted" style="padding:18px 0">还没有收藏，点下方按钮添加。</div>'}</div>
        <div class="row" style="margin-top:14px">
          <button class="btn primary" id="btnAddSite">＋ 添加网站</button>
          <span class="muted" id="siteSaveState">修改后自动保存</span>
        </div>
      </div>

      <div class="card">
        <h3>提示</h3>
        <ul class="note-list">
          <li>网址可以省略 <code>https://</code>，保存时会自动补全。</li>
          <li>部分站点禁止被内嵌（如某些视频站），此时请点「在浏览器中打开」。</li>
          <li>收藏数量建议 4—8 个，桌面上会以图标形式排列。</li>
        </ul>
      </div>`;
  }

  function wallpaperUrl() {
    const p = (config.desktop || {}).wallpaper || 'hero';
    if (p && p !== 'hero') return `tfwall://wallpaper/?v=${Date.now()}`;
    return '../../../assets/wallpaper.jpg';
  }

  function renderPersonalize() {
    const custom = ((config.desktop || {}).wallpaper || 'hero') !== 'hero';
    return `
      <h1 class="page-title">个性化</h1>
      <div class="page-sub">换一张自己的壁纸，虚拟桌面看起来才更像「你自己那台电脑」。</div>

      <div class="card">
        <h3>桌面壁纸</h3>
        <p class="desc">支持 JPG / PNG / WebP / BMP。图片会复制到本地配置目录，不上传、不联网。</p>
        <div class="wall-preview"><img src="${wallpaperUrl()}" alt="壁纸预览" /></div>
        <div class="row" style="margin-top:12px">
          <button class="btn primary" id="btnPickWall">选择图片…</button>
          <button class="btn" id="btnResetWall">恢复 Windows 10 默认</button>
          <span class="grow"></span>
          <span class="muted">${custom ? '当前：自定义图片' : '当前：Windows 10 Hero 壁纸'}</span>
        </div>
      </div>

      <div class="card">
        <h3>换个壁纸的小建议</h3>
        <ul class="note-list">
          <li>建议用 1920×1080 或更高的横图，会自动铺满、不拉伸变形。</li>
          <li>深色、低对比的图片更耐看，远处扫一眼也不容易看出破绽。</li>
          <li>虚拟桌面空白处右键 →「更换壁纸…」也能直接换。</li>
        </ul>
      </div>`;
  }

  function renderIcons() {
    const targets = [
      { value: 'app', label: '主程序图标（托盘 / 设置窗口）' },
      ...TF.baseItems.map((it) => ({ value: 'item:' + it.id, label: '桌面 · ' + it.name })),
      ...(config.sites || []).map((s) => ({ value: 'item:site-' + s.id, label: '桌面 · ' + s.name }))
    ];
    const selectVal = iconTarget;
    const current = selectVal === 'app' ? config.icons.app : (config.icons.desktop || {})[selectVal.slice(5)];
    const groups = {};
    ICONS.forEach((i) => {
      groups[i.group] = groups[i.group] || [];
      groups[i.group].push(i);
    });

    return `
      <h1 class="page-title">图标库</h1>
      <div class="page-sub">Windows 10 原生风格图标，选中心仪图标即点即换，立即生效并写入本地配置。</div>

      <div class="card">
        <h3>当前预览</h3>
        <div class="preview-line">
          <img src="${iconUrl(current)}" id="curIconPreview" />
          <div>
            <div class="pv-name" id="curIconName">${(ICON_MAP[current] || {}).label || '自定义'}</div>
            <div class="pv-sub">应用对象：${targets.find((t) => t.value === selectVal).label}</div>
          </div>
          <span class="grow" style="flex:1"></span>
          <button class="btn" id="btnResetIcon">恢复默认</button>
        </div>
        <div class="row" style="margin-top:6px">
          <span class="muted">更换对象</span>
          <select id="iconTarget" style="min-width:280px">
            ${targets.map((t) => `<option value="${t.value}" ${t.value === selectVal ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="card">
        <h3>可用图标</h3>
        <p class="desc">共 ${ICONS.length} 个图标，覆盖系统、办公、通讯与娱乐场景。</p>
        ${Object.entries(groups).map(([g, list]) => `
          <div class="icon-group-title">${g}</div>
          <div class="icon-grid">
            ${list.map((i) => `
              <button class="icon-cell ${i.id === current ? 'active' : ''}" data-icon="${i.id}" title="${i.label}">
                <img src="${iconUrl(i.id)}" />
                <span>${i.label}</span>
              </button>`).join('')}
          </div>`).join('')}
      </div>`;
  }

  function renderTray() {
    return `
      <h1 class="page-title">托盘与启动</h1>
      <div class="page-sub">让 touch fish 安静地待在系统托盘里，需要时一键唤出。</div>

      <div class="card">
        <h3>系统托盘</h3>
        <div class="row">
          <div class="grow">
            <div class="label">托盘显示摸鱼状态</div>
            <div class="muted">鼠标悬停托盘图标时提示「摸鱼中 / 待命」</div>
          </div>
          <button class="switch ${config.tray.showStatus ? 'on' : ''}" data-switch="showStatus"></button>
        </div>
        <div class="row">
          <div class="grow">
            <div class="label">关闭设置窗口时保留在托盘</div>
            <div class="muted">关闭后快捷键与托盘继续工作，不会退出程序</div>
          </div>
          <button class="switch ${config.tray.closeToTray ? 'on' : ''}" data-switch="closeToTray"></button>
        </div>
      </div>

      <div class="card">
        <h3>开机启动</h3>
        <div class="row">
          <div class="grow">
            <div class="label">开机后自动驻留托盘</div>
            <div class="muted">静默启动，不弹任何窗口，连按快捷键即可进入摸鱼</div>
          </div>
          <button class="switch ${config.tray.startWithWindows ? 'on' : ''}" data-switch="startWithWindows"></button>
        </div>
      </div>

      <div class="card">
        <h3>托盘菜单</h3>
        <ul class="note-list">
          <li>左键单击托盘图标：切换虚拟桌面</li>
          <li>右键菜单：状态提示 / 返回真实桌面 / 一键隐藏 / 网站收藏 / 设置 / 退出</li>
          <li>托盘图标会跟随「主程序图标」的伪装设置变化</li>
        </ul>
        <div class="row" style="margin-top:10px">
          <button class="btn" id="btnOpenData">打开配置目录</button>
          <button class="btn" data-goto="icons">更换托盘图标</button>
        </div>
      </div>`;
  }

  function renderAbout() {
    return `
      <h1 class="page-title">关于与卸载</h1>
      <div class="page-sub">touch fish ${meta.version} · 本地运行，配置只存在你自己的电脑上</div>

      <div class="card">
        <h3>程序信息</h3>
        <div class="row"><span class="muted" style="width:90px">版本</span><span>${meta.version}</span></div>
        <div class="row"><span class="muted" style="width:90px">安装位置</span><span id="installPath" style="font-size:11.5px;color:#555;word-break:break-all">${meta.exe || ''}</span></div>
        <div class="row"><span class="muted" style="width:90px">配置目录</span><span style="font-size:11.5px;color:#555;word-break:break-all">${meta.userData}</span></div>
        <div class="row" style="margin-top:12px">
          <button class="btn" id="btnDir">打开安装目录</button>
          <button class="btn" id="btnCfg">打开配置目录</button>
        </div>
      </div>

      <div class="card">
        <h3>卸载</h3>
        <p class="desc">推荐使用 Windows「设置 → 应用 → touch fish → 卸载」，或直接点下面的按钮。卸载不会删除你的个人配置。</p>
        <div class="row">
          <button class="btn danger" id="btnUninstall">卸载 touch fish</button>
          <span class="muted">卸载程序：安装目录下的 Uninstall touch fish.exe</span>
        </div>
        <ul class="note-list" style="margin-top:10px">
          <li>手动卸载：删除安装目录，并删除桌面 / 开始菜单快捷方式。</li>
          <li>彻底清理：再删除 <code>%APPDATA%\\touch fish</code> 配置目录。</li>
        </ul>
      </div>

      <div class="card">
        <h3>恢复默认</h3>
        <p class="desc">清空快捷键、网站收藏、图标与位置等全部本地配置。</p>
        <div class="row">
          <button class="btn danger" id="btnResetAll">恢复默认设置</button>
          <span class="muted">操作不可撤销，请谨慎</span>
        </div>
      </div>`;
  }

  function escapeAttr(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  /* ------------------------------------------------------------- 渲染调度 */

  const PAGES = {
    general: renderGeneral,
    hotkey: renderHotkey,
    personalize: renderPersonalize,
    sites: renderSites,
    icons: renderIcons,
    tray: renderTray,
    about: renderAbout
  };

  function render() {
    $('#content').innerHTML = PAGES[page]();
    bindPage();
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
    $('#navHotkey').textContent = meta.hotkeyLabel;
    $('#footHint').textContent = `${meta.hotkeyLabel} 随时切换`;
  }

  function go(p) {
    page = p;
    render();
    $('#content').scrollTop = 0;
  }

  /* --------------------------------------------------------------- 事件绑定 */

  function bindPage() {
    $$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));

    if (page === 'general') {
      const poolBtn = $('#btnPool');
      if (poolBtn) poolBtn.onclick = () => TF.startPool();

      const busySwitch = $('[data-busy]');
      if (busySwitch) busySwitch.onclick = async () => {
        const next = !busySwitch.classList.contains('on');
        busySwitch.classList.toggle('on', next);
        const res = await TF.patchConfig({ desktop: { ...(config.desktop || {}), busyMode: next } });
        config = res.config;
        toast(next ? '忙碌模式已开启：进入虚拟桌面就能看到工作页' : '忙碌模式已关闭');
      };
    }

    if (page === 'personalize') bindPersonalizePage();
    if (page === 'hotkey') bindHotkeyPage();
    if (page === 'sites') bindSitesPage();
    if (page === 'icons') bindIconsPage();
    if (page === 'tray') bindTrayPage();
    if (page === 'about') bindAboutPage();
  }

  function bindHotkeyPage() {
    $$('.preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.preset;
        if (id === 'custom') return startCapture();
        const p = PRESETS.find((x) => x.id === id);
        applyHotkey({ mode: p.mode, sequence: p.sequence || [], accelerator: p.accelerator || '', gap: config.hotkey.gap });
      });
    });

    const gap = $('#gapRange');
    if (gap) {
      gap.oninput = () => ($('#gapLabel').textContent = gap.value + ' 毫秒');
      gap.onchange = async () => {
        await TF.patchConfig({ hotkey: { ...config.hotkey, gap: Number(gap.value) } });
        toast('连击间隔已更新');
      };
    }

    const panicBtn = $('#btnCapturePanic');
    if (panicBtn) panicBtn.onclick = () => startPanicCapture();
  }

  async function applyHotkey(hk) {
    const res = await TF.patchConfig({ hotkey: { ...config.hotkey, ...hk } });
    config = res.config;
    meta = res.meta;
    toast('已生效：' + meta.hotkeyLabel);
    render();
  }

  /* --------------------------------------------------------------- 个性化 */

  function bindPersonalizePage() {
    const pick = $('#btnPickWall');
    if (pick) pick.onclick = async () => {
      const res = await TF.chooseWallpaper();
      if (!res || res.canceled) return;
      if (!res.ok) return toast(res.message || '壁纸设置失败');
      const r2 = await TF.getConfig();
      config = r2.config;
      meta = r2.meta;
      toast('壁纸已更换');
      render();
    };

    const reset = $('#btnResetWall');
    if (reset) reset.onclick = async () => {
      await TF.resetWallpaper();
      const r2 = await TF.getConfig();
      config = r2.config;
      meta = r2.meta;
      toast('已恢复 Windows 10 默认壁纸');
      render();
    };
  }

  /* --------------------------------------------------------- 快捷键捕获 */

  function keyToken(e) {
    const k = e.key;
    if (k === 'Control') return 'CTRL';
    if (k === 'Alt') return 'ALT';
    if (k === 'Shift') return 'SHIFT';
    if (k === 'Meta') return 'WIN';
    if (k === '`') return '`';
    if (k === ' ') return 'SPACE';
    if (/^F\d{1,2}$/i.test(k)) return k.toUpperCase();
    if (/^[a-zA-Z]$/.test(k)) return k.toUpperCase();
    if (/^[0-9]$/.test(k)) return k;
    return null;
  }

  function labelForSequence(tokens) {
    const map = { CTRL: 'Ctrl', ALT: 'Alt', SHIFT: 'Shift', WIN: 'Win', SPACE: '空格' };
    const t = tokens.map((x) => map[x] || x);
    if (t.length === 2 && t[0] === t[1]) return `连按两次 ${t[0]}`;
    if (t.length === 3 && t[1] === t[2] && t[0] === t[2]) return `连按三次 ${t[0]}`;
    return t.join(' → ');
  }

  function startCapture() {
    const area = $('#captureArea');
    if (!area) return;
    capture = { tokens: [], timer: null, kind: 'hotkey' };
    area.innerHTML = `
      <div class="capture-box" id="capBox">
        <span>请按下你想使用的按键</span>
        <b id="capPreview">等待输入…</b>
        <span class="muted">连续按 2—3 次同一个键，或按 Ctrl/Alt + 字母 的组合</span>
        <div class="cap-actions">
          <button class="btn" id="capCancel">取消</button>
        </div>
      </div>`;
    $('#capCancel').onclick = cancelCapture;
    $('#captureArea').scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function startPanicCapture() {
    const card = $('#btnCapturePanic').closest('.card');
    capture = { tokens: [], timer: null, kind: 'panic' };
    let box = card.querySelector('.capture-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'capture-box';
      card.appendChild(box);
    }
    box.innerHTML = `
      <span>按下一个组合键作为「一键隐藏」</span>
      <b id="capPreview">等待输入…</b>
      <div class="cap-actions"><button class="btn" id="capCancel">取消</button></div>`;
    $('#capCancel').onclick = cancelCapture;
  }

  function cancelCapture() {
    if (capture && capture.timer) clearTimeout(capture.timer);
    capture = null;
    const box = $('#capBox');
    if (box) box.closest('#captureArea').innerHTML = '';
    const p = $('#capPreview');
    if (p) p.closest('.capture-box').remove();
  }

  function updateCapturePreview() {
    const el = $('#capPreview');
    if (!el || !capture) return;
    const t = capture.tokens;
    if (!t.length) return;
    el.textContent = labelForSequence(t);
  }

  function finishCapture() {
    if (!capture) return;
    const tokens = capture.tokens;
    const kind = capture.kind;
    if (tokens.length >= 2 && tokens.every((t) => t === tokens[0])) {
      if (kind === 'panic') {
        cancelCapture();
        toast('一键隐藏需要组合键（例如 Ctrl + Alt + H）');
        return;
      }
      const hk = { mode: 'sequence', sequence: tokens.slice(0, 3), accelerator: '', gap: config.hotkey.gap };
      capture = null;
      applyHotkey(hk);
      return;
    }
    cancelCapture();
  }

  window.addEventListener('keydown', (e) => {
    if (!capture) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat) return;
    const token = keyToken(e);
    if (!token) return;

    const isMod = ['CTRL', 'ALT', 'SHIFT', 'WIN'].includes(token);
    const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;

    if (!isMod && hasMod) {
      // 组合键
      const parts = [];
      if (e.ctrlKey) parts.push('Control');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Super');
      parts.push(token.length === 1 ? token : token);
      const acc = parts.join('+');
      const label = acc.replace('Control', 'Ctrl').replace('Super', 'Win').replace(/\+/g, ' + ');
      if (capture.kind === 'panic') {
        capture = null;
        TF.patchConfig({ panic: { accelerator: acc, label } }).then((res) => {
          config = res.config;
          meta = res.meta;
          toast('一键隐藏已改为 ' + label);
          render();
        });
      } else {
        capture = null;
        applyHotkey({ mode: 'combo', accelerator: acc, sequence: [], label });
      }
      return;
    }

    capture.tokens.push(token);
    updateCapturePreview();
    clearTimeout(capture.timer);
    capture.timer = setTimeout(finishCapture, 900);
  }, true);

  /* ------------------------------------------------------------- 网站收藏 */

  let saveTimer;
  function bindSitesPage() {
    const list = $('#siteList');
    const persist = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        const sites = Array.from(list.querySelectorAll('.site-row')).map((row, i) => ({
          id: (config.sites[i] && config.sites[i].id) || 's-' + Date.now() + '-' + i,
          name: row.querySelector('[data-field="name"]').value.trim() || '未命名',
          url: normalizeUrl(row.querySelector('[data-field="url"]').value.trim()),
          icon: row.querySelector('[data-field="icon"]').value
        }));
        const res = await TF.saveSites(sites);
        config = res;
        const st = $('#siteSaveState');
        if (st) {
          st.textContent = '已保存 ' + new Date().toLocaleTimeString('zh-CN');
        }
      }, 500);
    };

    if (list) {
      list.addEventListener('input', persist);
      list.addEventListener('change', persist);
      list.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-op]');
        if (!btn) return;
        const row = btn.closest('.site-row');
        const idx = Number(row.dataset.idx);
        const sites = (config.sites || []).slice();
        if (btn.dataset.op === 'del') sites.splice(idx, 1);
        if (btn.dataset.op === 'up' && idx > 0) [sites[idx - 1], sites[idx]] = [sites[idx], sites[idx - 1]];
        if (btn.dataset.op === 'down' && idx < sites.length - 1) [sites[idx + 1], sites[idx]] = [sites[idx], sites[idx + 1]];
        TF.saveSites(sites).then((res) => {
          config = res;
          render();
        });
      });
    }

    const add = $('#btnAddSite');
    if (add) add.onclick = async () => {
      const sites = (config.sites || []).concat([{ id: 's-' + Date.now(), name: '新收藏', url: 'https://', icon: 'link' }]);
      const res = await TF.saveSites(sites);
      config = res;
      render();
      toast('已添加，填写名称与网址即可');
    };
  }

  function normalizeUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    return 'https://' + u;
  }

  /* --------------------------------------------------------------- 图标库 */

  function bindIconsPage() {
    const sel = $('#iconTarget');
    if (sel) sel.onchange = () => {
      iconTarget = sel.value;
      renderIconsTarget(iconTarget);
    };

    $$('.icon-cell').forEach((cell) => {
      cell.onclick = async () => {
        const target = (document.querySelector('#iconTarget') || {}).value || iconTarget;
        const iconId = cell.dataset.icon;
        await TF.setIcon(
          target === 'app'
            ? { scope: 'app', iconId }
            : { scope: 'item', itemId: target.slice(5), iconId }
        );
        const res = await TF.getConfig();
        config = res.config;
        meta = res.meta;
        toast(`已应用「${ICON_MAP[iconId].label}」`);
        renderIconsTarget(target);
      };
    });

    const reset = $('#btnResetIcon');
    if (reset) reset.onclick = async () => {
      const target = (document.querySelector('#iconTarget') || {}).value || iconTarget;
      if (target === 'app') {
        await TF.setIcon({ scope: 'app', iconId: 'whale' });
      } else {
        const itemId = target.slice(5);
        const def = TF.baseItems.find((i) => i.id === itemId);
        await TF.setIcon({ scope: 'item', itemId, iconId: def ? def.icon : 'link' });
      }
      const res = await TF.getConfig();
      config = res.config;
      toast('已恢复默认图标');
      renderIconsTarget(target);
    };
  }

  function renderIconsTarget(targetValue) {
    iconTarget = targetValue || iconTarget;
    page = 'icons';
    render();
    $('#content').scrollTop = 0;
  }

  /* ----------------------------------------------------------------- 托盘 */

  function bindTrayPage() {
    $$('[data-switch]').forEach((btn) => {
      btn.onclick = async () => {
        const key = btn.dataset.switch;
        const next = !btn.classList.contains('on');
        btn.classList.toggle('on', next);
        if (key === 'startWithWindows') {
          const ok = await TF.setLogin(next);
          if (!ok) toast('开机启动设置失败，请检查系统权限');
        } else {
          await TF.patchConfig({ tray: { [key]: next } });
        }
        const res = await TF.getConfig();
        config = res.config;
        toast('已更新');
      };
    });

    const open = $('#btnOpenData');
    if (open) open.onclick = () => TF.openUserData();
  }

  /* ----------------------------------------------------------------- 关于 */

  function bindAboutPage() {
    const d = $('#btnDir');
    if (d) d.onclick = () => TF.openInstallDir();
    const c = $('#btnCfg');
    if (c) c.onclick = () => TF.openUserData();

    const un = $('#btnUninstall');
    if (un) un.onclick = async () => {
      const ok = window.confirm('确定要卸载 touch fish 吗？卸载后会关闭当前程序。');
      if (!ok) return;
      const res = await TF.uninstall();
      if (res && res.ok === false) toast(res.message || '已打开安装目录');
    };

    const reset = $('#btnResetAll');
    if (reset) reset.onclick = async () => {
      if (!window.confirm('确定恢复全部默认设置吗？网站收藏与图标伪装都会被清空。')) return;
      const res = await TF.resetConfig();
      config = res.config;
      meta = res.meta;
      toast('已恢复默认设置');
      render();
    };
  }

  /* ----------------------------------------------------------------- 启动 */

  function bindChrome() {
    $('#btnMin').onclick = () => TF.windowMinimize();
    $('#btnMax').onclick = () => TF.windowMaximize();
    $('#btnClose').onclick = () => TF.windowClose();
    $('#btnEnter').onclick = () => TF.toggleDesktop();
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => go(b.dataset.page)));
  }

  async function init() {
    const res = await TF.getConfig();
    config = res.config;
    meta = res.meta;
    bindChrome();
    render();

    TF.onConfigChanged((payload) => {
      config = payload.config;
      meta = payload.meta;
      $('#navHotkey').textContent = meta.hotkeyLabel;
      $('#footHint').textContent = `${meta.hotkeyLabel} 随时切换`;
      if (page !== 'sites' && page !== 'icons') render();
      else if (page === 'icons') renderIconsTarget((document.querySelector('#iconTarget') || {}).value || 'app');
    });
  }

  init();
})();
