import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTurret, updateTurret, tryFire, damageTurret } from '../js/game/turret.js';

test('旋回は90度/秒', () => {
  const t = createTurret();
  updateTurret(t, 0.5, 1);
  assert.equal(t.heading, 45);
  updateTurret(t, 0.5, -1);
  assert.equal(t.heading, 0);
});

test('旋回は±90度で止まる', () => {
  const t = createTurret();
  updateTurret(t, 3, 1);
  assert.equal(t.heading, 90);
  updateTurret(t, 5, -1);
  assert.equal(t.heading, -90);
});

test('押しっぱなしで1秒に4発', () => {
  const t = createTurret();
  let shots = 0;
  for (let i = 0; i < 60; i++) {
    updateTurret(t, 1 / 60, 0);
    if (tryFire(t)) shots++;
  }
  assert.equal(shots, 4);
});

test('被弾で残機-1、無敵中は減らない、1.5秒で無敵が切れる', () => {
  const t = createTurret();
  assert.equal(damageTurret(t), true);
  assert.equal(t.lives, 2);
  assert.equal(damageTurret(t), false);
  assert.equal(t.lives, 2);
  updateTurret(t, 1.5, 0);
  assert.equal(t.invincible, 0);
  assert.equal(damageTurret(t), true);
  assert.equal(t.lives, 1);
});

const countShots = (fireRate, hz, seconds, idleSeconds = 0) => {
  const t = createTurret();
  t.fireRate = fireRate;
  const dt = 1 / hz;
  for (let i = 0; i < Math.round(idleSeconds * hz); i++) updateTurret(t, dt, 0);
  let shots = 0;
  for (let i = 0; i < Math.round(seconds * hz); i++) {
    updateTurret(t, dt, 0);
    if (tryFire(t)) shots++;
  }
  return shots;
};

test('連射速度どおりに撃てる（10秒間押しっぱなし）', () => {
  assert.ok(Math.abs(countShots(4, 60, 10) - 40) <= 1);
  assert.ok(Math.abs(countShots(4.6, 60, 10) - 46) <= 1);
  assert.ok(Math.abs(countShots(7, 60, 10) - 70) <= 1);
  assert.ok(Math.abs(countShots(4.6, 120, 10) - 46) <= 1);
});

test('撃たずに待っても、あとでまとめ撃ちにならない', () => {
  assert.ok(Math.abs(countShots(4, 60, 1, 3) - 4) <= 1);
});
