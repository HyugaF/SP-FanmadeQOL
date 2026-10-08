// Contingency Contract (危机合约 / Crisis Simulation) Arknights-style UI components:
//   - RiskTriangles(risk, isSupport): 1–3▲ triangles or 0★ support badge
//   - CrisisBadge({ risk, contracts, onClick }): industrial slanted risk badge for Lobby / Room / HUD
//   - ContractMatrixModal({ open, contracts, readOnly, onToggle, onClear, onPresetMax, onClose }):
//     Full Arknights Contingency Contract Matrix with horizontal category rows, interlocking contract hex/angled tiles,
//     conflict replacement indicators, and right-hand Active Contracts + Crisis Level summary sidebar.

import {
  CONTRACT_CATEGORIES,
  CONTRACTS,
  CONTRACT_BY_ID,
  computeContractRisk,
  toggleContract,
} from '../../../shared/contracts.js';
import { t } from '../../../shared/i18n.js';
import { html, Icon, Button, Modal, MicroLabel } from './components.js';

export {
  CONTRACT_CATEGORIES,
  CONTRACTS,
  CONTRACT_BY_ID,
  computeContractRisk,
  toggleContract,
};

const cx = (...a) => a.filter(Boolean).join(' ');

/** Localized contract title */
export function contractName(c) {
  if (!c) return '';
  return t(c.zhName);
}

/** Localized contract description */
export function contractDesc(c) {
  if (!c) return '';
  return t(c.zhDesc);
}

/** Localized category title */
export function categoryTitle(cat) {
  if (!cat) return '';
  return t(cat.zh);
}

/** Risk tier class for styling (1, 2, 3, support) */
export function riskTierClass(c) {
  if (!c) return 'cc-tier-1';
  if (c.isSupport) return 'cc-tier-support';
  return `cc-tier-${Math.min(3, Math.max(1, c.risk || 1))}`;
}

/** Render Arknights CC risk triangles (▲ / ▲▲ / ▲▲▲) or Support 0 badge */
export function RiskPip({ risk = 1, isSupport = false }) {
  if (isSupport) {
    return html`<span class="cc-pip cc-pip--support" title=${t('支援条约（危机等级归零）')}>
      <span class="cc-pip__tri">▽</span>
      <b class="num">0</b>
    </span>`;
  }
  const n = Math.min(3, Math.max(1, risk));
  return html`<span class=${cx('cc-pip', `cc-pip--r${n}`)}>
    <span class="cc-pip__tris">${'▲'.repeat(n)}</span>
    <b class="num">${n}</b>
  </span>`;
}

/** Compact Crisis Level badge used in Room header, Match HUD, and Result screen */
export function CrisisRiskBadge({ contracts = [], risk = null, onClick = null, size = 'md', showCount = true }) {
  const list = Array.isArray(contracts) ? contracts : [];
  const r = risk != null ? risk : computeContractRisk(list);
  const hasSupport = list.some((id) => CONTRACT_BY_ID.get(id)?.isSupport);
  const tier = hasSupport ? 'support' : r >= 18 ? 'max' : r >= 12 ? 'high' : r >= 6 ? 'mid' : 'low';
  const Tag = onClick ? 'button' : 'div';
  return html`<${Tag}
    type=${onClick ? 'button' : undefined}
    class=${cx('cc-badge', `cc-badge--${size}`, `cc-badge--${tier}`, onClick && 'is-clickable')}
    onClick=${onClick || undefined}
    data-testid="crisis-risk-badge"
    title=${onClick ? t('点击查看或配置危机条约') : t('当前危机等级')}
  >
    <span class="cc-badge__icon" aria-hidden="true">▲</span>
    <span class="cc-badge__meta">
      <span class="cc-badge__label">CRISIS LEVEL</span>
      <span class="cc-badge__row">
        <b class="cc-badge__num num">${r}</b>
        ${showCount ? html`<span class="cc-badge__cnt">${t('{n} 项条约', { n: list.length })}</span>` : null}
      </span>
    </span>
  <//>`;
}

/**
 * Full Arknights Contingency Contract Matrix modal.
 * Left column: Horizontal category rows of contract tiles (with mutex conflict link lines).
 * Right column: Large Risk Level emblem, quick action buttons, and scrollable active contract list.
 */
export function ContractMatrixModal({
  open,
  contracts = [],
  readOnly = false,
  onChange = null,
  onConfirm = null,
  confirmLabel = null,
  onClose,
}) {
  if (!open) return null;
  const activeIds = Array.isArray(contracts) ? contracts : [];
  const activeSet = new Set(activeIds);
  const totalRisk = computeContractRisk(activeIds);
  const hasSupport = activeIds.some((id) => CONTRACT_BY_ID.get(id)?.isSupport);

  // Map mutexGroup -> active contract ID to highlight sibling conflicts
  const activeMutex = new Map();
  for (const id of activeIds) {
    const c = CONTRACT_BY_ID.get(id);
    if (c && c.mutexGroup) activeMutex.set(c.mutexGroup, id);
  }

  const handleToggle = (id) => {
    if (readOnly || !onChange) return;
    onChange(toggleContract(activeIds, id));
  };

  const handleClear = () => {
    if (readOnly || !onChange) return;
    onChange([]);
  };

  const handleMaxRisk = () => {
    if (readOnly || !onChange) return;
    // Select highest risk contract in each non-support mutexGroup
    const bestByGroup = new Map();
    for (const c of CONTRACTS) {
      if (c.isSupport) continue;
      const g = c.mutexGroup || c.id;
      const prev = bestByGroup.get(g);
      if (!prev || (c.risk || 0) >= (prev.risk || 0)) bestByGroup.set(g, c);
    }
    onChange([...bestByGroup.values()].map((c) => c.id));
  };

  const activeContracts = activeIds.map((id) => CONTRACT_BY_ID.get(id)).filter(Boolean);
  const riskTier = hasSupport ? 'support' : totalRisk >= 18 ? 'max' : totalRisk >= 12 ? 'high' : totalRisk >= 6 ? 'mid' : 'low';

  return html`<${Modal}
    open=${open}
    onClose=${onClose}
    title=${t('危机条约矩阵')}
    micro="CONTINGENCY CONTRACT // CRISIS MATRIX"
    class="cc-modal"
    actions=${html`
      <div class="cc-modal__foot-left">
        ${!readOnly ? html`
          <${Button} variant="ghost" size="sm" icon="close" disabled=${activeIds.length === 0} onClick=${handleClear} data-testid="cc-clear-all">
            ${t('清空全部')}
          <//>
          <${Button} variant="secondary" size="sm" icon="bolt" onClick=${handleMaxRisk} data-testid="cc-select-max">
            ${t('满危机预设 (Risk 18+)')}
          <//>
        ` : html`<span class="cc-modal__ro-hint">${t('仅房主可在准备阶段调整危机条约')}</span>`}
      </div>
      ${onConfirm ? html`
        <${Button} variant="secondary" size="sm" onClick=${onClose} data-testid="cc-modal-cancel">
          ${t('返回')}
        <//>
      ` : null}
      <${Button} variant="primary" icon="check" data-autofocus data-testid="cc-modal-confirm" onClick=${onConfirm || onClose}>
        ${confirmLabel || (readOnly ? t('关闭') : t('确认签署'))}
      <//>
    `}
  >
    <div class="cc-matrix" data-testid="cc-matrix">
      <div class="cc-matrix__rows">
        ${CONTRACT_CATEGORIES.map((cat) => {
          const items = CONTRACTS.filter((c) => c.category === cat.id);
          return html`<section key=${cat.id} class="cc-row" data-category=${cat.id}>
            <header class="cc-row__head">
              <div class="cc-row__title">
                <span class="cc-row__bar"></span>
                <h4>${categoryTitle(cat)}</h4>
                <${MicroLabel}>${cat.en}</${MicroLabel}>
              </div>
            </header>
            <div class="cc-row__cards">
              ${items.map((c) => {
                const isOn = activeSet.has(c.id);
                const siblingActiveId = c.mutexGroup ? activeMutex.get(c.mutexGroup) : null;
                const isMutexSibling = !isOn && !!siblingActiveId;
                return html`<button
                  key=${c.id}
                  type="button"
                  disabled=${readOnly}
                  class=${cx(
                    'cc-card',
                    riskTierClass(c),
                    isOn && 'is-on',
                    isMutexSibling && 'is-mutex-dim',
                    readOnly && 'is-readonly',
                  )}
                  data-contract=${c.id}
                  data-testid=${`cc-card-${c.id}`}
                  aria-pressed=${isOn}
                  onClick=${() => handleToggle(c.id)}
                >
                  <div class="cc-card__top">
                    <${RiskPip} risk=${c.risk} isSupport=${!!c.isSupport} />
                    <span class="cc-card__glyph"><${Icon} name=${c.icon || 'warn'} /></span>
                    ${isOn ? html`<span class="cc-card__active-tag">ACTIVE</span>` : null}
                  </div>
                  <div class="cc-card__name">${contractName(c)}</div>
                  <div class="cc-card__desc">${contractDesc(c)}</div>
                </button>`;
              })}
            </div>
          </section>`;
        })}
      </div>

      <aside class=${cx('cc-sidebar', `cc-sidebar--${riskTier}`)}>
        <div class="cc-sidebar__emblem">
          <div class="cc-sidebar__tri" aria-hidden="true">▲</div>
          <div class="cc-sidebar__meta">
            <span class="cc-sidebar__kicker">CRISIS LEVEL // ${t('危机等级')}</span>
            <div class="cc-sidebar__num num" data-testid="cc-total-risk">${totalRisk}</div>
            <span class="cc-sidebar__status">
              ${hasSupport
                ? t('支援条约已启用 · 危机等级锁定为 0')
                : totalRisk >= 18
                  ? t('极境危机 · 最高警戒')
                  : totalRisk > 0
                    ? t('已生效 {n} 项危机条约', { n: activeContracts.length })
                    : t('未签署任何条约（标准终极强度）')}
            </span>
          </div>
        </div>

        <div class="cc-sidebar__list-head">
          <span>${t('已签署条约')}</span>
          <b class="num">${activeContracts.length}</b>
        </div>
        <div class="cc-sidebar__list" data-testid="cc-active-list">
          ${activeContracts.length === 0
            ? html`<div class="cc-sidebar__empty">${t('点击左侧矩阵中的条约卡片以签署或撤销')}</div>`
            : activeContracts.map((c) => html`
                <div key=${c.id} class=${cx('cc-aitem', riskTierClass(c))}>
                  <div class="cc-aitem__head">
                    <${RiskPip} risk=${c.risk} isSupport=${!!c.isSupport} />
                    <b class="cc-aitem__name">${contractName(c)}</b>
                    ${!readOnly ? html`
                      <button
                        type="button"
                        class="cc-aitem__rm"
                        title=${t('撤销此条约')}
                        onClick=${() => handleToggle(c.id)}
                      >×</button>
                    ` : null}
                  </div>
                  <div class="cc-aitem__desc">${contractDesc(c)}</div>
                </div>
              `)}
        </div>
      </aside>
    </div>
  <//>`;
}
