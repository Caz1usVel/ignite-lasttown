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
  if (outcome === 'clear') entry.cleared = true;
  const newBest = score > entry.best;
  if (newBest) entry.best = score;
  return { newBest };
}
