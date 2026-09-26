import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessStage, endlessPool, endlessEvery, speedMult, endlessBossParams,
} from '../js/game/endless.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { activeCount, createEnemy, ENEMY_DEFS } from '../js/game/enemies.js';
import { createBoss, updateBoss } from '../js/game/boss.js';
import { stageLabel } from '../js/data/stages.js';
import { shuffled, mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const noInput = { turnAxis: 0, firing: false, aim: { x: 500, y: 100 }, bulletSpeed: CONFIG.BULLET_SPEED_PC };
const S = (kind) => createEndlessStage(kind);

test('createEndlessStage：通常とハードの設定', () => {
  const n = S('normal');
  const h = S('hard');
  assert.equal(n.id, 'endless-normal');
  assert.equal(n.name, '通常エンドレス');
  assert.equal(h.id, 'endless-hard');
  assert.equal(h.name, 'ハードエンドレス');
  assert.equal(n.endless.startLevel, 0);
  assert.equal(h.endless.startLevel, 3);
  assert.equal(n.endless.bossEvery, 60);
  assert.equal(n.spawnEnd, Infinity);
  assert.equal(n.boss, null);
  assert.equal(stageLabel(n), '通常エンドレス　');
  assert.throws(() => createEndlessStage('x'));
});

test('プール：通常は段階投入、ハードは最初から近接、60秒から妨害も', () => {
  const at = (kind, t) => new Set(endlessPool(kind, t));
  assert.deepEqual([...at('normal', 0)].sort(), ['drone', 'meteor']);
  assert.deepEqual([...at('normal', 59.9)].sort(), ['drone', 'meteor']);
  assert.deepEqual([...at('normal', 60)].sort(), ['drone', 'formationDrone', 'meteor']);
  for (const t of ['burrower', 'thrower', 'charger']) assert.ok(at('normal', 120).has(t));
  assert.equal(at('normal', 239).has('shielder'), false);
  for (const t of ['shielder', 'teleporter', 'jammer']) assert.ok(at('normal', 240).has(t));
  for (const t of ['meteor', 'drone', 'formationDrone', 'burrower', 'thrower', 'charger']) assert.ok(at('hard', 0).has(t));
  assert.equal(at('hard', 59).has('jammer'), false);
  for (const t of ['shielder', 'teleporter', 'jammer']) assert.ok(at('hard', 60).has(t));
  for (const kind of ['normal', 'hard']) for (const t of endlessPool(kind, 9999)) assert.ok(t in ENEMY_DEFS);
});

test('出現間隔：時間とともに短くなり、floor で止まる。ハードのほうが速い', () => {
  const n = S('normal').endless;
  const h = S('hard').endless;
  assert.equal(endlessEvery(n, 0), 2.6);
  assert.ok(Math.abs(endlessEvery(n, 60) - 2.6 * 0.9) < 1e-9);
  assert.ok(endlessEvery(n, 120) < endlessEvery(n, 60));
  assert.equal(endlessEvery(n, 100000), n.floor);
  assert.equal(endlessEvery(h, 0), 1.8);
  assert.ok(endlessEvery(h, 0) < endlessEvery(n, 0));
  assert.equal(endlessEvery(h, 100000), h.floor);
});

test('敵の速さの倍率：1.0 から増え、+50% で止まる', () => {
  assert.equal(speedMult(0), 1);
  assert.ok(Math.abs(speedMult(60) - 1.04) < 1e-9);
  assert.equal(speedMult(100000), 1.5);
});

test('ボスの強さ：レベル0は基準値、レベルが上がると強く・速くなり、上限・下限で止まる', () => {
  const a0 = endlessBossParams('bossA', 0);
  assert.equal(a0.hp, 30);
  assert.equal(a0.summonCount, 3);
  assert.ok(Math.abs(a0.summonInterval - 7.5) < 1e-9);
  const a5 = endlessBossParams('bossA', 5);
  assert.ok(a5.hp > a0.hp && a5.summonCount === 8 && a5.summonInterval < a0.summonInterval);
  const a99 = endlessBossParams('bossA', 99);
  assert.equal(a99.summonCount, 9);
  assert.equal(a99.summonInterval, 3.5);
  assert.equal(a99.shotBurst, 6);
  const b0 = endlessBossParams('bossB', 0);
  assert.equal(b0.hp, 40);
  assert.equal(b0.dashCount, 1);
  assert.equal(endlessBossParams('bossB', 4).dashCount, 3);
  assert.equal(endlessBossParams('bossB', 99).dashInterval, 4);
  assert.equal(endlessBossParams('bossB', 99).dashTime, 1.8);
  assert.equal(endlessBossParams('bossB', 99).scatterCount, 11);
  const c0 = endlessBossParams('bossC', 0);
  assert.equal(c0.hp, 45);
  assert.equal(c0.decoyCount, 2);
  assert.equal(endlessBossParams('bossC', 4).decoyCount, 4);
  assert.equal(endlessBossParams('bossC', 99).decoyCount, 5);
  assert.equal(endlessBossParams('bossC', 99).swapInterval, 3);
  assert.equal(endlessBossParams('bossC', 99).shieldInterval, 5);
  assert.equal(endlessBossParams('bossC', 99).jamInterval, 4);
  for (const type of ['bossA', 'bossB', 'bossC']) {
    for (const L of [0, 3, 10, 99]) {
      assert.ok(createBoss(type, endlessBossParams(type, L)), `${type} L${L}`); // 実際に作れる（色の指定は無い）
      assert.equal('color' in endlessBossParams(type, L), false);
    }
  }
});

test('shuffled と activeCount は共通の場所にある', () => {
  const r = mulberry32(1);
  assert.deepEqual([...shuffled([1, 2, 3, 4], r)].sort(), [1, 2, 3, 4]);
  const state = { enemies: [createEnemy('meteor', 0, r), createEnemy('enemyShot', 0, r), createEnemy('healMeteor', 0, r)] };
  assert.equal(activeCount(state), 1);
});

function play(kind, seconds, { seed = 3, kill = false, each } = {}) {
  const s = createPlayState(S(kind), mulberry32(seed));
  const log = { maxActive: 0, bosses: [], types: new Set(), maxSpeedRatio: 0 };
  let lastBoss = null;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s.turret.lives = s.turret.maxLives; // 死なない
    if (kill) for (const e of s.enemies) if (ENEMY_DEFS[e.type].countsAsKill && e.dist < 200) e.dead = true;
    const ev = stepGame(s, DT, noInput);
    log.maxActive = Math.max(log.maxActive, activeCount(s));
    for (const e of s.enemies) log.types.add(e.type);
    if (s.boss && s.boss !== lastBoss) log.bosses.push(s.boss.type + '@' + Math.round(s.time)); // 新しいボスが出たときだけ記録
    lastBoss = s.boss;
    if (each) each(s, ev);
  }
  return { s, log };
}

test('通常エンドレス：60秒までは隕石とドローンだけ。ボスは60秒で出る。同時に出る敵は5体まで', () => {
  const { s, log } = play('normal', 59, { kill: true });
  assert.equal(s.boss, null);
  assert.ok(log.maxActive <= CONFIG.MAX_ACTIVE);
  for (const t of log.types) assert.ok(['meteor', 'drone', 'enemyShot', 'healMeteor'].includes(t), t);
  const later = play('normal', 62, { kill: true });
  assert.ok(later.s.boss, 'the first boss appears at 60 s');
  assert.ok(['bossA', 'bossB', 'bossC'].includes(later.s.boss.type));
  assert.equal(later.s.outcome, null);
});

test('ボス戦の間は、雑魚が新しく出ない。ボスを倒すと、クリアにならず、追加の選択が入り、60秒後に次のボス（前回と違う種類）', () => {
  const s = createPlayState(S('normal'), mulberry32(5));
  let bossDown = false;
  let firstType = null;
  let offerAfterBoss = false;
  let nextBossAt = null;
  for (let i = 0; i < 60 * 300; i++) {
    s.turret.lives = s.turret.maxLives;
    if (s.offer) { s.offer = null; if (bossDown) offerAfterBoss = true; }
    for (const e of s.enemies) if (ENEMY_DEFS[e.type].countsAsKill && e.dist < 250) e.dead = true;
    if (s.boss && !s.boss.dead && s.boss.arrived && firstType === null) {
      firstType = s.boss.type;
      const before = s.enemies.filter((e) => ENEMY_DEFS[e.type].countsAsKill).length;
      for (let k = 0; k < 60 * 6; k++) { stepGame(s, DT, noInput); s.turret.lives = s.turret.maxLives; }
      assert.equal(s.enemies.filter((e) => ENEMY_DEFS[e.type].countsAsKill && !['bossMinion'].includes(e.type)).length <= before, true);
      s.boss.hp = 0; s.boss.dead = true; // 倒した
    }
    const ev = stepGame(s, DT, noInput);
    if (ev.some((e) => e.type === 'bossDown')) { bossDown = true; assert.equal(s.boss, null); assert.equal(s.outcome, null); }
    if (bossDown && s.boss && nextBossAt === null) { nextBossAt = s.time; assert.notEqual(s.boss.type, firstType); }
    if (nextBossAt !== null) break;
  }
  assert.ok(bossDown, 'boss down event');
  assert.ok(offerAfterBoss, 'an extra power-up offer follows the boss');
  assert.ok(nextBossAt !== null, 'the next boss appears');
});

test('ボス撃破のとき、偽像と子機は消える（得点なし）', () => {
  const s = createPlayState(S('normal'), mulberry32(2));
  s.boss = createBoss('bossC', endlessBossParams('bossC', 0));
  s.spawner.endless.hadBoss = true;
  s.enemies.push(createEnemy('decoy', 10, s.rng, { dist: 340 }), createEnemy('bossMinion', 20, s.rng, { dist: 300 }));
  const score = s.score;
  s.boss.dead = true;
  const ev = stepGame(s, DT, noInput);
  assert.ok(ev.some((e) => e.type === 'bossDown'));
  assert.equal(s.enemies.filter((e) => e.type === 'decoy' || e.type === 'bossMinion').length, 0);
  assert.equal(s.score, score);
  assert.equal(s.boss, null);
});

test('ボスのレベルが上がる：撃破のたびに level+1。ハードは3から', () => {
  const s = createPlayState(S('hard'), mulberry32(1));
  assert.equal(s.spawner.endless.bossLevel, 3);
  s.boss = createBoss('bossA', endlessBossParams('bossA', 3));
  s.spawner.endless.hadBoss = true;
  s.boss.dead = true;
  stepGame(s, DT, noInput);
  updateSpawner(s.spawner, s, DT);
  assert.equal(s.spawner.endless.bossLevel, 4);
  assert.equal(s.spawner.endless.bossTimer < 1, true);
});

test('回復の隕石：エンドレスでも、体力が減っていれば出る（ボス戦の間も）', () => {
  const s = createPlayState(S('normal'), mulberry32(4));
  s.turret.lives = 1;
  let heals = 0;
  for (let i = 0; i < 60 * 45; i++) {
    for (const e of s.enemies) if (e.dist < 300) e.dead = true;
    stepGame(s, DT, noInput);
    s.turret.lives = 1;
    heals += s.enemies.filter((e) => e.type === 'healMeteor' && e.dist > 440).length ? 1 : 0;
  }
  assert.ok(heals > 0);
});

test('通常・ハードとも、長時間（20分）動かしても例外が出ず、同時に出る敵は5体まで。ハードのほうが最初から敵が多い', () => {
  for (const kind of ['normal', 'hard']) {
    const { s, log } = play(kind, 60 * 20, { seed: 9, kill: true, each: (st) => { if (st.offer) st.offer = null; if (st.boss && st.boss.arrived && !st.boss.dead) { st.boss.hp -= 0.02; if (st.boss.hp <= 0) st.boss.dead = true; } } });
    assert.ok(log.maxActive <= CONFIG.MAX_ACTIVE, `${kind} maxActive ${log.maxActive}`);
    assert.ok(log.bosses.length >= 3, `${kind} bosses ${log.bosses}`);
    assert.equal(s.outcome, null);
  }
  const n = play('normal', 40, { seed: 1 }).s;
  const h = play('hard', 40, { seed: 1 }).s;
  const cnt = (st) => st.enemies.filter((e) => e.type !== 'enemyShot').length + st.kills;
  assert.ok(cnt(h) >= cnt(n));
});

test('エンドレスのボスAの召喚も、同時に出る敵の上限（5体）を守る。ステージ制の召喚数は変えない', () => {
  const s = createPlayState(S('hard'), mulberry32(7));
  s.boss = createBoss('bossA', endlessBossParams('bossA', 99)); // summonCount 9
  s.spawner.endless.hadBoss = true;
  let maxActive = 0;
  let minions = 0;
  for (let i = 0; i < 60 * 40; i++) {
    s.turret.lives = s.turret.maxLives;
    stepGame(s, DT, noInput);
    maxActive = Math.max(maxActive, activeCount(s));
    minions = Math.max(minions, s.enemies.filter((e) => e.type === 'bossMinion').length);
  }
  assert.ok(minions > 0, 'the boss still summons');
  assert.ok(maxActive <= CONFIG.MAX_ACTIVE, `maxActive ${maxActive}`);
  // ステージ制（endless でない state）では、召喚数はそのまま
  const story = { enemies: [], rng: mulberry32(1), turret: s.turret, endless: false };
  const b = createBoss('bossA', { summonCount: 9 });
  b.arrived = true; b.dist = b.p.dist; b.summonT = 0;
  updateBoss(b, story, DT);
  assert.equal(story.enemies.filter((e) => e.type === 'bossMinion').length, 9);
});

test('ボスを倒したフレームに体力が0なら、bossDown のあと、選択を挟まずに次のフレームで gameover', () => {
  const s = createPlayState(S('normal'), mulberry32(2));
  s.boss = createBoss('bossA', endlessBossParams('bossA', 0));
  s.spawner.endless.hadBoss = true;
  s.boss.dead = true;
  s.turret.lives = 0;
  const ev = stepGame(s, DT, noInput);
  assert.ok(ev.some((e) => e.type === 'bossDown'));
  assert.equal(s.offer, null);
  assert.equal(s.outcome, null);
  const ev2 = stepGame(s, DT, noInput);
  assert.ok(ev2.some((e) => e.type === 'gameover'));
  assert.equal(s.outcome, 'gameover');
});

test('ボス撃破の kill イベントの対象は、state.boss が null になっても、ボス（ENEMY_DEFS に無い種類）と判別できる', () => {
  const s = createPlayState(S('normal'), mulberry32(2));
  s.boss = createBoss('bossA', endlessBossParams('bossA', 0));
  s.spawner.endless.hadBoss = true;
  s.boss.arrived = true;
  s.boss.angle = 0;
  s.boss.dist = 300;
  s.boss.hp = 1;
  const boss = s.boss;
  s.bullets.push({ angle: 0, prevDist: 290, dist: 290, speed: 900, radius: 6, dead: false, pierceLeft: 0 });
  const ev = stepGame(s, 0.05, noInput);
  const kill = ev.find((e) => e.type === 'kill');
  assert.ok(kill, 'kill event');
  assert.equal(s.boss, null);
  assert.equal(kill.target, boss);
  assert.equal(ENEMY_DEFS[kill.target.type], undefined); // play.js は、これでボスと判別する
  assert.equal(typeof kill.target.p.score, 'number');
});
