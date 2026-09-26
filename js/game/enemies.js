import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';

export const ENEMY_DEFS = {
  meteor:     { hp: 1, radius: 22, score: 100, countsAsKill: true,  behavior: 'straight' },
  drone:      { hp: 2, radius: 24, score: 200, countsAsKill: true,  behavior: 'drone' },
  enemyShot:  { hp: 1, radius: 9,  score: 10,  countsAsKill: false, behavior: 'straight' },
  bossMinion: { hp: 1, radius: 15, score: 50,  countsAsKill: true,  behavior: 'straight' },
  formationDrone: { hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight' },
};

export const DRONE = {
  holdMin: 300,
  holdMax: 380,
  sway: 4,          // ±度
  swayHz: 0.3,
  fireInterval: 3.5,
  hoverTime: 15,
};

export const ENEMY_SHOT_SPEED = 85;

function approachSpeed(rng) {
  const jitter = randRange(rng, -CONFIG.APPROACH_JITTER, CONFIG.APPROACH_JITTER);
  return CONFIG.SPAWN_DIST / (CONFIG.APPROACH_TIME * (1 + jitter));
}

export function createEnemy(type, angle, rng, opts = {}) {
  const def = ENEMY_DEFS[type];
  if (!def) throw new Error(`unknown enemy type: ${type}`);
  const e = {
    type,
    angle,
    dist: opts.dist ?? CONFIG.SPAWN_DIST,
    hp: def.hp,
    radius: def.radius,
    speed: opts.speed ?? approachSpeed(rng),
    t: 0,
    dead: false,
    spin: rng() * Math.PI * 2,
  };
  if (type === 'drone') {
    e.phase = 'approach';
    e.holdDist = randRange(rng, DRONE.holdMin, DRONE.holdMax);
    e.baseAngle = angle;
    e.hoverT = 0;
    e.fireT = DRONE.fireInterval;
  }
  return e;
}

const BEHAVIORS = {
  straight(e, state, dt) {
    e.dist -= e.speed * dt;
  },

  drone(e, state, dt) {
    if (e.phase === 'approach') {
      e.dist -= e.speed * dt;
      if (e.dist <= e.holdDist) {
        e.dist = e.holdDist;
        e.phase = 'hover';
        e.baseAngle = e.angle;
      }
      return;
    }
    if (e.phase === 'hover') {
      e.hoverT += dt;
      e.angle = e.baseAngle + DRONE.sway * Math.sin(e.hoverT * DRONE.swayHz * Math.PI * 2);
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT += DRONE.fireInterval;
        state.enemies.push(createEnemy('enemyShot', e.angle, state.rng, {
          dist: e.dist - e.radius,
          speed: ENEMY_SHOT_SPEED,
        }));
      }
      if (e.hoverT >= DRONE.hoverTime) e.phase = 'advance';
      return;
    }
    e.dist -= e.speed * dt; // advance
  },
};

export function updateEnemies(state, dt) {
  // この更新中に追加された敵（敵弾など）は次のフレームから動かす
  const n = state.enemies.length;
  for (let i = 0; i < n; i++) {
    const e = state.enemies[i];
    if (e.dead) continue;
    e.t += dt;
    BEHAVIORS[ENEMY_DEFS[e.type].behavior](e, state, dt);
  }
}

export function removeDead(list) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].dead) list.splice(i, 1);
  }
}
