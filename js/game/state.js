import { createTurret } from './turret.js';
import { createSpawner } from './spawner.js';
import { createPowerupCounts, OFFER_EVERY } from './powerups.js';

export function createPlayState(stage, rng = Math.random) {
  return {
    time: 0,
    turret: createTurret(),
    bullets: [],
    enemies: [],
    boss: null,
    bossFreeze: 0, // >0の間、ボス出現直後の突入演出として、ボスの行動を止める（秒。js/game/step.js）
    spawner: createSpawner(stage),
    score: 0,
    kills: 0,
    powerups: createPowerupCounts(), // 取得回数（ステージごとにリセット）
    nextOfferAt: OFFER_EVERY,        // 次の選択が発生する撃破数
    offer: null,                     // 選択待ちのとき、提示中のid配列
    rng,
    endless: Boolean(stage.endless),
    outcome: null, // null | 'clear' | 'gameover'
  };
}
