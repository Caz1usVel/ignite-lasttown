import { CONFIG } from './config.js';
import { getStage } from '../data/stages.js';

// getStageFn は、データのある面を差し替えてテストするための引数（通常は省略する）。

// その面のデータが登録されているか（未登録は「準備中」）
export function isStageAvailable(id, getStageFn = getStage) {
  return Number.isInteger(id) && id >= 1 && id <= CONFIG.STAGE_COUNT && getStageFn(id) !== null;
}

// 1面は最初から、以降は直前の面をクリアすると解放される
export function isStageUnlocked(save, id) {
  return id === 1 || save.stages[id - 1]?.cleared === true;
}

export function isStagePlayable(save, id, getStageFn = getStage) {
  return isStageAvailable(id, getStageFn) && isStageUnlocked(save, id);
}

export function nextPlayableStage(save, id, getStageFn = getStage) {
  const next = id + 1;
  return isStagePlayable(save, next, getStageFn) ? next : null;
}

// 結果をセーブデータに反映する（呼び出し側が persist する）。最高スコアはクリア・ゲームオーバーどちらでも記録する。
export function recordResult(save, id, outcome, score) {
  const entry = (save.stages[id] ??= { cleared: false, best: 0 });
  const newClear = outcome === 'clear' && !entry.cleared;
  if (outcome === 'clear') entry.cleared = true;
  const newBest = score > entry.best;
  if (newBest) entry.best = score;
  return { newBest, newClear };
}

// ハードエンドレスは、全ステージのクリアで解放される
export function isHardEndlessUnlocked(save) {
  for (let id = 1; id <= CONFIG.STAGE_COUNT; id++) {
    if (save.stages[id]?.cleared !== true) return false;
  }
  return true;
}

// エンドレスの結果を反映する（呼び出し側が persist する）。最高スコアを更新したときだけ、生存時間も更新する。
export function recordEndlessResult(save, kind, score, time) {
  save.endless ??= { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } };
  const entry = (save.endless[kind] ??= { best: 0, time: 0 });
  const newBest = score > entry.best;
  if (newBest) {
    entry.best = score;
    entry.time = time;
  }
  return { newBest };
}

// エンドレスの途中でやめたとき（ポーズ→タイトル）、その時点の記録を残す。
// 決着がついている（結果画面が記録する）場合や、エンドレスでない場合は、何もしない。
export function bankEndlessRun(save, run) {
  if (!run || !run.endless || run.outcome) return null;
  return recordEndlessResult(save, run.endless, run.score, run.time);
}
