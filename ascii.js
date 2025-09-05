// Прочный рендер: авто-вписывание по реальному измерению текста,
// рефит не зависит от контраста/гаммы

export class AsciiApp {
  constructor(outEl) {
    this.out = outEl;
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

    // элемент для измерений
    this._probe = document.createElement('span');
    Object.assign(this._probe.style, {
      position:'absolute', left:'-99999px', top:'-99999px',
      whiteSpace:'pre', visibility:'hidden', pointerEvents:'none'
    });
    document.body.appendChild(this._probe);

    // наблюдаем сцену
    this._ro = new ResizeObserver(() => this.refit());
    this._ro.observe(this.out.parentElement);

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
  }

  setOptions(opts) {
    Object.assign(this.options, opts);
    this._applyColors(); // обновим цвета, но НЕ рефитим
  }

  refit() {
    const cols = Math.max(1, this.options.widthChars | 0);
    const rows = this._estimateRows(cols);
    this._fitByProbe(cols, rows);
  }

  // ====== камера ======
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
      this.video.addEventListener('loadedmetadata', () => this.refit(), { once:true });
      this.video.addEventListener('playing', () => this.refit(), { once:true });
    } else {
      this.video.srcObject = this.stream;
    }

    if (!this.ctx) this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  // ====== цвета/фон ======
  _applyColors() {
    const fg = this.options.color || '#8ac7ff';
    const bg = this.options.background || '#000000';
    this.out.style.setProperty('--fg', fg);
    this.out.style.setProperty('--bg', bg);

    this.out.style.color = fg;
    this.out.style.backgroundColor = bg;

    const stage = this.out.parentElement;
    if (stage) stage.style.backgroundColor = bg;
  }

  // ====== расчёт строк по аспекту ======
  _estimateRows(cols){
    const vw = this.video?.videoWidth  || 640;
    const vh = this.video?.videoHeight || 480;
    return Math.max(1, Math.round(cols * (vh / vw)));
  }

  // ====== прочный рефит по реальному измерению ======
  _fitByProbe(cols, rows){
    const stage = this.out.parentElement;
    if (!stage) return;

    // подставляем тот же шрифт и свойства, что у <pre>
    const cs = getComputedStyle(this.out);
    const probeStyle = this._probe.style;
    probeStyle.fontFamily = cs.fontFamily;
    probeStyle.fontVariantLigatures = cs.fontVariantLigatures || 'none';
    probeStyle.letterSpacing = cs.letterSpacing || '0';
    probeStyle.lineHeight = cs.lineHeight || '1.0';

    // строим прямоугольник cols×rows
    const line = '0'.repeat(cols);
    this._probe.textContent = Array.from({length: rows}, () => line).join('\n');

    // стартовая прикидка
    let fontSize = 12; // px
    probeStyle.fontSize = fontSize + 'px';

    // реальные размеры при стартовой прикидке
    let rect = this._probe.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const sw = stage.clientWidth  || 1;
    const sh = stage.clientHeight || 1;

    // коэффициент вписывания (contain)
    const k = Math.min(sw / rect.width, sh / rect.height);
    fontSize = Math.max(1, Math.floor(fontSize * k));

    // финальный размер
    this.out.style.fontSize = fontSize + 'px';
  }

  // ====== рендер ======
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

    // геометрию не трогаем — только рисуем
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

        // яркость
        let Y = 0.2126*r + 0.7152*g + 0.0722*b;

        // мягкий контраст (clamp)
        if (contrast !== 1) {
          const k = Math.max(0, Math.min(2.5, contrast));
          Y = ((Y - 0.5) * k) + 0.5;
        }

        // гамма + кламп
        Y = Math.max(0, Math.min(1, Math.pow(Y, gammaInv)));

        if (inv) Y = 1 - Y;

        const idx = Math.min(rampLen - 1, Math.max(0, Math.floor(Y * rampLen)));
        out += ramp[idx];
      }
      if (y !== rows - 1) out += '\n';
    }

    this.out.textContent = out;
  }
}
