import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { pickSpreadAngles } from './boss-a.js';

const MEMBER_JITTER = 0.03; // 機ごとの接近時間のばらつき（編隊の基準ジッタに足す）

// 別々の角度から、ほぼ同時に中心へ届く編隊を作る。
// 角度は minSep 度以上離す。接近時間は編隊で共通のジッタ（±15%）を決め、機ごとに ±3% だけずらす。
export function createFormation(type, count, minSep, rng) {
  const angles = pickSpreadAngles(count, minSep, rng);
  const jitter = randRange(rng, -CONFIG.APPROACH_JITTER, CONFIG.APPROACH_JITTER);
  return angles.map((angle) => {
    const k = 1 + jitter + randRange(rng, -MEMBER_JITTER, MEMBER_JITTER);
    return createEnemy(type, angle, rng, { speed: CONFIG.SPAWN_DIST / (CONFIG.APPROACH_TIME * k) });
  });
}
