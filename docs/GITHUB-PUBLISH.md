# GitHub 仓库发布信息

> 本文件记录本仓库在 GitHub 上对外展示的元信息，便于日后修改或迁移时直接取用。
> Release 正文见 [`RELEASE-NOTES-v1.1.0.md`](RELEASE-NOTES-v1.1.0.md)。

---

## 仓库名称

```
touch-fish
```

## About（仓库描述，≤ 350 字符）

**中文（推荐）**

```
连按两次 Ctrl，立刻切换到高度仿真的 Windows 10 虚拟桌面：真实系统图标、任务栏、开始菜单、窗口拖拽缩放，外加台球玩法、忙碌模式与自定义壁纸。Electron 实现，纯本地运行。
```

**English**

```
Press Ctrl twice to instantly switch into a pixel-faithful Windows 10 desktop — real system icons, taskbar, Start menu, draggable windows, plus a pool mini-game, a busy mode and custom wallpaper. Built with Electron, fully local.
```

## Website

```
https://github.com/1464530024/touch-fish/releases/latest
```

## Topics（最多 20 个）

```
electron
windows10
fake-desktop
boss-key
privacy-screen
desktop
typescript
javascript
nodejs
electron-app
windows-desktop
minigame
```

## 社交预览图（Social preview）

上传 `docs/images/banner.png`（1280×360）作为仓库社交预览图，
在仓库 **Settings → General → Social preview** 处设置。

---

## Release 信息

| 字段 | 值 |
| --- | --- |
| Tag | `v1.1.0` |
| Target | `main` |
| Title | `v1.1.0 · 忙碌模式 + 内置浏览器 + 自定义壁纸` |
| Body | 见 [`RELEASE-NOTES-v1.1.0.md`](RELEASE-NOTES-v1.1.0.md) |
| Assets | `touch-fish-1.1.0-setup.exe`（73.6 MB） |

校验和：

```
SHA256  c8c2172603d38b6d303b69dd0c5e81ff277cd755881d7b3df52306313b6e9901
```

> 若重新打包，校验和会变（NSIS 内含时间戳），发布前请重新计算并同步更新
> `RELEASE-NOTES-v1.1.0.md`。

---

## 首次推送命令（备查）

```bash
git init -b main
git add -A
git commit -m "feat: touch fish v1.1.0 — Windows 10 伪装桌面"
git remote add origin git@github.com:1464530024/touch-fish.git
git push -u origin main
```
