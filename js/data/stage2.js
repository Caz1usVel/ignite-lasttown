// 2面：上空・隕石帯（激化）。数値は仮。実プレイで調整する。
export const STAGE2 = Object.freeze({
  id: 2,
  name: '上空・隕石帯（激化）',
  segments: [
    { from: 0,  to: 15,  spawns: { meteor: 2.0, drone: 10 } },
    { from: 15, to: 45,  spawns: { meteor: 1.8, drone: 7,
                                   formationDrone: { every: 14, count: 3, minSep: 25 } } },
    { from: 45, to: 90,  spawns: { meteor: 1.5, drone: 6,
                                   formationDrone: { every: 11, count: [3, 4], minSep: 25 } } },
    { from: 90, to: 110, spawns: { meteor: 1.5, drone: 6,
                                   formationDrone: { every: 9, count: [4, 5], minSep: 25 } } },
  ],
  spawnEnd: 110,
  // ボスAの強化型：HP・分散召喚の数と間隔を強め、色で見分ける（他は初期型のまま）
  boss: { type: 'bossA', params: { hp: 60, summonCount: 5, summonInterval: 4.5, color: '#ff8f6b' } },
});
