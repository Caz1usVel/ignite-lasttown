import { CONFIG } from './config.js';
import { DEG, clamp } from './util.js';

const EPS = 1e-9;

// 世界（極座標）→ 仮想画面。視界±fov/2 を画面上の±90度に線形で引き伸ばす。
export function worldToScreen(angle, dist, heading, fov = CONFIG.FOV) {
  const rel = angle - heading;
  const phi = rel * (90 / (fov / 2)) * DEG;
  return {
    x: CONFIG.CENTER_X + dist * Math.sin(phi),
    y: CONFIG.CENTER_Y - dist * Math.cos(phi) * CONFIG.VERT_SCALE,
    visible: Math.abs(rel) <= fov / 2 + EPS,
  };
}

// 仮想画面上の点 → その方向の世界の角度。中心より下は±90度に押し込む。
export function screenToWorldAngle(x, y, heading, fov = CONFIG.FOV) {
  const dx = x - CONFIG.CENTER_X;
  const dy = (CONFIG.CENTER_Y - y) / CONFIG.VERT_SCALE;
  const phiDeg = clamp(Math.atan2(dx, dy) / DEG, -90, 90);
  return heading + phiDeg / (90 / (fov / 2));
}

// 遠くの敵が小さくて見つけにくいので、距離に応じて拡大する倍率。
// 近い（距離0）で1.0倍、出現距離（SPAWN_DIST）で 1+FAR_SCALE 倍。描画と当たり判定の両方に同じ値を使う。
export function visualScale(dist) {
  return 1 + CONFIG.FAR_SCALE * clamp(dist / CONFIG.SPAWN_DIST, 0, 1);
}

// 1000×1000 の仮想エリアを、実画面の中央にレターボックスで置く（DOM専用）
export function createViewport(canvas) {
  const S = CONFIG.VIRTUAL_SIZE;
  const vp = { scale: 1, offsetX: 0, offsetY: 0, dpr: 1, cssW: 0, cssH: 0 };

  vp.resize = () => {
    // 前作から移植：iOS の 100vh 問題対策
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    vp.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.DPR_MAX);
    vp.cssW = canvas.clientWidth;
    vp.cssH = canvas.clientHeight;
    canvas.width = Math.round(vp.cssW * vp.dpr);
    canvas.height = Math.round(vp.cssH * vp.dpr);
    vp.scale = Math.min(vp.cssW, vp.cssH) / S;
    vp.offsetX = (vp.cssW - S * vp.scale) / 2;
    vp.offsetY = (vp.cssH - S * vp.scale) / 2;
  };

  vp.toVirtual = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left - vp.offsetX) / vp.scale,
      y: (clientY - r.top - vp.offsetY) / vp.scale,
    };
  };

  // 画面全体（CSSピクセル）に描くとき
  vp.screenSpace = (g) => g.setTransform(vp.dpr, 0, 0, vp.dpr, 0, 0);
  // 仮想座標で描くとき
  vp.virtualSpace = (g) => {
    const k = vp.dpr * vp.scale;
    g.setTransform(k, 0, 0, k, vp.dpr * vp.offsetX, vp.dpr * vp.offsetY);
  };

  window.addEventListener('resize', vp.resize);
  window.addEventListener('orientationchange', () => setTimeout(vp.resize, 150));
  vp.resize();
  return vp;
}
