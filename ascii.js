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
      customCharset: $('#charset_custom'),
      invert:   $('#invert'),
      fs:       $('#fs'),
      style:    $('#stylePreset'),
    }
  };

  // ==== FONT STACKS (добавлено) ====
const FONT_STACK_MAIN = `"BetterVCR",monospace`;

const FONT_STACK_CJK =
  // реальные моно/приближённые моно CJK + безопасные фолбэки
  `"Cica Web","MS Gothic","IPAGothic","Osaka-Mono","VL Gothic",monospace`;
// ==== /FONT STACKS ====
    // Значения по умолчанию
  const state = {
    facing: 'user',         // какая камера для мобилок
    mirror: true,           // режим рисования: true = отразить по X (НЕ-зеркало)
    widthChars: isMobile ? 75 : 150,
    contrast: 2.00,
    gamma: 0.90,
    fps: 60,
    color: '#8ac7ff',
    background: '#000000',
    charset: '@%#*+=-:. ',
    invert: false,
    isFullscreen: false,    // наш флаг
  };
  let forcedAspect = null;
  // === helpers ===
function isFullscreenLike() {
  return state.isFullscreen
      || document.body.classList.contains('body-fullscreen')
      || !!(document.fullscreenElement || document.webkitFullscreenElement);
}
  // ===== Стили (палитры) =====
  // Порядок: [тёмный, светлый]; тёмный идёт на ФОН, светлый на ТЕКСТ
  const PRESETS = [
    { id:'oldlcd',     name:'OLD LCD',           colors:['#000000', '#ffffff'] },
    { id:'macintosh',  name:'MACINTOSH',         colors:['#333319', '#e5ffff'] },
    { id:'macpaint',   name:'MAC PAINT',         colors:['#051b2c', '#8bc8fe'] },
    { id:'zenith',     name:'ZENITH ZVM 1240',   colors:['#3f291e', '#fdca55'] },
    { id:'obra',       name:'OBRA DINN',         colors:['#000b40', '#ebe1cd'] },
    { id:'ibm8503',    name:'IBM 8503',          colors:['#2e3037', '#ebe5ce'] },
    { id:'commodore',  name:'COMMODORE 1084',    colors:['#40318e', '#88d7de'] },
    { id:'ibm5151',    name:'IBM 5151',          colors:['#25342f', '#01eb5f'] },
    { id:'matrix',     name:'MATRIX',            colors:['#000000', '#00ff40'] },
    { id:'casio',      name:'CASIO',             colors:['#000000', '#83b07e'] },
    { id:'funkyjam',   name:'FUNKY JAM',         colors:['#920244', '#fec28c'] },
    { id:'cornsole',   name:'CORNSOLE',          colors:['#6495ed', '#fff8dc'] },
    { id:'postapoc',   name:'POSTAPOC SUNSET',   colors:['#1d0f44', '#f44e38'] },
    { id:'laughcry',   name:'POP LAUGH CRY',     colors:['#452f47', '#d7bcad'] },
    { id:'flowers',    name:'FLOWERS AND ASBESTOS', colors:['#c62b69', '#edf4ff'] },
    { id:'pepper1bit', name:'1BIT PEPPER',       colors:['#100101', '#ebb5b5'] },
    { id:'shapebit',   name:'SHAPE BIT',         colors:['#200955', '#ff0055'] },
    { id:'chasing',    name:'CHASING LIGHT',     colors:['#000000', '#ffff02'] },
    { id:'monsterbit', name:'MONSTER BIT',       colors:['#321632', '#cde9cd'] },
    { id:'gatoroboto', name:'GATO ROBOTO',       colors:['#2b0000', '#cc0e13'] },
    { id:'paperback',  name:'PAPERBACK',         colors:['#382b26', '#b8c2b9'] },
  ];
  const CUSTOM_LABEL = 'ПОЛЬЗОВАТЕЛЬСКИЙ';
  const norm = (hex)=> (hex||'').toLowerCase().replace('#','');
  const toHex = v => v && v[0]==='#' ? v : ('#'+v);
  const lum = (hex)=>{ // относительная яркость 0..1
    const h = norm(hex);
    if (h.length<6) return 0;
    const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
    const a=[r,g,b].map(c=> (c<=0.03928)? c/12.92 : Math.pow((c+0.055)/1.055,2.4));
    return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2];
  };
  // разложить пару на bg/text (тёмный/светлый)
  function splitToBgText(pair){
    const [c1,c2]=pair; return (lum(c1)<=lum(c2))? {bg:c1,text:c2}:{bg:c2,text:c1};
  }
  function detectPreset(textHex, bgHex){
    const t=norm(textHex), b=norm(bgHex);
    for(const p of PRESETS){
      const {bg,text}=splitToBgText(p.colors);
      if(norm(text)===t && norm(bg)===b) return p.id;
    }
    return 'custom';
  }
  function fillStyleSelect(){
    if(!app.ui.style) return;
    app.ui.style.innerHTML='';
    const opt = new Option(CUSTOM_LABEL,'custom'); app.ui.style.append(opt);
    PRESETS.forEach(p=> app.ui.style.append(new Option(p.name,p.id)));
  }
  function applyPreset(id){
    if(!app.ui.style) return;
    if(id==='custom'){ app.ui.style.value='custom'; return; }
    const p = PRESETS.find(x=>x.id===id); if(!p){ app.ui.style.value='custom'; return; }
    const {bg,text}=splitToBgText(p.colors);
    // обновим state и UI как при ручном выборе цвета
    state.color = toHex(text); state.background = toHex(bg);
    app.ui.fg.value = state.color; app.ui.bg.value = state.background;
    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
    app.ui.style.value = id;
  }

  // Вспомогательные канвасы
  const off = document.createElement('canvas');
  const ctx = off.getContext('2d', { willReadFrequently: true });

  // ==== measurePre + applyFontStack (замена) ====
const measurePre = document.createElement('pre');
measurePre.style.cssText = `
  position:absolute; left:-99999px; top:-99999px; margin:0;
  white-space:pre;
  line-height:1;
  letter-spacing:0;
  font-variant-ligatures:none;
  font-weight:700;
  -webkit-font-smoothing:none;
`;

// единая функция — применяем стек и к выводу, и к измерителю
function applyFontStack(stack) {
  if (app.out) {
    app.out.style.fontFamily = stack;
    app.out.style.fontWeight = '700';
    app.out.style.webkitFontSmoothing = 'none';
  }
  measurePre.style.fontFamily = stack;
  measurePre.style.fontWeight = '700';
}


document.body.appendChild(measurePre);
// по умолчанию — основной моно стек
applyFontStack(FONT_STACK_MAIN);
// ==== /measurePre + applyFontStack ====
  // === измеряем "плотность" символа ===
function measureCharDensity(ch) {
  const size = 32; // канвас 32x32
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  const c = cvs.getContext('2d');
  c.fillStyle = '#000';
  c.fillRect(0, 0, size, size);
  c.fillStyle = '#fff';
  const outFF = getComputedStyle(app.out).fontFamily || 'monospace';
  c.font = `${size}px ${outFF}`;
  c.textBaseline = 'top';
  c.fillText(ch, 0, 0);
  const data = c.getImageData(0, 0, size, size).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i] + data[i+1] + data[i+2];
  }
  return sum / (size * size * 3); // 0..255
}

// === авто-сортировка набора ===
function autoSortCharset(str) {
  const chars = Array.from(new Set(str.split(''))); // уникальные символы
  const withDensity = chars.map(ch => ({ ch, d: measureCharDensity(ch) }));
  withDensity.sort((a,b) => a.d - b.d); // от тёмных к светлым
  return withDensity.map(x => x.ch).join('');
}
  // ---- измерение пропорции символа (W/H) ----
function measureCharAspect() {
  if (typeof forcedAspect === 'number' && isFinite(forcedAspect) && forcedAspect > 0) {
    return forcedAspect;
  }
  const fs = parseFloat(getComputedStyle(app.out).fontSize) || 16;
  measurePre.style.fontSize = fs + 'px';
  // одна большая буква, чтобы померить ширину/высоту глифа
  measurePre.textContent = 'M';
  const r = measurePre.getBoundingClientRect();

  // W/H; подстрахуемся от нулей
  const w = Math.max(1, r.width);
  const h = Math.max(1, r.height);
  return w / h;
}

  // ============== КАМЕРА ==============
  async function startStream() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: state.facing }
      });
      app.vid.srcObject = stream;
      await app.vid.play();
      updateMirrorForFacing();
    } catch (e) {
      console.error('getUserMedia error', e);
      alert('Камера недоступна');
    }
  }

  // ============== РЕНДЕРИНГ ==============
  let raf = null;
  let lastFrameTime = 0;

  function setUI() {
    // разные пределы для мобилы и ПК
const WIDTH_MIN   = isMobile ? 50  : 100;
const WIDTH_MAX   = isMobile ? 100 : 175;
const WIDTH_START = isMobile ? 75  : 150;

    // применяем лимиты и старт
    app.ui.width.min  = WIDTH_MIN;
    app.ui.width.max  = WIDTH_MAX;

    // синхронизируем state и UI на старте
    state.widthChars = WIDTH_START;
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
const lbl = document.getElementById('invert_label');
if (lbl) lbl.textContent = state.invert ? 'ИНВЕРСИЯ: ВКЛ' : 'ИНВЕРСИЯ: ВЫКЛ';

    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;

    // обновим селект стиля
    fillStyleSelect();
    const matched = detectPreset(state.color, state.background);
    if (app.ui.style) app.ui.style.value = matched === 'custom' ? 'custom' : matched;
  }

  // Пересчёт h и подготовка offscreen размера
  function updateGridSize() {
  const v = app.vid;
  if (!v.videoWidth || !v.videoHeight) return { w: state.widthChars, h: 1 };

  const isFsLike = isFullscreenLike();

  // соотношение символа (W/H) → используем для правильного отношения столбцов/строк
  const ratioCharWOverH = measureCharAspect();   // W/H
  // нам нужна H/W, поэтому инверсия ниже в формулах

  // Базовый аспект источника как H/W:
  let sourceHOverW = v.videoHeight / v.videoWidth;

// В FS: ТОЛЬКО на мобиле принудительно 9:16 (портрет).
// На ПК оставляем нативное соотношение источника.
if (isFsLike && isMobile) {
  sourceHOverW = 16/9;
}

  const w = Math.max(1, Math.round(state.widthChars));
  const h = Math.max(1, Math.round(w * (sourceHOverW / (1 / ratioCharWOverH))));

  off.width = w;
  off.height = h;
  return { w, h };
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
// --- FULLSCREEN cover-crop под 16:9 ---
const isFsLike = isFullscreenLike();
const vw = v.videoWidth;
const vh = v.videoHeight;

let sx = 0, sy = 0, sw = vw, sh = vh;

// В FS кропим ТОЛЬКО на мобиле под вертикаль 9:16.
// На ПК в FS — без кропа (letterbox/pillarbox по contain).
if (isFsLike && isMobile) {
  const targetWH = 9/16; // W/H
  const srcWH = vw / vh;

  if (srcWH > targetWH) {
    // Источник шире 9:16 → режем бока
    sw = Math.round(vh * targetWH);
    sx = Math.round((vw - sw) / 2);
  } else if (srcWH < targetWH) {
    // Источник уже 9:16 → режем сверху/снизу
    sh = Math.round(vw / targetWH);
    sy = Math.round((vh - sh) / 2);
  }
}

// Подготовка трансформа для зеркала (как было)
ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? w : 0, 0);

// Рисуем уже с кропом, масштабируем на целевую сетку w×h
ctx.drawImage(v, sx, sy, sw, sh, 0, 0, w, h);

// Сброс трансформа
ctx.setTransform(1, 0, 0, 1, 0, 0);

    const data = ctx.getImageData(0, 0, w, h).data;
// Генерация ASCII (юникод-безопасно + поддержка пустого набора)
const chars = Array.from(state.charset || '');
const n = chars.length - 1;

if (n < 0) {
  // набор пустой → очищаем экран и выходим из функции loop
  app.out.textContent = '';
  refitFont(1, 1);
  return;   // ← важно, именно return из loop!
}

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

    // яркость → контраст → гамма
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
    const fs = isFullscreenLike();
    const k  = fs
    ? (isMobile ? Math.max(kW, kH) : Math.min(kW, kH)) // FS: мобилки cover, десктоп contain
    : Math.min(kW, kH);                                 // вне FS всегда contain


    const newFS = Math.max(6, Math.floor(currentFS * k));
    app.out.style.fontSize = newFS + 'px';

    measurePre.style.fontSize = newFS + 'px';
    mRect = measurePre.getBoundingClientRect();
    const k2 = fs
    ? (isMobile
    ? Math.max(stageW / mRect.width, stageH / mRect.height) // мобилки cover
    : Math.min(stageW / mRect.width, stageH / mRect.height) // десктоп contain (без перезума)
    )
    : Math.min(stageW / mRect.width, stageH / mRect.height);

    const finalFS = Math.max(6, Math.floor(newFS * k2));
    app.out.style.fontSize = finalFS + 'px';

    refitLock = false;
  }
  // === Вписывание ASCII-блока внутрь stage ===
  function fitAsciiToViewport(){
    const out = app.out;
    const stage = app.stage;
    if (!out || !stage) return;

    // сброс масштаба
    out.style.transform = 'translate(-50%, -50%) scale(1)';

    // реальные размеры ascii-блока
    const w = out.scrollWidth;
    const h = out.scrollHeight;

    // доступные размеры
    const W = stage.clientWidth;
    const H = stage.clientHeight;

    // коэффициент "contain"
    const S = Math.min(W / w, H / h);

    // применяем
    out.style.transform = `translate(-50%, -50%) scale(${S})`;
  }

  // ============== FULLSCREEN (tap-to-exit) ==============
  // Кросс-браузерные хелперы:
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

  // >>> Новая логика: выход по ТАПУ на сцену
  let fsTapHandler = null;
  let fsEnteredAt = 0;

  function enableTapToExit() {
    disableTapToExit(); // защита от дубля

    fsTapHandler = (e) => {
      // защита от случайного мгновенного выхода тем же тапом
      if (Date.now() - fsEnteredAt < 300) return;

      // игнорим явные интерактивные элементы (если будут поверх)
      const t = e.target;
      const tag = (t.tagName || '').toLowerCase();
      if (['button','a','input','select','textarea','label'].includes(tag)) return;

      exitFullscreen();
    };

    app.stage.addEventListener('click', fsTapHandler, { passive: true });
    app.stage.addEventListener('touchend', fsTapHandler, { passive: true });
  }

  function disableTapToExit() {
    if (!fsTapHandler) return;
    app.stage.removeEventListener('click', fsTapHandler);
    app.stage.removeEventListener('touchend', fsTapHandler);
    fsTapHandler = null;
  }

  async function enterFullscreen() {
    fsEnteredAt = Date.now();

    if (isMobile) {
      // мобилки: fullscreen + ландшафт
      await requestFull();
      await lockLandscapeIfPossible();
    } else {
      // десктоп: чистый fullscreen
      await requestFull();
    }

    // включаем выход по тапу
    enableTapToExit();
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

    // снимаем блокировку ориентации, если была
    if (screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch(e) {}
    }

    // выключаем обработчик тапа
    disableTapToExit();
  }

  // Системный выход из nat Fullscreen (жест «назад» и т.п.)
  document.addEventListener('fullscreenchange', () => {
    const active = inNativeFullscreen();
    state.isFullscreen = active;
    if (!active) {
      document.body.classList.remove('body-fullscreen');
      disableTapToExit();
    }
  });
function updateMirrorForFacing() {
  // фронталка = зеркалим, тыловая = не зеркалим
  state.mirror = (state.facing === 'user');
}
    // --- DOUBLE-TAP / DOUBLE-CLICK: вход в fullscreen ---
  let lastTapTs = 0;
  let singleTapTimer = null;
  const DOUBLE_TAP_WINDOW = 300; // мс
  const SINGLE_TAP_DELAY  = 250; // мс — чтобы одиночный не «съедал» двойной

  function onStagePointerUp(e) {
    const now = Date.now();
    const isDouble = now - lastTapTs < DOUBLE_TAP_WINDOW;
    lastTapTs = now;

    // На iOS отключаем системный дабл-тап-зум
    if (e.pointerType === 'touch') e.preventDefault?.();

    clearTimeout(singleTapTimer);

    if (!state.isFullscreen) {
      if (isDouble) {
        // Двойной тап -> войти в fullscreen
        enterFullscreen();
      } else {
        // Одиночный тап в НЕ fullscreen игнорируем (ничего не делаем)
        // (выход по одиночному уже реализован в enableTapToExit() и активен только в fullscreen)
      }
    } else {
      // Мы уже в fullscreen: одиночный тап закрывает (эта логика уже есть в fsTapHandler),
      // но перестрахуемся и ничего тут не делаем, чтобы не конфликтовать.
    }
  }

  function attachDoubleTapEnter() {
    if (!app.stage) return;
    // Универсально: pointerup покроет мышь/тач/стилус
    app.stage.addEventListener('pointerup', onStagePointerUp, { passive: true });

    // Для десктопа добавим приятный бонус — двойной клик мышью
    app.stage.addEventListener('dblclick', (e) => {
      e.preventDefault?.();
      if (!state.isFullscreen) enterFullscreen();
    });
  }
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
        fitAsciiToViewport();
      }, 0);
    });

    // Кнопка "Фронт/Тыл"
app.ui.flip.addEventListener('click', async () => {
  if (isMobile) {
    state.facing = (state.facing === 'user') ? 'environment' : 'user';
    const s = app.vid.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
    await startStream(); // внутри вызовется updateMirrorForFacing()
  } else {
    state.mirror = !state.mirror; // на ПК по-прежнему просто зеркалим
  }
});

    // Полноэкранный режим (вход по кнопке, выход — ТОЛЬКО по ТАПУ на сцену)
    if (app.ui.fs) {
      app.ui.fs.addEventListener('click', () => {
        if (!state.isFullscreen) enterFullscreen();
        else exitFullscreen(); // на десктопе оставим тож возможность выходить кнопкой
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

    if(app.ui.style){ app.ui.style.addEventListener('change', e => { applyPreset(e.target.value); }); }

    app.ui.fg.addEventListener('input', e => {
      state.color = e.target.value;
      app.out.style.color = state.color;
      if(app.ui.style){ const m = detectPreset(state.color, state.background); app.ui.style.value = (m==='custom'?'custom':m); }
    });
    app.ui.bg.addEventListener('input', e => {
      state.background = e.target.value;
      app.out.style.backgroundColor = state.background;
      app.stage.style.backgroundColor = state.background;
      if(app.ui.style){ const m = detectPreset(state.color, state.background); app.ui.style.value = (m==='custom'?'custom':m); }
    });

app.ui.charset.addEventListener('change', e => {
  const val = e.target.value;

  if (val === 'CUSTOM') {
    app.ui.customCharset.style.display = 'inline-block';
    applyFontStack(FONT_STACK_MAIN); // кастом всегда в MAIN
    state.charset = autoSortCharset(app.ui.customCharset.value || '');
    return;
  }

  app.ui.customCharset.style.display = 'none';

  // индексы из твоего index.html: 4 = カタカナ, 5 = ひらがな
  const idx = app.ui.charset.selectedIndex;
  const isCJK = (idx === 4 || idx === 5);

  if (isCJK) {
    applyFontStack(FONT_STACK_CJK); // CJK-моно стек
    state.charset = val;            // без сортировки!
    forcedAspect = 1.0;  
  } else {
    applyFontStack(FONT_STACK_MAIN);      // обратно на MAIN
    state.charset = autoSortCharset(val); // сортируем набор
    forcedAspect = null;                  // <<< вернулись к авто-замеру
  }
});

// реагируем на ввод своих символов
app.ui.customCharset.addEventListener('input', e => {
  state.charset = autoSortCharset(e.target.value || '');
});
    
// --- Синхронизация видимости при загрузке и первом показе панели ---
function syncCustomField() {
  const isCustom = app.ui.charset.value === 'CUSTOM';
  app.ui.customCharset.style.display = isCustom ? 'inline-block' : 'none';
}
syncCustomField(); // дергаем один раз при биндинге

app.ui.invert.addEventListener('change', e => {
  state.invert = e.target.checked;
  const lbl = document.getElementById('invert_label');
  if (lbl) {
    lbl.textContent = state.invert ? 'ИНВЕРСИЯ: ВКЛ' : 'ИНВЕРСИЯ: ВЫКЛ';
  }
});
    // Подгон при изменении окна/ориентации
    new ResizeObserver(() => {
      const { w, h } = updateGridSize();
      refitFont(w, h);
    }).observe(app.stage);
  }

  // ============== СТАРТ ==============
  async function init() {
    fillStyleSelect();
setUI();

// 1) Жёстко фиксируем отсутствие инверсии до первого кадра
state.invert = false;
if (app.ui.invert) app.ui.invert.checked = false;
{
  const lbl = document.getElementById('invert_label');
  if (lbl) lbl.textContent = 'ИНВЕРСИЯ: ВЫКЛ';
}

bindUI();
attachDoubleTapEnter();

// 2) Принудительно применяем шрифтовой стек под стартовый режим символов,
//    чтобы исключить "ложный" первый кадр с некорректным стеком.
if (app.ui.charset) {
  // дёрнем обработчик, он сам решит: CJK → CJK стек без сортировки,
  // не CJK → основной стек + авто-сорт.
  app.ui.charset.dispatchEvent(new Event('change', { bubbles: true }));
}

await startStream();

// 3) Только теперь стартуем цикл рендера
if (raf) cancelAnimationFrame(raf);
raf = requestAnimationFrame(loop);

const { w, h } = updateGridSize();
refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();










