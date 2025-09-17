(() => {
  // ============== УТИЛИТЫ ==============
  const $ = s => document.querySelector(s);
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
// ==== TEMP HUD ====
const hud = document.createElement('div');
hud.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:99999;background:rgba(0,0,0,.6);color:#0f0;font:12px/1.2 monospace;padding:6px 8px;border:1px solid #0f0;border-radius:6px;max-width:75vw;pointer-events:none;';
hud.textContent = 'boot…';
document.body.appendChild(hud);
window.addEventListener('error', e => { hud.textContent = 'JS ERROR: ' + (e.error?.message || e.message); });
function hudSet(txt){ hud.textContent = txt; }
// ==== /HUD ====

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
    modePhoto:   $('#modePhoto'),
    modeLive:    $('#modeLive'),
    modeVideo:   $('#modeVideo'),
    filePhoto:   $('#filePhoto'),
    fileVideo:   $('#fileVideo'),
    save:        $('#save'),
    placeholder: $('#placeholder'),
    render:      $('#render'),
    }
  };

  // ==== FONT STACKS (добавлено) ====
const FONT_STACK_MAIN = `"BetterVCR",monospace`;

const FONT_STACK_CJK =
  // реальные моно/приближённые моно CJK + безопасные фолбэки
  `"MS Gothic",monospace`;
// ==== /FONT STACKS ====
    // Значения по умолчанию
  // ===== Ordered dithering (8×8 Bayer) =====
const BAYER8 = [
   0,48,12,60,  3,51,15,63,
  32,16,44,28, 35,19,47,31,
   8,56, 4,52, 11,59, 7,55,
  40,24,36,20, 43,27,39,23,
   2,50,14,62,  1,49,13,61,
  34,18,46,30, 33,17,45,29,
  10,58, 6,54,  9,57, 5,53,
  42,26,38,22, 41,25,37,21
];
let DITHER_ENABLED = true;
// =========================================
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
    blackPoint: 0.06,   // 0..1 — общий дефолт
    whitePoint: 0.98,   // 0..1 — общий дефолт
    mode: 'live',           // 'live' | 'photo' | 'video'
    imageEl: null,          // <img> для режима ФОТО
    isRecording: false,     // запись видео (экспорт)
    recorder: null,
    recordChunks: [],
    lastGrid: { w:0, h:0 }, // запоминаем сетку для экспорта
  };
  function updateHud(extra=''){
  const v = app.vid;
  const src = (state.mode==='photo' && state.imageEl) ? 'img'
           : (v?.srcObject ? 'live' : (v?.src ? 'file' : 'none'));
  const vw = v?.videoWidth|0, vh = v?.videoHeight|0, rs = v?.readyState|0;
  hudSet(`mode:${state.mode} src:${src} vw:${vw} vh:${vh} rs:${rs} rec:${state.isRecording?'1':'0'} ${extra}`);
}
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
function applyFontStack(stack, weight = '700', eastAsianFullWidth = false) {
  if (app.out) {
    app.out.style.fontFamily = stack;
    app.out.style.fontWeight = weight;
    app.out.style.fontSynthesis = 'none';        // не синтезировать bold/italic
    app.out.style.fontKerning = 'none';
    app.out.style.fontVariantLigatures = 'none';
    app.out.style.fontVariantEastAsian = eastAsianFullWidth ? 'full-width' : 'normal';
    app.out.style.letterSpacing = '0';
    app.out.style.webkitFontSmoothing = 'none';
  }
  measurePre.style.fontFamily = stack;
  measurePre.style.fontWeight = weight;
  measurePre.style.fontSynthesis = 'none';
  measurePre.style.fontKerning = 'none';
  measurePre.style.fontVariantLigatures = 'none';
  measurePre.style.fontVariantEastAsian = eastAsianFullWidth ? 'full-width' : 'normal';
}

document.body.appendChild(measurePre);
// по умолчанию — основной моно стек
applyFontStack(FONT_STACK_MAIN, '700', false);
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
  // === Bin-reduce (умное сужение до K ступеней) ===
let K_BINS = 10;

// быстрее и плавнее
let PALETTE_INTERVAL = 320;   // мс — темп смены похожих символов
const CHANGES_PER_TICK = 1;   // меняем ровно 1 бин за тик
  
let ROTATE_PALETTE = true; 

// фиксируем первые N самых тёмных (по измеренной плотности)
let DARK_LOCK_COUNT = 3;    // ← можно менять на 2/3/4 по вкусу

let bins = [];
let palette = [];
let paletteTimer = null;

// массив фиксированных символов, привязанных к индексам бинов:
// fixedByBin[0] = (самый тёмный символ), fixedByBin[1] = (второй по тёмности), ...
let fixedByBin = new Array(K_BINS).fill(null);

function computeDensities(charsStr) {
  const seen = new Set();
  const arr = [];
  for (const ch of Array.from(charsStr || '')) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    arr.push({ ch, d: measureCharDensity(ch) });
  }
  // от тёмных к светлым
  arr.sort((a, b) => a.d - b.d);
  return arr;
}

function buildBinsFromChars(charsStr, K = K_BINS) {
  const dens = computeDensities(charsStr);
  if (dens.length === 0) return Array.from({ length: K }, () => []);
  const min = dens[0].d;
  const max = dens[dens.length - 1].d;
  const span = Math.max(1e-6, (max - min));
  const bins = Array.from({ length: K }, () => []);
  for (const it of dens) {
    let bi = Math.floor(((it.d - min) / span) * K);
    if (bi >= K) bi = K - 1;
    if (bi < 0) bi = 0;
    bins[bi].push(it.ch);
  }
  // если какой-то бин пуст — подтягиваем ближайший
  for (let i = 0; i < K; i++) {
    if (bins[i].length) continue;
    let left = i - 1, right = i + 1, picked = null;
    while (left >= 0 || right < K) {
      if (left >= 0 && bins[left].length) { picked = bins[left]; break; }
      if (right < K && bins[right].length) { picked = bins[right]; break; }
      left--; right++;
    }
    bins[i] = picked ? picked.slice(0, Math.min(3, picked.length)) : [' '];
  }
  return bins;
}

function pickPalette(_bins, fixedByBinArr = []) {
  const fixedChars = fixedByBinArr.filter(Boolean);
  return _bins.map((bucket, i) => {
    // если для этого бина задан фикс — используем его
    if (fixedByBinArr[i]) return fixedByBinArr[i];
    if (!bucket || bucket.length === 0) return ' ';
    // из остальных избегаем фиксированных символов
    const pool = bucket.filter(ch => !fixedChars.includes(ch));
    const src = pool.length ? pool : bucket;
    return src[Math.floor(Math.random() * src.length)];
  });
}

function updateBinsForCurrentCharset() {
  // включаем «умное сужение» только для длинных наборов
  if (state.charset && state.charset.length > K_BINS) {
    // 1) тёмные → светлые, без дублей
    const densSorted = computeDensities(state.charset); // [{ch, d}, ...] отсортированы
    const lockN = Math.min(DARK_LOCK_COUNT, K_BINS, densSorted.length);

    // 2) фиксируем первые N самых тёмных символов по индексам биновой шкалы
    fixedByBin = new Array(K_BINS).fill(null);
    for (let i = 0; i < lockN; i++) {
      fixedByBin[i] = densSorted[i].ch; // i=0 — самый тёмный символ, и т.д.
    }
// Если набор содержит CJK — принудительно фиксируем самый тёмный символ как fullwidth space
try {
  const hasCJK = CJK_RE.test(state.charset || '');
  if (hasCJK) {
  const FW_SPACE = pickDarkGlyph();

    // Убедимся, что он в наборе (на случай ручных изменений)
    if (!(state.charset || '').includes(FW_SPACE)) {
      state.charset = FW_SPACE + state.charset;
    }
    fixedByBin[0] = FW_SPACE; // бин 0 — абсолютная «чернота»
  }
} catch(e){}

    // 3) строим бины и первичную палитру с учётом фиксов
    bins = buildBinsFromChars(state.charset, K_BINS);
    palette = pickPalette(bins, fixedByBin);

    // 4) ротация похожих символов ТОЛЬКО в нефиксированных бинах
    if (paletteTimer) clearInterval(paletteTimer);
paletteTimer = null;

if (ROTATE_PALETTE) {
  paletteTimer = setInterval(() => {
    if (!bins || !bins.length) return;

    const lockN = Math.min(DARK_LOCK_COUNT, K_BINS);
    for (let k = 0; k < CHANGES_PER_TICK; k++) {
      const bi = Math.floor(Math.random() * (K_BINS - lockN)) + lockN;
      const bucket = bins[bi];
      if (!bucket || !bucket.length) continue;

      const fixedChars = fixedByBin.filter(Boolean);
      let pool = bucket.filter(ch => !fixedChars.includes(ch));
      if (!pool.length) pool = bucket;

      palette[bi] = pool[Math.floor(Math.random() * pool.length)];
    }
  }, PALETTE_INTERVAL);
}

  } else {
    // короткие наборы — без редьюса/ротации
    bins = [];
    palette = [];
    if (paletteTimer) { clearInterval(paletteTimer); paletteTimer = null; }
    fixedByBin = new Array(K_BINS).fill(null);
  }
}
// === CJK helpers (ставим прямо над measureCharAspect) ===
const CJK_RE = /[\u3000-\u303F\u3040-\u30FF\u31F0-\u31FF\u3400-\u9FFF\uF900-\uFAFF]/;

function measureSampleChar() {
  // state может быть ещё не инициализирован в момент загрузки файла — подстрахуемся:
  const charset = (typeof state !== 'undefined' && state && state.charset) ? state.charset : '';
  return CJK_RE.test(charset) ? '田' : 'M';
}
  // ---- измерение пропорции символа (W/H) ----
function measureCharAspect() {
  if (typeof forcedAspect === 'number' && isFinite(forcedAspect) && forcedAspect > 0) {
    return forcedAspect;
  }
  const fs = parseFloat(getComputedStyle(app.out).fontSize) || 16;
  measurePre.style.fontSize = fs + 'px';

  const CH = measureSampleChar(); // 'M' или '田'
  const N  = 32;                  // мерим среднюю ширину по 32 символам
  measurePre.textContent = CH.repeat(N);

  const r = measurePre.getBoundingClientRect();
  const charW = Math.max(1, r.width / N);
  const charH = Math.max(1, r.height);
  return charW / charH; // W/H
}
// Универсальный источник кадра для всех режимов
// Универсальный источник кадра для всех режимов (терпимо ждём видео)
function currentSource(){
  if (state.mode === 'photo' && state.imageEl) {
    const el = state.imageEl;
    const w = el.naturalWidth || el.width || 1;
    const h = el.naturalHeight || el.height || 1;
    updateHud(`src=img ${w}x${h}`);
    return { el, w, h, kind:'image' };
  }
  const v = app.vid;
  if (!v) return null;
  // ждём реальные размеры, чтобы не рисовать мусор 2×2
  if (v.readyState >= 1 && v.videoWidth > 2 && v.videoHeight > 2) {
    updateHud(`src=vid ${v.videoWidth}x${v.videoHeight}`);
    return { el: v, w: v.videoWidth, h: v.videoHeight, kind:(state.mode==='video'?'filevideo':'live') };
  }
  updateHud(`src=vid wait rs:${v.readyState}`);
  return null;
}

  // ============== КАМЕРА ==============
  async function startStream() {
  try {
    // выставляем атрибуты на всякий
    app.vid.setAttribute('playsinline',''); app.vid.setAttribute('autoplay',''); app.vid.setAttribute('muted','');
    app.vid.playsInline = true; app.vid.autoplay = true; app.vid.muted = true;

    const constraints = { video: { facingMode: state.facing || 'user' }, audio: false };
    updateHud('getUserMedia…');
    const stream = await navigator.mediaDevices.getUserMedia(constraints);

    app.vid.srcObject = stream;

    app.vid.onloadedmetadata = () => {
      updateHud('loadedmetadata');
      if (app.vid.videoWidth > 0 && app.vid.videoHeight > 0) {
        app.ui.placeholder.hidden = true;
        requestAnimationFrame(() => {
          const { w, h } = updateGridSize(); refitFont(w, h);
          updateHud('ready meta');
        });
      }
    };
    app.vid.oncanplay = () => {
      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => {
        const { w, h } = updateGridSize(); refitFont(w, h);
        updateHud('canplay');
      });
    };
    app.vid.onerror = (e)=> updateHud('video error');

    await app.vid.play().catch(()=>{});
    updateHud('play called');
    return true;
  } catch (err) {
    updateHud('gUM ERR: '+ (err?.name||err));
    alert('Камера недоступна: ' + (err?.message || err));
    return false;
  }
}

  // ============== РЕНДЕРИНГ ==============
  let raf = null;
  let lastFrameTime = 0;

  function setUI() {
    // разные пределы для мобилы и ПК
const WIDTH_MIN   = isMobile ? 50  : 125;
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
  const src = currentSource();
  if (!src) return { w: state.widthChars, h: 1 };

  const isFsLike = isFullscreenLike();
  const ratioCharWOverH = measureCharAspect(); // W/H

  // базовый H/W источника
  let sourceHOverW = src.h / src.w;

  // в FS на мобиле — фикс 9:16 ТОЛЬКО для LIVE
  if (isFsLike && isMobile && state.mode==='live') {
    sourceHOverW = 16/9;
  }

  const w = Math.max(1, Math.round(state.widthChars));
  const targetH = w * (sourceHOverW / (1 / Math.max(1e-6, ratioCharWOverH)));
  const h = Math.max(1, Math.min(1000, Math.round(targetH)));


  off.width = w;
  off.height = h;
  state.lastGrid = { w, h };
  return { w, h };
}

  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;

    const src = currentSource();
    if (!src) return;

    const { w, h } = updateGridSize();

    // Подготовка трансформа для зеркала
    // mirror = true ⇒ рисуем с scaleX(-1), чтобы получить НЕ-зеркальную картинку
// --- FULLSCREEN cover-crop под 16:9 (только для LIVE на мобиле) ---
const isFsLike = isFullscreenLike();

let sx = 0, sy = 0, sw = src.w, sh = src.h;
if (isFsLike && isMobile && state.mode==='live') {
  const targetWH = 9/16; // W/H
  const srcWH = src.w / src.h;
  if (srcWH > targetWH) { sw = Math.round(src.h * targetWH); sx = Math.round((src.w - sw)/2); }
  else if (srcWH < targetWH) { sh = Math.round(src.w / targetWH); sy = Math.round((src.h - sh)/2); }
}

// зеркалим как и раньше: mirror=true ⇒ scaleX(-1)
ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? w : 0, 0);
ctx.drawImage(src.el, sx, sy, sw, sh, 0, 0, w, h);
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
// Black/White clip для повышения «плотности» картинки
    const bp = state.blackPoint;
    const wp = state.whitePoint;
    v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
    v01 = Math.min(1, Math.max(0, v01));

    const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
    // u — непрерывный индекс 0..n
const u = (Yc / 255) * n;
let i0 = u | 0;        // floor
let idx = i0;

if (DITHER_ENABLED) {
  const frac = u - i0; // 0..1
  const thr  = BAYER8[(y & 7) * 8 + (x & 7)] / 64; // 0..1
  if (frac > thr) idx = i0 + 1;
}

if (idx < 0) idx = 0;
else if (idx > n) idx = n;

if (palette && palette.length === K_BINS) {
  let bi = Math.round((Yc / 255) * (K_BINS - 1));
  if (bi < 0) bi = 0; else if (bi >= K_BINS) bi = K_BINS - 1;
  line += palette[bi] || ' ';
} else {
  line += chars[idx];
}

  }
  out += line + '\n';
}

    app.out.textContent = out;
    refitFont(w, h);
    if (state.isRecording) {
  renderAsciiToCanvas(app.out.textContent || '', state.lastGrid.w, state.lastGrid.h);
}
  }
// ---------- EXPORT HELPERS (PNG/VIDEO) ----------

// Рендер готового ASCII-текста в canvas для экспорта
function renderAsciiToCanvas(text, cols, rows, scale = 2){
  const cvs = app.ui.render;
  const c = cvs.getContext('2d');
  const cs = getComputedStyle(app.out);
  const fsPx = parseFloat(cs.fontSize) || 16;
  const ff = cs.fontFamily || 'monospace';
  const lh = (parseFloat(cs.lineHeight)||1) * fsPx;

  // ширина «M» как шаг по X
  c.font = `${fsPx}px ${ff}`;
  const m = c.measureText('M');
  const stepX = Math.ceil(m.width);
  const stepY = Math.ceil(lh);

  const W = stepX * cols * scale;
  const H = stepY * rows * scale;

  cvs.width = Math.max(2, W);
  cvs.height = Math.max(2, H);

  // фон/текст из текущих настроек
  c.fillStyle = state.background;
  c.fillRect(0,0,W,H);
  c.fillStyle = state.color;
  c.font = `${fsPx*scale}px ${ff}`;
  c.textBaseline = 'top';

  const lines = text.split('\n');
  for (let y=0; y<rows && y<lines.length; y++){
    c.fillText(lines[y], 0, y*stepY*scale);
  }
}

// PNG (режим ФОТО)
function savePNG(){
  const grid = state.lastGrid;
  const text = app.out.textContent || '';
  if (!text.trim()) { alert('Нечего сохранять'); return; }
  renderAsciiToCanvas(text, grid.w, grid.h, 2);
  app.ui.render.toBlob(blob=>{
    if(!blob) return;
    downloadBlob(blob, 'ascii.png');
  }, 'image/png');
}

// Пытаемся дать MP4, иначе WebM
function pickMime(){
  const mp4 = 'video/mp4;codecs=h264';
  const webm9 = 'video/webm;codecs=vp9';
  const webm8 = 'video/webm;codecs=vp8';
  if (window.MediaRecorder?.isTypeSupported?.(mp4)) return mp4;
  if (window.MediaRecorder?.isTypeSupported?.(webm9)) return webm9;
  if (window.MediaRecorder?.isTypeSupported?.(webm8)) return webm8;
  return '';
}

// Видео (режим ВИДЕО)
function saveVideo(){
  if (state.mode!=='video') { alert('Видео-экспорт доступен только в режиме ВИДЕО'); return; }
  const mime = pickMime();
  if (!mime) { alert('Запись видео не поддерживается на этом устройстве.'); return; }

  const fps = Math.max(5, Math.min(60, state.fps));
  const stream = app.ui.render.captureStream(fps);
  state.recordChunks = [];

  try {
    state.recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  } catch(e) {
    alert('MediaRecorder недоступен: ' + (e.message||e));
    return;
  }

  state.recorder.ondataavailable = e => { if (e.data && e.data.size) state.recordChunks.push(e.data); };
  state.recorder.onstop = () => {
    const blob = new Blob(state.recordChunks, { type: mime });
    downloadBlob(blob, mime.includes('mp4') ? 'ascii.mp4' : 'ascii.webm');
    state.isRecording = false;
  };

  try { app.vid.currentTime = 0; } catch(e){}
  app.vid.play?.();

  state.isRecording = true;
  state.recorder.start(200);

  const onEnded = () => {
    try { state.recorder.stop(); } catch(e){}
    app.vid.removeEventListener('ended', onEnded);
  };
  app.vid.addEventListener('ended', onEnded, { once:true });
}

// Универсальное скачивание/открытие
function downloadBlob(blob, filename){
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

  // 1) Попытка: системное «Поделиться» (Android/iOS) — удобнее для «в Галерею»
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'ASCII VISOR', text: filename }).catch(()=>{});
    return;
  }

  // 2) В Telegram WebApp иногда блокируется download — открываем в новой вкладке
  const url = URL.createObjectURL(blob);
  if (window.Telegram?.WebApp) {
    window.open(url, '_blank');
    return;
  }

  // 3) Обычная загрузка ссылкой
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel='noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 3000);
}

  // Подбор font-size
  let refitLock = false;
  function refitFont(cols, rows) {
    if (refitLock) return;
    refitLock = true;

    const stageW = app.stage.clientWidth;
    const stageH = app.stage.clientHeight;

    const CH = measureSampleChar();
    measurePre.textContent = (CH.repeat(cols) + '\n').repeat(rows);
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
  function stopStream(){
  const s = app.vid?.srcObject;
  if (s) { s.getTracks().forEach(t=>t.stop()); app.vid.srcObject = null; }
  try { app.vid.pause?.(); } catch(e){}
  app.vid.removeAttribute('src');
}

async function setMode(newMode){
  state.mode = newMode;

  if (app.ui.fs)   app.ui.fs.hidden   = (newMode!=='live');
  if (app.ui.save) app.ui.save.hidden = (newMode==='live');

  app.ui.modeLive.classList.toggle('active',  newMode==='live');
  app.ui.modePhoto.classList.toggle('active', newMode==='photo');
  app.ui.modeVideo.classList.toggle('active', newMode==='video');

  if (newMode === 'live') {
    app.ui.placeholder.hidden = true;
    stopStream();
    await startStream();
    updateMirrorForFacing?.();
    return;
  }

  const needPH = (newMode==='photo' && !state.imageEl) ||
                 (newMode==='video' && !(app.vid && app.vid.src && app.vid.src!=='')); 
  app.ui.placeholder.hidden = !needPH;

  stopStream();

  if (newMode === 'photo') {
    if (!state.imageEl) app.ui.filePhoto.click();
  } else if (newMode === 'video') {
    if (!(app.vid && app.vid.src)) app.ui.fileVideo.click();
  }
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
  // В ФОТО/ВИДЕО — только зеркалим, камеру НЕ трогаем
  if (state.mode !== 'live') {
    state.mirror = !state.mirror;
    const { w, h } = updateGridSize();
    refitFont(w, h);
    return;
  }

  // В LIVE — на мобиле переключаем фронт/тыл (и обновляем флаг зеркала)
  if (isMobile) {
    state.facing = (state.facing === 'user') ? 'environment' : 'user';
    const s = app.vid.srcObject;
    if (s) s.getTracks().forEach(t => t.stop());
    await startStream();
    updateMirrorForFacing();
  } else {
    // На десктопе в LIVE — просто зеркалим
    state.mirror = !state.mirror;
    const { w, h } = updateGridSize();
    refitFont(w, h);
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

// --- Кнопки режимов внизу ---
app.ui.modeLive.addEventListener('click',  ()=> setMode('live'));
app.ui.modePhoto.addEventListener('click', ()=> setMode('photo'));
app.ui.modeVideo.addEventListener('click', ()=> setMode('video'));

// --- Выбор фото из галереи ---
app.ui.filePhoto.addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {
    state.imageEl = img;
    state.mirror = false;
    app.ui.placeholder.hidden = true;
    const { w, h } = updateGridSize(); refitFont(w, h);
    updateHud('img onload');
    requestAnimationFrame(()=>{}); // разовый тик
  };
  img.src = URL.createObjectURL(f);
});


app.ui.fileVideo.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  stopStream();
  app.vid.src = URL.createObjectURL(f);

  // жестко атрибуты
  app.vid.setAttribute('playsinline',''); app.vid.setAttribute('autoplay',''); app.vid.setAttribute('muted','');
  app.vid.playsInline = true; app.vid.autoplay = true; app.vid.muted = true;

  app.vid.onloadedmetadata = () => {
    updateHud('file meta');
    if (app.vid.videoWidth > 0 && app.vid.videoHeight > 0) {
      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => {
        const { w, h } = updateGridSize(); refitFont(w, h);
        updateHud('file ready');
      });
    }
  };
  app.vid.oncanplay = () => {
    app.ui.placeholder.hidden = true;
    requestAnimationFrame(() => {
      const { w, h } = updateGridSize(); refitFont(w, h);
      updateHud('file canplay');
    });
  };

  try { await app.vid.play(); } catch (err) {}
  state.mirror = false;
});

// --- Кнопка СОХРАНИТЬ ---
app.ui.save.addEventListener('click', ()=>{
  if (state.mode === 'photo') savePNG();
  else if (state.mode === 'video') saveVideo();
});

// Выбираем реально «чёрный» символ под текущий стек шрифтов
function pickDarkGlyph() {
  const candidates = [
    '\u3000', // IDEOGRAPHIC SPACE (fullwidth space)
    '\u2800', // BRAILLE PATTERN BLANK — часто пустой и не коллапсится
    '\u2003', // EM SPACE
    '\u205F', // MEDIUM MATHEMATICAL SPACE
    ' '       // обычный пробел — крайний фолбэк
  ];
  let best = ' ';
  let bestD = Infinity;
  for (const ch of candidates) {
    const d = measureCharDensity(ch); // 0..255, чем меньше — тем «чернее»
    if (d < bestD) { bestD = d; best = ch; }
  }
  // если по какой-то причине «пустоты» нет — всё равно возьмём наименее плотный
  return best;
}
app.ui.charset.addEventListener('change', e => {
  const val = e.target.value;

if (val === 'CUSTOM') {
  app.ui.customCharset.style.display = 'inline-block';
  applyFontStack(FONT_STACK_MAIN); // кастом всегда в MAIN
  state.charset = autoSortCharset(app.ui.customCharset.value || '');
  updateBinsForCurrentCharset(); // <<< ДОБАВЛЕНО
  return;
}

app.ui.customCharset.style.display = 'none';

// индекс «カタカナ» в твоём <select> — 4 (см. index.html)
const idx = app.ui.charset.selectedIndex;
const isPresetKatakana = (idx === 4); // «カタカナ» в твоём select

if (isPresetKatakana) {
  // Моно CJK + full-width
  applyFontStack(FONT_STACK_CJK, '400', true);
  forcedAspect = null;

  // Абсолютно тёмный символ для CJK — fullwidth space
  const FW_SPACE = pickDarkGlyph();

  // Мини-набор «обогащения» (без редких скобок, чтобы не ловить tofu)
  const enrichSafe = 'ー・。、。「」ァィゥェォッャュョヴヶ＝…';

  // ВАЖНО: fullwidth space идёт первым, затем исходный набор и обогащение
  const withSpace = (FW_SPACE + (val + enrichSafe).replaceAll(' ', ''));

  state.charset = autoSortCharset(withSpace);

  // Профайл под CJK: чуть больше ступеней, фиксируем 2 самых тёмных
  K_BINS = 14;
  DARK_LOCK_COUNT = 2;

  // Дизеринг снова включаем — он даёт как раз тот «панч» в полутонах
  DITHER_ENABLED  = true;

  // Ротацию схожих символов выключаем, чтобы картинка не «дрожала»
  ROTATE_PALETTE  = false;

  // Более «жирный» клип для усиления контраста
  state.blackPoint = 0.10;  // поднимаем чёрную точку
  state.whitePoint = 0.92;  // слегка опускаем белую
}
else {
  // все остальные пресеты — как раньше
  applyFontStack(FONT_STACK_MAIN, '700', false);
  forcedAspect = null;
  state.charset = autoSortCharset(val);

  K_BINS = 10;
  DARK_LOCK_COUNT = 3;
  DITHER_ENABLED  = true;
  ROTATE_PALETTE  = true;
}
updateBinsForCurrentCharset();

});

// реагируем на ввод своих символов
app.ui.customCharset.addEventListener('input', e => {
  state.charset = autoSortCharset(e.target.value || '');
  updateBinsForCurrentCharset(); // <<< ДОБАВЛЕНО
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

await setMode('live');         // внутри сам вызовется startStream()
if (raf) cancelAnimationFrame(raf);
raf = requestAnimationFrame(loop);

const { w, h } = updateGridSize();
refitFont(w, h);
  }

  document.addEventListener('DOMContentLoaded', init);
})();














