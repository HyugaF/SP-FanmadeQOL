// test/ui/debugPanel.test.js — tests for secret Developer Debug Panel & tools registry
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  debugStore,
  openDebugPanel,
  closeDebugPanel,
  toggleDebugPanel,
  registerDebugTool,
  unregisterDebugTool,
  getDebugTools,
  installDebugSequenceDetector,
  executeDebugCommand,
  unlockDebugSuite,
  lockDebugSuite,
} from '../../public/js/ui/debugPanel.js';

describe('debugPanel store & controls', () => {
  test('debug authorization: OpenDebug = 1 unlocks developer suite', () => {
    lockDebugSuite();
    assert.equal(debugStore.get().unlocked, false);

    // Invalid commands fail
    const bad = executeDebugCommand('OpenDebug = 2');
    assert.equal(bad.ok, false);
    assert.equal(debugStore.get().unlocked, false);

    // Correct command unlocks
    const ok = executeDebugCommand('OpenDebug = 1');
    assert.equal(ok.ok, true);
    assert.equal(debugStore.get().unlocked, true);

    // Spacing and case insensitive
    lockDebugSuite();
    assert.equal(debugStore.get().unlocked, false);
    const ok2 = executeDebugCommand('  opendebug=1  ');
    assert.equal(ok2.ok, true);
    assert.equal(debugStore.get().unlocked, true);

    // Lock function works
    lockDebugSuite();
    assert.equal(debugStore.get().unlocked, false);
  });

  test('open, close, and toggle debugStore', () => {
    closeDebugPanel();
    assert.equal(debugStore.get().open, false);

    openDebugPanel();
    assert.equal(debugStore.get().open, true);

    closeDebugPanel();
    assert.equal(debugStore.get().open, false);

    toggleDebugPanel();
    assert.equal(debugStore.get().open, true);

    toggleDebugPanel();
    assert.equal(debugStore.get().open, false);
  });

  test('extensible tools registry: register, retrieve, run, unregister', async () => {
    let executed = false;
    const testTool = {
      id: 'test_tool_sample',
      name: 'Sample Test Tool',
      category: 'Test',
      description: 'A mock tool for testing',
      run: () => { executed = true; return 'done'; },
    };

    registerDebugTool(testTool);
    const tools = getDebugTools();
    const found = tools.find((t) => t.id === 'test_tool_sample');
    assert.ok(found, 'tool should be found in registry');
    assert.equal(found.name, 'Sample Test Tool');

    const result = await found.run();
    assert.equal(result, 'done');
    assert.equal(executed, true);

    unregisterDebugTool('test_tool_sample');
    assert.ok(!getDebugTools().find((t) => t.id === 'test_tool_sample'), 'tool should be unregistered');
  });

  test('built-in debug tools are present in registry', () => {
    const tools = getDebugTools();
    const ids = tools.map((t) => t.id);
    assert.ok(ids.includes('copy_state_snapshot'), 'copy_state_snapshot tool exists');
    assert.ok(ids.includes('network_ping_probe'), 'network_ping_probe tool exists');
    assert.ok(ids.includes('force_reconnect_socket'), 'force_reconnect_socket tool exists');
    assert.ok(ids.includes('clear_session_tokens'), 'clear_session_tokens tool exists');
  });

  test('secret sequence listener detects CHTLYO', () => {
    closeDebugPanel();
    assert.equal(debugStore.get().open, false);

    const listeners = [];
    const fakeWindow = {
      addEventListener: (type, fn) => listeners.push(fn),
      removeEventListener: () => {},
    };

    // Simulate keydown events on fake global
    globalThis.window = fakeWindow;
    const cleanup = installDebugSequenceDetector();

    const dispatchKey = (key) => {
      for (const fn of listeners) fn({ key });
    };

    // Type random keys
    dispatchKey('A');
    dispatchKey('B');
    dispatchKey('C');
    assert.equal(debugStore.get().open, false);

    // Type partial code: 'c', 'h', 't', 'l'
    dispatchKey('c');
    dispatchKey('h');
    dispatchKey('t');
    dispatchKey('l');
    assert.equal(debugStore.get().open, false);

    // Finish sequence: 'y', 'o' (case-insensitive)
    dispatchKey('y');
    dispatchKey('o');
    assert.equal(debugStore.get().open, true, 'sequence CHTLYO should open panel');

    cleanup?.();
  });

  test('endless combat simulation engine: presets, enemy wave generation, and batch benchmark', async () => {
    const {
      endlessStore,
      PRESET_SQUADS,
      selectPresetSquad,
      generateWaveEnemies,
      stepSimulationTick,
      startEndlessSimulation,
      pauseEndlessSimulation,
      resetEndlessSimulation,
      runBatchEndlessBenchmark,
    } = await import('../../public/js/sim/endlessSim.js');

    // 1. Presets exist
    assert.ok(PRESET_SQUADS.length >= 4, 'at least 4 preset squads available');
    selectPresetSquad('abyssal');
    assert.equal(endlessStore.get().presetId, 'abyssal');
    assert.ok(endlessStore.get().operators.length >= 4);

    // 2. Wave enemy generation scaling
    const w1 = generateWaveEnemies(1, { scalingRate: 1.1, bossInterval: 5 });
    assert.ok(w1.length > 0, 'wave 1 spawns enemies');
    assert.equal(w1.some((e) => e.isBoss), false, 'wave 1 is not a boss wave');

    const w5 = generateWaveEnemies(5, { scalingRate: 1.1, bossInterval: 5 });
    assert.ok(w5.some((e) => e.isBoss), 'wave 5 contains boss enemies');

    const w10 = generateWaveEnemies(10, { scalingRate: 1.1, bossInterval: 5 });
    assert.ok(w10[0].maxHp > w5[0].maxHp, 'enemies scale in HP at higher waves');

    // 3. Batch benchmark execution
    selectPresetSquad('all_stars');
    const benchmark = runBatchEndlessBenchmark(10);
    assert.ok(benchmark.wavesTested === 10, 'benchmark tested 10 waves');
    assert.ok(benchmark.maxWaveSurvived >= 1, 'squad survived at least 1 wave in benchmark');
    assert.ok(benchmark.totalDmg > 0, 'damage dealt in benchmark');

    // 4. Reset function
    resetEndlessSimulation();
    assert.equal(endlessStore.get().wave, 1);
    assert.equal(endlessStore.get().status, 'idle');
  });
});
