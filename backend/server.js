require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const fs         = require('fs');
const os         = require('os');
const path       = require('path');
const axios      = require('axios');
const crypto     = require('crypto');
const multer     = require('multer');
const cors       = require('cors');
const { execFile } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execFile);
// @nav sections:
// @section IMPORTS_AND_PROCESS_BOOTSTRAP
// @section REFERRAL_DATABASE_LAYER
// @section RATE_LIMITER_GUARDS
// @section STORE_INTEGRATION_AND_FFMPEG_RUNNER
// @section TEXT_UTILS_AND_COPYWRITING
// @section EXPRESS_BOOTSTRAP_AND_CORS
// @section MEDIA_CONVERSION_PIPELINE
// @section TELEGRAM_INITDATA_VALIDATION
// @section MINIAPP_HTTP_API_ROUTES
// @section ADMIN_HTTP_ROUTES
// @section TELEGRAM_BILLING_AND_MESSAGE_UTILS
// @section TELEGRAM_WEBHOOK_HANDLER
// @section FALLBACK_AND_SERVER_START
// ==== IMPORTS / BOOTSTRAP ====
// @section IMPORTS_AND_PROCESS_BOOTSTRAP
// ==== РЕФЕРАЛЬНАЯ СИСТЕМА (файл referrals.json) ====
// @section REFERRAL_DATABASE_LAYER
const REF_DB_PATH = path.join(__dirname, '..', 'referrals.json');
const BAL_FILE = path.join(__dirname, '..', 'data', 'balances.json');
const UNAME_FILE = path.join(__dirname, '..', 'data', 'usernames.json');
const REGISTRY_FILE = path.join(__dirname, '..', 'data', 'user_registry.json');
const USERNAME_INDEX_FILE = path.join(__dirname, '..', 'data', 'username_index.json');
const USER_STYLE_PRESETS_FILE = path.join(__dirname, '..', 'data', 'user_style_presets.json');
const USER_STYLE_PRESETS_LIMIT = 20;
const USER_PRESET_ID_PREFIX = 'usp_';
function loadRefDb() {
  try {
    const raw = fs.readFileSync(REF_DB_PATH, 'utf8');
    const db = JSON.parse(raw);
    if (!db.users || typeof db.users !== 'object') db.users = {};
    return db;
  } catch (e) {
    return { users: {} };
  }
}
function saveRefDb(db) {
  try {
    fs.writeFileSync(REF_DB_PATH, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[ref] save error:', e);
  }
}
// регистрируем факт, что userId пришёл по ссылке inviterId
function registerReferral(userId, inviterId) {
  if (!userId || !inviterId || userId === inviterId) return null;
  const db = loadRefDb();
  if (!db.users) db.users = {};
  // уже есть — считаем, что реферал был учтён ранее
  if (db.users[userId]) return null;
  db.users[userId] = {
    invitedBy: String(inviterId),
    joinedAt: Date.now(),
    bonusGiven: false,
    totalFromRefills: 0
  };
  saveRefDb(db);
  return db.users[userId];
}
function getRefInfo(userId) {
  const db = loadRefDb();
  return (db.users && db.users[userId]) || null;
}
function markReferralBonusGiven(userId) {
  const db = loadRefDb();
  if (!db.users || !db.users[userId]) return;
  db.users[userId].bonusGiven = true;
  saveRefDb(db);
}
function addReferralEarning(inviterId, amount) {
  const db = loadRefDb();
  if (!db.users || !db.users[inviterId]) return;
  const u = db.users[inviterId];
  u.totalFromRefills = (u.totalFromRefills || 0) + amount;
  saveRefDb(db);
}
function getReferralsOf(inviterId) {
  const db = loadRefDb();
  const users = (db && db.users) || {};
  const iid = String(inviterId);
  return Object.entries(users)
    .filter(([, info]) => String(info?.invitedBy || '') === iid)
    .map(([uid]) => String(uid));
}
function formatMskDateTime(isoValue) {
  if (!isoValue) return 'неизвестно';
  const dt = new Date(isoValue);
  if (Number.isNaN(dt.getTime())) return 'неизвестно';
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(dt);
    const get = (type) => parts.find((p) => p.type === type)?.value || '00';
    return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}:${get('second')} МСК`;
  } catch {
    return 'неизвестно';
  }
}
function mapResolvedByLabel(foundBy) {
  const key = String(foundBy || '').trim();
  if (!key) return '-';
  if (key === 'registry') return 'реестр пользователей';
  if (key === 'username_index') return 'индекс никнеймов';
  if (key === 'legacy username' || key === 'legacy_usernames' || key === 'legacy_username_index') return 'старый индекс никнеймов';
  if (key === 'id' || key === 'user_id') return 'user_id';
  if (key === 'balance' || key === 'balances') return 'баланс';
  if (key === 'unknown' || key === 'fallback') return key;
  return `другой источник: ${key}`;
}
function readJsonObjectSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}
function backupDataFiles() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const backupDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const marker = path.join(backupDir, `.last-backup-${today}`);
  if (fs.existsSync(marker)) return { skipped: true, reason: 'already-backed-up-today' };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const files = [BAL_FILE, UNAME_FILE, REF_DB_PATH, REGISTRY_FILE, USERNAME_INDEX_FILE, USER_STYLE_PRESETS_FILE];
  for (const file of files) {
    try {
      if (!fs.existsSync(file)) continue;
      const base = path.basename(file);
      fs.copyFileSync(file, path.join(backupDir, `${ts}-${base}`));
    } catch (e) {
      console.error('[backup] copy failed:', file, e?.message || e);
    }
  }
  try { fs.writeFileSync(marker, ts, 'utf-8'); } catch {}
  try {
    const markers = fs.readdirSync(backupDir).filter((f) => f.startsWith('.last-backup-')).sort();
    if (markers.length > 30) {
      markers.slice(0, markers.length - 30).forEach((f) => { try { fs.unlinkSync(path.join(backupDir, f)); } catch {} });
    }
  } catch {}
  try {
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const backupFiles = fs.readdirSync(backupDir)
      .filter((f) => !f.startsWith('.last-backup-') && f.endsWith('.json'))
      .map((f) => ({ name: f, full: path.join(backupDir, f) }));
    backupFiles.forEach((f) => {
      try {
        const st = fs.statSync(f.full);
        if (st.mtimeMs < cutoff) fs.unlinkSync(f.full);
      } catch {}
    });
  } catch {}
  return { skipped: false, date: today };
}
const backupResult = backupDataFiles();
const refUsersCount = Object.keys(loadRefDb()?.users || {}).length;
// ==== ПРОСТАЯ АНТИ-СПАМ ЗАЩИТА ====
// @section RATE_LIMITER_GUARDS
const RATE_LIMIT = { photo: { limit: 60, windowMs: 60*60*1000 }, video: { limit: 20, windowMs: 60*60*1000 } };
const userBuckets = new Map(); // userId -> { kind -> [timestamps] }
function canProceed(userId, kind) {
  const rules = RATE_LIMIT[kind] || RATE_LIMIT.photo;
  const now = Date.now();
  const from = now - rules.windowMs;
  if (!userBuckets.has(userId)) userBuckets.set(userId, {});
  const bucket = userBuckets.get(userId);
  if (!bucket[kind]) bucket[kind] = [];
  bucket[kind] = bucket[kind].filter(ts => ts >= from);
  if (bucket[kind].length >= rules.limit) return false;
  bucket[kind].push(now);
  return true;
}
const {
  ensureUser,
  userExists,
  getBalance,
  add,
  deduct,
  convertAndSave,
  sendFileToUser,
  setUsername,
  findIdByUsername,
  upsertUserFromTelegramUser,
  resolveUserRef,
  normalizeUsername,
  getStorageStats,
  sendVideoToUser,
  sendAnimationToUser,
  probeVideo
} = require('./store');
const storageStats = getStorageStats();
console.log('[startup] data-stats', {
  balances_users: storageStats.balances,
  legacy_usernames: storageStats.legacyUsernames,
  user_registry: storageStats.userRegistry,
  username_index: storageStats.usernameIndex,
  referrals_users: refUsersCount,
  backup: backupResult
});
const { spawn } = require('child_process');
// ==== STORE / FFMPEG INTEGRATION ====
// @section STORE_INTEGRATION_AND_FFMPEG_RUNNER
function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', d => { err += d.toString(); if (err.length > 4000) err = err.slice(-4000); });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(err || `ffmpeg exit ${code}`)));
  });
}
// ==== Русское склонение для "импульса" ====
// @section TEXT_UTILS_AND_COPYWRITING
function pluralRu(n, one, few, many) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;                               // 1, 21, 31...
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;      // 2-4, 22-24...
  return many;                                                             // остальное
}
const IMPULSE_FORMS = ['импульс', 'импульса', 'импульсов'];
const impulseWord = (n) => pluralRu(n, ...IMPULSE_FORMS);
// ==== /pluralRu ====
const PORT      = process.env.PORT || 8080;
const ADMIN_ID  = String(process.env.ADMIN_TELEGRAM_ID || '');
const TG_SECRET = String(process.env.TG_WEBHOOK_SECRET || '');
const ADMIN_ONLY_REPLY = 'Хуя ты хитрый! Только Создатель может использовать эту команду.';
const PUBLIC_COMMANDS = new Set(['/start', '/balance', '/help', '/buy_energy', '/referal', '/referral']);
const SUPPORTED_COMMANDS = new Set([
  '/start', '/balance', '/help', '/buy_energy', '/referal', '/referral',
  '/who', '/who_refs', '/stats', '/all', '/say', '/penalise', '/punish', '/send'
]);
const app = express();
function isAdminUser(userId) {
  return String(userId) === String(ADMIN_ID);
}
function parseTelegramCommand(rawText = '') {
  const text = String(rawText || '');
  const firstLine = text.split('\n')[0] || '';
  const trimmed = firstLine.trim();
  if (!trimmed.startsWith('/')) {
    return { command: '', args: '', isValid: false };
  }
  const firstSpace = trimmed.search(/\s/);
  const token = firstSpace === -1 ? trimmed : trimmed.slice(0, firstSpace);
  const args = firstSpace === -1 ? '' : trimmed.slice(firstSpace + 1).trim();
  const isLowercase = token === token.toLowerCase();
  const hasMention = token.includes('@');
  const isSupported = SUPPORTED_COMMANDS.has(token);
  const isValid = isLowercase && !hasMention && isSupported;
  return { command: token, args, isValid };
}
// ---- CORS (единственный блок) ----
// @section EXPRESS_BOOTSTRAP_AND_CORS
const allowList = [/https:\/\/t\.me$/, /https:\/\/web\.telegram\.org/];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                // curl/healthchecks
    const ok = allowList.some(rx => rx.test(origin));  // Telegram webview / web
    cb(null, ok);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type','initdata','initData','X-Requested-With','X-Telegram-Init-Data'],
  maxAge: 86400,
}));
// парсинг json после CORS
app.use(bodyParser.json());
// (оставь свой логгер, если нужен)
app.use((req, res, next) => {
  console.log('[REQ]', req.method, req.path, 'Origin:', req.headers.origin || 'none');
  next();
});
// HTML-экранирование для безопасной подстановки имени
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// Одноразовый привет (первый /start)
function WELCOME_HTML(name) {
  return (
`<blockquote><b>: ДОБРО ПОЖАЛОВАТЬ В СИСТЕМУ, ${esc(name) || 'ТРИПОНАВТ'} :</b></blockquote>
⠀
В левом нижнем углу расположена кнопка запуска ядра. <b>Относись к нему с уважением.</b>
⠀
Каждое преобразование расходует энергию:
⠀
<blockquote><b>Т3КСТ-4РТ = 1 импульс | Ф0Т0 = 5 импульсов | ВИД30 = 15 импульсов</b></blockquote>
⠀
Изменяй параметры и режимы отображения реальности панелями сверху и снизу.
⠀
<blockquote expandable="true"><b>Узнать больше о работе ядра и дополнительные команды:</b>
⠀
<b>/balance</b> — доступная энергия
<b>/help</b> — манифест по управлению ядром
<b>/buy_energy</b> — пополнить запасы энергии
<b>/referal</b> — заработать импульсы</blockquote>`
  );
}
// Повторный /start
function WELCOME_BACK_HTML(name) {
  return (
`<blockquote><b>: С ВОЗВРАЩЕНИЕМ, ${esc(name) || 'ТРИПОНАВТ'} :</b></blockquote>
⠀
Помни:
⠀
<b>Т3КСТ-4РТ = 1, Ф0Т0 = 5 | ВИД30 = 15</b>
⠀
<blockquote expandable="true"><b>Взаимодействие с Ядром:</b>
⠀
<b>/balance</b> — доступная энергия
<b>/help</b> — манифест по управлению ядром
<b>/buy_energy</b> — пополнить запасы энергии
<b>/referal</b> — заработать импульсы</blockquote>`
  );
}
// простейшее «поминание» первого старта (сбросится при рестарте pm2)
const greeted = new Set();
const firstUnknownShown = new Set(); // userId -> уже показали "ЯДРО — НЕ ПОМОЙКА"
const FIRST_UNKNOWN_LINE = '<b>ЯДРО — НЕ ПОМОЙКА.</b> Относись к нему с уважением.';
// === RANDOM UNKNOWN REPLIES ===
const UNKNOWN_LINES = [
  '<b>ЯДРО — НЕ ПОМОЙКА.</b> Относись к нему с уважением.',
  '<b>Это не похоже на команду. Скорее, на человеческую глупость.</b>',
  '<b>Твоя идея покрыта ржавчиной. Я не приму это.</b>',
  '<b>ЯДР0 СЛЫШИТ Т0ЛЬК0 К0М4НДЫ, 4 Н3 Н4МЁКИ</b>',
  'Наш сервер не смог выполнить ваш запрос. Оставьте заявку на решение проблемы и порелаксируйте под треки из нашего радио внизу страницы: https://tripchiller.com',
  '<b>¯\\_(x_x)_/¯</b>',
  '<b>Если бы тебе прислали тоже самое, чтобы ты ответил?</b>',
  '<b>Вряд ли ты бы отправил что-то более умное.</b>',
  'Энергию на преобразование можно заработать, отдав часть души Ядру системы: https://t.me/boost/tripchiller',
  '<b>Прекрати присылать мусор. Ядро не одобряет такой подход.</b>',
  '<b>Интернет помнит, но не скорбит.</b>',
  '<code>01000110 01001001 01001110 01000100 00100000 01000001 00100000 01000110 01001100 01001111 01010111 01000101 01010010</code>',
  '<b>Я не вижу в этом смысла.</b>',
  '<b>Запрос отклонён в связи с отсутствием ценности.</b>',
];
const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
function HELP_HTML() {
  return (
`<b>: : 𝗛𝗘𝗟𝗣 ⛶ 𝗜𝗡𝗙𝗢 : :</b>
⠀
<blockquote expandable="true">
<b>: : СТАРТ-МЕНЮ : :</b>
⠀
<b>«Т3КСТ»</b> — символьный режим вывода: машина отправляет копируемое сообщение с рисунком из символов в чат.
⠀
<b>«ГР4ФИК4»</b> — основной режим: преобразует фото, видео и .GIF в цветной детально настраиваемый рендер.
⠀</blockquote>
<blockquote expandable="true">
<b>«П0В3РНУТЬ»</b> — смена вывода: <b>фронтальная / основная</b> камера
⠀
*при наличии единственного источника вывода или внутри режима <b>«Ф0Т0» / «ВИД30»</b> работает как «отзеркаливание»
⠀</blockquote>
<blockquote expandable="true">
<b>: : ПАНЕЛЬ НАСТРОЕК : :</b>
⠀
<b>«Н4Б0Р»</b> — формирует алфавит символов;
⠀
*помимо готовых пресетов доступен <b>«ручной ввод»</b> — инновация, позволяющая ядру собирать изображение из введённых символов на основе алгоритма градации яркости. Используй пробелы и знаки пунктуации для детализации изображения
⠀
<b>«Р4ЗМЕР»</b> — определяет количество символов (чем выше, тем чётче детали);
⠀
<b>«К0НТР4СТ»</b> — усиливает разницу между светом и тенью;
⠀
<b>«Г4ММ4»</b> — управляет мягкостью переходов, влияя на глубину изображения;
⠀
<b>«СТИЛЬ»</b> — раздел готовых цветовых пресетов;
⠀
<b>«Т3КСТ» / «Ф0Н»</b> — задают цвета рендера символов и заднего слоя;
⠀
<b>«ИНВ3РСИЯ»</b> — меняет полярность вывода: «СВЕТ = ТЬМА», и наоборот;
⠀
<b>«FPS»</b> — регулирует частоту обновления кадров: скорость, с которой Ядро реагирует на мир
⠀</blockquote>
<blockquote><b>«СКРЫТЬ»</b> — прячет интерфейс, оставляя чистый поток данных</blockquote>
<blockquote><b>«С0ХР4НИТЬ» </b> — запускает преобразование и отправляет результат в чат</blockquote>
<blockquote expandable="true">
<b>«ВСПЫШКА» </b> и <b>«ТАЙМЕР» </b> — круглые кнопки внизу экрана, помогающие подсветить кадр и установить задержку съёмки на 3 / 10 секунд.
⠀
*для фронтальной вспышки: чем выше яркость экрана - тем ярче кадр
⠀</blockquote>
<blockquote expandable="true">
<b>: : ПАНЕЛЬ РЕЖИМОВ : :</b>
⠀
<b>«Ф0Т0»</b> = разовый оттиск реальности
<b>«К4М3Р4»</b> = непрерывное наблюдение
<b>«В1Д30»</b> = запись последовательности
⠀</blockquote>
⠀
<code>01000111 01001111 01001111 01000100 00100000 01001100 01010101 01000011 01001011</code>`
  );
}
// ---------- Мелкие утилиты ----------
const string = (v) => (v == null ? '' : String(v));
function logReq(req){ console.log(`[REQ] ${req.method} ${req.url} Origin: ${req.headers.origin||'-'}`); }
function resolveTargetIdOrNull(token) {
  const resolved = resolveUserRef(token);
  if (resolved?.ok) return { targetId: String(resolved.id), resolved };
  return { targetId: null, resolved };
}
// Конвертация видео в MP4 с оптимизацией под ASCII
// @section MEDIA_CONVERSION_PIPELINE
async function convertToMp4(inPath, outPath, opts = {}) {
  const fps = Number(opts.fps || 30);
  const mode = opts.mode === 'balanced' ? 'balanced' : 'high';
  const dryRun = opts.dryRun === true;
  const vfExpr = `fps=${fps}:round=down,setsar=1,pad=ceil(iw/2)*2:ceil(ih/2)*2,format=yuv420p`;
  // Аргументы для ffmpeg
  const preset = mode === 'balanced' ? 'medium' : 'slow';
  const crf = mode === 'balanced' ? '20' : '12';
  const maxrate = mode === 'balanced' ? '10M' : '30M';
  const bufsize = mode === 'balanced' ? '20M' : '60M';
  const args = [
    '-hide_banner', '-loglevel', 'error',
    // Анализ потока для .MOV и тяжёлых файлов
    '-analyzeduration', '200M',
    '-probesize', '200M',
    '-sws_flags', 'neighbor+full_chroma_int+full_chroma_inp+accurate_rnd',
    '-i', inPath,
    '-map', '0:v:0',
    '-map', '0:a?',
    // Основные фильтры без downscale (сохраняем исходную детализацию ASCII)
    '-vf', vfExpr,
    // Кодек и параметры
    '-c:v', 'libx264',
    '-profile:v', 'high',
    '-level', '4.2',
    '-preset', preset,
    '-crf', crf,
    '-vsync', 'cfr',
    '-video_track_timescale', String(fps * 1000),
    // Чёткое ключевание без b-frames и дрожания
    '-x264-params', [
      `keyint=${fps}`,
      `min-keyint=${fps}`,
      'scenecut=0',
      'bframes=0',
      'rc-lookahead=0',
      'aq-mode=1',
      'aq-strength=1.0',
      'deblock=0:0',
      'mbtree=0'
    ].join(':'),
  '-c:a', 'aac',
  '-b:a', mode === 'balanced' ? '96k' : '128k',
  // TODO: future ASCII audio pass / bitcrusher-style processing.
  // Possible future direction: aresample / acrusher / low bitrate digital distortion.
  '-maxrate', maxrate,
  '-bufsize', bufsize,
  '-movflags', '+faststart',
    outPath,
  ];
  if (dryRun) return args;
  await runFfmpeg(args);
  return outPath;
}
async function convertAndSaveVideo(inPath, tmpdir, opts = {}) {
  const path = require('path');
  const outMp4 = path.join(tmpdir, `out_${Date.now()}.mp4`);
  const fps = clampInt(opts.fps, 5, 60, 30);
  const mode = opts.mode === 'balanced' ? 'balanced' : 'high';
  const inputSizeBytes = (() => {
    try { return fs.statSync(inPath).size; } catch { return null; }
  })();
  console.log('[VIDEO-CONVERT] start', { inputPath: inPath, outputPath: outMp4, fps, inputSizeBytes, mode });
  const ffmpegArgs = await convertToMp4(inPath, outMp4, { fps, mode, dryRun: true });
  console.log('[VIDEO-CONVERT] ffmpeg args', ffmpegArgs);
  await runFfmpeg(ffmpegArgs);
  const outputSizeBytes = (() => {
    try { return fs.statSync(outMp4).size; } catch { return null; }
  })();
  console.log('[VIDEO-CONVERT] done', { outputPath: outMp4, outputSizeBytes, mode });
  return { path: outMp4, mime: 'video/mp4', ext: 'mp4', mode, outputSizeBytes };
}
function clampInt(v, min, max, def) {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}
const VIDEO_MAX_DURATION_SEC = 60;
const VIDEO_OUTPUT_SAFE_LIMIT_BYTES = 45 * 1024 * 1024;
const ASCII_TEXT_LIMIT = 3800;
const TEXT_MODE_COST = 1;
const TEXT_COLS_MIN = 24;
const TEXT_COLS_MAX = 56;
const TEXT_ROWS_MIN = 12;
const TEXT_ROWS_MAX = 80;
const TEXT_CHAR_ASPECT = 0.55;
const TEXT_SIZE_PRESETS = {
  s: { cols: 68, rows: 40 },
  m: { cols: 82, rows: 48 },
  l: { cols: 96, rows: 56 }
};
const TEXT_CHARSETS = {
  DOTS: ' .:-=+*#%@',
  PIXEL: ' .:-=+*#%@',
  MICRO: ' .:*',
  SIMPLE_RAMP: ' .:-=+*#%@'
};
function escapeHtml(s='') {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function resolveTextCharset({ charsetInput, charsetPreset, cols }) {
  const inputRaw = String(charsetInput || '').trim();
  if (inputRaw) {
    if (TEXT_CHARSETS[inputRaw]) {
      return { charset: TEXT_CHARSETS[inputRaw], source: 'input', presetName: inputRaw };
    }
    return { charset: inputRaw, source: 'input', presetName: null };
  }

  const presetRaw = String(charsetPreset || '').trim();
  if (presetRaw) {
    if (TEXT_CHARSETS[presetRaw]) {
      return { charset: TEXT_CHARSETS[presetRaw], source: 'preset', presetName: presetRaw };
    }
    if (Object.values(TEXT_CHARSETS).includes(presetRaw)) {
      return { charset: presetRaw, source: 'preset', presetName: null };
    }
  }

  if (Number.isFinite(cols) && cols < 34) {
    return { charset: TEXT_CHARSETS.SIMPLE_RAMP, source: 'fallback', presetName: 'SIMPLE_RAMP' };
  }
  return { charset: TEXT_CHARSETS.DOTS, source: 'fallback', presetName: 'DOTS' };
}
function normalizeGrid({ cols, rows }) {
  let c = Math.max(TEXT_COLS_MIN, Math.min(TEXT_COLS_MAX, Math.round(cols || 80)));
  let r = Math.max(TEXT_ROWS_MIN, Math.min(TEXT_ROWS_MAX, Math.round(rows || 48)));
  while (((c + 1) * r) > ASCII_TEXT_LIMIT) {
    c = Math.max(TEXT_COLS_MIN, Math.floor(c * 0.94));
    r = Math.max(TEXT_ROWS_MIN, Math.floor(r * 0.94));
    if (c <= TEXT_COLS_MIN && r <= TEXT_ROWS_MIN) break;
  }
  return { cols: c, rows: r };
}
function parseTextCols(v) {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(TEXT_COLS_MIN, Math.min(TEXT_COLS_MAX, n));
}
function parseTextRows(v) {
  const n = parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return null;
  return Math.max(TEXT_ROWS_MIN, Math.min(TEXT_ROWS_MAX, n));
}
function sanitizeAsciiSnapshot(rawAscii, requestedCols, requestedRows) {
  const input = String(rawAscii || '').replace(/\r\n?/g, '\n');
  const lines = input ? input.split('\n') : [];
  let trailingBlankLineCount = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (String(lines[i] || '').trim() === '') trailingBlankLineCount++;
    else break;
  }
  const lineCountBeforeCleanup = lines.length;
  const lineCountAfterCleanup = Math.max(0, lineCountBeforeCleanup - trailingBlankLineCount);
  const bottomLine = lines.length ? String(lines[lines.length - 1] || '') : '';
  const bottomLineVisibleChars = (bottomLine.match(/\S/g) || []).length;
  console.debug(
    `[ascii-text] snapshot final debug lineCountBeforeCleanup=${lineCountBeforeCleanup},` +
    ` lineCountAfterCleanup=${lineCountAfterCleanup},` +
    ` hasTrailingBlankLines=${trailingBlankLineCount > 0},` +
    ` bottomLineRawLength=${Array.from(bottomLine).length},` +
    ` bottomLineVisibleChars=${bottomLineVisibleChars},` +
    ` fullyBlankTrailingLineCount=${trailingBlankLineCount}`
  );

  const sourceCols = lines.reduce((m, line) => Math.max(m, Array.from(line).length), 0);
  const sourceRows = lines.length;
  let cols = Number.isFinite(requestedCols) ? requestedCols : sourceCols;
  let rows = Number.isFinite(requestedRows) ? requestedRows : sourceRows;
  if (!Number.isFinite(cols) || cols <= 0) cols = TEXT_COLS_MIN;
  if (!Number.isFinite(rows) || rows <= 0) rows = TEXT_ROWS_MIN;

  cols = Math.max(TEXT_COLS_MIN, Math.min(TEXT_COLS_MAX, Math.round(cols)));
  rows = Math.max(TEXT_ROWS_MIN, Math.min(TEXT_ROWS_MAX, Math.round(rows)));

  const slicedRows = lines.slice(0, rows).map((line) => Array.from(line || '').slice(0, cols).join(''));
  const normalizedRows = slicedRows.length;
  const normalizedCols = slicedRows.reduce((m, line) => Math.max(m, Array.from(line).length), 0);
  let asciiText = slicedRows.join('\n');

  if (asciiText.length > ASCII_TEXT_LIMIT) {
    const maxRowsByLen = Math.max(1, Math.min(normalizedRows || rows, Math.floor(ASCII_TEXT_LIMIT / Math.max(1, normalizedCols + 1))));
    asciiText = slicedRows.slice(0, maxRowsByLen).join('\n').slice(0, ASCII_TEXT_LIMIT);
  }

  const finalLines = asciiText ? asciiText.split('\n') : [];
  const finalRows = finalLines.length;
  const finalCols = finalLines.reduce((m, line) => Math.max(m, Array.from(line).length), 0);
  return { asciiText, finalRows, finalCols, asciiLen: asciiText.length };
}
async function probeImageSize(inputPath) {
  try {
    const ffArgs = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=p=0:s=x',
      inputPath
    ];
    const { stdout } = await exec('ffprobe', ffArgs, { encoding: 'utf8' });
    const [wRaw, hRaw] = String(stdout || '').trim().split('x');
    const w = parseInt(wRaw, 10);
    const h = parseInt(hRaw, 10);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
    return { width: w, height: h };
  } catch (_) {
    return null;
  }
}
function asciiFromGrayBuffer(buffer, cols, rows, charset) {
  const chars = Array.from(charset || TEXT_CHARSETS.DOTS);
  const shades = chars.length > 1 ? chars.length - 1 : 1;
  const lines = [];
  for (let y = 0; y < rows; y++) {
    let row = '';
    for (let x = 0; x < cols; x++) {
      const lum = buffer[y * cols + x] ?? 0;
      const idx = Math.max(0, Math.min(shades, Math.round((lum / 255) * shades)));
      row += chars[idx] || ' ';
    }
    lines.push(row.replace(/\t/g, ' '));
  }
  return lines.join('\n');
}
async function renderAsciiTextFromImage(inputPath, options = {}) {
  const preset = String(options.preset || 'm').toLowerCase();
  const requestedCols = parseTextCols(options.cols);
  const base = TEXT_SIZE_PRESETS[preset] || TEXT_SIZE_PRESETS.m;
  const imageSize = await probeImageSize(inputPath);
  let grid = normalizeGrid(base);
  if (requestedCols) {
    const aspect = (imageSize?.width && imageSize?.height) ? (imageSize.height / imageSize.width) : (base.rows / base.cols);
    const rowsByCols = Math.round(requestedCols * aspect * TEXT_CHAR_ASPECT);
    grid = normalizeGrid({ cols: requestedCols, rows: rowsByCols });
  }
  const charsetResolved = resolveTextCharset({
    charsetInput: options.charsetInput,
    charsetPreset: options.charsetPreset,
    cols: grid.cols
  });
  const charset = charsetResolved.charset;
  for (let attempt = 0; attempt < 4; attempt++) {
    const ffArgs = [
      '-hide_banner', '-loglevel', 'error',
      '-i', inputPath,
      '-vf', `scale=${grid.cols}:${grid.rows}:flags=area,format=gray`,
      '-f', 'rawvideo',
      '-pix_fmt', 'gray',
      'pipe:1'
    ];
    const { stdout } = await exec('ffmpeg', ffArgs, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });
    const need = grid.cols * grid.rows;
    const buf = Buffer.isBuffer(stdout) ? stdout.subarray(0, need) : Buffer.from(stdout || '').subarray(0, need);
    const asciiText = asciiFromGrayBuffer(buf, grid.cols, grid.rows, charset);
    if (asciiText.length <= ASCII_TEXT_LIMIT) {
      return {
        asciiText,
        cols: grid.cols,
        rows: grid.rows,
        charset,
        preset,
        selectedCharsetSource: charsetResolved.source,
        selectedCharsetPreset: charsetResolved.presetName,
        requestedCols: requestedCols || null,
        imageWidth: imageSize?.width || null,
        imageHeight: imageSize?.height || null
      };
    }
    grid = normalizeGrid({ cols: Math.floor(grid.cols * 0.88), rows: Math.floor(grid.rows * 0.88) });
  }
  throw new Error('ASCII_TEXT_TOO_LARGE');
}
// Папка для временных загрузок (поддержим из .env TMP_DIR)
const TMP_DIR = process.env.TMP_DIR || '/tmp/ascii';
fs.mkdirSync(TMP_DIR, { recursive: true });

async function probeVideoStreams(inputPath) {
  try {
    const ffArgs = [
      '-v', 'error',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      inputPath
    ];
    const { stdout } = await exec('ffprobe', ffArgs, { encoding: 'utf8' });
    const data = JSON.parse(String(stdout || '{}'));
    const streams = Array.isArray(data?.streams) ? data.streams : [];
    const video = streams.find((st) => st.codec_type === 'video') || null;
    const audio = streams.find((st) => st.codec_type === 'audio') || null;
    return {
      hasVideo: !!video,
      hasAudio: !!audio,
      width: Number(video?.width || 0) || null,
      height: Number(video?.height || 0) || null,
      durationSec: Number(data?.format?.duration || video?.duration || 0) || 0
    };
  } catch (_) {
    return { hasVideo: false, hasAudio: false, width: null, height: null, durationSec: 0 };
  }
}
async function convertWebmToMutedMp4(inPath, outPath, opts = {}) {
  const fps = clampInt(opts.fps, 5, 60, 30);
  const crf = clampInt(opts.crf, 12, 30, 17);
  const preset = (String(opts.preset || 'medium').toLowerCase() === 'fast') ? 'fast' : 'medium';
  const maxrate = String(opts.maxrate || '10M');
  const bufsize = String(opts.bufsize || '20M');
  const args = [
    '-hide_banner', '-loglevel', 'error',
    '-i', inPath,
    '-r', String(fps),
    '-an',
    '-c:v', 'libx264',
    '-preset', preset,
    '-crf', String(crf),
    '-maxrate', maxrate,
    '-bufsize', bufsize,
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', outPath
  ];
  await runFfmpeg(args);
}
async function cleanupStaleTmpArtifacts() {
  const now = Date.now();
  const thresholdMs = 24 * 60 * 60 * 1000;
  let files = 0; let dirs = 0; let bytesApprox = 0;
  try {
    const entries = await fs.promises.readdir(TMP_DIR, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(TMP_DIR, e.name);
      const st = await fs.promises.stat(full).catch(() => null);
      if (!st || (now - st.mtimeMs) < thresholdMs) continue;
      bytesApprox += Number(st.size || 0);
      await fs.promises.rm(full, { recursive: true, force: true });
      e.isDirectory() ? dirs++ : files++;
    }
  } catch {}
  try {
    const tmpEntries = await fs.promises.readdir('/tmp', { withFileTypes: true });
    for (const e of tmpEntries) {
      if (!e.isDirectory() || (!e.name.startsWith('trip-vid-') && !e.name.startsWith('trip-gif-'))) continue;
      const full = path.join('/tmp', e.name);
      const st = await fs.promises.stat(full).catch(() => null);
      if (!st || (now - st.mtimeMs) < thresholdMs) continue;
      await fs.promises.rm(full, { recursive: true, force: true });
      dirs++;
    }
  } catch {}
  if (files || dirs) console.log('[TMP-CLEANUP] removed stale files/dirs', { files, dirs, bytesApprox });
}

// Multer: сохраняем во временный каталог
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    filename: (_req, file, cb) => {
      const ts = Date.now();
      const safe = (file.originalname || 'upload.bin').replace(/[^\w.\-]+/g,'_');
      cb(null, `${ts}__${safe}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 1024 } // до ~1 ГБ на всякий
});
// ---------- Debug ----------
app.get('/__debug', (_req, res) => res.type('text').send(`root=${PORT}`));
// ============================================================
// ===============  HTTP API из мини-аппа  ====================
// ============================================================
// ВАЛИДАЦИЯ Telegram WebApp initData (RFC 2104 / sha256)
// @section TELEGRAM_INITDATA_VALIDATION
function validateTelegramInitData(initData, botToken) {
  try {
    if (!initData || !botToken) return { ok: false, reason: 'missing_input' };
    const params = new URLSearchParams(initData);
    const hash = params.get('hash') || '';
    if (!hash) return { ok: false, reason: 'missing_hash' };
    params.delete('hash');
    const pairs = [];
    for (const [k, v] of params.entries()) pairs.push(`${k}=${v}`);
    pairs.sort();
    const dataCheckStr = pairs.join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calcHash = crypto.createHmac('sha256', secret).update(dataCheckStr).digest('hex');
    if (calcHash !== hash) return { ok: false, reason: 'hash_mismatch' };
    return { ok: true, params };
  } catch {
    return { ok: false, reason: 'malformed' };
  }
}

function maybeUpsertUserFromInitData(req) {
  const initData = String(req.get('X-Telegram-Init-Data') || '').trim();
  if (!initData) return null;
  const checked = validateTelegramInitData(initData, process.env.BOT_TOKEN);
  if (!checked.ok) {
    console.warn('[initData] invalid', checked.reason);
    return null;
  }
  try {
    const params = checked.params;
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    if (!user?.id) return null;
    upsertUserFromTelegramUser(user, 'webapp_initdata');
    return String(user.id);
  } catch {
    console.warn('[initData] invalid', 'bad_user_json');
    return null;
  }
}

function formatHttpError(err) {
  if (!err) return 'UNKNOWN_ERROR';
  const message = String(err?.message || err);
  const responseStatus = err?.response?.status;
  const responseData = err?.response?.data;
  const responseText = (typeof responseData === 'string')
    ? responseData
    : (responseData ? JSON.stringify(responseData) : '');
  const code = err?.code ? ` code=${err.code}` : '';
  const status = responseStatus ? ` status=${responseStatus}` : '';
  const body = responseText ? ` response=${responseText.slice(0, 800)}` : '';
  return `${message}${code}${status}${body}`;
}
function normalizeHexColor(color) {
  const raw = String(color || '').trim().toLowerCase();
  const hex = raw.startsWith('#') ? raw.slice(1) : raw;
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${hex.split('').map((ch) => ch + ch).join('')}`;
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return '';
}
function readUserStylePresetsDb() {
  return readJsonObjectSafe(USER_STYLE_PRESETS_FILE);
}
function writeUserStylePresetsDb(db) {
  const dir = path.dirname(USER_STYLE_PRESETS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${USER_STYLE_PRESETS_FILE}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmp, USER_STYLE_PRESETS_FILE);
}
function parseInitDataUserIdOrThrow(req) {
  const initData = String(req.get('X-Telegram-Init-Data') || '').trim();
  if (!initData) throw new Error('invalid_init_data');
  const checked = validateTelegramInitData(initData, process.env.BOT_TOKEN);
  if (!checked.ok) throw new Error('invalid_init_data');
  const user = JSON.parse(String(checked.params.get('user') || '{}'));
  if (!user?.id) throw new Error('invalid_init_data');
  upsertUserFromTelegramUser(user, 'webapp_initdata');
  return String(user.id);
}
function normalizeUserPresetName(name) {
  const clean = String(name || '').trim().toUpperCase().replace(/[^A-ZА-ЯЁ0-9 _-]/g, '').slice(0, 16);
  return clean.replace(/[OAEIОАЕЁЯ]/g, (ch) => {
    const map = {
      O: '0',
      A: '4',
      E: '3',
      I: '1',
      О: '0',
      А: '4',
      Е: '3',
      Ё: '3',
      Я: '9'
    };
    return map[ch] || ch;
  });
}
// Текущий баланс (из мини-аппа можно дергать GET /api/balance?telegramId=...)
// @section MINIAPP_HTTP_API_ROUTES
app.get('/api/balance', (req, res) => {
  logReq(req);
  maybeUpsertUserFromInitData(req);
  const telegramId = string(req.query.telegramId || '');
  if (!telegramId) return res.status(400).json({ ok:false, message:'telegramId required' });
  ensureUser(telegramId);
  return res.json({ ok:true, balance: getBalance(telegramId) });
});
app.get('/api/user-style-presets', (req, res) => {
  try {
    const userId = parseInitDataUserIdOrThrow(req);
    const db = readUserStylePresetsDb();
    return res.json({ ok: true, presets: Array.isArray(db[userId]) ? db[userId] : [] });
  } catch {
    return res.status(401).json({ ok: false, error: 'invalid_init_data' });
  }
});
app.post('/api/user-style-presets', (req, res) => {
  let userId = '';
  try {
    userId = parseInitDataUserIdOrThrow(req);
  } catch {
    return res.status(401).json({ ok: false, error: 'invalid_init_data' });
  }
  const name = normalizeUserPresetName(req.body?.name);
  const textColor = normalizeHexColor(req.body?.textColor);
  const bgColor = normalizeHexColor(req.body?.bgColor);
  if (!name || !/^[A-ZА-ЯЁ0-9 _-]{1,16}$/.test(name)) return res.status(400).json({ ok: false, error: 'invalid_name' });
  if (!textColor || !bgColor) return res.status(400).json({ ok: false, error: 'invalid_name' });
  const db = readUserStylePresetsDb();
  const list = Array.isArray(db[userId]) ? db[userId] : [];
  if (list.length >= USER_STYLE_PRESETS_LIMIT) return res.status(400).json({ ok: false, error: 'limit_reached' });
  if (list.some((p) => String(p?.name || '').toUpperCase() === name)) return res.status(400).json({ ok: false, error: 'duplicate_name' });
  const builtInPresets = [
    ['#ffffff','#000000'],['#e5ffff','#333319'],['#8bc8fe','#051b2c'],['#fdca55','#3f291e'],['#ebe1cd','#000b40'],['#ebe5ce','#2e3037'],['#88d7de','#40318e'],['#01eb5f','#25342f'],['#00ff40','#000000'],['#83b07e','#000000'],['#fec28c','#920244'],['#fff8dc','#6495ed'],['#f44e38','#1d0f44'],['#d7bcad','#452f47'],['#edf4ff','#c62b69'],['#ebb5b5','#100101'],['#ff0055','#200955'],['#ffff02','#000000'],['#cde9cd','#321632'],['#b8c2b9','#382b26']
  ];
  const hasDupBuiltIn = builtInPresets.some(([t,b]) => normalizeHexColor(t) === textColor && normalizeHexColor(b) === bgColor);
  if (hasDupBuiltIn || list.some((p) => normalizeHexColor(p?.textColor) === textColor && normalizeHexColor(p?.bgColor) === bgColor)) return res.status(400).json({ ok: false, error: 'duplicate_colors' });
  const preset = { id: `${USER_PRESET_ID_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, name, textColor, bgColor, createdAt: new Date().toISOString() };
  db[userId] = [...list, preset];
  writeUserStylePresetsDb(db);
  return res.json({ ok: true, preset });
});
app.delete('/api/user-style-presets/:presetId', (req, res) => {
  let userId = '';
  try {
    userId = parseInitDataUserIdOrThrow(req);
  } catch {
    return res.status(401).json({ ok: false, error: 'invalid_init_data' });
  }
  const presetId = String(req.params?.presetId || '').trim();
  if (!presetId || !presetId.startsWith(USER_PRESET_ID_PREFIX)) {
    return res.status(400).json({ ok: false, error: 'invalid_preset_id' });
  }
  const db = readUserStylePresetsDb();
  const list = Array.isArray(db[userId]) ? db[userId] : [];
  const idx = list.findIndex((p) => String(p?.id || '') === presetId);
  if (idx < 0) return res.status(404).json({ ok: false, error: 'not_found' });
  try {
    db[userId] = [...list.slice(0, idx), ...list.slice(idx + 1)];
    writeUserStylePresetsDb(db);
    return res.json({ ok: true, deletedId: presetId });
  } catch {
    return res.status(500).json({ ok: false, error: 'delete_failed' });
  }
});
// === ОБНОВЛЁННЫЙ ХЕНДЛЕР ДЛЯ /api/upload и /upload ===
// Принимаем любой из ключей: file ИЛИ document, а также initdata ИЛИ initData, mediatype ИЛИ mediaType
const uploadHandler = [
  // 1) принимаем любые поля multipart (без "Unexpected field")
  upload.any(),
  // 2) основной обработчик
  async (req, res) => {
    try {
      // --- ФАЙЛ ---
      const files = Array.isArray(req.files) ? req.files : [];
      const f =
        files.find(x => x.fieldname === 'file') ||
        files.find(x => x.fieldname === 'document') ||
        files[0];
      if (!f) {
        return res.status(400).json({ ok: false, error: 'NO_FILE' });
      }
      // достаём имя, расширение и mime загруженного файла
      const originalName = f.originalname || '';
      const uploadedMime = String(f.mimetype || '').toLowerCase();
      const sourceFilename = String(req.body?.sourceFilename || '');
      const sourceMime = String(req.body?.sourceMime || '').toLowerCase();
      const sourceIsGifFlag = String(req.body?.sourceIsGif || '') === '1';
      const sourceIsGif = sourceIsGifFlag || sourceMime === 'image/gif' || /\.gif$/i.test(sourceFilename);
      // --- initData (любая форма) ---
      const initDataUserId = maybeUpsertUserFromInitData(req);
      const userId = String(initDataUserId || req.body?.telegramId || req.body?.userId || '');
      if (!userId) return res.status(400).json({ ok: false, error: 'USER_ID_REQUIRED' });
      // --- тип медиа (любая форма ключа) ---
      let mediatype = String(req.body?.mediatype || req.body?.mediaType || 'photo').toLowerCase();
      // если источник GIF — обрабатываем как видео-пайплайн с gif output
      if (sourceIsGif) {
        mediatype = 'video';
      }
      const cost = mediatype === 'video' ? 15 : 5;
      ensureUser(userId);
      const bal = getBalance(userId);
      if (bal < cost) {
        console.log('[BALANCE-GUARD] denied', { mediatype, cost, balance: bal });
        try { if (f.path) fs.unlinkSync(f.path); } catch {}
        return res.status(402).json({ ok: false, error: 'INSUFFICIENT_FUNDS', need: cost, balance: bal });
      }
      console.log('[BALANCE-GUARD] ok', { mediatype, cost, balance: bal });
      // Проверим длительность (для видео)
      if (mediatype === 'video') {
        const { duration } = await probeVideo(f.path);
        const durationSec = Number(duration || 0);
        console.log('[VIDEO-CHECK] duration', { durationSec, maxDurationSec: VIDEO_MAX_DURATION_SEC });
        if (durationSec > VIDEO_MAX_DURATION_SEC) {
          try { if (f.path) fs.unlinkSync(f.path); } catch {}
          return res.status(400).json({ ok:false, error:'VIDEO_TOO_LONG', maxDurationSec: VIDEO_MAX_DURATION_SEC, durationSec });
        }
      }
      // --- отправка в ЛС бота ---
      if (mediatype === 'video') {
  if (sourceIsGif) {
    const gifTmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-gif-'));
    const outMp4 = path.join(gifTmpdir, `out_${Date.now()}.mp4`);
    try {
      const inputSizeBytes = (() => { try { return fs.statSync(f.path).size; } catch { return null; } })();
      console.log('[GIF-SOURCE] detected', { sourceFilename, sourceMime, uploadedMime, uploadedPath: f.path });
      console.log('[GIF-MP4-CONVERT] start', { inputPath: f.path, outputPath: outMp4, inputSizeBytes });
      await convertWebmToMutedMp4(f.path, outMp4, { fps: clampInt(req.body.fps, 5, 60, 30), crf: 17, preset: 'medium', maxrate: '10M', bufsize: '20M' });
      const outputSizeBytes = (() => { try { return fs.statSync(outMp4).size; } catch { return null; } })();
      console.log('[GIF-MP4-CONVERT] done', { outputPath: outMp4, outputSizeBytes });
      if (Number(outputSizeBytes || 0) > VIDEO_OUTPUT_SAFE_LIMIT_BYTES) {
        return res.status(413).json({ ok:false, error:'GIF_OUTPUT_TOO_LARGE', maxSizeBytes: VIDEO_OUTPUT_SAFE_LIMIT_BYTES, outputSizeBytes });
      }
      const sent = await sendAnimationToUser(userId, outMp4, { caption: '#ascii_video' });
      console.log('[TG] ascii animation sent', { ok: !!sent?.ok, filePath: outMp4, size: outputSizeBytes });
    } finally {
      try { if (f.path) await fs.promises.rm(f.path, { force: true }); } catch {}
      try { await fs.promises.rm(gifTmpdir, { recursive: true, force: true }); } catch {}
    }
  } else {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-vid-'));
  const userFps = clampInt(req.body.fps, 5, 60, 30);
  const mode = (String(req.body.videoQuality || req.body.compressMode || 'high').toLowerCase() === 'balanced') ? 'balanced' : 'high';
  try {
    const probe = await probeVideoStreams(f.path);
    console.log('[VIDEO-PROBE] streams', probe);
    const result = await convertAndSaveVideo(f.path, tmpdir, { fps: userFps, mode });
    if (result?.ext === 'mp4') {
      const outputSizeBytes = Number(result.outputSizeBytes || 0);
      if (outputSizeBytes > VIDEO_OUTPUT_SAFE_LIMIT_BYTES) {
        console.log('[VIDEO-CONVERT] too-large', { outputSizeBytes, maxSizeBytes: VIDEO_OUTPUT_SAFE_LIMIT_BYTES, mode });
        if (mode === 'high') {
          return res.status(413).json({ ok:false, error:'VIDEO_RETRY_COMPRESS', maxSizeBytes: VIDEO_OUTPUT_SAFE_LIMIT_BYTES, outputSizeBytes });
        }
        return res.status(413).json({ ok:false, error:'VIDEO_OUTPUT_TOO_LARGE', maxSizeBytes: VIDEO_OUTPUT_SAFE_LIMIT_BYTES, outputSizeBytes });
      }
      // успешный mp4 отправляем как video для прямого просмотра в Telegram
      const sent = await sendVideoToUser(userId, result.path, { caption: '#ascii_video' });
      console.log('[TG] ascii video sent', { ok: !!sent?.ok, filePath: result.path, size: outputSizeBytes, mode });
    } else {
      await sendFileToUser(userId, f.path || f.buffer, '#ascii_video (webm)');
    }
  } finally {
    try { await fs.promises.rm(tmpdir, { recursive: true, force: true }); } catch {}
    try { if (f.path) await fs.promises.rm(f.path, { force: true }); } catch {}
  }
  }
      } else {
        await sendFileToUser(userId, f.path || f.buffer, '#ascii_photo');
        try { if (f.path) await fs.promises.rm(f.path, { force: true }); } catch {}
      }
// --- РЕФЕРАЛЬНЫЙ БОНУС ЗА ПЕРВУЮ АКТИВАЦИЮ ЯДРА ---
      try {
        const ref = getRefInfo(String(userId));
        if (ref && !ref.bonusGiven && ref.invitedBy) {
          const inviterId = String(ref.invitedBy);
          const BONUS = 15;
          ensureUser(inviterId);
          add(inviterId, BONUS);
          const inviterBal = getBalance(inviterId);
          markReferralBonusGiven(String(userId));
          await sendMessage(
            inviterId,
            `<b>Приведённый тобою адепт впервые активировал Ядро.</b>\n` +
            `Тебе начислено: <b>${BONUS} ${impulseWord(BONUS)}</b>.\n` +
            `Баланс: ${inviterBal} ${impulseWord(inviterBal)}`,
            { parse_mode: 'HTML', disable_web_page_preview: true }
          );
        }
      } catch (e) {
        console.warn('[ref] first-use bonus error:', e?.message || e);
      }
      // --- финал ---
      deduct(userId, cost);
      return res.json({ ok: true, balance: getBalance(userId) });
    } catch (e) {
      try { const files = Array.isArray(req.files) ? req.files : []; await Promise.all(files.map((x) => x?.path ? fs.promises.rm(x.path, { force: true }).catch(() => {}) : Promise.resolve())); } catch {}
      const detail = formatHttpError(e);
      console.error('[ERR] /api/upload', detail);
      return res.status(500).json({ ok: false, error: 'UPLOAD_FAILED', detail });
    }
  }
];
// Регистрируем один и тот же обработчик на оба пути (как у тебя было)
app.post('/api/upload', ...uploadHandler);
app.post('/upload', ...uploadHandler);


app.post('/api/ascii-text', upload.any(), async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const f = files.find(x => x.fieldname === 'file') || files.find(x => x.fieldname === 'document') || files[0];
  const initDataUserId = maybeUpsertUserFromInitData(req);
  const userId = String(initDataUserId || req.body?.telegramId || req.body?.userId || '');
  if (!userId) {
    try { if (f?.path) fs.unlinkSync(f.path); } catch {}
    return res.status(400).json({ ok:false, error:'USER_ID_REQUIRED' });
  }
  try {
    ensureUser(userId);
    const bal = getBalance(userId);
    if (bal < TEXT_MODE_COST) {
      return res.status(402).json({ ok:false, error:'INSUFFICIENT_FUNDS', need:TEXT_MODE_COST, balance:bal });
    }
    const body = (req.body && typeof req.body === 'object') ? req.body : {};
    const query = (req.query && typeof req.query === 'object') ? req.query : {};
    const pickField = (key, fallback = null) => {
      const raw = body[key] ?? query[key] ?? fallback;
      return Array.isArray(raw) ? raw[0] : raw;
    };
    const requestedColsRaw = pickField('cols', null);
    const requestedRowsRaw = pickField('rows', null);
    const sizePreset = String(pickField('sizePreset', 'm') || 'm').toLowerCase();
    const cols = parseTextCols(requestedColsRaw);
    const rows = parseTextRows(requestedRowsRaw);
    const charsetPreset = pickField('charsetPreset', null);
    const charsetUsed = String(pickField('charsetUsed', '') || '');
    const charsetInput = pickField('charsetInput', null);
    const incomingAsciiText = String(pickField('asciiText', '') || '');
    let result;
    if (incomingAsciiText.trim()) {
      const snapshot = sanitizeAsciiSnapshot(incomingAsciiText, cols, rows);
      result = {
        asciiText: snapshot.asciiText,
        cols: snapshot.finalCols,
        rows: snapshot.finalRows,
        asciiLen: snapshot.asciiLen,
        selectedCharsetSource: 'snapshot',
        selectedCharset: charsetUsed || charsetPreset || TEXT_CHARSETS.DOTS
      };
    } else {
      if (!f) return res.status(400).json({ ok:false, error:'NO_FILE' });
      const rendered = await renderAsciiTextFromImage(f.path, { preset: sizePreset, cols, charsetInput, charsetPreset });
      result = {
        ...rendered,
        asciiLen: rendered.asciiText.length,
        selectedCharset: rendered.charset
      };
    }
    console.debug(`[ascii-text] requestedCols=${requestedColsRaw ?? 'null'}, requestedRows=${requestedRowsRaw ?? 'null'}, parsedCols=${cols ?? 'null'}, parsedRows=${rows ?? 'null'}, preset=${sizePreset}, finalCols=${result.cols}, finalRows=${result.rows}, asciiLen=${result.asciiLen}, selectedCharsetSource=${result.selectedCharsetSource}, selectedCharset=${String(result.selectedCharset || '').slice(0, 64)}`);
    const safeText = escapeHtml(result.asciiText);
    await sendMessage(userId, `<pre>${safeText}</pre>`, { parse_mode: 'HTML', disable_web_page_preview: true });
    deduct(userId, TEXT_MODE_COST);
    return res.json({
      ok:true,
      balance:getBalance(userId),
      asciiText: result.asciiText,
      cols: result.cols,
      rows: result.rows,
      finalCols: result.cols,
      finalRows: result.rows,
      asciiLen: result.asciiLen,
      selectedCharsetSource: result.selectedCharsetSource,
      selectedCharset: result.selectedCharset,
      selectedCharsetPreset: result.selectedCharsetPreset
    });
  } catch (e) {
    const detail = formatHttpError(e);
    console.error('[ERR] /api/ascii-text', detail);
    return res.status(500).json({ ok:false, error:'ASCII_TEXT_FAILED', message:detail });
  } finally {
    try { if (f?.path) fs.unlinkSync(f.path); } catch {}
  }
});
// ОСТАВЛЯЕМ: старый основной save (если где-то используется)
// ожидает { telegramId, assetId, type } и работает через convertAndSave → sendFileToUser
app.post('/api/save', async (req, res) => {
  logReq(req);
  try {
    const { telegramId, assetId, type } = req.body || {};
    if (!telegramId || !assetId || !type) {
      return res.status(400).json({ ok:false, message:'telegramId, assetId, type required' });
    }
    ensureUser(telegramId);
    const cost = (type === 'video') ? 15 : 5;
    const balance = getBalance(telegramId);
    if (balance < cost) {
      return res.status(402).json({ ok:false, message:'Insufficient balance', balance });
    }
// === Проверка анти-спама ===
const kind = type === 'video' ? 'video' : 'photo';
if (!canProceed(telegramId, kind)) {
  return res.status(429).json({ ok: false, error: 'Too many requests, попробуй через час' });
}
    console.log('[REQ] /api/save BODY:', { telegramId, assetId, type });
    const outPath = await convertAndSave({ assetId, type });
    
await sendFileToUser(telegramId, outPath, `#${assetId}`);
// === Очистка временных файлов после отправки ===
try { await fs.promises.rm(outPath, { force: true }); } catch {}
try { await fs.promises.rm(path.dirname(outPath), { recursive: true, force: true }); } catch {}
    try { fs.unlinkSync(outPath); } catch(_) {}
    deduct(telegramId, cost);
    res.json({ ok:true, balance: getBalance(telegramId), message: 'File processed and sent' });
  } catch (err) {
    console.error('[ERR] /api/save:', err);
    res.status(500).json({ ok:false, message: err.message });
  }
});
// ============================================================
// ===============   Админские HTTP ручки   ===================
// ============================================================
// @section ADMIN_HTTP_ROUTES
app.post('/admin/grant', (req, res) => {
  logReq(req);
  const { secret, telegramId, username, amount } = req.body || {};
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ ok:false, message:'forbidden' });
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return res.status(400).json({ ok:false, message:'amount must be number' });
  const targetId = telegramId ? String(telegramId) : resolveTargetIdOrNull(username).targetId;
  if (!targetId) return res.status(400).json({ ok:false, message:'telegramId or known username required' });
  ensureUser(targetId);
  add(targetId, amt);
  res.json({ ok:true, balance: getBalance(targetId), targetId });
});
app.post('/admin/set', (req, res) => {
  logReq(req);
  const { secret, telegramId, username, balance } = req.body || {};
  if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ ok:false, message:'forbidden' });
  const val = Number(balance);
  if (!Number.isFinite(val)) return res.status(400).json({ ok:false, message:'balance must be number' });
  const targetId = telegramId ? String(telegramId) : resolveTargetIdOrNull(username).targetId;
  if (!targetId) return res.status(400).json({ ok:false, message:'telegramId or known username required' });
  ensureUser(targetId);
  const curr = getBalance(targetId);
  deduct(targetId, curr);
  add(targetId, val);
  res.json({ ok:true, balance: getBalance(targetId), targetId });
});
// ============================================================
// ===============         Telegram webhook       =============
// ============================================================
const TG_MESSAGE_SOFT_LIMIT = 3600;

function buildMessagePreview(text, maxLen = 120) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .slice(0, maxLen);
}

function truncateMessageText(text, maxLen = TG_MESSAGE_SOFT_LIMIT) {
  const src = String(text || '');
  if (src.length <= maxLen) return src;
  const marker = '\n[сообщение сокращено]';
  return src.slice(0, Math.max(0, maxLen - marker.length)) + marker;
}

function logTelegramSendError(err, { method, chatId, text }) {
  console.error('[TG sendMessage error]', {
    method,
    status: err?.response?.status,
    description: err?.response?.data?.description,
    chatId: String(chatId),
    textLength: String(text || '').length,
    textPreview: buildMessagePreview(text)
  });
}

async function sendMessage(chatId, text, extra = {}) {
  const method = 'sendMessage';
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/${method}`;
  const safeText = truncateMessageText(text);
  try {
    await axios.post(url, { chat_id: String(chatId), text: safeText, ...extra });
  } catch (err) {
    logTelegramSendError(err, { method, chatId, text: safeText });
    throw err;
  }
}
async function getChatSafe(chatId) {
  try {
    const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/getChat`;
    const { data } = await axios.post(url, { chat_id: String(chatId) });
    if (data && data.ok && data.result) return data.result;
  } catch (e) {}
  return null;
}
function updateUsernameCache(userId, actualUsername) {
  const usernamesObj = readJsonObjectSafe(UNAME_FILE);
  let changed = false;
  // удалить старый username этого userId
  for (const [uname, uid] of Object.entries(usernamesObj)) {
    if (String(uid) === String(userId) && uname !== actualUsername) {
      delete usernamesObj[uname];
      changed = true;
    }
  }
  // если username есть — записать/обновить
  if (actualUsername) {
    if (usernamesObj[actualUsername] !== String(userId)) {
      usernamesObj[actualUsername] = String(userId);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(UNAME_FILE, JSON.stringify(usernamesObj, null, 2), 'utf-8');
  }
}
async function getActualUsername(userId) {
  const chat = await getChatSafe(userId);
  if (chat && chat.username) {
    const actualUsername = String(chat.username);
    updateUsernameCache(userId, actualUsername);
    return actualUsername;
  }
  if (chat) updateUsernameCache(userId, null);
  return null;
}
// ==== TELEGRAM MESSAGING / BILLING HELPERS ====
// @section TELEGRAM_BILLING_AND_MESSAGE_UTILS
// ==== ПРОСТОЕ ФОРМАТИРОВАНИЕ [b] [i] [c] [q] [link] → HTML ====
function applyMiniFormatting(text) {
  if (!text) return '';
  let out = String(text);
  // жирный
  out = out.replace(/\[b\](.+?)\[\/b\]/gis, '<b>$1</b>');
  // курсив
  out = out.replace(/\[i\](.+?)\[\/i\]/gis, '<i>$1</i>');
  // "код" / моноширинный блок
  out = out.replace(/\[c\](.+?)\[\/c\]/gis, '<code>$1</code>');
  // цитата
  out = out.replace(/\[q\](.+?)\[\/q\]/gis, '<blockquote expandable>$1</blockquote>');
  // гиперссылка: [link]текст|https://url[/link]
  out = out.replace(/\[link\](.+?)\|(.+?)\[\/link\]/gis, '<a href="$2">$1</a>');
  return out;
}
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
async function sendInvoice(chatId, pack) {
  const title = `${pack} ИМПУЛЬСОВ`;
  const description =
'ПОДТВЕРДИ СВОЁ НАМЕРЕНИЕ:';
  // payload сохраняем в том же формате, ты уже его парсишь в successful_payment
  const payload = `buy:${pack}:${Date.now()}`;
  // ВАЖНО: для Stars суммы — это ЦЕЛОЕ число звёзд
  const prices = [{ label: `${pack} ИМПУЛЬСОВ`, amount: pack }];
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendInvoice`;
  await axios.post(url, {
    chat_id: String(chatId),
    title,
    description,
    payload,
    provider_token: "",      // Stars → пустая строка
    currency: "XTR",         // Stars валюта
    prices,
    start_parameter: 'buy_energy',
    need_name: false,
    is_flexible: false
  });
}
// /tg/webhook (команды, баланс, /send и т.п.)
// @section TELEGRAM_WEBHOOK_HANDLER
app.post('/tg/webhook', async (req, res) => {
  try {
    // Защита секретом Telegram
    const secret = req.get('X-Telegram-Bot-Api-Secret-Token');
    if (secret !== TG_SECRET) {
      console.log('[TG] invalid secret');
      return res.sendStatus(401);
    }
    const upd = req.body;
    // inline-кнопки оплаты
    const cb = upd.callback_query;
    if (cb) {
      const fromId = String(cb.from.id);
      const data = String(cb.data || '');
      if (data === 'pay:back') {
        await sendMessage(fromId, 'ТЫ ПЕРЕДУМАЛ?.. Подумай ещё раз.');
        return res.json({ ok: true });
      }
      if (data.startsWith('pay:')) {
        const pack = Number(data.split(':')[1] || 0); // 10/25/50/100
        await sendInvoice(fromId, pack);
        return res.json({ ok: true });
      }
    }
const pc = upd.pre_checkout_query;
if (pc) {
  const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/answerPreCheckoutQuery`;
  await axios.post(url, { pre_checkout_query_id: pc.id, ok: true });
  return res.json({ ok: true });
}
    const msg = upd.message || upd.edited_message;
    if (!msg) return res.sendStatus(200);
    if (String(msg?.chat?.type || '') !== 'private') {
      return res.json({ ok: true });
    }
// успешный платёж → начисляем импульсы
if (msg.successful_payment) {
  const fromId = String(msg.from.id || '');
  // мы клали в payload строку вида "buy:<pack>"
  const payload = String(msg.successful_payment.invoice_payload || '');
  const pack = Number((payload.split(':')[1] || '0'));
  
  if (Number.isFinite(pack) && pack > 0) {
    ensureUser(fromId);
    add(fromId, pack);
    // --- реферальный бонус 20% от пополнения ---
    try {
      const info = getRefInfo(fromId);
      if (info && info.invitedBy) {
        const bonus = Math.floor(pack / 5);
        if (bonus > 0) {
          const inviterId = String(info.invitedBy);
          ensureUser(inviterId);
          add(inviterId, bonus);
          addReferralEarning(inviterId, bonus);
          const invBal = getBalance(inviterId);
          await sendMessage(
            inviterId,
            `<b>Приведённый тобою адепт пополнил энергию Ядра на ${pack} ${impulseWord(pack)}.</b>\n` +
            `<b>Тебе начислено:</b> +[${bonus}] ${impulseWord(bonus)}.\n` +
            `<b>В ЭНЕРГО-ХРАНИЛИЩЕ:</b> [${invBal}] ${impulseWord(invBal)}`,
            { parse_mode: 'HTML', disable_web_page_preview: true }
);
        }
      }
    } catch (e) {
      console.error('[ref] bonus error:', e);
    }
    const bal = getBalance(fromId);
    await sendMessage(fromId, `<b>ЗАЧИСЛЕНО:</b> [${pack}] ИМПУЛЬСОВ.\n<b>В ХРАНИЛИЩЕ:</b> ${bal} ${impulseWord(bal)}`,
{ parse_mode: 'HTML', disable_web_page_preview: true }
);
  } else {
    await sendMessage(fromId, 'Оплата получена, но пакет не распознан. /balance.');
  }
  return res.json({ ok: true });
}
    const fromId = string(msg.from.id || '');
    const text   = string((msg.text || '').trim());
    const textTrim = (text || '').trim();
    const { command, args, isValid } = parseTelegramCommand(textTrim);
    const isAdmin = isAdminUser(fromId);
    if (isValid && !isAdmin) {
      if (PUBLIC_COMMANDS.has(command)) {
        if (command === '/balance' && args) {
          await sendMessage(fromId, ADMIN_ONLY_REPLY);
          return res.json({ ok: true });
        }
      } else {
        await sendMessage(fromId, ADMIN_ONLY_REPLY);
        return res.json({ ok: true });
      }
    }
    // /say — отправить произвольный текст пользователю (только для админа)
    if (/^\/say(?:@[\w_]+)?(\s|$)/i.test(textTrim)) {
      if (!isAdmin) {
        await sendMessage(fromId, ADMIN_ONLY_REPLY);
        return res.json({ ok: true });
      }
      const m = textTrim.match(/^\/say(?:@[\w_]+)?\s+([\s\S]+)$/i);
      if (!m) {
        await sendMessage(fromId, '/say <@username|user_id> <text>');
        return res.json({ ok: true });
      }
      const args = String(m[1] || '').trim();
      const mm = args.match(/^(\S+)\s+([\s\S]+)$/);
      if (!mm) {
        await sendMessage(fromId, '/say <@username|user_id> <text>');
        return res.json({ ok: true });
      }
      const targetToken = String(mm[1] || '').trim();
      const messageText = String(mm[2] || '').trim();
      if (!targetToken || !messageText) {
        await sendMessage(fromId, '/say <@username|user_id> <text>');
        return res.json({ ok: true });
      }
      let resolvedChatId = null;
      if (/^-?\d+$/.test(targetToken)) {
        resolvedChatId = targetToken;
      } else {
        const uname = targetToken.replace(/^@/, '');
        const id = resolveTargetIdOrNull(uname).targetId;
        if (!id) {
          await sendMessage(fromId, `Пользователь @${uname} не существует или ещё ни разу не запускал бота.`);
          return res.json({ ok: true });
        }
        resolvedChatId = String(id);
      }
      try {
        const formatted = applyMiniFormatting(messageText);
        await sendMessage(resolvedChatId, formatted, { parse_mode: 'HTML' });
        await sendMessage(fromId, `Ядро написало пользователю ${resolvedChatId}`);
      } catch (e) {
        const err = String(e?.response?.data?.description || e?.message || 'send failed').slice(0, 180);
        await sendMessage(fromId, `Не удалось отправить послание: ${err}`);
      }
      return res.json({ ok: true });
    }
    if (msg.from) {
      upsertUserFromTelegramUser(msg.from, 'bot_message');
      setUsername(fromId, msg.from.username || '');
    }
// --------- /penalise (alias /punish) ---------
if (/^\/(penalise|punish)(?:@[\w_]+)?(\s|$)/i.test(text)) {
  // только админ
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  // Форматы:
  // /penalise @username 100 причина...
  // или ответ на сообщение юзера: /penalise 100 причина...
  let targetId = null;
  let amount = null;
  let reason = '';
  const userMentionMatch = text.match(/^\/(penalise|punish)\s+@([A-Za-z0-9_]+)\s+(\d+)(?:\s+(.+))?/i);
  if (userMentionMatch) {
    const uname = userMentionMatch[2];
    amount = Number(userMentionMatch[3]);
    reason = userMentionMatch[4] || '';
    targetId = resolveTargetIdOrNull(uname).targetId;
    if (!targetId) {
      await sendMessage(fromId, `Пользователь @${uname} ещё не запускал бота.`);
      return res.json({ ok:true });
    }
  } else if (msg.reply_to_message && msg.reply_to_message.from) {
    const m = text.match(/^\/(penalise|punish)\s+(\d+)(?:\s+(.+))?/i);
    if (!m) {
      await sendMessage(fromId, 'Формат: /penalise @username 100 причина... или ответ на сообщение: /penalise 100 причина...');
      return res.json({ ok:true });
    }
    amount = Number(m[2]);
    reason = m[3] || '';
    targetId = String(msg.reply_to_message.from.id);
  } else {
    await sendMessage(fromId, 'Формат: /penalise @username 100 причина... или ответ на сообщение пользователя: /penalise 100 причина...');
    return res.json({ ok:true });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(fromId, 'Неверная сумма для списания.');
    return res.json({ ok:true });
  }
  ensureUser(targetId); // гарантируем запись в хранилище
  const curr = getBalance(targetId); // функция из store.js
  if (curr < amount) {
    await sendMessage(fromId, `У пользователя недостаточно импульсов: есть ${curr}, требуется ${amount}. Списание отменено.`);
    return res.json({ ok:true });
  }
  // безопасное списание (не уходит в минус)
  deduct(targetId, amount); // или add(targetId, -amount) если у тебя так реализовано
  const newBal = getBalance(targetId);
  // лог
  try { fs.appendFileSync(path.join(__dirname,'penalties.log'), `${new Date().toISOString()} TG_PENALIZE admin=${fromId} target=${targetId} amt=${amount} reason=${reason}\n`); } catch(e){}
  // уведомления
await sendMessage(
  targetId,
  `⚠️  ШТРАФ СИСТЕМЫ : ${amount} ${impulseWord(amount)}.\nПричина: ${reason || 'Нарушение правил обращения с Ядром'}.\nБаланс: ${newBal} ${impulseWord(newBal)}`
);
  await sendMessage(fromId, `Готово. Списано ${amount}. Баланс пользователя: ${newBal}`);
  return res.json({ ok:true });
}
// /start (с поддержкой рефералок: /start ref_123456)
if (/^\/start(?:@[\w_]+)?/.test(text)) {
  const name  = string(msg.from.first_name || msg.from.username || '');
  const first = !greeted.has(fromId);
  const username = (msg.from.username || '').trim();
  const isAnonymousUser = !username; // нет username → не считаем рефералом
  // пробуем вытащить параметр после /start
  let inviterId = null;
  const m = text.match(/^\/start(?:@[\w_]+)?\s+(.+)$/);
  if (m && m[1]) {
    const param = m[1].trim();
    // ждём формат: ref_123456789
    if (/^ref_\d+$/.test(param)) {
      inviterId = param.slice(4); // всё после 'ref_'
    }
  }
  // 🔹 КЛЮЧ: проверяем, был ли юзер уже в базе ДО создания записи
  const wasKnownBefore = userExists(fromId);
  // создаём/гарантируем запись юзера
  ensureUser(fromId);
  // Регистрируем факт прихода по рефке, Но БЕЗ бонуса
  if (inviterId && inviterId !== fromId && !wasKnownBefore && !isAnonymousUser) {
    registerReferral(fromId, inviterId);
  }
  greeted.add(fromId);
  const html = first ? WELCOME_HTML(name) : WELCOME_BACK_HTML(name);
  await sendMessage(fromId, html, { parse_mode: 'HTML', disable_web_page_preview: true });
  return res.json({ ok:true });
}
    // /balance
if (text === '/balance') {
  ensureUser(fromId);
  const bal = getBalance(fromId);
  const msgHtml = `
<b>В ЭНЕРГО-ХРАНИЛИЩЕ:</b> <code>[${bal}]</code> ${impulseWord(bal)}
`;
  await sendMessage(
    fromId,
    msgHtml,
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
  return res.json({ ok:true });
}
// /referal — личная реферальная ссылка
if (text === '/referal' || text === '/referral') {
  const botUsername = 'ascii_visor_bot';
  const link = `https://t.me/${botUsername}?start=ref_${fromId}`;
  const msgHtml = 
`<b>РАСПРОСТРАНЯЙ ЯДРО:</b>
⠀
<code>${link}</code>
⠀
За каждого приведённого адепта, который активирует ядро по твоей ссылке и впервые сгенерирует файл/видео:
⠀
<blockquote>— система выдаст тебе <code>+[15]</code> импульсов сразу
— будет выдавать по 20% от всех его пополнений энергии</blockquote>
`;
  await sendMessage(
    fromId,
    msgHtml,
    { parse_mode: 'HTML', disable_web_page_preview: false }
  );
  return res.json({ ok:true });
}
// --------- /balance @username (только для админа) ---------
if (/^\/balance(?:@[\w_]+)?\s+@?([A-Za-z0-9_]+)\b/i.test(text)) {
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  const uname = text.match(/^\/balance(?:@[\w_]+)?\s+@?([A-Za-z0-9_]+)\b/i)[1];
  const { targetId } = resolveTargetIdOrNull(uname);
  if (!targetId) {
    await sendMessage(fromId, `Пользователь @${uname} ещё не запускал бота или не найден.`);
    return res.json({ ok:true });
  }
  ensureUser(targetId);
  const bal = getBalance(targetId);
  await sendMessage(fromId, `💠 У @${uname}: ${bal} ${impulseWord(bal)}.`);
  return res.json({ ok:true });
}
// --------- /stats (только для админа) ---------
if (/^\/stats(?:@[\w_]+)?$/i.test(text)) {
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  const balancesObj = readJsonObjectSafe(BAL_FILE);
  const usernamesObj = readJsonObjectSafe(UNAME_FILE);
  const userIds = Object.keys(balancesObj);
  const usersTotal = userIds.length;
  const usernamesIndexed = Object.keys(usernamesObj).length;
  const entries = userIds.map((uid) => ({
    userId: String(uid),
    balance: Number(balancesObj[uid] || 0)
  }));
  const totalImpulses = entries.reduce((sum, row) => sum + row.balance, 0);
  const avgBalance = usersTotal > 0 ? (totalImpulses / usersTotal).toFixed(2) : '0.00';
  const idToUsername = {};
  for (const [uname, uid] of Object.entries(usernamesObj)) {
    idToUsername[String(uid)] = String(uname);
  }
  const topRows = entries
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
  const top10 = [];
  for (let idx = 0; idx < topRows.length; idx += 1) {
    const row = topRows[idx];
    const actualUsername = await getActualUsername(row.userId);
    const name = actualUsername
      ? `@${actualUsername}`
      : (idToUsername[row.userId] ? `@${idToUsername[row.userId]}` : row.userId);
    top10.push(`${idx + 1}) ${name} — ${row.balance}`);
  }
  const now = new Date().toISOString();
  const report = [
    '[b]STATS[/b]',
    '[q]',
    `users total: ${usersTotal}`,
    `usernames indexed: ${usernamesIndexed}`,
    `total impulses: ${totalImpulses}`,
    `avg balance: ${avgBalance}`,
    'top 10 by balance:',
    ...(top10.length ? top10 : ['нет данных']),
    `server time: ${now}`,
    '[/q]'
  ].join('\n');
  await sendMessage(fromId, applyMiniFormatting(report), { parse_mode: 'HTML', disable_web_page_preview: true });
  return res.json({ ok:true });
}
// --------- /who (только для админа) ---------
if (/^\/who(?:@[\w_]+)?\s+(.+)$/i.test(text)) {
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  const targetToken = String(text.match(/^\/who(?:@[\w_]+)?\s+(.+)$/i)[1] || '').trim();
  if (!targetToken) {
    await sendMessage(fromId, applyMiniFormatting('[q]Формат: /who @username или /who <user_id>[/q]'), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  const usernamesObj = readJsonObjectSafe(UNAME_FILE);
  const registryObj = readJsonObjectSafe(REGISTRY_FILE);
  const { targetId, resolved } = resolveTargetIdOrNull(targetToken);
  let username = '';
  let known = Boolean(targetId);
  if (resolved?.ambiguous) {
    const lines = resolved.candidates.map((c) => `${c.id} (last_seen_at: ${c.last_seen_at || '-'})`);
    await sendMessage(fromId, applyMiniFormatting(['[b]КТО?[/b]', '[q]', 'Найдено несколько кандидатов:', ...lines, '[/q]'].join('\n')), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  if (!targetId) {
    await sendMessage(fromId, applyMiniFormatting('[q]Пользователь не найден.[/q]'), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  const reg = registryObj[targetId] || null;
  if (reg?.username) username = String(reg.username);
  const actualUsername = await getActualUsername(targetId);
  if (actualUsername) username = actualUsername;
  const idToUsername = {};
  for (const [uname, uid] of Object.entries(usernamesObj)) {
    idToUsername[String(uid)] = String(uname);
  }
  const referrals = getReferralsOf(targetId);
  const refsPreviewLimit = 15;
  const refsPreview = referrals.slice(0, refsPreviewLimit);
  const refsLines = refsPreview.map((rid) => {
    const label = idToUsername[rid] ? `@${idToUsername[rid]} (${rid})` : String(rid);
    return escapeHtml(label);
  });
  const refsTail = referrals.length > refsPreviewLimit
    ? escapeHtml(`...и ещё ${referrals.length - refsPreviewLimit} рефералов`)
    : null;
  const refsPreviewBlock = referrals.length
    ? ['[q]', ...refsLines, ...(refsTail ? [refsTail] : []), '[/q]']
    : ['нет'];
  const balancesObj = readJsonObjectSafe(BAL_FILE);
  const hasBalance = Object.prototype.hasOwnProperty.call(balancesObj, targetId);
  const balanceValue = hasBalance ? Number(balancesObj[targetId] || 0) : null;
  const usernameValue = username ? `@${username}` : '-';
  const usernameHistory = (reg?.username_history || []).join(', ') || '-';
  const lastSeenAt = formatMskDateTime(reg?.last_seen_at);
  const resolvedBy = mapResolvedByLabel(resolved?.foundBy);
  const whoMsg = [
    '[b]КТО?[/b]',
    `<b>username:</b> ${escapeHtml(usernameValue)}`,
    `<b>user_id:</b> <code>${escapeHtml(targetId)}</code>`,
    `<b>chat_id:</b> <code>${escapeHtml(targetId)}</code>`,
    `<b>Известен:</b> ${known ? 'да' : 'нет'}`,
    `<b>Найден через:</b> ${escapeHtml(resolvedBy)}`,
    `<b>Известен также как:</b> ${escapeHtml(usernameHistory)}`,
    `<b>Последнее посещение:</b> <code>${escapeHtml(lastSeenAt)}</code>`,
    hasBalance
      ? `<b>Баланс:</b> <code>${escapeHtml(`[${balanceValue}]`)}</code> импульсов`
      : '<b>Баланс:</b> нет',
    `<b>Приглашён другим:</b> ${getRefInfo(targetId) ? 'да' : 'нет'}`,
    `<b>Количество рефералов:</b> <code>${escapeHtml(String(referrals.length))}</code>`,
    '',
    '<b>Приведённые пользователи:</b>',
    ...refsPreviewBlock
  ].join('\n');
  await sendMessage(fromId, applyMiniFormatting(whoMsg), { parse_mode: 'HTML', disable_web_page_preview: true });
  return res.json({ ok:true });
}

// --------- /who_refs (только для админа) ---------
if (/^\/who_refs(?:@[\w_]+)?\s+(.+)$/i.test(text)) {
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  const rawArgs = String(text.match(/^\/who_refs(?:@[\w_]+)?\s+(.+)$/i)[1] || '').trim();
  const args = rawArgs.split(/\s+/).filter(Boolean);
  const targetToken = args[0] || '';
  const pageRaw = Number(args[1] || 1);
  const pageSize = 50;
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  if (!targetToken) {
    await sendMessage(fromId, applyMiniFormatting('[q]Формат: /who_refs @username|<user_id> [page][/q]'), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  const { targetId, resolved } = resolveTargetIdOrNull(targetToken);
  if (resolved?.ambiguous) {
    const lines = resolved.candidates.map((c) => `${c.id} (last_seen_at: ${c.last_seen_at || '-'})`);
    await sendMessage(fromId, applyMiniFormatting(['[b]ПРИВЕДЁННЫЕ АДЕПТЫ[/b]', '[q]', 'Найдено несколько кандидатов:', ...lines, '[/q]'].join('\n')), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  if (!targetId) {
    await sendMessage(fromId, applyMiniFormatting('[q]Пользователь не найден.[/q]'), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  const usernamesObj = readJsonObjectSafe(UNAME_FILE);
  const idToUsername = {};
  for (const [uname, uid] of Object.entries(usernamesObj)) idToUsername[String(uid)] = String(uname);
  const referrals = getReferralsOf(targetId);
  if (!referrals.length) {
    await sendMessage(fromId, applyMiniFormatting('[b]ПРИВЕДЁННЫЕ АДЕПТЫ[/b]\n<b>user_id:</b> <code>' + escapeHtml(targetId) + '</code>\n<b>Страница:</b> <code>1/1</code>\n<b>Количество:</b> <code>0</code>\n\n[q]нет[/q]'), { parse_mode: 'HTML', disable_web_page_preview: true });
    return res.json({ ok:true });
  }
  const totalPages = Math.max(1, Math.ceil(referrals.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = referrals.slice(start, start + pageSize);
  const lines = pageItems.map((rid, idx) => {
    const label = idToUsername[rid] ? `@${idToUsername[rid]} (${rid})` : String(rid);
    return `${start + idx + 1}. ${label}`;
  });
  const msg = [
    '[b]ПРИВЕДЁННЫЕ АДЕПТЫ[/b]',
    `<b>user_id:</b> <code>${escapeHtml(targetId)}</code>`,
    `<b>Страница:</b> <code>${escapeHtml(`${safePage}/${totalPages}`)}</code>`,
    `<b>Количество:</b> <code>${escapeHtml(String(referrals.length))}</code>`,
    '',
    '[q]',
    ...lines.map((line) => escapeHtml(line)),
    '[/q]'
  ].join('\n');
  await sendMessage(fromId, applyMiniFormatting(msg), { parse_mode: 'HTML', disable_web_page_preview: true });
  return res.json({ ok:true });
}

// --------- /all (только для админа) ---------
if (/^\/all(?:@[\w_]+)?\s+([\s\S]+)$/i.test(text)) {
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok:true });
  }
  const broadcastText = String(text.match(/^\/all(?:@[\w_]+)?\s+([\s\S]+)$/i)[1] || '');
  const formattedText = applyMiniFormatting(broadcastText);
  const balancesObj = readJsonObjectSafe(BAL_FILE);
  const recipients = Object.keys(balancesObj);
  let successCount = 0;
  let failCount = 0;
  for (const uid of recipients) {
    try {
      await sendMessage(String(uid), formattedText, { parse_mode: 'HTML', disable_web_page_preview: true });
      successCount += 1;
    } catch (e) {
      failCount += 1;
    }
    await sleep(34);
  }
  await sendMessage(
    fromId,
    applyMiniFormatting(`Рассылка завершена: ✅ ${successCount} | ❌ ${failCount}`),
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
  return res.json({ ok:true });
}
    // /buy_energy — показать пакеты
    if (text === '/buy_energy') {
      const kb = {
        inline_keyboard: [
          [{ text: '10 ◇',  callback_data: 'pay:10' },  { text: '25 ◈',  callback_data: 'pay:25' }],
          [{ text: '50 ◆',  callback_data: 'pay:50' },  { text: '100 ✦', callback_data: 'pay:100' }],
          [{ text: 'Назад',   callback_data: 'pay:back' }],
        ]
      };
     await sendMessage(fromId, `
    <b>ЯДРО ПИТАЕТСЯ ЭНЕРГИЕЙ:</b>
⠀
<blockquote><b>ИМПУJIЬС = ЗВЕЗДА</b>
⠀
<b>Т3КСТ-4РТ = 1 ИМПУJIЬС</b>
<b>Ф0Т0 = 5 ИМПУJIЬС0В</b>
<b>ВИД30 = 15 ИМПУJIЬС0В</b></blockquote>`,
    { parse_mode: 'HTML', reply_markup: JSON.stringify(kb) });
      return res.json({ ok: true });
    }
    // служебная /whoami
    if (text === '/whoami') {
      await sendMessage(fromId, `fromId=${fromId}\nADMIN_ID=${ADMIN_ID}`);
      return res.json({ ok:true });
    }
// /send — награда от Создателя (аналог /penalise, но с плюсом)
if (/^\/send(\s|$)/i.test(text)) {
  // только админ
  if (!isAdmin) {
    await sendMessage(fromId, ADMIN_ONLY_REPLY);
    return res.json({ ok: true });
  }
  let targetId = null;
  let amount = null;
  let reason = '';
  // Вариант 1: /send @username 100 комментарий...
  const byUsername = text.match(/^\/send\s+@([A-Za-z0-9_]+)\s+(\d+)(?:\s+(.+))?/i);
  if (byUsername) {
    const uname = byUsername[1];
    amount = Number(byUsername[2]);
    reason = byUsername[3] || '';
    const id = resolveTargetIdOrNull(uname).targetId;
    if (!id) {
      await sendMessage(fromId, `Пользователь @${uname} ещё ни разу не запускал бота.`);
      return res.json({ ok: true });
    }
    targetId = String(id);
  }
  // Вариант 2: ответ на сообщение — /send 100 комментарий...
  else if (msg.reply_to_message && msg.reply_to_message.from) {
    const m = text.match(/^\/send\s+(\d+)(?:\s+(.+))?/i);
    if (!m) {
      await sendMessage(
        fromId,
        'Форматы:\n' +
        '/send @username 100 комментарий...\n' +
        'ИЛИ ответом на сообщение пользователя: /send 100 комментарий...'
      );
      return res.json({ ok: true });
    }
    amount = Number(m[1]);
    reason = m[2] || '';
    targetId = String(msg.reply_to_message.from.id);
  }
  // Ничего не подошло — подсказываем формат
  else {
    await sendMessage(
      fromId,
      'Форматы:\n' +
      '/send @username 100 комментарий...\n' +
      'ИЛИ ответом на сообщение пользователя: /send 100 комментарий...'
    );
    return res.json({ ok: true });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    await sendMessage(fromId, 'Сумма должна быть положительным числом.');
    return res.json({ ok: true });
  }
  ensureUser(targetId);
  add(targetId, amount);
  const newBal = getBalance(targetId);
  // Сообщение пользователю
  let userMsg = `[b]ПОСЛАНИЕ СВЫШЕ:[/b] [c]+[${amount}][/c] ${impulseWord(amount)}.`;
  if (reason) {
    userMsg += `\n\n${reason}`;
  }
  // применяем нашу мини-разметку
  userMsg = applyMiniFormatting(userMsg);
  try {
    await sendMessage(targetId, userMsg, { parse_mode: 'HTML' });
  } catch (e) {
    console.warn('[send] failed to notify user:', e?.message || e);
  }
  // Ответ админу
  await sendMessage(
    fromId,
    `Готово: +${amount} ${impulseWord(amount)} → пользователь (${targetId}).\n` +
    `Новый баланс: ${newBal} ${impulseWord(newBal)}` +
    (reason ? `\nСистема: ${reason}` : '')
  );
  return res.json({ ok: true });
}
// КОМАНДА HELP
if (text === '/help') {
  const html = HELP_HTML();
  await sendMessage(fromId, html, { parse_mode: 'HTML', disable_web_page_preview: true });
  return res.json({ ok:true });
}
if (!firstUnknownShown.has(fromId)) {
  firstUnknownShown.add(fromId);
  await sendMessage(
    fromId,
    FIRST_UNKNOWN_LINE,
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
} else {
  await sendMessage(
    fromId,
    rnd(UNKNOWN_LINES),
    { parse_mode: 'HTML', disable_web_page_preview: true }
  );
}
return res.json({ ok: true });
  } catch (e) {
    console.error('[TG webhook error]', e);
    // Telegram ждёт 200 ОК
    res.sendStatus(200);
  }
});
// 404
// @section FALLBACK_AND_SERVER_START
app.use((req, res) => {
  res.type('text').status(404).send('fallback 404 ' + req.method + ' ' + req.url);
});
// Run
cleanupStaleTmpArtifacts().catch(() => {});
setInterval(() => { cleanupStaleTmpArtifacts().catch(() => {}); }, 6 * 60 * 60 * 1000);
app.listen(PORT, () => console.log(`[BOOT] API listening on ${PORT}`));
