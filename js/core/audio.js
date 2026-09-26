import { clamp } from './util.js';

// 前作から移植：効果音は WebAudio で合成する。BGMは <audio> 1本で、①では曲を流さない。
export function createAudio(settings) {
  let ctx = null;
  let master = null;
  const bgm = new Audio();
  bgm.loop = true;
  let bgmSrc = null;

  function applyVolumes() {
    if (master) master.gain.value = settings.muted ? 0 : settings.seVol;
    bgm.volume = settings.muted ? 0 : settings.bgmVol;
  }

  function tone(freq, duration, { type = 'sine', gain = 0.28, delay = 0, slideTo = null } = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const audio = {
    // ユーザー操作の中で呼ぶ（モバイルの自動再生制限の解除）
    unlock() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.connect(ctx.destination);
        applyVolumes();
      }
      if (ctx.state !== 'running') ctx.resume();
      if (bgmSrc && bgm.paused) bgm.play().catch(() => {});
    },
    suspend() {
      if (ctx?.state === 'running') ctx.suspend();
      if (!bgm.paused) bgm.pause();
    },
    setMuted(m) { settings.muted = m; applyVolumes(); },
    setSeVol(v) { settings.seVol = clamp(v, 0, 1); applyVolumes(); },
    setBgmVol(v) { settings.bgmVol = clamp(v, 0, 1); applyVolumes(); },
    playBgm(src) {
      if (src === bgmSrc) return;
      bgmSrc = src;
      if (!src) { bgm.pause(); return; }
      bgm.src = src;
      applyVolumes();
      bgm.play().catch(() => {});
    },
    se: {
      shoot: () => tone(880, 0.06, { type: 'square', gain: 0.05, slideTo: 440 }),
      hit: () => tone(520, 0.05, { type: 'triangle', gain: 0.12 }),
      kill: () => {
        tone(660, 0.07, { type: 'triangle', gain: 0.16 });
        tone(990, 0.1, { type: 'triangle', gain: 0.12, delay: 0.04 });
      },
      bossKill: () => {
        tone(392, 0.2, { type: 'square', gain: 0.18 });
        tone(523.25, 0.2, { type: 'square', gain: 0.18, delay: 0.12 });
        tone(783.99, 0.4, { type: 'square', gain: 0.2, delay: 0.24 });
      },
      damage: () => tone(220, 0.35, { type: 'sawtooth', gain: 0.3, slideTo: 55 }),
      clear: () => {
        tone(523.25, 0.12, { type: 'triangle', gain: 0.22 });
        tone(659.25, 0.12, { type: 'triangle', gain: 0.22, delay: 0.12 });
        tone(783.99, 0.12, { type: 'triangle', gain: 0.22, delay: 0.24 });
        tone(1046.5, 0.3, { type: 'triangle', gain: 0.24, delay: 0.36 });
      },
      gameOver: () => {
        tone(392, 0.25, { type: 'triangle', gain: 0.22 });
        tone(311.13, 0.25, { type: 'triangle', gain: 0.22, delay: 0.22 });
        tone(261.63, 0.5, { type: 'triangle', gain: 0.22, delay: 0.44 });
      },
      click: () => tone(440, 0.06, { type: 'sine', gain: 0.12 }),
    },
  };

  applyVolumes();
  return audio;
}
