import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBoss, updateBoss, pickSpreadAngles, BOSS_A_BASE, BOSSES } from '../js/game/boss.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const mkState = () => ({ enemies: [], rng: mulberry32(11) });
const run = (boss, s, seconds, dt = 1 / 60) => {
  for (let i = 0; i < Math.round(seconds / dt); i++) updateBoss(boss, s, dt);
};
// ボスAが距離460から目標の距離まで進入するのにかかる秒数（moveSpeed 28 → 約2.86秒）
const ARRIVE = (CONFIG.SPAWN_DIST - BOSS_A_BASE.dist) / BOSS_A_BASE.moveSpeed;

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
  assert.equal(b.hp, BOSS_A_BASE.hp);
  assert.equal(b.hp, 30);
  assert.equal(b.dist, 460);
  run(b, s, 1);
  assert.equal(b.arrived, false);
  assert.equal(s.enemies.length, 0);
  run(b, s, ARRIVE);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 380);
});

test('到着後7.5秒で子機3体、5秒で敵弾3連射', () => {
  const s = mkState();
  const b = createBoss('bossA');
  run(b, s, ARRIVE + 0.1); // 到着
  run(b, s, BOSS_A_BASE.shotInterval - 0.4); // 到着から shotInterval の少し前＋0.1秒＝約4.7秒は未発射のはずだが、下で確認する
  assert.equal(s.enemies.filter((e) => e.type === 'enemyShot').length, 0);
  run(b, s, 1.2);          // 到着から約5.9秒（3連射の間隔を含む）
  assert.equal(s.enemies.filter((e) => e.type === 'enemyShot').length, 3);
  assert.equal(s.enemies.filter((e) => e.type === 'bossMinion').length, 0);
  run(b, s, BOSS_A_BASE.summonInterval - BOSS_A_BASE.shotInterval - 0.7); // 到着から約7.6秒
  const minions = s.enemies.filter((e) => e.type === 'bossMinion');
  assert.equal(minions.length, 3);
  for (const m of minions) assert.ok(Math.abs(m.dist / m.speed - BOSS_A_BASE.minionApproach) < 0.5);
});

test('12秒ごとに40前進、下限200', () => {
  const s = mkState();
  const b = createBoss('bossA');
  run(b, s, ARRIVE + 0.1);
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
  run(b, s, ARRIVE + 0.1);
  run(b, s, BOSS_A_BASE.summonInterval);
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

test('共通調整：ボスAの子機到達7秒・進入速度28', () => {
  assert.equal(BOSS_A_BASE.minionApproach, 7);
  assert.equal(BOSS_A_BASE.moveSpeed, 28);
  assert.equal(Object.isFrozen(BOSS_A_BASE), true);
});

test('登録表：bossA の名前と、createBoss が name を付ける', () => {
  assert.equal(BOSSES.bossA.name, 'ボスA');
  assert.equal(createBoss('bossA').name, 'ボスA');
  assert.equal(createBoss('bossA', { hp: 60 }).name, 'ボスA');
});

test('createBoss：未知の種類と不正な color は例外', () => {
  assert.throws(() => createBoss('bossZ'), /unknown boss type/);
  assert.throws(() => createBoss('__proto__'), /unknown boss type/);
  for (const c of ['red', '#f80', '#12345', '#1234567', 'ff8f6b', '#gggggg', 123]) {
    assert.throws(() => createBoss('bossA', { color: c }), /invalid boss color/, String(c));
  }
  assert.equal(createBoss('bossA', { color: '#FF8F6B' }).p.color, '#FF8F6B');
});

test('updateBoss は登録表を引いて更新する', () => {
  const s = mkState();
  const b = createBoss('bossA');
  const before = b.dist;
  updateBoss(b, s, 1);
  assert.ok(b.dist < before);
});
