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
import { STAGE5 } from '../js/data/stage5.js';
import { STAGE6 } from '../js/data/stage6.js';

const mkSave = (stages = {}) => ({ version: 2, settings: {}, stages });
const cleared = (...ids) => mkSave(Object.fromEntries(ids.map((i) => [i, { cleared: true, best: 1 }])));
const seven = (id) => (id >= 1 && id <= 7 ? { id } : null); // 7面までデータがあると仮定した登録

test('ステージの登録：1〜6面', () => {
  const expected = [STAGE1, STAGE2, STAGE3, STAGE4, STAGE5, STAGE6];
  expected.forEach((stage, i) => assert.equal(getStage(i + 1), stage));
  assert.deepEqual(Object.keys(STAGES), ['1', '2', '3', '4', '5', '6']);
  assert.equal(getStage(7), null);
  assert.equal(getStage(0), null);
  assert.equal(getStage('__proto__'), null);
});

test('isStageAvailable：データがある面だけ', () => {
  for (const id of [1, 2, 3, 4, 5, 6]) assert.equal(isStageAvailable(id), true, `stage ${id}`);
  assert.equal(isStageAvailable(7), false);
  assert.equal(isStageAvailable(7, seven), true);
  assert.equal(isStageAvailable(0, seven), false);
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
  const all = cleared(1, 2, 3, 4, 5, 6);
  assert.equal(isStagePlayable(all, 6), true);
  assert.equal(isStagePlayable(all, 7), false);         // 解放済みだがデータが無い（準備中）
  assert.equal(isStagePlayable(all, 7, seven), true);
  assert.equal(isStagePlayable(cleared(1, 2, 3, 4, 5), 7, seven), false); // データはあるが未解放（6面が未クリア）
});

test('nextPlayableStage', () => {
  assert.equal(nextPlayableStage(cleared(1), 1), 2);
  assert.equal(nextPlayableStage(cleared(1), 2), null);      // 2面が未クリア
  assert.equal(nextPlayableStage(cleared(1, 2), 2), 3);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4), 4), 5);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4, 5), 5), 6);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4, 5, 6), 6), null);      // 7面のデータが無い
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4, 5, 6), 6, seven), 7);
  assert.equal(nextPlayableStage(cleared(1, 2, 3, 4, 5, 6, 7), 7, seven), null); // 最後の面
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
