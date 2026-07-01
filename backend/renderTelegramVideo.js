'use strict';

const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const {
  RENDER_OUTPUT_SAFE_LIMIT_BYTES,
  getRenderProfiles,
  resolveOrientation,
  clampRenderFps
} = require('./renderLimits');

const exec = promisify(execFile);
const FONT_CANDIDATES = [
  'assets/PxPlus IBM VGA.ttf',
  'assets/PxPlus IBM VGA.otf',
  'assets/BetterVCR.ttf',
  'assets/BetterVCR.otf',
  'assets/PxPlus IBM VGA.woff2',
  'assets/BetterVCR.woff2',
  'assets/MS Gothic.woff2'
];
const FONT_RENDER_NO_INK = 'FONT_RENDER_NO_INK';
const REPO_ROOT = path.resolve(__dirname, '..');
let fontRenderProbePromise = null;
const DEFAULT_CHARSET = ' .:-=+*#%@';
const GLYPH_W = 8;
const GLYPH_H = 16;
const DEFAULT_CELL_W = 9;
const DEFAULT_CELL_H = 16;
const FONT_CELL_W = 9;
const FONT_CELL_H = 16;

const GLYPHS_8X16 = {
  ' ': ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000'],
  '.': ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000','00011000','00011000','00011000','00000000','00000000','00000000'],
  ':': ['00000000','00000000','00000000','00011000','00011000','00011000','00000000','00000000','00000000','00011000','00011000','00011000','00000000','00000000','00000000','00000000'],
  '-': ['00000000','00000000','00000000','00000000','00000000','00000000','00000000','01111110','01111110','00000000','00000000','00000000','00000000','00000000','00000000','00000000'],
  '=': ['00000000','00000000','00000000','00000000','01111110','01111110','00000000','00000000','01111110','01111110','00000000','00000000','00000000','00000000','00000000','00000000'],
  '+': ['00000000','00000000','00000000','00011000','00011000','00011000','00011000','01111110','01111110','00011000','00011000','00011000','00011000','00000000','00000000','00000000'],
  '*': ['00000000','00000000','00000000','00000000','01100110','00111100','00011000','01111110','01111110','00011000','00111100','01100110','00000000','00000000','00000000','00000000'],
  '#': ['00000000','00000000','00100100','00100100','00100100','01111110','01111110','00100100','00100100','01111110','01111110','00100100','00100100','00100100','00000000','00000000'],
  '%': ['00000000','00000000','01100010','10010100','10010100','10011000','01101000','00010000','00010000','00101100','00110010','01010010','01010010','10001100','00000000','00000000'],
  '@': ['00000000','00000000','00111100','01000010','10011001','10100101','10100101','10100101','10111101','10000001','10000001','01000010','00111100','00000000','00000000','00000000']
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

function resolveRenderParams(inputPath, config, sourceSize) {
  const source = config?.source || {};
  const orientation = resolveOrientation({
    width: source.width || config.sourceWidth || sourceSize.width,
    height: source.height || config.sourceHeight || sourceSize.height,
    sourceOrientation: source.orientation || config.sourceOrientation
  });
  const profiles = getRenderProfiles(orientation);
  return { orientation, profiles, inputPath };
}

function resolveCharset(config) {
  const src = String(config.renderCharset10 || config.charset || DEFAULT_CHARSET);
  const chars = Array.from(src).filter((ch) => ch !== '\n' && ch !== '\r');
  return chars.length ? chars.join('') : DEFAULT_CHARSET;
}


function rgbCss(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

function rgbHex(rgb) {
  return `0x${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function escapeDrawtextPath(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

function parsePpmP6(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  let offset = 0;
  const tokens = [];
  while (tokens.length < 4 && offset < buffer.length) {
    while (offset < buffer.length) {
      const ch = buffer[offset];
      if (ch === 35) {
        while (offset < buffer.length && buffer[offset] !== 10) offset += 1;
      } else if (ch === 9 || ch === 10 || ch === 13 || ch === 32) {
        offset += 1;
      } else {
        break;
      }
    }
    const start = offset;
    while (offset < buffer.length) {
      const ch = buffer[offset];
      if (ch === 9 || ch === 10 || ch === 13 || ch === 32 || ch === 35) break;
      offset += 1;
    }
    if (offset > start) tokens.push(buffer.toString('ascii', start, offset));
  }
  if (offset < buffer.length && (buffer[offset] === 9 || buffer[offset] === 10 || buffer[offset] === 13 || buffer[offset] === 32)) offset += 1;
  const width = parseInt(tokens[1], 10);
  const height = parseInt(tokens[2], 10);
  const max = parseInt(tokens[3], 10);
  if (tokens[0] !== 'P6' || !Number.isFinite(width) || !Number.isFinite(height) || max !== 255) return null;
  const dataLength = width * height * 3;
  if (buffer.length - offset < dataLength) return null;
  return { width, height, dataOffset: offset, dataLength };
}

function validateRenderedPpmHasInk(ppmBuffer, bgRgb) {
  const ppm = parsePpmP6(ppmBuffer);
  if (!ppm) return { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 };
  let inkPixels = 0;
  const pixelCount = ppm.width * ppm.height;
  const bg = Array.isArray(bgRgb) ? bgRgb : [0, 0, 0];
  for (let p = ppm.dataOffset; p < ppm.dataOffset + ppm.dataLength; p += 3) {
    if (ppmBuffer[p] !== bg[0] || ppmBuffer[p + 1] !== bg[1] || ppmBuffer[p + 2] !== bg[2]) inkPixels += 1;
  }
  const minInkPixels = Math.max(2, Math.ceil(pixelCount * 0.001));
  return { ok: inkPixels >= minInkPixels, inkPixels, inkRatio: pixelCount ? inkPixels / pixelCount : 0, pixelCount };
}

async function commandExists(command) {
  try {
    await exec(command, ['-version'], { encoding: 'utf8', timeout: 3000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function probeMagickRenderer(command, fontPath) {
  try {
    const stdout = await runRenderer(command, ['-size', '16x16', `xc:${rgbCss([0, 0, 0])}`, '-font', fontPath, '-pointsize', '12', '-fill', rgbCss([255, 255, 255]), '-gravity', 'NorthWest', '-annotate', '+0+0', '@-', 'ppm:-'], '@');
    return validateRenderedPpmHasInk(stdout, [0, 0, 0]);
  } catch {
    return { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 };
  }
}

async function probeFfmpegDrawtext(fontPath) {
  const filter = `color=c=black:s=16x16:d=0.1,drawtext=fontfile='${escapeDrawtextPath(fontPath)}':text='@':fontsize=12:fontcolor=white:x=0:y=0:expansion=none`;
  try {
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'ppm', 'pipe:1'], { encoding: 'buffer', timeout: 5000, maxBuffer: 1024 * 1024 });
    return validateRenderedPpmHasInk(stdout, [0, 0, 0]);
  } catch {
    return { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 };
  }
}

async function probeFontRender() {
  if (fontRenderProbePromise) return fontRenderProbePromise;
  fontRenderProbePromise = (async () => {
    const selectedFontPath = FONT_CANDIDATES.map((candidate) => path.join(REPO_ROOT, candidate)).find((candidate) => fs.existsSync(candidate)) || null;
    const hasMagick = await commandExists('magick');
    const hasConvert = await commandExists('convert');
    const tools = {
      magick: selectedFontPath && hasMagick ? await probeMagickRenderer('magick', selectedFontPath) : { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 },
      convert: selectedFontPath && hasConvert ? await probeMagickRenderer('convert', selectedFontPath) : { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 },
      ffmpegDrawtext: selectedFontPath ? await probeFfmpegDrawtext(selectedFontPath) : { ok: false, inkPixels: 0, inkRatio: 0, pixelCount: 0 }
    };
    let rendererBackend = 'bitmap-fallback';
    if (tools.magick.ok) rendererBackend = 'magick';
    else if (tools.convert.ok) rendererBackend = 'convert';
    else if (tools.ffmpegDrawtext.ok) rendererBackend = 'ffmpeg-drawtext';
    const fontRenderAvailable = rendererBackend !== 'bitmap-fallback';
    return {
      fontRenderAvailable,
      selectedFontPath,
      glyphRenderer: fontRenderAvailable ? 'font-atlas' : 'bitmap-fallback',
      rendererBackend,
      reason: fontRenderAvailable ? null : 'NO_SYSTEM_FONT_RENDERER',
      fontProbeInkPixels: tools[rendererBackend]?.inkPixels || 0,
      fontProbeInkRatio: tools[rendererBackend]?.inkRatio || 0,
      tools
    };
  })();
  return fontRenderProbePromise;
}

function grayToAsciiText(gray, opts) {
  const { cols, rows, charset, contrast, gamma, invert } = opts;
  const shades = Math.max(1, charset.length - 1);
  const lines = [];
  for (let y = 0; y < rows; y += 1) {
    let line = '';
    for (let x = 0; x < cols; x += 1) {
      let lum = (gray[y * cols + x] || 0) / 255;
      lum = Math.pow(Math.max(0, Math.min(1, (lum - 0.5) * contrast + 0.5)), 1 / gamma);
      if (invert) lum = 1 - lum;
      line += charset[Math.max(0, Math.min(shades, Math.round(lum * shades)))] || ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function runRenderer(command, args, stdinText) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    child.stdout.on('data', (d) => chunks.push(d));
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(err || `${command} exit ${code}`));
    });
    child.stdin.end(stdinText);
  });
}

async function renderFrameSystemPpm(gray, opts, fontProbe) {
  const text = grayToAsciiText(gray, opts);
  const commonMagickArgs = ['-size', `${opts.outputWidth}x${opts.outputHeight}`, `xc:${rgbCss(opts.bg)}`, '-font', fontProbe.selectedFontPath, '-pointsize', String(opts.cellH), '-fill', rgbCss(opts.fg), '-gravity', 'NorthWest', '-interline-spacing', '0', '-annotate', '+0+0', '@-', 'ppm:-'];
  if (fontProbe.rendererBackend === 'magick' || fontProbe.rendererBackend === 'convert') {
    return runRenderer(fontProbe.rendererBackend, commonMagickArgs, text);
  }
  const tmp = path.join('/tmp', `ascii-render-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  await fs.promises.writeFile(tmp, text);
  try {
    const filter = `color=c=${rgbHex(opts.bg)}:s=${opts.outputWidth}x${opts.outputHeight}:d=0.1,drawtext=fontfile='${escapeDrawtextPath(fontProbe.selectedFontPath)}':textfile='${escapeDrawtextPath(tmp)}':fontsize=${opts.cellH}:fontcolor=${rgbHex(opts.fg)}:x=0:y=0:line_spacing=0:expansion=none`;
    const { stdout } = await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'ppm', 'pipe:1'], { encoding: 'buffer', timeout: 10000, maxBuffer: opts.outputWidth * opts.outputHeight * 4 + 4096 });
    return stdout;
  } finally {
    try { await fs.promises.rm(tmp, { force: true }); } catch {}
  }
}

function extractPpmRgb(buffer, width, height) {
  const ppm = parsePpmP6(buffer);
  if (!ppm || ppm.width !== width || ppm.height !== height) return null;
  return buffer.subarray(ppm.dataOffset, ppm.dataOffset + ppm.dataLength);
}

function countMaskInk(mask) {
  let inkPixels = 0;
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] > 0) inkPixels += 1;
  }
  return inkPixels;
}

function bitmapGlyphMask(ch, cellW, cellH) {
  const mask = Buffer.alloc(cellW * cellH);
  const glyph = GLYPHS_8X16[ch] || GLYPHS_8X16['#'];
  const { glyphScale, glyphWidthPx, glyphHeightPx, glyphOffsetX, glyphOffsetY } = resolveGlyphMetrics(cellW, cellH);
  for (let y = 0; y < cellH; y += 1) {
    for (let x = 0; x < cellW; x += 1) {
      const glyphX = x - glyphOffsetX;
      const glyphY = y - glyphOffsetY;
      if (glyphX >= 0 && glyphX < glyphWidthPx && glyphY >= 0 && glyphY < glyphHeightPx) {
        const gx = Math.floor(glyphX / glyphScale);
        const gy = Math.floor(glyphY / glyphScale);
        const row = glyph[gy] || GLYPHS_8X16[' '][0];
        if (row.charCodeAt(gx) === 49) mask[y * cellW + x] = 255;
      }
    }
  }
  return mask;
}

async function renderGlyphMaskWithFont(ch, opts, fontProbe) {
  if (ch === ' ') return Buffer.alloc(opts.cellW * opts.cellH);
  const pointSize = Math.max(1, Math.floor(opts.cellH));
  const tmp = path.join('/tmp', `ascii-glyph-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  await fs.promises.writeFile(tmp, ch);
  try {
    let ppmBuffer;
    if (fontProbe.rendererBackend === 'magick' || fontProbe.rendererBackend === 'convert') {
      ppmBuffer = await runRenderer(fontProbe.rendererBackend, [
        '-size', `${opts.cellW}x${opts.cellH}`,
        `xc:${rgbCss([0, 0, 0])}`,
        '-font', fontProbe.selectedFontPath,
        '-pointsize', String(pointSize),
        '-fill', rgbCss([255, 255, 255]),
        '-gravity', 'NorthWest',
        '-annotate', '+0+0', `@${tmp}`,
        '-trim',
        '+repage',
        '-background', 'black',
        '-gravity', 'Center',
        '-extent', `${opts.cellW}x${opts.cellH}`,
        'ppm:-'
      ], '');
    } else {
      const filter = `color=c=black:s=${opts.cellW}x${opts.cellH}:d=0.1,drawtext=fontfile='${escapeDrawtextPath(fontProbe.selectedFontPath)}':textfile='${escapeDrawtextPath(tmp)}':fontsize=${pointSize}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:expansion=none`;
      const { stdout } = await exec('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'ppm', 'pipe:1'], { encoding: 'buffer', timeout: 5000, maxBuffer: opts.cellW * opts.cellH * 4 + 4096 });
      ppmBuffer = stdout;
    }
    const rgb = extractPpmRgb(ppmBuffer, opts.cellW, opts.cellH);
    if (!rgb) return null;
    const mask = Buffer.alloc(opts.cellW * opts.cellH);
    for (let i = 0, j = 0; i < rgb.length; i += 3, j += 1) {
      mask[j] = Math.max(rgb[i], rgb[i + 1], rgb[i + 2]);
    }
    return countMaskInk(mask) > 0 ? mask : null;
  } finally {
    try { await fs.promises.rm(tmp, { force: true }); } catch {}
  }
}

async function buildGlyphAtlas(opts, fontProbe) {
  const atlas = new Map();
  const missingGlyphs = [];
  const uniqueChars = Array.from(new Set(Array.from(opts.charset)));
  const atlasInkPixels = {};
  for (const ch of uniqueChars) {
    let mask = fontProbe.fontRenderAvailable ? await renderGlyphMaskWithFont(ch, opts, fontProbe) : null;
    if (!mask) {
      missingGlyphs.push(ch);
      mask = bitmapGlyphMask(ch, opts.cellW, opts.cellH);
    }
    atlas.set(ch, mask);
  }
  for (const ch of ['@', '+', '%', '#']) {
    let mask = atlas.get(ch);
    if (!mask) {
      mask = fontProbe.fontRenderAvailable ? await renderGlyphMaskWithFont(ch, opts, fontProbe) : null;
      if (!mask) mask = bitmapGlyphMask(ch, opts.cellW, opts.cellH);
    }
    atlasInkPixels[ch] = countMaskInk(mask);
  }
  return { atlas, atlasGlyphCount: atlas.size, missingGlyphs, atlasInkPixels };
}

function renderFrameAtlasPpm(gray, opts, atlas) {
  const { cols, rows, outputWidth, outputHeight, cellW, cellH, charset, fg, bg, contrast, gamma, invert } = opts;
  const data = Buffer.alloc(outputWidth * outputHeight * 3);
  for (let i = 0; i < outputWidth * outputHeight; i += 1) {
    data[i * 3] = bg[0];
    data[i * 3 + 1] = bg[1];
    data[i * 3 + 2] = bg[2];
  }
  const shades = Math.max(1, charset.length - 1);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let lum = (gray[y * cols + x] || 0) / 255;
      lum = Math.pow(Math.max(0, Math.min(1, (lum - 0.5) * contrast + 0.5)), 1 / gamma);
      if (invert) lum = 1 - lum;
      const ch = charset[Math.max(0, Math.min(shades, Math.round(lum * shades)))] || ' ';
      const mask = atlas.get(ch) || atlas.get('#') || bitmapGlyphMask(ch, cellW, cellH);
      for (let gy = 0; gy < cellH; gy += 1) {
        for (let gx = 0; gx < cellW; gx += 1) {
          const alpha = mask[gy * cellW + gx] / 255;
          if (alpha <= 0) continue;
          const p = ((y * cellH + gy) * outputWidth + x * cellW + gx) * 3;
          data[p] = Math.round(bg[0] + (fg[0] - bg[0]) * alpha);
          data[p + 1] = Math.round(bg[1] + (fg[1] - bg[1]) * alpha);
          data[p + 2] = Math.round(bg[2] + (fg[2] - bg[2]) * alpha);
        }
      }
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${outputWidth} ${outputHeight}\n255\n`), data]);
}

function resolveGlyphMetrics(cellW, cellH) {
  const glyphScale = Math.max(1, Math.floor(Math.min(cellW / GLYPH_W, cellH / GLYPH_H)));
  const glyphWidthPx = GLYPH_W * glyphScale;
  const glyphHeightPx = GLYPH_H * glyphScale;
  return {
    glyphScale,
    glyphWidthPx,
    glyphHeightPx,
    glyphOffsetX: Math.max(0, Math.floor((cellW - glyphWidthPx) / 2)),
    glyphOffsetY: Math.max(0, Math.floor((cellH - glyphHeightPx) / 2))
  };
}

function drawGlyph(frame, ch, x0, y0, cellW, cellH, fg, bg) {
  const glyph = GLYPHS_8X16[ch] || GLYPHS_8X16['#'];
  const { glyphScale, glyphWidthPx, glyphHeightPx, glyphOffsetX, glyphOffsetY } = resolveGlyphMetrics(cellW, cellH);
  for (let y = 0; y < cellH; y += 1) {
    for (let x = 0; x < cellW; x += 1) {
      const glyphX = x - glyphOffsetX;
      const glyphY = y - glyphOffsetY;
      let c = bg;
      if (glyphX >= 0 && glyphX < glyphWidthPx && glyphY >= 0 && glyphY < glyphHeightPx) {
        const gx = Math.floor(glyphX / glyphScale);
        const gy = Math.floor(glyphY / glyphScale);
        const row = glyph[gy] || GLYPHS_8X16[' '][0];
        c = row.charCodeAt(gx) === 49 ? fg : bg;
      }
      const p = ((y0 + y) * frame.width + x0 + x) * 3;
      frame.data[p] = c[0];
      frame.data[p + 1] = c[1];
      frame.data[p + 2] = c[2];
    }
  }
}

function renderFrameBitmapPpm(gray, opts) {
  const { cols, rows, outputWidth, outputHeight, cellW, cellH, charset, fg, bg, contrast, gamma, invert } = opts;
  const data = Buffer.alloc(outputWidth * outputHeight * 3);
  for (let i = 0; i < outputWidth * outputHeight; i += 1) {
    data[i * 3] = bg[0];
    data[i * 3 + 1] = bg[1];
    data[i * 3 + 2] = bg[2];
  }
  const shades = Math.max(1, charset.length - 1);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let lum = (gray[y * cols + x] || 0) / 255;
      lum = Math.pow(Math.max(0, Math.min(1, (lum - 0.5) * contrast + 0.5)), 1 / gamma);
      if (invert) lum = 1 - lum;
      const ch = charset[Math.max(0, Math.min(shades, Math.round(lum * shades)))] || ' ';
      drawGlyph({ width: outputWidth, data }, ch, x * cellW, y * cellH, cellW, cellH, fg, bg);
    }
  }
  return Buffer.concat([Buffer.from(`P6\n${outputWidth} ${outputHeight}\n255\n`), data]);
}


function resolveGridAndCell(config, outputWidth, outputHeight) {
  const widthCharsRaw = Number(config.widthChars || config.size || 0);
  if (Number.isFinite(widthCharsRaw) && widthCharsRaw > 0) {
    const cols = clampInt(widthCharsRaw, 24, 260, 80);
    const cellW = Math.max(1, Math.floor(outputWidth / cols));
    const cellH = Math.max(1, Math.round(cellW * FONT_CELL_H / FONT_CELL_W));
    const rows = Math.max(1, Math.floor(outputHeight / cellH));
    return { cols, rows, cellW, cellH, widthChars: cols, gridSource: 'widthChars' };
  }
  const cellW = clampInt(config.cellW, 4, 64, DEFAULT_CELL_W);
  const cellH = clampInt(config.cellH, 6, 96, DEFAULT_CELL_H);
  const cols = Math.max(1, Math.floor(outputWidth / cellW));
  const rows = Math.max(1, Math.floor(outputHeight / cellH));
  return { cols, rows, cellW, cellH, widthChars: null, gridSource: 'cellFallback' };
}

function waitForClose(child, label, getErr) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(getErr() || `${label} exit ${code}`));
    });
  });
}

async function renderProfile(inputPath, outputPath, config, profile, sourceSize, fontProbe) {
  const fps = clampRenderFps(config.fps);
  const outputWidth = profile.width;
  const outputHeight = profile.height;
  const { cols, rows, cellW, cellH, widthChars, gridSource } = resolveGridAndCell(config, outputWidth, outputHeight);
  const fillMode = String(config.fillMode || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
  const charset = resolveCharset(config);
  const fg = hexToRgb(config.fg || config.color, [255, 255, 255]);
  const bg = hexToRgb(config.bg || config.background, [0, 0, 0]);
  const extractionMode = fillMode === 'cover' ? 'canvas-cover-then-grid' : 'grid-contain-fallback';
  const extractionFilter = buildExtractionFilter({ fps, fillMode, outputWidth, outputHeight, cols, rows });
  const glyphMetrics = resolveGlyphMetrics(cellW, cellH);
  const frameOpts = {
    cols,
    rows,
    outputWidth,
    outputHeight,
    cellW,
    cellH,
    charset,
    fg,
    bg,
    contrast: Math.max(0.1, Number(config.contrast || 1)),
    gamma: Math.max(0.1, Number(config.gamma || 1)),
    invert: !!config.invert
  };
  const atlasInfo = await buildGlyphAtlas(frameOpts, fontProbe);
  let useAtlasRenderer = fontProbe.fontRenderAvailable && atlasInfo.atlasGlyphCount > 0;

  console.log('[telegram-render] config', {
    sourceSize,
    outputCanvas: { width: outputWidth, height: outputHeight, profile: profile.name },
    widthChars,
    cols,
    rows,
    cellW,
    cellH,
    gridSource,
    fillMode,
    extractionMode,
    fontRenderAvailable: fontProbe.fontRenderAvailable,
    selectedFontPath: fontProbe.selectedFontPath,
    glyphRenderer: useAtlasRenderer ? 'font-atlas' : 'bitmap-fallback',
    rendererBackend: fontProbe.rendererBackend,
    reason: fontProbe.reason,
    fontCellMetric: `${FONT_CELL_W}x${FONT_CELL_H}`,
    atlasGlyphCount: atlasInfo.atlasGlyphCount,
    missingGlyphs: atlasInfo.missingGlyphs,
    atlasInkPixels: atlasInfo.atlasInkPixels,
    fontProbeInkPixels: fontProbe.fontProbeInkPixels,
    fontProbeInkRatio: fontProbe.fontProbeInkRatio,
    glyphMatrixSize: `${GLYPH_W}x${GLYPH_H}`,
    glyphScaleMode: 'uniform-integer',
    glyphScale: glyphMetrics.glyphScale,
    renderedGlyphWidth: glyphMetrics.glyphWidthPx,
    renderedGlyphHeight: glyphMetrics.glyphHeightPx
  });

  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const extract = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', inputPath, '-vf', extractionFilter, '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const encode = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-framerate', String(fps), '-f', 'image2pipe', '-vcodec', 'ppm', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', outputPath], { stdio: ['pipe', 'ignore', 'pipe'] });
  let extErr = '';
  let encErr = '';
  extract.stderr.on('data', (d) => { extErr += d.toString(); });
  encode.stderr.on('data', (d) => { encErr += d.toString(); });
  const extractDone = waitForClose(extract, 'ffmpeg extract', () => extErr);
  const encodeDone = waitForClose(encode, 'ffmpeg encode', () => encErr);
  const frameSize = cols * rows;
  let pending = Buffer.alloc(0);

  let useSystemRenderer = !useAtlasRenderer && fontProbe.fontRenderAvailable;
  let effectiveGlyphRenderer = useAtlasRenderer ? 'font-atlas' : fontProbe.glyphRenderer;
  let effectiveRendererBackend = fontProbe.rendererBackend;
  let effectiveReason = fontProbe.reason;
  let firstFrameChecked = false;
  let firstFrameInkPixels = null;
  let firstFrameInkRatio = null;

  for await (const chunk of extract.stdout) {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= frameSize) {
      const gray = pending.subarray(0, frameSize);
      pending = pending.subarray(frameSize);
      let ppm = useAtlasRenderer
        ? renderFrameAtlasPpm(gray, frameOpts, atlasInfo.atlas)
        : (useSystemRenderer ? await renderFrameSystemPpm(gray, frameOpts, fontProbe) : renderFrameBitmapPpm(gray, frameOpts));

      if ((useAtlasRenderer || useSystemRenderer) && !firstFrameChecked) {
        const firstFrameInk = validateRenderedPpmHasInk(ppm, bg);
        firstFrameChecked = true;
        firstFrameInkPixels = firstFrameInk.inkPixels;
        firstFrameInkRatio = firstFrameInk.inkRatio;
        console.log('[telegram-render] first-frame-ink-check', {
          glyphRenderer: firstFrameInk.ok ? (useAtlasRenderer ? 'font-atlas' : 'font-system') : 'bitmap-fallback',
          selectedFontPath: fontProbe.selectedFontPath,
          rendererBackend: fontProbe.rendererBackend,
          fontCellMetric: `${FONT_CELL_W}x${FONT_CELL_H}`,
          cellW,
          cellH,
          cols,
          rows,
          atlasGlyphCount: atlasInfo.atlasGlyphCount,
          missingGlyphs: atlasInfo.missingGlyphs,
          atlasInkPixels: atlasInfo.atlasInkPixels,
          firstFrameInkPixels,
          firstFrameInkRatio,
          reason: firstFrameInk.ok ? null : FONT_RENDER_NO_INK
        });
        if (!firstFrameInk.ok) {
          useAtlasRenderer = false;
          useSystemRenderer = false;
          effectiveGlyphRenderer = 'bitmap-fallback';
          effectiveRendererBackend = 'bitmap-fallback';
          effectiveReason = FONT_RENDER_NO_INK;
          ppm = renderFrameBitmapPpm(gray, frameOpts);
        }
      }

      if (!encode.stdin.write(ppm)) await new Promise((resolve) => encode.stdin.once('drain', resolve));
    }
  }

  await extractDone;
  encode.stdin.end();
  await encodeDone;
  const outputSizeBytes = (await fs.promises.stat(outputPath)).size;
  return { outputPath, outputSizeBytes, outputWidth, outputHeight, cols, rows, cellW, cellH, fillMode, extractionMode, glyphRenderer: effectiveGlyphRenderer, rendererBackend: effectiveRendererBackend, selectedFontPath: fontProbe.selectedFontPath, reason: effectiveReason, fontCellMetric: `${FONT_CELL_W}x${FONT_CELL_H}`, atlasGlyphCount: atlasInfo.atlasGlyphCount, missingGlyphs: atlasInfo.missingGlyphs, atlasInkPixels: atlasInfo.atlasInkPixels, fontProbeInkPixels: fontProbe.fontProbeInkPixels, fontProbeInkRatio: fontProbe.fontProbeInkRatio, firstFrameInkPixels, firstFrameInkRatio, glyphMatrixSize: `${GLYPH_W}x${GLYPH_H}`, glyphScaleMode: 'uniform-integer', glyphScale: glyphMetrics.glyphScale, renderedGlyphWidth: glyphMetrics.glyphWidthPx, renderedGlyphHeight: glyphMetrics.glyphHeightPx, profile: profile.name };
}

async function renderTelegramVideo(inputPath, outputPath, config = {}) {
  const fontProbe = await probeFontRender();
  console.log('[telegram-render] font-render-probe', {
    fontRenderAvailable: fontProbe.fontRenderAvailable,
    selectedFontPath: fontProbe.selectedFontPath,
    glyphRenderer: fontProbe.glyphRenderer,
    rendererBackend: fontProbe.rendererBackend,
    reason: fontProbe.reason,
    fontProbeInkPixels: fontProbe.fontProbeInkPixels,
    fontProbeInkRatio: fontProbe.fontProbeInkRatio,
    tools: fontProbe.tools
  });
  const sourceSize = await probeVideoSize(inputPath);
  const { orientation, profiles } = resolveRenderParams(inputPath, config, sourceSize);
  let lastResult = null;
  let lastError = null;
  for (const profile of profiles) {
    try {
      const result = await renderProfile(inputPath, outputPath, config, profile, sourceSize, fontProbe);
      lastResult = { ...result, orientation };
      if (result.outputSizeBytes <= RENDER_OUTPUT_SAFE_LIMIT_BYTES) return lastResult;
      console.log('[telegram-render] output-too-large-try-next-profile', { profile: profile.name, outputSizeBytes: result.outputSizeBytes, limit: RENDER_OUTPUT_SAFE_LIMIT_BYTES });
    } catch (err) {
      lastError = err;
      console.error('[telegram-render] profile-failed', { profile: profile.name, error: err?.message || err });
    }
    try { await fs.promises.rm(outputPath, { force: true }); } catch {}
  }
  if (lastResult) return lastResult;
  throw lastError || new Error('RENDER_FAILED');
}

module.exports = { renderTelegramVideo, buildExtractionFilter, GLYPHS_8X16 };
