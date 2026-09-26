import { STAGE1 } from './stage1.js';
import { STAGE2 } from './stage2.js';

// 面の登録。③b・③cで3〜7面のデータができたら、ここに1行ずつ足す。
export const STAGES = Object.freeze({ 1: STAGE1, 2: STAGE2 });

export function getStage(id) {
  return Object.prototype.hasOwnProperty.call(STAGES, id) ? STAGES[id] : null;
}

// 開始時のヒントの先頭に付ける、面の名前（例：「2面：上空・隕石帯（激化）　」）
export function stageLabel(stage) {
  return stage.name ? `${stage.id}面：${stage.name}　` : `${stage.id}面　`;
}
