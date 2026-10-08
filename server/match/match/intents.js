// server/match/match/intents.js — Match methods: the g.* / b.* intent router (_handle: the prep intents go to
// PlayerState, the drafts, watching, the pause and the battle reports to the match), emotes, AI 托管 (setAutoplay,
// kickBot) and g.unitStats (the stats the board's units start their next battle with: a preview battle, started, read
// and dropped).
// Installed on Match.prototype by server/match/Match.js (a method container: never instantiated; `this` is the match).

import { unitStatsEntry } from '../../../shared/protocol.js';
import { PHASE, ERR, EMOTES, EMOTE_COOLDOWN_MS, GEO } from '../../../shared/constants.js';
import { deriveSeed } from '../../sim/rng.js';
import { tileKey, FIELD } from '../board.js';
import { thresholdsOf } from '../bondsMeta.js';
import { OK, fail } from './common.js';

export class MatchIntents {
  _handle(ps, msg) {
    switch (msg.t) {
      case 'g.infoReady':
        if (this.phase !== PHASE.INFO_CHECK) return fail(ERR.WRONG_PHASE);
        if (!ps.infoReady) { ps.infoReady = true; this.markPublic(); this.maybeEndInfo(); }
        return OK;
      case 'g.band': return this.pickBand(ps, msg.bandId);
      case 'g.bandSkip': return this.skipBand(ps);
      // the strategy highlighted in the draft screen (what a timed-out turn takes, timeoutBand)
      case 'g.bandFocus': return this.bandFocus(ps, msg.bandId ?? null);
      case 'g.buy': return ps.buy(msg.slot);
      case 'g.refresh': return ps.refresh();
      case 'g.freeze': return ps.freeze();
      case 'g.levelUp': return ps.levelUp();
      case 'g.sell': return ps.sell(msg.uid);
      // dir: the deploy wheel's facing (DESIGN §3; absent ⇒ PlayerState reads to.dir, then RIGHT)
      case 'g.move': return ps.move(msg.uid, msg.to, msg.dir);
      case 'g.equip': return ps.equip(msg.itemUid, msg.targetUid, msg.replaceUid ?? null);
      case 'g.art': return ps.useArt(msg.itemUid, msg.row, msg.col, msg.dir);
      case 'g.destroy': return ps.destroy(msg.uid);
      case 'g.reward': return ps.pickReward(msg.idx);
      case 'g.choice': return this.pickCard(ps, msg.idx);
      case 'g.ready': return ps.setReady(!!msg.ready);
      case 'g.emote': return this.emote(ps, msg.id);
      // playerId: the player tapped (a shared field names two) — the watch preference (item 56)
      case 'g.watch': return this.watch(ps, msg.fieldId, msg.playerId ?? null);
      case 'g.autoplay': return this.setAutoplay(ps, !!msg.on);
      case 'g.pause': return this.setPause(ps, !!msg.on);
      case 'g.speedVote': return this.handleSpeedVote(ps, msg);
      case 'g.debug': return this.debugCmd(ps, msg);
      // the stats the board's units start their next battle with (the detail card in prep, user playtest #4 item 7)
      case 'g.unitStats': return this.unitStats(ps, msg.seq ?? null);
      case 'g.leave': this.onLeave(ps.playerId); return OK;
      case 'b.progress': return this._onProgress(ps, msg);
      case 'b.result': return this._onResult(ps, msg);
      default: return fail(ERR.BAD_MSG);
    }
  }

  emote(ps, id) {
    if (!EMOTES.includes(id)) return fail(ERR.BAD_MSG, 'unknown emote');
    const now = this.sched.now();
    if (now - ps.lastEmoteAt < EMOTE_COOLDOWN_MS) return fail(ERR.RATE);
    ps.lastEmoteAt = now;
    this.broadcast({ t: 'm.emote', playerId: ps.playerId, id });
    return OK;
  }

  setAutoplay(ps, on) {
    if (ps.autoplay === on) return OK;
    ps.autoplay = on;
    this.markPublic();
    if (on) this.kickBot(ps);
    return OK;
  }

  /** Let the bot act for a (newly) bot-controlled seat in the current phase. */
  kickBot(ps) {
    if (!ps.botControlled || this.ended) return;
    if (this.phase === PHASE.INFO_CHECK && !ps.infoReady) { ps.infoReady = true; this.markPublic(); this.maybeEndInfo(); }
    else if (this.phase === PHASE.BAND_DRAFT && this.draftTurn() === ps.playerId) this.scheduleBandBot();
    else if (this.phase === PHASE.SP_DRAFT && this.spTurn() === ps.playerId) this.scheduleSpBot();
    else if (this.phase === PHASE.PREP && ps.alive && !ps.ready) this.scheduleBotPrep(ps, 0);
  }

  /**
   * g.unitStats { seq? } (user playtest #4 item 7: the detail card showed fixed record stats): the stats every unit of
   * the player's board will fight with at the start of its next battle — equipment, bonds and their layers, 特质, the
   * band and 机变 effects — computed exactly by the shared sim. The player's battle input after the onBattleStart meta
   * handlers (`ev.preview: true`, no enemies — those handlers must not change the match for a preview) builds a Battle
   * of the battle's options that is started (initial deployment + battleStart hooks), read and dropped: it is never
   * stepped, so skills and timed effects do not show. Pushed to the player as `m.unitStats { seq, round, units }`
   * (units: shared/protocol.js unitStatsEntry, board operators and summons by uid); cached per input (a build costs
   * ≈ 0.3–0.7 ms). Prep phases only (ROUND_START, 机变, PREP); a battle's live stats come from the browser's own sim.
   * @param {PlayerState} ps @param {number|null} seq echoed (the client keeps the newest answer)
   */
  unitStats(ps, seq = null) {
    if (!ps.alive) return fail(ERR.ELIMINATED);
    if (this.phase !== PHASE.ROUND_START && this.phase !== PHASE.SP_DRAFT && this.phase !== PHASE.PREP) return fail(ERR.WRONG_PHASE);
    const units = this._unitStatsOf(ps);
    this.sendTo(ps.playerId, { t: 'm.unitStats', seq: Number.isInteger(seq) ? seq : null, round: this.round, units });
    return OK;
  }

  /** The start-of-battle stats of a player's board units (see unitStats); [] when the preview battle cannot be built. */
  _unitStatsOf(ps) {
    const input = ps.battleInput({ side: 'L', colOffset: 0 });
    const ev = { input, kind: 'normal', round: this.round, preview: true };
    this.dispatch(ps, 'onBattleStart', ev);
    const players = [ev.input && typeof ev.input === 'object' ? ev.input : input];
    let key = null;
    try { key = JSON.stringify([this.round, this.stageId, this.battleContent, players]); } catch { key = null; }
    if (!this._unitStatsCache) this._unitStatsCache = new WeakMap(); // PlayerState → { key, units } (the last preview)
    const cached = this._unitStatsCache.get(ps);
    if (key && cached && cached.key === key) return cached.units;
    const units = [];
    // the flags of the battle it previews: a normal round gains IN_BATTLE layers from its start (a <战斗开始时> layer gain
    // raises bond stats at t = 0 there too); the Final Assault / Hidden Core fight without (previewed as a normal field)
    const bossRound = this.round === this.gd.bossRound || this.round === this.gd.hiddenRound;
    const b = this.newBattle({
      seed: deriveSeed(this.seed, `preview:${this.round}:${ps.seat}`), kind: 'normal', modeId: this.modeId, round: this.round,
      stageId: this.stageId, rect: { ...GEO.NORMAL_RECT }, timeLimit: 60, players, spawns: [], routes: this.wave ? this.wave.routes : [],
      sharedBoss: null, flags: { layerGainsEnabled: !bossRound, ...this.gd.dp }, fieldId: `n:${ps.playerId}`, recordEvents: false,
    });
    try {
      if (typeof b.start === 'function') b.start();
      for (const u of Array.isArray(b.allyUnits) ? b.allyUnits : []) {
        if (u && Number.isInteger(u.uid) && (u.kind === 'op' || u.kind === 'token')) units.push(unitStatsEntry(u, u.s));
      }
    } catch (e) { this.reportError('unitStats', e); }
    this._unitStatsCache.set(ps, { key, units });
    return units;
  }

  /** Developer debug panel commands (g.debug). */
  debugCmd(ps, msg) {
    if (!ps || !msg || typeof msg.cmd !== 'string') return fail(ERR.BAD_MSG);
    const cmd = msg.cmd;

    const unbanBond = (bondId) => {
      if (!bondId || !this.gd.bond(bondId)) return;
      if (!(ps._debugUnbannedBonds instanceof Set)) {
        ps._debugUnbannedBonds = new Set();
      }
      ps._debugUnbannedBonds.add(bondId);
    };

    const deployPieceToBoard = (targetId) => {
      const rec = this.gd.chess(targetId);
      if (!rec) return null;
      for (const bId of rec.bonds || []) unbanBond(bId);
      const piece = ps.newPiece('chess', targetId, { poolCopies: 0, dir: 'RIGHT' });
      let placedKey = null;
      for (let r = FIELD.r0; r <= FIELD.r1 && !placedKey; r++) {
        for (let c = FIELD.c0; c <= FIELD.c1; c++) {
          const k = tileKey(r, c);
          if (!ps.board.has(k) && ps._legal(piece, r, c)) {
            placedKey = k;
            break;
          }
        }
      }
      if (!placedKey) {
        for (let r = FIELD.r0; r <= FIELD.r1 && !placedKey; r++) {
          for (let c = FIELD.c0; c <= FIELD.c1; c++) {
            const k = tileKey(r, c);
            if (!ps.board.has(k)) {
              placedKey = k;
              break;
            }
          }
        }
      }
      if (placedKey) {
        if (ps.deployCount >= ps.deployCap) {
          ps.deployCapBonus = (ps.deployCapBonus || 0) + 1;
        }
        ps.board.set(placedKey, piece);
        ps.grantTokensFor(piece);
        return piece;
      }
      return ps.acquireChess(targetId, { source: 'debug', fromPool: false });
    };

    switch (cmd) {
      case 'funds':
      case 'addFunds': {
        const amt = Number(msg.amount) || 0;
        ps.addFunds(amt, { reason: 'debug' });
        break;
      }
      case 'lp': {
        const amt = Number(msg.amount) || 0;
        ps.lp = Math.max(1, ps.lp + Math.trunc(amt));
        ps.dirty();
        this.markPublic();
        break;
      }
      case 'setLp': {
        const lp = Number(msg.lp);
        if (Number.isFinite(lp)) {
          ps.lp = Math.max(1, Math.trunc(lp));
          ps.dirty();
          this.markPublic();
        }
        break;
      }
      case 'shopLevel':
      case 'setShopLevel': {
        const lv = Math.max(1, Math.min(this.gd.maxShopLevel || 6, Math.trunc(Number(msg.level) || 6)));
        ps.shop.level = lv;
        ps.shop.upgradePrice = this.gd.upgradeBase(lv) ?? 0;
        ps.rollShop({ keepFrozen: false });
        ps.dirty();
        this.markPublic();
        break;
      }
      case 'deployCap': {
        const delta = Math.trunc(Number(msg.delta) || 0);
        ps.deployCapBonus = Math.max(-5, (ps.deployCapBonus || 0) + delta);
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'freeRefreshes': {
        const amt = Math.max(0, Math.trunc(Number(msg.amount) || 1));
        ps.shop.freeRefreshes = (ps.shop.freeRefreshes || 0) + amt;
        ps.dirty();
        break;
      }
      case 'rerollShop': {
        ps.rollShop({ keepFrozen: false });
        ps.dirty();
        break;
      }
      case 'setShopLockBond': {
        const bondId = typeof msg.bondId === 'string' && this.gd.bond(msg.bondId) ? msg.bondId : null;
        if (bondId) unbanBond(bondId);
        ps.shop.lockedBond = bondId;
        if (msg.reroll !== false) ps.rollShop({ keepFrozen: false });
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'activateBond': {
        const bondId = typeof msg.bondId === 'string' && this.gd.bond(msg.bondId) ? msg.bondId : null;
        if (!bondId) return fail(ERR.BAD_TARGET);
        unbanBond(bondId);
        const bond = this.gd.bond(bondId);
        const th = thresholdsOf(bond);
        const targetCount = Number.isInteger(msg.count) && msg.count > 0 ? msg.count : (th[th.length - 1] || bond.activeCount || 3);
        ps.bondCountBonus = ps.bondCountBonus || {};
        ps.bondCountBonus[bondId] = targetCount;
        if (Number.isFinite(msg.layers) && msg.layers > 0) {
          ps.layers[bondId] = Math.max(0, Math.min(999, (ps.layers[bondId] || 0) + Math.trunc(msg.layers)));
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'deactivateBond': {
        const bondId = typeof msg.bondId === 'string' ? msg.bondId : null;
        ps.bondCountBonus = ps.bondCountBonus || {};
        if (bondId) {
          delete ps.bondCountBonus[bondId];
        } else {
          ps.bondCountBonus = {};
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'spawnBondOps': {
        const bondId = typeof msg.bondId === 'string' && this.gd.bond(msg.bondId) ? msg.bondId : null;
        if (!bondId) return fail(ERR.BAD_TARGET);
        unbanBond(bondId);
        const bond = this.gd.bond(bondId);
        const rawMembers = Array.isArray(bond.visibleMembers) && bond.visibleMembers.length
          ? bond.visibleMembers
          : (Array.isArray(bond.members) ? bond.members : []);
        const validOps = rawMembers.filter((cid) => {
          const rec = this.gd.chess(cid);
          return rec && !rec.isGolden && !rec.isHidden && !rec.isDiy;
        });
        const maxSpawn = Math.max(1, Math.min(9, Math.trunc(Number(msg.count) || 6)));
        const golden = !!msg.golden;
        const toBoard = msg.deploy !== false;
        for (const cid of validOps.slice(0, maxSpawn)) {
          const targetId = golden ? (this.gd.goldenIdOf(cid) || cid) : cid;
          if (toBoard) {
            deployPieceToBoard(targetId);
          } else {
            ps.acquireChess(targetId, { source: 'debug', fromPool: false });
          }
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'unlockAllBonds': {
        for (const bid of this.gd.bondIds || []) unbanBond(bid);
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'grantChess':
      case 'addChess': {
        const cid = typeof msg.chessId === 'string' ? msg.chessId : null;
        if (!cid || !this.gd.chess(cid)) return fail(ERR.BAD_TARGET);
        const rec = this.gd.chess(cid);
        for (const bId of rec.bonds || []) unbanBond(bId);
        const count = Math.max(1, Math.min(9, Math.trunc(Number(msg.count) || 1)));
        const golden = !!msg.golden;
        const targetId = golden ? (this.gd.goldenIdOf(cid) || cid) : cid;
        for (let i = 0; i < count; i++) {
          const gained = ps.acquireChess(targetId, { source: 'debug', fromPool: false });
          if (!gained) {
            // If hand and temp were completely full, deploy directly to board or overwrite temp[0]
            const fallback = deployPieceToBoard(targetId);
            if (!fallback) {
              ps.temp[0] = ps.newPiece('chess', targetId, { poolCopies: 0 });
            }
          }
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'deployChess': {
        const cid = typeof msg.chessId === 'string' ? msg.chessId : null;
        if (!cid || !this.gd.chess(cid)) return fail(ERR.BAD_TARGET);
        const golden = !!msg.golden;
        const targetId = golden ? (this.gd.goldenIdOf(cid) || cid) : cid;
        deployPieceToBoard(targetId);
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'grantItem':
      case 'addItem': {
        const iid = typeof msg.itemId === 'string' ? msg.itemId : null;
        if (!iid || !this.gd.item(iid)) return fail(ERR.BAD_TARGET);
        const count = Math.max(1, Math.min(9, Math.trunc(Number(msg.count) || 1)));
        const rec = this.gd.item(iid);
        const targetId = msg.golden && rec?.goldenId && this.gd.item(rec.goldenId) ? rec.goldenId : iid;
        for (let i = 0; i < count; i++) {
          const gained = ps.acquireItem(targetId, { source: 'debug' });
          if (!gained) {
            ps.temp[0] = ps.newPiece('item', targetId);
          }
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'promoteBoard': {
        for (const [k, p] of ps.board.entries()) {
          if (!p || p.kind !== 'chess') continue;
          const gid = this.gd.goldenIdOf(p.id);
          if (gid && gid !== p.id && this.gd.chess(gid)) {
            p.id = gid;
          }
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'layers': {
        const bid = typeof msg.bondId === 'string' ? msg.bondId : null;
        const delta = Math.trunc(Number(msg.delta) || 0);
        if (bid && this.gd.bond(bid)) {
          unbanBond(bid);
          ps.layers[bid] = Math.max(0, Math.min(999, (ps.layers[bid] || 0) + delta));
          ps.recompute();
          this.markPublic();
        }
        break;
      }
      case 'allLayers': {
        const amt = Math.trunc(Number(msg.amount) || 0);
        for (const bid of Object.keys(this.data.bonds || {})) {
          if ((ps.bonds[bid] && ps.bonds[bid].active) || (ps.layers[bid] > 0)) {
            ps.layers[bid] = Math.max(0, Math.min(999, (ps.layers[bid] || 0) + amt));
          }
        }
        ps.recompute();
        this.markPublic();
        break;
      }
      case 'toggleEndless': {
        this.endlessMode = !this.endlessMode;
        this.markPublic();
        break;
      }
      case 'setRound':
      case 'skipToRound': {
        const r = Math.max(1, Math.min(999, Math.trunc(Number(msg.round) || 1)));
        if (this.phase === PHASE.PREP || this.phase === PHASE.SP_DRAFT || this.phase === PHASE.ROUND_START) {
          this.startRound(r);
        } else {
          this.round = r;
          this.markPublic();
        }
        break;
      }
      case 'skipPrep': {
        if (this.phase === PHASE.PREP) {
          this.prepDeadline();
        } else if (this.phase === PHASE.INFO_CHECK) {
          this.enterBandDraft();
        } else if (this.phase === PHASE.BAND_DRAFT) {
          this.finishBandDraft(false);
        }
        break;
      }
      default:
        return fail(ERR.BAD_MSG);
    }
    this.flush(true);
    return OK;
  }
}
