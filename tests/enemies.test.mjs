import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemies, removeDead, ENEMY_DEFS, DRONE, ENEMY_SHOT_SPEED } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const mkState = () => ({ enemies: [], rng: mulberry32(7) });

test('隕石は接近時間の基準±15%で中心に届く速さ', () => {
  const rng = mulberry32(3);
  const lo = CONFIG.APPROACH_TIME * (1 - CONFIG.APPROACH_JITTER);
  const hi = CONFIG.APPROACH_TIME * (1 + CONFIG.APPROACH_JITTER);
  for (let i = 0; i < 50; i++) {
    const e = createEnemy('meteor', 0, rng);
    assert.equal(e.dist, 460);
    assert.equal(e.hp, 1);
    const time = 460 / e.speed;
    assert.ok(time >= lo - 1e-9 && time <= hi + 1e-9, `time=${time}`);
  }
});

test('共通調整の値：接近時間14秒、敵弾85、自弾 900/2200（連射・旋回・残機は据え置き）', () => {
  assert.equal(CONFIG.APPROACH_TIME, 14);
  assert.equal(ENEMY_SHOT_SPEED, 85);
  assert.equal(CONFIG.BULLET_SPEED_PC, 900);
  assert.equal(CONFIG.BULLET_SPEED_MOBILE, 2200);
  assert.equal(CONFIG.FIRE_RATE, 4);
  assert.equal(CONFIG.TURN_SPEED, 90);
  assert.equal(CONFIG.LIVES, 3);
});

test('隕石は直進する', () => {
  const s = mkState();
  const e = createEnemy('meteor', 10, s.rng, { speed: 50 });
  s.enemies.push(e);
  updateEnemies(s, 1);
  assert.equal(e.dist, 410);
  assert.equal(e.angle, 10);
});

test('ドローンは接近→ホバリング→4.5秒ごとに撃つ→15秒後に再接近', () => {
  const s = mkState();
  const d = createEnemy('drone', 20, s.rng);
  assert.equal(d.hp, 2);
  assert.ok(d.holdDist >= DRONE.holdMin && d.holdDist <= DRONE.holdMax);
  s.enemies.push(d);
  const dt = 1 / 60;
  while (d.phase === 'approach') updateEnemies(s, dt);
  assert.equal(d.phase, 'hover');
  assert.equal(d.dist, d.holdDist);

  for (let i = 0; i < Math.round((DRONE.fireInterval + 0.1) / dt); i++) updateEnemies(s, dt);
  const shots = s.enemies.filter((e) => e.type === 'enemyShot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].speed, ENEMY_SHOT_SPEED);
  assert.ok(Math.abs(d.angle - 20) <= DRONE.sway + 1e-9);

  for (let i = 0; i < Math.round((15.6 - DRONE.fireInterval - 0.1) / dt); i++) updateEnemies(s, dt);
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
