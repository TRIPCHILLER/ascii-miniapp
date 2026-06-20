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

function decodePngFramePayload(payload = {}) {
  // Новый быстрый путь: frontend присылает PNG как ArrayBuffer.
  if (payload.frameBuffer) {
    const frameBuffer = payload.frameBuffer;

    if (frameBuffer instanceof ArrayBuffer) {
      return Buffer.from(frameBuffer);
    }

    if (ArrayBuffer.isView(frameBuffer)) {
      return Buffer.from(
        frameBuffer.buffer,
        frameBuffer.byteOffset,
        frameBuffer.byteLength
      );
    }
  }

  // Старый запасной путь: если где-то ещё остался dataURL.
  if (payload.frame) {
    return decodePngDataUrl(payload.frame);
  }

  throw new Error('No PNG frame data received.');
}

const mp4RenderSessions = new Map();
let mp4RenderSessionSeq = 0;

function sanitizeBasename(value, fallback = 'ascii_visor_video_stream') {
  return String(value || fallback).replace(/[^\w.-]+/g, '_');
}

function normalizeX264Preset(value) {
  const preset = String(value || 'medium').toLowerCase();

  const allowed = new Set([
    'ultrafast',
    'superfast',
    'veryfast',
    'faster',
    'fast',
    'medium',
    'slow',
    'slower',
    'veryslow',
  ]);

  return allowed.has(preset) ? preset : 'medium';
}

function createMp4MasterArgs({ fps, inputPattern, outputPath, preset = 'medium' }) {
  const safePreset = normalizeX264Preset(preset);

  return [
    '-y',

    // Читаем PNG-последовательность как видео.
    '-framerate', String(fps),
    '-i', inputPattern,

    // MASTER-качество для монтажа.
    // CRF и yuv444p оставляем, меняем только скорость энкодера.
    '-c:v', 'libx264',
    '-preset', safePreset,
    '-crf', '8',
    '-pix_fmt', 'yuv444p',

    // Не уменьшаем/не пересэмплим картинку.
    // Если размер нечётный — добавляем паддинг до чётного.
    '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',

    '-movflags', '+faststart',
    outputPath,
  ];
}

ipcMain.handle('desktop:mp4-render-session-start', async (_event, payload = {}) => {
  const win = BrowserWindow.getFocusedWindow();

  const fps = Math.max(1, Math.min(60, Number(payload.fps || 30)));
  const totalFrames = Math.max(0, Number(payload.totalFrames || 0));
  const basename = sanitizeBasename(payload.basename, 'ascii_visor_video_stream');
  const encoderPreset = normalizeX264Preset(payload.encoderPreset || 'medium');

  const saveResult = await dialog.showSaveDialog(win, {
    title: 'Куда сохранить ASCII MP4',
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
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ascii-visor-stream-'));
  const sessionId = `mp4-${Date.now()}-${++mp4RenderSessionSeq}`;

  const session = {
    sessionId,
    outputPath,
    tempDir,
    fps,
    totalFrames,
    encoderPreset,
    frames: 0,
    startedAt: Date.now(),
  };

  mp4RenderSessions.set(sessionId, session);

  return {
    ok: true,
    sessionId,
    outputPath,
    tempDir,
    fps,
    totalFrames,
    encoderPreset,
  };
});

ipcMain.handle('desktop:mp4-render-session-write-frame', async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || '');
  const session = mp4RenderSessions.get(sessionId);

  if (!session) {
    return {
      ok: false,
      error: 'MP4 render session not found.',
      sessionId,
    };
  }

  const index = Math.max(1, Math.floor(Number(payload.index || session.frames + 1)));

  if (!payload.frameBuffer && !payload.frame) {
    return {
      ok: false,
      error: 'No PNG frame data received.',
      sessionId,
      index,
    };
  }

  try {
    const frameNumber = String(index).padStart(6, '0');
    const framePath = path.join(session.tempDir, `frame_${frameNumber}.png`);

    const frameBuffer = decodePngFramePayload(payload);
    await fs.writeFile(framePath, frameBuffer);

    session.frames = Math.max(session.frames, index);
    session.lastFrameAt = Date.now();

    return {
      ok: true,
      sessionId,
      index,
      frames: session.frames,
      totalFrames: session.totalFrames,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      sessionId,
      index,
    };
  }
});

ipcMain.handle('desktop:mp4-render-session-finish', async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || '');
  const session = mp4RenderSessions.get(sessionId);

  if (!session) {
    return {
      ok: false,
      error: 'MP4 render session not found.',
      sessionId,
    };
  }

  if (!session.frames) {
    mp4RenderSessions.delete(sessionId);

    return {
      ok: false,
      error: 'No frames were written.',
      sessionId,
      outputPath: session.outputPath,
      tempDir: session.tempDir,
      fps: session.fps,
      frames: session.frames,
    };
  }

  const result = await runFfmpeg(
    createMp4MasterArgs({
      fps: session.fps,
      inputPattern: path.join(session.tempDir, 'frame_%06d.png'),
      outputPath: session.outputPath,
      preset: session.encoderPreset,
    })
  );

  mp4RenderSessions.delete(sessionId);

  if (result.ok) {
    shell.showItemInFolder(session.outputPath);
  }

  return {
    ...result,
    sessionId,
    outputPath: session.outputPath,
    tempDir: session.tempDir,
    fps: session.fps,
    frames: session.frames,
    totalFrames: session.totalFrames,
    encoderPreset: session.encoderPreset,
    renderDurationMs: Date.now() - session.startedAt,
  };
});

ipcMain.handle('desktop:mp4-render-session-cancel', async (_event, payload = {}) => {
  const sessionId = String(payload.sessionId || '');
  const session = mp4RenderSessions.get(sessionId);

  if (!session) {
    return {
      ok: true,
      alreadyGone: true,
      sessionId,
    };
  }

  mp4RenderSessions.delete(sessionId);

  return {
    ok: true,
    canceled: true,
    sessionId,
    outputPath: session.outputPath,
    tempDir: session.tempDir,
    frames: session.frames,
  };
});

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
'-crf', '8',
'-pix_fmt', 'yuv444p',

// Не уменьшаем/не пересэмплим картинку.
// Если размер нечётный — просто добавляем 1 пиксель паддинга.
'-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',

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