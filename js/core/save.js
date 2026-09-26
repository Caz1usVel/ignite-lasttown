export const SAVE_KEY = 'td_save_v1';

const DEFAULTS = Object.freeze({
  version: 1,
  settings: Object.freeze({ muted: false, bgmVol: 0.6, seVol: 0.7 }),
  highScore: 0,
});

function defaults() {
  return { ...DEFAULTS, settings: { ...DEFAULTS.settings } };
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

function sanitizeSettings(base, s) {
  const merged = { ...base, ...s };
  return {
    muted: typeof merged.muted === 'boolean' ? merged.muted : base.muted,
    bgmVol: clampVol(merged.bgmVol, base.bgmVol),
    seVol: clampVol(merged.seVol, base.seVol),
  };
}

export function loadSave(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    if (d?.version !== DEFAULTS.version) return defaults();
    const base = defaults();
    return {
      ...base,
      highScore: Number.isFinite(d.highScore) ? d.highScore : 0,
      settings: sanitizeSettings(base.settings, d.settings),
    };
  } catch {
    return defaults();
  }
}

export function writeSave(data, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
