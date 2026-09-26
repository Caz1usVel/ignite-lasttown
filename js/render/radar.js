import { CONFIG } from '../core/config.js';
import { DEG, clamp } from '../core/util.js';

// ミニマップ（レーダー）：仮想エリアの上中央に、自機を中心とした上向きの半円（脅威の180度範囲）を置く。
// 視界の外の敵も点だけは見える。世界の角度（0が正面、±90が左右の端）をそのまま使う。
export const RADAR = Object.freeze({ cx: 500, cy: 130, r: 90 });

// 世界の (角度, 距離) → レーダー上の座標。距離は出現距離で半径いっぱいになるように縮め、それより遠くは半径に収める
export function radarPoint(angle, dist) {
  const k = clamp(dist / CONFIG.SPAWN_DIST, 0, 1) * RADAR.r;
  const a = clamp(angle, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT) * DEG;
  return { x: RADAR.cx + k * Math.sin(a), y: RADAR.cy - k * Math.cos(a) };
}

// 現在の視界の扇形（canvasのarc用のラジアン。真上が -π/2、半円の範囲 -π〜0 に収める）
export function radarFovArc(heading, fov) {
  const from = clamp(-Math.PI / 2 + (heading - fov / 2) * DEG, -Math.PI, 0);
  const to = clamp(-Math.PI / 2 + (heading + fov / 2) * DEG, -Math.PI, 0);
  return { from, to };
}

function dot(g, e, inFov) {
  const p = radarPoint(e.angle, e.dist);
  const isShot = e.type === 'enemyShot' || e.type === 'shard' || e.type === 'jamShot';
  const r = isShot ? 2 : 4;
  g.fillStyle = isShot
    ? (inFov ? 'rgba(255,122,82,1)' : 'rgba(255,122,82,0.55)')
    : e.type === 'healMeteor'
      ? (inFov ? 'rgba(111,220,140,1)' : 'rgba(111,220,140,0.6)')
      : (inFov ? 'rgba(255,216,102,1)' : 'rgba(255,216,102,0.55)');
  g.beginPath();
  g.arc(p.x, p.y, r, 0, Math.PI * 2);
  g.fill();
}

function bossDot(g, e, inFov) {
  const p = radarPoint(e.angle, e.dist);
  g.fillStyle = inFov ? 'rgba(255,158,203,1)' : 'rgba(255,158,203,0.6)';
  g.beginPath();
  g.arc(p.x, p.y, 7, 0, Math.PI * 2);
  g.fill();
}

export function drawRadar(g, state) {
  const { heading, fov } = state.turret;
  const { cx, cy, r } = RADAR;
  g.save();

  // 半円の下地
  g.fillStyle = 'rgba(10,14,39,0.55)';
  g.beginPath();
  g.moveTo(cx - r, cy);
  g.arc(cx, cy, r, Math.PI, Math.PI * 2);
  g.closePath();
  g.fill();

  // 現在の視界の扇形
  const arc = radarFovArc(heading, fov);
  g.fillStyle = 'rgba(191,230,255,0.22)';
  g.beginPath();
  g.moveTo(cx, cy);
  g.arc(cx, cy, r, arc.from, arc.to);
  g.closePath();
  g.fill();

  // 外周と、旋回範囲の下辺
  g.strokeStyle = 'rgba(191,230,255,0.5)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, r, Math.PI, Math.PI * 2);
  g.moveTo(cx - r, cy);
  g.lineTo(cx + r, cy);
  g.stroke();

  // 敵（視界の外も点で出す。視界の中は明るく、外は少し暗く）
  const inView = (angle) => Math.abs(angle - heading) <= fov / 2;
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.type === 'decoy') { // 本体と見分けがつかないように、ボスと同じ点で描く
      bossDot(g, e, inView(e.angle));
      continue;
    }
    dot(g, e, inView(e.angle));
  }
  const boss = state.boss && !state.boss.dead && !state.boss.hidden ? state.boss : null;
  if (boss) {
    bossDot(g, boss, inView(boss.angle));
  }

  // 自機
  g.fillStyle = 'rgba(191,230,255,1)';
  g.beginPath();
  g.arc(cx, cy, 4, 0, Math.PI * 2);
  g.fill();

  g.restore();
}
