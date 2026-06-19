// electron-main.js
// ASCII VISOR LOCAL — минимальная Electron-оболочка.

const { app, BrowserWindow } = require('electron');
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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, 'local.html'));

  // На время разработки можно открыть DevTools клавишами Ctrl+Shift+I из окна.
  // Если захочешь автозапуск DevTools — добавим позже.
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});