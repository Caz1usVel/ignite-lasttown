// 前作から移植した星空。画面全体（CSSピクセル空間）に描く。
export function createStarfield(rng = Math.random, count = 140) {
  return Array.from({ length: count }, () => ({
    x: rng(),
    y: rng(),
    r: rng() * 1.6 + 0.4,
    tw: rng() * Math.PI * 2,
    speed: 0.004 + rng() * 0.01,
  }));
}

// shift：旋回に合わせた横スクロール量（画面幅に対する割合）
export function drawBackground(g, stars, w, h, dt, shift = 0) {
  g.fillStyle = '#0a0e27';
  g.fillRect(0, 0, w, h);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(20,26,61,0.9)');
  grad.addColorStop(1, 'rgba(10,14,39,0.2)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  for (const s of stars) {
    s.tw += dt * 2;
    s.y += s.speed * dt;
    if (s.y > 1.02) { s.y = -0.02; s.x = Math.random(); }
    const a = 0.3 + (0.5 + Math.sin(s.tw) * 0.5) * 0.7;
    const x = (((s.x + shift) % 1) + 1) % 1;
    g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
    g.beginPath();
    g.arc(x * w, s.y * h, s.r, 0, Math.PI * 2);
    g.fill();
  }
}
