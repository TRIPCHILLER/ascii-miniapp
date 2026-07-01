'use strict';

const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const exec = promisify(execFile);

const DEFAULT_OUTPUT_WIDTH = 720;
const DEFAULT_OUTPUT_HEIGHT = 1280;
const DEFAULT_CHARSET = ' .:-=+*#%@';
const VGA_W = 8;
const VGA_H = 12;

const GLYPHS_8X12 = {
  ' ': ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000'],
  '.': ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00011000','00011000','00000000'],
  ':': ['00000000','00000000','00011000','00011000','00000000','00000000','00000000','00011000','00011000','00000000','00000000','00000000'],
  '-': ['00000000','00000000','00000000','00000000','00000000','01111110','01111110','00000000','00000000','00000000','00000000','00000000'],
  '=': ['00000000','00000000','00000000','01111110','01111110','00000000','01111110','01111110','00000000','00000000','00000000','00000000'],
  '+': ['00000000','00000000','00011000','00011000','00011000','01111110','01111110','00011000','00011000','00011000','00000000','00000000'],
  '*': ['00000000','00000000','01100110','00111100','00011000','01111110','00011000','00111100','01100110','00000000','00000000','00000000'],
  '#': ['00000000','00100100','00100100','01111110','01111110','00100100','00100100','01111110','01111110','00100100','00100100','00000000'],
  '%': ['00000000','01100010','10010100','10011000','01101000','00010000','00101100','00110010','01010010','10001100','00000000','00000000'],
  '@': ['00000000','00111100','01000010','10011001','10100101','10100101','10111101','10000001','01000010','00111100','00000000','00000000']
};

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function hexToRgb(hex, fallback) {
  const raw = String(hex || '').trim().replace(/^#/, '');
  const six = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = /^[0-9a-f]{6}$/i.test(six) ? parseInt(six, 16) : null;
  return n == null ? fallback : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function probeVideoSize(inputPath) {
  try {
    const { stdout } = await exec('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', inputPath], { encoding: 'utf8' });
    const [w, h] = String(stdout || '').trim().split('x').map((x) => parseInt(x, 10));
    return { width: Number.isFinite(w) ? w : null, height: Number.isFinite(h) ? h : null };
  } catch {
    return { width: null, height: null };
  }
}

function buildExtractionFilter({ fps, fillMode, outputWidth, outputHeight, cols, rows }) {
  if (String(fillMode || 'cover').toLowerCase() === 'contain') {
    return `fps=${fps},scale=${cols}:${rows}:force_original_aspect_ratio=decrease,pad=${cols}:${rows}:(ow-iw)/2:(oh-ih)/2,format=gray`;
  }
  return `fps=${fps},scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight},scale=${cols}:${rows},format=gray`;
}

function drawGlyph(frame, ch, x0, y0, cellW, cellH, fg, bg) {
  const glyph = GLYPHS_8X12[ch] || GLYPHS_8X12['#'];
  for (let y = 0; y < cellH; y++) {
    const gy = Math.min(VGA_H - 1, Math.floor((y / cellH) * VGA_H));
    const row = glyph[gy] || GLYPHS_8X12[' '][0];
    for (let x = 0; x < cellW; x++) {
      const gx = Math.min(VGA_W - 1, Math.floor((x / cellW) * VGA_W));
      const on = row.charCodeAt(gx) === 49;
      const c = on ? fg : bg;
      const p = ((y0 + y) * frame.width + x0 + x) * 3;
      frame.data[p] = c[0]; frame.data[p + 1] = c[1]; frame.data[p + 2] = c[2];
    }
  }
}

function renderFramePpm(gray, opts) {
  const { cols, rows, outputWidth, outputHeight, cellW, cellH, charset, fg, bg, contrast, gamma, invert } = opts;
  const data = Buffer.alloc(outputWidth * outputHeight * 3);
  for (let i = 0; i < outputWidth * outputHeight; i++) {
    data[i * 3] = bg[0]; data[i * 3 + 1] = bg[1]; data[i * 3 + 2] = bg[2];
  }
  const shades = Math.max(1, charset.length - 1);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let lum = (gray[y * cols + x] || 0) / 255;
      lum = Math.pow(Math.max(0, Math.min(1, (lum - 0.5) * contrast + 0.5)), 1 / gamma);
      if (invert) lum = 1 - lum;
      const ch = charset[Math.max(0, Math.min(shades, Math.round(lum * shades)))] || ' ';
      drawGlyph({ width: outputWidth, data }, ch, x * cellW, y * cellH, cellW, cellH, fg, bg);
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${outputWidth} ${outputHeight}\n255\n`), data]);
}

async function renderTelegramVideo(inputPath, outputPath, config = {}) {
  const fps = clampInt(config.fps, 5, 60, 24);
  const outputWidth = clampInt(config.outputWidth || config.width, 160, 2160, DEFAULT_OUTPUT_WIDTH);
  const outputHeight = clampInt(config.outputHeight || config.height, 160, 3840, DEFAULT_OUTPUT_HEIGHT);
  const cellW = clampInt(config.cellW, 4, 64, 8);
  const cellH = clampInt(config.cellH, 6, 96, 16);
  const cols = Math.max(1, Math.floor(outputWidth / cellW));
  const rows = Math.max(1, Math.floor(outputHeight / cellH));
  const fillMode = String(config.fillMode || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
  const charset = Array.from(String(config.renderCharset10 || config.charset || DEFAULT_CHARSET)).filter((ch) => Object.prototype.hasOwnProperty.call(GLYPHS_8X12, ch)).join('') || DEFAULT_CHARSET;
  const fg = hexToRgb(config.fg || config.color, [255, 255, 255]);
  const bg = hexToRgb(config.bg || config.background, [0, 0, 0]);
  const source = await probeVideoSize(inputPath);
  const extractionFilter = buildExtractionFilter({ fps, fillMode, outputWidth, outputHeight, cols, rows });
  const extractionMode = fillMode === 'cover' ? 'canvas-cover-then-grid' : 'grid-contain-fallback';
  console.log('[telegram-render] config', { sourceSize: source, outputCanvas: { width: outputWidth, height: outputHeight }, cols, rows, cellW, cellH, fillMode, extractionMode, glyphRenderer: 'vga', glyphMatrixSize: `${VGA_W}x${VGA_H}`, glyphScaleX: cellW / VGA_W, glyphScaleY: cellH / VGA_H });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const extract = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', inputPath, '-vf', extractionFilter, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const encode = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-framerate', String(fps), '-f', 'image2pipe', '-vcodec', 'ppm', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outputPath], { stdio: ['pipe', 'ignore', 'pipe'] });
  let extErr = ''; let encErr = '';
  extract.stderr.on('data', (d) => { extErr += d.toString(); });
  encode.stderr.on('data', (d) => { encErr += d.toString(); });
  const frameSize = cols * rows;
  let pending = Buffer.alloc(0);
  extract.stdout.on('data', (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= frameSize) {
      const gray = pending.subarray(0, frameSize);
      pending = pending.subarray(frameSize);
      encode.stdin.write(renderFramePpm(gray, { cols, rows, outputWidth, outputHeight, cellW, cellH, charset, fg, bg, contrast: Math.max(0.1, Number(config.contrast || 1)), gamma: Math.max(0.1, Number(config.gamma || 1)), invert: !!config.invert }));
    }
  });
  const waitExtract = new Promise((resolve, reject) => extract.on('close', (code) => code === 0 ? resolve() : reject(new Error(extErr || `ffmpeg extract exit ${code}`))));
  const waitEncode = new Promise((resolve, reject) => encode.on('close', (code) => code === 0 ? resolve() : reject(new Error(encErr || `ffmpeg encode exit ${code}`))));
  await waitExtract;
  encode.stdin.end();
  await waitEncode;
  return { outputPath, outputWidth, outputHeight, cols, rows, cellW, cellH, fillMode, extractionMode, glyphRenderer: 'vga', glyphMatrixSize: `${VGA_W}x${VGA_H}` };
}

module.exports = { renderTelegramVideo, buildExtractionFilter, GLYPHS_8X12 };
