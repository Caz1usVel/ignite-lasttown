import { bankEndlessRun } from '../core/progress.js';

export function createPauseScene(app) {
  const { dom } = app;
  dom.resumeBtn.addEventListener('click', () => app.setScene('play', { resume: true }));
  dom.pauseSettingsBtn.addEventListener('click', () => app.settings.open());
  dom.pauseTitleBtn.addEventListener('click', () => {
    const run = app.scenes.play.getRun();
    if (run && run.endless && !run.outcome) {
      // エンドレスの途中でやめようとしている：確認画面をはさむ（続ける／記録してやめる／最初から）
      app.setScene('endlessQuit');
      return;
    }
    // ステージ制、またはすでに決着しているエンドレスは、そのままタイトルへ（記録は結果画面が済ませている）
    if (bankEndlessRun(app.save, run)) app.persist();
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
