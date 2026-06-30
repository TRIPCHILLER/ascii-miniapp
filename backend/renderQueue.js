'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { TG_RENDER_MAX_CONCURRENCY, TG_RENDER_COST } = require('./renderLimits');

function createRenderQueue({ sendMessage, sendVideoToUser, deduct, renderTelegramVideo, concurrency = TG_RENDER_MAX_CONCURRENCY } = {}) {
  if (typeof sendMessage !== 'function') {
    throw new Error('renderQueue requires sendMessage helper');
  }
  if (typeof sendVideoToUser !== 'function') {
    throw new Error('renderQueue requires sendVideoToUser helper');
  }
  if (typeof deduct !== 'function') {
    throw new Error('renderQueue requires deduct helper');
  }
  if (typeof renderTelegramVideo !== 'function') {
    throw new Error('renderQueue requires renderTelegramVideo helper');
  }

  const queue = [];
  const jobs = new Map();
  const openJobByUser = new Map();
  let activeCount = 0;
  const maxConcurrency = Math.max(1, Number.parseInt(String(concurrency), 10) || 1);

  function getJob(jobId) {
    return jobs.get(String(jobId));
  }

  function hasOpenJobForUser(userId) {
    const jobId = openJobByUser.get(String(userId));
    if (!jobId) return false;
    const job = jobs.get(jobId);
    return !!job && (job.status === 'queued' || job.status === 'active');
  }

  function enqueue({ userId, workspaceDir, inputPath, fps, durationSec }) {
    const uid = String(userId || '').trim();
    if (!uid) throw new Error('userId required');
    if (hasOpenJobForUser(uid)) {
      const err = new Error('USER_RENDER_JOB_ALREADY_ACTIVE');
      err.code = 'USER_RENDER_JOB_ALREADY_ACTIVE';
      throw err;
    }

    const jobId = `rj_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const job = {
      jobId,
      userId: uid,
      workspaceDir,
      inputPath,
      fps,
      durationSec,
      status: 'queued',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    jobs.set(jobId, job);
    openJobByUser.set(uid, jobId);
    queue.push(job);
    sendMessage(uid, `⏳ Background render поставлен в очередь. jobId: ${jobId}`).catch((err) => {
      console.warn('[renderQueue] queued message failed', err?.message || err);
    });
    drain();
    return job;
  }

  function drain() {
    while (activeCount < maxConcurrency && queue.length > 0) {
      const job = queue.shift();
      activeCount += 1;
      runJob(job).finally(() => {
        activeCount -= 1;
        drain();
      });
    }
  }

  async function runJob(job) {
    job.status = 'active';
    job.updatedAt = new Date().toISOString();
    try {
      await sendMessage(job.userId, `▶️ Background render стартовал. jobId: ${job.jobId}`);
      const result = await renderTelegramVideo(job);
      const sent = await sendVideoToUser(job.userId, result.path, { caption: '#ascii_video #background_render' });
      const nextBalance = deduct(job.userId, TG_RENDER_COST);
      job.status = 'done';
      job.result = {
        outputSizeBytes: result.outputSizeBytes,
        frameCount: result.frameCount,
        fps: result.fps,
        telegramOk: !!sent?.ok,
        balance: nextBalance
      };
      job.updatedAt = new Date().toISOString();
    } catch (err) {
      job.status = 'failed';
      job.error = String(err?.message || err);
      job.updatedAt = new Date().toISOString();
      try {
        await sendMessage(job.userId, `❌ Background render failed. Импульсы не списаны. jobId: ${job.jobId}`);
      } catch (sendErr) {
        console.warn('[renderQueue] failed message failed', sendErr?.message || sendErr);
      }
    } finally {
      openJobByUser.delete(job.userId);
      if (job.workspaceDir) {
        try {
          await fs.promises.rm(job.workspaceDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          console.warn('[renderQueue] cleanup failed', { jobId: job.jobId, error: cleanupErr?.message || cleanupErr });
        }
      } else if (job.inputPath) {
        try { await fs.promises.rm(job.inputPath, { force: true }); } catch {}
      }
    }
  }

  return { enqueue, getJob, hasOpenJobForUser };
}

module.exports = { createRenderQueue };
