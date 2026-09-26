import { POWERUPS, chooseOffer, powerupLevelText } from '../game/powerups.js';

const INPUT_LOCK = 0.5; // 秒。連射中の誤選択を防ぐ

// パワーアップの選択画面。止まったプレイ画面を背景にして、DOMのカード2枚を出す。
export function createPowerupScene(app) {
  const { dom, audio } = app;
  const cards = [dom.offerCard0, dom.offerCard1];
  let choices = [];
  let lock = 0;
  let active = false;

  function pick(i) {
    if (!active || lock > 0 || !choices[i]) return;
    if (!chooseOffer(app.scenes.play.getState(), choices[i])) return;
    audio.se.pick();
    app.setScene('play', { resume: true });
  }

  cards.forEach((card, i) => card.addEventListener('click', () => pick(i)));
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Digit1' || e.code === 'Numpad1') pick(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') pick(1);
  });

  return {
    enter() {
      const state = app.scenes.play.getState();
      choices = [...state.offer];
      lock = INPUT_LOCK;
      active = true;
      cards.forEach((card, i) => {
        const id = choices[i];
        card.classList.toggle('hidden', !id);
        if (!id) return;
        const def = POWERUPS[id];
        card.querySelector('.card-icon').textContent = def.icon;
        card.querySelector('.card-name').textContent = def.name;
        card.querySelector('.card-desc').textContent = def.desc;
        card.querySelector('.card-level').textContent = powerupLevelText(state, id);
      });
      dom.powerupScreen.classList.add('locked');
      dom.powerupScreen.classList.remove('hidden');
    },
    exit() {
      active = false;
      dom.powerupScreen.classList.add('hidden');
    },
    update(dt) {
      lock = Math.max(0, lock - dt);
      if (lock === 0) dom.powerupScreen.classList.remove('locked');
    },
    render(g) {
      app.scenes.play.render(g, 0);
    },
  };
}
