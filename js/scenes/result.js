import { drawBackground } from '../render/background.js';

export function createResultScene(app) {
  const { dom } = app;
  let lastMode = 'solo';
  dom.retryBtn.addEventListener('click', () => app.setScene('play', { mode: lastMode }));
  dom.resultTitleBtn.addEventListener('click', () => app.setScene('title'));

  return {
    enter({ outcome, score, kills, mode }) {
      lastMode = mode;
      const newBest = score > app.save.highScore;
      if (newBest) {
        app.save.highScore = score;
        app.persist();
      }
      dom.resultTitle.textContent = outcome === 'clear' ? 'ステージクリア！' : 'ゲームオーバー';
      dom.resultScore.textContent = score.toLocaleString();
      dom.resultKills.textContent = kills.toLocaleString();
      dom.resultBest.textContent = app.save.highScore.toLocaleString();
      dom.resultNewBest.classList.toggle('hidden', !newBest);
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
