import { STAGE1 } from './stage1.js';

// 面の登録。③で2〜7面のデータができたら、ここに1行ずつ足す。
export const STAGES = Object.freeze({ 1: STAGE1 });

export function getStage(id) {
  return Object.prototype.hasOwnProperty.call(STAGES, id) ? STAGES[id] : null;
}
