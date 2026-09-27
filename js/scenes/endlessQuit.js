import { bankEndlessRun } from '../core/progress.js';

const INPUT_LOCK = 0.4; // 秒。画面が出た直後の連打（Esc/Pの連打など）で、意図せず押してしまうのを防ぐ
const ARM_WINDOW = 3; // 秒。「記録せずにタイトルへ」は2回押さないと実行しない（連打での誤操作を防ぐ）
const ARM_CONFIRM_DELAY = 0.35; // 秒。1回目を押した直後は、2回目を受け付けない（連打の勢いで2回目に化けるのを防ぐ）
const DISCARD_LABEL = '記録せずにタイトルへ';
const DISCARD_CONFIRM_LABEL = '本当に記録せずにやめる？（もう一度押す）';

function formatTime(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ポーズから「タイトルへ」を選んだとき、エンドレスの途中なら、この確認画面をはさむ。
// 「つづける」でこのまま続行、「記録してタイトルへ」で今の記録を残してやめる、
// 「記録せずにタイトルへ」は、今のスコアを保存せずにやめる（2回押さないと実行しない：壊す操作なので、連打で誤って実行しない）。
export function createEndlessQuitScene(app) {
  const { dom } = app;
  let lock = 0;
  let armed = false;
  let armTimer = 0;
  let armLock = 0; // 構えた直後は、少しの間、確定の2回目を受け付けない（連打対策）

  function disarm() {
    armed = false;
    armTimer = 0;
    armLock = 0;
    dom.endlessQuitDiscardBtn.textContent = DISCARD_LABEL;
    dom.endlessQuitDiscardBtn.classList.remove('armed');
  }

  dom.endlessQuitResumeBtn.addEventListener('click', () => {
    if (lock > 0) return;
    app.setScene('play', { resume: true });
  });
  dom.endlessQuitTitleBtn.addEventListener('click', () => {
    if (lock > 0) return;
    if (bankEndlessRun(app.save, app.scenes.play.getRun())) app.persist();
    app.setScene('title');
  });
  dom.endlessQuitDiscardBtn.addEventListener('click', () => {
    if (lock > 0) return;
    if (!armed) {
      armed = true;
      armTimer = ARM_WINDOW;
      armLock = ARM_CONFIRM_DELAY;
      dom.endlessQuitDiscardBtn.textContent = DISCARD_CONFIRM_LABEL;
      dom.endlessQuitDiscardBtn.classList.add('armed');
      return;
    }
    if (armLock > 0) return; // 構えた直後の連打で、そのまま確定させない
    disarm();
    app.setScene('title'); // 記録は残さない（bankEndlessRun を呼ばない）
  });

  return {
    enter() {
      lock = INPUT_LOCK;
      disarm();
      const run = app.scenes.play.getRun();
      dom.endlessQuitScore.textContent = (run?.score ?? 0).toLocaleString();
      dom.endlessQuitTime.textContent = formatTime(run?.time ?? 0);
      dom.endlessQuitScreen.classList.add('locked');
      dom.endlessQuitScreen.classList.remove('hidden');
    },
    exit() {
      disarm();
      dom.endlessQuitScreen.classList.add('hidden');
    },
    update(dt) {
      lock = Math.max(0, lock - dt);
      if (lock === 0) dom.endlessQuitScreen.classList.remove('locked');
      if (armed) {
        armTimer -= dt;
        if (armTimer <= 0) disarm();
        else armLock = Math.max(0, armLock - dt);
      }
    },
    render(g) {
      app.scenes.play.render(g, 0); // 止まったプレイ画面をそのまま背景にする
    },
  };
}
