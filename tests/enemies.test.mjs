import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemies, removeDead, ENEMY_DEFS, DRONE } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';

const mkState = () => ({ enemies: [], rng: mulberry32(7) });

test('隕石は8.5〜11.5秒で中心に届く速さ', () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 50; i++) {
    const e = createEnemy('meteor', 0, rng);
    assert.equal(e.dist, 460);
    assert.equal(e.hp, 1);
    const time = 460 / e.speed;
    assert.ok(time >= 8.5 - 1e-9 && time <= 11.5 + 1e-9, `time=${time}`);
  }
});

test('隕石は直進する', () => {
  const s = mkState();
  const e = createEnemy('meteor', 10, s.rng, { speed: 50 });
  s.enemies.push(e);
  updateEnemies(s, 1);
  assert.equal(e.dist, 410);
  assert.equal(e.angle, 10);
});

test('ドローンは接近→ホバリング→3.5秒ごとに撃つ→15秒後に再接近', () => {
  const s = mkState();
  const d = createEnemy('drone', 20, s.rng);
  assert.equal(d.hp, 2);
  assert.ok(d.holdDist >= DRONE.holdMin && d.holdDist <= DRONE.holdMax);
  s.enemies.push(d);
  const dt = 1 / 60;
  while (d.phase === 'approach') updateEnemies(s, dt);
  assert.equal(d.phase, 'hover');
  assert.equal(d.dist, d.holdDist);

  for (let i = 0; i < Math.round(3.6 / dt); i++) updateEnemies(s, dt);
  const shots = s.enemies.filter((e) => e.type === 'enemyShot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].speed, 120);
  assert.ok(Math.abs(d.angle - 20) <= DRONE.sway + 1e-9);

  for (let i = 0; i < Math.round(12 / dt); i++) updateEnemies(s, dt);
  assert.equal(d.phase, 'advance');
  const before = d.dist;
  updateEnemies(s, 1);
  assert.ok(d.dist < before);
});

test('未知の敵タイプは例外', () => {
  assert.throws(() => createEnemy('nope', 0, mulberry32(1)));
});

test('敵弾は撃破数に数えない', () => {
  assert.equal(ENEMY_DEFS.enemyShot.countsAsKill, false);
  assert.equal(ENEMY_DEFS.meteor.countsAsKill, true);
});

test('removeDead は dead を取り除く', () => {
  const list = [{ dead: false }, { dead: true }, { dead: false }];
  removeDead(list);
  assert.equal(list.length, 2);
});
