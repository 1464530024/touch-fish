/**
 * touch fish · 全局快捷键
 * 默认「连按两次 Ctrl」切换虚拟桌面。
 * 通过 uiohook-napi 的低级键盘钩子监听裸修饰键（组合键模式走 Electron globalShortcut）。
 */

const MODIFIERS = new Set(['CTRL', 'ALT', 'SHIFT', 'WIN']);

let uIOhook = null;
let UiohookKey = null;
let hookReady = false;
let hookError = '';

function loadHook() {
  if (hookReady) return true;
  try {
    const mod = require('uiohook-napi');
    uIOhook = mod.uIOhook;
    UiohookKey = mod.UiohookKey;
    hookReady = true;
    return true;
  } catch (e) {
    hookError = e.message;
    return false;
  }
}

/** keycode -> 语义 token */
function buildKeyMap() {
  const map = new Map();
  const put = (code, token) => {
    if (typeof code === 'number') map.set(code, token);
  };
  const K = UiohookKey || {};
  put(K.Ctrl, 'CTRL');
  put(K.CtrlRight, 'CTRL');
  put(K.Alt, 'ALT');
  put(K.AltRight, 'ALT');
  put(K.Shift, 'SHIFT');
  put(K.ShiftRight, 'SHIFT');
  put(K.Meta, 'WIN');
  put(K.MetaRight, 'WIN');
  put(K.Space, 'SPACE');
  put(K.Backquote, '`');
  put(K.Escape, 'ESC');
  for (let i = 1; i <= 24; i++) put(K['F' + i], 'F' + i);
  for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') put(K[ch], ch);
  for (let d = 0; d <= 9; d++) {
    if (K['Digit' + d] !== undefined) put(K['Digit' + d], String(d));
    if (K['Num' + d] !== undefined) put(K['Num' + d], String(d));
  }
  return map;
}

let KEYMAP = null;

const TOKEN_LABEL = {
  CTRL: 'Ctrl',
  ALT: 'Alt',
  SHIFT: 'Shift',
  WIN: 'Win',
  SPACE: '空格',
  '`': '`',
  ESC: 'Esc'
};

function formatLabel(hotkey) {
  if (!hotkey) return '未设置';
  if (hotkey.mode === 'combo') return hotkey.label || hotkey.accelerator || '未设置';
  const tokens = (hotkey.sequence || []).map((t) => TOKEN_LABEL[t] || t);
  if (tokens.length === 2 && tokens[0] === tokens[1]) return `连按两次 ${tokens[0]}`;
  if (tokens.length === 3 && tokens[0] === tokens[2] && tokens[1] === tokens[2]) return `连按三次 ${tokens[2]}`;
  return tokens.join(' → ');
}

class KeyWatcher {
  constructor({ sequence, gap, onMatch, onError }) {
    this.sequence = sequence || [];
    this.gap = gap || 420;
    this.onMatch = onMatch;
    this.onError = onError || (() => {});
    this.pressed = new Set();
    this.hits = [];
    this.timer = null;
    this._down = null;
    this._up = null;
  }

  start() {
    if (!loadHook()) {
      this.onError('键盘钩子不可用：' + hookError);
      return false;
    }
    if (!KEYMAP) KEYMAP = buildKeyMap();
    try {
      this._down = (e) => {
        const token = KEYMAP.get(e.keycode);
        if (!token) return;
        if (this.pressed.has(token)) return; // 过滤长按自动重复
        this.pressed.add(token);
        this.registerPress(token);
      };
      this._up = (e) => {
        const token = KEYMAP.get(e.keycode);
        if (token) this.pressed.delete(token);
      };
      uIOhook.on('keydown', this._down);
      uIOhook.on('keyup', this._up);
      uIOhook.start();
      return true;
    } catch (e) {
      this.onError('键盘钩子启动失败：' + e.message);
      return false;
    }
  }

  registerPress(key) {
    const seq = this.sequence;
    if (!seq.length) return;
    if (key !== seq[0]) {
      this.hits = [];
      return;
    }
    const now = Date.now();
    if (this.hits.length && now - this.hits[this.hits.length - 1] > this.gap) this.hits = [];
    this.hits.push(now);
    if (this.hits.length >= seq.length) {
      this.hits = [];
      clearTimeout(this.timer);
      this.onMatch();
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.hits = [];
    }, this.gap + 80);
  }

  stop() {
    clearTimeout(this.timer);
    if (uIOhook) {
      try {
        if (this._down) uIOhook.off('keydown', this._down);
        if (this._up) uIOhook.off('keyup', this._up);
        uIOhook.stop();
      } catch {}
    }
    this.hits = [];
    this.pressed.clear();
  }
}

module.exports = { KeyWatcher, formatLabel, TOKEN_LABEL, MODIFIERS };
