import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, updateSpawner, validateStage } from '../js/game/spawner.js';
import { STAGES } from '../js/data/stages.js';
import { STAGE1 } from '../js/data/stage1.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

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

test('0〜20秒は隕石だけが 3秒×SPAWN_SCALE ごと（4体）', () => {
  const { log } = simulate(20);
  assert.equal(Math.floor(20 / (3.0 * CONFIG.SPAWN_SCALE)), 4);
  assert.equal(log.filter((l) => l.type === 'meteor' && l.time < 20).length, 4);
  assert.equal(log.filter((l) => l.type === 'drone' && l.time < 20).length, 0);
});

test('90秒までの総数がおおむね出現表どおり', () => {
  const { log } = simulate(90);
  const meteors = log.filter((l) => l.type === 'meteor').length;
  const drones = log.filter((l) => l.type === 'drone').length;
  const k = CONFIG.SPAWN_SCALE;
  // 区間ごとの間隔 × SPAWN_SCALE。タイマーは区間ごとに新しく数えるので、区間ごとに切り捨てる
  const expMeteors = Math.floor(20 / (3.0 * k)) + Math.floor(40 / (2.0 * k)) + Math.floor(30 / (1.5 * k));
  const expDrones = Math.floor(40 / (8 * k)) + Math.floor(30 / (6 * k));
  assert.ok(Math.abs(meteors - expMeteors) <= 2, `meteors=${meteors} expected≈${expMeteors}`);
  assert.ok(Math.abs(drones - expDrones) <= 2, `drones=${drones} expected≈${expDrones}`);
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
  const sp = createSpawner(stage, 1); // 既存の算術を保つため scale = 1
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

test('区間ごとのタイマー：区間に入ってから every 秒後が最初の出現で、前の区間の余りを引き継がない', () => {
  const stage = {
    id: 9,
    segments: [
      { from: 0, to: 10, spawns: { meteor: 4 } },   // 4, 8 に出る（余り 2 秒）
      { from: 10, to: 30, spawns: { meteor: 6 } },  // 引き継ぐと 12 に出るが、新しく始めるので 16, 22, 28
    ],
    spawnEnd: 30,
    boss: { type: 'bossA', params: {} },
  };
  const { groups } = simulateStage(stage, 29.9);
  const times = groups.map((g) => Math.round(g.time));
  assert.deepEqual(times, [4, 8, 16, 22, 28]);
});

test('同じ種類が離れた区間に現れても、前に現れたときの余りを持ち越さない', () => {
  const stage = {
    id: 9,
    segments: [
      { from: 0, to: 10, spawns: { meteor: 4 } },
      { from: 10, to: 20, spawns: { drone: 5 } },
      { from: 20, to: 40, spawns: { meteor: 7 } }, // 20 + 7 = 27 が最初
    ],
    spawnEnd: 40,
    boss: { type: 'bossA', params: {} },
  };
  const { groups } = simulateStage(stage, 39.9);
  const meteorTimes = groups.filter((g) => g.types.includes('meteor')).map((g) => Math.round(g.time));
  assert.deepEqual(meteorTimes, [4, 8, 27, 34]);
});
