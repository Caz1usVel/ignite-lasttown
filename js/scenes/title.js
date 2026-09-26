import { GAME_TITLE } from '../core/config.js';
import { drawBackground } from '../render/background.js';

export function createTitleScene(app) {
  const { dom } = app;
  dom.titleLogo.textContent = GAME_TITLE;
  dom.startSoloBtn.addEventListener('click', () => app.startGame('solo'));
  dom.startDuoBtn.addEventListener('click', () => app.startGame('duo'));
  dom.titleSettingsBtn.addEventListener('click', () => app.settings.open());

  return {
    enter() {
      dom.titleBest.textContent = app.save.highScore.toLocaleString();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.titleScreen.classList.remove('hidden');
      app.audio.playBgm(null);
    },
    exit() {
      dom.titleScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
