import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStageAvailable, isStageUnlocked, isStagePlayable, nextPlayableStage, recordResult,
} from '../js/core/progress.js';
import { STAGES, getStage } from '../js/data/stages.js';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';
import { STAGE3 } from '../js/data/stage3.js';
import { STAGE4 } from '../js/data/stage4.js';

const mkSave = (stages = {}) => ({ version: 2, settings: {}, stages });
const cleared = (...ids) => mkSave(Object.fromEntries(ids.map((i) => [i, { cleared: true, best: 1 }])));
const six = (id) => (id >= 1 && id <= 6 ? { id } : null); // 1〜6面にデータがあると仮定した登録

test('ステージの登録：1〜4面', () => {
  assert.equal(getStage(1), STAGE1);
  assert.equal(getStage(2), STAGE2);
  assert.equal(getStage(3), STAGE3);
  assert.equal(getStage(4), STAGE4);
  assert.deepEqual(Object.keys(STAGES), ['1', '2', '3', '4']);
  for (let i = 5; i <= 7; i++) assert.equal(getStage(i), null);
  assert.equal(getStage(0), null);
  assert.equal(getStage('__proto__'), null);
});

test('isStageAvailable：データがある面だけ', () => {
  for (const id of [1, 2, 3, 4]) assert.equal(isStageAvailable(id), true, `stage ${id}`);
  assert.equal(isStageAvailable(5), false);
  assert.equal(isStageAvailable(5, six), true);
  assert.equal(isStageAvailable(7, six), false);
  assert.equal(isStageAvailable(0, six), false);
  assert.equal(isStageAvailable(8, () => ({})), false); // STAGE_COUNT を超える番号は常に不可
});

test('isStageUnlocked：1面は常に解放、以降は直前の面のクリアで解放', () => {
  const s = mkSave();
  assert.equal(isStageUnlocked(s, 1), true);
  assert.equal(isStageUnlocked(s, 2), false);
  s.stages['1'] = { cleared: false, best: 900 };
  assert.equal(isStageUnlocked(s, 2), false); // 未クリアでは解放されない
  s.stages['1'].cleared = true;
  assert.equal(isStageUnlocked(s, 2), true);
  assert.equal(isStageUnlocked(s, 3), false);
});

test('isStagePlayable：データがあり、かつ解放済み', () => {
  const s = cleared(1);
  assert.equal(isStagePlayable(s, 1), true);
  assert.equal(isStagePlayable(s, 2), true);   // 1面クリア済みで、2面のデータがある
  assert.equal(isStagePlayable(s, 3), false);  // データはあるが未解放（2面が未クリア）
  const all = cleared(1, 2, 3, 4);
  assert.equal(isStagePlayable(all, 4), true);
  assert.equal(isStagePlayable(all, 5), false);      // 解放済みだがデータが無い（準備中）
  assert.equal(isStagePlayable(all, 5, six), true);
  assert.equal(isStagePlayable(all, 6, six), false); // データはあるが未解放（5面が未クリア）
});

test('nextPlayableStage', () => {
  assert.equal(nextPlayableStage(cleared(1), 1), 2);
  assert.equal(nextPlayableStage(cleared(1), 2), null);      // 2面が未クリア
  assert.equal(nextPlayableStage(cleared(1, 2), 2), 3);
  assert.equal(nextPlayableStage(cleared(1, 2), 3), null);   // 3面が未クリア
  assert.equal(nextPlayableStage(cleared(1, 2, 3), 3), 4);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4), 4), null);      // 5面のデータが無い
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4), 4, six), 5);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4, 5, 6), 6, six), null); // 7面のデータが無い
});

test('recordResult：クリアで cleared、最高スコアを更新', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'clear', 5000), { newBest: true });
  assert.deepEqual(s.stages['1'], { cleared: true, best: 5000 });
  assert.deepEqual(recordResult(s, 1, 'clear', 4000), { newBest: false });
  assert.equal(s.stages['1'].best, 5000);
  assert.deepEqual(recordResult(s, 1, 'clear', 6000), { newBest: true });
  assert.equal(s.stages['1'].best, 6000);
});

test('recordResult：ゲームオーバーでもスコアは記録し、cleared は変えない', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'gameover', 700), { newBest: true });
  assert.deepEqual(s.stages['1'], { cleared: false, best: 700 });
  s.stages['1'].cleared = true;
  recordResult(s, 1, 'gameover', 100);
  assert.equal(s.stages['1'].cleared, true); // 一度クリアしたら、あとの失敗で消えない
  assert.equal(s.stages['1'].best, 700);
});

test('recordResult：スコア0では最高スコア更新にならない', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'gameover', 0), { newBest: false });
});
