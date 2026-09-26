import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStageAvailable, isStageUnlocked, isStagePlayable, nextPlayableStage, recordResult,
} from '../js/core/progress.js';
import { STAGES, getStage } from '../js/data/stages.js';
import { STAGE1 } from '../js/data/stage1.js';

const mkSave = (stages = {}) => ({ version: 2, settings: {}, stages });
const three = (id) => (id >= 1 && id <= 3 ? { id } : null); // 1〜3面にデータがあると仮定した登録

test('ステージの登録：1面だけ', () => {
  assert.equal(getStage(1), STAGE1);
  assert.deepEqual(Object.keys(STAGES), ['1']);
  for (let i = 2; i <= 7; i++) assert.equal(getStage(i), null);
  assert.equal(getStage(0), null);
  assert.equal(getStage('__proto__'), null);
});

test('isStageAvailable：データがある面だけ', () => {
  assert.equal(isStageAvailable(1), true);
  assert.equal(isStageAvailable(2), false);
  assert.equal(isStageAvailable(3, three), true);
  assert.equal(isStageAvailable(4, three), false);
  assert.equal(isStageAvailable(0, three), false);
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
  const s = mkSave({ 1: { cleared: true, best: 1 } });
  assert.equal(isStagePlayable(s, 1), true);
  assert.equal(isStagePlayable(s, 2), false);       // 解放済みだがデータが無い（準備中）
  assert.equal(isStagePlayable(s, 2, three), true);
  assert.equal(isStagePlayable(s, 3, three), false); // データはあるが未解放
});

test('nextPlayableStage', () => {
  const s = mkSave({ 1: { cleared: true, best: 1 } });
  assert.equal(nextPlayableStage(s, 1), null);
  assert.equal(nextPlayableStage(s, 1, three), 2);
  assert.equal(nextPlayableStage(s, 2, three), null); // 2面が未クリア
  s.stages['2'] = { cleared: true, best: 1 };
  assert.equal(nextPlayableStage(s, 2, three), 3);
  assert.equal(nextPlayableStage(s, 3, three), null); // 4面のデータが無い
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
