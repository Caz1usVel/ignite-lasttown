import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_C_BASE, createBossC, updateBossC } from '../js/game/boss-c.js';
import { createBoss, updateBoss, BOSSES } from '../js/game/boss.js';
import { createEnemy, updateEnemies, ENEMY_DEFS, DECOY, ENEMY_SHOT_SPEED } from '../js/game/enemies.js';
import { resolveBulletHits } from '../js/game/collision.js';
import { createTurret } from '../js/game/turret.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const mkState = (seed = 11) => ({ enemies: [], boss: null, rng: mulberry32(seed), turret: createTurret() });
const step = (b, s, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) { updateBossC(b, s, DT); updateEnemies(s, DT); }
};
const toIdle = (b, s) => step(b, s, (CONFIG.SPAWN_DIST - b.p.dist) / b.p.moveSpeed + 0.1);
const decoysOf = (s) => s.enemies.filter((e) => e.type === 'decoy' && !e.dead);

test('BOSS_C_BASE：仕様の値で、凍結されている', () => {
  assert.equal(Object.isFrozen(BOSS_C_BASE), true);
  assert.equal(BOSS_C_BASE.hp, 45);
  assert.equal(BOSS_C_BASE.radius, 56);
  assert.equal(BOSS_C_BASE.dist, 340);
  assert.equal(BOSS_C_BASE.decoyCount, 2);
  assert.equal(BOSS_C_BASE.layoutRange, 70);
  assert.equal(BOSS_C_BASE.minSep, 30);
  assert.equal(BOSS_C_BASE.swapInterval, 6);
  assert.equal(BOSS_C_BASE.swapFlash, 0.4);
  assert.equal(BOSS_C_BASE.shieldInterval, 10);
  assert.equal(BOSS_C_BASE.shieldTime, 3);
  assert.equal(BOSS_C_BASE.jamInterval, 9);
  assert.equal(BOSS_C_BASE.score, 7000);
  assert.equal('color' in BOSS_C_BASE, false);
});

test('登録表：bossC を createBoss で作れる（名前・既定の色・色の検査）', () => {
  assert.equal(BOSSES.bossC.name, 'ボスC');
  assert.equal(BOSSES.bossC.color, '#4fc3d9');
  const b = createBoss('bossC');
  assert.equal(b.type, 'bossC');
  assert.equal(b.name, 'ボスC');
  assert.equal(b.color, '#4fc3d9');
  assert.equal(b.hp, 45);
  assert.equal(b.dist, 460);
  assert.throws(() => createBoss('bossC', { color: 'teal' }), /invalid boss color/);
  const strong = createBoss('bossC', { hp: 70, decoyCount: 3, color: '#ff9fd0' });
  assert.equal(strong.maxHp, 70);
  assert.equal(strong.color, '#ff9fd0');
  assert.equal(BOSS_C_BASE.hp, 45);
});

test('偽像：定義（HP1・半径40・スコア0・撃破数に数えない）と、動かずに ±3度 揺れる', () => {
  assert.deepEqual(ENEMY_DEFS.decoy, { hp: 1, radius: 40, score: 0, countsAsKill: false, behavior: 'decoy' });
  assert.equal(DECOY.sway, 3);
  const s = mkState();
  const d = createEnemy('decoy', 20, s.rng, { dist: 340 });
  s.enemies.push(d);
  let min = 99, max = -99;
  for (let i = 0; i < 60 * 10; i++) { updateEnemies(s, DT); min = Math.min(min, d.angle); max = Math.max(max, d.angle); }
  assert.equal(d.dist, 340);
  assert.ok(min >= 17 - 1e-9 && max <= 23 + 1e-9);
  assert.ok(max - min > 4); // 実際に揺れている
});

test('偽像：1発で消え、スコア・撃破数に数える種類ではない', () => {
  const s = { turret: createTurret(), bullets: [], enemies: [], boss: null, rng: mulberry32(1) };
  const d = createEnemy('decoy', 0, s.rng, { dist: 340 });
  d.baseAngle = 0;
  s.enemies.push(d);
  s.bullets.push({ angle: 0, prevDist: 300, dist: 420, speed: 900, radius: 6, dead: false, pierceLeft: 0 });
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((e) => e.type), ['kill']);
  assert.equal(d.dead, true);
  assert.equal(ENEMY_DEFS.decoy.countsAsKill, false);
  assert.equal(ENEMY_DEFS.decoy.score, 0);
});

test('進入：距離460から340まで進み、着いたら待機（idle）して、偽像が配置される', () => {
  const s = mkState();
  const b = createBossC();
  assert.equal(b.phase, 'approach');
  step(b, s, 1);
  assert.equal(b.arrived, false);
  assert.equal(decoysOf(s).length, 0);
  toIdle(b, s);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 340);
  assert.equal(b.phase, 'idle');
  assert.equal(decoysOf(s).length, 2);
});

test('配置：本体と偽像は、同じ距離で、互いに30度以上離れ、-70〜+70度の範囲に収まる（多数のシード）', () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const decoyCount of [2, 3]) {
      const s = mkState(seed);
      const b = createBossC({ decoyCount });
      toIdle(b, s);
      const figures = [b.baseAngle, ...decoysOf(s).map((d) => d.baseAngle)].sort((x, y) => x - y);
      assert.equal(figures.length, decoyCount + 1);
      for (let i = 0; i < figures.length; i++) {
        assert.ok(figures[i] >= -70 - 1e-9 && figures[i] <= 70 + 1e-9, `angle ${figures[i]}`);
        if (i > 0) assert.ok(figures[i] - figures[i - 1] >= 30 - 1e-9, `gap ${figures[i] - figures[i - 1]} (seed ${seed})`);
      }
      for (const d of decoysOf(s)) assert.equal(d.dist, 340);
    }
  }
});

test('本体は baseAngle を中心に ±3度 揺れる', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.swapT = 1e9; b.jamT = 1e9; b.shieldT = 1e9;
  let min = 99, max = -99;
  for (let i = 0; i < 60 * 10; i++) { step(b, s, DT); min = Math.min(min, b.angle - b.baseAngle); max = Math.max(max, b.angle - b.baseAngle); }
  assert.ok(min >= -3 - 1e-9 && max <= 3 + 1e-9);
  assert.ok(max - min > 4);
});

test('入れ替え：swapInterval のあと点滅（swap）し、swapFlash 後に配置をやり直す（偽像は全部作り直される）', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.shieldT = 1e9; b.jamT = 1e9;
  b.swapT = b.p.swapInterval; // 到着からの余りを捨てる
  const firstDecoys = decoysOf(s).slice();
  step(b, s, 5.9);
  assert.equal(b.phase, 'idle');
  step(b, s, 0.2);
  assert.equal(b.phase, 'swap');
  assert.equal(decoysOf(s).length, 2);   // 点滅の間は、まだ元の偽像
  step(b, s, 0.5);
  assert.equal(b.phase, 'idle');
  const now = decoysOf(s);
  assert.equal(now.length, 2);
  for (const d of firstDecoys) assert.equal(d.dead, true);      // 前の偽像は消えた
  for (const d of now) assert.equal(firstDecoys.includes(d), false);
});

test('入れ替え：本体の位置が変わる（数回の入れ替えで、baseAngle が変化する）', () => {
  const s = mkState(3);
  const b = createBossC();
  toIdle(b, s);
  b.shieldT = 1e9; b.jamT = 1e9;
  const seen = new Set([Math.round(b.baseAngle)]);
  for (let i = 0; i < 6; i++) { step(b, s, b.p.swapInterval + b.p.swapFlash + 0.05); seen.add(Math.round(b.baseAngle)); }
  assert.ok(seen.size >= 3, `distinct base angles: ${[...seen]}`);
});

test('偽像を撃って消しても、次の入れ替えで復活する。本体のHPは減らない', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.shieldT = 1e9; b.jamT = 1e9;
  const d = decoysOf(s)[0];
  d.dead = true;
  assert.equal(decoysOf(s).length, 1);
  assert.equal(b.hp, 45);
  b.swapT = 0.01;
  step(b, s, b.p.swapFlash + 0.1);
  assert.equal(decoysOf(s).length, 2);
});

test('シールド：shieldInterval のあと shieldTime だけ shielded。その間の弾は吸収され、HPは減らない', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.swapT = 1e9; b.jamT = 1e9;
  b.shieldT = b.p.shieldInterval;
  step(b, s, 9.9);
  assert.equal(b.shielded, false);
  step(b, s, 0.2);
  assert.equal(b.shielded, true);
  // 弾を当てる（本体の位置に）
  const combat = { turret: createTurret(), bullets: [], enemies: [], boss: b, rng: mulberry32(1) };
  b.angle = 0; b.baseAngle = 0; b.dist = 340;
  combat.bullets.push({ angle: 0, prevDist: 300, dist: 420, speed: 900, radius: 6, dead: false, pierceLeft: 0 });
  const ev = resolveBulletHits(combat);
  assert.deepEqual(ev.map((e) => e.type), ['block']);
  assert.equal(b.hp, 45);
  step(b, s, 3.0);
  assert.equal(b.shielded, false);
  combat.bullets = [{ angle: 0, prevDist: 300, dist: 420, speed: 900, radius: 6, dead: false, pierceLeft: 0 }];
  const ev2 = resolveBulletHits(combat);
  assert.deepEqual(ev2.map((e) => e.type), ['hit']);
  assert.equal(b.hp, 44);
});

test('シールドが切れたあと、次は shieldInterval 後', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.swapT = 1e9; b.jamT = 1e9;
  b.shieldT = 2;
  step(b, s, 2.1);
  assert.equal(b.shielded, true);
  step(b, s, 3.0);
  assert.equal(b.shielded, false);
  assert.ok(b.shieldT > 9.8 && b.shieldT <= 10); // 切れてから数フレーム分だけ減っている
});

test('妨害電波：jamInterval ごとに、本体の位置から jamShot を1発', () => {
  const s = mkState();
  const b = createBossC();
  toIdle(b, s);
  b.swapT = 1e9; b.shieldT = 1e9;
  b.jamT = b.p.jamInterval;
  step(b, s, 8.9);
  assert.equal(s.enemies.filter((e) => e.type === 'jamShot').length, 0);
  step(b, s, 0.2);
  const shots = s.enemies.filter((e) => e.type === 'jamShot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].speed, ENEMY_SHOT_SPEED);
  assert.ok(Math.abs(shots[0].angle - b.angle) < 2);
  assert.ok(Math.abs(shots[0].dist - (340 - 56)) < 12); // 発射後 ~0.1秒ぶん進んでいる
});

test('updateBoss は bossC を更新する。強化型の上書きが効く', () => {
  const s = mkState();
  const b = createBoss('bossC', { decoyCount: 3, swapInterval: 4.5, shieldInterval: 8, jamInterval: 7, hp: 70 });
  updateBoss(b, s, 1);
  assert.ok(b.dist < 460);
  toIdle(b, s);
  assert.equal(decoysOf(s).length, 3);
  assert.equal(b.p.swapInterval, 4.5);
});
