'use strict';

function envInt(name, fallback, min = 1) {
  const raw = process.env[name];
  const value = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, value);
}

const TG_BACKGROUND_RENDER_ENABLED = String(process.env.TG_BACKGROUND_RENDER_ENABLED || 'false').toLowerCase() === 'true';
const TG_RENDER_MAX_DURATION_SEC = envInt('TG_RENDER_MAX_DURATION_SEC', 10, 1);
const TG_RENDER_MAX_FPS = envInt('TG_RENDER_MAX_FPS', 30, 1);
const TG_RENDER_MAX_CONCURRENCY = envInt('TG_RENDER_MAX_CONCURRENCY', 1, 1);
const TG_RENDER_OUTPUT_SAFE_MB = envInt('TG_RENDER_OUTPUT_SAFE_MB', 45, 1);
const TG_RENDER_OUTPUT_SAFE_LIMIT_BYTES = TG_RENDER_OUTPUT_SAFE_MB * 1024 * 1024;
const TG_RENDER_COST = 15;

module.exports = {
  TG_BACKGROUND_RENDER_ENABLED,
  TG_RENDER_MAX_DURATION_SEC,
  TG_RENDER_MAX_FPS,
  TG_RENDER_MAX_CONCURRENCY,
  TG_RENDER_OUTPUT_SAFE_LIMIT_BYTES,
  TG_RENDER_COST
};
