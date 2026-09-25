import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen, screenToWorldAngle } from '../js/core/view.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('正面の敵は中心の真上に出る', () => {
  const p = worldToScreen(0, 100, 0);
  near(p.x, 500); near(p.y, 400);
  assert.equal(p.visible, true);
});

test('視界の端（±35度）は画面上で真横（±90度）になる', () => {
  const p = worldToScreen(35, 100, 0);
  near(p.x, 600); near(p.y, 500);
  assert.equal(p.visible, true);
  const q = worldToScreen(-35, 100, 0);
  near(q.x, 400);
});

test('視界外は visible=false', () => {
  assert.equal(worldToScreen(36, 100, 0).visible, false);
  assert.equal(worldToScreen(-36, 100, 0).visible, false);
});

test('向きを変えると、向いた方向が真上になる', () => {
  const p = worldToScreen(30, 100, 30);
  near(p.x, 500); near(p.y, 400);
  assert.equal(worldToScreen(0, 100, 40).visible, false);
});

test('世界→画面→世界で角度が戻る', () => {
  for (let rel = -35; rel <= 35; rel += 5) {
    const p = worldToScreen(20 + rel, 200, 20);
    near(screenToWorldAngle(p.x, p.y, 20), 20 + rel, 1e-9);
  }
});

test('中心より下をタップすると、視界の端に押し込まれる', () => {
  near(screenToWorldAngle(600, 700, 0), 35);
  near(screenToWorldAngle(400, 900, 10), -25);
});

test('FOVを広げると見える範囲と引き伸ばし倍率が変わる', () => {
  const p = worldToScreen(43, 100, 0, 86);
  assert.equal(p.visible, true);
  near(p.x, 600);
});
