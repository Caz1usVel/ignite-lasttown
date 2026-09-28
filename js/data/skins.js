import { isHardEndlessUnlocked } from '../core/progress.js';
import { CODE_TO_SKIN } from './codes.js';

// 砲台の見た目（装甲・側面パネルの色だけを変える）。前作の「スキン」機能を、この作品向けに簡略化したもの。
// trim（金縁）・accent（アクセントラインの色）・fx は、特別な演出を持つスキンだけが使う（無ければ既定の見た目のまま）。
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
    body: '#3a3f68', cheek: '#ff6b81', unlock: Object.freeze({ type: 'score', mode: 'hard', value: 1000 }),
  }),
  Object.freeze({
    id: 'code-crimson', name: '緋色迷彩', desc: '配布コードで解放される、特別な見た目。',
    body: '#8a2e2e', cheek: '#e0a56b', unlock: Object.freeze({ type: 'code' }),
  }),
  Object.freeze({
    id: 'code-violet', name: '深紫迷彩', desc: '配布コードで解放される、特別な見た目。',
    body: '#4a2e6b', cheek: '#b98fe0', unlock: Object.freeze({ type: 'code' }),
  }),
  Object.freeze({
    id: 'crimson-vanguard', name: 'クリムゾン・ヴァンガード（仮称）',
    desc: 'サブスク限定の特別な見た目。黒地に金縁の装甲、常時発光する紅いライン、砲身から立ち上る金の粒子、燃える彗星のような弾。',
    body: '#181818', cheek: '#caa33b', trim: '#d4af37', accent: '#c81e3a',
    unlock: Object.freeze({ type: 'code' }),
    fx: Object.freeze({ crimsonVanguard: true }),
  }),
  Object.freeze({
    id: 'violet-thunder', name: 'ヴァイオレット・サンダー（仮称）',
    desc: 'サブスク限定の特別な見た目。藍紫の装甲に白い稲妻ライン、間欠的に弾ける電気の火花、不規則に明滅するビーコン、ジグザグの稲妻弾。',
    body: '#2a1a4d', cheek: '#8f7cff', accent: '#f0f0ff',
    unlock: Object.freeze({ type: 'code' }),
    fx: Object.freeze({ violetThunder: true }),
  }),
]);

export function isSkinUnlocked(save, skin) {
  const u = skin.unlock;
  switch (u.type) {
    case 'default': return true;
    case 'stageClear': return save.stages?.[u.stage]?.cleared === true;
    case 'allClear': return isHardEndlessUnlocked(save); // 「全ステージクリア」の判定を再利用
    case 'score': return (save.endless?.[u.mode]?.best ?? 0) >= u.value;
    case 'code': return (save.redeemedCodes ?? []).some((c) => CODE_TO_SKIN[c] === skin.id);
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

// 大文字化してハイフン・空白を取り除いた形で比較する（コードを空白付き・ハイフン無しで入力しても通るように）
function normalizeCode(raw) {
  return String(raw ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

// 正規化した文字列 → 元のコード（CODE_TO_SKIN のキー）。解放の記録には、元のコードをそのまま使う。
const NORMALIZED_TO_CODE = Object.fromEntries(
  Object.keys(CODE_TO_SKIN).map((code) => [normalizeCode(code), code]),
);

// コードを解放する（呼び出し側が persist する）。コードごとに個別管理（単一の解放フラグではない）。
export function redeemCode(save, rawCode) {
  const normalized = normalizeCode(rawCode);
  if (!normalized) return { status: 'empty' };
  const code = NORMALIZED_TO_CODE[normalized];
  if (!code) return { status: 'unknown' };
  const skinId = CODE_TO_SKIN[code];
  save.redeemedCodes ??= [];
  if (save.redeemedCodes.includes(code)) return { status: 'already', skinId };
  save.redeemedCodes.push(code);
  return { status: 'ok', skinId };
}
