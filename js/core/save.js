import { CONFIG } from './config.js';

// キー名は v1 の頃のまま。変えると既存の保存が読めなくなるため（中身の version で世代を区別する）。
export const SAVE_KEY = 'td_save_v1';
export const SAVE_VERSION = 2;

const DEFAULT_SETTINGS = Object.freeze({ muted: false, bgmVol: 0.6, seVol: 0.7 });

function defaultEndless() {
  return { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } };
}

function defaults() {
  return { version: SAVE_VERSION, settings: { ...DEFAULT_SETTINGS }, stages: {}, endless: defaultEndless(), tutorialSeen: false, selectedSkinId: 'default', redeemedCodes: [] };
}

// 配布コードで解放したスキンの記録。コードごとに個別に持つ（1件ずつ、文字列のみ、重複なし）。
function sanitizeRedeemedCodes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    if (typeof c === 'string' && c.length > 0 && c.length <= 40 && !out.includes(c)) out.push(c);
    if (out.length >= 200) break; // 際限なく増やさない
  }
  return out;
}

function sanitizeEndless(raw) {
  const out = defaultEndless();
  if (!raw || typeof raw !== 'object') return out;
  for (const kind of ['normal', 'hard']) {
    const e = raw[kind];
    if (!e || typeof e !== 'object') continue;
    out[kind] = {
      best: Number.isFinite(e.best) && e.best > 0 ? e.best : 0,
      time: Number.isFinite(e.time) && e.time > 0 ? e.time : 0,
    };
  }
  return out;
}

// localStorage へのアクセス自体が例外を投げる環境（Safariのプライベートモード等）がある
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function clampVol(v, fallback) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function sanitizeSettings(s) {
  const merged = { ...DEFAULT_SETTINGS, ...s };
  return {
    muted: typeof merged.muted === 'boolean' ? merged.muted : DEFAULT_SETTINGS.muted,
    bgmVol: clampVol(merged.bgmVol, DEFAULT_SETTINGS.bgmVol),
    seVol: clampVol(merged.seVol, DEFAULT_SETTINGS.seVol),
  };
}

// キーは 1〜STAGE_COUNT の整数の文字列だけを受け付ける
function sanitizeStages(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, entry] of Object.entries(raw)) {
    if (!/^[1-9]\d*$/.test(key)) continue;
    const id = Number(key);
    if (id < 1 || id > CONFIG.STAGE_COUNT) continue;
    out[key] = {
      cleared: entry?.cleared === true,
      best: Number.isFinite(entry?.best) && entry.best > 0 ? entry.best : 0,
    };
  }
  return out;
}

export function loadSave(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    if (d?.version === 1) {
      // v1 → v2：設定を引き継ぎ、highScore は1面の最高スコアにする（v1にクリアの記録は無いので未クリア）
      const stages = {};
      if (Number.isFinite(d.highScore) && d.highScore > 0) stages['1'] = { cleared: false, best: d.highScore };
      return { version: SAVE_VERSION, settings: sanitizeSettings(d.settings), stages, endless: defaultEndless(), tutorialSeen: d.tutorialSeen === true, selectedSkinId: typeof d.selectedSkinId === 'string' ? d.selectedSkinId : 'default', redeemedCodes: [] };
    }
    if (d?.version === SAVE_VERSION) {
      const stages = sanitizeStages(d.stages);
      const endless = sanitizeEndless(d.endless);
      // 既存プレイヤー（このブランチより前のセーブ）は tutorialSeen が無いため false になり、
      // クリア済みでもチュートリアルが強制表示されてしまう。進捗（クリア済みステージ or エンドレス記録）があれば
      // 既に見たものとみなし、既存プレイヤーの体験を邪魔しない。新規プレイヤーは進捗が無いので影響しない。
      const hasProgress = Object.values(stages).some((s) => s.cleared === true) || endless.normal.best > 0 || endless.hard.best > 0;
      return { version: SAVE_VERSION, settings: sanitizeSettings(d.settings), stages, endless, tutorialSeen: d.tutorialSeen === true || hasProgress, selectedSkinId: typeof d.selectedSkinId === 'string' ? d.selectedSkinId : 'default', redeemedCodes: sanitizeRedeemedCodes(d.redeemedCodes) };
    }
    return defaults();
  } catch {
    return defaults();
  }
}

export function writeSave(data, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}
