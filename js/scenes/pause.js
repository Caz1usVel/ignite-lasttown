import { bankEndlessRun } from '../core/progress.js';

export function createPauseScene(app) {
  const { dom } = app;
  dom.resumeBtn.addEventListener('click', () => app.setScene('play', { resume: true }));
  dom.pauseSettingsBtn.addEventListener('click', () => app.settings.open());
  dom.pauseTitleBtn.addEventListener('click', () => {
    // エンドレスは、途中でやめても、その時点のスコア・生存時間を記録する
    if (bankEndlessRun(app.save, app.scenes.play.getRun())) app.persist();
    app.setScene('title');
  });

  return {
    enter() {
      dom.pauseScreen.classList.remove('hidden');
    },
    exit() {
      dom.pauseScreen.classList.add('hidden');
    },
    update() {},
    render(g) {
      app.scenes.play.render(g, 0); // 止まったプレイ画面をそのまま背景にする
    },
  };
}
