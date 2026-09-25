import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoss, updateBoss, pickSpreadAngles, BOSS_A_BASE } from '../js/game/boss.js';
import { mulberry32 } from '../js/core/util.js';

const mkState = () => ({ enemies: [], rng: mulberry32(11) });
const run = (boss, s, seconds, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) updateBoss(boss, s, dt);
};

test('pickSpreadAngles は互いに minSep 以上離れ、範囲内', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const a = pickSpreadAngles(3, 20, mulberry32(seed));
    assert.equal(a.length, 3);
    for (let i = 0; i < a.length; i++) {
      assert.ok(a[i] >= -90 && a[i] <= 90);
      if (i > 0) assert.ok(a[i] - a[i - 1] >= 20);
    }
  }
});

test('pickSpreadAngles は不可能な条件なら等間隔にする', () => {
  const a = pickSpreadAngles(10, 30, mulberry32(1));
  assert.equal(a.length, 10);
  assert.ok(Math.abs(a[1] - a[0] - 18) < 1e-9);
});

test('ボスは距離460から380まで進入してから攻撃を始める', () => {
  const s = mkState();
  const b = createBoss('bossA');
  assert.equal(b.hp, 40);
  assert.equal(b.dist, 460);
  run(b, s, 1);
  assert.equal(b.arrived, false);
  assert.equal(s.enemies.length, 0);
  run(b, s, 1.1);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 380);
});

test('到着後6秒で子機3体、4秒で敵弾3連射', () => {
  const s = mkState();
  const b = createBoss('bossA');
  run(b, s, 2.1);          // 到着
  run(b, s, 4.6);          // 到着から約4.6秒
  assert.equal(s.enemies.filter((e) => e.type === 'enemyShot').length, 3);
  assert.equal(s.enemies.filter((e) => e.type === 'bossMinion').length, 0);
  run(b, s, 1.5);          // 到着から約6.1秒
  const minions = s.enemies.filter((e) => e.type === 'bossMinion');
  assert.equal(minions.length, 3);
  for (const m of minions) assert.ok(Math.abs(m.dist / m.speed - 5) < 0.5);
});

test('12秒ごとに40前進、下限200', () => {
  const s = mkState();
  const b = createBoss('bossA');
  run(b, s, 2.1);
  run(b, s, 12.05);
  assert.equal(b.targetDist, 340);
  run(b, s, 12 * 10);
  assert.equal(b.targetDist, 200);
  assert.ok(b.dist >= 200);
});

test('左右の往復は±60度に収まる', () => {
  const s = mkState();
  const b = createBoss('bossA');
  for (let i = 0; i < 60 * 40; i++) {
    updateBoss(b, s, 1 / 60);
    assert.ok(Math.abs(b.angle) <= BOSS_A_BASE.angleRange + 1e-9);
  }
});

test('params で強化型のパラメータを上書きできる', () => {
  const s = mkState();
  const b = createBoss('bossA', { summonCount: 5, hp: 60 });
  assert.equal(b.maxHp, 60);
  run(b, s, 2.1);
  run(b, s, 6.1);
  assert.equal(s.enemies.filter((e) => e.type === 'bossMinion').length, 5);
});

test('未知のボスは例外', () => {
  assert.throws(() => createBoss('bossZ'));
});
