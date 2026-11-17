/**
 * touch fish · 本地配置存储
 * 全部配置保存在 %APPDATA%\touch fish\config.json，纯本地、不联网。
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { BASE_ITEMS, DEFAULT_SITES } = require('../shared/desktop-items');

const DEFAULTS = {
  version: 1,
  hotkey: {
    mode: 'sequence', // sequence = 连续按同一个键；combo = 组合键
    sequence: ['CTRL', 'CTRL'],
    gap: 420,
    accelerator: 'Control+Shift+Q',
    label: '连按两次 Ctrl'
  },
  panic: { accelerator: 'Control+Shift+H', label: 'Ctrl + Shift + H' },
  sites: DEFAULT_SITES,
  icons: {
    app: 'whale',
    desktop: BASE_ITEMS.reduce((acc, it) => {
      acc[it.id] = it.icon;
      return acc;
    }, {})
  },
  layout: {},
  tray: {
    showStatus: true,
    startWithWindows: false,
    closeToTray: true,
    tooltip: 'touch fish'
  },
  desktop: {
    wallpaper: 'hero', // 'hero' = Win10 官方默认；其它值为用户自选图片的绝对路径
    showDesktopIcons: true,
    ballSpeed: 1,
    busyMode: false // 忙碌模式：在桌面上铺几个假的工作页面
  },
  stats: { toggles: 0, pockets: 0 }
};

let configPath = null;
let cache = null;

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function merge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!isPlainObject(patch)) return out;
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) out[k] = merge(out[k], v);
    else out[k] = v;
  }
  return out;
}

function init() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  configPath = path.join(dir, 'config.json');
  cache = null;
  return get();
}

function get() {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    cache = merge(DEFAULTS, JSON.parse(raw));
  } catch {
    cache = JSON.parse(JSON.stringify(DEFAULTS));
  }
  // 补齐新增的默认图标映射
  cache.icons.desktop = cache.icons.desktop || {};
  for (const it of BASE_ITEMS) {
    if (!cache.icons.desktop[it.id]) cache.icons.desktop[it.id] = it.icon;
  }
  return cache;
}

function save() {
  try {
    const tmp = configPath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
    fs.renameSync(tmp, configPath);
  } catch (e) {
    console.error('[store] 保存配置失败', e);
  }
}

function patch(part) {
  cache = merge(get(), part);
  save();
  return cache;
}

function reset() {
  cache = JSON.parse(JSON.stringify(DEFAULTS));
  save();
  return cache;
}

function configFile() {
  return configPath;
}

module.exports = { init, get, save, patch, reset, configFile, DEFAULTS };
