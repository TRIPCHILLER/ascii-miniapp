const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'pong_leaderboard.json');
const RUNS_FILE = path.join(DATA_DIR, 'pong_runs.json');

const MIN_DURATION_MS = 2500;
const MAX_PLAYER_SCORE = 999;
const IMPULSES_PER_WIN = 3;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeJsonAtomic(filePath, data) {
  ensureDataDir();
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function readJsonArraySafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readLeaderboard() {
  return readJsonArraySafe(LEADERBOARD_FILE);
}

function writeLeaderboard(players) {
  writeJsonAtomic(LEADERBOARD_FILE, players);
}

function readRuns() {
  return readJsonArraySafe(RUNS_FILE);
}

function writeRuns(runs) {
  writeJsonAtomic(RUNS_FILE, runs);
}

function generateAvatarColors(seedInput) {
  const seed = crypto.createHash('sha256').update(String(seedInput)).digest('hex');
  const fg = `#${seed.slice(0, 6)}`;
  const bg = `#${seed.slice(6, 12)}`;
  return { avatarFg: fg, avatarBg: bg };
}

function formatDefaultName(playerNumber) {
  const suffix = playerNumber >= 1 && playerNumber <= 9 ? `0${playerNumber}` : String(playerNumber);
  return `ЦИФРОВОЙ_СУБЪ3КТ_${suffix}`;
}

function getOrCreatePlayer(userId) {
  const uid = String(userId);
  const players = readLeaderboard();
  let player = players.find((p) => String(p.userId) === uid);
  if (player) return { player, players, created: false };

  const now = new Date().toISOString();
  const maxNum = players.reduce((acc, p) => {
    const n = Number(p?.playerNumber || 0);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  const playerNumber = maxNum + 1;
  const colors = generateAvatarColors(uid || playerNumber);

  player = {
    userId: uid,
    playerNumber,
    displayName: formatDefaultName(playerNumber),
    isCustomName: false,
    avatarFg: colors.avatarFg,
    avatarBg: colors.avatarBg,
    bestScore: 0,
    totalWins: 0,
    totalImpulsesEarned: 0,
    gamesPlayed: 0,
    createdAt: now,
    updatedAt: now,
  };

  players.push(player);
  writeLeaderboard(players);
  return { player, players, created: true };
}

function createRun(userId) {
  const uid = String(userId);
  const runs = readRuns();
  const startedAt = new Date().toISOString();
  const run = {
    runId: `run_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`,
    userId: uid,
    startedAt,
    finishedAt: null,
    durationMs: null,
    playerScore: null,
    botScore: null,
    impulsesAwarded: 0,
    accepted: false,
    rejectReason: null,
  };
  runs.push(run);
  writeRuns(runs);
  return run;
}

function validateFinishResult({ run, userId, playerScore, botScore }) {
  if (!run) return { ok: false, reason: 'run_not_found' };
  if (String(run.userId) !== String(userId)) return { ok: false, reason: 'run_user_mismatch' };
  if (run.finishedAt) return { ok: false, reason: 'run_already_finished' };
  if (!Number.isInteger(playerScore) || playerScore < 0 || playerScore > MAX_PLAYER_SCORE) return { ok: false, reason: 'invalid_player_score' };
  if (botScore !== 3) return { ok: false, reason: 'invalid_bot_score' };

  const startedTs = Date.parse(run.startedAt);
  if (!Number.isFinite(startedTs)) return { ok: false, reason: 'invalid_run_started_at' };
  const durationMs = Date.now() - startedTs;
  if (durationMs < 0) return { ok: false, reason: 'invalid_duration' };
  if (playerScore >= 20 && durationMs < MIN_DURATION_MS) return { ok: false, reason: 'duration_too_short_for_score' };

  return { ok: true, durationMs };
}

function calculateImpulses(playerScore) {
  return playerScore >= 3 ? IMPULSES_PER_WIN : 0;
}

module.exports = {
  LEADERBOARD_FILE,
  RUNS_FILE,
  readLeaderboard,
  writeLeaderboard,
  readRuns,
  writeRuns,
  getOrCreatePlayer,
  createRun,
  validateFinishResult,
  calculateImpulses,
};
