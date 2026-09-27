import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, isSkinUnlocked, getSkin, selectedSkin } from '../js/data/skins.js';

const mkSave = (over = {}) => ({ stages: {}, endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } }, selectedSkinId: 'default', ...over });

test('SKINS：5件。1件目は既定（unlock.type=="default"）で、色を持つ。凍結されている', () => {
  assert.equal(SKINS.length, 5);
  assert.equal(Object.isFrozen(SKINS), true);
  const def = SKINS[0];
  assert.equal(def.unlock.type, 'default');
  for (const s of SKINS) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0);
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.body), s.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.cheek), s.id);
  }
  // 5種類の解放条件が、それぞれ1つ以上ある
  const types = new Set(SKINS.map((s) => s.unlock.type));
  for (const t of ['default', 'stageClear', 'allClear', 'score']) assert.ok(types.has(t), t);
});

test('isSkinUnlocked：既定は常に解放。stageClear・allClear・score の判定', () => {
  const def = SKINS.find((s) => s.unlock.type === 'default');
  assert.equal(isSkinUnlocked(mkSave(), def), true);

  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  const n = stageSkin.unlock.stage;
  assert.equal(isSkinUnlocked(mkSave(), stageSkin), false);
  assert.equal(isSkinUnlocked(mkSave({ stages: { [n]: { cleared: true, best: 1 } } }), stageSkin), true);

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
