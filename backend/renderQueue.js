'use strict';

const { RENDER_QUEUE_CONCURRENCY } = require('./renderLimits');

class RenderQueue {
  constructor({ concurrency = RENDER_QUEUE_CONCURRENCY } = {}) {
    this.concurrency = 1;
    this.pending = [];
    this.active = 0;
    this.userJobs = new Map();
    if (Number(concurrency) !== 1) this.concurrency = 1;
  }

  hasUserJob(userId) {
    return this.userJobs.has(String(userId));
  }

  add({ userId, jobId, task }) {
    const uid = String(userId || '');
    if (!uid) throw new Error('RENDER_USER_REQUIRED');
    if (this.hasUserJob(uid)) throw new Error('RENDER_JOB_ALREADY_ACTIVE');
    if (typeof task !== 'function') throw new TypeError('RenderQueue task must be a function');
    this.userJobs.set(uid, { jobId, status: 'queued' });
    return new Promise((resolve, reject) => {
      this.pending.push({ userId: uid, jobId, task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const item = this.pending.shift();
      const marker = this.userJobs.get(item.userId);
      if (marker) marker.status = 'active';
      this.active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.userJobs.delete(item.userId);
          this.drain();
        });
    }
  }

  stats() {
    return {
      active: this.active,
      pending: this.pending.length,
      concurrency: this.concurrency,
      userJobs: this.userJobs.size
    };
  }
}

module.exports = { RenderQueue, renderQueue: new RenderQueue({ concurrency: 1 }) };
