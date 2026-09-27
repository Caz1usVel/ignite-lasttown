import { CONFIG } from '../core/config.js';
import { randInt, randRange, shuffled } from '../core/util.js';
import { createEnemy, activeCount } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';
import { BOSS_A_BASE } from './boss-a.js';
import { BOSS_B_BASE } from './boss-b.js';
import { BOSS_C_BASE } from './boss-c.js';

// エンドレス：静的な出現表の代わりに、経過時間から、出現の間隔・敵の種類・敵の速さ・ボスの強さを決める。
// 同時に出る敵は MAX_ACTIVE のまま（ユーザーの指示）。難しくなるのは、出現頻度・速さ・ボスの強さ。
const CONFIGS = {
  normal: { startLevel: 0, base: 2.6, decay: 0.9, floor: 0.9, bossEvery: 60 },
  hard:   { startLevel: 5, base: 1.8, decay: 0.88, floor: 0.7, bossEvery: 60 },
};
const NAMES = { normal: '通常エンドレス', hard: 'ハードエンドレス' };
const BOSS_TYPES = ['bossA', 'bossB', 'bossC'];

export function createEndlessStage(kind) {
  if (!Object.prototype.hasOwnProperty.call(CONFIGS, kind)) throw new Error(`unknown endless kind: ${kind}`);
  return {
    id: `endless-${kind}`,
    name: NAMES[kind],
    endless: { kind, ...CONFIGS[kind] },
    segments: [],
    spawnEnd: Infinity,
    boss: null,
  };
}

const BASIC = ['meteor', 'drone'];
const MELEE = ['burrower', 'thrower', 'charger'];
const JAMMING = ['shielder', 'teleporter', 'jammer'];

export function endlessPool(kind, t) {
  if (kind === 'hard') return [...BASIC, 'formationDrone', ...MELEE, ...(t >= 60 ? JAMMING : [])];
  const pool = [...BASIC];
  if (t >= 60) pool.push('formationDrone');
  if (t >= 120) pool.push(...MELEE);
  if (t >= 240) pool.push(...JAMMING);
  return pool;
}

export function endlessEvery(cfg, t) {
  return Math.max(cfg.floor, cfg.base * Math.pow(cfg.decay, t / 60));
}

export function speedMult(t) {
  return 1 + Math.min(0.5, (0.04 * t) / 60);
}

// 5回の撃破ごとに1段階（tier）。0（初期）〜3（3段階目）で止まる（最終的に15回で上限）
export function endlessTier(L) {
  return Math.min(3, Math.floor(L / 5));
}

// ボスの強さ。tier（0〜3）が上がるほど、体力が+15%刻みで増え、識別攻撃の数・頻度が少しだけ上がる
export function endlessBossParams(type, L) {
  const tier = endlessTier(L);
  const hpk = 1 + 0.15 * tier;
  switch (type) {
    case 'bossA': return {
      hp: Math.round(BOSS_A_BASE.hp * hpk),
      summonCount: BOSS_A_BASE.summonCount + tier,
      summonInterval: BOSS_A_BASE.summonInterval * Math.pow(0.95, tier),
      shotInterval: BOSS_A_BASE.shotInterval * Math.pow(0.95, tier),
      shotBurst: BOSS_A_BASE.shotBurst + Math.floor(tier / 2),
    };
    case 'bossB': return {
      hp: Math.round(BOSS_B_BASE.hp * hpk),
      dashInterval: BOSS_B_BASE.dashInterval * Math.pow(0.95, tier),
      dashCount: BOSS_B_BASE.dashCount + Math.floor(tier / 2),
      dashTime: BOSS_B_BASE.dashTime * Math.pow(0.97, tier),
      scatterInterval: BOSS_B_BASE.scatterInterval * Math.pow(0.95, tier),
      scatterCount: BOSS_B_BASE.scatterCount + tier,
    };
    case 'bossC': return {
      hp: Math.round(BOSS_C_BASE.hp * hpk),
      decoyCount: BOSS_C_BASE.decoyCount + Math.min(2, tier),
      swapInterval: BOSS_C_BASE.swapInterval * Math.pow(0.95, tier),
      shieldInterval: BOSS_C_BASE.shieldInterval * Math.pow(0.95, tier),
      jamInterval: BOSS_C_BASE.jamInterval * Math.pow(0.95, tier),
    };
    default: throw new Error(`unknown endless boss type: ${type}`);
  }
}

export function initEndless(stage) {
  return {
    kind: stage.endless.kind,
    timer: 0,            // 雑魚の出現のタイマー
    bag: [],
    bagKey: '',
    bossTimer: 0,
    bossLevel: stage.endless.startLevel,
    hadBoss: false,
    lastBoss: null,
  };
}

export function updateEndless(sp, state, dt) {
  const st = sp.endless;
  const cfg = sp.stage.endless;
  const t = sp.time;

  // ボスがいなくなった（倒された）ら、強さを上げて、次のタイマーを始める
  if (st.hadBoss && !state.boss) {
    st.hadBoss = false;
    st.bossLevel += 1;
    st.bossTimer = 0;
  }

  if (state.boss) return; // ボス戦の間は、雑魚を出さない

  // ボスの出現
  st.bossTimer += dt;
  if (st.bossTimer >= cfg.bossEvery) {
    const candidates = BOSS_TYPES.filter((b) => b !== st.lastBoss);
    const type = candidates[randInt(state.rng, 0, candidates.length - 1)];
    st.lastBoss = type;
    state.boss = createBoss(type, endlessBossParams(type, st.bossLevel));
    st.hadBoss = true;
    return;
  }

  // 雑魚の出現
  st.timer += dt;
  const every = endlessEvery(cfg, t) * sp.scale;
  while (st.timer >= every) {
    const room = sp.maxActive - activeCount(state);
    if (room <= 0) { st.timer = every; break; }
    st.timer -= every;
    const pool = endlessPool(cfg.kind, t);
    const key = pool.join(',');
    if (st.bagKey !== key || st.bag.length === 0) { st.bag = shuffled(pool, state.rng); st.bagKey = key; }
    const picked = st.bag.pop();
    const mult = speedMult(t);
    let made;
    if (picked === 'formationDrone') {
      const [lo, hi] = t < 120 ? [3, 3] : [3, 4];
      const n = Math.min(randInt(state.rng, lo, hi), room);
      made = createFormation('formationDrone', n, 25, state.rng);
    } else {
      const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
      made = [createEnemy(picked, angle, state.rng)];
    }
    for (const e of made) e.speed *= mult;
    state.enemies.push(...made);
  }
}
