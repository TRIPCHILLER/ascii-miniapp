'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asciiVisorDesktop', {
  getRuntimeInfo: () => ipcRenderer.invoke('ascii-visor:get-runtime-info')
});
