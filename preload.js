// preload.js
// Безопасный мост между ASCII VISOR UI и Electron main process.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asciiVisorDesktop', {
  ping: () => ipcRenderer.invoke('desktop:ping'),
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
});