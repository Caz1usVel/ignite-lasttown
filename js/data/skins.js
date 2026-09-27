import { isHardEndlessUnlocked } from '../core/progress.js';

// 砲台の見た目（体・ほおの色だけを変える）。前作の「スキン」機能を、この作品向けに簡略化したもの。
export const SKINS = Object.freeze([
  Object.freeze({
    id: 'default', name: '既定', desc: '最初から使える、いつもの見た目。',
    body: '#bfe6ff', cheek: '#ffc2d1', unlock: Object.freeze({ type: 'default' }),
  }),
  Object.freeze({
    id: 'stage1', name: '夜明けカラー', desc: '1面をクリアすると使える。',
    body: '#ffd9a0', cheek: '#ffb3c6', unlock: Object.freeze({ type: 'stageClear', stage: 1 }),
  }),
  Object.freeze({
    id: 'allclear', name: '迎撃仕様', desc: '全7面をクリアすると使える。',
    body: '#ffe27a', cheek: '#ff9ecb', unlock: Object.freeze({ type: 'allClear' }),
  }),
  Object.freeze({
    id: 'endless-normal', name: '耐久カラー', desc: '通常エンドレスで3,000点以上を取ると使える。',
    body: '#8fe3c0', cheek: '#ffe0a3', unlock: Object.freeze({ type: 'score', mode: 'normal', value: 3000 }),
  }),
  Object.freeze({
    id: 'endless-hard', name: '最終防衛仕様', desc: 'ハードエンドレスで1,000点以上を取ると使える。',
    body: '#2b2f52', cheek: '#ff6b81', unlock: Object.freeze({ type: 'score', mode: 'hard', value: 1000 }),
  }),
]);

export function isSkinUnlocked(save, skin) {
  const u = skin.unlock;
  switch (u.type) {
    case 'default': return true;
    case 'stageClear': return save.stages?.[u.stage]?.cleared === true;
    case 'allClear': return isHardEndlessUnlocked(save); // 「全ステージクリア」の判定を再利用
    case 'score': return (save.endless?.[u.mode]?.best ?? 0) >= u.value;
    default: return false;
  }
}

export function getSkin(save, id) {
  const found = SKINS.find((s) => s.id === id);
  return found && isSkinUnlocked(save, found) ? found : SKINS[0];
}

export function selectedSkin(save) {
  return getSkin(save, save.selectedSkinId);
}
