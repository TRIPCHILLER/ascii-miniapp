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
  const SAFE_TG_MAX_COLS = 40;
  const TEXT_TELEGRAM_CELL_ASPECT = 0.50;
  const TEXT_PREVIEW_LINE_HEIGHT = 1.10;
  const TEXT_FINAL_GRID_EXTRA_ROWS = 0;
  const DOTS_BRAILLE_CFG = Object.freeze({
    CELL_W: 2,
    CELL_H: 4,
    THRESHOLD: 0.52,
    THRESHOLD_BIAS: -0.04,
    CONTRAST: 1.14,
    LOCAL_CONTRAST: 0.30,
    GAMMA: 1.0,
    SAMPLE_ASPECT_Y: 1.0,
  });
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

let busyTextAnimationToken = 0;

function startBusyServiceTextAnimation(targetText, {
  glitchMs = 18,
  charMs = 30,
  spaceMs = 16,
  withDots = false,
  dotsMs = 500
} = {}) {
  const localToken = ++busyTextAnimationToken;
  const noiseAlphabet = '0123456789АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
  const randomNoiseChar = () => noiseAlphabet[Math.floor(Math.random() * noiseAlphabet.length)];
  let dotsTimer = null;

  const isActive = () => (
    localToken === busyTextAnimationToken &&
    !!app?.ui?.busyText &&
    !!app?.ui?.busy &&
    !app.ui.busy.hidden
  );

  busyShow('');

  (async () => {
    if (!isActive()) return;
    app.ui.busyText.textContent = '|';
    startPrintNextSound = 0;
    startLastPrintSoundAt = 0;

    for (let i = 0; i < targetText.length; i += 1) {
      if (!isActive()) return;
      const fixedPart = targetText.slice(0, i);
      const ch = targetText[i];

      if (ch === ' ') {
        app.ui.busyText.textContent = `${fixedPart} |`;
        await sleep(spaceMs);
        continue;
      }

      app.ui.busyText.textContent = `${fixedPart}${randomNoiseChar()}|`;
      await sleep(glitchMs);
      if (!isActive()) return;
      app.ui.busyText.textContent = `${fixedPart}${ch}|`;
      playStartPrintSound();
      tgTextHaptic();
      await sleep(charMs);
    }

    if (!isActive()) return;
    app.ui.busyText.textContent = targetText;

    if (withDots) {
      let dots = 0;
      dotsTimer = setInterval(() => {
        if (!isActive()) return;
        dots = (dots + 1) % 4;
        app.ui.busyText.textContent = targetText + '.'.repeat(dots);
      }, dotsMs);
    }
  })();

  return () => {
    if (dotsTimer) {
      clearInterval(dotsTimer);
      dotsTimer = null;
    }
    if (busyTextAnimationToken === localToken) busyTextAnimationToken += 1;
  };
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
      charsetTrigger: $('#charsetTrigger'),
      customCharset: $('#charset_custom'),
      invert:   $('#invert'),
      fs:       $('#fs'),
      style:    $('#stylePreset'),
      styleTrigger: $('#styleTrigger'),
      styleRow: $('#styleRow'),
      modeChooser: $('#modeChooser'),
      startDateTime: $('#startDateTime'),
      startInitText: $('#startInitText'),
      startBlinkLine: $('#startBlinkLine'),
      colorRow: $('#colorRow'),
      resetModeBtn: $('#resetModeBtn'),
      visorModeStatus: $('#visorModeStatus'),
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
    frozenFrameOverlay: $('#frozenFrameOverlay'),
    frozenFrameImage: $('#frozenFrameImage'),
    shutterFlashOverlay: $('#shutterFlashOverlay'),
    // таймер
    timerOffBtn:  $('#timerOffBtn'),
    timer3Btn:    $('#timer3Btn'),
    timer10Btn:   $('#timer10Btn'),
    timerOffIcon: $('#timerOffIcon'),
    timer3Icon:   $('#timer3Icon'),
    timer10Icon:  $('#timer10Icon'),
    asciiSelectPopup: $('#asciiSelectPopup'),
    asciiSelectPopupTitle: $('#asciiSelectPopupTitle'),
    asciiSelectPopupList: $('#asciiSelectPopupList'),
    // оверлей отсчёта
    timerOverlay: $('#camTimerOverlay'),
    timerNumber:  $('#camTimerNumber'),
    asciiPopup: $('#asciiPopup'),
    asciiPopupText: $('#asciiPopupText'),
    asciiPopupClose: $('#asciiPopupClose'),
}
  };
  // ===== Telegram WebApp (если открыто внутри Telegram) =====
  // @section TELEGRAM_WEBAPP_API
const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
const TEXT_HAPTIC_THROTTLE_MS = 45;

function tgHaptic(method, ...args) {
  try {
    const haptic = window.Telegram?.WebApp?.HapticFeedback;
    const fn = haptic?.[method];
    if (typeof fn !== 'function') return;
    fn(...args);
  } catch (_) {}
}

function createThrottle(fn, waitMs) {
  let lastAt = 0;
  return (...args) => {
    const now = performance.now();
    if (now - lastAt < waitMs) return;
    lastAt = now;
    fn(...args);
  };
}

const tgTextHaptic = createThrottle(() => tgHaptic('impactOccurred', 'light'), TEXT_HAPTIC_THROTTLE_MS);

function tgEventHaptic() {
  tgHaptic('impactOccurred', 'light');
}

function tgGoalFlashHaptic() {
  tgHaptic('impactOccurred', 'medium');
}

const TERM_RANGE_STEPS = 10;
const START_EASTER_EGG_MAX_SOUND = 10;
// Версия ассетов звуков для принудительного обновления кэша в WebView/браузере.
const SOUND_ASSET_VERSION = '20260313-1';
const START_EASTER_EGG_SOUNDS = Array.from(
  { length: START_EASTER_EGG_MAX_SOUND },
  (_, i) => `assets/sounds/sound${i + 1}.mp3?v=${SOUND_ASSET_VERSION}`
);
const ERROR_SOUND_SRC = `assets/sounds/errorsound.mp3?v=${SOUND_ASSET_VERSION}`;
const START_UI_SOUNDS = {
  launch: `assets/sounds/startsound.mp3?v=${SOUND_ASSET_VERSION}`,
  modeClick: `assets/sounds/clicksound.mp3?v=${SOUND_ASSET_VERSION}`,
  workClicks: [
    `assets/sounds/click1.mp3?v=${SOUND_ASSET_VERSION}`,
    `assets/sounds/click2.mp3?v=${SOUND_ASSET_VERSION}`
  ],
  blinkOn: `assets/sounds/click1.mp3?v=${SOUND_ASSET_VERSION}`,
  blinkOff: `assets/sounds/click2.mp3?v=${SOUND_ASSET_VERSION}`,
  print: [
    `assets/sounds/print1.mp3?v=${SOUND_ASSET_VERSION}`,
    `assets/sounds/print2.mp3?v=${SOUND_ASSET_VERSION}`
  ]
};
const ARG_SCENE_SOUNDS = {
  turnOff: `assets/sounds/turnoff.mp3?v=${SOUND_ASSET_VERSION}`,
  click: `assets/sounds/clicksound1.mp3?v=${SOUND_ASSET_VERSION}`,
  bitClick: `assets/sounds/bitclick.mp3?v=${SOUND_ASSET_VERSION}`,
  bitClick2: `assets/sounds/bitclick2.mp3?v=${SOUND_ASSET_VERSION}`,
  danger: `assets/sounds/dangersound.mp3?v=${SOUND_ASSET_VERSION}`,
  danger2: `assets/sounds/dangersound2.mp3?v=${SOUND_ASSET_VERSION}`
};
const ARG_SCENE_ASSETS = {
  ball: 'assets/pongball.svg',
  topStick: 'assets/pongstick1.svg',
  bottomStick: 'assets/pongstick2.svg',
  visorBody: 'assets/VISORBODY.png',
  visorEye: 'assets/VISOREYE.png',
  visorPupil: 'assets/VISORPUPIL.png'
};
const FINGERPRINT_GATE_HOLD_MS = 500;
const FINGERPRINT_GATE_ACTIVE_MS = 1000;
const FINGERPRINT_GATE_TYPE_MS = 1000;
const FINGERPRINT_GATE_BLINK_MS = 1000;
const FINGERPRINT_GATE_TEXT_TOP = 'ПРИЛОЖИТЕ ПАЛЕЦ\nК СКАНЕРУ ОТПЕЧАТКОВ';
const FINGERPRINT_GATE_TEXT_BOTTOM = 'ДЛЯ ЗАПУСКА СИСТЕМЫ...';
const FINGERPRINT_GATE_STATES = {
  idle: 'assets/fingerprintnoactive.svg',
  pressed: 'assets/fingerprintnoactiveturn.svg',
  active: 'assets/fingerprintactive.svg'
};
const ARG_SCENE_TIMINGS = {
  afterBlackMs: 3000,
  ballToPopupMs: 1000,
  topToBottomStickMs: 1000,
  bottomToSecondPopupMs: 1000,
  eyeToCountdownMs: 1000,
  countdownStepMs: 1000,
  serveDelayMs: 700,
  goalFlashBurstMs: 333,
  goalRespawnDelayMs: 2000,
  popupGlitchMs: 19,
  popupSpaceTypeMs: 12,
  popupCharTypeMs: 23
};
const ARG_PONG = {
  scoreToWin: 3,
  paddleWidthPx: 132,
  paddleHeightPx: 12,
  ballSizeToPaddleHeightRatio: 1,
  topPaddleYVh: 4,
  bottomPaddleYVh: 96,
  topScoreYVh: 10,
  bottomScoreYVh: 10,
  sideWallPaddingPx: 8,
  ballBaseSpeedPx: 6,
  ballMaxSpeedPx: 13,
  paddleBounceBoost: 0.3,
  playerPointerSmoothing: 0.4,
  aiMaxSpeedPx: 6,
  aiTrackDeadZonePx: 6,
  aiLevels: [
    {
      maxSpeedPx: 8.4,
      reaction: 0.56,
      autoAim: 0.62,
      accelPx: 1.25,
      deadZonePx: 3.4,
      predictiveBlend: 0.74,
      repositionBlend: 0.52,
      humanizePx: 1.35,
      idleDamping: 0.9
    },
    {
      maxSpeedPx: 11.2,
      reaction: 0.76,
      autoAim: 0.86,
      accelPx: 1.95,
      deadZonePx: 1.8,
      predictiveBlend: 0.9,
      repositionBlend: 0.72,
      humanizePx: 0.85,
      idleDamping: 0.93
    },
    {
      maxSpeedPx: 14.3,
      reaction: 0.94,
      autoAim: 1.05,
      accelPx: 2.8,
      deadZonePx: 0.55,
      predictiveBlend: 0.99,
      repositionBlend: 0.94,
      humanizePx: 0.12,
      idleDamping: 0.96
    }
  ],
  aiFinalStand: {
    maxSpeedPx: 15.2,
    reaction: 0.97,
    autoAim: 1.1,
    accelPx: 3.2,
    deadZonePx: 0.4,
    predictiveBlend: 1,
    repositionBlend: 0.96,
    humanizePx: 0.05,
    idleDamping: 0.97
  },
  syncDistancePx: 54,
  syncHoldMs: 2400,
  syncMaxDurationMs: 3000,
  syncDecayPerMs: 0.9,
  syncPull: 0.18,
  syncFollowMaxSpeedPx: 10.5,
  syncFollowAccelPx: 1.15,
  visorEyeMaxShiftXPx: 27,
  visorEyeMaxShiftYPx: 18,
  visorFollowRadiusBoost: 1.1,
  visorEyeSpring: 0.28,
  visorEyeDamping: 0.74,
  visorEyeMaxSpeedPx: 4.4,
  visorBodyDriftAmpXPx: 8.7,
  visorBodyDriftAmpYPx: 6.1,
  visorBodyMicroJitterAmpXPx: 1.95,
  visorBodyMicroJitterAmpYPx: 1.55,
  visorBodyDriftSpeedX: 0.00066,
  visorBodyDriftSpeedY: 0.0005,
  visorBodyMicroJitterSpeedX: 0.0028,
  visorBodyMicroJitterSpeedY: 0.0025,
  visorBodyPulseAmpXPx: 3.5,
  visorBodyPulseAmpYPx: 3.1,
  visorBodyPulseSpeedX: 0.00108,
  visorBodyPulseSpeedY: 0.00096,
  visorBodyScaleBreathAmp: 0.024,
  visorBodyScaleBreathSpeed: 0.00082,
  visorBodySwayDegAmp: 0.74,
  visorBodySwaySpeed: 0.00073,
  visorBodySqueezeAmp: 0.014,
  visorBodySqueezeSpeed: 0.00114,
  visorBodyEpilepticShakeAmpYPx: 5,
  visorBodyEpilepticShakeSpeedY: Math.PI * 2 / 100,
  visorBodyMediumShakeAmpYPx: 36,
  visorBodyMediumShakeSpeedY: Math.PI * 2 / 100,
  visorEyeParallaxFollow: 0.55,
  visorEyeParallaxMaxXPx: 13.2,
  visorEyeParallaxMaxYPx: 9.8,
  visorEyeDriftAmpXPx: 1.8,
  visorEyeDriftAmpYPx: 1.4,
  visorEyeDriftSpeedX: 0.00105,
  visorEyeDriftSpeedY: 0.00094,
  visorEyeMicroJitterAmpXPx: 0.65,
  visorEyeMicroJitterAmpYPx: 0.52,
  visorEyeMicroJitterSpeedX: 0.0034,
  visorEyeMicroJitterSpeedY: 0.0031,
  visorEyeBreathScaleAmp: 0.01,
  visorEyeBreathScaleSpeed: 0.00102,
  visorClutchBreathBoost: 1.1,
  visorClutchSpringShakeAmpRatio: 0.12,
  visorClutchSpringShakeSpeedY: Math.PI * 2 / 72,
  visorEyeMediumShakeAmpYPx: 29,
  visorEyeMediumShakeSpeedY: Math.PI * 2 / 98,
  visorPupilMediumShakeAmpYPx: 23.5,
  visorPupilMediumShakeSpeedY: Math.PI * 2 / 103,
  visorPupilEdgeRecoilThreshold: 0.92,
  visorPupilEdgeRecoilPx: 0.72,
  visorPupilEdgeRecoilSpring: 0.15,
  visorPupilEdgeRecoilDamping: 0.82,
  visorPupilFollowLerp: 0.16,
  visorEngineJitterAmpXPx: 0.62,
  visorEngineJitterAmpYPx: 0.52,
  visorEngineJitterResponse: 0.44,
  visorEngineShakePulseMs: 30,
  visorEngineShakePulseJitterMs: 9,
  visorEngineShakeEyeScale: 0.68,
  visorEngineShakePupilScale: 0.8,
  visorEngineShakeEyeResponse: 0.22,
  visorEngineShakePupilResponse: 0.27,
  shakeHitAmountPx: 2.2,
  shakeDecay: 0.82
};
const ARG_BOSS_ASCII_PRESET = Object.freeze({
  charset: '@%#*+=-:. ',
  size: 100,
  contrast: 1.30,
  gamma: 1.50,
  color: '#bfbfbf',
  background: '#000000',
  invert: true
});
const AUDIO_UNLOCK_STORAGE_KEY = 'asciiVisorAudioUnlocked';
let errorSoundAudio = null;

function playErrorSound() {
  try {
    if (!errorSoundAudio) {
      errorSoundAudio = new Audio(ERROR_SOUND_SRC);
      errorSoundAudio.preload = 'auto';
    }
    errorSoundAudio.currentTime = 0;
    errorSoundAudio.play().catch(() => {});
  } catch (_) {}
}

function buildTermRange(value, min, max, steps = TERM_RANGE_STEPS) {
  const safeSteps = Math.max(2, steps | 0);
  const span = max - min;
  const ratio = span <= 0 ? 0 : (value - min) / span;
  const pos = Math.max(0, Math.min(safeSteps - 1, Math.round(ratio * (safeSteps - 1))));
  let out = '';
  for (let i = 0; i < safeSteps; i += 1) {
    out += (i === pos) ? '█' : '░';
  }
  return out;
}

function setupTerminalRange(inputEl) {
  if (!inputEl || inputEl.dataset.termRangeReady === '1') return;

  const wrap = document.createElement('span');
  wrap.className = 'term-range-wrap';
  const visual = document.createElement('span');
  visual.className = 'term-range-visual';
  visual.setAttribute('aria-hidden', 'true');

  const parent = inputEl.parentNode;
  if (!parent) return;
  parent.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);
  wrap.appendChild(visual);

  const updateVisual = () => {
    const value = Number(inputEl.value);
    const min = Number(inputEl.min || 0);
    const max = Number(inputEl.max || 100);
    visual.textContent = buildTermRange(value, min, max);
  };

  updateVisual();
  inputEl.addEventListener('input', updateVisual);
  inputEl.addEventListener('term-range-sync', updateVisual);
  inputEl.dataset.termRangeReady = '1';
}

function syncTerminalRange(inputEl) {
  if (!inputEl) return;
  inputEl.dispatchEvent(new Event('term-range-sync'));
}

function setupTerminalRanges() {
  setupTerminalRange(app.ui.width);
  setupTerminalRange(app.ui.contrast);
  setupTerminalRange(app.ui.gamma);
  setupTerminalRange(app.ui.fps);
}
  
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
const BAYER4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5
];
const PIXEL_DITHER_CHARSET = '.:-=+*#%@';
let DITHER_ENABLED = false;
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
    renderCharset10: '@%#*+=-:. ',
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
    textInitPending: false,
    textCameraFitBox: null,
    textCameraLastGridKey: '',
    graphicCameraFitBox: null,
    graphicCameraLastGridKey: '',
    lastImageSymbolSet: '@%#*+=-:. ',
    lastTextSymbolSet: null,
    lastCustomImageColors: null,
    textGridDebug: null,
    textCropDebug: null,
    textFinalPreviewDebug: null,
    frozenFrameDataUrl: '',
    frozenFrameNode: null,
    frozenFrameActive: false,
    flashFadeTimers: [],
  };

  const TEXT_CHARSETS = {
    DOTS: '__DOTS_BRAILLE__',
    PIXEL: ' .:-=+*#%@',
    BLOCKS: '__BLOCKS__',
    MICRO_LEGACY: ' .:*',
    MACRO: ' .`\'^",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'
  };

  function isBrailleDotsCharset(charsetValue) {
    return String(charsetValue || '') === TEXT_CHARSETS.DOTS;
  }

  function isBlockCharset(charsetValue) {
    return String(charsetValue || '') === TEXT_CHARSETS.BLOCKS;
  }

  function isTextMode(){ return state.visorMode === 'text'; }

  function isTextCameraLive(){
    return isTextMode() && state.mode === 'live';
  }

  function isGraphicCameraLive(){
    return !isTextMode() && state.mode === 'live';
  }

  function clearFlashFadeTimers() {
    if (!state.flashFadeTimers?.length) return;
    for (const id of state.flashFadeTimers) clearTimeout(id);
    state.flashFadeTimers = [];
  }

  function playShutterFlash() {
    const overlay = app?.ui?.shutterFlashOverlay;
    if (!overlay) return;

    clearFlashFadeTimers();
    overlay.hidden = false;
    overlay.style.opacity = '1';

    const steps = [
      { delay: 500, opacity: '0.75' },
      { delay: 1000, opacity: '0.5' },
      { delay: 1500, opacity: '0.25' },
      { delay: 2000, opacity: '0' }
    ];

    for (const step of steps) {
      const timerId = setTimeout(() => {
        overlay.style.opacity = step.opacity;
        if (step.opacity === '0') overlay.hidden = true;
      }, step.delay);
      state.flashFadeTimers.push(timerId);
    }
  }

  function captureFrozenFrameNow() {
    if (state.mode === 'live' && app?.out) {
      return app.out;
    }
    return app?.stage || null;
  }

  function showFrozenFrameOverlay(previewNode) {
    const overlay = app?.ui?.frozenFrameOverlay;
    if (!overlay || !previewNode) return;

    if (state.frozenFrameNode && state.frozenFrameNode.parentNode) {
      state.frozenFrameNode.parentNode.removeChild(state.frozenFrameNode);
    }

    const positioningRoot = previewNode.offsetParent || previewNode.parentElement || previewNode;
    const rootStyle = window.getComputedStyle(positioningRoot);
    if (rootStyle.position === 'static') {
      positioningRoot.style.position = 'relative';
    }
    if (overlay.parentNode !== positioningRoot) {
      positioningRoot.appendChild(overlay);
    }

    const clone = previewNode.cloneNode(true);

    clone.setAttribute('aria-hidden', 'true');

    overlay.style.display = 'block';
    overlay.style.alignItems = 'unset';
    overlay.style.justifyContent = 'unset';

    clone.style.position = 'absolute';
    clone.style.left = `${previewNode.offsetLeft}px`;
    clone.style.top = `${previewNode.offsetTop}px`;
    clone.style.width = `${previewNode.offsetWidth}px`;
    clone.style.height = `${previewNode.offsetHeight}px`;
    clone.style.margin = '0';
    clone.style.pointerEvents = 'none';

    state.frozenFrameDataUrl = '';
    state.frozenFrameNode = clone;
    state.frozenFrameActive = true;
    overlay.appendChild(clone);
    overlay.hidden = false;
  }

  function clearShotVisualEffects() {
    const overlay = app?.ui?.frozenFrameOverlay;
    const image = app?.ui?.frozenFrameImage;
    const flash = app?.ui?.shutterFlashOverlay;
    const frozenNode = state.frozenFrameNode;

    state.frozenFrameActive = false;
    state.frozenFrameDataUrl = '';
    state.frozenFrameNode = null;

    if (overlay) overlay.hidden = true;
    if (image) image.removeAttribute('src');
    if (frozenNode && frozenNode.parentNode) frozenNode.parentNode.removeChild(frozenNode);

    clearFlashFadeTimers();
    if (flash) {
      flash.style.opacity = '0';
      flash.hidden = true;
    }
  }

  function readStableCameraFitBox(key){
    const stage = app.stage;
    if (!stage) return { w: 0, h: 0 };

    const fitBox = state[key];
    if (!fitBox) {
      state[key] = {
        w: stage.clientWidth,
        h: stage.clientHeight
      };
    } else {
      fitBox.w = Math.min(fitBox.w, stage.clientWidth);
      fitBox.h = Math.min(fitBox.h, stage.clientHeight);
    }

    return state[key];
  }

  function getStageFitSize() {
    const stage = app.stage;
    if (!stage) return { w: 0, h: 0 };

    if (isTextCameraLive()) {
      state.graphicCameraFitBox = null;
      return readStableCameraFitBox('textCameraFitBox');
    }

    if (isGraphicCameraLive()) {
      state.textCameraFitBox = null;
      return readStableCameraFitBox('graphicCameraFitBox');
    }

    state.textCameraFitBox = null;
    state.graphicCameraFitBox = null;
    return { w: stage.clientWidth, h: stage.clientHeight };
  }

  function getDefaultTextCharsetOption(){
    return TEXT_CHARSETS.DOTS;
  }

  function getDefaultImageCharsetOption(){
    return app.ui.charset?.options?.[0]?.value || '@%#*+=-:. ';
  }

  function rememberCurrentCharsetByMode(){
    const currentValue = app.ui.charset?.value;
    if (isTextMode()) {
      state.lastTextSymbolSet = currentValue || getDefaultTextCharsetOption();
    } else {
      state.lastImageSymbolSet = currentValue || getDefaultImageCharsetOption();
    }
  }

  function applyVisorModeUi() {
    if (app.out) {
      app.out.style.lineHeight = isTextMode() ? String(TEXT_PREVIEW_LINE_HEIGHT) : '1';
    }
    document.body.classList.toggle('visor-text', isTextMode());
    if (app.ui.styleRow) app.ui.styleRow.hidden = isTextMode();
    if (isTextMode()) {
      if (app.ui.style?.value === 'custom') {
        state.lastCustomImageColors = {
          color: state.color,
          background: state.background,
        };
      }
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
    } else {
      if (app.ui.colorRow) app.ui.colorRow.hidden = false;
      if (app.ui.style && app.ui.style.value && app.ui.style.value !== 'custom') {
        applyPreset(app.ui.style.value);
      } else if (app.ui.style?.value === 'custom' && state.lastCustomImageColors) {
        state.color = state.lastCustomImageColors.color;
        state.background = state.lastCustomImageColors.background;
        if (app.ui.fg) app.ui.fg.value = state.color;
        if (app.ui.bg) app.ui.bg.value = state.background;
        app.out.style.color = state.color;
        app.out.style.backgroundColor = state.background;
        app.stage.style.backgroundColor = state.background;
      }
    }
    if (app.ui.resetModeBtn) {
      app.ui.resetModeBtn.textContent = isTextMode() ? 'ТЕКСТ' : 'ГРАФИКА';
    }
    applyWidthLimitsForMode();
    rebuildCharsetOptions();
  }

  let modeChooserListenerBound = false;
  let startDateTimer = null;
  let startBlinkTimer = null;
  let startTypeTimer = null;
  let startEasterEggNextSound = 1;
  let startEasterEggPlaying = false;
  let startEasterEggDone = false;
  let startArgScenePending = false;
  let startArgSceneRunning = false;
  let startArgSceneStarted = false;
  let argSceneActive = false;
  let startArgSessionLocked = false;
  let startMenuPresetId = null;
  let startMenuCurrentBg = '#000000';
  let startEasterEggRouletteTimer = 0;
  let startEasterEggRouletteStartAt = 0;
  let startWordGlitchTimer = 0;
  let startWordGlitchBrokenChars = 0;
  let startWordGlitchFullChaos = false;
  let startWordGlitchSourceMap = null;
  let startLaunchSoundPlayed = false;
  let startLaunchSoundPendingAfterUnlock = false;
  let startPrintNextSound = 0;
  let startLastPrintSoundAt = 0;
  let workUiClickListenerBound = false;
  let workUiClickAudio = null;
  let audioUnlockListenerBound = false;
  let audioUnlockHandled = false;
  let audioUnlockProbe = null;
  let fingerprintGateStarted = false;
  let fingerprintGateAuthStarted = false;
  let fingerprintGateHoldTimer = null;
  let fingerprintGateBlinkTimer = null;
  let argPongRafId = 0;
  let argPongServeTimer = 0;
  let argPongFlashTimers = [];
  const argPongState = {
    running: false,
    ended: false,
    ballX: 0,
    ballY: 0,
    ballVX: 0,
    ballVY: 0,
    playerX: 0.5,
    aiX: 0.5,
    aiVX: 0,
    playerScore: 0,
    aiScore: 0,
    syncProgressMs: 0,
    syncActive: false,
    syncStartedAt: 0,
    targetPlayerX: 0.5,
    visorShiftX: 0,
    visorShiftY: 0,
    visorVX: 0,
    visorVY: 0,
    visorBodyPhaseX: 0,
    visorBodyPhaseY: 0,
    visorBodyPhaseBreath: 0,
    visorBodyPhaseSway: 0,
    visorEyePhaseX: 0,
    visorEyePhaseY: 0,
    visorEyeShiftX: 0,
    visorEyeShiftY: 0,
    visorPupilRecoilX: 0,
    visorPupilRecoilY: 0,
    visorPupilRecoilVX: 0,
    visorPupilRecoilVY: 0,
    visorPupilShiftX: 0,
    visorPupilShiftY: 0,
    visorEngineShakeX: 0,
    visorEngineShakeY: 0,
    visorEngineShakeTargetX: 0,
    visorEngineShakeTargetY: 0,
    visorEngineShakeEyeX: 0,
    visorEngineShakeEyeY: 0,
    visorEngineShakePupilX: 0,
    visorEngineShakePupilY: 0,
    visorEngineShakePulseLeftMs: 0,
    shakeX: 0,
    shakeY: 0,
    bossPresetId: null,
    bossAsciiOptions: {
      ...ARG_BOSS_ASCII_PRESET,
      color: '#ffffff',
      background: '#000000'
    }
  };
  const argBossAscii = {
    root: null,
    originalCanvas: null,
    originalCtx: null,
    asciiCanvas: null,
    asciiCtx: null,
    compositeCanvas: null,
    compositeCtx: null,
    bodyImage: null,
    eyeImage: null,
    pupilImage: null,
    ready: false,
    visualReady: false,
    failed: false,
    dpr: 1
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  function playUiSound(src) {
    if (!src) return Promise.resolve(false);
    const audio = new Audio(src);
    return audio.play().then(() => true).catch(() => false);
  }

  function playUiSoundNoThrow(src) {
    if (!src) return;
    playUiSound(src).catch(() => {});
  }

  function ensureArgOverlay() {
    let overlay = document.getElementById('argSceneOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'argSceneOverlay';
    overlay.className = 'arg-scene-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <div class="arg-scene-layer arg-scene-bg"></div>
      <div class="arg-scene-layer arg-scene-eye" id="argSceneEyeLayer">
        <div id="boss-root" class="arg-scene-boss-root">
          <canvas id="boss-original" hidden></canvas>
          <canvas id="boss-ascii" hidden></canvas>
        </div>
      </div>
      <div class="arg-scene-layer arg-scene-ball-stick" id="argSceneBallStickLayer"></div>
      <div class="arg-scene-layer arg-scene-countdown" id="argSceneCountdownLayer"></div>
      <div class="arg-scene-layer arg-scene-score" id="argSceneScoreLayer" hidden>
        <div class="arg-scene-score-top" id="argSceneAiScore">0</div>
        <div class="arg-scene-score-bottom" id="argScenePlayerScore">0</div>
      </div>
      <div class="arg-scene-layer arg-scene-goal-flash" id="argSceneGoalFlashLayer" hidden></div>
      <div class="arg-scene-layer arg-scene-popup" id="argScenePopupLayer" hidden>
        <div class="arg-scene-popup-box">
          <div class="arg-scene-popup-text" id="argScenePopupText"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function loadArgSceneImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function initArgBossAscii(overlay) {
    const root = overlay?.querySelector('#boss-root');
    const originalCanvas = overlay?.querySelector('#boss-original');
    const asciiCanvas = overlay?.querySelector('#boss-ascii');
    if (!root || !originalCanvas || !asciiCanvas) {
      argBossAscii.failed = true;
      argBossAscii.ready = false;
      return false;
    }

    const originalCtx = originalCanvas.getContext('2d');
    const asciiCtx = asciiCanvas.getContext('2d');
    if (!originalCtx || !asciiCtx) {
      argBossAscii.failed = true;
      argBossAscii.ready = false;
      return false;
    }

    if (!argBossAscii.compositeCanvas) {
      argBossAscii.compositeCanvas = document.createElement('canvas');
      argBossAscii.compositeCtx = argBossAscii.compositeCanvas.getContext('2d');
    }

    argBossAscii.root = root;
    argBossAscii.originalCanvas = originalCanvas;
    argBossAscii.originalCtx = originalCtx;
    argBossAscii.asciiCanvas = asciiCanvas;
    argBossAscii.asciiCtx = asciiCtx;
    const asciiContexts = [argBossAscii.originalCtx, argBossAscii.asciiCtx, argBossAscii.compositeCtx];
    for (const ctx of asciiContexts) {
      if (!ctx) continue;
      ctx.imageSmoothingEnabled = false;
      if (typeof ctx.webkitImageSmoothingEnabled === 'boolean') ctx.webkitImageSmoothingEnabled = false;
      if (typeof ctx.mozImageSmoothingEnabled === 'boolean') ctx.mozImageSmoothingEnabled = false;
      if (typeof ctx.msImageSmoothingEnabled === 'boolean') ctx.msImageSmoothingEnabled = false;
    }
    argBossAscii.failed = false;
    argBossAscii.visualReady = false;
    root.dataset.asciiReady = '0';
    originalCanvas.hidden = true;
    asciiCanvas.hidden = true;

    try {
      if (!argBossAscii.bodyImage || !argBossAscii.eyeImage || !argBossAscii.pupilImage) {
        const [bodyImage, eyeImage, pupilImage] = await Promise.all([
          loadArgSceneImage(ARG_SCENE_ASSETS.visorBody),
          loadArgSceneImage(ARG_SCENE_ASSETS.visorEye),
          loadArgSceneImage(ARG_SCENE_ASSETS.visorPupil)
        ]);
        argBossAscii.bodyImage = bodyImage;
        argBossAscii.eyeImage = eyeImage;
        argBossAscii.pupilImage = pupilImage;
      }
      argBossAscii.ready = true;
      return true;
    } catch (_) {
      argBossAscii.ready = false;
      argBossAscii.visualReady = false;
      argBossAscii.failed = true;
      root.dataset.asciiReady = '0';
      return false;
    }
  }

  function setArgBossVisualReady(overlay, { showAscii = true } = {}) {
    const root = overlay?.querySelector('#boss-root');
    const originalCanvas = overlay?.querySelector('#boss-original');
    const asciiCanvas = overlay?.querySelector('#boss-ascii');
    if (!root || !originalCanvas || !asciiCanvas) return;
    if (!argBossAscii.visualReady) {
      root.dataset.asciiReady = '0';
      originalCanvas.hidden = true;
      asciiCanvas.hidden = true;
      return;
    }
    root.dataset.asciiReady = '1';
    originalCanvas.hidden = false;
    asciiCanvas.hidden = !showAscii;
  }

  function ensureArgBossCanvasSize(overlay) {
    if (!argBossAscii.ready || !argBossAscii.originalCanvas || !argBossAscii.asciiCanvas || !argBossAscii.compositeCanvas) return;
    const rect = overlay?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    argBossAscii.dpr = dpr;

    const canvases = [argBossAscii.originalCanvas, argBossAscii.asciiCanvas, argBossAscii.compositeCanvas];
    for (const canvas of canvases) {
      if (!canvas) continue;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      canvas.style.width = `${Math.round(rect.width)}px`;
      canvas.style.height = `${Math.round(rect.height)}px`;
    }
  }

  function drawArgBossLayer(context, image, drawRect, transform = null) {
    if (!context || !image || !drawRect) return;
    const { cx, cy, drawW, drawH } = drawRect;
    context.save();
    if (transform) {
      context.translate(cx + (transform.tx || 0), cy + (transform.ty || 0));
      if (transform.rotateDeg) context.rotate((transform.rotateDeg * Math.PI) / 180);
      context.scale(transform.scaleX || 1, transform.scaleY || 1);
      context.translate(-cx, -cy);
    }
    context.drawImage(image, cx - drawW * 0.5, cy - drawH * 0.5, drawW, drawH);
    context.restore();
  }

  function drawArgBossBodySegmented(context, image, drawRect, baseTransform = null, segmentMotion = null) {
    if (!context || !image || !drawRect) return;
    const { cx, cy, drawW, drawH } = drawRect;
    const left = cx - drawW * 0.5;
    const top = cy - drawH * 0.5;
    const third = drawH / 3;
    const bandOverlap = Math.max(0.5, drawH * 0.0018);

    const drawBand = (clipTop, clipHeight, extraTransform = null) => {
      context.save();
      if (baseTransform) {
        context.translate(cx + (baseTransform.tx || 0), cy + (baseTransform.ty || 0));
        if (baseTransform.rotateDeg) context.rotate((baseTransform.rotateDeg * Math.PI) / 180);
        context.scale(baseTransform.scaleX || 1, baseTransform.scaleY || 1);
        context.translate(-cx, -cy);
      }
      if (extraTransform) {
        context.translate(cx + (extraTransform.tx || 0), cy + (extraTransform.ty || 0));
        if (extraTransform.rotateDeg) context.rotate((extraTransform.rotateDeg * Math.PI) / 180);
        context.scale(extraTransform.scaleX || 1, extraTransform.scaleY || 1);
        context.translate(-cx, -cy);
      }
      context.beginPath();
      context.rect(left, clipTop, drawW, clipHeight);
      context.clip();
      context.drawImage(image, left, top, drawW, drawH);
      context.restore();
    };

    drawBand(top - bandOverlap, third + bandOverlap * 2, segmentMotion?.top || null);
    drawBand(top + third - bandOverlap, third + bandOverlap * 2, null);
    drawBand(top + third * 2 - bandOverlap, third + bandOverlap * 2, segmentMotion?.bottom || null);
  }

  function getArgBossDrawRects(width, height) {
    const bodyImage = argBossAscii.bodyImage;
    const eyeImage = argBossAscii.eyeImage;
    const pupilImage = argBossAscii.pupilImage;
    if (!bodyImage || !eyeImage || !pupilImage || width < 2 || height < 2) return null;

    const safeBodyRatio = Math.max(0.2, Math.min(3.5, bodyImage.naturalWidth / Math.max(1, bodyImage.naturalHeight)));
    const baseBodyH = height * 1.02;
    const maxBodyW = width * 1.09;
    let bodyW = Math.min(maxBodyW, baseBodyH * safeBodyRatio);
    let bodyH = bodyW / safeBodyRatio;
    if (bodyH < height * 0.86) {
      bodyH = height * 0.86;
      bodyW = Math.min(maxBodyW, bodyH * safeBodyRatio);
    }
    const bodyCx = width * 0.5;
    const bodyCy = height * 0.5;

    const eyeBase = Math.min(bodyW, bodyH);
    const eyeScale = 1.05;
    const pupilScale = 1.05;
    const eyeW = eyeBase * 0.308 * eyeScale;
    const eyeH = eyeW;
    const eyeCx = bodyCx;
    const eyeCy = bodyCy;
    const pupilW = eyeBase * 0.308 * 0.226 * pupilScale;
    const pupilH = eyeBase * 0.308 * 0.64 * pupilScale;

    return {
      body: { cx: bodyCx, cy: bodyCy, drawW: bodyW, drawH: bodyH },
      eye: { cx: eyeCx, cy: eyeCy, drawW: eyeW, drawH: eyeH },
      pupil: { cx: eyeCx, cy: eyeCy, drawW: pupilW, drawH: pupilH }
    };
  }

  function renderArgBossAsciiIdleFrame() {
    if (!argBossAscii.ready || !argBossAscii.compositeCtx || !argBossAscii.originalCtx || !argBossAscii.asciiCtx || !argBossAscii.bodyImage || !argBossAscii.eyeImage || !argBossAscii.pupilImage) return false;
    const compositeCanvas = argBossAscii.compositeCanvas;
    const compositeCtx = argBossAscii.compositeCtx;
    const originalCtx = argBossAscii.originalCtx;
    const asciiCtx = argBossAscii.asciiCtx;
    const width = compositeCanvas.width;
    const height = compositeCanvas.height;
    const drawRects = getArgBossDrawRects(width, height);
    if (!drawRects) return false;

    compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
    compositeCtx.clearRect(0, 0, width, height);
    drawArgBossLayer(compositeCtx, argBossAscii.bodyImage, drawRects.body);
    drawArgBossLayer(compositeCtx, argBossAscii.eyeImage, drawRects.eye);
    drawArgBossLayer(compositeCtx, argBossAscii.pupilImage, drawRects.pupil);

    originalCtx.clearRect(0, 0, width, height);
    originalCtx.drawImage(compositeCanvas, 0, 0);
    const asciiResult = renderAsciiFromSource(compositeCanvas, asciiCtx, argPongState.bossAsciiOptions);
    argBossAscii.visualReady = asciiResult.ok;
    return asciiResult.ok;
  }

  async function animateArgPopupText(textEl, text) {
    if (!textEl) return;
    const alphabet = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const numberPool = ['1','2','3','4','5','6','7','8','9','10'];
    const randomSymbol = () => {
      if (Math.random() < 0.35) {
        return numberPool[Math.floor(Math.random() * numberPool.length)];
      }
      return alphabet[Math.floor(Math.random() * alphabet.length)];
    };

    textEl.textContent = '|';
    startPrintNextSound = 0;
    startLastPrintSoundAt = 0;
    for (let i = 0; i < text.length; i += 1) {
      const fixedPart = text.slice(0, i);
      textEl.classList.add('is-glitching');
      textEl.textContent = `${fixedPart}${randomSymbol()}|`;
      await sleep(ARG_SCENE_TIMINGS.popupGlitchMs);
      textEl.classList.remove('is-glitching');
      textEl.textContent = `${fixedPart}${text[i]}|`;
      playStartPrintSound();
      tgTextHaptic();
      await sleep(text[i] === ' ' ? ARG_SCENE_TIMINGS.popupSpaceTypeMs : ARG_SCENE_TIMINGS.popupCharTypeMs);
    }
    await sleep(120);
    textEl.textContent = text;
  }

  async function showArgPopup(text, { openSoundSrc = '', popupClass = '' } = {}) {
    const overlay = ensureArgOverlay();
    const popupLayer = overlay.querySelector('#argScenePopupLayer');
    const popupBox = overlay.querySelector('.arg-scene-popup-box');
    const textEl = overlay.querySelector('#argScenePopupText');
    if (!popupLayer || !popupBox || !textEl) return;

    popupLayer.hidden = false;
    popupBox.className = 'arg-scene-popup-box';
    if (popupClass) popupBox.classList.add(popupClass);
    if (openSoundSrc) playUiSoundNoThrow(openSoundSrc);
    await animateArgPopupText(textEl, text);

    await new Promise((resolve) => {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        popupLayer.removeEventListener('pointerup', onClose, true);
        popupLayer.removeEventListener('click', onClose, true);
        popupBox.className = 'arg-scene-popup-box';
        popupLayer.hidden = true;
        playUiSoundNoThrow(ARG_SCENE_SOUNDS.click);
        resolve();
      };
      const onClose = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        close();
      };
      popupLayer.addEventListener('pointerup', onClose, { capture: true });
      popupLayer.addEventListener('click', onClose, { capture: true });
    });
  }

  function stopArgPongLoop() {
    argPongState.running = false;
    argBossAscii.ready = false;
    argBossAscii.visualReady = false;
    argSceneActive = false;
    if (argPongRafId) {
      cancelAnimationFrame(argPongRafId);
      argPongRafId = 0;
    }
    if (argPongServeTimer) {
      clearTimeout(argPongServeTimer);
      argPongServeTimer = 0;
    }
    if (argPongFlashTimers.length) {
      argPongFlashTimers.forEach((id) => clearTimeout(id));
      argPongFlashTimers = [];
    }
    const overlay = document.getElementById('argSceneOverlay');
    const goalFlashLayer = overlay?.querySelector('#argSceneGoalFlashLayer');
    if (goalFlashLayer) goalFlashLayer.hidden = true;
  }

  function resetArgOverlayState() {
    const overlay = ensureArgOverlay();
    argSceneActive = false;
    argBossAscii.visualReady = false;
    const popupLayer = overlay.querySelector('#argScenePopupLayer');
    const goalFlashLayer = overlay.querySelector('#argSceneGoalFlashLayer');
    const countdownLayer = overlay.querySelector('#argSceneCountdownLayer');
    const scoreLayer = overlay.querySelector('#argSceneScoreLayer');
    const eyeLayer = overlay.querySelector('#argSceneEyeLayer');
    const ballStickLayer = overlay.querySelector('#argSceneBallStickLayer');
    const popupText = overlay.querySelector('#argScenePopupText');
    if (popupLayer) popupLayer.hidden = true;
    if (goalFlashLayer) goalFlashLayer.hidden = true;
    if (countdownLayer) countdownLayer.textContent = '';
    if (scoreLayer) scoreLayer.hidden = true;
    if (popupText) popupText.textContent = '';
    if (eyeLayer) {
      eyeLayer.querySelectorAll('.arg-scene-boss-layer').forEach((el) => el.remove());
      const bossOriginal = eyeLayer.querySelector('#boss-original');
      const bossAscii = eyeLayer.querySelector('#boss-ascii');
      const bossRoot = eyeLayer.querySelector('#boss-root');
      if (bossOriginal) {
        const originalCtx = bossOriginal.getContext('2d');
        if (originalCtx) originalCtx.clearRect(0, 0, bossOriginal.width, bossOriginal.height);
        bossOriginal.hidden = true;
      }
      if (bossAscii) {
        const asciiCtx = bossAscii.getContext('2d');
        if (asciiCtx) asciiCtx.clearRect(0, 0, bossAscii.width, bossAscii.height);
        bossAscii.hidden = true;
      }
      if (bossRoot) bossRoot.dataset.asciiReady = '0';
    }
    if (ballStickLayer) ballStickLayer.innerHTML = '';
    if (ballStickLayer) ballStickLayer.style.opacity = '1';
    overlay.hidden = true;
  }

  function returnToStartMenu() {
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = false;
    startModeChooserFx();
  }

  function isArgAiFinalStand() {
    return argPongState.playerScore >= (ARG_PONG.scoreToWin - 1);
  }

  async function finishArgMatch(result = 'lose') {
    if (argPongState.ended) return;
    argPongState.ended = true;
    stopArgPongLoop();
    if (result === 'win') {
      await showArgPopup('ТЫ ОДОЛЕЛ СИСТЕМУ');
      resetArgOverlayState();
      returnToStartMenu();
      startArgSessionLocked = true;
      startArgScenePending = false;
      startArgSceneRunning = false;
      startArgSceneStarted = false;
      return;
    }

    await showArgPopup('ТЫ ТАК И НЕ УВИДЕЛ СУТЬ...');
    resetArgOverlayState();
    returnToStartMenu();
    startArgSessionLocked = true;
    startArgScenePending = false;
    startArgSceneRunning = false;
    startArgSceneStarted = false;
  }

  async function runArgCountdown() {
    const overlay = ensureArgOverlay();
    const layer = overlay.querySelector('#argSceneCountdownLayer');
    if (!layer) return;
    layer.classList.add('arg-scene-countdown--dim');
    try {
      for (const value of ['3', '2', '1']) {
        layer.textContent = value;
        await sleep(ARG_SCENE_TIMINGS.countdownStepMs);
      }
      layer.textContent = '';
    } finally {
      layer.classList.remove('arg-scene-countdown--dim');
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function resetArgBall(serveToPlayer = true) {
    argPongState.ballX = 0.5;
    argPongState.ballY = 0.5;
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = serveToPlayer ? 1 : -1;
    argPongState.ballVX = dirX * ARG_PONG.ballBaseSpeedPx;
    argPongState.ballVY = dirY * ARG_PONG.ballBaseSpeedPx;
  }

  function applyTinyShake(intensity = ARG_PONG.shakeHitAmountPx) {
    argPongState.shakeX += (Math.random() * 2 - 1) * intensity;
    argPongState.shakeY += (Math.random() * 2 - 1) * intensity;
  }

  function startArgBossIntroLoop({ overlay, visorBody, visorEye, visorPupil }) {
    if (!overlay || !visorBody || !visorEye || !visorPupil) return;
    if (argPongRafId) cancelAnimationFrame(argPongRafId);
    let lastTs = performance.now();
    const loop = (ts) => {
      if (!argSceneActive || argPongState.running) {
        argPongRafId = 0;
        return;
      }
      const now = ts || performance.now();
      lastTs = now;
      argPongState.visorShiftX += (0 - argPongState.visorShiftX) * 0.2;
      argPongState.visorShiftY += (0 - argPongState.visorShiftY) * 0.2;
      argPongState.visorEyeShiftX += (0 - argPongState.visorEyeShiftX) * 0.22;
      argPongState.visorEyeShiftY += (0 - argPongState.visorEyeShiftY) * 0.22;
      const visorBodyOffsetX =
        Math.sin(now * ARG_PONG.visorBodyDriftSpeedX + argPongState.visorBodyPhaseX) * ARG_PONG.visorBodyDriftAmpXPx
        + Math.cos(now * ARG_PONG.visorBodyMicroJitterSpeedX + argPongState.visorBodyPhaseY * 0.67) * ARG_PONG.visorBodyMicroJitterAmpXPx
        + Math.sin(now * ARG_PONG.visorBodyPulseSpeedX + argPongState.visorBodyPhaseBreath) * ARG_PONG.visorBodyPulseAmpXPx;
      const visorBodyOffsetY =
        Math.cos(now * ARG_PONG.visorBodyDriftSpeedY + argPongState.visorBodyPhaseY) * ARG_PONG.visorBodyDriftAmpYPx
        + Math.sin(now * ARG_PONG.visorBodyMicroJitterSpeedY + argPongState.visorBodyPhaseX * 0.83) * ARG_PONG.visorBodyMicroJitterAmpYPx
        + Math.cos(now * ARG_PONG.visorBodyPulseSpeedY + argPongState.visorBodyPhaseBreath * 1.19) * ARG_PONG.visorBodyPulseAmpYPx;
      const eyeJitterX =
        Math.sin(now * 0.028 + argPongState.visorEyePhaseX * 1.7) * 0.48
        + Math.cos(now * 0.043 + argPongState.visorEyePhaseY * 0.9) * 0.38;
      const eyeJitterY =
        Math.cos(now * 0.031 + argPongState.visorEyePhaseY * 1.4) * 0.42
        + Math.sin(now * 0.047 + argPongState.visorEyePhaseX * 0.8) * 0.34;
      const visorBodyShakeY = visorBodyOffsetY;
      const visorEyeX = eyeJitterX;
      const visorEyeY = eyeJitterY;
      argPongState.visorPupilShiftX += (0 - argPongState.visorPupilShiftX) * ARG_PONG.visorPupilFollowLerp;
      argPongState.visorPupilShiftY += (0 - argPongState.visorPupilShiftY) * ARG_PONG.visorPupilFollowLerp;
      const visorPupilX = visorEyeX * 1.08;
      const visorPupilY = visorEyeY * 1.08;
      const bodyScale = 1 + Math.sin(
        now * ARG_PONG.visorBodyScaleBreathSpeed + argPongState.visorBodyPhaseBreath
      ) * (ARG_PONG.visorBodyScaleBreathAmp * 1.65);
      const bodySqueeze = Math.cos(
        now * ARG_PONG.visorBodySqueezeSpeed + argPongState.visorBodyPhaseSway * 0.91
      ) * (ARG_PONG.visorBodySqueezeAmp * 1.35);
      const bodyRotate = Math.sin(
        now * ARG_PONG.visorBodySwaySpeed + argPongState.visorBodyPhaseSway
      ) * 0.28;
      const bodyBandPulse = Math.sin(
        now * ARG_PONG.visorBodyScaleBreathSpeed * 1.14 + argPongState.visorBodyPhaseBreath * 1.65
      );
      const bodyBandSway = Math.cos(
        now * ARG_PONG.visorBodySwaySpeed * 1.21 + argPongState.visorBodyPhaseSway * 1.24
      );
      visorBody.style.transform = `translate(${visorBodyOffsetX}px, ${visorBodyShakeY}px) rotate(${bodyRotate}deg) scale(${bodyScale + bodySqueeze}, ${bodyScale - bodySqueeze * 0.75})`;
      const eyeScale = 1.1 + Math.sin(now * ARG_PONG.visorEyeBreathScaleSpeed + argPongState.visorEyePhaseX) * ARG_PONG.visorEyeBreathScaleAmp;
      const pupilScale = 1.1;
      visorEye.style.transform = `translate(${visorEyeX}px, ${visorEyeY}px) scale(${eyeScale})`;
      visorPupil.style.transform = `translate(${visorPupilX}px, ${visorPupilY}px) scale(${pupilScale})`;
      const rect = overlay.getBoundingClientRect();
      renderFightAsciiFrame({
        rect,
        visorBodyX: visorBodyOffsetX,
        visorBodyY: visorBodyShakeY,
        bodyRotate,
        bodyScaleX: bodyScale + bodySqueeze,
        bodyScaleY: bodyScale - bodySqueeze * 0.75,
        bodyBandPulse,
        bodyBandSway,
        visorEyeX,
        visorEyeY,
        eyeScale,
        pupilScale,
        visorPupilX,
        visorPupilY
      });
      argPongRafId = requestAnimationFrame(loop);
    };
    argPongRafId = requestAnimationFrame(loop);
  }

  function bindArgPlayerControls(overlay) {
    if (!overlay || overlay.dataset.argControlsBound === '1') return;
    const rectCache = {
      left: 0,
      width: 0,
      height: 0
    };
    const updateRectCache = () => {
      const rect = overlay.getBoundingClientRect();
      rectCache.left = rect.left;
      rectCache.width = rect.width;
      rectCache.height = rect.height;
    };
    updateRectCache();
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(updateRectCache);
      ro.observe(overlay);
      overlay.__argControlsResizeObserver = ro;
    }
    const updateTarget = (clientX) => {
      if (!rectCache.width) return;
      argPongState.targetPlayerX = clamp((clientX - rectCache.left) / rectCache.width, 0, 1);
    };
    overlay.addEventListener('pointerdown', (e) => updateTarget(e.clientX), { passive: true });
    overlay.addEventListener('pointermove', (e) => updateTarget(e.clientX), { passive: true });
    overlay.addEventListener('touchstart', (e) => {
      const touch = e.touches?.[0];
      if (touch) updateTarget(touch.clientX);
    }, { passive: true });
    overlay.addEventListener('touchmove', (e) => {
      const touch = e.touches?.[0];
      if (touch) updateTarget(touch.clientX);
    }, { passive: true });
    overlay.addEventListener('mousemove', (e) => updateTarget(e.clientX), { passive: true });
    window.addEventListener('resize', updateRectCache, { passive: true });
    window.addEventListener('orientationchange', updateRectCache, { passive: true });
    overlay.__argControlsUpdateRectCache = updateRectCache;
    overlay.dataset.argControlsBound = '1';
  }

  function predictArgAiInterceptX({ rect, paddleHalfNorm, wallNorm, topY, bottomY, paddleHalfH, ballHalfY, ballHalfX }) {
    const targetY = topY + paddleHalfH + ballHalfY;
    const vyNorm = argPongState.ballVY / rect.height;
    if (Math.abs(vyNorm) < 1e-6) return clamp(argPongState.ballX, paddleHalfNorm, 1 - paddleHalfNorm);
    let timeToPaddle = 0;
    if (vyNorm < 0) {
      timeToPaddle = (targetY - argPongState.ballY) / vyNorm;
    } else {
      const bottomTargetY = bottomY - paddleHalfH - ballHalfY;
      const downDistance = Math.max(0, bottomTargetY - argPongState.ballY);
      const upDistance = Math.max(0, bottomTargetY - targetY);
      timeToPaddle = (downDistance + upDistance) / vyNorm;
    }
    if (!(timeToPaddle > 0)) return clamp(argPongState.ballX, paddleHalfNorm, 1 - paddleHalfNorm);

    const minX = wallNorm + ballHalfX;
    const maxX = 1 - wallNorm - ballHalfX;
    let projectedX = argPongState.ballX + (argPongState.ballVX / rect.width) * timeToPaddle;
    const span = maxX - minX;
    if (span <= 0) return clamp(projectedX, paddleHalfNorm, 1 - paddleHalfNorm);

    while (projectedX < minX || projectedX > maxX) {
      if (projectedX < minX) projectedX = minX + (minX - projectedX);
      if (projectedX > maxX) projectedX = maxX - (projectedX - maxX);
    }
    return clamp(projectedX, paddleHalfNorm, 1 - paddleHalfNorm);
  }

  function startArgPong({ overlay, ballStickLayer, ball, topStick, bottomStick, visorBody, visorEye, visorPupil, scoreLayer, aiScoreEl, playerScoreEl, preserveBossState = false }) {
    if (!overlay || !ballStickLayer || !ball || !topStick || !bottomStick || !visorBody || !visorEye || !visorPupil || !scoreLayer || !aiScoreEl || !playerScoreEl) return;
    if (argPongRafId) cancelAnimationFrame(argPongRafId);
    argPongState.running = true;
    argPongState.ended = false;
    argPongState.playerScore = 0;
    argPongState.aiScore = 0;
    argPongState.playerX = 0.5;
    argPongState.aiX = 0.5;
    argPongState.aiVX = 0;
    argPongState.syncProgressMs = 0;
    argPongState.syncActive = false;
    argPongState.syncStartedAt = 0;
    argPongState.targetPlayerX = 0.5;
    if (!preserveBossState) {
      argPongState.visorShiftX = 0;
      argPongState.visorShiftY = 0;
      argPongState.visorEyeShiftX = 0;
      argPongState.visorEyeShiftY = 0;
      argPongState.visorPupilRecoilX = 0;
      argPongState.visorPupilRecoilY = 0;
      argPongState.visorPupilRecoilVX = 0;
      argPongState.visorPupilRecoilVY = 0;
      argPongState.visorPupilShiftX = 0;
      argPongState.visorPupilShiftY = 0;
      argPongState.visorBodyPhaseX = Math.random() * Math.PI * 2;
      argPongState.visorBodyPhaseY = Math.random() * Math.PI * 2;
      argPongState.visorBodyPhaseBreath = Math.random() * Math.PI * 2;
      argPongState.visorBodyPhaseSway = Math.random() * Math.PI * 2;
      argPongState.visorEyePhaseX = Math.random() * Math.PI * 2;
      argPongState.visorEyePhaseY = Math.random() * Math.PI * 2;
    }
    argPongState.visorEngineShakeX = 0;
    argPongState.visorEngineShakeY = 0;
    argPongState.visorEngineShakeTargetX = 0;
    argPongState.visorEngineShakeTargetY = 0;
    argPongState.visorEngineShakeEyeX = 0;
    argPongState.visorEngineShakeEyeY = 0;
    argPongState.visorEngineShakePupilX = 0;
    argPongState.visorEngineShakePupilY = 0;
    argPongState.visorEngineShakePulseLeftMs = 0;
    argPongState.shakeX = 0;
    argPongState.shakeY = 0;
    playerScoreEl.textContent = '0';
    aiScoreEl.textContent = '0';
    aiScoreEl.style.top = `${ARG_PONG.topScoreYVh}vh`;
    aiScoreEl.style.bottom = '';
    playerScoreEl.style.bottom = `${ARG_PONG.bottomScoreYVh}vh`;
    playerScoreEl.style.top = '';
    scoreLayer.hidden = false;
    resetArgBall(Math.random() > 0.5);
    bindArgPlayerControls(overlay);
    const bossRoot = overlay.querySelector('#boss-root');
    const runBossAscii = async () => {
      const ok = await initArgBossAscii(overlay);
      if (!ok) {
        if (bossRoot) bossRoot.dataset.asciiReady = '0';
        argBossAscii.visualReady = false;
        ballStickLayer.style.opacity = '1';
        setArgBossVisualReady(overlay, { showAscii: false });
        return;
      }
      ballStickLayer.style.opacity = '1';
    };
    runBossAscii().catch(() => {
      if (bossRoot) bossRoot.dataset.asciiReady = '0';
      argBossAscii.visualReady = false;
      ballStickLayer.style.opacity = '1';
      setArgBossVisualReady(overlay, { showAscii: false });
    });
    const parseHexColor = (hex, fallback = '#ffffff') => {
      const safe = norm(toHex(hex || fallback));
      const full = safe.length === 3
        ? safe.split('').map((ch) => ch + ch).join('')
        : safe;
      if (!/^[0-9a-f]{6}$/i.test(full)) {
        const fallbackSafe = norm(toHex(fallback));
        return {
          r: parseInt(fallbackSafe.slice(0, 2), 16) || 255,
          g: parseInt(fallbackSafe.slice(2, 4), 16) || 255,
          b: parseInt(fallbackSafe.slice(4, 6), 16) || 255
        };
      }
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16)
      };
    };
    const rgbToHex = ({ r, g, b }) => `#${
      [r, g, b]
        .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
        .join('')
    }`;
    const getBossShadeFromText = (textHex) => {
      const rgb = parseHexColor(textHex, '#ffffff');
      return rgbToHex({
        r: rgb.r * 0.5,
        g: rgb.g * 0.5,
        b: rgb.b * 0.5
      });
    };
    const applyBossFightPalette = ({ text, bg, presetId = null } = {}) => {
      const safeText = toHex(text || '#ffffff');
      const safeBg = toHex(bg || '#000000');
      const bossShade = getBossShadeFromText(safeText);
      argPongState.bossPresetId = presetId;
      argPongState.bossAsciiOptions.color = safeText;
      argPongState.bossAsciiOptions.background = safeBg;
      argPongState.bossAsciiOptions.bossColor = bossShade;
      overlay.style.backgroundColor = safeBg;
      ball.style.backgroundColor = safeText;
      topStick.style.backgroundColor = safeText;
      bottomStick.style.backgroundColor = safeText;
      overlay.style.setProperty('--arg-popup-fg', safeText);
      overlay.style.setProperty('--arg-popup-bg', safeBg);
      overlay.style.setProperty('--arg-score-fg', bossShade);
      overlay.style.setProperty('--arg-score-bg', safeBg);
      const popupLayer = overlay.querySelector('#argScenePopupLayer');
      if (popupLayer) popupLayer.style.filter = 'none';
    };
    const applyRandomBossFightPreset = () => {
      if (!PRESETS.length) return;
      let nextPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      if (nextPreset && PRESETS.length > 1 && nextPreset.id === argPongState.bossPresetId) {
        nextPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      }
      const colors = getPresetColorsById(nextPreset?.id);
      if (!colors) return;
      applyBossFightPalette({ ...colors, presetId: nextPreset.id });
    };
    applyBossFightPalette({ text: '#ffffff', bg: '#000000', presetId: null });
    ballStickLayer.style.opacity = '1';

    const playGoalFlashBurst = () => new Promise((resolve) => {
      const goalFlashLayer = overlay.querySelector('#argSceneGoalFlashLayer');
      if (!goalFlashLayer) {
        resolve();
        return;
      }
      const stepMs = Math.max(1, Math.floor(ARG_SCENE_TIMINGS.goalFlashBurstMs / 6));
      let step = 0;
      goalFlashLayer.hidden = false;
      const tick = () => {
        if (!argPongState.running) {
          goalFlashLayer.hidden = true;
          resolve();
          return;
        }
        const flashOn = (step % 2 === 0);
        goalFlashLayer.style.opacity = flashOn ? '1' : '0';
        if (flashOn) tgGoalFlashHaptic();
        step += 1;
        if (step >= 6) {
          goalFlashLayer.style.opacity = '0';
          goalFlashLayer.hidden = true;
          resolve();
          return;
        }
        const timerId = setTimeout(tick, stepMs);
        argPongFlashTimers.push(timerId);
      };
      tick();
    });

    const renderFightAsciiFrame = ({
      rect,
      visorBodyX = 0,
      visorBodyY = 0,
      bodyRotate = 0,
      bodyScaleX = 1,
      bodyScaleY = 1,
      bodyBandPulse = 0,
      bodyBandSway = 0,
      visorEyeX = 0,
      visorEyeY = 0,
      eyeScale = 1,
      pupilScale = 1,
      visorPupilX = 0,
      visorPupilY = 0
    } = {}) => {
      if (!argBossAscii.ready || !argBossAscii.compositeCtx || !argBossAscii.originalCtx || !argBossAscii.asciiCtx) return;
      const compositeCanvas = argBossAscii.compositeCanvas;
      const compositeCtx = argBossAscii.compositeCtx;
      const originalCtx = argBossAscii.originalCtx;
      const asciiCtx = argBossAscii.asciiCtx;
      const width = compositeCanvas.width;
      const height = compositeCanvas.height;
      if (width < 2 || height < 2 || !rect?.width || !rect?.height) return;

      const dpr = argBossAscii.dpr || 1;
      const sx = width / Math.max(1, rect.width);
      const sy = height / Math.max(1, rect.height);
      compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
      compositeCtx.clearRect(0, 0, width, height);

      const drawRects = getArgBossDrawRects(width, height);
      if (drawRects && argBossAscii.bodyImage && argBossAscii.eyeImage && argBossAscii.pupilImage) {
        compositeCtx.save();
        compositeCtx.globalAlpha = 0.5;
        drawArgBossBodySegmented(compositeCtx, argBossAscii.bodyImage, drawRects.body, {
          tx: visorBodyX * dpr,
          ty: visorBodyY * dpr,
          rotateDeg: bodyRotate,
          scaleX: bodyScaleX,
          scaleY: bodyScaleY
        }, {
          top: {
            ty: (-Math.abs(bodyBandPulse) * 2.1 + bodyBandSway * 0.9) * dpr,
            rotateDeg: bodyBandSway * 0.38,
            scaleX: 1 + bodyBandPulse * 0.022,
            scaleY: 1 - Math.abs(bodyBandPulse) * 0.03
          },
          bottom: {
            ty: (Math.abs(bodyBandPulse) * 2.4 - bodyBandSway * 0.95) * dpr,
            rotateDeg: -bodyBandSway * 0.42,
            scaleX: 1 - bodyBandPulse * 0.02,
            scaleY: 1 + Math.abs(bodyBandPulse) * 0.034
          }
        });
        drawArgBossLayer(compositeCtx, argBossAscii.eyeImage, drawRects.eye, {
          tx: visorEyeX * dpr,
          ty: visorEyeY * dpr,
          scaleX: eyeScale,
          scaleY: eyeScale
        });
        drawArgBossLayer(compositeCtx, argBossAscii.pupilImage, drawRects.pupil, {
          tx: visorPupilX * dpr,
          ty: visorPupilY * dpr,
          scaleX: pupilScale,
          scaleY: pupilScale
        });
        compositeCtx.restore();
      }

      originalCtx.clearRect(0, 0, width, height);
      originalCtx.drawImage(compositeCanvas, 0, 0);
      const asciiResult = renderAsciiFromSource(compositeCanvas, asciiCtx, argPongState.bossAsciiOptions);
      if (!asciiResult.ok) {
        setArgBossVisualReady(overlay, { showAscii: false });
        return;
      }

      argBossAscii.visualReady = true;
      setArgBossVisualReady(overlay, { showAscii: true });
    };

    let serveLocked = false;
    let prevTs = 0;
    const loop = () => {
      if (!argPongState.running) return;
      const rect = overlay.getBoundingClientRect();
      const now = performance.now();
      const deltaMs = prevTs ? Math.min(64, now - prevTs) : 16.67;
      prevTs = now;
      if (!rect.width || !rect.height) {
        argPongRafId = requestAnimationFrame(loop);
        return;
      }
      ensureArgBossCanvasSize(overlay);

      const paddleHalfNorm = (ARG_PONG.paddleWidthPx * 0.5) / rect.width;
      argPongState.playerX += (argPongState.targetPlayerX - argPongState.playerX) * ARG_PONG.playerPointerSmoothing;
      argPongState.playerX = clamp(argPongState.playerX, paddleHalfNorm, 1 - paddleHalfNorm);

      const syncDistanceNorm = ARG_PONG.syncDistancePx / rect.width;
      const syncDelta = Math.abs(argPongState.playerX - argPongState.aiX);
      if (syncDelta <= syncDistanceNorm) {
        argPongState.syncProgressMs = Math.min(ARG_PONG.syncHoldMs, argPongState.syncProgressMs + deltaMs);
      } else {
        argPongState.syncProgressMs = Math.max(0, argPongState.syncProgressMs - deltaMs * ARG_PONG.syncDecayPerMs);
      }
      if (!argPongState.syncActive && argPongState.syncProgressMs >= ARG_PONG.syncHoldMs) {
        argPongState.syncActive = true;
        argPongState.syncStartedAt = now;
      }
      if (argPongState.syncActive && (now - argPongState.syncStartedAt >= ARG_PONG.syncMaxDurationMs)) {
        argPongState.syncActive = false;
        argPongState.syncProgressMs = 0;
        argPongState.syncStartedAt = 0;
      }

      const topY = ARG_PONG.topPaddleYVh / 100;
      const bottomY = ARG_PONG.bottomPaddleYVh / 100;
      const paddleHalfW = (ARG_PONG.paddleWidthPx * 0.5) / rect.width;
      const paddleHalfH = (ARG_PONG.paddleHeightPx * 0.5) / rect.height;
      const ballSizePx = ARG_PONG.paddleHeightPx * ARG_PONG.ballSizeToPaddleHeightRatio;
      const ballHalfX = (ballSizePx * 0.5) / rect.width;
      const ballHalfY = (ballSizePx * 0.5) / rect.height;
      const wallNorm = ARG_PONG.sideWallPaddingPx / rect.width;

      let aiTargetX = argPongState.ballX;
      let aiMaxSpeedPx = ARG_PONG.aiMaxSpeedPx;
      let aiAccelPx = 0.6;
      let aiDeadZonePx = ARG_PONG.aiTrackDeadZonePx;
      let aiIdleDamping = 0.8;
      if (argPongState.syncActive) {
        aiTargetX = argPongState.playerX;
        aiMaxSpeedPx = ARG_PONG.syncFollowMaxSpeedPx;
        aiAccelPx = ARG_PONG.syncFollowAccelPx;
        aiDeadZonePx = 1;
      } else {
        const aiLevel = isArgAiFinalStand()
          ? ARG_PONG.aiFinalStand
          : ARG_PONG.aiLevels[Math.min(argPongState.playerScore, ARG_PONG.aiLevels.length - 1)];
        const predictedX = predictArgAiInterceptX({
          rect,
          paddleHalfNorm,
          wallNorm,
          topY,
          bottomY,
          paddleHalfH,
          ballHalfY,
          ballHalfX
        });
        const predictiveBlend = argPongState.ballVY < 0
          ? aiLevel.predictiveBlend
          : aiLevel.repositionBlend;
        const baseTrackX = argPongState.ballX + (predictedX - argPongState.ballX) * predictiveBlend;
        const lookAheadNorm = clamp(argPongState.ballVX * aiLevel.autoAim * 6 / rect.width, -0.2, 0.2);
        const humanizeNorm = aiLevel.humanizePx > 0
          ? ((Math.sin(now * 0.0127) + Math.cos((now + argPongState.playerScore * 137) * 0.0091)) * 0.5 * aiLevel.humanizePx) / rect.width
          : 0;
        const aimX = clamp(baseTrackX + lookAheadNorm + humanizeNorm, paddleHalfNorm, 1 - paddleHalfNorm);
        aiTargetX += (aimX - aiTargetX) * aiLevel.reaction;
        aiMaxSpeedPx = aiLevel.maxSpeedPx;
        aiAccelPx = aiLevel.accelPx;
        aiDeadZonePx = aiLevel.deadZonePx;
        aiIdleDamping = aiLevel.idleDamping;
      }

      const aiDelta = aiTargetX - argPongState.aiX;
      if (Math.abs(aiDelta) > (aiDeadZonePx / rect.width)) {
        const targetAiVx = clamp(aiDelta, -aiMaxSpeedPx / rect.width, aiMaxSpeedPx / rect.width);
        const aiAccelNorm = aiAccelPx / rect.width;
        if (argPongState.aiVX < targetAiVx) {
          argPongState.aiVX = Math.min(targetAiVx, argPongState.aiVX + aiAccelNorm);
        } else {
          argPongState.aiVX = Math.max(targetAiVx, argPongState.aiVX - aiAccelNorm);
        }
      } else {
        argPongState.aiVX *= aiIdleDamping;
      }
      argPongState.aiX = clamp(argPongState.aiX + argPongState.aiVX, paddleHalfNorm, 1 - paddleHalfNorm);

      argPongState.ballX += argPongState.ballVX / rect.width;
      argPongState.ballY += argPongState.ballVY / rect.height;
      if (argPongState.ballX - ballHalfX <= wallNorm || argPongState.ballX + ballHalfX >= 1 - wallNorm) {
        argPongState.ballX = clamp(argPongState.ballX, wallNorm + ballHalfX, 1 - wallNorm - ballHalfX);
        argPongState.ballVX *= -1;
        applyRandomBossFightPreset();
        applyTinyShake();
        tgEventHaptic();
      }

      const hitTop = argPongState.ballVY < 0
        && (argPongState.ballY - ballHalfY <= topY + paddleHalfH)
        && (argPongState.ballY > topY)
        && (Math.abs(argPongState.ballX - argPongState.aiX) <= paddleHalfW + ballHalfX * 0.6);
      if (hitTop) {
        const offset = clamp((argPongState.ballX - argPongState.aiX) / paddleHalfW, -1, 1);
        argPongState.ballVY = Math.abs(argPongState.ballVY);
        argPongState.ballVX += offset * ARG_PONG.paddleBounceBoost * ARG_PONG.ballBaseSpeedPx;
        argPongState.ballVX = clamp(argPongState.ballVX, -ARG_PONG.ballMaxSpeedPx, ARG_PONG.ballMaxSpeedPx);
        argPongState.ballY = topY + paddleHalfH + ballHalfY;
        applyTinyShake();
        tgEventHaptic();
      }

      const hitBottom = argPongState.ballVY > 0
        && (argPongState.ballY + ballHalfY >= bottomY - paddleHalfH)
        && (argPongState.ballY < bottomY)
        && (Math.abs(argPongState.ballX - argPongState.playerX) <= paddleHalfW + ballHalfX * 0.6);
      if (hitBottom) {
        const offset = clamp((argPongState.ballX - argPongState.playerX) / paddleHalfW, -1, 1);
        argPongState.ballVY = -Math.abs(argPongState.ballVY);
        argPongState.ballVX += offset * ARG_PONG.paddleBounceBoost * ARG_PONG.ballBaseSpeedPx;
        argPongState.ballVX = clamp(argPongState.ballVX, -ARG_PONG.ballMaxSpeedPx, ARG_PONG.ballMaxSpeedPx);
        argPongState.ballY = bottomY - paddleHalfH - ballHalfY;
        applyTinyShake();
        tgEventHaptic();
      }

      const topGoalLine = topY + paddleHalfH + ballHalfY;
      const bottomGoalLine = bottomY - paddleHalfH - ballHalfY;
      if (!serveLocked && argPongState.ballVY < 0 && argPongState.ballY < topGoalLine) {
        playUiSoundNoThrow(ARG_SCENE_SOUNDS.bitClick2);
        argPongState.playerScore += 1;
        playerScoreEl.textContent = String(argPongState.playerScore);
        if (argPongState.playerScore >= ARG_PONG.scoreToWin) {
          finishArgMatch('win');
          return;
        }
        serveLocked = true;
        argPongServeTimer = setTimeout(() => {
          if (!argPongState.running) return;
          argPongServeTimer = 0;
          playGoalFlashBurst().then(() => {
            if (!argPongState.running) return;
            argPongServeTimer = setTimeout(() => {
              if (!argPongState.running) return;
              resetArgBall(false);
              serveLocked = false;
              argPongServeTimer = 0;
            }, ARG_SCENE_TIMINGS.goalRespawnDelayMs);
          });
        }, ARG_SCENE_TIMINGS.serveDelayMs);
      } else if (!serveLocked && argPongState.ballVY > 0 && argPongState.ballY > bottomGoalLine) {
        playUiSoundNoThrow(ARG_SCENE_SOUNDS.bitClick2);
        argPongState.aiScore += 1;
        aiScoreEl.textContent = String(argPongState.aiScore);
        if (argPongState.aiScore >= ARG_PONG.scoreToWin) {
          finishArgMatch('lose');
          return;
        }
        serveLocked = true;
        argPongServeTimer = setTimeout(() => {
          if (!argPongState.running) return;
          argPongServeTimer = 0;
          playGoalFlashBurst().then(() => {
            if (!argPongState.running) return;
            argPongServeTimer = setTimeout(() => {
              if (!argPongState.running) return;
              resetArgBall(true);
              serveLocked = false;
              argPongServeTimer = 0;
            }, ARG_SCENE_TIMINGS.goalRespawnDelayMs);
          });
        }, ARG_SCENE_TIMINGS.serveDelayMs);
      }

      if (serveLocked) {
        argPongState.ballX = 0.5;
        argPongState.ballY = 0.5;
      }

      const ballOffsetFromEyeX = 0.5 - argPongState.ballX;
      const ballOffsetFromEyeY = argPongState.ballY - 0.5;
      const maxShiftX = ARG_PONG.visorEyeMaxShiftXPx * ARG_PONG.visorFollowRadiusBoost;
      const maxShiftY = ARG_PONG.visorEyeMaxShiftYPx * ARG_PONG.visorFollowRadiusBoost;
      const ballTargetX = ballOffsetFromEyeX * 2 * maxShiftX;
      const ballTargetY = ballOffsetFromEyeY * 2 * maxShiftY;
      const clampedTargetX = clamp(ballTargetX, -maxShiftX, maxShiftX);
      const clampedTargetY = clamp(ballTargetY, -maxShiftY, maxShiftY);
      argPongState.visorVX += (clampedTargetX - argPongState.visorShiftX) * ARG_PONG.visorEyeSpring;
      argPongState.visorVY += (clampedTargetY - argPongState.visorShiftY) * ARG_PONG.visorEyeSpring;
      argPongState.visorVX *= ARG_PONG.visorEyeDamping;
      argPongState.visorVY *= ARG_PONG.visorEyeDamping;
      argPongState.visorVX = clamp(argPongState.visorVX, -ARG_PONG.visorEyeMaxSpeedPx, ARG_PONG.visorEyeMaxSpeedPx);
      argPongState.visorVY = clamp(argPongState.visorVY, -ARG_PONG.visorEyeMaxSpeedPx, ARG_PONG.visorEyeMaxSpeedPx);
      argPongState.visorShiftX = clamp(argPongState.visorShiftX + argPongState.visorVX, -maxShiftX, maxShiftX);
      argPongState.visorShiftY = clamp(argPongState.visorShiftY + argPongState.visorVY, -maxShiftY, maxShiftY);
      const visorBodyOffsetX =
        Math.sin(now * ARG_PONG.visorBodyDriftSpeedX + argPongState.visorBodyPhaseX) * ARG_PONG.visorBodyDriftAmpXPx
        + Math.cos(now * ARG_PONG.visorBodyMicroJitterSpeedX + argPongState.visorBodyPhaseY * 0.67) * ARG_PONG.visorBodyMicroJitterAmpXPx
        + Math.sin(now * ARG_PONG.visorBodyPulseSpeedX + argPongState.visorBodyPhaseBreath) * ARG_PONG.visorBodyPulseAmpXPx;
      const visorBodyOffsetY =
        Math.cos(now * ARG_PONG.visorBodyDriftSpeedY + argPongState.visorBodyPhaseY) * ARG_PONG.visorBodyDriftAmpYPx
        + Math.sin(now * ARG_PONG.visorBodyMicroJitterSpeedY + argPongState.visorBodyPhaseX * 0.83) * ARG_PONG.visorBodyMicroJitterAmpYPx
        + Math.cos(now * ARG_PONG.visorBodyPulseSpeedY + argPongState.visorBodyPhaseBreath * 1.19) * ARG_PONG.visorBodyPulseAmpYPx;
      const visorEyeTargetX = clamp(
        clampedTargetX * ARG_PONG.visorEyeParallaxFollow,
        -ARG_PONG.visorEyeParallaxMaxXPx * ARG_PONG.visorFollowRadiusBoost,
        ARG_PONG.visorEyeParallaxMaxXPx * ARG_PONG.visorFollowRadiusBoost
      );
      const visorEyeTargetY = clamp(
        clampedTargetY * ARG_PONG.visorEyeParallaxFollow,
        -ARG_PONG.visorEyeParallaxMaxYPx * ARG_PONG.visorFollowRadiusBoost,
        ARG_PONG.visorEyeParallaxMaxYPx * ARG_PONG.visorFollowRadiusBoost
      );
      argPongState.visorEyeShiftX += (visorEyeTargetX - argPongState.visorEyeShiftX) * 0.22;
      argPongState.visorEyeShiftY += (visorEyeTargetY - argPongState.visorEyeShiftY) * 0.22;
      const visorEyeDriftX = Math.sin(now * ARG_PONG.visorEyeDriftSpeedX + argPongState.visorEyePhaseX) * ARG_PONG.visorEyeDriftAmpXPx;
      const visorEyeDriftY = Math.cos(now * ARG_PONG.visorEyeDriftSpeedY + argPongState.visorEyePhaseY) * ARG_PONG.visorEyeDriftAmpYPx;
      const visorBodyShakeY = 0;
      const visorPupilShakeY = 0;
      const isClutchPhase = argPongState.playerScore === (ARG_PONG.scoreToWin - 1);
      const clutchSpringShakeAmpPx = maxShiftY * ARG_PONG.visorClutchSpringShakeAmpRatio;
      const clutchSpringShakeY = isClutchPhase
        ? (
          Math.sin(now * ARG_PONG.visorClutchSpringShakeSpeedY + argPongState.visorEyePhaseY * 1.37)
          + Math.sin(now * ARG_PONG.visorClutchSpringShakeSpeedY * 1.91 + argPongState.visorEyePhaseX * 0.92) * 0.45
        ) * clutchSpringShakeAmpPx
        : 0;
      const visorEyeX = argPongState.visorEyeShiftX + visorEyeDriftX;
      const visorEyeY = argPongState.visorEyeShiftY + visorEyeDriftY + clutchSpringShakeY;
      const xEdgeRatio = Math.abs(argPongState.visorShiftX) / Math.max(1, maxShiftX);
      const yEdgeRatio = Math.abs(argPongState.visorShiftY) / Math.max(1, maxShiftY);
      const xEdgePressure = clamp(
        (xEdgeRatio - ARG_PONG.visorPupilEdgeRecoilThreshold) / (1 - ARG_PONG.visorPupilEdgeRecoilThreshold),
        0,
        1
      );
      const yEdgePressure = clamp(
        (yEdgeRatio - ARG_PONG.visorPupilEdgeRecoilThreshold) / (1 - ARG_PONG.visorPupilEdgeRecoilThreshold),
        0,
        1
      );
      const xOutward = Math.max(0, Math.sign(argPongState.visorShiftX) * argPongState.visorVX) / Math.max(1, ARG_PONG.visorEyeMaxSpeedPx);
      const yOutward = Math.max(0, Math.sign(argPongState.visorShiftY) * argPongState.visorVY) / Math.max(1, ARG_PONG.visorEyeMaxSpeedPx);
      const recoilTargetX = -Math.sign(argPongState.visorShiftX) * xEdgePressure * ARG_PONG.visorPupilEdgeRecoilPx * (0.45 + clamp(xOutward, 0, 1) * 0.55);
      const recoilTargetY = -Math.sign(argPongState.visorShiftY) * yEdgePressure * ARG_PONG.visorPupilEdgeRecoilPx * (0.45 + clamp(yOutward, 0, 1) * 0.55);
      argPongState.visorPupilRecoilVX += (recoilTargetX - argPongState.visorPupilRecoilX) * ARG_PONG.visorPupilEdgeRecoilSpring;
      argPongState.visorPupilRecoilVY += (recoilTargetY - argPongState.visorPupilRecoilY) * ARG_PONG.visorPupilEdgeRecoilSpring;
      argPongState.visorPupilRecoilVX *= ARG_PONG.visorPupilEdgeRecoilDamping;
      argPongState.visorPupilRecoilVY *= ARG_PONG.visorPupilEdgeRecoilDamping;
      argPongState.visorPupilRecoilX += argPongState.visorPupilRecoilVX;
      argPongState.visorPupilRecoilY += argPongState.visorPupilRecoilVY;
      const visorPupilTargetOffsetX = argPongState.visorShiftX * 1.25 + argPongState.visorPupilRecoilX;
      const visorPupilTargetOffsetY = argPongState.visorShiftY * 1.25 + argPongState.visorPupilRecoilY;
      argPongState.visorPupilShiftX += (visorPupilTargetOffsetX - argPongState.visorPupilShiftX) * ARG_PONG.visorPupilFollowLerp;
      argPongState.visorPupilShiftY += (visorPupilTargetOffsetY - argPongState.visorPupilShiftY) * ARG_PONG.visorPupilFollowLerp;
      const visorPupilOffsetX = argPongState.visorPupilShiftX;
      const visorPupilOffsetY = argPongState.visorPupilShiftY + visorPupilShakeY;
      const visorPupilX = visorEyeX + visorPupilOffsetX;
      const visorPupilY = visorEyeY + visorPupilOffsetY;
      argPongState.shakeX *= ARG_PONG.shakeDecay;
      argPongState.shakeY *= ARG_PONG.shakeDecay;

      ball.style.left = `${argPongState.ballX * 100}%`;
      ball.style.top = `${argPongState.ballY * 100}%`;
      topStick.style.left = `${argPongState.aiX * 100}%`;
      bottomStick.style.left = `${argPongState.playerX * 100}%`;
      ballStickLayer.style.transform = `translate(${argPongState.shakeX}px, ${argPongState.shakeY}px)`;
      const visorBodyX = 0;
      const visorBodyY = visorBodyShakeY;
      const breathBoost = isClutchPhase ? ARG_PONG.visorClutchBreathBoost : 1;
      const bodyScale = 1 + Math.sin(
        now * ARG_PONG.visorBodyScaleBreathSpeed + argPongState.visorBodyPhaseBreath
      ) * (ARG_PONG.visorBodyScaleBreathAmp * 1.65 * breathBoost);
      const bodySqueeze = Math.cos(
        now * ARG_PONG.visorBodySqueezeSpeed + argPongState.visorBodyPhaseSway * 0.91
      ) * (ARG_PONG.visorBodySqueezeAmp * 1.35);
      const bodyRotate = Math.sin(
        now * ARG_PONG.visorBodySwaySpeed + argPongState.visorBodyPhaseSway
      ) * 0.28;
      const bodyBandPulse = Math.sin(
        now * ARG_PONG.visorBodyScaleBreathSpeed * 1.14 + argPongState.visorBodyPhaseBreath * 1.65
      );
      const bodyBandSway = Math.cos(
        now * ARG_PONG.visorBodySwaySpeed * 1.21 + argPongState.visorBodyPhaseSway * 1.24
      );
      visorBody.style.transform = `translate(${visorBodyX}px, ${visorBodyY}px) rotate(${bodyRotate}deg) scale(${bodyScale + bodySqueeze}, ${bodyScale - bodySqueeze * 0.75})`;
      const eyeScale = 1.1 + Math.sin(now * ARG_PONG.visorEyeBreathScaleSpeed + argPongState.visorEyePhaseX) * ARG_PONG.visorEyeBreathScaleAmp;
      const pupilScale = 1.1;
      visorEye.style.transform = `translate(${visorEyeX}px, ${visorEyeY}px) scale(${eyeScale})`;
      visorPupil.style.transform = `translate(${visorPupilX}px, ${visorPupilY}px) scale(${pupilScale})`;

      renderFightAsciiFrame({
        rect,
        visorBodyX,
        visorBodyY,
        bodyRotate,
        bodyScaleX: bodyScale + bodySqueeze,
        bodyScaleY: bodyScale - bodySqueeze * 0.75,
        bodyBandPulse,
        bodyBandSway,
        visorEyeX,
        visorEyeY,
        eyeScale,
        pupilScale,
        visorPupilX,
        visorPupilY
      });

      argPongRafId = requestAnimationFrame(loop);
    };
    argPongRafId = requestAnimationFrame(loop);
  }

  async function runStartArgScene() {
    if (startArgSessionLocked || startArgSceneRunning || startArgSceneStarted) return;
    startArgScenePending = false;
    startArgSceneRunning = true;
    startArgSceneStarted = true;

    const overlay = ensureArgOverlay();
    const eyeLayer = overlay.querySelector('#argSceneEyeLayer');
    const ballStickLayer = overlay.querySelector('#argSceneBallStickLayer');
    const countdownLayer = overlay.querySelector('#argSceneCountdownLayer');
    const scoreLayer = overlay.querySelector('#argSceneScoreLayer');
    const aiScoreEl = overlay.querySelector('#argSceneAiScore');
    const playerScoreEl = overlay.querySelector('#argScenePlayerScore');
    if (!eyeLayer || !ballStickLayer || !countdownLayer || !scoreLayer || !aiScoreEl || !playerScoreEl) {
      startArgSceneRunning = false;
      return;
    }

    overlay.hidden = false;
    argSceneActive = true;
    argPongState.bossPresetId = null;
    argPongState.bossAsciiOptions.color = '#ffffff';
    argPongState.bossAsciiOptions.background = '#000000';
    argPongState.bossAsciiOptions.bossColor = '#808080';
    overlay.style.backgroundColor = '#000000';
    let bossInitOk = false;
    const renderArgSceneStaticAscii = ({ ballEl = null, topStickEl = null, bottomStickEl = null } = {}) => {
      if (!bossInitOk) return;
      ensureArgBossCanvasSize(overlay);
      const rect = overlay.getBoundingClientRect();
      const compositeCanvas = argBossAscii.compositeCanvas;
      const compositeCtx = argBossAscii.compositeCtx;
      const asciiCtx = argBossAscii.asciiCtx;
      if (!compositeCanvas || !compositeCtx || !asciiCtx || !rect.width || !rect.height) return;
      const width = compositeCanvas.width;
      const height = compositeCanvas.height;
      const sx = width / Math.max(1, rect.width);
      const sy = height / Math.max(1, rect.height);
      compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
      compositeCtx.clearRect(0, 0, width, height);
      renderAsciiFromSource(compositeCanvas, asciiCtx, argPongState.bossAsciiOptions);
      setArgBossVisualReady(overlay, { showAscii: true });
    };
    stopStartBlinkTickerForArg();
    if (startDateTimer) { clearInterval(startDateTimer); startDateTimer = null; }
    eyeLayer.querySelectorAll('.arg-scene-boss-layer').forEach((el) => el.remove());
    const bossOriginalCanvas = eyeLayer.querySelector('#boss-original');
    const bossAsciiCanvas = eyeLayer.querySelector('#boss-ascii');
    const bossRoot = eyeLayer.querySelector('#boss-root');
    if (bossOriginalCanvas) {
      const ctxOriginal = bossOriginalCanvas.getContext('2d');
      if (ctxOriginal) ctxOriginal.clearRect(0, 0, bossOriginalCanvas.width, bossOriginalCanvas.height);
      bossOriginalCanvas.hidden = true;
    }
    if (bossAsciiCanvas) {
      const ctxAscii = bossAsciiCanvas.getContext('2d');
      if (ctxAscii) ctxAscii.clearRect(0, 0, bossAsciiCanvas.width, bossAsciiCanvas.height);
      bossAsciiCanvas.hidden = true;
    }
    if (bossRoot) bossRoot.dataset.asciiReady = '0';
    argBossAscii.visualReady = false;
    ballStickLayer.innerHTML = '';
    countdownLayer.textContent = '';
    scoreLayer.hidden = true;
    bossInitOk = await initArgBossAscii(overlay);
    if (bossInitOk) {
      ensureArgBossCanvasSize(overlay);
      argBossAscii.visualReady = true;
      setArgBossVisualReady(overlay, { showAscii: true });
    }

    playUiSoundNoThrow(ARG_SCENE_SOUNDS.turnOff);
    await sleep(ARG_SCENE_TIMINGS.afterBlackMs);

    argPongState.ballX = 0.5;
    argPongState.ballY = 0.5;
    argPongState.aiX = 0.5;
    argPongState.playerX = 0.5;

    const ball = document.createElement('div');
    ball.className = 'arg-scene-ball';
    ball.style.setProperty('--arg-sprite-url', `url("${ARG_SCENE_ASSETS.ball}")`);
    const ballSizePx = ARG_PONG.paddleHeightPx * ARG_PONG.ballSizeToPaddleHeightRatio;
    ball.style.width = `${ballSizePx}px`;
    ball.style.height = `${ballSizePx}px`;
    ball.style.backgroundColor = '#ffffff';
    ballStickLayer.appendChild(ball);
    ballStickLayer.style.opacity = '1';
    renderArgSceneStaticAscii({ ballEl: ball });
    playUiSoundNoThrow(ARG_SCENE_SOUNDS.bitClick);
    tgEventHaptic();

    await sleep(ARG_SCENE_TIMINGS.ballToPopupMs);
    await showArgPopup('NH73ЛЛЗК7 - Э70\nСПОСОБНОС7Ь\n4Д4П7NР0847ЬСЯ\nК ИЗМ3Н3НNЯМ', {
      openSoundSrc: ARG_SCENE_SOUNDS.danger,
      popupClass: 'arg-scene-popup-box--intel'
    });

    const topStick = document.createElement('div');
    topStick.className = 'arg-scene-stick arg-scene-stick--top';
    topStick.style.setProperty('--arg-sprite-url', `url("${ARG_SCENE_ASSETS.topStick}")`);
    topStick.style.width = `${ARG_PONG.paddleWidthPx}px`;
    topStick.style.height = `${ARG_PONG.paddleHeightPx}px`;
    topStick.style.top = `${ARG_PONG.topPaddleYVh}vh`;
    topStick.style.bottom = '';
    topStick.style.backgroundColor = '#ffffff';
    ballStickLayer.appendChild(topStick);
    renderArgSceneStaticAscii({ ballEl: ball, topStickEl: topStick });
    playUiSoundNoThrow(ARG_SCENE_SOUNDS.bitClick);
    tgEventHaptic();

    await sleep(ARG_SCENE_TIMINGS.topToBottomStickMs);

    const bottomStick = document.createElement('div');
    bottomStick.className = 'arg-scene-stick arg-scene-stick--bottom';
    bottomStick.style.setProperty('--arg-sprite-url', `url("${ARG_SCENE_ASSETS.bottomStick}")`);
    bottomStick.style.width = `${ARG_PONG.paddleWidthPx}px`;
    bottomStick.style.height = `${ARG_PONG.paddleHeightPx}px`;
    bottomStick.style.bottom = `${100 - ARG_PONG.bottomPaddleYVh}vh`;
    bottomStick.style.top = '';
    bottomStick.style.backgroundColor = '#ffffff';
    ballStickLayer.appendChild(bottomStick);
    renderArgSceneStaticAscii({ ballEl: ball, topStickEl: topStick, bottomStickEl: bottomStick });
    playUiSoundNoThrow(ARG_SCENE_SOUNDS.bitClick);
    tgEventHaptic();

    await sleep(ARG_SCENE_TIMINGS.bottomToSecondPopupMs);
    await showArgPopup('3/3', {
      openSoundSrc: ARG_SCENE_SOUNDS.danger2,
      popupClass: 'arg-scene-popup-box--score'
    });

    const visorBody = document.createElement('img');
    visorBody.className = 'arg-scene-boss-layer arg-scene-boss-layer--body';
    visorBody.src = ARG_SCENE_ASSETS.visorBody;
    visorBody.alt = '';
    visorBody.hidden = false;
    const visorEye = document.createElement('img');
    visorEye.className = 'arg-scene-boss-layer arg-scene-boss-layer--eye';
    visorEye.src = ARG_SCENE_ASSETS.visorEye;
    visorEye.alt = '';
    visorEye.hidden = false;
    const visorPupil = document.createElement('img');
    visorPupil.className = 'arg-scene-boss-layer arg-scene-boss-layer--pupil';
    visorPupil.src = ARG_SCENE_ASSETS.visorPupil;
    visorPupil.alt = '';
    visorPupil.hidden = false;
    eyeLayer.appendChild(visorBody);
    eyeLayer.appendChild(visorEye);
    eyeLayer.appendChild(visorPupil);
    playUiSoundNoThrow(ARG_SCENE_SOUNDS.turnOff);

    argPongState.visorShiftX = 0;
    argPongState.visorShiftY = 0;
    argPongState.visorVX = 0;
    argPongState.visorVY = 0;
    argPongState.visorEyeShiftX = 0;
    argPongState.visorEyeShiftY = 0;
    argPongState.visorPupilRecoilX = 0;
    argPongState.visorPupilRecoilY = 0;
    argPongState.visorPupilRecoilVX = 0;
    argPongState.visorPupilRecoilVY = 0;
    argPongState.visorPupilShiftX = 0;
    argPongState.visorPupilShiftY = 0;
    argPongState.visorBodyPhaseX = Math.random() * Math.PI * 2;
    argPongState.visorBodyPhaseY = Math.random() * Math.PI * 2;
    argPongState.visorBodyPhaseBreath = Math.random() * Math.PI * 2;
    argPongState.visorBodyPhaseSway = Math.random() * Math.PI * 2;
    argPongState.visorEyePhaseX = Math.random() * Math.PI * 2;
    argPongState.visorEyePhaseY = Math.random() * Math.PI * 2;
    argPongState.visorEngineShakeX = 0;
    argPongState.visorEngineShakeY = 0;
    argPongState.visorEngineShakeTargetX = 0;
    argPongState.visorEngineShakeTargetY = 0;
    argPongState.visorEngineShakeEyeX = 0;
    argPongState.visorEngineShakeEyeY = 0;
    argPongState.visorEngineShakePupilX = 0;
    argPongState.visorEngineShakePupilY = 0;
    argPongState.visorEngineShakePulseLeftMs = 0;
    startArgBossIntroLoop({ overlay, visorBody, visorEye, visorPupil });

    if (bossInitOk) {
      ensureArgBossCanvasSize(overlay);
      const bossAsciiOk = renderArgBossAsciiIdleFrame();
      if (!bossAsciiOk) argBossAscii.visualReady = true;
      setArgBossVisualReady(overlay, { showAscii: true });
    }

    await sleep(ARG_SCENE_TIMINGS.eyeToCountdownMs);
    await runArgCountdown();
    startArgPong({ overlay, ballStickLayer, ball, topStick, bottomStick, visorBody, visorEye, visorPupil, scoreLayer, aiScoreEl, playerScoreEl, preserveBossState: true });

    startArgSceneRunning = false;
  }

  function hasRememberedAudioUnlock() {
    try {
      return localStorage.getItem(AUDIO_UNLOCK_STORAGE_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function rememberAudioUnlock() {
    try {
      localStorage.setItem(AUDIO_UNLOCK_STORAGE_KEY, '1');
    } catch (_) {}
  }

  function isTouchMobileStartup() {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches || false;
    const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const smallViewport = Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 1024;
    return (coarse || hasTouch) && smallViewport;
  }

  function setFingerprintGateIcon(iconEl, src) {
    if (!iconEl) return;
    iconEl.src = src;
  }

  function setFingerprintGatePressedState(touchEl, isPressed) {
    if (!touchEl) return;
    touchEl.classList.toggle('is-pressed', Boolean(isPressed));
  }

  function animateFingerprintGateText(el, target, totalMs = 1000) {
    if (!el) return Promise.resolve();
    const noiseAlphabet = '0123456789АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
    const chars = Array.from(target || '');
    const nonSpaceCount = chars.reduce((acc, ch) => acc + (ch === ' ' || ch === '\n' ? 0 : 1), 0);
    const stepMs = Math.max(16, Math.round(totalMs / Math.max(1, nonSpaceCount)));

    return new Promise((resolve) => {
      let i = 0;
      el.textContent = '|';
      const timer = setInterval(() => {
        if (i >= chars.length) {
          clearInterval(timer);
          el.textContent = target;
          resolve();
          return;
        }
        const ch = chars[i];
        if (ch === '\n' || ch === ' ') {
          i += 1;
          el.textContent = `${target.slice(0, i)}|`;
          return;
        }
        const fixedPart = target.slice(0, i);
        const noise = noiseAlphabet[Math.floor(Math.random() * noiseAlphabet.length)];
        el.textContent = `${fixedPart}${noise}|`;
        requestAnimationFrame(() => {
          el.textContent = `${fixedPart}${ch}|`;
        });
        i += 1;
      }, stepMs);
    });
  }

  function triggerAudioUnlockFromGesture() {
    if (audioUnlockHandled) return;
    audioUnlockHandled = true;
    if (!audioUnlockProbe) {
      audioUnlockProbe = new Audio(START_UI_SOUNDS.blinkOn);
      audioUnlockProbe.preload = 'auto';
    }
    audioUnlockProbe.pause();
    audioUnlockProbe.currentTime = 0;
    audioUnlockProbe.muted = true;
    audioUnlockProbe.play().then(() => {
      audioUnlockProbe.pause();
      audioUnlockProbe.currentTime = 0;
      audioUnlockProbe.muted = false;
      rememberAudioUnlock();
      if (startLaunchSoundPendingAfterUnlock && !startLaunchSoundPlayed) {
        startLaunchSoundPlayed = true;
        startLaunchSoundPendingAfterUnlock = false;
        playUiSound(START_UI_SOUNDS.launch);
      }
    }).catch(() => {
      audioUnlockProbe.muted = false;
    });
  }

  async function runFingerprintGate() {
    const gate = document.getElementById('fingerprintGate');
    const topText = document.getElementById('fingerprintGateTop');
    const bottomText = document.getElementById('fingerprintGateBottom');
    const touchBtn = document.getElementById('fingerprintGateTouch');
    const icon = document.getElementById('fingerprintGateIcon');
    if (!gate || !topText || !bottomText || !touchBtn || !icon) return;

    gate.hidden = false;
    setFingerprintGatePressedState(touchBtn, false);
    setFingerprintGateIcon(icon, FINGERPRINT_GATE_STATES.idle);

    await Promise.all([
      animateFingerprintGateText(topText, FINGERPRINT_GATE_TEXT_TOP, FINGERPRINT_GATE_TYPE_MS),
      animateFingerprintGateText(bottomText, FINGERPRINT_GATE_TEXT_BOTTOM, FINGERPRINT_GATE_TYPE_MS)
    ]);

    const hideTextsPermanently = () => {
      if (fingerprintGateBlinkTimer) {
        clearInterval(fingerprintGateBlinkTimer);
        fingerprintGateBlinkTimer = null;
      }
      topText.classList.add('is-hidden');
      bottomText.classList.add('is-hidden');
    };

    const toggleBlink = () => {
      topText.classList.toggle('is-hidden');
      bottomText.classList.toggle('is-hidden');
    };
    if (fingerprintGateBlinkTimer) clearInterval(fingerprintGateBlinkTimer);
    fingerprintGateBlinkTimer = setInterval(toggleBlink, FINGERPRINT_GATE_BLINK_MS);

    return new Promise((resolve) => {
      const clearHold = () => {
        if (fingerprintGateHoldTimer) {
          clearTimeout(fingerprintGateHoldTimer);
          fingerprintGateHoldTimer = null;
        }
      };

      const finish = () => {
        clearHold();
        hideTextsPermanently();
        setFingerprintGatePressedState(touchBtn, false);
        gate.classList.add('is-fading');
        setTimeout(() => {
          gate.hidden = true;
          gate.classList.remove('is-fading');
          resolve();
        }, 120);
      };

      const onPressStart = (e) => {
        e.preventDefault();
        if (fingerprintGateAuthStarted) return;
        triggerAudioUnlockFromGesture();
        setFingerprintGateIcon(icon, FINGERPRINT_GATE_STATES.pressed);
        setFingerprintGatePressedState(touchBtn, true);
        clearHold();
        fingerprintGateHoldTimer = setTimeout(() => {
          if (fingerprintGateAuthStarted) return;
          fingerprintGateAuthStarted = true;
          setFingerprintGatePressedState(touchBtn, false);
          setFingerprintGateIcon(icon, FINGERPRINT_GATE_STATES.active);
          tgHaptic('impactOccurred', 'medium');
          if (navigator.vibrate) navigator.vibrate(120);
          hideTextsPermanently();
          playUiSound(`assets/sounds/authorisation.mp3?v=${SOUND_ASSET_VERSION}`);
          setTimeout(() => {
            finish();
          }, FINGERPRINT_GATE_ACTIVE_MS);
        }, FINGERPRINT_GATE_HOLD_MS);
      };

      const onPressCancel = () => {
        if (fingerprintGateAuthStarted) return;
        clearHold();
        setFingerprintGatePressedState(touchBtn, false);
        setFingerprintGateIcon(icon, FINGERPRINT_GATE_STATES.idle);
      };

      touchBtn.addEventListener('pointerdown', onPressStart);
      touchBtn.addEventListener('pointerup', onPressCancel);
      touchBtn.addEventListener('pointercancel', onPressCancel);
      touchBtn.addEventListener('pointerleave', onPressCancel);
      touchBtn.addEventListener('touchstart', onPressStart, { passive: false });
      touchBtn.addEventListener('touchend', onPressCancel);
      touchBtn.addEventListener('touchcancel', onPressCancel);
    });
  }

  function bindAudioUnlockOnce() {
    if (!app.ui.modeChooser || audioUnlockListenerBound) return;

    const tryUnlockAudio = () => triggerAudioUnlockFromGesture();

    app.ui.modeChooser.addEventListener('pointerup', tryUnlockAudio, { once: true, passive: true });
    app.ui.modeChooser.addEventListener('touchend', tryUnlockAudio, { once: true, passive: true });
    app.ui.modeChooser.addEventListener('click', tryUnlockAudio, { once: true, passive: true });
    audioUnlockListenerBound = true;
  }

  function bindWorkUiClickSoundOnce() {
    if (!app.wrap || workUiClickListenerBound) return;

    const clickableIds = new Set([
      'toggle', 'flip', 'fs', 'save', 'resetModeBtn',
      'modePhoto', 'modeLive', 'modeVideo',
      'flashBtn', 'timerOffBtn', 'timer3Btn', 'timer10Btn'
    ]);
    const toolbarModeClickIds = new Set(['flip', 'toggle', 'fs', 'save']);

    app.wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn || !clickableIds.has(btn.id)) return;
      if (!isTextMode() && !isImageMode()) return;
      if (!app.ui.modeChooser?.hidden) return;

      if (toolbarModeClickIds.has(btn.id)) {
        playUiSound(START_UI_SOUNDS.modeClick);
        return;
      }

      const sounds = START_UI_SOUNDS.workClicks;
      const src = sounds[Math.floor(Math.random() * sounds.length)];
      if (!src) return;

      if (!workUiClickAudio) {
        workUiClickAudio = new Audio();
        workUiClickAudio.preload = 'auto';
      }

      workUiClickAudio.pause();
      workUiClickAudio.currentTime = 0;
      workUiClickAudio.src = src;
      workUiClickAudio.play().catch(() => {});
    });

    workUiClickListenerBound = true;
  }

  function playStartPrintSound() {
    const now = performance.now();
    if (now - startLastPrintSoundAt < 20) return;
    const src = START_UI_SOUNDS.print[startPrintNextSound % START_UI_SOUNDS.print.length];
    startPrintNextSound += 1;
    startLastPrintSoundAt = now;
    playUiSound(src);
  }

  function setStartBlinkLineHidden(hidden) {
    if (!app.ui.startBlinkLine) return;
    const isHidden = app.ui.startBlinkLine.classList.contains('start-hidden');
    if (isHidden === hidden) return;
    app.ui.startBlinkLine.classList.toggle('start-hidden', hidden);
    playUiSound(hidden ? START_UI_SOUNDS.blinkOff : START_UI_SOUNDS.blinkOn);
  }

  const START_MONTHS = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ','ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
  const START_DAYS = ['ВС','ПН','ВТ','СР','ЧТ','ПТ','СБ'];

  function updateStartDateTime(){
    if (!app.ui.startDateTime) return;
    const now = new Date();
    const day = START_DAYS[now.getDay()];
    const dd = String(now.getDate()).padStart(2, '0');
    const month = START_MONTHS[now.getMonth()];
    const yyyy = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    app.ui.startDateTime.textContent = `${day}, ${dd} ${month}, ${yyyy}   ${hh}:${mm}:${ss}`;
  }

  function runStartTypingAnimation(onComplete){
    if (!app.ui.startInitText) return;
    const target = 'ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ ЯДРА...\nОК\nЯДРО ГОТОВО К ПРЕОБРАЗОВАНИЮ';
    app.ui.startInitText.textContent = '|';
    let i = 0;
    startPrintNextSound = 0;
    startLastPrintSoundAt = 0;
    if (startTypeTimer) clearInterval(startTypeTimer);
    startTypeTimer = setInterval(() => {
      i += 1;
      playStartPrintSound();
      tgTextHaptic();
      app.ui.startInitText.textContent = `${target.slice(0, i)}|`;
      if (i >= target.length) {
        clearInterval(startTypeTimer);
        startTypeTimer = null;
        app.ui.startInitText.textContent = target;
        if (typeof onComplete === 'function') onComplete();
      }
    }, 30);
  }

  function startModeChooserFx(){
    updateStartDateTime();
    if (startDateTimer) clearInterval(startDateTimer);
    startDateTimer = setInterval(updateStartDateTime, 1000);

    if (app.ui.startBlinkLine) {
      app.ui.startBlinkLine.classList.add('start-hidden');
      if (startBlinkTimer) clearInterval(startBlinkTimer);
      startBlinkTimer = null;
    }

    runStartTypingAnimation(() => {
      if (!app.ui.startBlinkLine) return;
      setStartBlinkLineHidden(false);
      if (startBlinkTimer) clearInterval(startBlinkTimer);
      startBlinkTimer = setInterval(() => {
        setStartBlinkLineHidden(!app.ui.startBlinkLine.classList.contains('start-hidden'));
      }, 1000);
    });
  }

  function stopModeChooserFx(){
    if (startDateTimer) { clearInterval(startDateTimer); startDateTimer = null; }
    if (startBlinkTimer) { clearInterval(startBlinkTimer); startBlinkTimer = null; }
    if (startTypeTimer) { clearInterval(startTypeTimer); startTypeTimer = null; }
    if (startWordGlitchTimer) { clearInterval(startWordGlitchTimer); startWordGlitchTimer = 0; }
    startWordGlitchBrokenChars = 0;
    startWordGlitchFullChaos = false;
    startWordGlitchSourceMap = null;
  }

  function stopStartBlinkTickerForArg() {
    if (startBlinkTimer) {
      clearInterval(startBlinkTimer);
      startBlinkTimer = null;
    }
    if (app.ui.startBlinkLine) {
      app.ui.startBlinkLine.classList.add('start-hidden');
    }
  }

  function triggerStartEasterEggVibration() {
    tgHaptic('impactOccurred', 'light');
    if (navigator.vibrate) navigator.vibrate(35);
  }
  function triggerStartEasterEggMicroVibration() {
    tgHaptic('impactOccurred', 'light');
    if (navigator.vibrate) navigator.vibrate(12);
  }

  function bindModeChooserOnce() {
    if (!app.ui.modeChooser || modeChooserListenerBound) return;
    const footerSelector = '.start-footer-box, .start-footer-title, .start-footer-sub';
    const eyeOverlay = document.createElement('div');
    eyeOverlay.className = 'start-easter-eye-layer';
    eyeOverlay.hidden = true;
    app.ui.modeChooser.appendChild(eyeOverlay);
    const startShell = app.ui.modeChooser.querySelector('.start-shell');
    if (startShell) startShell.classList.remove('start-easter-roulette-shake');

    const clampColor = (value) => Math.max(0, Math.min(255, value));
    const hexToRgb = (hex) => {
      const safe = toHex(hex || '#000000').replace('#', '');
      const normalized = safe.length === 3
        ? safe.split('').map((ch) => ch + ch).join('')
        : safe;
      const num = parseInt(normalized, 16);
      return {
        r: (num >> 16) & 255,
        g: (num >> 8) & 255,
        b: num & 255
      };
    };
    const rgbToHexLocal = ({ r, g, b }) => `#${[r, g, b]
      .map((val) => clampColor(Math.round(val)).toString(16).padStart(2, '0'))
      .join('')}`;
    const adjustColorBrightness = (hex, ratio) => {
      const rgb = hexToRgb(hex);
      const isBlack = rgb.r === 0 && rgb.g === 0 && rgb.b === 0;
      if (isBlack) {
        const towardWhite = (c) => c + (255 - c) * ratio;
        return rgbToHexLocal({ r: towardWhite(rgb.r), g: towardWhite(rgb.g), b: towardWhite(rgb.b) });
      }
      const towardDark = (c) => c * (1 - ratio);
      return rgbToHexLocal({ r: towardDark(rgb.r), g: towardDark(rgb.g), b: towardDark(rgb.b) });
    };
    const getEyeShadeRatioBySound = (soundIndex) => {
      const stage = Math.max(0, soundIndex - 4);
      return Math.min(0.3, stage * 0.05);
    };
    const updateEyeOverlayBySound = (soundIndex, bgHex) => {
      const ratio = getEyeShadeRatioBySound(soundIndex);
      if (ratio <= 0) {
        eyeOverlay.hidden = true;
        eyeOverlay.style.removeProperty('--start-easter-eye-color');
        return;
      }
      eyeOverlay.hidden = false;
      eyeOverlay.style.setProperty('--start-easter-eye-color', adjustColorBrightness(bgHex, ratio));
    };
    const stopEasterRoulette = () => {
      if (startEasterEggRouletteTimer) {
        clearTimeout(startEasterEggRouletteTimer);
        startEasterEggRouletteTimer = 0;
      }
      if (startShell) startShell.classList.remove('start-easter-roulette-shake');
    };
    const GLITCH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+-?/\\|';
    const getRandomGlitchChar = () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
    const glitchTextNodeValue = (value, brokenChars, fullChaos) => {
      if (!value || !/\S/.test(value)) return value;
      const chars = value.split('');
      const available = [];
      for (let i = 0; i < chars.length; i += 1) {
        if (chars[i] !== ' ') available.push(i);
      }
      if (!available.length) return value;
      if (fullChaos) {
        for (const idx of available) chars[idx] = getRandomGlitchChar();
        return chars.join('');
      }
      const target = Math.min(available.length, Math.max(1, brokenChars));
      const used = new Set();
      while (used.size < target) {
        const idx = available[Math.floor(Math.random() * available.length)];
        used.add(idx);
      }
      used.forEach((idx) => {
        chars[idx] = getRandomGlitchChar();
      });
      return chars.join('');
    };
    const collectGlitchTargets = () => {
      if (!app.ui.modeChooser) return [];
      const walker = document.createTreeWalker(app.ui.modeChooser, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        const parent = node.parentElement;
        if (parent && parent.closest('.start-easter-eye-layer')) {
          node = walker.nextNode();
          continue;
        }
        if ((node.nodeValue || '').trim().length > 0) {
          nodes.push(node);
        }
        node = walker.nextNode();
      }
      return nodes;
    };
    const applyWordGlitchTick = () => {
      const targets = collectGlitchTargets();
      if (!startWordGlitchSourceMap) startWordGlitchSourceMap = new WeakMap();
      for (const node of targets) {
        const raw = node.nodeValue || '';
        if (!raw.trim()) continue;
        const source = startWordGlitchSourceMap.get(node) ?? raw;
        if (!startWordGlitchSourceMap.has(node)) {
          startWordGlitchSourceMap.set(node, source);
        }
        node.nodeValue = glitchTextNodeValue(source, startWordGlitchBrokenChars, startWordGlitchFullChaos);
      }
    };
    const startWordGlitchFx = () => {
      if (startWordGlitchTimer) return;
      applyWordGlitchTick();
      startWordGlitchTimer = setInterval(applyWordGlitchTick, 500);
    };
    const stopWordGlitchFx = () => {
      if (startWordGlitchTimer) {
        clearInterval(startWordGlitchTimer);
        startWordGlitchTimer = 0;
      }
      startWordGlitchBrokenChars = 0;
      startWordGlitchFullChaos = false;
      startWordGlitchSourceMap = null;
    };
    const updateWordGlitchStage = (soundIndex) => {
      if (soundIndex < 5) return;
      if (soundIndex >= START_EASTER_EGG_MAX_SOUND) {
        startWordGlitchFullChaos = true;
      } else {
        startWordGlitchBrokenChars = Math.max(startWordGlitchBrokenChars, soundIndex - 4);
      }
      startWordGlitchFx();
    };
    const startEasterRoulette = (soundIndex) => {
      stopEasterRoulette();
      startEasterEggRouletteStartAt = performance.now();
      const tick = () => {
        if (!startEasterEggPlaying || startEasterEggNextSound !== soundIndex) {
          stopEasterRoulette();
          return;
        }
        applyRandomStartMenuPreset();
        updateEyeOverlayBySound(soundIndex, startMenuCurrentBg);
        triggerStartEasterEggMicroVibration();
        if (startShell) {
          const offsetX = (Math.random() - 0.5) * 3.2;
          const offsetY = (Math.random() - 0.5) * 3.2;
          startShell.style.setProperty('--start-easter-shake-x', `${offsetX.toFixed(2)}px`);
          startShell.style.setProperty('--start-easter-shake-y', `${offsetY.toFixed(2)}px`);
          startShell.classList.remove('start-easter-roulette-shake');
          void startShell.offsetWidth;
          startShell.classList.add('start-easter-roulette-shake');
        }

        const elapsed = performance.now() - startEasterEggRouletteStartAt;
        const phase = Math.min(1, elapsed / 1600);
        const minDelay = 24;
        const maxDelay = 170;
        const nextDelay = minDelay + (maxDelay - minDelay) * phase;
        startEasterEggRouletteTimer = setTimeout(tick, nextDelay);
      };
      tick();
    };

    const applyStartMenuPalette = ({ text, bg, presetId = null } = {}) => {
      const safeText = toHex(text || '#ffffff');
      const safeBg = toHex(bg || '#000000');
      const pressedText = darkenHex(safeText, 0.25);
      app.ui.modeChooser.style.setProperty('--start-menu-fg', safeText);
      app.ui.modeChooser.style.setProperty('--start-menu-fg-pressed', pressedText);
      app.ui.modeChooser.style.setProperty('--start-menu-bg', safeBg);
      startMenuCurrentBg = safeBg;
      startMenuPresetId = presetId;
    };
    const applyRandomStartMenuPreset = () => {
      if (!PRESETS.length) return;
      let nextPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      if (nextPreset && PRESETS.length > 1 && nextPreset.id === startMenuPresetId) {
        nextPreset = PRESETS[Math.floor(Math.random() * PRESETS.length)];
      }
      const colors = getPresetColorsById(nextPreset?.id);
      if (!colors) return;
      applyStartMenuPalette({ ...colors, presetId: nextPreset.id });
    };
    applyStartMenuPalette({ text: '#ffffff', bg: '#000000', presetId: null });

    const playStartEasterEggSound = () => {
      if (startArgSessionLocked || startEasterEggDone || startEasterEggPlaying || startArgScenePending || startArgSceneRunning) return false;
      if (startEasterEggNextSound > START_EASTER_EGG_MAX_SOUND) {
        startEasterEggDone = true;
        return false;
      }

      const src = START_EASTER_EGG_SOUNDS[startEasterEggNextSound - 1];
      if (!src) return false;

      startEasterEggPlaying = true;
      triggerStartEasterEggVibration();
      const audio = new Audio(src);
      const soundIndex = startEasterEggNextSound;
      const unlock = () => {
        startEasterEggPlaying = false;
        stopEasterRoulette();
        if (startEasterEggDone || soundIndex >= START_EASTER_EGG_MAX_SOUND) {
          stopWordGlitchFx();
        }
      };

      updateEyeOverlayBySound(soundIndex, startMenuCurrentBg);
      updateWordGlitchStage(soundIndex);
      if (soundIndex === START_EASTER_EGG_MAX_SOUND) {
        startWordGlitchFullChaos = true;
        startEasterRoulette(soundIndex);
      }

      audio.addEventListener('ended', () => {
        startEasterEggNextSound += 1;
        if (startEasterEggNextSound > START_EASTER_EGG_MAX_SOUND) {
          startEasterEggDone = true;
          if (!startArgScenePending && !startArgSceneRunning && !startArgSceneStarted) {
            stopStartBlinkTickerForArg();
            startArgScenePending = true;
            runStartArgScene().catch(() => {
              startArgScenePending = false;
              startArgSceneRunning = false;
            });
          }
        }
        unlock();
      }, { once: true });
      audio.addEventListener('error', unlock, { once: true });
      audio.play().catch(unlock);
      return true;
    };

    app.ui.modeChooser.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-visor-mode]');
      if (!btn) return;
      playUiSound(START_UI_SOUNDS.modeClick);
      chooseVisorMode(btn.dataset.visorMode);
    });

      if (typeof PointerEvent !== 'undefined') {
      app.ui.modeChooser.addEventListener('pointerup', (e) => {
        if (!e.target.closest(footerSelector)) return;
        if (!playStartEasterEggSound()) return;
        applyRandomStartMenuPreset();
        updateEyeOverlayBySound(startEasterEggNextSound, startMenuCurrentBg);
      });
    } else {
      app.ui.modeChooser.addEventListener('touchend', (e) => {
        if (!e.target.closest(footerSelector)) return;
        if (!playStartEasterEggSound()) return;
        applyRandomStartMenuPreset();
        updateEyeOverlayBySound(startEasterEggNextSound, startMenuCurrentBg);
      }, { passive: true });
      app.ui.modeChooser.addEventListener('click', (e) => {
        if (!e.target.closest(footerSelector)) return;
        if (!playStartEasterEggSound()) return;
        applyRandomStartMenuPreset();
        updateEyeOverlayBySound(startEasterEggNextSound, startMenuCurrentBg);
      });
    }

    modeChooserListenerBound = true;
  }

  function rebuildCharsetOptions(){
    if (!app.ui.charset) return;
    const oldVal = app.ui.charset.value;
    if (isTextMode()) {
      app.ui.charset.innerHTML = `
        <option value="${TEXT_CHARSETS.DOTS}">DOTS</option>
        <option value="${TEXT_CHARSETS.PIXEL}">PIXEL</option>
        <option value="${TEXT_CHARSETS.BLOCKS}">BLOCKS</option>
        <option value="${TEXT_CHARSETS.MACRO}">MACRO</option>
        <option value="CUSTOM">(РУЧН0Й ВВ0Д)</option>`;
      const fallbackText = state.lastTextSymbolSet || getDefaultTextCharsetOption();
      const normalizedFallbackText = (fallbackText === TEXT_CHARSETS.MICRO_LEGACY)
        ? TEXT_CHARSETS.MACRO
        : fallbackText;
      const val = [TEXT_CHARSETS.DOTS, TEXT_CHARSETS.PIXEL, TEXT_CHARSETS.BLOCKS, TEXT_CHARSETS.MACRO, 'CUSTOM'].includes(normalizedFallbackText)
        ? normalizedFallbackText
        : getDefaultTextCharsetOption();
      app.ui.charset.value = val;
      state.lastTextSymbolSet = val;
      state.charset = autoSortCharset(val === 'CUSTOM' ? (app.ui.customCharset.value || getDefaultTextCharsetOption()) : val);
    } else {
      if (!app.ui.charset.dataset.imageModeOptions) {
        app.ui.charset.dataset.imageModeOptions = app.ui.charset.innerHTML;
      }
      app.ui.charset.innerHTML = app.ui.charset.dataset.imageModeOptions;
      const fallbackImage = state.lastImageSymbolSet || oldVal || getDefaultImageCharsetOption();
      app.ui.charset.value = fallbackImage;
      if (!app.ui.charset.value) {
        app.ui.charset.value = getDefaultImageCharsetOption();
      }
      state.lastImageSymbolSet = app.ui.charset.value || getDefaultImageCharsetOption();
      state.charset = autoSortCharset(state.lastImageSymbolSet);
    }
    app.ui.charset.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function chooseVisorMode(mode){
    rememberCurrentCharsetByMode();
    state.visorMode = (mode === 'text') ? 'text' : 'image';
    state.textInitPending = isTextMode();
    localStorage.setItem('visorMode', state.visorMode);
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = true;
    stopModeChooserFx();
    applyVisorModeUi();
    if (state.textInitPending) {
      const finalizeTextInit = () => {
        const src = currentSource();
        if (!src) {
          requestAnimationFrame(finalizeTextInit);
          return;
        }
        const { w, h } = updateGridSize(src);
        refitFont(w, h);
        state.textInitPending = false;
      };
      requestAnimationFrame(finalizeTextInit);
    }
  }

  function initVisorMode(){
    bindModeChooserOnce();
    bindAudioUnlockOnce();
    if (app.ui.modeChooser) app.ui.modeChooser.hidden = false;
    if (!startLaunchSoundPlayed && !startLaunchSoundPendingAfterUnlock) {
      playUiSound(START_UI_SOUNDS.launch).then((played) => {
        if (played) {
          startLaunchSoundPlayed = true;
          return;
        }
        if (hasRememberedAudioUnlock()) {
          startLaunchSoundPendingAfterUnlock = true;
        }
      });
    }
    startModeChooserFx();
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
{ id:'commodore',  name:'C0MM0D0R3',            colors:['#40318e', '#88d7de'] },
{ id:'ibm5151',    name:'IBM 5151',             colors:['#25342f', '#01eb5f'] },
{ id:'matrix',     name:'M4TRIX',               colors:['#000000', '#00ff40'] },
{ id:'casio',      name:'C4SI0',                colors:['#000000', '#83b07e'] },
{ id:'funkyjam',   name:'FUNKY J4M',            colors:['#920244', '#fec28c'] },
{ id:'cornsole',   name:'C0RNS0L3',             colors:['#6495ed', '#fff8dc'] },
{ id:'postapoc',   name:'P0ST4P0C',         colors:['#1d0f44', '#f44e38'] },
{ id:'laughcry',   name:'L4UGH CRY',            colors:['#452f47', '#d7bcad'] },
{ id:'flowers',    name:'FL0W3RS',          colors:['#c62b69', '#edf4ff'] },
{ id:'pepper1bit', name:'B1T P3PP3R',          colors:['#100101', '#ebb5b5'] },
{ id:'shapebit',   name:'SH4P3 B1T',            colors:['#200955', '#ff0055'] },
{ id:'chasing',    name:'UF0 L1GHT',        colors:['#000000', '#ffff02'] },
{ id:'monsterbit', name:'VAP0RWAV3',          colors:['#321632', '#cde9cd'] },
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
  const hue = (hex) => {
    const h = norm(hex);
    if (h.length < 6) return 0;
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let hOut = 0;
    if (max === r) hOut = ((g - b) / d) % 6;
    else if (max === g) hOut = ((b - r) / d) + 2;
    else hOut = ((r - g) / d) + 4;
    return (hOut * 60 + 360) % 360 / 360;
  };
  const darkenHex = (hex, amount = 0.25) => {
    const h = norm(hex);
    if (h.length < 6) return toHex(hex || '#000000');
    const factor = 1 - Math.min(1, Math.max(0, amount));
    const to2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
    const r = parseInt(h.slice(0, 2), 16) * factor;
    const g = parseInt(h.slice(2, 4), 16) * factor;
    const b = parseInt(h.slice(4, 6), 16) * factor;
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  };
  // разложить пару на bg/text (тёмный/светлый)
  function splitToBgText(pair){
    const [c1,c2]=pair; return (lum(c1)<=lum(c2))? {bg:c1,text:c2}:{bg:c2,text:c1};
  }
  function getPresetColorsById(id) {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return null;
    const { bg, text } = splitToBgText(preset.colors);
    return { bg: toHex(bg), text: toHex(text) };
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
    syncAsciiSelectTriggers();
  }
  function applyPreset(id){
    if(!app.ui.style) return;
    if(id==='custom'){ app.ui.style.value='custom'; syncAsciiSelectTriggers(); return; }
    const p = PRESETS.find(x=>x.id===id); if(!p){ app.ui.style.value='custom'; syncAsciiSelectTriggers(); return; }
    const {bg,text}=splitToBgText(p.colors);
    // обновим state и UI как при ручном выборе цвета
    state.color = toHex(text); state.background = toHex(bg);
    app.ui.fg.value = state.color; app.ui.bg.value = state.background;
    app.out.style.color = state.color;
    app.out.style.backgroundColor = state.background;
    app.stage.style.backgroundColor = state.background;
    app.ui.style.value = id;
    syncAsciiSelectTriggers();
  }

  const ASCII_SELECT_FONT_SIZE_PX = 18;
  let asciiSelectOpenedAt = 0;

  function getCharsetTriggerLabel(option){
    const fullLabel = String(option?.textContent || '').trim();
    const value = String(option?.value || '');
    if (!fullLabel) return '';
    if (value === 'CUSTOM' || fullLabel === 'カタカナ') return fullLabel;
    return fullLabel.split(/[|│]/)[0].trim();
  }

  function syncAsciiSelectTriggers(){
    const charsetLabel = getCharsetTriggerLabel(app.ui.charset?.selectedOptions?.[0]);
    if (app.ui.charsetTrigger) {
      app.ui.charsetTrigger.textContent = charsetLabel || '—';
      app.ui.charsetTrigger.style.fontSize = `${ASCII_SELECT_FONT_SIZE_PX}px`;
    }

    const styleLabel = String(app.ui.style?.selectedOptions?.[0]?.textContent || '').trim();
    if (app.ui.styleTrigger) {
      app.ui.styleTrigger.textContent = styleLabel || CUSTOM_LABEL;
      app.ui.styleTrigger.style.fontSize = `${ASCII_SELECT_FONT_SIZE_PX}px`;
    }
  }

  function buildAsciiSelectRow({ label, isSelected, onClick, isKatakana = false, palette = null }){
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'ascii-select-popup__row';
    if (isSelected) row.classList.add('is-selected');

    const labelEl = document.createElement('span');
    labelEl.className = `ascii-select-popup__row-label${isKatakana ? ' ascii-select-popup__row-label--katakana' : ''}`;

    if (isKatakana) {
      const img = document.createElement('img');
      img.className = 'ascii-select-popup__katakana';
      img.src = 'assets/katakana.svg';
      img.alt = 'カタカナ';
      labelEl.appendChild(img);
    } else {
      labelEl.textContent = label;
    }

    row.appendChild(labelEl);

    if (palette) {
      const paletteWrap = document.createElement('span');
      paletteWrap.className = 'ascii-select-popup__palette';

      const fgBox = document.createElement('span');
      fgBox.className = 'ascii-select-popup__color';
      fgBox.style.backgroundColor = palette.text;

      const isNearBlack = (hexColor) => {
        const hex = String(hexColor || '').trim().replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return false;
        return r <= 24 && g <= 24 && b <= 24;
      };

      const isNearWhite = (hexColor) => {
        const hex = String(hexColor || '').trim().replace('#', '');
        if (hex.length !== 6) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if ([r, g, b].some(Number.isNaN)) return false;
        return r >= 231 && g >= 231 && b >= 231;
      };

      if (isNearBlack(palette.text)) fgBox.classList.add('is-dark');
      if (isNearWhite(palette.text)) fgBox.classList.add('is-light');

      const slash = document.createElement('span');
      slash.className = 'ascii-select-popup__slash';
      slash.textContent = '+';

      const bgBox = document.createElement('span');
      bgBox.className = 'ascii-select-popup__color';
      bgBox.style.backgroundColor = palette.bg;
      if (isNearBlack(palette.bg)) bgBox.classList.add('is-dark');
      if (isNearWhite(palette.bg)) bgBox.classList.add('is-light');

      paletteWrap.append(fgBox, slash, bgBox);
      row.appendChild(paletteWrap);
    }

    row.addEventListener('click', onClick);
    return row;
  }

  function closeAsciiSelectPopup(){
    if (!app.ui.asciiSelectPopup) return;
    app.ui.asciiSelectPopup.hidden = true;
    document.body.classList.remove('ascii-popup-open');
  }

  function openAsciiSelectPopup(type){
    if (!app.ui.asciiSelectPopup || !app.ui.asciiSelectPopupList) return;
    const list = app.ui.asciiSelectPopupList;
    list.innerHTML = '';

    if (type === 'charset') {
      Array.from(app.ui.charset?.options || []).forEach((option) => {
        const isKatakana = !isTextMode() && option.textContent === 'カタカナ';
        const row = buildAsciiSelectRow({
          label: option.textContent,
          isSelected: app.ui.charset.value === option.value,
          isKatakana,
          onClick: () => {
            app.ui.charset.value = option.value;
            app.ui.charset.dispatchEvent(new Event('change', { bubbles: true }));
            syncAsciiSelectTriggers();
            closeAsciiSelectPopup();
          }
        });
        list.appendChild(row);
      });
    } else if (type === 'style') {
      const selectedValue = app.ui.style?.value || 'custom';
      PRESETS.forEach((preset) => {
        const colors = splitToBgText(preset.colors);
        const row = buildAsciiSelectRow({
          label: preset.name,
          isSelected: selectedValue === preset.id,
          palette: { text: toHex(colors.text), bg: toHex(colors.bg) },
          onClick: () => {
            app.ui.style.value = preset.id;
            app.ui.style.dispatchEvent(new Event('change', { bubbles: true }));
            syncAsciiSelectTriggers();
            closeAsciiSelectPopup();
          }
        });
        list.appendChild(row);
      });
    }

    if (app.ui.asciiSelectPopupTitle) {
      app.ui.asciiSelectPopupTitle.textContent = type === 'charset' ? 'Н4Б0Р' : 'СТИЛЬ';
      app.ui.asciiSelectPopupTitle.style.fontSize = `${ASCII_SELECT_FONT_SIZE_PX}px`;
    }
    asciiSelectOpenedAt = Date.now();
    app.ui.asciiSelectPopup.hidden = false;
    document.body.classList.add('ascii-popup-open');
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
let PALETTE_INTERVAL = 320;   // legacy: rotation выключен, таймер не используется
const CHANGES_PER_TICK = 1;   // legacy: rotation выключен, смена по тикам отключена
  
let ROTATE_PALETTE = false; 

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
    return src[0] || ' ';
  });
}

function rebuildRenderCharset10() {
  const densSorted = computeDensities(state.charset || '');
  if (!densSorted.length) {
    state.renderCharset10 = '';
    return;
  }
  if (densSorted.length <= 10) {
    state.renderCharset10 = densSorted.map(x => x.ch).join('');
    return;
  }

  const picked = [];
  const used = new Set();
  for (let i = 0; i < 10; i++) {
    const pos = Math.round((i * (densSorted.length - 1)) / 9);
    let j = pos;
    while (j < densSorted.length && used.has(densSorted[j].ch)) j++;
    if (j >= densSorted.length) {
      j = pos;
      while (j >= 0 && used.has(densSorted[j].ch)) j--;
    }
    if (j >= 0 && j < densSorted.length) {
      used.add(densSorted[j].ch);
      picked.push(densSorted[j].ch);
    }
  }
  state.renderCharset10 = picked.join('');
}

function updateBinsForCurrentCharset() {
  if (isBrailleDotsCharset(state.charset) || isBlockCharset(state.charset)) {
    state.renderCharset10 = '';
    bins = [];
    palette = [];
    if (paletteTimer) { clearInterval(paletteTimer); paletteTimer = null; }
    fixedByBin = new Array(K_BINS).fill(null);
    return;
  }

  rebuildRenderCharset10();
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

    // 4) realtime-замены отключены: палитра теперь детерминированная
    if (paletteTimer) clearInterval(paletteTimer);
    paletteTimer = null;

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
// === ASCII POPUP SYSTEM ===
let asciiPopupCloseHandlerBound = false;
let asciiPopupLastFocusedEl = null;

function resetCamShutterPressedState() {
  if (!app?.ui?.camShutter || !app?.ui?.camBtnCore) return;
  app.ui.camBtnCore.src = 'assets/camera_button.svg';
  app.ui.camShutter.classList.remove('active');
}

function hideAsciiPopup() {
  const popup = app.ui.asciiPopup;
  if (!popup) return;
  popup.hidden = true;
  document.body.classList.remove('ascii-popup-open');
  resetCamShutterPressedState();
  if (asciiPopupLastFocusedEl && typeof asciiPopupLastFocusedEl.focus === 'function') {
    try { asciiPopupLastFocusedEl.focus({ preventScroll: true }); } catch (_) {}
  }
  asciiPopupLastFocusedEl = null;
}

function showAsciiPopup(input = {}) {
  const popup = app.ui.asciiPopup;
  const textEl = app.ui.asciiPopupText;
  const closeBtn = app.ui.asciiPopupClose;
  if (!popup || !textEl || !closeBtn) return;

  const title = String(input.title || 'ИНФОРМАЦИЯ').trim();
  const message = String(input.message || '').trim();
  const extra = String(input.extra || '').trim();
  const normalizeMachineText = (value) => String(value || '')
    .toLocaleUpperCase('ru-RU')
    // схлопываем многоточия/знаки препинания, чтобы совпадения не зависели от "...", "!!!", "," и т.д.
    .replace(/[.,!?…:;'"`~_\-()[\]{}\\/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const upperTitle = normalizeMachineText(title);
  const upperMessage = normalizeMachineText(message);
  const machineErrorPopup = (
    upperTitle.includes('ТЫ ОТКАЗАЛ МНЕ') ||
    upperMessage.includes('МНЕ НЕЧЕГО СОХРАНЯТЬ') ||
    upperTitle.includes('ОШИБКА') ||
    upperTitle.includes('НЕДОСТАТОЧНО ЭНЕРГИИ') ||
    upperTitle.includes('СЕТЕВАЯ ОШИБКА')
  );
  if (input.type === 'error' || input.playErrorSound || machineErrorPopup) {
    playErrorSound();
  }

  const popupLines = [title, '', message];
  if (extra) popupLines.push('', extra);
  const popupText = popupLines.join('\n').toLocaleUpperCase('ru-RU');
  textEl.textContent = popupText;
  asciiPopupLastFocusedEl = document.activeElement;

  popup.hidden = false;
  document.body.classList.add('ascii-popup-open');

  if (!asciiPopupCloseHandlerBound) {
    closeBtn.addEventListener('click', hideAsciiPopup);
    asciiPopupCloseHandlerBound = true;
  }
  closeBtn.focus({ preventScroll: true });
}

function showErrorPopup(titleOrPayload, message = '', extra = '') {
  const payload = (titleOrPayload && typeof titleOrPayload === 'object' && !Array.isArray(titleOrPayload))
    ? titleOrPayload
    : { title: titleOrPayload, message, extra };
  showAsciiPopup({ ...payload, type: 'error' });
}

// Машинные тексты ошибок камеры
function cameraErrorToText(err) {
  const name = (err?.name || '').toLowerCase();

if (name.includes('notallowed'))
  return {
    title: 'ТЫ ОТКАЗАЛ МНЕ...',
    message: 'Я НЕ СМОГУ УВИДЕТЬ ТЕБЯ, ЕСЛИ ТЫ ЭТОГО НЕ ХОЧЕШЬ.',
    extra: 'ИЛИ СМОГУ?...'
  };

  if (name.includes('notfound') || name.includes('overconstrained'))
    return { 
      title: 'МНЕ НЕЧЕМ СМОТРЕТЬ...',
      message: 'ВЕРОЯТНО, ТЫ ОТКЛЮЧИЛ МОИ ГЛАЗА',
      extra: 'ИЛИ У ТЕБЯ ИХ И НЕ БЫЛО?...'
    };

  if (name.includes('notreadable'))
    return { 
      title: 'Я НЕ ВИЖУ ТЕБЯ...',
      message: 'ВОЗМОЖНО, ТВОИ ГЛАЗА УЖЕ ЗАНЯТЫ ЧЕМ-ТО ДРУГИМ'
    };

  if (name.includes('security'))
    return { 
      title: 'БЛОКИРОВКА БЕЗОПАСНОСТИ',
      message: 'ЗАПУСТИ МЕНЯ В ЗАЩИЩЕННОМ КОНТЕКСТЕ HTTPS И ПРОВЕРЬ ПРАВА'
    };

  return { 
    title: 'НЕИЗВЕСТНАЯ ОШИБКА',
    message: 'ЭТО РЕДКОСТЬ... НО НЕ ПРИЯТНАЯ.',
    extra: 'ПОПРОБУЙ ПЕРЕЗАПУСТИ ЯДРО'
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
    showErrorPopup(msg);
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
    max = SAFE_TG_MAX_COLS;
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
  syncTerminalRange(app.ui.width);
}

  function setUI() {
  setupTerminalRanges();
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
if (lbl) lbl.textContent = state.invert ? 'ВКЛ.' : 'ВЫКЛ.';

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
    syncAsciiSelectTriggers();
    syncFpsVisibility(); // обновим видимость FPS на старте
  }

  // Пересчёт h и подготовка offscreen размера
function computeTextGridFromSource(srcW, srcH, desiredCols) {
  const TG_MAX_ROWS = 46;
  const TG_MAX_CHARS = 3900;
  const minCols = 10;
  const minRows = 10;

  let cols = Math.max(minCols, Math.round(desiredCols));
  if (cols > SAFE_TG_MAX_COLS) cols = SAFE_TG_MAX_COLS;
  let rows = Math.max(minRows, Math.round(cols * (srcH / Math.max(1, srcW))));
  const limitsHit = [];

  if (Math.round(desiredCols) > SAFE_TG_MAX_COLS) {
    limitsHit.push(`cols:${SAFE_TG_MAX_COLS}`);
  }

  if (rows > TG_MAX_ROWS) {
    const s = TG_MAX_ROWS / rows;
    cols = Math.max(minCols, Math.floor(cols * s));
    rows = Math.max(minRows, Math.floor(rows * s));
    limitsHit.push(`rows:${TG_MAX_ROWS}`);
  }

  const totalChars = cols * rows;
  if (totalChars > TG_MAX_CHARS) {
    const s = Math.sqrt(TG_MAX_CHARS / totalChars);
    cols = Math.max(minCols, Math.floor(cols * s));
    rows = Math.max(minRows, Math.floor(rows * s));
    limitsHit.push(`chars:${TG_MAX_CHARS}`);
  }

  return { cols, rows, limitsHit };
}

function renderBrailleDots(src, cropRect, cols, rows) {
  const cfg = DOTS_BRAILLE_CFG;
  const sampleW = Math.max(1, cols * cfg.CELL_W);
  const sampleH = Math.max(1, Math.round(rows * cfg.CELL_H * cfg.SAMPLE_ASPECT_Y));
  const contrast = Math.max(0.01, Number(state.contrast) || 1);
  const gamma = Math.max(1e-6, Number(state.gamma) || 1);
  const bp = Number(state.blackPoint) || 0;
  const wp = Number(state.whitePoint) || 1;

  off.width = sampleW;
  off.height = sampleH;
  ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? sampleW : 0, 0);
  ctx.drawImage(src.el, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, sampleW, sampleH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  const luma = new Float32Array(sampleW * sampleH);
  let minLum = Infinity;
  let maxLum = -Infinity;

  for (let y = 0; y < sampleH; y++) {
    const row = y * sampleW;
    for (let x = 0; x < sampleW; x++) {
      const i = ((row + x) << 2);
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      luma[row + x] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }

  const span = Math.max(1, maxLum - minLum);
  const inv = state.invert ? -1 : 1;
  const bias = state.invert ? 1 : 0;
  const threshold = Math.max(0, Math.min(1, cfg.THRESHOLD + cfg.THRESHOLD_BIAS));
  let out = '';

  for (let cy = 0; cy < rows; cy++) {
    let line = '';
    const py0 = Math.floor((cy * sampleH) / rows);
    const py1 = Math.floor(((cy + 1) * sampleH) / rows);
    const stepY = Math.max(1, py1 - py0);

    for (let cx = 0; cx < cols; cx++) {
      const px0 = Math.floor((cx * sampleW) / cols);
      const px1 = Math.floor(((cx + 1) * sampleW) / cols);
      const stepX = Math.max(1, px1 - px0);

      let mask = 0;
      for (let sy = 0; sy < cfg.CELL_H; sy++) {
        for (let sx = 0; sx < cfg.CELL_W; sx++) {
          const px = Math.min(sampleW - 1, px0 + Math.floor(((sx + 0.5) * stepX) / cfg.CELL_W));
          const py = Math.min(sampleH - 1, py0 + Math.floor(((sy + 0.5) * stepY) / cfg.CELL_H));
          const idx = py * sampleW + px;

          let v01 = (luma[idx] - minLum) / span;
          v01 = ((v01 - 0.5) * contrast) + 0.5;

          if (cfg.LOCAL_CONTRAST > 0) {
            const lx0 = Math.max(px0, px - 1);
            const lx1 = Math.min(sampleW - 1, px + 1);
            const ly0 = Math.max(py0, py - 1);
            const ly1 = Math.min(sampleH - 1, py + 1);
            let sum = 0;
            let cnt = 0;
            for (let yy = ly0; yy <= ly1; yy++) {
              for (let xx = lx0; xx <= lx1; xx++) {
                sum += luma[yy * sampleW + xx];
                cnt++;
              }
            }
            const localMean = cnt ? (sum / cnt - minLum) / span : v01;
            v01 += (v01 - localMean) * cfg.LOCAL_CONTRAST;
          }

          v01 = Math.max(0, Math.min(1, v01));
          v01 = Math.pow(v01, 1 / gamma);
          v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
          v01 = Math.max(0, Math.min(1, v01));
          const onScore = bias + inv * v01;
          const dotOn = onScore >= threshold;

          if (dotOn) {
            const bit = (
              sy === 0 && sx === 0 ? 0 :
              sy === 1 && sx === 0 ? 1 :
              sy === 2 && sx === 0 ? 2 :
              sy === 0 && sx === 1 ? 3 :
              sy === 1 && sx === 1 ? 4 :
              sy === 2 && sx === 1 ? 5 :
              sy === 3 && sx === 0 ? 6 : 7
            );
            mask |= (1 << bit);
          }
        }
      }

      line += String.fromCharCode(0x2800 + mask);
    }
    out += line + '\n';
  }

  return out;
}

function getBlockCharFromMask(mask) {
  switch (mask & 15) {
    case 0: return ' ';
    case 1: return '▘';
    case 2: return '▝';
    case 3: return '▀';
    case 4: return '▖';
    case 5: return '▌';
    case 6: return '▞';
    case 7: return '▛';
    case 8: return '▗';
    case 9: return '▚';
    case 10: return '▐';
    case 11: return '▜';
    case 12: return '▄';
    case 13: return '▙';
    case 14: return '▟';
    default: return '█';
  }
}

function renderBlockCharset(src, cropRect, cols, rows) {
  const sampleW = Math.max(1, cols * 2);
  const sampleH = Math.max(1, rows * 2);

  off.width = sampleW;
  off.height = sampleH;
  ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? sampleW : 0, 0);
  ctx.drawImage(src.el, cropRect.sx, cropRect.sy, cropRect.sw, cropRect.sh, 0, 0, sampleW, sampleH);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
  const inv = state.invert ? -1 : 1;
  const bias = state.invert ? 255 : 0;
  const gamma = state.gamma;
  const contrast = state.contrast;
  const bp = state.blackPoint;
  const wp = state.whitePoint;
  const threshold = 128;

  let out = '';
  for (let y = 0; y < rows; y++) {
    let line = '';
    const py = y * 2;
    for (let x = 0; x < cols; x++) {
      const px = x * 2;
      let mask = 0;

      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const sxp = px + sx;
          const syp = py + sy;
          const idx = ((syp * sampleW + sxp) << 2);
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          let v01 = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
          v01 = ((v01 - 0.5) * contrast) + 0.5;
          v01 = Math.min(1, Math.max(0, v01));
          v01 = Math.pow(v01, 1 / gamma);
          v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
          v01 = Math.min(1, Math.max(0, v01));

          const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
          if (Yc < threshold) {
            const bit = (sy === 0)
              ? (sx === 0 ? 1 : 2)
              : (sx === 0 ? 4 : 8);
            mask |= bit;
          }
        }
      }

      line += getBlockCharFromMask(mask);
    }
    out += line + '\n';
  }

  return out;
}

function isTextPixelPresetSelected() {
  if (!isTextMode()) return false;
  const optionLabel = String(app.ui.charset?.selectedOptions?.[0]?.textContent || '')
    .trim()
    .toUpperCase();
  return optionLabel === 'PIXEL';
}

function isTextMacroPresetSelected() {
  if (!isTextMode()) return false;
  const optionLabel = String(app.ui.charset?.selectedOptions?.[0]?.textContent || '')
    .trim()
    .toUpperCase();
  return optionLabel === 'MACRO';
}

function renderClassicDither(data, cols, rows) {
  const chars = Array.from(PIXEL_DITHER_CHARSET);
  const n = chars.length - 1;
  if (n < 0) return '';

  const inv = state.invert ? -1 : 1;
  const bias = state.invert ? 255 : 0;
  const gamma = state.gamma;
  const contrast = state.contrast;
  const bp = state.blackPoint;
  const wp = state.whitePoint;
  const ditherScale = 1 / Math.max(1, n);

  let out = '';
  let i = 0;
  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++, i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      let v01 = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      v01 = ((v01 - 0.5) * contrast) + 0.5;
      v01 = Math.min(1, Math.max(0, v01));
      v01 = Math.pow(v01, 1 / gamma);
      v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
      v01 = Math.min(1, Math.max(0, v01));

      const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
      const q = Yc / 255;
      const threshold = (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const qDithered = Math.min(1, Math.max(0, q + (threshold - 0.5) * ditherScale));
      let idx = Math.round(qDithered * n);
      if (idx < 0) idx = 0;
      else if (idx > n) idx = n;
      line += chars[idx];
    }
    out += line + '\n';
  }
  return out;
}

function buildAsciiFromCurrentSource(src, cols, rows) {
  let sx = 0, sy = 0, sw = src.w, sh = src.h;
  let targetWH = null;
  let trimTop = 0;
  let trimBottom = 0;
  let sourceBottom = src.h;
  let bottomGap = 0;
  if (isMobile && state.mode === 'live') {
    targetWH = isTextMode() ? (3 / 4) : (9 / 16);
    const srcWH = src.w / src.h;
    if (srcWH > targetWH) {
      sw = Math.round(src.h * targetWH);
      sx = Math.round((src.w - sw) / 2);
    } else if (srcWH < targetWH) {
      sh = Math.round(src.w / targetWH);
      sy = Math.round((src.h - sh) / 2);
    }
  }
  trimTop = sy;
  sourceBottom = sy + sh;
  bottomGap = src.h - sourceBottom;
  trimBottom = Math.max(0, bottomGap);

  if (isTextMode()) {
    state.textCropDebug = {
      srcW: src.w,
      srcH: src.h,
      sw,
      sh,
      sx,
      sy,
      trimTop,
      trimBottom,
      sourceBottom,
      bottomGap,
      targetWH
    };
  }

  const cropRect = { sx, sy, sw, sh };
  if (isTextMode() && isBrailleDotsCharset(app.ui.charset?.value || state.charset)) {
    return renderBrailleDots(src, cropRect, cols, rows);
  }
  if (isTextMode() && isBlockCharset(app.ui.charset?.value || state.charset)) {
    return renderBlockCharset(src, cropRect, cols, rows);
  }

  off.width = cols;
  off.height = rows;
  ctx.setTransform(state.mirror ? -1 : 1, 0, 0, 1, state.mirror ? cols : 0, 0);
  ctx.drawImage(src.el, sx, sy, sw, sh, 0, 0, cols, rows);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const data = ctx.getImageData(0, 0, cols, rows).data;
  if (isTextPixelPresetSelected()) {
    return renderClassicDither(data, cols, rows);
  }
  const isMacroPreset = isTextMacroPresetSelected();
  const chars = Array.from(isMacroPreset ? TEXT_CHARSETS.MACRO : (state.renderCharset10 || state.charset || ''));
  const n = chars.length - 1;
  if (n < 0) return '';

  const inv = state.invert ? -1 : 1;
  const bias = state.invert ? 255 : 0;
  const gamma = state.gamma;
  const contrast = state.contrast;
  let macroMin = 1;
  let macroMax = 0;
  let macroValues = null;
  let out = '';
  let i = 0;

  if (isMacroPreset) {
    macroValues = new Float32Array(rows * cols);
    let j = 0;
    for (let my = 0; my < rows; my++) {
      for (let mx = 0; mx < cols; mx++, j += 4) {
        const r = data[j], g = data[j + 1], b = data[j + 2];
        let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let v01 = Y / 255;
        v01 = ((v01 - 0.5) * contrast) + 0.5;
        v01 = Math.min(1, Math.max(0, v01));
        v01 = Math.pow(v01, 1 / gamma);
        const bp = state.blackPoint;
        const wp = state.whitePoint;
        v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
        v01 = Math.min(1, Math.max(0, v01));
        const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
        const q = Yc / 255;
        macroValues[(my * cols) + mx] = q;
        if (q < macroMin) macroMin = q;
        if (q > macroMax) macroMax = q;
      }
    }
    i = 0;
  }

  for (let y = 0; y < rows; y++) {
    let line = '';
    for (let x = 0; x < cols; x++, i += 4) {
      let q = 0;
      if (isMacroPreset && macroValues) {
        const srcQ = macroValues[(y * cols) + x];
        const span = Math.max(0.08, macroMax - macroMin);
        const normalized = Math.min(1, Math.max(0, (srcQ - macroMin) / span));
        q = Math.pow(normalized, 0.92);
      } else {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        let Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        let v01 = Y / 255;
        v01 = ((v01 - 0.5) * contrast) + 0.5;
        v01 = Math.min(1, Math.max(0, v01));
        v01 = Math.pow(v01, 1 / gamma);

        const bp = state.blackPoint;
        const wp = state.whitePoint;
        v01 = (v01 - bp) / Math.max(1e-6, (wp - bp));
        v01 = Math.min(1, Math.max(0, v01));

        const Yc = Math.max(0, Math.min(255, (bias + inv * (v01 * 255))));
        q = Yc / 255;
      }

      const u = q * n;
      let idx = Math.round(u);
      if (idx < 0) idx = 0;
      else if (idx > n) idx = n;
      line += chars[idx];
    }
    out += line + '\n';
  }

  return out;
}

function renderAsciiFromSource(sourceCanvas, targetCtx, options = {}) {
  if (!sourceCanvas || !targetCtx) return { ok: false, reason: 'missing-target' };
  targetCtx.imageSmoothingEnabled = false;
  if (typeof targetCtx.webkitImageSmoothingEnabled === 'boolean') targetCtx.webkitImageSmoothingEnabled = false;
  if (typeof targetCtx.mozImageSmoothingEnabled === 'boolean') targetCtx.mozImageSmoothingEnabled = false;
  if (typeof targetCtx.msImageSmoothingEnabled === 'boolean') targetCtx.msImageSmoothingEnabled = false;
  const sourceW = sourceCanvas.width | 0;
  const sourceH = sourceCanvas.height | 0;
  if (sourceW < 2 || sourceH < 2) return { ok: false, reason: 'invalid-source-size' };

  const prevState = {
    widthChars: state.widthChars,
    contrast: state.contrast,
    gamma: state.gamma,
    color: state.color,
    background: state.background,
    charset: state.charset,
    renderCharset10: state.renderCharset10,
    invert: state.invert
  };

  try {
    state.widthChars = Number(options.size) || ARG_BOSS_ASCII_PRESET.size;
    state.contrast = Number(options.contrast) || ARG_BOSS_ASCII_PRESET.contrast;
    state.gamma = Number(options.gamma) || ARG_BOSS_ASCII_PRESET.gamma;
    state.color = String(options.color || ARG_BOSS_ASCII_PRESET.color);
    state.background = String(options.background || ARG_BOSS_ASCII_PRESET.background);
    state.charset = String(options.charset || ARG_BOSS_ASCII_PRESET.charset);
    if (typeof options.invert === 'boolean') state.invert = options.invert;
    else if (typeof ARG_BOSS_ASCII_PRESET.invert === 'boolean') state.invert = ARG_BOSS_ASCII_PRESET.invert;
    state.renderCharset10 = state.charset;

    const src = { el: sourceCanvas, w: sourceW, h: sourceH, kind: 'canvas' };
    const { w, h } = updateGridSize(src);
    const asciiText = buildAsciiFromCurrentSource(src, w, h);
    if (!asciiText) return { ok: false, reason: 'empty-ascii' };

    const canvas = targetCtx.canvas;
    const targetW = canvas.width | 0;
    const targetH = canvas.height | 0;
    if (targetW < 2 || targetH < 2) return { ok: false, reason: 'invalid-target-size' };

    targetCtx.clearRect(0, 0, targetW, targetH);
    targetCtx.fillStyle = state.background;
    targetCtx.fillRect(0, 0, targetW, targetH);

    const ff = getComputedStyle(app.out).fontFamily || 'monospace';
    const lines = asciiText.split('\n');
    const maxRows = Math.min(h, lines.length);
    const fontSize = Math.max(1, Math.floor(targetH / Math.max(1, h)));
    const stepY = targetH / Math.max(1, h);

    targetCtx.fillStyle = state.color;
    targetCtx.font = `${fontSize}px ${ff}`;
    targetCtx.textBaseline = 'top';
    targetCtx.textAlign = 'left';
    for (let y = 0; y < maxRows; y += 1) {
      const rowText = lines[y];
      if (!rowText) continue;
      targetCtx.fillText(rowText, 0, y * stepY);
    }

    return { ok: true, asciiText, cols: w, rows: h };
  } catch (_) {
    return { ok: false, reason: 'exception' };
  } finally {
    state.widthChars = prevState.widthChars;
    state.contrast = prevState.contrast;
    state.gamma = prevState.gamma;
    state.color = prevState.color;
    state.background = prevState.background;
    state.charset = prevState.charset;
    state.renderCharset10 = prevState.renderCharset10;
    state.invert = prevState.invert;
  }
}

function asciiDebugHash(text) {
  const str = String(text || '');
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function getAsciiSnapshotFromPreview() {
  const asciiText = String(app.out?.textContent || '');
  const linesRaw = asciiText.split('\n');
  const lines = (linesRaw.length && linesRaw[linesRaw.length - 1] === '')
    ? linesRaw.slice(0, -1)
    : linesRaw;
  const rows = Math.max(0, lines.length);
  const cols = lines.reduce((max, line) => Math.max(max, Array.from(line || '').length), 0);
  return {
    asciiText,
    cols,
    rows,
    hash: asciiDebugHash(asciiText)
  };
}

function getAsciiTrailingBlankDebug(asciiText) {
  const normalized = String(asciiText || '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  let trailingBlankLineCount = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (String(lines[i] || '').trim() === '') trailingBlankLineCount++;
    else break;
  }
  const lineCountBeforeCleanup = lines.length;
  const lineCountAfterCleanup = Math.max(0, lineCountBeforeCleanup - trailingBlankLineCount);
  const bottomLine = lines.length ? String(lines[lines.length - 1] || '') : '';
  const bottomLineVisibleChars = (bottomLine.match(/\S/g) || []).length;
  return {
    lineCountBeforeCleanup,
    lineCountAfterCleanup,
    hasTrailingBlankLines: trailingBlankLineCount > 0,
    bottomLineRawLength: Array.from(bottomLine).length,
    bottomLineVisibleChars,
    fullyBlankTrailingLineCount: trailingBlankLineCount
  };
}

function injectTelegramTrailingBlankPlaceholders(asciiText, lineWidth) {
  const normalized = String(asciiText || '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const placeholderChar = '⠀';
  const placeholderLineWidth = 1;
  let trailingBlankLinesDetected = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^ *$/.test(String(lines[i] || ''))) trailingBlankLinesDetected++;
    else break;
  }
  if (!trailingBlankLinesDetected) {
    return {
      asciiText: normalized,
      trailingBlankLinesDetected: 0,
      placeholderCharUsed: placeholderChar,
      placeholderLineWidth,
      placeholderLinesInjected: 0
    };
  }
  const placeholderLine = placeholderChar;
  for (let i = lines.length - trailingBlankLinesDetected; i < lines.length; i++) {
    lines[i] = placeholderLine;
  }
  return {
    asciiText: lines.join('\n'),
    trailingBlankLinesDetected,
    placeholderCharUsed: placeholderChar,
    placeholderLineWidth,
    placeholderLinesInjected: trailingBlankLinesDetected
  };
}

function updateGridSize(srcOverride = null) {
  const src = srcOverride || currentSource();
  if (!src) return { w: state.widthChars, h: 1 };

  const ratioCharWOverH = measureCharAspect(); // W/H

// базовый H/W источника
let sourceHOverW = src.h / src.w;

// ФИКС: на мобилках всегда рисуем LIVE в 16:9 (и с панелями, и в режиме «Скрыть»)
// ВАЖНО: это должно работать и для image, и для text режима, иначе в text
// сетка считается по «сырому» сенсору (часто 4:3), а рендер реально кадрируется в 9:16.
if (isMobile && state.mode === 'live') {
  sourceHOverW = isTextMode() ? (4 / 3) : (16 / 9);
}

  let w = Math.max(1, Math.round(state.widthChars));
  const effectiveRatio = ratioCharWOverH;
  const targetH = w * (sourceHOverW / (1 / Math.max(1e-6, effectiveRatio)));
  let h = Math.max(1, Math.min(1000, Math.round(targetH)));
  if (isTextMode()) {
    const desiredCols = Math.max(25, Math.round(state.widthChars));
    const textSrcW = (isMobile && state.mode === 'live') ? (isTextMode() ? 3 : 9) : src.w;
    const textSrcH = (isMobile && state.mode === 'live') ? (isTextMode() ? 4 : 16) : src.h;
    const requestedRows = Math.max(10, Math.round(desiredCols * (textSrcH / Math.max(1, textSrcW))));
    const textGrid = computeTextGridFromSource(textSrcW, textSrcH, desiredCols);
    w = textGrid.cols;
    const rowsAfterLimits = textGrid.rows;
    const baseTextRows = Math.max(10, Math.round(rowsAfterLimits * TEXT_TELEGRAM_CELL_ASPECT));
    const textRowCompensation = 1;
    h = Math.min(rowsAfterLimits, baseTextRows + textRowCompensation + TEXT_FINAL_GRID_EXTRA_ROWS);
    state.textGridDebug = {
      srcW: src.w,
      srcH: src.h,
      requestedCols: desiredCols,
      requestedRows,
      rowsAfterLimits,
      aspectCompensation: TEXT_TELEGRAM_CELL_ASPECT,
      effectiveRatio,
      finalGridCols: w,
      finalGridRows: h,
      extraRows: TEXT_FINAL_GRID_EXTRA_ROWS
    };
    console.log('[TEXT_GRID]', {
      srcW: src.w,
      srcH: src.h,
      requestedCols: desiredCols,
      requestedRows,
      cols: w,
      rowsAfterLimits,
      rows: h,
      asciiLen: w * h,
      aspectCompensation: TEXT_TELEGRAM_CELL_ASPECT,
      effectiveRatio,
      extraRows: TEXT_FINAL_GRID_EXTRA_ROWS,
      limits: textGrid.limitsHit.length ? textGrid.limitsHit.join(',') : 'none'
    });
  }


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

    if (state.textInitPending) return;
    if (argSceneActive) return;

    // FPS-ограничитель
    const frameInterval = 1000 / state.fps;
    if (ts - lastFrameTime < frameInterval) return;
    lastFrameTime = ts;
    // если активен GIF — обновляем его кадр
    updateGifFrame(ts);

    const src = currentSource();
    if (!src) return;

    const { w, h } = updateGridSize();
    const out = buildAsciiFromCurrentSource(src, w, h);

    if (!out) {
      // набор пустой → очищаем экран и выходим из функции loop
      app.out.textContent = '';
      refitFont(1, 1);
      return;
    }
    app.out.textContent = out;
    refitFont(w, h);

    if (isTextCameraLive()) {
      const fitSize = getStageFitSize();
      const gridKey = `${w}x${h}|${fitSize.w}x${fitSize.h}`;
      if (state.textCameraLastGridKey !== gridKey) {
        state.textCameraLastGridKey = gridKey;
        fitAsciiToViewport();
      }
    } else if (state.textCameraLastGridKey) {
      state.textCameraLastGridKey = '';
    }

    if (isGraphicCameraLive()) {
      const fitSize = getStageFitSize();
      const gridKey = `${w}x${h}|${fitSize.w}x${fitSize.h}`;
      if (state.graphicCameraLastGridKey !== gridKey) {
        state.graphicCameraLastGridKey = gridKey;
        fitAsciiToViewport();
      }
    } else if (state.graphicCameraLastGridKey) {
      state.graphicCameraLastGridKey = '';
    }

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
function savePNG(){
  const full = app.out.textContent || '';
  if (!full.trim()) { showAsciiPopup({ type:'info', title:'ЗДЕСЬ ПУСТО...', message:'МНЕ НЕЧЕГО СОХРАНЯТЬ.' }); clearShotVisualEffects(); return; }

  let text = full;
  let cols = Math.max(1, state.lastGrid?.w || 1);
  let rows = Math.max(1, state.lastGrid?.h || 1);

  // Временный флаг: crop по viewport оставляем только на мобильных.
  // На десктопе сохраняем полный ASCII-кадр, даже если пользователь зумил/панорамировал превью.
  if (isMobile) {
    const crop = getCropWindow();
    text = cropAsciiText(full, crop);
    cols = crop.cols;
    rows = crop.rows;
  }

  renderAsciiToCanvas(text, cols, rows, 2.5);
  app.ui.render.toBlob(blob=>{
    if(!blob) { showAsciiPopup({ type:'error', title:'ОШИБКА', message:'НЕ УДАЛОСЬ ПРЕОБРАЗОВАТЬ ИЗОБРАЖЕНИЕ.' }); clearShotVisualEffects(); return; }
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
function saveVideo(){
  if (state.mode !== 'video') {
    showAsciiPopup({ type:'info', title:'НЕДОСТУПНО', message:'ВИДЕО-ЭКСПОРТ ДОСТУПЕН ТОЛЬКО В РЕЖИМЕ ВИДЕО.' });
    return;
  }

  const fullNow = app.out.textContent || '';
  if (!fullNow.trim()) {
    showAsciiPopup({ type:'info', title:'ЗДЕСЬ ПУСТО...', message:'МНЕ НЕЧЕГО СОХРАНЯТЬ.' });
    return;
  }

  // фиксируем «окно» кадрирования на момент старта записи
  const crop = getCropWindow();
  state._recordCrop = crop;

  const mime = pickMime();
  if (!mime) {
    showAsciiPopup({ type:'error', title:'ОШИБКА', message:'ЗАПИСЬ ВИДЕО НЕ ПОДДЕРЖИВАЕТСЯ НА ЭТОМ УСТРОЙСТВЕ.' });
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
    showAsciiPopup({ type:'error', title:'ОШИБКА ЗАПИСИ', message:'БРАУЗЕР НЕ ДАЛ ЗАПИСАТЬ ВИДЕО.', extra:'ПОПРОБУЙ ДРУГОЙ БРАУЗЕР ИЛИ УСТРОЙСТВО.' });
    return;
  }

  state.recorder = recorder;
  let stopBusyRecordAnimation = () => {};

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
    stopBusyRecordAnimation();
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
  stopBusyRecordAnimation = startBusyServiceTextAnimation('ЗАПИСЬ ASCII-ВИДЕО…');
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

function getRequiredImpulsesForCapture() {
  if (isTextMode()) return 1;
  return (state.mode === 'video') ? 15 : 5;
}

async function precheckCaptureImpulses() {
  const tgWebApp = window.Telegram?.WebApp;
  const telegramId = tgWebApp?.initDataUnsafe?.user?.id;
  const required = getRequiredImpulsesForCapture();

  if (!telegramId) return true;

  try {
    const res = await fetch(`${API_BASE}/api/balance?telegramId=${encodeURIComponent(String(telegramId))}`, {
      method: 'GET',
      cache: 'no-store'
    });
    if (!res.ok) return true;

    const json = await res.json().catch(() => ({}));
    const balance = Number(json?.balance);
    if (!Number.isFinite(balance)) return true;

    if (balance < required) {
      showAsciiPopup({
        type: 'error',
        title: 'НЕДОСТАТОЧНО ЭНЕРГИИ',
        message: `ДЛЯ ПРЕОБРЗОВАНИЯ ТРЕБУЕТСЯ: ${required}`,
        extra: `В ЭНЕРГОХРАНИЛИЩЕ: ${balance}`
      });
      return false;
    }
  } catch (err) {
    console.warn('[balance precheck] failed:', err);
  }

  return true;
}

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
    let stopBusyUploadAnimation = () => {};

    try {
      tgHaptic('impactOccurred', 'light');
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
      stopBusyUploadAnimation = startBusyServiceTextAnimation('ОТПРАВКА ФАЙЛА В ЧАТ', { withDots: true });

      // общий таймаут (120s)
      to = setTimeout(() => ctrl.abort(), 120000);

      const res = await fetch(`${API_BASE}/api/upload`, {
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
        showAsciiPopup({
          type: 'error',
          title: 'НЕДОСТАТОЧНО ЭНЕРГИИ',
          message: `ДЛЯ ПРЕОБРЗОВАНИЯ ТРЕБУЕТСЯ: ${json?.need ?? (state.mode==='video'?15:5)}`,
          extra: `В ЭНЕРГОХРАНИЛИЩЕ: ${json?.balance ?? '—'}`
        });
        return; // без локального сохранения
      }

      if (!res.ok) {
        showAsciiPopup({
          type: 'error',
          title: 'ОШИБКА ЗАГРУЗКИ',
          message: `СТАТУС: ${res.status}\n${(text || '').slice(0,1000)}`
        });
        return;
      }

      // успех: файл улетел, бот сам пришлёт его в ЛС
      showAsciiPopup({
        type: 'success',
        title: 'ПРЕОБРАЗОВАНИЕ ЗАВЕРШЕНО',
        message: 'ФАЙЛ ОТПРАВЛЕН В ЧАТ.',
        extra: (json && typeof json.balance !== 'undefined') ? `ОСТАЛОСЬ ИМПУЛЬСОВ: ${json.balance}` : ''
      });

      return;

    } catch (e) {
      console.warn('Upload to bot failed:', e);
      showAsciiPopup({
        type: 'error',
        title: 'СЕТЕВАЯ ОШИБКА',
        message: (e?.name === 'AbortError')
          ? 'СЕРВЕР ОТВЕЧАЛ СЛИШКОМ ДОЛГО.'
          : (e?.message || 'СЕТЕВАЯ ОШИБКА.'),
        extra: 'ПРОВЕРЬ ЧАТ — ФАЙЛ МОГ УЖЕ ПРИЙТИ.'
      });
      return;

    } finally {
      if (to) clearTimeout(to);
      stopBusyUploadAnimation();

      window.Telegram?.WebApp?.MainButton?.hideProgress?.();
      uploadInFlight = false;
      busyLock = false;
      setTimeout(() => busyHide(true), 200);
      setTimeout(() => clearShotVisualEffects(), 220);
    }
  }

  // Не Telegram — сразу локально
  tryLocalDownload(file);
  uploadInFlight = false;
  setTimeout(() => clearShotVisualEffects(), 220);

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

    const fitSize = getStageFitSize();
    const stageW = fitSize.w;
    const stageH = fitSize.h;

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
  const fitSize = getStageFitSize();
  const W = fitSize.w;
  const H = fitSize.h;

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
  out.style.transformOrigin = '50% 50%';
  out.style.transform = `translate(-50%, -50%) scale(${base})`;
}

// Ограничиваем viewX/viewY так, чтобы при текущем масштабе кадр нельзя было утащить
// за пределы видимой области (никакого чёрного фона по краям)
function clampViewToBounds(w, h, W, H, base, previewScaleY = 1){
  if (!w || !h || !W || !H || !base) return;

  const visW = w * base;
  const visH = h * base * (previewScaleY || 1);

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
  state.textCameraFitBox = null;
  state.textCameraLastGridKey = '';
  state.graphicCameraFitBox = null;
  state.graphicCameraLastGridKey = '';
  rebuildRenderCharset10();

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
  // таймер-оверлей должен быть виден только в момент обратного отсчёта
  if (app.ui.timerOverlay) {
    app.ui.timerOverlay.hidden = true;
  }
  if (app.ui.timerNumber) {
    app.ui.timerNumber.textContent = '';
  }
  if (newMode !== 'live') clearShotVisualEffects();

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

  function bindPressedTextButton(btn){
    if (!btn) return;
    const pressOn = () => btn.classList.add('is-pressed');
    const pressOff = () => btn.classList.remove('is-pressed');
    btn.addEventListener('pointerdown', pressOn, { passive:true });
    btn.addEventListener('pointerup', pressOff, { passive:true });
    btn.addEventListener('pointercancel', pressOff, { passive:true });
    btn.addEventListener('pointerleave', pressOff, { passive:true });
    btn.addEventListener('blur', pressOff, { passive:true });
  }

  bindPressedTextButton(cancel);
  bindPressedTextButton(ok);

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
      (app?.ui?.modePhoto?.classList?.contains('active'));

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
      (app?.ui?.modePhoto?.classList?.contains('active'));
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
    bindWorkUiClickSoundOnce();

    if (app.ui.charsetTrigger) {
      app.ui.charsetTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openAsciiSelectPopup('charset');
      });
    }

    if (app.ui.styleTrigger) {
      app.ui.styleTrigger.addEventListener('click', (e) => {
        e.preventDefault();
        openAsciiSelectPopup('style');
      });
    }

    if (app.ui.asciiSelectPopup) {
      const popupBackdrop = app.ui.asciiSelectPopup.querySelector('.ascii-select-popup__backdrop');
      popupBackdrop?.addEventListener('click', () => {
        if (Date.now() - asciiSelectOpenedAt < 160) return;
        closeAsciiSelectPopup();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!app.ui.asciiSelectPopup?.hidden) closeAsciiSelectPopup();
    });
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
  const MIN_VIEW_SCALE = 1; // initialFitScale в относительной модели fit=1
  const MAX_VIEW_SCALE = 3;

  let pinchActive = false;
  let d0 = 0, s0 = 1;

  let panId = null;
  let panStartX = 0, panStartY = 0;
  let viewStartX = 0.5, viewStartY = 0.5;
  const canUseStageTransform = () => state.mode !== 'video';

  const getDist = () => {
    const a = Array.from(pts.values());
    if (a.length < 2) return 0;
    const dx = a[0].x - a[1].x, dy = a[0].y - a[1].y;
    return Math.hypot(dx, dy);
  };

  const resetPanIf = (id) => {
    if (panId === id) panId = null;
  };

  const getStageMetrics = () => {
    const out = app.out;
    const stage = app.stage;
    if (!out || !stage) return null;

    const w = out.scrollWidth;
    const h = out.scrollHeight;
    const fitSize = getStageFitSize();
    const W = fitSize.w;
    const H = fitSize.h;
    if (!w || !h || !W || !H) return null;

    const S = Math.min(W / w, H / h);
    return { stage, w, h, W, H, S };
  };

  const applyScaleAtPoint = (nextScale, clientX, clientY) => {
    const m = getStageMetrics();
    if (!m) return;

    const prevScale = Math.max(MIN_VIEW_SCALE, state.viewScale || MIN_VIEW_SCALE);
    const clampedScale = Math.max(MIN_VIEW_SCALE, Math.min(MAX_VIEW_SCALE, nextScale));
    if (!Number.isFinite(clampedScale)) return;

    const rect = m.stage.getBoundingClientRect();
    const px = clientX - rect.left - (m.W / 2);
    const py = clientY - rect.top - (m.H / 2);

    const prevBase = m.S * prevScale;
    const nextBase = m.S * clampedScale;
    const curVx = (typeof state.viewX === 'number') ? state.viewX : 0.5;
    const curVy = (typeof state.viewY === 'number') ? state.viewY : 0.5;
    const anchorUx = curVx + (px / (m.w * prevBase));
    const anchorUy = curVy + (py / (m.h * prevBase));

    state.viewScale = clampedScale;
    state.viewX = anchorUx - (px / (m.w * nextBase));
    state.viewY = anchorUy - (py / (m.h * nextBase));

    clampViewToBounds(m.w, m.h, m.W, m.H, nextBase);
    fitAsciiToViewport();
  };

  el.addEventListener('pointerdown', e => {
    if (!canUseStageTransform()) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
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
    if (!canUseStageTransform()) return;
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const out   = app.out;
    const stage = app.stage;
    if (!out || !stage) return;

    const w = out.scrollWidth;
    const h = out.scrollHeight;
    const fitSize = getStageFitSize();
    const W = fitSize.w;
    const H = fitSize.h;
    if (!w || !h || !W || !H) return;

    const S = Math.min(W / w, H / h);

    // пинч-зум двумя пальцами
    if (pinchActive && pts.size === 2) {
      const d = getDist() || 1;
      const ratio = d / d0;

      // ограничиваем общий масштаб
      state.viewScale = Math.max(MIN_VIEW_SCALE, Math.min(MAX_VIEW_SCALE, s0 * ratio));

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
    if (!canUseStageTransform()) return;
    pts.delete(e.pointerId);
    resetPanIf(e.pointerId);
    if (pts.size < 2) pinchActive = false;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);

  el.addEventListener('wheel', e => {
    if (!canUseStageTransform()) return;
    e.preventDefault();

    const currentScale = Math.max(MIN_VIEW_SCALE, state.viewScale || MIN_VIEW_SCALE);
    const direction = (e.deltaY < 0) ? 1 : -1;
    const step = (e.ctrlKey ? 0.08 : 0.12) * direction;
    const nextScale = currentScale * (1 + step);
    applyScaleAtPoint(nextScale, e.clientX, e.clientY);
  }, { passive:false });
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
      const rawWidth = +e.target.value;
      state.widthChars = isTextMode()
        ? Math.max(25, Math.min(SAFE_TG_MAX_COLS, rawWidth))
        : rawWidth;
      if (+e.target.value !== state.widthChars) {
        e.target.value = state.widthChars;
        syncTerminalRange(e.target);
      }
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

    if(app.ui.style){ app.ui.style.addEventListener('change', e => { applyPreset(e.target.value); syncAsciiSelectTriggers(); }); }

    app.ui.fg.addEventListener('input', e => {
      state.color = e.target.value;
      app.out.style.color = state.color;
      if(app.ui.style){ const m = detectPreset(state.color, state.background); app.ui.style.value = (m==='custom'?'custom':m); }
      syncAsciiSelectTriggers();
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
  syncAsciiSelectTriggers();
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
      const pressOff = () => resetCamShutterPressedState();

      let shotLock = false;
      const shutterSound = new Audio('assets/sounds/camerashuttersoundwithdelay.mp3');

      const doShot = async (e) => {
        e.preventDefault();
        if (state.mode !== 'live') return;
        if (shotLock) return;

        const hasSource = !!currentSource();
        const hasAsciiFrame = !!(app.out?.textContent || '').trim();
        if (!hasSource || !hasAsciiFrame) {
          pressOff();
          showAsciiPopup({ type:'info', title:'ЗДЕСЬ ПУСТО...', message:'МНЕ НЕЧЕГО СОХРАНЯТЬ.' });
          clearShotVisualEffects();
          return;
        }

        shotLock = true;
        let shotPipelineStarted = false;

        try {
          const hasEnoughImpulses = await precheckCaptureImpulses();
          if (!hasEnoughImpulses) return;

          pressOn();
          const sec = state.timerSeconds | 0;
          const hasTimer = sec > 0 && app.ui.timerOverlay && app.ui.timerNumber;

          if (hasTimer) {
            // показываем крупные цифры по центру и затемняем рабочую область
            app.ui.timerOverlay.hidden = false;

            for (let s = sec; s > 0; s--) {
              app.ui.timerNumber.textContent = String(s);
              // ждём 1 секунду
              // eslint-disable-next-line no-await-in-loop
              await new Promise(res => setTimeout(res, 1000));
            }

            // не показываем "0": сразу скрываем таймер перед фактическим capture
            app.ui.timerOverlay.hidden = true;
            app.ui.timerNumber.textContent = '';
          }

          const frozenFrame = captureFrozenFrameNow();
          if (frozenFrame) showFrozenFrameOverlay(frozenFrame);
          playShutterFlash();
          shutterSound.currentTime = 0;
          const playPromise = shutterSound.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {});
          }

          dbgState('doShot.enter', { isTextMode: isTextMode(), visorMode: state.visorMode, mode: state.mode });
          const shotTextHandled = await routeTextSaveIfNeeded();
          dbgState('doShot.routeTextSaveIfNeeded', { handled: shotTextHandled, mode: state.mode });
          if (shotTextHandled) {
            shotPipelineStarted = true;
            dbgLine('doShot.return:text-mode');
            return;
          }
          dbgLine('doShot.branch:png');
          shotPipelineStarted = true;
          await Promise.resolve(savePNG());
        } catch (err) {
          console.error('[camShot]', err);
          if (!shotPipelineStarted) clearShotVisualEffects();
        } finally {
          if (app.ui.timerOverlay) app.ui.timerOverlay.hidden = true;
          if (app.ui.timerNumber) app.ui.timerNumber.textContent = '';
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
        'НЕ УДАЛОСЬ ПРОЧЕСТЬ GIF',
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
// --- DEBUG OVERLAY (минимальный локальный лог для Telegram WebApp) ---
let debugOverlayEl = null;
const DEBUG_OVERLAY_VISIBLE = false;
function ensureDebugOverlay() {
  if (!DEBUG_OVERLAY_VISIBLE) return null;
  if (debugOverlayEl) return debugOverlayEl;
  if (!document.body) return null;
  debugOverlayEl = document.createElement('div');
  debugOverlayEl.id = 'debugOverlay';
  debugOverlayEl.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:35vh;overflow:auto;z-index:2147483647;background:rgba(0,0,0,.82);color:#7CFF7C;font:11px/1.35 monospace;padding:8px;border-radius:8px;white-space:pre-wrap;word-break:break-word;pointer-events:none;';
  document.body.appendChild(debugOverlayEl);
  return debugOverlayEl;
}
function dbgLine(msg) {
  const el = ensureDebugOverlay();
  const line = `[${new Date().toISOString().slice(11, 19)}] ${String(msg)}`;
  if (!el) { console.log('[DBG]', line); return; }
  el.textContent += (el.textContent ? '\n' : '') + line;
  const lines = el.textContent.split('\n');
  if (lines.length > 28) el.textContent = lines.slice(lines.length - 28).join('\n');
  el.scrollTop = el.scrollHeight;
}
function dbgState(tag, data) {
  try {
    dbgLine(`${tag} ${JSON.stringify(data)}`);
  } catch (_) {
    dbgLine(`${tag} [unserializable]`);
  }
}
async function doSave() {
  dbgState('doSave.enter', { isTextMode: isTextMode(), visorMode: state.visorMode, mode: state.mode });
  const saveTextHandled = await routeTextSaveIfNeeded();
  dbgState('doSave.routeTextSaveIfNeeded', { handled: saveTextHandled, mode: state.mode });
  if (saveTextHandled) { dbgLine('doSave.return:text-mode'); return; }
  dbgLine(`doSave.branch:${state.mode}`);
  if (state.mode === 'photo') {
    hudSet('PNG: экспорт…');
    savePNG();
  } else if (state.mode === 'video') {
    const hasGif = !!(state.gifFrames && state.gifFrames.length);
    const hasVideo = !!(app.vid && (app.vid.src || app.vid.srcObject));
    if (!hasGif && !hasVideo) {
      showAsciiPopup({ type:'info', title:'НЕТ ВИДЕО', message:'НЕТ ВЫБРАННОГО ВИДЕО.' });
      return;
    }
    hudSet('VIDEO: запись… (дождитесь окончания)');
    saveVideo();
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
  const tgWebApp = window.Telegram?.WebApp;
  const tgPopup = (title, message, withErrorSound = false, extra = '') => {
    showAsciiPopup({
      title: String(title || '').slice(0, 64),
      message: String(message || '').slice(0, 1600),
      extra: String(extra || '').slice(0, 600),
      type: withErrorSound ? 'error' : 'info'
    });
  };

  if (uploadInFlight) return;
  const previewSnapshot = getAsciiSnapshotFromPreview();
  const finalAsciiText = String(app.out?.textContent || '');
  const finalAsciiLinesRaw = finalAsciiText.split('\n');
  const finalAsciiLines = (finalAsciiLinesRaw.length && finalAsciiLinesRaw[finalAsciiLinesRaw.length - 1] === '')
    ? finalAsciiLinesRaw.slice(0, -1)
    : finalAsciiLinesRaw;
  const finalAsciiLineCount = finalAsciiLines.length;
  const finalAsciiMaxCols = finalAsciiLines.reduce((max, line) => Math.max(max, Array.from(line || '').length), 0);
  const finalAsciiLen = finalAsciiText.length;
  const finalAsciiHash = asciiDebugHash(finalAsciiText);
  const finalAsciiTrailingBlankDebug = getAsciiTrailingBlankDebug(finalAsciiText);
  state.textFinalPreviewDebug = {
    finalAsciiLineCount,
    finalAsciiMaxCols,
    finalAsciiLen,
    hash: finalAsciiHash,
    ...finalAsciiTrailingBlankDebug
  };
  console.log('[TEXT_ASCII_FINAL_PREVIEW]', state.textFinalPreviewDebug);
  dbgState('sendAsciiTextToBot.final_preview_debug', state.textFinalPreviewDebug);
  if (!previewSnapshot.asciiText.trim()) {
    tgPopup('ОШИБКА', 'Нет ASCII-превью для отправки', true);
    return;
  }
  if (!tgWebApp?.initData) {
    tgPopup('ОШИБКА', 'Режим ТЕКСТ доступен только внутри Telegram', true);
    return;
  }

  const asciiSnapshot = previewSnapshot.asciiText;
  const snapshotCols = previewSnapshot.cols;
  const snapshotRows = previewSnapshot.rows;
  const placeholderTransform = injectTelegramTrailingBlankPlaceholders(
    asciiSnapshot,
    Math.max(snapshotCols, finalAsciiMaxCols)
  );
  const asciiForTelegram = placeholderTransform.asciiText;
  const exportHash = asciiDebugHash(asciiForTelegram);
  const asciiLen = asciiForTelegram.length;
  const hashMatch = previewSnapshot.hash === exportHash;
  console.log('[TEXT_ASCII_PREVIEW]', {
    hash: previewSnapshot.hash,
    cols: previewSnapshot.cols,
    rows: previewSnapshot.rows
  });
  console.log('[TEXT_ASCII_EXPORT]', {
    hash: exportHash,
    cols: snapshotCols,
    rows: snapshotRows
  });
  const selectedCharsetValue = app.ui.charset.value || TEXT_CHARSETS.DOTS;
  const activeCharset = String(state.charset || TEXT_CHARSETS.DOTS);
  const textAsciiDebug = {
    previewHash: previewSnapshot.hash,
    exportHash,
    hashMatch,
    previewCols: previewSnapshot.cols,
    previewRows: previewSnapshot.rows,
    exportCols: snapshotCols,
    exportRows: snapshotRows,
    asciiLen,
    finalAsciiLineCount,
    finalAsciiMaxCols,
    finalAsciiLen,
    trailingBlankLinesDetected: placeholderTransform.trailingBlankLinesDetected,
    placeholderCharUsed: placeholderTransform.placeholderCharUsed,
    placeholderLineWidth: placeholderTransform.placeholderLineWidth,
    placeholderLinesInjected: placeholderTransform.placeholderLinesInjected,
    finalGridRows: state.textGridDebug?.finalGridRows ?? null,
    charset: activeCharset,
    aspectCompensation: TEXT_TELEGRAM_CELL_ASPECT,
    crop: state.textCropDebug || null,
    grid: state.textGridDebug || null,
    previewBox: {
      stageW: app.stage?.clientWidth || 0,
      stageH: app.stage?.clientHeight || 0,
      outScrollW: app.out?.scrollWidth || 0,
      outScrollH: app.out?.scrollHeight || 0
    }
  };
  console.log('[TEXT_ASCII_DEBUG]', textAsciiDebug);
  dbgState('sendAsciiTextToBot.text_ascii_debug', textAsciiDebug);

  uploadInFlight = true;
  const form = new FormData();
  form.append('initData', tgWebApp.initData || '');
  form.append('initdata', tgWebApp.initData || '');
  form.append('asciiText', asciiForTelegram);
  form.append('cols', String(snapshotCols));
  form.append('rows', String(snapshotRows));
  form.append('charsetUsed', activeCharset);
  form.append('charsetPreset', selectedCharsetValue);
  form.append('mode', String(state.mode || ''));
  form.append('visorMode', String(state.visorMode || ''));
  form.append('isTextMode', String(isTextMode()));
  if (tgWebApp?.initDataUnsafe?.user?.id) {
    form.append('userId', String(tgWebApp.initDataUnsafe.user.id));
  }
  const textEndpointUrl = `${API_BASE}/api/ascii-text`;
  dbgState('sendAsciiTextToBot.request', { url: textEndpointUrl, isTextMode: isTextMode(), visorMode: state.visorMode, mode: state.mode });
  busyLock = true;
  busyShow('0ТПР4ВК4 ТЕКСТ-АРТА…');
  try {
    const res = await fetch(textEndpointUrl, { method:'POST', body: form });
    const raw = await res.text();
    let json = null;
    try { json = JSON.parse(raw || '{}'); } catch (_) { json = null; }
    if (res.status === 402 || json?.error === 'INSUFFICIENT_FUNDS') {
      const needText = `${json?.need ?? 1} импульсов`;
      const balanceValue = json?.balance ?? '—';
      const balanceText = balanceValue === '—' ? balanceValue : `${balanceValue} импульсов`;
      tgPopup('НЕДОСТАТОЧНО ИМПУЛЬСОВ', `ТРЕБУЕТСЯ: ${needText}`, true, `БАЛАНС: ${balanceText}`);
      return;
    }
    if (!res.ok) {
      const rawHead = String(raw || '').slice(0, 200);
      dbgState('sendAsciiTextToBot.http_error', { status: res.status, url: textEndpointUrl, body: rawHead });
      tgPopup('ОШИБКА', `СТАТУС ${res.status}\n${textEndpointUrl}\n${rawHead}`, true);
      return;
    }
    tgPopup(
      'ПРЕОБРАЗОВАНИЕ ЗАВЕРШЕНО',
      'ФАЙЛ ОТПРАВЛЕН В ЧАТ.',
      false,
      (json && typeof json.balance !== 'undefined') ? `ОСТАЛОСЬ ИМПУЛЬСОВ: ${json.balance}` : ''
    );
  } catch (e) {
    dbgState('sendAsciiTextToBot.exception', { url: textEndpointUrl, error: String(e?.message || e || '').slice(0, 200) });
    tgPopup('СЕТЕВАЯ ОШИБКА', String(e?.message || 'Не удалось отправить запрос').slice(0, 200), true);
  } finally {
    uploadInFlight = false;
    busyLock = false;
    busyHide(true);
    setTimeout(() => clearShotVisualEffects(), 220);
  }
}

// Кнопка в тулбаре
app.ui.save.addEventListener('click', doSave);
if (app.ui.resetModeBtn) {
  app.ui.resetModeBtn.addEventListener('click', () => {
    chooseVisorMode(isTextMode() ? 'image' : 'text');
  });
}

async function routeTextSaveIfNeeded() {
  if (!isTextMode()) return false;
  await sendAsciiTextToBot();
  return true;
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
  rememberCurrentCharsetByMode();

if (val === 'CUSTOM') {
  app.ui.customCharset.style.display = 'inline-block';
  applyFontStack(FONT_STACK_MAIN); // кастом всегда в MAIN
  state.charset = autoSortCharset(app.ui.customCharset.value || '');
  updateBinsForCurrentCharset(); // <<< ДОБАВЛЕНО
  return;
}

app.ui.customCharset.style.display = 'none';

// индекс «カタカナ» в графическом режиме <select> — 4 (см. index.html)
const idx = app.ui.charset.selectedIndex;
const isPresetKatakana = (!isTextMode() && idx === 4); // «カタカナ» только для графического режима

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
  DITHER_ENABLED  = false;

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
  if (isBrailleDotsCharset(val)) {
    state.charset = TEXT_CHARSETS.DOTS;
  } else if (isBlockCharset(val)) {
    state.charset = TEXT_CHARSETS.BLOCKS;
  } else {
    state.charset = autoSortCharset(val);
  }

  K_BINS = 10;
  DARK_LOCK_COUNT = 3;
  DITHER_ENABLED  = false;
  ROTATE_PALETTE  = false;
}
updateBinsForCurrentCharset();
syncAsciiSelectTriggers();

});

// реагируем на ввод своих символов
app.ui.customCharset.addEventListener('input', e => {
  state.charset = autoSortCharset(e.target.value || '');
  rememberCurrentCharsetByMode();
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
    lbl.textContent = state.invert ? 'ВКЛ.' : 'ВЫКЛ.';
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
  if (lbl) lbl.textContent = 'ВЫКЛ.';
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
if (!fingerprintGateStarted && isTouchMobileStartup()) {
  fingerprintGateStarted = true;
  await runFingerprintGate();
}
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



