// electron-main.js
// ASCII VISOR LOCAL — минимальная Electron-оболочка.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ffmpegPath = require('ffmpeg-static');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: 'ASCII VISOR LOCAL',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'local.html'));
}

ipcMain.handle('desktop:ping', async () => {
  return {
    ok: true,
    message: 'ASCII VISOR DESKTOP BRIDGE ONLINE',
    time: new Date().toISOString(),
  };
});

ipcMain.handle('desktop:get-info', async () => {
  return {
    ok: true,
    platform: process.platform,
    arch: process.arch,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  };
});

ipcMain.handle('desktop:ffmpeg-info', async () => {
  return await new Promise((resolve) => {
    if (!ffmpegPath) {
      resolve({
        ok: false,
        error: 'FFmpeg binary path not found.',
      });
      return;
    }

    const child = spawn(ffmpegPath, ['-version'], {
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      resolve({
        ok: false,
        error: error.message,
        ffmpegPath,
      });
    });

    child.on('close', (code) => {
      const firstLine = String(stdout || stderr).split('\n')[0] || '';

      resolve({
        ok: code === 0,
        code,
        ffmpegPath,
        version: firstLine,
      });
    });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});