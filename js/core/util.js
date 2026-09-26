export const DEG = Math.PI / 180;

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(rng, lo, hi) {
  return lo + (hi - lo) * rng();
}

// lo〜hi の整数を等確率で返す（両端を含む）
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// 中心 center から half 度以上離れた、-limit〜+limit の角度を、区間の長さで重み付けして一様に選ぶ。
// 区間が無ければ、center ≥ 0 なら -limit、そうでなければ +limit を返す。
export function pickAngleOutside(center, half, rng, limit = 90) {
  const spans = [
    { lo: -limit, hi: center - half },
    { lo: center + half, hi: limit },
  ].filter((s) => s.hi > s.lo);
  if (spans.length === 0) return center >= 0 ? -limit : limit;
  const total = spans.reduce((sum, s) => sum + (s.hi - s.lo), 0);
  let r = rng() * total;
  for (const s of spans) {
    const len = s.hi - s.lo;
    if (r < len) return s.lo + r;
    r -= len;
  }
  return spans[spans.length - 1].hi;
}

// シード付き乱数（テストとリプレイ用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 前作から移植：amt>0 で白に寄せ、amt<0 で暗くする
export function lightenColor(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * amt)));
  const darken = (c) => Math.max(0, Math.min(255, Math.round(c * (1 + amt))));
  r = amt >= 0 ? mix(r) : darken(r);
  g = amt >= 0 ? mix(g) : darken(g);
  b = amt >= 0 ? mix(b) : darken(b);
  return `rgb(${r},${g},${b})`;
}

// '#rrggbb' → 'rgba(r,g,b,alpha)'（ボスのオーラの色を、ボスの色から導くのに使う）
export function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
