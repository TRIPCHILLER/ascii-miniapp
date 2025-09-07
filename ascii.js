(() => {
  // ============== УТИЛИТЫ ==============
  const $ = s => document.querySelector(s);
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);

  const app = {
    vid:  $('#vid'),
    out:  $('#out'),
    stage:$('#stage'),
    ui: {
      flip:     $('#flip'),
      toggle:   $('#toggle'),
      settings: $('#settings'),
      width:    $('#width'),
      widthVal: $('#width_val'),
      contrast: $('#contrast'),
      contrastVal: $('#contrast_val'),
      gamma:    $('#gamma'),
      gammaVal: $('#gamma_val'),
      fps:      $('#fps'),
      fpsVal:   $('#fps_val'),
      fg:       $('#fg'),
      bg:       $('#bg'),
      charset:  $('#charset'),
      invert:   $('#invert'),
      fs:       $('#fs'),
    }
  };

  // Значения по умолчанию
  // ВАЖНО: mirror = true означает "НЕ-зеркальная картинка" (мы инвертируем стандартный селфи-вид).
  // Это даёт "оригинальное" восприятие, как ты просил — стартуем сразу с правильным горизонтальным отражением.
  const state = {
    facing: 'user',         // какая камера для мобилок
    mirror: true,           // режим рисования: true = отразить по X (НЕ-зеркало)
    widthChars: 160,
    contrast: 1.15,
    gamma: 1.20,
    fps: 30,
    color: '#8ac7ff',
    background: '#000000',
    charset: '@%#*+=-:. ',
    invert: true,
    isFullscreen: false,    // наш флаг
  };

  // Вспомогательные канвасы
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d', { willReadFrequently: true });

  // Для авто-подгонки шрифта
  const measurePre = document.createElement('pre');
  measurePre.style.cssText = `
    position:absolute; left:-99999px; top:-99999px; margin:0;
    white-space:pre; line-height:1ch; font-family: ui-monospace, Menlo, Consolas, "Cascadia Mono", monospace;
  `;
  document.body.appendChild(measurePre);

  // ============== КАМЕРА ==============
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

  // ============== РЕНДЕРИНГ ==============
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

    app.ui.fg.value = state.color;
    app.ui.bg.value = state.background;

    app.ui.charset.value = state.charset;
    app.ui.invert.checked = state.invert;

    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
  }

  // Пересчёт h и подготовка offscreen размера
  function updateGridSize() {
    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return { w: state.widthChars, h: 1 };

    const ratio = measureCharAspect();
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
    const chW = rect.width / 1;
    const charRatio = lineH / chW; // H/W
    return 1 / charRatio;          // W/H
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;

    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = updateGridSize();

    // Подготовка трансформа для зеркала
    // mirror = true ⇒ рисуем с scaleX(-1), чтобы получить НЕ-зеркальную картинку
    ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? w : 0, 0);
    ctx.drawImage(v, 0, 0, w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = ctx.getImageData(0, 0, w, h).data;

    // Генерация ASCII
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

  // Подбор font-size
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

  // ============== FULLSCREEN ==============
  let exitBtn = null;

  function inNativeFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  async function requestFull() {
    try {
      if (app.stage.requestFullscreen) await app.stage.requestFullscreen();
      else if (app.stage.webkitRequestFullscreen) await app.stage.webkitRequestFullscreen();
      state.isFullscreen = true;
    } catch(e) {
      // игнорируем — пойдём фолбэком
    }
  }

  async function lockLandscapeIfPossible() {
    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape');
      } else {
        // iOS / старые браузеры — фолбэк: дадим хотя бы чистый экран
        document.body.classList.add('body-fullscreen');
      }
    } catch(e) {
      // если запретили — фолбэк
      document.body.classList.add('body-fullscreen');
    }
  }

  function createExitButton() {
    if (exitBtn) return;
    exitBtn = document.createElement('button');
    exitBtn.className = 'fs-exit';
    exitBtn.type = 'button';
    exitBtn.addEventListener('click', exitFullscreen);
    document.body.appendChild(exitBtn);
  }

  async function enterFullscreen() {
    if (isMobile) {
      // мобилки: fullscreen + ландшафт
      await requestFull();
      await lockLandscapeIfPossible();
    } else {
      // десктоп: чистый fullscreen
      await requestFull();
    }
    createExitButton();
  }

  async function exitFullscreen() {
    try {
      if (inNativeFullscreen()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      }
    } catch(e) {}
    document.body.classList.remove('body-fullscreen');
    state.isFullscreen = false;

    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch(e) {}
    }
    if (exitBtn) { exitBtn.remove(); exitBtn = null; }
  }

  document.addEventListener('fullscreenchange', () => {
    const active = inNativeFullscreen();
    state.isFullscreen = active;
    if (!active) {
      // вышли из nat FS — подчистим фолбэк
      document.body.classList.remove('body-fullscreen');
      if (exitBtn) { exitBtn.remove(); exitBtn = null; }
    }
  });

  // ============== СВЯЗКА UI ==============
  function bindUI() {
    // Показ/скрытие панели
    app.ui.toggle.addEventListener('click', () => {
      const hidden = app.ui.settings.hasAttribute('hidden');
      if (hidden) app.ui.settings.removeAttribute('hidden');
      else app.ui.settings.setAttribute('hidden', '');
      setTimeout(() => {
        const { w, h } = updateGridSize();
        refitFont(w, h);
      }, 0);
    });

    // Кнопка "Фронт/Тыл"
    app.ui.flip.addEventListener('click', async () => {
  if (isMobile) {
    // Мобилка: реально меняем камеру между фронталкой и основной
    state.facing = (state.facing === 'user') ? 'environment' : 'user';

    // Останавливаем старые треки и запускаем новый стрим
    const s = app.vid.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
    await startStream();

    // ВАЖНО: зеркалим ТОЛЬКО основную камеру
    state.mirror = (state.facing === 'environment'); // true для основной, false для фронталки
  } else {
    // Десктоп: кнопка «развернуть» просто включает/выключает зеркалирование
    state.mirror = !state.mirror;
  }
});

    // Полноэкранный режим
    if (app.ui.fs) {
      app.ui.fs.addEventListener('click', () => {
        if (!state.isFullscreen) enterFullscreen();
        else exitFullscreen();
      });
    }

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

    app.ui.fg.addEventListener('input', e => {
      state.color = e.target.value;
      app.out.style.color = state.color;
    });
    app.ui.bg.addEventListener('input', e => {
      state.background = e.target.value;
      app.out.style.backgroundColor = state.background;
      app.stage.style.backgroundColor = state.background;
    });

    app.ui.charset.addEventListener('change', e => {
      state.charset = e.target.value;
    });
    app.ui.invert.addEventListener('change', e => {
      state.invert = e.target.checked;
    });

    // Подгон при изменении окна/ориентации
    new ResizeObserver(() => {
      const { w, h } = updateGridSize();
      refitFont(w, h);
    }).observe(app.stage);
  }

  // ============== СТАРТ ==============
  async function init() {
    setUI();
    bindUI();
    await startStream();

    // Стартуем сразу с НЕ-зеркального вида (нормальная ориентация по горизонтали)
    state.mirror = true;

    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);

    const { w, h } = updateGridSize();
    refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

