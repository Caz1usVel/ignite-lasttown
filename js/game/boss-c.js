import { CONFIG } from '../core/config.js';
import { randInt } from '../core/util.js';
import { createEnemy, ENEMY_SHOT_SPEED } from './enemies.js';
import { pickSpreadAngles } from './boss-a.js';

// ボスC：視界撹乱（フェイク・テレポート）が識別攻撃。本体と偽像が並び、一定時間ごとに位置が入れ替わる。
// 循環参照を避けるため、boss.js は読み込まない（boss.js の登録表がこのファイルを読み込む）。
export const BOSS_C_BASE = Object.freeze({
  hp: 45,
  radius: 56,
  dist: 340,            // 本体・偽像の距離
  moveSpeed: 28,        // 進入速度
  decoyCount: 2,
  layoutRange: 70,      // 配置する角度の範囲（±度）
  minSep: 30,           // 本体と偽像の角度の間隔（度、最小）
  sway: 3,              // 待機中の揺れ（±度）
  swayHz: 0.6,
  swapInterval: 6,      // 入れ替えの間隔（秒）
  swapFlash: 0.4,       // 入れ替えの前の点滅
  shieldInterval: 10,   // シールドを展開する間隔（秒）
  shieldTime: 3,        // シールドの持続
  jamInterval: 9,       // 妨害電波の間隔
  score: 7000,
});

export function createBossC(params = {}) {
  const p = { ...BOSS_C_BASE, ...params };
  return {
    type: 'bossC',
    p,
    hp: p.hp,
    maxHp: p.hp,
    radius: p.radius,
    angle: 0,
    dist: CONFIG.SPAWN_DIST,
    targetDist: p.dist,
    arrived: false,
    t: 0,
    dead: false,
    phase: 'approach',   // approach → idle ⇄ swap
    phaseT: 0,
    baseAngle: 0,
    decoys: [],
    swapT: p.swapInterval,
    shieldT: p.shieldInterval,
    shieldActive: 0,
    shielded: false,
    jamT: p.jamInterval,
    hidden: false,
  };
}

// 本体と偽像を配置し直す。前の偽像は消し、新しい偽像を足す。
function layout(boss, state) {
  const p = boss.p;
  for (const d of boss.decoys) d.dead = true;
  const n = p.decoyCount + 1;
  const angles = pickSpreadAngles(n, p.minSep, state.rng, -p.layoutRange, p.layoutRange);
  const real = randInt(state.rng, 0, n - 1);
  boss.baseAngle = angles[real];
  boss.decoys = [];
  angles.forEach((a, i) => {
    if (i === real) return;
    const d = createEnemy('decoy', a, state.rng, { dist: p.dist });
    boss.decoys.push(d);
    state.enemies.push(d);
  });
}

export function updateBossC(boss, state, dt) {
  const p = boss.p;
  boss.t += dt;

  if (boss.phase === 'approach') {
    boss.dist = Math.max(boss.targetDist, boss.dist - p.moveSpeed * dt);
    if (boss.dist <= boss.targetDist) {
      boss.arrived = true;
      boss.phase = 'idle';
      layout(boss, state);
      boss.angle = boss.baseAngle;
      boss.swapT = p.swapInterval;
      boss.shieldT = p.shieldInterval;
      boss.jamT = p.jamInterval;
    }
    return;
  }

  // 待機中の揺れ
  boss.angle = boss.baseAngle + p.sway * Math.sin(boss.t * p.swayHz * Math.PI * 2);

  // 入れ替え：idle → swap（点滅）→ 配置し直して idle
  if (boss.phase === 'idle') {
    boss.swapT -= dt;
    if (boss.swapT <= 0) {
      boss.phase = 'swap';
      boss.phaseT = p.swapFlash;
    }
  } else if (boss.phase === 'swap') {
    boss.phaseT -= dt;
    if (boss.phaseT <= 0) {
      layout(boss, state);
      boss.phase = 'idle';
      boss.swapT = p.swapInterval;
    }
  }

  // シールド（一定間隔で無敵化）
  if (boss.shielded) {
    boss.shieldActive -= dt;
    if (boss.shieldActive <= 0) {
      boss.shielded = false;
      boss.shieldT = p.shieldInterval;
    }
  } else {
    boss.shieldT -= dt;
    if (boss.shieldT <= 0) {
      boss.shielded = true;
      boss.shieldActive = p.shieldTime;
    }
  }

  // 妨害電波
  boss.jamT -= dt;
  if (boss.jamT <= 0) {
    boss.jamT += p.jamInterval;
    state.enemies.push(createEnemy('jamShot', boss.angle, state.rng, {
      dist: boss.dist - boss.radius,
      speed: ENEMY_SHOT_SPEED,
    }));
  }
}
