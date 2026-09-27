import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, SAVE_KEY } from '../js/core/save.js';

const memStorage = () => ({
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
});
const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
};
const DEFAULTS = { version: 2, settings: { muted: false, bgmVol: 0.6, seVol: 0.7 }, stages: {}, endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } }, tutorialSeen: false, selectedSkinId: 'default' };
const put = (st, obj) => st.setItem(SAVE_KEY, JSON.stringify(obj));

test('何も無ければ既定値（v2）', () => {
  assert.deepEqual(loadSave(memStorage()), DEFAULTS);
});

test('書いて読むと戻る', () => {
  const st = memStorage();
  const d = loadSave(st);
  d.stages['1'] = { cleared: true, best: 1234 };
  d.settings.muted = true;
  assert.equal(writeSave(d, st), true);
  const back = loadSave(st);
  assert.deepEqual(back.stages, { 1: { cleared: true, best: 1234 } });
  assert.equal(back.settings.muted, true);
  assert.equal(back.version, 2);
});

test('足りない設定項目は既定値で補う', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { muted: true }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.muted, true);
  assert.equal(d.settings.seVol, 0.7);
});

test('v1 からの移行：設定を引き継ぎ、highScore は1面の最高スコアになる（未クリア）', () => {
  const st = memStorage();
  put(st, { version: 1, settings: { muted: true, bgmVol: 0.2, seVol: 0.9 }, highScore: 4321 });
  const d = loadSave(st);
  assert.equal(d.version, 2);
  assert.deepEqual(d.settings, { muted: true, bgmVol: 0.2, seVol: 0.9 });
  assert.deepEqual(d.stages, { 1: { cleared: false, best: 4321 } });
  assert.equal('highScore' in d, false);
});

test('v1 で highScore が0や不正なら、stages は空', () => {
  const st = memStorage();
  put(st, { version: 1, settings: {}, highScore: 0 });
  assert.deepEqual(loadSave(st).stages, {});
  put(st, { version: 1, settings: {}, highScore: 'many' });
  assert.deepEqual(loadSave(st).stages, {});
});

test('壊れたデータ・未知のバージョン・例外は既定値', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(st), DEFAULTS);
  put(st, { version: 99, stages: { 1: { cleared: true, best: 5 } } });
  assert.deepEqual(loadSave(st), DEFAULTS);
  put(st, { version: 3 });
  assert.deepEqual(loadSave(st), DEFAULTS);
  st.setItem(SAVE_KEY, 'null');
  assert.deepEqual(loadSave(st), DEFAULTS);
  assert.deepEqual(loadSave(throwingStorage), DEFAULTS);
  assert.equal(writeSave(loadSave(throwingStorage), throwingStorage), false);
});

test('storage が無い環境（Node）でも落ちない', () => {
  assert.deepEqual(loadSave(), DEFAULTS);
  assert.equal(writeSave(loadSave()), false);
});

test('stages の検証：不正な値は補正し、不正なキーは無視する', () => {
  const st = memStorage();
  put(st, {
    version: 2,
    settings: {},
    stages: {
      1: { cleared: 'yes', best: -5 },
      2: { cleared: true, best: 'x' },
      3: { cleared: true, best: 700 },
      0: { cleared: true, best: 1 },
      8: { cleared: true, best: 1 },
      abc: { cleared: true, best: 1 },
      '1.5': { cleared: true, best: 1 },
      4: null,
    },
  });
  assert.deepEqual(loadSave(st).stages, {
    1: { cleared: false, best: 0 },
    2: { cleared: true, best: 0 },
    3: { cleared: true, best: 700 },
    4: { cleared: false, best: 0 },
  });
});

test('stages が配列や文字列でも落ちない', () => {
  const st = memStorage();
  put(st, { version: 2, settings: {}, stages: 'oops' });
  assert.deepEqual(loadSave(st).stages, {});
  put(st, { version: 2, settings: {}, stages: null });
  assert.deepEqual(loadSave(st).stages, {});
});

test('範囲外の音量は 0..1 にクランプする', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { bgmVol: 5, seVol: -1 }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 1);
  assert.equal(d.settings.seVol, 0);
});

test('数値でない音量は既定値になる', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { bgmVol: 'loud', seVol: null }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 0.6);
  assert.equal(d.settings.seVol, 0.7);
});

test('真偽値でない muted は既定値になる', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { muted: 'yes' }, stages: {} });
  assert.equal(loadSave(st).settings.muted, false);
});

test('エンドレスの記録：既定は 0。保存・読み込みで保たれ、壊れた値は 0 に直る。v1 からの移行でも入る', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.deepEqual(fresh.endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.endless.normal = { best: 1200, time: 245.5 };
  data.endless.hard.best = 300;
  writeSave(data, storage);
  const back = loadSave(storage);
  assert.deepEqual(back.endless.normal, { best: 1200, time: 245.5 });
  assert.deepEqual(back.endless.hard, { best: 300, time: 0 });
  const broken = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {}, endless: { normal: { best: -5, time: 'x' }, hard: 7, extra: 1 } }), setItem() {} };
  assert.deepEqual(loadSave(broken).endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const v1 = { getItem: () => JSON.stringify({ version: 1, highScore: 400, settings: {} }), setItem() {} };
  assert.deepEqual(loadSave(v1).endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const v2old = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: { 1: { cleared: true, best: 5 } } }), setItem() {} };
  assert.deepEqual(loadSave(v2old).endless.normal, { best: 0, time: 0 });
});

test('tutorialSeen：既定は false。保存・読み込みで保たれ、v1からの移行でも false になる', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.equal(fresh.tutorialSeen, false);
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.tutorialSeen = true;
  writeSave(data, storage);
  assert.equal(loadSave(storage).tutorialSeen, true);
  const v1 = { getItem: () => JSON.stringify({ version: 1, settings: {} }), setItem() {} };
  assert.equal(loadSave(v1).tutorialSeen, false);
  const oldV2 = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {} }), setItem() {} }; // tutorialSeen の欄が無い古いセーブ
  assert.equal(loadSave(oldV2).tutorialSeen, false);
});

test('selectedSkinId：既定は "default"。保存・読み込みで保たれ、壊れた値は既定に戻る', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.equal(fresh.selectedSkinId, 'default');
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.selectedSkinId = 'stage1';
  writeSave(data, storage);
  assert.equal(loadSave(storage).selectedSkinId, 'stage1');
  const broken = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {}, selectedSkinId: 123 }), setItem() {} };
  assert.equal(loadSave(broken).selectedSkinId, 'default');
});
