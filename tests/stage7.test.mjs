import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE7 } from '../js/data/stage7.js';
import { STAGES, getStage, stageLabel } from '../js/data/stages.js';
import { createBoss } from '../js/game/boss.js';
import { BOSS_D_BASE } from '../js/game/boss-d.js';
import { validateStage } from '../js/game/spawner.js';

const ALL = ['meteor', 'drone', 'formationDrone', 'burrower', 'thrower', 'charger', 'shielder', 'teleporter', 'jammer'];

test('7面：登録され、名前が付く。1〜7面がそろう', () => {
  assert.equal(getStage(7), STAGE7);
  assert.equal(STAGE7.id, 7);
  assert.equal(stageLabel(STAGE7), '7面：隕石本体・核心部　');
  assert.deepEqual(Object.keys(STAGES), ['1', '2', '3', '4', '5', '6', '7']);
  assert.equal(getStage(8), null);
});

test('7面：出現表の検査を通る。全区間が pool で、全テーマの敵を含む', () => {
  validateStage(STAGE7);
  assert.equal(STAGE7.spawnEnd, 110);
  assert.deepEqual(STAGE7.segments.map((s) => [s.from, s.to]), [[0, 30], [30, 70], [70, 110]]);
  const everys = [];
  for (const seg of STAGE7.segments) {
    const entries = Object.values(seg.spawns);
    assert.equal(entries.length, 1);
    const [entry] = entries;
    assert.deepEqual([...entry.pool].sort(), [...ALL].sort());
    assert.ok(entry.formation, 'formation is required (pool has formationDrone)');
    everys.push(entry.every);
  }
  assert.deepEqual(everys, [1.6, 1.4, 1.2]);
  assert.equal(Object.values(STAGE7.segments[0].spawns)[0].formation.count, 3);
  assert.deepEqual(Object.values(STAGE7.segments[1].spawns)[0].formation.count, [3, 4]);
  assert.deepEqual(Object.values(STAGE7.segments[2].spawns)[0].formation.count, [3, 4]);
});

test('7面のボスは、最終ボス（基準値のまま）', () => {
  assert.equal(STAGE7.boss.type, 'bossD');
  const b = createBoss(STAGE7.boss.type, STAGE7.boss.params);
  assert.equal(b.maxHp, 90);
  assert.equal(b.color, '#ffd24a');
  for (const key of Object.keys(BOSS_D_BASE)) assert.deepEqual(b.p[key], BOSS_D_BASE[key], key);
});
