// ascii.js — общий модуль для index.html и pro.html
// Экспортируемые сущности:
//   - AsciiApp: класс движка
//   - wireFullscreen(buttonEl, stageEl): фуллскрин с выходом по тапу
//   - bootIndex(): стартовый код для index.html

const isMobileUA = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

export class AsciiApp {
  constructor(outEl, opts = {}) {
    this.out = outEl;
    this.stage = opts.stageEl || outEl.closest('.stage') || document.body;
    this.video = opts.videoEl || document.getElementById('vid') || this._ensureVideo();

    // дефолты
    this.state = {
      facing: 'user',
      mirror: true,            // рисуем отзеркаленно на канвас, чтобы получить НЕ-зеркальную картинку
      widthChars: 160,
      contrast: 1.15,
      gamma: 1.20,
      fps: 30,
      color: '#8ac7ff',
      background: '#000000',
      ramp: (window.ASCII_RAMPS?.get?.('classic')) || "@%#*+=-:.",
      invert: true
    };

    // подложки
    this.off = document.createElement('canvas');
    this.ctx = this.off.getContext('2d', { willReadFrequently: true });

    this.measurePre = document.createElement('pre');
    this.measurePre.style.cssText = `
      position:absolute; left:-99999px; top:-99999px; margin:0;
      white-space:pre; line-height:1ch;
      font-family: ui-monospace, Menlo, Consolas, "Cascadia Mono", monospace;
    `;
    document.body.appendChild(this.measurePre);

    this.raf = null;
    this.lastFrameTime = 0;
    this._resizeObs = new ResizeObserver(() => this._refitNow());
    this._resizeObs.observe(this.stage);

    // применим цвета
    this.out.style.color = this.state.color;
    this.out.style.backgroundColor = this.state.background;
    this.stage.style.backgroundColor = this.state.background;
  }

  _ensureVideo() {
    const v = document.createElement('video');
    v.autoplay = true;
    v.playsInline = true;
    v.muted = true;
    v.hidden = true;
    document.body.appendChild(v);
    return v;
  }

  setOptions(o = {}) {
    const s = this.state;
    if (o.widthChars != null) s.widthChars = +o.widthChars;
    if (o.contrast != null)   s.contrast   = +o.contrast;
    if (o.gamma != null)      s.gamma      = +o.gamma;
    if (o.fps != null)        s.fps        = +o.fps;
    if (o.color)              { s.color = o.color; this.out.style.color = s.color; }
    if (o.background)         { s.background = o.background; this.out.style.backgroundColor = s.background; this.stage.style.backgroundColor = s.background; }
    if (o.ramp)               s.ramp = String(o.ramp);
    if (o.invert != null)     s.invert = !!o.invert;
  }

  async start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.state.facing } });
      this.video.srcObject = stream;
      await this.video.play();
    } catch (e) {
      console.error('getUserMedia error', e);
      throw e;
    }

    if (this.raf) cancelAnimationFrame(this.raf);
    const loop = (ts) => {
      this.raf = requestAnimationFrame(loop);
      const interval = 1000 / this.state.fps;
      if (ts - this.lastFrameTime < interval) return;
      this.lastFrameTime = ts;
      this._renderFrame();
    };
    this.raf = requestAnimationFrame(loop);
    this._refitNow();
  }

  async flip() {
    if (isMobileUA) {
      // на мобилке меняем камеру
      this.state.facing = this.state.facing === 'user' ? 'environment' : 'user';
      const s = this.video.srcObject;
      if (s) s.getTracks().forEach(t => t.stop());
      await this.start();
      this.state.mirror = true;  // оставляем «правильный» вид
    } else {
      // на десктопе — просто зеркалим/раззеркаливаем
      this.state.mirror = !this.state.mirror;
    }
  }

  _measureCharAspect() {
    this.measurePre.textContent = 'M\nM';
    this.measurePre.style.fontSize = getComputedStyle(this.out).fontSize || '16px';
    const rect = this.measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width;
    const charRatio = lineH / chW; // H/W
    return 1 / charRatio;          // W/H
  }

  _gridSize() {
    const v = this.video;
    if (!v.videoWidth || !v.videoHeight) return { w: this.state.widthChars, h: 1 };
    const ratio = this._measureCharAspect();
    const aspect = (v.videoHeight / v.videoWidth) / ratio;
    const w = Math.max(1, Math.round(this.state.widthChars));
    const h = Math.max(1, Math.round(w * aspect));
    this.off.width = w;
    this.off.height = h;
    return { w, h };
  }

  _renderFrame() {
    const v = this.video;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = this._gridSize();

    // трансформа для зеркала
    this.ctx.setTransform(this.state.mirror ? -1 : 1, 0, 0, 1, this.state.mirror ? w : 0, 0);
    this.ctx.drawImage(v, 0, 0, w, h);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = this.ctx.getImageData(0, 0, w, h).data;

    const chars = this.state.ramp;
    const n = chars.length - 1;
    const inv = this.state.invert ? -1 : 1;
    const bias = this.state.invert ? 255 : 0;

    const gamma = this.state.gamma;
    const contrast = this.state.contrast;

    let out = '';
    let i = 0;
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++, i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        let Y = 0.2126*r + 0.7152*g + 0.0722*b;
        let v01 = Y / 255;
        v01 = ((v01 - 0.5) * contrast) + 0.5;
        v01 = Math.min(1, Math.max(0, v01));
        v01 = Math.pow(v01, 1 / gamma);
        const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
        const idx = Math.round((Yc / 255) * n);
        line += chars[idx];
      }
      out += line + '\n';
    }

    this.out.textContent = out;
  }

  _refitNow() {
    // подбор font-size под размер сцены
    const { w, h } = this._gridSize();
    const stageW = this.stage.clientWidth;
    const stageH = this.stage.clientHeight;

    this.measurePre.textContent = ('M'.repeat(w) + '\n').repeat(h);
    const currentFS = parseFloat(getComputedStyle(this.out).fontSize) || 16;
    this.measurePre.style.fontSize = currentFS + 'px';

    let r = this.measurePre.getBoundingClientRect();
    const k1 = Math.min(stageW / r.width, stageH / r.height);
    let newFS = Math.max(6, Math.floor(currentFS * k1));
    this.out.style.fontSize = newFS + 'px';

    this.measurePre.style.fontSize = newFS + 'px';
    r = this.measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / r.width, stageH / r.height);
    newFS = Math.max(6, Math.floor(newFS * k2));
    this.out.style.fontSize = newFS + 'px';
  }
}

export function wireFullscreen(buttonEl, stageEl) {
  const stage = stageEl || document.querySelector('.stage') || document.body;

  const inNative = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const reqFull = async () => {
    try {
      if (stage.requestFullscreen) await stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) await stage.webkitRequestFullscreen();
    } catch (e) {}
  };
  const exitFull = async () => {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } catch (e) {}
  };

  let fsTapHandler = null;
  let enteredAt = 0;

  const enableTapToExit = () => {
    disableTapToExit();
    fsTapHandler = (e) => {
      if (Date.now() - enteredAt < 300) return; // защита от двойного тапа
      const tag = (e.target.tagName || '').toLowerCase();
      if (['button','a','input','select','textarea','label'].includes(tag)) return;
      exitFull();
    };
    stage.addEventListener('click', fsTapHandler, { passive: true });
    stage.addEventListener('touchend', fsTapHandler, { passive: true });
  };
  const disableTapToExit = () => {
    if (!fsTapHandler) return;
    stage.removeEventListener('click', fsTapHandler);
    stage.removeEventListener('touchend', fsTapHandler);
    fsTapHandler = null;
  };

  const enter = async () => {
    enteredAt = Date.now();
    await reqFull();
    enableTapToExit();
  };

  const exit = async () => {
    await exitFull();
    disableTapToExit();
  };

  if (buttonEl) {
    buttonEl.addEventListener('click', () => {
      if (!inNative()) enter();
      else exit();
    });
  }

  document.addEventListener('fullscreenchange', () => {
    if (!inNative()) disableTapToExit();
  });
}

// === Автоподготовка index.html ===
export function bootIndex() {
  const $ = (s) => document.querySelector(s);
  const ui = {
    out: $('#out'),
    stage: $('#stage'),
    vid: $('#vid'),
    flip: $('#flip'),
    toggle: $('#toggle'),
    settings: $('#settings'),
    width: $('#width'),
    widthVal: $('#width_val'),
    contrast: $('#contrast'),
    contrastVal: $('#contrast_val'),
    gamma: $('#gamma'),
    gammaVal: $('#gamma_val'),
    fps: $('#fps'),
    fpsVal: $('#fps_val'),
    fg: $('#fg'),
    bg: $('#bg'),
    charset: $('#charset'),
    charsetCustom: $('#charset_custom'),
    invert: $('#invert'),
    fs: $('#fs')
  };

  const app = new AsciiApp(ui.out, { stageEl: ui.stage, videoEl: ui.vid });

  // начальные значения
  ui.width.value = app.state.widthChars;
  ui.widthVal.textContent = app.state.widthChars;
  ui.contrast.value = app.state.contrast;
  ui.contrastVal.textContent = app.state.contrast.toFixed(2);
  ui.gamma.value = app.state.gamma;
  ui.gammaVal.textContent = app.state.gamma.toFixed(2);
  ui.fps.value = app.state.fps;
  ui.fpsVal.textContent = app.state.fps;
  ui.fg.value = app.state.color;
  ui.bg.value = app.state.background;
  ui.invert.checked = app.state.invert;

  // charset: стартуем с 'classic'
  ui.charset.value = 'classic';
  if (ui.charsetCustom) ui.charsetCustom.style.display = 'none';
  app.state.ramp = (window.ASCII_RAMPS?.get?.('classic')) || app.state.ramp;

  // биндинги
  ui.toggle.addEventListener('click', () => {
    const hidden = ui.settings.hasAttribute('hidden');
    if (hidden) ui.settings.removeAttribute('hidden');
    else ui.settings.setAttribute('hidden', '');
  });

  ui.flip.addEventListener('click', () => app.flip());

  if (ui.fs) wireFullscreen(ui.fs, ui.stage);

  ui.width.addEventListener('input', e => {
    app.setOptions({ widthChars: +e.target.value });
    ui.widthVal.textContent = e.target.value;
  });

  ui.contrast.addEventListener('input', e => {
    const v = +e.target.value;
    app.setOptions({ contrast: v });
    ui.contrastVal.textContent = v.toFixed(2);
  });

  ui.gamma.addEventListener('input', e => {
    const v = +e.target.value;
    app.setOptions({ gamma: v });
    ui.gammaVal.textContent = v.toFixed(2);
  });

  ui.fps.addEventListener('input', e => {
    const v = +e.target.value;
    app.setOptions({ fps: v });
    ui.fpsVal.textContent = v;
  });

  ui.fg.addEventListener('input', e => app.setOptions({ color: e.target.value }));
  ui.bg.addEventListener('input', e => app.setOptions({ background: e.target.value }));

  function updateCharsetFromUI() {
    const key = ui.charset.value;
    if (key === 'custom') {
      if (ui.charsetCustom) ui.charsetCustom.style.display = 'inline-block';
      const custom = (ui.charsetCustom && ui.charsetCustom.value) ? ui.charsetCustom.value : ' .:-=+*#%@';
      app.setOptions({ ramp: custom });
    } else {
      if (ui.charsetCustom) ui.charsetCustom.style.display = 'none';
      const ramp = (window.ASCII_RAMPS && window.ASCII_RAMPS.get(key)) || key;
      app.setOptions({ ramp });
    }
  }
  ui.charset.addEventListener('change', updateCharsetFromUI);
  if (ui.charsetCustom) ui.charsetCustom.addEventListener('input', updateCharsetFromUI);

  ui.invert.addEventListener('change', e => app.setOptions({ invert: e.target.checked }));

  // поехали
  app.start().catch(e => alert('Камера недоступна: ' + e.message));
}
