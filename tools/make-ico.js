/**
 * 生成多尺寸 Windows ICO（32 位 BMP 条目，兼容 NSIS / rcedit / 资源管理器）
 * 用法：python tools/run.py tools/make-ico.js
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'logo.jpg');
const OUT = path.join(ROOT, 'build', 'icon.ico');
const SIZES = [16, 24, 32, 48, 64, 128, 256];

function buildIco(entries) {
  // entries: [{size, rgba}]
  const count = entries.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirs = [];
  const datas = [];
  let offset = 6 + count * 16;

  for (const { size, rgba } of entries) {
    const xor = Buffer.alloc(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const src = ((size - 1 - y) * size + x) * 4; // 底向上
        const dst = (y * size + x) * 4;
        xor[dst] = rgba[src + 2];
        xor[dst + 1] = rgba[src + 1];
        xor[dst + 2] = rgba[src];
        xor[dst + 3] = rgba[src + 3];
      }
    }
    const maskRow = Math.ceil(size / 32) * 4;
    const mask = Buffer.alloc(maskRow * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const a = rgba[((size - 1 - y) * size + x) * 4 + 3];
        if (a === 0) mask[y * maskRow + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    const bih = Buffer.alloc(40);
    bih.writeUInt32LE(40, 0);
    bih.writeInt32LE(size, 4);
    bih.writeInt32LE(size * 2, 8);
    bih.writeUInt16LE(1, 12);
    bih.writeUInt16LE(32, 14);
    bih.writeUInt32LE(0, 16);
    bih.writeUInt32LE(xor.length + mask.length, 20);

    const data = Buffer.concat([bih, xor, mask]);
    const dir = Buffer.alloc(16);
    dir.writeUInt8(size === 256 ? 0 : size, 0);
    dir.writeUInt8(size === 256 ? 0 : size, 1);
    dir.writeUInt8(0, 2);
    dir.writeUInt8(0, 3);
    dir.writeUInt16LE(1, 4);
    dir.writeUInt16LE(32, 6);
    dir.writeUInt32LE(data.length, 8);
    dir.writeUInt32LE(offset, 12);

    dirs.push(dir);
    datas.push(data);
    offset += data.length;
  }
  return Buffer.concat([header, ...dirs, ...datas]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 300, height: 300 });
  await win.loadURL('data:text/html,<html><body></body></html>');
  const b64 = nativeImage.createFromPath(SRC).toPNG().toString('base64');

  const entries = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = 'data:image/png;base64,${b64}';
    await img.decode();
    const sizes = ${JSON.stringify(SIZES)};
    const out = [];
    for (const s of sizes) {
      const c = document.createElement('canvas');
      c.width = s; c.height = s;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, s, s);
      const d = ctx.getImageData(0, 0, s, s).data;
      out.push({ size: s, data: Array.from(d) });
    }
    return out;
  })()`);

  const buf = buildIco(entries.map((e) => ({ size: e.size, rgba: Buffer.from(e.data) })));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log('[ico] 生成', OUT, buf.length, 'bytes, sizes', SIZES.join('/'));
  app.exit(0);
});
