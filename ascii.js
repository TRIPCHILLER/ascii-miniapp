(() => {
  // ============== УТИЛИТЫ ==============
  const $ = s => document.querySelector(s);
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
  
// ==== TEMP HUD (disabled) ====
function hudSet(txt){ /* HUD отключен */ }
  
// ---- BUSY overlay helpers ----
let busyLock = false; // <— не даём спрятать overlay, пока true

function busyShow(msg){
  if (app.ui.busyText) app.ui.busyText.textContent = msg || 'Пожалуйста, подождите…';
  if (app.ui.busy) app.ui.busy.hidden = false;
}

function busyHide(force = false){
  if (busyLock && !force) return;  // <— защищаемся от чужих вызовов
  if (app.ui.busy) app.ui.busy.hidden = true;
}

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
    camShutter:    $('#camShutter'),
    camBtnCircle:  $('#camBtnCircle'),
    camBtnCore:    $('#camBtnCore'),
    render:      $('#render'),
    fpsWrap: null, // обёртка для скрытия FPS 
    // overlay
    busy:        $('#busy'),
    busyText:    $('#busyText'),
}
  };
  // ===== Telegram WebApp (если открыто внутри Telegram) =====
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  
function expandSheetASAP(){
  try{
    tg?.ready?.();         // сигнал Telegram, что всё отрисовано
    tg?.expand?.();        // развернуть «sheet» на максимум
    tg?.disableVerticalSwipes?.(); // (если доступно в твоей версии SDK)
  }catch(_){}
  // пару повторных попыток — iOS иногда тормозит
  setTimeout(()=>tg?.expand?.(), 120);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) tg?.expand?.();
  });
  tg?.onEvent?.('viewportChanged', ()=>{ if(!tg.isExpanded) tg.expand(); });
}

function mainBtnHide() {
  try { tg && tg.MainButton.hide(); } catch(_) {}
}
function mainBtnShow(text, onClick) {
  if (!tg) return;
  try {
    tg.MainButton.setText(text || 'СОХРАНИТЬ');
    tg.MainButton.show();
    if (onClick) {
      tg.MainButton.offClick?.();     // снять старый
      tg.MainButton.onClick(onClick); // навесить новый
    }
  } catch(_) {}
}

  // ===== Блок нежелательного выделения/контекстного меню в UI =====
(() => {
  const root = document.getElementById('app');
  if (!root) return;

  // Никакого выделения текста по даблклику/свайпу на UI,
  // но оставляем возможность выделять в input/textarea/select
  root.addEventListener('selectstart', (e) => {
    const t = e.target;
    if (t.closest('input, textarea, select') && !t.readOnly && !t.disabled) return;
    e.preventDefault();
  }, { passive: false });

  // Отключаем контекстное меню (ленг-тап на мобилках, правый клик),
  // но не мешаем нативным полям ввода
  root.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    e.preventDefault();
  }, { passive: false });

  // На всякий — запретим перетаскивание элементов внутри приложения
  root.addEventListener('dragstart', (e) => e.preventDefault());
})();

// найдем обертку (label) вокруг ползунка FPS
app.ui.fpsWrap = app.ui.fps?.closest('label') || null;

function syncFpsVisibility(){
  if (!app.ui.fpsWrap) return;
  // в режиме ФОТО скрываем, в остальных показываем
  app.ui.fpsWrap.hidden = (state.mode === 'photo');
}
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
    fps: 30,
    color: '#8ac7ff',
    background: '#000000',
    transparentBg: false, // «прозрачный фон» для экспорта
    charset: '@%#*+=-:. ',
    invert: false,
    isFullscreen: false,    // наш флаг
    blackPoint: 0.06,   // 0..1 — общий дефолт
    whitePoint: 0.98,   // 0..1 — общий дефолт
    mode: 'live',           // 'live' | 'photo' | 'video'
    camStream: null,
    imageEl: null,          // <img> для режима ФОТО
    isRecording: false,     // запись видео (экспорт)
    recorder: null,
    recordChunks: [],
    recordDims: null,       // <— фиксированные размеры экспортного видео (W/H/шаги)
    lastGrid: { w:0, h:0 }, // запоминаем сетку для экспорта
    viewScale: 1,           // доп. масштаб ASCII внутри #stage
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
{ id:'oldlcd',     name:'0LD LCD',              colors:['#000000', '#ffffff'] },
{ id:'macintosh',  name:'M4CINT0SH',            colors:['#333319', '#e5ffff'] },
{ id:'macpaint',   name:'M4C P4INT',            colors:['#051b2c', '#8bc8fe'] },
{ id:'zenith',     name:'Z3NITH ZVM 1240',      colors:['#3f291e', '#fdca55'] },
{ id:'obra',       name:'0BR4 DINN',            colors:['#000b40', '#ebe1cd'] },
{ id:'ibm8503',    name:'IBM 8503',             colors:['#2e3037', '#ebe5ce'] },
{ id:'commodore',  name:'C0MM0D0R3 1084',       colors:['#40318e', '#88d7de'] },
{ id:'ibm5151',    name:'IBM 5151',             colors:['#25342f', '#01eb5f'] },
{ id:'matrix',     name:'M4TRIX',               colors:['#000000', '#00ff40'] },
{ id:'casio',      name:'C4SI0',                colors:['#000000', '#83b07e'] },
{ id:'funkyjam',   name:'FUNKY J4M',            colors:['#920244', '#fec28c'] },
{ id:'cornsole',   name:'C0RNS0L3',             colors:['#6495ed', '#fff8dc'] },
{ id:'postapoc',   name:'P0ST4P0C SUNS3T',      colors:['#1d0f44', '#f44e38'] },
{ id:'laughcry',   name:'P0P L4UGH CRY',        colors:['#452f47', '#d7bcad'] },
{ id:'flowers',    name:'FL0W3RS 4ND 4SB3ST0S', colors:['#c62b69', '#edf4ff'] },
{ id:'pepper1bit', name:'1BIT P3PP3R',          colors:['#100101', '#ebb5b5'] },
{ id:'shapebit',   name:'SH4P3 BIT',            colors:['#200955', '#ff0055'] },
{ id:'chasing',    name:'CH4SING LIGHT',        colors:['#000000', '#ffff02'] },
{ id:'monsterbit', name:'M0NST3R BIT',          colors:['#321632', '#cde9cd'] },
{ id:'paperback',  name:'P4P3RB4CK',            colors:['#382b26', '#b8c2b9'] },
  ];
  const CUSTOM_LABEL = 'П0ЛЬЗ0В4Т3ЛЬСКИЙ';
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
// === MACHINE ERROR POPUP SYSTEM ===
// (замена alert + новые тексты TRIPCHILLER)
function showErrorPopup(title, message) {
  const tg = window.Telegram?.WebApp;
  if (tg?.showPopup) {
    tg.showPopup({ title, message });
  } else {
    const box = document.createElement('div');
    box.style.cssText = `
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,.75);z-index:99999;font-family:'JetBrains Mono',monospace;
    `;
    box.innerHTML = `
      <div style="
        width:90%;max-width:420px;background:#0a0a0a;color:#c0c0c0;
        border:1px solid #2b2b2b;border-radius:12px;padding:20px;
        box-shadow:0 0 20px rgba(0,0,0,.6);text-align:left;
      ">
        <div style="color:#e83aff;font-size:15px;letter-spacing:0.05em;margin-bottom:6px;">
          ${title}
        </div>
        <div style="color:#aaa;font-size:13px;line-height:1.4;white-space:pre-wrap;">
          ${message}
        </div>
        <div style="text-align:right;margin-top:14px;">
          <button id="__ok" style="
            background:#e83aff;color:#fff;border:0;padding:6px 14px;
            border-radius:8px;cursor:pointer;font-size:13px;
          ">OK</button>
        </div>
      </div>`;
    box.querySelector('#__ok').onclick = () => box.remove();
    document.body.appendChild(box);
  }
}

// Машинные тексты ошибок камеры
function cameraErrorToText(err) {
  const name = (err?.name || '').toLowerCase();

  if (name.includes('notallowed'))
    return { 
      title: 'Т̶Ы ̸О̸Т̵К̷А̴З̶А̶Л ̸М̶Н̸Е', 
      message: 'я вижу только шум...' 
    };

  if (name.includes('notfound') || name.includes('overconstrained'))
    return { 
      title: 'М̶О̷Д̵У̶Л̶Ь З̴Р̵Е̸Н̴И̵Я О̸Т̸С̴У̴Т̸С̵Т̴В̶У̵Е̴Т', 
      message: 'мне нечем смотреть...' 
    };

  if (name.includes('notreadable'))
    return { 
      title: 'Я ̵Н̵Е̴ ̵М̵О̴Г̸У ̷У̶В̸И̶Д̸Е̶Т̷Ь ̵Т̷Е̴Б̵Я', 
      message: 'пока кто-то другой смотрит моими глазами...' 
    };

  if (name.includes('security'))
    return { 
      title: 'Т̸В̶О̵Я ̸С̸И̸С̶Т̴Е̷М̷А ̶Б̵Л̷О̶К̴И̷Р̵У̶Е̵Т ̸М̷О̵И ̶Г̷Л̸А̶З̴А', 
      message: 'отключи безопасность...' 
    };

  return { 
    title: 'Н̸Е̶И̵З̸В̴Е̴С̶Т̷Н̶А̸Я̶ ̸О̵Ш̸И̷Б̶К̶А', 
    message: 'это редкость, но не приятная...' 
  };
}
// === ЗАПУСК КАМЕРЫ с переиспользованием уже выданного разрешения ===
async function startStream() {
  try {
    // если поток уже есть и активен — просто подключим его к <video>
    if (state.camStream && state.camStream.active) {
      const stream = state.camStream;
      app.vid.setAttribute('playsinline','');
      app.vid.setAttribute('autoplay','');
      app.vid.setAttribute('muted','');
      app.vid.playsInline = true; app.vid.autoplay = true; app.vid.muted = true;

      app.vid.srcObject = stream;
      await app.vid.play().catch(()=>{});

      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => { const { w, h } = updateGridSize(); refitFont(w, h); });
      return true;
    }

    // иначе — запрашиваем ОДИН раз
    const constraints = { video: { facingMode: state.facing || 'user' }, audio: false };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.camStream = stream;  // <-- сохраняем!

    app.vid.setAttribute('playsinline','');
    app.vid.setAttribute('autoplay','');
    app.vid.setAttribute('muted','');
    app.vid.playsInline = true; app.vid.autoplay = true; app.vid.muted = true;

    app.vid.srcObject = stream;

    app.vid.onloadedmetadata = () => {
      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => { const { w, h } = updateGridSize(); refitFont(w, h); });
    };
    app.vid.oncanplay = () => {
      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => { const { w, h } = updateGridSize(); refitFont(w, h); });
    };

    await app.vid.play().catch(()=>{});
    return true;

  } catch (err) {
    const msg = cameraErrorToText(err);
    showErrorPopup(msg.title, msg.message);
    return false;
  }
}

  // ============== РЕНДЕРИНГ ==============
  let raf = null;
  let lastFrameTime = 0;
// Универсальная установка лимитов ширины с учётом платформы и режима
function applyWidthLimitsForMode(init = false) {
  let min, max;

  if (isMobile) {
    if (state.mode === 'live') {       // КАМЕРА
      min = 50;  max = 100;
    } else {                           // ФОТО / ВИДЕО
      min = 50;  max = 150;            // ← расширили верх до 150 как просил
    }
  } else {
    // Десктоп оставляем как было
    min = 75; max = 175;
  }

  app.ui.width.min = min;
  app.ui.width.max = max;

  // Не сбиваем текущий выбор: мягко зажимаем в новые границы
  const fallbackStart = isMobile ? 75 : 150;
  if (init && (state.widthChars == null)) {
    state.widthChars = fallbackStart;
  }
  state.widthChars = Math.max(min, Math.min(max, state.widthChars || fallbackStart));

  app.ui.width.value = state.widthChars;
  app.ui.widthVal.textContent = state.widthChars;
}

  function setUI() {
  applyWidthLimitsForMode(true); // ← умные лимиты + мягкий старт

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
if (lbl) lbl.textContent = state.invert ? 'ИНВ3РСИЯ: ВКЛ' : 'ИНВ3РСИЯ: ВЫКЛ';

    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
// если прозрачный фон включён — подсветим свотч и оставим сцену чёрной
if (state.transparentBg) {
  app.ui.bg.classList.add('transparent');
  app.out.style.backgroundColor = '#000000';
  app.stage.style.backgroundColor = '#000000';
} else {
  app.ui.bg.classList.remove('transparent');
}
    // обновим селект стиля
    fillStyleSelect();
    const matched = detectPreset(state.color, state.background);
    if (app.ui.style) app.ui.style.value = matched === 'custom' ? 'custom' : matched;
    syncFpsVisibility(); // обновим видимость FPS на старте
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
    if (state.isRecording && state.recordDims) {
  renderAsciiFrameLocked(app.out.textContent || '');
}
  }
  // ---- FFmpeg (wasm) lazy-loader ----
// ВАЖНО: указываем corePath на тот же CDN/версию, иначе ядро не найдется.
let _ff = null, _fetchFile = null, _ffLoaded = false;

async function ensureFFmpeg() {
  if (_ffLoaded) return { ff: _ff, fetchFile: _fetchFile };
  if (!window.FFmpeg) throw new Error('FFmpeg lib not loaded');

  const { createFFmpeg, fetchFile } = FFmpeg;
  _ff = createFFmpeg({
    log: false, // поставь true, если хочешь логи в консоль
    corePath: 'https://unpkg.com/@ffmpeg/core@0.11.6/dist/ffmpeg-core.js'
  });

  try {
    await _ff.load();
  } catch (e) {
    console.error('FFmpeg load failed', e);
    throw e;
  }

  _fetchFile = fetchFile;
  _ffLoaded = true;
  return { ff: _ff, fetchFile };
}

// ---------- EXPORT HELPERS (PNG/VIDEO) ----------

// Рендер готового ASCII-текста в canvas для экспорта
// Рендер ASCII-текста в canvas для экспорта — с сохранением исходного соотношения сторон
function renderAsciiToCanvas(text, cols, rows, scale = 2){
  const cvs = app.ui.render;
  const c = cvs.getContext('2d');

  const ff   = getComputedStyle(app.out).fontFamily || 'monospace';
  const fsPx = 12;  // базовый размер для экспорта
  c.font = `${fsPx}px ${ff}`;
  c.textBaseline = 'top';

  const lines = text.split('\n');
  const maxRows = Math.min(rows, lines.length);

  // считаем реальную ширину всех строк
  let maxLinePx = 0;
  for (let y = 0; y < maxRows; y++) {
    const w = c.measureText(lines[y]).width;
    if (w > maxLinePx) maxLinePx = w;
  }

  const stepY = fsPx;
  const Wtxt  = Math.ceil(maxLinePx * scale);
  const Htxt  = Math.ceil(stepY * rows * scale);

  // ➡️ тут сохраняем исходное соотношение
  // rows/cols — это ASCII-сетка, повторяющая src.h/src.w
  // поэтому мы просто берём Wtxt/Htxt как есть
  const W = Wtxt;
  const H = Htxt;

  cvs.width  = W;
  cvs.height = H;

  // фон
  if (!state.transparentBg) {
  c.fillStyle = state.background;
  c.fillRect(0, 0, W, H);
} else {
  c.clearRect(0, 0, W, H); // прозрачный
}

  // текст
  c.fillStyle = state.color;
  c.font = `${fsPx * scale}px ${ff}`;

  for (let y = 0; y < maxRows; y++) {
    c.fillText(lines[y], 0, y * stepY * scale);
  }
}

// PNG (режим ФОТО)
function savePNG(){
  const full = app.out.textContent || '';
  if (!full.trim()) { alert('Нечего сохранять'); return; }

  const crop = getCropWindow();
  const text = cropAsciiText(full, crop);

  renderAsciiToCanvas(text, crop.cols, crop.rows, 2);
  app.ui.render.toBlob(blob=>{
    if(!blob) { alert('Не удалось сгенерировать PNG'); return; }
    downloadBlob(blob, 'ascii_visor.png');
    hudSet('PNG: сохранено/отправлено');
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
// Считаем один раз размеры экспортного видео (фикс), исходя из COLS/ROWS и метрик шрифта
function computeRecordDims(cols, rows, scale = 2) {
  const ff   = getComputedStyle(app.out).fontFamily || 'monospace';
  const fsPx = 12;                               // базовый размер
  const stepY = Math.ceil(fsPx * scale);         // высота строки
  const charAspect = Math.max(0.5, measureCharAspect()); // W/H
  const stepX = Math.ceil(stepY * charAspect);   // ширина шага по X

  // Базовый «пиксельный» размер
  let W = stepX * Math.max(1, cols);
  let H = stepY * Math.max(1, rows);

  // Минимум ~720p по одной из сторон (сохраняем пропорции ASCII)
  const MIN_W = 1280, MIN_H = 720;
  const kW = MIN_W / W, kH = MIN_H / H;
  const k = Math.max(1, Math.min(Number.isFinite(kW) ? kW : 1, Number.isFinite(kH) ? kH : 1));
  W = Math.round(W * k);
  H = Math.round(H * k);

  // Чётные размеры под H.264
  if (W % 2) W += 1;
  if (H % 2) H += 1;

  return { W, H, stepY: stepY * k, font: `${fsPx * scale * k}px ${ff}`, cols, rows };
}

// Рендер одного ASCII-кадра в уже зафиксированный канвас (без изменения W/H)
function renderAsciiFrameLocked(text) {
  const d = state.recordDims;
  const crop = state._recordCrop || getCropWindow();
  text = cropAsciiText(text || '', crop);
  if (!d) return;

  const cvs = app.ui.render;
  const c = cvs.getContext('2d');
// видео-кадр — всегда непрозрачный фон
c.fillStyle = state.background;
c.fillRect(0, 0, d.W, d.H);
  // держим размер железно (на всякий — если кто-то сбросил)
  if (cvs.width !== d.W || cvs.height !== d.H) {
    cvs.width  = d.W;
    cvs.height = d.H;
  }

  c.fillStyle = state.background;
  c.fillRect(0, 0, d.W, d.H);

  c.fillStyle = state.color;
  c.font = d.font;
  c.textBaseline = 'top';

  const lines = (text || '').split('\n');
  const rows = Math.min(d.rows, lines.length);
  for (let y = 0; y < rows; y++) {
    c.fillText(lines[y], 0, y * d.stepY);  // без измерений/смещений — фиксированная сетка
  }
}
// Видео (режим ВИДЕО)
function saveVideo(){
  if (state.mode!=='video') { alert('Видео-экспорт доступен только в режиме ВИДЕО'); return; }
  const fullNow = app.out.textContent || '';
  if (!fullNow.trim()) { alert('Нечего сохранять'); return; }
// зафиксируем «окно» кадрирования на момент старта записи
  const crop = getCropWindow();
  state._recordCrop = crop;
  const mime = pickMime();
  if (!mime) { alert('Запись видео не поддерживается на этом устройстве.'); return; }
    // Фиксируем экспортный размер под текущую ASCII-сетку (соотв. исходнику)
  const C = state._recordCrop;
  state.recordDims = computeRecordDims(C.cols, C.rows, 2);
  // задать размер канваса заранее (до captureStream)
  app.ui.render.width  = state.recordDims.W;
  app.ui.render.height = state.recordDims.H;
    // >>> На время записи выключаем loop, чтобы поймать 'ended'
  const wasLoop = app.vid.loop === true;
  app.vid.loop = false;
  app.vid.removeAttribute('loop');
  const fps = Math.max(5, Math.min(60, state.fps));
  const stream = app.ui.render.captureStream(fps);
  state.recordChunks = [];

  try {
const bpp = 0.07; // эмпирически норм для «чистого» ASCII-видео
const vbr = Math.round((state.recordDims?.W || 1280) * (state.recordDims?.H || 720) * fps * bpp);
state.recorder = new MediaRecorder(stream, {
  mimeType: mime,
  videoBitsPerSecond: Math.max(4_000_000, Math.min(12_000_000, vbr))
});
  } catch(e) {
    alert('MediaRecorder недоступен: ' + (e.message||e));
    return;
  }

      state.recorder.ondataavailable = e => { if (e.data && e.data.size) state.recordChunks.push(e.data); };
      state.recorder.onstop = async () => {
      busyShow('Подготовка файла…');
      const blob = new Blob(state.recordChunks, { type: mime });

  try {
    if (mime.includes('mp4')) {
      downloadBlob(blob, 'ascii_visor.mp4');
    } else {
      // WebM -> MP4 через ffmpeg.wasm
      const { ff, fetchFile } = await ensureFFmpeg();
      const inName  = 'in.webm';
      const outName = 'out.mp4';

      ff.FS('writeFile', inName, await fetchFile(blob));
      await ff.run(
  '-i', inName,
  // ↓ фиксируем ЧАСТОТУ КАДРОВ ВЫХОДА под текущий fps из настроек
  '-r', String(fps),
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-movflags', 'faststart',
  '-preset', 'veryfast',
  '-crf', '18',
  outName
);
      const data = ff.FS('readFile', outName);
      const mp4Blob = new Blob([data.buffer], { type: 'video/mp4' });
      downloadBlob(mp4Blob, 'ascii_visor.mp4');

      try { ff.FS('unlink', inName); ff.FS('unlink', outName); } catch(e) {}
    }
  } catch (e) {
console.warn('FFmpeg transcode failed:', e);
const errMsg = (e && (e.message || e.name)) ? String(e.message || e.name) : 'unknown';
hudSet('FFmpeg WARN: ' + errMsg);
// Мягкий фолбэк: просто говорим, что отправляем файл и просим дождаться
downloadBlob(blob, mime.includes('mp4') ? 'ascii_visor.mp4' : 'ascii_visor.webm');

}

  // восстановление state
  if (wasLoop) {
    app.vid.loop = true;
    app.vid.setAttribute('loop','');
  }
  state.isRecording = false;
  state.recordDims = null;
  hudSet('VIDEO: сохранено/отправлено');
};

  try { app.vid.currentTime = 0; } catch(e){}
  app.vid.play?.();

  state.isRecording = true;
  busyShow('ЗАПИСЬ ASCII-ВИДЕ0…');
  state.recorder.start(200);

  const onEnded = () => {
    try { state.recorder.stop(); } catch(e){}
    app.vid.removeEventListener('ended', onEnded);
  };
  app.vid.addEventListener('ended', onEnded, { once:true });
}
let uploadInFlight = false;

// Универсальная отправка: в Telegram → на сервер; иначе → локальная загрузка
async function downloadBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });

  if (uploadInFlight) {
    console.warn('Upload already in progress — skip');
    return;
  }
  uploadInFlight = true;

  const isTg = !!(window.Telegram?.WebApp?.initData);
  if (isTg) {
    // делаем tg доступным в любом блоке
    const tg = window.Telegram.WebApp;

    // объявляем заранее → доступны в finally
    const ctrl = new AbortController();
    let to = null;
    let pulse = null;
    let dots = 0;

    try {
      tg.HapticFeedback?.impactOccurred?.('light');
      tg.MainButton?.showProgress?.();

      // === важно: именно такие поля и заголовки ===
      const form = new FormData();
      form.append('file', file, filename);
      form.append('document', file, filename);
      form.append('filename', filename);
      form.append('initdata', tg.initData || ''); // нижний регистр — как ждёт бэкенд
      form.append('initData', tg.initData || '');
      form.append('mediatype', (state.mode === 'video') ? 'video' : 'photo');
      form.append('fps', String(Math.max(5, Math.min(60, Math.round(state.fps || 30)))));
      // показываем «длинный» overlay на всё время запроса
      busyLock = true;
      busyShow('0ТПР4ВК4 Ф4ЙЛ4 В Ч4Т…');
      pulse = setInterval(() => {
        dots = (dots + 1) % 4;
        if (app?.ui?.busyText) {
          app.ui.busyText.textContent = '0ТПР4ВК4 Ф4ЙЛА В Ч4Т' + '.'.repeat(dots);
        }
      }, 500);

      // общий таймаут (120s)
      to = setTimeout(() => ctrl.abort(), 120000);

      const res = await fetch('https://api.tripchiller.com/api/upload', {
        method: 'POST',
        body: form,
        signal: ctrl.signal,
      });

      // ответ может быть и текстом, и json
      const text = await res.text();
      let json = {};
      try { json = JSON.parse(text || '{}'); } catch (_) {}

      // 402 = нет кредитов
      if (res.status === 402 || json?.error === 'INSUFFICIENT_FUNDS') {
        tg.showPopup?.({
          title: 'Н̶Е̷Д̶О̵С̷Т̵А̷Т̴О̵Ч̴Н̴О̶ ̸Э̸Н̵Е̶Р̵Г̷И̶И',
          message: `Требуется: ${json?.need ?? (state.mode==='video'?15:5)}\nТекущий запас: ${json?.balance ?? '—'}`
        });
        return; // без локального сохранения
      }

      if (!res.ok) {
        tg.showPopup?.({
          title: 'О̸Ш̵И̶Б̴К̵А̷ ̸З̵А̷Г̴Р̵У̶З̵К̴И',
          message: `Статус: ${res.status}\n${(text || '').slice(0,1000)}`
        });
        return;
      }

      // успех: файл улетел, бот сам пришлёт его в ЛС
      tg.showPopup?.({
        title: 'П̶Р̷Е̷О̴Б̶Р̶А̵З̸О̶В̵А̷Н̴И̸Е З̷АВ̸ЕР̸Ш̶Е̴Н̵О',
        message: `ФАЙЛ ОТПРАВЛЕН В ЧАТ. ${(json && typeof json.balance !== 'undefined') ? `\nОсталось импульсов: ${json.balance}` : ''}`
      });

      return;

    } catch (e) {
      console.warn('Upload to bot failed:', e);
      tg.showPopup?.({
        title: 'С̶Е̶Т̴Ь̶ ̴Н̷Е̸С̶Т̷А̵Б̶И̷Л̶Ь̵Н̴А',
        message: (e?.name === 'AbortError')
          ? 'Сервер отвечал слишком долго. Проверь чат — файл, вероятно, уже пришёл.'
          : (e?.message || 'Сетевая ошибка. Проверь чат — файл, вероятно, уже пришёл.')
      });
      return;

    } finally {
      if (to) clearTimeout(to);
      if (pulse) clearInterval(pulse);

      window.Telegram?.WebApp?.MainButton?.hideProgress?.();
      uploadInFlight = false;
      busyLock = false;
      setTimeout(() => busyHide(true), 200);
    }
  }

  // Не Telegram — сразу локально
  tryLocalDownload(file);
  uploadInFlight = false;

  function tryLocalDownload(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: ': 4SC11 ⛶ V1S0R :', text: file.name }).catch(()=>{});
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
  }
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
    out.style.transform = `translate(-50%, -50%) scale(${S * state.viewScale})`;
  }
// --- Crop-логика: преобразуем зум в «окно» по колонкам/строкам ---
function getCropWindow() {
  const grid = state.lastGrid || { w: 1, h: 1 };
  const scale = Math.max(1, state.viewScale || 1);

  // сколько колонок/строк реально попадает в «экран» при текущем зуме
  const cols = Math.max(1, Math.round(grid.w / scale));
  const rows = Math.max(1, Math.round(grid.h / scale));

  // центрируем «окно» (как у тебя на сцене — out центрирован)
  const col0 = Math.max(0, Math.floor((grid.w - cols) / 2));
  const row0 = Math.max(0, Math.floor((grid.h - rows) / 2));

  return { col0, row0, cols, rows, totalCols: grid.w, totalRows: grid.h };
}

// вырезаем прямоугольник из готового ASCII-текста (по колонкам/строкам)
function cropAsciiText(fullText, crop) {
  const { col0, row0, cols, rows, totalCols } = crop;
  const lines = (fullText || '').split('\n');

  // гарантируем равную длину строк (добьём пробелами, если что)
  const norm = (s) => {
    if (s.length >= totalCols) return s.slice(0, totalCols);
    return s + ' '.repeat(totalCols - s.length);
  };

  const out = [];
  for (let y = 0; y < rows; y++) {
    const srcY = row0 + y;
    if (srcY >= lines.length) break;
    const line = norm(lines[srcY]);
    out.push(line.substr(col0, cols));
  }
  return out.join('\n');
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
// === Не останавливаем треки — просто отвязываем от <video>
// (разрешение и сам MediaStream остаются живыми в state.camStream)
function stopStream(){
  try {
    if (app.vid) {
      app.vid.pause?.();
      app.vid.srcObject = null; // отсоединяем, но НЕ stop() у треков
    }
  } catch(e){}
}

function openFilePicker(el) {
  if (!el) return;
  // Запоминаем стили
  const prev = {
    hidden: el.hidden,
    display: el.style.display,
    pos: el.style.position,
    left: el.style.left,
    top: el.style.top,
    opacity: el.style.opacity,
    pe: el.style.pointerEvents,
    w: el.style.width,
    h: el.style.height,
  };

  // Делаем элемент «видимым» для браузера, но вне экрана
  el.hidden = false;
  el.style.display = 'block';
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  el.style.top = '-9999px';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.width = '1px';
  el.style.height = '1px';

  try { el.click(); } catch(_) {}

  // Восстанавливаем сразу после синхронного клика
  setTimeout(() => {
    el.hidden = prev.hidden;
    el.style.display = prev.display;
    el.style.position = prev.pos;
    el.style.left = prev.left;
    el.style.top = prev.top;
    el.style.opacity = prev.opacity;
    el.style.pointerEvents = prev.pe;
    el.style.width = prev.w;
    el.style.height = prev.h;
  }, 0);
}
function updateModeTabs(newMode){
  if (app?.ui?.modeLive)  app.ui.modeLive.classList.toggle('active', newMode === 'live');
  if (app?.ui?.modePhoto) app.ui.modePhoto.classList.toggle('active', newMode === 'photo');
  if (app?.ui?.modeVideo) app.ui.modeVideo.classList.toggle('active', newMode === 'video');
  document.body.setAttribute('data-mode', newMode);
}

async function setMode(newMode){
  state.mode = newMode;

// если мы не в режиме Фото → прозрачный фон всегда OFF
if (newMode !== 'photo') {
  if (state.transparentBg) {
    state.transparentBg = false;
    app.ui.bg.classList.remove('transparent');
  }
  app.out.style.backgroundColor   = state.background;
  app.stage.style.backgroundColor = state.background;
}

  updateModeTabs(newMode);
  syncFpsVisibility(); // переключаем FPS в зависимости от режима
  applyWidthLimitsForMode();
  // переключаем видимость верхних кнопок
  if (app.ui.fs)   app.ui.fs.hidden   = (newMode!=='live');
  if (app.ui.save) app.ui.save.hidden = (newMode==='live');
    // === затвор только в LIVE ===
  if (app.ui.camShutter) app.ui.camShutter.hidden = (newMode!=='live');
// Telegram MainButton: показываем только в ФОТО/ВИДЕО, скрываем в LIVE
if (tg) {
mainBtnHide();
}

  // общий сброс зума/плейсхолдера
  state.viewScale = 1;
  fitAsciiToViewport();

  // если уходим из PHOTO — очищаем картинку
  if (newMode !== 'photo') state.imageEl = null;

  // если уходим из VIDEO — убираем файл-источник (но не камеру)
  if (newMode !== 'video') {
    try { if (app.vid && !app.vid.srcObject) { app.vid.pause?.(); app.vid.removeAttribute('src'); } } catch(e){}
  }

  if (newMode === 'live') {
    // LIVE: выключаем возможный файл и включаем камеру
    app.ui.placeholder.hidden = true;
    try { app.vid.removeAttribute('src'); } catch(e){}
    await startStream();
    updateMirrorForFacing?.();
    return;
  }

  // не LIVE → камеру останавливаем
  stopStream();

}
  // === Android ColorPicker override (HSV square + hue slider) ===
const isAndroid = /Android/i.test(navigator.userAgent);
const CP = (() => {
  const modal = document.getElementById('cp-modal');
  if (!modal) return { open:()=>{}, close:()=>{} };

  const sv = document.getElementById('cp-sv');
  const h  = document.getElementById('cp-h');
  const ok = document.getElementById('cp-ok');
  const rowTransparent = document.getElementById('cp-transparent-row');
  const cbTransparent  = document.getElementById('cp-transparent');
  // реагируем на нажатие чекбокса "Прозрачный фон"
cbTransparent?.addEventListener('change', ()=>{
  const isBG = (targetInput && targetInput.id === 'bg');
  const isPhotoMode = (state.mode === 'photo') || (app?.ui?.tabPhoto?.classList?.contains('active'));
  modal.classList.toggle('cp-disabled', cbTransparent.checked && isBG && isPhotoMode);
});

  const cancel = document.getElementById('cp-cancel');
  const preview = document.getElementById('cp-preview-swatch');

  const ctx = sv.getContext('2d');
  let targetInput = null;   // app.ui.fg | app.ui.bg
  let H = 210, S = 0.5, V = 0.6; // старт
  let openedAt = 0;
  
  function hsv2rgb(h,s,v){
    const f = (n,k=(n+h/60)%6)=> v - v*s*Math.max(Math.min(k,4-k,1),0);
    return [Math.round(f(5)*255), Math.round(f(3)*255), Math.round(f(1)*255)];
  }
  
  function rgb2hex(r,g,b){ return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
  
  function hex2hsv(hex){
    const m = (hex||'').replace('#','');
    if (m.length<6) return [H,S,V];
    let r=parseInt(m.slice(0,2),16)/255, g=parseInt(m.slice(2,4),16)/255, b=parseInt(m.slice(4,6),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0, s=max? d/max:0, v=max;
    if(d){
      switch(max){
        case r: h=(g-b)/d + (g<b?6:0); break;
        case g: h=(b-r)/d + 2; break;
        case b: h=(r-g)/d + 4; break;
      }
      h *= 60;
    }
    return [h,s,v];
  }
  
function rgbToHex(rgb){
  const m = String(rgb).match(/\d+/g)||[0,0,0];
  return '#'+m.slice(0,3).map(n=>Number(n).toString(16).padStart(2,'0')).join('');
}
  function repaintSV(){
    // слой 1: чистый цвет по H с полной насыщенностью и яркостью
    const [r,g,b] = hsv2rgb(H,1,1);
    const grdX = ctx.createLinearGradient(0,0,sv.width,0);
    grdX.addColorStop(0, 'rgb(255,255,255)');
    grdX.addColorStop(1, `rgb(${r},${g},${b})`);
    ctx.fillStyle = grdX; ctx.fillRect(0,0,sv.width,sv.height);

    const grdY = ctx.createLinearGradient(0,0,0,sv.height);
    grdY.addColorStop(0, 'rgba(0,0,0,0)');
    grdY.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grdY; ctx.fillRect(0,0,sv.width,sv.height);

    // курсор
    const x = Math.round(S * sv.width);
    const y = Math.round((1 - V) * sv.height);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI*2); ctx.strokeStyle = '#000'; ctx.stroke();

    const [pr,pg,pb] = hsv2rgb(H,S,V);
    preview.style.background = rgb2hex(pr,pg,pb);
  }

  function svFromEvent(e){
    const rect = sv.getBoundingClientRect();
    const cx = (e.touches? e.touches[0].clientX: e.clientX) - rect.left;
    const cy = (e.touches? e.touches[0].clientY: e.clientY) - rect.top;
    S = Math.min(1, Math.max(0, cx / rect.width));
    V = 1 - Math.min(1, Math.max(0, cy / rect.height));
    repaintSV();
  }

  function open(targetEl){
  targetInput = targetEl;
    
// Показываем чекбокс "Прозрачный фон" только для выбора ФОНА в режиме Фото
const isBG = (targetInput && targetInput.id === 'bg');
const isPhotoMode = (state.mode === 'photo') || (app?.ui?.tabPhoto?.classList?.contains('active'));
rowTransparent.hidden = !(isBG && isPhotoMode);

// Синхронизируем чекбокс и блокируем палитру при включении
cbTransparent.checked = !!state.transparentBg;
modal.classList.toggle('cp-disabled', cbTransparent.checked && isBG && isPhotoMode);
if (!isBG) modal.classList.remove('cp-disabled');
    
  // берём стартовое значение из поля
  [H,S,V] = hex2hsv(targetInput.value || '#8ac7ff');

  openedAt = Date.now();
  // небольшой defer — чтобы «хвост» клика не закрыл модал мгновенно
  setTimeout(() => {
    modal.hidden = false;
    repaintHue();      
    repaintSV();
  }, 0);
}

  function close(){ modal.hidden = true; }

  // события

  const drag = (on)=> (ev)=>{ ev.preventDefault(); on(ev);
    const move = (e)=> on(e);
    const up = ()=>{ window.removeEventListener('mousemove', move);
                     window.removeEventListener('touchmove', move);
                     window.removeEventListener('mouseup', up);
                     window.removeEventListener('touchend', up); };
    window.addEventListener('mousemove', move, { passive:false });
    window.addEventListener('touchmove', move, { passive:false });
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
  };
  sv.addEventListener('mousedown', drag(svFromEvent), { passive:false });
  sv.addEventListener('touchstart', drag(svFromEvent), { passive:false });
function repaintHue(){
  const hc = h.getContext('2d');
  const rect = h.getBoundingClientRect();
  const W = Math.round(rect.width), Hpx = Math.round(rect.height);
  if (h.width !== W || h.height !== Hpx){ h.width = W; h.height = Hpx; }

  const grd = hc.createLinearGradient(0,0,0,Hpx);
  grd.addColorStop(0/6,'#f00'); grd.addColorStop(1/6,'#ff0');
  grd.addColorStop(2/6,'#0f0'); grd.addColorStop(3/6,'#0ff');
  grd.addColorStop(4/6,'#00f'); grd.addColorStop(5/6,'#f0f');
  grd.addColorStop(6/6,'#f00');
  hc.fillStyle = grd; hc.fillRect(0,0,W,Hpx);

  const y = Math.round((H/360) * Hpx);
  hc.strokeStyle = '#fff'; hc.lineWidth = 2;
  hc.beginPath(); hc.moveTo(0,y+0.5); hc.lineTo(W,y+0.5); hc.stroke();
  hc.strokeStyle = '#000';
  hc.beginPath(); hc.moveTo(0,y+2.5); hc.lineTo(W,y+2.5); hc.stroke();
}

function hueFromEvent(e){
  const rect = h.getBoundingClientRect();
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  const clamped = Math.min(Math.max(cy, 0), rect.height);
  H = (clamped / rect.height) * 360;
  repaintHue();
  repaintSV();
}

const dragHue = (on) => (ev)=>{ ev.preventDefault();
  on(ev);
  const move = (e)=> on(e);
  const up = ()=>{ window.removeEventListener('mousemove', move);
                   window.removeEventListener('touchmove', move);
                   window.removeEventListener('mouseup', up);
                   window.removeEventListener('touchend', up); };
  window.addEventListener('mousemove', move, { passive:false });
  window.addEventListener('touchmove', move, { passive:false });
  window.addEventListener('mouseup', up);
  window.addEventListener('touchend', up);
};
h.addEventListener('mousedown',  dragHue(hueFromEvent), { passive:false });
h.addEventListener('touchstart', dragHue(hueFromEvent), { passive:false });

  cancel.addEventListener('click', close);
ok.addEventListener('click', ()=> {
  const pickedIsBG = (targetInput && targetInput.id === 'bg');
  const isPhotoMode = (state.mode === 'photo') || (app?.ui?.tabPhoto?.classList?.contains('active'));
  const wantTransparent = cbTransparent.checked && pickedIsBG && isPhotoMode;

  if (wantTransparent) {
    // Включаем прозрачный фон только для Фото
    state.transparentBg = true;

    // В UI показываем "чёрный", а экспорт будет прозрачный
    app.out.style.backgroundColor   = '#000000';
    app.stage.style.backgroundColor = '#000000';
    app.ui.bg.classList.add('transparent');

    // Сохраним текущий выбранный цвет в инпут на будущее
    const swatch = document.getElementById('cp-preview-swatch'); // если есть превью-свотч
    const hex = swatch ? rgbToHex(getComputedStyle(swatch).backgroundColor) : targetInput.value;
    if (targetInput) {
      targetInput.value = hex;
      targetInput.dispatchEvent(new Event('input', { bubbles:true }));
    }
  } else {
    // Обычная установка цвета
    const [r,g,b] = hsv2rgb(H,S,V);
    const hex = rgb2hex(r,g,b);
    if (targetInput) {
      targetInput.value = hex;
      targetInput.dispatchEvent(new Event('input', { bubbles:true }));
    }

    // Если это фон — выключаем прозрачность и возвращаем цвет
    if (pickedIsBG) {
      if (state.transparentBg) {
        state.transparentBg = false;
        app.ui.bg.classList.remove('transparent');
      }
      app.out.style.backgroundColor   = state.background;
      app.stage.style.backgroundColor = state.background;
    }
  }

  close();
});

  // клик по фону — закрыть
  modal.querySelector('.cp-backdrop').addEventListener('click', (ev) => {
  // игнорируем первый «хвостовой» клик сразу после открытия
  if (Date.now() - openedAt < 200) return;
  close();
});

  return { open, close };
})();

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
// --- ПИНЧ-ЗУМ ТОЛЬКО ДЛЯ СЦЕНЫ ---
(function enableStagePinchZoom(){
  const el = app.stage;
  const pts = new Map();
  let active = false;
  let d0 = 0, s0 = 1;

  const getDist = () => {
    const a = Array.from(pts.values());
    if (a.length < 2) return 0;
    const dx = a[0].x - a[1].x, dy = a[0].y - a[1].y;
    return Math.hypot(dx, dy);
  };

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') e.preventDefault?.();
    el.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      active = true;
      d0 = getDist() || 1;
      s0 = state.viewScale;
    }
  }, { passive:false });

  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active && pts.size === 2) {
      const d = getDist() || 1;
      const ratio = d / d0;
      state.viewScale = Math.max(1, Math.min(3, s0 * ratio));
      fitAsciiToViewport();
    }
  }, { passive:false });

  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) active = false;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
})();

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

  // если прозрачный фон выключен — показываем выбранный цвет как обычно
  if (!state.transparentBg) {
    app.out.style.backgroundColor  = state.background;
    app.stage.style.backgroundColor = state.background;
  }

  // синхронизация пресета
  if (app.ui.style){
    const m = detectPreset(state.color, state.background);
    app.ui.style.value = (m==='custom'?'custom':m);
  }
});

// На Android перехватываем нативный color-picker и открываем наш
if (/Android/i.test(navigator.userAgent)) {
  
const trap = (el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    CP.open(el);
  }, { passive:false });
};
  
  if (app.ui.fg) trap(app.ui.fg);
  if (app.ui.bg) trap(app.ui.bg);
}

// --- Кнопки режимов внизу (с приоритетным вызовом file picker) ---
 app.ui.modeLive.addEventListener('click', () => {
   updateModeTabs('live');
   setMode('live');
 });
// --- ФОТО
app.ui.modePhoto.addEventListener('click', () => {
  if (!app.ui.filePhoto) return;

  app.ui.filePhoto.value = '';

  const cleanup = () => {
    app.ui.filePhoto.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onReturn);
    window.removeEventListener('focus', onReturn);
  };

  const onChange = () => {
    cleanup();
    updateModeTabs('photo');   // подсветка только при реальном выборе
    setMode('photo');
  };

  const onReturn = () => {
    if (!document.hidden) {
      setTimeout(() => {
        if (!app.ui.filePhoto.files || app.ui.filePhoto.files.length === 0) {
          cleanup();
          updateModeTabs('live');   // жёстко вернуть подсветку в LIVE
          setMode('live');
        }
      }, 50);
    }
  };

  app.ui.filePhoto.addEventListener('change', onChange, { once: true });
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);

  app.ui.filePhoto.click();
});

// --- ВИДЕО (аналогично)
app.ui.modeVideo.addEventListener('click', () => {
  if (!app.ui.fileVideo) return;

  app.ui.fileVideo.value = '';

  const cleanup = () => {
    app.ui.fileVideo.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onReturn);
    window.removeEventListener('focus', onReturn);
  };

  const onChange = () => {
    cleanup();
    updateModeTabs('video');
    setMode('video');
  };

  const onReturn = () => {
    if (!document.hidden) {
      setTimeout(() => {
        if (!app.ui.fileVideo.files || app.ui.fileVideo.files.length === 0) {
          cleanup();
          updateModeTabs('live');
          setMode('live');
        }
      }, 50);
    }
  };

  app.ui.fileVideo.addEventListener('change', onChange, { once: true });
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('focus', onReturn);

  app.ui.fileVideo.click();
});

// --- Снимок в LIVE (тот же пайплайн, что и ФОТО) ---
if (app.ui.camShutter && app.ui.camBtnCore) {
  const pressOn  = () => { app.ui.camBtnCore.src = 'assets/camera_button_active.svg'; app.ui.camShutter.classList.add('active'); };
  const pressOff = () => { app.ui.camBtnCore.src = 'assets/camera_button.svg';          app.ui.camShutter.classList.remove('active'); };

  let shotLock = false;

  const doShot = async (e) => {
    e.preventDefault();
    if (state.mode !== 'live') return;
    if (shotLock) return;
    shotLock = true;

    try {
      pressOn();
      // 1) формируем PNG из текущего ASCII (без интерфейса — это отрисовка текста в канвас)
      // 2) внутри savePNG() вызывается downloadBlob(blob, ...) → /api/upload
      await Promise.resolve(savePNG());
    } catch (err) {
      console.error('[camShot]', err);
    } finally {
      setTimeout(pressOff, 180);  // короткая «анимация нажатия»
      setTimeout(() => { shotLock = false; }, 400);
    }
  };

  app.ui.camShutter.addEventListener('pointerdown', (e)=>{ if (state.mode==='live'){ e.preventDefault(); pressOn(); } }, {passive:false});
  app.ui.camShutter.addEventListener('pointerup',   doShot, {passive:false});
  app.ui.camShutter.addEventListener('click',       doShot, {passive:false});
  app.ui.camShutter.addEventListener('pointercancel', ()=>pressOff());
}

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
  if (app._lastImageURL) { try { URL.revokeObjectURL(app._lastImageURL); } catch(_) {} }
const urlImg = URL.createObjectURL(f);
img.src = urlImg;
app._lastImageURL = urlImg;

});

// --- Выбор видео из галереи (рабочий пайплайн + чистим ASCII до готовности)
app.ui.fileVideo.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;

  // остановим live (и любые старые источники)
  stopStream();
  try { app.vid.pause?.(); } catch(_) {}
  try { app.vid.removeAttribute('src'); } catch(_) {}
  app.vid.srcObject = null;

  // пока видео не готово — убираем «застывший» кадр
  app.out.textContent = '';
  app.ui.placeholder.hidden = false;

  // освободим старый blob, если был
  if (app._lastVideoURL) { try { URL.revokeObjectURL(app._lastVideoURL); } catch(_) {} }
  const url = URL.createObjectURL(f);
  app._lastVideoURL = url;

  // атрибуты автозапуска/зацикливания
  app.vid.setAttribute('playsinline','');
  app.vid.setAttribute('autoplay','');
  app.vid.setAttribute('muted','');
  app.vid.playsInline = true;
  app.vid.autoplay   = true;
  app.vid.muted      = true;
  app.vid.loop       = true;
  app.vid.setAttribute('loop','');

  // fallback loop для iOS
  if (app._loopFallback) app.vid.removeEventListener('ended', app._loopFallback);
  app._loopFallback = () => {
    if (!state.isRecording && state.mode === 'video' && app.vid.loop) {
      try { app.vid.currentTime = 0; app.vid.play(); } catch(_) {}
    }
  };
  app.vid.addEventListener('ended', app._loopFallback);

  // как только метаданные есть — прячем плейсхолдер, подгоняем сетку и всё
  app.vid.onloadedmetadata = () => {
    if (app.vid.videoWidth > 0 && app.vid.videoHeight > 0) {
      app.ui.placeholder.hidden = true;
      requestAnimationFrame(() => {
        const { w, h } = updateGridSize(); refitFont(w, h);
      });
    }
  };

  app.vid.oncanplay = () => {
    app.ui.placeholder.hidden = true;
    requestAnimationFrame(() => {
      const { w, h } = updateGridSize(); refitFont(w, h);
    });
  };

  // подключаем источник и стартуем
  app.vid.src = url;
  try { await app.vid.play?.(); } catch(_) {}

  // видео — не зеркалим
  state.mirror = false;
});

// --- ЕДИНАЯ функция сохранения ---
function doSave() {
  if (state.mode === 'photo') {
    hudSet('PNG: экспорт…');
    savePNG();
  } else if (state.mode === 'video') {
    if (!app.vid || (!app.vid.src && !app.vid.srcObject)) {
      alert('Нет выбранного видео.');
      return;
    }
    hudSet('VIDEO: запись… (дождитесь окончания)');
    saveVideo();
  }
}

// Кнопка в тулбаре
app.ui.save.addEventListener('click', doSave);

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
    lbl.textContent = state.invert ? 'ИНВ3РСИЯ: ВКЛ' : 'ИНВ3РСИЯ: ВЫКЛ';
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
if (tg) expandSheetASAP();
// 1) Жёстко фиксируем отсутствие инверсии до первого кадра
state.invert = false;
if (app.ui.invert) app.ui.invert.checked = false;
{
  const lbl = document.getElementById('invert_label');
  if (lbl) lbl.textContent = 'ИНВ3РСИЯ: ВЫКЛ';
}

bindUI();

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





