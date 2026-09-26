# 2面・編隊ドローン・まとめ出し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2面（編隊ドローン群＋ボスAの強化型）を遊べるようにし、複数の敵をまとめて出す出現表の書き方を追加する。

**Architecture:** 編隊の生成は純粋関数（`js/game/formation.js`）。出現表（`spawns`）は、数値（1体ずつ）またはオブジェクト（`every` 秒ごとに `count` 機をまとめて）を受け付け、`spawner.js` が解釈する。2面は `js/data/stage2.js` のデータで、`STAGES` に登録するだけで、②の解放・選択画面・結果画面の仕組みにそのまま乗る。

**Tech Stack:** 素のJavaScript（ES2022、ES Modules）、Canvas 2D、Node 24（`node --test`、`node --check`）。外部依存なし。

**Spec:** `docs/superpowers/specs/2026-09-26-stage2-formation-design.md`（①②の設計書の続き）

## Global Constraints

- ビルドツール・npm依存を追加しない。GitHub Pagesに静的ファイルとしてそのまま置ける構成を保つ
- `js/game/` と `js/core/` は、モジュール読み込み時点で DOM・canvas・`window` に触れない（Nodeのテストから import できること）。`js/render/` も同様に、読み込み時点で触れない
- 編隊の角度は -90〜+90度で、互いに `minSep` 度以上離す。編隊の接近時間は基準10秒（`CONFIG.APPROACH_TIME`）±15%（編隊で共通）＋機ごとに±3%
- `formationDrone`：HP1、半径16、スコア50、撃破数に数える、動きは `straight`
- 2面のボスAの強化型：HP60、分散召喚 5方向、召喚間隔 4.5秒、色 `#ff8f6b`。それ以外の設定は `BOSS_A_BASE` のまま。`BOSS_A_BASE` は書き換えない（凍結されたまま）
- 2面の出現数値は仮。自動操縦テストを通すために調整してよいのは `js/data/stage2.js` の出現表（`segments` の `spawns`・区間の境界・`spawnEnd`）だけ。ボスの設定・テスト・自動操縦の書き方は変えない
- UIの文言は日本語。キャラクター・敵は図形で描く。AI生成の画像・動画は使わない
- コミットメッセージの末尾に、次の1行を付ける（一字一句そのまま）：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。コミットの作成者はリポジトリのローカル設定（neku8）のまま変えない
- 各タスクの最後に `node tools/check.mjs` と `npm test` が通ること（出力にwarningが出ないこと）。ベースラインは102件

## ファイル構成

| ファイル | 役割 | タスク |
| --- | --- | --- |
| `js/core/util.js`, `js/game/enemies.js`, `js/game/formation.js` | `randInt`、`formationDrone` の定義、編隊の生成 | 1 |
| `js/game/spawner.js` | まとめ書き方の解釈 | 2 |
| `js/render/entities.js`, `js/scenes/play.js`（撃破エフェクトの色のみ）, `js/game/boss.js`（変更なし・テストのみ） | 編隊ドローンの見た目、ボスの色 | 3 |
| `js/data/stage2.js`, `js/data/stage1.js`, `js/data/stages.js`, `tests/progress.test.mjs`, `tests/stage2.test.mjs`, `tests/step.test.mjs` | 2面のデータ・登録・自動操縦テスト | 4 |
| `js/scenes/play.js`（ヒント）, `README.md` | 面の名前の表示、README | 5 |

---

### Task 1: `randInt`・`formationDrone`・編隊の生成

**Files:**
- Modify: `js/core/util.js`（`randInt` を追加）、`js/game/enemies.js`（`ENEMY_DEFS` に1行）
- Create: `js/game/formation.js`
- Test: `tests/util.test.mjs`（追記）、`tests/formation.test.mjs`

**Interfaces:**
- Consumes: `CONFIG`（`SPAWN_DIST`, `APPROACH_TIME`, `APPROACH_JITTER`）、`randRange`、`createEnemy(type, angle, rng, opts)`、`pickSpreadAngles(count, minSep, rng)`（`js/game/boss.js`）
- Produces:
  - `randInt(rng, lo, hi): number`（`lo`〜`hi` の整数、両端を含む）
  - `ENEMY_DEFS.formationDrone`
  - `createFormation(type, count, minSep, rng): Enemy[]`

- [ ] **Step 1: 失敗するテストを書く**

`tests/util.test.mjs` の import 行を次に変える:
```js
import { clamp, lerp, randRange, randInt, mulberry32, lightenColor } from '../js/core/util.js';
```
末尾に追記する:
```js

test('randInt は両端を含む整数を返し、同じシードで同じ列になる', () => {
  const a = mulberry32(7), b = mulberry32(7);
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = randInt(a, 3, 5);
    assert.equal(v, randInt(b, 3, 5));
    assert.ok(Number.isInteger(v) && v >= 3 && v <= 5);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [3, 4, 5]);
  assert.equal(randInt(mulberry32(1), 4, 4), 4);
});
```

`tests/formation.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFormation } from '../js/game/formation.js';
import { ENEMY_DEFS } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';

test('formationDrone の定義：HP1・半径16・50点・撃破数に数える・直進', () => {
  assert.deepEqual(ENEMY_DEFS.formationDrone, {
    hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight',
  });
});

test('編隊：機数どおり、種類・距離・HPが正しい', () => {
  for (const n of [1, 3, 4, 5]) {
    const f = createFormation('formationDrone', n, 25, mulberry32(n));
    assert.equal(f.length, n);
    for (const e of f) {
      assert.equal(e.type, 'formationDrone');
      assert.equal(e.dist, 460);
      assert.equal(e.hp, 1);
    }
  }
});

test('編隊：角度は-90〜+90度で、互いに minSep 以上離れる', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const n of [3, 4, 5]) {
      const angles = createFormation('formationDrone', n, 25, mulberry32(seed)).map((e) => e.angle).sort((a, b) => a - b);
      for (let i = 0; i < angles.length; i++) {
        assert.ok(angles[i] >= -90 && angles[i] <= 90, `angle ${angles[i]}`);
        if (i > 0) assert.ok(angles[i] - angles[i - 1] >= 25 - 1e-9, `gap ${angles[i] - angles[i - 1]} (n=${n}, seed=${seed})`);
      }
    }
  }
});

test('編隊：ほぼ同時に中心へ届く（到達時間の差が1.5秒未満、8.5〜11.5秒の範囲）', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const times = createFormation('formationDrone', 5, 25, mulberry32(seed)).map((e) => e.dist / e.speed);
    assert.ok(Math.max(...times) - Math.min(...times) < 1.5, `spread ${Math.max(...times) - Math.min(...times)}`);
    for (const t of times) assert.ok(t >= 8.5 - 0.35 && t <= 11.5 + 0.35, `t=${t}`);
  }
});

test('編隊：同じシードなら同じ結果', () => {
  const a = createFormation('formationDrone', 4, 25, mulberry32(42)).map((e) => [e.angle, e.speed]);
  const b = createFormation('formationDrone', 4, 25, mulberry32(42)).map((e) => [e.angle, e.speed]);
  assert.deepEqual(a, b);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`randInt` が無い、`formation.js` が無い）

- [ ] **Step 3: 実装する**

`js/core/util.js`：`randRange` の直後に追加する:
```js

// lo〜hi の整数を等確率で返す（両端を含む）
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}
```

`js/game/enemies.js`：`ENEMY_DEFS` の `bossMinion` の行の次に追加する:
```js
  formationDrone: { hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight' },
```

`js/game/formation.js`:
```js
import { CONFIG } from '../core/config.js';
import { randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { pickSpreadAngles } from './boss.js';

const MEMBER_JITTER = 0.03; // 機ごとの接近時間のばらつき（編隊の基準ジッタに足す）

// 別々の角度から、ほぼ同時に中心へ届く編隊を作る。
// 角度は minSep 度以上離す。接近時間は編隊で共通のジッタ（±15%）を決め、機ごとに ±3% だけずらす。
export function createFormation(type, count, minSep, rng) {
  const angles = pickSpreadAngles(count, minSep, rng);
  const jitter = randRange(rng, -CONFIG.APPROACH_JITTER, CONFIG.APPROACH_JITTER);
  return angles.map((angle) => {
    const k = 1 + jitter + randRange(rng, -MEMBER_JITTER, MEMBER_JITTER);
    return createEnemy(type, angle, rng, { speed: CONFIG.SPAWN_DIST / (CONFIG.APPROACH_TIME * k) });
  });
}
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: add formation drones and formation generation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: 出現表の「まとめて出す」書き方

**Files:**
- Modify: `js/game/spawner.js`（全面置き換え）
- Test: `tests/spawner.test.mjs`（追記）

**Interfaces:**
- Consumes: Task 1 の `randInt`、`createFormation(type, count, minSep, rng)`
- Produces: `spawns` の値が、数値（従来どおり）または `{ every, count, minSep }`（`count` は正の整数、または `[最小, 最大]`）。不正な値は、その項目を処理するときに `Error` を投げる。`createSpawner` / `updateSpawner` のシグネチャは変えない

- [ ] **Step 1: 失敗するテストを書く**

`tests/spawner.test.mjs` の末尾に追記する（既存の import・`simulate` は変えない）:
```js

// ---- まとめて出す書き方 ----
const groupStage = (spawns) => ({
  id: 9,
  segments: [{ from: 0, to: 1000, spawns }],
  spawnEnd: 1000,
  boss: { type: 'bossA', params: {} },
});

// 敵を動かさず、出現だけを時刻ごとにまとめて返す
function simulateStage(stage, seconds, dt = 0.1) {
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(stage);
  const groups = []; // { time, types: string[], angles: number[] }
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const before = state.enemies.length;
    updateSpawner(sp, state, dt);
    const fresh = state.enemies.slice(before);
    if (fresh.length) groups.push({ time: sp.time, types: fresh.map((e) => e.type), angles: fresh.map((e) => e.angle) });
  }
  return { state, groups };
}

test('まとめ書き方：every 秒ごとに count 機が同時に出る', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 10, count: 3, minSep: 25 } }), 35);
  assert.equal(groups.length, 3);
  for (const g of groups) {
    assert.equal(g.types.length, 3);
    assert.ok(g.types.every((t) => t === 'formationDrone'));
  }
  const times = groups.map((g) => g.time);
  assert.ok(Math.abs(times[0] - 10) < 0.15 && Math.abs(times[1] - 20) < 0.15 && Math.abs(times[2] - 30) < 0.15, `times=${times}`);
});

test('まとめ書き方：出る角度は互いに minSep 以上離れ、-90〜+90度', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 5, count: [3, 5], minSep: 25 } }), 120);
  assert.ok(groups.length >= 20);
  for (const g of groups) {
    const a = [...g.angles].sort((x, y) => x - y);
    for (let i = 0; i < a.length; i++) {
      assert.ok(a[i] >= -90 && a[i] <= 90);
      if (i > 0) assert.ok(a[i] - a[i - 1] >= 25 - 1e-9);
    }
  }
});

test('まとめ書き方：count が配列なら [最小, 最大] の範囲で、複数の機数が出る', () => {
  const { groups } = simulateStage(groupStage({ formationDrone: { every: 5, count: [3, 5], minSep: 25 } }), 200);
  const sizes = new Set(groups.map((g) => g.types.length));
  for (const s of sizes) assert.ok(s >= 3 && s <= 5, `size ${s}`);
  assert.ok(sizes.size >= 2, `sizes=${[...sizes]}`);
});

test('数値の書き方と、まとめ書き方を同じ区間に混ぜられる', () => {
  const { groups } = simulateStage(
    groupStage({ meteor: 2.0, formationDrone: { every: 10, count: 3, minSep: 25 } }), 35);
  // 同じフレームに隕石と編隊が同時に出ることがあるので、種類ごとの総数で数える
  const all = groups.flatMap((g) => g.types);
  const meteors = all.filter((t) => t === 'meteor').length;
  const formationDrones = all.filter((t) => t === 'formationDrone').length;
  assert.ok(meteors >= 16 && meteors <= 18, `meteors=${meteors}`);
  assert.equal(formationDrones, 9); // 3機 × 3回
});

test('不正な出現表の項目は例外になる', () => {
  const bad = [
    { formationDrone: { every: 0, count: 3, minSep: 25 } },
    { formationDrone: { every: -1, count: 3, minSep: 25 } },
    { formationDrone: { every: 10, count: 0, minSep: 25 } },
    { formationDrone: { every: 10, count: 2.5, minSep: 25 } },
    { formationDrone: { every: 10, count: [4, 3], minSep: 25 } },
    { formationDrone: { every: 10, count: [3, 4] } },
    { formationDrone: { every: 10, count: 3, minSep: 'wide' } },
    { formationDrone: 'often' },
    { meteor: 0 },
    { meteor: -2 },
    { meteor: Infinity },
  ];
  for (const spawns of bad) {
    assert.throws(() => simulateStage(groupStage(spawns), 20), Error, JSON.stringify(spawns));
  }
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/spawner.test.mjs`
Expected: FAIL（オブジェクトの値が解釈されない）

- [ ] **Step 3: 実装する**

`js/game/spawner.js` を次の内容で**全面的に置き換える**:
```js
import { CONFIG } from '../core/config.js';
import { randInt, randRange } from '../core/util.js';
import { createEnemy } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';

export function createSpawner(stage) {
  return { stage, time: 0, timers: {}, bossSpawned: false };
}

// 出現表の1項目を読む。
//   数値                                   … その間隔（秒）で1体ずつ
//   { every, count, minSep }               … every 秒ごとに count 機をまとめて出す（count は正の整数、または [最小, 最大]）
// ステージのデータの誤りは、その項目を処理するときに例外で知らせる。
function readEntry(type, entry) {
  if (typeof entry === 'number') {
    if (!Number.isFinite(entry) || entry <= 0) throw new Error(`invalid spawn interval for ${type}: ${entry}`);
    return { every: entry, group: null };
  }
  if (entry && typeof entry === 'object') {
    const { every, count = 1, minSep } = entry;
    if (!Number.isFinite(every) || every <= 0) throw new Error(`invalid spawn "every" for ${type}: ${every}`);
    const [lo, hi] = Array.isArray(count) ? count : [count, count];
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo < 1 || hi < lo) {
      throw new Error(`invalid spawn "count" for ${type}: ${JSON.stringify(count)}`);
    }
    if (!Number.isFinite(minSep)) throw new Error(`invalid spawn "minSep" for ${type}: ${minSep}`);
    return { every, group: { lo, hi, minSep } };
  }
  throw new Error(`invalid spawn entry for ${type}: ${entry}`);
}

export function updateSpawner(sp, state, dt) {
  sp.time += dt;
  const { stage } = sp;

  if (sp.time < stage.spawnEnd) {
    const seg = stage.segments.find((s) => sp.time >= s.from && sp.time < s.to);
    if (!seg) return;
    for (const [type, raw] of Object.entries(seg.spawns)) {
      const { every, group } = readEntry(type, raw);
      sp.timers[type] = (sp.timers[type] ?? 0) + dt;
      while (sp.timers[type] >= every) {
        sp.timers[type] -= every;
        if (group) {
          const n = randInt(state.rng, group.lo, group.hi);
          state.enemies.push(...createFormation(type, n, group.minSep, state.rng));
        } else {
          const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
          state.enemies.push(createEnemy(type, angle, state.rng));
        }
      }
    }
    return;
  }

  if (!sp.bossSpawned && state.enemies.length === 0) {
    state.boss = createBoss(stage.boss.type, stage.boss.params);
    sp.bossSpawned = true;
  }
}
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS（既存の1面のspawnerテストも変わらず通る）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: support grouped formation spawns in the spawn table

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 編隊ドローンの見た目とボスの色

**Files:**
- Modify: `js/render/entities.js`（`COLORS.formation`、`drawEnemy`、`drawBoss`）、`js/scenes/play.js`（撃破エフェクトの色の1行のみ）
- Test: `tests/boss.test.mjs`（追記）

**Interfaces:**
- Consumes: `boss.p.color`（`createBoss('bossA', { color })` で渡せる。`BOSS_A_BASE` には `color` を入れない）
- Produces: `COLORS.formation = '#7fe0ff'`。`drawEnemy` が `formationDrone` を描く。`drawBoss` が `boss.p.color ?? COLORS.boss` を体の色に使う

- [ ] **Step 1: 失敗するテストを書く**

`tests/boss.test.mjs` の末尾に追記する:
```js

test('createBoss：params の color が p.color に入り、基準値には color が無い', () => {
  assert.equal('color' in BOSS_A_BASE, false);
  assert.equal(createBoss('bossA').p.color, undefined);
  assert.equal(createBoss('bossA', { color: '#ff8f6b' }).p.color, '#ff8f6b');
  assert.equal('color' in BOSS_A_BASE, false); // 基準値は書き換わらない
});
```

- [ ] **Step 2: テストが通ること（および、まだ描画側が未対応であること）を確認する**

Run: `node --test tests/boss.test.mjs`
Expected: PASS（`createBoss` は元々 `params` をそのまま `p` に展開するので、このテストは実装前から通る。回帰防止のためのテスト）

- [ ] **Step 3: 描画を実装する**

`js/render/entities.js`：

1. `COLORS` オブジェクトの `minion: '#ff9ecb',` の次の行に追加する:
```js
  formation: '#7fe0ff',
```

2. `drawEnemy` の `else if (e.type === 'bossMinion') drawDrone(g, e, x, y, COLORS.minion);` の次の行に追加する:
```js
  else if (e.type === 'formationDrone') drawDrone(g, e, x, y, COLORS.formation);
```

3. `drawBoss` の中で、`const flash = ...` の次の行に追加する:
```js
  const bodyColor = boss.p.color ?? COLORS.boss; // 強化型は色で見分ける
```
そして `drawBoss` の中の次の3行の `COLORS.boss` を `bodyColor` に置き換える（他の行は変えない）:
```js
  ellipse(g, 0, r * 0.15, r * 1.15, r * 0.45, lightenColor(bodyColor, -0.35)); // 下のリング
  ellipse(g, 0, 0, r, r * 0.6, flash ? '#ffffff' : bodyColor);                // 本体
  g.fillStyle = lightenColor(bodyColor, 0.55);                               // ドーム
```

`js/scenes/play.js`：撃破エフェクトの色の行を置き換える:
```js
          spawnBurst(fx, ev.x, ev.y, isBoss ? COLORS.boss : '#ffd866', isBoss ? 60 : 12);
```
↓
```js
          spawnBurst(fx, ev.x, ev.y, isBoss ? (state.boss.p.color ?? COLORS.boss) : '#ffd866', isBoss ? 60 : 12);
```

- [ ] **Step 4: 描画がエラーなく動くことを、Nodeで確認する（コミットしない）**

スクラッチに、次のようなスクリプトを書いて実行し、出力をレポートに貼る。
- `js/render/entities.js` から `drawEnemy`, `drawBoss` を import する（読み込み時に `window`/`document` に触れないこと）
- 2Dコンテキストの代わりに、`Proxy` で作ったスタブ（どのメソッドも何もしない関数を返す。`createRadialGradient` / `createLinearGradient` は `addColorStop` を持つオブジェクトを返す）を渡す
- `createEnemy('formationDrone', 0, rng, {})` を `drawEnemy(g, e, 500, 300, 1)` で描く
- `createBoss('bossA', { color: '#ff8f6b' })` と `createBoss('bossA')` を、`drawBoss(g, boss, 500, 200, 1)` で描く。色を記録するために、スタブの `fillStyle` への代入を監視して、`'#ff8f6b'` から導いた色（`rgb(...)`）が使われていることを確認する
- 例外が出ないこと

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS

（ブラウザでの見た目の確認は、コントローラーが2面の登録後にまとめて行う。ここでは開かない）

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: draw formation drones and allow a custom boss color

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: 2面のデータ・登録・自動操縦テスト

**Files:**
- Create: `js/data/stage2.js`、`tests/stage2.test.mjs`
- Modify: `js/data/stage1.js`（`name` を追加）、`js/data/stages.js`（登録と `stageLabel`）、`tests/progress.test.mjs`（全面置き換え）、`tests/step.test.mjs`（自動操縦の関数を取り出し、2面のテストを追加）

**Interfaces:**
- Consumes: Task 1〜2 の編隊・まとめ書き方、`createBoss`、`BOSS_A_BASE`、`createSpawner/updateSpawner`
- Produces:
  - `STAGE2`（`{ id: 2, name, segments, spawnEnd, boss }`）、`STAGE1.name`
  - `STAGES = { 1: STAGE1, 2: STAGE2 }`
  - `stageLabel(stage): string`：`name` があれば `` `${id}面：${name}　` ``、なければ `` `${id}面　` ``（末尾は全角スペース）

- [ ] **Step 1: 失敗するテストを書く**

`tests/stage2.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';
import { stageLabel } from '../js/data/stages.js';
import { BOSS_A_BASE, createBoss } from '../js/game/boss.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { mulberry32 } from '../js/core/util.js';

test('2面：区間が連続していて隙間がなく、spawnEnd と一致する', () => {
  const segs = STAGE2.segments;
  assert.equal(segs[0].from, 0);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i].from, segs[i - 1].to);
  assert.equal(segs[segs.length - 1].to, STAGE2.spawnEnd);
});

test('2面：最初の区間には編隊が無く、それ以降の区間には編隊がある', () => {
  const [first, ...rest] = STAGE2.segments;
  assert.equal('formationDrone' in first.spawns, false);
  assert.ok(rest.length >= 2);
  for (const seg of rest) assert.equal(typeof seg.spawns.formationDrone, 'object');
});

test('2面：ボスAの強化型は初期型より強く、それ以外は初期型のまま。基準値は書き換わらない', () => {
  const boss = createBoss(STAGE2.boss.type, STAGE2.boss.params);
  assert.equal(STAGE2.boss.type, 'bossA');
  assert.equal(boss.maxHp, 60);
  assert.equal(boss.p.summonCount, 5);
  assert.equal(boss.p.summonInterval, 4.5);
  assert.equal(boss.p.color, '#ff8f6b');
  for (const key of ['radius', 'dist', 'angleRange', 'drift', 'moveSpeed', 'summonMinSep', 'minionApproach',
    'shotInterval', 'shotBurst', 'shotGap', 'advanceInterval', 'advanceStep', 'minDist', 'score']) {
    assert.equal(boss.p[key], BOSS_A_BASE[key], key);
  }
  assert.equal(BOSS_A_BASE.hp, 40);
  assert.equal(BOSS_A_BASE.summonCount, 3);
  assert.equal(BOSS_A_BASE.summonInterval, 6);
  assert.equal(Object.isFrozen(BOSS_A_BASE), true);
});

test('2面：出現をシミュレートすると、編隊が3〜5機ずつ何度も出る', () => {
  const state = { enemies: [], boss: null, rng: mulberry32(5) };
  const sp = createSpawner(STAGE2);
  const groups = [];
  for (let i = 0; i < Math.round(STAGE2.spawnEnd / 0.1); i++) {
    const before = state.enemies.length;
    updateSpawner(sp, state, 0.1);
    const fresh = state.enemies.slice(before).filter((e) => e.type === 'formationDrone');
    if (fresh.length) groups.push(fresh.length);
  }
  assert.ok(groups.length >= 6, `groups=${groups.length}`);
  for (const n of groups) assert.ok(n >= 3 && n <= 5, `size ${n}`);
});

test('面の名前：stageLabel', () => {
  assert.equal(STAGE1.name, '上空・隕石帯（序盤）');
  assert.equal(STAGE2.name, '上空・隕石帯（激化）');
  assert.equal(stageLabel(STAGE1), '1面：上空・隕石帯（序盤）　');
  assert.equal(stageLabel(STAGE2), '2面：上空・隕石帯（激化）　');
  assert.equal(stageLabel({ id: 5 }), '5面　');
});
```

`tests/progress.test.mjs` を次の内容で**全面的に置き換える**（2面が登録されたので、「2面にデータが無い」前提の箇所を差し替えた登録の形に直したもの）:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStageAvailable, isStageUnlocked, isStagePlayable, nextPlayableStage, recordResult,
} from '../js/core/progress.js';
import { STAGES, getStage } from '../js/data/stages.js';
import { STAGE1 } from '../js/data/stage1.js';
import { STAGE2 } from '../js/data/stage2.js';

const mkSave = (stages = {}) => ({ version: 2, settings: {}, stages });
const three = (id) => (id >= 1 && id <= 3 ? { id } : null); // 1〜3面にデータがあると仮定した登録

test('ステージの登録：1〜2面', () => {
  assert.equal(getStage(1), STAGE1);
  assert.equal(getStage(2), STAGE2);
  assert.deepEqual(Object.keys(STAGES), ['1', '2']);
  for (let i = 3; i <= 7; i++) assert.equal(getStage(i), null);
  assert.equal(getStage(0), null);
  assert.equal(getStage('__proto__'), null);
});

test('isStageAvailable：データがある面だけ', () => {
  assert.equal(isStageAvailable(1), true);
  assert.equal(isStageAvailable(2), true);
  assert.equal(isStageAvailable(3), false);
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
  assert.equal(isStagePlayable(s, 2), true);          // 1面クリア済みで、2面のデータがある
  assert.equal(isStagePlayable(s, 3, three), false);  // データはあるが未解放（2面が未クリア）
  s.stages['2'] = { cleared: true, best: 1 };
  assert.equal(isStagePlayable(s, 3), false);         // 解放済みだがデータが無い（準備中）
  assert.equal(isStagePlayable(s, 3, three), true);
});

test('nextPlayableStage', () => {
  const s = mkSave({ 1: { cleared: true, best: 1 } });
  assert.equal(nextPlayableStage(s, 1), 2);
  assert.equal(nextPlayableStage(s, 2), null);          // 2面が未クリア
  assert.equal(nextPlayableStage(s, 2, three), null);   // 同上
  s.stages['2'] = { cleared: true, best: 1 };
  assert.equal(nextPlayableStage(s, 2), null);          // 3面のデータが無い
  assert.equal(nextPlayableStage(s, 2, three), 3);
  assert.equal(nextPlayableStage(s, 3, three), null);   // 4面のデータが無い
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

`tests/step.test.mjs`：

1. import に追加する:
```js
import { STAGE2 } from '../js/data/stage2.js';
```

2. 「自動操縦で1面をクリアできる」テスト全体（コメント2行 `// バランス確認：…` `// 失敗した場合は…` を含む）を、次に置き換える。自動操縦の関数 `autoPilot` を取り出して、1面と2面で共有する:
```js
// バランス確認：単純な自動操縦でステージをクリアできること。
// 自動操縦は狙いが完璧で、人間より強い。失敗した場合は、結果（到達時間・残機・ボスHP）を報告すること。
function autoPilot(st) {
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL（`stage2.js` が無い）

- [ ] **Step 3: 実装する**

`js/data/stage2.js`:
```js
// 2面：上空・隕石帯（激化）。数値は仮。実プレイで調整する。
export const STAGE2 = Object.freeze({
  id: 2,
  name: '上空・隕石帯（激化）',
  segments: [
    { from: 0,  to: 15,  spawns: { meteor: 2.0, drone: 10 } },
    { from: 15, to: 45,  spawns: { meteor: 1.8, drone: 7,
                                   formationDrone: { every: 14, count: 3, minSep: 25 } } },
    { from: 45, to: 90,  spawns: { meteor: 1.5, drone: 6,
                                   formationDrone: { every: 11, count: [3, 4], minSep: 25 } } },
    { from: 90, to: 110, spawns: { meteor: 1.5, drone: 6,
                                   formationDrone: { every: 9, count: [4, 5], minSep: 25 } } },
  ],
  spawnEnd: 110,
  // ボスAの強化型：HP・分散召喚の数と間隔を強め、色で見分ける（他は初期型のまま）
  boss: { type: 'bossA', params: { hp: 60, summonCount: 5, summonInterval: 4.5, color: '#ff8f6b' } },
});
```

`js/data/stage1.js`：`id: 1,` の次の行に追加する:
```js
  name: '上空・隕石帯（序盤）',
```

`js/data/stages.js` を次の内容にする:
```js
import { STAGE1 } from './stage1.js';
import { STAGE2 } from './stage2.js';

// 面の登録。③b・③cで3〜7面のデータができたら、ここに1行ずつ足す。
export const STAGES = Object.freeze({ 1: STAGE1, 2: STAGE2 });

export function getStage(id) {
  return Object.prototype.hasOwnProperty.call(STAGES, id) ? STAGES[id] : null;
}

// 開始時のヒントの先頭に付ける、面の名前（例：「2面：上空・隕石帯（激化）　」）
export function stageLabel(stage) {
  return stage.name ? `${stage.id}面：${stage.name}　` : `${stage.id}面　`;
}
```

- [ ] **Step 4: テストとチェックが通ることを確認する**

Run: `npm test` → Expected: 全PASS。
「自動操縦で2面をクリアできる」だけが失敗した場合は、Global Constraints のとおり、**`js/data/stage2.js` の出現表（`segments` の `spawns`・区間の境界・`spawnEnd`）だけ**を調整して通す（編隊が15秒以降の全区間に残ること、`stage2.test.mjs` が通ることを守る）。ボスの設定・テスト・`autoPilot` は変えない。調整した場合は、最終の数値、5つのシードごとの到達時間と残機を、レポートに書く。調整しても通らないときは、失敗メッセージをそのまま報告して止まる。
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "feat: add stage 2 with formation drones and a stronger boss A

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（Task 4 のコミット後）：**
- タイトル→「ひとりで」→ステージ選択で、2面が「未解放」、1面クリア後（`localStorage` にクリア済みの保存を入れる）に「挑戦できる」になる。3〜7面は「準備中」
- 2面を始め、15秒以降に編隊ドローン（水色の小さなドローン）が3機同時に別の角度から出る。中心へ届くタイミングがほぼそろう
- ボスAの強化型が、色（`#ff8f6b`）で1面のボスと見分けられ、5方向に子機を出す
- コンソールにエラーが無い

---

### Task 5: 面の名前の表示と README

**Files:**
- Modify: `js/scenes/play.js`（ヒントの1行）、`README.md`

**Interfaces:**
- Consumes: Task 4 の `stageLabel(stage)`、`getStage(id)`

- [ ] **Step 1: ヒントに面の名前を付ける**

`js/scenes/play.js`：import 行を置き換える:
```js
import { getStage } from '../data/stages.js';
```
↓
```js
import { getStage, stageLabel } from '../data/stages.js';
```

`enter(params = {})` の中の次の行を置き換える:
```js
        dom.hint.textContent = input.isTouch() ? HINTS.touch : HINTS[mode];
```
↓
```js
        dom.hint.textContent = stageLabel(getStage(stageId)) + (input.isTouch() ? HINTS.touch : HINTS[mode]);
```

- [ ] **Step 2: README を更新する**

`README.md` の次の行を置き換える:
```markdown
- タイトルで「ひとりで」または「ふたりで」を選ぶと、ステージ選択に進む。1面から遊べて、クリアすると次の面が解放される（2〜7面は準備中）
```
↓
```markdown
- タイトルで「ひとりで」または「ふたりで」を選ぶと、ステージ選択に進む。1面から遊べて、クリアすると次の面が解放される（3〜7面は準備中）
- 2面には、3〜5機が同時に別の角度から来る編隊ドローンが出る。ボスも強化型になる
```

- [ ] **Step 3: 機械チェック**

Run: `node tools/check.mjs` → Expected: 全OK
Run: `npm test` → Expected: 全PASS
Run: `git status` → Expected: `js/scenes/play.js` と `README.md` 以外に未コミットの変更が無い

（画面確認は、コントローラーがブラウザで行う。実装担当はブラウザを開かない）

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "feat: show the stage name in the start hint and update README

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（Task 5 のコミット後）：**
- 1面を始めると、ヒントが「1面：上空・隕石帯（序盤）　A/D・←→ で旋回…」になる。2面は「2面：上空・隕石帯（激化）　…」
- スマホ表示（タッチ）では、面の名前のあとにタッチ用の操作説明が続く
- 1面をクリア→結果画面に「次のステージへ」が出て、押すと2面が始まる
- コンソールにエラーが無い
