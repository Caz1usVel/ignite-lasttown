import { GAME_TITLE, CONFIG } from '../core/config.js';
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
  dom.titleSkinBtn.addEventListener('click', () => app.setScene('skin'));
  dom.titleSettingsBtn.addEventListener('click', () => app.settings.open());

  return {
    enter() {
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.titleProgress.textContent = progressLine(app.save);
      dom.titleScreen.classList.remove('hidden');
      app.audio.playBgm('bgm/title.mp3');
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

// これまでの記録を、短い1行にまとめる（実績が無ければ、その旨を出す）
function progressLine(save) {
  const cleared = Object.values(save.stages ?? {}).filter((s) => s.cleared).length;
  const parts = [];
  if (cleared > 0) parts.push(`ステージ ${cleared}/${CONFIG.STAGE_COUNT} クリア`);
  const normalBest = save.endless?.normal?.best ?? 0;
  if (normalBest > 0) parts.push(`通常エンドレス 最高 ${normalBest.toLocaleString()}`);
  const hardBest = save.endless?.hard?.best ?? 0;
  if (hardBest > 0) parts.push(`ハード 最高 ${hardBest.toLocaleString()}`);
  return parts.length > 0 ? `これまでの記録：${parts.join('　')}` : '';
}
