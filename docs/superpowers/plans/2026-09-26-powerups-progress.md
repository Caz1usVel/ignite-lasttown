# パワーアップ・ステージ進行・セーブ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 撃破10体ごとの2択パワーアップ（6種）、ステージ選択と解放、セーブv2（v1からの移行つき）を、①で作った1面のゲームに追加する。

**Architecture:** パワーアップは純粋なロジック（`js/game/powerups.js`）で、`stepGame` が選択待ち（`state.offer`）を作り、その間は更新を止める。選択画面と、ステージ選択は、①と同じシーン方式（`enter/exit/update/render`）で `main.js` の常駐ループから振り分ける。ステージの登録（`data/stages.js`）と解放の判定（`core/progress.js`）はデータ駆動で、③で面を足すときは登録を1行足すだけにする。

**Tech Stack:** 素のJavaScript（ES2022、ES Modules）、Canvas 2D、Node 24（`node --test`、`node --check`）。外部依存なし。

**Spec:** `docs/superpowers/specs/2026-09-26-powerups-progress-design.md`（①の設計 `docs/superpowers/specs/2026-09-26-core-stage1-design.md` の続き）

## Global Constraints

- ビルドツール・npm依存を追加しない。GitHub Pagesに静的ファイルとしてそのまま置ける構成を保つ
- `js/game/` と `js/core/` は、モジュール読み込み時点で DOM・canvas・`window` に触れない（Nodeのテストから import できること）。例外は `js/core/view.js` の `createViewport`・`js/core/input.js`・`js/core/audio.js`（呼ばれたときだけ触れる）
- パワーアップの効果と上限（仕様書 §3.1）：連射 `4×(1+0.15n)` 上限5／攻撃力 `1+0.2n` 上限5／貫通 `n` 上限3／旋回 `90×(1+0.15n)` 上限4／視界 `70+8n` 度 上限3／残機+1 は上限なし。重みは 10・10・10・10・5・2
- 選択は撃破数10体ごと。候補は最大2つ、重複なし。ステージごとにリセット（持ち越さない）
- コンティニューは「ステージの最初からやり直す」のみ（結果画面の「もう一度」）
- セーブのキーは `td_save_v1` のまま。中身の `version` を `2` にする。書き込みは常にv2
- UIの文言は日本語。キャラクター・敵は図形で描く。AI生成の画像・動画は使わない
- コミットメッセージの末尾に、次の1行を付ける（一字一句そのまま）：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。コミットの作成者はリポジトリのローカル設定（neku8）のまま変えない
- 各タスクの最後に `node tools/check.mjs` と `npm test` が通ること（出力にwarningが出ないこと）

## ファイル構成

| ファイル | 役割 | タスク |
| --- | --- | --- |
| `js/game/powerups.js` | 定義、候補の生成、適用、能力の再計算、選択の確定、レベル表示 | 1 |
| `js/game/turret.js` | `pierce` を追加 | 1 |
| `js/game/bullets.js`, `js/game/collision.js` | 弾の貫通 | 2 |
| `js/game/state.js`, `js/game/step.js` | 選択待ちの状態、発生、停止 | 3 |
| `js/core/config.js`, `js/core/save.js`, `js/core/progress.js`, `js/data/stages.js` | ステージ数、セーブv2、解放、登録 | 4 |
| `js/scenes/stageselect.js`, `js/scenes/title.js`, `js/scenes/result.js`, `js/scenes/play.js`, HTML/CSS | ステージ選択と結果画面の流れ | 5 |
| `js/scenes/powerup.js`, `js/core/audio.js`, `js/scenes/play.js`, HTML/CSS | 選択画面、HUD、効果音 | 6 |
| `README.md` | 遊び方の追記、最終確認 | 7 |

---

### Task 1: パワーアップの定義と適用（純粋ロジック）

**Files:**
- Create: `js/game/powerups.js`
- Modify: `js/game/turret.js`（`createTurret` に `pierce: 0` を追加）
- Test: `tests/powerups.test.mjs`

**Interfaces:**
- Consumes: `CONFIG`（`FIRE_RATE`, `TURN_SPEED`, `FOV`）
- Produces:
  - `OFFER_EVERY = 10`、`OFFER_SIZE = 2`
  - `POWERUPS`：id をキーにした定義。各定義は `{ id, name, desc, icon, max, weight }`（`max` は数値または `Infinity`）
  - `POWERUP_IDS: string[]`、`createPowerupCounts(): { [id]: 0 }`
  - `availablePowerups(counts, defs = POWERUPS): string[]`
  - `makeOffer(counts, rng, defs = POWERUPS): string[]`（最大 `OFFER_SIZE`、重複なし）
  - `recomputeTurret(turret, counts)`（`fireRate / damage / pierce / turnSpeed / fov` を上書き。`lives` は触らない）
  - `applyPowerup(state, id)`（`state.powerups[id] += 1`、`life` は `state.turret.lives += 1`、そのあと `recomputeTurret`）
  - `chooseOffer(state, id): boolean`（`id` が `state.offer` に含まれるときだけ適用して `state.offer = null`。適用したら `true`）
  - `powerupLevelText(state, id): string`

- [ ] **Step 1: 失敗するテストを書く**

`tests/powerups.test.mjs`:
```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`Cannot find module ... powerups.js`）

- [ ] **Step 3: 実装する**

`js/game/turret.js` の `createTurret` の戻り値に `pierce: 0,` を追加する（`damage: 1,` の次の行）:
```js
    fireRate: CONFIG.FIRE_RATE,
    damage: 1,
    pierce: 0,
  };
```

`js/game/powerups.js`:
```js
import { CONFIG } from '../core/config.js';

export const OFFER_EVERY = 10; // 撃破数がこの数増えるごとに選択が発生する
export const OFFER_SIZE = 2;

// 1回あたりの効果量（コンセプト書「パワーアップ要素」）
const PER_LEVEL = { fireRate: 0.15, damage: 0.2, turnSpeed: 0.15, fov: 8 };

export const POWERUPS = Object.freeze({
  fireRate:  { id: 'fireRate',  name: '連射速度アップ', desc: '秒間の発射数 +15%',        icon: '⚡', max: 5,        weight: 10 },
  damage:    { id: 'damage',    name: '攻撃力アップ',   desc: '1発のダメージ +20%',       icon: '💥', max: 5,        weight: 10 },
  pierce:    { id: 'pierce',    name: '貫通弾',         desc: '倒した敵を貫通する（+1体）', icon: '🎯', max: 3,        weight: 10 },
  turnSpeed: { id: 'turnSpeed', name: '旋回速度アップ', desc: '旋回の速さ +15%',          icon: '🔄', max: 4,        weight: 10 },
  fov:       { id: 'fov',       name: '視界拡大',       desc: '見える角度 +8度',          icon: '👁', max: 3,        weight: 5 },
  life:      { id: 'life',      name: '残機+1',         desc: '残機が1つ増える',          icon: '❤', max: Infinity, weight: 2 },
});

export const POWERUP_IDS = Object.freeze(Object.keys(POWERUPS));

export function createPowerupCounts() {
  return Object.fromEntries(POWERUP_IDS.map((id) => [id, 0]));
}

export function availablePowerups(counts, defs = POWERUPS) {
  return Object.keys(defs).filter((id) => (counts[id] ?? 0) < defs[id].max);
}

// 重み付き・重複なしで最大 OFFER_SIZE 個。候補が足りなければある分だけ（0個なら空）
export function makeOffer(counts, rng, defs = POWERUPS) {
  const pool = availablePowerups(counts, defs);
  const picks = [];
  while (picks.length < OFFER_SIZE && pool.length > 0) {
    const total = pool.reduce((sum, id) => sum + defs[id].weight, 0);
    let r = rng() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= defs[pool[idx]].weight;
      if (r < 0) break;
    }
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

// 取得回数から砲台の能力を計算し直す（残機は取得した瞬間に加算するので触らない）
export function recomputeTurret(turret, counts) {
  turret.fireRate = CONFIG.FIRE_RATE * (1 + PER_LEVEL.fireRate * counts.fireRate);
  turret.damage = 1 + PER_LEVEL.damage * counts.damage;
  turret.pierce = counts.pierce;
  turret.turnSpeed = CONFIG.TURN_SPEED * (1 + PER_LEVEL.turnSpeed * counts.turnSpeed);
  turret.fov = CONFIG.FOV + PER_LEVEL.fov * counts.fov;
}

export function applyPowerup(state, id) {
  state.powerups[id] += 1;
  if (id === 'life') state.turret.lives += 1;
  recomputeTurret(state.turret, state.powerups);
}

// 選択の確定。候補に含まれるidだけを受け付ける
export function chooseOffer(state, id) {
  if (!state.offer || !state.offer.includes(id)) return false;
  applyPowerup(state, id);
  state.offer = null;
  return true;
}

export function powerupLevelText(state, id) {
  if (id === 'life') return `残機 ${state.turret.lives} → ${state.turret.lives + 1}`;
  const n = state.powerups[id];
  const next = n + 1;
  return `Lv ${n} → ${next}${next >= POWERUPS[id].max ? '（MAX）' : ''}`;
}
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS（既存62件＋新規）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: add powerup definitions, offers and turret stat recompute

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: 弾の貫通

**Files:**
- Modify: `js/game/bullets.js`（`spawnBullet` に `pierceLeft`）、`js/game/collision.js`（`resolveBulletHits` の書き換え）
- Test: `tests/collision.test.mjs`（追記）

**Interfaces:**
- Consumes: Task 1 の `turret.pierce`
- Produces: 弾は `pierceLeft`（未定義は0として扱う）を持つ。`resolveBulletHits(state)` の戻り値の形は変えない（`{ type: 'hit' | 'kill', target, x, y }` の配列）。1発の弾で当たれる敵は最大 `pierceLeft + 1` 体

- [ ] **Step 1: 失敗するテストを書く**

`tests/collision.test.mjs` の末尾に追記する（既存の import・`mkState`・`bullet`・`rng` をそのまま使う）:
```js
const pbullet = (angle, prevDist, dist, pierceLeft) => ({ ...bullet(angle, prevDist, dist), pierceLeft });
const meteorAt = (s, dist) => {
  const m = createEnemy('meteor', 0, rng, { dist, speed: 0 });
  s.enemies.push(m);
  return m;
};

test('spawnBullet は turret.pierce を pierceLeft に入れる', () => {
  const s = mkState();
  s.turret.pierce = 2;
  spawnBullet(s, 0, 600);
  assert.equal(s.bullets[0].pierceLeft, 2);
});

test('貫通0：1体倒したら弾は消え、奥の敵には当たらない', () => {
  const s = mkState();
  const a = meteorAt(s, 100), b = meteorAt(s, 150);
  s.bullets.push(pbullet(0, 60, 260, 0));
  const ev = resolveBulletHits(s);
  assert.equal(ev.length, 1);
  assert.equal(a.dead, true);
  assert.equal(b.dead, false);
  assert.equal(s.bullets[0].dead, true);
});

test('貫通2：3体まで倒して弾が消える（4体目は無傷）', () => {
  const s = mkState();
  const ms = [100, 150, 200, 250].map((d) => meteorAt(s, d));
  s.bullets.push(pbullet(0, 60, 300, 2));
  const ev = resolveBulletHits(s);
  assert.equal(ev.filter((e) => e.type === 'kill').length, 3);
  assert.deepEqual(ms.map((m) => m.dead), [true, true, true, false]);
  assert.equal(s.bullets[0].dead, true);
});

test('貫通1：1体倒したあとも弾は生きていて、残りの貫通は0になる', () => {
  const s = mkState();
  const a = meteorAt(s, 100);
  s.bullets.push(pbullet(0, 60, 160, 1));
  const ev = resolveBulletHits(s);
  assert.equal(ev.length, 1);
  assert.equal(a.dead, true);
  assert.equal(s.bullets[0].dead, false);
  assert.equal(s.bullets[0].pierceLeft, 0);
});

test('倒しきれなかったら貫通していても弾は止まる', () => {
  const s = mkState();
  const d = createEnemy('drone', 0, rng, { dist: 100, speed: 0 });
  const behind = meteorAt(s, 160);
  s.enemies.push(d);
  s.bullets.push(pbullet(0, 60, 260, 3));
  const ev = resolveBulletHits(s);
  assert.deepEqual(ev.map((e) => e.type), ['hit']);
  assert.equal(d.hp, 1);
  assert.equal(behind.dead, false);
  assert.equal(s.bullets[0].dead, true);
});

test('pierceLeft が無い弾は貫通0として扱う', () => {
  const s = mkState();
  const a = meteorAt(s, 100), b = meteorAt(s, 150);
  s.bullets.push(bullet(0, 60, 260));
  resolveBulletHits(s);
  assert.equal(a.dead, true);
  assert.equal(b.dead, false);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/collision.test.mjs`
Expected: FAIL（貫通2などの期待が満たされない。`spawnBullet` のテストは `pierceLeft` が `undefined`）

- [ ] **Step 3: 実装する**

`js/game/bullets.js` の `spawnBullet` の `state.bullets.push({...})` に `pierceLeft` を追加する:
```js
export function spawnBullet(state, angle, speed) {
  state.bullets.push({
    angle,
    dist: MUZZLE_DIST,
    prevDist: MUZZLE_DIST,
    speed,
    radius: CONFIG.BULLET_RADIUS,
    pierceLeft: state.turret.pierce ?? 0,
    dead: false,
  });
}
```

`js/game/collision.js` の `resolveBulletHits` を次の内容に置き換える（`circlesOverlap`・`targetsOf`・`resolveCoreHits`・`applyKnockback` は変えない）:
```js
// 判定は「今の向き」での画面座標で行う（見た目と一致させるため）。
// 倒した弾は pierceLeft が残っていれば消えずに進み続ける。倒しきれなかった弾はそこで止まる。
export function resolveBulletHits(state) {
  const { heading, fov, damage } = state.turret;
  const targets = targetsOf(state);
  const events = [];

  for (const b of state.bullets) {
    if (b.dead) continue;
    const span = b.dist - b.prevDist;
    const steps = Math.max(1, Math.ceil(span / SWEEP_STEP));
    let pierceLeft = b.pierceLeft ?? 0;

    sweep: for (let s = 1; s <= steps; s++) {
      const p = worldToScreen(b.angle, b.prevDist + (span * s) / steps, heading, fov);
      if (!p.visible) break;
      for (const t of targets) {
        if (t.dead) continue;
        const q = worldToScreen(t.angle, t.dist, heading, fov);
        if (!q.visible) continue;
        if (!circlesOverlap(p.x, p.y, b.radius, q.x, q.y, t.radius * CONFIG.HITBOX_RATIO)) continue;

        t.hp -= damage;
        const killed = t.hp <= 0;
        if (killed) t.dead = true;
        events.push({ type: killed ? 'kill' : 'hit', target: t, x: q.x, y: q.y });

        if (killed && pierceLeft > 0) {
          pierceLeft -= 1; // 倒した敵は dead になるので、同じ敵に二度当たることはない
          continue;
        }
        b.dead = true;
        break sweep;
      }
    }
    b.pierceLeft = pierceLeft;
  }
  return events;
}
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS（①の当たり判定のテストも含めて）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: let bullets pierce killed enemies

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 選択待ちの状態と `stepGame` への組み込み

**Files:**
- Modify: `js/game/state.js`、`js/game/step.js`
- Test: `tests/step.test.mjs`（`runUntil` の変更と追記）

**Interfaces:**
- Consumes: Task 1 の `createPowerupCounts`, `OFFER_EVERY`, `makeOffer`, `chooseOffer`
- Produces:
  - `createPlayState` が `powerups`（取得回数）、`nextOfferAt`（初期 `OFFER_EVERY`）、`offer`（`null`）を持つ
  - `stepGame` は `state.offer` が `null` でない間は何もせず `[]` を返す
  - 撃破数が `nextOfferAt` に届き、`outcome` が決まっていないとき、`makeOffer(state.powerups, state.rng)` を呼び、`nextOfferAt += OFFER_EVERY`。結果が空でなければ `state.offer = choices` にして、イベント `{ type: 'offer', choices }` を返す

- [ ] **Step 1: 失敗するテストを書く**

`tests/step.test.mjs` の import に追加する:
```js
import { chooseOffer } from '../js/game/powerups.js';
```

`runUntil` を、選択を自動で選べるように置き換える（元の関数は `function runUntil(state, controls, pred, maxSec = 10) { ... }`。最後の引数と1行だけが増える）:
```js
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
```
（元の `runUntil` の本体が上と違っていた場合は、`for` の直後に `if (autoChoose && state.offer) chooseOffer(state, state.offer[0]);` を1行足し、引数に `autoChoose = false` を足すだけにする）

「自動操縦で1面をクリアできる」テストの `runUntil(s, bot, (st) => st.outcome, 400);` を次に変える:
```js
  runUntil(s, bot, (st) => st.outcome, 400, true); // 選択が出たら先頭の候補を自動で選ぶ
```

ファイルの末尾に追記する:
```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/step.test.mjs`
Expected: FAIL（`powerups` / `offer` が `undefined`、選択が発生しない）

- [ ] **Step 3: 実装する**

`js/game/state.js` を次の内容にする:
```js
import { createTurret } from './turret.js';
import { createSpawner } from './spawner.js';
import { createPowerupCounts, OFFER_EVERY } from './powerups.js';

export function createPlayState(stage, rng = Math.random) {
  return {
    time: 0,
    turret: createTurret(),
    bullets: [],
    enemies: [],
    boss: null,
    spawner: createSpawner(stage),
    score: 0,
    kills: 0,
    powerups: createPowerupCounts(), // 取得回数（ステージごとにリセット）
    nextOfferAt: OFFER_EVERY,        // 次の選択が発生する撃破数
    offer: null,                     // 選択待ちのとき、提示中のid配列
    rng,
    outcome: null, // null | 'clear' | 'gameover'
  };
}
```

`js/game/step.js`：import に追加する:
```js
import { makeOffer, OFFER_EVERY } from './powerups.js';
```

関数の先頭の `if (state.outcome) return events;` を次に変える:
```js
  if (state.outcome || state.offer) return events; // 決着後・選択待ちの間は止める
```

`return events;`（関数の最後）の直前、`if (state.boss?.dead) { ... } else if (t.lives <= 0) { ... }` のブロックのあとに追加する:
```js
  // 撃破10体ごとのパワーアップ選択。決着した瞬間には出さない
  if (!state.outcome && state.kills >= state.nextOfferAt) {
    const choices = makeOffer(state.powerups, state.rng);
    state.nextOfferAt += OFFER_EVERY;
    if (choices.length > 0) {
      state.offer = choices;
      events.push({ type: 'offer', choices });
    }
  }
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS。自動操縦テストだけが失敗した場合は、**数値やテストを変えずに**失敗メッセージ（time / lives / bossHp）をそのまま報告して止まる。
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: trigger powerup offers every 10 kills and freeze the step while pending

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: セーブv2・ステージの登録・解放の判定

**Files:**
- Modify: `js/core/config.js`（`STAGE_COUNT: 7`）、`js/core/save.js`（全面書き換え）、`tests/save.test.mjs`（全面書き換え）
- Create: `js/data/stages.js`、`js/core/progress.js`
- Test: `tests/save.test.mjs`、`tests/progress.test.mjs`

**Interfaces:**
- Consumes: `CONFIG.STAGE_COUNT`、`STAGE1`（`js/data/stage1.js`）
- Produces:
  - `CONFIG.STAGE_COUNT = 7`
  - `SAVE_KEY = 'td_save_v1'`、`SAVE_VERSION = 2`
  - `loadSave(storage?)` / `writeSave(data, storage?)`。`loadSave` の戻り値は `{ version: 2, settings: { muted, bgmVol, seVol }, stages: { [id: string]: { cleared: boolean, best: number } } }`
  - `STAGES`（`{ 1: STAGE1 }`）、`getStage(id): Stage | null`
  - `isStageAvailable(id, getStageFn = getStage)`、`isStageUnlocked(save, id)`、`isStagePlayable(save, id, getStageFn = getStage)`、`nextPlayableStage(save, id, getStageFn = getStage): number | null`、`recordResult(save, id, outcome, score): { newBest: boolean }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/save.test.mjs` を次の内容で**全面的に置き換える**:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSave, writeSave, SAVE_KEY } from '../js/core/save.js';

const memStorage = () => ({
  data: {},
  getItem(k) { return this.data[k] ?? null; },
  setItem(k, v) { this.data[k] = String(v); },
});
const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
};
const DEFAULTS = { version: 2, settings: { muted: false, bgmVol: 0.6, seVol: 0.7 }, stages: {} };
const put = (st, obj) => st.setItem(SAVE_KEY, JSON.stringify(obj));

test('何も無ければ既定値（v2）', () => {
  assert.deepEqual(loadSave(memStorage()), DEFAULTS);
});

test('書いて読むと戻る', () => {
  const st = memStorage();
  const d = loadSave(st);
  d.stages['1'] = { cleared: true, best: 1234 };
  d.settings.muted = true;
  assert.equal(writeSave(d, st), true);
  const back = loadSave(st);
  assert.deepEqual(back.stages, { 1: { cleared: true, best: 1234 } });
  assert.equal(back.settings.muted, true);
  assert.equal(back.version, 2);
});

test('足りない設定項目は既定値で補う', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { muted: true }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.muted, true);
  assert.equal(d.settings.seVol, 0.7);
});

test('v1 からの移行：設定を引き継ぎ、highScore は1面の最高スコアになる（未クリア）', () => {
  const st = memStorage();
  put(st, { version: 1, settings: { muted: true, bgmVol: 0.2, seVol: 0.9 }, highScore: 4321 });
  const d = loadSave(st);
  assert.equal(d.version, 2);
  assert.deepEqual(d.settings, { muted: true, bgmVol: 0.2, seVol: 0.9 });
  assert.deepEqual(d.stages, { 1: { cleared: false, best: 4321 } });
  assert.equal('highScore' in d, false);
});

test('v1 で highScore が0や不正なら、stages は空', () => {
  const st = memStorage();
  put(st, { version: 1, settings: {}, highScore: 0 });
  assert.deepEqual(loadSave(st).stages, {});
  put(st, { version: 1, settings: {}, highScore: 'many' });
  assert.deepEqual(loadSave(st).stages, {});
});

test('壊れたデータ・未知のバージョン・例外は既定値', () => {
  const st = memStorage();
  st.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadSave(st), DEFAULTS);
  put(st, { version: 99, stages: { 1: { cleared: true, best: 5 } } });
  assert.deepEqual(loadSave(st), DEFAULTS);
  put(st, { version: 3 });
  assert.deepEqual(loadSave(st), DEFAULTS);
  st.setItem(SAVE_KEY, 'null');
  assert.deepEqual(loadSave(st), DEFAULTS);
  assert.deepEqual(loadSave(throwingStorage), DEFAULTS);
  assert.equal(writeSave(loadSave(throwingStorage), throwingStorage), false);
});

test('storage が無い環境（Node）でも落ちない', () => {
  assert.deepEqual(loadSave(), DEFAULTS);
  assert.equal(writeSave(loadSave()), false);
});

test('stages の検証：不正な値は補正し、不正なキーは無視する', () => {
  const st = memStorage();
  put(st, {
    version: 2,
    settings: {},
    stages: {
      1: { cleared: 'yes', best: -5 },
      2: { cleared: true, best: 'x' },
      3: { cleared: true, best: 700 },
      0: { cleared: true, best: 1 },
      8: { cleared: true, best: 1 },
      abc: { cleared: true, best: 1 },
      '1.5': { cleared: true, best: 1 },
      4: null,
    },
  });
  assert.deepEqual(loadSave(st).stages, {
    1: { cleared: false, best: 0 },
    2: { cleared: true, best: 0 },
    3: { cleared: true, best: 700 },
    4: { cleared: false, best: 0 },
  });
});

test('stages が配列や文字列でも落ちない', () => {
  const st = memStorage();
  put(st, { version: 2, settings: {}, stages: 'oops' });
  assert.deepEqual(loadSave(st).stages, {});
  put(st, { version: 2, settings: {}, stages: null });
  assert.deepEqual(loadSave(st).stages, {});
});

test('範囲外の音量は 0..1 にクランプする', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { bgmVol: 5, seVol: -1 }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 1);
  assert.equal(d.settings.seVol, 0);
});

test('数値でない音量は既定値になる', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { bgmVol: 'loud', seVol: null }, stages: {} });
  const d = loadSave(st);
  assert.equal(d.settings.bgmVol, 0.6);
  assert.equal(d.settings.seVol, 0.7);
});

test('真偽値でない muted は既定値になる', () => {
  const st = memStorage();
  put(st, { version: 2, settings: { muted: 'yes' }, stages: {} });
  assert.equal(loadSave(st).settings.muted, false);
});
```

`tests/progress.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStageAvailable, isStageUnlocked, isStagePlayable, nextPlayableStage, recordResult,
} from '../js/core/progress.js';
import { STAGES, getStage } from '../js/data/stages.js';
import { STAGE1 } from '../js/data/stage1.js';

const mkSave = (stages = {}) => ({ version: 2, settings: {}, stages });
const three = (id) => (id >= 1 && id <= 3 ? { id } : null); // 1〜3面にデータがあると仮定した登録

test('ステージの登録：1面だけ', () => {
  assert.equal(getStage(1), STAGE1);
  assert.deepEqual(Object.keys(STAGES), ['1']);
  for (let i = 2; i <= 7; i++) assert.equal(getStage(i), null);
  assert.equal(getStage(0), null);
  assert.equal(getStage('__proto__'), null);
});

test('isStageAvailable：データがある面だけ', () => {
  assert.equal(isStageAvailable(1), true);
  assert.equal(isStageAvailable(2), false);
  assert.equal(isStageAvailable(3, three), true);
  assert.equal(isStageAvailable(4, three), false);
  assert.equal(isStageAvailable(0, three), false);
  assert.equal(isStageAvailable(8, () => ({})), false); // STAGE_COUNT を超える番号は常に不可
});

test('isStageUnlocked：1面は常に解放、以降は直前の面のクリアで解放', () => {
  const s = mkSave();
  assert.equal(isStageUnlocked(s, 1), true);
  assert.equal(isStageUnlocked(s, 2), false);
  s.stages['1'] = { cleared: false, best: 900 };
  assert.equal(isStageUnlocked(s, 2), false); // 未クリアでは解放されない
  s.stages['1'].cleared = true;
  assert.equal(isStageUnlocked(s, 2), true);
  assert.equal(isStageUnlocked(s, 3), false);
});

test('isStagePlayable：データがあり、かつ解放済み', () => {
  const s = mkSave({ 1: { cleared: true, best: 1 } });
  assert.equal(isStagePlayable(s, 1), true);
  assert.equal(isStagePlayable(s, 2), false);       // 解放済みだがデータが無い（準備中）
  assert.equal(isStagePlayable(s, 2, three), true);
  assert.equal(isStagePlayable(s, 3, three), false); // データはあるが未解放
});

test('nextPlayableStage', () => {
  const s = mkSave({ 1: { cleared: true, best: 1 } });
  assert.equal(nextPlayableStage(s, 1), null);
  assert.equal(nextPlayableStage(s, 1, three), 2);
  assert.equal(nextPlayableStage(s, 2, three), null); // 2面が未クリア
  s.stages['2'] = { cleared: true, best: 1 };
  assert.equal(nextPlayableStage(s, 2, three), 3);
  assert.equal(nextPlayableStage(s, 3, three), null); // 4面のデータが無い
});

test('recordResult：クリアで cleared、最高スコアを更新', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'clear', 5000), { newBest: true });
  assert.deepEqual(s.stages['1'], { cleared: true, best: 5000 });
  assert.deepEqual(recordResult(s, 1, 'clear', 4000), { newBest: false });
  assert.equal(s.stages['1'].best, 5000);
  assert.deepEqual(recordResult(s, 1, 'clear', 6000), { newBest: true });
  assert.equal(s.stages['1'].best, 6000);
});

test('recordResult：ゲームオーバーでもスコアは記録し、cleared は変えない', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'gameover', 700), { newBest: true });
  assert.deepEqual(s.stages['1'], { cleared: false, best: 700 });
  s.stages['1'].cleared = true;
  recordResult(s, 1, 'gameover', 100);
  assert.equal(s.stages['1'].cleared, true); // 一度クリアしたら、あとの失敗で消えない
  assert.equal(s.stages['1'].best, 700);
});

test('recordResult：スコア0では最高スコア更新にならない', () => {
  const s = mkSave();
  assert.deepEqual(recordResult(s, 1, 'gameover', 0), { newBest: false });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`progress.js` / `stages.js` が無い。save のテストは v2 の期待で失敗）

- [ ] **Step 3: 実装する**

`js/core/config.js` の `CONFIG` に追加する（`VIRTUAL_SIZE: 1000,` の次の行）:
```js
  STAGE_COUNT: 7,
```

`js/data/stages.js`:
```js
import { STAGE1 } from './stage1.js';

// 面の登録。③で2〜7面のデータができたら、ここに1行ずつ足す。
export const STAGES = Object.freeze({ 1: STAGE1 });

export function getStage(id) {
  return Object.hasOwn(STAGES, id) ? STAGES[id] : null;
}
```

`js/core/progress.js`:
```js
import { CONFIG } from './config.js';
import { getStage } from '../data/stages.js';

// getStageFn は、データのある面を差し替えてテストするための引数（通常は省略する）。

// その面のデータが登録されているか（未登録は「準備中」）
export function isStageAvailable(id, getStageFn = getStage) {
  return Number.isInteger(id) && id >= 1 && id <= CONFIG.STAGE_COUNT && getStageFn(id) !== null;
}

// 1面は最初から、以降は直前の面をクリアすると解放される
export function isStageUnlocked(save, id) {
  return id === 1 || save.stages[id - 1]?.cleared === true;
}

export function isStagePlayable(save, id, getStageFn = getStage) {
  return isStageAvailable(id, getStageFn) && isStageUnlocked(save, id);
}

export function nextPlayableStage(save, id, getStageFn = getStage) {
  const next = id + 1;
  return isStagePlayable(save, next, getStageFn) ? next : null;
}

// 結果をセーブデータに反映する（呼び出し側が persist する）。最高スコアはクリア・ゲームオーバーどちらでも記録する。
export function recordResult(save, id, outcome, score) {
  const entry = (save.stages[id] ??= { cleared: false, best: 0 });
  if (outcome === 'clear') entry.cleared = true;
  const newBest = score > entry.best;
  if (newBest) entry.best = score;
  return { newBest };
}
```

`js/core/save.js` を次の内容で**全面的に置き換える**:
```js
import { CONFIG } from './config.js';

// キー名は v1 の頃のまま。変えると既存の保存が読めなくなるため（中身の version で世代を区別する）。
export const SAVE_KEY = 'td_save_v1';
export const SAVE_VERSION = 2;

const DEFAULT_SETTINGS = Object.freeze({ muted: false, bgmVol: 0.6, seVol: 0.7 });

function defaults() {
  return { version: SAVE_VERSION, settings: { ...DEFAULT_SETTINGS }, stages: {} };
}

// localStorage へのアクセス自体が例外を投げる環境（Safariのプライベートモード等）がある
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function clampVol(v, fallback) {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function sanitizeSettings(s) {
  const merged = { ...DEFAULT_SETTINGS, ...s };
  return {
    muted: typeof merged.muted === 'boolean' ? merged.muted : DEFAULT_SETTINGS.muted,
    bgmVol: clampVol(merged.bgmVol, DEFAULT_SETTINGS.bgmVol),
    seVol: clampVol(merged.seVol, DEFAULT_SETTINGS.seVol),
  };
}

// キーは 1〜STAGE_COUNT の整数の文字列だけを受け付ける
function sanitizeStages(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, entry] of Object.entries(raw)) {
    if (!/^[1-9]\d*$/.test(key)) continue;
    const id = Number(key);
    if (id < 1 || id > CONFIG.STAGE_COUNT) continue;
    out[key] = {
      cleared: entry?.cleared === true,
      best: Number.isFinite(entry?.best) && entry.best > 0 ? entry.best : 0,
    };
  }
  return out;
}

export function loadSave(storage = defaultStorage()) {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (!raw) return defaults();
    const d = JSON.parse(raw);
    if (d?.version === 1) {
      // v1 → v2：設定を引き継ぎ、highScore は1面の最高スコアにする（v1にクリアの記録は無いので未クリア）
      const stages = {};
      if (Number.isFinite(d.highScore) && d.highScore > 0) stages['1'] = { cleared: false, best: d.highScore };
      return { version: SAVE_VERSION, settings: sanitizeSettings(d.settings), stages };
    }
    if (d?.version === SAVE_VERSION) {
      return { version: SAVE_VERSION, settings: sanitizeSettings(d.settings), stages: sanitizeStages(d.stages) };
    }
    return defaults();
  } catch {
    return defaults();
  }
}

export function writeSave(data, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
    return true;
  } catch {
    return false;
  }
}
```

（`js/scenes/title.js` と `js/scenes/result.js` は、まだ `save.highScore` を参照している。Task 5 で置き換えるまでの間、ブラウザでのタイトル・結果画面は動かない（タイトルは例外で止まる）。このタスクではそこに触れない。`node --check` と `npm test` には影響しない）

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: save v2 with per-stage progress, v1 migration, stage registry and unlock rules

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: ステージ選択・タイトル・結果画面の流れ

**Files:**
- Create: `js/scenes/stageselect.js`
- Modify: `js/scenes/title.js`（全面置き換え）、`js/scenes/result.js`（全面置き換え）、`js/scenes/play.js`、`js/main.js`、`index.html`、`css/style.css`

**Interfaces:**
- Consumes: Task 4 の `getStage`、`isStageAvailable`, `isStageUnlocked`, `isStagePlayable`, `nextPlayableStage`, `recordResult`、`CONFIG.STAGE_COUNT`、`app.save.stages`
- Produces:
  - `app.mode`（`'solo' | 'duo'`。タイトルで設定する）
  - `createStageSelectScene(app)`
  - シーンの受け渡し：`play.enter({ stageId, mode })`、`result.enter({ outcome, score, kills, mode, stageId })`
  - DOM id：`stageSelectScreen`, `stageGrid`, `stageBackBtn`, `nextStageBtn`, `resultStageSelectBtn`（`titleBest` と `resultTitleBtn` は廃止）

- [ ] **Step 1: HTML と CSS を変更する**

`index.html`：タイトル画面の `<p class="best">ハイスコア <span id="titleBest">0</span></p>` の行を**削除する**。

`index.html`：`<div id="resultScreen" ...>` の中を次に置き換える（`<div id="resultScreen" class="overlay hidden">` から対応する `</div>` まで）:
```html
  <div id="resultScreen" class="overlay hidden">
    <h2 id="resultTitle"></h2>
    <dl class="result-stats">
      <dt>スコア</dt><dd id="resultScore">0</dd>
      <dt>撃破数</dt><dd id="resultKills">0</dd>
      <dt>最高スコア</dt><dd id="resultBest">0</dd>
    </dl>
    <p id="resultNewBest" class="new-best hidden">ハイスコア更新！</p>
    <div class="btn-col">
      <button class="btn" id="nextStageBtn">次のステージへ</button>
      <button class="btn btn-sub" id="retryBtn">もう一度</button>
      <button class="link-btn" id="resultStageSelectBtn">ステージ選択へ</button>
    </div>
  </div>
```

`index.html`：`<div id="pauseScreen" ...>` の直前に追加する:
```html
  <div id="stageSelectScreen" class="overlay hidden">
    <h2>ステージ選択</h2>
    <div id="stageGrid"></div>
    <button class="link-btn" id="stageBackBtn">タイトルへ</button>
  </div>

```

`css/style.css` の末尾に追加する:
```css

/* 縦が足りない画面（スマホの横向きなど）で、オーバーレイの中身が切れないようにする */
.overlay { overflow-y: auto; }
@supports (justify-content: safe center) {
  .overlay { justify-content: safe center; }
}

#stageGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 12px;
  width: min(560px, 92vw);
}
.stage-tile {
  touch-action: manipulation;
  font-family: var(--font);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  border-radius: 16px;
  border: 2px solid rgba(191, 230, 255, 0.4);
  background: rgba(20, 26, 61, 0.92);
  cursor: pointer;
}
.stage-tile:hover:not(:disabled) { border-color: var(--star-gold); }
.stage-tile:disabled { opacity: 0.45; cursor: default; }
.stage-tile.cleared { border-color: rgba(182, 255, 176, 0.7); }
.tile-num { font-weight: 800; font-size: 1.3rem; color: var(--star-gold); }
.tile-status { font-size: 0.85rem; color: var(--text-dim); }
.tile-best { font-size: 0.8rem; color: var(--text-dim); min-height: 1.1em; }
```

- [ ] **Step 2: ステージ選択のシーンを作る**

`js/scenes/stageselect.js`:
```js
import { CONFIG } from '../core/config.js';
import { isStageAvailable, isStageUnlocked, isStagePlayable } from '../core/progress.js';
import { drawBackground } from '../render/background.js';

function statusOf(save, id) {
  if (!isStageAvailable(id)) return '準備中';
  if (!isStageUnlocked(save, id)) return '未解放';
  return save.stages[id]?.cleared ? 'クリア済み' : '挑戦できる';
}

export function createStageSelectScene(app) {
  const { dom } = app;
  dom.stageBackBtn.addEventListener('click', () => app.setScene('title'));

  // 入るたびに、セーブの内容から作り直す
  function build() {
    const save = app.save;
    dom.stageGrid.replaceChildren();
    for (let id = 1; id <= CONFIG.STAGE_COUNT; id++) {
      const entry = save.stages[id];
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'stage-tile' + (entry?.cleared ? ' cleared' : '');
      tile.disabled = !isStagePlayable(save, id);

      const num = document.createElement('span');
      num.className = 'tile-num';
      num.textContent = `${id}面`;
      const status = document.createElement('span');
      status.className = 'tile-status';
      status.textContent = statusOf(save, id);
      const best = document.createElement('span');
      best.className = 'tile-best';
      best.textContent = entry && entry.best > 0 ? `最高 ${entry.best.toLocaleString()}` : '';
      tile.append(num, status, best);

      tile.addEventListener('click', () => app.setScene('play', { stageId: id, mode: app.mode }));
      dom.stageGrid.append(tile);
    }
  }

  return {
    enter() {
      build();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.stageSelectScreen.classList.remove('hidden');
      app.audio.playBgm(null);
    },
    exit() {
      dom.stageSelectScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
```

- [ ] **Step 3: タイトルを置き換える**

`js/scenes/title.js` を次の内容で**全面的に置き換える**:
```js
import { GAME_TITLE } from '../core/config.js';
import { drawBackground } from '../render/background.js';

export function createTitleScene(app) {
  const { dom } = app;
  dom.titleLogo.textContent = GAME_TITLE;
  // ソロと2人協力は操作の分担が違うだけ。どちらもステージ選択へ進み、mode はヒント表示にだけ使う
  dom.startSoloBtn.addEventListener('click', () => {
    app.mode = 'solo';
    app.setScene('stageselect');
  });
  dom.startDuoBtn.addEventListener('click', () => {
    app.mode = 'duo';
    app.setScene('stageselect');
  });
  dom.titleSettingsBtn.addEventListener('click', () => app.settings.open());

  return {
    enter() {
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.titleScreen.classList.remove('hidden');
      app.audio.playBgm(null);
    },
    exit() {
      dom.titleScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
```

- [ ] **Step 4: 結果画面を置き換える**

`js/scenes/result.js` を次の内容で**全面的に置き換える**:
```js
import { drawBackground } from '../render/background.js';
import { recordResult, nextPlayableStage } from '../core/progress.js';

export function createResultScene(app) {
  const { dom } = app;
  let last = { mode: 'solo', stageId: 1 };
  let nextId = null;

  dom.retryBtn.addEventListener('click', () => {
    app.setScene('play', { mode: last.mode, stageId: last.stageId }); // ステージの最初からやり直す
  });
  dom.nextStageBtn.addEventListener('click', () => {
    if (nextId !== null) app.setScene('play', { mode: last.mode, stageId: nextId });
  });
  dom.resultStageSelectBtn.addEventListener('click', () => app.setScene('stageselect'));

  return {
    enter({ outcome, score, kills, mode, stageId }) {
      last = { mode, stageId };
      const { newBest } = recordResult(app.save, stageId, outcome, score);
      app.persist();
      nextId = outcome === 'clear' ? nextPlayableStage(app.save, stageId) : null;

      dom.resultTitle.textContent = outcome === 'clear' ? 'ステージクリア！' : 'ゲームオーバー';
      dom.resultScore.textContent = score.toLocaleString();
      dom.resultKills.textContent = kills.toLocaleString();
      dom.resultBest.textContent = app.save.stages[stageId].best.toLocaleString();
      dom.resultNewBest.classList.toggle('hidden', !newBest);
      dom.nextStageBtn.classList.toggle('hidden', nextId === null);
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.resultScreen.classList.remove('hidden');
    },
    exit() {
      dom.resultScreen.classList.add('hidden');
    },
    update() {},
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
    },
  };
}
```

- [ ] **Step 5: play シーンにステージ番号を渡す**

`js/scenes/play.js`：`import { STAGE1 } from '../data/stage1.js';` の行を次に変える:
```js
import { getStage } from '../data/stages.js';
```

`let mode = 'solo';` の次の行に追加する:
```js
  let stageId = 1;
```

`enter(params = {})` の中の次の2行を置き換える:
```js
        mode = params.mode ?? mode;
        state = createPlayState(STAGE1);
```
↓
```js
        mode = params.mode ?? mode;
        stageId = params.stageId ?? stageId;
        state = createPlayState(getStage(stageId));
```

結果画面へ渡す行を置き換える:
```js
          app.setScene('result', { outcome: state.outcome, score: state.score, kills: state.kills, mode });
```
↓
```js
          app.setScene('result', { outcome: state.outcome, score: state.score, kills: state.kills, mode, stageId });
```

- [ ] **Step 6: main.js につなぐ**

`js/main.js`：import に追加する:
```js
import { createStageSelectScene } from './scenes/stageselect.js';
```

`IDS` を変更する。次の2行を置き換える:
```js
  'titleScreen', 'titleLogo', 'startSoloBtn', 'startDuoBtn', 'titleSettingsBtn', 'titleBest',
```
↓
```js
  'titleScreen', 'titleLogo', 'startSoloBtn', 'startDuoBtn', 'titleSettingsBtn',
  'stageSelectScreen', 'stageGrid', 'stageBackBtn',
```
```js
  'retryBtn', 'resultTitleBtn',
```
↓
```js
  'nextStageBtn', 'retryBtn', 'resultStageSelectBtn',
```

`app` オブジェクトの `startGame: (mode) => setScene('play', { mode }),` の行を次に置き換える:
```js
  mode: 'solo', // 'solo' | 'duo'（タイトルで選ぶ）
```

`app.scenes.title = createTitleScene(app);` の次の行に追加する:
```js
app.scenes.stageselect = createStageSelectScene(app);
```

- [ ] **Step 7: 機械チェック**

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS
Run: `grep -rn "highScore\|titleBest\|resultTitleBtn\|startGame\|STAGE1" js/ index.html` → Expected: `js/data/stage1.js` と `js/data/stages.js` の `STAGE1` 以外に出力が無い（`save.js` のv1移行コード内の `d.highScore` は除く）

（このタスクの画面確認は、コントローラーがブラウザで行う。実装担当はブラウザを開かない）

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "feat: add stage select, per-stage results and unlock flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（Task 5 のコミット後）：**
- タイトル→「ひとりで」でステージ選択。1面は「挑戦できる」、2〜7面は「準備中」で押せない。「タイトルへ」で戻れる
- 1面を始める→ゲームオーバー→結果画面（最高スコア、「もう一度」「ステージ選択へ」。「次のステージへ」は出ない）。「もう一度」で1面がやり直しになり、パワーアップは素の状態に戻っている
- 1面をクリア→結果画面に「次のステージへ」は出ない（2面が準備中のため）。ステージ選択で1面が「クリア済み」、最高スコアが出ている。ページを再読み込みしても残る
- 旧セーブ（v1）：`localStorage.setItem('td_save_v1', JSON.stringify({version:1,settings:{muted:true,bgmVol:0.3,seVol:0.5},highScore:1234}))` を入れて再読み込みすると、ミュート・音量が引き継がれ、1面のタイルに「最高 1,234」が出る（未クリア）
- モバイル（375×812）とスマホ横向き（812×375）で、ステージ選択・結果・選択画面が切れずに見える
- コンソールにエラーが無い

---

### Task 6: 選択画面・HUD・効果音・プレイシーンへの組み込み

**Files:**
- Create: `js/scenes/powerup.js`
- Modify: `js/core/audio.js`、`js/scenes/play.js`、`js/main.js`、`index.html`、`css/style.css`

**Interfaces:**
- Consumes: Task 1 の `POWERUPS`, `POWERUP_IDS`, `chooseOffer`, `powerupLevelText`。Task 3 の `state.offer` と `'offer'` イベント
- Produces:
  - `createPowerupScene(app)`：`{ enter, exit, update, render }`
  - play シーンに `getState()` を追加（`app.scenes.play.getState()`）
  - `audio.se.offer()`、`audio.se.pick()`
  - DOM id：`hudPowerups`、`powerupScreen`、`offerCard0`、`offerCard1`

- [ ] **Step 1: HTML と CSS を追加する**

`index.html`：`<div class="hud-left">` の中の `<div id="hudScore">0</div>` の直後に追加する:
```html
      <div id="hudPowerups"></div>
```

`index.html`：`<div id="pauseScreen" ...>` の直前に追加する:
```html
  <div id="powerupScreen" class="overlay hidden">
    <h2>パワーアップを選んでね</h2>
    <div class="offer-row">
      <button type="button" class="offer-card" id="offerCard0">
        <span class="card-key">1</span>
        <span class="card-icon"></span>
        <span class="card-name"></span>
        <span class="card-desc"></span>
        <span class="card-level"></span>
      </button>
      <button type="button" class="offer-card" id="offerCard1">
        <span class="card-key">2</span>
        <span class="card-icon"></span>
        <span class="card-name"></span>
        <span class="card-desc"></span>
        <span class="card-level"></span>
      </button>
    </div>
    <p class="offer-hint">クリック・タップ、または 1 / 2 キーで選べます</p>
  </div>

```

`css/style.css` の末尾に追加する:
```css

#hudPowerups { font-size: 0.95rem; color: var(--text-dim); min-height: 1.2em; }

#powerupScreen { z-index: 12; }
.offer-row {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
.offer-card {
  touch-action: manipulation;
  font-family: var(--font);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: min(210px, 42vw);
  min-width: 150px;
  padding: 18px 12px 16px;
  border-radius: 20px;
  border: 2px solid rgba(255, 216, 102, 0.5);
  background: rgba(20, 26, 61, 0.92);
  cursor: pointer;
  position: relative;
  transition: transform 0.08s ease, border-color 0.08s ease;
}
.offer-card:hover, .offer-card:focus-visible { border-color: var(--star-gold); transform: translateY(-3px); }
.offer-card:active { transform: translateY(1px); }
.offer-card.hidden { display: none; }
.card-key {
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 0.85rem;
  color: var(--text-dim);
}
.card-icon { font-size: 2.2rem; line-height: 1; }
.card-name { font-weight: 800; font-size: 1.05rem; color: var(--star-gold); }
.card-desc { font-size: 0.9rem; color: var(--text-dim); }
.card-level { font-weight: 800; font-size: 0.95rem; }
.offer-hint { color: var(--text-dim); font-size: 0.85rem; margin: 6px 0 0; }
/* 出た直後は誤選択を防ぐため押せない（見た目でも分かるように薄くする） */
#powerupScreen.locked .offer-card { opacity: 0.45; pointer-events: none; }
```

- [ ] **Step 2: 効果音を追加する**

`js/core/audio.js` の `se: {` オブジェクトの `click: () => tone(440, 0.06, { type: 'sine', gain: 0.12 }),` の次の行に追加する:
```js
      offer: () => {
        tone(660, 0.08, { type: 'triangle', gain: 0.18 });
        tone(880, 0.08, { type: 'triangle', gain: 0.18, delay: 0.08 });
        tone(1320, 0.14, { type: 'triangle', gain: 0.2, delay: 0.16 });
      },
      pick: () => {
        tone(784, 0.07, { type: 'square', gain: 0.12 });
        tone(1046.5, 0.12, { type: 'square', gain: 0.14, delay: 0.06 });
      },
```

- [ ] **Step 3: 選択画面のシーンを作る**

`js/scenes/powerup.js`:
```js
import { POWERUPS, chooseOffer, powerupLevelText } from '../game/powerups.js';

const INPUT_LOCK = 0.5; // 秒。連射中の誤選択を防ぐ

// パワーアップの選択画面。止まったプレイ画面を背景にして、DOMのカード2枚を出す。
export function createPowerupScene(app) {
  const { dom, audio } = app;
  const cards = [dom.offerCard0, dom.offerCard1];
  let choices = [];
  let lock = 0;
  let active = false;

  function pick(i) {
    if (!active || lock > 0 || !choices[i]) return;
    if (!chooseOffer(app.scenes.play.getState(), choices[i])) return;
    audio.se.pick();
    app.setScene('play', { resume: true });
  }

  cards.forEach((card, i) => card.addEventListener('click', () => pick(i)));
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Digit1' || e.code === 'Numpad1') pick(0);
    else if (e.code === 'Digit2' || e.code === 'Numpad2') pick(1);
  });

  return {
    enter() {
      const state = app.scenes.play.getState();
      choices = [...state.offer];
      lock = INPUT_LOCK;
      active = true;
      cards.forEach((card, i) => {
        const id = choices[i];
        card.classList.toggle('hidden', !id);
        if (!id) return;
        const def = POWERUPS[id];
        card.querySelector('.card-icon').textContent = def.icon;
        card.querySelector('.card-name').textContent = def.name;
        card.querySelector('.card-desc').textContent = def.desc;
        card.querySelector('.card-level').textContent = powerupLevelText(state, id);
      });
      dom.powerupScreen.classList.add('locked');
      dom.powerupScreen.classList.remove('hidden');
    },
    exit() {
      active = false;
      dom.powerupScreen.classList.add('hidden');
    },
    update(dt) {
      lock = Math.max(0, lock - dt);
      if (lock === 0) dom.powerupScreen.classList.remove('locked');
    },
    render(g) {
      app.scenes.play.render(g, 0);
    },
  };
}
```

- [ ] **Step 4: play シーンに組み込む**

`js/scenes/play.js`：import に追加する:
```js
import { POWERUPS, POWERUP_IDS } from '../game/powerups.js';
```

`updateHud` の中の、`dom.hudScore.textContent = ...` の行の次に追加する:
```js
    dom.hudPowerups.textContent = POWERUP_IDS
      .filter((id) => id !== 'life' && state.powerups[id] > 0) // 残機はハート表示に反映されるので並べない
      .map((id) => `${POWERUPS[id].icon}${state.powerups[id]}`)
      .join(' ');
```

`handleEvents` の `switch` に、`case 'gameover':` の前に追加する:
```js
        case 'offer':
          audio.se.offer();
          break;
```

`update(dt)` の中の `updateHud();` の行の直後に追加する:
```js
      if (state.offer) {
        app.setScene('powerup'); // 選択が出たら止まる。選んだら { resume: true } で戻ってくる
        return;
      }
```

シーンオブジェクトの末尾（`render(g, dt) { ... },` の次）にメソッドを追加する:
```js
    getState() {
      return state;
    },
```

- [ ] **Step 5: main.js につなぐ**

`js/main.js`：import に追加する:
```js
import { createPowerupScene } from './scenes/powerup.js';
```

`IDS` の配列の `'hud', 'hudLives', 'hudScore', 'hudTime', 'pauseBtn', 'hint',` の行を次に変える:
```js
  'hud', 'hudLives', 'hudScore', 'hudPowerups', 'hudTime', 'pauseBtn', 'hint',
  'powerupScreen', 'offerCard0', 'offerCard1',
```

`app.scenes.pause = createPauseScene(app);` の次の行に追加する:
```js
app.scenes.powerup = createPowerupScene(app);
```

- [ ] **Step 6: 機械チェック**

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS

（このタスクの画面確認は、実装担当ではなくコントローラーがブラウザで行う。実装担当はブラウザを開かない）

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat: add powerup selection scene, HUD icons and sounds

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（Task 6 のコミット後）：**
- 開発サーバーを起動し、`window.requestAnimationFrame` を差し替えてフレームを手動で進める（ペインが非表示でも進められる）。撃破数が10になったら、選択画面が出てプレイが止まる
- カードが2枚、名前・説明・レベル（`Lv 0 → 1`）が正しく出る。最初の0.5秒はカードが薄く押せない。0.5秒後にクリック（合成イベントの `click`）または 1/2 キーで選べる
- 選ぶとプレイに戻り、HUDにアイコンとレベルが出る。連射・視界拡大などが実際に効く
- 選択画面で Esc を押してもポーズにならない
- コンソールにエラーが無い

---

### Task 7: README と最終確認

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README を更新する**

`README.md` の「Esc・P・⏸ でポーズ。」の行の次に追加する:
```markdown

## ステージとパワーアップ

- タイトルで「ひとりで」または「ふたりで」を選ぶと、ステージ選択に進む。1面から遊べて、クリアすると次の面が解放される（2〜7面は準備中）
- 敵を10体倒すごとにゲームが止まり、パワーアップを2択で選べる（クリック・タップ、または 1 / 2 キー）
- パワーアップはステージごとにリセットされる。ゲームオーバーからの「もう一度」は、そのステージの最初からのやり直し

| 種類 | 効果 | 上限 |
| --- | --- | --- |
| 連射速度アップ | 秒間の発射数 +15% | 5回 |
| 攻撃力アップ | 1発のダメージ +20% | 5回 |
| 貫通弾 | 倒した敵を貫通する（+1体ずつ、最大4体に当たる） | 3回 |
| 旋回速度アップ | 旋回の速さ +15% | 4回 |
| 視界拡大 | 見える角度 +8度 | 3回 |
| 残機+1 | 残機が1つ増える | 上限なし（出にくい） |

## セーブ

ブラウザの localStorage（キー `td_save_v1`、中身は version 2）に、設定とステージごとのクリア・最高スコアを保存する。古い形式（v1）は自動で引き継ぐ。
```

- [ ] **Step 2: 最終確認**

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS（テスト数と所要時間を記録しておく）
Run: `git status` → Expected: README 以外に未コミットの変更が無い

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "docs: document stage select, powerups and save format

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
