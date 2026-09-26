import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';
import { stageLabel } from '../js/data/stages.js';
import { BOSS_A_BASE, createBoss } from '../js/game/boss.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { mulberry32 } from '../js/core/util.js';

test('2面：区間が連続していて隙間がなく、spawnEnd と一致する', () => {
  const segs = STAGE2.segments;
  assert.equal(segs[0].from, 0);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].from, segs[i - 1].to);
  assert.equal(segs[segs.length - 1].to, STAGE2.spawnEnd);
});

test('2面：最初の区間には編隊が無く、それ以降の区間には編隊がある', () => {
  const [first, ...rest] = STAGE2.segments;
  assert.equal('formationDrone' in first.spawns, false);
  assert.ok(rest.length >= 2);
  for (const seg of rest) assert.equal(typeof seg.spawns.formationDrone, 'object');
});

test('2面：ボスAの強化型は初期型より強く、それ以外は初期型のまま。基準値は書き換わらない', () => {
  const boss = createBoss(STAGE2.boss.type, STAGE2.boss.params);
  assert.equal(STAGE2.boss.type, 'bossA');
  assert.equal(boss.maxHp, 45);
  assert.equal(boss.p.summonCount, 4);
  assert.equal(boss.p.summonInterval, 6);
  assert.equal(boss.p.color, '#ff8f6b');
  for (const key of ['radius', 'dist', 'angleRange', 'drift', 'moveSpeed', 'summonMinSep', 'minionApproach',
    'shotInterval', 'shotBurst', 'shotGap', 'advanceInterval', 'advanceStep', 'minDist', 'score']) {
    assert.equal(boss.p[key], BOSS_A_BASE[key], key);
  }
  assert.equal(BOSS_A_BASE.hp, 30);
  assert.equal(BOSS_A_BASE.summonCount, 3);
  assert.equal(BOSS_A_BASE.summonInterval, 7.5);
  assert.equal(Object.isFrozen(BOSS_A_BASE), true);
});

test('2面：出現をシミュレートすると、編隊が3〜5機ずつ何度も出る', () => {
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(STAGE2);
  const groups = [];
  for (let i = 0; i < Math.round(STAGE2.spawnEnd / 0.1); i++) {
    const before = state.enemies.length;
    updateSpawner(sp, state, 0.1);
    const fresh = state.enemies.slice(before).filter((e) => e.type === 'formationDrone');
    if (fresh.length) groups.push(fresh.length);
  }
  assert.ok(groups.length >= 6, `groups=${groups.length}`);
  for (const n of groups) assert.ok(n >= 3 && n <= 5, `size ${n}`);
});

test('面の名前：stageLabel', () => {
  assert.equal(STAGE1.name, '上空・隕石帯（序盤）');
  assert.equal(STAGE2.name, '上空・隕石帯（激化）');
  assert.equal(stageLabel(STAGE1), '1面：上空・隕石帯（序盤）　');
  assert.equal(stageLabel(STAGE2), '2面：上空・隕石帯（激化）　');
  assert.equal(stageLabel({ id: 5 }), '5面　');
});
