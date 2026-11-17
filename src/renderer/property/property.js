/* touch fish · 网站属性二级窗口 */
(function () {
  const TF = window.TF;
  const $ = (s) => document.querySelector(s);
  const ICONS = TF.icons || [];
  const ICON_MAP = Object.fromEntries(ICONS.map((i) => [i.id, i]));

  const params = new URLSearchParams(location.search);
  let data = {};
  try {
    data = JSON.parse(params.get('data') || '{}');
  } catch {}

  const url = data.url || 'about:blank';
  const name = data.name || '网站';

  const iconUrl = (id) => {
    const it = ICON_MAP[id] || ICON_MAP.link;
    if (it.file) return '../../../' + it.file;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg);
  };

  $('#siteIcon').src = iconUrl(data.icon || 'link');
  $('#siteName').textContent = name;
  $('#address').textContent = url;
  document.title = `${name} - 属性`;

  const view = $('#view');
  const fill = $('#loadFill');
  const fallback = $('#fallback');

  let viewReady = false;
  let pendingUrl = null;

  function load(target) {
    fallback.classList.add('hidden');
    $('#address').textContent = target;
    if (viewReady && typeof view.loadURL === 'function') {
      view.loadURL(target).catch(() => fallback.classList.remove('hidden'));
    } else {
      pendingUrl = target;
    }
  }

  view.addEventListener('dom-ready', () => {
    if (!viewReady) {
      viewReady = true;
      if (pendingUrl) {
        const u = pendingUrl;
        pendingUrl = null;
        try {
          view.loadURL(u).catch(() => {});
        } catch {}
      }
    }
  });

  view.addEventListener('did-start-loading', () => {
    fill.style.opacity = '1';
    fill.style.width = '24%';
    setTimeout(() => {
      if (fill.style.width === '24%') fill.style.width = '68%';
    }, 320);
  });
  view.addEventListener('did-stop-loading', () => {
    fill.style.width = '100%';
    setTimeout(() => {
      fill.style.opacity = '0';
      fill.style.width = '0';
    }, 320);
  });
  ['did-finish-load','did-fail-load','dom-ready'].forEach((ev) => {
    view.addEventListener(ev, (e) => {
      console.log('[webview]', ev, JSON.stringify({ code: e && e.errorCode, desc: e && e.errorDescription, url: view.getURL && view.getURL() }));
    });
  });
  view.addEventListener('did-fail-load', (e) => {
    if (e.errorCode === -3) return; // 主动取消
    fallback.classList.remove('hidden');
  });
  view.addEventListener('page-title-updated', (e) => {
    const t = e.title || name;
    $('#address').textContent = view.getURL() || url;
    document.title = `${t} - 属性`;
  });

  // 站内点击新窗口：仍然交给内嵌视图打开
  view.addEventListener('new-window', (e) => {
    e.preventDefault();
    load(e.url);
  });

  $('#btnBack').onclick = () => {
    try { if (view.canGoBack()) view.goBack(); } catch {}
  };
  $('#btnForward').onclick = () => {
    try { if (view.canGoForward()) view.goForward(); } catch {}
  };
  $('#btnReload').onclick = () => {
    try { view.reload(); } catch { load(url); }
  };
  $('#btnHome').onclick = () => load(url);
  $('#btnExternal').onclick = () => TF.openExternal(view.getURL() || url);
  $('#fbOpen').onclick = () => TF.openExternal(url);

  $('#btnMin').onclick = () => TF.windowMinimize();
  $('#btnMax').onclick = () => TF.windowMaximize();
  $('#btnClose').onclick = () => TF.windowClose();

  TF.onReload((d) => {
    if (!d) return;
    data = d;
    $('#siteName').textContent = d.name || name;
    $('#siteIcon').src = iconUrl(d.icon || 'link');
    load(d.url);
  });

  load(url);
})();
