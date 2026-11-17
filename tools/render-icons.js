/**
 * 构建期图标栅格化：把 iconlib 里的 SVG 渲染成 64px PNG（供托盘 / 窗口图标使用），
 * 并把品牌 logo 转成 PNG 作为安装包图标。
 * 用法：npm run icons
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const { ICONS } = require('../src/shared/iconlib');

const ROOT = path.join(__dirname, '..');
const TRAY_DIR = path.join(ROOT, 'assets', 'tray');
const BUILD_DIR = path.join(ROOT, 'build');

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  fs.mkdirSync(TRAY_DIR, { recursive: true });
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const win = new BrowserWindow({
    show: false,
    width: 240,
    height: 240,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  });
  await win.loadURL('data:text/html,<html><head><meta charset="utf-8"></head><body></body></html>');

  const payload = JSON.stringify(ICONS.map((i) => ({ id: i.id, svg: i.svg })));
  const result = await win.webContents.executeJavaScript(`(async () => {
    const icons = ${payload};
    const out = {};
    for (const it of icons) {
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(it.svg);
      await img.decode();
      const size = 64;
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      out[it.id] = c.toDataURL('image/png').split(',')[1];
    }
    return out;
  })()`);

  let count = 0;
  for (const [id, b64] of Object.entries(result)) {
    const out = path.join(TRAY_DIR, id + '.png');
    // 真实系统图标已由 tools/extract-icons.py 提取，不覆盖
    if (fs.existsSync(out) && process.env.FORCE_SVG_TRAY !== '1') continue;
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    count++;
  }

  const logoPath = path.join(ROOT, 'assets', 'logo.jpg');
  const logoPng = path.join(ROOT, 'assets', 'logo.png');
  if (fs.existsSync(logoPath)) {
    const img = nativeImage.createFromPath(logoPath);
    fs.writeFileSync(logoPng, img.toPNG());
    const big = img.resize({ width: 1024, height: 1024, quality: 'best' });
    fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), big.toPNG());
    fs.writeFileSync(path.join(ROOT, 'assets', 'logo-256.png'), img.resize({ width: 256, height: 256, quality: 'best' }).toPNG());
  }

  console.log(`[icons] 生成 ${count} 个托盘图标 -> assets/tray`);
  console.log('[icons] 生成 build/icon.png, assets/logo.png');
  app.quit();
});
