const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pong-econ-test-'));
process.env.DATA_DIR = path.join(tmpRoot, 'data');

const originalLoad = Module._load;
let sendShouldFail = false;
Module._load = function patched(request, parent, isMain) {
  if (request === 'axios') return { post: async () => { if (sendShouldFail) throw new Error('mock_send_failed'); return { data: { ok: true } }; } };
  if (request === 'form-data') return class FormDataMock {};
  if (request === 'mime-types') return { lookup: () => 'application/octet-stream' };
  return originalLoad(request, parent, isMain);
};

const { ensureUser, getBalance, add } = require('./store');
const { createRun, readRuns, writeRuns, validateFinishResult, calculateImpulses } = require('./pongStore');

async function finishRun({ userId, runId, playerScore, botScore }) {
  if (!runId) return { status: 400, json: { ok: false, error: 'run_id_required' } };
  const runs = readRuns();
  const idx = runs.findIndex((r) => String(r.runId) === String(runId));
  const run = idx >= 0 ? runs[idx] : null;
  if (run?.finishedAt && run?.accepted && String(run.userId) === String(userId)) {
    return {
      status: 200,
      json: {
        ok: true,
        success: true,
        duplicate: true,
        impulsesEarned: Math.max(0, Number(run.impulsesAwarded || 0)),
        impulseBalance: getBalance(userId),
        messageSent: false,
        consolationBonus: !!run.consolationBonus,
      }
    };
  }
  const verdict = validateFinishResult({ run, userId, playerScore, botScore });
  if (!verdict.ok) return { status: 400, json: { ok: false, error: verdict.reason } };
  const winsInRun = Math.max(0, Number(playerScore) || 0);
  const consolationBonus = winsInRun <= 0;
  const impulsesAwarded = consolationBonus ? 1 : calculateImpulses(winsInRun);
  run.finishedAt = new Date().toISOString();
  run.durationMs = verdict.durationMs;
  run.playerScore = playerScore;
  run.botScore = botScore;
  run.impulsesAwarded = impulsesAwarded;
  run.consolationBonus = consolationBonus;
  run.accepted = true;
  runs[idx] = run;
  writeRuns(runs);
  if (impulsesAwarded > 0) add(userId, impulsesAwarded);
  let messageSent = false;
  try {
    await Module._load('axios').post('https://api.telegram.org/botX/sendMessage', {});
    messageSent = !sendShouldFail;
  } catch {}
  return { status: 200, json: { ok: true, success: true, impulsesEarned: impulsesAwarded, impulseBalance: getBalance(userId), messageSent, consolationBonus, duplicate: false } };
}

test('Pong economy smoke', async () => {
  const user1 = 'u1'; ensureUser(user1);
  const b1 = getBalance(user1);
  const noRun = await finishRun({ userId: user1, playerScore: 3, botScore: 3 });
  assert.equal(noRun.status, 400); assert.equal(noRun.json.error, 'run_id_required'); assert.equal(getBalance(user1), b1);

  const user2 = 'u2'; ensureUser(user2);
  const b2 = getBalance(user2); const run2 = createRun(user2);
  const fin2 = await finishRun({ userId: user2, runId: run2.runId, playerScore: 3, botScore: 3 });
  assert.equal(fin2.status, 200); assert.equal(fin2.json.impulsesEarned, 3); assert.equal(getBalance(user2), b2 + 3);

  const b2d = getBalance(user2);
  const dup = await finishRun({ userId: user2, runId: run2.runId, playerScore: 3, botScore: 3 });
  assert.equal(dup.json.duplicate, true); assert.equal(dup.json.messageSent, false); assert.equal(getBalance(user2), b2d);

  const user3 = 'u3'; ensureUser(user3);
  const b3 = getBalance(user3); const run3 = createRun(user3);
  const fin3 = await finishRun({ userId: user3, runId: run3.runId, playerScore: 0, botScore: 3 });
  assert.equal(fin3.status, 200); assert.equal(fin3.json.impulsesEarned, 1); assert.equal(fin3.json.consolationBonus, true); assert.equal(getBalance(user3), b3 + 1);
  const b3d = getBalance(user3);
  const dup3 = await finishRun({ userId: user3, runId: run3.runId, playerScore: 0, botScore: 3 });
  assert.equal(dup3.status, 200); assert.equal(dup3.json.duplicate, true); assert.equal(dup3.json.consolationBonus, true); assert.equal(getBalance(user3), b3d);

  const user4 = 'u4'; ensureUser(user4);
  const b4 = getBalance(user4); const run4 = createRun(user4);
  sendShouldFail = true;
  const fin4 = await finishRun({ userId: user4, runId: run4.runId, playerScore: 2, botScore: 3 });
  assert.equal(fin4.status, 200); assert.equal(fin4.json.messageSent, false); assert.equal(fin4.json.consolationBonus, false); assert.equal(getBalance(user4), b4 + 2);

  Module._load = originalLoad;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
