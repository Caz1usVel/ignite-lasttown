import { worldToScreen } from '../core/view.js';
import { drawBackground } from './background.js';
import { drawFov, drawHeadingGauge } from './fov.js';
import { drawTurret, drawEnemy, drawBoss, drawBullet, drawEffects, drawBossBar } from './entities.js';

export function drawPlayfield(g, vp, stars, state, fx, dt) {
  const t = state.turret;
  vp.screenSpace(g);
  drawBackground(g, stars, vp.cssW, vp.cssH, dt, -t.heading / 360);

  vp.virtualSpace(g);
  drawFov(g);
  for (const e of state.enemies) {
    const p = worldToScreen(e.angle, e.dist, t.heading, t.fov);
    if (p.visible) drawEnemy(g, e, p.x, p.y, state.time);
  }
  const boss = state.boss && !state.boss.dead ? state.boss : null;
  if (boss) {
    const p = worldToScreen(boss.angle, boss.dist, t.heading, t.fov);
    if (p.visible) drawBoss(g, boss, p.x, p.y, state.time);
  }
  for (const b of state.bullets) drawBullet(g, b, t.heading, t.fov);
  drawTurret(g, t, state.time);
  drawEffects(g, fx);
  drawHeadingGauge(g, t.heading, t.fov);
  if (boss) drawBossBar(g, boss);
}
