import { CONFIG } from '../core/config.js';

export const OFFER_EVERY = 10; // 撃破数がこの数増えるごとに選択が発生する
export const OFFER_SIZE = 2;

// 1回あたりの効果量（コンセプト書「パワーアップ要素」）
const PER_LEVEL = { fireRate: 0.15, damage: 0.2, turnSpeed: 0.15, fov: 8 };

export const POWERUPS = Object.freeze({
  fireRate:  { id: 'fireRate',  name: '連射速度アップ', desc: '秒間の発射数 +15%',        icon: '⚡', max: 5,        weight: 10 },
  damage:    { id: 'damage',    name: '攻撃力アップ',   desc: '1発のダメージ +20%',       icon: '💥', max: 5,        weight: 10 },
  pierce:    { id: 'pierce',    name: '貫通弾',         desc: '倒した敵を貫通する（+1体）', icon: '🎯', max: 3,        weight: 10 },
  turnSpeed: { id: 'turnSpeed', name: '旋回速度アップ', desc: '旋回の速さ +15%',          icon: '🔄', max: 4,        weight: 10 },
  fov:       { id: 'fov',       name: '視界拡大',       desc: '見える角度 +8度',          icon: '👁️', max: 3,        weight: 5 },
  life:      { id: 'life',      name: '最大体力+1',      desc: '最大体力が1増え、体力が1回復する',          icon: '❤️', max: Infinity, weight: 2 },
});

export const POWERUP_IDS = Object.freeze(Object.keys(POWERUPS));

export function createPowerupCounts() {
  return Object.fromEntries(POWERUP_IDS.map((id) => [id, 0]));
}

export function availablePowerups(counts, defs = POWERUPS) {
  return Object.keys(defs).filter((id) => (counts[id] ?? 0) < defs[id].max);
}

// 重み付き・重複なしで最大 OFFER_SIZE 個。候補が足りなければある分だけ（0個なら空）
export function makeOffer(counts, rng, defs = POWERUPS) {
  const pool = availablePowerups(counts, defs);
  const picks = [];
  while (picks.length < OFFER_SIZE && pool.length > 0) {
    const total = pool.reduce((sum, id) => sum + defs[id].weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= defs[pool[idx]].weight;
      if (r < 0) break;
    }
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

// 取得回数から砲台の能力を計算し直す（体力の最大値・現在値は取得した瞬間に加算するので触らない）
export function recomputeTurret(turret, counts) {
  turret.fireRate = CONFIG.FIRE_RATE * (1 + PER_LEVEL.fireRate * counts.fireRate);
  turret.damage = 1 + PER_LEVEL.damage * counts.damage;
  turret.pierce = counts.pierce;
  turret.turnSpeed = CONFIG.TURN_SPEED * (1 + PER_LEVEL.turnSpeed * counts.turnSpeed);
  turret.fov = CONFIG.FOV + PER_LEVEL.fov * counts.fov;
}

export function applyPowerup(state, id) {
  state.powerups[id] += 1;
  if (id === 'life') {
    state.turret.maxLives += 1;
    state.turret.lives += 1; // 最大値が増えるだけでなく、体力も1回復する
  }
  recomputeTurret(state.turret, state.powerups);
}

// 選択の確定。候補に含まれるidだけを受け付ける
export function chooseOffer(state, id) {
  if (!state.offer || !state.offer.includes(id)) return false;
  applyPowerup(state, id);
  state.offer = null;
  return true;
}

export function powerupLevelText(state, id) {
  if (id === 'life') return `最大体力 ${state.turret.maxLives} → ${state.turret.maxLives + 1}`;
  const n = state.powerups[id];
  const next = n + 1;
  return `Lv ${n} → ${next}${next >= POWERUPS[id].max ? '（MAX）' : ''}`;
}
