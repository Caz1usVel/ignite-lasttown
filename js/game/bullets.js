import { CONFIG } from '../core/config.js';

export const MUZZLE_DIST = 34;

export function spawnBullet(state, angle, speed) {
  state.bullets.push({
    angle,
    dist: MUZZLE_DIST,
    prevDist: MUZZLE_DIST,
    speed,
    radius: CONFIG.BULLET_RADIUS,
    pierceLeft: state.turret.pierce ?? 0,
    dead: false,
  });
}

export function updateBullets(state, dt) {
  for (const b of state.bullets) {
    b.prevDist = b.dist;
    b.dist += b.speed * dt;
    // 最後の区間の判定を済ませてから消えるよう、prevDist で判断する
    if (b.prevDist > CONFIG.BULLET_MAX_DIST) b.dead = true;
  }
}
