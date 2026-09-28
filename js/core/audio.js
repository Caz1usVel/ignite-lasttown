import { clamp } from './util.js';

// 前作から移植：効果音は WebAudio で合成する。BGMは <audio> 1本で、①では曲を流さない。
export function createAudio(settings) {
  let ctx = null;
  let master = null;
  // iOS SafariはBGM要素の.volumeへの書き込みを無視する仕様（ハード音量ボタンでしか変えられない）ため、
  // BGMの音量制御はゲインノード（bgmGain）経由で行い、<audio>要素の.volume/.mutedには触れない
  let bgmGain = null;
  const bgm = new Audio();
  bgm.loop = true;
  let bgmSrc = null;

  // 一部の効果音（発射・クリア・ゲームオーバー・ボス突入）は、音声ファイルから鳴らす。
  // 読み込みが終わるまで（または失敗したときは）合成音にフォールバックする。
  const SE_FILES = { shoot: 'se/shoot.mp3', clear: 'se/clear.mp3', gameOver: 'se/gameover.mp3', bossAlert: 'se/bossalert.mp3' };
  const seBuffers = {};
  let seBuffersPromise = null;
  function loadSeBuffers() {
    if (seBuffersPromise || !ctx) return;
    seBuffersPromise = Promise.all(
      Object.entries(SE_FILES).map(([name, src]) =>
        fetch(src)
          .then((r) => r.arrayBuffer())
          .then((buf) => ctx.decodeAudioData(buf))
          .then((decoded) => { seBuffers[name] = decoded; })
          .catch(() => {}), // 読み込めなくても、合成音のフォールバックで足りる
      ),
    );
  }
  // 再生できたら true。onEnded を渡すと、再生し終わったタイミングで呼ぶ（ボス突入音の2連続再生に使う）
  function playSeBuffer(name, onEnded) {
    if (!ctx || !seBuffers[name] || ctx.state !== 'running') return false;
    const src = ctx.createBufferSource();
    src.buffer = seBuffers[name];
    src.connect(master);
    if (onEnded) src.onended = onEnded;
    src.start();
    return true;
  }

  function applyVolumes() {
    if (master) master.gain.value = settings.muted ? 0 : settings.seVol;
    if (bgmGain) bgmGain.gain.value = settings.muted ? 0 : settings.bgmVol;
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
        bgmGain = ctx.createGain();
        bgmGain.connect(ctx.destination);
        // createMediaElementSourceは同じ要素に対して1回しか呼べないため、ctx生成時にここで1度だけ作る
        const bgmSource = ctx.createMediaElementSource(bgm);
        bgmSource.connect(bgmGain);
        applyVolumes();
        loadSeBuffers();
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
      shoot: () => { if (!playSeBuffer('shoot')) tone(880, 0.06, { type: 'square', gain: 0.05, slideTo: 440 }); },
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
        if (playSeBuffer('clear')) return;
        tone(523.25, 0.12, { type: 'triangle', gain: 0.22 });
        tone(659.25, 0.12, { type: 'triangle', gain: 0.22, delay: 0.12 });
        tone(783.99, 0.12, { type: 'triangle', gain: 0.22, delay: 0.24 });
        tone(1046.5, 0.3, { type: 'triangle', gain: 0.24, delay: 0.36 });
      },
      gameOver: () => {
        if (playSeBuffer('gameOver')) return;
        tone(392, 0.25, { type: 'triangle', gain: 0.22 });
        tone(311.13, 0.25, { type: 'triangle', gain: 0.22, delay: 0.22 });
        tone(261.63, 0.5, { type: 'triangle', gain: 0.22, delay: 0.44 });
      },
      // ボス突入音。onEnded を渡すと、再生し終わった時に呼ぶ（呼び出し側が2回連続で鳴らすのに使う）。
      // ファイルが無い/読み込めない場合は、短い合成音を1回鳴らし、おおよその再生時間の後に onEnded を呼ぶ
      bossAlert: (onEnded) => {
        if (playSeBuffer('bossAlert', onEnded)) return;
        tone(660, 0.14, { type: 'square', gain: 0.2 });
        tone(880, 0.14, { type: 'square', gain: 0.2, delay: 0.16 });
        if (onEnded) setTimeout(onEnded, 320);
      },
      click: () => tone(440, 0.06, { type: 'sine', gain: 0.12 }),
      offer: () => {
        tone(660, 0.08, { type: 'triangle', gain: 0.18 });
        tone(880, 0.08, { type: 'triangle', gain: 0.18, delay: 0.08 });
        tone(1320, 0.14, { type: 'triangle', gain: 0.2, delay: 0.16 });
      },
      pick: () => {
        tone(784, 0.07, { type: 'square', gain: 0.12 });
        tone(1046.5, 0.12, { type: 'square', gain: 0.14, delay: 0.06 });
      },
      heal: () => {
        tone(660, 0.08, { type: 'triangle', gain: 0.16 });
        tone(880, 0.1, { type: 'triangle', gain: 0.16, delay: 0.07 });
        tone(1320, 0.16, { type: 'triangle', gain: 0.18, delay: 0.14 });
      },
      block: () => tone(1200, 0.05, { type: 'square', gain: 0.1, slideTo: 900 }),
      jam: () => {
        tone(180, 0.25, { type: 'sawtooth', gain: 0.18, slideTo: 90 });
        tone(140, 0.25, { type: 'square', gain: 0.1, delay: 0.05, slideTo: 70 });
      },
    },
  };

  applyVolumes();
  return audio;
}
