import { createTurret } from './turret.js';
import { createSpawner } from './spawner.js';

export function createPlayState(stage, rng = Math.random) {
  return {
    time: 0,
    turret: createTurret(),
    bullets: [],
    enemies: [],
    boss: null,
    spawner: createSpawner(stage),
    score: 0,
    kills: 0,
    rng,
    outcome: null, // null | 'clear' | 'gameover'
  };
}
