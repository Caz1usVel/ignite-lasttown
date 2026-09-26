import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy, ENEMY_DEFS } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';

export function createSpawner(stage, scale = CONFIG.SPAWN_SCALE) {
  return { stage, scale, time: 0, timers: {}, bags: {}, bossSpawned: false };
}

// 出現表の1項目を読む。
//   数値                                   … その間隔（秒）で1体ずつ
//   { every, count, minSep }               … every 秒ごとに count 機をまとめて出す（count は正の整数、または [最小, 最大]）
// ステージのデータの誤りは、その項目を処理するときに例外で知らせる。
function readEntry(type, entry) {
  if (entry && typeof entry === 'object' && 'pool' in entry) {
    const { every, pool, formation } = entry;
    if (!Number.isFinite(every) || every <= 0) throw new Error(`invalid spawn "every" for ${type}: ${every}`);
    if (!Array.isArray(pool) || pool.length === 0) throw new Error(`invalid spawn "pool" for ${type}: must be a non-empty array`);
    for (const t of pool) {
      if (!Object.prototype.hasOwnProperty.call(ENEMY_DEFS, t)) throw new Error(`unknown enemy type in pool: ${t}`);
    }
    let group = null;
    if (pool.includes('formationDrone')) {
      if (!formation) throw new Error(`pool with formationDrone needs "formation" (${type})`);
      if (Array.isArray(formation.count) && formation.count.length !== 2) {
        throw new Error(`"count" array for formation of ${type} must have exactly 2 elements: ${JSON.stringify(formation.count)}`);
      }
      group = readEntry('formationDrone', { every, count: formation.count, minSep: formation.minSep }).group;
    }
    return { every, group: null, pool, formationGroup: group };
  }
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
      const isPool = raw && typeof raw === 'object' && 'pool' in raw;
      if (!isPool && !Object.prototype.hasOwnProperty.call(ENEMY_DEFS, type)) throw new Error(`${label}: unknown enemy type in spawns: ${type}`);
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
      const { every: baseEvery, group, pool, formationGroup } = readEntry(type, raw);
      const every = baseEvery * sp.scale; // 物量の調整（仕様書 §2）
      const key = `${segIndex}:${type}`; // 区間ごとに新しく数える（前の区間の余りを引き継がない）
      sp.timers[key] = (sp.timers[key] ?? 0) + dt;
      while (sp.timers[key] >= every) {
        sp.timers[key] -= every;
        if (pool) {
          // 袋方式：空なら全種類をシャッフルして詰め、1つずつ取り出す（1周するまで同じ種類は出ない）
          let bag = sp.bags[key];
          if (!bag || bag.length === 0) bag = sp.bags[key] = shuffled(pool, state.rng);
          const picked = bag.pop();
          if (picked === 'formationDrone') {
            const n = randInt(state.rng, formationGroup.lo, formationGroup.hi);
            state.enemies.push(...createFormation('formationDrone', n, formationGroup.minSep, state.rng));
          } else {
            const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
            state.enemies.push(createEnemy(picked, angle, state.rng));
          }
        } else if (group) {
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

// フィッシャー–イェーツ（元の配列は変えない）
function shuffled(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
