import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/core/config.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { DRONE, THROWER, BURROWER, CHARGER } from '../js/game/enemies.js';
import { BOSS_A_BASE } from '../js/game/boss.js';
import { BOSS_B_BASE } from '../js/game/boss-b.js';
import { STAGE2 } from '../js/data/stage2.js';
import { STAGE4 } from '../js/data/stage4.js';
import { mulberry32 } from '../js/core/util.js';

test('難易度調整：雑魚の攻撃の間隔と衝撃波・予兆', () => {
  assert.equal(DRONE.fireInterval, 4.5);
  assert.equal(THROWER.fireInterval, 5.0);
  assert.deepEqual(BURROWER.waveOffsets, [-16, 0, 16]);
  assert.equal(CHARGER.waitTime, 1.5);
});

test('難易度調整：ボスAの初期型・強化型（2面）', () => {
  assert.equal(BOSS_A_BASE.hp, 30);
  assert.equal(BOSS_A_BASE.shotInterval, 5);
  assert.equal(BOSS_A_BASE.summonInterval, 7.5);
  assert.equal(STAGE2.boss.params.hp, 45);
  assert.equal(STAGE2.boss.params.summonCount, 4);
  assert.equal(STAGE2.boss.params.summonInterval, 6);
});

test('難易度調整：ボスBの初期型・強化型（4面）', () => {
  assert.equal(BOSS_B_BASE.hp, 40);
  assert.equal(BOSS_B_BASE.dashInterval, 11);
  assert.equal(BOSS_B_BASE.dashBreak, 6);
  assert.equal(BOSS_B_BASE.scatterInterval, 9);
  assert.equal(BOSS_B_BASE.scatterCount, 5);
  const p = STAGE4.boss.params;
  assert.equal(p.hp, 60);
  assert.equal(p.dashInterval, 8.5);
  assert.equal(p.dashTime, 2.5);
  assert.equal(p.dashBreak, 6);
  assert.equal(p.scatterInterval, 7);
});

test('難易度調整：接近時間・残機・連射・旋回は据え置き', () => {
  assert.equal(CONFIG.APPROACH_TIME, 10);
  assert.equal(CONFIG.LIVES, 3);
  assert.equal(CONFIG.FIRE_RATE, 4);
  assert.equal(CONFIG.TURN_SPEED, 90);
  assert.equal(CONFIG.INVINCIBLE_TIME, 1.5);
});

test('出現の物量：SPAWN_SCALE(1.35) を出現間隔に掛ける', () => {
  assert.equal(CONFIG.SPAWN_SCALE, 1.35);
  const stage = { id: 9, segments: [{ from: 0, to: 1000, spawns: { meteor: 4, formationDrone: { every: 10, count: 3, minSep: 25 } } }], spawnEnd: 1000, boss: { type: 'bossA', params: {} } };
  const count = (scale, seconds) => {
    const state = { enemies: [], boss: null, rng: mulberry32(5) };
    const sp = scale === undefined ? createSpawner(stage, CONFIG.SPAWN_SCALE, Infinity) : createSpawner(stage, scale, Infinity);
    for (let i = 0; i < Math.round(seconds / 0.1); i++) updateSpawner(sp, state, 0.1);
    return {
      meteors: state.enemies.filter((e) => e.type === 'meteor').length,
      formations: state.enemies.filter((e) => e.type === 'formationDrone').length / 3,
    };
  };
  const def = count(undefined, 60.5);
  assert.equal(def.meteors, 11);
  assert.equal(def.formations, 4);
  const one = count(1, 60.5);
  assert.equal(one.meteors, 15);
  assert.equal(one.formations, 6);
});
