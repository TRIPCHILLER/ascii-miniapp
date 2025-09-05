// ascii.js — рендер из камеры в ASCII
// Важное: автоматически вписывает ASCII в .stage при любой "Ширине"

export class AsciiApp {
  constructor(outEl) {
    this.out = outEl;               // <pre id="out">
    this.video = null;
    this.stream = null;
    this.ctx = null;
    this.canvas = document.createElement('canvas');

    this.options = {
      widthChars: 160,
      contrast: 1.15,
      gamma: 1.20,
      color: '#8ac7ff',
      background: '#000000',
      fps: 30,
      ramp: " .'`\",:;Il!i~+_-?][}{1tfjrxnuvczXYUJCLQ0089@#",
      invert: true,
    };

    this.facing = 'user';
    this._running = false;
    this._timer = 0;
    this._lastFrameTs = 0;
    this._measure = null;

    // подгонка под размер окна
    this._ro = new ResizeObserver(() => this._refit());
    this._ro.observe(this.out.parentElement); // .stage

    this._applyColors();
  }

  async start() {
    await this._openCamera();
    this._running = true;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  async flip() {
    this.facing = (this.facing === 'user') ? 'environment' : 'user';
    await this._openCamera(true);
    this._refit();
  }

  setOptions(opts) {
    Object.assign(this.options, opts);
    this._applyColors();
    this._refit();
  }

  // ===== камера =====
  async _openCamera(restart = false) {
    if (restart) this.stop();

    const constraints = {
      audio: false,
      video: { facingMode: this.facing, width: { ideal: 1280 }, height: { ideal: 720 } }
    };
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    if (!this.video) {
      this.video = document.createElement('video');
      this.video.playsInline = true;
      this.video.muted = true;
      this.video.autoplay = true;
      this.video.srcObject = this.stream;

      this.video.addEventListener('loadedmetadata', () => this._refit(), { once:true });
      this.video.addEventListener('playing', () => this._refit(), { once:true });
    } else {
      this.video.srcObject = this.stream;
    }

    if (!this.ctx) this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  // ===== цвета/фон =====
  _applyColors() {
    if (!this.out) return;
    const fg = this.options.color || '#8ac7ff';
    const bg = this.options.background || '#000000';

    this.out.style.setProperty('--fg', fg);
    this.out.style.setProperty('--bg', bg);

    this.out.style.color = fg;              // сам ASCII
    this.out.style.backgroundColor = bg;    // фон ASCII

    const stage = this.out.parentElement;   // фон вокруг — чтобы совпадал
    if (stage) stage.style.backgroundColor = bg;
  }

  // ===== авто-вписывание в .stage =====
  _measureChPx(){
    if (!this._measure) {
      this._measure = document.createElement('div');
      this._measure.style.position = 'absolute';
      this._measure.style.visibility = 'hidden';
      this._measure.style.pointerEvents = 'none';
      this._measure.style.width = '1ch';
      this._measure.style.height = '0';
      this._measure.style.fontFamily = getComputedStyle(this.out).fontFamily;
      this._measure.style.fontSize = '1px';
      document.body.appendChild(this._measure);
    }
    const k = this._measure.getBoundingClientRect().width || 1;
    return k; // px per 1ch when font-size=1px
  }

  _estimateRows(cols){
    const vw = this.video?.videoWidth  || 640;
    const vh = this.video?.videoHeight || 480;
    return Math.max(1, Math.round(cols * (vh / vw)));
  }

  _fitToStage(cols){
    const stage = this.out?.parentElement;
    if (!stage || !cols) return;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return;

    const rows = this._estimateRows(cols);
    const chPxTarget = Math.floor(Math.min(sw / cols, sh / rows)); // contain
    if (!isFinite(chPxTarget) || chPxTarget <= 0) return;

    const k = this._measureChPx();
    const fontSizePx = chPxTarget / k;
    this.out.style.fontSize = fontSizePx + 'px';
  }

  _refit(){
    const cols = this.options?.widthChars || 160;
    this._fitToStage(cols);
  }

  // ===== рендер =====
  _loop(ts = 0) {
    if (!this._running) return;

    const msPerFrame = 1000 / Math.max(1, this.options.fps || 30);
    if (ts - this._lastFrameTs >= msPerFrame) {
      this._lastFrameTs = ts;
      this._renderFrame();
    }
    this._timer = requestAnimationFrame(this._loop.bind(this));
  }

  _renderFrame() {
    if (!this.video || !this.ctx) return;
    const cols = Math.max(1, this.options.widthChars | 0);
    const rows = this._estimateRows(cols);

    // на всякий — следим за размерами
    this._fitToStage(cols);

    this.canvas.width = cols;
    this.canvas.height = rows;
    this.ctx.drawImage(this.video, 0, 0, cols, rows);

    const img = this.ctx.getImageData(0, 0, cols, rows).data;

    const contrast = this.options.contrast || 1.0;
    const gamma = this.options.gamma || 1.0;
    const inv = !!this.options.invert;

    const ramp = (this.options.ramp && this.options.ramp.length > 1)
      ? this.options.ramp
      : " .'`\",:;Il!i~+_-?][}{1tfjrxnuvczXYUJCLQ0089@#";

    const rampLen = ramp.length;
    const gammaInv = 1 / gamma;

    let out = '';
    let p = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, p += 4) {
        const r = img[p]   / 255;
        const g = img[p+1] / 255;
        const b = img[p+2] / 255;

        let Y = 0.2126*r + 0.7152*g + 0.0722*b; // luma
        Y = ((Y - 0.5) * contrast) + 0.5;       // контраст
        Y = Math.max(0, Math.min(1, Math.pow(Y, gammaInv))); // гамма

        if (inv) Y = 1 - Y;

        const idx = Math.min(rampLen - 1, Math.max(0, Math.floor(Y * rampLen)));
        out += ramp[idx];
      }
      if (y !== rows - 1) out += '\n';
    }

    this.out.textContent = out;
  }
}
