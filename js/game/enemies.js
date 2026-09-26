import { CONFIG } from '../core/config.js';
import { randRange, clamp } from '../core/util.js';

export const ENEMY_DEFS = {
  meteor:     { hp: 1, radius: 22, score: 100, countsAsKill: true,  behavior: 'straight' },
  drone:      { hp: 2, radius: 24, score: 200, countsAsKill: true,  behavior: 'drone' },
  enemyShot:  { hp: 1, radius: 9,  score: 10,  countsAsKill: false, behavior: 'straight' },
  bossMinion: { hp: 1, radius: 15, score: 50,  countsAsKill: true,  behavior: 'straight' },
  formationDrone: { hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight' },
  burrower: { hp: 2, radius: 24, score: 150, countsAsKill: true,  behavior: 'burrower' },
  thrower:  { hp: 3, radius: 26, score: 250, countsAsKill: true,  behavior: 'thrower' },
  charger:  { hp: 2, radius: 24, score: 200, countsAsKill: true,  behavior: 'charger' },
  shard:    { hp: 1, radius: 10, score: 10,  countsAsKill: false, behavior: 'arc' },
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

// 近接テーマ
export const BURROWER = {
  distMin: 280,
  distMax: 360,
  burrowTime: 3.0,        // 盛り上がりから隆起まで（秒）
  burrowJitter: 0.5,
  burrowedHp: 1,
  burrowedRadius: 12,
  waveOffsets: [-24, -12, 0, 12, 24], // 隆起の衝撃波（敵弾5発）の角度
};
export const THROWER = {
  holdMin: 300,
  holdMax: 360,
  sway: 4,                // ±度
  swayHz: 0.3,
  fireInterval: 4.0,
  hoverTime: 14,
  shardOffsets: [-20, 0, 20],
};
export const CHARGER = {
  dist: 440,
  waitTime: 1.2,          // 予兆（点滅）の時間
  dashTime: 3.0,          // 突進で中心へ届くまで（接近時間の基準の影響は受けない）
};

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
  if (type === 'burrower') {
    e.dist = opts.dist ?? randRange(rng, BURROWER.distMin, BURROWER.distMax);
    e.phase = 'burrowed';
    e.hp = BURROWER.burrowedHp;
    e.radius = BURROWER.burrowedRadius;
    e.burrowT = BURROWER.burrowTime + randRange(rng, -BURROWER.burrowJitter, BURROWER.burrowJitter);
  }
  if (type === 'thrower') {
    e.phase = 'approach';
    e.holdDist = randRange(rng, THROWER.holdMin, THROWER.holdMax);
    e.baseAngle = angle;
    e.hoverT = 0;
    e.fireT = THROWER.fireInterval;
  }
  if (type === 'charger') {
    e.dist = opts.dist ?? CHARGER.dist;
    e.phase = 'wait';
    e.waitT = CHARGER.waitTime;
  }
  if (type === 'shard') {
    e.baseAngle = angle;
    e.offset = opts.offset ?? 0;
    e.startDist = e.dist;
    e.angle = angle + e.offset; // 生成の瞬間は、基準からオフセットだけずれた位置
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

  // 盛り上がり → 隆起（衝撃波）→ 前進
  burrower(e, state, dt) {
    if (e.phase === 'burrowed') {
      e.burrowT -= dt;
      if (e.burrowT > 0) return;
      e.phase = 'risen';
      e.hp = ENEMY_DEFS.burrower.hp;
      e.radius = ENEMY_DEFS.burrower.radius;
      for (const off of BURROWER.waveOffsets) {
        state.enemies.push(createEnemy('enemyShot', clamp(e.angle + off, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT), state.rng, {
          dist: e.dist - e.radius,
          speed: ENEMY_SHOT_SPEED,
        }));
      }
      return;
    }
    e.dist -= e.speed * dt;
  },

  // 保持距離まで進んで静止 → 破片を投げ続ける → 前進
  thrower(e, state, dt) {
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
      e.angle = e.baseAngle + THROWER.sway * Math.sin(e.hoverT * THROWER.swayHz * Math.PI * 2);
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT += THROWER.fireInterval;
        for (const offset of THROWER.shardOffsets) {
          state.enemies.push(createEnemy('shard', e.angle, state.rng, {
            dist: e.dist - e.radius,
            speed: ENEMY_SHOT_SPEED,
            offset,
          }));
        }
      }
      if (e.hoverT >= THROWER.hoverTime) e.phase = 'advance';
      return;
    }
    e.dist -= e.speed * dt; // advance
  },

  // 静止（予兆）→ 高速で直進
  charger(e, state, dt) {
    if (e.phase === 'wait') {
      e.waitT -= dt;
      if (e.waitT <= 0) {
        e.phase = 'dash';
        e.speed = e.dist / CHARGER.dashTime;
      }
      return;
    }
    e.dist -= e.speed * dt;
  },

  // 破片：左右にずれた位置から、基準の線へ収束する曲線
  arc(e, state, dt) {
    e.dist -= e.speed * dt;
    e.angle = e.baseAngle + e.offset * Math.max(0, e.dist / e.startDist);
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
