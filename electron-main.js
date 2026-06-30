'use strict';

const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const ffmpegPath = require('ffmpeg-static');

function resolveFfmpegPath() {
  if (!ffmpegPath) return null;
  if (!app.isPackaged) return ffmpegPath;
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 720,
    backgroundColor: '#050505',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'local.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('ascii-visor:get-runtime-info', () => ({
    isPackaged: app.isPackaged,
    ffmpegPath: resolveFfmpegPath()
  }));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
