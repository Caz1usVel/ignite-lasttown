// 6面：防衛拠点・最終防衛線。妨害電波敵が加わる。ボスCは強化型。数値は仮（SPAWN_SCALE を掛ける前の値）。
export const STAGE6 = Object.freeze({
  id: 6,
  name: '防衛拠点・最終防衛線',
  segments: [
    { from: 0,  to: 20,  spawns: { meteor: 3.0, shielder: 12, teleporter: 14, jammer: 16 } },
    { from: 20, to: 55,  spawns: { meteor: 2.8, drone: 10, burrower: 12, shielder: 10, teleporter: 11, jammer: 14 } },
    { from: 55, to: 95,  spawns: { meteor: 2.6, thrower: 14, shielder: 9, teleporter: 10, jammer: 12, charger: 14,
                                   formationDrone: { every: 18, count: 3, minSep: 25 } } },
    { from: 95, to: 135, spawns: { meteor: 2.4, burrower: 12, thrower: 12, shielder: 8, teleporter: 9, jammer: 10, charger: 12,
                                   formationDrone: { every: 14, count: [3, 4], minSep: 25 } } },
  ],
  spawnEnd: 135,
  // ボスCの強化型：偽像・入れ替え・シールド・妨害電波を強め、色で見分ける
  boss: {
    type: 'bossC',
    params: { hp: 70, decoyCount: 3, swapInterval: 4.5, shieldInterval: 8, jamInterval: 7, color: '#ff9fd0' },
  },
});
