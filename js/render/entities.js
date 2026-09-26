import { CONFIG } from '../core/config.js';
import { lightenColor, hexToRgba } from '../core/util.js';
import { worldToScreen } from '../core/view.js';

// 図形ベースの簡易デフォルメ（前作の drawPlayer の作り方を踏襲）。AI生成画像は使わない。
export const COLORS = {
  turret: '#bfe6ff',
  cheek: '#ffc2d1',
  barrel: '#ffd866',
  meteor: '#b08a6a',
  drone: '#9be8ff',
  minion: '#ff9ecb',
  formation: '#8dffb0',
  boss: '#8f7cff',
  bullet: '#fff6c8',
  eye: '#1b1f3a',
};

function ellipse(g, x, y, rx, ry, color) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

// CanvasRenderingContext2D#roundRect が無い環境（iOS<16 等）向けの代替パス生成。
// 呼び出し側で beginPath() 済みであること前提。
function roundRectPath(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function drawTurret(g, turret, time) {
  if (turret.invincible > 0 && Math.floor(time * 12) % 2 === 0) return; // 無敵中は点滅
  g.save();
  g.translate(CONFIG.CENTER_X, CONFIG.CENTER_Y);

  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 70);
  glow.addColorStop(0, 'rgba(191,230,255,0.35)');
  glow.addColorStop(1, 'rgba(191,230,255,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.fill();

  for (const fx of [-16, 16]) ellipse(g, fx, 24, 9, 6, lightenColor(COLORS.turret, -0.25)); // 足
  g.fillStyle = COLORS.barrel; // 砲身（常に真上）
  g.beginPath();
  roundRectPath(g, -7, -48, 14, 30, 6);
  g.fill();
  ellipse(g, 0, 0, 30, 27, COLORS.turret);                         // 体
  ellipse(g, 0, 6, 18, 13, lightenColor(COLORS.turret, 0.5));      // おなか
  for (const ex of [-10, 10]) ellipse(g, ex, -5, 3.5, 5, COLORS.eye);
  for (const ex of [-9, 11]) ellipse(g, ex, -7, 1.4, 1.4, '#ffffff');
  for (const cx of [-18, 18]) ellipse(g, cx, 3, 5, 3, COLORS.cheek);
  g.restore();
}

const METEOR_SHAPE = [1, 0.82, 0.95, 0.78, 1, 0.86, 0.92, 0.8];

function drawMeteor(g, e, x, y) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  g.rotate(e.spin + e.t * 0.8);
  g.fillStyle = COLORS.meteor;
  g.beginPath();
  METEOR_SHAPE.forEach((k, i) => {
    const a = (i / METEOR_SHAPE.length) * Math.PI * 2;
    const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  g.closePath();
  g.fill();
  const s = r / 22;
  for (const [cx, cy, cr] of [[-6, -4, 5], [7, 5, 4], [2, -10, 3]]) {
    ellipse(g, cx * s, cy * s, cr * s, cr * s, lightenColor(COLORS.meteor, -0.3));
  }
  g.restore();
}

function drawDrone(g, e, x, y, color) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  g.strokeStyle = lightenColor(color, 0.4);
  g.lineWidth = 2;
  const w = r * (0.6 + 0.4 * Math.abs(Math.sin(e.t * 30))); // プロペラ
  for (const px of [-r * 0.7, r * 0.7]) {
    g.beginPath();
    g.moveTo(px - w * 0.5, -r * 0.75);
    g.lineTo(px + w * 0.5, -r * 0.75);
    g.stroke();
  }
  ellipse(g, 0, 0, r, r * 0.55, color);
  g.fillStyle = lightenColor(color, 0.5); // ドーム
  g.beginPath();
  g.ellipse(0, -r * 0.2, r * 0.5, r * 0.4, 0, Math.PI, 0);
  g.fill();
  ellipse(g, 0, 0, r * 0.22, r * 0.22, COLORS.eye);
  ellipse(g, r * 0.07, -r * 0.07, r * 0.07, r * 0.07, '#ffffff');
  g.restore();
}

function drawShot(g, e, x, y, time) {
  const r = e.radius * (1 + 0.15 * Math.sin(time * 20));
  const grad = g.createRadialGradient(x, y, 0, x, y, r * 2);
  grad.addColorStop(0, 'rgba(255,200,160,1)');
  grad.addColorStop(0.4, 'rgba(255,122,82,0.9)');
  grad.addColorStop(1, 'rgba(255,122,82,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r * 2, 0, Math.PI * 2);
  g.fill();
}

function drawUnknown(g, e, x, y) {
  g.save();
  g.translate(x, y);
  ellipse(g, 0, 0, e.radius, e.radius, '#ff00ff');
  g.fillStyle = '#ffffff';
  g.font = "800 20px sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('？', 0, 1);
  g.restore();
}

export function drawEnemy(g, e, x, y, time) {
  if (e.type === 'meteor') drawMeteor(g, e, x, y);
  else if (e.type === 'drone') drawDrone(g, e, x, y, COLORS.drone);
  else if (e.type === 'bossMinion') drawDrone(g, e, x, y, COLORS.minion);
  else if (e.type === 'formationDrone') drawDrone(g, e, x, y, COLORS.formation);
  else if (e.type === 'enemyShot') drawShot(g, e, x, y, time);
  else drawUnknown(g, e, x, y); // 未知の種類でも、見えない敵が当たってこないように目立たせる
  if (time - (e.flashT ?? -1) < 0.08) {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.arc(x, y, e.radius, 0, Math.PI * 2);
    g.fill();
  }
}

export function drawBoss(g, boss, x, y, time) {
  const r = boss.radius;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  const bodyColor = boss.p.color ?? COLORS.boss; // 強化型は色で見分ける
  g.save();
  g.translate(x, y);
  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6);
  glow.addColorStop(0, hexToRgba(bodyColor, 0.35));
  glow.addColorStop(1, hexToRgba(bodyColor, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.6, 0, Math.PI * 2);
  g.fill();

  ellipse(g, 0, r * 0.15, r * 1.15, r * 0.45, lightenColor(bodyColor, -0.35)); // 下のリング
  ellipse(g, 0, 0, r, r * 0.6, flash ? '#ffffff' : bodyColor);                // 本体
  g.fillStyle = lightenColor(bodyColor, 0.55);                               // ドーム
  g.beginPath();
  g.ellipse(0, -r * 0.25, r * 0.5, r * 0.4, 0, Math.PI, 0);
  g.fill();
  for (let i = 0; i < 6; i++) {                                                // 回るライト
    const a = (i / 6) * Math.PI * 2 + time * 1.5;
    ellipse(g, Math.cos(a) * r * 0.8, r * 0.12 + Math.sin(a) * r * 0.25, 4, 4, i % 2 ? '#ffd866' : '#ff9ecb');
  }
  ellipse(g, 0, -r * 0.05, r * 0.2, r * 0.24, COLORS.eye);
  ellipse(g, 0, -r * 0.05, r * 0.09, r * 0.09, '#ff7a52');
  g.restore();
}

export function drawBullet(g, b, heading, fov) {
  const head = worldToScreen(b.angle, b.dist, heading, fov);
  if (!head.visible) return;
  const tail = worldToScreen(b.angle, Math.max(0, b.dist - 22), heading, fov);
  g.save();
  g.strokeStyle = COLORS.bullet;
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.shadowColor = '#ffd866';
  g.shadowBlur = 10;
  g.beginPath();
  g.moveTo(tail.x, tail.y);
  g.lineTo(head.x, head.y);
  g.stroke();
  g.restore();
}

export function drawEffects(g, fx) {
  for (const p of fx.particles) {
    const a = 1 - p.age / p.life;
    g.globalAlpha = a;
    ellipse(g, p.x, p.y, p.size * a + 1, p.size * a + 1, p.color);
  }
  g.textAlign = 'center';
  g.font = "800 22px 'M PLUS Rounded 1c', sans-serif";
  for (const p of fx.popups) {
    const t = p.age / p.life;
    g.globalAlpha = 1 - t;
    g.fillStyle = p.color;
    g.fillText(p.text, p.x, p.y - t * 36);
  }
  g.globalAlpha = 1;
}

// ボスのHPバー（仮想エリア下部。視界外にいても表示する）
export function drawBossBar(g, boss, time = 0) {
  const w = 420, h = 14, x = 500 - w / 2, y = 780;
  g.fillStyle = 'rgba(255,255,255,0.12)';
  g.beginPath();
  roundRectPath(g, x, y, w, h, 7);
  g.fill();
  const k = Math.max(0, boss.hp / boss.maxHp);
  if (k > 0) {
    g.fillStyle = '#ff9ecb';
    g.beginPath();
    roundRectPath(g, x, y, Math.max(h, w * k), h, 7);
    g.fill();
  }
  g.fillStyle = '#f4f2ff';
  g.font = "700 18px 'M PLUS Rounded 1c', sans-serif";
  g.textAlign = 'center';
  g.fillText(boss.name ?? 'ボス', 500, y - 8);
}
