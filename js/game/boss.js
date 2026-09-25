import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';
import { createEnemy, ENEMY_SHOT_SPEED } from './enemies.js';

export const BOSS_A_BASE = Object.freeze({
  hp: 40,
  radius: 60,
  dist: 380,
  angleRange: 60,       // ±度
  drift: 10,            // 度/秒
  moveSpeed: 40,        // 距離の移動速度（進入・前進）
  summonInterval: 6,
  summonCount: 3,
  summonMinSep: 20,
  minionApproach: 5,    // 子機が中心へ届くまでの秒数
  shotInterval: 4,
  shotBurst: 3,
  shotGap: 0.25,
  advanceInterval: 12,
  advanceStep: 40,
  minDist: 200,
  score: 5000,
});

export function createBoss(type, params = {}) {
  if (type !== 'bossA') throw new Error(`unknown boss type: ${type}`);
  const p = { ...BOSS_A_BASE, ...params };
  return {
    type,
    p,
    hp: p.hp,
    maxHp: p.hp,
    radius: p.radius,
    angle: 0,
    dist: CONFIG.SPAWN_DIST,
    targetDist: p.dist,
    dir: 1,
    arrived: false,
    summonT: p.summonInterval,
    shotT: p.shotInterval,
    burstLeft: 0,
    burstT: 0,
    advanceT: p.advanceInterval,
    t: 0,
    dead: false,
  };
}

export function pickSpreadAngles(count, minSep, rng, lo = -CONFIG.HEADING_LIMIT, hi = CONFIG.HEADING_LIMIT) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const angles = [];
    for (let i = 0; i < count; i++) angles.push(randRange(rng, lo, hi));
    angles.sort((a, b) => a - b);
    if (angles.every((a, i) => i === 0 || a - angles[i - 1] >= minSep)) return angles;
  }
  const step = (hi - lo) / count; // 条件を満たせないときは等間隔
  return Array.from({ length: count }, (_, i) => lo + step * (i + 0.5));
}

export function updateBoss(boss, state, dt) {
  const p = boss.p;
  boss.t += dt;

  if (boss.dist > boss.targetDist) {
    boss.dist = Math.max(boss.targetDist, boss.dist - p.moveSpeed * dt);
  }
  if (!boss.arrived) {
    if (boss.dist > boss.targetDist) return;
    boss.arrived = true;
  }

  // 左右にゆっくり往復
  boss.angle += boss.dir * p.drift * dt;
  if (boss.angle > p.angleRange) { boss.angle = p.angleRange; boss.dir = -1; }
  if (boss.angle < -p.angleRange) { boss.angle = -p.angleRange; boss.dir = 1; }

  // 分散召喚（アイデンティティ攻撃）
  boss.summonT -= dt;
  if (boss.summonT <= 0) {
    boss.summonT += p.summonInterval;
    for (const a of pickSpreadAngles(p.summonCount, p.summonMinSep, state.rng)) {
      state.enemies.push(createEnemy('bossMinion', a, state.rng, {
        dist: boss.dist,
        speed: boss.dist / p.minionApproach,
      }));
    }
  }

  // 直進弾（低速の連射）
  boss.shotT -= dt;
  if (boss.shotT <= 0) {
    boss.shotT += p.shotInterval;
    boss.burstLeft = p.shotBurst;
    boss.burstT = 0;
  }
  if (boss.burstLeft > 0) {
    boss.burstT -= dt;
    if (boss.burstT <= 0) {
      boss.burstT += p.shotGap;
      boss.burstLeft -= 1;
      state.enemies.push(createEnemy('enemyShot', boss.angle, state.rng, {
        dist: boss.dist - boss.radius,
        speed: ENEMY_SHOT_SPEED,
      }));
    }
  }

  // 突進（じわじわ前進）
  boss.advanceT -= dt;
  if (boss.advanceT <= 0) {
    boss.advanceT += p.advanceInterval;
    boss.targetDist = Math.max(p.minDist, boss.targetDist - p.advanceStep);
  }
}
