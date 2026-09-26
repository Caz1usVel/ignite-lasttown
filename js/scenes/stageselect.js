import { CONFIG } from '../core/config.js';
import { isStageAvailable, isStageUnlocked, isStagePlayable } from '../core/progress.js';
import { drawBackground } from '../render/background.js';

function statusOf(save, id) {
  if (!isStageAvailable(id)) return '準備中';
  if (!isStageUnlocked(save, id)) return '未解放';
  return save.stages[id]?.cleared ? 'クリア済み' : '挑戦できる';
}

export function createStageSelectScene(app) {
  const { dom } = app;
  dom.stageBackBtn.addEventListener('click', () => app.setScene('title'));

  // 入るたびに、セーブの内容から作り直す
  function build() {
    const save = app.save;
    dom.stageGrid.replaceChildren();
    for (let id = 1; id <= CONFIG.STAGE_COUNT; id++) {
      const entry = save.stages[id];
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'stage-tile' + (entry?.cleared ? ' cleared' : '');
      tile.disabled = !isStagePlayable(save, id);

      const num = document.createElement('span');
      num.className = 'tile-num';
      num.textContent = `${id}面`;
      const status = document.createElement('span');
      status.className = 'tile-status';
      status.textContent = statusOf(save, id);
      const best = document.createElement('span');
      best.className = 'tile-best';
      best.textContent = entry && entry.best > 0 ? `最高 ${entry.best.toLocaleString()}` : '';
      tile.append(num, status, best);

      tile.addEventListener('click', () => app.setScene('play', { stageId: id, mode: app.mode }));
      dom.stageGrid.append(tile);
    }
  }

  return {
    enter() {
      build();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.stageSelectScreen.classList.remove('hidden');
      app.audio.playBgm(null);
    },
    exit() {
      dom.stageSelectScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
