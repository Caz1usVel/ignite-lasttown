import { CONFIG } from '../core/config.js';
import { DEG } from '../core/util.js';

const CX = CONFIG.CENTER_X, CY = CONFIG.CENTER_Y;
const R = CONFIG.SPAWN_DIST + 30;

// 視界の扇形（画面上では上半分の半円）を明るく、それ以外を暗くする
export function drawFov(g) {
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  const M = CONFIG.VIRTUAL_SIZE * 3; // レターボックスの余白も暗くする
  g.rect(-M, -M, CONFIG.VIRTUAL_SIZE + 2 * M, CONFIG.VIRTUAL_SIZE + 2 * M);
  g.moveTo(CX + R, CY);
  g.arc(CX, CY, R, 0, Math.PI, true);
  g.closePath();
  g.fill('evenodd');

  const grad = g.createRadialGradient(CX, CY, 20, CX, CY, R);
  grad.addColorStop(0, 'rgba(191,230,255,0.10)');
  grad.addColorStop(1, 'rgba(191,230,255,0.02)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(CX, CY);
  g.arc(CX, CY, R, Math.PI, Math.PI * 2);
  g.closePath();
  g.fill();

  g.strokeStyle = 'rgba(191,230,255,0.35)';
  g.lineWidth = 2;
  g.setLineDash([8, 10]);
  g.beginPath();
  g.arc(CX, CY, R, Math.PI, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.strokeStyle = 'rgba(191,230,255,0.25)';
  g.beginPath();
  g.moveTo(CX - R, CY);
  g.lineTo(CX + R, CY);
  g.stroke();
}

// 旋回範囲180度の中で、今どこを向いているか（敵の情報は出さない）
export function drawHeadingGauge(g, heading, fov) {
  const gx = CX, gy = CY + 150, r = 70;
  g.save();
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(191,230,255,0.15)';
  g.beginPath();
  g.arc(gx, gy, r, -Math.PI, 0);
  g.stroke();
  const a0 = Math.max(-Math.PI, -Math.PI / 2 + (heading - fov / 2) * DEG);
  const a1 = Math.min(0, -Math.PI / 2 + (heading + fov / 2) * DEG);
  g.strokeStyle = 'rgba(255,216,102,0.85)';
  g.beginPath();
  g.arc(gx, gy, r, a0, a1);
  g.stroke();
  g.restore();
}
