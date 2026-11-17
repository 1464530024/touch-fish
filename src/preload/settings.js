const { contextBridge, ipcRenderer } = require('electron');
const { ICONS } = require('../shared/iconlib');
const { BASE_ITEMS } = require('../shared/desktop-items');

const listeners = new Set();
ipcRenderer.on('config:changed', (_e, payload) => listeners.forEach((fn) => fn(payload)));

contextBridge.exposeInMainWorld('TF', {
  icons: ICONS.map(({ id, label, group, svg, file }) => ({ id, label, group, svg, file })),
  baseItems: BASE_ITEMS,
  getConfig: () => ipcRenderer.invoke('config:get'),
  patchConfig: (part) => ipcRenderer.invoke('config:patch', part),
  resetConfig: () => ipcRenderer.invoke('config:reset'),
  setIcon: (payload) => ipcRenderer.invoke('icons:set', payload),
  saveSites: (sites) => ipcRenderer.invoke('sites:save', sites),
  openSettings: () => ipcRenderer.invoke('settings:open'),
  openProperty: (payload) => ipcRenderer.invoke('property:open', payload),
  openExternal: (url) => ipcRenderer.invoke('shell:external', url),
  chooseWallpaper: () => ipcRenderer.invoke('wallpaper:choose'),
  resetWallpaper: () => ipcRenderer.invoke('wallpaper:reset'),
  openUserData: () => ipcRenderer.invoke('shell:open-userdata'),
  openInstallDir: () => ipcRenderer.invoke('shell:open-install-dir'),
  setLogin: (v) => ipcRenderer.invoke('app:set-login', v),
  uninstall: () => ipcRenderer.invoke('app:uninstall'),
  hideAll: () => ipcRenderer.invoke('app:hide-all'),
  quit: () => ipcRenderer.invoke('app:quit'),
  toggleDesktop: () => ipcRenderer.invoke('desktop:toggle'),
  startPool: () => ipcRenderer.invoke('desktop:pool'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  onConfigChanged: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }
});
