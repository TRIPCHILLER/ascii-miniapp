const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const util = require('util');
const axios = require('axios');
const FormData = require('form-data');
const mime = require('mime-types');

const execFileAsync = util.promisify(execFile);

const TMP_DIR = process.env.TMP_DIR || '/tmp/ascii';
const PHOTO_EXT = process.env.PHOTO_EXT || 'png';
const VIDEO_EXT = process.env.VIDEO_EXT || 'mp4';

const CLI_PHOTO_BIN = process.env.CLI_PHOTO_BIN;
const CLI_PHOTO_ARGS = process.env.CLI_PHOTO_ARGS;
const CLI_VIDEO_BIN = process.env.CLI_VIDEO_BIN;
const CLI_VIDEO_ARGS = process.env.CLI_VIDEO_ARGS;

const BOT_TOKEN = process.env.BOT_TOKEN;
const TG_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// @nav sections:
// @section IMPORTS_AND_RUNTIME_CONFIG
// @section PERSISTENCE_FILES_AND_LOADERS
// @section BALANCE_STATE_API
// @section USERNAME_INDEX_API
// @section LOCAL_HELPERS
// @section CONVERSION_EXECUTION
// @section TELEGRAM_DOCUMENT_UPLOAD_PRIMARY
// @section TELEGRAM_DOCUMENT_UPLOAD_LEGACY_DUPLICATE
// @section VIDEO_PROBE_METADATA
// @section TELEGRAM_VIDEO_UPLOAD
// @section MODULE_EXPORTS

// ==== BOOTSTRAP / CONFIG ====
// @section IMPORTS_AND_RUNTIME_CONFIG

// ==== PERSISTENCE (balances + usernames) ====
// @section PERSISTENCE_FILES_AND_LOADERS
const DATA_DIR = path.join(__dirname, '..', 'data');
const BAL_FILE = path.join(DATA_DIR, 'balances.json');
const UNAME_FILE = path.join(DATA_DIR, 'usernames.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let balances = new Map();
let unameIndex = {};

function loadBalances() {
  try {
    const obj = JSON.parse(fs.readFileSync(BAL_FILE, 'utf-8'));
    balances = new Map(Object.entries(obj));
  } catch { balances = new Map(); }
}
function saveBalances() {
  const obj = Object.fromEntries(balances);
  fs.writeFileSync(BAL_FILE, JSON.stringify(obj, null, 2), 'utf-8');
}
function loadUsernames() {
  try {
    unameIndex = JSON.parse(fs.readFileSync(UNAME_FILE, 'utf-8'));
  } catch { unameIndex = {}; }
}
function saveUsernames() {
  fs.writeFileSync(UNAME_FILE, JSON.stringify(unameIndex, null, 2), 'utf-8');
}

loadBalances();
loadUsernames();

// ==== BALANCE API ====
// @section BALANCE_STATE_API
function ensureUser(userId) {
  const uid = String(userId);
  if (!balances.has(uid)) {
    const isAdmin = uid === String(process.env.ADMIN_TELEGRAM_ID || '');
    balances.set(uid, isAdmin ? 999 : 25); // стартовый баланс
    saveBalances();
  }
}

// проверка, был ли юзер уже в базе
function userExists(userId) {
  const uid = String(userId);
  return balances.has(uid);
}

function getBalance(userId) {
  const uid = String(userId);
  return Number(balances.get(uid) || 0);
}
const getbalance = getBalance; // алиас

function add(userId, amount) {
  const uid = String(userId);
  const cur = getBalance(uid);
  balances.set(uid, cur + Number(amount));
  saveBalances();
}
function deduct(userId, amount) {
  const uid = String(userId);
  const cur = getBalance(uid);
  const next = Math.max(0, cur - Number(amount));
  balances.set(uid, next);
  saveBalances();
  return next;
}

// ==== USERNAME CACHE ====
// @section USERNAME_INDEX_API
function setUsername(userId, username) {
  const u = (username || '').trim();
  if (!u) return;
  if (unameIndex[u] !== String(userId)) {
    unameIndex[u] = String(userId);
    saveUsernames();
  }
}
function findIdByUsername(username) {
  const u = (username || '').replace(/^@/, '');
  return unameIndex[u] || null;
}

// ==== HELPERS ====
// @section LOCAL_HELPERS
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function buildArgs(template, inputPath, outputPath) {
  if (!template.includes('{in}') || !template.includes('{out}')) {
    throw new Error('CLI_ARGS must contain {in} and {out}');
  }
  return template.replaceAll('{in}', inputPath).replaceAll('{out}', outputPath).split(/\s+/);
}

// ==== CONVERT ====
// @section CONVERSION_EXECUTION
async function convertAndSave(assetId, type, inputPath) {
  ensureDir(TMP_DIR);
  ensureDir(path.join(TMP_DIR, 'in'));
  ensureDir(path.join(TMP_DIR, 'out'));

  const isVideo = type === 'video';
  const outExt = isVideo ? VIDEO_EXT : PHOTO_EXT;

  if (!inputPath) {
    inputPath = path.join(TMP_DIR, 'in', 'test.mp4');
  }

  const outPath = path.join(TMP_DIR, 'out', `${assetId}.${outExt}`);
  const bin = isVideo ? CLI_VIDEO_BIN : CLI_PHOTO_BIN;
  const args = buildArgs(isVideo ? CLI_VIDEO_ARGS : CLI_PHOTO_ARGS, inputPath, outPath);

  await execFileAsync(bin, args, { maxBuffer: 1024 * 1024 * 32 });

  if (!fs.existsSync(outPath)) throw new Error(`convertAndSave output not found: ${outPath}`);
  return outPath;
}

// ==== SEND FILE TO TELEGRAM ====
// @section TELEGRAM_DOCUMENT_UPLOAD_PRIMARY
async function sendFileToUser(telegramId, filePath, caption) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is empty');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const url = `${TG_BASE}/sendDocument`;
  const form = new FormData();
  const filename = path.basename(filePath);
  const contentType = mime.lookup(filename) || 'application/octet-stream';

  form.append('chat_id', telegramId);
  form.append('document', fs.createReadStream(filePath), { filename, contentType });
  if (caption) form.append('caption', caption);

  const { data } = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 30000,
  });

  if (!data.ok) throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  return data;
}
// ==== SEND FILE TO TELEGRAM ====
// @section TELEGRAM_DOCUMENT_UPLOAD_LEGACY_DUPLICATE
async function sendFileToUser(telegramId, filePath, caption) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is empty');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const url = `${TG_BASE}/sendDocument`;
  const form = new FormData();
  const filename = path.basename(filePath);
  const contentType = mime.lookup(filename) || 'application/octet-stream';

  form.append('chat_id', telegramId);
  form.append('document', fs.createReadStream(filePath), { filename, contentType });
  if (caption) form.append('caption', caption);

  const { data } = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 30000,
  });

  if (!data.ok) throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  return data;
}

// ==== VIDEO PROBE ====
// @section VIDEO_PROBE_METADATA
async function probeVideo(filePath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-of', 'json',
      // одна опция show_entries сразу для двух секций:
      ' -show_entries', 'stream=width,height:format=duration',
      filePath,
    ], { maxBuffer: 1e6 });

    const meta = JSON.parse(stdout || '{}');
    const width  = meta.streams?.[0]?.width  || undefined;
    const height = meta.streams?.[0]?.height || undefined;
    const duration = Math.round(Number(meta.format?.duration || 0));

    return { width, height, duration };
  } catch {
    return { width: undefined, height: undefined, duration: 0 };
  }
}

// ==== SEND VIDEO TO TELEGRAM ====
// @section TELEGRAM_VIDEO_UPLOAD
async function sendVideoToUser(telegramId, filePath, { caption } = {}) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN is empty');
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const url = `${TG_BASE}/sendVideo`;
  const form = new FormData();

  form.append('chat_id', telegramId);
  if (caption) form.append('caption', caption);
  form.append('supports_streaming', 'true');

  // 🔎 метаданные для Telegram
  const meta = await probeVideo(filePath);
  if (meta.duration) form.append('duration', String(meta.duration));
  if (meta.width)    form.append('width',    String(meta.width));
  if (meta.height)   form.append('height',   String(meta.height));

  form.append('video', fs.createReadStream(filePath));

  const { data } = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    timeout: 120000,             // чуть больше времени на аплоад
  });

  if (!data.ok) throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  return data;
}

// ==== EXPORTS ====
// @section MODULE_EXPORTS
module.exports = {
  ensureUser,
  userExists,
  getBalance,
  getbalance,
  add,
  deduct,
  setUsername,
  findIdByUsername,
  buildArgs,
  convertAndSave,
  sendFileToUser,
  sendVideoToUser,
  probeVideo,
};
