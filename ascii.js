(() => {
  // ============== УТИЛИТЫ ==============
  const $ = s => document.querySelector(s);
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
    }
  };

  // Значения по умолчанию (как в v18)
  const state = {
    facing: 'user',
    widthChars: 160,
    contrast: 1.15,
    gamma: 1.20,
    fps: 30,
    color: '#8ac7ff',
    background: '#000000',
    charset: '@%#*+=-:. ',
    invert: true,
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
    // Инициализация контролов
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

    // Цвет применяем к самому ASCII и сцене
    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
  }

  // Пересчёт h и подготовка offscreen размера
  function updateGridSize() {
    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return { w: state.widthChars, h: 1 };

    // Коэффициент «плоскости» символа (ширина/высота). Для большинства моношрифтов ~0.5–0.6.
    // Мы измерим его на лету, чтобы не гадать.
    const ratio = measureCharAspect();
    const aspect = (v.videoHeight / v.videoWidth) / ratio;

    const w = Math.max(1, Math.round(state.widthChars));
    const h = Math.max(1, Math.round(w * aspect));

    off.width = w;
    off.height = h;
    return { w, h };
  }

  // Измерение фактического отношения W/H одного символа при текущем font-size
  function measureCharAspect() {
    // Пишем «М» в две строки, чтобы корректно поймать высоту строки с line-height:1ch
    measurePre.textContent = 'M\nM';
    measurePre.style.fontSize = app.out.style.fontSize || '16px';
    const rect = measurePre.getBoundingClientRect();
    const lineH = rect.height / 2;
    const chW = rect.width / 1; // ширина одной «M» (почти равно ширине символа)
    // отношение высоты к ширине одного символа:
    const charRatio = lineH / chW; // H/W
    // нам нужен W/H (ширина/высота) → обратное:
    return 1 / charRatio;
  }

  // Главный цикл
  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;

    const v = app.vid;
    if (!v.videoWidth || !v.videoHeight) return;

    const { w, h } = updateGridSize();

    // Рисуем видео кадр на offscreen
    ctx.drawImage(v, 0, 0, w, h);
    let data = ctx.getImageData(0, 0, w, h).data;

    // Генерация ASCII
    const chars = state.charset;
    const n = chars.length - 1;
    const inv = state.invert ? -1 : 1;
    const bias = state.invert ? 255 : 0;

    const gamma = state.gamma;
    const contrast = state.contrast;

    // Собираем строку
    let out = '';
    let i = 0;
    for (let y = 0; y < h; y++) {
      let line = '';
      for (let x = 0; x < w; x++, i += 4) {
        const r = data[i], g = data[i+1], b = data[i+2];
        // Y (перцептуальная яркость)
        let Y = 0.2126*r + 0.7152*g + 0.0722*b;

        // Контраст (нормируем к 0..1, затем снова в 0..255)
        let v01 = Y / 255;
        v01 = ((v01 - 0.5) * contrast) + 0.5;
        v01 = Math.min(1, Math.max(0, v01));

        // Гамма
        v01 = Math.pow(v01, 1 / gamma);

        // Инверсия
        const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
        const idx = Math.round((Yc / 255) * n);
        line += chars[idx];
      }
      out += line + '\n';
    }

    app.out.textContent = out;

    // Подогнать font-size, чтобы целиком влезло в .stage
    refitFont(w, h);
  }

  // Подбор font-size так, чтобы #out (w×h) влезал в .stage
  let refitLock = false;
  function refitFont(cols, rows) {
    if (refitLock) return;
    refitLock = true;

    // Берём текущий размер и меряем
    const stageW = app.stage.clientWidth;
    const stageH = app.stage.clientHeight;

    // Для оценки размеров строим «измеритель»
    measurePre.textContent = ('M'.repeat(cols) + '\n').repeat(rows);
    // Стартуем с текущего размера out (или 16px)
    const currentFS = parseFloat(getComputedStyle(app.out).fontSize) || 16;
    measurePre.style.fontSize = currentFS + 'px';

    // Сколько сейчас занимает?
    let mRect = measurePre.getBoundingClientRect();
    // Коэффициенты подгонки по сторонам
    const kW = stageW / mRect.width;
    const kH = stageH / mRect.height;
    // Окончательный масштаб
    const k = Math.min(kW, kH);

    // Новый размер шрифта
    const newFS = Math.max(6, Math.floor(currentFS * k));
    app.out.style.fontSize = newFS + 'px';

    // Финальная корректировка одной итерацией (чуть точнее)
    measurePre.style.fontSize = newFS + 'px';
    mRect = measurePre.getBoundingClientRect();
    const k2 = Math.min(stageW / mRect.width, stageH / mRect.height);
    const finalFS = Math.max(6, Math.floor(newFS * k2));
    app.out.style.fontSize = finalFS + 'px';

    refitLock = false;
  }

  // ============== СВЯЗКА UI ==============
  function bindUI() {
    // Показ/скрытие панели
    app.ui.toggle.addEventListener('click', () => {
      const hidden = app.ui.settings.hasAttribute('hidden');
      if (hidden) app.ui.settings.removeAttribute('hidden');
      else app.ui.settings.setAttribute('hidden', '');
      // Подгон после изменения доступной площади
      setTimeout(() => {
        const { w, h } = updateGridSize();
        refitFont(w, h);
      }, 0);
    });

    // Смена камеры
    app.ui.flip.addEventListener('click', async () => {
      state.facing = state.facing === 'user' ? 'environment' : 'user';
      const s = app.vid.srcObject;
      if (s) s.getTracks().forEach(t => t.stop());
      await startStream();
    });

    app.ui.width.addEventListener('input', e => {
      state.widthChars = +e.target.value;
      app.ui.widthVal.textContent = state.widthChars;
      // пересчёт сетки → refit сделаем в кадре
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

    // Запускаем цикл
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);

    // Первая подгонка
    const { w, h } = updateGridSize();
    refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
