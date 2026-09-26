import { DIARY, isDiaryUnlocked } from '../data/diary.js';
import { drawBackground } from '../render/background.js';

export function createDiaryScene(app) {
  const { dom } = app;
  dom.diaryBackBtn.addEventListener('click', () => app.setScene('title'));

  function build() {
    dom.diaryList.replaceChildren();
    dom.diaryText.textContent = '読みたい日記を選んでください';
    for (const d of DIARY) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const open = isDiaryUnlocked(app.save, d.stage);
      btn.disabled = !open;
      btn.textContent = open ? `${d.stage}. ${d.title}` : `${d.stage}. ？？？`;
      btn.addEventListener('click', () => {
        for (const other of dom.diaryList.children) other.classList.remove('active');
        btn.classList.add('active');
        dom.diaryText.textContent = d.body;
      });
      dom.diaryList.append(btn);
    }
  }

  return {
    enter() {
      build();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.diaryScreen.classList.remove('hidden');
    },
    exit() {
      dom.diaryScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
