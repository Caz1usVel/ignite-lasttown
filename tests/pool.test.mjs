import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, updateSpawner, validateStage } from '../js/game/spawner.js';
import { mulberry32 } from '../js/core/util.js';

const TYPES = ['meteor', 'drone', 'burrower', 'shielder'];
const mkStage = (spawns, extra = {}) => ({
  id: 9,
  segments: [{ from: 0, to: 1000, spawns }],
  spawnEnd: 1000,
  boss: { type: 'bossA', params: {} },
  ...extra,
});

// 出現した敵の種類を、出現順に返す（編隊は formationDrone 1回として数える）
function drawTypes(stage, seconds, seed = 3) {
  const state = { enemies: [], boss: null, rng: mulberry32(seed) };
  const sp = createSpawner(stage, 1);
  const seen = [];
  let last = 0;
  for (let i = 0; i < Math.round(seconds / 0.1); i++) {
    updateSpawner(sp, state, 0.1);
    if (state.enemies.length > last) {
      const added = state.enemies.slice(last);
      seen.push(added[0].type === 'formationDrone' ? 'formationDrone' : added[0].type);
      last = state.enemies.length;
    }
  }
  return seen;
}

test('pool：袋方式。全種類が1周するまで、同じ種類は出ない', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const seen = drawTypes(stage, 2 * 4 * 6 + 0.5); // 6周ぶん
  assert.equal(seen.length, 24);
  for (let lap = 0; lap < 6; lap++) {
    const bag = seen.slice(lap * 4, lap * 4 + 4);
    assert.deepEqual([...bag].sort(), [...TYPES].sort(), `lap ${lap}: ${bag}`);
  }
});

test('pool：周ごとの順番はシャッフルされる（毎回同じ順ではない）', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const seen = drawTypes(stage, 2 * 4 * 12 + 0.5);
  const laps = new Set();
  for (let lap = 0; lap < 12; lap++) laps.add(seen.slice(lap * 4, lap * 4 + 4).join(','));
  assert.ok(laps.size >= 4, `distinct orders: ${laps.size}`);
});

test('pool：every に scale を掛ける', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const state = { enemies: [], boss: null, rng: mulberry32(1) };
  const sp = createSpawner(stage, 1.5); // 3 秒ごと
  for (let i = 0; i < 100; i++) updateSpawner(sp, state, 0.1); // 10 秒
  assert.equal(state.enemies.length, 3);
});

test('pool：formationDrone が出たら、formation の設定で編隊（count 機）を出す', () => {
  const stage = mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'], formation: { count: [3, 4], minSep: 25 } } });
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(stage, 1);
  for (let i = 0; i < 20 * 10; i++) updateSpawner(sp, state, 0.1); // 20 秒 = 10 回
  const drones = state.enemies.filter((e) => e.type === 'formationDrone');
  const meteors = state.enemies.filter((e) => e.type === 'meteor');
  assert.equal(meteors.length, 5);
  assert.ok(drones.length >= 15 && drones.length <= 20, `drones ${drones.length}`); // 5 編隊 × 3〜4
});

test('pool：区間が変わると袋も新しくなる（区間ごとに別の袋）', () => {
  const stage = {
    id: 9,
    segments: [
      { from: 0, to: 10, spawns: { pool: { every: 2, pool: ['meteor', 'drone'] } } },
      { from: 10, to: 30, spawns: { pool: { every: 2, pool: ['burrower', 'shielder'] } } },
    ],
    spawnEnd: 30,
    boss: { type: 'bossA', params: {} },
  };
  const seen = drawTypes(stage, 29.5);
  const second = seen.slice(5); // 10 秒以降。0.1 の累積誤差で 10 秒ちょうどの1体は最初の区間に入るため 5 体ぶん飛ばす
  assert.ok(second.every((t) => t === 'burrower' || t === 'shielder'), second.join());
});

test('validateStage：pool の検査', () => {
  validateStage(mkStage({ pool: { every: 2, pool: TYPES } }));
  validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'], formation: { count: 3, minSep: 25 } } }));
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: [] } })), /pool/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: 'meteor' } })), /pool/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['nope'] } })), /unknown enemy type/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 0, pool: TYPES } })), /every/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'] } })), /formation/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone'], formation: { count: 0, minSep: 25 } } })), /count/);
});

test('validateStage：pool でない項目は、これまでどおりキー名を種類として検査する', () => {
  assert.throws(() => validateStage(mkStage({ nope: 3 })), /unknown enemy type/);
  validateStage(mkStage({ meteor: 3 }));
});
