// electron-main.js
// ASCII VISOR LOCAL — минимальная Electron-оболочка.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

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

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});