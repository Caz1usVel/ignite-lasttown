// 1面：上空・隕石帯（序盤）。数値は仮。実プレイで調整する。
export const STAGE1 = Object.freeze({
  id: 1,
  segments: [
    { from: 0,  to: 20, spawns: { meteor: 3.0 } },
    { from: 20, to: 60, spawns: { meteor: 2.0, drone: 8 } },
    { from: 60, to: 90, spawns: { meteor: 1.5, drone: 6 } },
  ],
  spawnEnd: 90,
  boss: { type: 'bossA', params: {} },
});
