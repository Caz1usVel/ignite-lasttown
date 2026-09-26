import { CONFIG } from '../core/config.js';
import { randRange, clamp } from '../core/util.js';
import { createEnemy, ENEMY_SHOT_SPEED } from './enemies.js';

// ボスB：瞬間突進（視界の外に再出現して、中心へ突進する）が識別攻撃。
// 循環参照を避けるため、boss.js は読み込まない（boss.js の登録表がこのファイルを読み込む）。
export const BOSS_B_BASE = Object.freeze({
  hp: 40,
  radius: 56,
  dist: 340,            // 待機の距離
  moveSpeed: 28,        // 進入速度
  angleRange: 50,       // 待機中の左右の往復（±度）
  drift: 8,             // 度/秒
  firstDashDelay: 2,    // 到着してから、最初の突進の予兆まで（秒）
  dashInterval: 11,      // 咆哮のあと待機に戻ってから、次の突進の予兆まで（秒）
  dashCount: 1,         // 連続突進の回数
  chainGap: 0.6,        // 連続突進の2回目の予兆までの間（秒）
  telegraph: 1.0,       // 予兆（点滅）
  vanish: 0.8,          // 姿を消している時間
  reappearDist: 440,
  reappearMargin: 15,   // 視界の端から、さらに外側へ離す量（度）
  settle: 0.4,          // 再出現してから突進を始めるまで
  dashTime: 2.6,        // 距離440から中心へ届くまで
  dashBreak: 6,         // 突進中に受けたダメージがこの値に届くと中断
  scatterInterval: 9,
  scatterCount: 5,
  scatterSpread: 120,   // 扇の全体の角度（度）
  roarTime: 2.2,        // 咆哮硬直（無防備）
  roarMult: 1.5,        // 咆哮中に受けるダメージの倍率
  score: 6000,
});

export function createBossB(params = {}) {
  const p = { ...BOSS_B_BASE, ...params };
  return {
    type: 'bossB',
    name: 'ボスB',
    p,
    hp: p.hp,
    maxHp: p.hp,
    radius: p.radius,
    angle: 0,
    dist: CONFIG.SPAWN_DIST,
    targetDist: p.dist,
    dir: 1,
    arrived: false,
    t: 0,
    dead: false,
    phase: 'approach',   // approach → idle → telegraph → vanish → settle → dash → (roar | telegraph)
    phaseT: 0,
    hidden: false,
    dashesLeft: 0,
    dashSpeed: 0,
    dashStartDamage: 0,   // 再出現した時点の damageTaken
    damageTaken: 0,      // 受けたダメージの合計（collision.js が加算する）
    damageMult: 1,       // 咆哮の間だけ roarMult
    dashT: p.dashInterval,
    scatterT: p.scatterInterval,
    hitCore: false,      // 突進が中心に届いた。stepGame が読んで戻す
  };
}

// 再出現の角度：視界（fov/2 + margin）の外側から、-90〜+90度で選ぶ
export function pickHiddenAngle(heading, fov, margin, rng) {
  const half = fov / 2 + margin;
  const L = CONFIG.HEADING_LIMIT;
  const spans = [
    { lo: -L, hi: heading - half },
    { lo: heading + half, hi: L },
  ].filter((s) => s.hi > s.lo);
  if (spans.length === 0) return heading >= 0 ? -L : L;
  const total = spans.reduce((sum, s) => sum + (s.hi - s.lo), 0);
  let r = rng() * total;
  for (const s of spans) {
    const len = s.hi - s.lo;
    if (r < len) return s.lo + r;
    r -= len;
  }
  return spans[spans.length - 1].hi;
}

function enterRoar(boss) {
  boss.phase = 'roar';
  boss.phaseT = boss.p.roarTime;
  boss.damageMult = boss.p.roarMult;
}

function retreat(boss, state) {
  boss.dist = boss.p.dist;
  boss.angle = randRange(state.rng, -boss.p.angleRange, boss.p.angleRange);
}

function scatter(boss, state) {
  const { scatterCount: n, scatterSpread: spread } = boss.p;
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
    state.enemies.push(createEnemy('enemyShot', clamp(boss.angle + a, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT), state.rng, {
      dist: boss.dist - boss.radius,
      speed: ENEMY_SHOT_SPEED,
    }));
  }
}

export function updateBossB(boss, state, dt) {
  const p = boss.p;
  boss.t += dt;

  if (boss.phase === 'approach') {
    boss.dist = Math.max(boss.targetDist, boss.dist - p.moveSpeed * dt);
    if (boss.dist <= boss.targetDist) {
      boss.arrived = true;
      boss.phase = 'idle';
      boss.dashT = p.firstDashDelay;
      boss.scatterT = p.scatterInterval;
    }
    return;
  }

  switch (boss.phase) {
    case 'idle': {
      boss.angle += boss.dir * p.drift * dt;
      if (boss.angle > p.angleRange) { boss.angle = p.angleRange; boss.dir = -1; }
      if (boss.angle < -p.angleRange) { boss.angle = -p.angleRange; boss.dir = 1; }
      boss.scatterT -= dt;
      if (boss.scatterT <= 0) {
        boss.scatterT += p.scatterInterval;
        scatter(boss, state);
      }
      boss.dashT -= dt;
      if (boss.dashT <= 0) {
        boss.phase = 'telegraph';
        boss.phaseT = p.telegraph;
        boss.dashesLeft = p.dashCount;
      }
      break;
    }
    case 'telegraph':
      boss.phaseT -= dt;
      if (boss.phaseT <= 0) {
        boss.phase = 'vanish';
        boss.phaseT = p.vanish;
        boss.hidden = true;
      }
      break;
    case 'vanish':
      boss.phaseT -= dt;
      if (boss.phaseT <= 0) {
        const { heading, fov } = state.turret;
        boss.angle = pickHiddenAngle(heading, fov, p.reappearMargin, state.rng);
        boss.dist = p.reappearDist;
        boss.hidden = false;
        boss.dashStartDamage = boss.damageTaken; // 再出現してからのダメージを、中断の判定に数える
        boss.phase = 'settle';
        boss.phaseT = p.settle;
      }
      break;
    case 'settle':
      boss.phaseT -= dt;
      if (boss.phaseT <= 0) {
        boss.phase = 'dash';
        boss.dashSpeed = boss.dist / p.dashTime;
      }
      break;
    case 'dash': {
      boss.dist -= boss.dashSpeed * dt;
      if (boss.damageTaken - boss.dashStartDamage >= p.dashBreak) {
        // 突進を止められた：怯んで戻り、残りの突進も無くなる
        retreat(boss, state);
        boss.dashesLeft = 0;
        enterRoar(boss);
        break;
      }
      if (boss.dist <= CONFIG.HIT_RADIUS_CORE) {
        boss.hitCore = true;
        retreat(boss, state);
        boss.dashesLeft -= 1;
        if (boss.dashesLeft > 0) {
          boss.phase = 'telegraph';
          boss.phaseT = p.chainGap;
        } else {
          enterRoar(boss);
        }
      }
      break;
    }
    case 'roar':
      boss.phaseT -= dt;
      if (boss.phaseT <= 0) {
        boss.damageMult = 1;
        boss.phase = 'idle';
        boss.dashT = p.dashInterval;
      }
      break;
  }
}
