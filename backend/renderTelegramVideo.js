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

const ffmpegPath = resolveFfmpegPath();

const CELL_W = 6;
const CELL_H = 8;
const COLS = 120;
const ROWS = 68;
const OUT_W = COLS * CELL_W;
const OUT_H = ROWS * CELL_H;
const ASCII_RAMP = ' .:-=+*#%@';
const CYAN = [80, 220, 255];

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

function runProcess(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: opts.stdio || ['ignore', 'pipe', 'pipe'] });
    const stderr = [];
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr.push(chunk);
        if (stderr.reduce((sum, item) => sum + item.length, 0) > 512 * 1024) stderr.shift();
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${path.basename(cmd)} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-4000)}`));
    });
  });
}

function drawGlyph(rgb, x, y, glyph) {
  const rows = FONT[glyph] || FONT[' '];
  for (let gy = 0; gy < rows.length; gy += 1) {
    const row = rows[gy];
    for (let gx = 0; gx < row.length; gx += 1) {
      if (row[gx] !== '1') continue;
      const px = x + gx;
      const py = y + gy;
      if (px < 0 || px >= OUT_W || py < 0 || py >= OUT_H) continue;
      const offset = (py * OUT_W + px) * 3;
      rgb[offset] = CYAN[0];
      rgb[offset + 1] = CYAN[1];
      rgb[offset + 2] = CYAN[2];
    }
  }
}

function writeAsciiPpm(frameGray, outPath) {
  const rgb = Buffer.alloc(OUT_W * OUT_H * 3, 0);
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const lum = frameGray[row * COLS + col];
      const idx = Math.max(0, Math.min(ASCII_RAMP.length - 1, Math.floor((lum / 256) * ASCII_RAMP.length)));
      drawGlyph(rgb, col * CELL_W, row * CELL_H, ASCII_RAMP[idx]);
    }
  }
  fs.writeFileSync(outPath, Buffer.concat([Buffer.from(`P6\n${OUT_W} ${OUT_H}\n255\n`), rgb]));
}

async function extractRawFrames(inputPath, rawPath, fps, durationSec) {
  const safeFps = Math.min(renderLimits.TG_RENDER_MAX_FPS, Math.max(1, Number.parseInt(String(fps), 10) || renderLimits.TG_RENDER_MAX_FPS));
  const safeDuration = Math.min(renderLimits.TG_RENDER_MAX_DURATION_SEC, Math.max(0.1, Number(durationSec) || renderLimits.TG_RENDER_MAX_DURATION_SEC));
  await runProcess(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-t', String(safeDuration),
    '-i', inputPath,
    '-an',
    '-vf', `fps=${safeFps}:round=down,scale=${COLS}:${ROWS}:force_original_aspect_ratio=decrease,pad=${COLS}:${ROWS}:(ow-iw)/2:(oh-ih)/2:black,format=gray`,
    '-f', 'rawvideo',
    '-pix_fmt', 'gray',
    rawPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  return safeFps;
}

async function encodeFrames(framesDir, outputPath, fps) {
  await runProcess(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%06d.ppm'),
    '-an',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'main',
    '-preset', 'veryfast',
    '-crf', '23',
    '-movflags', '+faststart',
    outputPath
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

async function renderTelegramVideo(job) {
  if (!job?.workspaceDir || !job?.inputPath) throw new Error('render job workspace/input is missing');
  const rawPath = path.join(job.workspaceDir, 'source.gray');
  const framesDir = path.join(job.workspaceDir, 'ascii_frames');
  const outputPath = path.join(job.workspaceDir, 'telegram_ascii_render.mp4');
  await fs.promises.mkdir(framesDir, { recursive: true });

  const fps = await extractRawFrames(job.inputPath, rawPath, job.fps, job.durationSec);
  const raw = await fs.promises.readFile(rawPath);
  const frameSize = COLS * ROWS;
  const frameCount = Math.floor(raw.length / frameSize);
  if (frameCount <= 0) throw new Error('ffmpeg produced no frames');

  for (let i = 0; i < frameCount; i += 1) {
    const frame = raw.subarray(i * frameSize, (i + 1) * frameSize);
    writeAsciiPpm(frame, path.join(framesDir, `frame_${String(i + 1).padStart(6, '0')}.ppm`));
  }

  await encodeFrames(framesDir, outputPath, fps);
  const stat = await fs.promises.stat(outputPath);
  if (stat.size > renderLimits.TG_RENDER_OUTPUT_SAFE_LIMIT_BYTES) {
    const err = new Error('TG_RENDER_OUTPUT_TOO_LARGE');
    err.code = 'TG_RENDER_OUTPUT_TOO_LARGE';
    err.outputSizeBytes = stat.size;
    throw err;
  }
  return { path: outputPath, outputSizeBytes: stat.size, frameCount, fps };
}

module.exports = { renderTelegramVideo };
