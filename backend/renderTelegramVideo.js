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

const CELL_W = 6;
const CELL_H = 8;
const OUTPUT_CANVASES = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
  square: { width: 1080, height: 1080 }
};
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


function runProcessOutput(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = [];
    const stderr = [];
    if (child.stdout) child.stdout.on('data', (chunk) => stdout.push(chunk));
    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr.push(chunk);
        if (stderr.reduce((sum, item) => sum + item.length, 0) > 512 * 1024) stderr.shift();
      });
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve(Buffer.concat(stdout).toString('utf8'));
      reject(new Error(`${path.basename(cmd)} exited with code ${code}: ${Buffer.concat(stderr).toString('utf8').slice(-4000)}`));
    });
  });
}

async function probeVideoLayout(inputPath) {
  const stdout = await runProcessOutput(ffprobePath, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,side_data_list:stream_tags=rotate',
    '-of', 'json',
    inputPath
  ]);
  const parsed = JSON.parse(stdout || '{}');
  const stream = parsed.streams?.[0] || {};
  let width = Number(stream.width) || 0;
  let height = Number(stream.height) || 0;
  const rotation = getStreamRotation(stream);
  if (Math.abs(rotation) % 180 === 90) {
    [width, height] = [height, width];
  }
  const orientation = width === height ? 'square' : (height > width ? 'portrait' : 'landscape');
  const canvas = OUTPUT_CANVASES[orientation];
  return {
    orientation,
    outputWidth: canvas.width,
    outputHeight: canvas.height,
    cols: Math.floor(canvas.width / CELL_W),
    rows: Math.floor(canvas.height / CELL_H)
  };
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

function drawGlyph(rgb, x, y, glyph, layout) {
  const rows = FONT[glyph] || FONT[' '];
  for (let gy = 0; gy < rows.length; gy += 1) {
    const row = rows[gy];
    for (let gx = 0; gx < row.length; gx += 1) {
      if (row[gx] !== '1') continue;
      const px = x + gx;
      const py = y + gy;
      if (px < 0 || px >= layout.outputWidth || py < 0 || py >= layout.outputHeight) continue;
      const offset = (py * layout.outputWidth + px) * 3;
      rgb[offset] = CYAN[0];
      rgb[offset + 1] = CYAN[1];
      rgb[offset + 2] = CYAN[2];
    }
  }
}

function writeAsciiPpm(frameGray, outPath, layout) {
  const rgb = Buffer.alloc(layout.outputWidth * layout.outputHeight * 3, 0);
  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.cols; col += 1) {
      const lum = frameGray[row * layout.cols + col];
      const idx = Math.max(0, Math.min(ASCII_RAMP.length - 1, Math.floor((lum / 256) * ASCII_RAMP.length)));
      drawGlyph(rgb, col * CELL_W, row * CELL_H, ASCII_RAMP[idx], layout);
    }
  }
  fs.writeFileSync(outPath, Buffer.concat([Buffer.from(`P6\n${layout.outputWidth} ${layout.outputHeight}\n255\n`), rgb]));
}

async function extractRawFrames(inputPath, rawPath, fps, durationSec, layout) {
  const safeFps = Math.min(renderLimits.TG_RENDER_MAX_FPS, Math.max(1, Number.parseInt(String(fps), 10) || renderLimits.TG_RENDER_MAX_FPS));
  const safeDuration = Math.min(renderLimits.TG_RENDER_MAX_DURATION_SEC, Math.max(0.1, Number(durationSec) || renderLimits.TG_RENDER_MAX_DURATION_SEC));
  await runProcess(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-t', String(safeDuration),
    '-i', inputPath,
    '-an',
    '-vf', `fps=${safeFps}:round=down,scale=${layout.cols}:${layout.rows}:force_original_aspect_ratio=decrease,pad=${layout.cols}:${layout.rows}:(ow-iw)/2:(oh-ih)/2:black,format=gray`,
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
    '-crf', '20',
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

  const layout = await probeVideoLayout(job.inputPath);
  const fps = await extractRawFrames(job.inputPath, rawPath, job.fps, job.durationSec, layout);
  const raw = await fs.promises.readFile(rawPath);
  const frameSize = layout.cols * layout.rows;
  const frameCount = Math.floor(raw.length / frameSize);
  if (frameCount <= 0) throw new Error('ffmpeg produced no frames');

  for (let i = 0; i < frameCount; i += 1) {
    const frame = raw.subarray(i * frameSize, (i + 1) * frameSize);
    writeAsciiPpm(frame, path.join(framesDir, `frame_${String(i + 1).padStart(6, '0')}.ppm`), layout);
  }

  await encodeFrames(framesDir, outputPath, fps);
  const stat = await fs.promises.stat(outputPath);
  if (stat.size > renderLimits.TG_RENDER_OUTPUT_SAFE_LIMIT_BYTES) {
    const err = new Error('TG_RENDER_OUTPUT_TOO_LARGE');
    err.code = 'TG_RENDER_OUTPUT_TOO_LARGE';
    err.outputSizeBytes = stat.size;
    throw err;
  }
  return { path: outputPath, outputSizeBytes: stat.size, frameCount, fps, orientation: layout.orientation, outputWidth: layout.outputWidth, outputHeight: layout.outputHeight };
}

module.exports = { renderTelegramVideo };
