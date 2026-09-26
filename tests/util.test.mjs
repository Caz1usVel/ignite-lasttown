import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, randRange, randInt, mulberry32, lightenColor, hexToRgba, pickAngleOutside } from '../js/core/util.js';

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

test('randInt は両端を含む整数を返し、同じシードで同じ列になる', () => {
  const a = mulberry32(7), b = mulberry32(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = randInt(a, 3, 5);
    assert.equal(v, randInt(b, 3, 5));
    assert.ok(Number.isInteger(v) && v >= 3 && v <= 5);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
  assert.equal(randInt(mulberry32(1), 4, 4), 4);
});

test('hexToRgba は #rrggbb を rgba() にする', () => {
  assert.equal(hexToRgba('#8f7cff', 0.35), 'rgba(143,124,255,0.35)');
  assert.equal(hexToRgba('#000000', 0), 'rgba(0,0,0,0)');
  assert.equal(hexToRgba('#ffffff', 1), 'rgba(255,255,255,1)');
});

test('pickAngleOutside：中心から half 度以上離れた、-90〜+90 の角度を選ぶ', () => {
  const rng = mulberry32(3);
  for (const center of [-90, -45, 0, 30, 90]) {
    for (const half of [10, 30, 50]) {
      for (let i = 0; i < 200; i++) {
        const a = pickAngleOutside(center, half, rng);
        assert.ok(a >= -90 && a <= 90, `a=${a}`);
        assert.ok(Math.abs(a - center) >= half - 1e-9, `center=${center} half=${half} a=${a}`);
      }
    }
  }
});

test('pickAngleOutside：両側が候補なら両方から選び、区間が無ければ反対の端', () => {
  const rng = mulberry32(5);
  let left = 0, right = 0;
  for (let i = 0; i < 400; i++) { if (pickAngleOutside(0, 30, rng) < 0) left++; else right++; }
  assert.ok(left > 100 && right > 100, `${left}/${right}`);
  assert.equal(pickAngleOutside(0, 200, mulberry32(1)), -90);
  assert.equal(pickAngleOutside(10, 200, mulberry32(1)), -90);
  assert.equal(pickAngleOutside(-10, 200, mulberry32(1)), 90);
});
