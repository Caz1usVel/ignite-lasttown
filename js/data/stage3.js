// 3面：落下地帯・地表。突き上げ敵と破片飛ばし敵が出る。1・2面の敵も混ざる。数値は仮。
export const STAGE3 = Object.freeze({
  id: 3,
  name: '落下地帯・地表',
  segments: [
    { from: 0,  to: 20,  spawns: { meteor: 3.0, burrower: 12 } },
    { from: 20, to: 50,  spawns: { meteor: 2.6, drone: 10, burrower: 9, thrower: 16 } },
    { from: 50, to: 85,  spawns: { meteor: 2.4, drone: 9, burrower: 8, thrower: 12,
                                   formationDrone: { every: 18, count: 3, minSep: 25 } } },
    { from: 85, to: 120, spawns: { meteor: 2.2, drone: 8, burrower: 7, thrower: 10,
                                   formationDrone: { every: 14, count: [3, 4], minSep: 25 } } },
  ],
  spawnEnd: 120,
  boss: { type: 'bossB', params: {} },
});
