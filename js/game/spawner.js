import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { createBoss } from './boss.js';

export function createSpawner(stage) {
  return { stage, time: 0, timers: {}, bossSpawned: false };
}

export function updateSpawner(sp, state, dt) {
  sp.time += dt;
  const { stage } = sp;

  if (sp.time < stage.spawnEnd) {
    const seg = stage.segments.find((s) => sp.time >= s.from && sp.time < s.to);
    if (!seg) return;
    for (const [type, interval] of Object.entries(seg.spawns)) {
      sp.timers[type] = (sp.timers[type] ?? 0) + dt;
      while (sp.timers[type] >= interval) {
        sp.timers[type] -= interval;
        const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
        state.enemies.push(createEnemy(type, angle, state.rng));
      }
    }
    return;
  }

  if (!sp.bossSpawned && state.enemies.length === 0) {
    state.boss = createBoss(stage.boss.type, stage.boss.params);
    sp.bossSpawned = true;
  }
}
