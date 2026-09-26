import { CONFIG } from './core/config.js';
import { createViewport } from './core/view.js';
import { loadSave, writeSave } from './core/save.js';
import { createAudio } from './core/audio.js';
import { createStarfield } from './render/background.js';
import { initSettings } from './scenes/settings.js';
import { createTitleScene } from './scenes/title.js';
import { createInput } from './core/input.js';
import { createPlayScene } from './scenes/play.js';
import { createResultScene } from './scenes/result.js';
import { createPauseScene } from './scenes/pause.js';

const IDS = [
  'stage', 'game',
  'hud', 'hudLives', 'hudScore', 'hudTime', 'pauseBtn', 'hint',
  'touchControls', 'turnLeftBtn', 'turnRightBtn',
  'titleScreen', 'titleLogo', 'startSoloBtn', 'startDuoBtn', 'titleSettingsBtn', 'titleBest',
  'pauseScreen', 'resumeBtn', 'pauseSettingsBtn', 'pauseTitleBtn',
  'resultScreen', 'resultTitle', 'resultScore', 'resultKills', 'resultBest', 'resultNewBest',
  'retryBtn', 'resultTitleBtn',
  'settingsScreen', 'bgmVol', 'seVol', 'muteBtn', 'settingsBackBtn',
];
const dom = Object.fromEntries(IDS.map((id) => [id, document.getElementById(id)]));

const g = dom.game.getContext('2d');
const save = loadSave();
const app = {
  dom,
  save,
  viewport: createViewport(dom.game),
  audio: createAudio(save.settings),
  stars: createStarfield(),
  scenes: {},
  sceneName: null,
  persist: () => writeSave(save),
  setScene,
  startGame: (mode) => setScene('play', { mode }),
};
app.input = createInput(dom.game, app.viewport, dom.turnLeftBtn, dom.turnRightBtn);
app.settings = initSettings(app);
app.scenes.title = createTitleScene(app);
app.scenes.play = createPlayScene(app);
app.scenes.result = createResultScene(app);
app.scenes.pause = createPauseScene(app);

let current = null;
function setScene(name, params) {
  current?.exit();
  app.sceneName = name;
  current = app.scenes[name];
  current.enter(params);
}

// 最初のユーザー操作でオーディオを有効化する
document.addEventListener('pointerdown', (e) => {
  app.input.notePointer(e);
  app.audio.unlock();
}, { capture: true });
window.addEventListener('keydown', () => app.audio.unlock(), { capture: true });

// ループは常にこの1本だけ
let lastTime = null;
function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, CONFIG.DT_MAX);
  lastTime = ts;
  current.update(dt);
  current.render(g, dt);
  requestAnimationFrame(loop);
}

function togglePause() {
  if (app.sceneName === 'play') setScene('pause');
  else if (app.sceneName === 'pause' && dom.settingsScreen.classList.contains('hidden')) {
    setScene('play', { resume: true });
  }
}
app.input.onPause = togglePause;
dom.pauseBtn.addEventListener('click', togglePause);

// タブが非表示になったら自動でポーズし、音も止める。戻ったときの dt の跳ねを防ぐ。
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (app.sceneName === 'play') setScene('pause');
    app.audio.suspend();
  }
  lastTime = null;
});

setScene('title');
requestAnimationFrame(loop);
