const { contextBridge, ipcRenderer } = require('electron');
const { ICONS, iconSvg } = require('../shared/iconlib');
const { BASE_ITEMS } = require('../shared/desktop-items');

const listeners = new Set();
ipcRenderer.on('config:changed', (_e, payload) => {
  listeners.forEach((fn) => fn(payload));
});
ipcRenderer.on('desktop:shown', () => {
  document.dispatchEvent(new CustomEvent('tf:shown'));
});
ipcRenderer.on('pool:start', () => {
  document.dispatchEvent(new CustomEvent('tf:pool'));
});
ipcRenderer.on('web:open', (_e, payload) => {
  document.dispatchEvent(new CustomEvent('tf:web', { detail: payload }));
});

contextBridge.exposeInMainWorld('TF', {
  icons: ICONS.map(({ id, label, group, svg, file }) => ({ id, label, group, svg, file })),
  baseItems: BASE_ITEMS,
  iconSvg,
  getConfig: () => ipcRenderer.invoke('config:get'),
  patchConfig: (part) => ipcRenderer.invoke('config:patch', part),
  setIcon: (payload) => ipcRenderer.invoke('icons:set', payload),
  saveSites: (sites) => ipcRenderer.invoke('sites:save', sites),
  saveLayout: (layout) => ipcRenderer.invoke('layout:save', layout),
  toggleDesktop: () => ipcRenderer.invoke('desktop:toggle'),
  hideDesktop: () => ipcRenderer.invoke('desktop:hide'),
  showDesktop: () => ipcRenderer.invoke('desktop:show'),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  openProperty: (payload) => ipcRenderer.invoke('property:open', payload),
  openExternal: (url) => ipcRenderer.invoke('shell:external', url),
  chooseWallpaper: () => ipcRenderer.invoke('wallpaper:choose'),
  resetWallpaper: () => ipcRenderer.invoke('wallpaper:reset'),
  hideAll: () => ipcRenderer.invoke('app:hide-all'),
  quit: () => ipcRenderer.invoke('app:quit'),
  stats: (key) => ipcRenderer.invoke('app:stats', key),
  onConfigChanged: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
});
