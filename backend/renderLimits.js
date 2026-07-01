'use strict';

const RENDER_VIDEO_COST = 15;
const RENDER_MAX_DURATION_SEC = 10;
const RENDER_OUTPUT_SAFE_LIMIT_BYTES = 48 * 1024 * 1024;
const RENDER_QUEUE_CONCURRENCY = 1;
const TG_BACKGROUND_RENDER_ENABLED = /^(1|true|yes|on)$/i.test(String(process.env.TG_BACKGROUND_RENDER_ENABLED || ''));
const TG_RENDER_MAX_FPS = Math.max(1, Math.min(60, Math.round(Number(process.env.TG_RENDER_MAX_FPS || 24) || 24)));

function clampRenderFps(value) {
  const fps = Math.round(Number(value));
  if (!Number.isFinite(fps) || fps <= 0) return TG_RENDER_MAX_FPS;
  return Math.max(1, Math.min(TG_RENDER_MAX_FPS, fps));
}

function getRenderProfiles(orientation) {
  const key = String(orientation || '').toLowerCase();
  if (key === 'landscape') {
    return [
      { width: 2984, height: 1680, name: 'landscape-2984x1680' },
      { width: 2560, height: 1440, name: 'landscape-2560x1440' },
      { width: 1920, height: 1080, name: 'landscape-1920x1080' },
      { width: 1280, height: 720, name: 'landscape-1280x720' }
    ];
  }
  if (key === 'square') {
    return [
      { width: 2160, height: 2160, name: 'square-2160x2160' },
      { width: 1440, height: 1440, name: 'square-1440x1440' },
      { width: 1080, height: 1080, name: 'square-1080x1080' }
    ];
  }
  return [
    { width: 1680, height: 2984, name: 'portrait-1680x2984' },
    { width: 1440, height: 2560, name: 'portrait-1440x2560' },
    { width: 1080, height: 1920, name: 'portrait-1080x1920' },
    { width: 720, height: 1280, name: 'portrait-720x1280' }
  ];
}

function resolveOrientation({ width, height, sourceOrientation } = {}) {
  const explicit = String(sourceOrientation || '').toLowerCase();
  if (explicit === 'portrait' || explicit === 'landscape' || explicit === 'square') return explicit;
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (w > h) return 'landscape';
  if (h > w) return 'portrait';
  return 'square';
}

module.exports = {
  RENDER_VIDEO_COST,
  RENDER_MAX_DURATION_SEC,
  RENDER_OUTPUT_SAFE_LIMIT_BYTES,
  RENDER_QUEUE_CONCURRENCY,
  TG_BACKGROUND_RENDER_ENABLED,
  TG_RENDER_MAX_FPS,
  clampRenderFps,
  getRenderProfiles,
  resolveOrientation
};
