// public/js/sim/endlessSim.js — Endless Combat Sandbox & Squad Benchmark Engine
// (i18n-ignore-file: developer sandbox simulator)

import { createStore } from '../store.js';
import { data } from '../data.js';
import { toast } from '../ui/toasts.js';

export const PRESET_SQUADS = [
  {
    id: 'siracusa_meta',
    name: '叙拉古狼群核心 (Siracusa Meta Squad)',
    ops: [
      { id: 'chess_char_5_05_a', name: '德克萨斯', tier: 5, prof: 'PIONEER', maxHp: 3200, atk: 980, def: 460, maxSp: 25, skillName: '剑雨·改' },
      { id: 'chess_char_6_05_a', name: '伺夜', tier: 6, prof: 'PIONEER', maxHp: 2850, atk: 890, def: 380, maxSp: 30, skillName: '领袖的呼唤' },
      { id: 'chess_char_6_06_a', name: '斥罪', tier: 6, prof: 'TANK', maxHp: 5600, atk: 1250, def: 920, maxSp: 35, skillName: '披荆斩棘' },
      { id: 'chess_char_5_06_a', name: '拉普兰德', tier: 5, prof: 'WARRIOR', maxHp: 3400, atk: 1050, def: 480, maxSp: 28, skillName: '狼魂' },
      { id: 'chess_char_4_06_a', name: '红云', tier: 4, prof: 'SNIPER', maxHp: 2100, atk: 920, def: 240, maxSp: 22, skillName: '狩猎时刻' },
      { id: 'chess_char_5_11_a', name: '塞雷娅', tier: 5, prof: 'TANK', maxHp: 4900, atk: 740, def: 860, maxSp: 26, skillName: '钙质化' },
    ],
  },
  {
    id: 'abyssal',
    name: '深海猎人潮汐队 (Abyssal Hunters Squad)',
    ops: [
      { id: 'chess_char_6_14_a', name: '归溟幽灵鲨', tier: 6, prof: 'SPECIALIST', maxHp: 4400, atk: 1420, def: 520, maxSp: 26, skillName: '生存的技巧' },
      { id: 'chess_char_6_13_a', name: '斯卡蒂', tier: 6, prof: 'WARRIOR', maxHp: 5200, atk: 1850, def: 490, maxSp: 24, skillName: '涌潮悲歌' },
      { id: 'chess_char_5_14_a', name: '幽灵鲨', tier: 5, prof: 'WARRIOR', maxHp: 4100, atk: 1320, def: 460, maxSp: 28, skillName: '肉斩骨断' },
      { id: 'chess_char_5_13_a', name: '歌蕾蒂娅', tier: 5, prof: 'SPECIALIST', maxHp: 4200, atk: 1280, def: 560, maxSp: 30, skillName: '碎浪之舞' },
      { id: 'chess_char_4_13_a', name: '安哲拉', tier: 4, prof: 'SNIPER', maxHp: 2400, atk: 1480, def: 230, maxSp: 25, skillName: '阻滞射击' },
    ],
  },
  {
    id: 'kazimierz_burst',
    name: '卡西米尔荣光骑士 (Kazimierz Burst)',
    ops: [
      { id: 'chess_char_5_19_a', name: '玛恩纳', tier: 5, prof: 'WARRIOR', maxHp: 4800, atk: 1680, def: 640, maxSp: 32, skillName: '未照耀的荣光' },
      { id: 'chess_char_6_19_a', name: '耀骑士临光', tier: 6, prof: 'WARRIOR', maxHp: 4500, atk: 1520, def: 590, maxSp: 28, skillName: '逐光耀日' },
      { id: 'chess_char_5_20_a', name: '瑕光', tier: 5, prof: 'TANK', maxHp: 5100, atk: 880, def: 840, maxSp: 25, skillName: '神圣守卫' },
      { id: 'chess_char_4_19_a', name: '白金', tier: 4, prof: 'SNIPER', maxHp: 2200, atk: 1120, def: 260, maxSp: 24, skillName: '天马视域' },
      { id: 'chess_char_4_22_a', name: '银灰', tier: 4, prof: 'WARRIOR', maxHp: 3600, atk: 1350, def: 520, maxSp: 30, skillName: '真银斩' },
      { id: 'chess_char_3_01_a', name: '能天使', tier: 3, prof: 'SNIPER', maxHp: 2300, atk: 1080, def: 280, maxSp: 20, skillName: '过载模式' },
    ],
  },
  {
    id: 'yan_arts',
    name: '大炎岁相术师团 (Yan Arts Mastery)',
    ops: [
      { id: 'chess_char_6_10_a', name: '令', tier: 6, prof: 'SUPPORT', maxHp: 3100, atk: 1380, def: 410, maxSp: 30, skillName: '宁作吾' },
      { id: 'chess_char_6_11_a', name: '黍', tier: 6, prof: 'TANK', maxHp: 5400, atk: 920, def: 890, maxSp: 26, skillName: '岁稔年丰' },
      { id: 'chess_char_5_10_a', name: '夕', tier: 5, prof: 'CASTER', maxHp: 2700, atk: 1450, def: 310, maxSp: 32, skillName: '写意胜形' },
      { id: 'chess_char_5_07_a', name: '史尔特尔', tier: 5, prof: 'WARRIOR', maxHp: 4600, atk: 1750, def: 540, maxSp: 22, skillName: '黄昏' },
      { id: 'chess_char_5_08_a', name: '艾雅法拉', tier: 5, prof: 'CASTER', maxHp: 2500, atk: 1390, def: 290, maxSp: 25, skillName: '火山' },
      { id: 'chess_char_4_10_a', name: '年', tier: 4, prof: 'TANK', maxHp: 5800, atk: 780, def: 980, maxSp: 30, skillName: '铁御' },
    ],
  },
  {
    id: 'all_stars',
    name: '全明星决战阵列 (All-Stars Squad)',
    ops: [
      { id: 'chess_char_6_19_a', name: '耀骑士临光', tier: 6, prof: 'WARRIOR', maxHp: 4800, atk: 1650, def: 620, maxSp: 28, skillName: '逐光耀日' },
      { id: 'chess_char_5_07_a', name: '史尔特尔', tier: 5, prof: 'WARRIOR', maxHp: 4700, atk: 1820, def: 560, maxSp: 22, skillName: '黄昏' },
      { id: 'chess_char_6_11_a', name: '黍', tier: 6, prof: 'TANK', maxHp: 5600, atk: 950, def: 920, maxSp: 26, skillName: '岁稔年丰' },
      { id: 'chess_char_5_19_a', name: '玛恩纳', tier: 5, prof: 'WARRIOR', maxHp: 4900, atk: 1720, def: 650, maxSp: 32, skillName: '未照耀的荣光' },
      { id: 'chess_char_6_10_a', name: '令', tier: 6, prof: 'SUPPORT', maxHp: 3200, atk: 1420, def: 420, maxSp: 30, skillName: '宁作吾' },
      { id: 'chess_char_3_01_a', name: '能天使', tier: 3, prof: 'SNIPER', maxHp: 2400, atk: 1150, def: 290, maxSp: 20, skillName: '过载模式' },
    ],
  },
];

function buildSquad(presetId) {
  const preset = PRESET_SQUADS.find((p) => p.id === presetId) || PRESET_SQUADS[0];
  return preset.ops.map((op, i) => ({
    uid: i + 1,
    ...op,
    curHp: op.maxHp,
    curSp: Math.floor(op.maxSp * 0.4),
    alive: true,
    dmgDealt: 0,
  }));
}

export const BOSS_ROSTER = [
  { id: 'boss_quintus', name: '首领·盐风主教昆图斯', tag: 'ARTS', trait: '海潮倾覆 (全场法术浪潮)', skillName: '海潮倾覆', archetype: 'caster', hpFactor: 1.0, atkFactor: 1.05, def: 750 },
  { id: 'boss_lucian', name: '首领·卢西恩“猩红血钻”', tag: 'STEALTH', trait: '血色假面 (高闪避·斩杀后排)', skillName: '血色假面', archetype: 'assassin', hpFactor: 1.0, atkFactor: 1.15, def: 620 },
  { id: 'boss_alistair', name: '首领·阿利斯泰尔“帝国余晖”', tag: 'SHIELD', trait: '帝国壁垒 (重甲顺劈)', skillName: '破阵重斩', archetype: 'bulwark', hpFactor: 1.05, atkFactor: 1.0, def: 1050 },
  { id: 'boss_sami', name: '首领·“萨米的意志”', tag: 'FROST', trait: '无尽极寒 (冰冻降技力)', skillName: '无尽极寒', archetype: 'frost', hpFactor: 1.08, atkFactor: 0.98, def: 850 },
  { id: 'boss_manfred', name: '首领·军事委员会曼弗雷德', tag: 'REFLECT', trait: '电磁偏转 (折射反击副炮)', skillName: '副炮齐射', archetype: 'reflection', hpFactor: 1.1, atkFactor: 1.06, def: 900 },
  { id: 'boss_talulah', name: '首领·黑蛇塔露拉', tag: 'BURN', trait: '焚天烈焰 (全场灼烧真伤)', skillName: '焚天余烬', archetype: 'burn', hpFactor: 1.12, atkFactor: 1.12, def: 820 },
  { id: 'boss_armor', name: '首领·假想敌：胄', tag: 'SHIELD', trait: '超重型装甲 (高额物防减伤)', skillName: '超重碾压', archetype: 'bulwark', hpFactor: 1.15, atkFactor: 0.95, def: 1200 },
  { id: 'boss_railgun', name: '首领·假想敌：铳', tag: 'SNIPE', trait: '高能轨道狙击 (锁定残血)', skillName: '轨道贯穿', archetype: 'sniper', hpFactor: 1.15, atkFactor: 1.2, def: 700 },
  { id: 'boss_cannon', name: '首领·假想敌：管', tag: 'BOOM', trait: '地毯式重炮轰击 (范围溅射)', skillName: '毁灭齐射', archetype: 'exploder', hpFactor: 1.18, atkFactor: 1.15, def: 880 },
  { id: 'boss_pursuer', name: '首领·“内卫”坍缩之影', tag: 'CORRUPT', trait: '国度迷雾 (攻防削弱与爆发)', skillName: '坍缩国度', archetype: 'corrupt', hpFactor: 1.2, atkFactor: 1.18, def: 920 },
];

export const ELITE_ARCHETYPES = [
  { id: 'elite_colossus', name: '精锐·泥岩重构巨像', tag: 'COLOSSUS', trait: '巨石重击 (高血量·重击前排)', archetype: 'colossus', hpMod: 1.35, atkMod: 1.15, def: 720 },
  { id: 'elite_bomber', name: '精锐·高空轰炸艇「天火」', tag: 'AIR', trait: '制空轰炸 (绕过前排轰炸后排)', archetype: 'drone', hpMod: 0.9, atkMod: 1.18, def: 320 },
  { id: 'elite_shaman', name: '精锐·血巫萨满祭司', tag: 'BUFF', trait: '狂热祝祷 (持续恢复并强化敌军)', archetype: 'shaman', hpMod: 0.95, atkMod: 0.95, def: 420 },
  { id: 'elite_exploder', name: '精锐·高危自爆工兵', tag: 'BOOM', trait: '殉爆核心 (倒下时引爆范围伤害)', archetype: 'exploder', hpMod: 0.88, atkMod: 1.1, def: 380 },
  { id: 'elite_assassin', name: '精锐·猩红暗影刺客', tag: 'STEALTH', trait: '隐匿背刺 (突袭高输出干员)', archetype: 'assassin', hpMod: 0.85, atkMod: 1.28, def: 310 },
  { id: 'elite_centurion', name: '精锐·萨卡兹百夫长', tag: 'MULTI', trait: '狂暴连斩 (多段高频攻击)', archetype: 'times', hpMod: 1.1, atkMod: 1.12, def: 520 },
  { id: 'elite_frost', name: '精锐·冬痕冰霜巫师', tag: 'FROST', trait: '寒霜侵蚀 (法术穿透与削减SP)', archetype: 'caster', hpMod: 0.92, atkMod: 1.15, def: 360 },
  { id: 'elite_guard', name: '精锐·帝国皇家铁卫', tag: 'SHIELD', trait: '重装壁垒 (极高物理防御)', archetype: 'bulwark', hpMod: 1.25, atkMod: 0.95, def: 850 },
];

export const NORMAL_ARCHETYPES = [
  { id: 'norm_swarm', name: '源石裂变虫·α', tag: 'SWARM', trait: '集群突袭 (攻速较快)', archetype: 'swarmer', hpMod: 0.82, atkMod: 0.95, def: 140 },
  { id: 'norm_drone', name: '帝国巡航无人机', tag: 'AIR', trait: '高空飞掠 (优先袭击远程)', archetype: 'drone', hpMod: 0.88, atkMod: 1.05, def: 180 },
  { id: 'norm_shield', name: '重装盾卫步兵', tag: 'SHIELD', trait: '持盾防御 (物理减伤)', archetype: 'bulwark', hpMod: 1.2, atkMod: 0.88, def: 480 },
  { id: 'norm_caster', name: '深池蚀刻术师', tag: 'ARTS', trait: '蚀刻法球 (无视部分防御)', archetype: 'caster', hpMod: 0.9, atkMod: 1.12, def: 160 },
  { id: 'norm_stalker', name: '隐匿潜行猎手', tag: 'STEALTH', trait: '光学迷彩 (伺机狙击)', archetype: 'assassin', hpMod: 0.86, atkMod: 1.15, def: 190 },
  { id: 'norm_corrupt', name: '腐败凋零漫步者', tag: 'DOT', trait: '秽蚀污染 (附带持续侵蚀)', archetype: 'corrosion', hpMod: 1.0, atkMod: 1.0, def: 220 },
  { id: 'norm_brawler', name: '双持狂暴突击手', tag: 'MULTI', trait: '双刃连击 (二连击)', archetype: 'times', hpMod: 0.96, atkMod: 1.08, def: 210 },
  { id: 'norm_reflect', name: '折射晶甲傀儡', tag: 'REFLECT', trait: '晶化外壳 (法术折射)', archetype: 'reflection', hpMod: 1.08, atkMod: 0.95, def: 340 },
];

export const WAVE_THEMES = [
  { id: 'combined', name: '全军突击 · Combined Arms', desc: '均衡混合编队，前排重装掩护后排术师与突击手推进', preferred: [0, 2, 3, 6] },
  { id: 'air_raid', name: '高空奇袭 · Aerial Raid', desc: '大量巡航无人机与轰炸艇升空，直接威胁后排干员', preferred: [1, 3, 4] },
  { id: 'iron_wall', name: '装甲洪流 · Armored Phalanx', desc: '泥岩巨像与重装铁卫组成钢铁防线，考验破甲与法术输出', preferred: [2, 7, 0] },
  { id: 'shadow_hunt', name: '暗影猎杀 · Shadow Infiltration', desc: '隐匿刺客与狂暴打手伺机切入，精准狙杀主力核心', preferred: [4, 6, 1] },
  { id: 'arts_storm', name: '法术风暴 · Arts Maelstrom', desc: '蚀刻术师、冰霜巫师与萨满祭司协同释放高压法术洪流', preferred: [3, 5, 7] },
  { id: 'toxic_swarm', name: '秽蚀狂潮 · Corrosive Swarm', desc: '裂变虫群与自爆工兵亡命冲锋，击败时将引爆剧烈冲击', preferred: [0, 5, 6] },
];

export function getWaveTheme(wave, bossInterval = 5) {
  const isBoss = wave > 0 && wave % bossInterval === 0;
  if (isBoss) {
    const bossIdx = (Math.floor(wave / Math.max(1, bossInterval)) - 1) % BOSS_ROSTER.length;
    const boss = BOSS_ROSTER[Math.max(0, bossIdx)];
    return {
      id: 'boss_showdown',
      name: `首领决战 · ${boss.name}`,
      desc: `首领特性：${boss.trait}`,
      isBoss: true,
    };
  }
  return WAVE_THEMES[(wave - 1) % WAVE_THEMES.length];
}

export function generateWaveEnemies(wave, scalingRateOrOpts = 1.10, bossIntervalParam = 5) {
  let scalingRate = 1.10;
  let bossInterval = 5;
  if (typeof scalingRateOrOpts === 'object' && scalingRateOrOpts !== null) {
    if (Number.isFinite(scalingRateOrOpts.scalingRate)) scalingRate = scalingRateOrOpts.scalingRate;
    if (Number.isInteger(scalingRateOrOpts.bossInterval)) bossInterval = scalingRateOrOpts.bossInterval;
  } else {
    if (Number.isFinite(scalingRateOrOpts)) scalingRate = scalingRateOrOpts;
    if (Number.isInteger(bossIntervalParam)) bossInterval = bossIntervalParam;
  }
  const isBoss = wave > 0 && wave % bossInterval === 0;
  const mult = Math.pow(scalingRate, Math.max(0, wave - 1));
  const theme = getWaveTheme(wave, bossInterval);
  const count = isBoss ? 6 : Math.min(12, 4 + Math.floor(wave / 2));
  const list = [];

  for (let i = 0; i < count; i++) {
    const bossUnit = isBoss && i === 0;
    const eliteUnit = !bossUnit && (i % 3 === 0 || wave >= 6);

    if (bossUnit) {
      const bossIdx = (Math.floor(wave / Math.max(1, bossInterval)) - 1) % BOSS_ROSTER.length;
      const bossTpl = BOSS_ROSTER[Math.max(0, bossIdx)];
      const baseHp = Math.round(48000 * bossTpl.hpFactor);
      const baseAtk = Math.round(1350 * bossTpl.atkFactor);
      const maxHp = Math.round(baseHp * mult);
      list.push({
        uid: `e_${wave}_${i}`,
        name: `${bossTpl.name} (Lv.${wave})`,
        tag: bossTpl.tag,
        trait: bossTpl.trait,
        skillName: bossTpl.skillName,
        archetype: bossTpl.archetype,
        waveTheme: theme.name,
        isBoss: true,
        isElite: false,
        maxHp,
        curHp: maxHp,
        atk: Math.round(baseAtk * Math.pow(scalingRate, Math.max(0, (wave - 1) * 0.75))),
        def: bossTpl.def,
        skillCd: 0,
        alive: true,
      });
    } else if (eliteUnit) {
      const pref = theme.preferred || [0, 1, 2, 3];
      const archIdx = ( pref[i % pref.length] + wave + i ) % ELITE_ARCHETYPES.length;
      const tpl = ELITE_ARCHETYPES[archIdx];
      const baseHp = Math.round(9500 * tpl.hpMod);
      const baseAtk = Math.round(680 * tpl.atkMod);
      const maxHp = Math.round(baseHp * mult);
      list.push({
        uid: `e_${wave}_${i}`,
        name: `${tpl.name} #${i + 1}`,
        tag: tpl.tag,
        trait: tpl.trait,
        archetype: tpl.archetype,
        waveTheme: theme.name,
        isBoss: false,
        isElite: true,
        maxHp,
        curHp: maxHp,
        atk: Math.round(baseAtk * Math.pow(scalingRate, Math.max(0, (wave - 1) * 0.75))),
        def: tpl.def,
        alive: true,
      });
    } else {
      const pref = theme.preferred || [0, 1, 2, 3];
      const archIdx = ( pref[i % pref.length] + wave * 2 + i ) % NORMAL_ARCHETYPES.length;
      const tpl = NORMAL_ARCHETYPES[archIdx];
      const baseHp = Math.round(3800 * tpl.hpMod);
      const baseAtk = Math.round(390 * tpl.atkMod);
      const maxHp = Math.round(baseHp * mult);
      list.push({
        uid: `e_${wave}_${i}`,
        name: `${tpl.name} #${i + 1}`,
        tag: tpl.tag,
        trait: tpl.trait,
        archetype: tpl.archetype,
        waveTheme: theme.name,
        isBoss: false,
        isElite: false,
        maxHp,
        curHp: maxHp,
        atk: Math.round(baseAtk * Math.pow(scalingRate, Math.max(0, (wave - 1) * 0.75))),
        def: tpl.def,
        alive: true,
      });
    }
  }
  return list;
}

export function stepSimulationTick() {
  tickEndlessSim();
}

const initialOps = buildSquad('siracusa_meta');

export const endlessStore = createStore({
  presetId: 'siracusa_meta',
  status: 'idle', // 'idle' | 'running' | 'paused' | 'victory' | 'wiped'
  wave: 1,
  maxWaveRecord: 1,
  bossInterval: 5,
  speed: 2,
  scalingRate: 1.10,
  autoNext: true,
  godMode: false,
  fastSp: false,
  waveTimer: 0,
  totalEnemiesKilled: 0,
  totalDmgDealt: 0,
  squadAliveCount: initialOps.length,
  squadTotalCount: initialOps.length,
  operators: initialOps,
  enemies: generateWaveEnemies(1, 1.10, 5),
  recentDmgFeed: [],
  waveLog: [],
});

let simInterval = null;

function stopLoop() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
}

function tickEndlessSim() {
  const s = endlessStore.get();
  if (s.status !== 'running') return;

  const dt = 0.25 * (s.speed || 1);
  const ops = s.operators.map((o) => ({ ...o }));
  const enemies = s.enemies.map((e) => ({ ...e }));
  const feed = [...s.recentDmgFeed];
  let killsGain = 0;
  let dmgGain = 0;

  const aliveOps = ops.filter((o) => o.alive);
  const aliveEnemies = enemies.filter((e) => e.alive);

  if (!aliveOps.length) {
    stopLoop();
    endlessStore.set({ status: 'wiped' });
    return;
  }

  if (!aliveEnemies.length) {
    stopLoop();
    const mvp = [...ops].sort((a, b) => b.dmgDealt - a.dmgDealt)[0] || { name: 'None', dmgDealt: 0 };
    const logItem = {
      id: `${s.wave}_${Date.now()}`,
      wave: s.wave,
      isBoss: s.wave % s.bossInterval === 0,
      clearTime: s.waveTimer.toFixed(1),
      mvpName: mvp.name,
      mvpDmg: mvp.dmgDealt,
      casualtyCount: ops.filter((o) => !o.alive).length,
    };
    const nextMax = Math.max(s.maxWaveRecord, s.wave);
    endlessStore.set({
      status: 'victory',
      maxWaveRecord: nextMax,
      waveLog: [logItem, ...s.waveLog.slice(0, 29)],
    });
    if (s.autoNext) {
      setTimeout(() => {
        if (endlessStore.get().status === 'victory') {
          startEndlessSimulation(s.wave + 1);
        }
      }, 600);
    }
    return;
  }

  // Operators attack & charge skills with smart targeting by profession
  for (const op of aliveOps) {
    // Snipers prioritize drones (AIR), Casters prioritize high DEF bulwarks/colossi, others hit frontline
    let target = null;
    if (op.prof === 'SNIPER') {
      target = enemies.find((e) => e.alive && e.tag === 'AIR') || enemies.find((e) => e.alive);
    } else if (op.prof === 'CASTER' || op.prof === 'SUPPORT') {
      target = enemies.find((e) => e.alive && (e.tag === 'SHIELD' || e.tag === 'COLOSSUS' || e.isBoss)) || enemies.find((e) => e.alive);
    } else {
      target = enemies.find((e) => e.alive);
    }
    if (!target) break;

    const spGain = (s.fastSp ? 10 : 3.2) * dt;
    op.curSp = Math.min(op.maxSp, op.curSp + spGain);
    let burst = false;
    if (op.curSp >= op.maxSp) {
      op.curSp = 0;
      burst = true;
    }
    const isArtsOp = op.prof === 'CASTER' || op.prof === 'SUPPORT';
    const raw = op.atk * (burst ? 2.8 : 1.0) * dt;
    const defMitigation = isArtsOp ? target.def * 0.08 * dt : target.def * 0.25 * dt;
    const actual = Math.max(Math.round(raw * 0.15), Math.round(raw - defMitigation));
    target.curHp = Math.max(0, target.curHp - actual);
    op.dmgDealt += actual;
    dmgGain += actual;

    if (burst) {
      feed.unshift(`⚡ [${op.name}] activated 【${op.skillName}】 → ${actual.toLocaleString()} DMG to ${target.name}!`);
    }
    if (target.curHp <= 0) {
      target.alive = false;
      killsGain++;
      feed.unshift(`💀 [${op.name}] defeated ${target.name}!`);
      // Exploder enemy on-death detonation mechanic
      if (target.archetype === 'exploder' && !s.godMode) {
        const frontVictim = ops.find((o) => o.alive && o.prof === 'TANK') || ops.find((o) => o.alive);
        if (frontVictim) {
          const blast = Math.round(target.atk * 0.42);
          frontVictim.curHp = Math.max(0, frontVictim.curHp - blast);
          feed.unshift(`💥 [${target.name}] detonated on death → ${blast.toLocaleString()} blast DMG to [${frontVictim.name}]!`);
          if (frontVictim.curHp <= 0) {
            frontVictim.alive = false;
            feed.unshift(`⚠️ Operator [${frontVictim.name}] was knocked out by ${target.name}'s explosion!`);
          }
        }
      }
    }
  }

  // Diverse Enemy Counter-Attacks & Archetype Mechanics
  if (!s.godMode) {
    for (const en of enemies.filter((e) => e.alive)) {
      const stillAliveOps = ops.filter((o) => o.alive);
      if (!stillAliveOps.length) break;

      // Shaman heals wounded enemies
      if (en.archetype === 'shaman') {
        const wounded = enemies.find((x) => x.alive && x.curHp < x.maxHp);
        if (wounded) {
          const heal = Math.round(en.atk * 0.45 * dt);
          wounded.curHp = Math.min(wounded.maxHp, wounded.curHp + heal);
        }
      }

      // Boss special skill activation every few seconds
      if (en.isBoss) {
        en.skillCd = (en.skillCd || 0) + dt;
        if (en.skillCd >= 3.0) {
          en.skillCd = 0;
          const skillDmg = Math.round(en.atk * 0.48);
          for (const victim of stillAliveOps.slice(0, 2)) {
            victim.curHp = Math.max(0, victim.curHp - skillDmg);
            if (en.archetype === 'frost') {
              victim.curSp = Math.max(0, victim.curSp - 4);
            }
            if (victim.curHp <= 0) {
              victim.alive = false;
              feed.unshift(`⚠️ Operator [${victim.name}] fell to ${en.name}'s 【${en.skillName || '终极技'}】!`);
            }
          }
          feed.unshift(`👑 [${en.name}] unleashed 【${en.skillName || '灾厄冲击'}】 (${skillDmg.toLocaleString()} AoE DMG)!`);
        }
      }

      // Select target based on enemy archetype
      let targetOp = null;
      if (en.archetype === 'drone') {
        // Drones target backline (Sniper / Caster / Support) first
        targetOp = stillAliveOps.find((o) => o.prof === 'SNIPER' || o.prof === 'CASTER' || o.prof === 'SUPPORT') || stillAliveOps[0];
      } else if (en.archetype === 'assassin') {
        // Assassins strike highest DPS operator
        targetOp = [...stillAliveOps].sort((a, b) => b.atk - a.atk)[0];
      } else if (en.archetype === 'sniper') {
        // Snipers lock onto lowest HP operator
        targetOp = [...stillAliveOps].sort((a, b) => a.curHp - b.curHp)[0];
      } else {
        // Frontline tank or first operator
        targetOp = stillAliveOps.find((o) => o.prof === 'TANK') || stillAliveOps[0];
      }

      if (!targetOp) break;

      const isArtsEnemy = en.archetype === 'caster' || en.archetype === 'frost' || en.archetype === 'burn' || en.archetype === 'corrosion';
      const multiMod = en.archetype === 'times' ? 1.25 : 1.0;
      const defFactor = isArtsEnemy ? 0.25 : 0.55;
      const hit = Math.max(25, Math.round((en.atk * multiMod - targetOp.def * defFactor) * 0.35 * dt));
      targetOp.curHp = Math.max(0, targetOp.curHp - hit);

      if (targetOp.curHp <= 0) {
        targetOp.alive = false;
        feed.unshift(`⚠️ Operator [${targetOp.name}] was knocked out by ${en.name}!`);
      }
    }
  }

  endlessStore.set({
    waveTimer: s.waveTimer + dt,
    totalEnemiesKilled: s.totalEnemiesKilled + killsGain,
    totalDmgDealt: s.totalDmgDealt + dmgGain,
    squadAliveCount: ops.filter((o) => o.alive).length,
    operators: ops,
    enemies,
    recentDmgFeed: feed.slice(0, 25),
  });
}

export function selectPresetSquad(presetId) {
  stopLoop();
  const ops = buildSquad(presetId);
  const s = endlessStore.get();
  endlessStore.set({
    presetId,
    status: 'idle',
    wave: 1,
    waveTimer: 0,
    squadAliveCount: ops.length,
    squadTotalCount: ops.length,
    operators: ops,
    enemies: generateWaveEnemies(1, s.scalingRate, s.bossInterval),
    recentDmgFeed: [`Loaded squad preset: ${presetId}`],
  });
  toast('Squad preset loaded', 'info');
}

export function importLiveBoard(matchSlice) {
  const board = matchSlice?.private?.board || [];
  const chessObj = data.get('chess') || {};
  if (!board.length) {
    toast('No operators deployed on your live board to import.', 'warn');
    return;
  }
  stopLoop();
  const ops = board.filter((b) => b && b.kind === 'chess').map((b, i) => {
    const rec = chessObj[b.id] || {};
    const stats = rec.stats || {};
    return {
      uid: b.uid || i + 1,
      id: b.id,
      name: rec.name || b.id,
      tier: rec.tier || 4,
      prof: rec.profession || 'WARRIOR',
      maxHp: stats.maxHp || 3500,
      curHp: stats.maxHp || 3500,
      atk: stats.atk || 950,
      def: stats.def || 450,
      maxSp: rec.skill?.spCost || 25,
      curSp: 10,
      skillName: rec.skill?.name || '战术技能',
      alive: true,
      dmgDealt: 0,
    };
  });
  if (!ops.length) {
    toast('No valid operators found on board.', 'warn');
    return;
  }
  const s = endlessStore.get();
  endlessStore.set({
    presetId: 'live_import',
    status: 'idle',
    wave: 1,
    waveTimer: 0,
    squadAliveCount: ops.length,
    squadTotalCount: ops.length,
    operators: ops,
    enemies: generateWaveEnemies(1, s.scalingRate, s.bossInterval),
    recentDmgFeed: [`Imported ${ops.length} operators from live match board.`],
  });
  toast(`Imported ${ops.length} operators from live match!`, 'success');
}

export function startEndlessSimulation(targetWave = null) {
  stopLoop();
  const s = endlessStore.get();
  const w = targetWave != null ? Math.max(1, targetWave) : s.wave;
  const ops = s.operators.map((o) => ({
    ...o,
    curHp: o.maxHp,
    curSp: Math.min(o.maxSp, o.curSp + 8),
    alive: true,
  }));
  endlessStore.set({
    wave: w,
    status: 'running',
    waveTimer: 0,
    squadAliveCount: ops.length,
    operators: ops,
    enemies: generateWaveEnemies(w, s.scalingRate, s.bossInterval),
  });
  simInterval = setInterval(tickEndlessSim, 120);
}

export function pauseEndlessSimulation() {
  stopLoop();
  endlessStore.set({ status: 'paused' });
}

export function resumeEndlessSimulation() {
  const s = endlessStore.get();
  if (s.status !== 'paused') return;
  endlessStore.set({ status: 'running' });
  simInterval = setInterval(tickEndlessSim, 120);
}

export function resetEndlessSimulation() {
  stopLoop();
  const s = endlessStore.get();
  const ops = buildSquad(s.presetId);
  endlessStore.set({
    status: 'idle',
    wave: 1,
    waveTimer: 0,
    totalEnemiesKilled: 0,
    totalDmgDealt: 0,
    squadAliveCount: ops.length,
    squadTotalCount: ops.length,
    operators: ops,
    enemies: generateWaveEnemies(1, s.scalingRate, s.bossInterval),
    recentDmgFeed: [],
  });
}

export function setSimSpeed(speed) {
  endlessStore.set({ speed });
}

export function healSquad() {
  const s = endlessStore.get();
  const ops = s.operators.map((o) => ({ ...o, curHp: o.maxHp, curSp: o.maxSp, alive: true }));
  endlessStore.set({
    operators: ops,
    squadAliveCount: ops.length,
    recentDmgFeed: ['💚 Full Squad Healed & SP Restored!', ...s.recentDmgFeed.slice(0, 20)],
  });
}

export function runBatchEndlessBenchmark(maxWaves = 20) {
  const s = endlessStore.get();
  const ops = buildSquad(s.presetId);
  let waveSurvived = 0;
  let totalKills = 0;
  let totalDmg = 0;

  for (let w = 1; w <= maxWaves; w++) {
    const enemies = generateWaveEnemies(w, s.scalingRate, s.bossInterval);
    const squadDps = ops.reduce((sum, o) => sum + o.atk * 1.45, 0);
    const squadEhp = ops.reduce((sum, o) => sum + o.maxHp + o.def * 3.5, 0);
    const enemyHp = enemies.reduce((sum, e) => sum + e.maxHp, 0);
    const enemyDps = enemies.reduce((sum, e) => sum + e.atk * 0.55, 0);

    const timeToClear = enemyHp / Math.max(100, squadDps);
    const incomingDmg = enemyDps * timeToClear;

    if (!s.godMode && incomingDmg > squadEhp * 1.35) {
      break;
    }
    waveSurvived = w;
    totalKills += enemies.length;
    totalDmg += enemyHp;
    ops.forEach((o) => {
      o.dmgDealt += Math.round(enemyHp * (o.atk / Math.max(1, ops.reduce((acc, x) => acc + x.atk, 0))));
    });
  }

  const mvp = [...ops].sort((a, b) => b.dmgDealt - a.dmgDealt)[0] || { name: 'None', dmgDealt: 0 };
  const nextRecord = Math.max(s.maxWaveRecord, waveSurvived);
  endlessStore.set({ maxWaveRecord: nextRecord });
  return {
    wavesTested: maxWaves,
    maxWaveSurvived: waveSurvived,
    totalKills,
    totalDmg,
    mvpName: mvp.name,
    mvpDmg: mvp.dmgDealt,
  };
}
