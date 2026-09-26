import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE5 } from '../js/data/stage5.js';
import { STAGE6 } from '../js/data/stage6.js';
import { stageLabel, getStage } from '../js/data/stages.js';
import { createBoss } from '../js/game/boss.js';
import { BOSS_C_BASE } from '../js/game/boss-c.js';
import { validateStage } from '../js/game/spawner.js';

const typesIn = (stage) => new Set(stage.segments.flatMap((s) => Object.keys(s.spawns)));

test('5面・6面：登録され、名前が付く', () => {
  assert.equal(getStage(5), STAGE5);
  assert.equal(getStage(6), STAGE6);
  assert.equal(STAGE5.id, 5);
  assert.equal(STAGE6.id, 6);
  assert.equal(stageLabel(STAGE5), '5面：防衛拠点・電子戦エリア　');
  assert.equal(stageLabel(STAGE6), '6面：防衛拠点・最終防衛線　');
});

test('5面・6面：出現表の検査を通る', () => {
  validateStage(STAGE5);
  validateStage(STAGE6);
  assert.equal(STAGE5.spawnEnd, 125);
  assert.equal(STAGE6.spawnEnd, 135);
});

test('5面：シールド・テレポートが出て、妨害電波は出ない。旧テーマの敵も混ざる', () => {
  const t = typesIn(STAGE5);
  for (const type of ['shielder', 'teleporter', 'meteor', 'drone', 'burrower', 'thrower', 'formationDrone']) assert.ok(t.has(type), type);
  assert.equal(t.has('jammer'), false);
});

test('6面：妨害電波が加わり、シールド・テレポート・旧テーマの敵も混ざる', () => {
  const t = typesIn(STAGE6);
  for (const type of ['jammer', 'shielder', 'teleporter', 'meteor', 'burrower', 'thrower', 'charger', 'formationDrone']) assert.ok(t.has(type), type);
});

test('5面のボスは、ボスCの初期型（基準値のまま）', () => {
  assert.equal(STAGE5.boss.type, 'bossC');
  const b = createBoss(STAGE5.boss.type, STAGE5.boss.params);
  assert.equal(b.maxHp, 45);
  for (const key of Object.keys(BOSS_C_BASE)) assert.equal(b.p[key], BOSS_C_BASE[key], key);
});

test('6面のボスは、ボスCの強化型：HP70・偽像3・入れ替え4.5秒・シールド8秒・妨害電波7秒・色', () => {
  assert.equal(STAGE6.boss.type, 'bossC');
  const b = createBoss(STAGE6.boss.type, STAGE6.boss.params);
  assert.equal(b.maxHp, 70);
  assert.equal(b.p.decoyCount, 3);
  assert.equal(b.p.swapInterval, 4.5);
  assert.equal(b.p.shieldInterval, 8);
  assert.equal(b.p.jamInterval, 7);
  assert.equal(b.color, '#ff9fd0');
  assert.equal(BOSS_C_BASE.hp, 45); // 基準値は書き換わらない
});
