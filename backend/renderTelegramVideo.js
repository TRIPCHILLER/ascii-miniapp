'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const renderLimits = require('./renderLimits');

function resolveFfmpegPath() {
  const modulePaths = require.resolve.paths('ffmpeg-static') || [];
  for (const modulePath of modulePaths) {
    const entryPath = path.join(modulePath, 'ffmpeg-static', 'index.js');
    if (!fs.existsSync(entryPath)) continue;
    const staticFfmpeg = require(entryPath);
    if (staticFfmpeg) return staticFfmpeg;
  }
  return 'ffmpeg';
}

function resolveFfprobePath() {
  if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
    const candidate = path.join(path.dirname(ffmpegPath), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe');
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'ffprobe';
}

const ffmpegPath = resolveFfmpegPath();
const ffprobePath = resolveFfprobePath();

const BASE_CELL_W = 6;
const BASE_CELL_H = 8;
const DEFAULT_ASCII_RAMP = ' .:-=+*#%@';
const DEFAULT_FG = [80, 220, 255];
const DEFAULT_BG = [0, 0, 0];
const OUTPUT_PROFILES = {
  portrait: [
    { width: 1680, height: 2984, crf: 12 },
    { width: 1440, height: 2560, crf: 12 },
    { width: 1080, height: 1920, crf: 12 },
    { width: 720, height: 1280, crf: 12 },
    { width: 720, height: 1280, crf: 18 }
  ],
  landscape: [
    { width: 2984, height: 1680, crf: 12 },
    { width: 2560, height: 1440, crf: 12 },
    { width: 1920, height: 1080, crf: 12 },
    { width: 1280, height: 720, crf: 12 },
    { width: 1280, height: 720, crf: 18 }
  ],
  square: [
    { width: 2160, height: 2160, crf: 12 },
    { width: 1440, height: 1440, crf: 12 },
    { width: 1080, height: 1080, crf: 12 },
    { width: 1080, height: 1080, crf: 18 }
  ]
};

const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','01100','01100'],
  ':': ['00000','01100','01100','00000','01100','01100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '=': ['00000','00000','11111','00000','11111','00000','00000'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '*': ['00000','10101','01110','11111','01110','10101','00000'],
  '#': ['01010','11111','01010','01010','11111','01010','00000'],
  '%': ['11001','11010','00100','01000','10110','00110','00000'],
  '@': ['01110','10001','10111','10101','10111','10000','01111']
};
const FALLBACK_GLYPHS = Object.keys(FONT);

function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.stdio || ['ignore', 'pipe', 'pipe'] });
    const stderr = [];
    if (child.stderr) child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
      if (stderr.reduce((sum, item) => sum + item.length, 0) > 512 * 1024) stderr.shift();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${path.basename(cmd)} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-4000)}`));
    });
  });
}

function runProcessOutput(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    if (child.stdout) child.stdout.on('data', (chunk) => stdout.push(chunk));
    if (child.stderr) child.stderr.on('data', (chunk) => {
      stderr.push(chunk);
      if (stderr.reduce((sum, item) => sum + item.length, 0) > 512 * 1024) stderr.shift();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(stdout).toString('utf8'));
      reject(new Error(`${path.basename(cmd)} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-4000)}`));
    });
  });
}

async function probeVideoLayout(inputPath) {
  const stdout = await runProcessOutput(ffprobePath, [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,side_data_list:stream_tags=rotate',
    '-of', 'json', inputPath
  ]);
  const parsed = JSON.parse(stdout || '{}');
  const stream = parsed.streams?.[0] || {};
  let width = Number(stream.width) || 0;
  let height = Number(stream.height) || 0;
  const rotation = getStreamRotation(stream);
  if (Math.abs(rotation) % 180 === 90) [width, height] = [height, width];
  const orientation = width === height ? 'square' : (height > width ? 'portrait' : 'landscape');
  return { sourceWidth: width, sourceHeight: height, rotation, orientation };
}

function getStreamRotation(stream) {
  const tagRotation = Number(stream.tags?.rotate);
  if (Number.isFinite(tagRotation)) return tagRotation;
  const sideData = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
  for (const item of sideData) {
    const rotation = Number(item.rotation ?? item.displaymatrix?.rotation);
    if (Number.isFinite(rotation)) return rotation;
  }
  return 0;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseColor(input, fallback) {
  const value = String(input || '').trim();
  let m = /^#?([0-9a-f]{6})$/i.exec(value);
  if (m) {
    const hex = m[1];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  m = /^rgba?\((\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i.exec(value);
  if (m) return [0, 1, 2].map((i) => Math.min(255, Math.max(0, Number(m[i + 1]) || 0)));
  return fallback.slice();
}

function normalizeRenderConfig(config = {}, fallbackFps) {
  const charset = Array.from(String(config.charset || config.renderCharset10 || DEFAULT_ASCII_RAMP).replace(/[\r\n]/g, '')).join('') || DEFAULT_ASCII_RAMP;
  const fillMode = config.fillMode === 'contain' ? 'contain' : 'cover';
  return {
    charset,
    widthChars: Math.round(clampNumber(config.widthChars ?? config.size, 24, 260, 120)),
    contrast: clampNumber(config.contrast, 0.05, 5, 1),
    gamma: clampNumber(config.gamma, 0.05, 5, 1),
    fg: parseColor(config.fg || config.color, DEFAULT_FG),
    bg: parseColor(config.bg || config.background, DEFAULT_BG),
    invert: !!config.invert,
    fps: clampNumber(config.fps ?? fallbackFps, 1, renderLimits.TG_RENDER_MAX_FPS, fallbackFps),
    fillMode
  };
}

function buildLayout(probe, profile, cfg) {
  const cols = Math.max(1, Math.min(cfg.widthChars, Math.floor(profile.width / 2)));
  const cellW = Math.max(2, Math.floor(profile.width / cols));
  const cellH = Math.max(3, Math.round(cellW * (BASE_CELL_H / BASE_CELL_W)));
  const rows = Math.max(1, Math.floor(profile.height / cellH));
  return {
    ...probe,
    outputWidth: profile.width,
    outputHeight: profile.height,
    cols,
    rows,
    cellW,
    cellH,
    glyphScaleX: Math.max(1, Math.floor(cellW / 5)),
    glyphScaleY: Math.max(1, Math.floor(cellH / 7))
  };
}

function drawGlyph(rgb, x, y, glyph, layout, color) {
  let rows = FONT[glyph];
  if (!rows) {
    const idx = Math.max(0, Math.min(FALLBACK_GLYPHS.length - 1, Math.round((FALLBACK_GLYPHS.length - 1) / 2)));
    rows = FONT[FALLBACK_GLYPHS[idx]];
  }
  const offsetX = Math.floor((layout.cellW - (5 * layout.glyphScaleX)) / 2);
  const offsetY = Math.floor((layout.cellH - (7 * layout.glyphScaleY)) / 2);
  for (let gy = 0; gy < rows.length; gy += 1) {
    const row = rows[gy];
    for (let gx = 0; gx < row.length; gx += 1) {
      if (row[gx] !== '1') continue;
      for (let sy = 0; sy < layout.glyphScaleY; sy += 1) {
        for (let sx = 0; sx < layout.glyphScaleX; sx += 1) {
          const px = x + offsetX + gx * layout.glyphScaleX + sx;
          const py = y + offsetY + gy * layout.glyphScaleY + sy;
          if (px < 0 || px >= layout.outputWidth || py < 0 || py >= layout.outputHeight) continue;
          const offset = (py * layout.outputWidth + px) * 3;
          rgb[offset] = color[0]; rgb[offset + 1] = color[1]; rgb[offset + 2] = color[2];
        }
      }
    }
  }
}

function mapLumaToGlyph(lum, cfg) {
  let v01 = lum / 255;
  v01 = ((v01 - 0.5) * cfg.contrast) + 0.5;
  v01 = Math.max(0, Math.min(1, v01));
  v01 = Math.pow(v01, 1 / cfg.gamma);
  if (cfg.invert) v01 = 1 - v01;
  const chars = Array.from(cfg.charset);
  const idx = Math.max(0, Math.min(chars.length - 1, Math.round(v01 * (chars.length - 1))));
  return chars[idx] || ' ';
}

function writeAsciiPpm(frameGray, outPath, layout, cfg) {
  const rgb = Buffer.alloc(layout.outputWidth * layout.outputHeight * 3);
  for (let i = 0; i < rgb.length; i += 3) {
    rgb[i] = cfg.bg[0]; rgb[i + 1] = cfg.bg[1]; rgb[i + 2] = cfg.bg[2];
  }
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      drawGlyph(rgb, col * layout.cellW, row * layout.cellH, mapLumaToGlyph(frameGray[row * layout.cols + col], cfg), layout, cfg.fg);
    }
  }
  fs.writeFileSync(outPath, Buffer.concat([Buffer.from(`P6\n${layout.outputWidth} ${layout.outputHeight}\n255\n`), rgb]));
}

function buildFrameExtractionFilter(layout, cfg) {
  const fillMode = cfg.fillMode === 'contain' ? 'contain' : 'cover';
  const scaleMode = fillMode === 'contain' ? 'decrease' : 'increase';
  const fitFilter = fillMode === 'contain'
    ? `pad=${layout.cols}:${layout.rows}:(ow-iw)/2:(oh-ih)/2:black`
    : `crop=${layout.cols}:${layout.rows}`;
  return {
    fillMode,
    scaleCropMode: fillMode === 'contain' ? 'contain/pad' : 'cover/crop',
    filter: `scale=${layout.cols}:${layout.rows}:force_original_aspect_ratio=${scaleMode},${fitFilter}`
  };
}

async function extractRawFrames(inputPath, rawPath, fps, durationSec, layout, cfg) {
  const safeFps = Math.min(renderLimits.TG_RENDER_MAX_FPS, Math.max(1, Number.parseInt(String(fps), 10) || renderLimits.TG_RENDER_MAX_FPS));
  const safeDuration = Math.min(renderLimits.TG_RENDER_MAX_DURATION_SEC, Math.max(0.1, Number(durationSec) || renderLimits.TG_RENDER_MAX_DURATION_SEC));
  const extraction = buildFrameExtractionFilter(layout, cfg);
  console.log('[telegram-render] frame extraction', {
    fillMode: extraction.fillMode,
    scaleCropMode: extraction.scaleCropMode,
    sourceSize: `${layout.sourceWidth}x${layout.sourceHeight}`,
    outputCanvas: `${layout.outputWidth}x${layout.outputHeight}`,
    cols: layout.cols,
    rows: layout.rows
  });
  await runProcess(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-t', String(safeDuration), '-i', inputPath, '-an',
    '-vf', `fps=${safeFps}:round=down,${extraction.filter},format=gray`,
    '-f', 'rawvideo', '-pix_fmt', 'gray', rawPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return safeFps;
}

async function encodeFrames(framesDir, outputPath, fps, crf) {
  await runProcess(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error', '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%06d.ppm'), '-an',
    '-c:v', 'libx264', '-crf', String(crf), '-preset', 'medium',
    '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', outputPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

async function emptyDir(dir) {
  await fs.promises.rm(dir, { recursive: true, force: true });
  await fs.promises.mkdir(dir, { recursive: true });
}

async function renderAttempt(job, probe, cfg, profile, fallbackNumber) {
  const layout = buildLayout(probe, profile, cfg);
  const rawPath = path.join(job.workspaceDir, `source_${fallbackNumber}.gray`);
  const framesDir = path.join(job.workspaceDir, 'ascii_frames');
  const outputPath = path.join(job.workspaceDir, `telegram_ascii_render_${fallbackNumber}.mp4`);
  await emptyDir(framesDir);
  try { await fs.promises.rm(outputPath, { force: true }); } catch (_) {}

  console.log('[telegram-render] profile selected', {
    fallbackNumber,
    selectedCanvas: `${layout.outputWidth}x${layout.outputHeight}`,
    cols: layout.cols,
    rows: layout.rows,
    charsetLength: Array.from(cfg.charset).length,
    colors: { fg: cfg.fg, bg: cfg.bg },
    contrast: cfg.contrast,
    gamma: cfg.gamma,
    invert: cfg.invert,
    crf: profile.crf,
    fillMode: cfg.fillMode,
    sourceSize: `${layout.sourceWidth}x${layout.sourceHeight}`
  });

  const fps = await extractRawFrames(job.inputPath, rawPath, cfg.fps, job.durationSec, layout, cfg);
  const raw = await fs.promises.readFile(rawPath);
  const frameSize = layout.cols * layout.rows;
  const frameCount = Math.floor(raw.length / frameSize);
  if (frameCount <= 0) throw new Error('ffmpeg produced no frames');

  for (let i = 0; i < frameCount; i += 1) {
    const frame = raw.subarray(i * frameSize, (i + 1) * frameSize);
    writeAsciiPpm(frame, path.join(framesDir, `frame_${String(i + 1).padStart(6, '0')}.ppm`), layout, cfg);
  }

  await encodeFrames(framesDir, outputPath, fps, profile.crf);
  const stat = await fs.promises.stat(outputPath);
  const outputMb = stat.size / (1024 * 1024);
  console.log('[telegram-render] encoded', { fallbackNumber, crf: profile.crf, outputMb: Number(outputMb.toFixed(2)) });
  try { await fs.promises.rm(rawPath, { force: true }); } catch (_) {}
  if (stat.size > renderLimits.TG_RENDER_OUTPUT_SAFE_LIMIT_BYTES) {
    const err = new Error('TG_RENDER_OUTPUT_TOO_LARGE');
    err.code = 'TG_RENDER_OUTPUT_TOO_LARGE';
    err.outputSizeBytes = stat.size;
    err.outputPath = outputPath;
    throw err;
  }
  return { path: outputPath, outputSizeBytes: stat.size, frameCount, fps, orientation: layout.orientation, outputWidth: layout.outputWidth, outputHeight: layout.outputHeight, cols: layout.cols, rows: layout.rows, crf: profile.crf, fallbackNumber };
}

async function renderTelegramVideo(job) {
  if (!job?.workspaceDir || !job?.inputPath) throw new Error('render job workspace/input is missing');
  const probe = await probeVideoLayout(job.inputPath);
  const cfg = normalizeRenderConfig(job.renderConfig, job.fps);
  const profiles = OUTPUT_PROFILES[probe.orientation] || OUTPUT_PROFILES.landscape;
  let lastTooLarge = null;

  for (let i = 0; i < profiles.length; i += 1) {
    try {
      return await renderAttempt(job, probe, cfg, profiles[i], i + 1);
    } catch (err) {
      if (err?.code !== 'TG_RENDER_OUTPUT_TOO_LARGE') throw err;
      lastTooLarge = err;
      const outputMb = Number(((err.outputSizeBytes || 0) / (1024 * 1024)).toFixed(2));
      console.warn('[telegram-render] output too large, trying fallback', { fallbackNumber: i + 1, outputMb });
      if (err.outputPath) {
        try { await fs.promises.rm(err.outputPath, { force: true }); } catch (_) {}
      }
    }
  }

  const err = lastTooLarge || new Error('TG_RENDER_OUTPUT_TOO_LARGE');
  err.code = 'TG_RENDER_OUTPUT_TOO_LARGE';
  throw err;
}

module.exports = { renderTelegramVideo };
