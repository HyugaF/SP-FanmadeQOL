import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACTS,
  CONTRACT_CATEGORIES,
  CONTRACT_BY_ID,
  sanitizeContracts,
  toggleContract,
  computeContractRisk,
  resolveContractMods,
} from '../../shared/contracts.js';
import { DIFFICULTIES, modeIdFor } from '../../shared/constants.js';

test('Contingency Contract - Catalog integrity', () => {
  assert.ok(CONTRACTS.length >= 15, 'Should have at least 15 contracts');
  assert.ok(CONTRACT_CATEGORIES.length >= 5, 'Should have standard CC categories');

  for (const c of CONTRACTS) {
    assert.ok(c.id, 'Contract must have id');
    assert.ok(c.zhName && c.enName, 'Contract must have zhName and enName');
    assert.ok(c.zhDesc && c.enDesc, 'Contract must have zhDesc and enDesc');
    assert.ok(Number.isInteger(c.risk) && c.risk >= 0, 'Contract risk must be non-negative integer');
    assert.ok(CONTRACT_BY_ID.get(c.id), 'Contract must be registered in CONTRACT_BY_ID');
  }
});

test('Contingency Contract - Mutex conflict resolution', () => {
  // Test conflicting seal contracts (cc_seal_1 and cc_seal_2)
  const list1 = ['cc_seal_1'];
  const list2 = sanitizeContracts([...list1, 'cc_seal_2']);
  assert.deepEqual(list2, ['cc_seal_2'], 'Last selected mutex contract should replace previous');

  // Toggle contract behavior
  const toggledOff = toggleContract(['cc_seal_2'], 'cc_seal_2');
  assert.deepEqual(toggledOff, []);

  const toggledMutex = toggleContract(['cc_seal_1'], 'cc_seal_2');
  assert.deepEqual(toggledMutex, ['cc_seal_2']);
});

test('Contingency Contract - Risk level computation and Support rules', () => {
  // Normal risk sum
  const risk = computeContractRisk(['cc_seal_2', 'cc_ehp_3', 'cc_eatk_3']);
  // cc_seal_2 (3) + cc_ehp_3 (3) + cc_eatk_3 (3) = 9
  assert.equal(risk, 9);

  // Support contract locks risk to 0
  const riskWithSupport = computeContractRisk(['cc_seal_2', 'cc_ehp_3', 'cc_support_funds']);
  assert.equal(riskWithSupport, 0, 'Support contract must lock total risk to 0');
});

test('Contingency Contract - Modifier aggregation', () => {
  const mods = resolveContractMods([
    'cc_seal_2',        // maxLifeOverride: 1, risk: 3
    'cc_ehp_2',         // enemyHpMul: 1.65, risk: 2
    'cc_eatk_2',        // enemyAtkMul: 1.55, risk: 2
    'cc_deploy_1',      // deployCapDelta: -1, risk: 2
    'cc_ban_bonds_1',   // extraDisabledBonds: 1, risk: 1
    'cc_funds_1',       // roundFundsDelta: -2, risk: 2
    'cc_shop_1',        // shopSlotDelta: -1, risk: 2
  ]);

  assert.equal(mods.risk, 14);
  assert.equal(mods.hasSupport, false);
  assert.equal(mods.maxLifeOverride, 1);
  assert.equal(mods.enemyHpMul, 1.65);
  assert.equal(mods.enemyAtkMul, 1.55);
  assert.equal(mods.deployCapDelta, -1);
  assert.equal(mods.extraDisabledBonds, 1);
  assert.equal(mods.roundFundsDelta, -2);
  assert.equal(mods.shopSlotDelta, -1);
});

test('Contingency Contract - Mode mapping and Constants', () => {
  assert.ok(DIFFICULTIES.includes('CRISIS'), 'CRISIS must be in DIFFICULTIES');
  assert.equal(modeIdFor('solo', 'CRISIS'), 'mode_single_crisis');
  assert.equal(modeIdFor('coop', 'CRISIS'), 'mode_multi_crisis');
});
