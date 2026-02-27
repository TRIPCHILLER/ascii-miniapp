(() => {
  
/* NAV: search "@section "
   @section UTILS
   @section STATE_CONFIG
   @section STYLE_PRESETS_FONTS
   @section TELEGRAM_WEBAPP_API
   @section UI_INTERACTION_GUARDS
   @section MODE_LIVE_CAMERA
   @section CAMERA_STREAM_LIFECYCLE
   @section ASCII_RENDER_ENGINE
   @section VIEWPORT_CROP_FULLSCREEN
   @section FULLSCREEN_CONTROLS
   @section UI_BINDINGS
   @section STAGE_GESTURES
   @section MODE_SWITCHING
   @section MODE_PHOTO
   @section MODE_VIDEO_GIF
   @section COLOR_PALETTES_PICKER
   @section EXPORT_SAVE_SHARE
   @section BOOTSTRAP_INIT
*/
  
  // ============== УТИЛИТЫ ==============
  // @section UTILS
  const $ = s => document.querySelector(s);
  const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
  const API_BASE = 'https://api.tripchiller.com';
  const DEBUG_TEXT = /(?:\?|&)DEBUG_TEXT=1(?:&|$)/.test(window.location.search) || window.DEBUG_TEXT === 1;

  function apiUrl(path) {
    const cleanPath = `/${String(path || '').replace(/^\/+/, '')}`;
    const base = String(API_BASE || window.location.origin).replace(/\/+$/, '');
    const normalizedBase = base.replace(/\/api$/i, '');
    const normalizedPath = cleanPath.replace(/^\/api\//i, '/');
    return `${normalizedBase}/api${normalizedPath}`;
  }
    // Портрет-лок (чтобы не крутилось в горизонталь, где получится каша)
  let orientationLockRequested = false;

  async function lockPortraitIfSupported() {
    // API есть только в части браузеров, поэтому всё в try/catch
    try {
      if (
        typeof screen !== 'undefined' &&
        screen.orientation &&
        typeof screen.orientation.lock === 'function'
      ) {
        await screen.orientation.lock('portrait');
      }
    } catch (e) {
      // На iOS и в части вебвью просто вылетит NotSupportedError — игнорируем
      console.warn('Orientation lock not supported:', e && e.name);
    }
  }

// ==== TEMP HUD (disabled) ====
function hudSet(txt){ /* HUD отключен */ }
  
// ---- BUSY overlay helpers ----
// @section HELPERS_UTILS
let busyLock = false; // <— не даём спрятать overlay, пока true

function busyShow(msg){
  // как только показываем рендер/аплоад-оверлей — сразу прячем панель настроек,
  // чтобы она не нависала над логотипом и блюром
  if (app?.ui?.settings) {
    app.ui.settings.setAttribute('hidden', '');
  }

  if (app.ui.busyText) {
    app.ui.busyText.textContent = msg || 'Пожалуйста, подождите…';
  }
  if (app.ui.busy) {
    app.ui.busy.hidden = false;
  }
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
      modeChooser: $('#modeChooser'),
      colorRow: $('#colorRow'),
      resetModeBtn: $('#resetModeBtn'),
      textSizeWrap: $('#textSizeWrap'),
      textSizePreset: $('#textSizePreset'),
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
    camControls:  $('#camControls'),
    flashBtn:  $('#flashBtn'),
    flashIcon: $('#flashIcon'),
    // таймер
    timerOffBtn:  $('#timerOffBtn'),
    timer3Btn:    $('#timer3Btn'),
    timer10Btn:   $('#timer10Btn'),
    timerOffIcon: $('#timerOffIcon'),
    timer3Icon:   $('#timer3Icon'),
    timer10Icon:  $('#timer10Icon'),
    // оверлей отсчёта
    timerOverlay: $('#camTimerOverlay'),
    timerNumber:  $('#camTimerNumber'),
}
  };
  // ===== Telegram WebApp (если открыто внутри Telegram) =====
  // @section TELEGRAM_WEBAPP_API
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
  // @section UI_INTERACTION_GUARDS
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
// Единственный источник правды: когда блокировать палитру ФОНА
function syncBgPaletteLock(){
  const mustLock = (state.mode === 'photo') && !!state.transparentBg;
  if (app?.ui?.bg){
    app.ui.bg.disabled = false; // ← гарантируем, что не disabled
    app.ui.bg.classList.toggle('is-disabled', mustLock); // только визуальная «серость»
  }
}

function syncFpsVisibility(){
  if (!app.ui.fpsWrap) return;
  // в режиме ФОТО скрываем, в остальных показываем
  app.ui.fpsWrap.hidden = (state.mode === 'photo');
}
  // ==== FONT STACKS (добавлено) ====
  // @section STYLE_PRESETS_FONTS
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
// ============== STATE / DEFAULT CONFIG ==============
// @section STATE_CONFIG
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
    camBlocked: false,
    imageEl: null,          // <img> для режима ФОТО
    
      // ===== GIF-анимация без видео-тегов =====
    gifImage: null,         // (оставляем на всякий, но больше не используем)
    gifFrames: null,        // массив { delay, imageData }
    gifDuration: 0,         // полная длительность GIF в мс
    gifFrameIndex: 0,       // текущий индекс кадра
    gifTime: 0,             // накапливаем время внутри цикла
    gifCanvas: null,        // offscreen-canvas для текущего кадра
    gifCtx: null,           // контекст для gifCanvas
    _gifLastTs: 0,          // последний ts из loop()
    
    isRecording: false,     // запись видео (экспорт)
    recorder: null,
    recordChunks: [],
        recordDims: null,       // <— фиксированные размеры экспортного видео (W/H/шаги)
    lastGrid: { w:0, h:0 }, // запоминаем сетку для экспорта
    viewScale: 1,           // доп. масштаб ASCII внутри #stage
    viewX: 0.5,             // центр «окна» по X (0..1)
    viewY: 0.5,             // центр «окна» по Y (0..1)
    flashEnabled: false,
    timerSeconds: 0,
    visorMode: 'image',
    textSize: 'm',
  };

  const TEXT_CHARSETS = {
    DOTS: ' .,:;i1tfLCG08@',
    PIXEL: ' .:-=+*#%@',
    MICRO: ' .:*'
  };

  function isTextMode(){ return state.visorMode === 'text'; }

  function applyVisorModeUi() {
    document.body.classList.toggle('visor-text', isTextMode());
    if (isTextMode()) {
      state.mode = (state.mode === 'video') ? 'live' : state.mode;
      state.color = '#ffffff';
      state.background = '#000000';
      state.transparentBg = false;
      app.out.style.color = '#ffffff';
      app.out.style.backgroundColor = '#000000';
      app.stage.style.backgroundColor = '#000000';
      if (app.ui.fg) app.ui.fg.value = '#ffffff';
      if (app.ui.bg) app.ui.bg.value = '#000000';
      if (app.ui.colorRow) app.ui.colorRow.hidden = true;
      if (app.ui.textSizeWrap) app.ui.textSizeWrap.hidden = false;
    } else {
      if (app.ui.colorRow) app.ui.colorRow.hidden = false;
      if (app.ui.textSizeWrap) app.ui.textSizeWrap.hidden = true;
    }
    applyWidthLimitsForMode();
    rebuildCharsetOptions();
  }

  let modeChooserListenerBound = false;
  function bindModeChooserOnce() {
    if (!app.ui.modeChooser || modeChooserListenerBound) return;
    app.ui.modeChooser.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-visor-mode]');
      if (!btn) return;
      chooseVisorMode(btn.dataset.visorMode);
    });
    modeChooserListenerBound = true;
  }

  function rebuildCharsetOptions(){
    if (!app.ui.charset) return;
    const oldVal = app.ui.charset.value;
    if (isTextMode()) {
      app.ui.charset.innerHTML = `
        <option value="${TEXT_CHARSETS.DOTS}">DOTS</option>
        <option value="${TEXT_CHARSETS.PIXEL}">PIXEL</option>
        <option value="${TEXT_CHARSETS.MICRO}">MICRO</option>
        <option value="CUSTOM">(РУЧН0Й ВВ0Д)</option>`;
      const val = [TEXT_CHARSETS.DOTS, TEXT_CHARSETS.PIXEL, TEXT_CHARSETS.MICRO, 'CUSTOM'].includes(oldVal) ? oldVal : TEXT_CHARSETS.DOTS;
      app.ui.charset.value = val;
      state.charset = autoSortCharset(val === 'CUSTOM' ? (app.ui.customCharset.value || TEXT_CHARSETS.DOTS) : val);
    } else {
      if (!app.ui.charset.dataset.imageModeOptions) {
        app.ui.charset.dataset.imageModeOptions = app.ui.charset.innerHTML;
      }
      app.ui.charset.innerHTML = app.ui.charset.dataset.imageModeOptions;
      app.ui.charset.value = oldVal || app.ui.charset.options[0]?.value || '@%#*+=-:. ';
      state.charset = autoSortCharset(app.ui.charset.value);
    }
    app.ui.charset.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function chooseVisorMode(mode){
    state.visorMode = (mode === 'text') ? 'text' : 'image';
    localStorage.setItem('visorMode', state.visorMode);
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = true;
    applyVisorModeUi();
  }

  function initVisorMode(){
    bindModeChooserOnce();
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = false;
  }

  // ===== ВСПЫШКА (иконки + подсветка фронталки + torch для тыловой) =====
// @section MODE_LIVE_CAMERA
  // Пытаемся включить аппаратную вспышку у активного видео-трека (если поддерживается)
  function updateTorch(enabled) {
    try {
      const s = state.camStream;
      if (!s) return;
      const track = s.getVideoTracks && s.getVideoTracks()[0];
      if (!track) return;

      const caps = track.getCapabilities && track.getCapabilities();
      if (!caps || !caps.torch) return; // устройство не умеет torch – молча выходим

      track.applyConstraints({
        advanced: [{ torch: !!enabled }]
      }).catch(() => {});
    } catch (_) {
      // если что-то пошло не так — просто молчим, без падения
    }
  }

 function updateFlashUI() {
  const isLive      = (state.mode === 'live');
  const haveStream  = !!state.camStream && !state.camBlocked;

  // реальный флаг "вспышка активна прямо сейчас"
  const flashOn = !!state.flashEnabled && isLive && haveStream;
  const isFront = (state.facing === 'user');
  const isRear  = (state.facing === 'environment');

  // --- иконка вспышки ---
  if (app.ui.flashIcon) {
    app.ui.flashIcon.src = flashOn
      ? 'assets/flash_active.svg'
      : 'assets/flash_no_active.svg';
  }

  // --- фронталка: размазанное белое свечение по краям ---
  if (app.stage) {
    if (flashOn && isFront) {
      app.stage.classList.add('flash-front');
    } else {
      app.stage.classList.remove('flash-front');
    }
  }

  // --- фронталка: инверсия ВСЕГО UI (верх/низ/иконки) ---
  const body = document.body;
  if (body) {
    if (flashOn && isFront) {
      body.classList.add('flash-front-ui');
    } else {
      body.classList.remove('flash-front-ui');
    }
  }

  // --- тыловая: аппаратная вспышка (torch), если умеет ---
  updateTorch(flashOn && isRear);
}

  function updateTimerUI() {
    if (!app.ui.timerOffIcon || !app.ui.timer3Icon || !app.ui.timer10Icon) return;

    const t = state.timerSeconds | 0;
    const offActive = (t === 0);
    const t3Active  = (t === 3);
    const t10Active = (t === 10);

    app.ui.timerOffIcon.src = offActive
      ? 'assets/disable_timer_active.svg'
      : 'assets/disable_timer_no_active.svg';

    app.ui.timer3Icon.src = t3Active
      ? 'assets/timer_3sec_active.svg'
      : 'assets/timer_3sec_no_active.svg';

    app.ui.timer10Icon.src = t10Active
      ? 'assets/timer_10sec_active.svg'
      : 'assets/timer_10sec_no_active.svg';
  }
  
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
// Отдельный canvas под GIF-кадры
state.gifCanvas = document.createElement('canvas');
state.gifCtx    = state.gifCanvas.getContext('2d');

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
function currentSource(){
  // Фото: обычный <img>
  if (state.mode === 'photo' && state.imageEl) {
    const el = state.imageEl;
    const w = el.naturalWidth || el.width || 1;
    const h = el.naturalHeight || el.height || 1;
    updateHud(`src=img ${w}x${h}`);
    return { el, w, h, kind:'image' };
  }

  // ВИДЕО + GIF: берём offscreen-canvas с текущим кадром
  if (state.mode === 'video' && state.gifFrames && state.gifCanvas && state.gifFrames.length) {
    const el = state.gifCanvas;
    const w = el.width  || 1;
    const h = el.height || 1;
    updateHud(`src=gif ${w}x${h}`);
    return { el, w, h, kind:'gifvideo' };
  }

  // Обычное видео через <video>
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
  // @section CAMERA_STREAM_LIFECYCLE
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
    updateFlashUI();
    return true;

  } catch (err) {
    state.camBlocked = true;
    const msg = cameraErrorToText(err);
    showErrorPopup(msg.title, msg.message);
    return false;
  }
}

  // ============== РЕНДЕРИНГ ==============
  // @section ASCII_RENDER_ENGINE
  let raf = null;
  let lastFrameTime = 0;
// Универсальная установка лимитов ширины с учётом платформы и режима
function applyWidthLimitsForMode(init = false) {
  let min, max;

  if (isTextMode()) {
    min = 25;
    max = 75;
  } else if (isMobile) {
    if (state.mode === 'live') {
      min = 50;  max = 100;
    } else {
      min = 50;  max = 150;
    }
  } else {
    // Десктоп оставляем как было
    min = 75; max = 150;
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
    syncBgPaletteLock();
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

// ФИКС: на мобилках всегда рисуем LIVE в 16:9 (и с панелями, и в режиме «Скрыть»)
if (isMobile && state.mode === 'live') {
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
// Обновление текущего кадра GIF по времени ts
function updateGifFrame(ts) {
  if (state.mode !== 'video') return;
  if (!state.gifFrames || !state.gifFrames.length) return;
  if (!state.gifCanvas || !state.gifCtx) return;

  if (!state._gifLastTs) state._gifLastTs = ts;
  const dt = ts - state._gifLastTs;
  state._gifLastTs = ts;

  state.gifTime = (state.gifTime || 0) + dt;

  const total = state.gifDuration || 0;
  if (total <= 0) return;

  const frames = state.gifFrames;
  let t = state.gifTime % total;
  let acc = 0;
  let idx = 0;

  for (let i = 0; i < frames.length; i++) {
    acc += frames[i].delay;
    if (t < acc) { idx = i; break; }
  }

  if (idx === state.gifFrameIndex && state.gifCanvas.width) {
    return; // кадр не сменился — ничего не перерисовываем
  }

  state.gifFrameIndex = idx;
  const fr = frames[idx];
  const W = fr.imageData.width;
  const H = fr.imageData.height;

  if (state.gifCanvas.width !== W || state.gifCanvas.height !== H) {
    state.gifCanvas.width  = W;
    state.gifCanvas.height = H;
  }
  state.gifCtx.putImageData(fr.imageData, 0, 0);
}

  function loop(ts) {
    raf = requestAnimationFrame(loop);

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;
    // если активен GIF — обновляем его кадр
    updateGifFrame(ts);

    const src = currentSource();
    if (!src) return;

    const { w, h } = updateGridSize();

    // Подготовка трансформа для зеркала
    // mirror = true ⇒ рисуем с scaleX(-1), чтобы получить НЕ-зеркальную картинку
    
// --- LIVE cover-crop под 16:9 на мобилках (и fullscreen, и с панелями) ---
const isFsLike = isFullscreenLike();

let sx = 0, sy = 0, sw = src.w, sh = src.h;
// ФИКС: LIVE на мобилках всегда кадрируем под 9:16, даже с открытыми панелями
if (isMobile && state.mode === 'live') {
  const targetWH = 9/16; // W/H
  const srcWH = src.w / src.h;
  if (srcWH > targetWH) {
    sw = Math.round(src.h * targetWH);
    sx = Math.round((src.w - sw) / 2);
  } else if (srcWH < targetWH) {
    sh = Math.round(src.w / targetWH);
    sy = Math.round((src.h - sh) / 2);
  }
  // дальше код оставляешь как был
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
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
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
// Конвертация GIF → MP4 на клиенте через ffmpeg.wasm
async function convertGifToMp4(file){
  const { ff, fetchFile } = await ensureFFmpeg();

  const inName  = 'gif_in.gif';
  const outName = 'gif_out.mp4';

  // подчистим остатки прошлых запусков
  try { ff.FS('unlink', inName); } catch(e){}
  try { ff.FS('unlink', outName); } catch(e){}

  // кладём GIF в виртуальную ФС ffmpeg
  ff.FS('writeFile', inName, await fetchFile(file));

  // простая конвертация GIF → MP4 с нормальным плеем
  await ff.run(
    '-i', inName,
    '-movflags', 'faststart',
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-an',
    outName
  );

  const data = ff.FS('readFile', outName);
  return new Blob([data.buffer], { type: 'video/mp4' });
}

// ---------- EXPORT HELPERS (PNG/VIDEO) ----------
  function hexToRgb(hex){
  hex = String(hex).trim();
  if (hex.startsWith('#')) hex = hex.slice(1);

  if (hex.length === 3){
    hex = hex.split('').map(ch => ch + ch).join('');
  }

  const num = parseInt(hex || '000000', 16);
  return [
    (num >> 16) & 255,
    (num >> 8)  & 255,
    num & 255
  ];
}
// Жёсткая пикселизация ASCII-канваса: убираем антиалиас
function snapAsciiPixels(ctx, W, H, fgHex, bgHex, transparentBg){
  const img = ctx.getImageData(0, 0, W, H);
  const data = img.data;

  const [fr, fg, fb] = hexToRgb(fgHex || '#ffffff');
  let br = 0, bg = 0, bb = 0;

  if (!transparentBg && bgHex){
    [br, bg, bb] = hexToRgb(bgHex);
  }

  for (let i = 0; i < data.length; i += 4){
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (transparentBg){
      // при прозрачном фоне: либо полностью прозрачный, либо полностью цвет текста
      if (a > 32){          // порог можно подправить (16–64)
        data[i]     = fr;
        data[i + 1] = fg;
        data[i + 2] = fb;
        data[i + 3] = 255;
      } else {
        data[i + 3] = 0;
      }
    } else {
      // непрозрачный фон: выбираем, к какому цвету пиксель ближе — к фону или к тексту
      const dToBg = Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb);
      const dToFg = Math.abs(r - fr) + Math.abs(g - fg) + Math.abs(b - fb);

      if (dToFg <= dToBg){
        data[i]     = fr;
        data[i + 1] = fg;
        data[i + 2] = fb;
        data[i + 3] = 255;
      } else {
        data[i]     = br;
        data[i + 1] = bg;
        data[i + 2] = bb;
        data[i + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
}

// Рендер готового ASCII-текста в canvas для экспорта
// Рендер ASCII-текста в canvas для экспорта — с сохранением исходного соотношения сторон
function renderAsciiToCanvas(text, cols, rows, scale = 2.5){
  const cvs = app.ui.render;
  const c = cvs.getContext('2d');

  const ff   = getComputedStyle(app.out).fontFamily || 'monospace';
  const fsPx = 14;  // базовый размер для экспорта
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

  // 🔧 После отрисовки текста — жёстко «щелкаем» пиксели,
  // убирая сглаживание и оставляя только фон/текст.
  snapAsciiPixels(c, W, H, state.color, state.background, state.transparentBg);
}

// PNG (режим ФОТО)
async function savePNG(){
  if (isTextMode()) {
    await sendAsciiTextToBot();
    return;
  }
  const full = app.out.textContent || '';
  if (!full.trim()) { alert('Нечего сохранять'); return; }

  const crop = getCropWindow();
  const text = cropAsciiText(full, crop);

  renderAsciiToCanvas(text, crop.cols, crop.rows, 2.5);
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
async function saveVideo(){
  if (isTextMode()) {
    await sendAsciiTextToBot();
    return;
  }
  if (state.mode !== 'video') {
    alert('Видео-экспорт доступен только в режиме ВИДЕО');
    return;
  }

  const fullNow = app.out.textContent || '';
  if (!fullNow.trim()) {
    alert('Нечего сохранять');
    return;
  }

  // фиксируем «окно» кадрирования на момент старта записи
  const crop = getCropWindow();
  state._recordCrop = crop;

  const mime = pickMime();
  if (!mime) {
    alert('Запись видео не поддерживается на этом устройстве.');
    return;
  }

  // Фиксируем экспортный размер под текущую ASCII-сетку
  const C = state._recordCrop;
  state.recordDims = computeRecordDims(C.cols, C.rows, 2);

  // задаём размер канваса заранее (до captureStream)
  app.ui.render.width  = state.recordDims.W;
  app.ui.render.height = state.recordDims.H;

  const fps = Math.max(5, Math.min(60, state.fps));
  const stream = app.ui.render.captureStream(fps);
  state.recordChunks = [];

  // создаём MediaRecorder с очень высоким битрейтом
  let recorder;
  try {
    const bpp = 0.07; // эмпирически норм для «чистого» ASCII-видео
    const vbr = Math.round(
      (state.recordDims.W || 1280) *
      (state.recordDims.H || 720) *
      fps * bpp
    );

    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: Math.max(4_000_000, Math.min(20_000_000, vbr))
    });
  } catch (e) {
    console.warn('MediaRecorder error:', e);
    alert('Браузер не дал записать видео. Попробуй другой браузер или устройство.');
    return;
  }

  state.recorder = recorder;

  // временно отключаем loop у <video>, чтобы поймать ended
  const wasLoop = !!(app.vid && app.vid.loop === true);
  if (app.vid) {
    try {
      app.vid.loop = false;
      app.vid.removeAttribute('loop');
    } catch (_) {}
  }

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size) {
      state.recordChunks.push(ev.data);
    }
  };

  recorder.onstop = async () => {
    busyHide();

    const blob = new Blob(state.recordChunks, { type: mime });
    state.recordChunks = [];

    const filename = mime.includes('mp4')
      ? 'ascii_visor.mp4'
      : 'ascii_visor.webm';

    await downloadBlob(blob, filename);

    // восстанавливаем loop у видео, если он был
    if (app.vid && wasLoop) {
      try {
        app.vid.loop = true;
        app.vid.setAttribute('loop','');
      } catch (_) {}
    }

    state.isRecording = false;
    state.recordDims = null;
    hudSet('VIDEO: сохранено/отправлено');
  };

  // сбрасываем видео к началу и запускаем (для обычного видео)
  if (app.vid && app.vid.readyState >= 2) {
    try { app.vid.currentTime = 0; } catch (_) {}
    try { app.vid.play?.(); } catch (_) {}
  }

  state.isRecording = true;
  busyShow('ЗАПИСЬ ASCII-ВИДЕО…');
  recorder.start(200);

  const onEnded = () => {
    try { recorder.stop(); } catch (_) {}
  };

  // источник — GIF или обычное видео?
  const isGifSource = !!(state.gifFrames && state.gifFrames.length);

  if (isGifSource) {
    // Пишем ролик длиной ≈ полная длительность GIF (но не более 15 сек)
    const totalMs = (state.gifDuration && state.gifDuration > 0)
      ? state.gifDuration
      : 5000;
    const maxMs = 15000;
    const dur = Math.min(totalMs, maxMs);

    setTimeout(() => {
      if (state.isRecording) onEnded();
    }, dur);
  } else if (app.vid) {
    // Обычное видео — останавливаем по окончанию файла
    app.vid.addEventListener('ended', onEnded, { once:true });
  }
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

      const res = await fetch(apiUrl('/api/upload'), {
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
  
    // === Вписывание ASCII-блока: теперь только zoom по viewScale ===
// === Вписывание ASCII-блока: теперь только zoom по viewScale ===
function fitAsciiToViewport(){
  const out   = app.out;
  const stage = app.stage;
  if (!out || !stage) return;

  // 1. Сбрасываем transform/позицию, чтобы узнать реальный размер ASCII-блока
  out.style.transform = 'translate(-50%, -50%) scale(1)';
  out.style.left = '50%';
  out.style.top  = '50%';

  // 2. Реальные размеры pre c ASCII
  const w = out.scrollWidth;
  const h = out.scrollHeight;

  // 3. Доступные размеры сцены
  const W = stage.clientWidth;
  const H = stage.clientHeight;

  if (!w || !h || !W || !H) {
    out.style.transform = 'translate(-50%, -50%) scale(1)';
    out.style.left = '50%';
    out.style.top  = '50%';
    return;
  }

  // 4. Классический "contain": вписать целиком, без обрезки
  const S = Math.min(W / w, H / h);

  // 5. Применяем базовый масштаб + пользовательский зум
  const base = S * (state.viewScale || 1);

  // 5.1. Жёстко ограничиваем центр «окна» так, чтобы кадр не выходил за экран
  clampViewToBounds(w, h, W, H, base);

  // 6. Дополнительный сдвиг в зависимости от центра «окна» (viewX/viewY)
  const vx = (typeof state.viewX === 'number') ? state.viewX : 0.5;
  const vy = (typeof state.viewY === 'number') ? state.viewY : 0.5;

  const dxPx = (0.5 - vx) * w * base;
  const dyPx = (0.5 - vy) * h * base;

  // Двигаем сам #out, а transform оставляем центрирующим
  out.style.left = `calc(50% + ${dxPx}px)`;
  out.style.top  = `calc(50% + ${dyPx}px)`;
  out.style.transform = `translate(-50%, -50%) scale(${base})`;
}

// Ограничиваем viewX/viewY так, чтобы при текущем масштабе кадр нельзя было утащить
// за пределы видимой области (никакого чёрного фона по краям)
function clampViewToBounds(w, h, W, H, base){
  if (!w || !h || !W || !H || !base) return;

  const visW = w * base;
  const visH = h * base;

  let vx = (typeof state.viewX === 'number') ? state.viewX : 0.5;
  let vy = (typeof state.viewY === 'number') ? state.viewY : 0.5;

  // Горизонталь
  if (visW <= W + 1) {
    // Кадр уже меньше окна — центрируем, таскать нечего
    vx = 0.5;
  } else {
    const maxShiftX = (visW - W) / 2;      // максимальное смещение центра в пикселях
    const minVx = 0.5 - maxShiftX / visW;  // левый предел viewX
    const maxVx = 0.5 + maxShiftX / visW;  // правый предел viewX

    if (vx < minVx) vx = minVx;
    else if (vx > maxVx) vx = maxVx;
  }

  // Вертикаль
  if (visH <= H + 1) {
    vy = 0.5;
  } else {
    const maxShiftY = (visH - H) / 2;
    const minVy = 0.5 - maxShiftY / visH;
    const maxVy = 0.5 + maxShiftY / visH;

    if (vy < minVy) vy = minVy;
    else if (vy > maxVy) vy = maxVy;
  }

  state.viewX = vx;
  state.viewY = vy;
}

// --- Crop-логика: преобразуем зум в «окно» по колонкам/строкам ---
// @section VIEWPORT_CROP_FULLSCREEN
function getCropWindow() {
  const grid = state.lastGrid || { w: 1, h: 1 };
  const scale = Math.max(1, state.viewScale || 1);

  const totalCols = Math.max(1, grid.w || 1);
  const totalRows = Math.max(1, grid.h || 1);

  // сколько колонок/строк реально попадает в «экран» при текущем зуме
  const cols = Math.max(1, Math.round(totalCols / scale));
  const rows = Math.max(1, Math.round(totalRows / scale));

  // текущий центр «окна» в нормированных координатах (0..1)
  let vx = (typeof state.viewX === 'number') ? state.viewX : 0.5;
  let vy = (typeof state.viewY === 'number') ? state.viewY : 0.5;

  // превращаем в центр окна в индексах символов
  let centerCol = vx * totalCols;
  let centerRow = vy * totalRows;

  let col0 = Math.round(centerCol - cols / 2);
  let row0 = Math.round(centerRow - rows / 2);

  const maxCol0 = totalCols - cols;
  const maxRow0 = totalRows - rows;

  if (maxCol0 <= 0) {
    col0 = 0;
  } else {
    if (col0 < 0) col0 = 0;
    else if (col0 > maxCol0) col0 = maxCol0;
  }

  if (maxRow0 <= 0) {
    row0 = 0;
  } else {
    if (row0 < 0) row0 = 0;
    else if (row0 > maxRow0) row0 = maxRow0;
  }

  return { col0, row0, cols, rows, totalCols, totalRows };
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
  // @section FULLSCREEN_CONTROLS
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
  updateFlashUI();
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
    const s = state.camStream;
    // Не убиваем треки и не чистим state.camStream —
    // просто отвязываем поток от <video>, чтобы при повторном
    // входе в КАМЕРУ не запрашивать разрешение заново в рамках сессии.
    if (app.vid) {
      app.vid.pause?.();
      app.vid.srcObject = null;
      app.vid.removeAttribute('src');
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
  if (isTextMode() && newMode === 'video') newMode = 'live';
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
syncBgPaletteLock();
  updateModeTabs(newMode);
  syncFpsVisibility(); // переключаем FPS в зависимости от режима
  applyWidthLimitsForMode();
  // переключаем видимость верхних кнопок
  if (app.ui.fs)   app.ui.fs.hidden   = (newMode!=='live');
  if (app.ui.save) app.ui.save.hidden = (newMode==='live');
  
    // === затвор только в LIVE ===
  if (app.ui.camShutter) app.ui.camShutter.hidden = (newMode!=='live');
    // Новое: ряд иконок (вспышка/таймер) только в режиме КАМЕРА
  if (app.ui.camControls) {
    app.ui.camControls.hidden = (newMode !== 'live');
  }
  // таймер-оверлей скрываем, если мы не в live
  if (app.ui.timerOverlay) {
    app.ui.timerOverlay.hidden = (newMode !== 'live');
    if (newMode !== 'live' && app.ui.timerNumber) {
      app.ui.timerNumber.textContent = '';
    }
  }

  // и пересчитываем визуал вспышки (свечение/torch)
  updateFlashUI();

// Telegram MainButton: показываем только в ФОТО/ВИДЕО, скрываем в LIVE
if (tg) {
mainBtnHide();
}

  // общий сброс зума/плейсхолдера
  state.viewScale = 1;
  state.viewX = 0.5;
  state.viewY = 0.5;
  fitAsciiToViewport();

  // если уходим из PHOTO — очищаем картинку
  if (newMode !== 'photo') state.imageEl = null;

  // если уходим из VIDEO — убираем файл-источник (но не камеру)
    // если уходим из VIDEO — убираем файл-источник (но не камеру)
    if (newMode !== 'video') {
    try {
      if (app.vid && !app.vid.srcObject) {
        app.vid.pause?.();
        app.vid.removeAttribute('src');
      }
    } catch(e){}

    // чистим GIF-режим: убираем картинку и из DOM, и из state
    if (state.gifImage && state.gifImage.parentNode) {
      state.gifImage.parentNode.removeChild(state.gifImage);
    }
    state.gifImage = null;

    if (app._lastGifURL) {
      try { URL.revokeObjectURL(app._lastGifURL); } catch(_) {}
      app._lastGifURL = null;
    }
  }

  if (newMode === 'live') {
    // LIVE: выключаем возможный файл и включаем камеру
    app.ui.placeholder.hidden = true;
    try { app.vid.removeAttribute('src'); } catch(e){}
    if (state.camBlocked) {
  // Камера недоступна: держим плейсхолдер и не трогаем getUserMedia
  app.ui.placeholder.hidden = false;
  app.out.textContent = '';
  updateMirrorForFacing?.();
  return; // выходим без старта камеры
}
    await startStream();
    updateMirrorForFacing?.();
    return;
  }

  // не LIVE → камеру останавливаем
  stopStream();

}
  // === Android ColorPicker override (HSV square + hue slider) ===
  // @section COLOR_PALETTES_PICKER
const CP = (() => {
  const modal = document.getElementById('cp-modal');
  if (!modal) return { open:()=>{}, close:()=>{} };

  const sv = document.getElementById('cp-sv');
  const h  = document.getElementById('cp-h');
  const ok = document.getElementById('cp-ok');
  const cancel = document.getElementById('cp-cancel');

  const rowTransparent = document.getElementById('cp-transparent-row');
  const cbTransparent  = document.getElementById('cp-transparent');

  const preview = document.getElementById('cp-preview-swatch');

  const tabSpectrum  = document.getElementById('cp-tab-spectrum');
  const tabGrid      = document.getElementById('cp-tab-grid');
  const bodySpectrum = document.getElementById('cp-body-spectrum');
  const bodyGrid     = document.getElementById('cp-body-grid');
  const grid         = document.getElementById('cp-grid');

  const ctx = sv.getContext('2d');

  let targetInput = null;
  let H = 210, S = 0.5, V = 0.6;
  let openedAt = 0;
  let mode = 'spectrum'; // 'spectrum' | 'grid'

  function hsv2rgb(h,s,v){
    const f = (n,k=(n+h/60)%6)=> v - v*s*Math.max(Math.min(k,4-k,1),0);
    return [Math.round(f(5)*255), Math.round(f(3)*255), Math.round(f(1)*255)];
  }

  function rgb2hex(r,g,b){
    return '#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  }

  function hex2hsv(hex){
    const m = (hex||'').replace('#','');
    if (m.length < 6) return [H,S,V];
    let r=parseInt(m.slice(0,2),16)/255,
        g=parseInt(m.slice(2,4),16)/255,
        b=parseInt(m.slice(4,6),16)/255;
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

  function hexToRgb(hex){
    hex = String(hex).trim();
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 3){
      hex = hex.split('').map(ch => ch + ch).join('');
    }
    const num = parseInt(hex || '000000', 16);
    return [
      (num >> 16) & 255,
      (num >> 8)  & 255,
      num & 255
    ];
  }

  function repaintSV(){
    const [r,g,b] = hsv2rgb(H,1,1);
    const grdX = ctx.createLinearGradient(0,0,sv.width,0);
    grdX.addColorStop(0, 'rgb(255,255,255)');
    grdX.addColorStop(1, `rgb(${r},${g},${b})`);
    ctx.fillStyle = grdX; ctx.fillRect(0,0,sv.width,sv.height);

    const grdY = ctx.createLinearGradient(0,0,0,sv.height);
    grdY.addColorStop(0, 'rgba(0,0,0,0)');
    grdY.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = grdY; ctx.fillRect(0,0,sv.width,sv.height);

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

  const dragHue = (on)=> (ev)=>{ ev.preventDefault(); on(ev);
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

  // ---------- СЕТКА ГОТОВЫХ ЦВЕТОВ ----------
  const GRID_COLORS = [
    // 1. cерый ряд: от белого к чёрному
    ['#ffffff','#f5f5f5','#e0e0e0','#cccccc','#b3b3b3','#999999',
     '#808080','#666666','#4d4d4d','#333333','#1a1a1a','#000000'],

    // 2. красные (от светлого к тёмному)
    ['#ffe5e5','#ffc7c7','#ffaaaa','#ff8c8c','#ff6f6f','#ff5252',
     '#ff3434','#e02222','#b81b1b','#8f1414','#660d0d','#3d0707'],

    // 3. оранжевые
    ['#ffeede','#ffd7b8','#ffc192','#ffab6c','#ff9445','#ff7e1f',
     '#f56a07','#d25805','#a74404','#7c3203','#532102','#2b1101'],

    // 4. жёлтые
    ['#fff9dc','#fff1b3','#ffe88a','#ffdf61','#ffd638','#ffcd10',
     '#f0bc00','#c99700','#a07300','#785600','#503900','#291d00'],

    // 5. лайм / жёлто-зелёные
    ['#f3ffe0','#e3ffb3','#d3ff86','#c2ff59','#aef53a','#97e124',
     '#7dbe15','#63940f','#496a0a','#304106','#182703','#0b1401'],

    // 6. зелёные
    ['#e1ffe8','#b6ffd0','#8cffb9','#62ffa1','#3cf089','#25d272',
     '#1cad5e','#14844a','#0d5b35','#083322','#041c13','#020e09'],

    // 7. бирюза / циан
    ['#e0fff9','#b3fff4','#86ffef','#59ffe9','#33f2dd','#1fd3c1',
     '#17ac9e','#10857b','#0a5f58','#053a36','#021f1e','#010f0f'],

    // 8. синие
    ['#e0f0ff','#b3d4ff','#86b8ff','#599cff','#2c80ff','#0d66f0',
     '#084fcc','#063da0','#042b73','#031b49','#020f2b','#010714'],

    // 9. фиолет / пурпур
    ['#f2e5ff','#dec0ff','#ca9bff','#b675ff','#a04fff','#8735ea',
     '#6b27c0','#501e95','#37156a','#220d44','#120723','#080312'],

    // 10. розово-фиолетовые
    ['#ffe4f4','#ffc0e6','#ff9bd8','#ff76c9','#ff52bb','#f034a7',
     '#cc278a','#a11f6c','#76174f','#4b1031','#290a1b','#14040d']
  ];

  function ensureGrid(){
    if (!grid || grid.childElementCount) return;
    GRID_COLORS.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'cp-grid-row';
      row.forEach(hex => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cp-grid-swatch';
        btn.style.backgroundColor = hex;
        btn.dataset.hex = hex;
        btn.addEventListener('click', () => {
          [H,S,V] = hex2hsv(hex);
          repaintHue();
          repaintSV();
        });
        rowEl.appendChild(btn);
      });
      grid.appendChild(rowEl);
    });
  }

  function setMode(newMode){
    mode = newMode === 'grid' ? 'grid' : 'spectrum';

    if (bodySpectrum) bodySpectrum.hidden = (mode !== 'spectrum');
    if (bodyGrid)     bodyGrid.hidden     = (mode !== 'grid');

    if (tabSpectrum) {
      tabSpectrum.classList.toggle('cp-tab-active', mode === 'spectrum');
    }
    if (tabGrid) {
      tabGrid.classList.toggle('cp-tab-active', mode === 'grid');
    }
  }

  tabSpectrum?.addEventListener('click', () => setMode('spectrum'));
  tabGrid?.addEventListener('click',     () => setMode('grid'));

  // --- ПРОЗРАЧНЫЙ ФОН: блокируем палитру, когда он включён ---
  cbTransparent?.addEventListener('change', ()=>{
    const isBG = (targetInput && targetInput.id === 'bg');
    modal.classList.toggle('cp-disabled', cbTransparent.checked && isBG);
  });

  function open(targetEl){
    targetInput = targetEl;

    // Показываем чекбокс только для ФОНА в режиме ФОТО
    const isBG = (targetInput && targetInput.id === 'bg');
    const isPhotoMode = (state.mode === 'photo') ||
      (app?.ui?.tabPhoto?.classList?.contains('active'));

    rowTransparent.hidden = !(isBG && isPhotoMode);

    cbTransparent.checked = !!state.transparentBg;
    modal.classList.toggle('cp-disabled', cbTransparent.checked && isBG);
    if (!isBG) modal.classList.remove('cp-disabled');

    // стартовый цвет берём из инпута
    [H,S,V] = hex2hsv(targetInput.value || '#8ac7ff');

    ensureGrid();       // создаём сетку при первом открытии
    setMode(mode);      // оставляем последний выбранный режим

    openedAt = Date.now();
    setTimeout(() => {
      modal.hidden = false;
      repaintHue();
      repaintSV();
    }, 0);
  }

  function close(){
    modal.hidden = true;
  }

  cancel.addEventListener('click', close);

  ok.addEventListener('click', ()=> {
    const pickedIsBG  = (targetInput && targetInput.id === 'bg');
    const isPhotoMode = (state.mode === 'photo') ||
      (app?.ui?.tabPhoto?.classList?.contains('active'));
    const wantTransparent = cbTransparent.checked && pickedIsBG && isPhotoMode;

    if (wantTransparent) {
      // включаем прозрачный фон
      state.transparentBg = true;

      app.out.style.backgroundColor   = '#000000';
      app.stage.style.backgroundColor = '#000000';
      app.ui.bg.classList.add('transparent');

      const swatch = document.getElementById('cp-preview-swatch');
      const hex = swatch
        ? rgbToHex(getComputedStyle(swatch).backgroundColor)
        : (targetInput.value || '#000000');

      if (targetInput) {
        targetInput.value = hex;
        targetInput.dispatchEvent(new Event('input', { bubbles:true }));
      }
      syncBgPaletteLock();
    } else {
      // обычная установка цвета
      const [r,g,b] = hsv2rgb(H,S,V);
      const hex = rgb2hex(r,g,b);

      if (targetInput) {
        targetInput.value = hex;
        targetInput.dispatchEvent(new Event('input', { bubbles:true }));
      }

      if (pickedIsBG) {
        if (state.transparentBg) {
          state.transparentBg = false;
          app.ui.bg.classList.remove('transparent');
        }
        app.out.style.backgroundColor   = state.background;
        app.stage.style.backgroundColor = state.background;
        syncBgPaletteLock();
      }
    }

    close();
  });

  // клик по фону — закрыть (кроме «хвоста» первого тапа)
  modal.querySelector('.cp-backdrop').addEventListener('click', (ev) => {
    if (Date.now() - openedAt < 200) return;
    close();
  });

  return { open, close };
})();

// Выставляем панель настроек ровно под верхним тулбаром
function layoutSettingsPanel() {
  const panel   = app.ui.settings;
  const toolbar = document.querySelector('.toolbar');
  if (!panel || !toolbar) return;

  // координаты тулбара и родителя панели
  const tbRect      = toolbar.getBoundingClientRect();
  const parentRect  = panel.offsetParent
    ? panel.offsetParent.getBoundingClientRect()
    : { top: 0 };

  // top = нижняя граница тулбара относительно offsetParent
  const top = Math.max(0, tbRect.bottom - parentRect.top);
  panel.style.top = top + 'px';

  // чтобы панель не вылезала за экран — подрежем max-height
  const free = window.innerHeight - top;
  panel.style.maxHeight = Math.max(0, free - 24) + 'px';
}

  // ============== СВЯЗКА UI ==============
  // @section UI_BINDINGS
  function bindUI() {
// Показ/скрытие панели
// Показ/скрытие панели
app.ui.toggle.addEventListener('click', () => {
  const panel = app.ui.settings;
  if (!panel) return;

  const hidden = panel.hasAttribute('hidden');
  if (hidden) {
    panel.removeAttribute('hidden');  // показываем
    layoutSettingsPanel();            // сразу клеим к тулбару
  } else {
    panel.setAttribute('hidden', ''); // прячем
  }

  // ВАЖНО: больше НЕ трогаем fitAsciiToViewport здесь,
  // чтобы не появлялась лишняя рамка вокруг картинки.
});

// --- ПИНЧ-ЗУМ + ПАНОРАМИРОВАНИЕ ДЛЯ СЦЕНЫ ---
// @section STAGE_GESTURES
(function enableStagePinchZoom(){
  const el = app.stage;
  const pts = new Map();

  let pinchActive = false;
  let d0 = 0, s0 = 1;

  let panId = null;
  let panStartX = 0, panStartY = 0;
  let viewStartX = 0.5, viewStartY = 0.5;

  const getDist = () => {
    const a = Array.from(pts.values());
    if (a.length < 2) return 0;
    const dx = a[0].x - a[1].x, dy = a[0].y - a[1].y;
    return Math.hypot(dx, dy);
  };

  const resetPanIf = (id) => {
    if (panId === id) panId = null;
  };

  el.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') e.preventDefault?.();
    el.setPointerCapture?.(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size === 2) {
      // старт пинча
      pinchActive = true;
      d0 = getDist() || 1;
      s0 = state.viewScale || 1;
      panId = null; // при двух пальцах — только зум
    } else if (pts.size === 1) {
      // возможный старт панорамирования
      panId = e.pointerId;
      panStartX = e.clientX;
      panStartY = e.clientY;
      viewStartX = (typeof state.viewX === 'number') ? state.viewX : 0.5;
      viewStartY = (typeof state.viewY === 'number') ? state.viewY : 0.5;
    }
  }, { passive:false });

  el.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const out   = app.out;
    const stage = app.stage;
    if (!out || !stage) return;

    const w = out.scrollWidth;
    const h = out.scrollHeight;
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    if (!w || !h || !W || !H) return;

    const S = Math.min(W / w, H / h);

    // пинч-зум двумя пальцами
    if (pinchActive && pts.size === 2) {
      const d = getDist() || 1;
      const ratio = d / d0;

      // ограничиваем общий масштаб
      state.viewScale = Math.max(1, Math.min(3, s0 * ratio));

      const base = S * (state.viewScale || 1);
      clampViewToBounds(w, h, W, H, base);
      fitAsciiToViewport();
      return;
    }

    // панорамирование одним пальцем
    if (panId === e.pointerId && pts.size === 1) {
      const scale = Math.max(1, state.viewScale || 1);
      const base  = S * scale;

      // если зума нет (scale ~ 1) — двигать нечего, держим центр
      if (base * w <= W + 1 && base * h <= H + 1) {
        state.viewX = 0.5;
        state.viewY = 0.5;
        fitAsciiToViewport();
        return;
      }

      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;

      // dx>0 (палец вправо) → центр окна смещаем влево (картинка едет за пальцем)
      let vx = viewStartX - dx / (w * base);
      let vy = viewStartY - dy / (h * base);

      // грубая нормализация, потом подрежет clampViewToBounds
      if (!Number.isFinite(vx)) vx = 0.5;
      if (!Number.isFinite(vy)) vy = 0.5;

      state.viewX = vx;
      state.viewY = vy;

      clampViewToBounds(w, h, W, H, base);
      fitAsciiToViewport();
    }
  }, { passive:false });

  const up = e => {
    pts.delete(e.pointerId);
    resetPanIf(e.pointerId);
    if (pts.size < 2) pinchActive = false;
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

      // сбрасываем пользовательский зум
      state.viewScale = 1;
      state.viewX = 0.5;
      state.viewY = 0.5;

      const src = currentSource();
      if (src) {
        const { w, h } = updateGridSize();
        refitFont(w, h);      // авто-вписывание через font-size
      }

      // в любом случае обновляем transform под актуальный viewScale
      fitAsciiToViewport();
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

// Перехватываем нативный color-picker и открываем наш кастомный:
//
// — для ФОНА (bg) и ТЕКСТА (fg) всегда через нашу модалку
// — клики ловим на label, а не на самом <input type="color">,
//   чтобы iOS вообще не узнал, что это color-инпут.
const trapColorInput = (inputEl) => {
  if (!inputEl) return;

  // Пытаемся найти родительский <label class="color">
  const label = inputEl.closest('label') || inputEl;
  label.addEventListener('click', (e) => {
    // если инпут реально задизейблен — ничего не делаем
    if (inputEl.disabled) return;

    e.preventDefault();
    e.stopPropagation();

    // открываем кастомный picker именно для ИНПУТА,
    // чтобы CP.open знал, кому потом писать .value
    CP.open(inputEl);
  }, { passive: false });
};

// ФОН — всегда через кастомную палитру (ПК + мобилки)
if (app.ui.bg) {
  trapColorInput(app.ui.bg);
}

// ТЕКСТ — теперь тоже всегда через наш кастомный picker
if (app.ui.fg) {
  trapColorInput(app.ui.fg);
}

// --- Кнопки режимов внизу (с приоритетным вызовом file picker) ---
// @section MODE_SWITCHING
app.ui.modeLive.addEventListener('click', () => {
  // КАМЕРА — сразу в live
  updateModeTabs('live');
  setMode('live');
});

// --- ФОТО: только открываем диалог, режим пока НЕ трогаем ---
app.ui.modePhoto.addEventListener('click', () => {
  if (!app.ui.filePhoto) return;

  app.ui.filePhoto.value = '';

  // используем наш helper, который "нормально" открывает input вне экрана
  openFilePicker(app.ui.filePhoto);
});

// --- ВИДЕО: аналогично, только открываем диалог ---
app.ui.modeVideo.addEventListener('click', () => {
  if (isTextMode()) return;
  if (!app.ui.fileVideo) return;

  app.ui.fileVideo.value = '';
  openFilePicker(app.ui.fileVideo);
});

    // --- ВСПЫШКА: одна кнопка toggle ---
if (app.ui.flashBtn) {
  // дефолт: вспышка выключена
  state.flashEnabled = false;
  updateFlashUI();

  app.ui.flashBtn.addEventListener('click', (e) => {
    e.preventDefault();
    state.flashEnabled = !state.flashEnabled;
    updateFlashUI();
  });
}

    // --- ТАЙМЕР: выкл / 3с / 10с ---
    if (app.ui.timerOffBtn && app.ui.timer3Btn && app.ui.timer10Btn) {
      // дефолт: таймер выключен
      state.timerSeconds = 0;
      updateTimerUI();

      app.ui.timerOffBtn.addEventListener('click', (e) => {
        e.preventDefault();
        state.timerSeconds = 0;
        updateTimerUI();
      });

      app.ui.timer3Btn.addEventListener('click', (e) => {
        e.preventDefault();
        state.timerSeconds = 3;
        updateTimerUI();
      });

      app.ui.timer10Btn.addEventListener('click', (e) => {
        e.preventDefault();
        state.timerSeconds = 10;
        updateTimerUI();
      });
    }

 // --- Снимок в LIVE (тот же пайплайн, что и ФОТО) ---
    if (app.ui.camShutter && app.ui.camBtnCore) {
      const pressOn  = () => {
        app.ui.camBtnCore.src = 'assets/camera_button_active.svg';
        app.ui.camShutter.classList.add('active');
      };
      const pressOff = () => {
        app.ui.camBtnCore.src = 'assets/camera_button.svg';
        app.ui.camShutter.classList.remove('active');
      };

      let shotLock = false;

      const doShot = async (e) => {
        e.preventDefault();
        if (isTextMode()) {
          await sendAsciiTextToBot();
          return;
        }
        if (state.mode !== 'live') return;
        if (shotLock) return;
        shotLock = true;

        try {
          pressOn();

          const sec = state.timerSeconds | 0;
          const hasTimer = sec > 0 && app.ui.timerOverlay && app.ui.timerNumber;

          if (hasTimer) {
            // показываем крупные цифры по центру
            app.ui.timerOverlay.hidden = false;

            for (let s = sec; s > 0; s--) {
              app.ui.timerNumber.textContent = String(s);
              // ждём 1 секунду
              // eslint-disable-next-line no-await-in-loop
              await new Promise(res => setTimeout(res, 1000));
            }

            // убираем цифры
            app.ui.timerOverlay.hidden = true;
            app.ui.timerNumber.textContent = '';
          }

          // делаем снимок (тот же PNG-пайплайн)
          await Promise.resolve(savePNG());
        } catch (err) {
          console.error('[camShot]', err);
        } finally {
          setTimeout(pressOff, 180);
          setTimeout(() => { shotLock = false; }, 400);
        }
      }; // ← ВАЖНО: закрываем doShot

      app.ui.camShutter.addEventListener('pointerdown', (e) => {
        if (state.mode === 'live') {
          e.preventDefault();
          pressOn();
        }
      }, { passive: false });

      app.ui.camShutter.addEventListener('pointerup',   doShot, { passive: false });
      app.ui.camShutter.addEventListener('click',       doShot, { passive: false });
      app.ui.camShutter.addEventListener('pointercancel', () => pressOff());
    }

// --- Выбор фото из галереи ---
// @section MODE_PHOTO
app.ui.filePhoto.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];

  // Юзер закрыл диалог, ничего не выбрал → остаёмся в старом режиме
  if (!f) return;

  // Только сейчас, после реального выбора файла, переключаемся в режим ФОТО
  if (state.mode !== 'photo') {
    updateModeTabs('photo');
    await setMode('photo');
  }

  const img = new Image();
  img.onload = () => {
    state.imageEl = img;
    state.mirror = false;
    app.ui.placeholder.hidden = true;

    const { w, h } = updateGridSize();
    refitFont(w, h);
    updateHud('img onload');
    requestAnimationFrame(() => {}); // разовый тик
  };

  if (app._lastImageURL) {
    try { URL.revokeObjectURL(app._lastImageURL); } catch (_) {}
  }

  const urlImg = URL.createObjectURL(f);
  img.src = urlImg;
  app._lastImageURL = urlImg;
});

// === Подготовка GIF-кадров из gifuct-js ===
function setupGifFromFrames(rawFrames) {
  if (!rawFrames || !rawFrames.length) {
    state.gifFrames   = null;
    state.gifDuration = 0;
    return;
  }

  // 1) Определяем "глобальные" размеры всего GIF
  let globalW = 0;
  let globalH = 0;
  for (const f of rawFrames) {
    const d = f.dims || {};
    const w = (d.width  || 0) + (d.left || 0);
    const h = (d.height || 0) + (d.top  || 0);
    if (w > globalW) globalW = w;
    if (h > globalH) globalH = h;
  }
  if (!globalW || !globalH) {
    // на всякий случай — fallback на первый кадр
    const d0 = rawFrames[0].dims || {};
    globalW = d0.width  || 1;
    globalH = d0.height || 1;
  }

  const frames = [];
  const delays = [];
  let prevFullData = null; // Uint8ClampedArray для предыдущего полного кадра

  for (const f of rawFrames) {
    const dims = f.dims || {};
    const frameW = dims.width  || globalW;
    const frameH = dims.height || globalH;
    const left   = dims.left   || 0;
    const top    = dims.top    || 0;

    // --- задержка кадра ---
    let rawDelay = Number(f.delay) || 0;
    if (rawDelay <= 0) rawDelay = 10;
    let delayMs = rawDelay;              // gifuct обычно даёт уже мс
    if (delayMs < 16)  delayMs = 16;     // ~60 fps
    if (delayMs > 200) delayMs = 200;    // ~5 fps
    delays.push(delayMs);

    // --- patch текущего кадра ---
    const patch = f.patch;
    const patchData = (patch instanceof Uint8ClampedArray)
      ? patch
      : new Uint8ClampedArray(patch);

    // Если patch уже полноразмерный и без смещения — можно использовать прямо его
    const isFullFrame =
      frameW === globalW &&
      frameH === globalH &&
      left   === 0 &&
      top    === 0 &&
      patchData.length === globalW * globalH * 4;

    let fullData;

    if (isFullFrame) {
      fullData = patchData;
    } else {
      // Собираем полный кадр: копируем предыдущий и накладываем patch
      fullData = new Uint8ClampedArray(globalW * globalH * 4);

      if (prevFullData && prevFullData.length === fullData.length) {
        fullData.set(prevFullData);
      }

      // Накладываем patch построчно с учётом left/top
      for (let y = 0; y < frameH; y++) {
        const srcRowStart = y * frameW * 4;
        const dstRowStart = ((top + y) * globalW + left) * 4;

        fullData.set(
          patchData.subarray(srcRowStart, srcRowStart + frameW * 4),
          dstRowStart
        );
      }
    }

    const imageData = new ImageData(fullData, globalW, globalH);
    prevFullData = fullData; // запоминаем для следующего кадра

    frames.push({ delay: delayMs, imageData });
  }

  // Нормализуем задержки (медиана, как было)
  delays.sort((a, b) => a - b);
  const median = delays[Math.floor(delays.length / 2)] || 100;
  const frameDelay = Math.min(200, Math.max(16, median));

  let total = 0;
  for (const fr of frames) {
    fr.delay = frameDelay;
    total += frameDelay;
  }

  state.gifFrames     = frames;
  state.gifDuration   = total;
  state.gifFrameIndex = 0;
  state.gifTime       = 0;
  state._gifLastTs    = 0;

  if (!state.gifCanvas) {
    state.gifCanvas = document.createElement('canvas');
    state.gifCtx    = state.gifCanvas.getContext('2d');
  }

  const fr0 = frames[0];
  state.gifCanvas.width  = fr0.imageData.width;
  state.gifCanvas.height = fr0.imageData.height;
  state.gifCtx.putImageData(fr0.imageData, 0, 0);

  const { w, h } = updateGridSize();
  refitFont(w, h);
  app.ui.placeholder.hidden = true;
}

// --- Выбор видео из галереи (включая GIF как «видео») ---
// @section MODE_VIDEO_GIF
fileVideo.addEventListener('change', async (e) => {
  const original = e.target.files?.[0];

  // Ничего не выбрали → не трогаем текущий режим (live/photo/video)
  if (!original) return;

  const isGif = (original.type === 'image/gif') || /\.gif$/i.test(original.name || '');

  // В любом случае — очищаем предыдущее GIF-состояние
  state.gifFrames   = null;
  state.gifDuration = 0;
  state.gifFrameIndex = 0;
  state.gifTime       = 0;
  state._gifLastTs    = 0;

  if (state.gifImage && state.gifImage.parentNode) {
    state.gifImage.parentNode.removeChild(state.gifImage);
  }
  state.gifImage = null;

  if (app._lastGifURL) {
    try { URL.revokeObjectURL(app._lastGifURL); } catch(_) {}
    app._lastGifURL = null;
  }

  // Всегда переключаемся в режим ВИДЕО только ПОСЛЕ выбора файла
  if (state.mode !== 'video') {
    updateModeTabs('video');
    await setMode('video');
  }

  // На всякий — глушим камеру и старые источники
  stopStream();
  try { app.vid.pause?.(); } catch(_) {}
  try { app.vid.removeAttribute('src'); } catch(_) {}
  app.vid.srcObject = null;

  app.out.textContent = '';
  app.ui.placeholder.hidden = false;

  if (isGif) {
    
        // ====== ВЕТКА GIF: парсим в кадры через gifuct-js / GIF ======
    try {
      const buf = await original.arrayBuffer();

      let frames = null;

      // 1) Пытаемся использовать современный API parseGIF / decompressFrames
      try {
        const gifLib = window.gifuct || window.gifuctJs || window;
        const parseGIF         = gifLib && gifLib.parseGIF;
        const decompressFrames = gifLib && gifLib.decompressFrames;

        if (typeof parseGIF === 'function' && typeof decompressFrames === 'function') {
          const gifParsed = parseGIF(buf);
          frames = decompressFrames(gifParsed, true); // true = собрать RGBA patch
        }
      } catch (_) {
        // молча переходим к fallback'у
      }

      // 2) Fallback для старой версии: глобальный конструктор window.GIF
      if (!frames || !frames.length) {
        const GIF = window.GIF;
        if (typeof GIF !== 'function') {
          throw new Error('gifuct-js не найден ни как parseGIF/decompressFrames, ни как window.GIF');
        }
        const gifObj = new GIF(buf);
        frames = gifObj.decompressFrames(true); // true = собрать RGBA patch
      }

      if (!frames || !frames.length) {
        throw new Error('GIF не содержит кадров');
      }

      setupGifFromFrames(frames);
      state.mirror = false; // GIF не зеркалим
    } catch (err) {
      console.error('GIF decode failed', err);
      showErrorPopup?.(
        'Н̷Е̷ ̵У̵Д̷А̴Л̵О̶С̸Ь ̶П̴Р̶О̸Ч̵Е̵С̷Т̶Ь ̴GIF',
        String(err && (err.message || err.name) || err || 'неизвестная ошибка')
      );
      app.ui.placeholder.hidden = false;
      state.gifFrames = null;
      return; // при ошибке сразу выходим из обработчика
    }

    // GIF успешно разобран → выходим, НЕ идём в ветку обычного видео
    return;
  }

  // ====== ВЕТКА ОБЫЧНОГО ВИДЕО (mp4, webm и т.п.) ======

  // освобождаем старый blob, если был
  if (app._lastVideoURL) {
    try { URL.revokeObjectURL(app._lastVideoURL); } catch(_) {}
  }

  const url = URL.createObjectURL(original);
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

  app.vid.src = url;
  try { await app.vid.play?.(); } catch(_) {}

  state.mirror = false; // видео не зеркалим
});

// --- ЕДИНАЯ функция сохранения ---
// @section EXPORT_SAVE_SHARE
async function doSave() {
  if (isTextMode()) {
    await sendAsciiTextToBot();
    return;
  }
  if (state.mode === 'photo') {
    hudSet('PNG: экспорт…');
    await savePNG();
  } else if (state.mode === 'video') {
    const hasGif = !!(state.gifFrames && state.gifFrames.length);
    const hasVideo = !!(app.vid && (app.vid.src || app.vid.srcObject));
    if (!hasGif && !hasVideo) {
      alert('Нет выбранного видео.');
      return;
    }
    hudSet('VIDEO: запись… (дождитесь окончания)');
    await saveVideo();
  }
}

async function frameBlobForTextMode() {
  const src = currentSource();
  if (!src || !src.el) return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, src.w || 1);
  canvas.height = Math.max(1, src.h || 1);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (state.mode === 'live' && state.mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src.el, 0, 0, canvas.width, canvas.height);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
}

async function sendAsciiTextToBot() {
  if (uploadInFlight) return;
  const blob = await frameBlobForTextMode();
  if (!blob) {
    alert('Нет кадра для отправки');
    return;
  }
  const tgWebApp = window.Telegram?.WebApp;
  if (!tgWebApp?.initData) {
    alert('Режим ТЕКСТ доступен только внутри Telegram');
    return;
  }
  uploadInFlight = true;
  const form = new FormData();
  form.append('file', blob, 'ascii_text.jpg');
  form.append('initData', tgWebApp.initData || '');
  form.append('initdata', tgWebApp.initData || '');
  form.append('charsetPreset', app.ui.charset.value || TEXT_CHARSETS.DOTS);
  form.append('sizePreset', state.textSize || 'm');
  busyLock = true;
  busyShow('0ТПР4ВК4 ТЕКСТ-АРТА…');
  const textApiUrl = apiUrl('/api/ascii-text');
  try {
    const res = await fetch(textApiUrl, { method:'POST', body: form });
    const raw = await res.text();
    const json = (() => {
      try { return JSON.parse(raw || '{}'); } catch (_) { return {}; }
    })();
    if (res.status === 402 || json?.error === 'INSUFFICIENT_FUNDS') {
      tgWebApp.showPopup?.({ title:'НЕД0СТ4Т0ЧН0 ИМПУЛЬС0В', message:`Нужно: ${json?.need ?? 1}
Баланс: ${json?.balance ?? '—'}` });
      return;
    }
    if (!res.ok) {
      if (DEBUG_TEXT) {
        const bodyPreview = (raw || '').slice(0, 200);
        alert(`TEXT SAVE ERROR: ${res.status} ${textApiUrl}${bodyPreview ? `\n${bodyPreview}` : ''}`);
      }
      tgWebApp.showPopup?.({ title:'ОШИБКА', message: json?.message || json?.error || `Статус ${res.status}` });
      return;
    }
    tgWebApp.showPopup?.({ title:'Г0Т0В0', message:`ASCII-арт отправлен в чат.${typeof json.balance !== 'undefined' ? `
Осталось: ${json.balance}` : ''}` });
  } catch (e) {
    tgWebApp.showPopup?.({ title:'СЕТЕВАЯ ОШИБКА', message: e?.message || 'Не удалось отправить запрос' });
  } finally {
    uploadInFlight = false;
    busyLock = false;
    busyHide(true);
  }
}

// Кнопка в тулбаре
app.ui.save.addEventListener('click', doSave);
if (app.ui.resetModeBtn) {
  app.ui.resetModeBtn.addEventListener('click', () => {
    bindModeChooserOnce();
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = false;
  });
}
if (app.ui.textSizePreset) {
  app.ui.textSizePreset.addEventListener('change', (e) => { state.textSize = e.target.value || 'm'; });
}

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
  // @section BOOTSTRAP_INIT
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
    // === Портрет-лок: пробуем залочить ориентацию один раз после первого тапа ===
    if (isMobile && typeof document !== 'undefined') {
      const onFirstTap = () => {
        if (orientationLockRequested) return;
        orientationLockRequested = true;
        lockPortraitIfSupported();
        // после попытки — отписываемся от событий
        document.removeEventListener('click', onFirstTap);
        document.removeEventListener('touchstart', onFirstTap);
      };

      // слушаем и клик, и touchstart — чтобы сработало в WebView/на таче
      document.addEventListener('click', onFirstTap, { passive: true });
      document.addEventListener('touchstart', onFirstTap, { passive: true });
    }

bindUI();
initVisorMode();
applyVisorModeUi();
window.addEventListener('resize', () => {
  layoutSettingsPanel();
});
    
// 2) Принудительно применяем шрифтовой стек под стартовый режим символов,
//    чтобы исключить "ложный" первый кадр с некорректным стеком.
if (app.ui.charset) {
  // дёрнем обработчик, он сам решит: CJK → CJK стек без сортировки,
  // не CJK → основной стек + авто-сорт.
  app.ui.charset.dispatchEvent(new Event('change', { bubbles: true }));
}

let hasCam = false;
try {
  const devs = await navigator.mediaDevices?.enumerateDevices?.() || [];
  hasCam = devs.some(d => d.kind === 'videoinput');
} catch(_) {}

await setMode(isTextMode() ? (hasCam ? 'live' : 'photo') : (hasCam ? 'live' : 'photo'));
    // стартуем отрисовку
    updateFlashUI();
    requestAnimationFrame(loop);
  }

  // ---- BOOTSTRAP ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();



