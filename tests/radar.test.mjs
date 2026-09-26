import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADAR, radarPoint, radarFovArc } from '../js/render/radar.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('radarPoint：正面（0度）は中心の真上、距離0は中心', () => {
  const p = radarPoint(0, 230);
  near(p.x, RADAR.cx);
  near(p.y, RADAR.cy - RADAR.r * 0.5);
  const c = radarPoint(45, 0);
  near(c.x, RADAR.cx); near(c.y, RADAR.cy);
});

test('radarPoint：±90度は左右の端（中心と同じ高さ）、出現距離で半径いっぱい', () => {
  const r = radarPoint(90, 460);
  near(r.x, RADAR.cx + RADAR.r); near(r.y, RADAR.cy);
  const l = radarPoint(-90, 460);
  near(l.x, RADAR.cx - RADAR.r); near(l.y, RADAR.cy);
});

test('radarPoint：世界の角度をそのまま使う（視界の引き伸ばしはしない）', () => {
  const p = radarPoint(30, 460);
  near(p.x, RADAR.cx + RADAR.r * Math.sin(Math.PI / 6));
  near(p.y, RADAR.cy - RADAR.r * Math.cos(Math.PI / 6));
});

test('radarPoint：半円の外（距離が出現距離より遠い）は半径に収める', () => {
  const p = radarPoint(0, 9999);
  near(p.y, RADAR.cy - RADAR.r);
});

test('radarFovArc：視界の扇形の角度（ラジアン、-90度が真上を0とする世界角）', () => {
  const a = radarFovArc(0, 70);
  // 真上(-π/2)を中心に ±35度
  near(a.from, -Math.PI / 2 - (35 * Math.PI) / 180);
  near(a.to, -Math.PI / 2 + (35 * Math.PI) / 180);
  const r = radarFovArc(80, 70); // 右端に向いているとき、旋回範囲(±90)を超える分はレーダーの半円に収める
  near(r.to, 0);
  const l = radarFovArc(-80, 70);
  near(l.from, -Math.PI);
});
