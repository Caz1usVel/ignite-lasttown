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

const pbullet = (angle, prevDist, dist, pierceLeft) => ({ ...bullet(angle, prevDist, dist), pierceLeft });
const meteorAt = (s, dist) => {
  const m = createEnemy('meteor', 0, rng, { dist, speed: 0 });
  s.enemies.push(m);
  return m;
};

test('spawnBullet は turret.pierce を pierceLeft に入れる', () => {
  const s = mkState();
  s.turret.pierce = 2;
  spawnBullet(s, 0, 600);
  assert.equal(s.bullets[0].pierceLeft, 2);
});

test('貫通0：1体倒したら弾は消え、奥の敵には当たらない', () => {
  const s = mkState();
  const a = meteorAt(s, 100), b = meteorAt(s, 150);
  s.bullets.push(pbullet(0, 60, 260, 0));
  const ev = resolveBulletHits(s);
  assert.equal(ev.length, 1);
  assert.equal(a.dead, true);
  assert.equal(b.dead, false);
  assert.equal(s.bullets[0].dead, true);
});

test('貫通2：3体まで倒して弾が消える（4体目は無傷）', () => {
  const s = mkState();
  const ms = [100, 150, 200, 250].map((d) => meteorAt(s, d));
  s.bullets.push(pbullet(0, 60, 300, 2));
  const ev = resolveBulletHits(s);
  assert.equal(ev.filter((e) => e.type === 'kill').length, 3);
  assert.deepEqual(ms.map((m) => m.dead), [true, true, true, false]);
  assert.equal(s.bullets[0].dead, true);
});

test('貫通1：1体倒したあとも弾は生きていて、残りの貫通は0になる', () => {
  const s = mkState();
  const a = meteorAt(s, 100);
  s.bullets.push(pbullet(0, 60, 160, 1));
  const ev = resolveBulletHits(s);
  assert.equal(ev.length, 1);
  assert.equal(a.dead, true);
  assert.equal(s.bullets[0].dead, false);
  assert.equal(s.bullets[0].pierceLeft, 0);
});

test('倒しきれなかったら貫通していても弾は止まる', () => {
  const s = mkState();
  const d = createEnemy('drone', 0, rng, { dist: 100, speed: 0 });
  const behind = meteorAt(s, 160);
  s.enemies.push(d);
  s.bullets.push(pbullet(0, 60, 260, 3));
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((e) => e.type), ['hit']);
  assert.equal(d.hp, 1);
  assert.equal(behind.dead, false);
  assert.equal(s.bullets[0].dead, true);
});

test('pierceLeft が無い弾は貫通0として扱う', () => {
  const s = mkState();
  const a = meteorAt(s, 100), b = meteorAt(s, 150);
  s.bullets.push(bullet(0, 60, 260));
  resolveBulletHits(s);
  assert.equal(a.dead, true);
  assert.equal(b.dead, false);
});

test('小数のダメージが積もっても、HP÷ダメージ回で倒せる（攻撃力Lv3で HP8 は5発）', () => {
  const run = (n) => {
    const s = mkState();
    s.turret.damage = 1 + 0.2 * 3;
    const m = createEnemy('meteor', 0, rng, { dist: 100, speed: 0 });
    m.hp = 8;
    s.enemies.push(m);
    for (let i = 0; i < n; i++) s.bullets.push(bullet(0, 60, 160));
    return { ev: resolveBulletHits(s), m };
  };
  const four = run(4);
  assert.equal(four.m.dead, false);
  const five = run(5);
  assert.equal(five.ev.length, 5);
  assert.equal(five.ev[4].type, 'kill');
  assert.equal(five.m.dead, true);
});
