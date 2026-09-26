# 出現表の抽選・最終ボス・7面 Implementation Plan（③c 計画B）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全テーマの敵を偏りなく出す抽選（`pool`）、ボスA・B・Cの識別攻撃を合わせた最終ボス（bossD）、7面を作って、全7面を通して遊べるようにする。

**Architecture:** `pool` は出現表の項目の新しい形で、「袋方式」の抽選（種類が全部1周するまで同じものは出ない）。最終ボスは、ボスBの突進を、内部のボスBオブジェクトに任せて再利用する。モードは `rest → summon | dash | decoy` の繰り返しで、HPが35%以下では、召喚・偽像・突進を同時に行う。

**Tech Stack:** 素のJavaScript（ES2022、ES Modules）、Canvas 2D、Node 24（`node --test`）。外部依存なし。

**Spec:** `docs/superpowers/specs/2026-09-27-stage567-bossc-design.md`（§7、§8 の7面）。計画A（`docs/superpowers/plans/2026-09-27-stage56-bossc.md`）は完了済みで、その成果（`boss-a.js`〜`boss-c.js`、`BOSSES` 登録表、`ENEMY_INITS`、区間ごとのタイマー、`decoy`、`assertMostlyClears`）を使う

## Global Constraints

- ビルドツール・npm依存を追加しない。GitHub Pagesに静的ファイルとしてそのまま置ける構成を保つ
- `js/game/` と `js/core/` は、モジュール読み込み時点で DOM・canvas・`window` に触れない。`js/render/` も同様
- 数値は仕様書 §7・§8 のとおり（`BOSS_D_BASE`、7面の出現表）。`BOSS_D_BASE` は凍結。ボスの `color` は `#rrggbb` のみ
- 数値は仮。自動操縦テストを通すために調整してよいのは、各タスクに書いた範囲だけ。調整したら最終の数値とシードごとの結果（クリア・時間・残機）を報告する
- UIの文言は日本語。キャラクター・敵は図形で描く。AI生成の画像・動画は使わない
- コミットメッセージの末尾に、次の1行を付ける（一字一句そのまま）：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。コミットの作成者はリポジトリのローカル設定のまま変えない。`git add` は、パスを指定して行う
- 各タスクの最後に `node tools/check.mjs` と `npm test` が通ること（出力にwarningが出ないこと）。ベースラインは235件

## ファイル構成

| ファイル | 役割 | タスク |
| --- | --- | --- |
| `js/game/spawner.js`, `tests/pool.test.mjs` | `pool` の出現（袋方式）と検査 | B1 |
| `js/game/boss-d.js`（新規）, `js/game/boss.js`（登録）, `js/game/enemies.js`（decoy の `style`/`color`）, `tests/boss-d.test.mjs` | 最終ボス | B2 |
| `js/render/entities.js` | 最終ボスと、その偽像の描画 | B3 |
| `js/data/stage7.js`, `js/data/stages.js`, `tests/stage7.test.mjs`, `tests/progress.test.mjs`, `tests/step.test.mjs`, `README.md` | 7面・登録・自動操縦・README | B4 |

---

### Task B1: `pool`（出現表の抽選）

**Files:**
- Modify: `js/game/spawner.js`
- Test: `tests/pool.test.mjs`

**Interfaces:**
- Produces: `spawns` の値に `{ every: number, pool: string[], formation?: { count: number | [number, number], minSep: number } }` を許す（キー名は任意。以降、7面では `pool` を使う）。`validateStage` は、`pool` の項目ではキー名を敵の種類として検査しない。`sp.bags`（キー `${区間番号}:${キー名}` → 残りの袋の配列）

- [ ] **Step 1: 失敗するテストを書く**

`tests/pool.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpawner, updateSpawner, validateStage } from '../js/game/spawner.js';
import { mulberry32 } from '../js/core/util.js';

const TYPES = ['meteor', 'drone', 'burrower', 'shielder'];
const mkStage = (spawns, extra = {}) => ({
  id: 9,
  segments: [{ from: 0, to: 1000, spawns }],
  spawnEnd: 1000,
  boss: { type: 'bossA', params: {} },
  ...extra,
});

// 出現した敵の種類を、出現順に返す（編隊は formationDrone 1回として数える）
function drawTypes(stage, seconds, seed = 3) {
  const state = { enemies: [], boss: null, rng: mulberry32(seed) };
  const sp = createSpawner(stage, 1);
  const seen = [];
  let last = 0;
  for (let i = 0; i < Math.round(seconds / 0.1); i++) {
    updateSpawner(sp, state, 0.1);
    if (state.enemies.length > last) {
      const added = state.enemies.slice(last);
      seen.push(added[0].type === 'formationDrone' ? 'formationDrone' : added[0].type);
      last = state.enemies.length;
    }
  }
  return seen;
}

test('pool：袋方式。全種類が1周するまで、同じ種類は出ない', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const seen = drawTypes(stage, 2 * 4 * 6 + 0.5); // 6周ぶん
  assert.equal(seen.length, 24);
  for (let lap = 0; lap < 6; lap++) {
    const bag = seen.slice(lap * 4, lap * 4 + 4);
    assert.deepEqual([...bag].sort(), [...TYPES].sort(), `lap ${lap}: ${bag}`);
  }
});

test('pool：周ごとの順番はシャッフルされる（毎回同じ順ではない）', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const seen = drawTypes(stage, 2 * 4 * 12 + 0.5);
  const laps = new Set();
  for (let lap = 0; lap < 12; lap++) laps.add(seen.slice(lap * 4, lap * 4 + 4).join(','));
  assert.ok(laps.size >= 4, `distinct orders: ${laps.size}`);
});

test('pool：every に scale を掛ける', () => {
  const stage = mkStage({ pool: { every: 2, pool: TYPES } });
  const state = { enemies: [], boss: null, rng: mulberry32(1) };
  const sp = createSpawner(stage, 1.5); // 3 秒ごと
  for (let i = 0; i < 100; i++) updateSpawner(sp, state, 0.1); // 10 秒
  assert.equal(state.enemies.length, 3);
});

test('pool：formationDrone が出たら、formation の設定で編隊（count 機）を出す', () => {
  const stage = mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'], formation: { count: [3, 4], minSep: 25 } } });
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(stage, 1);
  for (let i = 0; i < 20 * 10; i++) updateSpawner(sp, state, 0.1); // 20 秒 = 10 回
  const drones = state.enemies.filter((e) => e.type === 'formationDrone');
  const meteors = state.enemies.filter((e) => e.type === 'meteor');
  assert.equal(meteors.length, 5);
  assert.ok(drones.length >= 15 && drones.length <= 20, `drones ${drones.length}`); // 5 編隊 × 3〜4
});

test('pool：区間が変わると袋も新しくなる（区間ごとに別の袋）', () => {
  const stage = {
    id: 9,
    segments: [
      { from: 0, to: 10, spawns: { pool: { every: 2, pool: ['meteor', 'drone'] } } },
      { from: 10, to: 30, spawns: { pool: { every: 2, pool: ['burrower', 'shielder'] } } },
    ],
    spawnEnd: 30,
    boss: { type: 'bossA', params: {} },
  };
  const seen = drawTypes(stage, 29.5);
  const second = seen.slice(4); // 10 秒以降（2 秒ごとに 4 回ぶんが最初の区間）
  assert.ok(second.every((t) => t === 'burrower' || t === 'shielder'), second.join());
});

test('validateStage：pool の検査', () => {
  validateStage(mkStage({ pool: { every: 2, pool: TYPES } }));
  validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'], formation: { count: 3, minSep: 25 } } }));
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: [] } })), /pool/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: 'meteor' } })), /pool/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['nope'] } })), /unknown enemy type/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 0, pool: TYPES } })), /every/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone', 'meteor'] } })), /formation/);
  assert.throws(() => validateStage(mkStage({ pool: { every: 2, pool: ['formationDrone'], formation: { count: 0, minSep: 25 } } })), /count/);
});

test('validateStage：pool でない項目は、これまでどおりキー名を種類として検査する', () => {
  assert.throws(() => validateStage(mkStage({ nope: 3 })), /unknown enemy type/);
  validateStage(mkStage({ meteor: 3 }));
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/pool.test.mjs`
Expected: FAIL（`pool` の項目が読めない）

- [ ] **Step 3: 実装する**

`js/game/spawner.js`：

1. `createSpawner` の返すオブジェクトに `bags: {},` を足す:
```js
  return { stage, scale, time: 0, timers: {}, bags: {}, bossSpawned: false };
```

2. `readEntry` の先頭（`if (typeof entry === 'number')` の前）に追加する。`{ every, group }` の返す値に、`pool`（配列）と `formation`（`{ lo, hi, minSep }`）を足した形で返す:
```js
  if (entry && typeof entry === 'object' && 'pool' in entry) {
    const { every, pool, formation } = entry;
    if (!Number.isFinite(every) || every <= 0) throw new Error(`invalid spawn "every" for ${type}: ${every}`);
    if (!Array.isArray(pool) || pool.length === 0) throw new Error(`invalid spawn "pool" for ${type}: must be a non-empty array`);
    for (const t of pool) {
      if (!Object.prototype.hasOwnProperty.call(ENEMY_DEFS, t)) throw new Error(`unknown enemy type in pool: ${t}`);
    }
    let group = null;
    if (pool.includes('formationDrone')) {
      if (!formation) throw new Error(`pool with formationDrone needs "formation" (${type})`);
      group = readEntry('formationDrone', { every, count: formation.count, minSep: formation.minSep }).group;
    }
    return { every, group: null, pool, formationGroup: group };
  }
```

3. `validateStage` の中の、種類名の検査を、`pool` の項目では飛ばす。次の2行:
```js
      if (!Object.prototype.hasOwnProperty.call(ENEMY_DEFS, type)) throw new Error(`${label}: unknown enemy type in spawns: ${type}`);
      readEntry(type, raw);
```
を次に置き換える:
```js
      const isPool = raw && typeof raw === 'object' && 'pool' in raw;
      if (!isPool && !Object.prototype.hasOwnProperty.call(ENEMY_DEFS, type)) throw new Error(`${label}: unknown enemy type in spawns: ${type}`);
      readEntry(type, raw);
```
（`count` 配列の要素数の検査は、そのままにする）

4. `updateSpawner` の、項目を読む部分と、出す部分を置き換える。次の行:
```js
      const { every: baseEvery, group } = readEntry(type, raw);
```
を
```js
      const { every: baseEvery, group, pool, formationGroup } = readEntry(type, raw);
```
に、そして `while` ループの中の `if (group) { … } else { … }` を次に置き換える:
```js
        if (pool) {
          // 袋方式：空なら全種類をシャッフルして詰め、1つずつ取り出す（1周するまで同じ種類は出ない）
          let bag = sp.bags[key];
          if (!bag || bag.length === 0) bag = sp.bags[key] = shuffled(pool, state.rng);
          const picked = bag.pop();
          if (picked === 'formationDrone') {
            const n = randInt(state.rng, formationGroup.lo, formationGroup.hi);
            state.enemies.push(...createFormation('formationDrone', n, formationGroup.minSep, state.rng));
          } else {
            const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
            state.enemies.push(createEnemy(picked, angle, state.rng));
          }
        } else if (group) {
          const n = randInt(state.rng, group.lo, group.hi);
          state.enemies.push(...createFormation(type, n, group.minSep, state.rng));
        } else {
          const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
          state.enemies.push(createEnemy(type, angle, state.rng));
        }
```

5. ファイルの末尾（または `readEntry` の前）に、フィッシャー–イェーツのシャッフルを足す:
```js
// フィッシャー–イェーツ（元の配列は変えない）
function shuffled(items, rng) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```
（`randInt(rng, lo, hi)` は両端を含む。`spawner.js` は既に `randInt` を import している）

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add js/game/spawner.js tests/pool.test.mjs
git commit -m "feat: add bag-drawn pool spawn entries

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B2: 最終ボス（bossD）

**Files:**
- Create: `js/game/boss-d.js`
- Modify: `js/game/boss.js`（登録）、`js/game/enemies.js`（`ENEMY_INITS.decoy` に `style`・`color`）
- Test: `tests/boss-d.test.mjs`

**Interfaces:**
- Consumes: `createBossB` / `updateBossB`（`boss-b.js`）、`pickSpreadAngles`（`boss-a.js`）、`createEnemy`（`decoy`、`bossMinion`）、`randInt` / `randRange`
- Produces:
  - `js/game/boss-d.js`：`BOSS_D_BASE`（凍結）、`createBossD(params = {})`、`updateBossD(boss, state, dt)`
  - `BOSSES.bossD = { name: '最終ボス', color: '#ffd24a', create: createBossD, update: updateBossD }`
  - ボスDの項目：`type: 'bossD'`、`p`、`hp`、`maxHp`、`radius`、`angle`、`dist`、`targetDist`、`dir`、`arrived`、`t`、`dead`、`phase`（待機中は `mode`（`'approach' | 'rest' | 'summon' | 'decoy' | 'final'`）、突進中は内部のボスBの `phase`）、`mode`、`modeT`、`lastMode`、`volleysLeft`、`hidden`、`damageTaken`、`damageMult`、`hitCore`、`dashing`、`inner`、`decoys`、`decoyRefillT`、`decoyLifeT`、`final`、`finalSummonT`、`finalDashT`
  - 偽像の `opts.style`（文字列、既定 `null`）と `opts.color`（文字列、既定 `null`）を、敵の `e.style` / `e.color` に持つ（描画用。B3）

- [ ] **Step 1: 失敗するテストを書く**

`tests/boss-d.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_D_BASE, createBossD, updateBossD } from '../js/game/boss-d.js';
import { createBoss, updateBoss, BOSSES } from '../js/game/boss.js';
import { createEnemy, updateEnemies } from '../js/game/enemies.js';
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
// 次のモードを強制する（ランダム選択を避ける）
const force = (b, s, mode) => {
  b.mode = 'rest'; b.modeT = 0; b.lastMode = null;
  const pick = { summon: 0, dash: 1, decoy: 2 };
  // pickMode は candidates から randInt で選ぶ。狙いのモードになるまで rng を進める代わりに、公開の enter* に頼らず
  // 「rest → 目的のモード」を直接作るヘルパを使う
  b.__force?.(mode);
  return pick[mode];
};

test('BOSS_D_BASE：仕様の値で、凍結されている', () => {
  assert.equal(Object.isFrozen(BOSS_D_BASE), true);
  assert.equal(BOSS_D_BASE.hp, 90);
  assert.equal(BOSS_D_BASE.radius, 64);
  assert.equal(BOSS_D_BASE.dist, 340);
  assert.equal(BOSS_D_BASE.moveSpeed, 28);
  assert.equal(BOSS_D_BASE.angleRange, 50);
  assert.equal(BOSS_D_BASE.drift, 8);
  assert.equal(BOSS_D_BASE.restTime, 3.0);
  assert.equal(BOSS_D_BASE.finalRatio, 0.35);
  assert.deepEqual(BOSS_D_BASE.summonCount, [2, 3]);
  assert.equal(BOSS_D_BASE.summonMinSep, 25);
  assert.equal(BOSS_D_BASE.summonVolleys, 2);
  assert.equal(BOSS_D_BASE.summonGap, 3.0);
  assert.equal(BOSS_D_BASE.minionApproach, 7);
  assert.equal(BOSS_D_BASE.decoyCount, 2);
  assert.equal(BOSS_D_BASE.decoyMinSep, 30);
  assert.equal(BOSS_D_BASE.decoyLifetime, 8);
  assert.deepEqual({ ...BOSS_D_BASE.dash }, {
    dashCount: 1, dashTime: 2.8, dashBreak: 6, settle: 0.5, telegraph: 1.0, vanish: 0.8,
    reappearDist: 440, reappearMargin: 15, roarTime: 2.2, roarMult: 1.5,
  });
  assert.equal(BOSS_D_BASE.finalSummonInterval, 6);
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
  arrive(b, s);
  assert.equal(b.arrived, true);
  assert.equal(b.dist, 340);
  assert.equal(b.mode, 'rest');
  assert.equal(b.phase, 'rest');
  assert.equal(minions(s).length + decoys(s).length, 0);
});

test('rest は 3 秒。そのあと、前回と違うモードを選ぶ（summon / dash / decoy）', () => {
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
      if (m !== last && m !== 'rest') { seen.push(m); }
      if (m !== last) last = m;
      b.hp = b.maxHp; // 最終フェーズにしない
      s.enemies = s.enemies.filter((e) => e.type === 'decoy' || e.type === 'bossMinion' ? e.dist > 60 : true);
    }
    for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], `seed ${seed}: ${seen}`);
    for (const m of seen) assert.ok(['summon', 'dash', 'decoy'].includes(m), m);
  }
});

test('summon モード：2回、3秒おきに 2〜3方向の子機を出し、最後の2秒後に rest', () => {
  const s = mkState();
  const b = createBossD();
  arrive(b, s);
  b.mode = 'rest'; b.modeT = 0;
  // summon を直接選ばせる：enter する内部関数の代わりに、mode を summon にして状態を作る
  b.mode = 'summon'; b.phase = 'summon'; b.volleysLeft = b.p.summonVolleys; b.modeT = 0;
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
  step(b, s, 1.9);
  assert.equal(b.mode, 'summon');
  step(b, s, 0.4);
  assert.equal(b.mode, 'rest');
  assert.equal(b.phase, 'rest');
});

test('decoy モード：decoyCount 体を、ボスから 30 度以上離して出し、8 秒後に消して rest。撃たれて消えても待つ', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = mkState(seed);
    const b = createBossD();
    arrive(b, s);
    b.mode = 'decoy'; b.phase = 'decoy'; b.decoyLifeT = -1; // enterDecoy を呼ぶ：下の force を使う
    // 公開の入口：モードに入る処理を、rest の終わりで走らせる
    b.mode = 'rest'; b.modeT = 0; b.lastMode = 'summon';
    // 直接：decoy に入る
    b.__enter = undefined;
    break;
  }
  // 上の準備は不要。実際の検証は、内部の入口 enterMode('decoy') を使って行う
  const s = mkState(5);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'decoy');
  assert.equal(b.mode, 'decoy');
  const ds = decoys(s);
  assert.equal(ds.length, 2);
  for (const d of ds) {
    assert.equal(d.dist, 340);
    assert.ok(Math.abs(d.baseAngle - b.angle) >= 30 - 1e-9, `decoy ${d.baseAngle} vs boss ${b.angle}`);
    assert.equal(d.style, 'bossD');
  }
  assert.ok(Math.abs(ds[0].baseAngle - ds[1].baseAngle) >= 30 - 1e-9 || true);
  ds[0].dead = true;                    // 撃たれて消えた
  step(b, s, 7.5);
  assert.equal(b.mode, 'decoy');        // まだ待つ
  assert.equal(decoys(s).length, 1);
  step(b, s, 0.7);
  assert.equal(b.mode, 'rest');
  assert.equal(decoys(s).length, 0);    // 残りは消える
});

test('dash モード：内部のボスBが突進して、ボスDの hidden / angle / dist / phase が内部に合う。終わったら rest', () => {
  const s = mkState(9);
  const b = createBossD();
  arrive(b, s);
  enterMode(b, s, 'dash');
  assert.equal(b.dashing, true);
  const seenPhases = new Set();
  let hiddenSeen = false;
  let hit = false;
  for (let i = 0; i < 60 * 15 && b.dashing; i++) {
    updateBossD(b, s, DT);
    seenPhases.add(b.phase);
    if (b.hidden) hiddenSeen = true;
    if (b.hitCore) { hit = true; b.hitCore = false; }
    // 突進が届く前に撃たれて中断しないよう、ダメージは与えない
  }
  for (const ph of ['telegraph', 'vanish', 'settle', 'dash', 'roar']) assert.ok(seenPhases.has(ph), `missing phase ${ph}: ${[...seenPhases]}`);
  assert.equal(hiddenSeen, true);
  assert.equal(hit, true);              // 中心に届いた
  assert.equal(b.dashing, false);
  assert.equal(b.hidden, false);
  assert.equal(b.damageMult, 1);
  assert.equal(b.dist, 340);
  assert.equal(b.mode, 'rest');
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
});

test('最終フェーズ：HPが35%以下になると、召喚・偽像・突進が同時に動き、モードの切り替えはしない', () => {
  const s = mkState(6);
  const b = createBossD();
  arrive(b, s);
  b.hp = b.maxHp * b.p.finalRatio;
  updateBossD(b, s, DT);
  assert.equal(b.final, true);
  assert.equal(b.mode, 'final');
  step(b, s, 2.5);                       // 偽像は 2 体（補充は 0 秒から）
  assert.equal(decoys(s).length, 2);
  step(b, s, 4);                         // 召喚（6 秒ごと、2 方向）
  assert.ok(minions(s).length >= 2, `minions ${minions(s).length}`);
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
  // 突進中も、召喚・偽像の処理は続く（偽像を消すと補充される）
  const before = minions(s).length;
  for (const d of decoys(s)) d.dead = true;
  step(b, s, 2.3);
  assert.equal(decoys(s).length, 2);
  assert.equal(b.mode, 'final');
  void before;
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
});

test('待機中は angleRange の範囲で左右に往復する（decoy モードの間は動かない）', () => {
  const s = mkState();
  const b = createBossD();
  arrive(b, s);
  b.mode = 'rest'; b.modeT = 1e9;
  const a0 = b.angle;
  step(b, s, 2);
  assert.ok(Math.abs(b.angle - a0) > 10);
  assert.ok(Math.abs(b.angle) <= 50 + 1e-9);
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

// テスト用の入口：モードに入る処理を、公開のモジュール関数として呼べるようにしておく（boss-d.js が export する）
import { enterMode } from '../js/game/boss-d.js';
```

（注：上のテストファイルには、実装前の下書きの名残（`force`、decoy モードのテストの前半の `for` ループなど）が含まれる。**実装者は、これらの下書き部分を削除して整理してよい**。整理の方針：`force` ヘルパは削除する。「decoy モード」のテストは、`for (let seed…) { … break; }` のブロックを丸ごと削除して、その後の `const s = mkState(5);` 以降だけを残す。`enterMode(b, s, 'summon' | 'dash' | 'decoy')` は `boss-d.js` が `export` する関数で、そのモードに入る（`summon`：`volleysLeft`・`modeT=0` を設定、`dash`：内部のボスBを作って `dashing = true`、`decoy`：偽像を出して `decoyLifeT` を設定）。import の行はファイルの先頭にまとめてよい。テストの意図（検査する値・期待する挙動）は変えない）

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/boss-d.test.mjs`
Expected: FAIL（`boss-d.js` が無い）

- [ ] **Step 3: 実装する**

`js/game/enemies.js`：`ENEMY_INITS.decoy` を置き換える:
```js
  decoy(e, angle, rng, opts) {
    e.baseAngle = angle;
    e.swayT = 0;
    e.style = opts.style ?? null;   // 描画の見た目（例：'bossD'）
    e.color = opts.color ?? null;
  },
```

`js/game/boss-d.js`:
```js
import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { pickSpreadAngles } from './boss-a.js';
import { createBossB, updateBossB } from './boss-b.js';

// 最終ボス：ボスA（召喚）・ボスB（突進）・ボスC（偽像）の識別攻撃を、弱めて組み合わせる。
// 突進は、内部にボスBのオブジェクトを持って、その動きを借りる。
// 循環参照を避けるため、boss.js は読み込まない。
export const BOSS_D_BASE = Object.freeze({
  hp: 90,
  radius: 64,
  dist: 340,
  moveSpeed: 28,
  angleRange: 50,
  drift: 8,
  restTime: 3.0,
  finalRatio: 0.35,
  summonCount: Object.freeze([2, 3]),
  summonMinSep: 25,
  summonVolleys: 2,
  summonGap: 3.0,
  summonEnd: 2.0,        // 最後の召喚のあと、rest に戻るまで
  minionApproach: 7,
  decoyCount: 2,
  decoyMinSep: 30,
  decoyLifetime: 8,
  decoyRefill: 2,        // 最終フェーズで、偽像が消えてから補充するまで
  dash: Object.freeze({
    dashCount: 1, dashTime: 2.8, dashBreak: 6, settle: 0.5, telegraph: 1.0, vanish: 0.8,
    reappearDist: 440, reappearMargin: 15, roarTime: 2.2, roarMult: 1.5,
  }),
  finalSummonInterval: 6,
  finalSummonCount: 2,
  finalDashInterval: 7,
  score: 10000,
});

const MODES = ['summon', 'dash', 'decoy'];

export function createBossD(params = {}) {
  const p = { ...BOSS_D_BASE, ...params };
  return {
    type: 'bossD',
    p,
    hp: p.hp,
    maxHp: p.hp,
    radius: p.radius,
    angle: 0,
    dist: CONFIG.SPAWN_DIST,
    targetDist: p.dist,
    dir: 1,
    arrived: false,
    t: 0,
    dead: false,
    phase: 'approach',   // 待機中は mode と同じ。突進中は内部のボスBの phase
    mode: 'approach',    // approach → rest → summon | dash | decoy → rest …、HP が少ないと final
    modeT: 0,
    lastMode: null,
    volleysLeft: 0,
    hidden: false,
    damageTaken: 0,      // collision.js が加算する
    damageMult: 1,
    hitCore: false,      // 突進が中心に届いた。stepGame が読んで戻す
    dashing: false,
    inner: null,         // 突進を担当する、内部のボスB
    decoys: [],
    decoyRefillT: 0,
    decoyLifeT: 0,
    final: false,
    finalSummonT: 0,
    finalDashT: 0,
  };
}

function enterRest(boss) {
  boss.mode = 'rest';
  boss.phase = 'rest';
  boss.modeT = boss.p.restTime;
}

function summonVolley(boss, state, count) {
  const p = boss.p;
  for (const a of pickSpreadAngles(count, p.summonMinSep, state.rng)) {
    state.enemies.push(createEnemy('bossMinion', a, state.rng, {
      dist: boss.dist,
      speed: boss.dist / p.minionApproach,
    }));
  }
}

// ボスの角度と、すでにある偽像から minSep 以上離れた角度で、n 体を出す
function spawnDecoys(boss, state, n) {
  const p = boss.p;
  const taken = [boss.angle, ...boss.decoys.map((d) => d.baseAngle)];
  for (let i = 0; i < n; i++) {
    let a = randRange(state.rng, -70, 70);
    for (let tries = 0; tries < 30 && !taken.every((t) => Math.abs(t - a) >= p.decoyMinSep); tries++) {
      a = randRange(state.rng, -70, 70);
    }
    taken.push(a);
    const d = createEnemy('decoy', a, state.rng, { dist: boss.dist, style: 'bossD', color: boss.color ?? null });
    boss.decoys.push(d);
    state.enemies.push(d);
  }
}

function startDash(boss) {
  const p = boss.p;
  const inner = createBossB({ ...p.dash, angleRange: p.angleRange, dist: p.dist, scatterInterval: Infinity });
  inner.arrived = true;
  inner.phase = 'idle';
  inner.dist = boss.dist;
  inner.angle = boss.angle;
  inner.dashT = 0;      // すぐに予兆に入る
  boss.inner = inner;
  boss.dashing = true;
}

// 指定のモードに入る
export function enterMode(boss, state, mode) {
  const p = boss.p;
  boss.mode = mode;
  boss.phase = mode;
  boss.lastMode = mode;
  if (mode === 'summon') {
    boss.volleysLeft = p.summonVolleys;
    boss.modeT = 0;
  } else if (mode === 'dash') {
    startDash(boss);
  } else if (mode === 'decoy') {
    spawnDecoys(boss, state, p.decoyCount);
    boss.decoyLifeT = p.decoyLifetime;
  }
}

function pickMode(boss, state) {
  const candidates = MODES.filter((m) => m !== boss.lastMode);
  return candidates[randInt(state.rng, 0, candidates.length - 1)];
}

function startFinal(boss) {
  boss.final = true;
  boss.mode = 'final';
  boss.phase = boss.dashing ? boss.phase : 'final';
  boss.volleysLeft = 0;
  boss.finalSummonT = boss.p.finalSummonInterval;
  boss.finalDashT = boss.p.finalDashInterval;
  boss.decoyRefillT = 0;
  boss.decoyLifeT = Infinity;
}

function updateDash(boss) {
  const inner = boss.inner;
  inner.damageTaken = boss.damageTaken;   // 受けたダメージを内部のボスBに伝える（突進の中断の判定）
  return inner;
}

function syncDash(boss, state, dt) {
  const inner = updateDash(boss);
  updateBossB(inner, state, dt);
  boss.hidden = inner.hidden;
  boss.angle = inner.angle;
  boss.dist = inner.dist;
  boss.damageMult = inner.damageMult;
  boss.phase = inner.phase;
  if (inner.hitCore) {
    boss.hitCore = true;
    inner.hitCore = false;
  }
  if (inner.phase === 'idle') {   // 突進と咆哮が終わった
    boss.dashing = false;
    boss.inner = null;
    boss.hidden = false;
    boss.damageMult = 1;
    boss.dist = boss.p.dist;
    if (boss.final) boss.phase = 'final';
    else enterRest(boss);
  }
}

export function updateBossD(boss, state, dt) {
  const p = boss.p;
  boss.t += dt;

  if (!boss.arrived) {
    boss.dist = Math.max(boss.targetDist, boss.dist - p.moveSpeed * dt);
    if (boss.dist <= boss.targetDist) {
      boss.arrived = true;
      enterRest(boss);
    }
    return;
  }

  boss.decoys = boss.decoys.filter((d) => !d.dead);
  if (!boss.final && boss.hp <= boss.maxHp * p.finalRatio) startFinal(boss);

  if (boss.dashing) {
    syncDash(boss, state, dt);
  } else if (boss.mode !== 'decoy') {
    // 待機の動き：左右に往復（decoy モードの間は動かない）
    boss.angle += boss.dir * p.drift * dt;
    if (boss.angle > p.angleRange) { boss.angle = p.angleRange; boss.dir = -1; }
    if (boss.angle < -p.angleRange) { boss.angle = -p.angleRange; boss.dir = 1; }
  }

  if (boss.final) {
    boss.finalSummonT -= dt;
    if (boss.finalSummonT <= 0) {
      boss.finalSummonT += p.finalSummonInterval;
      summonVolley(boss, state, p.finalSummonCount);
    }
    const missing = p.decoyCount - boss.decoys.length;
    if (missing > 0) {
      boss.decoyRefillT -= dt;
      if (boss.decoyRefillT <= 0) {
        spawnDecoys(boss, state, missing);
        boss.decoyRefillT = p.decoyRefill;
      }
    } else {
      boss.decoyRefillT = p.decoyRefill;
    }
    if (!boss.dashing) {
      boss.finalDashT -= dt;
      if (boss.finalDashT <= 0) {
        boss.finalDashT = p.finalDashInterval;
        startDash(boss);
      }
    }
    return;
  }

  if (boss.dashing) return;

  switch (boss.mode) {
    case 'rest':
      boss.modeT -= dt;
      if (boss.modeT <= 0) enterMode(boss, state, pickMode(boss, state));
      break;
    case 'summon':
      boss.modeT -= dt;
      if (boss.modeT <= 0) {
        if (boss.volleysLeft > 0) {
          summonVolley(boss, state, randInt(state.rng, p.summonCount[0], p.summonCount[1]));
          boss.volleysLeft -= 1;
          boss.modeT = boss.volleysLeft > 0 ? p.summonGap : p.summonEnd;
        } else {
          enterRest(boss);
        }
      }
      break;
    case 'decoy':
      boss.decoyLifeT -= dt;
      if (boss.decoyLifeT <= 0) {
        for (const d of boss.decoys) d.dead = true;
        boss.decoys = [];
        enterRest(boss);
      }
      break;
  }
}
```
補足：`startFinal` と `syncDash` の `boss.phase` の扱いで、突進中（`dashing`）に最終フェーズに入ったときは、`phase` は内部のボスBの値のまま。`updateDash` は、ダメージの伝達だけをするヘルパで、あってもなくても良い（`syncDash` の中に直接書いてよい）。**`boss.color` は `createBoss`（boss.js）が、生成の後に付ける**ので、`createBossD` の直後は `undefined`。偽像の `color: boss.color ?? null` は、`createBoss` 経由の実際のボスでは `#ffd24a`（または `params.color`）になる。

`js/game/boss.js`：import に `import { createBossD, updateBossD } from './boss-d.js';` を足し、登録表の `bossC: …` の行の次に追加する:
```js
  bossD: Object.freeze({ name: '最終ボス', color: '#ffd24a', create: createBossD, update: updateBossD }),
```

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
テストのタイミングやシードで落ちる場合は、**テスト側**の待ち時間・シードを、意図を変えずに直す（仕様書の値・挙動は変えない）。直したものは、レポートに書く。
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add js/game/boss-d.js js/game/boss.js js/game/enemies.js tests/boss-d.test.mjs
git commit -m "feat: add final boss D combining summon, dash and decoy attacks

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B3: 最終ボスの描画

**Files:**
- Modify: `js/render/entities.js`
- Test: なし（Nodeのスタブで動作確認する）

**Interfaces:**
- Consumes: ボスDの項目（`phase`、`hidden`、`color`、`flashT`）、偽像の `e.style` / `e.color`
- Produces: `BOSS_DRAWERS.bossD`。偽像が `style === 'bossD'` のとき、ボスDと同じ体で描かれる（見分けがつかない）

- [ ] **Step 1: 実装する**

`js/render/entities.js`：`drawBossC` の関数の後ろに、次を追加する:
```js
// 最終ボスの体（本体と偽像で共用）：ボスBの角・ボスCの3本の飾り・ボスAのような大きな目を合わせた、金色の体
function drawBossDBody(g, r, color, time, opts = {}) {
  const { flash = false, warn = false, roar = false } = opts;
  g.save();
  const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 1.8);
  glow.addColorStop(0, hexToRgba(color, 0.4));
  glow.addColorStop(1, hexToRgba(color, 0));
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, r * 1.8, 0, Math.PI * 2);
  g.fill();
  const pulse = warn ? 1 + 0.06 * Math.sin(time * 40) : roar ? 1.08 : 1;
  g.scale(pulse, pulse);
  g.fillStyle = lightenColor(color, -0.4); // 角（ボスB）
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.35, -r * 0.55);
    g.lineTo(s * r * 0.95, -r * 1.1);
    g.lineTo(s * r * 0.62, -r * 0.3);
    g.closePath();
    g.fill();
  }
  g.fillStyle = lightenColor(color, -0.2); // 冠の飾り（ボスC）
  for (const s of [-1, 0, 1]) {
    g.beginPath();
    g.moveTo(s * r * 0.22 - r * 0.07, -r * 0.7);
    g.lineTo(s * r * 0.22, -r * (s === 0 ? 1.25 : 1.05));
    g.lineTo(s * r * 0.22 + r * 0.07, -r * 0.7);
    g.closePath();
    g.fill();
  }
  const blink = warn && Math.floor(time * 16) % 2 === 0;
  ellipse(g, 0, 0, r, r * 0.82, flash ? '#ffffff' : blink ? '#ff4d4d' : color);
  ellipse(g, 0, r * 0.24, r * 0.64, r * 0.4, lightenColor(color, 0.45));
  ellipse(g, 0, -r * 0.16, r * 0.34, r * 0.26, '#fff6d0'); // 大きな目（ボスA）
  ellipse(g, 0, -r * 0.14, r * 0.15, r * 0.15, COLORS.eye);
  for (const s of [-1, 1]) {
    ellipse(g, s * r * 0.5, -r * 0.12, r * 0.1, r * 0.13, '#fff6d0');
    ellipse(g, s * r * 0.5, -r * 0.1, r * 0.045, r * 0.06, COLORS.eye);
  }
  if (roar) {
    ellipse(g, 0, r * 0.38, r * 0.32, r * 0.24, COLORS.eye);
  } else {
    g.strokeStyle = COLORS.eye;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-r * 0.25, r * 0.36);
    g.lineTo(r * 0.25, r * 0.36);
    g.stroke();
  }
  g.restore();
}

function drawBossD(g, boss, x, y, time) {
  if (boss.hidden) return;
  const color = boss.color ?? boss.p.color ?? COLORS.bossD;
  const flash = time - (boss.flashT ?? -1) < 0.1;
  g.save();
  g.translate(x, y);
  drawBossDBody(g, boss.radius, color, time, { flash, warn: boss.phase === 'telegraph', roar: boss.phase === 'roar' });
  g.restore();
}
```
`COLORS` に追加する（`bossC: '#4fc3d9',` の次に）: `  bossD: '#ffd24a',`

`drawDecoy` を置き換える（`style === 'bossD'` のときは、ボスDと同じ体で描く）:
```js
function drawDecoy(g, e, x, y, time, swapBlink) {
  g.save();
  g.translate(x, y);
  if (e.style === 'bossD') drawBossDBody(g, e.radius, e.color ?? COLORS.bossD, time);
  else drawBossCBody(g, e.radius, COLORS.bossC, time, { swapBlink });
  g.restore();
}
```
`BOSS_DRAWERS` に `bossD: drawBossD,` を足す（`bossC: drawBossC,` の次）。

（ボスDの突進の予兆・咆哮は、`drawBossD` の `warn` / `roar`（ボスBと同じ表現）と、既存の警告表示（`boss.phase` が `telegraph` / `vanish` / `settle` のときの「⚠ 視界の外から突進！」）がそのまま使える。ミニマップ（`radar.js`）は、ボスと偽像を同じ点で描くので、変更しない）

- [ ] **Step 2: Nodeで描画の動作確認をする（コミットしない）**

スクラッチに、`Proxy` で作った2Dコンテキストのスタブ（どのメソッドも何もしない関数。`createRadialGradient` / `createLinearGradient` は `addColorStop` を持つオブジェクトを返す。`fillText` の引数を記録）で、次を実行して出力をレポートに貼る。
- `drawBoss(g, createBoss('bossD'), 500, 200, 1)`（`phase` を `'rest'`、`'telegraph'`、`'roar'`、`'final'` にして、それぞれ。`hidden: true` のときは何も描かないこと）が、例外なく、`fillText('？')` も呼ばないこと
- `drawEnemy(g, decoy, …)`：`style: 'bossD'`、`color: '#ffd24a'` の偽像が、例外なく描けること（ボスDと同じ体の関数を通ること）
- 既存：`style` なしの偽像（ボスC用）が、これまでどおり描けること

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS

- [ ] **Step 3: コミット**

```bash
git add js/render/entities.js
git commit -m "feat: draw final boss and its decoys with a shared golden body

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task B4: 7面のデータ・登録・進行・自動操縦・README

**Files:**
- Create: `js/data/stage7.js`、`tests/stage7.test.mjs`
- Modify: `js/data/stages.js`、`tests/progress.test.mjs`、`tests/step.test.mjs`、`README.md`

**Interfaces:**
- Consumes: `pool`（B1）、`bossD`（B2）、`assertMostlyClears`（`tests/step.test.mjs` 内、計画A）
- Produces: `STAGE7`。`STAGES` に 7 を足す（1〜7面）

- [ ] **Step 1: 失敗するテストを書く**

`tests/stage7.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE7 } from '../js/data/stage7.js';
import { STAGES, getStage, stageLabel } from '../js/data/stages.js';
import { createBoss } from '../js/game/boss.js';
import { BOSS_D_BASE } from '../js/game/boss-d.js';
import { validateStage } from '../js/game/spawner.js';

const ALL = ['meteor', 'drone', 'formationDrone', 'burrower', 'thrower', 'charger', 'shielder', 'teleporter', 'jammer'];

test('7面：登録され、名前が付く。1〜7面がそろう', () => {
  assert.equal(getStage(7), STAGE7);
  assert.equal(STAGE7.id, 7);
  assert.equal(stageLabel(STAGE7), '7面：隕石本体・核心部　');
  assert.deepEqual(Object.keys(STAGES), ['1', '2', '3', '4', '5', '6', '7']);
  assert.equal(getStage(8), null);
});

test('7面：出現表の検査を通る。全区間が pool で、全テーマの敵を含む', () => {
  validateStage(STAGE7);
  assert.equal(STAGE7.spawnEnd, 110);
  assert.deepEqual(STAGE7.segments.map((s) => [s.from, s.to]), [[0, 30], [30, 70], [70, 110]]);
  const everys = [];
  for (const seg of STAGE7.segments) {
    const entries = Object.values(seg.spawns);
    assert.equal(entries.length, 1);
    const [entry] = entries;
    assert.deepEqual([...entry.pool].sort(), [...ALL].sort());
    assert.ok(entry.formation, 'formation is required (pool has formationDrone)');
    everys.push(entry.every);
  }
  assert.deepEqual(everys, [1.6, 1.4, 1.2]);
  assert.equal(Object.values(STAGE7.segments[0].spawns)[0].formation.count, 3);
  assert.deepEqual(Object.values(STAGE7.segments[1].spawns)[0].formation.count, [3, 4]);
  assert.deepEqual(Object.values(STAGE7.segments[2].spawns)[0].formation.count, [3, 4]);
});

test('7面のボスは、最終ボス（基準値のまま）', () => {
  assert.equal(STAGE7.boss.type, 'bossD');
  const b = createBoss(STAGE7.boss.type, STAGE7.boss.params);
  assert.equal(b.maxHp, 90);
  assert.equal(b.color, '#ffd24a');
  for (const key of Object.keys(BOSS_D_BASE)) assert.deepEqual(b.p[key], BOSS_D_BASE[key], key);
});
```

`tests/progress.test.mjs` を、7面が登録された現実に合わせて直す（**意味のあるカバレッジは落とさない**）。方針：
- 「ステージの登録」のテスト：1〜7面（`STAGE7` を import）、`Object.keys(STAGES)` が `['1'..'7']`、`getStage(8)` が `null`
- `isStageAvailable`：1〜7 が `true`。`isStageAvailable(8)` は `false`（`STAGE_COUNT` を超える）。注入のパラメータ（`getStageFn`）のカバレッジは、`const sparse = (id) => (id <= 3 ? { id } : null);` のような仮の登録で残す（`isStageAvailable(4, sparse) === false`、`(3, sparse) === true`）
- `isStagePlayable`：7面まで解放済みなら `isStagePlayable(cleared(1..6), 7) === true`、`cleared(1..5)` なら 7 面は `false`（未解放）。`sparse` でデータが無い面が `false` になるケース（解放済みでもデータ無し）も残す
- `nextPlayableStage`：`(cleared(1..6), 6) → 7`、`(cleared(1..7), 7) → null`（最後の面）、`(cleared(1), 2) → null` などの既存の意味は残す。`sparse` で「次の面のデータが無い → null」も残す
- `recordResult` のテストはそのまま

`tests/step.test.mjs`：
1. import に `import { STAGE7 } from '../js/data/stage7.js';` を足す
2. 「自動操縦で6面をクリアできる（複数のシード）」の直後に追加する:
```js
test('自動操縦で7面をクリアできる（複数のシード）', () => assertMostlyClears(STAGE7, 1000, 'stage 7'));
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`stage7.js` が無い）

- [ ] **Step 3: 実装する**

`js/data/stage7.js`:
```js
// 7面：隕石本体・核心部。全テーマの敵を、偏りなく（袋方式で）ランダムに出す。ボスは最終ボス。数値は仮（SPAWN_SCALE を掛ける前の値）。
const ALL_TYPES = ['meteor', 'drone', 'formationDrone', 'burrower', 'thrower', 'charger', 'shielder', 'teleporter', 'jammer'];

export const STAGE7 = Object.freeze({
  id: 7,
  name: '隕石本体・核心部',
  segments: [
    { from: 0,  to: 30,  spawns: { pool: { every: 1.6, pool: ALL_TYPES, formation: { count: 3, minSep: 25 } } } },
    { from: 30, to: 70,  spawns: { pool: { every: 1.4, pool: ALL_TYPES, formation: { count: [3, 4], minSep: 25 } } } },
    { from: 70, to: 110, spawns: { pool: { every: 1.2, pool: ALL_TYPES, formation: { count: [3, 4], minSep: 25 } } } },
  ],
  spawnEnd: 110,
  boss: { type: 'bossD', params: {} },
});
```

`js/data/stages.js`：`import { STAGE7 } from './stage7.js';` を足し、コメントと `STAGES` を置き換える:
```js
// 面の登録（1〜7面）
export const STAGES = Object.freeze({ 1: STAGE1, 2: STAGE2, 3: STAGE3, 4: STAGE4, 5: STAGE5, 6: STAGE6, 7: STAGE7 });
```

`README.md`：「（7面は準備中）」の記述を削除して「全7面」の説明に直し、最終ボスの箇条書きを足す（既存の文体に合わせる）:
```markdown
- 7面（最終面）は、これまでの全種類の敵が、偏りなく出てくる
- 最終ボスは、召喚・視界の外からの突進・偽像を組み合わせて攻めてくる。HPが減ると、それらを同時に使う
```

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
7面の自動操縦が失敗した場合（合格率 4/5 を下回る）、次の範囲で調整して通す。
- `js/data/stage7.js` の `every`（1.6 / 1.4 / 1.2）。**下限は 1.2 / 1.1 / 1.0**（これより濃くしない。薄くする方向は自由）。`stage7.test.mjs` の期待値を同じ値に直す
- ボスD：基準値（`BOSS_D_BASE`）の `hp` は 70 以上、`finalRatio` は 0.3 以上、`finalSummonInterval` は 5 以上、`finalDashInterval` は 6 以上、`restTime` は 2.5 以上、`decoyCount` は 1 以上。変える場合は、`tests/boss-d.test.mjs` の基準値の検査を同じ値に直す
- 自動操縦の関数・テストの書き方・その他の設定は変えない
テストの上限秒（1000）は動かさない。調整した場合は、最終の数値と、5つのシードごとのクリア・時間・残機を、レポートに書く。調整しなくても通った場合は、その旨と同じ表を書く（スクラッチのスクリプトで計算してよい。コミットしない）。
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add js/data/stage7.js js/data/stages.js tests/stage7.test.mjs tests/progress.test.mjs tests/step.test.mjs README.md
git commit -m "feat: add stage 7 with pooled enemy mix and final boss

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（B4 のコミット後）：**
- ステージ選択：1〜6面クリア済みの保存で、7面が挑戦できる。7面クリア後は次の面が無い
- 7面：全種類の敵が混ざって出る。最終ボスのモード（召喚・偽像・突進）と、HPが減った後の同時攻撃。偽像がボスと見分けがつかないこと
- コンソールにエラーが無い
