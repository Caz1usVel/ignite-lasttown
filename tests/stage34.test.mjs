import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE3 } from '../js/data/stage3.js';
import { STAGE4 } from '../js/data/stage4.js';
import { stageLabel, getStage } from '../js/data/stages.js';
import { createBoss } from '../js/game/boss.js';
import { BOSS_B_BASE } from '../js/game/boss-b.js';
import { validateStage } from '../js/game/spawner.js';

const typesIn = (stage) => new Set(stage.segments.flatMap((s) => Object.keys(s.spawns)));

test('3面・4面：登録され、名前が付く', () => {
  assert.equal(getStage(3), STAGE3);
  assert.equal(getStage(4), STAGE4);
  assert.equal(STAGE3.id, 3);
  assert.equal(STAGE4.id, 4);
  assert.equal(stageLabel(STAGE3), '3面：落下地帯・地表　');
  assert.equal(stageLabel(STAGE4), '4面：落下地帯・激戦区　');
});

test('3面・4面：出現表の検査を通る（区間の連続、spawnEnd、敵の種類、ボス）', () => {
  validateStage(STAGE3);
  validateStage(STAGE4);
  assert.equal(STAGE3.spawnEnd, 120);
  assert.equal(STAGE4.spawnEnd, 130);
});

test('3面：突き上げ敵・破片飛ばし敵が出て、突進敵は出ない。旧テーマの敵も混ざる', () => {
  const t = typesIn(STAGE3);
  for (const type of ['burrower', 'thrower', 'meteor', 'drone', 'formationDrone']) assert.ok(t.has(type), type);
  assert.equal(t.has('charger'), false);
});

test('4面：突進敵が出て、3面の敵も旧テーマの敵も混ざる', () => {
  const t = typesIn(STAGE4);
  for (const type of ['charger', 'burrower', 'thrower', 'meteor', 'drone', 'formationDrone']) assert.ok(t.has(type), type);
});

test('3面のボスは、ボスBの初期型（基準値のまま）', () => {
  assert.equal(STAGE3.boss.type, 'bossB');
  const b = createBoss(STAGE3.boss.type, STAGE3.boss.params);
  assert.equal(b.maxHp, 50);
  for (const key of Object.keys(BOSS_B_BASE)) assert.equal(b.p[key], BOSS_B_BASE[key], key);
});

test('4面のボスは、ボスBの強化型：HP80・連続2回・間隔6.5・突進2.3秒・中断8・散布5秒・色', () => {
  assert.equal(STAGE4.boss.type, 'bossB');
  const b = createBoss(STAGE4.boss.type, STAGE4.boss.params);
  assert.equal(b.maxHp, 80);
  assert.equal(b.p.dashCount, 2);
  assert.equal(b.p.dashInterval, 6.5);
  assert.equal(b.p.dashTime, 2.3);
  assert.equal(b.p.dashBreak, 8);
  assert.equal(b.p.scatterInterval, 5);
  assert.equal(b.p.color, '#ff7a3d');
  assert.equal(BOSS_B_BASE.hp, 50); // 基準値は書き換わらない
});
