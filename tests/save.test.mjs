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

test('何も無ければ既定値', () => {
  const d = loadSave(memStorage());
  assert.deepEqual(d, { version: 1, settings: { muted: false, bgmVol: 0.6, seVol: 0.7 }, highScore: 0 });
});

test('書いて読むと戻る', () => {
  const st = memStorage();
  const d = loadSave(st);
  d.highScore = 1234;
  d.settings.muted = true;
  assert.equal(writeSave(d, st), true);
  assert.equal(loadSave(st).highScore, 1234);
  assert.equal(loadSave(st).settings.muted, true);
});

test('足りない設定項目は既定値で補う', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ version: 1, settings: { muted: true }, highScore: 5 }));
  const d = loadSave(st);
  assert.equal(d.settings.muted, true);
  assert.equal(d.settings.seVol, 0.7);
  assert.equal(d.highScore, 5);
});

test('壊れたデータ・違うバージョン・例外は既定値', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, '{broken');
  assert.equal(loadSave(st).highScore, 0);
  st.setItem(SAVE_KEY, JSON.stringify({ version: 99, highScore: 5 }));
  assert.equal(loadSave(st).highScore, 0);
  assert.equal(loadSave(throwingStorage).highScore, 0);
  assert.equal(writeSave(loadSave(throwingStorage), throwingStorage), false);
});

test('storage が無い環境（Node）でも落ちない', () => {
  assert.equal(loadSave().highScore, 0);
  assert.equal(writeSave(loadSave()), false);
});

test('範囲外の音量は 0..1 にクランプする', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ version: 1, settings: { bgmVol: 5, seVol: -1 }, highScore: 0 }));
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 1);
  assert.equal(d.settings.seVol, 0);
});

test('数値でない音量は既定値になる', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ version: 1, settings: { bgmVol: 'loud', seVol: null }, highScore: 0 }));
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 0.6);
  assert.equal(d.settings.seVol, 0.7);
});

test('真偽値でない muted は既定値になる', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, JSON.stringify({ version: 1, settings: { muted: 'yes' }, highScore: 0 }));
  const d = loadSave(st);
  assert.equal(d.settings.muted, false);
});
