// 7面：隕石本体・核心部。全テーマの敵を、偏りなく（袋方式で）ランダムに出す。ボスは最終ボス。数値は仮（SPAWN_SCALE を掛ける前の値）。
const ALL_TYPES = ['meteor', 'drone', 'formationDrone', 'burrower', 'thrower', 'charger', 'shielder', 'teleporter', 'jammer'];

export const STAGE7 = Object.freeze({
  id: 7,
  name: '隕石本体・核心部',
  segments: [
    { from: 0,  to: 30,  spawns: { pool: { every: 1.6, pool: ALL_TYPES, formation: { count: 3, minSep: 25 } } } },
    { from: 30, to: 70,  spawns: { pool: { every: 1.4, pool: ALL_TYPES, formation: { count: [3, 4], minSep: 25 } } } },
    { from: 70, to: 110, spawns: { pool: { every: 1.2, pool: ALL_TYPES, formation: { count: [3, 4], minSep: 25 } } } },
  ],
  spawnEnd: 110,
  boss: { type: 'bossD', params: {} },
});
