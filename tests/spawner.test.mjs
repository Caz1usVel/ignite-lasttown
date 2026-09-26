import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, updateSpawner, validateStage } from '../js/game/spawner.js';
import { STAGES } from '../js/data/stages.js';
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
  assert.equal(log.filter((l) => l.type === 'meteor' && l.time < 20).length, 6);
  assert.equal(log.filter((l) => l.type === 'drone' && l.time < 20).length, 0);
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

// ---- まとめて出す書き方 ----
const groupStage = (spawns) => ({
  id: 9,
  segments: [{ from: 0, to: 1000, spawns }],
  spawnEnd: 1000,
  boss: { type: 'bossA', params: {} },
});

// 敵を動かさず、出現だけを時刻ごとにまとめて返す
function simulateStage(stage, seconds, dt = 0.1) {
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(stage);
  const groups = []; // { time, types: string[], angles: number[] }
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const before = state.enemies.length;
    updateSpawner(sp, state, dt);
    const fresh = state.enemies.slice(before);
    if (fresh.length) groups.push({ time: sp.time, types: fresh.map((e) => e.type), angles: fresh.map((e) => e.angle) });
  }
  return { state, groups };
}

test('まとめ書き方：every 秒ごとに count 機が同時に出る', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 10, count: 3, minSep: 25 } }), 35);
  assert.equal(groups.length, 3);
  for (const g of groups) {
    assert.equal(g.types.length, 3);
    assert.ok(g.types.every((t) => t === 'formationDrone'));
  }
  const times = groups.map((g) => g.time);
  assert.ok(Math.abs(times[0] - 10) < 0.15 && Math.abs(times[1] - 20) < 0.15 && Math.abs(times[2] - 30) < 0.15, `times=${times}`);
});

test('まとめ書き方：出る角度は互いに minSep 以上離れ、-90〜+90度', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 5, count: [3, 5], minSep: 25 } }), 120);
  assert.ok(groups.length >= 20);
  for (const g of groups) {
    const a = [...g.angles].sort((x, y) => x - y);
    for (let i = 0; i < a.length; i++) {
      assert.ok(a[i] >= -90 && a[i] <= 90);
      if (i > 0) assert.ok(a[i] - a[i - 1] >= 25 - 1e-9);
    }
  }
});

test('まとめ書き方：count が配列なら [最小, 最大] の範囲で、複数の機数が出る', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 5, count: [3, 5], minSep: 25 } }), 200);
  const sizes = new Set(groups.map((g) => g.types.length));
  for (const s of sizes) assert.ok(s >= 3 && s <= 5, `size ${s}`);
  assert.ok(sizes.size >= 2, `sizes=${[...sizes]}`);
});

test('数値の書き方と、まとめ書き方を同じ区間に混ぜられる', () => {
  const { groups } = simulateStage(
    groupStage({ meteor: 2.0, formationDrone: { every: 10, count: 3, minSep: 25 } }), 35);
  // 同じフレームに隕石と編隊が同時に出ることがあるので、種類ごとの総数で数える
  const all = groups.flatMap((g) => g.types);
  const meteors = all.filter((t) => t === 'meteor').length;
  const formationDrones = all.filter((t) => t === 'formationDrone').length;
  assert.ok(meteors >= 16 && meteors <= 18, `meteors=${meteors}`);
  assert.equal(formationDrones, 9); // 3機 × 3回
});

test('不正な出現表の項目は例外になる', () => {
  const bad = [
    { formationDrone: { every: 0, count: 3, minSep: 25 } },
    { formationDrone: { every: -1, count: 3, minSep: 25 } },
    { formationDrone: { every: 10, count: 0, minSep: 25 } },
    { formationDrone: { every: 10, count: 2.5, minSep: 25 } },
    { formationDrone: { every: 10, count: [4, 3], minSep: 25 } },
    { formationDrone: { every: 10, count: [3, 4] } },
    { formationDrone: { every: 10, count: 3, minSep: 'wide' } },
    { formationDrone: 'often' },
    { meteor: 0 },
    { meteor: -2 },
    { meteor: Infinity },
  ];
  for (const spawns of bad) {
    assert.throws(() => simulateStage(groupStage(spawns), 20), Error, JSON.stringify(spawns));
  }
});

// ---- validateStage ----
test('validateStage：登録済みの全ステージが通る', () => {
  for (const [id, stage] of Object.entries(STAGES)) {
    assert.doesNotThrow(() => validateStage(stage), `stage ${id}`);
  }
});

test('validateStage：誤ったステージデータは例外になる', () => {
  const ok = () => ({
    id: 9,
    segments: [
      { from: 0, to: 10, spawns: { meteor: 2 } },
      { from: 10, to: 20, spawns: { formationDrone: { every: 5, count: [3, 4], minSep: 25 } } },
    ],
    spawnEnd: 20,
    boss: { type: 'bossA', params: {} },
  });
  assert.doesNotThrow(() => validateStage(ok()));
  const cases = {
    '区間の隙間': (s) => { s.segments[1].from = 12; },
    '区間の重なり': (s) => { s.segments[1].from = 8; },
    'to <= from': (s) => { s.segments[1].to = 10; },
    '最初が0でない': (s) => { s.segments[0].from = 1; },
    'segments が空': (s) => { s.segments = []; },
    'spawnEnd の不一致': (s) => { s.spawnEnd = 25; },
    '未知の敵の種類': (s) => { s.segments[0].spawns = { ufo: 2 }; },
    '不正なまとめ項目': (s) => { s.segments[1].spawns.formationDrone.every = 0; },
    'count 配列が3要素': (s) => { s.segments[1].spawns.formationDrone.count = [3, 4, 5]; },
    '未知のボス': (s) => { s.boss.type = 'bossZ'; },
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const stage = ok();
    mutate(stage);
    assert.throws(() => validateStage(stage), Error, name);
  }
  const ufo = ok();
  ufo.segments[0].spawns = { ufo: 2 };
  assert.throws(() => validateStage(ufo), /ufo/);
});
