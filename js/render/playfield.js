import { worldToScreen, visualScale } from '../core/view.js';
import { drawBackground } from './background.js';
import { drawFov, drawHeadingGauge } from './fov.js';
import { drawTurret, drawEnemy, drawBoss, drawBullet, drawEffects, drawBossBar, drawJamNotice } from './entities.js';
import { drawRadar } from './radar.js';

export function drawPlayfield(g, vp, stars, state, fx, dt, skin) {
  const t = state.turret;
  const boss = state.boss && !state.boss.dead ? state.boss : null;
  const danger = Boolean(boss); // 危険時（ボス出現中）は赤空・ビーコン赤に切り替える
  vp.screenSpace(g);
  drawBackground(g, stars, vp.cssW, vp.cssH, dt, danger); // 旋回しても背景は動かさない（向きは砲身の傾きで表す）

  vp.virtualSpace(g);
  drawFov(g);
  const swapping = state.boss?.phase === 'swap' && state.boss.type === 'bossC';
  for (const e of state.enemies) {
    const p = worldToScreen(e.angle, e.dist, t.heading, t.fov);
    if (!p.visible) continue;
    // 遠くの敵ほど大きく描く（当たり判定も同じ倍率）
    const k = visualScale(e.dist);
    g.save();
    g.translate(p.x, p.y);
    g.scale(k, k);
    if (e.type === 'decoy') e.swapBlink = swapping; // 入れ替えの間、偽像も本体と同時に点滅する
    drawEnemy(g, e, 0, 0, state.time);
    g.restore();
  }
  if (boss) {
    const p = worldToScreen(boss.angle, boss.dist, t.heading, t.fov);
    if (p.visible) drawBoss(g, boss, p.x, p.y, state.time);
  }
  for (const b of state.bullets) drawBullet(g, b, t.heading, t.fov);
  drawTurret(g, t, state.time, skin, danger);
  drawEffects(g, fx);
  drawHeadingGauge(g, t.heading, t.fov);
  drawRadar(g, state);
  if (t.jam > 0) drawJamNotice(g, state.time);
  if (boss) drawBossBar(g, boss, state.time);
}
