// server/match/match/pause.js — Match methods: the solo pause (g.pause, DESIGN §14 "Solo pause") — freeze, resume
// (every clock and deadline shifted by the pause), the drop at the battle phase's end, and the field clocks' "now".
// Installed on Match.prototype by server/match/Match.js (a method container: never instantiated; `this` is the match).

import { PHASE, ERR } from '../../../shared/constants.js';
import { BOSS_CLOCK_MS, FLOW_TICKER_PRIORITY, OK, fail } from './common.js';
import { msg } from '../../../shared/i18n.js';

export class MatchPause {
  /**
   * Solo pause (official PauseUp / ResumeUp; DESIGN §14 "Solo pause"): g.pause { on } freezes the running battle — the
   * field clock (b.start `elapsed`, the boss budgets and overtime), the result deadline / server release timers, the
   * boss clock, the HUD `deadline` / `overtimeAt` (shifted by the pause on resume) and the server-run pacers
   * (FieldRunner / HeadlessPacer skip their intervals) — and the browser's runner stops its local clock while
   * `m.public.paused` is true. Solo matches only (co-op battles never pause: WRONG_PHASE) and only while a battle runs;
   * `{ on: false }` is always accepted. A disconnect / leave, or the battle phase ending, resumes.
   */
  setPause(ps, on) {
    void ps;
    if (!this.isSolo) return fail(ERR.WRONG_PHASE, 'co-op battles never pause');
    if (!on) { this._resume(); return OK; }
    if (this.paused) return OK;
    const battlePhase = this.phase === PHASE.COMBAT || this.phase === PHASE.FINAL_ASSAULT || this.phase === PHASE.HIDDEN_CORE;
    if (!battlePhase || this._finalEnding || !this.fields.some((f) => f.live && !f.done)) return fail(ERR.WRONG_PHASE, 'no battle running');
    this.paused = true;
    this._pausedAt = this.sched.now();
    for (const f of this.fields) {
      if (!f.cc) continue;
      if (f.deadlineTimer) { this.cancel(f.deadlineTimer); f.deadlineTimer = null; f.rearmDeadline = true; }
      if (f.doneTimer) { this.cancel(f.doneTimer); f.doneTimer = null; f.rearmRelease = true; }
    }
    if (this._bossClock) { this.cancel(this._bossClock); this._bossClock = null; }
    this.markPublic();
    return OK;
  }

  /** End a solo pause: every clock and deadline moves on by the paused time (no-op when not paused). */
  _resume() {
    if (!this.paused) return;
    const d = Math.max(0, this.sched.now() - this._pausedAt);
    this.paused = false;
    this._pausedAt = 0;
    this.pausedMs += d;
    if (this.deadline) this.deadline += d;
    if (this.overtimeAt) this.overtimeAt += d;
    if (this._bossStartAt != null) this._bossStartAt += d;
    for (const f of this.fields) {
      if (!f.cc || f.done) continue;
      f.startAt += d;
      f.lastProgressAt += d;
      if (f.rearmDeadline && f.mode === 'client') this._armDeadline(f);
      if (f.rearmRelease && f.mode === 'server') this._armRelease(f);
      f.rearmDeadline = false;
      f.rearmRelease = false;
    }
    if (this._bossClockOn && !this._bossClock && (this.phase === PHASE.FINAL_ASSAULT || this.phase === PHASE.HIDDEN_CORE)) {
      this._bossClock = this.later(BOSS_CLOCK_MS, () => this._bossClockTick());
    }
    this.markPublic();
  }

  /** The battle phase is over: drop the pause without shifting anything (its timers are gone). */
  _clearPause() {
    if (!this.paused) return;
    this.pausedMs += Math.max(0, this.sched.now() - this._pausedAt);
    this.paused = false;
    this._pausedAt = 0;
    this.markPublic();
  }

  /** The field clocks' "now": frozen at the pause instant while paused. */
  _clockNow() { return this.paused ? this._pausedAt : this.sched.now(); }

  // ---- 1x / 2x Speed Vote (both 1x -> 2x and 2x -> 1x require approval) -------------------------------------

  _clearSpeedVoteTimers() {
    if (!Array.isArray(this._speedVoteTimers)) {
      this._speedVoteTimers = [];
      return;
    }
    for (const h of this._speedVoteTimers) {
      if (h) this.cancel(h);
    }
    this._speedVoteTimers = [];
  }

  _speedVoters() {
    return this.order.filter((p) => !p.left && (p.isBot || p.connected));
  }

  _speedVoteView() {
    const v = this.speedVote;
    if (!v) return null;
    return {
      id: v.id,
      fromSpeed: v.fromSpeed,
      targetSpeed: v.targetSpeed,
      initiatorId: v.initiatorId,
      initiatorName: v.initiatorName,
      startedAt: v.startedAt,
      deadline: v.deadline,
      totalSeconds: v.totalSeconds,
      status: v.status,
      resolvedBy: v.resolvedBy || null,
      votes: { ...v.votes },
    };
  }

  handleSpeedVote(ps, m) {
    if (!ps || ps.isBot || ps.left || ps.spectator) return fail(ERR.SPECTATOR);
    const action = m && m.action;
    if (action === 'propose') {
      if (this.speedVote) return OK;
      const now = this.sched.now();
      if (this.speedVoteCooldownUntil && now < this.speedVoteCooldownUntil) {
        const sec = Math.max(1, Math.ceil((this.speedVoteCooldownUntil - now) / 1000));
        this.toast?.(ps.playerId, msg('速度投票冷却中，请等待 {sec} 秒', { sec }), 'warn');
        return OK;
      }
      const cur = this.speedMult >= 2 ? 2 : 1;
      const req = m.speed === 1 || m.speed === 2 ? m.speed : (cur >= 2 ? 1 : 2);
      const targetSpeed = req === cur ? (cur >= 2 ? 1 : 2) : req;
      this._clearSpeedVoteTimers();
      const voters = this._speedVoters();
      const humanVoters = voters.filter((p) => !p.isBot);
      const votes = {};
      for (const p of voters) {
        // When multiple humans are in the match, the initiator automatically approves and teammates vote;
        // when only 1 human is in the match (Solo or Co-op with AI bots), keep the human's vote pending so
        // the center-screen approval UI stays open for them to confirm or cancel.
        votes[p.playerId] = (humanVoters.length > 1 && p.playerId === ps.playerId) ? 'yes' : null;
      }
      const totalSeconds = 15;
      this.speedVote = {
        id: ++this._speedVoteSeq,
        fromSpeed: cur,
        targetSpeed,
        initiatorId: ps.playerId,
        initiatorName: ps.name,
        startedAt: now,
        deadline: now + this.scaled(totalSeconds * 1000),
        totalSeconds,
        status: 'pending',
        resolvedBy: null,
        votes,
      };
      const bots = voters.filter((p) => p.isBot);
      bots.forEach((bot, idx) => {
        const h = this.later(this.scaled(350 + idx * 280), () => {
          if (!this.speedVote || this.speedVote.status !== 'pending') return;
          this.speedVote.votes[bot.playerId] = 'yes';
          this.markPublic();
          this._checkSpeedVoteResolution();
        });
        if (h) this._speedVoteTimers.push(h);
      });
      const timeoutH = this.later(this.scaled(totalSeconds * 1000), () => {
        if (!this.speedVote || this.speedVote.status !== 'pending') return;
        this._resolveSpeedVote('rejected', null);
      });
      if (timeoutH) this._speedVoteTimers.push(timeoutH);
      this.tickerText(msg('{name}博士发起了 {speed}× 作战速度投票', { name: ps.name, speed: targetSpeed }), FLOW_TICKER_PRIORITY);
      this.markPublic();
      this._checkSpeedVoteResolution();
      return OK;
    }

    if (action === 'yes' || action === 'no') {
      if (!this.speedVote || this.speedVote.status !== 'pending') return OK;
      this.speedVote.votes[ps.playerId] = action;
      if (action === 'no') {
        this._resolveSpeedVote('rejected', ps);
        return OK;
      }
      // If all connected humans have now approved, finalize any remaining AI bot votes immediately
      const voters = this._speedVoters();
      const allHumansYes = voters.filter((p) => !p.isBot).every((p) => this.speedVote.votes[p.playerId] === 'yes');
      if (allHumansYes) {
        for (const p of voters) {
          if (p.isBot) this.speedVote.votes[p.playerId] = 'yes';
        }
      }
      this.markPublic();
      this._checkSpeedVoteResolution();
      return OK;
    }
    return fail(ERR.BAD_MSG);
  }

  _checkSpeedVoteResolution() {
    if (!this.speedVote || this.speedVote.status !== 'pending') return;
    const voters = this._speedVoters();
    for (const p of voters) {
      if (this.speedVote.votes[p.playerId] === 'no') {
        this._resolveSpeedVote('rejected', p);
        return;
      }
    }
    const allYes = voters.length > 0 && voters.every((p) => this.speedVote.votes[p.playerId] === 'yes');
    if (allYes) {
      this._resolveSpeedVote('approved', null);
    }
  }

  _resolveSpeedVote(outcome, byPs = null) {
    if (!this.speedVote || this.speedVote.status !== 'pending') return;
    this._clearSpeedVoteTimers();
    this.speedVote.status = outcome;
    this.speedVote.resolvedBy = byPs ? byPs.name : null;
    const cooldownMs = this.scaled(10000);
    this.speedVoteCooldownUntil = this.sched.now() + cooldownMs;
    if (outcome === 'approved') {
      const target = this.speedVote.targetSpeed;
      this._applySpeedMult(target);
      this.tickerText(msg('全员同意，模拟速度已切换为 {speed}×', { speed: target }), FLOW_TICKER_PRIORITY);
    } else if (byPs) {
      this.tickerText(msg('{name}博士拒绝了速度变更提议', { name: byPs.name }), FLOW_TICKER_PRIORITY);
    } else {
      this.tickerText(msg('速度变更投票超时未通过'), FLOW_TICKER_PRIORITY);
    }
    this.markPublic();
    const clearH = this.later(this.scaled(950), () => {
      this.speedVote = null;
      this.markPublic();
    });
    if (clearH) this._speedVoteTimers.push(clearH);
    const cdH = this.later(cooldownMs, () => {
      this.speedVoteCooldownUntil = 0;
      this.markPublic();
    });
    if (cdH) this._speedVoteTimers.push(cdH);
  }

  _applySpeedMult(nextSpeed) {
    const m = nextSpeed >= 2 ? 2 : 1;
    if (this.speedMult === m) return;
    this.speedMult = m;
    for (const f of this.fields) {
      if (!f || !f.cc || f.done) continue;
      if (f.mode === 'server' && f.result != null) this._armRelease(f);
    }
    this.markPublic();
  }
}
