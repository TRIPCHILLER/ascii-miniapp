// ASCII Live App — fixed build
// - Default FPS: 30
// - Front camera aspect ratio preserved (no vertical stretch). Uses charAspect calibration.
// - Fullscreen handled via requestFullscreen/exitFullscreen with Telegram WebApp fallback.
// - Inversion is ON by default (mapping of brightness to ramp is inverted).
// - Mirroring for front camera ("user") for natural selfie preview.
// - Throttled frame loop to target FPS.

export class AsciiApp {
  constructor(outEl, opts = {}) {
    this.out = outEl;
    this.opts = Object.assign({
      widthChars: 140,
      contrast: 1.15,
      gamma: 1.2,
      color: '#8ac7ff',
      background: '#000000',
      fps: 30,                       // default 30 FPS
      ramp: " .'`\",:;Il!i~+_-?][}{1tfjrxnuvczXYUJCLQ0089@#",
      invert: true,                  // inversion ON by default
      charAspect: 0.50               // width/height of a monospace character cell (~0.5 is a good start)
    }, opts);
    this.facing = 'user';            // 'user' (front) or 'environment' (rear)
    this._c = document.createElement('canvas');
    this._ctx = this._c.getContext('2d', { willReadFrequently: true });
    this._video = document.createElement('video');
    this._video.playsInline = true;
    this._video.muted = true;
    this._video.autoplay = true;

    this._stream = null;
    this._raf = 0;
    this._timer = 0;
    this._loop = this._loop.bind(this);
    this._running = false;
  }

  setOptions(o) {
    Object.assign(this.opts, o || {});
    // Apply colors to the PRE via CSS variables for instant feedback
    if (this.out) {
      this.out.style.setProperty('--fg', this.opts.color);
      this.out.style.setProperty('--bg', this.opts.background);
    }
  }

  async _getStream() {
    // Prefer a sane resolution; the pipeline downsamples anyway.
    const constraints = {
      audio: false,
      video: {
        facingMode: this.facing,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  async start() {
    await this.stop(); // clean previous
    try {
      this._stream = await this._getStream();
    } catch (e) {
      throw e;
    }
    const [track] = this._stream.getVideoTracks();
    // Some Android devices misreport settings; we rely on videoWidth/Height once ready.
    this._video.srcObject = this._stream;
    await this._video.play();

    // Colors to PRE
    this.setOptions({}); // re-apply colors

    this._running = true;
    this._loop();
  }

  async stop() {
    this._running = false;
    if (this._timer) { clearTimeout(this._timer); this._timer = 0; }
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  }

  async flip() {
    // Toggle camera; restart stream to apply facingMode.
    this.facing = (this.facing === 'user') ? 'environment' : 'user';
    await this.start();
  }

  _calcCharGrid() {
    const vw = this._video.videoWidth || 1280;
    const vh = this._video.videoHeight || 720;
    // Preserve aspect ratio by solving for heightChars:
    // displayedAspect ≈ (widthChars * charAspect) / heightChars = vw / vh
    // => heightChars ≈ widthChars * (vh / vw) / charAspect
    const heightChars = Math.max(8, Math.round(this.opts.widthChars * (vh / vw) / this.opts.charAspect));
    return { widthChars: this.opts.widthChars | 0, heightChars };
  }

  _loop() {
    if (!this._running) return;

    const { widthChars: Wc, heightChars: Hc } = this._calcCharGrid();
    // Ensure canvas matches character grid; we draw video into this grid to avoid stretch.
    this._c.width = Wc;
    this._c.height = Hc;

    const ctx = this._ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';

    // Mirror for front camera for a natural selfie preview
    if (this.facing === 'user') {
      ctx.translate(this._c.width, 0);
      ctx.scale(-1, 1);
    }

    // Draw current video frame resized to canvas grid
    ctx.drawImage(this._video, 0, 0, this._c.width, this._c.height);
    ctx.restore();

    // Read pixels & build ASCII
    const img = ctx.getImageData(0, 0, this._c.width, this._c.height).data;
    const ramp = this.opts.ramp;
    const rlen = ramp.length - 1;
    const inv = !!this.opts.invert; // invert brightness-to-ramp mapping

    const C = Math.max(0, this.opts.contrast); // contrast multiplier
    const g = Math.max(0.01, this.opts.gamma); // gamma

    let outStr = '';
    for (let y = 0; y < Hc; y++) {
      let row = '';
      const rowOff = y * Wc * 4;
      for (let x = 0; x < Wc; x++) {
        const i = rowOff + x * 4;
        let r = img[i], gch = img[i + 1], b = img[i + 2];
        // linear luminance
        let L = 0.2126 * r + 0.7152 * gch + 0.0722 * b;
        // contrast
        L = (L - 128) * C + 128;
        // gamma
        L = 255 * Math.pow(Math.min(255, Math.max(0, L)) / 255, 1 / this.opts.gamma);
        const idx = Math.round(((inv ? L : (255 - L)) / 255) * rlen);
        row += ramp[idx];
      }
      outStr += row + '\n';
    }
    this.out.textContent = outStr;

    // Throttle to target FPS
    const interval = 1000 / Math.max(1, this.opts.fps | 0);
    this._timer = setTimeout(() => { this._raf = requestAnimationFrame(this._loop); }, interval);
  }
}

// Utility to wire a fullscreen toggle button
export function wireFullscreen(btn) {
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // Prefer wrapping element if present
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
      }
    } catch (e) {
      // Telegram WebApp fallback (no-op outside Telegram)
      try { if (window.Telegram && Telegram.WebApp) Telegram.WebApp.expand(); } catch (_) {}
    }
  });
}
