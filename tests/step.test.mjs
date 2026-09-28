import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { createEnemy } from '../js/game/enemies.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { createBoss } from '../js/game/boss.js';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';
import { STAGE3 } from '../js/data/stage3.js';
import { STAGE4 } from '../js/data/stage4.js';
import { STAGE5 } from '../js/data/stage5.js';
import { STAGE6 } from '../js/data/stage6.js';
import { STAGE7 } from '../js/data/stage7.js';
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

test('エンドレスでボスが出現する瞬間、残っている雑魚を消し、bossIncomingを出し、突入演出の間だけボスの行動を止める', () => {
  const stage = { id: 'test-endless', endless: { kind: 'normal', base: 2.6, decay: 0.9, floor: 0.9, bossEvery: 0.1 }, segments: [], spawnEnd: Infinity, boss: null };
  const s = createPlayState(stage, mulberry32(1));
  s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 300, speed: 0 }));

  let seenIncoming = false;
  let sawBoss = false;
  for (let i = 0; i < 60 && !seenIncoming; i++) {
    const ev = stepGame(s, DT, idle);
    if (ev.some((e) => e.type === 'bossIncoming')) seenIncoming = true;
  }
  assert.equal(seenIncoming, true);
  assert.ok(s.boss); // ボスは出現している
  assert.equal(s.enemies.length, 0); // 出現していた雑魚は消えている
  assert.ok(s.bossFreeze > 0);
  assert.equal(s.boss.dist, CONFIG.SPAWN_DIST); // 突入演出の間は、ボスの行動（移動）が止まっている

  // 突入演出の時間が経つまでは、ボスは動かない
  for (let i = 0; i < Math.round((CONFIG.BOSS_INTRO_FREEZE - DT) / DT); i++) {
    stepGame(s, DT, idle);
    sawBoss = sawBoss || s.boss.dist !== CONFIG.SPAWN_DIST;
  }
  assert.equal(sawBoss, false);
  assert.ok(s.bossFreeze > 0);

  // 突入演出が終わると、以後はボスの行動（移動）が始まる
  for (let i = 0; i < 10 && s.boss.dist === CONFIG.SPAWN_DIST; i++) stepGame(s, DT, idle);
  assert.equal(s.bossFreeze, 0);
  assert.ok(s.boss.dist < CONFIG.SPAWN_DIST);
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
  // 時間で開くボスCの盾は撃っても吸収されるので狙わない。耐久のある盾（シールド敵）は、撃って壊す
  const cands = [...st.enemies, ...(st.boss && !st.boss.dead && !st.boss.hidden ? [st.boss] : [])].filter((e) => !e.shielded || e.shieldHp > 0);
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

// 自動操縦で複数のシードを走らせる。乱数の流れが変わって、固定のシードが偶然落ちるのを避けるため、
// 「5回中4回以上クリアし、クリアしたものは残機が1つ以上残る」で見る。失敗メッセージには、全シードの結果を出す。
function clearSummary(stage, maxSec, seeds = [3, 4, 5, 6, 7]) {
  return seeds.map((seed) => {
    const s = createPlayState(stage, mulberry32(seed));
    runUntil(s, autoPilot, (st) => st.outcome, maxSec, true);
    return { seed, outcome: s.outcome, time: Math.round(s.time), lives: s.turret.lives, bossHp: s.boss?.hp, phase: s.boss?.phase };
  });
}
function assertMostlyClears(stage, maxSec, label) {
  const results = clearSummary(stage, maxSec);
  const ok = results.filter((r) => r.outcome === 'clear' && r.lives >= 1);
  assert.ok(ok.length >= 4, `${label}: ${ok.length}/5 cleared — ${JSON.stringify(results)}`);
}

test('自動操縦で1面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE1, 400, 'stage 1'));
test('自動操縦で2面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE2, 500, 'stage 2'));
test('自動操縦で3面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE3, 600, 'stage 3'));
test('自動操縦で4面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE4, 700, 'stage 4'));
test('自動操縦で5面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE5, 700, 'stage 5'));
test('自動操縦で6面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE6, 800, 'stage 6'));
test('自動操縦で7面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE7, 1000, 'stage 7'));

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

// ---- ボスBの突進を、stepGame を通して確かめる（seed 固定・決定的） ----
test('ボスBの突進を止められないと、中心に届いて残機-1になる', () => {
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.boss = createBoss('bossB');
  const seen = [];
  const ev = runUntil(s, idle, (st, e) => { seen.push(st.boss.phase); return e.some((x) => x.type === 'damage'); }, 30);
  const damages = ev.filter((e) => e.type === 'damage');
  assert.deepEqual(damages, [{ type: 'damage', lives: 2 }]); // 最初の突進が届いた分だけ
  assert.equal(s.turret.lives, 2);
  assert.equal(s.boss.hitCore, false);
  assert.equal(s.boss.phase, 'roar');
  assert.equal(s.boss.dist, s.boss.p.dist); // 届いたあとは待機の距離へ戻る
  assert.ok(seen.includes('dash'));
});

test('ボスBの突進は、撃ち込むと止められる', () => {
  // 突進の途中で dashBreak 分のダメージを与えれば、突進は中断される（残機は減らない）。
  // ボスのHPは大きくして倒れないようにし、散布は止めて、敵弾で残機が減る余地をなくす。
  // 見ているのは、「突進が dash → roar で終わり、その突進の間に damage が1回も無い」こと。
  const s = createPlayState(EMPTY_STAGE, mulberry32(1));
  s.boss = createBoss('bossB', { hp: 500, scatterInterval: 1e9 });
  s.turret.damage = 2; // 3発で dashBreak（6）に届く
  let prev = s.boss.phase;
  let broken = 0;
  let damagedInWindow = false;
  for (let i = 0; i < 40 * 60; i++) {
    const ev = stepGame(s, DT, autoPilot(s)); // ボスだけが狙いの候補（散布を止めてあるので、敵は出ない）
    if (s.boss.phase === 'settle' || s.boss.phase === 'dash') {
      if (ev.some((e) => e.type === 'damage')) damagedInWindow = true;
    }
    if (prev === 'dash' && s.boss.phase === 'roar') {
      // 中心には届いていない（dist が待機の距離に戻っているのは、中断のあとの retreat による）
      assert.equal(s.boss.dashesLeft, 0);
      assert.equal(s.boss.dist, s.boss.p.dist);
      if (!damagedInWindow) broken += 1;
    }
    if (s.boss.phase === 'telegraph') damagedInWindow = false;
    prev = s.boss.phase;
  }
  assert.ok(broken >= 1, `broken=${broken}`);
  assert.equal(s.turret.lives, 3); // 止め続けた間、残機は減らない
});

// ---- 敵の弾は体力に関係なく、届くと減点。体当たりだけが残機を減らす ----
const noInput = { turnAxis: 0, firing: false, aim: { x: 500, y: 100 }, bulletSpeed: CONFIG.BULLET_SPEED_PC };
const idleStage = { id: 0, segments: [], spawnEnd: 1e9, boss: { type: 'bossA', params: {} } };

test('敵の弾（enemyShot・shard）が中心に届くと、残機は減らず、スコアが SHOT_PENALTY だけ減る', () => {
  for (const type of ['enemyShot', 'shard']) {
    const s = createPlayState(idleStage, mulberry32(1));
    s.score = 300;
    s.enemies.push(createEnemy(type, 0, s.rng, { dist: 41, speed: 100 }));
    const ev = stepGame(s, 0.05, noInput);
    assert.deepEqual(ev.filter((e) => e.type === 'penalty'), [{ type: 'penalty', amount: CONFIG.SHOT_PENALTY, hits: 1 }], type);
    assert.equal(s.score, 300 - CONFIG.SHOT_PENALTY);
    assert.equal(s.turret.lives, CONFIG.LIVES);
    assert.equal(s.turret.invincible, 0);
    assert.equal(ev.some((e) => e.type === 'damage'), false);
    assert.equal(s.enemies.length, 0); // 弾は消える
  }
});

test('減点でスコアは0未満にならない。同時に届いた弾はそれぞれ減点される', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  s.score = 70;
  s.enemies.push(createEnemy('enemyShot', -10, s.rng, { dist: 41, speed: 100 }), createEnemy('enemyShot', 10, s.rng, { dist: 41, speed: 100 }));
  const ev = stepGame(s, 0.05, noInput);
  assert.equal(s.score, 0);
  assert.deepEqual(ev.filter((e) => e.type === 'penalty'), [{ type: 'penalty', amount: 70, hits: 2 }]);
  const t = createPlayState(idleStage, mulberry32(1));
  const ev2 = stepGame(t, 0.05, noInput);
  assert.equal(ev2.some((e) => e.type === 'penalty'), false);
});

test('敵の体当たり（弾でない敵が中心に届く）は、これまでどおり残機が減る。スコアは減らない', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  s.score = 300;
  s.enemies.push(createEnemy('meteor', 0, s.rng, { dist: 41, speed: 100 }));
  const ev = stepGame(s, 0.05, noInput);
  assert.equal(s.turret.lives, CONFIG.LIVES - 1);
  assert.equal(s.score, 300);
  assert.equal(ev.some((e) => e.type === 'damage'), true);
  assert.equal(ev.some((e) => e.type === 'penalty'), false);
});

test('敵の弾は撃ち落とせる（減点にならない）', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  s.score = 300;
  s.enemies.push(createEnemy('enemyShot', 0, s.rng, { dist: 200, speed: 0 }));
  s.bullets.push({ angle: 0, prevDist: 199.6, dist: 199.6, speed: 900, radius: 6, dead: false, pierceLeft: 0 });
  stepGame(s, 0.01, noInput);
  assert.equal(s.enemies.length, 0);
  assert.ok(s.score >= 300);
});

// ---- 体力：最大値と、回復の隕石 ----
test('体力の最大値：初期は LIVES。「最大体力+1」は最大値を1増やし、体力も1回復する（満タンでも増える）', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  assert.equal(s.turret.maxLives, CONFIG.LIVES);
  s.offer = ['life'];
  assert.equal(chooseOffer(s, 'life'), true);
  assert.equal(s.turret.maxLives, CONFIG.LIVES + 1);
  assert.equal(s.turret.lives, CONFIG.LIVES + 1);
  s.turret.lives = 1;
  s.offer = ['life'];
  chooseOffer(s, 'life');
  assert.equal(s.turret.maxLives, CONFIG.LIVES + 2);
  assert.equal(s.turret.lives, 2);
});

function shootAt(s, e) {
  s.enemies.push(e);
  s.bullets.push({ angle: e.angle, prevDist: e.dist - 30, dist: e.dist - 30, speed: 900, radius: 6, dead: false, pierceLeft: 0 });
  return stepGame(s, 0.05, noInput);
}

test('回復の隕石を撃つと体力が1回復する（最大値まで）。スコア・撃破数は増えない', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  s.turret.lives = 1;
  const ev = shootAt(s, createEnemy('healMeteor', 0, s.rng, { dist: 300, speed: 0 }));
  assert.equal(s.turret.lives, 2);
  assert.ok(ev.some((e) => e.type === 'heal' && e.lives === 2));
  assert.equal(s.score, 0);
  assert.equal(s.kills, 0);
  const full = createPlayState(idleStage, mulberry32(1));
  const ev2 = shootAt(full, createEnemy('healMeteor', 0, full.rng, { dist: 300, speed: 0 }));
  assert.equal(full.turret.lives, CONFIG.LIVES); // 満タンなら超えない
  assert.equal(ev2.some((e) => e.type === 'heal'), false);
});

test('回復の隕石が中心に届いても、体力は減らず、何も起きずに消える', () => {
  const s = createPlayState(idleStage, mulberry32(1));
  s.enemies.push(createEnemy('healMeteor', 0, s.rng, { dist: 41, speed: 100 }));
  const ev = stepGame(s, 0.05, noInput);
  assert.equal(s.turret.lives, CONFIG.LIVES);
  assert.equal(s.enemies.length, 0);
  assert.equal(ev.some((e) => e.type === 'damage' || e.type === 'penalty'), false);
});

test('回復の隕石の出現：体力が減っているときだけ、HEAL_METEOR_INTERVAL ごとに1つ。満タンなら出ない', () => {
  const heals = (s) => s.enemies.filter((e) => e.type === 'healMeteor').length;
  const full = createPlayState(idleStage, mulberry32(1));
  for (let i = 0; i < 60 * 130; i++) { full.enemies = full.enemies.filter((e) => e.type !== 'healMeteor'); stepGame(full, 1 / 60, noInput); if (full.enemies.some((e) => e.type === 'healMeteor')) assert.fail('spawned at full health'); }
  const hurt = createPlayState(idleStage, mulberry32(1));
  hurt.turret.lives = 2;
  let n = 0;
  for (let i = 0; i < 60 * (CONFIG.HEAL_METEOR_INTERVAL + 5); i++) {
    stepGame(hurt, 1 / 60, noInput);
    n += heals(hurt);
    hurt.enemies = hurt.enemies.filter((e) => e.type !== 'healMeteor');
  }
  assert.ok(n >= 1, 'a heal meteor appears once health is missing');
  const noTurret = { enemies: [], boss: null, rng: mulberry32(1) };
  assert.doesNotThrow(() => updateSpawner(createSpawner(idleStage), noTurret, 1));
});
