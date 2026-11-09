const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('sac', {
  getFavorites: () => ipcRenderer.invoke('favorites:get'),
  setFavorites: (list) => ipcRenderer.invoke('favorites:set', list),
  setTheme: (mode) => ipcRenderer.invoke('theme:set', mode),
});
