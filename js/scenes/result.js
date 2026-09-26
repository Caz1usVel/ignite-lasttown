import { drawBackground } from '../render/background.js';
import { recordResult, nextPlayableStage } from '../core/progress.js';

export function createResultScene(app) {
  const { dom } = app;
  let last = { mode: 'solo', stageId: 1 };
  let nextId = null;

  dom.retryBtn.addEventListener('click', () => {
    app.setScene('play', { mode: last.mode, stageId: last.stageId }); // ステージの最初からやり直す
  });
  dom.nextStageBtn.addEventListener('click', () => {
    if (nextId !== null) app.setScene('play', { mode: last.mode, stageId: nextId });
  });
  dom.resultStageSelectBtn.addEventListener('click', () => app.setScene('stageselect'));

  return {
    enter({ outcome, score, kills, mode, stageId }) {
      last = { mode, stageId };
      const { newBest } = recordResult(app.save, stageId, outcome, score);
      app.persist();
      nextId = outcome === 'clear' ? nextPlayableStage(app.save, stageId) : null;

      dom.resultTitle.textContent = outcome === 'clear' ? 'ステージクリア！' : 'ゲームオーバー';
      dom.resultScore.textContent = score.toLocaleString();
      dom.resultKills.textContent = kills.toLocaleString();
      dom.resultBest.textContent = app.save.stages[stageId].best.toLocaleString();
      dom.resultNewBest.classList.toggle('hidden', !newBest);
      dom.nextStageBtn.classList.toggle('hidden', nextId === null);
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.resultScreen.classList.remove('hidden');
    },
    exit() {
      dom.resultScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
