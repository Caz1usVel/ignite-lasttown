import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { STAGE1 } from '../js/data/stage1.js';
import { mulberry32 } from '../js/core/util.js';

// 敵を動かさず、出現だけを数える
function simulate(seconds, dt = 0.1) {
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(STAGE1);
  const log = [];
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const before = state.enemies.length;
    updateSpawner(sp, state, dt);
    for (const e of state.enemies.slice(before)) log.push({ type: e.type, time: sp.time, angle: e.angle });
  }
  return { state, sp, log };
}

test('0〜20秒は隕石だけが3秒ごと（6体）', () => {
  const { log } = simulate(20);
  assert.equal(log.filter((l) => l.type === 'meteor').length, 6);
  assert.equal(log.filter((l) => l.type === 'drone').length, 0);
});

test('90秒までの総数がおおむね出現表どおり', () => {
  const { log } = simulate(90);
  const meteors = log.filter((l) => l.type === 'meteor').length;
  const drones = log.filter((l) => l.type === 'drone').length;
  assert.ok(meteors >= 44 && meteors <= 48, `meteors=${meteors}`);
  assert.ok(drones >= 8 && drones <= 12, `drones=${drones}`);
});

test('出現角度は-90〜+90度', () => {
  const { log } = simulate(90);
  for (const l of log) assert.ok(l.angle >= -90 && l.angle <= 90);
});

test('90秒以降は出現が止まり、雑魚が残っている間はボスが出ない', () => {
  const { state, sp, log } = simulate(95);
  assert.ok(log.every((l) => l.time < 90 + 1e-9));
  assert.equal(state.boss, null);
  assert.equal(sp.bossSpawned, false);
});

test('雑魚がいなくなったらボスが出る（1回だけ）', () => {
  const { state, sp } = simulate(95);
  state.enemies.length = 0;
  updateSpawner(sp, state, 0.1);
  assert.equal(state.boss.type, 'bossA');
  const first = state.boss;
  updateSpawner(sp, state, 0.1);
  assert.equal(state.boss, first);
});
