/* touch fish · 虚拟桌面窗口系统（拖拽 / 最小化 / 最大化 / 关闭 / 八向缩放 / 内置浏览器） */
(function () {
  const iconUrl = (id) => {
    const it = (window.TF.icons || []).find((i) => i.id === id) || window.TF.icons[0] || {};
    if (it.file) return '../../../' + it.file;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg || '');
  };
  window.iconUrl = iconUrl;

  const GLYPH = {
    min: '<svg viewBox="0 0 10 10"><path d="M0 5h10"/></svg>',
    max: '<svg viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9"/></svg>',
    restore: '<svg viewBox="0 0 10 10"><rect x="0.5" y="2.5" width="7" height="7"/><path d="M2.5 2.5V0.5h7v7h-2"/></svg>',
    close: '<svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10"/></svg>',
    back: '<svg viewBox="0 0 16 16"><path d="M10.5 2.5L5 8l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    fwd: '<svg viewBox="0 0 16 16"><path d="M5.5 2.5L11 8l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    reload: '<svg viewBox="0 0 16 16"><path d="M13 8a5 5 0 1 1-1.6-3.7" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M13.4 1.8v3.4H10" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    home: '<svg viewBox="0 0 16 16"><path d="M2.5 7.4L8 2.6l5.5 4.8V14H9.8v-3.6H6.2V14H2.5z" fill="currentColor"/></svg>'
  };

  const BUSY_ICON = {
    word: 'word',
    premiere: 'video',
    photoshop: 'photos',
    vscode: 'vscode'
  };

  /* --------------------------------------------------------- 窗口内容模板 */

  const driveRow = (letter, label, total, used, low) => `
    <div class="drive">
      <img src="${iconUrl('drive')}" alt="" />
      <div>
        <b>${label} (${letter}:)</b>
        <div class="bar ${low ? 'low' : ''}"><i style="width:${used}%"></i></div>
        <small>${Math.round((total * (100 - used)) / 100)} GB 可用，共 ${total} GB</small>
      </div>
    </div>`;

  /* -------- 假工作页：Word -------- */
  const WORD_DOC = `
    <div class="of-page">
      <div class="of-brand">内部资料 · 请勿外传</div>
      <h1>2026 年第四季度经营分析报告</h1>
      <p>本季度整体业务保持稳定增长，核心业务交付量与去年同期相比提升约 18%，区域拓展完成年度目标的 76%。以下从收入结构、交付产能与渠道转化三个维度展开分析。</p>
      <h2>一、收入结构</h2>
      <p>主营收入仍以咨询服务与内容授权为主，两者合计占比 81.4%，其中内容授权业务环比增长 9.2 个百分点，主要来自新签约的 12 家合作机构。</p>
      <table class="of-table">
        <thead><tr><th>业务板块</th><th>本季收入（万元）</th><th>环比</th><th>占比</th></tr></thead>
        <tbody>
          <tr><td>咨询服务</td><td>1,286.4</td><td>+6.1%</td><td>52.3%</td></tr>
          <tr><td>内容授权</td><td>714.8</td><td>+9.2%</td><td>29.1%</td></tr>
          <tr><td>培训与运营服务</td><td>286.5</td><td>+3.4%</td><td>11.6%</td></tr>
          <tr><td>其他</td><td>171.2</td><td>-1.8%</td><td>7.0%</td></tr>
        </tbody>
      </table>
      <h2>二、交付产能</h2>
      <p>本季度累计交付 3,842 单，其中标准化方案 1,915 单，平均交付周期由 6.2 天缩短到 5.4 天，返工率下降明显。</p>
      <h2>三、下一步动作</h2>
      <p>四季度重点推进三件事：一是把区域资料库补齐到 31 个省份；二是完成合作机构的工具培训全覆盖；三是上线内部工作台 2.0，收敛重复劳动。</p>
      <p class="of-sign">拟稿：运营中心 · 2026 年 11 月</p>
    </div>`;

  /* -------- 假工作页：Premiere -------- */
  const PR_CLIPS = `
    <div class="pr-track"><b>V2</b><div class="pr-lane"><i style="left:2%;width:18%">字幕包装.mogrt</i><i style="left:22%;width:24%">片头动画</i></div></div>
    <div class="pr-track"><b>V1</b><div class="pr-lane">
      <i style="left:2%;width:14%">A001_C012</i><i style="left:16.4%;width:13%">A001_C015</i>
      <i style="left:29.8%;width:16%">B002_C003</i><i style="left:46.2%;width:12%">B002_C008</i>
      <i style="left:58.6%;width:18%">C003_C001</i><i style="left:77%;width:21%">片尾定版</i>
    </div></div>
    <div class="pr-track"><b>A1</b><div class="pr-lane"><i class="audio" style="left:2%;width:60%">访谈同期声.wav</i></div></div>
    <div class="pr-track"><b>A2</b><div class="pr-lane"><i class="audio" style="left:2%;width:96%">背景音乐_轻快.wav</i></div></div>`;

  /* -------- 假工作页：Photoshop -------- */
  const PS_LAYERS = `
    <div class="ps-layer on"><span class="eye">◉</span><i class="thumb"></i><span>主标题 · 中文</span></div>
    <div class="ps-layer on"><span class="eye">◉</span><i class="thumb t2"></i><span>人物 · 抠像</span></div>
    <div class="ps-layer on"><span class="eye">◉</span><i class="thumb t3"></i><span>光效叠加</span></div>
    <div class="ps-layer"><span class="eye">◌</span><i class="thumb t4"></i><span>参考图</span></div>
    <div class="ps-layer on"><span class="eye">◉</span><i class="thumb t5"></i><span>背景 · 渐变</span></div>`;

  /* -------- 假工作页：VS Code -------- */
  const VS_CODE = `
<span class="ln">1</span><span class="k">const</span> { app, BrowserWindow } = <span class="f">require</span>(<span class="s">'electron'</span>);
<span class="ln">2</span><span class="k">const</span> path = <span class="f">require</span>(<span class="s">'path'</span>);
<span class="ln">3</span>
<span class="ln">4</span><span class="c">// 创建虚拟桌面窗口</span>
<span class="ln">5</span><span class="k">function</span> <span class="f">createDesktop</span>() {
<span class="ln">6</span>  <span class="k">if</span> (desktopWin &amp;&amp; !desktopWin.<span class="f">isDestroyed</span>()) <span class="k">return</span> desktopWin;
<span class="ln">7</span>  <span class="k">const</span> { bounds } = screen.<span class="f">getPrimaryDisplay</span>();
<span class="ln">8</span>  desktopWin = <span class="k">new</span> <span class="t">BrowserWindow</span>({
<span class="ln">9</span>    x: bounds.x,
<span class="ln">10</span>    y: bounds.y,
<span class="ln">11</span>    width: bounds.width,
<span class="ln">12</span>    height: bounds.height,
<span class="ln">13</span>    frame: <span class="k">false</span>,
<span class="ln">14</span>    skipTaskbar: <span class="k">true</span>
<span class="ln">15</span>  });
<span class="ln">16</span>  desktopWin.<span class="f">loadFile</span>(path.<span class="f">join</span>(__dirname, <span class="s">'index.html'</span>));
<span class="ln">17</span>  <span class="k">return</span> desktopWin;
<span class="ln">18</span>}
<span class="ln">19</span>
<span class="ln">20</span><span class="k">export</span> { createDesktop };`;

  const TPL = {
    explorer: () => `
      <div class="exp-ribbon">
        <div class="exp-tabs"><span>文件</span><span class="active">计算机</span><span>查看</span></div>
        <div class="exp-tools">
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M3 6h7l2 2h9v11H3z"/></svg>新建文件夹</div>
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/></svg>属性</div>
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/></svg>打开</div>
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M4 4h16v6H4zm0 8h10v8H4zm12 0h4v8h-4z"/></svg>布局</div>
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M4 6h16v12H4z"/><path d="M8 10h8v4H8z" fill="#fff"/></svg>复制</div>
        </div>
      </div>
      <div class="exp-path"><span class="crumb">此电脑</span><span>›</span></div>
      <div class="exp-body">
        <aside class="exp-nav">
          <div class="nav-item"><img src="${iconUrl('folder')}"/>快速访问</div>
          <div class="nav-item active"><img src="${iconUrl('this-pc')}"/>此电脑</div>
          <div class="nav-item"><img src="${iconUrl('link')}"/>网络</div>
          <div class="nav-group">文件夹</div>
          <div class="nav-item"><img src="${iconUrl('user')}"/>桌面</div>
          <div class="nav-item"><img src="${iconUrl('downloads')}"/>下载</div>
          <div class="nav-item"><img src="${iconUrl('folder')}"/>文档</div>
          <div class="nav-item"><img src="${iconUrl('pictures')}"/>图片</div>
          <div class="nav-item"><img src="${iconUrl('video')}"/>视频</div>
        </aside>
        <main class="exp-main">
          <div class="group-title">设备和驱动器 (4)</div>
          <div class="drives">
            ${driveRow('C', '本地磁盘', 237, 62)}
            ${driveRow('D', '数据', 931, 48)}
            ${driveRow('E', '备份', 1863, 91, true)}
            <div class="drive">
              <img src="${iconUrl('folder')}" alt="" />
              <div><b>工作资料</b><small>网络位置</small></div>
            </div>
          </div>
        </main>
      </div>`,

    recycle: () => `
      <div class="exp-ribbon">
        <div class="exp-tabs"><span>文件</span><span class="active">主页</span><span>查看</span></div>
        <div class="exp-tools">
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg>清空回收站</div>
          <div class="exp-tool"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/></svg>还原所有项目</div>
        </div>
      </div>
      <div class="exp-path"><span class="crumb">回收站</span><span>›</span></div>
      <div class="exp-body">
        <aside class="exp-nav">
          <div class="nav-item"><img src="${iconUrl('folder')}"/>快速访问</div>
          <div class="nav-item active"><img src="${iconUrl('recycle-bin')}"/>回收站</div>
          <div class="nav-item"><img src="${iconUrl('this-pc')}"/>此电脑</div>
        </aside>
        <main class="empty-state">
          <img src="${iconUrl('recycle-bin')}" />
          <b>回收站为空</b>
          <span style="font-size:11.5px">台球模式下这里是球洞</span>
        </main>
      </div>`,

    chat: (name) => `
      <div class="app-shell">
        <aside class="app-side">
          <div class="row active"><span class="avatar">群</span><span>摸鱼交流群(8)</span></div>
          <div class="row"><span class="avatar">张</span><span>张三</span></div>
          <div class="row"><span class="avatar">李</span><span>李四 · 产品</span></div>
          <div class="row"><span class="avatar">王</span><span>王五 · 设计</span></div>
          <div class="row"><span class="avatar">部</span><span>部门通知</span></div>
        </aside>
        <div class="app-main">
          <div class="chat-row"><span class="avatar">张</span><div><b>张三</b><small>下午 14:22</small><div style="margin-top:4px">周报模板发群里了，今天 18 点前交一下</div></div></div>
          <div class="chat-row"><span class="avatar">李</span><div><b>李四</b><small>下午 14:31</small><div style="margin-top:4px">好的，我这边下午过一遍需求就写</div></div></div>
          <div class="chat-row"><span class="avatar">我</span><div><b>我</b><small>下午 14:33</small><div style="margin-top:4px">收到，正在整理数据 ~</div></div></div>
          <div style="color:#9aa4ad;font-size:11px;padding:10px 9px">（${name} · 演示窗口，所有内容均为本地静态渲染）</div>
        </div>
      </div>`,

    browser: (name) => `
      <div class="browser-bar">
        <div class="dots"><i></i><i></i><i></i></div>
        <span style="color:#5f6368">←</span><span style="color:#bdc1c6">→</span><span style="color:#5f6368">⟳</span>
        <div class="omnibox">🔒 新标签页</div>
        <span style="color:#5f6368">☆</span>
      </div>
      <div class="chrome-page">
        <div class="chrome-logo"><span>G</span><span>o</span><span>o</span><span>g</span><span>l</span><span>e</span></div>
        <div class="chrome-search">🔍 搜索 Google 或输入网址</div>
        <div class="chrome-shortcuts">
          <div class="shortcut"><i><img src="${iconUrl('bilibili')}"/></i>哔哩哔哩</div>
          <div class="shortcut"><i><img src="${iconUrl('novel')}"/></i>小说</div>
          <div class="shortcut"><i><img src="${iconUrl('netease')}"/></i>音乐</div>
          <div class="shortcut"><i><img src="${iconUrl('youtube')}"/></i>YouTube</div>
          <div class="shortcut"><i><img src="${iconUrl('steam')}"/></i>Steam</div>
        </div>
        <div style="color:#9aa0a6;font-size:11px">${name} · 新标签页</div>
      </div>`,

    media: () => `
      <div class="media-page">
        <div class="media-top">晚间摸鱼歌单 <span style="font-size:11px;opacity:.6">共 24 首</span></div>
        <div class="playlist">
          <div class="song"><i>01</i><span>若把你</span><span style="margin-left:auto;opacity:.5">03:42</span></div>
          <div class="song"><i>02</i><span>我记得</span><span style="margin-left:auto;opacity:.5">04:12</span></div>
          <div class="song"><i>03</i><span>悬溺</span><span style="margin-left:auto;opacity:.5">04:02</span></div>
          <div class="song"><i>04</i><span>晚风心里吹</span><span style="margin-left:auto;opacity:.5">03:28</span></div>
          <div class="song"><i>05</i><span>海底</span><span style="margin-left:auto;opacity:.5">04:20</span></div>
          <div class="song"><i>06</i><span>孤勇者</span><span style="margin-left:auto;opacity:.5">04:16</span></div>
        </div>
        <div class="player-bar">
          <span>⏮</span><span style="font-size:16px">▶</span><span>⏭</span>
          <div style="flex:1"><div style="font-size:11px;opacity:.85">若把你 — 刘珂矣</div><div class="bar" style="width:100%;background:rgba(255,255,255,.18);margin-top:5px"><i style="width:38%"></i></div></div>
          <span style="opacity:.6">🔊</span>
        </div>
      </div>`,

    doc: () => `
      <div class="ribbon-lite">
        <span style="color:#2b579a;font-weight:600">开始</span><span>插入</span><span>设计</span><span>布局</span><span>引用</span><span>审阅</span><span>视图</span>
        <span style="margin-left:auto;color:#777;font-size:11px">已保存到 OneDrive</span>
      </div>
      <div class="doc-page">
        <div class="page">
          <h1>本周工作周报</h1>
          <p>本周主要推进三件事：一是完成新版产品文案的梳理，将核心卖点收缩到 3 条以内；二是配合技术组完成线上系统的交互走查；三是整理了本周市场调研的资料。</p>
          <h2>一、本周进展</h2>
          <p>内容侧完成 12 篇稿件，平均阅读完成率提升 6%。技术侧修复了后台在弱网下的超时问题，重试逻辑改为指数退避。</p>
          <h2>二、下周计划</h2>
          <p>继续推进官网的页面结构，同时把素材库按区域—项目两级目录补齐。</p>
          <h2>三、风险与需要支持</h2>
          <p>素材版权确认流程仍偏慢，建议同步一份可商用素材清单。</p>
        </div>
      </div>`,

    store: () => `
      <div class="store-page">
        <div class="store-hero"><b>精选应用</b><p>本周为你推荐的生产力与摸鱼工具</p></div>
        <div class="store-grid">
          <div class="store-card"><img src="${iconUrl('vscode')}"/><div><b>Visual Studio Code</b><small>免费</small></div></div>
          <div class="store-card"><img src="${iconUrl('notepad')}"/><div><b>记事本</b><small>免费</small></div></div>
          <div class="store-card"><img src="${iconUrl('photos')}"/><div><b>照片</b><small>免费</small></div></div>
          <div class="store-card"><img src="${iconUrl('calculator')}"/><div><b>计算器</b><small>免费</small></div></div>
          <div class="store-card"><img src="${iconUrl('music')}"/><div><b>媒体播放器</b><small>免费</small></div></div>
          <div class="store-card"><img src="${iconUrl('shield')}"/><div><b>安全中心</b><small>系统</small></div></div>
        </div>
      </div>`,

    /* ------------------------------------------------ 内置浏览器（属性窗口） */
    web: (name, opts = {}) => `
      <div class="web-bar">
        <button class="wb-btn" data-nav="back" title="后退">${GLYPH.back}</button>
        <button class="wb-btn" data-nav="fwd" title="前进">${GLYPH.fwd}</button>
        <button class="wb-btn" data-nav="reload" title="刷新">${GLYPH.reload}</button>
        <button class="wb-btn" data-nav="home" title="首页">${GLYPH.home}</button>
        <div class="wb-urlwrap">
          <span class="wb-lock">🔒</span>
          <input class="wb-url" spellcheck="false" value="" />
        </div>
        <button class="wb-go">转到</button>
        <button class="wb-ext" title="在系统默认浏览器中打开">浏览器打开</button>
      </div>
      <div class="web-loading"><i></i></div>
      <div class="web-wrap" data-home="${(opts.url || '').replace(/"/g, '&quot;')}"></div>`,

    /* ------------------------------------------------------ 忙碌模式：Word */
    word: () => `
      <div class="of-ribbon">
        <div class="of-tabs">
          <span class="of-logo">W</span>
          <span class="on">开始</span><span>插入</span><span>设计</span><span>布局</span><span>引用</span>
          <span>邮件</span><span>审阅</span><span>视图</span><span>帮助</span>
          <span class="of-saved">已保存</span>
        </div>
        <div class="of-tools">
          <div class="of-group"><div class="of-btns"><b class="of-b1">粘贴</b></div><small>剪贴板</small></div>
          <div class="of-group">
            <div class="of-btns"><b>B</b><b class="i">I</b><b class="u">U</b><b class="s">S</b></div><small>字体</small>
          </div>
          <div class="of-group"><div class="of-btns"><b>正文</b><b>12</b></div><small>段落</small></div>
          <div class="of-group"><div class="of-btns"><b>•≡</b><b>1≡</b></div><small>样式</small></div>
        </div>
      </div>
      <div class="of-doc">${WORD_DOC}</div>
      <div class="of-status">
        <span>第 1 页，共 6 页</span>
        <span>2,184 个字</span>
        <span>中文(中国)</span>
        <span class="of-sp"></span>
        <span>100%</span>
      </div>`,

    /* -------------------------------------------------- 忙碌模式：Premiere */
    premiere: () => `
      <div class="pr-top">
        <span class="pr-logo">Pr</span>
        <span class="pr-menu">文件</span><span class="pr-menu">编辑</span><span class="pr-menu">剪辑</span>
        <span class="pr-menu">序列</span><span class="pr-menu">标记</span><span class="pr-menu">图形</span>
        <span class="pr-menu">视图</span><span class="pr-menu">窗口</span><span class="pr-menu">帮助</span>
        <span class="pr-name">宣传片_v7.prproj — Premiere Pro</span>
      </div>
      <div class="pr-body">
        <aside class="pr-left">
          <div class="pr-pt">项目：宣传片_v7</div>
          <div class="pr-tree">
            <div class="pr-f older">▾ 01_素材</div>
            <div class="pr-f">A001_C012.mp4</div>
            <div class="pr-f">A001_C015.mp4</div>
            <div class="pr-f">B002_C003.mp4</div>
            <div class="pr-f">C003_C001.mp4</div>
            <div class="pr-f older">▾ 02_音频</div>
            <div class="pr-f">访谈同期声.wav</div>
            <div class="pr-f">背景音乐_轻快.wav</div>
            <div class="pr-f older">▾ 03_包装</div>
            <div class="pr-f">片头动画.aep</div>
          </div>
          <div class="pr-pt">效果</div>
          <div class="pr-tree"><div class="pr-f">交叉溶解</div><div class="pr-f">Lumetri 颜色</div><div class="pr-f">变形稳定器</div></div>
        </aside>
        <div class="pr-center">
          <div class="pr-monitor">
            <div class="pr-frame">
              <div class="pr-scene"><span>企业宣传片 · 成片预览</span></div>
            </div>
            <div class="pr-ctrl"><span>00:00:12:08</span><span class="pr-sp"></span><span>25 fps</span><span>1920×1080</span></div>
          </div>
          <div class="pr-timeline">
            <div class="pr-ruler"><i style="left:6%">5s</i><i style="left:22%">10s</i><i style="left:38%">15s</i><i style="left:54%">20s</i><i style="left:70%">25s</i><i style="left:86%">30s</i></div>
            ${PR_CLIPS}
            <div class="pr-playhead"></div>
          </div>
        </div>
        <aside class="pr-right">
          <div class="pr-pt">效果控件</div>
          <div class="pr-prop"><span>位置</span><b>960.0</b><b>540.0</b></div>
          <div class="pr-prop"><span>缩放</span><b>100.0</b></div>
          <div class="pr-prop"><span>不透明度</span><b>100%</b></div>
          <div class="pr-pt">Lumetri 范围</div>
          <div class="pr-scopes"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        </aside>
      </div>`,

    /* ------------------------------------------------- 忙碌模式：Photoshop */
    photoshop: () => `
      <div class="ps-top">
        <span class="ps-logo">Ps</span>
        <span class="ps-menu">文件</span><span class="ps-menu">编辑</span><span class="ps-menu">图像</span>
        <span class="ps-menu">图层</span><span class="ps-menu">文字</span><span class="ps-menu">选择</span>
        <span class="ps-menu">滤镜</span><span class="ps-menu">视图</span><span class="ps-menu">窗口</span><span class="ps-menu">帮助</span>
      </div>
      <div class="ps-body">
        <div class="ps-tools">
          <b class="on">▣</b><b>↖</b><b>▭</b><b>◌</b><b>✎</b><b>◧</b><b>✂</b><b>T</b><b>✋</b><b>🔍</b>
          <div class="ps-fg"><i></i></div>
        </div>
        <div class="ps-center">
          <div class="ps-docbar"><span>主视觉_终稿.psd @ 66.7% (RGB/8) *</span></div>
          <div class="ps-canvas">
            <div class="ps-art">
              <div class="ps-art-bg"></div>
              <div class="ps-art-title">秋季新品<br />视觉提案</div>
              <div class="ps-art-sub">品牌主视觉 · 2026 秋季档</div>
              <div class="ps-art-badge">01</div>
            </div>
          </div>
          <div class="ps-status"><span>66.7%</span><span>文档: 12.4M/48.2M</span><span class="ps-sp"></span><span>图层 5</span></div>
        </div>
        <aside class="ps-right">
          <div class="ps-panel"><div class="ps-pt">图层</div>${PS_LAYERS}</div>
          <div class="ps-panel">
            <div class="ps-pt">属性</div>
            <div class="ps-rows"><span>不透明度</span><b>100%</b></div>
            <div class="ps-rows"><span>混合</span><b>正常</b></div>
          </div>
          <div class="ps-panel"><div class="ps-pt">颜色</div><div class="ps-color"></div></div>
        </aside>
      </div>`,

    /* -------------------------------------------------- 忙碌模式：VS Code */
    vscode: () => `
      <div class="vs-title">
        <span class="vs-dot r"></span><span class="vs-dot y"></span><span class="vs-dot g"></span>
        <span class="vs-name">touch-fish — src/main/main.js — Visual Studio Code</span>
        <span class="vs-menus">文件　编辑　选择　查看　转到　运行　终端　帮助</span>
      </div>
      <div class="vs-body">
        <div class="vs-activity">
          <b class="on">☰</b><b>⌕</b><b>⑂</b><b>▷</b><b>⧉</b><b>⛭</b>
        </div>
        <div class="vs-side">
          <div class="vs-side-title">资源管理器</div>
          <div class="vs-tree">
            <div class="vs-f open">▾ TOUCH-FISH</div>
            <div class="vs-f">▾ src</div>
            <div class="vs-f">▾ main</div>
            <div class="vs-f file on">main.js</div>
            <div class="vs-f file">hotkey.js</div>
            <div class="vs-f file">store.js</div>
            <div class="vs-f">▾ renderer</div>
            <div class="vs-f file">desktop.css</div>
            <div class="vs-f file">app.js</div>
            <div class="vs-f">▸ assets</div>
            <div class="vs-f">package.json</div>
          </div>
        </div>
        <div class="vs-main">
          <div class="vs-tabs"><span class="on">main.js <i>●</i></span><span>store.js</span><span>hotkey.js</span></div>
          <div class="vs-code">
            <pre>${VS_CODE}</pre>
            <div class="vs-minimap"></div>
          </div>
          <div class="vs-term">
            <div class="vs-term-tabs"><span class="on">终端</span><span>输出</span><span>问题</span><span>调试控制台</span></div>
            <div class="vs-term-body">
              <div><span class="vs-p">PS D:\\touch-fish&gt;</span> npm run dev</div>
              <div class="vs-ok">&gt; touch fish@1.0.0 dev</div>
              <div class="vs-ok">&gt; electron . --dev</div>
              <div class="vs-dim">[hotkey] KeyWatcher 已启动 · sequence = CTRL,CTRL gap=420</div>
              <div class="vs-dim">[desktop] 虚拟桌面已就绪，等待切换…</div>
            </div>
          </div>
        </div>
      </div>
      <div class="vs-status">
        <span>⑂ main*</span><span>0 ⊗ 0 ⚠</span><span class="vs-sp"></span>
        <span>Ln 14, Col 22</span><span>空格: 2</span><span>UTF-8</span><span>JavaScript</span>
      </div>`
  };

  /* ------------------------------------------------------------- 管理器 */

  const DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  class WindowManager {
    constructor({ layer, taskbarEl }) {
      this.layer = layer;
      this.taskbarEl = taskbarEl;
      this.wins = new Map();
      this.z = 100;
      this.cascade = 0;
      this.activeKey = null;
    }

    open(key, opts) {
      const exist = this.wins.get(key);
      if (exist) {
        if (exist.minimized) this.restore(key);
        else this.focus(key);
        return exist;
      }
      const {
        title, icon, width = 900, height = 560, tpl = 'explorer',
        resizable = true, minW = 430, minH = 260
      } = opts;

      const el = document.createElement('div');
      el.className = 'win';
      el.dataset.key = key;

      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 80;
      const w = Math.min(width, maxW);
      const h = Math.min(height, maxH);
      const off = (this.cascade++ % 6) * 26;
      let left = Math.max(20, Math.round((window.innerWidth - w) / 2) + off - 60);
      let top = Math.max(14, Math.round((window.innerHeight - 40 - h) / 2) + off - 40);
      if (typeof opts.left === 'number') left = Math.max(8, Math.min(opts.left, window.innerWidth - 120));
      if (typeof opts.top === 'number') top = Math.max(0, Math.min(opts.top, window.innerHeight - 80));

      el.style.left = left + 'px';
      el.style.top = top + 'px';
      el.style.width = w + 'px';
      el.style.height = h + 'px';

      const body = typeof TPL[tpl] === 'function' ? TPL[tpl](title, opts) : TPL.explorer();

      el.innerHTML = `
        <div class="titlebar">
          <img class="t-ico" src="${iconUrl(icon)}" alt="" />
          <div class="t-title">${title}</div>
          <div class="t-controls">
            <button class="t-btn min" title="最小化">${GLYPH.min}</button>
            <button class="t-btn max" title="最大化">${GLYPH.max}</button>
            <button class="t-btn close" title="关闭">${GLYPH.close}</button>
          </div>
        </div>
        <div class="win-body" style="background:#fff">${body}</div>
        ${resizable ? DIRS.map((d) => `<div class="win-rh rh-${d}" data-dir="${d}"></div>`).join('') : ''}
      `;

      this.layer.appendChild(el);

      const rec = {
        key, el, title, icon, tpl, minimized: false, maximized: false, prev: null,
        minW, minH,
        taskBtn: this.makeTaskButton(key, title, icon)
      };
      this.wins.set(key, rec);

      el.querySelector('.t-btn.close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.close(key);
      });
      el.querySelector('.t-btn.min').addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimize(key);
      });
      el.querySelector('.t-btn.max').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMax(key);
      });
      el.addEventListener('mousedown', () => this.focus(key));

      this.bindDrag(rec);
      if (resizable) this.bindResize(rec);
      if (tpl === 'web') this.bindWeb(rec, opts);

      this.focus(key);
      return rec;
    }

    /* --------------------------------------------------- 内置浏览器逻辑 */
    bindWeb(rec, opts) {
      const wrap = rec.el.querySelector('.web-wrap');
      const urlInput = rec.el.querySelector('.wb-url');
      const home = opts.url || 'about:blank';
      rec.webHome = home;

      const view = document.createElement('webview');
      view.className = 'web-view';
      view.setAttribute('partition', 'persist:touchfish');
      view.setAttribute('allowpopups', 'true');
      view.setAttribute('src', home);
      wrap.appendChild(view);
      rec.view = view;

      const safe = (fn, fallback) => {
        try { return fn(); } catch (e) { return fallback; }
      };
      const currentUrl = () => safe(() => view.getURL(), '') || home;
      const syncUrl = (u) => {
        if (urlInput && u && u !== 'about:blank') urlInput.value = u;
      };
      syncUrl(home);

      view.addEventListener('did-start-loading', () => {
        rec.el.classList.add('loading');
      });
      view.addEventListener('did-stop-loading', () => {
        rec.el.classList.remove('loading');
        syncUrl(safe(() => view.getURL(), ''));
      });
      view.addEventListener('did-navigate', (e) => syncUrl(e.url));
      view.addEventListener('did-navigate-in-page', (e) => syncUrl(e.url));
      view.addEventListener('page-title-updated', (e) => {
        const t = rec.el.querySelector('.t-title');
        if (t && e.title) t.textContent = e.title;
        if (rec.taskBtn) rec.taskBtn.title = e.title;
      });
      view.addEventListener('did-fail-load', (e) => {
        if (e.errorCode === -3 || e.errorCode === -20) return; // 主动中断不算失败
        this.showWebFail(rec, e.errorDescription || '页面加载失败', currentUrl());
      });
      view.addEventListener('render-process-gone', () => {
        this.showWebFail(rec, '页面进程异常退出', currentUrl());
      });

      rec.el.querySelectorAll('.wb-btn').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const nav = b.dataset.nav;
          if (nav === 'back') { if (safe(() => view.canGoBack(), false)) view.goBack(); }
          if (nav === 'fwd') { if (safe(() => view.canGoForward(), false)) view.goForward(); }
          if (nav === 'reload') safe(() => view.reload());
          if (nav === 'home') openUrl(home);
        });
      });

      const openUrl = (u) => {
        const target = /^https?:\/\//i.test(u) ? u : 'https://' + u.replace(/^\/+/, '');
        safe(() => view.loadURL(target));
      };

      const go = rec.el.querySelector('.wb-go');
      if (go) go.addEventListener('click', (e) => { e.stopPropagation(); openUrl(urlInput.value.trim()); });
      if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') openUrl(urlInput.value.trim());
        });
      }
      const ext = rec.el.querySelector('.wb-ext');
      if (ext) ext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.TF && TF.openExternal) TF.openExternal(currentUrl());
      });
    }

    showWebFail(rec, msg, url) {
      const wrap = rec.el.querySelector('.web-wrap');
      if (!wrap || wrap.querySelector('.web-fail')) return;
      const div = document.createElement('div');
      div.className = 'web-fail';
      div.innerHTML = `
        <div class="wf-card">
          <b>无法打开这个页面</b>
          <p>${msg}</p>
          <p class="wf-url">${url || ''}</p>
          <div class="wf-ops">
            <button class="wf-retry">重试</button>
            <button class="wf-ext">在系统浏览器中打开</button>
          </div>
          <small>有些站点（如部分视频站）禁止被内嵌，建议改用系统浏览器。</small>
        </div>`;
      div.querySelector('.wf-retry').onclick = () => {
        div.remove();
        try { rec.view.reload(); } catch {}
      };
      div.querySelector('.wf-ext').onclick = () => TF.openExternal(url);
      wrap.appendChild(div);
    }

    makeTaskButton(key, title, icon) {
      const b = document.createElement('button');
      b.className = 'tb-app running';
      b.dataset.key = key;
      b.innerHTML = `<img src="${iconUrl(icon)}" alt="" /><span class="tb-tip">${title}</span>`;
      b.addEventListener('click', () => {
        const rec = this.wins.get(key);
        if (!rec) return;
        if (rec.minimized) this.restore(key);
        else if (this.activeKey === key) this.minimize(key);
        else this.focus(key);
      });
      this.taskbarEl.appendChild(b);
      return b;
    }

    focus(key) {
      const rec = this.wins.get(key);
      if (!rec || rec.minimized) return;
      this.activeKey = key;
      this.z += 1;
      rec.el.style.zIndex = this.z;
      for (const [k, r] of this.wins) {
        r.el.classList.toggle('inactive', k !== key);
        if (r.taskBtn) {
          r.taskBtn.classList.toggle('focused', k === key && !r.minimized);
          r.taskBtn.classList.toggle('running', true);
        }
      }
    }

    minimize(key) {
      const rec = this.wins.get(key);
      if (!rec || rec.minimized) return;
      const winRect = rec.el.getBoundingClientRect();
      const btnRect = rec.taskBtn ? rec.taskBtn.getBoundingClientRect() : { left: winRect.left, top: window.innerHeight };
      rec.el.style.setProperty('--mx', btnRect.left - winRect.left + 'px');
      rec.el.style.setProperty('--my', btnRect.top - winRect.top + 'px');
      rec.el.classList.add('minimizing');
      rec.minimized = true;
      if (this.activeKey === key) this.activeKey = null;
      rec.taskBtn.classList.remove('focused');
      setTimeout(() => {
        if (rec.minimized) rec.el.style.display = 'none';
        rec.el.classList.remove('minimizing');
      }, 190);
    }

    restore(key) {
      const rec = this.wins.get(key);
      if (!rec) return;
      rec.el.style.display = 'flex';
      rec.minimized = false;
      const winRect = rec.el.getBoundingClientRect();
      const btnRect = rec.taskBtn.getBoundingClientRect();
      rec.el.style.setProperty('--mx', btnRect.left - winRect.left + 'px');
      rec.el.style.setProperty('--my', btnRect.top - winRect.top + 'px');
      rec.el.classList.add('restoring');
      setTimeout(() => rec.el.classList.remove('restoring'), 210);
      this.focus(key);
    }

    close(key, animate = true) {
      const rec = this.wins.get(key);
      if (!rec) return;
      const finish = () => {
        rec.el.remove();
        if (rec.taskBtn) rec.taskBtn.remove();
        this.wins.delete(key);
        if (this.activeKey === key) this.activeKey = null;
      };
      if (!animate) return finish();
      rec.el.classList.add('closing');
      setTimeout(finish, 120);
    }

    closeAll() {
      Array.from(this.wins.keys()).forEach((k) => this.close(k, false));
      this.cascade = 0;
    }

    toggleMax(key) {
      const rec = this.wins.get(key);
      if (!rec) return;
      const btn = rec.el.querySelector('.t-btn.max');
      if (!rec.maximized) {
        rec.prev = { left: rec.el.style.left, top: rec.el.style.top, width: rec.el.style.width, height: rec.el.style.height };
        rec.el.style.left = '0px';
        rec.el.style.top = '0px';
        rec.el.style.width = '100%';
        rec.el.style.height = 'calc(100% - 40px)';
        rec.el.style.borderRadius = '0';
        rec.maximized = true;
        btn.innerHTML = GLYPH.restore;
      } else {
        Object.assign(rec.el.style, rec.prev || {});
        rec.el.style.borderRadius = '';
        rec.maximized = false;
        btn.innerHTML = GLYPH.max;
      }
    }

    bindDrag(rec) {
      const bar = rec.el.querySelector('.titlebar');
      let sx = 0, sy = 0, sl = 0, st = 0, dragging = false;
      bar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.t-btn') || rec.maximized) return;
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        sl = parseInt(rec.el.style.left, 10) || 0;
        st = parseInt(rec.el.style.top, 10) || 0;
        document.body.style.cursor = 'default';
        e.preventDefault();
      });
      bar.addEventListener('dblclick', (e) => {
        if (e.target.closest('.t-btn')) return;
        this.toggleMax(rec.key);
      });
      const move = (e) => {
        if (!dragging) return;
        const w = rec.el.offsetWidth;
        const maxL = window.innerWidth - 80;
        const maxT = window.innerHeight - 60;
        rec.el.style.left = Math.min(maxL, Math.max(-w + 120, sl + e.clientX - sx)) + 'px';
        rec.el.style.top = Math.min(maxT, Math.max(0, st + e.clientY - sy)) + 'px';
      };
      const up = () => {
        dragging = false;
        document.body.style.cursor = '';
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    }

    /** 八向缩放（上下左右 + 四角） */
    bindResize(rec) {
      const body = document.body;
      rec.el.querySelectorAll('.win-rh').forEach((handle) => {
        handle.addEventListener('mousedown', (e) => {
          if (rec.maximized) return;
          const dir = handle.dataset.dir;
          const sx = e.clientX;
          const sy = e.clientY;
          const r = rec.el.getBoundingClientRect();
          const start = { left: r.left, top: r.top, width: r.width, height: r.height };
          e.preventDefault();
          e.stopPropagation();

          const move = (ev) => {
            const dx = ev.clientX - sx;
            const dy = ev.clientY - sy;
            let { left, top, width, height } = start;
            const minW = rec.minW || 430;
            const minH = rec.minH || 260;

            if (dir.includes('e')) width = Math.max(minW, start.width + dx);
            if (dir.includes('s')) height = Math.max(minH, start.height + dy);
            if (dir.includes('w')) {
              width = Math.max(minW, start.width - dx);
              left = start.left + (start.width - width);
            }
            if (dir.includes('n')) {
              height = Math.max(minH, start.height - dy);
              top = start.top + (start.height - height);
            }
            rec.el.style.left = Math.max(0, left) + 'px';
            rec.el.style.top = Math.max(0, top) + 'px';
            rec.el.style.width = width + 'px';
            rec.el.style.height = height + 'px';
          };
          const up = () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            body.style.cursor = '';
          };
          body.style.cursor = getComputedStyle(handle).cursor;
          window.addEventListener('mousemove', move);
          window.addEventListener('mouseup', up);
        });
      });
    }
  }

  window.WindowManager = WindowManager;
  window.BUSY_ICON = BUSY_ICON;
})();
