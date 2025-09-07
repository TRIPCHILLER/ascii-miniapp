(() => {
  const $ = s => document.querySelector(s);
  const app = {
    vid:  $('#vid'),
    out:  $('#out'),
    stage:$('#stage'),
    ui: {
      flip:     $('#flip'),
      toggle:   $('#toggle'),
      fullscreen: $('#fullscreen'),
      settings: $('#settings'),
      width:    $('#width'),
      widthVal: $('#width_val'),
      contrast: $('#contrast'),
      contrastVal: $('#contrast_val'),
      gamma:    $('#gamma'),
      gammaVal: $('#gamma_val'),
      fps:      $('#fps'),
      fpsVal:   $('#fps_val'),
      charset:  $('#charset'),
      invert:   $('#invert'),
      palette:  $('#palette'),
      mirrorBtn:$('#mirrorBtn')
    }
  };

  // состояние
  const state = {
    facing: 'user',          // 'user' | 'environment'
    widthChars: 160,
    contrast: 1.15,
    gamma: 1.20,
    fps: 30,
    color: '#8ac7ff',
    background: '#000000',
    charset: '@%#*+=-:. ',
    invert: true,
    mirror: false            // ручной переключатель ⇋ (XOR с базовой логикой)
  };

  // палитры
  const palettes = {
    macintosh:   { bg:"#333319", fg:"#e5ffff" },
    zenith:      { bg:"#3f291e", fg:"#fdca55" },
    ibm8503:     { bg:"#2e3037", fg:"#ebe5ce" },
    commodore:   { bg:"#40318e", fg:"#88d7de" },
    obra:        { bg:"#000b40", fg:"#ebe1cd" },
    oldlcd:      { bg:"#000000", fg:"#ffffff" },
    ibm5151:     { bg:"#25342f", fg:"#01eb5f" },
    matrix:      { bg:"#000000", fg:"#00ff40" },
  };

  // offscreen
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d', { willReadFrequently: true });

  // измеритель метрик символа
  const measurePre = document.createElement('pre');
  measurePre.style.cssText = `
    position:absolute; left:-99999px; top:-99999px; margin:0;
    white-space:pre; line-height:1ch;
    font-family:"Cascadia Mono","Menlo","Consolas","Noto Sans Mono CJK JP","MS Gothic",monospace !important;
  `;
  document.body.appendChild(measurePre);

  // ===== камера =====
  async function startStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: state.facing }
      });
      app.vid.srcObject = stream;
      await app.vid.play();
    } catch (e) {
      console.error('getUserMedia error', e);
      alert('Камера недоступна');
    }
  }

  // ===== рендер =====
  let raf = null;
  let lastFrameTime = 0;

  function setUI() {
    app.ui.width.value = state.widthChars;
    app.ui.widthVal.textContent = state.widthChars;
    app.ui.contrast.value = state.contrast;
    app.ui.contrastVal.textContent = state.contrast.toFixed(2);
    app.ui.gamma.value = state.gamma;
    app.ui.gammaVal.textContent = state.gamma.toFixed(2);
    app.ui.fps.value = state.fps;
    app.ui.fpsVal.textContent = state.fps;
    app.ui.charset.value = state.charset;
    app.ui.invert.checked = state.invert;
    applyColors(state.background, state.color);
  }

  function applyColors(bg, fg){
    state.background = bg; state.color = fg;
    app.out.style.backgroundColor = bg;
    app.stage.style.backgroundColor = bg;
    app.out.style.color = fg;
  }

  function updateGridSize() {
    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return { w: state.widthChars, h: 1 };

    const ratio = measureCharAspect(); // W/H одного символа
    const aspect = (v.videoHeight / v.videoWidth) / ratio;

    const w = Math.max(1, Math.round(state.widthChars));
    const h = Math.max(1, Math.round(w * aspect));

    off.width = w;
    off.height = h;
    return { w, h };
  }

  function measureCharAspect() {
    measurePre.textContent = 'M\nM';
    measurePre.style.fontSize = app.out.style.fontSize || '16px';
    const rect = measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width; // ширина строки "M"
    const charRatio = lineH / chW;
    return 1 / charRatio; // W/H
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);

    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;

    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = updateGridSize();

    // Базовая логика: back-camera (environment) зеркалим ПО УМОЛЧАНИЮ.
    // Кнопка ⇋ делает XOR — меняет состояние и для front, и для back.
    let needMirror = (state.facing === 'environment');
    if (state.mirror) needMirror = !needMirror;

    if (needMirror) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(v, -w, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(v, 0, 0, w, h);
    }

    const data = ctx.getImageData(0, 0, w, h).data;

    const chars = state.charset;
    const n = chars.length - 1;
    const inv = state.invert ? -1 : 1;
    const bias = state.invert ? 255 : 0;
    const gamma = state.gamma;
    const contrast = state.contrast;

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

    app.out.textContent = out;
    refitFont(w, h);
  }

  // авто-подгонка размера шрифта
  let refitLock = false;
  function refitFont(cols, rows) {
    if (refitLock) return;
    refitLock = true;

    const stageW = app.stage.clientWidth;
    const stageH = app.stage.clientHeight;

    measurePre.textContent = ('M'.repeat(cols) + '\n').repeat(rows);
    const currentFS = parseFloat(getComputedStyle(app.out).fontSize) || 16;
    measurePre.style.fontSize = currentFS + 'px';

    let mRect = measurePre.getBoundingClientRect();
    const kW = stageW / mRect.width;
    const kH = stageH / mRect.height;
    const k = Math.min(kW, kH);

    const newFS = Math.max(6, Math.floor(currentFS * k));
    app.out.style.fontSize = newFS + 'px';

    measurePre.style.fontSize = newFS + 'px';
    mRect = measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / mRect.width, stageH / mRect.height);
    const finalFS = Math.max(6, Math.floor(newFS * k2));
    app.out.style.fontSize = finalFS + 'px';

    refitLock = false;
  }

  // ===== UI =====
  function bindUI() {
    app.ui.toggle.addEventListener('click', () => {
      const hidden = app.ui.settings.hasAttribute('hidden');
      if (hidden) app.ui.settings.removeAttribute('hidden');
      else app.ui.settings.setAttribute('hidden', '');
      setTimeout(() => {
        const { w, h } = updateGridSize();
        refitFont(w, h);
      }, 0);
    });

    app.ui.flip.addEventListener('click', async () => {
      state.facing = state.facing === 'user' ? 'environment' : 'user';
      // при смене камеры сбрасывать ручной переключатель не будем
      const s = app.vid.srcObject;
      if (s) s.getTracks().forEach(t => t.stop());
      await startStream();
    });

    // Классический fullscreen: скрываем UI и разворачиваем сцену
    app.ui.fullscreen.addEventListener('click', async () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        document.body.classList.add('fs');
        const el = document.documentElement; // на весь документ — надёжнее на мобилах
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else {
        document.body.classList.remove('fs');
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    });

    // держим CSS-состояние в sync, если юзер вышел ESC-ом
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) document.body.classList.remove('fs');
    });
    document.addEventListener('webkitfullscreenchange', () => {
      const active = document.webkitFullscreenElement != null;
      if (!active) document.body.classList.remove('fs');
    });

    app.ui.width.addEventListener('input', e => {
      state.widthChars = +e.target.value;
      app.ui.widthVal.textContent = state.widthChars;
    });

    app.ui.contrast.addEventListener('input', e => {
      state.contrast = +e.target.value;
      app.ui.contrastVal.textContent = state.contrast.toFixed(2);
    });

    app.ui.gamma.addEventListener('input', e => {
      state.gamma = +e.target.value;
      app.ui.gammaVal.textContent = state.gamma.toFixed(2);
    });

    app.ui.fps.addEventListener('input', e => {
      state.fps = +e.target.value;
      app.ui.fpsVal.textContent = state.fps;
    });

    app.ui.charset.addEventListener('change', e => {
      state.charset = e.target.value;
    });

    app.ui.invert.addEventListener('change', e => {
      state.invert = e.target.checked;
    });

    app.ui.palette.addEventListener('change', e => {
      const p = palettes[e.target.value];
      applyColors(p.bg, p.fg);
    });

    if (app.ui.mirrorBtn) {
      app.ui.mirrorBtn.addEventListener('click', () => {
        state.mirror = !state.mirror;  // XOR с базовым поведением
      });
    }

    new ResizeObserver(() => {
      const { w, h } = updateGridSize();
      refitFont(w, h);
    }).observe(app.stage);
  }

  async function init() {
    setUI();
    bindUI();
    await startStream();

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);

    const { w, h } = updateGridSize();
    refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
