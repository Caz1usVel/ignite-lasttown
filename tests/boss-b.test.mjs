import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_B_BASE, createBossB, updateBossB, pickHiddenAngle } from '../js/game/boss-b.js';
import { createBoss, updateBoss, BOSSES } from '../js/game/boss.js';
import { ENEMY_SHOT_SPEED } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const mkState = (heading = 0, fov = 70) => ({ enemies: [], rng: mulberry32(11), turret: { heading, fov } });
const step = (b, s, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) updateBossB(b, s, DT); };
const toIdle = (b, s) => step(b, s, (CONFIG.SPAWN_DIST - b.p.dist) / b.p.moveSpeed + 0.1);
// 指定の phase になるまで進める（最大 maxSec 秒）
const until = (b, s, phase, maxSec = 40) => {
  for (let i = 0; i < Math.round(maxSec / DT) && b.phase !== phase; i++) updateBossB(b, s, DT);
  return b.phase === phase;
};

test('BOSS_B_BASE：仕様の値で、凍結されている', () => {
  assert.equal(Object.isFrozen(BOSS_B_BASE), true);
  assert.equal(BOSS_B_BASE.hp, 50);
  assert.equal(BOSS_B_BASE.dist, 340);
  assert.equal(BOSS_B_BASE.moveSpeed, 28);
  assert.equal(BOSS_B_BASE.dashInterval, 9);
  assert.equal(BOSS_B_BASE.dashCount, 1);
  assert.equal(BOSS_B_BASE.telegraph, 1.0);
  assert.equal(BOSS_B_BASE.vanish, 0.8);
  assert.equal(BOSS_B_BASE.reappearDist, 440);
  assert.equal(BOSS_B_BASE.reappearMargin, 15);
  assert.equal(BOSS_B_BASE.settle, 0.4);
  assert.equal(BOSS_B_BASE.dashTime, 2.6);
  assert.equal(BOSS_B_BASE.dashBreak, 8);
  assert.equal(BOSS_B_BASE.scatterInterval, 7);
  assert.equal(BOSS_B_BASE.scatterCount, 7);
  assert.equal(BOSS_B_BASE.scatterSpread, 120);
  assert.equal(BOSS_B_BASE.roarTime, 2.2);
  assert.equal(BOSS_B_BASE.roarMult, 1.5);
  assert.equal(BOSS_B_BASE.score, 6000);
  assert.equal('color' in BOSS_B_BASE, false);
});

test('登録表：bossB を createBoss で作れる（名前・色の検査つき）', () => {
  assert.equal(BOSSES.bossB.name, 'ボスB');
  const b = createBoss('bossB');
  assert.equal(b.type, 'bossB');
  assert.equal(b.name, 'ボスB');
  assert.equal(b.hp, 50);
  assert.equal(b.dist, 460);
  assert.throws(() => createBoss('bossB', { color: 'orange' }), /invalid boss color/);
  assert.equal(createBoss('bossB', { color: '#ff7a3d' }).p.color, '#ff7a3d');
  const strong = createBoss('bossB', { hp: 80, dashCount: 2 });
  assert.equal(strong.maxHp, 80);
  assert.equal(BOSS_B_BASE.hp, 50); // 基準値は書き換わらない
});

test('進入：距離460から340まで進み、着いたら待機（idle）', () => {
  const s = mkState();
  const b = createBossB();
  assert.equal(b.phase, 'approach');
  step(b, s, 1);
  assert.equal(b.arrived, false);
  toIdle(b, s);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 340);
  assert.equal(b.phase, 'idle');
  assert.equal(b.hidden, false);
});

test('updateBoss は bossB を更新する', () => {
  const s = mkState();
  const b = createBoss('bossB');
  const before = b.dist;
  updateBoss(b, s, 1);
  assert.ok(b.dist < before);
});

// ---- 再出現の角度 ----
test('pickHiddenAngle：視界の外（視界の半分＋余白の外側）から、-90〜+90 度で選ぶ', () => {
  const rng = mulberry32(3);
  for (const heading of [-90, -60, -30, 0, 30, 60, 90]) {
    for (const fov of [70, 78, 86, 94]) {
      for (let i = 0; i < 200; i++) {
        const a = pickHiddenAngle(heading, fov, 15, rng);
        assert.ok(a >= -90 && a <= 90, `a=${a}`);
        assert.ok(Math.abs(a - heading) >= fov / 2 + 15 - 1e-9, `heading=${heading} fov=${fov} a=${a}`);
      }
    }
  }
});

test('pickHiddenAngle：左右の両方が候補なら、両方から選ぶ。片方しか無ければそちら', () => {
  const rng = mulberry32(5);
  const seen = { left: 0, right: 0 };
  for (let i = 0; i < 400; i++) { const a = pickHiddenAngle(0, 70, 15, rng); if (a < 0) seen.left++; else seen.right++; }
  assert.ok(seen.left > 100 && seen.right > 100, JSON.stringify(seen));
  for (let i = 0; i < 100; i++) assert.ok(pickHiddenAngle(-90, 70, 15, rng) > -90 + 50 - 1e-9); // 左端を向いているなら、右側だけ
  for (let i = 0; i < 100; i++) assert.ok(pickHiddenAngle(90, 70, 15, rng) < 90 - 50 + 1e-9);  // 右端を向いているなら、左側だけ
});

test('pickHiddenAngle：視界の外が存在しない条件では、向きの反対側の端を返す', () => {
  assert.equal(pickHiddenAngle(0, 70, 200, mulberry32(1)), -90);
  assert.equal(pickHiddenAngle(10, 70, 200, mulberry32(1)), -90);
  assert.equal(pickHiddenAngle(-10, 70, 200, mulberry32(1)), 90);
});

// ---- 突進の流れ ----
test('突進の流れ：待機 → 予兆 → 消える → 再出現（視界の外）→ 待つ → 突進 → 中心に届く → 咆哮 → 待機', () => {
  const s = mkState(0, 70);
  const b = createBossB();
  toIdle(b, s);
  const seen = [];
  let hitCoreFrames = 0;
  let hiddenPhases = new Set();
  let settleAngle = null, settleDist = null;
  for (let i = 0; i < 60 * 30; i++) {
    updateBossB(b, s, DT);
    if (seen[seen.length - 1] !== b.phase) seen.push(b.phase);
    if (b.hidden) hiddenPhases.add(b.phase);
    if (b.phase === 'settle' && settleAngle === null) { settleAngle = b.angle; settleDist = b.dist; }
    if (b.hitCore) { hitCoreFrames++; b.hitCore = false; } // stepGame と同じく、読んだら戻す
    if (seen.includes('roar') && b.phase === 'idle') break;
  }
  assert.deepEqual(seen, ['idle', 'telegraph', 'vanish', 'settle', 'dash', 'roar', 'idle']);
  assert.deepEqual([...hiddenPhases], ['vanish']);
  assert.equal(hitCoreFrames, 1);
  assert.ok(Math.abs(settleAngle) >= 50 - 1e-9 && Math.abs(settleAngle) <= 90, `settle angle ${settleAngle}`);
  assert.equal(settleDist, 440);
  assert.equal(b.dist, 340);            // 届いたあとは、元の距離に戻る
  assert.equal(b.damageMult, 1);        // 咆哮のあと、元に戻る
});

test('待機から予兆までは dashInterval（9秒）、各段階の長さは 1.0 / 0.8 / 0.4 秒', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  b.dashT = b.p.dashInterval; // 到着からの余りを捨てて、待機の長さを正確に測る
  const t0 = b.t;
  assert.equal(until(b, s, 'telegraph'), true);
  assert.ok(Math.abs(b.t - t0 - 9) < 0.1, `idle for ${b.t - t0}`);
  const t1 = b.t;
  assert.equal(until(b, s, 'vanish'), true);
  assert.ok(Math.abs(b.t - t1 - 1.0) < 0.1);
  const t2 = b.t;
  assert.equal(until(b, s, 'settle'), true);
  assert.ok(Math.abs(b.t - t2 - 0.8) < 0.1);
  const t3 = b.t;
  assert.equal(until(b, s, 'dash'), true);
  assert.ok(Math.abs(b.t - t3 - 0.4) < 0.1);
});

test('突進：dashTime（2.6秒）で距離440から中心へ。距離40（被弾）までは約 2.36 秒', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  until(b, s, 'dash');
  assert.ok(Math.abs(b.dashSpeed - 440 / 2.6) < 1e-9);
  const t0 = b.t;
  while (b.phase === 'dash' && !b.hitCore) updateBossB(b, s, DT);
  const took = b.t - t0;
  assert.ok(took > 2.3 && took < 2.45, `took ${took}`);
  assert.equal(b.hitCore, true);
});

test('突進の中断：突進中に受けたダメージが dashBreak（8）に届くと、怯んで戻り、咆哮に入る', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  until(b, s, 'dash');
  step(b, s, 0.5);
  b.damageTaken += 7.9;
  step(b, s, DT);
  assert.equal(b.phase, 'dash'); // まだ届かない
  b.damageTaken += 0.2;
  step(b, s, DT);
  assert.equal(b.phase, 'roar');
  assert.equal(b.dist, 340);
  assert.equal(b.hitCore, false);
  assert.equal(b.dashesLeft, 0);
  assert.equal(b.damageMult, 1.5);
});

test('突進の前に受けたダメージは、中断の判定に数えない（dashStartDamage との差だけ）', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  b.damageTaken = 100;
  until(b, s, 'dash');
  step(b, s, 0.3);
  assert.equal(b.phase, 'dash');
});

test('咆哮：2.2秒間は damageMult が 1.5 で、その間は動かない。終わると待機に戻る', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  until(b, s, 'dash');
  b.damageTaken += 8;
  step(b, s, DT);
  assert.equal(b.phase, 'roar');
  const angle0 = b.angle;
  step(b, s, 2.0);
  assert.equal(b.phase, 'roar');
  assert.equal(b.damageMult, 1.5);
  assert.equal(b.angle, angle0);
  step(b, s, 0.3);
  assert.equal(b.phase, 'idle');
  assert.equal(b.damageMult, 1);
});

test('連続突進（強化型 dashCount 2）：1回目が届いたら0.6秒の予兆で2回目、咆哮は最後のあとだけ', () => {
  const s = mkState();
  const b = createBossB({ dashCount: 2 });
  toIdle(b, s);
  const phases = [];
  let hits = 0;
  for (let i = 0; i < 60 * 40; i++) {
    updateBossB(b, s, DT);
    if (phases[phases.length - 1] !== b.phase) phases.push(b.phase);
    if (b.hitCore) { hits++; b.hitCore = false; if (hits === 1) assert.equal(b.phase, 'telegraph'); }
    if (phases.includes('roar') && b.phase === 'idle') break;
  }
  assert.equal(hits, 2);
  assert.deepEqual(phases, ['idle', 'telegraph', 'vanish', 'settle', 'dash', 'telegraph', 'vanish', 'settle', 'dash', 'roar', 'idle']);
});

test('連続突進の途中で中断されたら、残りの突進は無くなり、すぐに咆哮', () => {
  const s = mkState();
  const b = createBossB({ dashCount: 2 });
  toIdle(b, s);
  until(b, s, 'dash');
  b.damageTaken += 8;
  step(b, s, DT);
  assert.equal(b.phase, 'roar');
  assert.equal(b.dashesLeft, 0);
});

test('破片散布：7秒ごとに敵弾7発を、ボスの角度を中心に ±60 度に放つ（-90〜+90に丸める）', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  b.dashT = 100; // 突進は起こさず、散布だけ見る
  b.angle = 0;
  b.dir = 0;     // 動かさない（drift × 0）
  b.scatterT = b.p.scatterInterval; // 到着からの余りを捨てて、間隔を正確に測る
  step(b, s, 6.7);
  assert.equal(s.enemies.length, 0);
  step(b, s, 0.5);
  assert.equal(s.enemies.length, 7);
  const angles = s.enemies.map((e) => e.angle).sort((a, c) => a - c);
  assert.deepEqual(angles.map((a) => Math.round(a)), [-60, -40, -20, 0, 20, 40, 60]);
  for (const e of s.enemies) {
    assert.equal(e.type, 'enemyShot');
    assert.equal(e.speed, ENEMY_SHOT_SPEED);
    assert.equal(e.dist, 340 - 56);
  }
});

test('破片散布：端に近いときも -90〜+90 度に丸める', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  b.dashT = 100;
  b.angle = 50;
  b.dir = 0;
  b.scatterT = b.p.scatterInterval;
  step(b, s, 7.1);
  for (const e of s.enemies) assert.ok(e.angle >= -90 && e.angle <= 90, `angle ${e.angle}`);
  assert.equal(Math.max(...s.enemies.map((e) => e.angle)), 90);
});

test('待機中の左右の往復は ±angleRange（50度）に収まる', () => {
  const s = mkState();
  const b = createBossB();
  toIdle(b, s);
  b.dashT = 1e9; b.scatterT = 1e9;
  for (let i = 0; i < 60 * 40; i++) {
    updateBossB(b, s, DT);
    assert.ok(Math.abs(b.angle) <= 50 + 1e-9);
  }
});

test('強化型の上書き：dashInterval 6.5・dashTime 2.0 などが効く', () => {
  const s = mkState();
  const b = createBossB({ hp: 80, dashInterval: 6.5, dashTime: 2.0, dashBreak: 12 });
  toIdle(b, s);
  b.dashT = b.p.dashInterval;
  const t0 = b.t;
  until(b, s, 'telegraph');
  assert.ok(Math.abs(b.t - t0 - 6.5) < 0.1);
  until(b, s, 'dash');
  assert.ok(Math.abs(b.dashSpeed - 440 / 2.0) < 1e-9);
  assert.equal(b.p.dashBreak, 12);
});
