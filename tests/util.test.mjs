import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, randRange, mulberry32, lightenColor } from '../js/core/util.js';

test('clamp は範囲内に収める', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('lerp は線形補間する', () => {
  assert.equal(lerp(10, 20, 0.25), 12.5);
});

test('mulberry32 は同じシードで同じ列を返し、0以上1未満', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('randRange は lo..hi に収まる', () => {
  const rng = mulberry32(1);
  for (let i = 0; i < 100; i++) {
    const v = randRange(rng, -90, 90);
    assert.ok(v >= -90 && v < 90);
  }
});

test('lightenColor は明るく／暗くする', () => {
  assert.equal(lightenColor('#000000', 0.5), 'rgb(128,128,128)');
  assert.equal(lightenColor('#ffffff', -0.5), 'rgb(128,128,128)');
});
