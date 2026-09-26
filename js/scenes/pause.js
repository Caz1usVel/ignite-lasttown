export function createPauseScene(app) {
  const { dom } = app;
  dom.resumeBtn.addEventListener('click', () => app.setScene('play', { resume: true }));
  dom.pauseSettingsBtn.addEventListener('click', () => app.settings.open());
  dom.pauseTitleBtn.addEventListener('click', () => app.setScene('title'));

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
