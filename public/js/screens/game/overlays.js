// public/js/screens/game/overlays.js — the match-ended plate, the solo pause plate, and the center-screen speed vote modal.

import { useState } from '../../../vendor/hooks.module.js';
import { Button, Icon, MicroLabel, html, useTicker } from '../../ui/components.js';
import { PlayerAvatar } from '../../ui/gameComponents.js';
import { emptyMatch, serverNow, store } from '../../store.js';
import { localAsset } from '../../data.js';
import { actions } from '../../ui/gameActions.js';
import { t, tParts } from '../../../../shared/i18n.js';

/** The room went back to its lobby without a result (match aborted): offer the way back. */
export function MatchEnded() {
  return html`<div class="awayov" role="dialog" aria-label=${t('模拟已结束')}>
    <div class="awayov__box brackets">
      <${MicroLabel} tone="mint">SIMULATION CLOSED</${MicroLabel}>
      <h2>${t('本局模拟已结束')}</h2>
      <p class="t-lo">${t('同盟已返回等待室')}</p>
      <${Button} variant="primary" size="lg" icon="chevronLeft" onClick=${() => store.set({ match: emptyMatch() })}>${t('返回同盟')}<//>
    </div>
  </div>`;
}

/** Solo pause (m.public.paused): the field dims under the 暂停中 plate; 继续作战 resumes (g.pause off). */
export function PausedOverlay({ canResume, busy, onResume, onExit }) {
  const plate = localAsset('ui/battle', 'matte_pause');
  return html`<div class="pauseov" role="dialog" aria-label=${t('暂停中')} data-testid="paused">
    <div class="pauseov__box">
      <div class="pauseov__plate" style=${plate ? `--pause-plate:url("${plate}")` : ''}>
        <span class="pauseov__micro">PAUSED</span>
        <h2>${t('暂停中')}</h2>
      </div>
      <p class="pauseov__note">${t('作战已暂停，计时与敌人行动均已停止')}</p>
      <div class="pauseov__btns">
        ${onExit ? html`<${Button} variant="secondary" size="lg" icon="exit" onClick=${onExit}>${t('放弃模拟')}<//>` : null}
        ${canResume ? html`<${Button} variant="primary" size="lg" icon="play" loading=${busy} onClick=${onResume} data-autofocus>${t('继续作战')}<//>` : null}
      </div>
    </div>
  </div>`;
}

/**
 * Center-screen tactical voting overlay for changing simulation speed (1× -> 2× AND 2× -> 1×).
 * @param {{ pub: any, myId: string, spectator?: boolean }} props
 */
export function SpeedVoteOverlay({ pub, myId, spectator = false }) {
  const vote = pub?.speedVote;
  const [busy, setBusy] = useState(false);
  useTicker(vote && vote.status === 'pending' ? 200 : 0);
  if (!vote) return null;

  const isPending = vote.status === 'pending';
  const isApproved = vote.status === 'approved';
  const isRejected = vote.status === 'rejected';
  const toFast = vote.targetSpeed >= 2;
  const fromLabel = `${vote.fromSpeed || (toFast ? 1 : 2)}×`;
  const toLabel = `${vote.targetSpeed || (toFast ? 2 : 1)}×`;

  const totalMs = Math.max(1000, (Number(vote.totalSeconds) || 15) * 1000);
  const remainMs = isPending && vote.deadline ? Math.max(0, vote.deadline - serverNow()) : 0;
  const remainSec = Math.ceil(remainMs / 1000);
  const pct = isPending ? Math.max(0, Math.min(100, (remainMs / totalMs) * 100)) : (isApproved ? 100 : 0);

  const players = (Array.isArray(pub?.players) ? pub.players : []).filter((p) => p && p.status !== 'left' && (p.isBot || p.connected !== false));
  const votesMap = vote.votes || {};
  const myVote = myId ? votesMap[myId] : null;
  const yesCount = players.filter((p) => votesMap[p.playerId] === 'yes').length;

  const castVote = async (choice) => {
    if (busy || !isPending || spectator) return;
    setBusy(true);
    await actions.speedVote(choice);
    setBusy(false);
  };

  const titleText = toFast ? t('申请切换至 2× 作战速度') : t('申请恢复至 1× 正常速度');

  return html`<div class=${`svote svote--${vote.status} ${toFast ? 'svote--to2x' : 'svote--to1x'}`} role="dialog" aria-label=${titleText} data-testid="speed-vote-modal">
    <div class="svote__box brackets">
      <div class="svote__head">
        <div class="svote__head-left">
          <${MicroLabel} tone=${isRejected ? 'danger' : isApproved ? 'mint' : 'amber'}>
            ${isApproved ? 'PRTS // PROTOCOL APPROVED' : isRejected ? 'PRTS // PROTOCOL REJECTED' : 'PRTS // SPEED PROTOCOL VOTE'}
          <//>
          <h3 class="svote__title">${titleText}</h3>
        </div>
        ${isPending ? html`<div class="svote__timer num" title=${t('剩余表决时间')}>
          <${Icon} name="clock" /><span>${remainSec}s</span>
        </div>` : null}
      </div>

      <div class="svote__transition">
        <div class=${`svote__pill ${!toFast ? 'is-from-fast' : ''}`}>
          <b class="num">${fromLabel}</b>
          <span>${vote.fromSpeed >= 2 ? t('二倍速') : t('标准速度')}</span>
        </div>
        <div class="svote__arrow" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div class=${`svote__pill svote__pill--target ${toFast ? 'is-fast' : 'is-normal'}`}>
          <b class="num">${toLabel}</b>
          <span>${toFast ? t('二倍速') : t('标准速度')}</span>
        </div>
      </div>

      <p class="svote__desc">
        ${tParts('{name} 发起速度变更提议，需确认后生效（{yes}/{total}）', {
          name: html`<b class="svote__initiator">${vote.initiatorName || t('盟友')}</b>`,
          yes: html`<b class="num">${yesCount}</b>`,
          total: html`<span class="num">${players.length}</span>`,
        })}
      </p>

      <div class="svote__players">
        ${players.map((p) => {
          const st = votesMap[p.playerId] || null;
          const statusCls = st === 'yes' ? 'is-yes' : st === 'no' ? 'is-no' : 'is-wait';
          const statusTxt = st === 'yes' ? t('已同意') : st === 'no' ? t('已拒绝') : t('待表决…');
          return html`<div key=${p.playerId} class=${`svote__pcard ${statusCls} ${p.playerId === myId ? 'is-me' : ''}`}>
            <${PlayerAvatar} seat=${p.seat} name=${p.name} bandId=${p.bandId} isBot=${p.isBot} size="sm" />
            <div class="svote__pinfo">
              <span class="svote__pname">${p.name}${p.isBot ? html`<small class="svote__ai">AI</small>` : null}</span>
              <span class="svote__pstatus">
                ${st === 'yes' ? html`<${Icon} name="check" />` : st === 'no' ? html`<${Icon} name="close" />` : null}
                <span>${statusTxt}</span>
              </span>
            </div>
          </div>`;
        })}
      </div>

      <div class="svote__bar" aria-hidden="true">
        <div class="svote__bar-fill" style=${`width:${pct}%`}></div>
      </div>

      <div class="svote__foot">
        ${isPending && !spectator ? (
          myVote !== 'yes'
            ? html`<div class="svote__btns">
                <${Button} variant="danger" size="md" icon="close" disabled=${busy} onClick=${() => castVote('no')}>
                  ${t('拒绝 ({from}×)', { from: vote.fromSpeed })}
                <//>
                <${Button} variant="primary" size="md" icon="check" loading=${busy} onClick=${() => castVote('yes')} data-autofocus>
                  ${t('同意切换 ({to}×)', { to: vote.targetSpeed })}
                <//>
              </div>`
            : html`<div class="svote__waiting">
                <span class="svote__waiting-txt"><${Icon} name="check" />${t('你已同意，等待其他成员确认…')}</span>
                <${Button} variant="danger" size="sm" icon="close" disabled=${busy} onClick=${() => castVote('no')}>
                  ${t('取消 / 拒绝')}
                <//>
              </div>`
        ) : null}

        ${isApproved ? html`<div class="svote__outcome svote__outcome--ok" role="status">
          <${Icon} name="check" />
          <span>${t('表决通过 · 模拟速度已切换为 {speed}×', { speed: vote.targetSpeed })}</span>
        </div>` : null}

        ${isRejected ? html`<div class="svote__outcome svote__outcome--no" role="status">
          <${Icon} name="close" />
          <span>${vote.resolvedBy
            ? t('{name} 拒绝了提议 · 维持 {speed}× 速度', { name: vote.resolvedBy, speed: vote.fromSpeed })
            : t('表决超时未通过 · 维持 {speed}× 速度', { speed: vote.fromSpeed })}</span>
        </div>` : null}
      </div>
    </div>
  </div>`;
}
