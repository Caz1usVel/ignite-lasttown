// 荒野の背景（防壁の上から見た構図）。画面全体（CSSピクセル空間）に描く。
// 関数名・app.stars という呼び名は前作（星空）から引き継いだままだが、内容は荒野の装飾（岩・枯れ木・廃墟）。
// 旋回しても背景は動かさない（固定した1枚の絵）。向きは砲身の傾きで表す（entities.js の drawTurret）。
export function createStarfield(rng = Math.random, count = 22) {
  return {
    time: 0,
    ruins: Array.from({ length: 5 }, () => ({
      x: rng(),
      w: 0.05 + rng() * 0.05,
      h: 0.05 + rng() * 0.08,
      teeth: 3 + Math.floor(rng() * 3),
      jag: rng(),
    })),
    props: Array.from({ length: count }, () => ({
      x: rng(),
      depth: rng(),          // 0 = 手前（大きい）、1 = 地平線付近（小さい）
      kind: rng() < 0.55 ? 'rock' : 'tree',
      scale: 0.7 + rng() * 0.6,
      sway: rng() * Math.PI * 2,
    })),
    cracks: Array.from({ length: 8 }, () => ({
      x: rng(), y: rng(), len: 0.05 + rng() * 0.09, ang: rng() * Math.PI,
    })),
  };
}

// danger：赤空に切り替える（例：ボス出現中）
export function drawBackground(g, scenery, w, h, dt, danger = false) {
  scenery.time += dt;
  const horizonY = h * 0.5;
  const groundY = h * 0.86; // このY以下が防壁の通路面

  // 空（危険時は赤空）
  const sky = g.createLinearGradient(0, 0, 0, horizonY);
  if (danger) {
    sky.addColorStop(0, '#3a0d10');
    sky.addColorStop(1, '#9a3a24');
  } else {
    sky.addColorStop(0, '#0a1a33');
    sky.addColorStop(1, '#3f6a94');
  }
  g.fillStyle = sky;
  g.fillRect(0, 0, w, horizonY);

  const glow = g.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, w * 0.55);
  glow.addColorStop(0, danger ? 'rgba(255,140,90,0.35)' : 'rgba(190,225,255,0.25)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, horizonY);

  // 崩れた高層建造物のシルエット（地平線の少し奥、薄く）
  g.fillStyle = 'rgba(10,10,20,0.4)';
  for (const r of scenery.ruins) {
    const x = r.x * w;
    const rw = r.w * w, rh = r.h * h;
    g.beginPath();
    g.moveTo(x, horizonY);
    for (let i = 0; i <= r.teeth; i++) {
      const tx = x + (rw * i) / r.teeth;
      const ty = horizonY - rh * (0.4 + 0.6 * Math.abs(Math.sin(r.jag * 10 + i * 1.7)));
      g.lineTo(tx, i === 0 || i === r.teeth ? horizonY : ty);
      if (i > 0 && i < r.teeth) g.lineTo(tx, horizonY - rh * 0.15);
    }
    g.lineTo(x + rw, horizonY);
    g.closePath();
    g.fill();
  }

  // 荒野（ひび割れた乾いた大地）
  const ground = g.createLinearGradient(0, horizonY, 0, groundY);
  ground.addColorStop(0, '#8a7355');
  ground.addColorStop(1, '#4a3a26');
  g.fillStyle = ground;
  g.fillRect(0, horizonY, w, groundY - horizonY);

  g.strokeStyle = 'rgba(30,22,12,0.35)';
  g.lineWidth = 1.5;
  for (const c of scenery.cracks) {
    const x = c.x * w;
    const y = horizonY + c.y * (groundY - horizonY);
    const len = c.len * w;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(c.ang) * len, y + Math.sin(c.ang) * len * 0.4);
    g.stroke();
  }

  // 枯れ木・岩（奥ほど小さく、手前ほど大きく。既存の遠近表現と同じ考え方）
  const sorted = [...scenery.props].sort((a, b) => b.depth - a.depth);
  for (const p of sorted) {
    const x = p.x * w;
    const y = horizonY + (1 - p.depth) * (groundY - horizonY) * 0.92;
    const size = (h * 0.05) * (0.4 + (1 - p.depth) * 1.1) * p.scale;
    if (p.kind === 'rock') {
      g.fillStyle = 'rgba(50,40,30,0.6)';
      g.beginPath();
      g.moveTo(x - size, y);
      g.lineTo(x - size * 0.5, y - size * 0.7);
      g.lineTo(x + size * 0.4, y - size * 0.9);
      g.lineTo(x + size, y);
      g.closePath();
      g.fill();
    } else {
      const sway = Math.sin(scenery.time * 0.5 + p.sway) * size * 0.12;
      g.strokeStyle = 'rgba(40,30,20,0.65)';
      g.lineWidth = Math.max(1, size * 0.12);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - size * 1.3);
      g.moveTo(x, y - size * 0.9);
      g.lineTo(x - size * 0.6 + sway, y - size * 1.5);
      g.moveTo(x, y - size * 1.1);
      g.lineTo(x + size * 0.55 + sway, y - size * 1.6);
      g.stroke();
    }
  }

  // 防壁の通路面（一番手前）と、低い胸壁（銃眼のような凹凸）
  const rampart = g.createLinearGradient(0, groundY, 0, h);
  rampart.addColorStop(0, '#5a5a62');
  rampart.addColorStop(1, '#33333a');
  g.fillStyle = rampart;
  g.fillRect(0, groundY, w, h - groundY);

  const toothH = (h - groundY) * 0.55;
  const unit = w / 16;
  g.fillStyle = '#484850';
  for (let i = 0; i < 16; i += 2) {
    g.fillRect(i * unit, groundY - toothH, unit * 0.62, toothH);
  }
}
