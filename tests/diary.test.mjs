import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIARY, isDiaryUnlocked } from '../js/data/diary.js';
import { recordResult } from '../js/core/progress.js';
import { CONFIG } from '../js/core/config.js';

test('日記：ステージ数だけあり、1〜7が1つずつ。題名・本文は空でない。凍結されている', () => {
  assert.equal(DIARY.length, CONFIG.STAGE_COUNT);
  assert.deepEqual(DIARY.map((d) => d.stage), [1, 2, 3, 4, 5, 6, 7]);
  for (const d of DIARY) {
    assert.ok(typeof d.title === 'string' && d.title.length > 0);
    assert.ok(typeof d.body === 'string' && d.body.length >= 60, `stage ${d.stage} body too short`);
  }
  assert.equal(Object.isFrozen(DIARY), true);
});

test('日記の文面は、名前・性別・年齢を明示しない（一人称のみ）', () => {
  const text = DIARY.map((d) => d.title + d.body).join('\n');
  for (const word of ['彼女', '彼は', '男', '女', '歳', '才', 'さん']) assert.equal(text.includes(word), false, word);
});

test('isDiaryUnlocked：そのステージをクリアしていれば読める', () => {
  const save = { stages: { 1: { cleared: true, best: 5 }, 2: { cleared: false, best: 9 } } };
  assert.equal(isDiaryUnlocked(save, 1), true);
  assert.equal(isDiaryUnlocked(save, 2), false);
  assert.equal(isDiaryUnlocked(save, 3), false);
});

test('recordResult：newClear は、初めてクリアになったときだけ true', () => {
  const save = { stages: {} };
  assert.equal(recordResult(save, 1, 'gameover', 100).newClear, false);
  assert.equal(recordResult(save, 1, 'clear', 200).newClear, true);
  assert.equal(recordResult(save, 1, 'clear', 300).newClear, false);
  assert.equal(recordResult(save, 2, 'clear', 0).newClear, true);
});
