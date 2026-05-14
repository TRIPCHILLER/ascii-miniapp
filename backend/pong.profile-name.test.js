const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function loadStoreWithTempDataDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pong-profile-'));
  const prevDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = tempDir;
  const modulePath = require.resolve('./pongStore');
  delete require.cache[modulePath];
  const store = require('./pongStore');
  return {
    store,
    tempDir,
    restore() {
      if (prevDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = prevDataDir;
      delete require.cache[modulePath];
    }
  };
}

test('имя игрока перезаписывается в существующей записи без создания дублей userId', () => {
  const ctx = loadStoreWithTempDataDir();
  const { store } = ctx;
  try {
    const { players, player } = store.getOrCreatePlayer('101');
    player.displayName = 'TESTER';
    player.isCustomName = true;
    store.writeLeaderboard(players);

    const { players: samePlayers, player: samePlayer } = store.getOrCreatePlayer('101');
    samePlayer.displayName = 'TESTER2';
    samePlayer.isCustomName = true;
    store.writeLeaderboard(samePlayers);

    const leaderboard = store.readLeaderboard();
    assert.equal(leaderboard.length, 1);
    assert.equal(String(leaderboard[0].userId), '101');
    assert.equal(leaderboard[0].displayName, 'TESTER2');
    assert.equal(leaderboard[0].isCustomName, true);
  } finally {
    ctx.restore();
  }
});

test('пустое имя сбрасывает custom-name и сохраняет только текущее состояние', () => {
  const ctx = loadStoreWithTempDataDir();
  const { store } = ctx;
  try {
    const { players, player } = store.getOrCreatePlayer('102');
    player.displayName = 'ABC';
    player.isCustomName = true;
    store.writeLeaderboard(players);

    const { players: updatedPlayers, player: updatedPlayer } = store.getOrCreatePlayer('102');
    updatedPlayer.displayName = '';
    updatedPlayer.isCustomName = false;
    store.writeLeaderboard(updatedPlayers);

    const leaderboard = store.readLeaderboard();
    assert.equal(leaderboard.length, 1);
    assert.equal(leaderboard[0].displayName, '');
    assert.equal(leaderboard[0].isCustomName, false);
  } finally {
    ctx.restore();
  }
});

test('getOrCreatePlayer merge-ит legacy-дубли по userId без потери важных полей', () => {
  const ctx = loadStoreWithTempDataDir();
  const { store, tempDir } = ctx;
  try {
    const now = new Date().toISOString();
    const olderUpdated = new Date(Date.now() - 60_000).toISOString();
    const oldestCreated = new Date(Date.now() - 120_000).toISOString();
    const filePath = path.join(tempDir, 'pong_leaderboard.json');
    fs.writeFileSync(filePath, JSON.stringify([
      {
        userId: '103',
        playerNumber: 7,
        displayName: 'OLD_NICK',
        isCustomName: true,
        bestScore: 50,
        totalWins: 10,
        totalImpulsesEarned: 13,
        gamesPlayed: 15,
        avatarRendered: 'data:image/png;base64,oldRendered',
        avatarSource: 'data:image/png;base64,oldSource',
        avatarFg: '#111111',
        avatarBg: '#222222',
        updatedAt: olderUpdated,
        createdAt: oldestCreated
      },
      {
        userId: '103',
        playerNumber: 42,
        displayName: 'NEW_NICK',
        isCustomName: true,
        bestScore: 20,
        totalWins: 3,
        totalImpulsesEarned: 5,
        gamesPlayed: 7,
        avatarRendered: '',
        avatarSource: '',
        avatarFg: '#abcdef',
        avatarBg: '#123456',
        updatedAt: now,
        createdAt: olderUpdated
      }
    ], null, 2));

    const { players, player } = store.getOrCreatePlayer('103');
    assert.equal(player.displayName, 'NEW_NICK');
    assert.equal(players.length, 1);
    assert.equal(String(players[0].userId), '103');
    assert.equal(player.playerNumber, 7);
    assert.equal(player.bestScore, 50);
    assert.equal(player.totalWins, 10);
    assert.equal(player.totalImpulsesEarned, 13);
    assert.equal(player.gamesPlayed, 15);
    assert.equal(player.avatarFg, '#abcdef');
    assert.equal(player.avatarBg, '#123456');
    assert.equal(player.avatarRendered, 'data:image/png;base64,oldRendered');
    assert.equal(player.avatarSource, 'data:image/png;base64,oldSource');
    assert.equal(player.createdAt, oldestCreated);
    assert.equal(player.updatedAt, now);

    const afterRead = store.readLeaderboard().filter((p) => String(p.userId) === '103');
    assert.equal(afterRead.length, 1);
  } finally {
    ctx.restore();
  }
});
