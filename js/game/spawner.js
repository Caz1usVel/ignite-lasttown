import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy, ENEMY_DEFS } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';

export function createSpawner(stage, scale = CONFIG.SPAWN_SCALE) {
  return { stage, scale, time: 0, timers: {}, bossSpawned: false };
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

// ステージのデータを読み込み時に検査する。誤りがあれば、内容のわかる例外を投げる。
export function validateStage(stage) {
  const label = `stage ${stage?.id}`;
  const { segments } = stage ?? {};
  if (!Array.isArray(segments) || segments.length === 0) throw new Error(`${label}: segments must be a non-empty array`);
  if (segments[0].from !== 0) throw new Error(`${label}: first segment must start at 0 (got ${segments[0].from})`);
  segments.forEach((seg, i) => {
    if (i > 0 && seg.from !== segments[i - 1].to) {
      throw new Error(`${label}: segment ${i} starts at ${seg.from} but the previous one ends at ${segments[i - 1].to}`);
    }
    if (!(seg.to > seg.from)) throw new Error(`${label}: segment ${i} must have to > from (${seg.from}..${seg.to})`);
    for (const [type, raw] of Object.entries(seg.spawns ?? {})) {
      if (!Object.prototype.hasOwnProperty.call(ENEMY_DEFS, type)) throw new Error(`${label}: unknown enemy type in spawns: ${type}`);
      readEntry(type, raw);
      if (raw && typeof raw === 'object' && Array.isArray(raw.count) && raw.count.length !== 2) {
        throw new Error(`${label}: "count" array for ${type} must have exactly 2 elements: ${JSON.stringify(raw.count)}`);
      }
    }
  });
  const last = segments[segments.length - 1];
  if (stage.spawnEnd !== last.to) throw new Error(`${label}: spawnEnd (${stage.spawnEnd}) must equal the last segment's end (${last.to})`);
  try {
    createBoss(stage.boss?.type, stage.boss?.params);
  } catch (err) {
    throw new Error(`${label}: invalid boss (${err.message})`);
  }
}

export function updateSpawner(sp, state, dt) {
  sp.time += dt;
  const { stage } = sp;

  if (sp.time < stage.spawnEnd) {
    const seg = stage.segments.find((s) => sp.time >= s.from && sp.time < s.to);
    if (!seg) return;
    const segIndex = stage.segments.indexOf(seg);
    for (const [type, raw] of Object.entries(seg.spawns)) {
      const { every: baseEvery, group } = readEntry(type, raw);
      const every = baseEvery * sp.scale; // 物量の調整（仕様書 §2）
      const key = `${segIndex}:${type}`; // 区間ごとに新しく数える（前の区間の余りを引き継がない）
      sp.timers[key] = (sp.timers[key] ?? 0) + dt;
      while (sp.timers[key] >= every) {
        sp.timers[key] -= every;
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
