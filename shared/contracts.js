// Contingency Contract (危机模拟 / Crisis Simulation) contract definitions, conflict resolution,
// risk calculation, and modifier aggregation.
// Pure module shared by client (public/js) and server (server/lobby, server/match, server/sim).

import { N_ } from './i18n.js';

export const MAX_CONTRACTS = 18;

/**
 * Contract categories displayed as horizontal rows in the Arknights-style Contract Matrix.
 * Order here defines the visual row order in the Crisis Contract Matrix panel.
 */
export const CONTRACT_CATEGORIES = Object.freeze([
  { id: 'objective', zh: N_('目标与环境'), en: 'OBJECTIVE // ENVIRONMENT' },
  { id: 'enemy_vital', zh: N_('敌方强化 · 生存'), en: 'HOSTILE // VITALITY & ARMOR' },
  { id: 'enemy_offense', zh: N_('敌方强化 · 攻势'), en: 'HOSTILE // OFFENSE & MOBILITY' },
  { id: 'logistics', zh: N_('后勤与调度限制'), en: 'LOGISTICS // DISPATCH & FUNDS' },
  { id: 'command', zh: N_('战术与编制限制'), en: 'COMMAND // SQUAD & STATS' },
  { id: 'support', zh: N_('支援条约（演训）'), en: 'SUPPORT // ASSISTED PROTOCOL' },
]);

/**
 * Full catalog of Contingency Contracts.
 * Mutual exclusivity is enforced via `mutexGroup`: selecting a contract automatically
 * deselects any other contract sharing the same non-null `mutexGroup`.
 */
export const CONTRACTS = Object.freeze([
  // Row 1 — Objective & Environment
  {
    id: 'cc_seal_1',
    category: 'objective',
    mutexGroup: 'seal',
    risk: 2,
    zhName: N_('防线告急 II'),
    enName: 'Critical Perimeter II',
    zhDesc: N_('初始目标生命值降低至 10'),
    enDesc: 'Initial Protection Objective LP is reduced to 10',
    icon: 'hp',
    mods: { maxLifeOverride: 10 },
  },
  {
    id: 'cc_seal_2',
    category: 'objective',
    mutexGroup: 'seal',
    risk: 3,
    zhName: N_('防线告急 III'),
    enName: 'Zero Tolerance III',
    zhDesc: N_('初始目标生命值降低至 1（任何突破即告失败）'),
    enDesc: 'Initial Protection Objective LP is reduced to 1',
    icon: 'hp',
    mods: { maxLifeOverride: 1 },
  },
  {
    id: 'cc_ban_bonds_1',
    category: 'objective',
    mutexGroup: 'ban_bonds',
    risk: 1,
    zhName: N_('盟约封锁 I'),
    enName: 'Alliance Embargo I',
    zhDesc: N_('本局额外随机禁用 1 个核心盟约'),
    enDesc: '1 additional Core Alliance is randomly disabled this match',
    icon: 'lock',
    mods: { extraDisabledBonds: 1 },
  },
  {
    id: 'cc_ban_bonds_2',
    category: 'objective',
    mutexGroup: 'ban_bonds',
    risk: 2,
    zhName: N_('盟约封锁 II'),
    enName: 'Alliance Embargo II',
    zhDesc: N_('本局额外随机禁用 2 个核心盟约'),
    enDesc: '2 additional Core Alliances are randomly disabled this match',
    icon: 'lock',
    mods: { extraDisabledBonds: 2 },
  },

  // Row 2 — Enemy Vitality & Armor
  {
    id: 'cc_ehp_1',
    category: 'enemy_vital',
    mutexGroup: 'ehp',
    risk: 1,
    zhName: N_('源石活化 I'),
    enName: 'Originium Surge I',
    zhDesc: N_('所有敌方单位最大生命值 +30%'),
    enDesc: 'All enemy units gain +30% Max HP',
    icon: 'skull',
    mods: { enemyHpMul: 1.3 },
  },
  {
    id: 'cc_ehp_2',
    category: 'enemy_vital',
    mutexGroup: 'ehp',
    risk: 2,
    zhName: N_('源石活化 II'),
    enName: 'Originium Surge II',
    zhDesc: N_('所有敌方单位最大生命值 +65%'),
    enDesc: 'All enemy units gain +65% Max HP',
    icon: 'skull',
    mods: { enemyHpMul: 1.65 },
  },
  {
    id: 'cc_ehp_3',
    category: 'enemy_vital',
    mutexGroup: 'ehp',
    risk: 3,
    zhName: N_('源石活化 III'),
    enName: 'Originium Surge III',
    zhDesc: N_('所有敌方单位最大生命值 +110%'),
    enDesc: 'All enemy units gain +110% Max HP',
    icon: 'skull',
    mods: { enemyHpMul: 2.1 },
  },
  {
    id: 'cc_edef_1',
    category: 'enemy_vital',
    mutexGroup: 'edef',
    risk: 1,
    zhName: N_('重装披挂 I'),
    enName: 'Reinforced Plating I',
    zhDesc: N_('所有敌方单位防御力 +35%，法术抗性 +20%'),
    enDesc: 'All enemies gain +35% DEF and +20% RES',
    icon: 'shield',
    mods: { enemyDefMul: 1.35, enemyResMul: 1.2 },
  },
  {
    id: 'cc_edef_2',
    category: 'enemy_vital',
    mutexGroup: 'edef',
    risk: 2,
    zhName: N_('重装披挂 II'),
    enName: 'Reinforced Plating II',
    zhDesc: N_('所有敌方单位防御力 +75%，法术抗性 +40%'),
    enDesc: 'All enemies gain +75% DEF and +40% RES',
    icon: 'shield',
    mods: { enemyDefMul: 1.75, enemyResMul: 1.4 },
  },

  // Row 3 — Enemy Offense & Mobility
  {
    id: 'cc_eatk_1',
    category: 'enemy_offense',
    mutexGroup: 'eatk',
    risk: 1,
    zhName: N_('狂暴攻势 I'),
    enName: 'Frenzied Assault I',
    zhDesc: N_('所有敌方单位攻击力 +25%'),
    enDesc: 'All enemy units gain +25% ATK',
    icon: 'swords',
    mods: { enemyAtkMul: 1.25 },
  },
  {
    id: 'cc_eatk_2',
    category: 'enemy_offense',
    mutexGroup: 'eatk',
    risk: 2,
    zhName: N_('狂暴攻势 II'),
    enName: 'Frenzied Assault II',
    zhDesc: N_('所有敌方单位攻击力 +55%'),
    enDesc: 'All enemy units gain +55% ATK',
    icon: 'swords',
    mods: { enemyAtkMul: 1.55 },
  },
  {
    id: 'cc_eatk_3',
    category: 'enemy_offense',
    mutexGroup: 'eatk',
    risk: 3,
    zhName: N_('狂暴攻势 III'),
    enName: 'Frenzied Assault III',
    zhDesc: N_('所有敌方单位攻击力 +90%'),
    enDesc: 'All enemy units gain +90% ATK',
    icon: 'swords',
    mods: { enemyAtkMul: 1.9 },
  },
  {
    id: 'cc_espd_1',
    category: 'enemy_offense',
    mutexGroup: 'espd',
    risk: 1,
    zhName: N_('迅捷突进 I'),
    enName: 'Rapid Advance I',
    zhDesc: N_('所有敌方单位移动速度 +25%'),
    enDesc: 'All enemy units gain +25% Movement Speed',
    icon: 'bolt',
    mods: { enemySpeedMul: 1.25 },
  },
  {
    id: 'cc_espd_2',
    category: 'enemy_offense',
    mutexGroup: 'espd',
    risk: 2,
    zhName: N_('迅捷突进 II'),
    enName: 'Rapid Advance II',
    zhDesc: N_('所有敌方单位移动速度 +50%'),
    enDesc: 'All enemy units gain +50% Movement Speed',
    icon: 'bolt',
    mods: { enemySpeedMul: 1.5 },
  },

  // Row 4 — Logistics & Dispatch Restrictions
  {
    id: 'cc_funds_1',
    category: 'logistics',
    mutexGroup: 'funds',
    risk: 2,
    zhName: N_('预算紧缩 II'),
    enName: 'Austerity Budget II',
    zhDesc: N_('每回合基础补给资金减少 2（最低保留 2 资金）'),
    enDesc: 'Round base Funds supply reduced by 2 (min 2 Funds)',
    icon: 'coin',
    mods: { roundFundsDelta: -2 },
  },
  {
    id: 'cc_funds_2',
    category: 'logistics',
    mutexGroup: 'funds',
    risk: 3,
    zhName: N_('预算紧缩 III'),
    enName: 'Austerity Budget III',
    zhDesc: N_('每回合基础补给资金减少 4（最低保留 2 资金）'),
    enDesc: 'Round base Funds supply reduced by 4 (min 2 Funds)',
    icon: 'coin',
    mods: { roundFundsDelta: -4 },
  },
  {
    id: 'cc_shop_1',
    category: 'logistics',
    mutexGroup: 'shop_slots',
    risk: 2,
    zhName: N_('补给受限 II'),
    enName: 'Supply Bottleneck II',
    zhDesc: N_('调度中心每次刷新展示的槽位减少 1 个'),
    enDesc: 'Dispatch Center shop displays 1 fewer slot per refresh',
    icon: 'refresh',
    mods: { shopSlotDelta: -1 },
  },
  {
    id: 'cc_shop_2',
    category: 'logistics',
    mutexGroup: 'shop_slots',
    risk: 3,
    zhName: N_('补给受限 III'),
    enName: 'Supply Bottleneck III',
    zhDesc: N_('调度中心每次刷新展示的槽位减少 2 个'),
    enDesc: 'Dispatch Center shop displays 2 fewer slots per refresh',
    icon: 'refresh',
    mods: { shopSlotDelta: -2 },
  },
  {
    id: 'cc_upgrade_cost',
    category: 'logistics',
    mutexGroup: 'upgrade_cost',
    risk: 2,
    zhName: N_('扩建阻滞 II'),
    enName: 'Expansion Tariff II',
    zhDesc: N_('升级调度中心所需初始资金 +4'),
    enDesc: 'Upgrading the Dispatch Center costs +4 additional Funds',
    icon: 'up',
    mods: { levelCostDelta: 4 },
  },

  // Row 5 — Command & Squad Restrictions
  {
    id: 'cc_deploy_1',
    category: 'command',
    mutexGroup: 'deploy_cap',
    risk: 2,
    zhName: N_('编制压缩 II'),
    enName: 'Squad Downsizing II',
    zhDesc: N_('战场可部署角色上限 -1（最低为 1）'),
    enDesc: 'Maximum deployable unit limit on the battlefield -1 (min 1)',
    icon: 'user',
    mods: { deployCapDelta: -1 },
  },
  {
    id: 'cc_deploy_2',
    category: 'command',
    mutexGroup: 'deploy_cap',
    risk: 3,
    zhName: N_('编制压缩 III'),
    enName: 'Squad Downsizing III',
    zhDesc: N_('战场可部署角色上限 -2（最低为 1）'),
    enDesc: 'Maximum deployable unit limit on the battlefield -2 (min 1)',
    icon: 'user',
    mods: { deployCapDelta: -2 },
  },
  {
    id: 'cc_fatigue_1',
    category: 'command',
    mutexGroup: 'fatigue',
    risk: 1,
    zhName: N_('侵蚀干扰 I'),
    enName: 'Originium Interference I',
    zhDesc: N_('我方全体单位攻击力 -15%，最大生命值 -15%'),
    enDesc: 'All friendly units suffer -15% ATK and -15% Max HP',
    icon: 'warn',
    mods: { allyAtkMul: 0.85, allyHpMul: 0.85 },
  },
  {
    id: 'cc_fatigue_2',
    category: 'command',
    mutexGroup: 'fatigue',
    risk: 2,
    zhName: N_('侵蚀干扰 II'),
    enName: 'Originium Interference II',
    zhDesc: N_('我方全体单位攻击力 -25%，最大生命值 -25%'),
    enDesc: 'All friendly units suffer -25% ATK and -25% Max HP',
    icon: 'warn',
    mods: { allyAtkMul: 0.75, allyHpMul: 0.75 },
  },
  {
    id: 'cc_fatigue_3',
    category: 'command',
    mutexGroup: 'fatigue',
    risk: 3,
    zhName: N_('侵蚀干扰 III'),
    enName: 'Originium Interference III',
    zhDesc: N_('我方全体单位攻击力 -35%，最大生命值 -35%'),
    enDesc: 'All friendly units suffer -35% ATK and -35% Max HP',
    icon: 'warn',
    mods: { allyAtkMul: 0.65, allyHpMul: 0.65 },
  },

  // Row 6 — Support / Assisted Protocol (locks Risk to 0)
  {
    id: 'cc_support_funds',
    category: 'support',
    mutexGroup: 'support',
    risk: 0,
    isSupport: true,
    zhName: N_('演训特别拨款'),
    enName: 'Emergency Grant',
    zhDesc: N_('初始额外获得 +15 资金与 +3 次免费刷新（启用支援条约后危机等级固定为 0）'),
    enDesc: 'Start with +15 bonus Funds and +3 free refreshes (locks Crisis Level to 0)',
    icon: 'star',
    mods: { initialGoldBonus: 15, initialFreeRerolls: 3 },
  },
  {
    id: 'cc_support_elite',
    category: 'support',
    mutexGroup: 'support',
    risk: 0,
    isSupport: true,
    zhName: N_('战地强心剂'),
    enName: 'Tactical Stimulants',
    zhDesc: N_('我方全体单位攻击力 +30%，最大生命值 +30%（启用支援条约后危机等级固定为 0）'),
    enDesc: 'All friendly units gain +30% ATK and +30% Max HP (locks Crisis Level to 0)',
    icon: 'star',
    mods: { allyAtkMul: 1.3, allyHpMul: 1.3 },
  },
]);

export const CONTRACT_BY_ID = new Map(CONTRACTS.map((c) => [c.id, c]));

/**
 * Sanitize and deduplicate an arbitrary contract ID list, enforcing mutexGroup rules
 * (if multiple contracts in the same mutexGroup are passed, the last valid one wins).
 * @param {unknown} rawIds
 * @returns {string[]}
 */
export function sanitizeContracts(rawIds) {
  if (!Array.isArray(rawIds)) return [];
  const chosenByGroup = new Map();
  const order = [];
  for (const id of rawIds) {
    if (typeof id !== 'string') continue;
    const def = CONTRACT_BY_ID.get(id);
    if (!def) continue;
    if (def.mutexGroup) {
      const prev = chosenByGroup.get(def.mutexGroup);
      if (prev) {
        const idx = order.indexOf(prev);
        if (idx !== -1) order.splice(idx, 1);
      }
      chosenByGroup.set(def.mutexGroup, id);
    } else if (order.includes(id)) {
      continue;
    }
    order.push(id);
    if (order.length >= MAX_CONTRACTS) break;
  }
  return order;
}

/**
 * Toggle a single contract ID in a current selection list, automatically resolving mutexGroup conflicts.
 * @param {string[]} currentIds
 * @param {string} targetId
 * @returns {string[]}
 */
export function toggleContract(currentIds, targetId) {
  const clean = sanitizeContracts(currentIds);
  const def = CONTRACT_BY_ID.get(targetId);
  if (!def) return clean;
  if (clean.includes(targetId)) {
    return clean.filter((id) => id !== targetId);
  }
  const filtered = def.mutexGroup
    ? clean.filter((id) => CONTRACT_BY_ID.get(id)?.mutexGroup !== def.mutexGroup)
    : clean;
  return sanitizeContracts([...filtered, targetId]);
}

/**
 * Compute total Crisis Risk level from a list of contract IDs.
 * If any support contract (`isSupport`) is active, total risk is locked to 0.
 * @param {string[]} contractIds
 * @returns {number}
 */
export function computeContractRisk(contractIds) {
  const clean = sanitizeContracts(contractIds);
  let total = 0;
  for (const id of clean) {
    const def = CONTRACT_BY_ID.get(id);
    if (!def) continue;
    if (def.isSupport) return 0;
    total += def.risk || 0;
  }
  return total;
}

/**
 * Aggregate all active contract modifiers into a single normalized modifier object.
 * @param {string[]} contractIds
 */
export function resolveContractMods(contractIds) {
  const clean = sanitizeContracts(contractIds);
  const mods = {
    risk: computeContractRisk(clean),
    hasSupport: false,
    maxLifeOverride: null,
    extraDisabledBonds: 0,
    enemyHpMul: 1,
    enemyAtkMul: 1,
    enemyDefMul: 1,
    enemyResMul: 1,
    enemySpeedMul: 1,
    roundFundsDelta: 0,
    shopSlotDelta: 0,
    levelCostDelta: 0,
    deployCapDelta: 0,
    allyAtkMul: 1,
    allyHpMul: 1,
    initialGoldBonus: 0,
    initialFreeRerolls: 0,
  };
  for (const id of clean) {
    const def = CONTRACT_BY_ID.get(id);
    if (!def) continue;
    if (def.isSupport) mods.hasSupport = true;
    const m = def.mods || {};
    if (typeof m.maxLifeOverride === 'number') {
      mods.maxLifeOverride = mods.maxLifeOverride === null ? m.maxLifeOverride : Math.min(mods.maxLifeOverride, m.maxLifeOverride);
    }
    if (typeof m.extraDisabledBonds === 'number') mods.extraDisabledBonds += m.extraDisabledBonds;
    if (typeof m.enemyHpMul === 'number') mods.enemyHpMul = +(mods.enemyHpMul * m.enemyHpMul).toFixed(4);
    if (typeof m.enemyAtkMul === 'number') mods.enemyAtkMul = +(mods.enemyAtkMul * m.enemyAtkMul).toFixed(4);
    if (typeof m.enemyDefMul === 'number') mods.enemyDefMul = +(mods.enemyDefMul * m.enemyDefMul).toFixed(4);
    if (typeof m.enemyResMul === 'number') mods.enemyResMul = +(mods.enemyResMul * m.enemyResMul).toFixed(4);
    if (typeof m.enemySpeedMul === 'number') mods.enemySpeedMul = +(mods.enemySpeedMul * m.enemySpeedMul).toFixed(4);
    if (typeof m.roundFundsDelta === 'number') mods.roundFundsDelta += m.roundFundsDelta;
    if (typeof m.shopSlotDelta === 'number') mods.shopSlotDelta += m.shopSlotDelta;
    if (typeof m.levelCostDelta === 'number') mods.levelCostDelta += m.levelCostDelta;
    if (typeof m.deployCapDelta === 'number') mods.deployCapDelta += m.deployCapDelta;
    if (typeof m.allyAtkMul === 'number') mods.allyAtkMul = +(mods.allyAtkMul * m.allyAtkMul).toFixed(4);
    if (typeof m.allyHpMul === 'number') mods.allyHpMul = +(mods.allyHpMul * m.allyHpMul).toFixed(4);
    if (typeof m.initialGoldBonus === 'number') mods.initialGoldBonus += m.initialGoldBonus;
    if (typeof m.initialFreeRerolls === 'number') mods.initialFreeRerolls += m.initialFreeRerolls;
  }
  return mods;
}
