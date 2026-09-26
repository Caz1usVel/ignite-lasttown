import { CONFIG } from '../core/config.js';
import { clamp } from '../core/util.js';

const COOLDOWN_EPS = 1e-6;

export function createTurret() {
  return {
    heading: 0,
    cooldown: 0,
    lives: CONFIG.LIVES,
    invincible: 0,
    fov: CONFIG.FOV,
    turnSpeed: CONFIG.TURN_SPEED,
    fireRate: CONFIG.FIRE_RATE,
    damage: 1,
    pierce: 0,
    jam: 0,
  };
}

export function updateTurret(t, dt, turnAxis) {
  t.heading = clamp(
    t.heading + turnAxis * t.turnSpeed * dt,
    -CONFIG.HEADING_LIMIT,
    CONFIG.HEADING_LIMIT,
  );
  const next = t.cooldown - dt;
  // 発射の余りを次に持ち越す（最大1フレーム分）。撃っていない間に「貯金」はしない
  t.cooldown = t.cooldown > 0 ? Math.max(next, -dt) : 0;
  t.invincible = Math.max(0, t.invincible - dt);
  t.jam = Math.max(0, t.jam - dt);
}

export function tryFire(t) {
  if (t.jam > 0) return false; // 妨害中は撃てない
  if (t.cooldown > COOLDOWN_EPS) return false;
  t.cooldown += 1 / t.fireRate;
  return true;
}

export function damageTurret(t) {
  if (t.invincible > 0 || t.lives <= 0) return false;
  t.lives -= 1;
  t.invincible = CONFIG.INVINCIBLE_TIME;
  return true;
}
