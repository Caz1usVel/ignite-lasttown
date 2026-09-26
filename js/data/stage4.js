// 4面：落下地帯・激戦区。3面の敵に、突進敵が加わる。ボスBは強化型。数値は仮。
export const STAGE4 = Object.freeze({
  id: 4,
  name: '落下地帯・激戦区',
  segments: [
    { from: 0,  to: 20,  spawns: { meteor: 3.0, burrower: 14, charger: 18 } },
    { from: 20, to: 55,  spawns: { meteor: 2.6, drone: 10, burrower: 12, thrower: 16, charger: 15 } },
    { from: 55, to: 95,  spawns: { meteor: 2.4, drone: 9, burrower: 11, thrower: 14, charger: 12,
                                   formationDrone: { every: 16, count: 3, minSep: 25 } } },
    { from: 95, to: 130, spawns: { meteor: 2.2, drone: 8, burrower: 10, thrower: 12, charger: 10,
                                   formationDrone: { every: 12, count: [3, 4], minSep: 25 } } },
  ],
  spawnEnd: 130,
  // ボスBの強化型：HP・連続突進・突進の速さ・散布の間隔を強め、色で見分ける
  boss: {
    type: 'bossB',
    params: { hp: 80, dashInterval: 6.5, dashCount: 2, dashTime: 2.3, dashBreak: 8, scatterInterval: 5, color: '#ff7a3d' },
  },
});
