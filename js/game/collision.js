import { CONFIG } from '../core/config.js';
import { worldToScreen } from '../core/view.js';

const SWEEP_STEP = 12; // 弾の移動区間をこの間隔でサンプリングする

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

function targetsOf(state) {
  return state.boss && !state.boss.dead ? [...state.enemies, state.boss] : state.enemies;
}

// 判定は「今の向き」での画面座標で行う（見た目と一致させるため）
export function resolveBulletHits(state) {
  const { heading, fov, damage } = state.turret;
  const targets = targetsOf(state);
  const events = [];

  for (const b of state.bullets) {
    if (b.dead) continue;
    const span = b.dist - b.prevDist;
    const steps = Math.max(1, Math.ceil(span / SWEEP_STEP));
    let hit = null;

    for (let s = 1; s <= steps && !hit; s++) {
      const p = worldToScreen(b.angle, b.prevDist + (span * s) / steps, heading, fov);
      if (!p.visible) break;
      for (const t of targets) {
        if (t.dead) continue;
        const q = worldToScreen(t.angle, t.dist, heading, fov);
        if (!q.visible) continue;
        if (circlesOverlap(p.x, p.y, b.radius, q.x, q.y, t.radius * CONFIG.HITBOX_RATIO)) {
          hit = { target: t, x: q.x, y: q.y };
          break;
        }
      }
    }
    if (!hit) continue;

    b.dead = true;
    hit.target.hp -= damage;
    const killed = hit.target.hp <= 0;
    if (killed) hit.target.dead = true;
    events.push({ type: killed ? 'kill' : 'hit', target: hit.target, x: hit.x, y: hit.y });
  }
  return events;
}

export function resolveCoreHits(state) {
  let reached = 0;
  for (const e of state.enemies) {
    if (!e.dead && e.dist <= CONFIG.HIT_RADIUS_CORE) {
      e.dead = true;
      reached++;
    }
  }
  return reached;
}

// 被弾時の仕切り直し：中心に近い敵・敵弾を外側へ押し戻す
export function applyKnockback(state) {
  for (const e of state.enemies) {
    if (!e.dead && e.dist < CONFIG.KNOCKBACK_RADIUS) e.dist += CONFIG.KNOCKBACK_DIST;
  }
}
