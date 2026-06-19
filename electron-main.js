// electron-main.js
// ASCII VISOR LOCAL — Electron-оболочка для desktop-версии.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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

function runFfmpeg(args) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    if (!ffmpegPath) {
      resolve({
        ok: false,
        error: 'FFmpeg binary path not found.',
      });
      return;
    }

    const child = spawn(ffmpegPath, args, {
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
        args,
      });
    });

    child.on('close', (code) => {
      resolve({
        ok: code === 0,
        code,
        ffmpegPath,
        args,
        durationMs: Date.now() - startedAt,
        stdoutTail: stdout.slice(-2000),
        stderrTail: stderr.slice(-4000),
      });
    });
  });
}

ipcMain.handle('desktop:transcode-mp4-test', async () => {
  const win = BrowserWindow.getFocusedWindow();

  const openResult = await dialog.showOpenDialog(win, {
    title: 'Выбери видео для MP4-теста',
    properties: ['openFile'],
    filters: [
      {
        name: 'Video files',
        extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'],
      },
      {
        name: 'All files',
        extensions: ['*'],
      },
    ],
  });

  if (openResult.canceled || !openResult.filePaths?.[0]) {
    return {
      ok: false,
      canceled: true,
      step: 'open',
    };
  }

  const inputPath = openResult.filePaths[0];

  const saveResult = await dialog.showSaveDialog(win, {
    title: 'Куда сохранить тестовый MP4',
    defaultPath: 'ascii_visor_ffmpeg_test.mp4',
    filters: [
      {
        name: 'MP4 video',
        extensions: ['mp4'],
      },
    ],
  });

  if (saveResult.canceled || !saveResult.filePath) {
    return {
      ok: false,
      canceled: true,
      step: 'save',
      inputPath,
    };
  }

  const outputPath = saveResult.filePath;

  const result = await runFfmpeg([
    '-y',
    '-i', inputPath,

    // Нормальный монтажный MP4-тест.
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',

    // Если в исходнике есть звук — кодируем его в AAC.
    // Если звука нет, FFmpeg просто продолжит без аудио.
    '-c:a', 'aac',
    '-b:a', '192k',

    '-movflags', '+faststart',
    outputPath,
  ]);

  if (result.ok) {
    shell.showItemInFolder(outputPath);
  }

  return {
    ...result,
    inputPath,
    outputPath,
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