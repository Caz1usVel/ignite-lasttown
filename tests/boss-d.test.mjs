import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_D_BASE, createBossD, updateBossD, enterMode, pickFreeAngle } from '../js/game/boss-d.js';
import { createBoss, updateBoss, BOSSES } from '../js/game/boss.js';
import { updateEnemies } from '../js/game/enemies.js';
import { resolveBulletHits } from '../js/game/collision.js';
import { createTurret } from '../js/game/turret.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

const DT = 1 / 60;
const mkState = (seed = 21) => ({ enemies: [], boss: null, rng: mulberry32(seed), turret: createTurret() });
const step = (b, s, seconds) => {
  for (let i = 0; i < Math.round(seconds / DT); i++) { updateBossD(b, s, DT); updateEnemies(s, DT); }
};
const arrive = (b, s) => step(b, s, (CONFIG.SPAWN_DIST - b.p.dist) / b.p.moveSpeed + 0.1);
const minions = (s) => s.enemies.filter((e) => e.type === 'bossMinion' && !e.dead);
const decoys = (s) => s.enemies.filter((e) => e.type === 'decoy' && !e.dead);
const EPS = 1e-9;

test('BOSS_D_BASE：仕様の値で、凍結されている', () => {
  assert.equal(Object.isFrozen(BOSS_D_BASE), true);
  assert.equal(Object.isFrozen(BOSS_D_BASE.dash), true);
  assert.equal(Object.isFrozen(BOSS_D_BASE.summonCount), true);
  assert.equal(BOSS_D_BASE.hp, 90);
  assert.equal(BOSS_D_BASE.radius, 64);
  assert.equal(BOSS_D_BASE.dist, 340);
  assert.equal(BOSS_D_BASE.moveSpeed, 28);
  assert.equal(BOSS_D_BASE.angleRange, 50);
  assert.equal(BOSS_D_BASE.drift, 8);
  assert.equal(BOSS_D_BASE.restTime, 3.0);
  assert.equal(BOSS_D_BASE.finalRatio, 0.35);
  assert.deepEqual([...BOSS_D_BASE.summonCount], [2, 3]);
  assert.equal(BOSS_D_BASE.summonMinSep, 25);
  assert.equal(BOSS_D_BASE.summonVolleys, 2);
  assert.equal(BOSS_D_BASE.summonGap, 3.0);
  assert.equal(BOSS_D_BASE.summonEnd, 2.0);
  assert.equal(BOSS_D_BASE.minionApproach, 7);
  assert.equal(BOSS_D_BASE.decoyCount, 2);
  assert.equal(BOSS_D_BASE.decoyMinSep, 30);
  assert.equal(BOSS_D_BASE.decoyLifetime, 8);
  assert.equal(BOSS_D_BASE.decoyRefill, 2);
  assert.deepEqual({ ...BOSS_D_BASE.dash }, {
    dashCount: 1, dashTime: 2.8, dashBreak: 6, settle: 0.5, telegraph: 1.0, vanish: 0.8,
    reappearDist: 440, reappearMargin: 15, roarTime: 2.2, roarMult: 1.5,
  });
  assert.equal(BOSS_D_BASE.finalSummonInterval, 6);
  assert.equal(BOSS_D_BASE.finalSummonCount, 2);
  assert.equal(BOSS_D_BASE.finalDashInterval, 7);
  assert.equal(BOSS_D_BASE.score, 10000);
  assert.equal('color' in BOSS_D_BASE, false);
});

test('登録表：bossD を createBoss で作れる', () => {
  assert.equal(BOSSES.bossD.name, '最終ボス');
  assert.equal(BOSSES.bossD.color, '#ffd24a');
  const b = createBoss('bossD');
  assert.equal(b.type, 'bossD');
  assert.equal(b.name, '最終ボス');
  assert.equal(b.color, '#ffd24a');
  assert.equal(b.maxHp, 90);
  assert.equal(b.dist, 460);
  assert.equal(b.hidden, false);
  assert.equal(b.damageMult, 1);
  assert.equal(b.damageTaken, 0);
  assert.throws(() => createBoss('bossD', { color: 'gold' }), /invalid boss color/);
});

test('進入：距離460から340へ進み、着いたら rest になる。偽像・召喚はまだ無い', () => {
  const s = mkState();
  const b = createBossD();
  step(b, s, 1);
  assert.equal(b.arrived, false);
  assert.equal(b.phase, 'approach');
  arrive(b, s);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 340);
  assert.equal(b.mode, 'rest');
  assert.equal(b.phase, 'rest');
  assert.equal(minions(s).length + decoys(s).length, 0);
});

test('rest は 3 秒。そのあと、前回と違うモードを選ぶ（summon / dash / decoy）', () => {
  {
    const s = mkState(3);
    const b = createBossD();
    arrive(b, s);
    step(b, s, 2.9);
    assert.equal(b.mode, 'rest');
    step(b, s, 0.2);
    assert.notEqual(b.mode, 'rest');
  }
  const all = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const s = mkState(seed);
    const b = createBossD();
    arrive(b, s);
    const seen = [];
    let last = null;
    for (let i = 0; i < 60 * 200 && seen.length < 8; i++) {
      updateBossD(b, s, DT);
      updateEnemies(s, DT);
      const m = b.dashing ? 'dash' : b.mode;
      if (m !== last && m !== 'rest') seen.push(m);
      last = m;
      b.hp = b.maxHp; // 最終フェーズにしない
      b.hitCore = false;
      s.enemies = s.enemies.filter((e) => (e.type === 'bossMinion' ? e.dist > 60 : true));
    }
    assert.equal(seen.length, 8, `seed ${seed}: ${seen}`);
    for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `seed ${seed}: ${seen}`);
    for (const m of seen) { assert.ok(['summon', 'dash', 'decoy'].includes(m), m); all.add(m); }
  }
  assert.equal(all.size, 3);
});

test('summon モード：2回、3秒おきに 2〜3方向の子機を出し、最後の2秒後に rest', () => {
  const s = mkState();
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'summon');
  assert.equal(b.mode, 'summon');
  assert.equal(b.phase, 'summon');
  step(b, s, 0.1);
  const first = minions(s).length;
  assert.ok(first >= 2 && first <= 3, `first volley ${first}`);
  for (const m of minions(s)) assert.ok(Math.abs(m.dist - 340) < 20);
  step(b, s, 2.7);
  assert.equal(minions(s).length, first); // 3 秒たつ前は出ない
  step(b, s, 0.5);
  const second = minions(s).length - first;
  assert.ok(second >= 2 && second <= 3, `second volley ${second}`);
  assert.equal(b.mode, 'summon');
  // 2 回目は約 3.0 秒。その 2 秒後（約 5.0 秒）に rest
  step(b, s, 1.5);                       // 約 4.8 秒
  assert.equal(b.mode, 'summon');
  step(b, s, 0.4);                       // 約 5.2 秒
  assert.equal(b.mode, 'rest');
  assert.equal(b.phase, 'rest');
  assert.equal(minions(s).length, first + second); // 3 回目は無い
});

test('decoy モード：decoyCount 体を、ボスと互いから decoyMinSep 以上離して出す（多くのシード）', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = mkState(seed);
    const b = createBossD();
    arrive(b, s);
    b.angle = ((seed * 37) % 101) - 50; // ボスの角度を -50〜+50 に散らす
    enterMode(b, s, 'decoy');
    const ds = decoys(s);
    assert.equal(ds.length, 2);
    const angles = [b.angle, ...ds.map((d) => d.baseAngle)];
    for (let i = 0; i < angles.length; i++) {
      for (let j = i + 1; j < angles.length; j++) {
        assert.ok(Math.abs(angles[i] - angles[j]) >= 30 - EPS, `seed ${seed}: ${angles}`);
      }
    }
    for (const d of ds) assert.ok(Math.abs(d.baseAngle) <= 70 + EPS, `seed ${seed}: ${d.baseAngle}`);
  }
});

test('decoy モード：8 秒後に消して rest。撃たれて消えても待つ。待つ間ボスは動かない', () => {
  const s = mkState(5);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'decoy');
  assert.equal(b.mode, 'decoy');
  assert.equal(b.phase, 'decoy');
  const ds = decoys(s);
  assert.equal(ds.length, 2);
  for (const d of ds) {
    assert.equal(d.dist, 340);
    assert.equal(d.style, 'bossD');
    assert.equal(d.color, '#ffd24a');     // createBossD 直後は boss.color が無いので既定の金色
  }
  const a0 = b.angle;
  ds[0].dead = true;                    // 撃たれて消えた
  step(b, s, 7.5);
  assert.equal(b.mode, 'decoy');        // まだ待つ
  assert.equal(b.angle, a0);
  assert.equal(decoys(s).length, 1);
  step(b, s, 0.7);
  assert.equal(b.mode, 'rest');
  assert.equal(decoys(s).length, 0);    // 残りは消える
  assert.equal(b.decoys.length, 0);
});

test('偽像の色：createBoss 経由ならボスの色（params.color を含む）を使う', () => {
  const s = mkState(2);
  const b = createBoss('bossD', { color: '#123456' });
  arrive(b, s);
  enterMode(b, s, 'decoy');
  for (const d of decoys(s)) assert.equal(d.color, '#123456');
});

test('dash モード：内部のボスBが突進して、ボスDの hidden / angle / dist / phase が内部に合う。終わったら rest', () => {
  const s = mkState(9);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'dash');
  assert.equal(b.dashing, true);
  assert.equal(b.mode, 'dash');
  assert.equal(b.phase, 'telegraph');   // 入った瞬間から予兆（'dash' や 'idle' を見せない）
  const seenPhases = new Set();
  let hiddenSeen = false;
  let hit = false;
  for (let i = 0; i < 60 * 15 && b.dashing; i++) {
    updateBossD(b, s, DT);
    if (b.dashing) {
      seenPhases.add(b.phase);
      assert.equal(b.angle, b.inner.angle);
      assert.equal(b.dist, b.inner.dist);
      assert.equal(b.hidden, b.inner.hidden);
      assert.equal(b.damageMult, b.inner.damageMult);
    }
    if (b.hidden) hiddenSeen = true;
    if (b.hitCore) { hit = true; b.hitCore = false; }
  }
  assert.deepEqual([...seenPhases].sort(), ['dash', 'roar', 'settle', 'telegraph', 'vanish']);
  assert.equal(hiddenSeen, true);
  assert.equal(hit, true);              // 中心に届いた
  assert.equal(b.dashing, false);
  assert.equal(b.inner, null);
  assert.equal(b.hidden, false);
  assert.equal(b.damageMult, 1);
  assert.equal(b.dist, 340);
  assert.equal(b.mode, 'rest');
  assert.equal(b.phase, 'rest');
  assert.equal(minions(s).length, 0);   // 内部のボスBは散弾を撃たない
  assert.equal(s.enemies.length, 0);
});

test('dash モード：damageTaken が内部のボスBに伝わり、突進中に dashBreak だけ受けると中断される', () => {
  const s = mkState(4);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'dash');
  let guard = 0;
  while (b.phase !== 'dash' && guard++ < 60 * 10) updateBossD(b, s, DT);
  assert.equal(b.phase, 'dash');
  b.damageTaken += b.p.dash.dashBreak;  // collision.js が加算するのと同じ
  updateBossD(b, s, DT);
  assert.equal(b.phase, 'roar');        // 中断されて怯んだ
  assert.equal(b.hitCore, false);
  assert.equal(b.damageMult, b.p.dash.roarMult);
  assert.equal(b.dist, 340);
});

test('最終フェーズ：HPが35%以下になると、召喚・偽像・突進が同時に動き、モードの切り替えはしない', () => {
  const s = mkState(6);
  const b = createBossD();
  arrive(b, s);
  b.hp = b.maxHp * b.p.finalRatio;
  updateBossD(b, s, DT);
  assert.equal(b.final, true);
  assert.equal(b.mode, 'final');
  assert.equal(b.phase, 'final');
  step(b, s, 2.5);                       // 偽像は 2 体（補充は 0 秒から）
  assert.equal(decoys(s).length, 2);
  step(b, s, 4);                         // 召喚（6 秒ごと、2 方向）
  assert.equal(minions(s).length, 2);
  // 偽像を 1 体消すと、2 秒後に補充される
  decoys(s)[0].dead = true;
  step(b, s, 1.0);
  assert.equal(decoys(s).length, 1);
  step(b, s, 1.3);
  assert.equal(decoys(s).length, 2);
  // 突進：finalDashInterval(7 秒) のうちに始まる
  let dashed = false;
  for (let i = 0; i < 60 * 10 && !dashed; i++) { updateBossD(b, s, DT); updateEnemies(s, DT); if (b.dashing) dashed = true; }
  assert.equal(dashed, true);
  assert.equal(b.mode, 'final');
  // 突進中も、召喚・偽像の処理は続く
  for (const d of decoys(s)) d.dead = true;
  step(b, s, 2.3);
  assert.equal(decoys(s).length, 2);
  const fresh = () => minions(s).filter((m) => m.dist > 300).length;
  assert.equal(fresh(), 0);
  step(b, s, 1.5);                       // 約 12.6 秒：2 回目の召喚（12 秒）のあと
  assert.equal(b.dashing, true);
  assert.equal(fresh(), 2);
  assert.equal(b.mode, 'final');
});

test('最終フェーズ：補充される偽像も、ボスと残りの偽像から decoyMinSep 以上離れる（多くのシード）', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = mkState(seed);
    const b = createBossD();
    arrive(b, s);
    b.hp = 1;
    step(b, s, 0.1);
    for (let k = 0; k < 3; k++) {
      decoys(s)[0].dead = true;
      step(b, s, 2.1);
      if (b.dashing) break;               // 突進中はボスの角度が視界の外になりうる
      const ds = decoys(s);
      assert.equal(ds.length, 2);
      assert.ok(Math.abs(ds[0].baseAngle - ds[1].baseAngle) >= 30 - EPS, `seed ${seed}`);
    }
  }
});

test('最終フェーズ：突進が終わっても rest には入らず、final のまま', () => {
  const s = mkState(8);
  const b = createBossD();
  arrive(b, s);
  b.hp = 1;
  updateBossD(b, s, DT);
  let ended = false;
  let wasDashing = false;
  for (let i = 0; i < 60 * 40; i++) {
    updateBossD(b, s, DT); updateEnemies(s, DT);
    s.enemies = s.enemies.filter((e) => e.type !== 'bossMinion');
    if (b.dashing) wasDashing = true;
    if (b.hitCore) b.hitCore = false;
    if (wasDashing && !b.dashing) { ended = true; break; }
  }
  assert.equal(ended, true);
  assert.equal(b.mode, 'final');
  assert.equal(b.phase, 'final');
  assert.equal(b.hidden, false);
  assert.equal(b.damageMult, 1);
  assert.equal(b.dist, 340);
});

test('突進中に最終フェーズに入る：突進は続き、phase は内部のまま。終わると final', () => {
  const s = mkState(11);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'dash');
  step(b, s, 0.5);
  assert.equal(b.phase, 'telegraph');
  b.hp = 1;
  updateBossD(b, s, DT);
  assert.equal(b.final, true);
  assert.equal(b.mode, 'final');
  assert.equal(b.dashing, true);
  assert.equal(b.phase, 'telegraph');
  for (let i = 0; i < 60 * 15 && b.dashing; i++) { updateBossD(b, s, DT); b.hitCore = false; }
  assert.equal(b.dashing, false);
  assert.equal(b.phase, 'final');
  assert.equal(b.mode, 'final');
  assert.equal(b.hidden, false);
  assert.equal(b.damageMult, 1);
});

test('decoy モード中に最終フェーズに入る：偽像はそのまま使い、寿命では消えない', () => {
  const s = mkState(12);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'decoy');
  const ds = decoys(s);
  b.hp = 1;
  step(b, s, 10);                        // decoyLifetime(8) を過ぎても消えない
  assert.equal(b.mode, 'final');
  assert.equal(decoys(s).length, 2);
  for (const d of ds) assert.equal(d.dead, false);
});

test('summon モード中に最終フェーズに入る：残りの召喚は取り消される', () => {
  const s = mkState(13);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'summon');
  step(b, s, 0.1);
  const first = minions(s).length;
  b.hp = 1;
  step(b, s, 5);                         // 最終フェーズの召喚（6 秒）より前
  assert.equal(b.mode, 'final');
  assert.equal(b.volleysLeft, 0);
  assert.equal(minions(s).length, first);
});

test('待機中は angleRange の範囲で左右に往復する（decoy モードの間は動かない）', () => {
  const s = mkState();
  const b = createBossD();
  arrive(b, s);
  b.mode = 'rest'; b.modeT = 1e9;
  const a0 = b.angle;
  step(b, s, 2);
  assert.ok(Math.abs(b.angle - a0) > 10);
  step(b, s, 30);
  assert.ok(Math.abs(b.angle) <= 50 + EPS);
  enterMode(b, s, 'decoy');
  const a1 = b.angle;
  step(b, s, 2);
  assert.equal(b.angle, a1);
});

test('updateBoss は bossD を更新する。ボスDに当てると damageTaken が増え、HPが減る', () => {
  const s = mkState();
  const b = createBoss('bossD');
  updateBoss(b, s, 1);
  assert.ok(b.dist < 460);
  arrive(b, s);
  b.angle = 0;
  const combat = { turret: createTurret(), bullets: [{ angle: 0, prevDist: 300, dist: 420, speed: 900, radius: 6, dead: false, pierceLeft: 0 }], enemies: [], boss: b, rng: mulberry32(1) };
  const ev = resolveBulletHits(combat);
  assert.deepEqual(ev.map((e) => e.type), ['hit']);
  assert.equal(b.hp, 89);
  assert.equal(b.damageTaken, 1);
});

test('pickFreeAngle：空きがあれば minSep 以上離れた角度を範囲内で選び、無ければ最も離れる角度', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 500; i++) {
    const taken = [-50 + 100 * rng(), -50 + 100 * rng()]; // ボスの角度（±50）と偽像1体
    const a = pickFreeAngle(taken, 30, -70, 70, rng);
    assert.ok(a >= -70 - EPS && a <= 70 + EPS, String(a));
    for (const t of taken) assert.ok(Math.abs(a - t) >= 30 - EPS, a + ' vs ' + taken);
  }
  // 空きが無い：-70〜70 に 30 間隔の 5 点、minSep 40
  const a = pickFreeAngle([-60, -30, 0, 30, 60], 40, -70, 70, rng);
  assert.ok([-45, -15, 15, 45].includes(a), String(a)); // 隣り合う2点の中点（15 離れる）。端（10）より良い
});
