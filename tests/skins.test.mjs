import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, isSkinUnlocked, getSkin, selectedSkin, redeemCode } from '../js/data/skins.js';
import { CODE_TO_SKIN } from '../js/data/codes.js';

const mkSave = (over = {}) => ({ stages: {}, endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } }, selectedSkinId: 'default', redeemedCodes: [], ...over });

test('SKINS：11件。1件目は既定（unlock.type=="default"）で、色を持つ。凍結されている', () => {
  assert.equal(SKINS.length, 11);
  assert.equal(Object.isFrozen(SKINS), true);
  const def = SKINS[0];
  assert.equal(def.unlock.type, 'default');
  for (const s of SKINS) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0);
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.body), s.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.cheek), s.id);
  }
  // 解放条件が、それぞれ1つ以上ある
  const types = new Set(SKINS.map((s) => s.unlock.type));
  for (const t of ['default', 'stageClear', 'allClear', 'score', 'code']) assert.ok(types.has(t), t);
});

test('isSkinUnlocked：既定は常に解放。stageClear・allClear・score の判定', () => {
  const def = SKINS.find((s) => s.unlock.type === 'default');
  assert.equal(isSkinUnlocked(mkSave(), def), true);

  const stageSkins = SKINS.filter((s) => s.unlock.type === 'stageClear');
  assert.ok(stageSkins.length >= 2, 'ステージクリアで解放するスキンが2つ以上ある');
  for (const stageSkin of stageSkins) {
    const n = stageSkin.unlock.stage;
    assert.equal(isSkinUnlocked(mkSave(), stageSkin), false, stageSkin.id);
    assert.equal(isSkinUnlocked(mkSave({ stages: { [n]: { cleared: true, best: 1 } } }), stageSkin), true, stageSkin.id);
  }

  const allSkin = SKINS.find((s) => s.unlock.type === 'allClear');
  const notAll = mkSave({ stages: { 1: { cleared: true, best: 1 }, 2: { cleared: true, best: 1 } } });
  assert.equal(isSkinUnlocked(notAll, allSkin), false);
  const all = mkSave({ stages: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { cleared: true, best: 1 }])) });
  assert.equal(isSkinUnlocked(all, allSkin), true);

  const scoreSkins = SKINS.filter((s) => s.unlock.type === 'score');
  assert.ok(scoreSkins.length >= 2, '通常・ハード、それぞれのスコアで解放するものがある');
  for (const s of scoreSkins) {
    const kind = s.unlock.mode; // 'normal' | 'hard'
    assert.ok(kind === 'normal' || kind === 'hard');
    const below = mkSave({ endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 }, [kind]: { best: s.unlock.value - 1, time: 0 } } });
    const above = mkSave({ endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 }, [kind]: { best: s.unlock.value, time: 0 } } });
    assert.equal(isSkinUnlocked(below, s), false, s.id);
    assert.equal(isSkinUnlocked(above, s), true, s.id);
  }
});

test('getSkin：未解放・存在しないIDなら既定を返す。解放済みならそのスキンを返す', () => {
  const save = mkSave();
  assert.equal(getSkin(save, 'no-such-id').unlock.type, 'default');
  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  assert.equal(getSkin(save, stageSkin.id).unlock.type, 'default'); // まだ未解放
  const unlocked = mkSave({ stages: { [stageSkin.unlock.stage]: { cleared: true, best: 1 } } });
  assert.equal(getSkin(unlocked, stageSkin.id).id, stageSkin.id);
});

test('selectedSkin：save.selectedSkinId から求める', () => {
  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  const save = mkSave({ selectedSkinId: stageSkin.id, stages: { [stageSkin.unlock.stage]: { cleared: true, best: 1 } } });
  assert.equal(selectedSkin(save).id, stageSkin.id);
});

test('isSkinUnlocked：code は redeemedCodes に、そのスキンへ対応するコードが含まれているときだけ解放', () => {
  const codeSkins = SKINS.filter((s) => s.unlock.type === 'code');
  assert.ok(codeSkins.length >= 2, '配布コードで解放するスキンが2つ以上ある');
  for (const skin of codeSkins) {
    const code = Object.entries(CODE_TO_SKIN).find(([, id]) => id === skin.id)?.[0];
    assert.ok(code, `${skin.id} に対応するコードがある`);
    assert.equal(isSkinUnlocked(mkSave(), skin), false);
    assert.equal(isSkinUnlocked(mkSave({ redeemedCodes: ['UNRELATED'] }), skin), false);
    assert.equal(isSkinUnlocked(mkSave({ redeemedCodes: [code] }), skin), true);
  }
  // 他のスキンのコードを持っていても、別のコードのスキンは解放されない
  const [a, b] = codeSkins;
  const codeA = Object.entries(CODE_TO_SKIN).find(([, id]) => id === a.id)[0];
  assert.equal(isSkinUnlocked(mkSave({ redeemedCodes: [codeA] }), b), false);
});

test('redeemCode：正しいコードで解放。2回目は「すでに解放済み」。存在しないコードは「不明」。空は「空」', () => {
  const [code, skinId] = Object.entries(CODE_TO_SKIN)[0];
  const save = mkSave();
  assert.deepEqual(redeemCode(save, code), { status: 'ok', skinId });
  assert.deepEqual(save.redeemedCodes, [code]);
  assert.deepEqual(redeemCode(save, code), { status: 'already', skinId });
  assert.deepEqual(save.redeemedCodes, [code]); // 重複しない
  assert.equal(redeemCode(save, 'NOSUCHCODE').status, 'unknown');
  assert.equal(redeemCode(save, '').status, 'empty');
  assert.equal(redeemCode(save, '   ').status, 'empty');
});

test('redeemCode：大文字・小文字・前後の空白を無視する。別のコードは個別に記録される（単一フラグではない）', () => {
  const [codeA, skinA] = Object.entries(CODE_TO_SKIN)[0];
  const [codeB, skinB] = Object.entries(CODE_TO_SKIN)[1];
  const save = mkSave();
  assert.deepEqual(redeemCode(save, `  ${codeA.toLowerCase()}  `), { status: 'ok', skinId: skinA });
  assert.deepEqual(redeemCode(save, codeB), { status: 'ok', skinId: skinB });
  assert.deepEqual([...save.redeemedCodes].sort(), [codeA, codeB].sort());
  const skinAObj = SKINS.find((s) => s.id === skinA);
  const skinBObj = SKINS.find((s) => s.id === skinB);
  assert.equal(isSkinUnlocked(save, skinAObj), true);
  assert.equal(isSkinUnlocked(save, skinBObj), true);
});

test('crimson-vanguard：金縁・紅いアクセント・専用の演出フラグを持つ。コードはハイフン無し・小文字でも通る', () => {
  const skin = SKINS.find((s) => s.id === 'crimson-vanguard');
  assert.ok(skin, 'crimson-vanguard が存在する');
  assert.equal(skin.unlock.type, 'code');
  assert.ok(/^#[0-9a-f]{6}$/i.test(skin.trim));
  assert.ok(/^#[0-9a-f]{6}$/i.test(skin.accent));
  assert.equal(skin.fx.crimsonVanguard, true);

  const code = Object.entries(CODE_TO_SKIN).find(([, id]) => id === 'crimson-vanguard')[0];
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/); // 8文字、4文字-4文字のハイフン区切り
  const save = mkSave();
  assert.deepEqual(redeemCode(save, code.replace('-', '').toLowerCase()), { status: 'ok', skinId: 'crimson-vanguard' });
  assert.deepEqual(save.redeemedCodes, [code]); // 記録は元の（ハイフン付き）コードの形にそろえる
  assert.equal(isSkinUnlocked(save, skin), true);
});

test('violet-thunder：白いアクセント・専用の演出フラグを持つ。コードはハイフン無し・小文字でも通る', () => {
  const skin = SKINS.find((s) => s.id === 'violet-thunder');
  assert.ok(skin, 'violet-thunder が存在する');
  assert.equal(skin.unlock.type, 'code');
  assert.ok(/^#[0-9a-f]{6}$/i.test(skin.accent));
  assert.equal(skin.fx.violetThunder, true);

  const code = Object.entries(CODE_TO_SKIN).find(([, id]) => id === 'violet-thunder')[0];
  assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  const save = mkSave();
  assert.deepEqual(redeemCode(save, code.replace('-', '').toLowerCase()), { status: 'ok', skinId: 'violet-thunder' });
  assert.deepEqual(save.redeemedCodes, [code]);
  assert.equal(isSkinUnlocked(save, skin), true);
});

test('frostbite-silver・celestial-gold：専用の演出フラグを持つ。コードはハイフン無し・小文字でも通る', () => {
  for (const [id, fxKey] of [['frostbite-silver', 'frostbiteSilver'], ['celestial-gold', 'celestialGold']]) {
    const skin = SKINS.find((s) => s.id === id);
    assert.ok(skin, `${id} が存在する`);
    assert.equal(skin.unlock.type, 'code');
    assert.ok(/^#[0-9a-f]{6}$/i.test(skin.accent), id);
    assert.equal(skin.fx[fxKey], true);

    const code = Object.entries(CODE_TO_SKIN).find(([, sid]) => sid === id)[0];
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    const save = mkSave();
    assert.deepEqual(redeemCode(save, code.replace('-', '').toLowerCase()), { status: 'ok', skinId: id });
    assert.deepEqual(save.redeemedCodes, [code]);
    assert.equal(isSkinUnlocked(save, skin), true);
  }
});

test('CODE_TO_SKIN：すべてのコードが8文字・4文字-4文字のハイフン区切りで、対応するスキンが実在する', () => {
  for (const [code, skinId] of Object.entries(CODE_TO_SKIN)) {
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/, code);
    assert.ok(SKINS.some((s) => s.id === skinId), `${code} -> ${skinId}`);
  }
});
