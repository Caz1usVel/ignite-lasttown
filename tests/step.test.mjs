import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { createEnemy } from '../js/game/enemies.js';
import { createBoss } from '../js/game/boss.js';
import { STAGE1 } from '../js/data/stage1.js';
import { worldToScreen } from '../js/core/view.js';
import { mulberry32 } from '../js/core/util.js';

const EMPTY_STAGE = { id: 0, segments: [], spawnEnd: 1e9, boss: { type: 'bossA', params: {} } };
const DT = 1 / 60;
const idle = { turnAxis: 0, firing: false, aim: null, bulletSpeed: 600 };
const fireUp = { turnAxis: 0, firing: true, aim: { x: 500, y: 100 }, bulletSpeed: 600 };

function runUntil(state, controls, pred, maxSec = 10) {
  const all = [];
  for (let i = 0; i < Math.round(maxSec / DT); i++) {
    const ev = stepGame(state, DT, typeof controls === 'function' ? controls(state) : controls);
    all.push(...ev);
    if (pred(state, ev)) break;
  }
  return all;
}

test('真上を狙って撃つと角度0の弾が出る', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  const ev = stepGame(s, DT, fireUp);
  assert.deepEqual(ev.map((e) => e.type), ['fire']);
  assert.ok(Math.abs(ev[0].angle) < 1e-9);
  assert.equal(s.bullets.length, 1);
});

test('正面の隕石を撃ち落とすとスコア100・撃破1', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 300 }));
  const ev = runUntil(s, fireUp, (st) => st.kills > 0, 2);
  assert.ok(ev.some((e) => e.type === 'kill'));
  assert.equal(s.score, 100);
  assert.equal(s.kills, 1);
  assert.equal(s.enemies.length, 0);
});

test('敵が中心に届くと被弾、近くの敵は押し戻される', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 41, speed: 100 }));
  const other = createEnemy('meteor', 60, s.rng, { dist: 150, speed: 0 });
  s.enemies.push(other);
  const ev = stepGame(s, 0.05, idle);
  assert.deepEqual(ev.filter((e) => e.type === 'damage'), [{ type: 'damage', lives: 2 }]);
  assert.equal(s.turret.lives, 2);
  assert.equal(other.dist, 230);
});

test('残機0でゲームオーバー、その後は進まない', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.turret.lives = 1;
  s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 41, speed: 100 }));
  const ev = stepGame(s, 0.05, idle);
  assert.ok(ev.some((e) => e.type === 'gameover'));
  assert.equal(s.outcome, 'gameover');
  const t = s.time;
  assert.deepEqual(stepGame(s, 0.05, idle), []);
  assert.equal(s.time, t);
});

test('ボス撃破でクリア、スコア5000', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.boss = createBoss('bossA', { hp: 1, drift: 0 });
  s.boss.dist = 380;
  const ev = runUntil(s, fireUp, (st) => st.outcome, 3);
  assert.ok(ev.some((e) => e.type === 'clear'));
  assert.equal(s.outcome, 'clear');
  assert.equal(s.score, 5000);
  assert.equal(s.kills, 1);
});

test('何もしなければ1面はゲームオーバーになる', () => {
  const s = createPlayState(STAGE1, mulberry32(2));
  runUntil(s, idle, (st) => st.outcome, 120);
  assert.equal(s.outcome, 'gameover');
});

// バランス確認：単純な自動操縦で1面をクリアできること。
// 失敗した場合は数値を勝手に変えず、結果（到達時間・残機・ボスHP）を報告すること。
test('自動操縦で1面をクリアできる', () => {
  const s = createPlayState(STAGE1, mulberry32(3));
  const bot = (st) => {
    const t = st.turret;
    const cands = [...st.enemies, ...(st.boss && !st.boss.dead ? [st.boss] : [])];
    if (!cands.length) return idle;
    const target = cands.reduce((a, b) => (b.dist < a.dist ? b : a));
    let aimAngle = target.angle;
    if (target === st.boss && st.boss.arrived) {
      aimAngle += st.boss.dir * st.boss.p.drift * (target.dist / 600); // ボスは横移動を先読み
    }
    const diff = aimAngle - t.heading;
    const turnAxis = Math.abs(diff) > 3 ? Math.sign(diff) : 0;
    const p = worldToScreen(aimAngle, target.dist, t.heading, t.fov);
    return { turnAxis, firing: p.visible, aim: p.visible ? { x: p.x, y: p.y } : null, bulletSpeed: 600 };
  };
  runUntil(s, bot, (st) => st.outcome, 400);
  assert.equal(s.outcome, 'clear', `time=${s.time.toFixed(1)} lives=${s.turret.lives} bossHp=${s.boss?.hp}`);
});
