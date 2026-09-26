import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  POWERUPS, POWERUP_IDS, OFFER_EVERY, OFFER_SIZE, createPowerupCounts, availablePowerups,
  makeOffer, applyPowerup, chooseOffer, recomputeTurret, powerupLevelText,
} from '../js/game/powerups.js';
import { createTurret } from '../js/game/turret.js';
import { mulberry32 } from '../js/core/util.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const mkState = () => ({ turret: createTurret(), powerups: createPowerupCounts(), offer: null });

test('定義：6種、重みと上限が仕様どおり', () => {
  assert.deepEqual(POWERUP_IDS, ['fireRate', 'damage', 'pierce', 'turnSpeed', 'fov', 'life']);
  assert.equal(OFFER_EVERY, 10);
  assert.equal(OFFER_SIZE, 2);
  const w = Object.fromEntries(POWERUP_IDS.map((id) => [id, POWERUPS[id].weight]));
  assert.deepEqual(w, { fireRate: 10, damage: 10, pierce: 10, turnSpeed: 10, fov: 5, life: 2 });
  const m = Object.fromEntries(POWERUP_IDS.map((id) => [id, POWERUPS[id].max]));
  assert.deepEqual(m, { fireRate: 5, damage: 5, pierce: 3, turnSpeed: 4, fov: 3, life: Infinity });
  assert.equal(createTurret().pierce, 0);
});

test('recomputeTurret：取得0回は基準値', () => {
  const t = createTurret();
  recomputeTurret(t, createPowerupCounts());
  near(t.fireRate, 4); near(t.damage, 1); assert.equal(t.pierce, 0);
  near(t.turnSpeed, 90); near(t.fov, 70);
});

test('recomputeTurret：各種類の効果量', () => {
  const t = createTurret();
  const c = { ...createPowerupCounts(), fireRate: 1, damage: 1, pierce: 1, turnSpeed: 1, fov: 1 };
  recomputeTurret(t, c);
  near(t.fireRate, 4.6); near(t.damage, 1.2); assert.equal(t.pierce, 1);
  near(t.turnSpeed, 103.5); near(t.fov, 78);
  recomputeTurret(t, { ...createPowerupCounts(), fireRate: 5, damage: 5, pierce: 3, turnSpeed: 4, fov: 3 });
  near(t.fireRate, 7); near(t.damage, 2); assert.equal(t.pierce, 3);
  near(t.turnSpeed, 144); near(t.fov, 94);
});

test('recomputeTurret は残機を変えない', () => {
  const t = createTurret();
  t.lives = 7;
  recomputeTurret(t, { ...createPowerupCounts(), life: 4 });
  assert.equal(t.lives, 7);
});

test('availablePowerups：上限の種類は除き、残機は常に残る', () => {
  const c = { ...createPowerupCounts(), fireRate: 5, pierce: 3, life: 99 };
  const a = availablePowerups(c);
  assert.ok(!a.includes('fireRate'));
  assert.ok(!a.includes('pierce'));
  assert.ok(a.includes('life'));
  assert.ok(a.includes('damage'));
});

test('availablePowerups：全種類が上限なら空（差し替えた定義で確認）', () => {
  const defs = { a: { id: 'a', max: 1, weight: 1 } };
  assert.deepEqual(availablePowerups({ a: 1 }, defs), []);
  assert.deepEqual(makeOffer({ a: 1 }, mulberry32(1), defs), []);
});

test('makeOffer：2つ、重複なし、候補の中から', () => {
  const rng = mulberry32(3);
  for (let i = 0; i < 200; i++) {
    const o = makeOffer(createPowerupCounts(), rng);
    assert.equal(o.length, 2);
    assert.notEqual(o[0], o[1]);
    for (const id of o) assert.ok(POWERUP_IDS.includes(id));
  }
});

test('makeOffer：候補が1種類ならその1つだけ', () => {
  const c = { fireRate: 5, damage: 5, pierce: 3, turnSpeed: 4, fov: 3, life: 0 };
  assert.deepEqual(makeOffer(c, mulberry32(1)), ['life']);
});

test('makeOffer：上限の種類は出ない', () => {
  const c = { ...createPowerupCounts(), fireRate: 5, damage: 5 };
  const rng = mulberry32(5);
  for (let i = 0; i < 200; i++) {
    const o = makeOffer(c, rng);
    assert.ok(!o.includes('fireRate') && !o.includes('damage'));
  }
});

test('makeOffer：重みどおりに偏る（残機 < 視界 < 通常）', () => {
  const rng = mulberry32(1);
  const n = Object.fromEntries(POWERUP_IDS.map((id) => [id, 0]));
  for (let i = 0; i < 4000; i++) for (const id of makeOffer(createPowerupCounts(), rng)) n[id]++;
  assert.ok(n.life < n.fov, `life ${n.life} < fov ${n.fov}`);
  assert.ok(n.fov < n.fireRate, `fov ${n.fov} < fireRate ${n.fireRate}`);
  assert.ok(n.fov < n.damage && n.fov < n.pierce && n.fov < n.turnSpeed);
});

test('applyPowerup：回数と能力が更新され、残機は+1', () => {
  const s = mkState();
  applyPowerup(s, 'fireRate');
  assert.equal(s.powerups.fireRate, 1);
  near(s.turret.fireRate, 4.6);
  applyPowerup(s, 'life');
  assert.equal(s.turret.lives, 4);
  assert.equal(s.powerups.life, 1);
  applyPowerup(s, 'fov');
  near(s.turret.fov, 78);
  assert.equal(s.turret.lives, 4);
});

test('chooseOffer：候補内のidだけ適用し、offer を空にする', () => {
  const s = mkState();
  s.offer = ['damage', 'pierce'];
  assert.equal(chooseOffer(s, 'fov'), false);
  assert.deepEqual(s.offer, ['damage', 'pierce']);
  assert.equal(s.powerups.fov, 0);
  assert.equal(chooseOffer(s, 'pierce'), true);
  assert.equal(s.offer, null);
  assert.equal(s.powerups.pierce, 1);
  assert.equal(s.turret.pierce, 1);
  assert.equal(chooseOffer(s, 'pierce'), false); // 選択待ちでないときは何もしない
  assert.equal(s.powerups.pierce, 1);
});

test('powerupLevelText', () => {
  const s = mkState();
  s.powerups.fireRate = 2;
  assert.equal(powerupLevelText(s, 'fireRate'), 'Lv 2 → 3');
  s.powerups.fireRate = 4;
  assert.equal(powerupLevelText(s, 'fireRate'), 'Lv 4 → 5（MAX）');
  s.turret.lives = 3;
  assert.equal(powerupLevelText(s, 'life'), '残機 3 → 4');
});
