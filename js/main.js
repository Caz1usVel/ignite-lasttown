import { CONFIG } from './core/config.js';
import { createViewport } from './core/view.js';
import { loadSave, writeSave } from './core/save.js';
import { createAudio } from './core/audio.js';
import { createStarfield } from './render/background.js';
import { initSettings } from './scenes/settings.js';
import { createTitleScene } from './scenes/title.js';
import { createInput } from './core/input.js';
import { createPlayScene } from './scenes/play.js';
import { createStageSelectScene } from './scenes/stageselect.js';
import { createResultScene } from './scenes/result.js';
import { createPauseScene } from './scenes/pause.js';
import { createEndlessQuitScene } from './scenes/endlessQuit.js';
import { createPowerupScene } from './scenes/powerup.js';
import { createDiaryScene } from './scenes/diary.js';
import { createHowtoScene } from './scenes/howto.js';
import { createSkinScene } from './scenes/skin.js';

const IDS = [
  'stage', 'game',
  'hud', 'hudLives', 'hudScore', 'hudPowerups', 'hudTime', 'pauseBtn', 'hint',
  'powerupScreen', 'offerCard0', 'offerCard1',
  'touchControls', 'turnLeftBtn', 'turnRightBtn',
  'titleScreen', 'titleLogo', 'titleProgress', 'startSoloBtn', 'startDuoBtn', 'titleHowtoBtn', 'titleDiaryBtn', 'titleSkinBtn', 'titleSettingsBtn',
  'howtoScreen', 'howtoTitle', 'howtoBody', 'howtoPage', 'howtoPrevBtn', 'howtoNextBtn',
  'stageSelectScreen', 'stageGrid', 'stageBackBtn',
  'pauseScreen', 'resumeBtn', 'pauseSettingsBtn', 'pauseTitleBtn',
  'endlessQuitScreen', 'endlessQuitScore', 'endlessQuitTime', 'endlessQuitResumeBtn', 'endlessQuitTitleBtn', 'endlessQuitDiscardBtn',
  'resultScreen', 'resultTitle', 'resultScore', 'resultKills', 'resultBest', 'resultNewBest', 'resultDiaryNote',
  'endlessBtn', 'hardEndlessBtn', 'resultTimeLabel', 'resultTime',
  'nextStageBtn', 'retryBtn', 'resultStageSelectBtn',
  'diaryScreen', 'diaryList', 'diaryText', 'diaryBackBtn', 'diaryPageCount',
  'skinScreen', 'skinList', 'skinPreviewCanvas', 'skinPreviewName', 'skinPreviewDesc', 'skinSelectBtn', 'skinBackBtn',
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
  mode: 'solo', // 'solo' | 'duo'（タイトルで選ぶ）
};
app.input = createInput(dom.game, app.viewport, dom.turnLeftBtn, dom.turnRightBtn);
app.settings = initSettings(app);
app.scenes.title = createTitleScene(app);
app.scenes.stageselect = createStageSelectScene(app);
app.scenes.play = createPlayScene(app);
app.scenes.result = createResultScene(app);
app.scenes.pause = createPauseScene(app);
app.scenes.endlessQuit = createEndlessQuitScene(app);
app.scenes.powerup = createPowerupScene(app);
app.scenes.diary = createDiaryScene(app);
app.scenes.howto = createHowtoScene(app);
app.scenes.skin = createSkinScene(app);

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
// iOSはpointerdownではユーザー操作と認められないことがあるため、pointerupでも解除する
document.addEventListener('pointerup', () => app.audio.unlock(), { capture: true });
window.addEventListener('keydown', () => app.audio.unlock(), { capture: true });

// ループは常にこの1本だけ
let lastTime = null;
function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, CONFIG.DT_MAX);
  lastTime = ts;
  requestAnimationFrame(loop); // update/render が例外を投げてもループが止まらないよう先に予約する
  current.update(dt);
  current.render(g, dt);
}

function togglePause() {
  if (app.sceneName === 'play') setScene('pause');
  else if (app.sceneName === 'pause' && dom.settingsScreen.classList.contains('hidden')) {
    setScene('play', { resume: true });
  }
}
app.input.onPause = togglePause;
dom.pauseBtn.addEventListener('click', () => {
  togglePause();
  dom.pauseBtn.blur(); // フォーカスが残るとSpace/Enterで再トリガーしてしまう
});

// タブが非表示になったら自動でポーズし、音も止める。戻ったときの dt の跳ねを防ぐ。
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (app.sceneName === 'play') setScene('pause');
    app.audio.suspend();
  }
  lastTime = null;
});

if (!save.tutorialSeen) setScene('howto', { forced: true });
else setScene('title');
requestAnimationFrame(loop);
