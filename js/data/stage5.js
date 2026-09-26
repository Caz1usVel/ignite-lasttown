// 5面：防衛拠点・電子戦エリア。シールド敵・テレポート敵が出る。旧テーマの敵も混ざる。数値は仮（SPAWN_SCALE を掛ける前の値）。
export const STAGE5 = Object.freeze({
  id: 5,
  name: '防衛拠点・電子戦エリア',
  segments: [
    { from: 0,  to: 20,  spawns: { meteor: 3.0, drone: 10, shielder: 12 } },
    { from: 20, to: 55,  spawns: { meteor: 2.8, drone: 10, burrower: 12, shielder: 10, teleporter: 12 } },
    { from: 55, to: 95,  spawns: { meteor: 2.6, drone: 9, thrower: 14, shielder: 9, teleporter: 10,
                                   formationDrone: { every: 18, count: 3, minSep: 25 } } },
    { from: 95, to: 125, spawns: { meteor: 2.4, drone: 9, burrower: 11, thrower: 12, shielder: 8, teleporter: 9,
                                   formationDrone: { every: 14, count: [3, 4], minSep: 25 } } },
  ],
  spawnEnd: 125,
  boss: { type: 'bossC', params: {} },
});
