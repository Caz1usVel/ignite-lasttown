import { drawBackground } from '../render/background.js';
import { recordResult, nextPlayableStage, recordEndlessResult } from '../core/progress.js';
import { createEffects, spawnBurst, updateEffects } from '../game/effects.js';
import { drawEffects } from '../render/entities.js';
import { CONFIG } from '../core/config.js';

export function createResultScene(app) {
  const { dom } = app;
  let last = { mode: 'solo', stageId: 1, endless: null };
  let nextId = null;
  let fx = createEffects();
  let countUp = { score: 0, kills: 0, targetScore: 0, targetKills: 0, t: 0 };
  const COUNT_TIME = 1.0; // 秒。カウントアップにかける時間
  let celebrateTimer = null;

  dom.retryBtn.addEventListener('click', () => {
    // ステージ（エンドレスなら最初）からやり直す
    app.setScene('play', last.endless ? { mode: last.mode, endless: last.endless } : { mode: last.mode, stageId: last.stageId });
  });
  dom.nextStageBtn.addEventListener('click', () => {
    if (nextId !== null) app.setScene('play', { mode: last.mode, stageId: nextId });
  });
  dom.resultStageSelectBtn.addEventListener('click', () => app.setScene('stageselect'));

  return {
    enter({ outcome, score, kills, mode, stageId, endless, time }) {
      clearTimeout(celebrateTimer);
      last = { mode, stageId, endless: endless ?? null };
      const { newBest, newClear = false } = endless
        ? recordEndlessResult(app.save, endless, score, time ?? 0)
        : recordResult(app.save, stageId, outcome, score);
      app.persist();
      nextId = !endless && outcome === 'clear' ? nextPlayableStage(app.save, stageId) : null;

      dom.resultTitle.textContent = !endless && outcome === 'clear' ? 'ステージクリア！' : 'ゲームオーバー';
      dom.resultTimeLabel.classList.toggle('hidden', !endless);
      dom.resultTime.classList.toggle('hidden', !endless);
      if (endless) {
        const s = Math.floor(time ?? 0);
        dom.resultTime.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }
      dom.resultBest.textContent = (endless ? app.save.endless[endless].best : app.save.stages[stageId].best).toLocaleString();
      dom.resultNewBest.classList.toggle('hidden', !newBest);
      dom.resultDiaryNote.classList.toggle('hidden', !newClear);
      dom.nextStageBtn.classList.toggle('hidden', nextId === null);
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.resultScreen.classList.remove('hidden');
      fx = createEffects();
      countUp = { score: 0, kills: 0, targetScore: score, targetKills: kills, t: 0 };
      dom.resultScore.textContent = '0';
      dom.resultKills.textContent = '0';
      dom.resultNewBest.classList.remove('celebrate');
      if (newBest) {
        // 更新した瞬間を、少し遅らせて祝う（カウントアップが終わる頃に）
        celebrateTimer = setTimeout(() => {
          if (dom.resultScreen.classList.contains('hidden')) return; // 既に結果画面を離れていたら何もしない
          dom.resultNewBest.classList.add('celebrate');
          spawnBurst(fx, CONFIG.CENTER_X, CONFIG.CENTER_Y - 120, '#ffd866', 40, Math.random);
          spawnBurst(fx, CONFIG.CENTER_X, CONFIG.CENTER_Y - 120, '#ff9ecb', 24, Math.random);
        }, COUNT_TIME * 1000);
      }
    },
    exit() {
      clearTimeout(celebrateTimer);
      dom.resultScreen.classList.add('hidden');
      dom.resultDiaryNote.classList.add('hidden');
      dom.resultNewBest.classList.remove('celebrate');
    },
    update(dt) {
      countUp.t = Math.min(COUNT_TIME, countUp.t + dt);
      const k = COUNT_TIME > 0 ? countUp.t / COUNT_TIME : 1;
      const ease = 1 - Math.pow(1 - k, 3); // 徐々に減速する
      dom.resultScore.textContent = Math.round(countUp.targetScore * ease).toLocaleString();
      dom.resultKills.textContent = Math.round(countUp.targetKills * ease).toLocaleString();
      updateEffects(fx, dt);
    },
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
      vp.virtualSpace(g);
      drawEffects(g, fx);
    },
  };
}
