// electron-main.js
// ASCII VISOR LOCAL — Electron-оболочка для desktop-версии.

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
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
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
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

function decodePngDataUrl(dataUrl) {
  const text = String(dataUrl || '');
  const match = text.match(/^data:image\/png;base64,(.+)$/);

  if (!match) {
    throw new Error('Invalid PNG data URL.');
  }

  return Buffer.from(match[1], 'base64');
}

ipcMain.handle('desktop:render-png-frames-to-mp4-test', async (_event, payload = {}) => {
  const win = BrowserWindow.getFocusedWindow();

  const frames = Array.isArray(payload.frames) ? payload.frames : [];
  const fps = Math.max(1, Math.min(60, Number(payload.fps || 30)));
  const basename = String(payload.basename || 'ascii_visor_ascii_frames_test').replace(/[^\w.-]+/g, '_');

  if (!frames.length) {
    return {
      ok: false,
      error: 'No PNG frames received.',
    };
  }

  const saveResult = await dialog.showSaveDialog(win, {
    title: 'Куда сохранить ASCII MP4 test',
    defaultPath: `${basename}.mp4`,
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
    };
  }

  const outputPath = saveResult.filePath;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ascii-visor-frames-'));

  try {
    for (let i = 0; i < frames.length; i += 1) {
      const frameNumber = String(i + 1).padStart(6, '0');
      const framePath = path.join(tempDir, `frame_${frameNumber}.png`);
      await fs.writeFile(framePath, decodePngDataUrl(frames[i]));
    }

    const result = await runFfmpeg([
      '-y',

      // Читаем PNG-последовательность как видео.
      '-framerate', String(fps),
      '-i', path.join(tempDir, 'frame_%06d.png'),

      // Делаем совместимый MP4.
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '14',
      '-pix_fmt', 'yuv420p',

      // На всякий случай приводим размеры к чётным значениям.
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',

      '-movflags', '+faststart',
      outputPath,
    ]);

    if (result.ok) {
      shell.showItemInFolder(outputPath);
    }

    return {
      ...result,
      outputPath,
      tempDir,
      frames: frames.length,
      fps,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      outputPath,
      tempDir,
      frames: frames.length,
      fps,
    };
  }
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