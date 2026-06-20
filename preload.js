// preload.js
// Безопасный мост между ASCII VISOR UI и Electron main process.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('asciiVisorDesktop', {
  ping: () => ipcRenderer.invoke('desktop:ping'),
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  getFfmpegInfo: () => ipcRenderer.invoke('desktop:ffmpeg-info'),
  pickVideoFile: () => ipcRenderer.invoke('desktop:pick-video-file'),
  extractVideoFrames: (payload) => ipcRenderer.invoke('desktop:extract-video-frames', payload),

  // Тестовый MP4 pipeline:
  // выбрать видео → выбрать место сохранения → FFmpeg делает MP4.
  transcodeMp4Test: () => ipcRenderer.invoke('desktop:transcode-mp4-test'),

  // Старый тест: весь массив PNG frames → MP4.
  renderPngFramesToMp4Test: (payload) =>
    ipcRenderer.invoke('desktop:render-png-frames-to-mp4-test', payload),

  // Новый потоковый MP4 pipeline:
  // старт → пишем кадры по одному → finish запускает FFmpeg.
  startMp4RenderSession: (payload) =>
    ipcRenderer.invoke('desktop:mp4-render-session-start', payload),

  writeMp4RenderFrame: (payload) =>
    ipcRenderer.invoke('desktop:mp4-render-session-write-frame', payload),

  finishMp4RenderSession: (payload) =>
    ipcRenderer.invoke('desktop:mp4-render-session-finish', payload),

  cancelMp4RenderSession: (payload) =>
    ipcRenderer.invoke('desktop:mp4-render-session-cancel', payload),
});