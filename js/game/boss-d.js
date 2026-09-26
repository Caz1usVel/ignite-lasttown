import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy, DECOY } from './enemies.js';
import { pickSpreadAngles } from './boss-a.js';
import { createBossB, updateBossB } from './boss-b.js';

// 最終ボス：ボスA（召喚）・ボスB（突進）・ボスC（偽像）の識別攻撃を、弱めて組み合わせる。
// 突進は、内部にボスBのオブジェクトを持って、その動きを借りる。
// 循環参照を避けるため、boss.js は読み込まない（boss.js の登録表がこのファイルを読み込む）。
export const BOSS_D_BASE = Object.freeze({
  hp: 90,
  radius: 64,
  decoyRadius: 44,       // 偽像の半径。遠近の拡大（visualScale(340)≒1.443）をかけるとボスの radius 64 に揃う
  dist: 340,
  moveSpeed: 28,
  angleRange: 50,
  drift: 8,
  restTime: 3.0,
  finalRatio: 0.35,
  summonCount: Object.freeze([2, 3]),
  summonMinSep: 25,
  summonVolleys: 2,
  summonGap: 3.0,
  summonEnd: 2.0,        // 最後の召喚のあと、rest に戻るまで
  minionApproach: 7,
  decoyCount: 2,
  decoyMinSep: 30,
  decoyLifetime: 8,
  decoyRange: 70,        // 偽像を置く角度の範囲（±度、ボスCの layoutRange と同じ）
  decoyRefill: 2,        // 最終フェーズで、偽像が消えてから補充するまで
  dash: Object.freeze({
    dashCount: 1, dashTime: 2.8, dashBreak: 6, settle: 0.5, telegraph: 1.0, vanish: 0.8,
    reappearDist: 440, reappearMargin: 15, roarTime: 2.2, roarMult: 1.5,
  }),
  finalSummonInterval: 6,
  finalSummonCount: 2,
  finalDashInterval: 7,
  score: 10000,
});

// createBoss（boss.js）が boss.color を付ける前に偽像を作るとき（テストで createBossD を直接使うなど）の色。
// 登録表の bossD の既定の色と同じ。
const FALLBACK_COLOR = '#ffd24a';

const MODES = ['summon', 'dash', 'decoy'];

export function createBossD(params = {}) {
  const p = { ...BOSS_D_BASE, ...params };
  return {
    type: 'bossD',
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
    phase: 'approach',   // 待機中は mode と同じ。突進中は内部のボスBの phase（telegraph / vanish / settle / dash / roar）
    mode: 'approach',    // approach → rest → summon | dash | decoy → rest …、HP が少ないと final
    modeT: 0,
    lastMode: null,
    volleysLeft: 0,
    hidden: false,
    damageTaken: 0,      // collision.js が加算する
    damageMult: 1,
    hitCore: false,      // 突進が中心に届いた。stepGame が読んで戻す
    dashing: false,
    inner: null,         // 突進を担当する、内部のボスB
    decoys: [],
    decoyRefillT: 0,
    decoyLifeT: 0,
    swayBase: 0,         // decoy モードに入ったときの角度（偽像と同じ揺れの中心）
    final: false,
    finalSummonT: 0,
    finalDashT: 0,
  };
}

function enterRest(boss) {
  boss.mode = 'rest';
  boss.phase = 'rest';
  boss.modeT = boss.p.restTime;
}

function summonVolley(boss, state, count) {
  const p = boss.p;
  for (const a of pickSpreadAngles(count, p.summonMinSep, state.rng)) {
    state.enemies.push(createEnemy('bossMinion', a, state.rng, {
      dist: p.dist,
      speed: p.dist / p.minionApproach,
    }));
  }
}

// [lo, hi] の中で、taken のどれからも minSep 以上離れた角度を一様に選ぶ。
// そういう角度が無いときは、いちばん離れられる角度を選ぶ。
export function pickFreeAngle(taken, minSep, lo, hi, rng) {
  const sorted = taken.filter((t) => t > lo - minSep && t < hi + minSep).sort((x, y) => x - y);
  const free = [];
  let from = lo;
  for (const t of sorted) {
    const to = Math.min(hi, t - minSep);
    if (to >= from) free.push([from, to]);
    from = Math.max(from, t + minSep);
  }
  if (hi >= from) free.push([from, hi]);
  const total = free.reduce((s, [a, b]) => s + (b - a), 0);
  if (free.length > 0) {
    let u = randRange(rng, 0, total);
    for (const [a, b] of free) {
      if (u <= b - a) return a + u;
      u -= b - a;
    }
    return free[free.length - 1][1];
  }
  // 置ける場所が無い：端と、隣り合う2点の中点のうち、最も離れるもの
  const cands = [lo, hi];
  for (let i = 1; i < sorted.length; i++) cands.push((sorted[i - 1] + sorted[i]) / 2);
  const gap = (a) => Math.min(...taken.map((t) => Math.abs(t - a)));
  return cands.filter((a) => a >= lo && a <= hi).reduce((best, a) => (gap(a) > gap(best) ? a : best));
}

// ボスの角度と、すでにある偽像から decoyMinSep 以上離れた角度で、n 体を出す
function spawnDecoys(boss, state, n) {
  const p = boss.p;
  const taken = [boss.angle, ...boss.decoys.map((d) => d.baseAngle)];
  for (let i = 0; i < n; i++) {
    const a = pickFreeAngle(taken, p.decoyMinSep, -p.decoyRange, p.decoyRange, state.rng);
    taken.push(a);
    const d = createEnemy('decoy', a, state.rng, { dist: p.dist, style: 'bossD', radius: p.decoyRadius, color: boss.color ?? FALLBACK_COLOR });
    boss.decoys.push(d);
    state.enemies.push(d);
  }
}

function killDecoys(boss) {
  for (const d of boss.decoys) d.dead = true;
  boss.decoys = [];
}

// 内部のボスBを、すぐに予兆（telegraph）から始める。idle を経由しないので、
// 内部が 'idle' に戻ったこと＝突進と咆哮が終わったこと、になる。
function startDash(boss) {
  const p = boss.p;
  const inner = createBossB({ ...p.dash, angleRange: p.angleRange, dist: p.dist, scatterInterval: Infinity });
  inner.arrived = true;
  inner.dist = boss.dist;
  inner.angle = boss.angle;
  inner.dir = boss.dir;
  inner.damageTaken = boss.damageTaken;
  inner.phase = 'telegraph';
  inner.phaseT = inner.p.telegraph;
  inner.dashesLeft = inner.p.dashCount;
  boss.inner = inner;
  boss.dashing = true;
  boss.phase = inner.phase;
}

// 指定のモードに入る（テストからも使う）
export function enterMode(boss, state, mode) {
  const p = boss.p;
  boss.mode = mode;
  boss.phase = mode;
  boss.lastMode = mode;
  if (mode === 'summon') {
    boss.volleysLeft = p.summonVolleys;
    boss.modeT = 0;
  } else if (mode === 'dash') {
    startDash(boss);
  } else if (mode === 'decoy') {
    spawnDecoys(boss, state, p.decoyCount);
    boss.swayBase = boss.angle;
    boss.decoyLifeT = p.decoyLifetime;
  } else {
    throw new Error(`unknown bossD mode: ${mode}`);
  }
}

function pickMode(boss, state) {
  const candidates = MODES.filter((m) => m !== boss.lastMode);
  return candidates[randInt(state.rng, 0, candidates.length - 1)];
}

// 最終フェーズ：モードの切り替えをやめる。突進中なら、その突進はそのまま続ける（phase も内部のまま）。
// decoy モードの偽像は、そのまま最終フェーズの偽像として使う（寿命では消えない）。
function startFinal(boss) {
  boss.final = true;
  boss.mode = 'final';
  if (!boss.dashing) boss.phase = 'final';
  boss.volleysLeft = 0;
  boss.finalSummonT = boss.p.finalSummonInterval;
  boss.finalDashT = boss.p.finalDashInterval;
  boss.decoyRefillT = 0;
  boss.decoyLifeT = Infinity;
}

function syncDash(boss, state, dt) {
  const inner = boss.inner;
  inner.damageTaken = boss.damageTaken;   // 受けたダメージを内部のボスBに伝える（突進の中断の判定）
  updateBossB(inner, state, dt);
  boss.damageTaken = inner.damageTaken;
  boss.hidden = inner.hidden;
  boss.angle = inner.angle;
  boss.dist = inner.dist;
  boss.damageMult = inner.damageMult;
  boss.phase = inner.phase;
  if (inner.hitCore) {
    boss.hitCore = true;
    inner.hitCore = false;
  }
  if (inner.phase === 'idle') {   // 突進と咆哮が終わった
    boss.dashing = false;
    boss.inner = null;
    boss.hidden = false;
    boss.damageMult = 1;
    boss.dist = boss.p.dist;
    if (boss.final) boss.phase = 'final';
    else enterRest(boss);
  }
}

function drift(boss, dt) {
  const p = boss.p;
  boss.angle += boss.dir * p.drift * dt;
  if (boss.angle > p.angleRange) { boss.angle = p.angleRange; boss.dir = -1; }
  if (boss.angle < -p.angleRange) { boss.angle = -p.angleRange; boss.dir = 1; }
}

function updateFinal(boss, state, dt) {
  const p = boss.p;
  boss.finalSummonT -= dt;
  if (boss.finalSummonT <= 0) {
    boss.finalSummonT += p.finalSummonInterval;
    summonVolley(boss, state, p.finalSummonCount);
  }
  const missing = p.decoyCount - boss.decoys.length;
  if (missing > 0) {
    boss.decoyRefillT -= dt;
    if (boss.decoyRefillT <= 0) {
      spawnDecoys(boss, state, missing);
      boss.decoyRefillT = p.decoyRefill;
    }
  } else {
    boss.decoyRefillT = p.decoyRefill;
  }
  if (!boss.dashing) {
    boss.finalDashT -= dt;
    if (boss.finalDashT <= 0) {
      boss.finalDashT = p.finalDashInterval;
      startDash(boss);
    }
  }
}

export function updateBossD(boss, state, dt) {
  const p = boss.p;
  boss.t += dt;

  if (!boss.arrived) {
    boss.dist = Math.max(boss.targetDist, boss.dist - p.moveSpeed * dt);
    if (boss.dist <= boss.targetDist) {
      boss.arrived = true;
      enterRest(boss);
    }
    return;
  }

  boss.decoys = boss.decoys.filter((d) => !d.dead);
  if (!boss.final && boss.hp <= boss.maxHp * p.finalRatio) startFinal(boss);

  if (boss.dashing) syncDash(boss, state, dt);
  // 待機の動き。decoy モードの間は、偽像と見分けがつかないよう動かない
  else if (boss.mode !== 'decoy') drift(boss, dt);
  // decoy モードの間は、偽像と同じ揺れ方をして、動かないことで見分けられないようにする
  else boss.angle = boss.swayBase + DECOY.sway * Math.sin(boss.t * DECOY.swayHz * Math.PI * 2);

  if (boss.final) {
    updateFinal(boss, state, dt);
    return;
  }
  if (boss.dashing) return;

  switch (boss.mode) {
    case 'rest':
      boss.modeT -= dt;
      if (boss.modeT <= 0) enterMode(boss, state, pickMode(boss, state));
      break;
    case 'summon':
      boss.modeT -= dt;
      if (boss.modeT <= 0) {
        if (boss.volleysLeft > 0) {
          summonVolley(boss, state, randInt(state.rng, p.summonCount[0], p.summonCount[1]));
          boss.volleysLeft -= 1;
          boss.modeT = boss.volleysLeft > 0 ? p.summonGap : p.summonEnd;
        } else {
          enterRest(boss);
        }
      }
      break;
    case 'decoy':
      boss.decoyLifeT -= dt;
      if (boss.decoyLifeT <= 0) {
        killDecoys(boss);
        enterRest(boss);
      }
      break;
  }
}
