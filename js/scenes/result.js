import { drawBackground } from '../render/background.js';
import { recordResult, nextPlayableStage, recordEndlessResult } from '../core/progress.js';

export function createResultScene(app) {
  const { dom } = app;
  let last = { mode: 'solo', stageId: 1, endless: null };
  let nextId = null;

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
      dom.resultScore.textContent = score.toLocaleString();
      dom.resultKills.textContent = kills.toLocaleString();
      dom.resultBest.textContent = (endless ? app.save.endless[endless].best : app.save.stages[stageId].best).toLocaleString();
      dom.resultNewBest.classList.toggle('hidden', !newBest);
      dom.resultDiaryNote.classList.toggle('hidden', !newClear);
      dom.nextStageBtn.classList.toggle('hidden', nextId === null);
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.resultScreen.classList.remove('hidden');
    },
    exit() {
      dom.resultScreen.classList.add('hidden');
      dom.resultDiaryNote.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
