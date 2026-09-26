import { CONFIG } from './core/config.js';
import { createViewport } from './core/view.js';
import { loadSave, writeSave } from './core/save.js';
import { createAudio } from './core/audio.js';
import { createStarfield } from './render/background.js';
import { initSettings } from './scenes/settings.js';
import { createTitleScene } from './scenes/title.js';

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
  startGame: (mode) => console.info('play scene is added in Task 11', mode),
};
app.settings = initSettings(app);
app.scenes.title = createTitleScene(app);

let current = null;
function setScene(name, params) {
  current?.exit();
  app.sceneName = name;
  current = app.scenes[name];
  current.enter(params);
}

// 最初のユーザー操作でオーディオを有効化する
document.addEventListener('pointerdown', () => app.audio.unlock(), { capture: true });
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

setScene('title');
requestAnimationFrame(loop);
