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

test('createBoss：params の color が p.color に入り、基準値には color が無い', () => {
  assert.equal('color' in BOSS_A_BASE, false);
  assert.equal(createBoss('bossA').p.color, undefined);
  assert.equal(createBoss('bossA', { color: '#ff8f6b' }).p.color, '#ff8f6b');
  assert.equal('color' in BOSS_A_BASE, false); // 基準値は書き換わらない
});

test('pickSpreadAngles：実現可能なら常に昇順・範囲内・minSep 以上（200シード × 1〜5機）', () => {
  for (let count = 1; count <= 5; count++) {
    for (let seed = 1; seed <= 200; seed++) {
      const a = pickSpreadAngles(count, 25, mulberry32(seed));
      assert.equal(a.length, count);
      for (let i = 0; i < a.length; i++) {
        assert.ok(a[i] >= -90 - 1e-9 && a[i] <= 90 + 1e-9, `angle ${a[i]}`);
        if (i > 0) assert.ok(a[i] - a[i - 1] >= 25 - 1e-9, `gap ${a[i] - a[i - 1]}`);
      }
    }
  }
});

test('pickSpreadAngles：5機・minSep 25 でも固定の等間隔に落ちず、配置がばらける', () => {
  const sets = new Set();
  for (let seed = 1; seed <= 200; seed++) {
    const a = pickSpreadAngles(5, 25, mulberry32(seed));
    assert.notDeepEqual(a.map((x) => Math.round(x * 1e6) / 1e6), [-72, -36, 0, 36, 72]);
    sets.add(JSON.stringify(a));
  }
  assert.ok(sets.size >= 150, `distinct=${sets.size}`);
});

test('pickSpreadAngles：1機なら範囲内の角度を1つ返す', () => {
  const a = pickSpreadAngles(1, 25, mulberry32(3));
  assert.equal(a.length, 1);
  assert.ok(a[0] >= -90 && a[0] <= 90);
});
