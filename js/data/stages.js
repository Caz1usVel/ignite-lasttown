import { STAGE1 } from './stage1.js';
import { STAGE2 } from './stage2.js';
import { STAGE3 } from './stage3.js';
import { STAGE4 } from './stage4.js';
import { STAGE5 } from './stage5.js';
import { STAGE6 } from './stage6.js';
import { STAGE7 } from './stage7.js';

// 面の登録（1〜7面）
export const STAGES = Object.freeze({ 1: STAGE1, 2: STAGE2, 3: STAGE3, 4: STAGE4, 5: STAGE5, 6: STAGE6, 7: STAGE7 });

export function getStage(id) {
  return Object.prototype.hasOwnProperty.call(STAGES, id) ? STAGES[id] : null;
}

// 開始時のヒントの先頭に付ける、面の名前（例：「2面：上空・隕石帯（激化）　」）
export function stageLabel(stage) {
  if (stage.endless) return `${stage.name}　`;
  return stage.name ? `${stage.id}面：${stage.name}　` : `${stage.id}面　`;
}
