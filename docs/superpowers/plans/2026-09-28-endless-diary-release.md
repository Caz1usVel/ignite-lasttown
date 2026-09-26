# エンドレスモード・日記・公開準備 Implementation Plan（④⑤⑥）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通常・ハードのエンドレスモード、ステージクリアで解放される日記、公開準備（コンセプト書・README・GitHub Pages のワークフロー）を作る。

**Architecture:** エンドレスは、静的な出現表の代わりに「経過時間から出現間隔・敵の種類・敵の速さ・ボスの強さを計算する」動的な出し方（`js/game/endless.js`）で、ステージのデータに `endless` の設定を持たせる。`updateSpawner` が `stage.endless` を見て、そちらに切り替える。残りは、セーブ・ステージ選択・結果画面のUIと、日記の画面。

**Tech Stack:** 素のJavaScript（ES2022、ES Modules）、Canvas 2D、DOM、Node 24（`node --test`）。外部依存なし。

**Spec:** 設計はこのファイルの「設計」に書く（`docs/concept.md` のエンドレスモード詳細・ボス設計・日記の記述が元）。ユーザーは長期間不在で、確認は取れない。判断が要る点は、下の「判断（Ruling）」に決めてあり、実装者はそれに従う。迷ったら、その場で決めて、レポートの「判断」に書く。

## 判断（Ruling）

| # | 判断 | 理由 |
| --- | --- | --- |
| R1 | エンドレスでも、同時に出る敵の本体は `MAX_ACTIVE`（5）のまま。上げない | ユーザーが後から「最大で5体まで」と明示した。コンセプト書の「同時出現数が際限なく上昇」より新しい指示を優先する。代わりに、出現頻度・敵の速さ・ボスの強さを上げる |
| R2 | エンドレスのボスは A・B・C のみ（最終ボスDは出さない）。ハードは強化レベル3から始める | コンセプト書のとおり |
| R3 | ボス戦の間は、雑魚の出現を止める（回復の隕石は出続ける）。ボス撃破後、60 秒で次のボス | ボスの戦いを見やすくするため。コンセプト書の「一定間隔（例：60秒）」の解釈 |
| R4 | ボスを倒すと、追加でパワーアップの選択が1回ある（コンセプト書） | 仕様どおり。ステージ制ではクリアで終わるため、これまで無かった |
| R5 | 日記の文面は、こちらで書く（性別・名前・年齢は明示しない、一人称のみ） | コンセプト書は基本情報を未確定としている。仮の文面で、あとで差し替えやすいように、データに分ける |
| R6 | GitHub への公開（リモート設定・プッシュ）はしない | ユーザーの操作が要る。ワークフローのファイルと手順の文書だけ用意する |
| R7 | 完了後の `master` へのローカルマージまで行う | これまでずっと、ユーザーが「master にローカルでマージする」を選んできた。ローカルでいつでも戻せる |

## 設計

### エンドレス（`js/game/endless.js`）

`createEndlessStage(kind)`（`kind` は `'normal'` か `'hard'`）が、次の形のステージのデータを返す（登録表 `STAGES` には入れない）:
```js
{
  id: 'endless-normal' | 'endless-hard',
  name: '通常エンドレス' | 'ハードエンドレス',
  endless: { kind, startLevel: 0 | 3, base: 2.6 | 1.8, decay: 0.90 | 0.88, floor: 0.9 | 0.7, bossEvery: 60, healthyStart: ... },
  segments: [], spawnEnd: Infinity, boss: null,
}
```
- **敵の種類（プール）**（経過秒 `t` で決まる、`ENEMY` の種類の配列。袋方式で抽選）:

| 通常 | 経過 | プール |
| --- | --- | --- |
| 0〜60 | meteor, drone |
| 60〜120 | + formationDrone |
| 120〜240 | + burrower, thrower, charger |
| 240〜 | + shielder, teleporter, jammer |

  ハードは、開始から `meteor, drone, formationDrone, burrower, thrower, charger` が入っていて、60 秒から `shielder, teleporter, jammer` も入る。プールが変わったら、袋を作り直す。
- **出現間隔**：`every(t) = max(floor, base × decay^(t/60))`（秒）に `sp.scale`（`SPAWN_SCALE`）を掛ける。1 つのタイマーで、`every` ごとに、袋から 1 種類を出す。編隊（`formationDrone`）は、`count` を 3（`t<120`）、`[3,4]`（以降）、`minSep` 25 で出す。
- **敵の速さ**：`speedMult(t) = 1 + min(0.5, 0.04 × t/60)`。出した敵（編隊も）の `speed` に掛ける。
- **上限**：`sp.maxActive - activeCount(state)` の空きの分だけ出す（編隊は空きに切り詰める）。空きが無ければ、タイマーを `every` に止めて待つ。
- **ボス**：`sp.endless.bossTimer` は、ボスがいない間だけ進み、`bossEvery` に達したら、`state.boss` を作る。種類は A・B・C から、前回と違うものをランダムに選ぶ（`sp.endless.lastBoss`）。強さは `level = startLevel + 倒したボスの数`。ボスがいる間は、雑魚を出さない（回復の隕石は別）。ボスを倒したら（`state.boss` が `null` になったのを見て）`level += 1`、`bossTimer = 0`。
- **ボスの強さ**（`endlessBossParams(kind, level)`。`L = level`）:

| ボス | パラメータ |
| --- | --- |
| A | `hp = round(30×(1+0.3L))`, `summonCount = min(9, 3+L)`, `summonInterval = max(3.5, 7.5×0.92^L)`, `shotInterval = max(2.5, 5×0.92^L)`, `shotBurst = min(6, 3+floor(L/2))` |
| B | `hp = round(40×(1+0.3L))`, `dashInterval = max(4, 11×0.9^L)`, `dashCount = 1+min(2, floor(L/2))`, `dashTime = max(1.8, 2.6×0.95^L)`, `scatterInterval = max(4, 9×0.9^L)`, `scatterCount = min(11, 5+L)` |
| C | `hp = round(45×(1+0.3L))`, `decoyCount = min(5, 2+floor(L/2))`, `swapInterval = max(3, 6×0.92^L)`, `shieldInterval = max(5, 10×0.92^L)`, `jamInterval = max(4, 9×0.92^L)` |

  色は指定しない（見た目は同じまま）。
- **ボス撃破時**（`stepGame`）：エンドレスでは、クリアにせず、`state.boss = null`、残っている偽像（`decoy`）と子機（`bossMinion`）を消す（`dead = true`、得点なし）、`state.nextOfferAt = state.kills`（追加の選択が 1 回入る）、イベント `{ type: 'bossDown' }`。
- **ゲームオーバー**（体力 0）で終わる。結果は、スコア・撃破数・生存時間。

### セーブ（`js/core/save.js`）
`save.endless = { normal: { best, time }, hard: { best, time } }`。`best` はスコア、`time` はその回の生存秒（最高スコアを出した回のもの）。`SAVE_VERSION` は 2 のまま（欠けていれば 0 で補う）。

### UI
- ステージ選択の画面の、ステージのタイルの下に、「通常エンドレス」「ハードエンドレス」のボタン（最高スコアと生存時間を表示）。ハードは、全 7 面クリアで解放（未解放の間は無効で「全ステージクリアで解放」）。
- 結果画面（エンドレス）：「ゲームオーバー」、生存時間の行を出す。「次のステージへ」は出さない。「もう一度」で同じモード。
- プレイ画面のヒント：モード名。

### 日記
`js/data/diary.js` に 7 つ（ステージ 1〜7 に 1 つずつ、`{ stage, title, body }`）。ステージ n を一度でもクリアすると n 番が読める。タイトル画面に「日記」ボタン。日記の画面：7 つの一覧（未解放は「？？？」）と、選んだ日記の本文。結果画面：初めてクリアしたときに「日記が解放されました」と出す。

### 公開準備
`docs/concept.md` を現状に合わせる。`README.md` を整える。`.github/workflows/pages.yml`（push で、テストとチェックを走らせ、GitHub Pages にデプロイ）と、手順の文書。

## Global Constraints

- ビルドツール・npm依存を追加しない。GitHub Pagesに静的ファイルとしてそのまま置ける構成を保つ
- `js/game/` と `js/core/` は、モジュール読み込み時点で DOM・canvas・`window` に触れない。`js/render/` も同様
- UIの文言は日本語。キャラクター・敵は図形で描く。AI生成の画像・動画は使わない
- 既存の挙動（1〜7面、被弾ルール、上限5体、盾3発、回復の隕石など）を変えない
- コミットメッセージの末尾に、次の1行を付ける（一字一句そのまま）：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。コミットの作成者はリポジトリのローカル設定のまま変えない。`git add` は、パスを指定して行う
- 各タスクの最後に `node tools/check.mjs` と `npm test` が通ること（出力にwarningが出ないこと）。ベースラインは283件
- ブランチは `feat/endless-mode`（作成済み）。全タスクをこの上に積む

---

### Task 1: エンドレスの中身（出現・ボスの強化・ボス撃破の扱い）

**Files:**
- Create: `js/game/endless.js`
- Modify: `js/game/enemies.js`（`activeCount` を移す）、`js/core/util.js`（`shuffled` を移す）、`js/game/spawner.js`、`js/game/state.js`、`js/game/step.js`、`js/data/stages.js`（`stageLabel`）
- Test: `tests/endless.test.mjs`

**Interfaces:**
- Produces:
  - `js/core/util.js`：`shuffled(items, rng)`（フィッシャー–イェーツ。今 `spawner.js` の中にあるものを移して `export`）
  - `js/game/enemies.js`：`activeCount(state)`（今 `spawner.js` の中にあるものを移して `export`）
  - `js/game/endless.js`：`createEndlessStage(kind)`、`endlessPool(kind, t)`、`endlessEvery(cfg, t)`、`speedMult(t)`、`endlessBossParams(bossType, level)`、`initEndless(stage)`（`sp.endless` の初期値）、`updateEndless(sp, state, dt)`
  - `spawner.js`：`createSpawner` は、`stage.endless` があれば `sp.endless = initEndless(stage)` を持つ。`updateSpawner` は、`stage.endless` があれば、回復の隕石の処理（共通の関数 `updateHealMeteor(sp, state, dt)` に切り出して `export`）と `updateEndless` を呼んで戻る。`validateStage` は変えない
  - `state.js`：`createPlayState` の返す値に `endless: Boolean(stage.endless)` を足す
  - `step.js`：エンドレスのボス撃破の扱い（設計の「ボス撃破時」）
  - `stages.js`：`stageLabel(stage)` は、`stage.endless` なら `${stage.name}　` を返す（既存の面はそのまま）

- [ ] **Step 1: 失敗するテストを書く**

`tests/endless.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createEndlessStage, endlessPool, endlessEvery, speedMult, endlessBossParams,
} from '../js/game/endless.js';
import { createSpawner, updateSpawner } from '../js/game/spawner.js';
import { createPlayState } from '../js/game/state.js';
import { stepGame } from '../js/game/step.js';
import { activeCount, createEnemy, ENEMY_DEFS } from '../js/game/enemies.js';
import { createBoss } from '../js/game/boss.js';
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
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s.turret.lives = s.turret.maxLives; // 死なない
    if (kill) for (const e of s.enemies) if (ENEMY_DEFS[e.type].countsAsKill && e.dist < 200) e.dead = true;
    const ev = stepGame(s, DT, noInput);
    log.maxActive = Math.max(log.maxActive, activeCount(s));
    for (const e of s.enemies) log.types.add(e.type);
    if (s.boss && !log.bosses.includes(s.boss.type + '@' + Math.round(s.time))) log.bosses.push(s.boss.type + '@' + Math.round(s.time));
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
    const { s, log } = play(kind, 60 * 20, { seed: 9, kill: true, each: (st) => { if (st.offer) st.offer = null; if (st.boss && st.boss.arrived && !st.boss.dead) st.boss.hp -= 0.02; } });
    assert.ok(log.maxActive <= CONFIG.MAX_ACTIVE, `${kind} maxActive ${log.maxActive}`);
    assert.ok(log.bosses.length >= 3, `${kind} bosses ${log.bosses}`);
    assert.equal(s.outcome, null);
  }
  const n = play('normal', 40, { seed: 1 }).s;
  const h = play('hard', 40, { seed: 1 }).s;
  const cnt = (st) => st.enemies.filter((e) => e.type !== 'enemyShot').length + st.kills;
  assert.ok(cnt(h) >= cnt(n));
});
```
（時間依存のテストは、実装の細部で外れる可能性がある。**意図を変えずに**、待ち時間・シード・許容の幅を直してよい。直した箇所は、レポートに書く。）

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/endless.test.mjs`
Expected: FAIL（`endless.js` が無い）

- [ ] **Step 3: 実装する**

`js/core/util.js`：末尾に、`spawner.js` の `shuffled` を移して `export` する（中身はそのまま。`randInt` を使う）。`spawner.js` の同名の関数は削除して、`import { … shuffled } from '../core/util.js'` にする。
`js/game/enemies.js`：末尾に `activeCount` を追加して `export` する:
```js
// 画面に同時にいる「敵の本体」の数（敵弾・妨害電波・偽像・回復の隕石は数えない）
export function activeCount(state) {
  let n = 0;
  for (const e of state.enemies) if (!e.dead && ENEMY_DEFS[e.type].countsAsKill) n++;
  return n;
}
```
`spawner.js` の同名のローカル関数は削除して、`enemies.js` から import する。

`js/game/spawner.js`：
1. 回復の隕石の処理を `export function updateHealMeteor(sp, state, dt)` に切り出す（今 `updateSpawner` の `if (sp.time < stage.spawnEnd) {` の直後にある `const turret = state.turret; if (turret) {…}` のブロックをそのまま移す。`updateSpawner` の同じ場所からは `updateHealMeteor(sp, state, dt);` を呼ぶ）。
2. `import { initEndless, updateEndless } from './endless.js';` を足す。`createSpawner` の返す値の後に、`if (stage.endless) sp.endless = initEndless(stage);` を足す（返す値を変数 `sp` にして、最後に返す）。
3. `updateSpawner` の先頭（`sp.time += dt;` と `const { stage } = sp;` の後）に追加する:
```js
  if (stage.endless) {
    updateHealMeteor(sp, state, dt);
    updateEndless(sp, state, dt);
    return;
  }
```

`js/game/endless.js`:
```js
import { CONFIG } from '../core/config.js';
import { randInt, randRange, shuffled } from '../core/util.js';
import { createEnemy, activeCount } from './enemies.js';
import { createFormation } from './formation.js';
import { createBoss } from './boss.js';
import { BOSS_A_BASE } from './boss-a.js';
import { BOSS_B_BASE } from './boss-b.js';
import { BOSS_C_BASE } from './boss-c.js';

// エンドレス：静的な出現表の代わりに、経過時間から、出現の間隔・敵の種類・敵の速さ・ボスの強さを決める。
// 同時に出る敵は MAX_ACTIVE のまま（ユーザーの指示）。難しくなるのは、出現頻度・速さ・ボスの強さ。
const CONFIGS = {
  normal: { startLevel: 0, base: 2.6, decay: 0.9, floor: 0.9, bossEvery: 60 },
  hard:   { startLevel: 3, base: 1.8, decay: 0.88, floor: 0.7, bossEvery: 60 },
};
const NAMES = { normal: '通常エンドレス', hard: 'ハードエンドレス' };
const BOSS_TYPES = ['bossA', 'bossB', 'bossC'];

export function createEndlessStage(kind) {
  if (!Object.prototype.hasOwnProperty.call(CONFIGS, kind)) throw new Error(`unknown endless kind: ${kind}`);
  return {
    id: `endless-${kind}`,
    name: NAMES[kind],
    endless: { kind, ...CONFIGS[kind] },
    segments: [],
    spawnEnd: Infinity,
    boss: null,
  };
}

const BASIC = ['meteor', 'drone'];
const MELEE = ['burrower', 'thrower', 'charger'];
const JAMMING = ['shielder', 'teleporter', 'jammer'];

export function endlessPool(kind, t) {
  if (kind === 'hard') return [...BASIC, 'formationDrone', ...MELEE, ...(t >= 60 ? JAMMING : [])];
  const pool = [...BASIC];
  if (t >= 60) pool.push('formationDrone');
  if (t >= 120) pool.push(...MELEE);
  if (t >= 240) pool.push(...JAMMING);
  return pool;
}

export function endlessEvery(cfg, t) {
  return Math.max(cfg.floor, cfg.base * Math.pow(cfg.decay, t / 60));
}

export function speedMult(t) {
  return 1 + Math.min(0.5, (0.04 * t) / 60);
}

// ボスの強さ。level が上がるほど、HPが増え、アイデンティティ攻撃の数・頻度が上がる（上限・下限あり）
export function endlessBossParams(type, L) {
  const hpk = 1 + 0.3 * L;
  switch (type) {
    case 'bossA': return {
      hp: Math.round(BOSS_A_BASE.hp * hpk),
      summonCount: Math.min(9, 3 + L),
      summonInterval: Math.max(3.5, BOSS_A_BASE.summonInterval * Math.pow(0.92, L)),
      shotInterval: Math.max(2.5, BOSS_A_BASE.shotInterval * Math.pow(0.92, L)),
      shotBurst: Math.min(6, 3 + Math.floor(L / 2)),
    };
    case 'bossB': return {
      hp: Math.round(BOSS_B_BASE.hp * hpk),
      dashInterval: Math.max(4, BOSS_B_BASE.dashInterval * Math.pow(0.9, L)),
      dashCount: 1 + Math.min(2, Math.floor(L / 2)),
      dashTime: Math.max(1.8, BOSS_B_BASE.dashTime * Math.pow(0.95, L)),
      scatterInterval: Math.max(4, BOSS_B_BASE.scatterInterval * Math.pow(0.9, L)),
      scatterCount: Math.min(11, BOSS_B_BASE.scatterCount + L),
    };
    case 'bossC': return {
      hp: Math.round(BOSS_C_BASE.hp * hpk),
      decoyCount: Math.min(5, BOSS_C_BASE.decoyCount + Math.floor(L / 2)),
      swapInterval: Math.max(3, BOSS_C_BASE.swapInterval * Math.pow(0.92, L)),
      shieldInterval: Math.max(5, BOSS_C_BASE.shieldInterval * Math.pow(0.92, L)),
      jamInterval: Math.max(4, BOSS_C_BASE.jamInterval * Math.pow(0.92, L)),
    };
    default: throw new Error(`unknown endless boss type: ${type}`);
  }
}

export function initEndless(stage) {
  return {
    kind: stage.endless.kind,
    timer: 0,            // 雑魚の出現のタイマー
    bag: [],
    bagKey: '',
    bossTimer: 0,
    bossLevel: stage.endless.startLevel,
    hadBoss: false,
    lastBoss: null,
  };
}

export function updateEndless(sp, state, dt) {
  const st = sp.endless;
  const cfg = sp.stage.endless;
  const t = sp.time;

  // ボスがいなくなった（倒された）ら、強さを上げて、次のタイマーを始める
  if (st.hadBoss && !state.boss) {
    st.hadBoss = false;
    st.bossLevel += 1;
    st.bossTimer = 0;
  }

  if (state.boss) return; // ボス戦の間は、雑魚を出さない

  // ボスの出現
  st.bossTimer += dt;
  if (st.bossTimer >= cfg.bossEvery) {
    const candidates = BOSS_TYPES.filter((b) => b !== st.lastBoss);
    const type = candidates[randInt(state.rng, 0, candidates.length - 1)];
    st.lastBoss = type;
    state.boss = createBoss(type, endlessBossParams(type, st.bossLevel));
    st.hadBoss = true;
    return;
  }

  // 雑魚の出現
  st.timer += dt;
  const every = endlessEvery(cfg, t) * sp.scale;
  while (st.timer >= every) {
    const room = sp.maxActive - activeCount(state);
    if (room <= 0) { st.timer = every; break; }
    st.timer -= every;
    const pool = endlessPool(cfg.kind, t);
    const key = pool.join(',');
    if (st.bagKey !== key || st.bag.length === 0) { st.bag = shuffled(pool, state.rng); st.bagKey = key; }
    const picked = st.bag.pop();
    const mult = speedMult(t);
    let made;
    if (picked === 'formationDrone') {
      const [lo, hi] = t < 120 ? [3, 3] : [3, 4];
      const n = Math.min(randInt(state.rng, lo, hi), room);
      made = createFormation('formationDrone', n, 25, state.rng);
    } else {
      const angle = randRange(state.rng, -CONFIG.HEADING_LIMIT, CONFIG.HEADING_LIMIT);
      made = [createEnemy(picked, angle, state.rng)];
    }
    for (const e of made) e.speed *= mult;
    state.enemies.push(...made);
  }
}
```

`js/game/state.js`：返す値に `endless: Boolean(stage.endless),` を足す（`outcome` の前）。

`js/game/step.js`：`if (state.boss?.dead) { state.outcome = 'clear'; … }` の分岐を置き換える:
```js
  if (state.boss?.dead) {
    if (state.endless) {
      // エンドレス：クリアにならず、次のボスへ。偽像・子機は消し、追加のパワーアップ選択を1回入れる
      for (const e of state.enemies) if (e.type === 'decoy' || e.type === 'bossMinion') e.dead = true;
      removeDead(state.enemies);
      state.boss = null;
      state.nextOfferAt = state.kills;
      events.push({ type: 'bossDown' });
    } else {
      state.outcome = 'clear';
      events.push({ type: 'clear' });
    }
  } else if (t.lives <= 0) {
```
（続きの `state.outcome = 'gameover'; …` は今のまま。`else if` の形を保つ。エンドレスでボスを倒したフレームに体力が 0 なら、その回は `bossDown` だけで、次のフレームで `gameover` になる）

`js/data/stages.js`：`stageLabel` を置き換える:
```js
export function stageLabel(stage) {
  if (stage.endless) return `${stage.name}　`;
  return stage.name ? `${stage.id}面：${stage.name}　` : `${stage.id}面　`;
}
```

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add js/game/endless.js js/game/enemies.js js/core/util.js js/game/spawner.js js/game/state.js js/game/step.js js/data/stages.js tests/endless.test.mjs
git commit -m "feat: endless mode engine (time-scaled spawns, boss cycle with scaling levels)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: エンドレスのセーブ・画面（ステージ選択・結果・プレイ）

**Files:**
- Modify: `js/core/save.js`、`js/core/progress.js`、`index.html`、`css/style.css`、`js/main.js`、`js/scenes/stageselect.js`、`js/scenes/play.js`、`js/scenes/result.js`
- Test: `tests/save.test.mjs`（追記）、`tests/progress.test.mjs`（追記）

**Interfaces:**
- Consumes: `createEndlessStage(kind)`（Task 1）、`stageLabel`
- Produces:
  - `save.js`：`defaults()` に `endless: { normal: {best:0,time:0}, hard: {best:0,time:0} }`。読み込みで検査（`sanitizeEndless`）。`v1` からの移行でも `endless` を入れる。`writeSave` はそのまま
  - `progress.js`：`isHardEndlessUnlocked(save)`（1〜`STAGE_COUNT` のすべてが `cleared`）、`recordEndlessResult(save, kind, score, time)`（最高スコアを更新したら `{ newBest: true }`、そのとき `time` も更新）
  - プレイ画面の入口のパラメータ：`{ endless: 'normal' | 'hard', mode }`（`stageId` は使わない）。結果画面へは `{ outcome, score, kills, mode, stageId, endless, time }`
  - DOM の id：`endlessBtn`、`hardEndlessBtn`、`resultTimeLabel`、`resultTime`

- [ ] **Step 1: 失敗するテストを書く**

`tests/save.test.mjs` の末尾に追記する（既存の import・ヘルパ（メモリのストレージを作るもの）を使う。無ければ、テスト内で `{ getItem, setItem }` のオブジェクトを作る）:
```js

test('エンドレスの記録：既定は 0。保存・読み込みで保たれ、壊れた値は 0 に直る。v1 からの移行でも入る', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.deepEqual(fresh.endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.endless.normal = { best: 1200, time: 245.5 };
  data.endless.hard.best = 300;
  writeSave(data, storage);
  const back = loadSave(storage);
  assert.deepEqual(back.endless.normal, { best: 1200, time: 245.5 });
  assert.deepEqual(back.endless.hard, { best: 300, time: 0 });
  const broken = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {}, endless: { normal: { best: -5, time: 'x' }, hard: 7, extra: 1 } }), setItem() {} };
  assert.deepEqual(loadSave(broken).endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const v1 = { getItem: () => JSON.stringify({ version: 1, highScore: 400, settings: {} }), setItem() {} };
  assert.deepEqual(loadSave(v1).endless, { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } });
  const v2old = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: { 1: { cleared: true, best: 5 } } }), setItem() {} };
  assert.deepEqual(loadSave(v2old).endless.normal, { best: 0, time: 0 }); // endless の欄が無い古い v2
});
```

`tests/progress.test.mjs` の末尾に追記する（`mkSave`/`cleared` ヘルパは、このファイルに既にある。`mkSave` は `endless` を持たないので、テスト内で足す）:
```js

import { isHardEndlessUnlocked, recordEndlessResult } from '../js/core/progress.js';

test('isHardEndlessUnlocked：全ステージクリアで解放', () => {
  assert.equal(isHardEndlessUnlocked(mkSave()), false);
  assert.equal(isHardEndlessUnlocked(cleared(1, 2, 3, 4, 5, 6)), false);
  assert.equal(isHardEndlessUnlocked(cleared(1, 2, 3, 4, 5, 6, 7)), true);
  const notClear = cleared(1, 2, 3, 4, 5, 6);
  notClear.stages['7'] = { cleared: false, best: 900 };
  assert.equal(isHardEndlessUnlocked(notClear), false);
});

test('recordEndlessResult：最高スコアを更新したときだけ、記録と生存時間を更新する', () => {
  const s = { ...mkSave(), endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } } };
  assert.deepEqual(recordEndlessResult(s, 'normal', 500, 120), { newBest: true });
  assert.deepEqual(s.endless.normal, { best: 500, time: 120 });
  assert.deepEqual(recordEndlessResult(s, 'normal', 400, 300), { newBest: false });
  assert.deepEqual(s.endless.normal, { best: 500, time: 120 });
  assert.deepEqual(recordEndlessResult(s, 'normal', 800, 60), { newBest: true });
  assert.deepEqual(s.endless.normal, { best: 800, time: 60 });
  assert.deepEqual(recordEndlessResult(s, 'hard', 0, 10), { newBest: false });
  assert.deepEqual(s.endless.hard, { best: 0, time: 0 });
  const old = mkSave(); // endless の欄が無いセーブでも落ちない
  assert.deepEqual(recordEndlessResult(old, 'hard', 50, 5), { newBest: true });
  assert.deepEqual(old.endless.hard, { best: 50, time: 5 });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/save.test.mjs tests/progress.test.mjs`
Expected: FAIL

- [ ] **Step 3: 実装する**

`js/core/save.js`：
```js
function defaultEndless() {
  return { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } };
}

function sanitizeEndless(raw) {
  const out = defaultEndless();
  if (!raw || typeof raw !== 'object') return out;
  for (const kind of ['normal', 'hard']) {
    const e = raw[kind];
    if (!e || typeof e !== 'object') continue;
    out[kind] = {
      best: Number.isFinite(e.best) && e.best > 0 ? e.best : 0,
      time: Number.isFinite(e.time) && e.time > 0 ? e.time : 0,
    };
  }
  return out;
}
```
`defaults()` の返す値に `endless: defaultEndless()` を足す。`loadSave` の v1 移行の返す値と v2 の返す値に `endless: sanitizeEndless(d.endless)`（v1 は `defaultEndless()`）を足す。

`js/core/progress.js` に追加する:
```js
// ハードエンドレスは、全ステージのクリアで解放される
export function isHardEndlessUnlocked(save) {
  for (let id = 1; id <= CONFIG.STAGE_COUNT; id++) {
    if (save.stages[id]?.cleared !== true) return false;
  }
  return true;
}

// エンドレスの結果を反映する（呼び出し側が persist する）。最高スコアを更新したときだけ、生存時間も更新する。
export function recordEndlessResult(save, kind, score, time) {
  save.endless ??= { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } };
  const entry = (save.endless[kind] ??= { best: 0, time: 0 });
  const newBest = score > entry.best;
  if (newBest) {
    entry.best = score;
    entry.time = time;
  }
  return { newBest };
}
```

`index.html`：
- ステージ選択の `#stageGrid` の直後に追加する:
```html
    <div class="endless-row">
      <button type="button" class="btn btn-sub endless-btn" id="endlessBtn"></button>
      <button type="button" class="btn btn-sub endless-btn" id="hardEndlessBtn"></button>
    </div>
```
- 結果画面の `<dl class="result-stats">` の中の、撃破数の行の後ろに追加する:
```html
      <dt id="resultTimeLabel" class="hidden">生存時間</dt><dd id="resultTime" class="hidden">0:00</dd>
```
`js/main.js` の `IDS` に `'endlessBtn', 'hardEndlessBtn', 'resultTimeLabel', 'resultTime'` を足す。
`css/style.css`：`.endless-row { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }` と `.endless-btn { font-size: 0.95rem; padding: 10px 16px; line-height: 1.4; }` `.endless-btn:disabled { opacity: 0.45; cursor: default; }` を足す（既存のボタンのスタイルに合わせる。`.btn:disabled` があれば、それに任せてよい）。

`js/scenes/stageselect.js`：`build()` の最後に、エンドレスのボタンを作る処理を足す:
```js
    const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const line = (label, e) => `${label}\n${e && e.best > 0 ? `最高 ${e.best.toLocaleString()}（${fmtTime(e.time)}）` : 'まだ記録なし'}`;
    dom.endlessBtn.textContent = line('通常エンドレス', save.endless?.normal);
    const hardOpen = isHardEndlessUnlocked(save);
    dom.hardEndlessBtn.disabled = !hardOpen;
    dom.hardEndlessBtn.textContent = hardOpen ? line('ハードエンドレス', save.endless?.hard) : 'ハードエンドレス\n全ステージクリアで解放';
```
（`textContent` の改行を表示するため、CSS で `.endless-btn { white-space: pre-line; }` を足す）。ボタンの click は、コンストラクタの側で、一度だけ登録する:
```js
  dom.endlessBtn.addEventListener('click', () => app.setScene('play', { endless: 'normal', mode: app.mode }));
  dom.hardEndlessBtn.addEventListener('click', () => {
    if (isHardEndlessUnlocked(app.save)) app.setScene('play', { endless: 'hard', mode: app.mode });
  });
```
`isHardEndlessUnlocked` を `progress.js` から import する。

`js/scenes/play.js`：
- `import { createEndlessStage } from '../game/endless.js';` を足す。
- 変数 `let endless = null;` を足し、`enter` の `!params.resume` の中を次にする:
```js
        mode = params.mode ?? mode;
        endless = params.endless ?? null;
        if (!endless) stageId = params.stageId ?? stageId;
        const stage = endless ? createEndlessStage(endless) : getStage(stageId);
        state = createPlayState(stage);
        fx = createEffects();
        endTimer = 0;
        dom.hint.textContent = stageLabel(stage) + (input.isTouch() ? HINTS.touch : HINTS[mode]);
        dom.hint.classList.remove('hidden');
```
- `handleEvents` に、`bossDown` を足す（`case 'clear':` の前）:
```js
        case 'bossDown':
          audio.se.bossKill();
          spawnBurst(fx, CONFIG.CENTER_X, 300, '#ffd866', 40);
          spawnPopup(fx, CONFIG.CENTER_X, 260, 'ボス撃破！', '#ffd866');
          break;
```
  （ボスを倒した位置の爆発・音は、通常の `kill` イベントがすでに出している。ここは、追加の演出だけにする）
- 結果画面へ渡す値に、`endless` と `time: state.time` を足す: `app.setScene('result', { outcome: state.outcome, score: state.score, kills: state.kills, mode, stageId, endless, time: state.time });`

`js/scenes/result.js`：
- `import { recordResult, nextPlayableStage, recordEndlessResult } from '../core/progress.js';`
- `let last = { mode: 'solo', stageId: 1, endless: null };` にし、`retryBtn` の処理を、`last.endless` があれば `app.setScene('play', { mode: last.mode, endless: last.endless })`、なければこれまでどおりにする。
- `enter({ outcome, score, kills, mode, stageId, endless, time })`：`last = { mode, stageId, endless: endless ?? null };`。エンドレスのときは、`recordEndlessResult(app.save, endless, score, time)` の結果の `newBest` を使い、`nextId = null`、タイトルは「ゲームオーバー」、最高スコアの欄は `app.save.endless[endless].best`、生存時間の行（`resultTimeLabel`・`resultTime`）を出す（`m:ss`）。エンドレスでなければ、これまでどおりで、生存時間の行は隠す。`persist()` はどちらでも呼ぶ。

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: ブラウザで動作確認する（コントローラーが後で行うので、実装者は Node での確認だけでよい）**

Node で、`createPlayState(createEndlessStage('normal'))` を `stepGame` で 10 秒進め、例外が出ないことだけ確認して、レポートに書く。

- [ ] **Step 6: コミット**

```bash
git add js/core/save.js js/core/progress.js index.html css/style.css js/main.js js/scenes/stageselect.js js/scenes/play.js js/scenes/result.js tests/save.test.mjs tests/progress.test.mjs
git commit -m "feat: endless mode save data, stage select buttons, play and result screens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: 日記

**Files:**
- Create: `js/data/diary.js`、`js/scenes/diary.js`、`tests/diary.test.mjs`
- Modify: `js/core/progress.js`（`recordResult` の戻り値に `newClear` を足す）、`index.html`、`css/style.css`、`js/main.js`、`js/scenes/title.js`、`js/scenes/result.js`

**Interfaces:**
- Produces:
  - `js/data/diary.js`：`DIARY`（凍結した配列。長さ 7。各要素 `{ stage: 1..7, title, body }`。`body` は改行を含む文字列）、`isDiaryUnlocked(save, stage)`（`save.stages[stage]?.cleared === true`）
  - `progress.js`：`recordResult` は `{ newBest, newClear }` を返す（`newClear`：この結果で初めてクリアになった）
  - シーン `diary`：`app.scenes.diary`。タイトルの「日記」ボタンから入り、「もどる」でタイトルへ
  - DOM の id：`titleDiaryBtn`、`diaryScreen`、`diaryList`、`diaryText`、`diaryBackBtn`、`resultDiaryNote`

- [ ] **Step 1: 失敗するテストを書く**

`tests/diary.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIARY, isDiaryUnlocked } from '../js/data/diary.js';
import { recordResult } from '../js/core/progress.js';
import { CONFIG } from '../js/core/config.js';

test('日記：ステージ数だけあり、1〜7が1つずつ。題名・本文は空でない。凍結されている', () => {
  assert.equal(DIARY.length, CONFIG.STAGE_COUNT);
  assert.deepEqual(DIARY.map((d) => d.stage), [1, 2, 3, 4, 5, 6, 7]);
  for (const d of DIARY) {
    assert.ok(typeof d.title === 'string' && d.title.length > 0);
    assert.ok(typeof d.body === 'string' && d.body.length >= 60, `stage ${d.stage} body too short`);
  }
  assert.equal(Object.isFrozen(DIARY), true);
});

test('日記の文面は、名前・性別・年齢を明示しない（一人称のみ）', () => {
  const text = DIARY.map((d) => d.title + d.body).join('\n');
  for (const word of ['彼女', '彼は', '男', '女', '歳', '才', 'さん']) assert.equal(text.includes(word), false, word);
});

test('isDiaryUnlocked：そのステージをクリアしていれば読める', () => {
  const save = { stages: { 1: { cleared: true, best: 5 }, 2: { cleared: false, best: 9 } } };
  assert.equal(isDiaryUnlocked(save, 1), true);
  assert.equal(isDiaryUnlocked(save, 2), false);
  assert.equal(isDiaryUnlocked(save, 3), false);
});

test('recordResult：newClear は、初めてクリアになったときだけ true', () => {
  const save = { stages: {} };
  assert.equal(recordResult(save, 1, 'gameover', 100).newClear, false);
  assert.equal(recordResult(save, 1, 'clear', 200).newClear, true);
  assert.equal(recordResult(save, 1, 'clear', 300).newClear, false);
  assert.equal(recordResult(save, 2, 'clear', 0).newClear, true);
});
```
（既存の `progress.test.mjs` の `recordResult` のテストは、`deepEqual({ newBest })` になっている。`{ newBest, newClear }` に合わせて直す。意図は変えない）

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/diary.test.mjs`
Expected: FAIL

- [ ] **Step 3: 実装する**

`js/core/progress.js`：`recordResult` を置き換える:
```js
export function recordResult(save, id, outcome, score) {
  const entry = (save.stages[id] ??= { cleared: false, best: 0 });
  const newClear = outcome === 'clear' && !entry.cleared;
  if (outcome === 'clear') entry.cleared = true;
  const newBest = score > entry.best;
  if (newBest) entry.best = score;
  return { newBest, newClear };
}
```

`js/data/diary.js`：次の 7 つを、そのまま使う（仮の文面。差し替えやすいように、このファイルだけに置く）:
```js
// 防衛砲手の日記。ステージ n をクリアすると n 番が読める。名前・性別・年齢は明示しない（仮の文面）。
export const DIARY = Object.freeze([
  Object.freeze({
    stage: 1,
    title: '任命の日',
    body: '今日、防衛砲手を任された。\nこの星に、空から石が降りはじめて三日。地上の人たちは、まだ何も知らずに眠っている。\n砲台は思っていたより小さくて、意外と可愛い顔をしていた。\nまずは空の見張りから。ここを通したら、みんなの朝が来なくなる。',
  }),
  Object.freeze({
    stage: 2,
    title: '数が増えていく',
    body: '石の数が、昨日の倍になった。\n小さな偵察機が群れで来るようになって、首が回らない。\n右を見ていると左が落ちる。当たり前のことを、体で覚えている最中だ。\nそれでも、今日は一つも地上に届かせなかった。',
  }),
  Object.freeze({
    stage: 3,
    title: '地面の下から',
    body: '空だけじゃなかった。\n地面が盛り上がって、下から何かが突き上げてくる。見つけるのが遅れると、もう目の前だ。\n先に気づいたほうが勝つ。音と、地面の揺れと、勘を頼りにした。\n手が少し震えている。でも、まだ撃てる。',
  }),
  Object.freeze({
    stage: 4,
    title: '一拍の間',
    body: '突っ込んでくる相手には、一拍の間がある。\nその間をどう使うかで、全部が決まると気づいた。\n大きな影が視界から消えて、思いもよらない方向から戻ってきた日は、正直、怖かった。\n怖いと思えるうちは、まだ大丈夫だと思うことにする。',
  }),
  Object.freeze({
    stage: 5,
    title: '見えなくなる',
    body: '拠点に入ってから、目が信用できない。\n盾を張る相手、消えて別の場所に現れる相手、偽物の影。\nどれが本物かを疑いながら撃つのは、思った以上に疲れる。\nでも、疑い方にも慣れてきた。落ち着いて、一つずつ。',
  }),
  Object.freeze({
    stage: 6,
    title: '最後の線',
    body: '電波が乱れて、砲台が一瞬だけ黙る。その一瞬に、全部が落ちてくる。\nここが最後の防衛線。ここを抜かれたら、あとはもう誰もいない。\n昨日の自分より、少しだけ落ち着いていられた。\n明日、核心に向かう。今夜は、ちゃんと眠ることにした。',
  }),
  Object.freeze({
    stage: 7,
    title: '朝が来る',
    body: '石の本体は、思っていたよりずっと静かだった。\n今までの全部が、順番に、そして一度に押し寄せてきた。\n最後の一発を撃ったあと、空がゆっくり明るくなった。\n地上の人たちは、きっと、いつもと同じ朝を迎える。\nそれが、この仕事のすべてだった。',
  }),
]);

export function isDiaryUnlocked(save, stage) {
  return save.stages?.[stage]?.cleared === true;
}
```

`index.html`：
- タイトルの `.btn-col` に、`<button class="btn btn-sub" id="startDuoBtn">…</button>` の直後に `<button class="btn btn-sub" id="titleDiaryBtn">日記</button>` を足す。
- 結果画面の `<p id="resultNewBest" …>` の直後に `<p id="resultDiaryNote" class="new-best hidden">日記が解放されました（タイトルの「日記」から読めます）</p>` を足す。
- 設定の画面の前に、日記の画面を足す:
```html
  <div id="diaryScreen" class="overlay hidden">
    <h2>日記</h2>
    <div id="diaryList" class="diary-list"></div>
    <p id="diaryText" class="diary-text">読みたい日記を選んでください</p>
    <button class="link-btn" id="diaryBackBtn">もどる</button>
  </div>
```
`js/main.js`：`IDS` に `'titleDiaryBtn', 'diaryScreen', 'diaryList', 'diaryText', 'diaryBackBtn', 'resultDiaryNote'` を足し、`import { createDiaryScene } from './scenes/diary.js';` と `app.scenes.diary = createDiaryScene(app);` を足す。
`css/style.css`：
```css
.diary-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 560px; }
.diary-list button { min-width: 120px; padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.08); color: var(--text-main); font-family: var(--font); cursor: pointer; }
.diary-list button:disabled { opacity: 0.4; cursor: default; }
.diary-list button.active { border-color: var(--ember); }
.diary-text { max-width: 520px; min-height: 8em; padding: 14px 18px; border-radius: 14px; background: rgba(10, 14, 39, 0.75); white-space: pre-line; line-height: 1.8; text-align: left; }
```
（`--ember`・`--text-main`・`--font` は既存の変数。無ければ、既存のスタイルの色に合わせる）
`js/scenes/diary.js`：
```js
import { DIARY, isDiaryUnlocked } from '../data/diary.js';
import { drawBackground } from '../render/background.js';

export function createDiaryScene(app) {
  const { dom } = app;
  dom.diaryBackBtn.addEventListener('click', () => app.setScene('title'));

  function build() {
    dom.diaryList.replaceChildren();
    dom.diaryText.textContent = '読みたい日記を選んでください';
    for (const d of DIARY) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const open = isDiaryUnlocked(app.save, d.stage);
      btn.disabled = !open;
      btn.textContent = open ? `${d.stage}. ${d.title}` : `${d.stage}. ？？？`;
      btn.addEventListener('click', () => {
        for (const other of dom.diaryList.children) other.classList.remove('active');
        btn.classList.add('active');
        dom.diaryText.textContent = d.body;
      });
      dom.diaryList.append(btn);
    }
  }

  return {
    enter() {
      build();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.diaryScreen.classList.remove('hidden');
    },
    exit() {
      dom.diaryScreen.classList.add('hidden');
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
`js/scenes/title.js`：`dom.titleSettingsBtn.addEventListener(…)` の前に、`dom.titleDiaryBtn.addEventListener('click', () => app.setScene('diary'));` を足す。
`js/scenes/result.js`：ステージ制の結果のとき、`recordResult` の `newClear` を使って、`dom.resultDiaryNote.classList.toggle('hidden', !newClear);`。エンドレスのときは、常に隠す。`exit` でも隠す。

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: コミット**

```bash
git add js/data/diary.js js/scenes/diary.js js/scenes/title.js js/scenes/result.js js/core/progress.js js/main.js index.html css/style.css tests/diary.test.mjs tests/progress.test.mjs
git commit -m "feat: diary entries unlocked by clearing stages, with a diary screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: 公開準備（コンセプト書・README・GitHub Pages のワークフロー）

**Files:**
- Modify: `docs/concept.md`、`README.md`
- Create: `.github/workflows/pages.yml`、`docs/DEPLOY.md`

**Interfaces:** なし（文書と設定だけ）

- [ ] **Step 1: `docs/concept.md` を現状に合わせる**

コードと `README.md`、`docs/superpowers/specs/*.md` を読んで、コンセプト書の記述が、実装と食い違っている箇所を、実装に合わせて直す。少なくとも、次を反映する（ある記述は直し、無いものは、該当の章に足す）:
- ミニマップは画面**上中央**（今は「右下」）。砲台は画面の下寄りで、奥行きを縦に 1.5 倍に引き伸ばして表示している（`CENTER_Y` 900、`VERT_SCALE` 1.5）
- 敵の接近時間の基準は**10秒**（「延長を確定」の記述を、現状に合わせる。実プレイで一度 14 秒にして、10 秒に戻した経緯を 1 行で）
- 被弾ルール：体当たりだけが体力を減らす。敵の弾（直進弾・破片）は届くと**スコア −50**（体力は減らない）。妨害電波は「1.5 秒撃てない」
- 体力：最大値の概念。パワーアップは「**最大体力+1**」（最大値 +1 と体力 +1 回復）。回復の隕石（体力が減っているときだけ 40 秒ごとに出る、撃つと 1 回復）
- 同時に出る敵の本体は**最大 5 体**
- シールド敵の盾は、弾を **3 発**吸収すると壊れる（時間で開閉しない）。ボスCの盾は時間で開閉
- 出現数の調整（`SPAWN_SCALE` 1.35、雑魚・ボスの弱体化）
- エンドレスモード：この計画の「設計」のとおりに実装したこと（同時出現数は上げず、頻度・速さ・ボスの強さを上げる）。ボスは A・B・C、ハードは強化レベル 3 から
- 日記：7 つ、ステージクリアで解放。文面は仮
- 7面専用ボス（最終ボス）：実装した仕様（モード・最終フェーズ）を、簡潔に
文書の文体・章立てを保ち、大きく書き換えない。直した箇所の一覧を、レポートに書く。

- [ ] **Step 2: `README.md` を整える**

現状の README を読んで、次を満たす（既存の内容は、正しければ残す）:
- 冒頭に、ゲームの説明と、遊び方（操作：ソロ・2人・スマホ）
- 全 7 ステージ + エンドレス（通常・ハード）+ 日記の説明
- ルール（体当たり・敵の弾・盾・回復の隕石・上限 5 体）が最新
- 「ローカルでの動かし方」（`npm run serve`、テスト `npm test`、機械チェック `npm run check`）
- 「公開」の節：`docs/DEPLOY.md` への案内
- 「ディレクトリ構成」の簡単な表（`js/core`、`js/game`、`js/render`、`js/scenes`、`js/data`、`tests`、`tools`、`docs`）
- 「準備中」「未実装」の記述が残っていないこと

- [ ] **Step 3: GitHub Pages のワークフローと手順**

`.github/workflows/pages.yml`（`master` への push と手動実行で、テストとチェックを走らせて、GitHub Pages にデプロイする）:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [master]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npm test
      - run: node tools/check.mjs

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - name: Assemble site
        run: |
          mkdir _site
          cp -r index.html css js _site/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
```
`docs/DEPLOY.md`：GitHub に公開する手順（ユーザーが行う）。次を含める:
1. GitHub でリポジトリを作る（空のまま）
2. `git remote add origin <URL>` → `git push -u origin master`
3. リポジトリの Settings → Pages → Source を「GitHub Actions」にする
4. push で、ワークフローが走り、公開される（URL は Actions の結果に出る）
5. 公開前のチェックリスト：`npm test`、`npm run check`、ブラウザで 1 面〜7 面とエンドレス・日記を通して遊ぶ、スマホ（タッチ操作）で確認する、Google Fonts の読み込み（外部）についての注意
6. 公開しないもの：`docs/`、`tests/`、`tools/`、`.superpowers/` は、`_site` にコピーしない（ワークフローの `cp` の対象に入っていない）

- [ ] **Step 4: チェック**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK
ワークフローの YAML が構文として正しいこと（`node -e` で、簡単な検査：インデントの崩れ、`${{ }}` の対応）を、目で確認して、レポートに書く。

- [ ] **Step 5: コミット**

```bash
git add docs/concept.md README.md docs/DEPLOY.md .github/workflows/pages.yml
git commit -m "docs: update concept and README to match the implementation; add GitHub Pages workflow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
