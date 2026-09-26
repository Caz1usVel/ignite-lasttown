import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen, screenToWorldAngle, visualScale } from '../js/core/view.js';
import { CONFIG } from '../js/core/config.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('正面の敵は中心の真上に出る', () => {
  const p = worldToScreen(0, 100, 0);
  near(p.x, 500); near(p.y, CONFIG.CENTER_Y - 100 * CONFIG.VERT_SCALE);
  assert.equal(p.visible, true);
});

test('視界の端（±35度）は画面上で真横（±90度）になる', () => {
  const p = worldToScreen(35, 100, 0);
  near(p.x, 600); near(p.y, CONFIG.CENTER_Y);
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
  near(p.x, 500); near(p.y, CONFIG.CENTER_Y - 100 * CONFIG.VERT_SCALE);
  assert.equal(worldToScreen(0, 100, 40).visible, false);
});

test('世界→画面→世界で角度が戻る', () => {
  for (let rel = -35; rel <= 35; rel += 5) {
    const p = worldToScreen(20 + rel, 200, 20);
    near(screenToWorldAngle(p.x, p.y, 20), 20 + rel, 1e-9);
  }
});

test('中心より下をタップすると、視界の端に押し込まれる', () => {
  near(screenToWorldAngle(600, CONFIG.CENTER_Y + 200, 0), 35);
  near(screenToWorldAngle(400, CONFIG.CENTER_Y + 400, 10), -25);
});

test('FOVを広げると見える範囲と引き伸ばし倍率が変わる', () => {
  const p = worldToScreen(43, 100, 0, 86);
  assert.equal(p.visible, true);
  near(p.x, 600);
});

test('visualScale：近いほど1.0倍、出現距離で 1+FAR_SCALE 倍、距離に対して単調増加', () => {
  assert.equal(visualScale(0), 1);
  near(visualScale(460), 1 + CONFIG.FAR_SCALE);
  near(visualScale(230), 1 + CONFIG.FAR_SCALE / 2);
  let prev = visualScale(0);
  for (let d = 10; d <= 460; d += 10) {
    const k = visualScale(d);
    assert.ok(k > prev, `d=${d}`);
    prev = k;
  }
  near(visualScale(9999), 1 + CONFIG.FAR_SCALE); // 出現距離より遠くても頭打ち
});

test('縦は VERT_SCALE 倍に引き伸ばされ、横は距離そのまま（斜めの点も画面→世界で戻る）', () => {
  const p = worldToScreen(20, 300, 0); // 20度 = 画面上 ~51.4度
  const phi = 20 * (90 / 35) * Math.PI / 180;
  near(p.x, CONFIG.CENTER_X + 300 * Math.sin(phi));
  near(p.y, CONFIG.CENTER_Y - 300 * Math.cos(phi) * CONFIG.VERT_SCALE);
  near(screenToWorldAngle(p.x, p.y, 0), 20, 1e-9);
});

test('砲台（中心）は画面の下寄りにあり、正面の出現距離でもレーダー（上端）の下に収まる', () => {
  assert.ok(CONFIG.CENTER_Y >= 800);
  const top = worldToScreen(0, CONFIG.SPAWN_DIST, 0).y;
  assert.ok(top > 150, `top=${top}`);
});
