// 設定オーバーレイ（タイトルとポーズの両方から開く）。リスナーは起動時に1回だけ登録する。
export function initSettings(app) {
  const { dom, audio, save } = app;
  let onClose = null;

  const renderMute = () => {
    dom.muteBtn.textContent = save.settings.muted ? '🔇 ミュート中' : '🔊 音あり';
  };

  dom.bgmVol.addEventListener('input', () => {
    audio.setBgmVol(dom.bgmVol.value / 100);
    app.persist();
  });
  dom.seVol.addEventListener('input', () => {
    audio.setSeVol(dom.seVol.value / 100);
    app.persist();
  });
  dom.seVol.addEventListener('change', () => audio.se.click());
  dom.muteBtn.addEventListener('click', () => {
    audio.setMuted(!save.settings.muted);
    app.persist();
    renderMute();
  });
  dom.settingsBackBtn.addEventListener('click', () => {
    dom.settingsScreen.classList.add('hidden');
    const cb = onClose;
    onClose = null;
    cb?.();
  });

  return {
    open(cb) {
      onClose = cb ?? null;
      dom.bgmVol.value = Math.round(save.settings.bgmVol * 100);
      dom.seVol.value = Math.round(save.settings.seVol * 100);
      renderMute();
      dom.settingsScreen.classList.remove('hidden');
    },
  };
}
