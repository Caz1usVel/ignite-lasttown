// 前作から移植したパーティクル／スコア表示。座標は仮想画面座標。
export function createEffects() {
  return { particles: [], popups: [] };
}

export function spawnBurst(fx, x, y, color, count, rng = Math.random) {
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const spd = 60 + rng() * 140;
    fx.particles.push({
      x, y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      age: 0,
      life: 0.35 + rng() * 0.3,
      color,
      size: 2 + rng() * 2,
    });
  }
}

export function spawnPopup(fx, x, y, text, color) {
  fx.popups.push({ x, y, text, color, age: 0, life: 0.8 });
}

export function updateEffects(fx, dt) {
  for (const p of fx.particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  fx.particles = fx.particles.filter((p) => p.age < p.life);
  for (const p of fx.popups) p.age += dt;
  fx.popups = fx.popups.filter((p) => p.age < p.life);
}
