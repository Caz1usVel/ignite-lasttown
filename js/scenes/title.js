import { GAME_TITLE } from '../core/config.js';
import { drawBackground } from '../render/background.js';

export function createTitleScene(app) {
  const { dom } = app;
  dom.titleLogo.textContent = GAME_TITLE;
  // ソロと2人協力は操作の分担が違うだけ。どちらもステージ選択へ進み、mode はヒント表示にだけ使う
  dom.startSoloBtn.addEventListener('click', () => {
    app.mode = 'solo';
    app.setScene('stageselect');
  });
  dom.startDuoBtn.addEventListener('click', () => {
    app.mode = 'duo';
    app.setScene('stageselect');
  });
  dom.titleHowtoBtn.addEventListener('click', () => app.setScene('howto', { forced: false }));
  dom.titleDiaryBtn.addEventListener('click', () => app.setScene('diary'));
  dom.titleSettingsBtn.addEventListener('click', () => app.settings.open());

  return {
    enter() {
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
