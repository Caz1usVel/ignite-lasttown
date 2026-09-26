import { createBossA, updateBossA, BOSS_A_BASE, pickSpreadAngles } from './boss-a.js';
import { createBossB, updateBossB } from './boss-b.js';

// 既存の import（テスト・formation.js など）を壊さないための再エクスポート
export { BOSS_A_BASE, pickSpreadAngles };

// ---- ボスの登録表：種類ごとに、名前・既定の色・作り方・更新の仕方を持つ ----
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const BOSSES = Object.freeze({
  bossA: Object.freeze({ name: 'ボスA', color: '#8f7cff', create: createBossA, update: updateBossA }),
  bossB: Object.freeze({ name: 'ボスB', color: '#c2418f', create: createBossB, update: updateBossB }),
});

export function createBoss(type, params = {}) {
  const def = Object.prototype.hasOwnProperty.call(BOSSES, type) ? BOSSES[type] : null;
  if (!def) throw new Error(`unknown boss type: ${type}`);
  if (params.color !== undefined && !(typeof params.color === 'string' && COLOR_RE.test(params.color))) {
    throw new Error(`invalid boss color (need #rrggbb): ${params.color}`);
  }
  const boss = def.create(params);
  boss.name = def.name;
  boss.color = params.color ?? def.color; // 描画・エフェクトはこの色を使う（p.color は params のまま）
  return boss;
}

export function updateBoss(boss, state, dt) {
  BOSSES[boss.type].update(boss, state, dt);
}
