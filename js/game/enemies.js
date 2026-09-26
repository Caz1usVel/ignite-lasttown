import { CONFIG } from '../core/config.js';
import { randRange, clamp, pickAngleOutside } from '../core/util.js';

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
  shielder:   { hp: 1, radius: 26, score: 200, countsAsKill: true,  behavior: 'shielder' },
  teleporter: { hp: 2, radius: 22, score: 250, countsAsKill: true,  behavior: 'teleporter' },
  jammer:     { hp: 2, radius: 24, score: 250, countsAsKill: true,  behavior: 'jammer' },
  jamShot:    { hp: 1, radius: 12, score: 10,  countsAsKill: false, behavior: 'straight' },
  decoy:      { hp: 1, radius: 40, score: 0,   countsAsKill: false, behavior: 'decoy' },
};

export const DRONE = {
  holdMin: 300,
  holdMax: 380,
  sway: 4,          // ±度
  swayHz: 0.3,
  fireInterval: 4.5,
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
  waveOffsets: [-16, 0, 16], // 隆起の衝撃波（敵弾3発）の角度
};
export const THROWER = {
  holdMin: 300,
  holdMax: 360,
  sway: 4,                // ±度
  swayHz: 0.3,
  fireInterval: 5.0,
  hoverTime: 14,
  shardOffsets: [-20, 0, 20],
};
export const CHARGER = {
  dist: 440,
  waitTime: 1.5,          // 予兆（点滅）の時間
  dashTime: 3.0,          // 突進で中心へ届くまで（接近時間の基準の影響は受けない）
};

// 妨害テーマ
export const SHIELDER = {
  holdMin: 320,
  holdMax: 380,
  hoverTime: 14,
  cycle: 3.0,        // シールドの周期（秒）
  closedTime: 2.2,   // 周期の最初の、閉じている時間（残りが開いている時間）
  blinkTime: 0.3,    // 開く前の点滅（予兆）
};
export const TELEPORTER = {
  interval: 3.0,
  jitter: 0.5,
  warn: 0.4,         // 移動の前の点滅（予兆）
  minDelta: 30,      // 移動先の角度が、今の角度から離れる最小の量（度）
  flash: 0.3,        // 移動した直後の演出
};
export const JAMMER = {
  holdMin: 300,
  holdMax: 360,
  sway: 4,
  swayHz: 0.3,
  fireInterval: 5.0,
  hoverTime: 14,
};

// ボスCの偽像：動かずに、基準の角度を中心に少し揺れる（本体と見分けがつかない）
export const DECOY = {
  sway: 3,          // ±度
  swayHz: 0.6,
};

function approachSpeed(rng) {
  const jitter = randRange(rng, -CONFIG.APPROACH_JITTER, CONFIG.APPROACH_JITTER);
  return CONFIG.SPAWN_DIST / (CONFIG.APPROACH_TIME * (1 + jitter));
}

// 種類ごとの初期化（createEnemy が呼ぶ）。乱数を引く順番は、これまでと同じにする。
const ENEMY_INITS = {
  drone(e, angle, rng) {
    e.phase = 'approach';
    e.holdDist = randRange(rng, DRONE.holdMin, DRONE.holdMax);
    e.baseAngle = angle;
    e.hoverT = 0;
    e.fireT = DRONE.fireInterval;
  },
  burrower(e, angle, rng, opts) {
    e.dist = opts.dist ?? randRange(rng, BURROWER.distMin, BURROWER.distMax);
    e.phase = 'burrowed';
    e.hp = BURROWER.burrowedHp;
    e.radius = BURROWER.burrowedRadius;
    e.burrowT = BURROWER.burrowTime + randRange(rng, -BURROWER.burrowJitter, BURROWER.burrowJitter);
  },
  thrower(e, angle, rng) {
    e.phase = 'approach';
    e.holdDist = randRange(rng, THROWER.holdMin, THROWER.holdMax);
    e.baseAngle = angle;
    e.hoverT = 0;
    e.fireT = THROWER.fireInterval;
  },
  charger(e, angle, rng, opts) {
    e.dist = opts.dist ?? CHARGER.dist;
    e.phase = 'wait';
    e.waitT = CHARGER.waitTime;
  },
  shard(e, angle, rng, opts) {
    e.baseAngle = angle;
    e.offset = opts.offset ?? 0;
    e.startDist = e.dist;
    e.angle = angle + e.offset; // 生成の瞬間は、基準からオフセットだけずれた位置
  },
  shielder(e, angle, rng) {
    e.phase = 'approach';
    e.holdDist = randRange(rng, SHIELDER.holdMin, SHIELDER.holdMax);
    e.hoverT = 0;
    e.cycleT = 0;
    e.shielded = true;   // 接近の間は、常に閉じている
    e.blink = false;
  },
  teleporter(e, angle, rng) {
    e.tpT = TELEPORTER.interval + randRange(rng, -TELEPORTER.jitter, TELEPORTER.jitter);
    e.warn = false;
    e.warpFlash = 0;
  },
  jammer(e, angle, rng) {
    e.phase = 'approach';
    e.holdDist = randRange(rng, JAMMER.holdMin, JAMMER.holdMax);
    e.baseAngle = angle;
    e.hoverT = 0;
    e.fireT = JAMMER.fireInterval;
  },
  decoy(e, angle, rng, opts) {
    e.baseAngle = angle;
    e.swayT = 0;
    e.style = opts.style ?? null;   // 描画の見た目（例：'bossD'）
    e.color = opts.color ?? null;
  },
};

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
  ENEMY_INITS[type]?.(e, angle, rng, opts);
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

  // 偽像：動かない。基準の角度を中心に、位相 spin で揺れる
  decoy(e, state, dt) {
    e.swayT += dt;
    e.angle = e.baseAngle + DECOY.sway * Math.sin(e.swayT * DECOY.swayHz * Math.PI * 2 + e.spin);
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

  // 保持距離まで進んで静止。シールドが周期的に開閉する。14秒後に前進（周期は続く）
  shielder(e, state, dt) {
    if (e.phase === 'approach') {
      e.dist -= e.speed * dt;
      if (e.dist <= e.holdDist) {
        e.dist = e.holdDist;
        e.phase = 'hover';
        e.cycleT = 0;
      }
      return;
    }
    if (e.phase === 'hover') {
      e.hoverT += dt;
      if (e.hoverT >= SHIELDER.hoverTime) e.phase = 'advance';
    } else {
      e.dist -= e.speed * dt; // advance
    }
    e.cycleT = (e.cycleT + dt) % SHIELDER.cycle;
    e.shielded = e.cycleT < SHIELDER.closedTime;
    e.blink = e.shielded && e.cycleT >= SHIELDER.closedTime - SHIELDER.blinkTime;
  },

  // 通常の速さで前進しながら、一定の間隔で、角度だけ離れた場所へ瞬間移動する
  teleporter(e, state, dt) {
    e.dist -= e.speed * dt;
    e.tpT -= dt;
    if (e.warpFlash > 0) e.warpFlash = Math.max(0, e.warpFlash - dt);
    e.warn = e.tpT > 0 && e.tpT <= TELEPORTER.warn;
    if (e.tpT <= 0) {
      e.angle = pickAngleOutside(e.angle, TELEPORTER.minDelta, state.rng);
      e.tpT += TELEPORTER.interval + randRange(state.rng, -TELEPORTER.jitter, TELEPORTER.jitter);
      e.warpFlash = TELEPORTER.flash;
      e.warn = false;
    }
  },

  // 保持距離まで進んで静止 → 妨害電波（jamShot）を放ち続ける → 前進
  jammer(e, state, dt) {
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
      e.angle = e.baseAngle + JAMMER.sway * Math.sin(e.hoverT * JAMMER.swayHz * Math.PI * 2);
      e.fireT -= dt;
      if (e.fireT <= 0) {
        e.fireT += JAMMER.fireInterval;
        state.enemies.push(createEnemy('jamShot', e.angle, state.rng, {
          dist: e.dist - e.radius,
          speed: ENEMY_SHOT_SPEED,
        }));
      }
      if (e.hoverT >= JAMMER.hoverTime) e.phase = 'advance';
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
