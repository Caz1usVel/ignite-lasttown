import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemy, updateEnemies, ENEMY_DEFS, ENEMY_SHOT_SPEED, SHIELDER, TELEPORTER, JAMMER,
} from '../js/game/enemies.js';
import { resolveBulletHits, resolveCoreHits, resolveJamHits } from '../js/game/collision.js';
import { createTurret, updateTurret, tryFire } from '../js/game/turret.js';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const rng = mulberry32(9);
const mkState = (seed = 7) => ({ enemies: [], rng: mulberry32(seed) });
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) updateEnemies(s, DT); };
const of = (s, type) => s.enemies.filter((e) => e.type === type);
const mkCombat = () => ({ turret: createTurret(), bullets: [], enemies: [], boss: null, rng });
const bullet = (angle, prevDist, dist, pierceLeft = 0) => ({ angle, prevDist, dist, speed: 900, radius: 6, dead: false, pierceLeft });

test('定義とパラメータ', () => {
  assert.deepEqual(ENEMY_DEFS.shielder, { hp: 1, radius: 26, score: 200, countsAsKill: true, behavior: 'shielder' });
  assert.deepEqual(ENEMY_DEFS.teleporter, { hp: 2, radius: 22, score: 250, countsAsKill: true, behavior: 'teleporter' });
  assert.deepEqual(ENEMY_DEFS.jammer, { hp: 2, radius: 24, score: 250, countsAsKill: true, behavior: 'jammer' });
  assert.deepEqual(ENEMY_DEFS.jamShot, { hp: 1, radius: 12, score: 10, countsAsKill: false, behavior: 'straight' });
  assert.equal(CONFIG.JAM_TIME, 1.5);
  assert.equal(SHIELDER.cycle, 3.0);
  assert.equal(SHIELDER.closedTime, 2.2);
  assert.equal(TELEPORTER.interval, 3.0);
  assert.equal(TELEPORTER.minDelta, 30);
  assert.equal(JAMMER.fireInterval, 5.0);
});

// ---- シールド敵 ----
test('シールド敵：接近の間は閉じていて、保持距離320〜380で止まる', () => {
  const s = mkState();
  const e = createEnemy('shielder', 0, s.rng);
  assert.equal(e.phase, 'approach');
  assert.equal(e.shielded, true);
  assert.ok(e.holdDist >= 320 && e.holdDist <= 380);
  s.enemies.push(e);
  while (e.phase === 'approach') { updateEnemies(s, DT); assert.equal(e.shielded, true); }
  assert.equal(e.phase, 'hover');
  assert.equal(e.dist, e.holdDist);
});

test('シールド敵：保持に入ってから、閉じる2.2秒 → 開く0.8秒 の周期。開く前の0.3秒は点滅', () => {
  const s = mkState();
  const e = createEnemy('shielder', 0, s.rng);
  s.enemies.push(e);
  while (e.phase === 'approach') updateEnemies(s, DT);
  run(s, 1.0);
  assert.equal(e.shielded, true);
  assert.equal(e.blink, false);
  run(s, 1.0); // 2.0 秒：開く前の0.3秒（1.9〜2.2）に入っている
  assert.equal(e.shielded, true);
  assert.equal(e.blink, true);
  run(s, 0.4); // 2.4 秒：開いている
  assert.equal(e.shielded, false);
  assert.equal(e.blink, false);
  run(s, 0.7); // 3.1 秒：次の周期の閉じている間
  assert.equal(e.shielded, true);
});

test('シールド敵：14秒保持したあと、前進を再開する（周期は続く）', () => {
  const s = mkState();
  const e = createEnemy('shielder', 0, s.rng);
  s.enemies.push(e);
  while (e.phase === 'approach') updateEnemies(s, DT);
  run(s, 13.9);
  assert.equal(e.phase, 'hover');
  run(s, 0.3);
  assert.equal(e.phase, 'advance');
  const before = e.dist;
  run(s, 1);
  assert.ok(e.dist < before);
});

test('吸収：閉じているシールドに当たった弾はダメージなしで消え、block イベントになる（貫通も止まる）', () => {
  const s = mkCombat();
  const e = createEnemy('shielder', 0, rng, { dist: 200, speed: 0 });
  e.shielded = true;
  const behind = createEnemy('meteor', 0, rng, { dist: 300, speed: 0 });
  s.enemies.push(e, behind);
  s.bullets.push(bullet(0, 150, 400, 3));
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((x) => x.type), ['block']);
  assert.equal(ev[0].target, e);
  assert.equal(e.hp, 1);
  assert.equal(e.dead, false);
  assert.equal(behind.dead, false);       // 後ろの敵は守られる
  assert.equal(s.bullets[0].dead, true);
});

test('吸収：開いているシールドは、普通に倒せる', () => {
  const s = mkCombat();
  const e = createEnemy('shielder', 0, rng, { dist: 200, speed: 0 });
  e.shielded = false;
  s.enemies.push(e);
  s.bullets.push(bullet(0, 150, 260));
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((x) => x.type), ['kill']);
  assert.equal(e.dead, true);
});

// ---- テレポート敵 ----
test('テレポート敵：通常の速さで前進し、3±0.5秒ごとに角度だけ30度以上ずれた場所へ瞬間移動する（距離はそのまま）', () => {
  const s = mkState();
  const e = createEnemy('teleporter', 10, s.rng, { speed: 0 }); // 前進を止めて、瞬間移動だけを見る
  s.enemies.push(e);
  assert.ok(e.tpT >= 2.5 && e.tpT <= 3.5);
  const jumps = [];
  let last = e.angle;
  for (let i = 0; i < 60 * 20; i++) {
    updateEnemies(s, DT);
    if (e.angle !== last) { jumps.push({ t: (i + 1) * DT, from: last, to: e.angle, dist: e.dist }); last = e.angle; }
  }
  assert.ok(jumps.length >= 5 && jumps.length <= 8, `jumps=${jumps.length}`);
  for (const j of jumps) {
    assert.ok(Math.abs(j.to - j.from) >= 30 - 1e-9, `delta ${j.to - j.from}`);
    assert.ok(j.to >= -90 && j.to <= 90);
    assert.equal(j.dist, 460);
  }
  for (let i = 1; i < jumps.length; i++) {
    const gap = jumps[i].t - jumps[i - 1].t;
    assert.ok(gap >= 2.5 - 0.05 && gap <= 3.5 + 0.05, `gap ${gap}`);
  }
});

test('テレポート敵：移動の0.4秒前から warn、移動の直後は 0.3秒 warpFlash', () => {
  const s = mkState();
  const e = createEnemy('teleporter', 0, s.rng, { speed: 0 });
  s.enemies.push(e);
  run(s, e.tpT - 0.5);
  assert.equal(e.warn, false);
  run(s, 0.2);
  assert.equal(e.warn, true);
  const before = e.angle;
  while (e.angle === before) updateEnemies(s, DT);
  assert.equal(e.warn, false);
  assert.ok(e.warpFlash > 0.2 && e.warpFlash <= 0.3);
  run(s, 0.4);
  assert.equal(e.warpFlash, 0);
});

test('テレポート敵：接近もする（速さは通常の接近速度）', () => {
  const s = mkState();
  const e = createEnemy('teleporter', 0, s.rng);
  s.enemies.push(e);
  const time = 460 / e.speed;
  assert.ok(time >= CONFIG.APPROACH_TIME * 0.85 - 1e-9 && time <= CONFIG.APPROACH_TIME * 1.15 + 1e-9);
  run(s, 1);
  assert.ok(Math.abs(460 - e.dist - e.speed) < e.speed * 0.05);
});

// ---- 妨害電波敵と妨害の効果 ----
test('妨害電波敵：保持距離300〜360で止まり、5秒ごとに jamShot を1発放つ。14秒保持したら前進', () => {
  const s = mkState();
  const j = createEnemy('jammer', 20, s.rng);
  assert.equal(j.hp, 2);
  assert.ok(j.holdDist >= 300 && j.holdDist <= 360);
  s.enemies.push(j);
  while (j.phase === 'approach') updateEnemies(s, DT);
  assert.equal(j.phase, 'hover');
  run(s, 4.9);
  assert.equal(of(s, 'jamShot').length, 0);
  run(s, 0.2);
  const shots = of(s, 'jamShot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].speed, ENEMY_SHOT_SPEED);
  assert.ok(Math.abs(shots[0].angle - 20) <= JAMMER.sway + 1e-9);
  run(s, 9);
  assert.equal(j.phase, 'advance');
});

test('jamShot は撃ち落とせる（撃破数に数えない）', () => {
  const s = mkCombat();
  const shot = createEnemy('jamShot', 0, rng, { dist: 200, speed: 0 });
  s.enemies.push(shot);
  s.bullets.push(bullet(0, 150, 260));
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((x) => x.type), ['kill']);
  assert.equal(ENEMY_DEFS.jamShot.countsAsKill, false);
});

test('jamShot が中心に届くと、残機は減らず、jam が1.5秒になって弾は消える。resolveCoreHits は数えない', () => {
  const s = mkCombat();
  const shot = createEnemy('jamShot', 0, rng, { dist: 30, speed: 0 });
  const meteor = createEnemy('meteor', 0, rng, { dist: 500, speed: 0 });
  s.enemies.push(shot, meteor);
  assert.equal(resolveCoreHits(s), 0);
  assert.equal(shot.dead, false);
  assert.equal(resolveJamHits(s), 1);
  assert.equal(shot.dead, true);
  assert.equal(s.turret.jam, CONFIG.JAM_TIME);
  assert.equal(s.turret.lives, 3);
  assert.equal(resolveJamHits(s), 0);
});

test('妨害中は撃てず、時間で回復する', () => {
  const t = createTurret();
  assert.equal(t.jam, 0);
  t.jam = 1.5;
  updateTurret(t, DT, 0);
  assert.equal(tryFire(t), false);
  updateTurret(t, 1.0, 0);
  assert.equal(tryFire(t), false);
  updateTurret(t, 0.6, 0);
  assert.equal(t.jam, 0);
  assert.equal(tryFire(t), true);
});

test('stepGame：jamShot が届くと jam イベント、残機は減らない。妨害中は発射しない', () => {
  const stage = { id: 0, segments: [], spawnEnd: 1e9, boss: { type: 'bossA', params: {} } };
  const s = createPlayState(stage, mulberry32(1));
  s.enemies.push(createEnemy('jamShot', 0, s.rng, { dist: 41, speed: 100 }));
  const fire = { turnAxis: 0, firing: true, aim: { x: 500, y: 100 }, bulletSpeed: CONFIG.BULLET_SPEED_PC };
  // 最初の1歩は撃たない（同じフレームの自弾が jamShot を撃ち落としてしまうため）
  const ev = stepGame(s, 0.05, { ...fire, firing: false });
  assert.ok(ev.some((e) => e.type === 'jam'));
  assert.equal(s.turret.lives, 3);
  assert.equal(ev.some((e) => e.type === 'damage'), false);
  const ev2 = stepGame(s, DT, fire);
  assert.equal(ev2.some((e) => e.type === 'fire'), false); // 妨害中は撃てない
  assert.equal(s.bullets.length, 0);
  for (let i = 0; i < 60 * 2; i++) stepGame(s, DT, fire);
  assert.ok(s.bullets.length > 0 || s.turret.jam === 0); // 回復したら撃てる
  assert.equal(s.turret.jam, 0);
});
