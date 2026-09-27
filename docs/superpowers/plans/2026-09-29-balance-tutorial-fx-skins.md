# エンドレス調整・チュートリアル・演出強化・スキン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** エンドレスのボス強化を、3段階・最終15回で上限のある形に作り直す。ボスCの偽像をボスと同じ色にして、レーダーだけ見分けられるようにする。タイトルに、初回強制のチュートリアルと、いつでも見られる「遊び方」を作る。リザルト・タイトルの演出を強化する。前作にあったスキン（見た目）変更機能を作る。

**Architecture:** 既存のシーン構成（`js/scenes/*.js`、`js/main.js` の `IDS`・`app.scenes`）に、新しいシーン（`howto`、`skin`）を1つずつ追加する。スキンはデータ（`js/data/skins.js`）として持ち、`drawTurret` に渡す引数を1つ増やすだけで反映する。エンドレスのボス強化は `js/game/endless.js` の式を差し替える。

**Tech Stack:** 素のJavaScript（ES2022、ES Modules）、Canvas 2D、DOM、Node 24（`node --test`）。外部依存なし。

**Spec:** このファイルの各タスクに書く。ユーザーは長期間不在で、確認は取れない。判断が要る点は、下の「判断（Ruling）」に決めてあり、実装者はそれに従う。迷ったら、その場で決めて、レポートの「判断」に書く。

## 判断（Ruling）

| # | 判断 | 理由 |
| --- | --- | --- |
| R1 | エンドレスのボス強化は、5回の撃破ごとに1段階（tier）、tierは0〜3の4段階（初期・1段階目・2段階目・3段階目）。撃破数が15回以上になったら、tierは3で止まる（上限） | ユーザーの指示（「15%を5回で…3段階…最終的に15回で上限」）どおり |
| R2 | ハードエンドレスは、開始時点で tier1 から始まる（`startLevel` を 3 → 5 に変える。5回撃破した扱いにすると、`floor(5/5)=1` で tier1 になる） | 旧仕様「ハードはレベル3から」の「最初から少し強い」という意図を、新しいtier制でも保つための判断 |
| R3 | 偽像はボスCの色（`boss.color`）と完全に同じ見た目にする。レーダーの点だけ、偽像は別の色（`rgba(200,140,255,…)`、紫系）にする | ユーザーの指示どおり。本体との見分けは、メイン画面ではつけない（ゲーム性のため）、レーダーでだけ確認できるようにする |
| R4 | チュートリアルは、セーブに `tutorialSeen` が無い（＝初回）ときだけ、タイトルより先に強制で開く。閉じる操作をした時点で `tutorialSeen = true` を保存する（表示した瞬間ではなく、閉じたときに保存する） | 「最初に強制的に表示」という指示どおり。表示中にリロードされたら、もう一度出るくらいで十分（厳格にする必要はない） |
| R5 | スキンは5種類、色（体・ほお）だけを変える（アクセサリーは前作にあったが、今回は作らない。将来の拡張はしやすい形にする） | 実装量を抑えつつ、機能の本体（選ぶ・反映される・解放条件）を満たすため |
| R6 | スキンの解放条件は、「最初から」「1面クリア」「全7面クリア」「通常エンドレスのスコア」「ハードエンドレスのスコア」の5種類に対応させる | 既存のセーブ（`stages`・`endless`）だけで判定できる範囲で、進行のいろいろな段階に応じた解放にする |
| R7 | リザルトのカウントアップ・タイトルの演出は、既存の `effects.js`（パーティクル・ポップアップ）と、CSSのアニメーションだけで作る。新しい描画の仕組みは増やさない | 既存の道具立てで足りる。過剰実装を避ける |
| R8 | 完了後の `master` へのローカルマージまで行う | これまでのユーザーの選択と同じ |

## Global Constraints

- ビルドツール・npm依存を追加しない。GitHub Pagesに静的ファイルとしてそのまま置ける構成を保つ
- `js/game/` と `js/core/` は、モジュール読み込み時点で DOM・canvas・`window` に触れない。`js/render/` はDOM操作以外は今までと同じでよい（Canvas 2D API のみ）
- UIの文言は日本語。キャラクター・敵は図形で描く。AI生成の画像・動画は使わない
- 既存の挙動（1〜7面、被弾ルール、上限5体、盾3発、回復の隕石、エンドレスの途中終了の確認画面など）を変えない（ボスの強化式だけ、この計画で変える）
- コミットメッセージの末尾に、次の1行を付ける（一字一句そのまま）：`Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。コミットの作成者はリポジトリのローカル設定のまま変えない。`git add` は、パスを指定して行う
- 各タスクの最後に `node tools/check.mjs` と `npm test` が通ること（出力にwarningが出ないこと）。ベースラインは314件
- ブランチは `feat/balance-tutorial-fx-skins`（作成済み）。全タスクをこの上に積む
- 新しいDOM要素を追加するときは、`index.html` に書いたIDと、`js/main.js` の `IDS` 配列の両方に、同じ名前で入れる（片方だけだと起動時に壊れる）

---

### Task 1: エンドレスのボス強化を3段階・15回で上限に。ボスCの偽像の色をボスに合わせる

**Files:**
- Modify: `js/game/endless.js`、`js/game/boss-c.js`、`js/render/entities.js`、`js/render/radar.js`
- Test: `tests/endless.test.mjs`（既存の強化のテストを差し替える）、`tests/boss-c.test.mjs`（追記）

**Interfaces:**
- Produces:
  - `js/game/endless.js`：`endlessTier(L)`（`L`→`Math.min(3, Math.floor(L / 5))`。`export`する）。`endlessBossParams(type, L)` は内部でこの `tier` を使う（返す値の形は変えない）。`CONFIGS.hard.startLevel` を `5` にする
  - `js/game/boss-c.js`：`layout(boss, state)` の中で作る偽像に `color: boss.color` を渡す
  - `js/render/entities.js`：`drawDecoy` は、`style !== 'bossD'` のとき `e.color ?? COLORS.bossC` を使う（今は固定で `COLORS.bossC`）
  - `js/render/radar.js`：`COLORS_DECOY = 'rgba(200,140,255,'`（偽像専用の色）。`drawRadar` の中で、偽像は `bossDot` ではなく、この色を使う新しい描き方にする（大きさ・位置は `bossDot` と同じ半径7のまま）

- [ ] **Step 1: 失敗するテストを書く**

`tests/endless.test.mjs` の中の、既存の「ボスの強さ：レベル0は基準値、レベルが上がると強く・速くなり、上限・下限で止まる」というテストを、次に**置き換える**（このテストの前後にある、他のテスト・importはそのまま）:
```js
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
    assert.deepEqual(byTier.map((p) => p.hp), endlessBossParams(type, 999) && byTier.map((p) => p.hp)); // 参考：上限を超えても変わらない
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
```
（ファイルの先頭の import に `endlessTier` を足す：`import { createEndlessStage, endlessPool, endlessEvery, speedMult, endlessBossParams, endlessTier } from '../js/game/endless.js';`）

`tests/boss-c.test.mjs` の末尾に追記する（既存の import・`mkState`・`toIdle` を使う）:
```js

test('偽像は、本体（ボス）と同じ色で作られる', () => {
  const s = mkState();
  const b = createBoss('bossC', { color: '#ff9fd0' });
  toIdle(b, s);
  const decoys = s.enemies.filter((e) => e.type === 'decoy' && !e.dead);
  assert.ok(decoys.length > 0);
  for (const d of decoys) assert.equal(d.color, '#ff9fd0');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/endless.test.mjs tests/boss-c.test.mjs`
Expected: FAIL（`endlessTier` が無い、色が渡っていない）

- [ ] **Step 3: 実装する**

`js/game/endless.js`：

1. `CONFIGS` の `hard` の `startLevel` を `5` に変える:
```js
  hard:   { startLevel: 5, base: 1.8, decay: 0.88, floor: 0.7, bossEvery: 60 },
```

2. `endlessBossParams` の直前に追加する:
```js
// 5回の撃破ごとに1段階（tier）。0（初期）〜3（3段階目）で止まる（最終的に15回で上限）
export function endlessTier(L) {
  return Math.min(3, Math.floor(L / 5));
}
```

3. `endlessBossParams` を、次に**全面的に置き換える**:
```js
// ボスの強さ。tier（0〜3）が上がるほど、体力が+15%刻みで増え、識別攻撃の数・頻度が少しだけ上がる
export function endlessBossParams(type, L) {
  const tier = endlessTier(L);
  const hpk = 1 + 0.15 * tier;
  switch (type) {
    case 'bossA': return {
      hp: Math.round(BOSS_A_BASE.hp * hpk),
      summonCount: BOSS_A_BASE.summonCount + tier,
      summonInterval: BOSS_A_BASE.summonInterval * Math.pow(0.95, tier),
      shotInterval: BOSS_A_BASE.shotInterval * Math.pow(0.95, tier),
      shotBurst: BOSS_A_BASE.shotBurst + Math.floor(tier / 2),
    };
    case 'bossB': return {
      hp: Math.round(BOSS_B_BASE.hp * hpk),
      dashInterval: BOSS_B_BASE.dashInterval * Math.pow(0.95, tier),
      dashCount: BOSS_B_BASE.dashCount + Math.floor(tier / 2),
      dashTime: BOSS_B_BASE.dashTime * Math.pow(0.97, tier),
      scatterInterval: BOSS_B_BASE.scatterInterval * Math.pow(0.95, tier),
      scatterCount: BOSS_B_BASE.scatterCount + tier,
    };
    case 'bossC': return {
      hp: Math.round(BOSS_C_BASE.hp * hpk),
      decoyCount: BOSS_C_BASE.decoyCount + Math.min(2, tier),
      swapInterval: BOSS_C_BASE.swapInterval * Math.pow(0.95, tier),
      shieldInterval: BOSS_C_BASE.shieldInterval * Math.pow(0.95, tier),
      jamInterval: BOSS_C_BASE.jamInterval * Math.pow(0.95, tier),
    };
    default: throw new Error(`unknown endless boss type: ${type}`);
  }
}
```
（`decoyCount` は `BOSS_C_BASE.decoyCount`(2) + `min(2, tier)` なので、tier0=2, tier1=3, tier2=4, tier3=4 で止まる。これで `n`（本体+偽像）は最大5体、`(5-1)×minSep(30)=120 ≤ layoutRange(70)×2=140` に収まり、詰まらない）

`js/game/boss-c.js`：`layout` の中の、偽像を作る行を置き換える:
```js
    const d = createEnemy('decoy', a, state.rng, { dist: p.dist, color: boss.color });
```

`js/render/entities.js`：`drawDecoy` を置き換える:
```js
function drawDecoy(g, e, x, y, time, swapBlink) {
  g.save();
  g.translate(x, y);
  if (e.style === 'bossD') drawBossDBody(g, e.radius, e.color ?? COLORS.bossD, time);
  else drawBossCBody(g, e.radius, e.color ?? COLORS.bossC, time, { swapBlink });
  g.restore();
}
```

`js/render/radar.js`：
1. `bossDot` の直後に追加する:
```js
// 偽像はボスと同じ色で描かれるので、レーダーでは別の色にして見分けられるようにする（大きさは同じ）
function decoyDot(g, e, inFov) {
  const p = radarPoint(e.angle, e.dist);
  g.fillStyle = inFov ? 'rgba(200,140,255,1)' : 'rgba(200,140,255,0.6)';
  g.beginPath();
  g.arc(p.x, p.y, 7, 0, Math.PI * 2);
  g.fill();
}
```
2. `drawRadar` の中の `if (e.type === 'decoy') { bossDot(g, e, inView(e.angle)); continue; }` を `if (e.type === 'decoy') { decoyDot(g, e, inView(e.angle)); continue; }` に変える。

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS。エンドレスの長時間シミュレーションのテスト（既存）が、新しい強化式でも壊れないことを確認する。壊れる場合は、意図を変えずに、そのテストの期待値・待ち時間だけ、新しい式に合わせて直す（値そのものは変えない）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 5: Nodeで描画の動作確認をする（コミットしない）**

スクラッチに、`Proxy` で作った2Dコンテキストのスタブで、`drawDecoy`（`e.color` あり／なし）、`drawRadar`（`state.enemies` に `decoy` を含む状態）を呼び、例外が出ないことと、`decoyDot` が `bossDot` と別の `fillStyle` を使うことを確認して、レポートに書く。

- [ ] **Step 6: コミット**

```bash
git add js/game/endless.js js/game/boss-c.js js/render/entities.js js/render/radar.js tests/endless.test.mjs tests/boss-c.test.mjs
git commit -m "feat: cap endless boss scaling at 3 tiers (15 kills), match decoy color to boss, distinguish on radar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: チュートリアル・遊び方画面

**Files:**
- Create: `js/scenes/howto.js`
- Modify: `index.html`、`js/main.js`、`js/scenes/title.js`、`js/core/save.js`、`css/style.css`
- Test: `tests/save.test.mjs`（追記）

**Interfaces:**
- Consumes: なし
- Produces:
  - `save.tutorialSeen`（boolean、既定 `false`）
  - `js/scenes/howto.js`：`createHowtoScene(app)`。シーン `howto`。`enter(params)` の `params.forced`（boolean、既定 `false`）で、最後のページのボタンの文言を変える
  - DOM：`howtoScreen`、`howtoTitle`、`howtoBody`、`howtoPage`、`howtoPrevBtn`、`howtoNextBtn`、`titleHowtoBtn`

- [ ] **Step 1: 失敗するテストを書く**

`tests/save.test.mjs` の末尾に追記する（既存の `loadSave`/`writeSave` の import・メモリのストレージの作り方を使う）:
```js

test('tutorialSeen：既定は false。保存・読み込みで保たれ、v1からの移行でも false になる', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.equal(fresh.tutorialSeen, false);
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.tutorialSeen = true;
  writeSave(data, storage);
  assert.equal(loadSave(storage).tutorialSeen, true);
  const v1 = { getItem: () => JSON.stringify({ version: 1, settings: {} }), setItem() {} };
  assert.equal(loadSave(v1).tutorialSeen, false);
  const oldV2 = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {} }), setItem() {} }; // tutorialSeen の欄が無い古いセーブ
  assert.equal(loadSave(oldV2).tutorialSeen, false);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/save.test.mjs`
Expected: FAIL

- [ ] **Step 3: 実装する**

`js/core/save.js`：
1. `defaults()` の返す値に `tutorialSeen: false,` を足す。
2. `loadSave` の中の、v1移行の返す値と、v2の返す値の両方に `tutorialSeen: d.tutorialSeen === true,` を足す（v1には元から無いので `false` になる。v2は、その保存に無ければ `undefined === true` で `false`）。

`index.html`：タイトルの `.btn-col` に、`titleDiaryBtn` の前に「遊び方」ボタンを足す:
```html
      <button class="btn btn-sub" id="titleHowtoBtn">遊び方</button>
```
（`titleDiaryBtn` の直前に置く）

タイトルの `<div id="titleScreen" ...>` の直後（`stageSelectScreen` の前）に、遊び方の画面を足す:
```html
  <div id="howtoScreen" class="overlay hidden">
    <h2 id="howtoTitle"></h2>
    <p id="howtoBody" class="howto-body"></p>
    <p id="howtoPage" class="howto-page"></p>
    <div class="btn-col">
      <div class="howto-nav-row">
        <button class="link-btn" id="howtoPrevBtn">◀ もどる</button>
        <button class="btn" id="howtoNextBtn">つづき ▶</button>
      </div>
    </div>
  </div>
```

`js/main.js`：
1. `import { createHowtoScene } from './scenes/howto.js';` を足す。
2. `IDS` に `'titleHowtoBtn',` を（`titleDiaryBtn` の並びに）、`'howtoScreen', 'howtoTitle', 'howtoBody', 'howtoPage', 'howtoPrevBtn', 'howtoNextBtn',` を足す。
3. `app.scenes.howto = createHowtoScene(app);` を足す（`app.scenes.diary = createDiaryScene(app);` の次）。
4. ファイル末尾の `setScene('title');` を、次に置き換える:
```js
if (!save.tutorialSeen) setScene('howto', { forced: true });
else setScene('title');
```

`js/scenes/howto.js`（新規）:
```js
import { drawBackground } from '../render/background.js';

// 遊び方（タイトルの「遊び方」から、いつでも見られる。初回はタイトルより先に強制で開く）
const SLIDES = [
  {
    title: '守るのは、中心の砲台',
    body: '砲台は画面の中心に固定されています。旋回して狙う方向を変え、視界（明るい範囲）に入った敵だけを狙って撃ちます。',
  },
  {
    title: '操作',
    body: 'PC：A/D・←→ キーで旋回、マウスで狙ってクリック（長押しで連射）。\nふたりで：1P が旋回、2P がマウスで発射。\nスマホ：画面下の◀▶で旋回、タップで発射。',
  },
  {
    title: '体力とスコア',
    body: '敵の体当たりを受けると、体力が1減ります。敵の弾（直進弾・破片）は、体力ではなくスコアを減らします。盾を張る敵は、3発当てると盾が壊れます。体力が減っていると、緑色の「回復の隕石」が現れます。',
  },
  {
    title: 'ステージとパワーアップ',
    body: '全7ステージのほか、時間とともに難しくなる「エンドレス」（通常・ハード）があります。10体倒すごとに、パワーアップを2択で選べます。',
  },
  {
    title: 'その他',
    body: '画面上のミニマップには、視界の外の敵も点で映ります。ステージをクリアすると日記が読めます。タイトルの「見た目」から、砲台の見た目（スキン）を変えられます。',
  },
];

export function createHowtoScene(app) {
  const { dom } = app;
  let index = 0;
  let forced = false;

  function render() {
    const slide = SLIDES[index];
    dom.howtoTitle.textContent = slide.title;
    dom.howtoBody.textContent = slide.body;
    dom.howtoPage.textContent = `${index + 1} / ${SLIDES.length}`;
    dom.howtoPrevBtn.disabled = index === 0;
    const isLast = index === SLIDES.length - 1;
    dom.howtoNextBtn.textContent = isLast ? (forced ? 'はじめる！' : 'とじる') : 'つづき ▶';
  }

  dom.howtoPrevBtn.addEventListener('click', () => {
    if (index > 0) { index -= 1; render(); }
  });
  dom.howtoNextBtn.addEventListener('click', () => {
    if (index < SLIDES.length - 1) { index += 1; render(); return; }
    app.save.tutorialSeen = true;
    app.persist();
    app.setScene('title');
  });

  return {
    enter(params = {}) {
      forced = params.forced === true;
      index = 0;
      render();
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.howtoScreen.classList.remove('hidden');
    },
    exit() {
      dom.howtoScreen.classList.add('hidden');
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

`js/scenes/title.js`：`dom.titleDiaryBtn.addEventListener(...)` の前に追加する:
```js
  dom.titleHowtoBtn.addEventListener('click', () => app.setScene('howto', { forced: false }));
```

`css/style.css`：既存の `.diary-text` の定義のあたりに追加する:
```css
.howto-body { max-width: 520px; min-height: 6em; padding: 14px 18px; border-radius: 14px; background: rgba(10, 14, 39, 0.75); white-space: pre-line; line-height: 1.8; text-align: left; }
.howto-page { color: var(--text-dim); margin: 0; }
.howto-nav-row { display: flex; gap: 16px; align-items: center; }
```

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK
`grep -n "dom\.howto\|dom\.titleHowtoBtn" js/scenes/*.js` と `index.html`・`js/main.js` の `IDS` を見比べて、名前が全て一致していることを確認する（1つでも欠けると起動できない）。レポートに、確認した結果を書く。

- [ ] **Step 5: コミット**

```bash
git add js/scenes/howto.js index.html js/main.js js/scenes/title.js js/core/save.js css/style.css tests/save.test.mjs
git commit -m "feat: add a how-to-play screen, forced on first launch and reachable from the title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: リザルト・タイトルの演出強化

**Files:**
- Modify: `js/scenes/result.js`、`js/scenes/title.js`、`css/style.css`
- Test: なし（DOM・時間に依存する演出のため、目視確認をレポートに書く）

**Interfaces:**
- Consumes: `createEffects`、`spawnBurst`、`updateEffects`（`js/game/effects.js`）、`drawEffects`（`js/render/entities.js`）
- Produces: `result` シーンに、スコア・撃破数のカウントアップと、更新時の演出（パーティクル＋CSSアニメーション）。`title` シーンに、これまでの記録を1行で示す表示

- [ ] **Step 1: 実装する（テストは無いので、直接実装する）**

`js/scenes/result.js` を、次のように直す。

1. import に足す:
```js
import { createEffects, spawnBurst, updateEffects } from '../game/effects.js';
import { drawEffects, drawBoss } from '../render/entities.js';
import { CONFIG } from '../core/config.js';
```
（`drawBoss` は使わない。パーティクルの色に、既存の `COLORS` は使わないので `drawEffects` だけで足りる。上のimportから `drawBoss` は外してよい）

2. `createResultScene(app)` の先頭（`let last = …` の次）に追加する:
```js
  let fx = createEffects();
  let countUp = { score: 0, kills: 0, targetScore: 0, targetKills: 0, t: 0 };
  const COUNT_TIME = 1.0; // 秒。カウントアップにかける時間
```

3. `enter(...)` の中の、`dom.resultScore.textContent = score.toLocaleString();` と `dom.resultKills.textContent = kills.toLocaleString();` の2行を削除して、代わりに次を、`dom.resultNewBest.classList.toggle(...)` の直前に追加する:
```js
      fx = createEffects();
      countUp = { score: 0, kills: 0, targetScore: score, targetKills: kills, t: 0 };
      dom.resultScore.textContent = '0';
      dom.resultKills.textContent = '0';
      dom.resultNewBest.classList.remove('celebrate');
      if (newBest) {
        // 更新した瞬間を、少し遅らせて祝う（カウントアップが終わる頃に）
        setTimeout(() => {
          if (dom.resultScreen.classList.contains('hidden')) return; // 既に結果画面を離れていたら何もしない
          dom.resultNewBest.classList.add('celebrate');
          spawnBurst(fx, CONFIG.CENTER_X, CONFIG.CENTER_Y - 120, '#ffd866', 40, Math.random);
          spawnBurst(fx, CONFIG.CENTER_X, CONFIG.CENTER_Y - 120, '#ff9ecb', 24, Math.random);
        }, COUNT_TIME * 1000);
      }
```

4. `update() {}` を、次に置き換える:
```js
    update(dt) {
      countUp.t = Math.min(COUNT_TIME, countUp.t + dt);
      const k = COUNT_TIME > 0 ? countUp.t / COUNT_TIME : 1;
      const ease = 1 - Math.pow(1 - k, 3); // 徐々に減速する
      dom.resultScore.textContent = Math.round(countUp.targetScore * ease).toLocaleString();
      dom.resultKills.textContent = Math.round(countUp.targetKills * ease).toLocaleString();
      updateEffects(fx, dt);
    },
```

5. `render(g, dt)` の中の `drawBackground(...)` の次に `drawEffects(g, fx);` を足す（`vp.virtualSpace(g);` を、その前に呼ぶ必要がある。今の `render` は `vp.screenSpace(g)` のままなので、`drawBackground` の後に `vp.virtualSpace(g); drawEffects(g, fx);` を追加する）。実際の `render` 全体:
```js
    render(g, dt) {
      const vp = app.viewport;
      vp.screenSpace(g);
      drawBackground(g, app.stars, vp.cssW, vp.cssH, dt);
      vp.virtualSpace(g);
      drawEffects(g, fx);
    },
```

6. `exit()` に `dom.resultNewBest.classList.remove('celebrate');` を足す。

`css/style.css`：`.new-best` の定義（検索して見つける）の後に追加する:
```css
.new-best.celebrate { animation: celebrate-pulse 0.9s ease-in-out 2; }
@keyframes celebrate-pulse {
  0%, 100% { transform: scale(1); text-shadow: 0 0 0 rgba(255, 216, 102, 0); }
  50% { transform: scale(1.15); text-shadow: 0 0 18px rgba(255, 216, 102, 0.9); }
}
```

`js/scenes/title.js` に、これまでの記録を示す1行を足す。
1. `index.html` のタイトルの `<p class="tagline">...</p>` の直後に足す:
```html
    <p id="titleProgress" class="title-progress"></p>
```
`js/main.js` の `IDS` に `'titleProgress',` を足す。

2. `js/scenes/title.js` に、`import { CONFIG } from '../core/config.js';` を足し、`enter()` の中の `dom.titleScreen.classList.remove('hidden');` の直前に追加する:
```js
      dom.titleProgress.textContent = progressLine(app.save);
```
そして、ファイル内に（`createTitleScene` の外に）関数を追加する:
```js
// これまでの記録を、短い1行にまとめる（実績が無ければ、その旨を出す）
function progressLine(save) {
  const cleared = Object.values(save.stages ?? {}).filter((s) => s.cleared).length;
  const parts = [];
  if (cleared > 0) parts.push(`ステージ ${cleared}/${CONFIG.STAGE_COUNT} クリア`);
  const normalBest = save.endless?.normal?.best ?? 0;
  if (normalBest > 0) parts.push(`通常エンドレス 最高 ${normalBest.toLocaleString()}`);
  const hardBest = save.endless?.hard?.best ?? 0;
  if (hardBest > 0) parts.push(`ハード 最高 ${hardBest.toLocaleString()}`);
  return parts.length > 0 ? `これまでの記録：${parts.join('　')}` : '';
}
```

`css/style.css`：`.tagline` の定義の後に追加する:
```css
.title-progress { color: var(--star-gold); font-size: 0.9rem; margin: -8px 0 12px; min-height: 1.2em; }
```

- [ ] **Step 2: チェックを実行する**

Run: `npm test` → Expected: 全PASS（このタスクはテストを追加しないので、既存のテストが通ることだけ確認する）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 3: Nodeで動作確認する（コミットしない）**

スクラッチのスクリプトで、`progressLine({ stages: {}, endless: { normal: { best: 0 }, hard: { best: 0 } } })` が空文字になること、記録がある場合は文言が入ることを確認する。また、`createEffects`・`spawnBurst`・`updateEffects` を呼んで例外が出ないことを確認する。結果をレポートに書く。

- [ ] **Step 4: コミット**

```bash
git add js/scenes/result.js js/scenes/title.js index.html js/main.js css/style.css
git commit -m "feat: add count-up and celebration effects to the result screen, a progress line on the title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（このタスクのコミット後）：** ステージをクリアして結果画面のカウントアップと、最高スコア更新時の演出を見る。タイトルに戻って記録の行が出ることを見る。

---

### Task 4: スキン（見た目）機能

**Files:**
- Create: `js/data/skins.js`
- Modify: `js/render/entities.js`（`drawTurret`）、`js/render/playfield.js`、`js/scenes/play.js`、`js/scenes/title.js`、`js/core/save.js`、`index.html`、`js/main.js`、`css/style.css`
- Test: `tests/skins.test.mjs`（新規）、`tests/save.test.mjs`（追記）

**Interfaces:**
- Consumes: `isHardEndlessUnlocked`（`js/core/progress.js`）
- Produces:
  - `js/data/skins.js`：`SKINS`（凍結した配列、5件、`{ id, name, desc, body, cheek, unlock }`）、`isSkinUnlocked(save, skin)`、`getSkin(save, id)`（未解放・存在しないIDなら既定を返す）、`selectedSkin(save)`（`getSkin(save, save.selectedSkinId)`）
  - `save.selectedSkinId`（文字列、既定 `'default'`）
  - `drawTurret(g, turret, time, skin)`：第4引数（省略可）。`skin` があれば、体・ほおの色に使う
  - `js/render/playfield.js`：`drawPlayfield(g, vp, stars, state, fx, dt, skin)`（第7引数、省略可）
  - シーン `skin`：`js/scenes/skin.js`（このタスクで作る）
  - DOM：`titleSkinBtn`、`skinScreen`、`skinList`、`skinPreviewCanvas`、`skinPreviewName`、`skinPreviewDesc`、`skinSelectBtn`、`skinBackBtn`

- [ ] **Step 1: 失敗するテストを書く**

`tests/skins.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKINS, isSkinUnlocked, getSkin, selectedSkin } from '../js/data/skins.js';

const mkSave = (over = {}) => ({ stages: {}, endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 } }, selectedSkinId: 'default', ...over });

test('SKINS：5件。1件目は既定（unlock.type=="default"）で、色を持つ。凍結されている', () => {
  assert.equal(SKINS.length, 5);
  assert.equal(Object.isFrozen(SKINS), true);
  const def = SKINS[0];
  assert.equal(def.unlock.type, 'default');
  for (const s of SKINS) {
    assert.ok(typeof s.id === 'string' && s.id.length > 0);
    assert.ok(typeof s.name === 'string' && s.name.length > 0);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.body), s.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(s.cheek), s.id);
  }
  // 5種類の解放条件が、それぞれ1つ以上ある
  const types = new Set(SKINS.map((s) => s.unlock.type));
  for (const t of ['default', 'stageClear', 'allClear', 'score']) assert.ok(types.has(t), t);
});

test('isSkinUnlocked：既定は常に解放。stageClear・allClear・score の判定', () => {
  const def = SKINS.find((s) => s.unlock.type === 'default');
  assert.equal(isSkinUnlocked(mkSave(), def), true);

  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  const n = stageSkin.unlock.stage;
  assert.equal(isSkinUnlocked(mkSave(), stageSkin), false);
  assert.equal(isSkinUnlocked(mkSave({ stages: { [n]: { cleared: true, best: 1 } } }), stageSkin), true);

  const allSkin = SKINS.find((s) => s.unlock.type === 'allClear');
  const notAll = mkSave({ stages: { 1: { cleared: true, best: 1 }, 2: { cleared: true, best: 1 } } });
  assert.equal(isSkinUnlocked(notAll, allSkin), false);
  const all = mkSave({ stages: Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { cleared: true, best: 1 }])) });
  assert.equal(isSkinUnlocked(all, allSkin), true);

  const scoreSkins = SKINS.filter((s) => s.unlock.type === 'score');
  assert.ok(scoreSkins.length >= 2, '通常・ハード、それぞれのスコアで解放するものがある');
  for (const s of scoreSkins) {
    const kind = s.unlock.mode; // 'normal' | 'hard'
    assert.ok(kind === 'normal' || kind === 'hard');
    const below = mkSave({ endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 }, [kind]: { best: s.unlock.value - 1, time: 0 } } });
    const above = mkSave({ endless: { normal: { best: 0, time: 0 }, hard: { best: 0, time: 0 }, [kind]: { best: s.unlock.value, time: 0 } } });
    assert.equal(isSkinUnlocked(below, s), false, s.id);
    assert.equal(isSkinUnlocked(above, s), true, s.id);
  }
});

test('getSkin：未解放・存在しないIDなら既定を返す。解放済みならそのスキンを返す', () => {
  const save = mkSave();
  assert.equal(getSkin(save, 'no-such-id').unlock.type, 'default');
  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  assert.equal(getSkin(save, stageSkin.id).unlock.type, 'default'); // まだ未解放
  const unlocked = mkSave({ stages: { [stageSkin.unlock.stage]: { cleared: true, best: 1 } } });
  assert.equal(getSkin(unlocked, stageSkin.id).id, stageSkin.id);
});

test('selectedSkin：save.selectedSkinId から求める', () => {
  const stageSkin = SKINS.find((s) => s.unlock.type === 'stageClear');
  const save = mkSave({ selectedSkinId: stageSkin.id, stages: { [stageSkin.unlock.stage]: { cleared: true, best: 1 } } });
  assert.equal(selectedSkin(save).id, stageSkin.id);
});
```

`tests/save.test.mjs` の末尾に追記する:
```js

test('selectedSkinId：既定は "default"。保存・読み込みで保たれ、壊れた値は既定に戻る', () => {
  const fresh = loadSave({ getItem: () => null, setItem() {} });
  assert.equal(fresh.selectedSkinId, 'default');
  const mem = {};
  const storage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
  const data = loadSave(storage);
  data.selectedSkinId = 'stage1';
  writeSave(data, storage);
  assert.equal(loadSave(storage).selectedSkinId, 'stage1');
  const broken = { getItem: () => JSON.stringify({ version: 2, settings: {}, stages: {}, selectedSkinId: 123 }), setItem() {} };
  assert.equal(loadSave(broken).selectedSkinId, 'default');
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test tests/skins.test.mjs tests/save.test.mjs`
Expected: FAIL（`js/data/skins.js` が無い）

- [ ] **Step 3: 実装する**

`js/data/skins.js`:
```js
import { isHardEndlessUnlocked } from '../core/progress.js';

// 砲台の見た目（体・ほおの色だけを変える）。前作の「スキン」機能を、この作品向けに簡略化したもの。
export const SKINS = Object.freeze([
  Object.freeze({
    id: 'default', name: '既定', desc: '最初から使える、いつもの見た目。',
    body: '#bfe6ff', cheek: '#ffc2d1', unlock: Object.freeze({ type: 'default' }),
  }),
  Object.freeze({
    id: 'stage1', name: '夜明けカラー', desc: '1面をクリアすると使える。',
    body: '#ffd9a0', cheek: '#ffb3c6', unlock: Object.freeze({ type: 'stageClear', stage: 1 }),
  }),
  Object.freeze({
    id: 'allclear', name: '迎撃仕様', desc: '全7面をクリアすると使える。',
    body: '#ffe27a', cheek: '#ff9ecb', unlock: Object.freeze({ type: 'allClear' }),
  }),
  Object.freeze({
    id: 'endless-normal', name: '耐久カラー', desc: '通常エンドレスで3,000点以上を取ると使える。',
    body: '#8fe3c0', cheek: '#ffe0a3', unlock: Object.freeze({ type: 'score', mode: 'normal', value: 3000 }),
  }),
  Object.freeze({
    id: 'endless-hard', name: '最終防衛仕様', desc: 'ハードエンドレスで1,000点以上を取ると使える。',
    body: '#2b2f52', cheek: '#ff6b81', unlock: Object.freeze({ type: 'score', mode: 'hard', value: 1000 }),
  }),
]);

export function isSkinUnlocked(save, skin) {
  const u = skin.unlock;
  switch (u.type) {
    case 'default': return true;
    case 'stageClear': return save.stages?.[u.stage]?.cleared === true;
    case 'allClear': return isHardEndlessUnlocked(save); // 「全ステージクリア」の判定を再利用
    case 'score': return (save.endless?.[u.mode]?.best ?? 0) >= u.value;
    default: return false;
  }
}

export function getSkin(save, id) {
  const found = SKINS.find((s) => s.id === id);
  return found && isSkinUnlocked(save, found) ? found : SKINS[0];
}

export function selectedSkin(save) {
  return getSkin(save, save.selectedSkinId);
}
```

`js/core/save.js`：
1. `defaults()` の返す値に `selectedSkinId: 'default',` を足す。
2. `loadSave` の v1・v2の返す値に `selectedSkinId: typeof d.selectedSkinId === 'string' ? d.selectedSkinId : 'default',` を足す（v1にはそもそも無いので `'default'` になる）。

`js/render/entities.js`：`drawTurret` の関数のシグネチャと、色の参照を変える:
```js
export function drawTurret(g, turret, time, skin = null) {
  if (turret.invincible > 0 && Math.floor(time * 12) % 2 === 0) return; // 無敵中は点滅
  const bodyColor = skin?.body ?? COLORS.turret;
  const cheekColor = skin?.cheek ?? COLORS.cheek;
  g.save();
  g.translate(CONFIG.CENTER_X, CONFIG.CENTER_Y);

  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 70);
  glow.addColorStop(0, 'rgba(191,230,255,0.35)');
  glow.addColorStop(1, 'rgba(191,230,255,0)');
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.fill();

  for (const fx of [-16, 16]) ellipse(g, fx, 24, 9, 6, lightenColor(bodyColor, -0.25)); // 足
  g.fillStyle = COLORS.barrel; // 砲身（常に真上）
  g.beginPath();
  roundRectPath(g, -7, -48, 14, 30, 6);
  g.fill();
  ellipse(g, 0, 0, 30, 27, bodyColor);                         // 体
  ellipse(g, 0, 6, 18, 13, lightenColor(bodyColor, 0.5));      // おなか
  for (const ex of [-10, 10]) ellipse(g, ex, -5, 3.5, 5, COLORS.eye);
  for (const ex of [-9, 11]) ellipse(g, ex, -7, 1.4, 1.4, '#ffffff');
  for (const cx of [-18, 18]) ellipse(g, cx, 3, 5, 3, cheekColor);
  g.restore();
}
```
（元の関数の中身と1文ずつ見比べて、`COLORS.turret` → `bodyColor`、`COLORS.cheek` → `cheekColor` に変える。他の行（`COLORS.barrel`、`COLORS.eye`、白目、座標、大きさ）は変えない）

`js/render/playfield.js`：`drawPlayfield` のシグネチャと呼び出しを変える:
```js
export function drawPlayfield(g, vp, stars, state, fx, dt, skin) {
```
（関数の中の `drawTurret(g, t, state.time);` を `drawTurret(g, t, state.time, skin);` に変える。他は変えない）

`js/scenes/play.js`：
1. `import { selectedSkin } from '../game/skins.js';` ではなく、正しいパス `import { selectedSkin } from '../data/skins.js';` を足す。
2. `render(g, dt) { drawPlayfield(g, app.viewport, app.stars, state, fx, dt); }` を `render(g, dt) { drawPlayfield(g, app.viewport, app.stars, state, fx, dt, selectedSkin(app.save)); }` に変える。

`js/scenes/skin.js`（新規）:
```js
import { SKINS, isSkinUnlocked } from '../data/skins.js';
import { CONFIG } from '../core/config.js';
import { drawTurret } from '../render/entities.js';
import { drawBackground } from '../render/background.js';

// 見た目（スキン）を選ぶ画面。小さなプレビューに、実際の drawTurret をそのまま使う。
export function createSkinScene(app) {
  const { dom } = app;
  const ctx = dom.skinPreviewCanvas.getContext('2d');
  let previewId = null;

  function drawPreview(skin) {
    const w = dom.skinPreviewCanvas.width, h = dom.skinPreviewCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    // drawTurret は自前で CONFIG.CENTER_X/Y へ移動するので、それが (w/2, h*0.6) に来るよう合わせる
    ctx.translate(w / 2 - CONFIG.CENTER_X, h * 0.6 - CONFIG.CENTER_Y);
    drawTurret(ctx, { invincible: 0 }, 0, skin);
    ctx.restore();
  }

  function unlockText(skin) {
    const u = skin.unlock;
    if (u.type === 'stageClear') return `${u.stage}面をクリアすると使えます。`;
    if (u.type === 'allClear') return '全7面をクリアすると使えます。';
    if (u.type === 'score') {
      const label = u.mode === 'hard' ? 'ハードエンドレス' : '通常エンドレス';
      return `${label}で ${u.value.toLocaleString()} 点以上を取ると使えます。`;
    }
    return '';
  }

  function select(skin, unlocked) {
    previewId = skin.id;
    for (const btn of dom.skinList.children) btn.classList.toggle('active', btn.dataset.id === skin.id);
    dom.skinPreviewName.textContent = unlocked ? skin.name : `${skin.name}（未解放）`;
    dom.skinPreviewDesc.textContent = unlocked ? skin.desc : unlockText(skin);
    drawPreview(skin);
    const isCurrent = skin.id === app.save.selectedSkinId;
    dom.skinSelectBtn.disabled = !unlocked || isCurrent;
    dom.skinSelectBtn.textContent = isCurrent ? '使用中' : 'これにする';
  }

  function build() {
    dom.skinList.replaceChildren();
    for (const skin of SKINS) {
      const unlocked = isSkinUnlocked(app.save, skin);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-swatch' + (skin.id === app.save.selectedSkinId ? ' active' : '');
      btn.dataset.id = skin.id;
      btn.disabled = !unlocked;
      btn.style.background = skin.body;
      btn.setAttribute('aria-label', unlocked ? skin.name : `${skin.name}（未解放）`);
      btn.addEventListener('click', () => select(skin, unlocked));
      dom.skinList.append(btn);
    }
  }

  dom.skinSelectBtn.addEventListener('click', () => {
    const skin = SKINS.find((s) => s.id === previewId);
    if (!skin || !isSkinUnlocked(app.save, skin)) return;
    app.save.selectedSkinId = skin.id;
    app.persist();
    build();
    select(skin, true);
  });
  dom.skinBackBtn.addEventListener('click', () => app.setScene('title'));

  return {
    enter() {
      build();
      const current = SKINS.find((s) => s.id === app.save.selectedSkinId) ?? SKINS[0];
      select(current, isSkinUnlocked(app.save, current));
      dom.hud.classList.add('hidden');
      dom.hint.classList.add('hidden');
      dom.touchControls.classList.add('hidden');
      dom.skinScreen.classList.remove('hidden');
    },
    exit() {
      dom.skinScreen.classList.add('hidden');
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

`index.html`：
1. タイトルの `.btn-col` に、`titleDiaryBtn` の直後に足す:
```html
      <button class="btn btn-sub" id="titleSkinBtn">見た目</button>
```
2. `diaryScreen` の直後（`settingsScreen` の前）に足す:
```html
  <div id="skinScreen" class="overlay hidden">
    <h2>見た目を選ぶ</h2>
    <div id="skinList" class="skin-list"></div>
    <canvas id="skinPreviewCanvas" width="160" height="170" class="skin-preview-canvas"></canvas>
    <p id="skinPreviewName" class="skin-preview-name"></p>
    <p id="skinPreviewDesc" class="skin-preview-desc"></p>
    <div class="btn-col">
      <button class="btn" id="skinSelectBtn">これにする</button>
      <button class="link-btn" id="skinBackBtn">もどる</button>
    </div>
  </div>
```

`js/main.js`：
1. `import { createSkinScene } from './scenes/skin.js';` を足す。
2. `IDS` に `'titleSkinBtn',`（`titleDiaryBtn` の並び）、`'skinScreen', 'skinList', 'skinPreviewCanvas', 'skinPreviewName', 'skinPreviewDesc', 'skinSelectBtn', 'skinBackBtn',` を足す。
3. `app.scenes.skin = createSkinScene(app);` を足す（`app.scenes.diary = createDiaryScene(app);` の次）。

`js/scenes/title.js`：`dom.titleDiaryBtn.addEventListener(...)` の直後に足す:
```js
  dom.titleSkinBtn.addEventListener('click', () => app.setScene('skin'));
```

`css/style.css`：`.diary-list button.active` の定義の後に追加する:
```css
.skin-list { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 320px; }
.skin-swatch { width: 44px; height: 44px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.25); cursor: pointer; padding: 0; }
.skin-swatch:disabled { opacity: 0.35; cursor: default; }
.skin-swatch.active { border-color: var(--star-gold); box-shadow: 0 0 0 3px rgba(255, 216, 102, 0.35); }
.skin-preview-canvas { background: rgba(255,255,255,0.05); border-radius: 16px; margin: 8px 0; }
.skin-preview-name { font-weight: 800; color: var(--star-gold); margin: 0; }
.skin-preview-desc { font-size: 0.85rem; color: var(--text-dim); max-width: 320px; margin: 0 0 8px; text-align: center; }
```

- [ ] **Step 4: テストとチェックを実行する**

Run: `npm test` → Expected: 全PASS
Run: `node tools/check.mjs` → Expected: 全OK
`grep` で、`dom.skin*`・`dom.titleSkinBtn` が `index.html`・`IDS` の両方にあることを確認する。レポートに書く。

- [ ] **Step 5: Nodeで描画の動作確認をする（コミットしない）**

スクラッチに、`Proxy` で作った2Dコンテキストのスタブで、`drawTurret(g, { invincible: 0 }, 0)`（スキン無し）と `drawTurret(g, { invincible: 0 }, 0, SKINS[1])`（スキンあり）を呼び、例外が出ないこと、`ellipse` 相当の描画呼び出しで使われる色が、スキンの `body`/`cheek` に変わっていることを確認して、レポートに書く（`fillStyle` の履歴を記録するスタブにする）。

- [ ] **Step 6: コミット**

```bash
git add js/data/skins.js js/render/entities.js js/render/playfield.js js/scenes/play.js js/scenes/skin.js js/scenes/title.js js/core/save.js index.html js/main.js css/style.css tests/skins.test.mjs tests/save.test.mjs
git commit -m "feat: add turret skins, unlocked by stage/all-clear/endless score, selectable from the title

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

**コントローラーによるブラウザ確認（このタスクのコミット後）：** タイトルの「見た目」からスキン画面を開き、未解放のスキンが選べないこと、既定のスキンのプレビューが実際の砲台と同じ見た目に見えること、選ぶとプレイ中に反映されることを確認する。

---

### Task 5: ドキュメント同期

**Files:**
- Modify: `docs/concept.md`、`README.md`

**Interfaces:** なし（文書だけ）

- [ ] **Step 1: `docs/concept.md` を直す**

- 「エンドレスモードでの強化」の節を、新しい3段階・15回上限の式に直す（`endlessTier`・tierごとの数値の変わり方）。ハードエンドレスは「tier1から始まる」に直す
- 「ボスC」の節に、「偽像は本体と同じ色。レーダーだけ別の色で見分けられる」を1行足す
- 新しい節、または既存の節に、チュートリアル・遊び方（初回強制、タイトルからいつでも）、スキン（5種・解放条件・タイトルの「見た目」から選べる）、リザルト・タイトルの演出強化（カウントアップ、ハイスコア演出、記録の表示）を、簡潔に追記する
- 既存の文体・章立てを保つ。書き換えは最小限にする

- [ ] **Step 2: `README.md` を直す**

- 全体の機能一覧に、チュートリアル・遊び方、スキン、演出強化を1行ずつ追記する
- 「準備中」「未実装」の記述が残っていないことを確認する

- [ ] **Step 3: チェック**

Run: `npm test` → Expected: 全PASS（文書だけの変更なので、コードのテストへの影響は無いはず）
Run: `node tools/check.mjs` → Expected: 全OK

- [ ] **Step 4: コミット**

```bash
git add docs/concept.md README.md
git commit -m "docs: sync concept and README with the tiered endless bosses, tutorial, skins and result/title effects

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
