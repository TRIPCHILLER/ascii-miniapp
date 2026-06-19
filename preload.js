// preload.js
// Безопасный мост между ASCII VISOR UI и Electron main process.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asciiVisorDesktop', {
  ping: () => ipcRenderer.invoke('desktop:ping'),
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  getFfmpegInfo: () => ipcRenderer.invoke('desktop:ffmpeg-info'),

  // Тестовый MP4 pipeline:
  // выбрать видео → выбрать место сохранения → FFmpeg делает MP4.
  transcodeMp4Test: () => ipcRenderer.invoke('desktop:transcode-mp4-test'),

  // Первый ASCII → PNG frames → MP4 тест.
  renderPngFramesToMp4Test: (payload) =>
    ipcRenderer.invoke('desktop:render-png-frames-to-mp4-test', payload),
});