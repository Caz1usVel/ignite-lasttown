import { CONFIG } from '../core/config.js';
import { lightenColor, hexToRgba } from '../core/util.js';
import { worldToScreen } from '../core/view.js';

// 図形ベースの簡易デフォルメ（前作の drawPlayer の作り方を踏襲）。AI生成画像は使わない。
export const COLORS = {
  turret: '#bfe6ff',
  cheek: '#ffc2d1',
  barrel: '#ffd866',
  accent: '#5fe3d0',
  beaconDanger: '#ff4d4d',
  meteor: '#b08a6a',
  healMeteor: '#6fdc8c',
  drone: '#9be8ff',
  minion: '#ff9ecb',
  formation: '#8dffb0',
  burrower: '#b58a5a',
  thrower: '#e0a458',
  shard: '#ffb84d',
  charger: '#ff6b6b',
  bossB: '#c2418f',
  shielder: '#8fb8ff',
  teleporter: '#b18cff',
  jammer: '#7be0c3',
  jamShot: '#5fffd0',
  bossC: '#4fc3d9',
  bossD: '#ffd24a',
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

// 装甲のある回転式ガンタレット。旋回そのものは視界（FOV）側の表現なので、本体は常に正面向き。
export function drawTurret(g, turret, time, skin = null, danger = false) {
  if (turret.invincible > 0 && Math.floor(time * 12) % 2 === 0) return; // 無敵中は点滅
  const armorColor = skin?.body ?? COLORS.turret;
  const panelColor = skin?.cheek ?? COLORS.cheek;
  const beaconColor = danger ? COLORS.beaconDanger : COLORS.accent; // 空の色と連動
  g.save();
  g.translate(CONFIG.CENTER_X, CONFIG.CENTER_Y);

  const glowColor = danger ? '255,100,90' : '95,227,208';
  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 66);
  glow.addColorStop(0, `rgba(${glowColor},0.3)`);
  glow.addColorStop(1, `rgba(${glowColor},0)`);
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 66, 0, Math.PI * 2);
  g.fill();

  // 台座：防壁の上面にしっかり接地させる（接地影＋土台）
  ellipse(g, 0, 34, 40, 10, 'rgba(0,0,0,0.35)');
  g.fillStyle = lightenColor(armorColor, -0.55);
  g.beginPath();
  roundRectPath(g, -34, 18, 68, 18, 5);
  g.fill();

  // 本体（装甲）
  ellipse(g, 0, 8, 32, 22, lightenColor(armorColor, -0.2));  // 下部装甲
  ellipse(g, 0, -2, 28, 20, armorColor);                     // 上部装甲
  ellipse(g, 0, 6, 14, 8, panelColor);                       // 側面パネル（スキンの副配色）

  // アクセントライン（シアン、本体に1本）
  g.strokeStyle = COLORS.accent;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(-24, -4);
  g.lineTo(24, -4);
  g.stroke();

  // 照準窓
  ellipse(g, 0, -12, 7, 5.5, 'rgba(30,40,40,0.9)');
  ellipse(g, 0, -12, 4.5, 3.5, hexToRgba(COLORS.accent, 0.7));

  // 砲身（短め、常に真上）
  g.fillStyle = COLORS.barrel;
  g.beginPath();
  roundRectPath(g, -6, -32, 12, 20, 4);
  g.fill();
  g.fillStyle = lightenColor(armorColor, -0.3); // 砲身の付け根の帯
  g.beginPath();
  roundRectPath(g, -9, -16, 18, 6, 3);
  g.fill();

  // アンテナとビーコン（通常はシアン、危険時は赤く点灯）
  g.strokeStyle = lightenColor(armorColor, -0.4);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(20, -14);
  g.lineTo(27, -38);
  g.stroke();
  const pulse = 0.7 + 0.3 * Math.sin(time * 6);
  g.fillStyle = hexToRgba(beaconColor, 0.35 * pulse);
  g.beginPath();
  g.arc(27, -38, 7, 0, Math.PI * 2);
  g.fill();
  ellipse(g, 27, -38, 3.2, 3.2, beaconColor);

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

// 突き上げ敵：盛り上がり（土の山）→ 隆起（とげとげの岩の生き物）
function drawBurrower(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  if (e.phase === 'burrowed') {
    const shake = e.burrowT < 0.8 ? Math.sin(time * 60) * 2.5 : 0; // 隆起が近いと、ぐらぐら揺れる
    g.translate(shake, 0);
    g.fillStyle = lightenColor(COLORS.burrower, -0.2);
    g.beginPath();
    g.ellipse(0, r * 0.4, r * 1.3, r * 0.9, 0, Math.PI, 0);
    g.fill();
    for (let i = 0; i < 3; i++) { // 舞う土煙
      const px = (i - 1) * r * 0.7;
      const py = -r * 0.3 - Math.abs(Math.sin(time * 6 + i * 2)) * r * 0.6;
      ellipse(g, px, py, 2.6, 2.6, '#e6d3b0');
    }
  } else {
    g.fillStyle = lightenColor(COLORS.burrower, -0.35);
    for (let i = 0; i < 7; i++) { // とげ
      const a = (i / 7) * Math.PI * 2 + e.spin;
      g.beginPath();
      g.moveTo(Math.cos(a - 0.22) * r * 0.8, Math.sin(a - 0.22) * r * 0.8);
      g.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35);
      g.lineTo(Math.cos(a + 0.22) * r * 0.8, Math.sin(a + 0.22) * r * 0.8);
      g.closePath();
      g.fill();
    }
    ellipse(g, 0, 0, r, r * 0.92, COLORS.burrower);
    ellipse(g, 0, r * 0.2, r * 0.6, r * 0.4, lightenColor(COLORS.burrower, 0.35));
    for (const s of [-1, 1]) {
      ellipse(g, s * r * 0.35, -r * 0.2, r * 0.16, r * 0.2, '#fff3c4');
      ellipse(g, s * r * 0.35, -r * 0.16, r * 0.07, r * 0.1, COLORS.eye);
    }
  }
  g.restore();
}

// 破片飛ばし敵：砲台のような体。破片を投げる直前は、口が光る
function drawThrower(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  ellipse(g, 0, r * 0.2, r * 1.15, r * 0.5, lightenColor(COLORS.thrower, -0.35));
  ellipse(g, 0, 0, r * 0.95, r * 0.78, COLORS.thrower);
  const charging = e.phase === 'hover' && e.fireT < 0.6;
  ellipse(g, 0, r * 0.38, r * 0.36, r * 0.24, charging ? '#fff3c4' : COLORS.eye);
  if (charging) {
    const glow = g.createRadialGradient(0, r * 0.38, 0, 0, r * 0.38, r * 0.9);
    glow.addColorStop(0, 'rgba(255,243,196,0.7)');
    glow.addColorStop(1, 'rgba(255,243,196,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, r * 0.38, r * 0.9, 0, Math.PI * 2);
    g.fill();
  }
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.36, -r * 0.2, r * 0.14, r * 0.18, '#ffffff');
    ellipse(g, s * r * 0.36, -r * 0.17, r * 0.06, r * 0.09, COLORS.eye);
  }
  g.restore();
}

// 破片：くるくる回る小さなひし形
function drawShard(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  g.rotate(e.spin + time * 6);
  g.fillStyle = COLORS.shard;
  g.beginPath();
  g.moveTo(0, -r * 1.3);
  g.lineTo(r * 0.8, 0);
  g.lineTo(0, r * 1.3);
  g.lineTo(-r * 0.8, 0);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.beginPath();
  g.moveTo(0, -r * 1.3);
  g.lineTo(r * 0.3, 0);
  g.lineTo(0, -r * 0.1);
  g.closePath();
  g.fill();
  g.restore();
}

// 突進敵：静止している間（予兆）は赤く点滅して「！」を出す。突進中は、勢いの線を引く
function drawCharger(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  if (e.phase === 'wait') {
    const pulse = 0.5 + 0.5 * Math.sin(time * 24);
    const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2);
    glow.addColorStop(0, `rgba(255,80,80,${(0.35 + 0.35 * pulse).toFixed(2)})`);
    glow.addColorStop(1, 'rgba(255,80,80,0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(0, 0, r * 2.2, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = 'rgba(255,160,160,0.55)';
    g.lineWidth = 3;
    for (const s of [-1, 0, 1]) {
      g.beginPath();
      g.moveTo(s * r * 0.5, -r * 1.2);
      g.lineTo(s * r * 0.5, -r * 2.4);
      g.stroke();
    }
  }
  g.fillStyle = lightenColor(COLORS.charger, -0.3);
  for (const s of [-1, 1]) { // 角
    g.beginPath();
    g.moveTo(s * r * 0.3, -r * 0.7);
    g.lineTo(s * r * 0.75, -r * 1.3);
    g.lineTo(s * r * 0.75, -r * 0.4);
    g.closePath();
    g.fill();
  }
  ellipse(g, 0, 0, r, r * 0.9, e.phase === 'wait' && Math.floor(time * 12) % 2 === 0 ? '#ffffff' : COLORS.charger);
  for (const s of [-1, 1]) { // 怒った目
    ellipse(g, s * r * 0.36, -r * 0.1, r * 0.2, r * 0.14, '#fff3c4');
    ellipse(g, s * r * 0.36, -r * 0.08, r * 0.08, r * 0.08, COLORS.eye);
  }
  if (e.phase === 'wait') {
    g.fillStyle = '#ffffff';
    g.font = "800 22px 'M PLUS Rounded 1c', sans-serif";
    g.textAlign = 'center';
    g.fillText('！', 0, -r * 1.5);
  }
  g.restore();
}

// シールド敵：丸い体と、正面（中心側＝画面の下）に広がる盾。盾は残りの耐久の数だけ弧が残り、3発で壊れて消える
function drawShielder(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  ellipse(g, 0, 0, r * 0.9, r * 0.8, COLORS.shielder);
  ellipse(g, 0, r * 0.15, r * 0.55, r * 0.4, lightenColor(COLORS.shielder, 0.4));
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.3, -r * 0.2, r * 0.13, r * 0.17, '#ffffff');
    ellipse(g, s * r * 0.3, -r * 0.17, r * 0.06, r * 0.08, COLORS.eye);
  }
  if (e.shielded) {
    const hits = e.shieldHp ?? 3;
    const k = Math.max(1, hits) / 3; // 残りの耐久：1.0（3発）〜0.33（1発）
    g.strokeStyle = `rgba(143,184,255,${(0.4 + 0.5 * k).toFixed(2)})`;
    g.lineWidth = 3 + 3 * k;
    // 下側（中心側）に、残りの耐久の数だけ弧の盾を並べる
    const seg = (Math.PI * 0.7) / 3;
    for (let i = 0; i < hits; i++) {
      const a0 = Math.PI * 0.15 + seg * i + 0.03;
      g.beginPath();
      g.arc(0, r * 0.1, r * 1.35, a0, a0 + seg - 0.06);
      g.stroke();
    }
    g.fillStyle = `rgba(143,184,255,${(0.08 + 0.14 * k).toFixed(2)})`;
    g.beginPath();
    g.moveTo(0, r * 0.1);
    g.arc(0, r * 0.1, r * 1.35, Math.PI * 0.15, Math.PI * 0.85);
    g.closePath();
    g.fill();
  }
  g.restore();
}

// テレポート敵：ふわふわした体。移動の予兆で点滅・半透明になり、移動した直後は光る輪が広がる
function drawTeleporter(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  if (e.warpFlash > 0) {
    g.strokeStyle = `rgba(200,170,255,${(e.warpFlash / 0.3).toFixed(2)})`;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(0, 0, r * (1.2 + (0.3 - e.warpFlash) * 6), 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = e.warn ? (Math.floor(time * 24) % 2 === 0 ? 0.25 : 0.7) : 1;
  ellipse(g, 0, 0, r, r * 0.9, COLORS.teleporter);
  ellipse(g, 0, r * 0.2, r * 0.6, r * 0.42, lightenColor(COLORS.teleporter, 0.4));
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.3, -r * 0.15, r * 0.14, r * 0.18, '#ffffff');
    ellipse(g, s * r * 0.3, -r * 0.12, r * 0.06, r * 0.09, COLORS.eye);
  }
  g.restore();
}

// 妨害電波敵：パラボラのような皿を載せた体。電波を出す直前は、皿のまわりに輪が広がる
function drawJammer(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  ellipse(g, 0, r * 0.2, r * 0.95, r * 0.6, lightenColor(COLORS.jammer, -0.3));
  ellipse(g, 0, 0, r * 0.8, r * 0.7, COLORS.jammer);
  g.fillStyle = lightenColor(COLORS.jammer, 0.35); // 皿
  g.beginPath();
  g.ellipse(0, r * 0.45, r * 0.55, r * 0.3, 0, 0, Math.PI);
  g.fill();
  const charging = e.phase === 'hover' && e.fireT < 0.8;
  if (charging) {
    const k = 1 - e.fireT / 0.8;
    g.strokeStyle = `rgba(95,255,208,${(0.8 * (1 - k)).toFixed(2)})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, r * 0.45, r * (0.6 + k * 1.0), 0, Math.PI * 2);
    g.stroke();
  }
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.28, -r * 0.2, r * 0.13, r * 0.17, '#ffffff');
    ellipse(g, s * r * 0.28, -r * 0.17, r * 0.06, r * 0.08, COLORS.eye);
  }
  g.restore();
}

// 妨害電波（jamShot）：同心円の波
function drawJamShot(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  g.strokeStyle = COLORS.jamShot;
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    g.globalAlpha = 1 - i * 0.28;
    g.beginPath();
    g.arc(0, 0, r * (0.45 + 0.4 * i + 0.1 * Math.sin(time * 14 + i)), 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

// ボスCの体（本体と偽像で共用）。見分けがつかないように、同じ描き方にする
function drawBossCBody(g, r, color, time, opts = {}) {
  const { flash = false, swapBlink = false } = opts;
  g.save();
  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.6);
  glow.addColorStop(0, hexToRgba(color, 0.35));
  glow.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.6, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = swapBlink && Math.floor(time * 20) % 2 === 0 ? 0.35 : 1;
  g.fillStyle = lightenColor(color, -0.35); // 頭の飾り（アンテナ）
  for (const s of [-1, 0, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.35 - r * 0.08, -r * 0.6);
    g.lineTo(s * r * 0.35, -r * (s === 0 ? 1.15 : 0.95));
    g.lineTo(s * r * 0.35 + r * 0.08, -r * 0.6);
    g.closePath();
    g.fill();
  }
  ellipse(g, 0, 0, r, r * 0.8, flash ? '#ffffff' : color);
  ellipse(g, 0, r * 0.22, r * 0.62, r * 0.4, lightenColor(color, 0.45));
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.3, -r * 0.18, r * 0.14, r * 0.18, '#eaffff');
    ellipse(g, s * r * 0.3, -r * 0.15, r * 0.06, r * 0.09, COLORS.eye);
  }
  g.strokeStyle = COLORS.eye;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-r * 0.22, r * 0.32);
  g.lineTo(r * 0.22, r * 0.32);
  g.stroke();
  g.restore();
}

function drawDecoy(g, e, x, y, time, swapBlink) {
  g.save();
  g.translate(x, y);
  if (e.style === 'bossD') drawBossDBody(g, e.radius, e.color ?? COLORS.bossD, time);
  else drawBossCBody(g, e.radius, e.color ?? COLORS.bossC, time, { swapBlink });
  g.restore();
}

function drawBossC(g, boss, x, y, time) {
  const r = boss.radius;
  const color = boss.color ?? boss.p.color ?? COLORS.bossC;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  g.save();
  g.translate(x, y);
  drawBossCBody(g, r, color, time, { flash, swapBlink: boss.phase === 'swap' });
  if (boss.shielded) { // シールドのバブル（本体だけ）
    g.strokeStyle = 'rgba(143,184,255,0.9)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(0, 0, r * 1.25, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(143,184,255,0.18)';
    g.beginPath();
    g.arc(0, 0, r * 1.25, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// 最終ボスの体（本体と偽像で共用）：ボスBの角・ボスCの3本の飾り・ボスAのような大きな目を合わせた、金色の体
function drawBossDBody(g, r, color, time, opts = {}) {
  const { flash = false, warn = false, roar = false } = opts;
  g.save();
  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8);
  glow.addColorStop(0, hexToRgba(color, 0.4));
  glow.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  g.fill();
  const pulse = warn ? 1 + 0.06 * Math.sin(time * 40) : roar ? 1.08 : 1;
  g.scale(pulse, pulse);
  g.fillStyle = lightenColor(color, -0.4); // 角（ボスB）
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.35, -r * 0.55);
    g.lineTo(s * r * 0.95, -r * 1.1);
    g.lineTo(s * r * 0.62, -r * 0.3);
    g.closePath();
    g.fill();
  }
  g.fillStyle = lightenColor(color, -0.2); // 冠の飾り（ボスC）
  for (const s of [-1, 0, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.22 - r * 0.07, -r * 0.7);
    g.lineTo(s * r * 0.22, -r * (s === 0 ? 1.25 : 1.05));
    g.lineTo(s * r * 0.22 + r * 0.07, -r * 0.7);
    g.closePath();
    g.fill();
  }
  const blink = warn && Math.floor(time * 16) % 2 === 0;
  ellipse(g, 0, 0, r, r * 0.82, flash ? '#ffffff' : blink ? '#ff4d4d' : color);
  ellipse(g, 0, r * 0.24, r * 0.64, r * 0.4, lightenColor(color, 0.45));
  ellipse(g, 0, -r * 0.16, r * 0.34, r * 0.26, '#fff6d0'); // 大きな目（ボスA）
  ellipse(g, 0, -r * 0.14, r * 0.15, r * 0.15, COLORS.eye);
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.5, -r * 0.12, r * 0.1, r * 0.13, '#fff6d0');
    ellipse(g, s * r * 0.5, -r * 0.1, r * 0.045, r * 0.06, COLORS.eye);
  }
  if (roar) {
    ellipse(g, 0, r * 0.38, r * 0.32, r * 0.24, COLORS.eye);
  } else {
    g.strokeStyle = COLORS.eye;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-r * 0.25, r * 0.36);
    g.lineTo(r * 0.25, r * 0.36);
    g.stroke();
  }
  g.restore();
}

function drawBossD(g, boss, x, y, time) {
  if (boss.hidden) return;
  const color = boss.color ?? boss.p.color ?? COLORS.bossD;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  g.save();
  g.translate(x, y);
  drawBossDBody(g, boss.radius, color, time, { flash, warn: boss.phase === 'telegraph', roar: boss.phase === 'roar' });
  g.restore();
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

// 回復の隕石：緑色の丸い石に、ハートが光る。撃つと体力が1回復する
function drawHealMeteor(g, e, x, y, time) {
  const r = e.radius;
  g.save();
  g.translate(x, y);
  const pulse = 1 + 0.08 * Math.sin(time * 6);
  const glow = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
  glow.addColorStop(0, 'rgba(111,220,140,0.45)');
  glow.addColorStop(1, 'rgba(111,220,140,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.9 * pulse, 0, Math.PI * 2);
  g.fill();
  g.rotate(e.spin + e.t * 0.5);
  g.fillStyle = COLORS.healMeteor;
  g.beginPath();
  METEOR_SHAPE.forEach((k, i) => {
    const a = (i / METEOR_SHAPE.length) * Math.PI * 2;
    const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  g.closePath();
  g.fill();
  g.rotate(-(e.spin + e.t * 0.5)); // ハートは回転させない
  g.fillStyle = '#ffffff';
  g.font = `800 ${Math.round(r * 1.1)}px sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('♥', 0, 1);
  g.restore();
}

export function drawEnemy(g, e, x, y, time) {
  if (e.type === 'meteor') drawMeteor(g, e, x, y);
  else if (e.type === 'healMeteor') drawHealMeteor(g, e, x, y, time);
  else if (e.type === 'drone') drawDrone(g, e, x, y, COLORS.drone);
  else if (e.type === 'bossMinion') drawDrone(g, e, x, y, COLORS.minion);
  else if (e.type === 'formationDrone') drawDrone(g, e, x, y, COLORS.formation);
  else if (e.type === 'burrower') drawBurrower(g, e, x, y, time);
  else if (e.type === 'thrower') drawThrower(g, e, x, y, time);
  else if (e.type === 'shard') drawShard(g, e, x, y, time);
  else if (e.type === 'charger') drawCharger(g, e, x, y, time);
  else if (e.type === 'shielder') drawShielder(g, e, x, y, time);
  else if (e.type === 'teleporter') drawTeleporter(g, e, x, y, time);
  else if (e.type === 'jammer') drawJammer(g, e, x, y, time);
  else if (e.type === 'jamShot') drawJamShot(g, e, x, y, time);
  else if (e.type === 'decoy') drawDecoy(g, e, x, y, time, e.swapBlink === true);
  else if (e.type === 'enemyShot') drawShot(g, e, x, y, time);
  else drawUnknown(g, e, x, y); // 未知の種類でも、見えない敵が当たってこないように目立たせる
  if (time - (e.flashT ?? -1) < 0.08) {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath();
    g.arc(x, y, e.radius, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBossA(g, boss, x, y, time) {
  const r = boss.radius;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  const bodyColor = boss.color ?? boss.p.color ?? COLORS.boss; // 強化型は色で見分ける
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

// ボスB：角のある大きな体。予兆の間は赤く点滅し、咆哮の間は口を開けて膨らむ。消えている間は描かない
function drawBossB(g, boss, x, y, time) {
  if (boss.hidden) return;
  const r = boss.radius;
  const bodyColor = boss.color ?? boss.p.color ?? COLORS.bossB;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  const warn = boss.phase === 'telegraph';
  const roar = boss.phase === 'roar';
  g.save();
  g.translate(x, y);

  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.7);
  glow.addColorStop(0, hexToRgba(bodyColor, 0.35));
  glow.addColorStop(1, hexToRgba(bodyColor, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.7, 0, Math.PI * 2);
  g.fill();

  const pulse = warn ? 1 + 0.06 * Math.sin(time * 40) : roar ? 1.08 : 1;
  g.scale(pulse, pulse);

  g.fillStyle = lightenColor(bodyColor, -0.4); // 角
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.35, -r * 0.55);
    g.lineTo(s * r * 0.9, -r * 1.05);
    g.lineTo(s * r * 0.62, -r * 0.3);
    g.closePath();
    g.fill();
  }
  const blink = warn && Math.floor(time * 16) % 2 === 0;
  ellipse(g, 0, 0, r, r * 0.8, flash ? '#ffffff' : blink ? '#ff4d4d' : bodyColor);
  ellipse(g, 0, r * 0.22, r * 0.62, r * 0.4, lightenColor(bodyColor, 0.45));
  for (const s of [-1, 1]) { // 光る目
    ellipse(g, s * r * 0.3, -r * 0.2, r * 0.14, r * 0.18, '#ffeb99');
    ellipse(g, s * r * 0.3, -r * 0.17, r * 0.06, r * 0.09, COLORS.eye);
  }
  if (roar) {
    ellipse(g, 0, r * 0.32, r * 0.34, r * 0.26, COLORS.eye);
  } else {
    g.strokeStyle = COLORS.eye;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-r * 0.25, r * 0.3);
    g.lineTo(r * 0.25, r * 0.3);
    g.stroke();
  }
  g.restore();
}

// ボスの種類 → 描画関数。表に無い種類は、目立つ代わりの図形（見えないボスが当たってくるのを防ぐ）
const BOSS_DRAWERS = {
  bossA: drawBossA,
  bossB: drawBossB,
  bossC: drawBossC,
  bossD: drawBossD,
};

export function drawBoss(g, boss, x, y, time) {
  const draw = BOSS_DRAWERS[boss.type];
  if (draw) draw(g, boss, x, y, time);
  else drawUnknown(g, { radius: boss.radius ?? 56 }, x, y);
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
  const w = 420, h = 14, x = 500 - w / 2, y = 975;
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
  // ボスBの突進の予兆：消えてから再出現するまで、警告を点滅させる
  if (boss.phase === 'telegraph' || boss.phase === 'vanish' || boss.phase === 'settle') {
    g.fillStyle = Math.floor(time * 8) % 2 === 0 ? '#ff6b6b' : '#ffd866';
    g.font = "800 22px 'M PLUS Rounded 1c', sans-serif";
    g.fillText('⚠ 視界の外から突進！', 500, 790);
  }
}

// 妨害中の表示（自機の近く）。攻撃が使えないことを知らせる
export function drawJamNotice(g, time) {
  g.save();
  g.globalAlpha = 0.6 + 0.4 * Math.sin(time * 16);
  g.fillStyle = '#5fffd0';
  g.font = "800 26px 'M PLUS Rounded 1c', sans-serif";
  g.textAlign = 'center';
  g.fillText('⚡ 妨害中', 500, 820);
  g.restore();
}
