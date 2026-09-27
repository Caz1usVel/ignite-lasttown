import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEndlessQuitScene } from '../js/scenes/endlessQuit.js';
import { createPauseScene } from '../js/scenes/pause.js';

// scenes/*.js は DOM と app にしか触れないので、両方を簡単なスタブで作って、
// ブラウザなしで（requestAnimationFrame に頼らず）ロジックだけを検査する。
function mkEl() {
  const listeners = {};
  const classes = new Set();
  return {
    textContent: '',
    disabled: false,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    click() { (listeners.click ?? []).forEach((fn) => fn()); },
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
  };
}

function mkDom(ids) {
  return Object.fromEntries(ids.map((id) => [id, mkEl()]));
}


function mkApp(dom, { run, save } = {}) {
  const setSceneCalls = [];
  const app = {
    dom,
    save: save ?? { endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } } },
    persist: () => { app.persisted = (app.persisted ?? 0) + 1; },
    setScene: (name, params) => setSceneCalls.push({ name, params }),
    scenes: { play: { getRun: () => run, render() {} } },
    settings: { open() {} },
  };
  app.setSceneCalls = setSceneCalls;
  return app;
}

const ENDLESS_QUIT_IDS = [
  'endlessQuitScreen', 'endlessQuitScore', 'endlessQuitTime',
  'endlessQuitResumeBtn', 'endlessQuitTitleBtn', 'endlessQuitDiscardBtn',
];

test('endlessQuit：出た直後はロックされ、ボタンを押しても何も起きない', () => {
  const dom = mkDom(ENDLESS_QUIT_IDS);
  const run = { endless: 'normal', score: 500, time: 42, outcome: null };
  const app = mkApp(dom, { run });
  const scene = createEndlessQuitScene(app);
  scene.enter();
  assert.equal(dom.endlessQuitScreen.classList.contains('locked'), true);
  assert.equal(dom.endlessQuitScreen.classList.contains('hidden'), false);
  assert.equal(dom.endlessQuitScore.textContent, '500');
  assert.equal(dom.endlessQuitTime.textContent, '0:42');

  // 連打：ロックされている間は、押しても何も起きない
  for (let i = 0; i < 5; i++) dom.endlessQuitDiscardBtn.click();
  assert.equal(app.setSceneCalls.length, 0);
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), false);
  dom.endlessQuitResumeBtn.click();
  dom.endlessQuitTitleBtn.click();
  assert.equal(app.setSceneCalls.length, 0);
});

test('endlessQuit：ロックが解けたら、つづける／記録してタイトルへ が効く', () => {
  const dom = mkDom(ENDLESS_QUIT_IDS);
  const run = { endless: 'normal', score: 500, time: 42, outcome: null };
  const save = { endless: { normal: { best: 100, time: 10 }, hard: { best: 0, time: 0 } } };
  const app = mkApp(dom, { run, save });
  const scene = createEndlessQuitScene(app);
  scene.enter();
  scene.update(1); // ロックの秒数より大きく進める
  assert.equal(dom.endlessQuitScreen.classList.contains('locked'), false);

  dom.endlessQuitResumeBtn.click();
  assert.deepEqual(app.setSceneCalls.at(-1), { name: 'play', params: { resume: true } });

  const app2 = mkApp(mkDom(ENDLESS_QUIT_IDS), { run, save });
  const scene2 = createEndlessQuitScene(app2);
  scene2.enter();
  scene2.update(1);
  app2.dom.endlessQuitTitleBtn.click();
  assert.deepEqual(app2.setSceneCalls.at(-1), { name: 'title', params: undefined });
  assert.deepEqual(save.endless.normal, { best: 500, time: 42 }); // 新記録なので保存された
  assert.equal(app2.persisted, 1);
});

test('endlessQuit：「記録せずにタイトルへ」は2回押さないと実行されない。1回目はボタンの見た目が変わるだけ', () => {
  const dom = mkDom(ENDLESS_QUIT_IDS);
  const run = { endless: 'hard', score: 900, time: 300, outcome: null };
  const save = { endless: { normal: { best: 0, time: 0 }, hard: { best: 100, time: 20 } } };
  const app = mkApp(dom, { run, save });
  const scene = createEndlessQuitScene(app);
  scene.enter();
  scene.update(1);

  const before = dom.endlessQuitDiscardBtn.textContent;
  dom.endlessQuitDiscardBtn.click(); // 1回目：構える（実行しない）
  assert.equal(app.setSceneCalls.length, 0);
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), true);
  assert.notEqual(dom.endlessQuitDiscardBtn.textContent, before);

  // 連打（構えた直後に、間を置かず何度も押す）は、実行にならない
  dom.endlessQuitDiscardBtn.click();
  dom.endlessQuitDiscardBtn.click();
  dom.endlessQuitDiscardBtn.click();
  assert.equal(app.setSceneCalls.length, 0);
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), true); // 構えたままで、キャンセルもされない

  scene.update(1); // 一呼吸おく（連打の勢いが収まる）
  dom.endlessQuitDiscardBtn.click(); // ここでの2回目は、意図した押し直しなので実行する
  assert.deepEqual(app.setSceneCalls.at(-1), { name: 'title', params: undefined });
  assert.deepEqual(save.endless.hard, { best: 100, time: 20 }); // 記録せずにやめたので、更新されない
  assert.equal(app.persisted, undefined); // 保存もされない
});

test('endlessQuit：構えたまま一定時間たつと、元の見た目に戻り、また1回目からになる', () => {
  const dom = mkDom(ENDLESS_QUIT_IDS);
  const run = { endless: 'normal', score: 0, time: 0, outcome: null };
  const app = mkApp(dom, { run });
  const scene = createEndlessQuitScene(app);
  scene.enter();
  scene.update(1);
  dom.endlessQuitDiscardBtn.click();
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), true);

  scene.update(10); // 構えている時間より、十分長く進める
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), false);

  dom.endlessQuitDiscardBtn.click(); // 時間切れのあとは、また1回目（実行しない）
  assert.equal(app.setSceneCalls.length, 0);
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), true);
});

test('endlessQuit：抜けるとロック・構えの状態がリセットされる', () => {
  const dom = mkDom(ENDLESS_QUIT_IDS);
  const app = mkApp(dom, { run: { endless: 'normal', score: 0, time: 0, outcome: null } });
  const scene = createEndlessQuitScene(app);
  scene.enter();
  scene.update(1);
  dom.endlessQuitDiscardBtn.click();
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), true);
  scene.exit();
  assert.equal(dom.endlessQuitScreen.classList.contains('hidden'), true);
  assert.equal(dom.endlessQuitDiscardBtn.classList.contains('armed'), false);
});

const PAUSE_IDS = ['pauseScreen', 'resumeBtn', 'pauseSettingsBtn', 'pauseTitleBtn'];

test('pause：エンドレスの途中でタイトルへを押すと、確認画面（endlessQuit）へ行く。記録・タイトルへの遷移はしない', () => {
  const dom = mkDom(PAUSE_IDS);
  const app = mkApp(dom, { run: { endless: 'normal', score: 999, time: 1, outcome: null } });
  const scene = createPauseScene(app);
  dom.pauseTitleBtn.click();
  assert.deepEqual(app.setSceneCalls, [{ name: 'endlessQuit', params: undefined }]);
  assert.equal(app.persisted, undefined);
  void scene;
});

test('pause：ステージ制のときは、これまでどおりそのままタイトルへ', () => {
  const dom = mkDom(PAUSE_IDS);
  const app = mkApp(dom, { run: { endless: null, score: 999, time: 1, outcome: null } });
  createPauseScene(app);
  dom.pauseTitleBtn.click();
  assert.deepEqual(app.setSceneCalls, [{ name: 'title', params: undefined }]);
});

test('pause：すでに決着したエンドレス（結果画面へ向かう途中）は、確認画面を出さず、そのままタイトルへ（二重に記録しない）', () => {
  const dom = mkDom(PAUSE_IDS);
  const save = { endless: { normal: { best: 999999, time: 1 }, hard: { best: 0, time: 0 } } };
  const app = mkApp(dom, { run: { endless: 'normal', score: 1, time: 1, outcome: 'gameover' }, save });
  createPauseScene(app);
  dom.pauseTitleBtn.click();
  assert.deepEqual(app.setSceneCalls, [{ name: 'title', params: undefined }]);
  assert.equal(save.endless.normal.best, 999999); // 上書きされない（結果画面がすでに記録している）
});
