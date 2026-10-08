import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE } from '../../shared/constants.js';
import { makeMatch, give, chessOfTier } from './harness.js';

test('speed vote: solo match toggles 2x speed immediately', () => {
  const h = makeMatch({ mode: 'solo', humans: 1, bots: 0, seed: 101, fake: true, instant: false }).start();
  const m = h.m;
  h.toPrep(1);

  assert.equal(m.speedMultiplier, 1);
  assert.equal(m.gameSpeed, 2);
  let pub = m.publicView();
  assert.equal(pub.speedMultiplier, 1);
  assert.deepEqual(pub.speedVotes, { yes: 0, total: 1, active: false, voted: [] });

  // Player votes ON
  const r1 = m.handle('p_0', { t: 'g.speedVote', on: true });
  assert.deepEqual(r1, { ok: true });
  assert.equal(m.speedMultiplier, 2);
  assert.equal(m.gameSpeed, 4);

  pub = m.publicView();
  assert.equal(pub.speedMultiplier, 2);
  assert.deepEqual(pub.speedVotes, { yes: 1, total: 1, active: true, voted: ['p_0'] });

  // Player votes OFF
  const r2 = m.handle('p_0', { t: 'g.speedVote', on: false });
  assert.deepEqual(r2, { ok: true });
  assert.equal(m.speedMultiplier, 1);
  assert.equal(m.gameSpeed, 2);

  pub = m.publicView();
  assert.equal(pub.speedMultiplier, 1);
  assert.deepEqual(pub.speedVotes, { yes: 0, total: 1, active: false, voted: [] });
});

test('speed vote: co-op requires all active human players to vote yes', () => {
  const h = makeMatch({ mode: 'coop', humans: 2, bots: 1, seed: 102, fake: true, instant: false }).start();
  const m = h.m;
  h.toPrep(1);

  assert.equal(m.speedMultiplier, 1);
  assert.equal(m.eligibleVotingPlayers().length, 2, 'bot does not count as human voter');

  // Player 0 votes YES
  m.handle('p_0', { t: 'g.speedVote', on: true });
  assert.equal(m.speedMultiplier, 1, '1/2 votes does not activate 2x yet');
  let pub = m.publicView();
  assert.deepEqual(pub.speedVotes, { yes: 1, total: 2, active: false, voted: ['p_0'] });

  // Player 1 votes YES
  m.handle('p_1', { t: 'g.speedVote', on: true });
  assert.equal(m.speedMultiplier, 2, '2/2 votes activates 2x speed');
  assert.equal(m.gameSpeed, 4);
  pub = m.publicView();
  assert.equal(pub.speedVotes.active, true);
  assert.equal(pub.speedVotes.yes, 2);

  // Player 0 cancels vote
  m.handle('p_0', { t: 'g.speedVote', on: false });
  assert.equal(m.speedMultiplier, 1, 'falls back to 1x when any player opts out');
  assert.equal(m.gameSpeed, 2);
  pub = m.publicView();
  assert.equal(pub.speedVotes.active, false);
  assert.equal(pub.speedVotes.yes, 1);
});

test('speed vote: disconnect/reconnect updates voting threshold dynamically', () => {
  const h = makeMatch({ mode: 'coop', humans: 2, bots: 0, seed: 103, fake: true, instant: false }).start();
  const m = h.m;
  h.toPrep(1);

  // Player 0 votes YES
  m.handle('p_0', { t: 'g.speedVote', on: true });
  assert.equal(m.speedMultiplier, 1);

  // Player 1 disconnects -> remaining active player count is 1, so p_0 represents 100%
  m.onDisconnect('p_1');
  assert.equal(m.speedMultiplier, 2, 'becomes 2x because all connected players (p_0) voted yes');
  let pub = m.publicView();
  assert.equal(pub.speedVotes.total, 1);
  assert.equal(pub.speedVotes.yes, 1);
  assert.equal(pub.speedVotes.active, true);

  // Player 1 reconnects -> active count becomes 2 again, p_1 has not voted
  m.onReconnect('p_1');
  assert.equal(m.speedMultiplier, 1, 'reverts to 1x because p_1 has reconnected and not yet agreed');
  pub = m.publicView();
  assert.equal(pub.speedVotes.total, 2);
  assert.equal(pub.speedVotes.yes, 1);
  assert.equal(pub.speedVotes.active, false);

  // Player 1 also votes YES
  m.handle('p_1', { t: 'g.speedVote', on: true });
  assert.equal(m.speedMultiplier, 2);
  assert.equal(m.publicView().speedVotes.active, true);
});

test('speed vote: dynamic speed switch during combat adjusts deadlines and fields seamlessly', () => {
  const h = makeMatch({ mode: 'solo', humans: 1, bots: 0, seed: 104, fake: true, instant: false, script: () => ({ duration: 10 }) }).start();
  const m = h.m;
  h.toPrep(1);

  const a = h.ps('p_0');
  const id = chessOfTier(1, (c) => c.position === 'RANGED').find((x) => m.pool.has(x));
  const piece = give(m, a, id);
  const tile = [...a.deployMap()].find(([, v]) => v)[0].split(',').map(Number);
  m.handle('p_0', { t: 'g.move', uid: piece.uid, to: { area: 'board', row: tile[0], col: tile[1] } });
  m.handle('p_0', { t: 'g.ready', ready: true });

  h.run(() => m.phase === PHASE.COMBAT);
  assert.equal(m.phase, PHASE.COMBAT);
  assert.equal(m.gameSpeed, 2);
  const initialDeadline = m.deadline;
  assert.ok(initialDeadline > m.sched.now());

  // Advance time by 2 seconds in combat at 1x speed (2 game seconds per real second)
  h.sched.advance(2000);

  // Now vote for 2x speed
  m.handle('p_0', { t: 'g.speedVote', on: true });
  assert.equal(m.gameSpeed, 4);

  // The remaining deadline should be shorter because speed doubled
  assert.ok(m.deadline < initialDeadline, 'deadline moved earlier because game is running 2x faster');
  const f = m.fields[0];
  assert.equal(f.speed, 4);
});
