import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';

export function createSpawner(stage) {
  return { stage, time: 0, timers: {}, bossSpawned: false };
}

// 出現表の1項目を読む。
//   数値                                   … その間隔（秒）で1体ずつ
//   { every, count, minSep }               … every 秒ごとに count 機をまとめて出す（count は正の整数、または [最小, 最大]）
// ステージのデータの誤りは、その項目を処理するときに例外で知らせる。
function readEntry(type, entry) {
  if (typeof entry === 'number') {
    if (!Number.isFinite(entry) || entry <= 0) throw new Error(`invalid spawn interval for ${type}: ${entry}`);
    return { every: entry, group: null };
  }
  if (entry && typeof entry === 'object') {
    const { every, count = 1, minSep } = entry;
    if (!Number.isFinite(every) || every <= 0) throw new Error(`invalid spawn "every" for ${type}: ${every}`);
    const [lo, hi] = Array.isArray(count) ? count : [count, count];
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) {
      throw new Error(`invalid spawn "count" for ${type}: ${JSON.stringify(count)}`);
    }
    if (!Number.isFinite(minSep)) throw new Error(`invalid spawn "minSep" for ${type}: ${minSep}`);
    return { every, group: { lo, hi, minSep } };
  }
  throw new Error(`invalid spawn entry for ${type}: ${entry}`);
}

export function updateSpawner(sp, state, dt) {
  sp.time += dt;
  const { stage } = sp;

  if (sp.time < stage.spawnEnd) {
    const seg = stage.segments.find((s) => sp.time >= s.from && sp.time < s.to);
    if (!seg) return;
    for (const [type, raw] of Object.entries(seg.spawns)) {
      const { every, group } = readEntry(type, raw);
      sp.timers[type] = (sp.timers[type] ?? 0) + dt;
      while (sp.timers[type] >= every) {
        sp.timers[type] -= every;
        if (group) {
          const n = randInt(state.rng, group.lo, group.hi);
          state.enemies.push(...createFormation(type, n, group.minSep, state.rng));
        } else {
          const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
          state.enemies.push(createEnemy(type, angle, state.rng));
        }
      }
    }
    return;
  }

  if (!sp.bossSpawned && state.enemies.length === 0) {
    state.boss = createBoss(stage.boss.type, stage.boss.params);
    sp.bossSpawned = true;
  }
}
