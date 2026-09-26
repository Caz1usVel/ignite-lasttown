import { CONFIG } from '../core/config.js';
import { worldToScreen } from '../core/view.js';

const KILL_EPS = 1e-9; // 小数ダメージの積み重ねで HP が 1e-16 ほど残っても倒したことにする
const SWEEP_STEP = 12; // 弾の移動区間をこの間隔でサンプリングする

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by, r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

function targetsOf(state) {
  return state.boss && !state.boss.dead ? [...state.enemies, state.boss] : state.enemies;
}

// 判定は「今の向き」での画面座標で行う（見た目と一致させるため）。
// 倒した弾は pierceLeft が残っていれば消えずに進み続ける。倒しきれなかった弾はそこで止まる。
export function resolveBulletHits(state) {
  const { heading, fov, damage } = state.turret;
  const targets = targetsOf(state);
  const events = [];

  for (const b of state.bullets) {
    if (b.dead) continue;
    const span = b.dist - b.prevDist;
    const steps = Math.max(1, Math.ceil(span / SWEEP_STEP));
    let pierceLeft = b.pierceLeft ?? 0;

    sweep: for (let s = 1; s <= steps; s++) {
      const p = worldToScreen(b.angle, b.prevDist + (span * s) / steps, heading, fov);
      if (!p.visible) break;
      for (const t of targets) {
        if (t.dead) continue;
        const q = worldToScreen(t.angle, t.dist, heading, fov);
        if (!q.visible) continue;
        if (!circlesOverlap(p.x, p.y, b.radius, q.x, q.y, t.radius * CONFIG.HITBOX_RATIO)) continue;

        t.hp -= damage;
        const killed = t.hp <= KILL_EPS;
        if (killed) t.dead = true;
        events.push({ type: killed ? 'kill' : 'hit', target: t, x: q.x, y: q.y });

        if (killed && pierceLeft > 0) {
          pierceLeft -= 1; // 倒した敵は dead になるので、同じ敵に二度当たることはない
          continue;
        }
        b.dead = true;
        break sweep;
      }
    }
    b.pierceLeft = pierceLeft;
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
