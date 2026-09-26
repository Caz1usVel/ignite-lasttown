import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnBullet, updateBullets, MUZZLE_DIST } from '../js/game/bullets.js';
import { resolveBulletHits, resolveCoreHits, applyKnockback, circlesOverlap } from '../js/game/collision.js';
import { createTurret } from '../js/game/turret.js';
import { createEnemy } from '../js/game/enemies.js';
import { createBoss } from '../js/game/boss.js';
import { mulberry32 } from '../js/core/util.js';

const rng = mulberry32(9);
const mkState = () => ({ turret: createTurret(), bullets: [], enemies: [], boss: null, rng });
const bullet = (angle, prevDist, dist) => ({ angle, prevDist, dist, speed: 600, radius: 6, dead: false });

test('circlesOverlap', () => {
  assert.equal(circlesOverlap(0, 0, 5, 9, 0, 5), true);
  assert.equal(circlesOverlap(0, 0, 5, 11, 0, 5), false);
});

test('spawnBullet と updateBullets', () => {
  const s = mkState();
  spawnBullet(s, 12, 600);
  assert.equal(s.bullets[0].dist, MUZZLE_DIST);
  updateBullets(s, 0.1);
  assert.equal(s.bullets[0].prevDist, MUZZLE_DIST);
  assert.equal(s.bullets[0].dist, MUZZLE_DIST + 60);
});

test('範囲外に出た弾は dead', () => {
  const s = mkState();
  s.bullets.push(bullet(0, 530, 540));
  updateBullets(s, 0.01);
  assert.equal(s.bullets[0].dead, true);
});

test('正面の隕石に当たると kill', () => {
  const s = mkState();
  const m = createEnemy('meteor', 0, rng, { dist: 200 });
  s.enemies.push(m);
  s.bullets.push(bullet(0, 150, 250));
  const ev = resolveBulletHits(s);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, 'kill');
  assert.equal(ev[0].target, m);
  assert.equal(m.dead, true);
  assert.equal(s.bullets[0].dead, true);
});

test('1フレームで大きく進む弾もすり抜けない', () => {
  const s = mkState();
  s.enemies.push(createEnemy('meteor', 0, rng, { dist: 140 }));
  s.bullets.push(bullet(0, 100, 175));
  assert.equal(resolveBulletHits(s).length, 1);
});

test('視界外の敵には当たらない', () => {
  const s = mkState();
  s.enemies.push(createEnemy('meteor', 50, rng, { dist: 200 }));
  s.bullets.push(bullet(50, 150, 250));
  assert.equal(resolveBulletHits(s).length, 0);
});

test('HP2のドローンは1発目が hit', () => {
  const s = mkState();
  const d = createEnemy('drone', 0, rng, { dist: 300 });
  s.enemies.push(d);
  s.bullets.push(bullet(0, 260, 320));
  const ev = resolveBulletHits(s);
  assert.equal(ev[0].type, 'hit');
  assert.equal(d.hp, 1);
  assert.equal(d.dead, false);
});

test('ボスにも当たる', () => {
  const s = mkState();
  s.boss = createBoss('bossA');
  s.boss.dist = 380;
  s.bullets.push(bullet(0, 300, 360));
  const ev = resolveBulletHits(s);
  assert.equal(ev[0].target, s.boss);
  assert.equal(s.boss.hp, 39);
});

test('中心に届いた敵は dead になり、数が返る', () => {
  const s = mkState();
  const a = createEnemy('meteor', 0, rng, { dist: 30 });
  const b = createEnemy('meteor', 0, rng, { dist: 50 });
  s.enemies.push(a, b);
  assert.equal(resolveCoreHits(s), 1);
  assert.equal(a.dead, true);
  assert.equal(b.dead, false);
});

test('ノックバックは半径200より内側だけ80押し戻す', () => {
  const s = mkState();
  const a = createEnemy('meteor', 0, rng, { dist: 150 });
  const b = createEnemy('meteor', 0, rng, { dist: 250 });
  s.enemies.push(a, b);
  applyKnockback(s);
  assert.equal(a.dist, 230);
  assert.equal(b.dist, 250);
});
