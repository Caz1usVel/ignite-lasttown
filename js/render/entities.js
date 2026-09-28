import { CONFIG } from '../core/config.js';
import { lightenColor, hexToRgba, DEG } from '../core/util.js';
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

// 角を斜めに落とした八角形（装甲の台座など、丸くない・機械的な見た目に使う）
function octagon(g, cx, cy, w, h, color, strokeColor = null) {
  const cut = Math.min(w, h) * 0.4;
  g.beginPath();
  g.moveTo(cx - w + cut, cy - h);
  g.lineTo(cx + w - cut, cy - h);
  g.lineTo(cx + w, cy - h + cut);
  g.lineTo(cx + w, cy + h - cut);
  g.lineTo(cx + w - cut, cy + h);
  g.lineTo(cx - w + cut, cy + h);
  g.lineTo(cx - w, cy + h - cut);
  g.lineTo(cx - w, cy - h + cut);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  if (strokeColor) {
    g.strokeStyle = strokeColor;
    g.lineWidth = 1.5;
    g.stroke();
  }
}

// 砲身の付け根から常時立ち上る、金色の粒子（クリムゾン・ヴァンガード専用）。持続する状態を持たず、time だけから計算する。
function drawEmberParticles(g, time, x, y) {
  const N = 5;
  for (let i = 0; i < N; i++) {
    const phase = (time * 0.6 + i / N) % 1;
    const px = x + Math.sin(phase * Math.PI * 2 * 1.3 + i * 2.1) * 5;
    const py = y - phase * 26;
    const alpha = 1 - phase;
    const size = 1.4 + (1 - phase) * 1.6;
    g.fillStyle = hexToRgba('#ffcf4d', 0.75 * alpha);
    g.beginPath();
    g.arc(px, py, size, 0, Math.PI * 2);
    g.fill();
  }
}

// 本体周りに間欠的に弾ける、電気の火花（ヴァイオレット・サンダー（仮称）専用）。
// 持続する状態を持たず、time だけから計算する：出現位置ごとに違う周期・位相の三角波を使い、
// ほとんどの時間は非表示、短い間だけ「パチッ」と光ることで、常時ではなく間欠的に見せる。
function drawSparkBursts(g, time, x, y) {
  const N = 4;
  for (let i = 0; i < N; i++) {
    const cycle = 0.9 + i * 0.37;
    const cycleIndex = Math.floor(time / cycle);
    const phase = (time / cycle) % 1;
    if (phase > 0.08) continue; // 火花が見えるのは、周期のごく短い間だけ
    const flash = 1 - phase / 0.08;
    const angle = i * 1.7 + cycleIndex * 2.3; // 発生ごとに、向きも変わって見える
    const dist = 22 + (i % 2) * 6;
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist * 0.6;
    g.strokeStyle = hexToRgba('#f0f0ff', flash);
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(px - 3, py - 3);
    g.lineTo(px + 2, py);
    g.lineTo(px - 1, py + 1);
    g.lineTo(px + 3, py + 3);
    g.stroke();
  }
}

// 菱形のランプ（丸いアンテナ球の代わり。点灯色を切り替えて使う）
function diamond(g, cx, cy, w, h, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx, cy - h);
  g.lineTo(cx + w, cy);
  g.lineTo(cx, cy + h);
  g.lineTo(cx - w, cy);
  g.closePath();
  g.fill();
}

// 装甲のある回転式ガンタレット。旋回そのものは視界（FOV）側の表現なので、本体は常に正面向き。
export function drawTurret(g, turret, time, skin = null, danger = false) {
  if (turret.invincible > 0 && Math.floor(time * 12) % 2 === 0) return; // 無敵中は点滅
  const armorColor = skin?.body ?? COLORS.turret;
  const panelColor = skin?.cheek ?? COLORS.cheek;
  const trimColor = skin?.trim ?? null;
  const accentColor = skin?.accent ?? COLORS.accent;
  const vanguard = skin?.fx?.crimsonVanguard === true; // クリムゾン・ヴァンガード（仮称）の専用演出
  const thunder = skin?.fx?.violetThunder === true; // ヴァイオレット・サンダー（仮称）の専用演出
  // ビーコン：通常はシアン（この特別スキンだけ金）。危険時は赤（この特別スキンだけ、より強い紅で速く点滅）
  const beaconNormal = vanguard ? '#ffcf4d' : accentColor;
  const beaconDanger = vanguard ? '#ff1f3d' : COLORS.beaconDanger;
  const beaconColor = danger ? beaconDanger : beaconNormal;
  // ヴァイオレット・サンダーのビーコンは、一定間隔ではなく稲妻のように不規則に明滅する
  // （周期の違う2つの波を掛け合わせ、状態を持たずに不規則な点灯パターンを作る）
  const pulse = thunder
    ? 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * 23.7)) * (0.5 + 0.5 * Math.sin(time * 5.3 + 2.1))
    : 0.7 + 0.3 * Math.sin(time * (danger && vanguard ? 12 : 6));
  g.save();
  g.translate(CONFIG.CENTER_X, CONFIG.CENTER_Y);

  // 周囲のグロー・接地影：完全固定（transformを一切持たない静的な要素。旋回では動かさない）
  const glowColor = danger ? '255,100,90' : '95,227,208';
  const glow = g.createRadialGradient(0, -10, 10, 0, -10, 60);
  glow.addColorStop(0, `rgba(${glowColor},0.28)`);
  glow.addColorStop(1, `rgba(${glowColor},0)`);
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, -10, 60, 0, Math.PI * 2);
  g.fill();
  ellipse(g, 0, 34, 40, 9, 'rgba(0,0,0,0.35)'); // 接地影

  // 土台（完全固定）：角ばった台座・下段の装甲・首元のパネル。ここに、側面パネル・アクセントライン・
  // ビーコンも乗せる（頭部の回転には巻き込まない、目立たない大きさにする）。
  octagon(g, 0, 22, 34, 14, lightenColor(armorColor, -0.55), trimColor); // 台座
  g.fillStyle = lightenColor(armorColor, -0.15);
  g.beginPath();
  roundRectPath(g, -30, 2, 60, 24, 3); // 下段の装甲
  g.fill();
  g.fillStyle = armorColor;
  g.beginPath();
  roundRectPath(g, -22, -14, 44, 16, 3); // 首元（ドーム状の頭部を受ける、固定のパネル）
  g.fill();
  if (trimColor) { // 金縁（クリムゾン・ヴァンガード（仮称）専用。それ以外のスキンは縁取りしない）
    g.strokeStyle = trimColor;
    g.lineWidth = 1.5;
    g.stroke();
  }

  // 側面パネル（スキンの副配色。目立たない小さな帯）
  g.fillStyle = panelColor;
  g.beginPath();
  roundRectPath(g, -13, -4, 26, 5, 2);
  g.fill();

  // アクセントライン（通常はシアン。クリムゾン・ヴァンガードは紅で常時発光。ヴァイオレット・サンダーは
  // 白い稲妻模様のジグザグ線で常時発光。目立たない長さに縮小）
  g.strokeStyle = accentColor;
  g.lineWidth = 2;
  if (vanguard || thunder) {
    g.shadowColor = accentColor;
    g.shadowBlur = 8 + 4 * Math.sin(time * 4);
  }
  g.beginPath();
  if (thunder) {
    g.moveTo(-18, -9);
    g.lineTo(-9, -6);
    g.lineTo(-3, -11);
    g.lineTo(5, -6);
    g.lineTo(1, -11);
    g.lineTo(18, -9);
  } else {
    g.moveTo(-18, -9);
    g.lineTo(18, -9);
  }
  g.stroke();
  g.shadowBlur = 0;

  if (thunder) drawSparkBursts(g, time, 0, -6); // 本体周りに、間欠的に弾ける電気の火花

  // ビーコン（丸いアンテナ球ではなく、菱形のランプ。土台に固定）
  g.fillStyle = hexToRgba(beaconColor, 0.32 * pulse);
  g.beginPath();
  g.arc(16, -9, danger && vanguard ? 10 : 7, 0, Math.PI * 2); // 光の暈
  g.fill();
  diamond(g, 16, -9, 4.5, 4.5, beaconColor);

  // 頭部（丸みのあるドーム）＋砲身＋照準窓：この一式だけを、ドームの中心（transform-origin）を軸に、
  // 旋回角度（-90〜+90度）でその場を回転させる。箱型ではなくドームなので、大きく傾いても
  // 「倒れた」印象にならず、旋回として見える。
  const DOME_CY = -14; // ドームの底面（首元パネルの上端）＝回転の軸
  const DOME_R = 17;
  g.save();
  g.translate(0, DOME_CY);
  g.rotate((turret.heading ?? 0) * DEG);
  g.translate(0, -DOME_CY);

  // 完全な円（半円ではない）：どの旋回角度でも同じ見た目になり、扇形に欠けて見えることが無い
  g.fillStyle = armorColor;
  g.beginPath();
  g.arc(0, DOME_CY, DOME_R, 0, Math.PI * 2);
  g.fill();
  if (trimColor) {
    g.strokeStyle = trimColor;
    g.lineWidth = 1.2;
    g.stroke();
  }
  // 内側の模様も、円に合わせて同心円にする（ハイライトの円＋中央寄りの丸い照準窓）
  ellipse(g, 0, DOME_CY, DOME_R * 0.62, DOME_R * 0.62, lightenColor(armorColor, 0.18));
  const domeTopY = DOME_CY - DOME_R;
  const windowCY = DOME_CY - DOME_R * 0.4;
  ellipse(g, 0, windowCY, DOME_R * 0.32, DOME_R * 0.32, 'rgba(20,30,30,0.9)'); // 照準窓（丸）
  ellipse(g, 0, windowCY, DOME_R * 0.2, DOME_R * 0.2, hexToRgba(accentColor, 0.75));

  g.fillStyle = COLORS.barrel; // 砲身（短く太い、角ばった箱）
  g.beginPath();
  roundRectPath(g, -7, domeTopY - 20, 14, 20, 2);
  g.fill();
  g.fillStyle = lightenColor(COLORS.barrel, -0.3); // 銃口
  g.beginPath();
  roundRectPath(g, -7, domeTopY - 20, 14, 4, 1);
  g.fill();

  if (vanguard) drawEmberParticles(g, time, 0, domeTopY); // 砲身の付け根から立ち上る金の粒子

  g.restore(); // 頭部（ドーム＋砲身＋照準窓）
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

export function drawBullet(g, b, heading, fov, skin = null) {
  const head = worldToScreen(b.angle, b.dist, heading, fov);
  if (!head.visible) return;
  const tail = worldToScreen(b.angle, Math.max(0, b.dist - 22), heading, fov);
  const vanguard = skin?.fx?.crimsonVanguard === true;
  const thunder = skin?.fx?.violetThunder === true;
  g.save();
  if (thunder) {
    // ジグザグの稲妻型の弾。進行方向に垂直な向きへ振れさせてジグザグを作り、
    // 主の稲妻本体の外側にもう1本、薄紫の細いアークを纏わせる（ヴァイオレット・サンダー（仮称）専用）
    const dx = head.x - tail.x, dy = head.y - tail.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const steps = 4;
    const zigzagPath = (jagSign) => {
      g.beginPath();
      g.moveTo(tail.x, tail.y);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = tail.x + dx * t, py = tail.y + dy * t;
        const jag = (i % 2 === 0 ? 1 : -1) * jagSign;
        g.lineTo(px + nx * jag, py + ny * jag);
      }
      g.lineTo(head.x, head.y);
    };
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(177,140,255,0.6)'; // 外側の細いアーク
    g.lineWidth = 1.5;
    zigzagPath(-6);
    g.stroke();
    g.strokeStyle = '#e8e8ff'; // 稲妻本体
    g.lineWidth = 3;
    g.shadowColor = '#b18cff';
    g.shadowBlur = 12;
    zigzagPath(4);
    g.stroke();
  } else if (vanguard) {
    // 紅と金のグラデーションで燃える彗星のような弾（クリムゾン・ヴァンガード（仮称）専用）
    const grad = g.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, 'rgba(200,30,50,0)');
    grad.addColorStop(0.5, '#c81e3a');
    grad.addColorStop(1, '#ffd24a');
    g.strokeStyle = grad;
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.shadowColor = '#ffb347';
    g.shadowBlur = 14;
    g.beginPath();
    g.moveTo(tail.x, tail.y);
    g.lineTo(head.x, head.y);
    g.stroke();
    ellipse(g, head.x, head.y, 4, 4, '#fff3c4'); // 燃える先端
  } else {
    g.strokeStyle = COLORS.bullet;
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.shadowColor = '#ffd866';
    g.shadowBlur = 10;
    g.beginPath();
    g.moveTo(tail.x, tail.y);
    g.lineTo(head.x, head.y);
    g.stroke();
  }
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
