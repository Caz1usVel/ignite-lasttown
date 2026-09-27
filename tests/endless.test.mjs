import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessStage, endlessPool, endlessEvery, speedMult, endlessBossParams, endlessTier,
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
  assert.equal(h.endless.startLevel, 5);
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

test('endlessTier：5回ごとに1段階、0〜3の4段階で止まる', () => {
  assert.equal(endlessTier(0), 0);
  assert.equal(endlessTier(4), 0);
  assert.equal(endlessTier(5), 1);
  assert.equal(endlessTier(9), 1);
  assert.equal(endlessTier(10), 2);
  assert.equal(endlessTier(14), 2);
  assert.equal(endlessTier(15), 3);
  assert.equal(endlessTier(20), 3);
  assert.equal(endlessTier(9999), 3); // 上限で止まる
});

test('ボスの強さ：tierごとに、体力が+15%ずつ増え（3段階で最大+45%）、識別攻撃が少しだけ強くなる', () => {
  for (const [type, base] of [['bossA', 30], ['bossB', 40], ['bossC', 45]]) {
    const byTier = [0, 5, 10, 15].map((L) => endlessBossParams(type, L));
    assert.deepEqual(byTier.map((p) => p.hp), [base, Math.round(base * 1.15), Math.round(base * 1.3), Math.round(base * 1.45)], type);
    assert.equal(endlessBossParams(type, 999).hp, byTier[3].hp, `${type}: 上限を超えても変わらない`);
    assert.deepEqual(endlessBossParams(type, 20).hp, byTier[3].hp, `${type}: L20 も tier3 のまま`);
  }

  const a = [0, 5, 10, 15].map((L) => endlessBossParams('bossA', L));
  assert.deepEqual(a.map((p) => p.summonCount), [3, 4, 5, 6]);
  assert.ok(a[0].summonInterval > a[3].summonInterval, 'summonInterval shortens');
  assert.ok(a[0].shotInterval > a[3].shotInterval);
  assert.deepEqual(a.map((p) => p.shotBurst), [3, 3, 4, 4]);

  const b = [0, 5, 10, 15].map((L) => endlessBossParams('bossB', L));
  assert.deepEqual(b.map((p) => p.dashCount), [1, 1, 2, 2]);
  assert.deepEqual(b.map((p) => p.scatterCount), [5, 6, 7, 8]);
  assert.ok(b[0].dashInterval > b[3].dashInterval);
  assert.ok(b[0].dashTime > b[3].dashTime);
  assert.ok(b[0].scatterInterval > b[3].scatterInterval);

  const c = [0, 5, 10, 15].map((L) => endlessBossParams('bossC', L));
  assert.deepEqual(c.map((p) => p.decoyCount), [2, 3, 4, 4]); // tier3でも4止まり（詰まらない範囲）
  assert.ok(c[0].swapInterval > c[3].swapInterval);
  assert.ok(c[0].shieldInterval > c[3].shieldInterval);
  assert.ok(c[0].jamInterval > c[3].jamInterval);
  for (const type of ['bossA', 'bossB', 'bossC']) {
    for (const L of [0, 5, 10, 15, 200]) {
      assert.ok(createBoss(type, endlessBossParams(type, L)), `${type} L${L}`);
    }
  }
});

test('ハードエンドレスは、開始時点で tier1（撃破5回ぶん）から始まる', () => {
  const s = createPlayState(S('hard'), mulberry32(1));
  assert.equal(s.spawner.endless.bossLevel, 5);
  assert.equal(endlessTier(s.spawner.endless.bossLevel), 1);
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

test('ボスのレベルが上がる：撃破のたびに level+1。ハードは5から', () => {
  const s = createPlayState(S('hard'), mulberry32(1));
  assert.equal(s.spawner.endless.bossLevel, 5);
  s.boss = createBoss('bossA', endlessBossParams('bossA', 5));
  s.spawner.endless.hadBoss = true;
  s.boss.dead = true;
  stepGame(s, DT, noInput);
  updateSpawner(s.spawner, s, DT);
  assert.equal(s.spawner.endless.bossLevel, 6);
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
