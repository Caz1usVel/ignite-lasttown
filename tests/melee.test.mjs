import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemy, updateEnemies, ENEMY_DEFS, ENEMY_SHOT_SPEED, BURROWER, THROWER, CHARGER,
} from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const mkState = (seed = 7) => ({ enemies: [], rng: mulberry32(seed) });
const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds / DT); i++) updateEnemies(s, DT); };
const shotsOf = (s, type) => s.enemies.filter((e) => e.type === type);

test('定義：突き上げ・破片飛ばし・突進・破片', () => {
  assert.deepEqual(ENEMY_DEFS.burrower, { hp: 2, radius: 24, score: 150, countsAsKill: true, behavior: 'burrower' });
  assert.deepEqual(ENEMY_DEFS.thrower, { hp: 3, radius: 26, score: 250, countsAsKill: true, behavior: 'thrower' });
  assert.deepEqual(ENEMY_DEFS.charger, { hp: 2, radius: 24, score: 200, countsAsKill: true, behavior: 'charger' });
  assert.deepEqual(ENEMY_DEFS.shard, { hp: 1, radius: 10, score: 10, countsAsKill: false, behavior: 'arc' });
});

// ---- 突き上げ敵 ----
test('突き上げ敵：最初は盛り上がり（HP1・半径12）、距離280〜360、潜伏2.5〜3.5秒', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const e = createEnemy('burrower', 0, mulberry32(seed));
    assert.equal(e.phase, 'burrowed');
    assert.equal(e.hp, 1);
    assert.equal(e.radius, 12);
    assert.ok(e.dist >= 280 && e.dist <= 360, `dist=${e.dist}`);
    assert.ok(e.burrowT >= 2.5 && e.burrowT <= 3.5, `burrowT=${e.burrowT}`);
  }
});

test('突き上げ敵：盛り上がりの間は動かない。潜伏時間が過ぎると隆起して、衝撃波（敵弾3発）を放つ', () => {
  const s = mkState();
  const e = createEnemy('burrower', 10, s.rng);
  s.enemies.push(e);
  const dist0 = e.dist;
  run(s, e.burrowT - 0.1);
  assert.equal(e.phase, 'burrowed');
  assert.equal(e.dist, dist0);
  assert.equal(shotsOf(s, 'enemyShot').length, 0);
  while (e.phase === 'burrowed') updateEnemies(s, DT); // 隆起した更新の直後で確認する（敵弾は次のフレームから動く）
  assert.equal(e.phase, 'risen');
  assert.equal(e.hp, 2);
  assert.equal(e.radius, 24);
  const shots = shotsOf(s, 'enemyShot');
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((x) => x.angle).sort((a, b) => a - b), BURROWER.waveOffsets.map((o) => 10 + o));
  for (const x of shots) {
    assert.equal(x.speed, ENEMY_SHOT_SPEED);
    assert.equal(x.dist, dist0 - 24);
  }
});

test('突き上げ敵：衝撃波の角度は -90〜+90 度に丸める', () => {
  const s = mkState();
  const e = createEnemy('burrower', 85, s.rng);
  s.enemies.push(e);
  run(s, 4);
  const angles = shotsOf(s, 'enemyShot').map((x) => x.angle).sort((a, b) => a - b);
  assert.deepEqual(angles, [69, 85, 90]);
});

test('突き上げ敵：隆起後は接近速度で中心へ前進する', () => {
  const s = mkState();
  const e = createEnemy('burrower', 0, s.rng);
  s.enemies.push(e);
  run(s, e.burrowT + 0.1);
  const before = e.dist;
  run(s, 1);
  assert.ok(Math.abs(before - e.dist - e.speed) < e.speed * 0.05, `moved ${before - e.dist}, speed ${e.speed}`);
  const expectTime = 460 / e.speed;
  assert.ok(expectTime >= CONFIG.APPROACH_TIME * 0.85 - 1e-9 && expectTime <= CONFIG.APPROACH_TIME * 1.15 + 1e-9);
});

// ---- 破片飛ばし敵 ----
test('破片飛ばし敵：保持距離300〜360まで進んで止まり、5秒ごとに破片3つ', () => {
  const s = mkState();
  const t = createEnemy('thrower', 20, s.rng);
  assert.equal(t.hp, 3);
  assert.ok(t.holdDist >= THROWER.holdMin && t.holdDist <= THROWER.holdMax);
  s.enemies.push(t);
  while (t.phase === 'approach') updateEnemies(s, DT);
  assert.equal(t.phase, 'hover');
  assert.equal(t.dist, t.holdDist);

  run(s, THROWER.fireInterval - 0.1);
  assert.equal(shotsOf(s, 'shard').length, 0);
  run(s, 0.2);
  const shards = shotsOf(s, 'shard');
  assert.equal(shards.length, 3);
  assert.deepEqual(shards.map((x) => x.offset).sort((a, b) => a - b), [-20, 0, 20]);
  for (const x of shards) {
    assert.equal(x.speed, ENEMY_SHOT_SPEED);
    assert.ok(Math.abs(x.baseAngle - 20) <= THROWER.sway + 1e-9); // 基準は、投げた瞬間の敵の角度（ゆらぎの範囲内）
  }
  assert.ok(Math.abs(t.angle - 20) <= THROWER.sway + 1e-9);
});

test('破片飛ばし敵：14秒保持したあと、前進を再開する', () => {
  const s = mkState();
  const t = createEnemy('thrower', 0, s.rng);
  s.enemies.push(t);
  while (t.phase === 'approach') updateEnemies(s, DT);
  run(s, 13.9);
  assert.equal(t.phase, 'hover');
  run(s, 0.3);
  assert.equal(t.phase, 'advance');
  const before = t.dist;
  run(s, 1);
  assert.ok(t.dist < before);
});

// ---- 破片 ----
test('破片：左右にずれた位置から、曲線を描いて基準の線に収束する', () => {
  const s = mkState();
  const sh = createEnemy('shard', 10, s.rng, { dist: 400, speed: 100, offset: 20 });
  assert.equal(sh.hp, 1);
  assert.equal(sh.angle, 30);        // 生成の瞬間は 基準 + オフセット
  assert.equal(sh.startDist, 400);
  s.enemies.push(sh);
  run(s, 2);                         // dist 400 → 200
  assert.ok(Math.abs(sh.dist - 200) < 1e-6);
  assert.ok(Math.abs(sh.angle - 20) < 1e-6, `angle=${sh.angle}`); // 10 + 20 × 200/400
  run(s, 3);                         // dist が0を下回っても、角度は基準に収束したまま
  assert.ok(Math.abs(sh.angle - 10) < 1e-6);
});

test('破片：オフセット無しなら直進（角度は基準のまま）', () => {
  const s = mkState();
  const sh = createEnemy('shard', -30, s.rng, { dist: 300, speed: 60 });
  s.enemies.push(sh);
  run(s, 2);
  assert.equal(sh.angle, -30);
});

// ---- 突進敵 ----
test('突進敵：距離440で1.5秒静止（予兆）→ dist/3.0 の速さで突進し、約3秒で中心へ届く', () => {
  const s = mkState();
  const c = createEnemy('charger', -40, s.rng);
  assert.equal(c.hp, 2);
  assert.equal(c.dist, 440);
  assert.equal(c.phase, 'wait');
  s.enemies.push(c);
  run(s, CHARGER.waitTime - 0.1);
  assert.equal(c.phase, 'wait');
  assert.equal(c.dist, 440);
  run(s, 0.2);
  assert.equal(c.phase, 'dash');
  assert.ok(Math.abs(c.speed - 440 / CHARGER.dashTime) < 1e-9);
  assert.equal(CHARGER.dashTime, 3.0);
  let t = 0;
  while (c.dist > 40 && t < 10) { updateEnemies(s, DT); t += DT; }
  assert.ok(t > 2.5 && t < 2.9, `到達（距離40）まで ${t} 秒`);
});

test('突進敵の速さは接近時間の基準の影響を受けない', () => {
  const a = createEnemy('charger', 0, mulberry32(1));
  const b = createEnemy('charger', 0, mulberry32(999));
  const sa = mkState(); sa.enemies.push(a);
  const sb = mkState(); sb.enemies.push(b);
  run(sa, CHARGER.waitTime + 0.1); run(sb, CHARGER.waitTime + 0.1);
  assert.equal(a.speed, b.speed);
});
