// public/js/ui/debugPanel.js — Secret Developer Debug Panel & Tools Registry
// (i18n-ignore-file: developer debug tools)
//
// Activation sequence: `CHTLYO` typed sequentially on any screen.
// Only runs locally for the developer. No public UI or tutorial hints exist.

import { useEffect, useRef, useState, useMemo } from '../../vendor/hooks.module.js';
import { html, Icon, MicroLabel, confirmDialog, alertDialog } from './components.js';
import { createStore, useStore, store, selectRoute, serverNow } from '../store.js';
import { net } from '../net.js';
import { data, useData } from '../data.js';
import { toast } from './toasts.js';
import { copyText } from './clipboard.js';
import { audio } from '../audio.js';
import { battleRunner } from '../battle/runner.js';
import { t as T } from '../../../shared/i18n.js';
import { actions } from './gameActions.js';
import { chessAvatarUrl, itemIconUrl, bondIconUrl } from './assetUrls.js';
import {
  endlessStore,
  PRESET_SQUADS,
  selectPresetSquad,
  importLiveBoard,
  startEndlessSimulation,
  pauseEndlessSimulation,
  resumeEndlessSimulation,
  resetEndlessSimulation,
  setSimSpeed,
  healSquad,
  runBatchEndlessBenchmark,
} from '../sim/endlessSim.js';

const ACTIVATION_CODE = 'CHTLYO';
const BUFFER_MAX_LENGTH = 32;
const IDLE_RESET_MS = 6000;

// ---- Store & State ---------------------------------------------------------------------------------

export const debugStore = createStore({
  open: false,
  unlocked: false,
  activeTab: 'cheats', // 'endless' | 'cheats' | 'shopLock' | 'operators' | 'items' | 'combat' | 'telemetry' | 'data' | 'tools'
  simSpeed: 1,
  events: [],
  logs: [
    { id: 1, time: new Date().toLocaleTimeString(), type: 'info', text: 'Developer Console initialized. Welcome.' },
  ],
  dataCategory: 'chess',
  dataFilter: '',
});

export function openDebugPanel() {
  debugStore.set({ open: true });
}

export function closeDebugPanel() {
  debugStore.set({ open: false });
}

export function unlockDebugSuite() {
  debugStore.set({ unlocked: true });
}

export function lockDebugSuite() {
  debugStore.set({ unlocked: false });
}

export function executeDebugCommand(cmd) {
  const clean = String(cmd || '').trim();
  const normalized = clean.replace(/\s+/g, '').toLowerCase();
  if (normalized === 'opendebug=1' || normalized === 'opendebug==1') {
    debugStore.set({ unlocked: true });
    try { audio.sfx?.('ready', { volume: 0.6 }); } catch { /* ignore */ }
    toast('[DEV] Authorization Accepted: OpenDebug = 1. Developer Suite Unlocked!', 'success');
    return { ok: true, msg: 'OpenDebug = 1 accepted! Developer privileges unlocked.' };
  }
  if (normalized === 'opendebug=0' || normalized === 'opendebug==0') {
    debugStore.set({ unlocked: false });
    toast('[DEV] Developer mode locked.', 'info');
    return { ok: true, msg: 'Debug suite locked.' };
  }
  return { ok: false, error: 'Command unrecognized or insufficient privilege: ' + clean };
}

export function toggleDebugPanel() {
  const cur = debugStore.get().open;
  debugStore.set({ open: !cur });
  if (!cur) {
    try { audio.sfx?.('ready', { volume: 0.5 }); } catch { /* ignore */ }
    toast('[DEV] Diagnostic Console Opened', 'info');
  }
}

// ---- Extensible Developer Tools Registry -----------------------------------------------------------

/**
 * Registry of developer testing tools. Developers can register custom debug tools anytime.
 * @type {Array<{ id: string, name: string, category: string, description: string, run: () => Promise<any>|any }>}
 */
const registeredTools = [];
const registryListeners = new Set();
const notifyTools = () => { for (const fn of [...registryListeners]) fn(); };

export function registerDebugTool(tool) {
  if (!tool || !tool.id || !tool.name || typeof tool.run !== 'function') return;
  const idx = registeredTools.findIndex((t) => t.id === tool.id);
  if (idx >= 0) registeredTools[idx] = tool;
  else registeredTools.push(tool);
  notifyTools();
}

export function unregisterDebugTool(id) {
  const idx = registeredTools.findIndex((t) => t.id === id);
  if (idx >= 0) {
    registeredTools.splice(idx, 1);
    notifyTools();
  }
}

export function getDebugTools() {
  return [...registeredTools];
}

// Register built-in developer tools
registerDebugTool({
  id: 'copy_state_snapshot',
  name: 'Copy State JSON Snapshot',
  category: 'Telemetry',
  description: 'Copies current client store state (route, room, match, net) as formatted JSON to clipboard.',
  run: async () => {
    const snap = {
      timestamp: new Date().toISOString(),
      route: selectRoute(store.get()),
      serverNow: serverNow(),
      state: store.get(),
    };
    const json = JSON.stringify(snap, null, 2);
    const ok = await copyText(json);
    if (ok) toast('State snapshot copied to clipboard', 'success');
    else toast('Failed to copy to clipboard', 'warn');
  },
});

registerDebugTool({
  id: 'network_ping_probe',
  name: 'Network Latency Probe',
  category: 'Network',
  description: 'Triggers WebSocket heartbeat ping probe to compute round-trip latency and clock sync offset.',
  run: () => {
    net.probe();
    toast(`Ping probe sent. Current ping: ${net.ping ?? '--'} ms`, 'info');
  },
});

registerDebugTool({
  id: 'force_reconnect_socket',
  name: 'Reconnect WebSocket',
  category: 'Network',
  description: 'Resets and reconnects WebSocket to test network interruption and resume logic.',
  run: () => {
    net.connect();
    toast('Triggered socket reconnect attempt', 'info');
  },
});

registerDebugTool({
  id: 'simulate_connection_drop',
  name: 'Simulate Connection Drop',
  category: 'Network',
  description: 'Forces socket drop to simulate network dropout and inspect client recovery UX.',
  run: () => {
    net.close();
    toast('Simulating socket disconnect. Reconnecting in 3s...', 'warn');
    setTimeout(() => { net.connect(); }, 3000);
  },
});

registerDebugTool({
  id: 'clear_session_tokens',
  name: 'Clear Stored Auth Tokens',
  category: 'Identity',
  description: 'Removes saved tokens in sessionStorage and localStorage to test fresh user onboarding.',
  run: () => {
    try {
      sessionStorage.removeItem('sp.token');
      localStorage.removeItem('sp.tokens');
      toast('Session tokens cleared from storage', 'success');
    } catch (e) {
      toast(`Storage clear error: ${e.message}`, 'error');
    }
  },
});

registerDebugTool({
  id: 'inspect_storage_keys',
  name: 'Inspect Storage Keys',
  category: 'Storage',
  description: 'Lists all stored localStorage & sessionStorage keys and values in the debug console.',
  run: () => {
    const items = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        items[`local:${k}`] = localStorage.getItem(k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        items[`session:${k}`] = sessionStorage.getItem(k);
      }
    } catch { /* ignore */ }
    logToDebugConsole('Storage Dump:\n' + JSON.stringify(items, null, 2), 'result');
    toast('Storage keys dumped to Console tab', 'info');
  },
});

registerDebugTool({
  id: 'reload_game_data_cache',
  name: 'Invalidate Game Data Cache',
  category: 'Data',
  description: 'Forces invalidation and re-fetch of all static game data sets.',
  run: async () => {
    const list = ['config', 'chess', 'bonds', 'items', 'enemies', 'stages', 'bosses'];
    for (const name of list) {
      try { await data.invalidate(name); } catch { /* ignore */ }
    }
    toast('Game data cache invalidated and refreshed', 'success');
  },
});

registerDebugTool({
  id: 'simulate_build_stale',
  name: 'Simulate Stale Build Update',
  category: 'UI',
  description: 'Triggers build guard notification banner to test deployment refresh alert.',
  run: () => {
    store.patch('ui', { buildStale: true });
    toast('Triggered buildStale flag in UI store', 'info');
  },
});

// Helper to log to debug console
function logToDebugConsole(text, type = 'info') {
  const line = {
    id: Date.now() + Math.random(),
    time: new Date().toLocaleTimeString(),
    type,
    text: String(text),
  };
  debugStore.set((s) => ({
    logs: [...s.logs.slice(-50), line],
  }));
}

// ---- Secret Input Sequence Detector ---------------------------------------------------------------

let inputBuffer = '';
let resetTimer = null;

/**
 * Installs the hidden global keyboard listener for sequence `//CHTLY`.
 * Captures keystrokes globally without breaking normal inputs.
 */
export function installDebugSequenceDetector() {
  if (typeof window === 'undefined') return;

  const onKeyDown = (e) => {
    // Only capture single characters
    const k = e.key;
    if (typeof k !== 'string' || k.length !== 1) return;

    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => { inputBuffer = ''; }, IDLE_RESET_MS);

    // Append uppercase char
    inputBuffer = (inputBuffer + k.toUpperCase()).slice(-BUFFER_MAX_LENGTH);

    if (inputBuffer.endsWith(ACTIVATION_CODE) || inputBuffer.endsWith('//CHTLY')) {
      inputBuffer = '';
      toggleDebugPanel();
    }
  };

  window.addEventListener('keydown', onKeyDown, true);
  return () => window.removeEventListener('keydown', onKeyDown, true);
}

// Hook runner events only when developer panel is actively open on the combat tab
if (typeof window !== 'undefined' && battleRunner) {
  try {
    let lastEvTime = 0;
    battleRunner.on('ev', (msg) => {
      const cur = debugStore.get();
      if (!cur.open || cur.activeTab !== 'combat') return;
      const now = performance.now();
      if (now - lastEvTime < 250) return;
      lastEvTime = now;
      if (Array.isArray(msg?.ev) && msg.ev.length) {
        const sample = msg.ev.slice(0, 3).map((item) => String(item[0] || 'ev'));
        debugStore.set((s) => ({
          events: [...s.events.slice(-19), { id: Date.now() + Math.random(), time: new Date().toLocaleTimeString(), kinds: sample.join(', ') }],
        }));
      }
    });
  } catch { /* ignore */ }
}

// ---- UI Sub-Tabs -----------------------------------------------------------------------------------

function DebugAuthScreen({ s, route }) {
  const [inputVal, setInputVal] = useState('');
  const [authLogs, setAuthLogs] = useState([
    { id: 1, time: new Date().toLocaleTimeString(), type: 'info', text: 'Diagnostic console connected. Standard mode active.' },
    { id: 2, time: new Date().toLocaleTimeString(), type: 'warn', text: 'Elevated developer controls & features are locked.' },
    { id: 3, time: new Date().toLocaleTimeString(), type: 'info', text: 'Type system command in the console below to execute.' },
  ]);

  const handleSubmit = (cmdToRun = inputVal) => {
    const cmd = String(cmdToRun || '').trim();
    if (!cmd) return;
    const res = executeDebugCommand(cmd);
    const newLog = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString(),
      type: res.ok ? 'result' : 'error',
      text: res.ok ? `> ${cmd} => SUCCESS: ${res.msg}` : `> ${cmd} => FAILED: ${res.error}`,
    };
    setAuthLogs((prev) => [...prev, newLog]);
    if (res.ok) {
      setInputVal('');
    }
  };

  const conn = s.connection || {};
  const me = s.me || {};

  return html`<div class="debug-section">
    <!-- Authorization Prompt Banner -->
    <div class="debug-banner" style="border-left-color:#e68b35;background:linear-gradient(90deg,rgba(230,139,53,0.15) 0%,#141c18 100%);">
      <div class="debug-banner__info">
        <div class="debug-banner__title" style="color:#f7a250;">
          <${Icon} name="key" size="16" />
          <span>SYSTEM DIAGNOSTIC CONSOLE // RESTRICTED ACCESS</span>
          <span class="debug-banner__badge" style="background:rgba(230,139,53,0.2);color:#f7a250;border-color:rgba(230,139,53,0.4);">LOCKED</span>
        </div>
        <div class="debug-banner__desc">
          Panel saat ini berada dalam mode diagnosa standar. Masukkan kode otorisasi debug untuk mengaktifkan fungsi pengembang.
        </div>
      </div>
    </div>

    <!-- Command Input Bar -->
    <div class="debug-filter-bar">
      <div class="debug-card__label" style="font-weight:700;color:#8fa69c;display:flex;align-items:center;gap:6px;">
        <${Icon} name="edit" size="14" /> Execute Debug Command:
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" class="debug-input"
               style="font-size:13px;font-family:monospace;letter-spacing:0.05em;"
               placeholder="Enter debug command..."
               value=${inputVal}
               onInput=${(e) => setInputVal(e.target.value)}
               onKeyDown=${(e) => { if (e.key === 'Enter') handleSubmit(); }} />
        <button type="button" class="debug-btn debug-btn--primary" style="font-weight:700;" onClick=${() => handleSubmit()}>
          <${Icon} name="check" size="14" /> Execute
        </button>
      </div>
    </div>

    <!-- Standard Diagnostic Information (Layar Debug Biasa) -->
    <h3 class="debug-section__title" style="margin-top:0.4rem;">
      <${Icon} name="signal" size="14" /> System Telemetry (Diagnosa Standar)
    </h3>
    <div class="debug-grid">
      <div class="debug-card">
        <span class="debug-card__label">Active Route</span>
        <span class="debug-card__value debug-card__value--highlight">${route.toUpperCase()}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Socket Status</span>
        <span class="debug-card__value">${conn.status || 'idle'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Latency (RTT)</span>
        <span class="debug-card__value">${conn.ping != null ? `${conn.ping} ms` : '--'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Clock Offset</span>
        <span class="debug-card__value">${s.clock?.offset != null ? `${s.clock.offset} ms` : '0 ms'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Player ID</span>
        <span class="debug-card__value">${me.playerId || '(None)'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Player Name</span>
        <span class="debug-card__value">${me.name || '(None)'}</span>
      </div>
    </div>

    <!-- Diagnostic Terminal Feed -->
    <h3 class="debug-section__title" style="margin-top:0.4rem;">
      <${Icon} name="book" size="14" /> Diagnostic Terminal Logs
    </h3>
    <div class="debug-console" style="margin-top:2px;">
      <div class="debug-console__logs" style="height:120px;">
        ${authLogs.map((l) => html`
          <div key=${l.id} class=${`debug-log-line debug-log-line--${l.type}`}>
            <span style="color:#506a5f;">[${l.time}]</span> ${l.text}
          </div>
        `)}
      </div>
    </div>
  </div>`;
}

function CheatsTab({ s, route }) {
  const match = s.match?.public || null;
  const priv = s.match?.private || null;
  const currentLocked = priv?.shop?.lockedBond || null;
  const [goldenOp, setGoldenOp] = useState(false);
  const [goldenItem, setGoldenItem] = useState(false);
  const [busy, setBusy] = useState(false);

  useData('bonds', 'chess', 'items', 'assets');
  const bondsObj = data.get('bonds') || {};
  const chessObj = data.get('chess') || {};
  const itemsObj = data.get('items') || {};
  const assets = data.get('assets');

  const activeBondName = currentLocked ? (bondsObj[currentLocked]?.name || currentLocked) : null;

  const handleLaunchSoloMatch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      toast('Creating instant solo test match...', 'info');
      await net.request('room.create', { mode: 'solo', difficulty: 'FUNNY' });
      await new Promise((r) => setTimeout(r, 250));
      await net.request('room.start', {});
      toast('Test match active! All cheats are live.', 'success');
    } catch (err) {
      toast(`Match start error: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleStartRoomMatch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      toast('Starting match...', 'info');
      await net.request('room.start', {});
      toast('Match started!', 'success');
    } catch (err) {
      toast(`Start failed: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLockBond = (bondId) => {
    actions.debug('setShopLockBond', { bondId, reroll: true });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Shop locked to [${bName}]. Rolls now guarantee this bond.`, 'success');
  };

  const handleActivateBond = (bondId) => {
    actions.debug('activateBond', { bondId, layers: 20 });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Bond [${bName}] force-activated at Max Tier (+20 Layers)!`, 'success');
  };

  const handleUnlock = () => {
    actions.debug('setShopLockBond', { bondId: null, reroll: true });
    toast('Shop bond lock cleared. Reverted to standard pool.', 'info');
  };

  const quickOps = [
    { id: 'chess_char_4_22_a', name: '银灰 SilverAsh' },
    { id: 'chess_char_1_08_a', name: '德克萨斯 Texas' },
    { id: 'chess_char_5_19_a', name: '玛恩纳 Młynar' },
    { id: 'chess_char_3_01_a', name: '能天使 Exusiai' },
    { id: 'chess_char_5_11_a', name: '塞雷娅 Saria' },
    { id: 'chess_char_5_07_a', name: '史尔特尔 Surtr' },
  ];

  const quickItems = [
    { id: 'chess_item_1_01_e_a', name: '维式重锤 (Hammer)' },
    { id: 'chess_item_1_02_e_a', name: '坚守盾牌 (Shield)' },
    { id: 'chess_item_1_03_e_a', name: '盟约之币 (Coin)' },
    { id: 'chess_item_1_04_e_a', name: '随身身份牌 (Dogtag)' },
  ];

  const presets = [
    { id: 'siracusaShip', name: '叙拉古 (Siracusa)' },
    { id: 'kazimierzShip', name: '卡西米尔 (Kazimierz)' },
    { id: 'yanShip', name: '炎 (Yan)' },
    { id: 'lateranoShip', name: '拉特兰 (Laterano)' },
    { id: 'victoriaShip', name: '维多利亚 (Victoria)' },
    { id: 'kjeragShip', name: '谢拉格 (Kjerag)' },
    { id: 'sargonShip', name: '萨尔贡 (Sargon)' },
    { id: 'egirShip', name: '阿戈尔 (Aegir)' },
  ];

  return html`<div class="debug-section">
    <!-- Match Presence / Instant Launch Bar -->
    ${!match ? html`
      <div class="debug-banner" style="border-left-color:#e68b35;background:linear-gradient(90deg,rgba(230,139,53,0.15) 0%,#141c18 100%);">
        <div class="debug-banner__info">
          <div class="debug-banner__title" style="color:#f7a250;">
            <${Icon} name="warn" size="16" />
            <span>CURRENTLY OUTSIDE MATCH (SCREEN: ${route.toUpperCase()})</span>
            <span class="debug-banner__badge" style="background:rgba(230,139,53,0.2);color:#f7a250;border-color:rgba(230,139,53,0.4);">STANDBY</span>
          </div>
          <div class="debug-banner__desc">
            Gameplay cheats (Gold, Operators, Items, Shop Lock) will take effect when inside an active match.
          </div>
        </div>
        <div class="debug-controls-row">
          ${route === 'room' ? html`
            <button type="button" class="debug-btn debug-btn--primary" disabled=${busy} onClick=${handleStartRoomMatch}>
              <${Icon} name="play" size="14" /> Start Room Match Now
            </button>
          ` : html`
            <button type="button" class="debug-btn debug-btn--primary" disabled=${busy} onClick=${handleLaunchSoloMatch}>
              <${Icon} name="play" size="14" /> ⚡ Launch Instant Solo Match
            </button>
          `}
          <button type="button" class="debug-btn" onClick=${() => window.location.reload()} title="Hard reload client application">
            <${Icon} name="refresh" size="14" /> Hard Refresh App
          </button>
        </div>
      </div>
    ` : html`
      <div class="debug-banner is-locked" style="border-left-color:#4ed8af;background:linear-gradient(90deg,rgba(78,216,175,0.12) 0%,#141c18 100%);">
        <div class="debug-banner__info">
          <div class="debug-banner__title">
            <${Icon} name="sword" size="16" />
            <span>ACTIVE MATCH: ROUND ${match.round ?? '--'} · PHASE ${match.phase}</span>
            <span class="debug-banner__badge">LIVE IN GAME</span>
          </div>
          <div class="debug-banner__desc">
            Gold: <strong>${priv?.funds ?? priv?.gold ?? 0}</strong> · LP: <strong>${priv?.lp ?? 100}</strong> · Shop: <strong>Lv.${priv?.shop?.level ?? 1}</strong> · Deploy: <strong>${priv?.deployCount ?? 0}/${priv?.deployCap ?? 8}</strong> · Bond Lock: <strong>${activeBondName || 'None'}</strong>
          </div>
        </div>
        <div class="debug-controls-row">
          <button type="button" class="debug-btn debug-btn--warn" onClick=${() => { actions.debug('addFunds', { amount: 50 }); toast('+50 Gold added', 'success'); }}>
            +50 Gold
          </button>
          <button type="button" class="debug-btn debug-btn--primary" onClick=${() => { actions.debug('rerollShop', {}); toast('Shop re-rolled', 'info'); }}>
            <${Icon} name="refresh" size="14" /> Reroll Shop
          </button>
        </div>
      </div>
    `}

    <!-- 1. Gold, Board & Economy Cheats -->
    <div class="debug-filter-bar">
      <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
        <${Icon} name="crown" size="14" /> Economy, Board & Player Cheats:
      </div>
      <div class="debug-controls-row">
        <button type="button" class="debug-btn debug-btn--primary" onClick=${() => { actions.debug('addFunds', { amount: 10 }); toast('+10 Gold added', 'success'); }}>
          +10 Gold
        </button>
        <button type="button" class="debug-btn debug-btn--primary" onClick=${() => { actions.debug('addFunds', { amount: 50 }); toast('+50 Gold added', 'success'); }}>
          +50 Gold
        </button>
        <button type="button" class="debug-btn debug-btn--primary" onClick=${() => { actions.debug('addFunds', { amount: 100 }); toast('+100 Gold added', 'success'); }}>
          +100 Gold
        </button>
        <button type="button" class="debug-btn debug-btn--warn" onClick=${() => { actions.debug('addFunds', { amount: 999 }); toast('+999 Max Gold added', 'success'); }}>
          +999 Max Gold
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('setShopLevel', { level: 6 }); toast('Shop set to Max Lv.6', 'success'); }}>
          Max Shop Lv.6
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('setLp', { lp: 100 }); toast('LP restored to 100', 'success'); }}>
          Full 100 LP
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('deployCap', { delta: 2 }); toast('+2 Deploy Limit added', 'success'); }}>
          +2 Deploy Cap
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('promoteBoard', {}); toast('All board operators promoted to 2★ Elite!', 'success'); }}>
          ⭐ Promote Board to 2★
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('allLayers', { amount: 25 }); toast('+25 Layers added to active bonds!', 'success'); }}>
          +25 Bond Layers
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('rerollShop', {}); toast('Shop re-rolled', 'info'); }}>
          <${Icon} name="refresh" size="14" /> Free Reroll
        </button>
      </div>
    </div>

    <!-- 1.5 Endless Match Progression Cheats -->
    <div class="debug-filter-bar">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
          <${Icon} name="infinity" size="14" /> Endless Match Mode (Simulasi Wave Tanpa Akhir):
          <span class="debug-banner__badge" style=${match?.endlessMode ? 'border-color:#4ed8af;color:#4ed8af;background:rgba(78,216,175,0.15);' : 'border-color:#6e857b;color:#6e857b;'}>
            ${match?.endlessMode ? `ENABLED · WAVE ${match?.round ?? 1}` : 'DISABLED'}
          </span>
        </div>
        <button type="button" class="debug-pill" style="border-color:#4ed8af;color:#4ed8af;"
                onClick=${() => debugStore.set({ activeTab: 'endless' })}>
          Open Endless Sandbox ➔
        </button>
      </div>
      <div class="debug-controls-row">
        <button type="button" class=${`debug-btn ${match?.endlessMode ? 'debug-btn--warn' : 'debug-btn--primary'}`}
                onClick=${() => {
                  actions.debug('toggleEndless', {});
                  toast(match?.endlessMode ? 'Endless mode disabled' : 'Endless mode enabled! Match will continue infinitely beyond Round 15.', 'info');
                }}>
          <${Icon} name="infinity" size="14" /> ${match?.endlessMode ? 'Turn OFF Endless' : 'Turn ON Endless Mode'}
        </button>
        <button type="button" class="debug-btn" onClick=${() => {
          const nextR = (match?.round || 1) + 5;
          actions.debug('skipToRound', { round: nextR });
          toast(`Skipped forward to Round ${nextR}`, 'info');
        }}>
          Skip +5 Waves
        </button>
        <button type="button" class="debug-btn debug-btn--warn" onClick=${() => {
          actions.debug('skipToRound', { round: 15 });
          toast('Jumped to Round 15 Boss Wave!', 'warn');
        }}>
          👑 Jump to Round 15 Boss
        </button>
        <button type="button" class="debug-btn" onClick=${() => {
          actions.debug('skipPrep', {});
          toast('Skipped current phase!', 'info');
        }}>
          ⏭ Skip Phase / Start Combat
        </button>
      </div>
    </div>

    <!-- 2. Shop Lock & Force Activate Bond Shortcuts -->
    <div class="debug-filter-bar">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
          <${Icon} name="shield" size="14" /> Bond Cheats & Shop Lock (${currentLocked ? `Shop Locked: ${activeBondName}` : 'Standard Pool'}):
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button type="button" class="debug-pill" onClick=${() => { actions.debug('unlockAllBonds', {}); toast('All banned/disabled bonds unlocked for this match!', 'success'); }}>
            🔓 Unban All Bonds
          </button>
          <button type="button" class="debug-pill" style="border-color:#4ed8af;color:#4ed8af;"
                  onClick=${() => debugStore.set({ activeTab: 'shopLock' })}>
            All Bonds & Activator ➔
          </button>
        </div>
      </div>
      <div style="font-size:11px;color:#8ea398;margin-bottom:2px;">Click to Lock Shop & Reroll, or use ⚡ to Force-Activate Bond at Max Tier:</div>
      <div class="debug-pill-group">
        ${presets.map((p) => html`
          <div key=${p.id} style="display:inline-flex;align-items:center;gap:2px;">
            <button type="button"
                    class=${`debug-pill ${currentLocked === p.id ? 'is-active' : ''}`}
                    onClick=${() => handleLockBond(p.id)}
                    title="Lock shop to roll operators of this bond">
              🔒 ${p.name}
            </button>
            <button type="button"
                    class="debug-pill"
                    style="border-color:#ffd043;color:#ffd043;padding:2px 6px;"
                    onClick=${() => handleActivateBond(p.id)}
                    title="Force-activate this bond at Max Tier (+20 Layers)">
              ⚡
            </button>
          </div>
        `)}
        ${currentLocked ? html`
          <button type="button" class="debug-pill" style="border-color:#ff8585;color:#ff8585;" onClick=${handleUnlock}>
            ✕ Clear Shop Lock
          </button>
        ` : null}
      </div>
    </div>

    <!-- 3. Quick Operator Spawner -->
    <div class="debug-filter-bar">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
          <${Icon} name="rook" size="14" /> Quick Spawn Top Operators:
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#e8f2ed;font-size:12px;">
            <input type="checkbox" checked=${goldenOp} onChange=${(e) => setGoldenOp(e.target.checked)} />
            <span style=${goldenOp ? 'color:#ffd043;font-weight:700;' : ''}>2★ Elite Variant</span>
          </label>
          <button type="button" class="debug-pill" style="border-color:#4ed8af;color:#4ed8af;"
                  onClick=${() => debugStore.set({ activeTab: 'operators' })}>
            All Operators ➔
          </button>
        </div>
      </div>
      <div class="debug-controls-row">
        ${quickOps.map((op) => {
          const rec = chessObj[op.id] || op;
          const avatarUrl = chessAvatarUrl(assets, rec);
          return html`
            <button key=${op.id} type="button" class="debug-btn"
                    onClick=${() => {
                      actions.debug('addChess', { chessId: op.id, count: 1, golden: goldenOp });
                      toast(`Spawned ${op.name} (${goldenOp ? '2★' : '1★'}) to bench`, 'success');
                    }}>
              ${avatarUrl ? html`<img src=${avatarUrl} style="width:16px;height:16px;border-radius:2px;object-fit:cover;" alt="" />` : null}
              <span>+ ${op.name}</span>
            </button>
          `;
        })}
      </div>
    </div>

    <!-- 4. Quick Item Spawner -->
    <div class="debug-filter-bar">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
        <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
          <${Icon} name="plus" size="14" /> Quick Add Items & Equipment:
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#e8f2ed;font-size:12px;">
            <input type="checkbox" checked=${goldenItem} onChange=${(e) => setGoldenItem(e.target.checked)} />
            <span style=${goldenItem ? 'color:#ffd043;font-weight:700;' : ''}>Golden Upgraded</span>
          </label>
          <button type="button" class="debug-pill" style="border-color:#4ed8af;color:#4ed8af;"
                  onClick=${() => debugStore.set({ activeTab: 'items' })}>
            Browse All Items ➔
          </button>
        </div>
      </div>
      <div class="debug-controls-row">
        ${quickItems.map((it) => {
          const rec = itemsObj[it.id] || it;
          const iconUrl = itemIconUrl(assets, rec);
          return html`
            <button key=${it.id} type="button" class="debug-btn"
                    onClick=${() => {
                      actions.debug('addItem', { itemId: it.id, count: 1, golden: goldenItem });
                      toast(`Added ${it.name} to inventory`, 'success');
                    }}>
              ${iconUrl ? html`<img src=${iconUrl} style="width:16px;height:16px;object-fit:contain;" alt="" />` : null}
              <span>+ ${it.name}</span>
            </button>
          `;
        })}
      </div>
    </div>

    <!-- 5. Simulation & Audio Controls -->
    <div class="debug-filter-bar">
      <div class="debug-card__label" style="font-weight:700;color:#4ed8af;display:flex;align-items:center;gap:6px;">
        <${Icon} name="play" size="14" /> Simulation Speed & Audio Diagnostics:
      </div>
      <div class="debug-controls-row">
        ${[0.5, 1, 2, 3, 5, 10].map((sp) => html`
          <button key=${sp} type="button" class="debug-btn"
                  onClick=${() => {
                    battleRunner?.setSpeed?.(sp);
                    toast(`Simulation speed set to ${sp}x`, 'info');
                  }}>
            ${sp}x Speed
          </button>
        `)}
        <button type="button" class="debug-btn" onClick=${() => {
          try { audio.sfx?.('ready'); toast('SFX test triggered', 'info'); } catch { /* ignore */ }
        }}>
          Test SFX
        </button>
      </div>
    </div>
  </div>`;
}

function EndlessSimulationTab({ s, route }) {
  const eState = useStore((x) => x, Object.is, endlessStore);
  const match = s.match?.public || null;
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResult, setBenchResult] = useState(null);

  useData('assets');
  const assets = data.get('assets');

  const handleStartOrToggle = () => {
    if (eState.status === 'running') {
      pauseEndlessSimulation();
    } else if (eState.status === 'paused') {
      resumeEndlessSimulation();
    } else {
      startEndlessSimulation();
    }
  };

  const handleNextWave = () => {
    startEndlessSimulation(eState.wave + 1);
  };

  const handleRunBenchmark = (waves) => {
    setBenchmarking(true);
    setTimeout(() => {
      try {
        const res = runBatchEndlessBenchmark(waves);
        setBenchResult(res);
        toast(`Benchmark finished: Survived ${res.maxWaveSurvived}/${waves} waves!`, 'success');
      } catch (err) {
        toast(`Benchmark failed: ${err.message}`, 'error');
      } finally {
        setBenchmarking(false);
      }
    }, 50);
  };

  const isBossWave = eState.wave > 0 && eState.wave % eState.bossInterval === 0;

  return html`<div class="debug-section">
    <!-- Top Hero Banner -->
    <div class="debug-banner" style="border-left-color:#4ed8af;background:linear-gradient(90deg,rgba(78,216,175,0.18) 0%,#141c18 100%);">
      <div class="debug-banner__info">
        <div class="debug-banner__title">
          <${Icon} name="infinity" size="18" />
          <span>ENDLESS COMBAT SIMULATION & SQUAD BENCHMARK</span>
          <span class="debug-banner__badge" style="background:rgba(78,216,175,0.2);color:#4ed8af;border-color:#4ed8af;">
            BEST RECORD: WAVE ${eState.maxWaveRecord}
          </span>
        </div>
        <div class="debug-banner__desc">
          Simulasi pertempuran tanpa akhir (infinite scaling waves). Uji ketahanan squad, analisis DPS komparatif, dan uji stress-test 100+ gelombang musuh Arknights.
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        ${match ? html`
          <button type="button" class=${`debug-btn ${match.endlessMode ? 'debug-btn--warn' : 'debug-btn--primary'}`}
                  onClick=${() => {
                    actions.debug('toggleEndless', {});
                    toast(match.endlessMode ? 'Match Endless Mode OFF' : 'Match Endless Mode ON', 'info');
                  }}>
            <${Icon} name="infinity" size="12" /> Match Endless: ${match.endlessMode ? 'ON' : 'OFF'}
          </button>
          <button type="button" class="debug-btn" onClick=${() => importLiveBoard(s.match)}>
            <${Icon} name="refresh" size="12" /> Import Live Board
          </button>
        ` : null}
      </div>
    </div>

    <!-- 1. Squad Preset Selector -->
    <div class="debug-filter-bar">
      <div class="debug-card__label" style="font-weight:700;color:#8fa69c;display:flex;align-items:center;gap:6px;">
        <${Icon} name="user" size="14" /> Choose Simulation Squad Preset:
      </div>
      <div class="debug-controls-row">
        ${PRESET_SQUADS.map((p) => html`
          <button key=${p.id} type="button" class=${`debug-btn ${eState.presetId === p.id ? 'is-active' : ''}`}
                  onClick=${() => selectPresetSquad(p.id)}>
            ${p.name.split(' (')[0]}
          </button>
        `)}
        ${match ? html`
          <button type="button" class="debug-btn debug-btn--warn" onClick=${() => importLiveBoard(s.match)}>
            📥 Import Current Match Board
          </button>
        ` : null}
      </div>
    </div>

    <!-- 2. Main Simulation Controls Bar -->
    <div class="debug-filter-bar">
      <div class="debug-controls-row" style="justify-content:space-between;width:100%;">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button type="button" class=${`debug-btn ${eState.status === 'running' ? 'debug-btn--warn' : 'debug-btn--primary'}`}
                  style="font-weight:700;min-width:120px;"
                  onClick=${handleStartOrToggle}>
            <${Icon} name=${eState.status === 'running' ? 'dots' : 'play'} size="14" />
            ${eState.status === 'running' ? 'Pause Sim' : (eState.status === 'paused' ? 'Resume Sim' : 'Start Simulation')}
          </button>

          <button type="button" class="debug-btn" onClick=${handleNextWave} title="Advance directly to next wave">
            <${Icon} name="chevronRight" size="14" /> Next Wave (${eState.wave + 1})
          </button>

          <button type="button" class="debug-btn" onClick=${healSquad} title="Heal and restore SP of all operators">
            💚 Heal & Revive
          </button>

          <button type="button" class="debug-btn" onClick=${resetEndlessSimulation} title="Reset to wave 1">
            <${Icon} name="refresh" size="14" /> Reset
          </button>
        </div>

        <!-- Sim Speed Toggles -->
        <div style="display:flex;gap:4px;align-items:center;">
          <span class="debug-card__label">Speed:</span>
          ${[1, 2, 5, 10, 20].map((sp) => html`
            <button key=${sp} type="button" class=${`debug-pill ${eState.speed === sp ? 'is-active' : ''}`}
                    onClick=${() => setSimSpeed(sp)}>
              ${sp}x
            </button>
          `)}
        </div>
      </div>

      <!-- Settings row -->
      <div class="debug-filter-bar__row" style="margin-top:4px;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#e8f2ed;cursor:pointer;">
            <input type="checkbox" checked=${eState.autoNext}
                   onChange=${(e) => endlessStore.set({ autoNext: e.target.checked })} />
            <span>Auto Next Wave</span>
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#ffd043;cursor:pointer;">
            <input type="checkbox" checked=${eState.godMode}
                   onChange=${(e) => endlessStore.set({ godMode: e.target.checked })} />
            <span>God Mode (No Squad Damage)</span>
          </label>
          <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#38b6ff;cursor:pointer;">
            <input type="checkbox" checked=${eState.fastSp}
                   onChange=${(e) => endlessStore.set({ fastSp: e.target.checked })} />
            <span>Rapid SP / Fast Ults</span>
          </label>
        </div>

        <div style="display:flex;align-items:center;gap:8px;">
          <span class="debug-card__label">Scaling:</span>
          <select class="debug-input" style="padding:2px 6px;width:auto;"
                  value=${eState.scalingRate}
                  onChange=${(e) => endlessStore.set({ scalingRate: parseFloat(e.target.value) })}>
            <option value="1.05">Casual (+5%/wave)</option>
            <option value="1.10">Standard (+10%/wave)</option>
            <option value="1.20">Calamity (+20%/wave)</option>
            <option value="1.35">Inferno (+35%/wave)</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 3. Visual Interactive Combat Arena -->
    <div class="debug-endless-arena">
      <!-- Left: Squad -->
      <div class="debug-endless-col">
        <div class="debug-endless-col__title">
          <span>RHODES ISLAND SQUAD</span>
          <span style="color:#4ed8af;">${eState.squadAliveCount}/${eState.squadTotalCount} ALIVE</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;padding-right:2px;">
          ${eState.operators.map((op) => {
            const hpPct = Math.max(0, Math.min(100, Math.round((op.curHp / op.maxHp) * 100)));
            const spPct = Math.max(0, Math.min(100, Math.round((op.curSp / op.maxSp) * 100)));
            const avatarUrl = chessAvatarUrl(assets, { id: op.id });
            return html`
              <div key=${op.uid} class=${`debug-endless-op-card ${!op.alive ? 'is-dead' : ''}`}>
                <div class="debug-endless-op-header">
                  <div style="display:flex;align-items:center;gap:6px;">
                    ${avatarUrl
                      ? html`<img src=${avatarUrl} style="width:20px;height:20px;border-radius:2px;object-fit:cover;" alt="" />`
                      : html`<${Icon} name="user" size="14" />`}
                    <span style="font-weight:700;">${op.name}</span>
                    <span class="debug-tag" style="font-size:9px;">${op.tier}★ ${op.prof}</span>
                  </div>
                  <div style="font-size:11px;color:#4ed8af;font-family:monospace;">
                    ${op.dmgDealt.toLocaleString()} DMG
                  </div>
                </div>

                <div class="debug-endless-bars">
                  <div class="debug-endless-bar-wrap" title="HP: ${op.curHp}/${op.maxHp}">
                    <div class=${`debug-endless-bar-fill ${hpPct < 30 ? 'debug-endless-bar-fill--hp-low' : 'debug-endless-bar-fill--hp'}`}
                         style=${`width:${hpPct}%;`}></div>
                  </div>
                  <div class="debug-endless-bar-wrap" title="SP: ${Math.round(op.curSp)}/${op.maxSp} (${op.skillName})">
                    <div class="debug-endless-bar-fill debug-endless-bar-fill--sp"
                         style=${`width:${spPct}%;`}></div>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>

      <!-- Center: VS / Telemetry HUD -->
      <div class="debug-endless-center">
        <span class="debug-card__label" style="font-size:10px;">CURRENT WAVE</span>
        <div class="debug-endless-wave-num">${eState.wave}</div>
        <span class=${`debug-endless-wave-badge ${isBossWave ? 'debug-endless-wave-badge--boss' : ''}`}>
          ${isBossWave ? '👑 BOSS ASSAULT' : 'STANDARD WAVE'}
        </span>
        ${eState.enemies[0]?.waveTheme ? html`
          <div style="font-size:10px;color:#4ed8af;font-weight:600;margin-top:4px;text-align:center;">
            ${eState.enemies[0].waveTheme}
          </div>
        ` : null}

        <div style="font-size:10px;color:#7e968b;margin-top:6px;line-height:1.4;">
          <div>Time: <strong>${eState.waveTimer.toFixed(1)}s</strong></div>
          <div>Slain: <strong>${eState.totalEnemiesKilled}</strong></div>
          <div>Total DMG: <strong>${(eState.totalDmgDealt / 1000).toFixed(1)}k</strong></div>
        </div>

        ${eState.status === 'wiped' ? html`
          <span style="color:#ff6b6b;font-weight:700;font-size:11px;margin-top:4px;">💀 SQUAD WIPED</span>
          <button type="button" class="debug-btn debug-btn--warn debug-btn-xs" onClick=${() => startEndlessSimulation(eState.wave)}>
            Retry Wave
          </button>
        ` : (eState.status === 'victory' ? html`
          <span style="color:#4ed8af;font-weight:700;font-size:11px;margin-top:4px;">🏆 WAVE CLEARED!</span>
        ` : null)}
      </div>

      <!-- Right: Enemies -->
      <div class="debug-endless-col">
        <div class="debug-endless-col__title">
          <span>HOSTILE TARGETS</span>
          <span style="color:#ff8585;">${eState.enemies.filter((e) => e.alive).length} REMAINING</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto;padding-right:2px;">
          ${eState.enemies.map((e) => {
            const hpPct = Math.max(0, Math.min(100, Math.round((e.curHp / e.maxHp) * 100)));
            return html`
              <div key=${e.uid} class=${`debug-endless-enemy-card ${e.isBoss ? 'is-boss' : ''} ${!e.alive ? 'is-dead' : ''}`} title=${e.trait || ''}>
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;gap:4px;">
                  <span style=${e.isBoss ? 'color:#ff8585;font-weight:700;' : (e.isElite ? 'color:#ffd043;font-weight:600;' : 'color:#d6e2dc;')}>
                    ${e.isBoss ? '👑 ' : (e.isElite ? '⭐ ' : '')}${e.name}
                    ${e.tag ? html`<span style="margin-left:4px;padding:1px 4px;border-radius:3px;font-size:9px;background:rgba(255,255,255,0.08);color:#9adbc5;font-family:monospace;">${e.tag}</span>` : null}
                  </span>
                  <span style="font-size:10px;color:#8da499;font-family:monospace;white-space:nowrap;">
                    ${e.curHp.toLocaleString()} HP
                  </span>
                </div>
                ${e.trait ? html`<div style="font-size:9px;color:#7e968b;line-height:1.2;">${e.trait} · ATK ${e.atk} / DEF ${e.def}</div>` : null}
                <div class="debug-endless-bar-wrap">
                  <div class="debug-endless-bar-fill debug-endless-bar-fill--hp-low" style=${`width:${hpPct}%;`}></div>
                </div>
              </div>
            `;
          })}
        </div>
      </div>
    </div>

    <!-- 4. Real-time Combat Action Feed -->
    <h3 class="debug-section__title" style="margin-top:0.8rem;">
      <${Icon} name="bolt" size="14" /> Live Battle Event Stream
    </h3>
    <div class="debug-endless-feed">
      ${eState.recentDmgFeed.length ? eState.recentDmgFeed.map((item, idx) => html`
        <div key=${idx} class="debug-endless-feed-item">${item}</div>
      `) : html`<span style="color:#506a5f;">No combat actions recorded yet. Start simulation to observe live ticks.</span>`}
    </div>

    <!-- 5. Headless Batch Stress-Test / Deep Benchmark -->
    <h3 class="debug-section__title" style="margin-top:0.8rem;">
      <${Icon} name="signal" size="14" /> Instant Headless Stress-Test & Benchmark
    </h3>
    <div class="debug-filter-bar">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button type="button" class="debug-btn debug-btn--primary" disabled=${benchmarking}
                onClick=${() => handleRunBenchmark(20)}>
          ${benchmarking ? 'Simulating...' : '⚡ Run 20-Wave Stress Test'}
        </button>
        <button type="button" class="debug-btn debug-btn--primary" disabled=${benchmarking}
                onClick=${() => handleRunBenchmark(50)}>
          ${benchmarking ? 'Simulating...' : '⚡ Run 50-Wave Deep Benchmark'}
        </button>
        <button type="button" class="debug-btn debug-btn--warn" disabled=${benchmarking}
                onClick=${() => handleRunBenchmark(100)}>
          ${benchmarking ? 'Simulating...' : '👑 Run 100-Wave Ultra Benchmark'}
        </button>
      </div>

      ${benchResult ? html`
        <div class="debug-benchmark-result">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-weight:700;color:#4ed8af;font-size:13px;">BENCHMARK TELEMETRY RESULTS</span>
            <span class="debug-tag">Tested ${benchResult.wavesTested} Waves</span>
          </div>
          <div class="debug-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
            <div class="debug-card">
              <span class="debug-card__label">Max Wave Cleared</span>
              <span class="debug-card__value debug-card__value--highlight">Wave ${benchResult.maxWaveSurvived}</span>
            </div>
            <div class="debug-card">
              <span class="debug-card__label">Total Enemies Defeated</span>
              <span class="debug-card__value">${benchResult.totalKills}</span>
            </div>
            <div class="debug-card">
              <span class="debug-card__label">Cumulative Damage</span>
              <span class="debug-card__value debug-card__value--warn">${(benchResult.totalDmg / 1000).toFixed(1)}k DMG</span>
            </div>
            <div class="debug-card">
              <span class="debug-card__label">MVP Damage Dealer</span>
              <span class="debug-card__value">${benchResult.mvpName} (${(benchResult.mvpDmg / 1000).toFixed(1)}k)</span>
            </div>
          </div>
        </div>
      ` : null}
    </div>

    <!-- 6. Wave History Log Table -->
    ${eState.waveLog.length ? html`
      <h3 class="debug-section__title" style="margin-top:0.8rem;">
        <${Icon} name="book" size="14" /> Wave Clears History (${eState.waveLog.length})
      </h3>
      <div class="debug-console__logs" style="height:120px;">
        ${eState.waveLog.map((log) => html`
          <div key=${log.id} class="debug-log-line">
            <span style="color:#4ed8af;">[WAVE ${log.wave}]</span> ${' '}
            <span style="color:#e0ece7;">${log.isBoss ? '👑 Boss Cleared' : 'Wave Cleared'} in ${log.clearTime}s</span> · ${' '}
            <span style="color:#ffd043;">MVP: ${log.mvpName} (${(log.mvpDmg / 1000).toFixed(1)}k DMG)</span> · ${' '}
            <span style="color:#788f85;">Casualties: ${log.casualtyCount}</span>
          </div>
        `)}
      </div>
    ` : null}
  </div>`;
}

function ShopLockTab({ s }) {
  const match = s.match?.public || null;
  const priv = s.match?.private || null;
  const currentLocked = priv?.shop?.lockedBond || null;
  const [filter, setFilter] = useState('');
  const [category, setCategory] = useState('ALL');

  useData('bonds', 'chess', 'assets');
  const bondsObj = data.get('bonds') || {};
  const chessObj = data.get('chess') || {};
  const assets = data.get('assets');

  // Map active player bonds by bondId for live status display
  const playerBondMap = useMemo(() => {
    const map = {};
    for (const pb of priv?.bonds || []) {
      if (pb && pb.bondId) map[pb.bondId] = pb;
    }
    return map;
  }, [priv?.bonds]);

  const bondsList = useMemo(() => {
    return Object.values(bondsObj).map((b) => ({
      id: b.bondId || b.id,
      name: b.name || b.bondId,
      desc: b.desc || b.effectDesc || '',
      isCore: !!b.isCore,
      members: Array.isArray(b.visibleMembers) && b.visibleMembers.length
        ? b.visibleMembers
        : (Array.isArray(b.members) ? b.members : []),
      iconId: b.iconId,
    }));
  }, [bondsObj]);

  const filteredBonds = useMemo(() => {
    return bondsList.filter((b) => {
      if (category === 'FACTIONS' && !b.isCore) return false;
      if (category === 'REGULAR' && b.isCore) return false;
      if (filter) {
        const q = filter.toLowerCase().trim();
        const matchesName = (b.name || '').toLowerCase().includes(q);
        const matchesId = (b.id || '').toLowerCase().includes(q);
        const matchesDesc = (b.desc || '').toLowerCase().includes(q);
        return matchesName || matchesId || matchesDesc;
      }
      return true;
    });
  }, [bondsList, category, filter]);

  const handleLockBond = (bondId, reroll = true) => {
    actions.debug('setShopLockBond', { bondId, reroll });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Shop locked to [${bName}]. All rolls now guarantee this bond.`, 'success');
  };

  const handleUnlock = () => {
    actions.debug('setShopLockBond', { bondId: null, reroll: true });
    toast('Shop bond lock cleared. Reverted to standard pool.', 'info');
  };

  const handleActivateBond = (bondId) => {
    actions.debug('activateBond', { bondId, layers: 20 });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Activated [${bName}] at Max Tier (+20 Layers)!`, 'success');
  };

  const handleDeactivateBond = (bondId) => {
    actions.debug('deactivateBond', { bondId });
    const bName = bondId ? (bondsObj[bondId]?.name || bondId) : 'All Bonds';
    toast(`Cleared forced bond bonus for [${bName}].`, 'info');
  };

  const handleSpawnBondOps = (bondId, golden = false) => {
    actions.debug('spawnBondOps', { bondId, count: 6, golden, deploy: true });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Deployed [${bName}] operators to board!`, 'success');
  };

  const handleAddBondLayers = (bondId, delta = 25) => {
    actions.debug('layers', { bondId, delta });
    const bName = bondsObj[bondId]?.name || bondId;
    toast(`Added +${delta} layers to [${bName}]!`, 'success');
  };

  const activeBondName = currentLocked ? (bondsObj[currentLocked]?.name || currentLocked) : null;

  const presets = [
    { id: 'siracusaShip', name: '叙拉古 (Siracusa)' },
    { id: 'kazimierzShip', name: '卡西米尔 (Kazimierz)' },
    { id: 'yanShip', name: '炎 (Yan)' },
    { id: 'lateranoShip', name: '拉特兰 (Laterano)' },
    { id: 'victoriaShip', name: '维多利亚 (Victoria)' },
    { id: 'kjeragShip', name: '谢拉格 (Kjerag)' },
    { id: 'sargonShip', name: '萨尔贡 (Sargon)' },
    { id: 'egirShip', name: '阿戈尔 (Aegir)' },
  ];

  return html`<div class="debug-section">
    <!-- Active Status Banner -->
    <div class=${`debug-banner ${currentLocked ? 'is-locked' : ''}`}>
      <div class="debug-banner__info">
        <div class="debug-banner__title">
          <${Icon} name=${currentLocked ? 'key' : 'shield'} size="16" />
          <span>${currentLocked ? `SHOP LOCKED: ${activeBondName}` : 'BOND CONTROL & SHOP LOCK'}</span>
          <span class="debug-banner__badge">${currentLocked ? 'LOCKED' : 'STANDARD POOL'}</span>
        </div>
        <div class="debug-banner__desc">
          ${currentLocked
            ? `Shop terkunci ke [${activeBondName}]. Setiap reroll akan memprioritaskan operator dari bond ini sesuai level Dispatch Center (tingkat kelayakan tier terjamin, misal Lv.1 tidak akan memunculkan T6).`
            : 'Kunci shop ke bond tertentu, aktifkan bond langsung ke Max Tier, atau deploy squad bond. Reroll shop tetap mematuhi aturan level Dispatch Center (misal Lv.1 tidak akan mendapat operator T6).'}
        </div>
      </div>
      <div class="debug-controls-row">
        ${currentLocked ? html`
          <button type="button" class="debug-btn debug-btn--warn" onClick=${handleUnlock}>
            <${Icon} name="close" size="14" /> Unlock Shop
          </button>
          <button type="button" class="debug-btn debug-btn--primary" onClick=${() => { actions.debug('rerollShop', {}); toast('Shop re-rolled', 'info'); }}>
            <${Icon} name="refresh" size="14" /> Reroll Now
          </button>
        ` : html`
          <button type="button" class="debug-btn debug-btn--primary" onClick=${() => handleLockBond('siracusaShip')}>
            Quick Lock: 叙拉古 (Siracusa)
          </button>
        `}
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('unlockAllBonds', {}); toast('All banned/inactive bonds unlocked!', 'success'); }}>
          🔓 Unban All Bonds
        </button>
        <button type="button" class="debug-btn" onClick=${() => handleDeactivateBond(null)}>
          Reset Forced Bonds
        </button>
      </div>
    </div>

    <!-- Quick Presets -->
    <div style="display:flex;flex-direction:column;gap:4px;">
      <span class="debug-card__label" style="font-weight:700;">Faction Quick Presets (🔒 Lock Shop · ⚡ Force Activate):</span>
      <div class="debug-pill-group">
        ${presets.map((p) => html`
          <div key=${p.id} style="display:inline-flex;align-items:center;gap:2px;">
            <button type="button"
                    class=${`debug-pill ${currentLocked === p.id ? 'is-active' : ''}`}
                    onClick=${() => handleLockBond(p.id)}>
              🔒 ${p.name}
            </button>
            <button type="button"
                    class="debug-pill"
                    style="border-color:#ffd043;color:#ffd043;padding:2px 6px;"
                    onClick=${() => handleActivateBond(p.id)}
                    title="Force-activate this bond at Max Tier">
              ⚡
            </button>
          </div>
        `)}
        ${currentLocked ? html`
          <button type="button" class="debug-pill" style="border-color:#ff8585;color:#ff8585;" onClick=${handleUnlock}>
            ✕ Clear Lock
          </button>
        ` : null}
      </div>
    </div>

    <!-- Match Utility Cheats -->
    <div class="debug-filter-bar">
      <div class="debug-card__label" style="font-weight:700;">Match Cheats & Utilities:</div>
      <div class="debug-controls-row">
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('addFunds', { amount: 50 }); toast('+50 Funds added', 'success'); }}>
          +50 Gold
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('setShopLevel', { level: 6 }); toast('Shop set to Max Lv.6', 'success'); }}>
          Max Shop Lv.6
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('allLayers', { amount: 25 }); toast('+25 Layers added to active bonds!', 'success'); }}>
          +25 All Active Layers
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('allLayers', { amount: 100 }); toast('+100 Layers added to active bonds!', 'success'); }}>
          +100 All Active Layers
        </button>
        <button type="button" class="debug-btn" onClick=${() => { actions.debug('rerollShop', {}); toast('Shop re-rolled', 'info'); }}>
          Re-roll Shop
        </button>
      </div>
    </div>

    <!-- Bond Filter Bar -->
    <div class="debug-filter-bar">
      <div class="debug-filter-bar__row">
        <input type="text" class="debug-input" placeholder="Search bonds (e.g. 叙拉古, siracusa, 卡西米尔, 炎, 狙击)..."
               value=${filter} onInput=${(e) => setFilter(e.target.value)} />
        <div class="debug-pill-group">
          ${['ALL', 'FACTIONS', 'REGULAR'].map((c) => html`
            <button key=${c} type="button" class=${`debug-pill ${category === c ? 'is-active' : ''}`}
                    onClick=${() => setCategory(c)}>
              ${c}
            </button>
          `)}
        </div>
      </div>
    </div>

    <!-- Bonds List Grid -->
    <div class="debug-grid-cards">
      ${filteredBonds.map((b) => {
        const isCur = currentLocked === b.id;
        const pb = playerBondMap[b.id] || null;
        const isActive = !!(pb && pb.active);
        const iconUrl = bondIconUrl(assets, b.id);
        const memberNames = b.members.slice(0, 7).map((mId) => chessObj[mId]?.name || mId).filter(Boolean);
        return html`
          <div key=${b.id} class=${`debug-bond-card ${isCur || isActive ? 'is-locked' : ''}`}>
            <div class="debug-bond-card__header">
              <div class="debug-bond-card__title">
                ${iconUrl ? html`<img src=${iconUrl} style="width:20px;height:20px;object-fit:contain;" alt="" />` : null}
                <span>${b.name}</span>
                <span class="debug-tag">${b.isCore ? 'Faction' : 'Regular'}</span>
              </div>
              <div style="display:flex;gap:4px;align-items:center;">
                ${isActive ? html`<span class="debug-banner__badge" style="border-color:#ffd043;color:#ffd043;">ACTIVE T${pb.tier || 1} (${pb.count}${pb.layers ? ` · ${pb.layers}L` : ''})</span>` : null}
                ${isCur ? html`<span class="debug-banner__badge">SHOP LOCKED</span>` : null}
              </div>
            </div>

            <div class="debug-bond-card__members">
              <span style="color:#6e857b;">Members (${b.members.length}): </span>
              ${memberNames.join(', ')}${b.members.length > 7 ? '...' : ''}
            </div>

            <div style="font-size:11px;color:#8ea398;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${b.desc}
            </div>

            <div style="margin-top:auto;padding-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
              ${isCur ? html`
                <button type="button" class="debug-btn debug-btn--warn debug-btn-xs" style="flex:1;" onClick=${handleUnlock}>
                  Unlock Shop
                </button>
              ` : html`
                <button type="button" class="debug-btn debug-btn--primary debug-btn-xs" style="flex:1;"
                        onClick=${() => handleLockBond(b.id)}>
                  🔒 Lock Shop
                </button>
              `}
              <button type="button" class="debug-btn debug-btn-xs" style="border-color:#ffd043;color:#ffd043;"
                      title="Force activate this bond at Max Tier (+20 Layers)"
                      onClick=${() => handleActivateBond(b.id)}>
                ⚡ Activate
              </button>
              <button type="button" class="debug-btn debug-btn-xs"
                      title="Deploy operators of this bond to board"
                      onClick=${() => handleSpawnBondOps(b.id, false)}>
                ⚔ Spawn Squad
              </button>
              <button type="button" class="debug-btn debug-btn-xs"
                      title="Add +25 Layers to this bond"
                      onClick=${() => handleAddBondLayers(b.id, 25)}>
                +25L
              </button>
            </div>
          </div>
        `;
      })}
    </div>
  </div>`;
}

function OperatorAdderTab({ s }) {
  const match = s.match?.public || null;
  const [filter, setFilter] = useState('');
  const [tier, setTier] = useState('ALL');
  const [prof, setProf] = useState('ALL');
  const [golden, setGolden] = useState(false);
  const [count, setCount] = useState(1);

  useData('chess', 'assets', 'bonds');
  const chessObj = data.get('chess') || {};
  const bondsObj = data.get('bonds') || {};
  const assets = data.get('assets');

  const baseOperators = useMemo(() => {
    const list = Object.entries(chessObj)
      .map(([key, c]) => ({
        ...c,
        id: c.chessId || c.id || key,
      }))
      .filter((c) => !c.isGolden && !c.isDiy && !c.isHidden);
    return list.sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }, [chessObj]);

  const filtered = useMemo(() => {
    return baseOperators.filter((c) => {
      if (tier !== 'ALL' && c.tier !== Number(tier)) return false;
      if (prof !== 'ALL' && String(c.profession || '').toUpperCase() !== prof) return false;
      if (filter) {
        const q = filter.toLowerCase().trim();
        const matchesName = (c.name || '').toLowerCase().includes(q);
        const matchesAppellation = (c.appellation || '').toLowerCase().includes(q);
        const matchesId = (c.id || '').toLowerCase().includes(q);
        const matchesCharId = (c.charId || '').toLowerCase().includes(q);
        const matchesBonds = Array.isArray(c.bonds) && c.bonds.some((bId) => {
          const b = bondsObj[bId];
          return (b?.name || bId).toLowerCase().includes(q);
        });
        return matchesName || matchesAppellation || matchesId || matchesCharId || matchesBonds;
      }
      return true;
    });
  }, [baseOperators, tier, prof, filter, bondsObj]);

  const handleAddHand = (c) => {
    const targetChessId = c.chessId || c.id;
    actions.debug('addChess', { chessId: targetChessId, count, golden });
    toast(`Added ${c.name} (${golden ? '2★ Elite' : '1★'}) x${count} to bench`, 'success');
  };

  const handleDeploy = (c) => {
    const targetChessId = c.chessId || c.id;
    actions.debug('deployChess', { chessId: targetChessId, golden });
    toast(`Deployed ${c.name} (${golden ? '2★ Elite' : '1★'}) to board`, 'success');
  };

  const profOptions = ['ALL', 'WARRIOR', 'SNIPER', 'CASTER', 'TANK', 'MEDIC', 'PIONEER', 'SUPPORT', 'SPECIAL'];
  const profLabels = {
    ALL: 'All', WARRIOR: '近卫 Guard', SNIPER: '狙击 Sniper', CASTER: '术师 Caster',
    TANK: '重装 Defender', MEDIC: '医疗 Medic', PIONEER: '先锋 Vanguard',
    SUPPORT: '辅助 Supporter', SPECIAL: '特种 Specialist',
  };

  return html`<div class="debug-section">
    <!-- Configuration Bar -->
    <div class="debug-filter-bar">
      <div class="debug-filter-bar__row" style="justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="debug-card__label" style="font-weight:700;">Spawn Mode:</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#e8f2ed;font-size:12px;">
            <input type="checkbox" checked=${golden} onChange=${(e) => setGolden(e.target.checked)} />
            <span style=${golden ? 'color:#ffd043;font-weight:700;' : ''}>2★ Elite / Golden Variant</span>
          </label>
          <div style="display:flex;align-items:center;gap:4px;margin-left:8px;">
            <span class="debug-card__label">Count:</span>
            ${[1, 2, 3].map((n) => html`
              <button key=${n} type="button" class=${`debug-pill ${count === n ? 'is-active' : ''}`}
                      onClick=${() => setCount(n)}>
                ${n}x
              </button>
            `)}
          </div>
        </div>
        ${!match ? html`<span style="color:#e68b35;font-size:11px;">(Note: Live spawn applies during match)</span>` : null}
      </div>

      <div class="debug-filter-bar__row">
        <input type="text" class="debug-input" placeholder="Search operators by name, English name, ID or bond (e.g. 银灰, SilverAsh, Texas, siracusa)..."
               value=${filter} onInput=${(e) => setFilter(e.target.value)} />
        <span style="font-size:11px;color:#7e968b;white-space:nowrap;">Showing ${filtered.length} operators</span>
      </div>

      <!-- Tier Filters -->
      <div class="debug-filter-bar__row">
        <span class="debug-card__label">Rarity:</span>
        <div class="debug-pill-group">
          ${['ALL', '6', '5', '4', '3', '2', '1'].map((t) => html`
            <button key=${t} type="button" class=${`debug-pill ${tier === t ? 'is-active' : ''}`}
                    onClick=${() => setTier(t)}>
              ${t === 'ALL' ? 'ALL TIERS' : `Tier ${t} (${t}★)`}
            </button>
          `)}
        </div>
      </div>

      <!-- Profession Filters -->
      <div class="debug-filter-bar__row">
        <span class="debug-card__label">Class:</span>
        <div class="debug-pill-group">
          ${profOptions.map((p) => html`
            <button key=${p} type="button" class=${`debug-pill ${prof === p ? 'is-active' : ''}`}
                    onClick=${() => setProf(p)}>
              ${profLabels[p] || p}
            </button>
          `)}
        </div>
      </div>
    </div>

    <!-- Operators Grid -->
    <div class="debug-grid-cards">
      ${filtered.map((c) => {
        const avatarUrl = chessAvatarUrl(assets, c);
        const bondNames = (c.bonds || []).map((bId) => bondsObj[bId]?.name || bId);
        const displayName = c.appellation && c.appellation !== c.name ? `${c.name} (${c.appellation})` : c.name;
        return html`
          <div key=${c.id} class="debug-op-card">
            <div class="debug-op-card__avatar">
              ${avatarUrl
                ? html`<img src=${avatarUrl} alt=${c.name} loading="lazy" />`
                : html`<${Icon} name="user" size="24" />`}
            </div>
            <div class="debug-op-card__meta">
              <div class="debug-op-card__name-row">
                <span class="debug-op-card__name" title=${displayName}>${displayName}</span>
                <span class=${`debug-tag debug-tag--tier debug-tag--t${c.tier}`}>T${c.tier}</span>
              </div>
              <div style="font-size:11px;color:#6fa894;">${c.profession || ''}</div>
              <div class="debug-op-card__bonds">
                ${bondNames.map((bn, idx) => html`<span key=${idx} class="debug-tag">${bn}</span>`)}
              </div>
            </div>
            <div class="debug-op-card__actions">
              <button type="button" class="debug-btn debug-btn--primary debug-btn-xs"
                      title="Add to bench/hand" onClick=${() => handleAddHand(c)}>
                + Hand (${count})
              </button>
              <button type="button" class="debug-btn debug-btn-xs"
                      title="Deploy directly onto board" onClick=${() => handleDeploy(c)}>
                ⚔ Deploy
              </button>
            </div>
          </div>
        `;
      })}
    </div>
  </div>`;
}

function ItemAdderTab({ s }) {
  const match = s.match?.public || null;
  const [filter, setFilter] = useState('');
  const [tier, setTier] = useState('ALL');
  const [golden, setGolden] = useState(false);
  const [count, setCount] = useState(1);

  useData('items', 'assets');
  const itemsObj = data.get('items') || {};
  const assets = data.get('assets');

  const baseItems = useMemo(() => {
    const list = Object.entries(itemsObj)
      .map(([key, it]) => ({
        ...it,
        id: it.id || it.itemId || key,
      }))
      .filter((it) => !it.isGolden);
    return list.sort((a, b) => (b.tier || 0) - (a.tier || 0));
  }, [itemsObj]);

  const filtered = useMemo(() => {
    return baseItems.filter((it) => {
      if (tier !== 'ALL' && it.tier !== Number(tier)) return false;
      if (filter) {
        const q = filter.toLowerCase().trim();
        const matchesName = (it.name || '').toLowerCase().includes(q);
        const matchesId = (it.id || '').toLowerCase().includes(q);
        const matchesDesc = (it.desc || '').toLowerCase().includes(q);
        return matchesName || matchesId || matchesDesc;
      }
      return true;
    });
  }, [baseItems, tier, filter]);

  const handleAddItem = (it) => {
    const targetItemId = it.id || it.itemId;
    actions.debug('addItem', { itemId: targetItemId, count, golden });
    toast(`Added ${it.name} (${golden ? 'Golden/Upgraded' : 'Normal'}) x${count}`, 'success');
  };

  return html`<div class="debug-section">
    <!-- Filter & Configuration Bar -->
    <div class="debug-filter-bar">
      <div class="debug-filter-bar__row" style="justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="debug-card__label" style="font-weight:700;">Spawn Mode:</span>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;color:#e8f2ed;font-size:12px;">
            <input type="checkbox" checked=${golden} onChange=${(e) => setGolden(e.target.checked)} />
            <span style=${golden ? 'color:#ffd043;font-weight:700;' : ''}>Golden / Upgraded Item</span>
          </label>
          <div style="display:flex;align-items:center;gap:4px;margin-left:8px;">
            <span class="debug-card__label">Count:</span>
            ${[1, 2, 3, 5].map((n) => html`
              <button key=${n} type="button" class=${`debug-pill ${count === n ? 'is-active' : ''}`}
                      onClick=${() => setCount(n)}>
                ${n}x
              </button>
            `)}
          </div>
        </div>
        ${!match ? html`<span style="color:#e68b35;font-size:11px;">(Note: Live spawn applies during match)</span>` : null}
      </div>

      <div class="debug-filter-bar__row">
        <input type="text" class="debug-input" placeholder="Search items by name, ID or description (e.g. 重锤, 盾牌, 浓茶, 弹射器)..."
               value=${filter} onInput=${(e) => setFilter(e.target.value)} />
        <span style="font-size:11px;color:#7e968b;white-space:nowrap;">Showing ${filtered.length} items</span>
      </div>

      <div class="debug-filter-bar__row">
        <span class="debug-card__label">Rarity Tier:</span>
        <div class="debug-pill-group">
          ${['ALL', '6', '5', '4', '3', '2', '1'].map((t) => html`
            <button key=${t} type="button" class=${`debug-pill ${tier === t ? 'is-active' : ''}`}
                    onClick=${() => setTier(t)}>
              ${t === 'ALL' ? 'ALL TIERS' : `Tier ${t}`}
            </button>
          `)}
        </div>
      </div>
    </div>

    <!-- Items Grid -->
    <div class="debug-grid-cards">
      ${filtered.map((it) => {
        const iconUrl = itemIconUrl(assets, it);
        return html`
          <div key=${it.id} class="debug-item-card">
            <div class="debug-item-card__icon">
              ${iconUrl
                ? html`<img src=${iconUrl} alt=${it.name} loading="lazy" />`
                : html`<${Icon} name="shield" size="20" />`}
            </div>
            <div class="debug-item-card__content">
              <div class="debug-item-card__title">
                <span>${it.name}</span>
                <span class=${`debug-tag debug-tag--tier debug-tag--t${it.tier || 1}`}>T${it.tier || 1}</span>
              </div>
              <div class="debug-item-card__desc" title=${it.desc}>
                ${it.desc || it.effectName || 'No description'}
              </div>
              <div style="margin-top:0.4rem;display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:0.65rem;color:#6a8076;">${it.id}</span>
                <button type="button" class="debug-btn debug-btn--primary debug-btn-xs"
                        onClick=${() => handleAddItem(it)}>
                  + Add (${count})
                </button>
              </div>
            </div>
          </div>
        `;
      })}
    </div>
  </div>`;
}

function TelemetryTab({ s, route }) {
  const conn = s.connection || {};
  const me = s.me || {};
  const room = s.room || null;
  const match = s.match?.public || null;
  const priv = s.match?.private || null;

  return html`<div class="debug-section">
    <h3 class="debug-section__title"><${Icon} name="signal" size="14" /> Client & Connection</h3>
    <div class="debug-grid">
      <div class="debug-card">
        <span class="debug-card__label">Active Route</span>
        <span class="debug-card__value debug-card__value--highlight">${route.toUpperCase()}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Socket Status</span>
        <span class="debug-card__value">${conn.status || 'idle'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Latency (RTT)</span>
        <span class="debug-card__value">${conn.ping != null ? `${conn.ping} ms` : '--'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Clock Offset</span>
        <span class="debug-card__value">${s.clock?.offset != null ? `${s.clock.offset} ms` : '0 ms'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Player ID</span>
        <span class="debug-card__value">${me.playerId || '(None)'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Player Name</span>
        <span class="debug-card__value">${me.name || '(None)'}</span>
      </div>
    </div>

    ${room ? html`
      <h3 class="debug-section__title" style="margin-top:0.6rem;"><${Icon} name="rook" size="14" /> Room Telemetry</h3>
      <div class="debug-grid">
        <div class="debug-card">
          <span class="debug-card__label">Room Code</span>
          <span class="debug-card__value debug-card__value--highlight">${room.code}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Mode</span>
          <span class="debug-card__value">${room.mode}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Difficulty</span>
          <span class="debug-card__value">${room.difficulty}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Seats Occupied</span>
          <span class="debug-card__value">${(room.seats || []).filter(Boolean).length} / ${(room.seats || []).length}</span>
        </div>
      </div>
    ` : null}

    ${match ? html`
      <h3 class="debug-section__title" style="margin-top:0.6rem;"><${Icon} name="sword" size="14" /> Match Telemetry</h3>
      <div class="debug-grid">
        <div class="debug-card">
          <span class="debug-card__label">Phase</span>
          <span class="debug-card__value debug-card__value--highlight">${match.phase}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Round</span>
          <span class="debug-card__value">${match.round != null ? match.round : '--'}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Gold / Funds</span>
          <span class="debug-card__value debug-card__value--warn">${priv?.funds != null ? priv.funds : '--'}</span>
        </div>
        <div class="debug-card">
          <span class="debug-card__label">Shop Level</span>
          <span class="debug-card__value">${priv?.shop ? `Lv.${priv.shop.level} / ${priv.shop.maxLevel}` : '--'}</span>
        </div>
      </div>
    ` : null}
  </div>`;
}

function CombatTab({ dState }) {
  const [curSpeed, setCurSpeed] = useState(() => dState.simSpeed || 1);
  const runnerStats = battleRunner?.stats?.() || null;
  const runnerState = battleRunner?.state?.() || null;

  const handleSetSpeed = (sp) => {
    setCurSpeed(sp);
    debugStore.set({ simSpeed: sp });
    if (battleRunner?.setSpeed) {
      battleRunner.setSpeed(sp);
      toast(`Local sim speed set to ${sp}x`, 'info');
    }
  };

  const handleTogglePause = () => {
    if (battleRunner?.setPaused) {
      const isPausedNow = !!runnerState?.paused;
      battleRunner.setPaused(!isPausedNow);
      toast(isPausedNow ? 'Local sim resumed' : 'Local sim paused', 'info');
    }
  };

  return html`<div class="debug-section">
    <h3 class="debug-section__title"><${Icon} name="play" size="14" /> Local Battle Runner Speed Control</h3>
    <p style="font-size:0.8rem;color:#8fa69c;margin:0 0 0.4rem 0;">
      Controls local battle simulation speed without affecting multiplayer peers or server clock.
    </p>
    <div class="debug-controls-row">
      ${[0.5, 1, 2, 3, 5, 10].map((sp) => html`
        <button key=${sp} type="button" class=${`debug-btn ${curSpeed === sp ? 'is-active' : ''}`}
                onClick=${() => handleSetSpeed(sp)}>
          ${sp}x Speed
        </button>
      `)}
      <button type="button" class="debug-btn debug-btn--warn" onClick=${handleTogglePause}>
        ${runnerState?.paused ? 'Resume Sim' : 'Pause Sim'}
      </button>
    </div>

    <h3 class="debug-section__title" style="margin-top:0.8rem;"><${Icon} name="signal" size="14" /> Simulation Engine Stats</h3>
    <div class="debug-grid">
      <div class="debug-card">
        <span class="debug-card__label">Active Battle ID</span>
        <span class="debug-card__value">${runnerState?.battleId ? String(runnerState.battleId).slice(0, 10) : 'None'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Authoritative</span>
        <span class="debug-card__value">${runnerState?.authoritative ? 'YES (Local)' : 'NO / Replica'}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Sim Ticks Stepped</span>
        <span class="debug-card__value">${runnerStats?.ticks ?? 0}</span>
      </div>
      <div class="debug-card">
        <span class="debug-card__label">Avg Tick Compute</span>
        <span class="debug-card__value">${runnerStats?.avgTickMs ? `${runnerStats.avgTickMs.toFixed(2)} ms` : '--'}</span>
      </div>
    </div>

    <h3 class="debug-section__title" style="margin-top:0.8rem;"><${Icon} name="dots" size="14" /> Audio Trigger Diagnostics</h3>
    <div class="debug-controls-row">
      ${['click', 'buy', 'sell', 'refresh', 'freeze', 'ready', 'deploy', 'error'].map((sfxName) => html`
        <button key=${sfxName} type="button" class="debug-btn" onClick=${() => {
          try { audio.sfx?.(sfxName); toast(`Played SFX: ${sfxName}`, 'info'); } catch { /* ignore */ }
        }}>
          Play: ${sfxName}
        </button>
      `)}
    </div>

    <h3 class="debug-section__title" style="margin-top:0.8rem;"><${Icon} name="snow" size="14" /> Live Battle Events Stream</h3>
    <div class="debug-event-list">
      ${dState.events && dState.events.length ? dState.events.slice().reverse().map((ev) => html`
        <div key=${ev.id} class="debug-event-item">
          <span>${ev.kinds}</span>
          <span style="color:#788f85;font-size:0.7rem;">${ev.time}</span>
        </div>
      `) : html`<span style="color:#60786e;padding:0.4rem;">No recent combat events logged.</span>`}
    </div>
  </div>`;
}

function DataTab({ dState }) {
  const [cat, setCat] = useState(() => dState.dataCategory || 'chess');
  const [filter, setFilter] = useState('');
  useData(cat);

  const rawData = data.get(cat);
  const items = useMemo(() => {
    if (!rawData) return [];
    if (Array.isArray(rawData)) return rawData;
    if (typeof rawData === 'object') return Object.entries(rawData).map(([k, v]) => ({ _id: k, ...(typeof v === 'object' ? v : { val: v }) }));
    return [];
  }, [rawData]);

  const filtered = useMemo(() => {
    if (!filter) return items.slice(0, 15);
    const q = filter.toLowerCase();
    return items.filter((it) => JSON.stringify(it).toLowerCase().includes(q)).slice(0, 15);
  }, [items, filter]);

  const testToasts = (kind) => {
    toast(`Sample [${kind.toUpperCase()}] debug notification message`, kind);
  };

  const testConfirm = async () => {
    const res = await confirmDialog({
      title: 'Debug Modal Test',
      text: 'This is a test confirmation modal triggered from the developer panel.',
      okText: 'Confirm',
      cancelText: 'Cancel',
    });
    toast(`Confirm result: ${res ? 'OK' : 'CANCELED'}`, 'info');
  };

  return html`<div class="debug-section">
    <h3 class="debug-section__title"><${Icon} name="search" size="14" /> UI Feedback & Modal Tester</h3>
    <div class="debug-controls-row">
      <button type="button" class="debug-btn" onClick=${() => testToasts('info')}>Toast: Info</button>
      <button type="button" class="debug-btn debug-btn--primary" onClick=${() => testToasts('success')}>Toast: Success</button>
      <button type="button" class="debug-btn debug-btn--warn" onClick=${() => testToasts('warn')}>Toast: Warn</button>
      <button type="button" class="debug-btn" style="color:#ff8585;border-color:#e55353;" onClick=${() => testToasts('error')}>Toast: Error</button>
      <button type="button" class="debug-btn" onClick=${testConfirm}>Open Confirm Dialog</button>
      <button type="button" class="debug-btn" onClick=${() => alertDialog({ title: 'Alert Test', text: 'Diagnostic alert popup' })}>Open Alert Dialog</button>
    </div>

    <h3 class="debug-section__title" style="margin-top:0.8rem;"><${Icon} name="book" size="14" /> Static Game Data Inspector</h3>
    <div class="debug-controls-row">
      ${['chess', 'bonds', 'items', 'enemies', 'stages', 'config', 'tokens'].map((c) => html`
        <button key=${c} type="button" class=${`debug-btn ${cat === c ? 'is-active' : ''}`}
                onClick=${() => { setCat(c); debugStore.set({ dataCategory: c }); }}>
          ${c.toUpperCase()} (${data.list(c)?.length || Object.keys(data.get(c) || {}).length || 0})
        </button>
      `)}
    </div>

    <div style="display:flex;gap:0.5rem;align-items:center;">
      <input type="text" class="debug-input" placeholder="Search entries in ${cat}..."
             value=${filter} onInput=${(e) => setFilter(e.target.value)} />
      <span style="font-size:0.75rem;color:#788f85;white-space:nowrap;">Showing ${filtered.length} of ${items.length}</span>
    </div>

    <div class="debug-console__logs" style="height:150px;">
      ${filtered.length ? filtered.map((it, idx) => html`
        <div key=${it._id || it.id || idx} class="debug-log-line">
          <span style="color:#4ed8af;">[${it._id || it.id || it.chessId || it.bondId || idx}]</span> ${' '}
          <span style="color:#e0ece7;">${it.name || it.title || ''}</span> ${' '}
          <span style="color:#6e857c;font-size:0.7rem;">${JSON.stringify(it).slice(0, 110)}...</span>
        </div>
      `) : html`<span style="color:#60786e;">No entries match criteria.</span>`}
    </div>
  </div>`;
}

function ToolsTab({ dState }) {
  const [tools, setTools] = useState(getDebugTools);
  const [scriptInput, setScriptInput] = useState('');

  useEffect(() => {
    const update = () => setTools(getDebugTools());
    registryListeners.add(update);
    return () => registryListeners.delete(update);
  }, []);

  const handleRunScript = () => {
    if (!scriptInput.trim()) return;
    const cmd = scriptInput.trim();
    logToDebugConsole(`> ${cmd}`, 'info');
    try {
      // Sandboxed execution with access to core runtime references
      const runnerScope = {
        store,
        net,
        data,
        audio,
        runner: battleRunner,
        state: store.get(),
      };
      const fn = new Function('ctx', `with(ctx) { return (${cmd}); }`);
      const res = fn(runnerScope);
      const str = typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res);
      logToDebugConsole(str, 'result');
    } catch (err) {
      logToDebugConsole(`Error: ${err.message}`, 'error');
    }
    setScriptInput('');
  };

  return html`<div class="debug-section">
    <h3 class="debug-section__title"><${Icon} name="edit" size="14" /> Extensible Testing Tools</h3>
    <div class="debug-grid">
      ${tools.map((tool) => html`
        <div key=${tool.id} class="debug-card" style="display:flex;justify-content:space-between;">
          <div>
            <div style="font-weight:700;color:#f0f6f3;font-size:0.88rem;margin-bottom:0.2rem;">${tool.name}</div>
            <div style="font-size:0.75rem;color:#7e968b;line-height:1.3;">${tool.description}</div>
          </div>
          <button type="button" class="debug-btn debug-btn--primary" style="margin-top:0.5rem;align-self:flex-start;"
                  onClick=${async () => {
                    try { await tool.run(); } catch (err) { toast(`Tool failed: ${err.message}`, 'error'); }
                  }}>
            Execute
          </button>
        </div>
      `)}
    </div>

    <h3 class="debug-section__title" style="margin-top:0.8rem;"><${Icon} name="key" size="14" /> Interactive Console & Expression Evaluator</h3>
    <div class="debug-console">
      <div class="debug-console__logs">
        ${(dState.logs || []).map((l) => html`
          <div key=${l.id} class=${`debug-log-line debug-log-line--${l.type}`}>
            <span style="color:#506a5f;">[${l.time}]</span> ${l.text}
          </div>
        `)}
      </div>
      <div class="debug-console__input-row">
        <input type="text" class="debug-input" placeholder="e.g. store.get().me.name or runner.stats()"
               value=${scriptInput}
               onInput=${(e) => setScriptInput(e.target.value)}
               onKeyDown=${(e) => { if (e.key === 'Enter') handleRunScript(); }} />
        <button type="button" class="debug-btn debug-btn--primary" onClick=${handleRunScript}>
          Run
        </button>
      </div>
    </div>
  </div>`;
}

// ---- Main Host Component ---------------------------------------------------------------------------

export function DebugPanelHost() {
  const isOpen = useStore((s) => !!s.open, undefined, debugStore);
  if (!isOpen) return null;
  return html`<${DebugPanelModal} />`;
}

function DebugPanelModal() {
  const dState = useStore((s) => s, Object.is, debugStore);
  const appState = useStore((s) => s);
  const route = useStore(selectRoute);
  const panelRef = useRef(null);

  // Close on Escape when panel is open
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeDebugPanel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isUnlocked = !!dState.unlocked;

  if (!isUnlocked) {
    return html`<div class="debug-panel-overlay" role="presentation"
                     onMouseDown=${(e) => { if (e.target === e.currentTarget) closeDebugPanel(); }}>
      <div ref=${panelRef} class="debug-panel brackets" role="dialog" aria-modal="true" aria-label="Diagnostic Console">
        <header class="debug-panel__header">
          <div class="debug-panel__title-group">
            <span class="debug-panel__subtitle">RHODES ISLAND // SYSTEM DIAGNOSTIC CONSOLE</span>
            <h2 class="debug-panel__title">
              <span>DIAGNOSTIC TERMINAL</span>
              <span class="debug-panel__badge" style="border-color:#e68b35;color:#f7a250;background:rgba(230,139,53,0.18);">AUTHORIZATION REQUIRED</span>
            </h2>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button type="button" class="debug-btn debug-btn-xs" title="Hard reload client application"
                    onClick=${() => window.location.reload()}>
              <${Icon} name="refresh" size="12" /> Reload Client
            </button>
            <button type="button" class="debug-panel__close" aria-label=${T('关闭')} title="Close (Esc)" onClick=${closeDebugPanel}>
              <${Icon} name="close" />
            </button>
          </div>
        </header>

        <main class="debug-panel__body">
          <${DebugAuthScreen} s=${appState} route=${route} />
        </main>

        <footer class="debug-panel__footer">
          <div>
            <span>Restricted Diagnostic Mode</span>
            <span style="margin: 0 0.4rem;">·</span>
            <span>System authorization required</span>
          </div>
          <div class="debug-panel__footer-tip">
            Toggle: CHTLYO or ESC
          </div>
        </footer>
      </div>
    </div>`;
  }

  const tabs = [
    { id: 'endless', label: 'ENDLESS SIMULATION', icon: 'infinity' },
    { id: 'cheats', label: 'MATCH CHEATS', icon: 'sword' },
    { id: 'shopLock', label: 'SHOP LOCK BOND', icon: 'shield' },
    { id: 'operators', label: 'OPERATOR ADDER', icon: 'rook' },
    { id: 'items', label: 'ITEMS ADDER', icon: 'plus' },
    { id: 'combat', label: 'COMBAT & SFX', icon: 'play' },
    { id: 'telemetry', label: 'TELEMETRY', icon: 'signal' },
    { id: 'data', label: 'DATA INSPECTOR', icon: 'search' },
    { id: 'tools', label: 'DEV CONSOLE', icon: 'edit' },
  ];

  return html`<div class="debug-panel-overlay" role="presentation"
                   onMouseDown=${(e) => { if (e.target === e.currentTarget) closeDebugPanel(); }}>
    <div ref=${panelRef} class="debug-panel brackets" role="dialog" aria-modal="true" aria-label="Developer Debug Panel">
      <header class="debug-panel__header">
        <div class="debug-panel__title-group">
          <span class="debug-panel__subtitle">RHODES ISLAND // CONFIDENTIAL DIAGNOSTIC SUITE</span>
          <h2 class="debug-panel__title">
            <span>DEVELOPER DEBUG PANEL</span>
            <span class="debug-panel__badge">ACTIVATED: OpenDebug = 1</span>
          </h2>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" class="debug-btn debug-btn-xs" style="color:#f7a250;border-color:#e68b35;"
                  title="Lock debug panel back to restricted mode"
                  onClick=${lockDebugSuite}>
            <${Icon} name="key" size="12" /> Lock
          </button>
          <button type="button" class="debug-btn debug-btn-xs" title="Hard reload client application"
                  onClick=${() => window.location.reload()}>
            <${Icon} name="refresh" size="12" /> Reload Client
          </button>
          <button type="button" class="debug-panel__close" aria-label=${T('关闭')} title="Close (Esc)" onClick=${closeDebugPanel}>
            <${Icon} name="close" />
          </button>
        </div>
      </header>

      <nav class="debug-panel__nav">
        ${tabs.map((t) => html`
          <button key=${t.id} type="button"
                  class=${`debug-panel__tab-btn ${dState.activeTab === t.id ? 'is-active' : ''}`}
                  onClick=${() => debugStore.set({ activeTab: t.id })}>
            <${Icon} name=${t.icon} size="14" />
            <span>${t.label}</span>
          </button>
        `)}
      </nav>

      <main class="debug-panel__body">
        ${dState.activeTab === 'endless' ? html`<${EndlessSimulationTab} s=${appState} route=${route} />` : null}
        ${dState.activeTab === 'cheats' ? html`<${CheatsTab} s=${appState} route=${route} />` : null}
        ${dState.activeTab === 'shopLock' ? html`<${ShopLockTab} s=${appState} />` : null}
        ${dState.activeTab === 'operators' ? html`<${OperatorAdderTab} s=${appState} />` : null}
        ${dState.activeTab === 'items' ? html`<${ItemAdderTab} s=${appState} />` : null}
        ${dState.activeTab === 'combat' ? html`<${CombatTab} dState=${dState} />` : null}
        ${dState.activeTab === 'telemetry' ? html`<${TelemetryTab} s=${appState} route=${route} />` : null}
        ${dState.activeTab === 'data' ? html`<${DataTab} dState=${dState} />` : null}
        ${dState.activeTab === 'tools' ? html`<${ToolsTab} dState=${dState} />` : null}
      </main>

      <footer class="debug-panel__footer">
        <div>
          <span>Local Developer Environment</span>
          <span style="margin: 0 0.4rem;">·</span>
          <span>OpenDebug = 1 accepted</span>
        </div>
        <div class="debug-panel__footer-tip">
          Toggle: CHTLYO or ESC
        </div>
      </footer>
    </div>
  </div>`;
}
