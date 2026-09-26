import { screenToWorldAngle } from '../core/view.js';
import { updateTurret, tryFire, damageTurret } from './turret.js';
import { spawnBullet, updateBullets } from './bullets.js';
import { updateEnemies, removeDead, ENEMY_DEFS } from './enemies.js';
import { updateBoss } from './boss.js';
import { updateSpawner } from './spawner.js';
import { resolveBulletHits, resolveCoreHits, applyKnockback } from './collision.js';
import { makeOffer, OFFER_EVERY } from './powerups.js';

// 1フレーム分ゲームを進め、起きたことをイベント配列で返す（音・エフェクトはシーン側で処理する）
export function stepGame(state, dt, controls) {
  const events = [];
  if (state.outcome || state.offer) return events; // 決着後・選択待ちの間は止める
  state.time += dt;
  const t = state.turret;

  updateTurret(t, dt, controls.turnAxis);
  if (controls.firing && controls.aim && tryFire(t)) {
    const angle = screenToWorldAngle(controls.aim.x, controls.aim.y, t.heading, t.fov);
    spawnBullet(state, angle, controls.bulletSpeed);
    events.push({ type: 'fire', angle });
  }

  updateSpawner(state.spawner, state, dt);
  updateEnemies(state, dt);
  if (state.boss && !state.boss.dead) updateBoss(state.boss, state, dt);
  updateBullets(state, dt);

  for (const ev of resolveBulletHits(state)) {
    ev.target.flashT = state.time;
    events.push(ev);
    if (ev.type !== 'kill') continue;
    if (ev.target === state.boss) {
      state.score += state.boss.p.score;
      state.kills += 1;
    } else {
      const def = ENEMY_DEFS[ev.target.type];
      state.score += def.score;
      if (def.countsAsKill) state.kills += 1;
    }
  }

  let coreHits = resolveCoreHits(state);
  if (state.boss?.hitCore) { // ボスの突進が中心に届いた
    state.boss.hitCore = false;
    coreHits += 1;
  }
  if (coreHits > 0 && damageTurret(t)) {
    applyKnockback(state);
    events.push({ type: 'damage', lives: t.lives });
  }

  removeDead(state.enemies);
  removeDead(state.bullets);

  if (state.boss?.dead) {
    state.outcome = 'clear';
    events.push({ type: 'clear' });
  } else if (t.lives <= 0) {
    state.outcome = 'gameover';
    events.push({ type: 'gameover' });
  }

  // 撃破10体ごとのパワーアップ選択。決着した瞬間には出さない
  if (!state.outcome && state.kills >= state.nextOfferAt) {
    const choices = makeOffer(state.powerups, state.rng);
    state.nextOfferAt += OFFER_EVERY;
    if (choices.length > 0) {
      state.offer = choices;
      events.push({ type: 'offer', choices });
    }
  }

  return events;
}
