import { CONFIG } from '../core/config.js';
import { getStage, stageLabel } from '../data/stages.js';
import { createPlayState } from '../game/state.js';
import { stepGame } from '../game/step.js';
import { POWERUPS, POWERUP_IDS } from '../game/powerups.js';
import { ENEMY_DEFS } from '../game/enemies.js';
import { createEffects, spawnBurst, spawnPopup, updateEffects } from '../game/effects.js';
import { drawPlayfield } from '../render/playfield.js';
import { COLORS } from '../render/entities.js';

const HINTS = {
  solo: 'A/D・←→ で旋回　マウスで狙ってクリック（長押しで連射）',
  duo: '1P：A/D・←→ で旋回　／　2P：マウスで狙って発射',
  touch: '◀ ▶ で旋回　敵をタップして発射（長押しで連射）',
};
const HINT_TIME = 5;
const END_DELAY = 1.2; // 最後の演出を見せてから結果画面へ

export function createPlayScene(app) {
  const { dom, audio, input } = app;
  let state = null;
  let fx = null;
  let mode = 'solo';
  let stageId = 1;
  let endTimer = 0;

  function updateHud() {
    dom.hudLives.textContent = '♥'.repeat(Math.max(0, state.turret.lives));
    dom.hudScore.textContent = state.score.toLocaleString();
    dom.hudPowerups.textContent = POWERUP_IDS
      .filter((id) => id !== 'life' && state.powerups[id] > 0) // 残機はハート表示に反映されるので並べない
      .map((id) => `${POWERUPS[id].icon}${state.powerups[id]}`)
      .join(' ');
    const s = Math.floor(state.time);
    dom.hudTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function handleEvents(events) {
    for (const ev of events) {
      switch (ev.type) {
        case 'fire':
          audio.se.shoot();
          break;
        case 'hit':
          audio.se.hit();
          spawnBurst(fx, ev.x, ev.y, '#fff6c8', 4);
          break;
        case 'kill': {
          const isBoss = ev.target === state.boss;
          const score = isBoss ? state.boss.p.score : ENEMY_DEFS[ev.target.type].score;
          if (isBoss) audio.se.bossKill(); else audio.se.kill();
          spawnBurst(fx, ev.x, ev.y, isBoss ? (state.boss.p.color ?? COLORS.boss) : '#ffd866', isBoss ? 60 : 12);
          spawnPopup(fx, ev.x, ev.y - 10, `+${score}`, '#ffd866');
          break;
        }
        case 'damage':
          audio.se.damage();
          spawnBurst(fx, CONFIG.CENTER_X, CONFIG.CENTER_Y, '#ff7a52', 24);
          break;
        case 'clear':
          audio.se.clear();
          endTimer = END_DELAY;
          break;
        case 'offer':
          audio.se.offer();
          break;
        case 'gameover':
          audio.se.gameOver();
          endTimer = END_DELAY;
          break;
      }
    }
  }

  return {
    enter(params = {}) {
      if (!params.resume) {
        mode = params.mode ?? mode;
        stageId = params.stageId ?? stageId;
        state = createPlayState(getStage(stageId));
        fx = createEffects();
        endTimer = 0;
        dom.hint.textContent = stageLabel(getStage(stageId)) + (input.isTouch() ? HINTS.touch : HINTS[mode]);
        dom.hint.classList.remove('hidden');
      }
      input.reset();
      dom.hud.classList.remove('hidden');
    },
    exit() {
      input.reset();
      dom.touchControls.classList.add('hidden');
    },
    update(dt) {
      dom.touchControls.classList.toggle('hidden', !input.isTouch());
      const tap = input.takeTap();
      const held = input.isFiring();
      const events = stepGame(state, dt, {
        turnAxis: input.turnAxis(),
        firing: held || tap !== null,
        aim: held ? input.aim() : (tap ?? input.aim()),
        bulletSpeed: input.isTouch() ? CONFIG.BULLET_SPEED_MOBILE : CONFIG.BULLET_SPEED_PC,
      });
      handleEvents(events);
      updateEffects(fx, dt);
      if (state.time > HINT_TIME) dom.hint.classList.add('hidden');
      updateHud();
      if (state.offer) {
        app.setScene('powerup'); // 選択が出たら止まる。選んだら { resume: true } で戻ってくる
        return;
      }
      if (state.outcome) {
        endTimer -= dt;
        if (endTimer <= 0) {
          app.setScene('result', { outcome: state.outcome, score: state.score, kills: state.kills, mode, stageId });
        }
      }
    },
    render(g, dt) {
      drawPlayfield(g, app.viewport, app.stars, state, fx, dt);
    },
    getState() {
      return state;
    },
  };
}
