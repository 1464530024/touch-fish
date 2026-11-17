const { contextBridge, ipcRenderer } = require('electron');
const { ICONS } = require('../shared/iconlib');

contextBridge.exposeInMainWorld('TF', {
  icons: ICONS.map(({ id, label, group, svg, file }) => ({ id, label, group, svg, file })),
  getConfig: () => ipcRenderer.invoke('config:get'),
  openExternal: (url) => ipcRenderer.invoke('shell:external', url),
  hideAll: () => ipcRenderer.invoke('app:hide-all'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  onReload: (fn) => ipcRenderer.on('property:reload', (_e, p) => fn(p))
});
