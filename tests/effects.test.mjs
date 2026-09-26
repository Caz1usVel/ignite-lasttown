import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEffects, spawnBurst, spawnPopup, updateEffects } from '../js/game/effects.js';
import { mulberry32 } from '../js/core/util.js';

test('spawnBurst は指定数のパーティクルを作り、寿命で消える', () => {
  const fx = createEffects();
  spawnBurst(fx, 100, 100, '#ffd866', 12, mulberry32(1));
  assert.equal(fx.particles.length, 12);
  updateEffects(fx, 0.1);
  assert.equal(fx.particles.length, 12);
  assert.notEqual(fx.particles[0].x, 100);
  updateEffects(fx, 1);
  assert.equal(fx.particles.length, 0);
});

test('spawnPopup は0.8秒で消える', () => {
  const fx = createEffects();
  spawnPopup(fx, 0, 0, '+100', '#fff');
  updateEffects(fx, 0.5);
  assert.equal(fx.popups.length, 1);
  updateEffects(fx, 0.4);
  assert.equal(fx.popups.length, 0);
});
