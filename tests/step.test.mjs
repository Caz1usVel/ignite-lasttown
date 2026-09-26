import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { createEnemy } from '../js/game/enemies.js';
import { createBoss } from '../js/game/boss.js';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';
import { STAGE3 } from '../js/data/stage3.js';
import { STAGE4 } from '../js/data/stage4.js';
import { worldToScreen } from '../js/core/view.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';
import { chooseOffer } from '../js/game/powerups.js';

const EMPTY_STAGE = { id: 0, segments: [], spawnEnd: 1e9, boss: { type: 'bossA', params: {} } };
const DT = 1 / 60;
const idle = { turnAxis: 0, firing: false, aim: null, bulletSpeed: CONFIG.BULLET_SPEED_PC };
const fireUp = { turnAxis: 0, firing: true, aim: { x: 500, y: 100 }, bulletSpeed: CONFIG.BULLET_SPEED_PC };

function runUntil(state, controls, pred, maxSec = 10, autoChoose = false) {
  const all = [];
  for (let i = 0; i < Math.round(maxSec / DT); i++) {
    if (autoChoose && state.offer) chooseOffer(state, state.offer[0]);
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

// バランス確認：単純な自動操縦でステージをクリアできること。
// 自動操縦は狙いが完璧で、人間より強い。失敗した場合は、結果（到達時間・残機・ボスHP）を報告すること。
function autoPilot(st) {
  const t = st.turret;
  const cands = [...st.enemies, ...(st.boss && !st.boss.dead && !st.boss.hidden ? [st.boss] : [])];
  if (!cands.length) return idle;
  const target = cands.reduce((a, b) => (b.dist < a.dist ? b : a));
  let aimAngle = target.angle;
  if (target === st.boss && st.boss.arrived) {
    aimAngle += st.boss.dir * st.boss.p.drift * (target.dist / CONFIG.BULLET_SPEED_PC); // ボスは横移動を先読み
  }
  const diff = aimAngle - t.heading;
  const turnAxis = Math.abs(diff) > 3 ? Math.sign(diff) : 0;
  const p = worldToScreen(aimAngle, target.dist, t.heading, t.fov);
  return { turnAxis, firing: p.visible, aim: p.visible ? { x: p.x, y: p.y } : null, bulletSpeed: CONFIG.BULLET_SPEED_PC };
}

test('自動操縦で1面をクリアできる', () => {
  const s = createPlayState(STAGE1, mulberry32(3));
  runUntil(s, autoPilot, (st) => st.outcome, 400, true); // 選択が出たら先頭の候補を自動で選ぶ
  assert.equal(s.outcome, 'clear', `time=${s.time.toFixed(1)} lives=${s.turret.lives} bossHp=${s.boss?.hp}`);
});

test('自動操縦で2面をクリアできる（複数のシード）', () => {
  for (const seed of [3, 4, 5, 6, 7]) {
    const s = createPlayState(STAGE2, mulberry32(seed));
    runUntil(s, autoPilot, (st) => st.outcome, 500, true);
    assert.equal(s.outcome, 'clear',
      `seed=${seed} time=${s.time.toFixed(1)} lives=${s.turret.lives} bossHp=${s.boss?.hp}`);
    assert.ok(s.turret.lives >= 1);
  }
});

test('自動操縦で3面をクリアできる（複数のシード）', () => {
  for (const seed of [3, 4, 5, 6, 7]) {
    const s = createPlayState(STAGE3, mulberry32(seed));
    runUntil(s, autoPilot, (st) => st.outcome, 600, true);
    assert.equal(s.outcome, 'clear',
      `seed=${seed} time=${s.time.toFixed(1)} lives=${s.turret.lives} bossHp=${s.boss?.hp} phase=${s.boss?.phase}`);
    assert.ok(s.turret.lives >= 1);
  }
});

test('自動操縦で4面をクリアできる（複数のシード）', () => {
  for (const seed of [3, 4, 5, 6, 7]) {
    const s = createPlayState(STAGE4, mulberry32(seed));
    runUntil(s, autoPilot, (st) => st.outcome, 700, true);
    assert.equal(s.outcome, 'clear',
      `seed=${seed} time=${s.time.toFixed(1)} lives=${s.turret.lives} bossHp=${s.boss?.hp} phase=${s.boss?.phase}`);
    assert.ok(s.turret.lives >= 1);
  }
});

const meteorAhead = (s) => s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 300, speed: 0 }));

test('createPlayState：パワーアップの初期状態', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  assert.deepEqual(s.powerups, { fireRate: 0, damage: 0, pierce: 0, turnSpeed: 0, fov: 0, life: 0 });
  assert.equal(s.nextOfferAt, 10);
  assert.equal(s.offer, null);
});

test('撃破が10に届くと選択が発生し、stepGame は止まる', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.kills = 9;
  meteorAhead(s);
  const ev = runUntil(s, fireUp, (st) => st.offer !== null, 3);
  const offerEv = ev.find((e) => e.type === 'offer');
  assert.ok(offerEv);
  assert.equal(offerEv.choices.length, 2);
  assert.deepEqual(s.offer, offerEv.choices);
  assert.equal(s.nextOfferAt, 20);

  const t = s.time;
  assert.deepEqual(stepGame(s, DT, fireUp), []);
  assert.equal(s.time, t); // 時間が進まない
});

test('選択を確定すると再開し、次の発生は20体', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.kills = 9;
  meteorAhead(s);
  runUntil(s, fireUp, (st) => st.offer !== null, 3);
  const id = s.offer[0];
  assert.equal(chooseOffer(s, id), true);
  assert.equal(s.offer, null);
  const t = s.time;
  stepGame(s, DT, idle);
  assert.ok(s.time > t);
  s.kills = 19;
  meteorAhead(s);
  runUntil(s, fireUp, (st) => st.offer !== null, 3);
  assert.equal(s.nextOfferAt, 30);
});

test('ボス撃破でクリアする瞬間には選択を出さない', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.kills = 9;
  s.boss = createBoss('bossA', { hp: 1, drift: 0 });
  s.boss.dist = 380;
  runUntil(s, fireUp, (st) => st.outcome, 3);
  assert.equal(s.outcome, 'clear');
  assert.equal(s.offer, null);
});

test('残機以外がすべて上限なら、残機だけが提示される', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.powerups = { fireRate: 5, damage: 5, pierce: 3, turnSpeed: 4, fov: 3, life: 0 };
  s.kills = 9;
  meteorAhead(s);
  runUntil(s, fireUp, (st) => st.offer !== null, 3);
  assert.deepEqual(s.offer, ['life']);
});

test('選んだパワーアップが実際の射撃に効く（連射）', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.offer = ['fireRate', 'damage'];
  chooseOffer(s, 'fireRate');
  let shots = 0;
  for (let i = 0; i < 60 * 5; i++) shots += stepGame(s, DT, fireUp).filter((e) => e.type === 'fire').length;
  assert.ok(shots >= 21 && shots <= 24, `shots=${shots}`); // 基準値(4発/秒)なら20発。5秒 × 4.6発/秒 ≒ 22（フレーム単位の丸めで上下する）
});

test('ボスの hitCore が立つと、残機-1・ノックバック・damage イベントになり、hitCore は戻る', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.boss = createBoss('bossA');
  s.boss.dist = 380;
  s.boss.hitCore = true;
  const other = createEnemy('meteor', 60, s.rng, { dist: 150, speed: 0 });
  s.enemies.push(other);
  const ev = stepGame(s, DT, idle);
  assert.deepEqual(ev.filter((e) => e.type === 'damage'), [{ type: 'damage', lives: 2 }]);
  assert.equal(s.turret.lives, 2);
  assert.equal(s.boss.hitCore, false);
  assert.equal(other.dist, 230);
});

test('無敵中は hitCore でも残機が減らないが、hitCore は戻る', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.boss = createBoss('bossA');
  s.boss.dist = 380;
  s.turret.invincible = 1;
  s.boss.hitCore = true;
  stepGame(s, DT, idle);
  assert.equal(s.turret.lives, 3);
  assert.equal(s.boss.hitCore, false);
});
