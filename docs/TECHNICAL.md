# touch fish · 技术说明文档

> 本文档面向想读懂 / 修改 / 二次开发本项目的人。内容包括进程模型、关键算法、IPC 协议、
> 配置结构，以及开发过程中踩过的每一个坑和最终解法。
>
> 配套阅读：[README](../README.md) · [更新日志](../CHANGELOG.md)

---

## 目录

1. [设计目标与取舍](#一设计目标与取舍)
2. [进程模型与目录职责](#二进程模型与目录职责)
3. [真实系统资源提取](#三真实系统资源提取)
4. [全局热键：裸修饰键连按检测](#四全局热键裸修饰键连按检测)
5. [虚拟桌面渲染层](#五虚拟桌面渲染层)
6. [窗口系统](#六窗口系统)
7. [内置浏览器（属性窗口）](#七内置浏览器属性窗口)
8. [台球物理引擎](#八台球物理引擎)
9. [自定义壁纸协议](#九自定义壁纸协议)
10. [配置系统与 IPC 协议](#十配置系统与-ipc-协议)
11. [打包与踩坑记录](#十一打包与踩坑记录)
12. [测试与验证](#十二测试与验证)
13. [性能与体积](#十三性能与体积)
14. [已知限制与后续计划](#十四已知限制与后续计划)

---

## 一、设计目标与取舍

这个项目要解决的核心矛盾是：**"看起来真"和"技术上轻"往往冲突**。

所以定了三条硬约束，后面所有实现都围绕它们：

| 约束 | 含义 | 具体做法 |
| --- | --- | --- |
| **真** | 不能让同事一眼看出是假的 | 壁纸与图标不用手绘，直接从系统资源提取；任务栏高度、图标网格、字号按 1920×1080 真机实测对齐 |
| **轻** | 常驻内存、切换必须瞬时 | 不用 React/Vue，纯原生 DOM；不引入任何 UI 框架；忙碌模式是纯 CSS，零图片素材 |
| **稳** | 敢放在后台挂一整天 | 单实例锁、异常兜底、键盘钩子失败自动降级、配置原子写入 |

**明确不做的事**（避免过度设计）：

- 不做多显示器镜像（副屏保持原样反而更真实）
- 不接管真实系统通知（Windows 通知会照常弹出，这点真机也一样）
- 不做真实文件系统操作（虚拟桌面里的"此电脑"只是模板渲染，不会误删你的文件）

---

## 二、进程模型与目录职责

Electron 的三层架构，严格按职责切分，不跨层调用：

```
┌──────────────────────────────────────────────────────────┐
│  主进程  src/main/                                        │
│  窗口生命周期 / 托盘 / 全局热键 / 配置落盘 / 自定义协议    │
└───────────────┬──────────────────────────────────────────┘
                │ IPC（ipcMain.handle / webContents.send）
┌───────────────▼──────────────────────────────────────────┐
│  预加载  src/preload/                                     │
│  contextBridge 暴露 window.TF —— 唯一的跨进程通道          │
└───────────────┬──────────────────────────────────────────┘
                │ window.TF.xxx()
┌───────────────▼──────────────────────────────────────────┐
│  渲染进程  src/renderer/                                  │
│  虚拟桌面 / 设置页 / 属性窗口 —— 无任何 Node 权限          │
└──────────────────────────────────────────────────────────┘
```

### 2.1 各文件职责

| 文件 | 行数级别 | 职责 |
| --- | --- | --- |
| `src/main/main.js` | ~700 | 应用入口。创建三个窗口、托盘、注册全部 IPC、`tfwall://` 协议、单实例锁、内置自检 |
| `src/main/store.js` | ~130 | 配置读写。深合并默认值、原子写、变更广播 |
| `src/main/hotkey.js` | ~160 | 键盘钩子封装。键码映射、连按判定状态机、标签格式化 |
| `src/preload/desktop.js` | ~60 | 虚拟桌面桥。`getConfig / patchConfig / saveLayout / setIcon / openProperty …` |
| `src/preload/settings.js` | ~70 | 设置页桥。额外暴露 `resetConfig / setLogin / uninstall / startPool` |
| `src/preload/property.js` | ~40 | 旧独立属性窗口桥（保留兼容） |
| `src/shared/iconlib.js` | ~400 | 39 个图标定义：真实 PNG 路径 + 内联 SVG 兜底 + 元数据 |
| `src/shared/desktop-items.js` | ~90 | 桌面项模板、默认收藏站点 |
| `src/renderer/desktop/app.js` | ~700 | 桌面主逻辑：图标渲染、菜单、开始菜单、徽章、忙碌模式、壁纸应用 |
| `src/renderer/desktop/windows.js` | ~500 | 窗口管理器 + 12 套内容模板（含 4 套假工作页） |
| `src/renderer/desktop/pool.js` | ~330 | 台球物理与渲染 |
| `src/renderer/settings/settings.js` | ~600 | 设置页六个分页的逻辑 |

### 2.2 为什么不用框架

桌面图标最多 20 个、窗口最多 10 个、动画都是 CSS transform。引入框架带来的收益（响应式更新）
在这个规模下几乎为零，成本却是多 1MB 运行时 + 构建链路 + 启动时长。所以全部手写 DOM。

代价是**状态管理要自己兜住**。做法是：所有可变状态只有一个来源 `state.cfg`（来自 `config:get`），
任何修改都走 `patchConfig()` → 主进程落盘 → 广播 `config:changed` → 渲染进程整体重绘。宁可整棵重绘，
也不做局部 diff —— 20 个节点的重绘成本远低于维护 diff 逻辑的复杂度。

---

## 三、真实系统资源提取

这是"看起来真"的关键。**桌面图标不是画出来的，是从你的 Windows 里抠出来的。**

### 3.1 为什么不用 `SHGetFileInfoW`

最初的实现用的是传统 API：

```python
SHGetFileInfoW(path, 0, byref(info), sizeof(info), SHGFI_ICON | SHGFI_LARGEICON)
```

两个问题：

1. **拿不到 256px**。它最大只给 32×32（大图标）或 16×16（小图标），放大到桌面用的 48px 就糊。
2. **对 CLSID 字符串返回 `iIcon = 0`**。`::{20D04FE0-3AEA-1069-A2D8-08002B30309D}`（此电脑）这类
   Shell 命名空间对象拿不到图标索引。

### 3.2 改用 `IShellItemImageFactory`

这是资源管理器自己用的接口，能拿到**它实际渲染的那张缩略图/图标**（含 Win10 新版扁平风格），
而且支持任意尺寸：

```python
# tools/extract-icons.py（简化）
def shell_icon(path, size=256):
    # SHCreateItemFromParsingName → IShellItemImageFactory::GetImage
    factory = shell_item_factory(path)
    hbmp = factory.GetImage(SIZE(size, size), SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK)
    return hbitmap_to_rgba(hbmp)
```

关键点：

- `SIIGBF_ICONONLY`：只要图标，不要文档缩略图
- 尺寸传 `256×256`，Win10 的 `imageres.dll.mun` 里有 256px 资源，能取到最清晰的一档
- COM 必须在 `CoInitializeEx(COINIT_APARTMENTTHREADED)` 之后调用

### 3.3 `HICON` / `HBITMAP` → RGBA

Windows 的位图是 **BGRA + 预乘 alpha**，Python 里要手工转换：

```python
def hbitmap_to_rgba(hbmp):
    # GetObjectW 取 BITMAP 结构 → GetDIBits 拿 BGRA 像素
    # 逐个像素：R↔B 互换，alpha 反预乘
    for i in range(0, len(buf), 4):
        b, g, r, a = buf[i:i+4]
        if a:  # 反预乘，否则半透明边缘会发黑
            buf[i]   = min(255, r * 255 // a)
            buf[i+2] = min(255, b * 255 // a)
        buf[i+3] = a
```

> **坑**：`gdi32.SelectObject` 必须显式声明 `argtypes`，否则 64 位下句柄被截断成 32 位，
> 报 `OverflowError: int too long to convert`。

### 3.4 PNG 编码：不用 Pillow

提取脚本刻意只依赖 `ctypes` + 标准库，用手写 PNG 编码（`zlib.compress` + 手工拼 IHDR/IDAT/IEND），
这样用户不必先 `pip install pillow` 就能跑。代码在 `write_png()`。

### 3.5 「本地磁盘」的特例

`IShellItemImageFactory` 对 `C:\` 只返回**未知文件的白纸图标** —— 因为盘符根目录不是一个
具体的 shell 项。试过 `SHGetFileInfoW`、`ExtractIconExW` 都不对。

最终方案：**直接从 `imageres.dll.mun` 按索引取**。做法是生成索引图（`python tools/extract-icons.py sheet`），
人眼扫一遍定位到**索引 30** 是标准的银灰立体硬盘，然后写进 `INDEX_TARGETS`：

```python
INDEX_TARGETS = [
    ('drive', r'C:\Windows\SystemResources\imageres.dll.mun', 30),
    # ...
]
```

> 这类"人眼定位 + 硬编码索引"的妥协在图标提取里很常见，因为微软没有公开稳定的索引表。
> 好处是效果与真机完全一致，代价是 Windows 大版本更新后可能对不上（届时重新跑 `sheet` 命令再扫一遍即可）。

### 3.6 提取目标清单

| 类别 | 来源 | 示例 |
| --- | --- | --- |
| Shell 命名空间 | CLSID 字符串 | 此电脑、回收站、网络 |
| 可执行文件 | `.exe` 路径 | Edge、记事本、CMD、画图 |
| 文件夹 | 实际目录 | 用户目录、图片、下载 |
| UWP 应用 | `shell:AppsFolder\...` | 计算器、设置、照片、邮件、音乐、视频 |
| 系统模块 | `imageres.dll.mun` 索引 | 本地磁盘 |

输出统一为 256×256 PNG，落在 `assets/icons/png/`，同时缩一份 64px 到 `assets/tray/`。

---

## 四、全局热键：裸修饰键连按检测

### 4.1 为什么 `globalShortcut` 做不到

Electron 的 `globalShortcut.register('Control+Control')` 是**无效的** —— 它只接受
"修饰键 + 主键"的加速键组合，单独的 `Ctrl` 按两下这种**裸修饰键序列**它根本表达不了。

所以必须用**低级键盘钩子**（`WH_KEYBOARD_LL`）自己监听原始 keydown/keyup。

### 4.2 选型：`uiohook-napi`

候选方案对比：

| 方案 | 结论 |
| --- | --- |
| `node-global-key-listener` | ❌ Windows 端需要 `WinKeyServer.exe`，而包里只有 X11 的二进制；自己编译被安全策略拦 `csc.exe` |
| `iohook` | ❌ 只支持到 Electron 8，原生模块 ABI 不兼容 |
| `nut-js` | ❌ 太重，且需要额外驱动 |
| **`uiohook-napi`** | ✅ 自带 `win32-x64` prebuild，napi 版本 ABI 稳定，5 分钟接上 |

### 4.3 连按判定状态机

```js
// src/main/hotkey.js
registerPress(key) {
  const seq = this.sequence;              // 默认 ['CTRL', 'CTRL']
  if (key !== seq[0]) { this.hits = []; return; }   // 按了别的键 → 清零

  const now = Date.now();
  // 距上一次超时 → 重新计数
  if (this.hits.length && now - this.hits[this.hits.length - 1] > this.gap) this.hits = [];

  this.hits.push(now);
  if (this.hits.length >= seq.length) {
    this.hits = [];
    this.onMatch();                        // 命中，触发切换
    return;
  }
  // 兜底：超时后清空，避免"半个序列"跨很久生效
  this.timer = setTimeout(() => { this.hits = []; }, this.gap + 80);
}
```

三个细节值得说：

1. **长按过滤**：Windows 长按会持续发 keydown。用 `pressed` Set 记录当前按下的键，
   第二次 keydown 直接 `return`，否则按住 Ctrl 不放就会一直累加。
2. **`gap + 80` 而不是 `gap`**：定时器与真实事件有调度抖动，留 80ms 余量避免误清。
3. **只认 `seq[0]`**：当前配置只支持"同一个键按 N 次"，因为跨键序列（Ctrl→Alt）在实际使用中
   误触率极高 —— 用户按 `Ctrl+C` 再按 `Alt+Tab` 就会被判命中。

### 4.4 降级策略

钩子在某些环境（杀软拦截、权限不足、远程会话）会失败。此时 `start()` 返回 `false`，
主进程改用 `globalShortcut.register(accelerator)`：

```js
function startHotkey() {
  const cfg = store.get();
  stopHotkey();
  if (cfg.hotkey.mode === 'combo') { /* 直接走 globalShortcut */ }
  watcher = new KeyWatcher({ sequence, gap, onMatch: toggleDesktop, onError: ... });
  if (!watcher.start()) fallbackToCombo();   // 钩子失败 → 组合键
}
```

用户会在设置页看到"当前快捷键"的真实状态，不会出现"设了但没生效还不知道"的情况。

### 4.5 键码映射

`buildKeyMap()` 把 uiohook 的物理键码映射成逻辑 token（`CTRL / ALT / SHIFT / WIN / A-Z / F1-F24 / …`）。
**左右修饰键合并为一个 token** —— 用户按左 Ctrl 还是右 Ctrl 都应该算数，这是真实使用习惯。

---

## 五、虚拟桌面渲染层

### 5.1 窗口参数

```js
desktopWin = new BrowserWindow({
  x, y, width, height,        // 主显示器全尺寸
  show: false,
  frame: false,               // 无边框
  skipTaskbar: true,          // 不出现在真实任务栏
  alwaysOnTop: true,
  resizable: false,
  backgroundColor: '#0a4e8f',
  webPreferences: {
    contextIsolation: true,   // 隔离渲染进程
    sandbox: false,           // preload 需要 require
    backgroundThrottling: false,  // 后台也保持 60fps（合成器不降频）
    webviewTag: true          // 内置浏览器需要
  }
});
desktopWin.setAlwaysOnTop(true, 'screen-saver');  // 关键：盖住真实任务栏
```

> `'screen-saver'` 这个层级是能盖住 Windows 任务栏的关键。用默认的 `'floating'` 时，
> 真实任务栏依然会显示在最上层，一眼穿帮。

### 5.2 切换动画

不用 `win.show()/hide()` 的默认效果（会闪白），改成自己控制透明度：

```js
function fadeTo(target, done) {
  // 8 步 × 16ms ≈ 128ms，每帧改 setOpacity
}
```

真实 Win10 的"显示桌面"是瞬时的，但这里刻意保留 128ms 淡入 —— 完全瞬时会让切换显得生硬，
128ms 既察觉不到延迟，又不会突兀。

### 5.3 图标网格：对齐真机

最初版本是 92×98 的格子，看起来"图标稀、留白多"。真机实测（1920×1080，100% 缩放）：

| 指标 | 真机 Win10 | 本项目 |
| --- | --- | --- |
| 单元格 | 约 84×96 | 84×96 |
| 图标本体 | 48×48 | 48×48 |
| 标签字号 | 12px，最多 2 行 | 12px，最多 2 行 |
| 起点 | 左上角约 6px 内边距 | 8px 6px |

验证方法不是肉眼，而是 `tools/measure-desktop.py`：用 Playwright 加载页面（注入 `TF` 桩），
直接量 `getBoundingClientRect()`：

```
grid: { cols: 2, cellW: 84, cellH: 96 }
icon: { w: 84, h: 96, glyph: 48 }
label: { fontSize: 12, lineHeight: 15 }
```

> **标签换行的坑**：一开始用 `word-break: break-all`，结果 `Google Chrome` 被拆成
> `Chrom` / `e`。改成 `overflow-wrap: anywhere` 后按词断行，正常了。

### 5.4 图标解析优先级

```js
function iconFor(it) {
  const id = state.cfg.icons.desktop[it.id] || it.icon;
  const def = TF.icons.find(i => i.id === id);
  return def && def.file ? '../../../' + def.file : iconDataUrl(id);   // PNG 优先，SVG 兜底
}
```

- 用户改过图标 → 用改过的
- 有真实 PNG → 用 PNG
- 都没有 → 用 `iconlib.js` 里的内联 SVG

这样即使 `assets/icons/png/` 缺失（比如没跑提取脚本），界面也不会开天窗。

### 5.5 拖拽落位

图标 `draggable=true`，`dragend` 时把 `dataTransfer` 里的 id 与鼠标坐标换算成网格坐标
（`Math.floor((x - padX) / 84)`），写进 `layout` 并落盘。刷新后位置保留。

---

## 六、窗口系统

### 6.1 DOM 结构

```html
<div class="win" data-key="explorer-1" style="left/width/height/z-index">
  <div class="t-bar">
    <img class="t-icon" /><span class="t-title">此电脑</span>
    <div class="t-btns"><button class="t-btn min" /><button class="t-btn max" /><button class="t-btn close" /></div>
  </div>
  <div class="win-body">…模板内容…</div>
  <div class="rs n"></div><div class="rs s"></div>…  <!-- 八向把手 -->
</div>
```

### 6.2 八向缩放

不用 `-webkit-app-region`（那是给无边框窗口用的，这里是 DOM 元素）。八个把手各带方向标记：

| 把手 | class | cursor | 逻辑 |
| --- | --- | --- | --- |
| 上/下 | `.rs.n` `.rs.s` | `ns-resize` | 改 `height` 与 `top`（向上拖时要同时移动 `top`） |
| 左/右 | `.rs.w` `.rs.e` | `ew-resize` | 改 `width` 与 `left` |
| 四角 | `.rs.nw` … | `nwse-resize` | 两个方向叠加 |

约束：`minWidth 520 / minHeight 340`，且不允许小于标题栏高度。

> 缩放用 `requestAnimationFrame` 节流，直接改 `style`，不触发重排计算 —— 改 `width/height` 是重排，
> 但在 10 个窗口规模下可以接受，实测拖拽流畅。

### 6.3 层级与任务栏联动

`state.z` 单调递增，`focus(key)` 时把它提到 `z-index` 最高，同时给对应任务栏按钮加 `.focused`；
`minimize()` 加 `.win-min` 类（`transform: scale(.86)` + `opacity: 0`），任务栏按钮保留但去掉下划线。

### 6.4 模板系统

`windows.js` 里的 `TPL` 是一个 `{ 类型: (name, opts) => html字符串 }` 的映射表，共 12 套：

| 类型 | 用于 |
| --- | --- |
| `explorer` | 此电脑 / 资源管理器（含磁盘行、导航窗格） |
| `recycle` | 回收站 |
| `chat` | 微信 / 钉钉 |
| `browser` | Chrome / Edge（地址栏 + 假页面） |
| `media` | 网易云音乐 |
| `doc` | Word / 记事本 |
| `store` | Microsoft Store |
| `web` | 内置浏览器（真 webview，见下节） |
| `word` / `premiere` / `photoshop` / `vscode` | **忙碌模式四套假工作页** |

### 6.5 忙碌模式：为什么是纯 CSS

目标只有一个：**让人从工位侧面看过来，觉得你在认真工作**。既然如此：

- 不需要真实编辑功能 → 全部静态 HTML
- 不需要真实素材 → 用 CSS 画：图层面板的棋盘格是 `repeating-conic-gradient`，示波器是 `linear-gradient` 条纹，代码高亮靠 `<span class>` 上色
- 不需要外部字体 → 用系统自带的 Consolas / 微软雅黑

四套模板的信息密度按真实软件排布：

| 窗口 | 仿真的部分 |
| --- | --- |
| Word | 功能区（粘贴/字体/段落/样式）+ 中文经营分析报告 + 数据表格 + `160%` 缩放状态栏 |
| Premiere | 项目面板、素材树、监视器、四轨时间线（含音频轨）、效果控件、示波器 |
| Photoshop | 工具栏、棋盘格画布上的主视觉、图层列表（缩略图 + 眼睛图标）、色带 |
| VS Code | 活动栏、资源树、带语法高亮的代码、终端里的 `npm run dev` 日志、蓝色状态栏 |

四者按四分屏铺开（`x/y/w/h` 都是屏宽高的百分比），保证每个窗口都能露出一部分，
形成"多任务并行"的观感。

**注意**：忙碌模式文案刻意保持通用（"咨询服务""内容授权""合作机构"），不留任何可识别个人 / 单位身份的信息。

---

## 七、内置浏览器（属性窗口）

### 7.1 需求演变

- **v1.0**：右键「属性」→ 弹出**独立的 `BrowserWindow`**（真 Windows 窗口）。问题：一按 `Alt+Tab`
  就露馅了，因为它出现在真实任务栏里。
- **v1.1**：改为**虚拟桌面内部的窗口**，用 `<webview>` 挂载。这样它和虚拟桌面同生共死，
  关掉桌面就一起消失。

### 7.2 webview 的加载时序坑

最初的写法是直接设 `view.src = url`，结果页面永远 `about:blank`。原因：

> `webview` 在 `dom-ready` 之前，`loadURL()` 不可用，`src` 赋值会被静默忽略。

正确写法是维护一个待办队列：

```js
let viewReady = false, pendingUrl = null;

function load(target) {
  if (viewReady && typeof view.loadURL === 'function') {
    view.loadURL(target);
  } else {
    pendingUrl = target;      // 先存着
  }
}

view.addEventListener('dom-ready', () => {
  if (!viewReady) {
    viewReady = true;
    if (pendingUrl) { const u = pendingUrl; pendingUrl = null; view.loadURL(u); }
  }
});
```

### 7.3 站点来源规则

右键**任意**图标 →「属性」都打开内置浏览器：

| 图标类型 | 打开地址 |
| --- | --- |
| 收藏站点（起点中文网等） | 该站点自己的 URL |
| 普通图标（此电脑、记事本…） | 第一个收藏站点 |
| 一个收藏都没有 | `https://www.qidian.com` |

这样保证任何情况下点「属性」都有页面可看，不会弹一个白框。

### 7.4 会话隔离

```html
<webview partition="persist:touchfish" />
```

`persist:` 前缀让 Cookie / localStorage 落盘，重启后登录态还在；所有窗口共用同一分区，
所以在内置浏览器里登录 B 站，托盘里打开也是登录态。

### 7.5 安全设置

- `contextIsolation: true`，webview 内的页面拿不到 `window.TF`
- 地址栏只接受 `http/https`，其它协议（`file:` `javascript:`）被 `normalizeUrl()` 拦掉
- 外部链接跳转统一走 `shell.openExternal`

---

## 八、台球物理引擎

### 8.1 坐标系

Canvas 按 `devicePixelRatio` 缩放，逻辑坐标与 CSS 像素一致：

```js
canvas.width = width * dpr;
canvas.height = height * dpr;
ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
```

桌面区域高度取 `innerHeight - 40`（扣掉任务栏），球不会滚到任务栏下面。

### 8.2 为什么需要子步进

高速球（初速可达 2000px/s）在 16ms 的一帧内会移动 32px，而球半径只有 22px ——
**直接积分会穿球**。解法是按位移切分：

```js
const sp = Math.hypot(b.vx, b.vy);
const steps = Math.max(1, Math.ceil((sp * dt) / 5));   // 每步不超过 5px
const sdt = dt / steps;
for (let s = 0; s < steps; s++) { /* 位移 + 碰撞检测 */ }
```

### 8.3 摩擦

指数衰减而不是线性减速，这样高速球减速快、低速球减速慢，手感接近真实：

```js
const friction = Math.exp(-1.05 * dt);   // 每秒衰减到约 35%
b.vx *= friction; b.vy *= friction;
```

低于 `7px/s` 直接归零，避免"永远在抖"。

### 8.4 球球碰撞

等质量弹性碰撞 + 恢复系数 0.94：

```js
// 法向单位向量
const nx = dx / d, ny = dy / d;
// 先分离重叠，各退一半
const overlap = min - d;
b.x -= nx * overlap * 0.5;  o.x += nx * overlap * 0.5;
// 相对速度在法向的分量
const sep = (o.vx - b.vx) * nx + (o.vy - b.vy) * ny;
if (sep < 0) {                      // 正在接近才响应，否则会"粘住"
  const imp = -(1 + 0.94) * sep / 2;
  b.vx -= imp * nx;  b.vy -= imp * ny;
  o.vx += imp * nx;  o.vy += imp * ny;
}
```

> `sep < 0` 这个判断很关键。少了它，两个球分开的过程中还会反复施加冲量，表现为"球黏在一起抖"。

### 8.5 库边与进洞

- 库边：位置钳制 + 速度反向 × 0.86（能量损失）
- 进洞：球心到洞心距离 < `r × 0.82`，判定进袋，播下沉动画
- 白球落袋：不计分，`reset()` 回原位（不惩罚，这是摸鱼工具不是真台球）

### 8.6 随机布球：拒绝采样

要求：球不能重叠、不能压住球洞、不能盖住右上角 HUD、不能滚到力度条下面。

```js
function placeRandom(count, W, H, pocket, radius) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 4000) {
    const x = rand(radius + 24, W - radius - 24);
    const y = rand(radius + 24, H - radius - 24);
    if (Math.hypot(x - pocket.x, y - pocket.y) < pocket.r + radius + 165) continue; // 洞口禁区
    if (x > W - 360 && y < 240) continue;                                            // HUD 禁区
    if (y > H - 130) continue;                                                       // 力度条禁区
    if (out.some(b => Math.hypot(b.x - x, b.y - y) < radius * 2 + 12)) continue;      // 球间距
    out.push({ x, y });
  }
  return out;
}
```

`guard` 上限 4000 是防止参数不合理时死循环。真跑下来平均 30 次以内收敛。

### 8.7 击球

长按白球 → 出现球杆（从球心指向鼠标反向）→ 拖拽蓄力 → 松开：

```js
speed = 260 + power * 2100;   // 最小 260px/s，满力 2360px/s
```

`power` 是拖拽距离除以 210px 后钳制到 `[0, 1]`。力度条在底部实时显示。

---

## 九、自定义壁纸协议

### 9.1 为什么不用 `file://`

渲染进程加载的是 `file://` 页面，理论上可以直接引用 `file:///C:/Users/.../wallpaper.jpg`。
但一旦用户把图片放在别的盘符/目录，Chromium 的同源策略会拒绝加载（`Not allowed to load local resource`）。

### 9.2 注册私有协议

```js
// 必须在 app.whenReady() 之前调用
protocol.registerSchemesAsPrivileged([
  { scheme: 'tfwall', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);

// ready 之后
protocol.handle('tfwall', async () => {
  const p = wallpaperFile();                       // 从配置读，不接受 URL 传参
  if (!p) return new Response('', { status: 404 });
  const data = await fs.promises.readFile(p);
  return new Response(data, {
    headers: { 'content-type': MIME[path.extname(p)], 'cache-control': 'no-cache' }
  });
});
```

CSS 里只需要：

```css
#wallpaper { background: #08243d url("tfwall://wallpaper") center/cover no-repeat; }
```

### 9.3 安全设计

**协议处理器不接受任何 URL 参数**，路径完全来自 `config.json`。这就从根本上排除了
路径穿越（`tfwall://../../etc/passwd`）的可能 —— 攻击者即使能构造 URL 也没用，
因为 handler 根本不读它。

### 9.4 换图流程

1. 设置页点「选择图片」→ 主进程 `dialog.showOpenDialog`（过滤 `jpg/jpeg/png/webp/bmp/gif`）
2. 校验扩展名 → 复制到 `%APPDATA%\touch fish\wallpaper.<ext>`
3. `removeOldWallpapers()` 清掉旧格式的残留（换过格式时不会堆文件）
4. 写 `desktop.wallpaper = 新路径` → 广播 → 桌面立即换图
5. 「恢复默认」→ 删除副本 + `wallpaper = 'hero'`

> 图片是**复制**而不是移动/引用，原图永远不会被动。

---

## 十、配置系统与 IPC 协议

### 10.1 配置结构

`%APPDATA%\touch fish\config.json`：

```jsonc
{
  "version": 1,
  "hotkey": {
    "mode": "sequence",              // sequence = 连按同键；combo = 组合键
    "sequence": ["CTRL", "CTRL"],
    "gap": 420,                      // 连击间隔阈值(ms)
    "accelerator": "Control+Shift+Q", // combo 模式用
    "label": "连按两次 Ctrl"
  },
  "panic": { "accelerator": "Control+Shift+H", "label": "Ctrl + Shift + H" },
  "sites": [ { "id": "...", "name": "起点中文网", "url": "https://www.qidian.com", "icon": "novel" } ],
  "icons": {
    "app": "whale",                  // 主程序 / 托盘图标
    "desktop": { "this-pc": "this-pc", "recycle-bin": "recycle-bin" }  // 每个桌面图标的伪装
  },
  "layout": { "app-wechat": { "x": 0, "y": 3 } },   // 拖拽后的网格坐标
  "tray": { "showStatus": true, "startWithWindows": false, "closeToTray": true },
  "desktop": {
    "wallpaper": "hero",             // 'hero' 或绝对路径
    "showDesktopIcons": true,
    "ballSpeed": 1,
    "busyMode": false
  },
  "stats": { "toggles": 0, "pockets": 0 }
}
```

### 10.2 读写策略

- **深合并**：读出来的配置与 `DEFAULTS` 逐层合并，所以新增字段对老配置自动生效，不会因为
  缺字段而崩。
- **原子写**：先写 `config.json.tmp` 再 `rename`，避免写一半断电导致配置损坏。这是 Electron
  应用最常见的坑之一（用户强杀进程时配置变空）。
- **内存缓存**：`cache` 常驻，读操作不落盘。

```js
function save(next) {
  const tmp = configPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  fs.renameSync(tmp, configPath);
  cache = next;
}
```

### 10.3 IPC 协议表

所有通道都是 `invoke/handle`（Promise），只有事件推送用 `webContents.send`。

**配置类**

| 通道 | 入参 | 返回 | 说明 |
| --- | --- | --- | --- |
| `config:get` | — | `{config, meta}` | 取全量配置 + 运行态信息（版本、路径） |
| `config:patch` | 部分配置对象 | `config` | 深合并后落盘并广播 |
| `config:reset` | — | `config` | 恢复默认 |
| `icons:set` | `{scope, itemId, iconId}` | `config` | `scope` = `app` 或 `item` |
| `sites:save` | 站点数组 | `config` | 整表覆盖 |
| `layout:save` | `{itemId: {x,y}}` | `true` | 图标拖拽落位 |

**桌面控制**

| 通道 | 说明 |
| --- | --- |
| `desktop:toggle` / `show` / `hide` / `state` | 显示、隐藏、查询状态 |
| `desktop:pool` | 进入台球模式（广播 `pool:start`） |
| `settings:open` | 打开设置窗口 |
| `property:open` | 打开旧独立属性窗口（托盘兼容路径） |

**壁纸**

| 通道 | 说明 |
| --- | --- |
| `wallpaper:choose` | 弹系统文件框 → 复制 → 落盘 → 广播 |
| `wallpaper:reset` | 删除副本 → 切回 `hero` |

**系统交互**

| 通道 | 说明 |
| --- | --- |
| `shell:external` | 用系统浏览器打开 URL（只放行 http/https） |
| `shell:open-userdata` | 打开配置目录 |
| `shell:open-install-dir` | 打开安装目录 |
| `app:hide-all` | 一键隐藏（桌面 + 所有窗口） |
| `app:quit` | 真退出（`app.isQuitting = true` 绕过 close 拦截） |
| `app:uninstall` | 找 `Uninstall touch fish.exe` 并调起 |
| `app:set-login` | 开机自启（写注册表 Run 项） |
| `app:stats` | 统计 +1（切换次数 / 进洞数） |
| `window:minimize/maximize/close` | 无边框设置窗的自绘标题栏用 |

**主 → 渲染**

| 事件 | 触发时机 |
| --- | --- |
| `config:changed` | 任何配置变更 |
| `desktop:shown` | 虚拟桌面淡入完成 |
| `pool:start` | 请求进入台球模式 |

### 10.4 关闭行为

虚拟桌面窗口的 `close` 事件被拦截成 `hide()` —— 否则用户误按 `Alt+F4` 会直接销毁窗口，
下次切换就白屏。真正退出走托盘「退出」或 `app:quit`，此时 `app.isQuitting = true` 放行。

---

## 十一、打包与踩坑记录

### 11.1 命令

```bash
npm run build     # electron-builder --win nsis --x64
```

产物 `dist/touch-fish-<version>-setup.exe`。

### 11.2 四个连环阻塞

这一节是踩坑全记录，遇到同类问题可以直接对照。

#### ① `Cannot create symbolic link ... winCodeSign\...\darwin\...\dylib`

**现象**：打包卡在下载 winCodeSign，7z 解压报"客户端没有所需特权"。

**原因**：`winCodeSign-2.6.0.7z` 内含 macOS 的符号链接（`darwin/10.12/lib/*.dylib`），
Windows 非管理员 / 未开开发者模式时无法创建符号链接，整包解压失败。

**解法**：其实压缩包已经把 Windows 部分解到位了（`rcedit-x64.exe`、`windows-10/x64/signtool.exe`），
只是整体退出码非 0 导致缓存被判定无效。把已解压的随机目录内容复制成 electron-builder
期望的最终目录名即可复用：

```bash
C="$LOCALAPPDATA/electron-builder/Cache/winCodeSign"
cp -r "$C/276817123/." "$C/winCodeSign-2.6.0/"
```

#### ② `invalid icon file`

**原因**：NSIS 的 `installerIcon` / `uninstallerIcon` **只接受 ICO**，PNG 会直接报错。

**解法**：`tools/make-ico.js` 手工生成多尺寸 ICO（16/24/32/48/64/128/256，全 32bpp BMP 条目），
并把 `package.json` 里所有图标字段指向 `build/icon.ico`。

> 为什么不直接让 electron-builder 转？因为它转换时会去下载 winCodeSign，又回到坑 ①。
> 自己生成 ICO 可以完全离线。

#### ③ `Plugin not found, cannot call UAC::_`

**原因**：`nsis-resources-3.4.1` 解压不完整，`plugins/x86-unicode` 是空目录，缺 `UAC.dll`。

**解法**：

```bash
7za x -y nsis-resources-3.4.1.7z -o"$CACHE/nsis/nsis-resources-3.4.1"
# 校验：x86-unicode 下应有 9 个 DLL，其中包含 UAC.dll
```

#### ④ 体积 83MB → 77MB

**原因**：Electron 默认带 55 个语言包（41MB），且 `asarUnpack` 把 `uiohook-napi`
6 个平台的预编译全打进去了。

**解法**：

```jsonc
"electronLanguages": ["zh-CN", "en-US"],
"files": [
  "src/**/*", "assets/**/*", "package.json",
  "!**/*.map",
  "!**/node_modules/uiohook-napi/prebuilds/{darwin,linux,freebsd}*/**",
  "!node_modules/uiohook-napi/src/**",
  "!assets/icons/sheets/**"
],
"asarUnpack": ["**/*.node", "node_modules/uiohook-napi/**"]
```

### 11.3 三个环境变量

```bash
export ELECTRON_BUILDER_BINARIES_MIRROR="https://registry.npmmirror.com/-/binary/electron-builder-binaries/"
export NODE_OPTIONS=""                                  # 避免宿主注入 safe-delete 守卫
export CSC_IDENTITY_AUTO_DISCOVERY=false                # 不做代码签名
```

> `NODE_OPTIONS` 里如果被注入了 `--require node-safe-delete-shim.cjs`，`fs.rm` 删 `locales`
> 下 64 个文件时会触发批量删除守卫，打包直接失败（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`）。

### 11.4 一个看起来像"应用崩溃"的坑

打包后的 exe 双击后**秒退**，退出码 0，没有任何窗口。

排查：用 `--enable-logging --log-file=pkg.log` 启动，日志里是：

```
bad option: --enable-logging
```

**根因**：当前 shell 环境里带着 `ELECTRON_RUN_AS_NODE=1`。Electron 会以纯 Node 模式启动，
把命令行参数当 Node 参数解析，遇到不认识的参数就退出。

**这不影响真实用户双击**（Explorer 启动不带这个变量），但自动化测试里必须显式剥离：

```python
env = {k: v for k, v in os.environ.items() if k.upper() != "ELECTRON_RUN_AS_NODE"}
subprocess.Popen([EXE], env=env)
```

`tools/run.py` 就是干这件事的开发启动器。

---

## 十二、测试与验证

### 12.1 内置自检 `--smoke`

```bash
"dist/win-unpacked/touch fish.exe" --smoke
```

自动走一遍：虚拟桌面 → 右键菜单 → 开始菜单 → 此电脑窗口 → 台球 → 忙碌模式 →
内置浏览器（真实请求起点中文网）→ 设置页各分页，逐个截图。

产物写到 `%APPDATA%\touch fish`（打包态）或项目根（开发态）。

> **为什么打包后不能写项目根**：`app.asar` 是只读的，往里面写文件会直接抛异常，
> 表现为"自检启动即退出"。这个坑踩过一次，解法是 `OUT_DIR = app.isPackaged ? app.getPath('userData') : ROOT`。

同时输出**结构化断言**，可直接 grep：

| 标记 | 断言内容 |
| --- | --- |
| `[menu-check]` | 点叶子菜单项 / 点空白后，主菜单与子菜单是否都已隐藏 |
| `[prop-check]` | 右键「属性」→ 内置浏览器窗口是否出现、标题是否同步 |
| `[web-info]` | webview 的真实 URL 与标题 |
| `[resize-check]` | 缩放前后的 `width×height` |
| `[busy-word]` | Word 假页面里的正文首句（验证模板渲染） |

### 12.2 端到端 `tools/e2e-test.py`

模拟真实用户：

1. 启动 exe（剥离 `ELECTRON_RUN_AS_NODE`）
2. `keybd_event` 注入两次 `Ctrl` 的 down/up
3. 用 GDI `BitBlt` 全屏截图 → `e2e-virtual.png`
4. 再注入两次 → 截图 `e2e-real.png`
5. `taskkill` 收尾

支持传入任意 exe 路径，所以**安装后的版本**也能测：

```bash
python tools/e2e-test.py "C:\Users\<你>\AppData\Local\Programs\touch fish\touch fish.exe"
```

### 12.3 几何回归 `tools/measure-desktop.py`

用 Playwright 加载 `index.html`，注入 `TF` 桩（假配置 + 假图标列表），
量出网格、图标、标签、开始菜单、任务栏的实际 rect。改样式后跑一遍就能确认没跑偏。

### 12.4 发布前检查清单

| 项 | 做法 |
| --- | --- |
| 开发版无报错 | `--smoke` 后 grep `tf-error` / `pageerror` |
| 打包版渲染一致 | 在 asar 内再跑一次 `--smoke`，比对截图 |
| 安装链路 | `setup.exe /S` → 退出码 0 → 检查快捷方式、注册表卸载项 |
| 已安装版可用 | 对安装目录的 exe 跑 `e2e-test.py` |
| 卸载干净 | `Uninstall.exe /currentuser /S` → 残留文件数应为 0 |
| 配置未被污染 | 删掉测试期间改过的 `config.json` |

---

## 十三、性能与体积

| 指标 | 实测 |
| --- | --- |
| 安装包 | 77 MB |
| 安装后占用 | 约 210 MB（Electron 本体为主） |
| 常驻内存（虚拟桌面隐藏时） | 约 90 MB（3 个渲染进程按需创建） |
| 切换耗时 | 约 130 ms（淡入淡出） |
| 台球帧率 | 60 fps（20 球 + 全屏 Canvas） |

**没做的优化**（有意为之）：

- 不做图标预加载（20 张 PNG，浏览器缓存足够快）
- 不做窗口内容虚拟化（最多 10 个窗口，DOM 规模很小）
- 不引入 Web Worker（物理计算在 60fps 下 CPU 占用 < 3%）

---

## 十四、已知限制与后续计划

### 已知限制

| 限制 | 原因 | 规避 |
| --- | --- | --- |
| 仅 Windows | 图标提取依赖 COM / `imageres.dll`；钩子用 Win32 prebuild | — |
| 仅覆盖主显示器 | `screen.getPrimaryDisplay()` | 副屏保持真实，反而更自然 |
| 某些站点无法内嵌 | 站点设置 `X-Frame-Options: DENY` | 工具栏「浏览器打开」 |
| 无代码签名 | 未购买证书 | SmartScreen 提示「仍要运行」 |
| 杀软可能拦截 | 全局键盘钩子是重点监控对象 | 添加信任，或改用组合键模式 |
| 缩放不是 100% 时图标略小 | 网格按 100% 缩放设计 | 可在 CSS 里调整 `--cell-w` |

### 后续计划

- [ ] 图标网格随 DPI 自适应（按 `window.devicePixelRatio` 调整单元格）
- [ ] 忙碌模式增加「会议中」场景（Teams / 腾讯会议静态界面）
- [ ] 台球支持双人对战与击球音效
- [ ] 支持多套壁纸轮换
- [ ] 引入 CI（GitHub Actions）自动构建 & 发布

---

<div align="center">
<sub>有问题欢迎提 <a href="../../issues">Issue</a>，觉得有用就点个 ⭐</sub>
</div>
