import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';
import { createEnemy, activeCount, ENEMY_SHOT_SPEED } from './enemies.js';

export const BOSS_A_BASE = Object.freeze({
  hp: 30,
  radius: 60,
  dist: 380,
  angleRange: 60,       // ±度
  drift: 10,            // 度/秒
  moveSpeed: 28,        // 距離の移動速度（進入・前進）
  summonInterval: 7.5,
  summonCount: 3,
  summonMinSep: 20,
  minionApproach: 7,    // 子機が中心へ届くまでの秒数
  shotInterval: 5,
  shotBurst: 3,
  shotGap: 0.25,
  advanceInterval: 12,
  advanceStep: 40,
  minDist: 200,
  score: 5000,
});

export function createBossA(params = {}) {
  const p = { ...BOSS_A_BASE, ...params };
  return {
    type: 'bossA',
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
  const slack = (hi - lo) - (count - 1) * minSep;
  if (slack < 0) {
    const step = (hi - lo) / count; // 物理的に不可能な条件のときだけ等間隔
    return Array.from({ length: count }, (_, i) => lo + step * (i + 0.5));
  }
  // 余白 slack の中に一様に点を取り、i 番目に minSep * i を足す。取り得るすべての配置から一様に選べる。
  const u = Array.from({ length: count }, () => randRange(rng, 0, slack));
  u.sort((x, y) => x - y);
  return u.map((v, i) => lo + v + i * minSep);
}

export function updateBossA(boss, state, dt) {
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
    let count = p.summonCount;
    // エンドレスでは、子機も同時に出る敵の上限（spawner.maxActive）の空きの分だけ出す
    if (state.endless) count = Math.min(count, Math.max(0, state.spawner.maxActive - activeCount(state)));
    for (const a of count > 0 ? pickSpreadAngles(count, p.summonMinSep, state.rng) : []) {
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
