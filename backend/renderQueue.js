'use strict';

const DEFAULT_CONCURRENCY = Math.max(1, Number(process.env.RENDER_QUEUE_CONCURRENCY || 1) || 1);

class RenderQueue {
  constructor({ concurrency = DEFAULT_CONCURRENCY } = {}) {
    this.concurrency = Math.max(1, Number(concurrency) || 1);
    this.pending = [];
    this.active = 0;
  }

  add(task) {
    if (typeof task !== 'function') throw new TypeError('RenderQueue task must be a function');
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.drain();
    });
  }

  drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const item = this.pending.shift();
      this.active += 1;
      Promise.resolve()
        .then(item.task)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.active -= 1;
          this.drain();
        });
    }
  }

  stats() {
    return { active: this.active, pending: this.pending.length, concurrency: this.concurrency };
  }
}

module.exports = { RenderQueue, renderQueue: new RenderQueue() };
