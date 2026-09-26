# 設計書：3〜4面・近接テーマの敵・ボスB・共通調整（サブプロジェクト③b）

作成日: 2026-09-26
元資料: `docs/concept.md`、①②③aの設計書。実プレイの依頼（接近時間をさらに遅く、自弾の速度を上げる）を含む。

## 1. スコープ

### ③bに含むもの
- **共通調整**：接近時間・敵弾・ボスの進入を遅くする、自弾の飛ぶ速さを上げる（§2）
- **整備**（③aのレビューで持ち越し）：ボスの種類ごとの登録、ボスのオーラ色を色から導く、色の形式の検査、未知の敵の代わりの描画、ミニマップの角度の丸め（§3）
- **近接テーマの敵**：突き上げ敵、破片飛ばし敵、突進敵、破片（§4）
- **ボスB**（初期型・強化型）（§5）
- **3面・4面のデータ**と登録（§6）

### ③bに含まないもの
- 妨害テーマ（シールド・テレポート・妨害電波）、ボスC、7面（③c）
- 区間をまたぐタイマーの扱いの変更（既存のまま）
- ボスの効果音・専用の警告音（見た目の予兆だけ）

## 2. 共通調整

| 項目 | 今 | 変更後 | 場所 |
| --- | --- | --- | --- |
| 接近時間の基準 `APPROACH_TIME` | 10秒 | **14秒** | `js/core/config.js` |
| ボス子機の到達時間 `minionApproach` | 5秒 | **7秒** | `js/game/boss.js`（`BOSS_A_BASE`） |
| 敵弾の速さ `ENEMY_SHOT_SPEED` | 120 | **85** | `js/game/enemies.js` |
| ボスの進入速度 `moveSpeed` | 40 | **28** | `js/game/boss.js`（`BOSS_A_BASE`） |
| 自弾の速さ（PC）`BULLET_SPEED_PC` | 600 | **900** | `js/core/config.js` |
| 自弾の速さ（スマホ）`BULLET_SPEED_MOBILE` | 1500 | **2200** | `js/core/config.js` |

- 変えないもの：連射速度、旋回速度、視界、残機、無敵時間、ボスの左右移動や前進の間隔、敵の出現間隔
- 隕石・偵察ドローン・編隊ドローンの前進・偵察ドローンの再接近は `APPROACH_TIME` から決まるので、自動で遅くなる
- 既存のテストが決め打ちしている数値（接近時間の範囲、子機の5秒、敵弾の120、自弾の600など）は、設定値から計算する形に直す
- 自動操縦テストが通らなくなったら、`stage1.js` / `stage2.js` の出現表の数値を、報告つきで調整してよい（ボスの設定・テストの書き方は変えない）

## 3. 整備

### 3.1 ボスの登録
- `js/game/boss.js` の既存の `createBoss` / `updateBoss` を、`createBossA` / `updateBossA` に改名する
- 同じファイルの末尾に登録表を置き、`createBoss(type, params)` と `updateBoss(boss, state, dt)` は登録表を引くだけの関数にする（呼び出し側は変えない）
```js
export const BOSSES = {
  bossA: { name: 'ボスA', create: createBossA, update: updateBossA },
  bossB: { name: 'ボスB', create: createBossB, update: updateBossB },
};
```
- `createBoss`：未知の種類は `Error('unknown boss type: …')`（既存のテストを通す）。`params.color` がある場合は `#rrggbb`（6桁の16進）でなければ `Error`
- ボスのオブジェクトに `name`（登録表の名前）を持たせ、HPバーの表示（`drawBossBar`）は `boss.name` を使う
- `boss-b.js`（新規）は `boss.js` を読み込まない（`enemies.js` と `config.js` だけ）。循環参照を避ける

### 3.2 オーラの色
- `js/core/util.js` に `hexToRgba(hex, alpha)`（`#rrggbb` → `'rgba(r,g,b,a)'`）を追加する
- ボスAの描画（`drawBoss`）のオーラを、`bodyColor` から `hexToRgba(bodyColor, 0.35)` / `…, 0)` で導く。ボスAの初期型（`COLORS.boss = '#8f7cff'`）は今と同じ見た目になる

### 3.3 未知の敵の描画
- `drawEnemy` は、既知の種類のどれにも当てはまらなければ、目立つ代わりの図形（マゼンタの円と「？」）を描く

### 3.4 ミニマップ
- `radarPoint` は、角度を -90〜+90度に丸めてから座標にする（破片が旋回範囲の外に出たときに、半円の外に点が出ないように）
- 隠れている（`hidden`）ボスは、ミニマップにも出さない

## 4. 近接テーマの敵

### 4.1 定義（`js/game/enemies.js`）
```js
burrower: { hp: 2, radius: 24, score: 150, countsAsKill: true,  behavior: 'burrower' },
thrower:  { hp: 3, radius: 26, score: 250, countsAsKill: true,  behavior: 'thrower' },
charger:  { hp: 2, radius: 24, score: 200, countsAsKill: true,  behavior: 'charger' },
shard:    { hp: 1, radius: 10, score: 10,  countsAsKill: false, behavior: 'arc' },
```

### 4.2 突き上げ敵（`burrower`）
- 出現：角度は -90〜+90度、距離は 280〜360 のランダム。最初は **盛り上がり**（`phase: 'burrowed'`、HP1、半径12）。潜伏時間は 3.0 秒 ±0.5秒
- 隆起：`phase: 'risen'` に変わり、HP2、半径24になる。その瞬間に **衝撃波**として、敵弾（`enemyShot`）を5発、角度 `angle + [-24, -12, 0, 12, 24]`（-90〜+90度に丸める）に放つ。距離は `dist − radius`、速さは `ENEMY_SHOT_SPEED`
- 隆起後：通常の接近速度（`approachSpeed`、`APPROACH_TIME` から決まる）で中心へ前進する
- `countsAsKill`：盛り上がりの間に倒しても、隆起後に倒しても、同じ150点・撃破数1

### 4.3 破片飛ばし敵（`thrower`）
- 出現：距離460から接近し、保持距離 300〜360（ランダム）で静止（`phase: 'hold'`）。保持の間、左右にゆらゆら動く（±4度、偵察ドローンと同じ）
- 攻撃：`fireInterval = 4.0` 秒ごとに、**破片（`shard`）を3つ**、オフセット `[-20, 0, +20]` 度で投げる。速さは `ENEMY_SHOT_SPEED`
- 保持時間 14 秒のあと、前進を再開する（`phase: 'advance'`。速さは通常の接近速度）

### 4.4 破片（`shard`）
- 生成時に、基準の角度 `baseAngle`（投げた敵の角度）、`offset`（-20/0/+20）、`startDist`（投げた距離）を持つ
- 動き（`arc`）：`dist −= speed × dt`、`angle = baseAngle + offset × max(0, dist / startDist)`。左右にずれた位置から、曲線を描いて基準の線に収束する
- 撃ち落とせる（HP1）。中心に届いたら被弾（既存の `resolveCoreHits`）。撃破数には数えない

### 4.5 突進敵（`charger`）
- 出現：距離440、角度は -90〜+90度のランダム
- `phase: 'wait'`（1.2秒。予兆：点滅）→ `phase: 'dash'`：速さ `dist / 3.0`（約3秒で中心へ）
- 突進の速さは `APPROACH_TIME` の影響を受けない（速いことが脅威なので）

## 5. ボスB（`js/game/boss-b.js`）

### 5.1 パラメータ（`BOSS_B_BASE`、凍結。強化型は `params` で上書き）

| キー | 初期型（3面） | 強化型（4面）で上書き | 意味 |
| --- | --- | --- | --- |
| `hp` | 50 | 80 | |
| `radius` | 56 | | |
| `dist` | 340 | | 待機の距離 |
| `moveSpeed` | 28 | | 進入速度 |
| `angleRange` / `drift` | 50 / 8 | | 待機中の左右の往復（±度、度/秒） |
| `dashInterval` | 9 | 6.5 | 待機に入ってから次の突進の予兆まで（秒） |
| `dashCount` | 1 | 2 | 連続突進の回数 |
| `chainGap` | 0.6 | | 連続突進の2回目の予兆までの間（秒） |
| `telegraph` | 1.0 | | 予兆（点滅）の時間 |
| `vanish` | 0.8 | | 姿を消している時間 |
| `reappearDist` | 440 | | 再出現の距離 |
| `reappearMargin` | 15 | | 再出現の角度を、視界の端からさらに外側に離す量（度） |
| `settle` | 0.4 | | 再出現してから突進を始めるまでの間（秒） |
| `dashTime` | 2.6 | 2.0 | 突進で中心へ届くまでの時間（秒） |
| `dashBreak` | 8 | 12 | 突進中に受けたダメージがこの値に届くと突進が中断する |
| `scatterInterval` | 7 | 5 | 破片散布の間隔（秒） |
| `scatterCount` | 7 | | 破片散布の発数 |
| `scatterSpread` | 120 | | 扇の全体の角度（度） |
| `roarTime` | 2.2 | | 咆哮硬直の時間（秒） |
| `roarMult` | 1.5 | | 咆哮硬直中に受けるダメージの倍率 |
| `score` | 6000 | | |
| `color` | `'#c2418f'` | `'#ff7a3d'` | `BOSS_B_BASE` には入れず、ステージのデータで渡す（初期型の色は `COLORS.bossB`） |

- 数値は仮。自動操縦テストのために調整してよい範囲は §8 に書く

### 5.2 状態
- ボスのオブジェクト：`{ type: 'bossB', name: 'ボスB', p, hp, maxHp, radius, angle, dist, targetDist, dir, arrived, t, dead, phase, phaseT, hidden, dashesLeft, dashSpeed, dashStartDamage, damageTaken, damageMult, dashT, scatterT, hitCore }`
- `phase`：`'idle'`（待機）→ `'telegraph'` → `'vanish'` → `'settle'` → `'dash'` →（`'roar'` または連続突進なら `'telegraph'`）→ `'idle'`
- 進入（`arrived` になるまで）は、ボスAと同じく、距離460から `dist` まで `moveSpeed` で進む。到着したら `phase = 'idle'`、`dashT = dashInterval`、`scatterT = scatterInterval`

### 5.3 動き（`updateBossB(boss, state, dt)`）
1. **idle**：ボスAと同じく左右に往復。`dashT` と `scatterT` を減らす。
   - `scatterT ≤ 0`：`scatterT += scatterInterval`。**破片散布**として、敵弾（`enemyShot`）を `scatterCount` 発、角度 `boss.angle + linspace(−scatterSpread/2, +scatterSpread/2)`（-90〜+90度に丸める）に放つ。距離は `dist − radius`、速さは `ENEMY_SHOT_SPEED`
   - `dashT ≤ 0`：`phase = 'telegraph'`、`phaseT = telegraph`、`dashesLeft = dashCount`
2. **telegraph**：ボスが点滅する（描画側）。`phaseT` が0になったら `phase = 'vanish'`、`phaseT = vanish`、`hidden = true`
3. **vanish**：`phaseT` が0になったら、視界の外の角度に再出現する（`pickHiddenAngle`、§5.4）。`hidden = false`、`dist = reappearDist`、`phase = 'settle'`、`phaseT = settle`
4. **settle**：`phaseT` が0になったら `phase = 'dash'`、`dashSpeed = dist / dashTime`、`dashStartDamage = damageTaken`
5. **dash**：`dist −= dashSpeed × dt`。
   - **中断**：`damageTaken − dashStartDamage ≥ dashBreak` になったら、突進を中断する。`dist = p.dist`、角度は `±angleRange` のランダム、`dashesLeft = 0`、`phase = 'roar'`、`phaseT = roarTime`、`damageMult = roarMult`
   - **到達**：`dist ≤ HIT_RADIUS_CORE` になったら `hitCore = true`（`stepGame` が残機-1とノックバックを行う）。`dist = p.dist`、角度は `±angleRange` のランダム。`dashesLeft −= 1`。まだ残っていれば `phase = 'telegraph'`、`phaseT = chainGap`（連続突進）。残っていなければ `phase = 'roar'`、`phaseT = roarTime`、`damageMult = roarMult`
6. **roar**：その場で待機（左右には動かない）。`phaseT` が0になったら `damageMult = 1`、`phase = 'idle'`、`dashT = dashInterval`

### 5.4 再出現の角度（`pickHiddenAngle(heading, fov, margin, rng)`、純粋関数・エクスポートする）
- `half = fov/2 + margin`。視界の外の区間は、`[-90, heading − half]` と `[heading + half, 90]`（長さが正のもの）
- 区間が残っていれば、長さで重み付けして1つ選び、その中で一様に角度を選ぶ。どちらも無ければ、`heading ≥ 0` なら -90、そうでなければ +90
- 返す角度は -90〜+90度

### 5.5 当たり判定・被弾の変更（`js/game/collision.js`、`js/game/step.js`）
- 弾の対象（`targetsOf`）から、`hidden` のボスを除く
- ダメージ：`dmg = damage × (t.damageMult ?? 1)`。`t.hp −= dmg`。`t.damageTaken` が数値なら `t.damageTaken += dmg`（ボスBの突進の中断の判定に使う。ボスAには無いので何も起きない）
- ボスの当たり判定の半径には、拡大の倍率を掛けない（③前のまま）
- `stepGame`：ボスの更新のあと、`state.boss?.hitCore` なら `hitCore = false` にして、`resolveCoreHits` の結果に1を足し、既存の被弾の処理（`damageTurret` → ノックバック → `damage` イベント）に流す

### 5.6 描画
- ボスB（`drawBossB`）：大きな体（楕円）と2本の角、光る目。`COLORS.bossB` または `boss.p.color` を体の色にし、オーラは `hexToRgba` で導く
- 予兆（`telegraph`）：赤く点滅する。咆哮（`roar`）：口を大きく開け、体を少し膨らませる。`hidden` のときは描かない
- HPバー（`drawBossBar`）：名前は `boss.name`。`phase` が `'telegraph'` / `'vanish'` / `'settle'` の間は、HPバーの上に警告「⚠ 視界の外から突進！」を点滅させる
- 撃破エフェクトの色は `boss.p.color ?? COLORS.boss`（既存）

## 6. 3面・4面のデータ（数値は仮）

```js
// STAGE3：落下地帯・地表（120秒）
segments: [
  { from: 0,  to: 20,  spawns: { meteor: 3.0, burrower: 12 } },
  { from: 20, to: 50,  spawns: { meteor: 2.6, drone: 10, burrower: 9, thrower: 16 } },
  { from: 50, to: 85,  spawns: { meteor: 2.4, drone: 9, burrower: 8, thrower: 12,
                                 formationDrone: { every: 18, count: 3, minSep: 25 } } },
  { from: 85, to: 120, spawns: { meteor: 2.2, drone: 8, burrower: 7, thrower: 10,
                                 formationDrone: { every: 14, count: [3, 4], minSep: 25 } } },
],
spawnEnd: 120,
boss: { type: 'bossB', params: {} },

// STAGE4：落下地帯・激戦区（130秒）
segments: [
  { from: 0,  to: 20,  spawns: { meteor: 3.0, burrower: 10, charger: 14 } },
  { from: 20, to: 55,  spawns: { meteor: 2.6, drone: 10, burrower: 8, thrower: 14, charger: 11 } },
  { from: 55, to: 95,  spawns: { meteor: 2.4, drone: 9, burrower: 7, thrower: 11, charger: 9,
                                 formationDrone: { every: 16, count: 3, minSep: 25 } } },
  { from: 95, to: 130, spawns: { meteor: 2.2, drone: 8, burrower: 6, thrower: 9, charger: 7,
                                 formationDrone: { every: 12, count: [3, 4], minSep: 25 } } },
],
spawnEnd: 130,
boss: { type: 'bossB', params: { hp: 80, dashInterval: 6.5, dashCount: 2, dashTime: 2.0, dashBreak: 12,
                                 scatterInterval: 5, color: '#ff7a3d' } },
```
- `name`：3面「落下地帯・地表」、4面「落下地帯・激戦区」
- `STAGES` に `3: STAGE3, 4: STAGE4` を足す。1〜2面をクリアすると3面、3面をクリアすると4面が解放される（②の仕組みのまま）。5〜7面は準備中のまま
- ②③aのテストのうち「3面にデータが無い」前提のもの（`tests/progress.test.mjs`、`tests/stage2.test.mjs` など）は、差し替えた登録（`getStageFn`）を使う形に直す
- README の「（3〜7面は準備中）」を「（5〜7面は準備中）」にし、近接テーマの敵とボスBの説明を足す

## 7. 色
`COLORS` に追加：`burrower: '#b58a5a'`（土色）、`thrower: '#e0a458'`、`shard: '#ffb84d'`、`charger: '#ff6b6b'`、`bossB: '#c2418f'`。

## 8. テスト

- **共通調整**：設定値（`APPROACH_TIME` 14、弾速 900/2200、敵弾 85、子機 7秒、進入 28）。既存の接近時間・子機・敵弾のテストは、設定値から計算する形に
- **整備**：`createBoss` の未知の種類と不正な `color`（`'red'`、`'#f80'`）は例外／`hexToRgba`／`radarPoint` の角度の丸め／`hidden` のボスは弾の対象外
- **突き上げ敵**：盛り上がり（HP1・半径12）→ 潜伏時間の経過で隆起（HP2・半径24）／隆起の瞬間に敵弾が5発、指定の角度／隆起後は前進する
- **破片飛ばし敵**：保持距離まで進んで止まる／4秒ごとに破片3つ／保持14秒のあと前進
- **破片**：曲線（`angle = base + offset × dist/startDist`）／中心に届くと被弾／撃破数に数えない
- **突進敵**：1.2秒待つ／その後 `dist/3.0` で突進し、約3秒で届く
- **ボスB**：進入→待機／`pickHiddenAngle` が視界の外の区間から選ぶ（多数のシードと、heading・fov の組み合わせ）／突進の流れ（予兆→消える→再出現→settle→突進）／ダメージで中断する（`dashBreak`）／到達で `hitCore`／咆哮のダメージ倍率／連続突進（強化型）／破片散布／`BOSS_B_BASE` が凍結され書き換わらない／強化型の上書き
- **ステップ**：ボスBの `hitCore` で残機が減る／ノックバック／咆哮のダメージ倍率が実際の被ダメージに効く
- **ステージのデータ**：3面・4面が `validateStage` を通る（全ステージのテストに自動で入る）／4面にだけ突進敵がある／ボスの設定
- **自動操縦**：3面・4面を複数のシードでクリアできる。自動操縦の関数は、`hidden` のボスを狙わないように直す。**調整してよい範囲**：`stage3.js` / `stage4.js` の出現表の数値、`BOSS_B_BASE` と4面の強化型の `params` のうち、`dashTime`（初期型は最大3.2秒、強化型は最大2.6秒まで）、`dashBreak`（初期型は最小5、強化型は最小8まで）、`settle`（最大0.8秒まで）、`dashInterval`。調整した場合は、最終の数値と、シードごとのクリア時間・残機を報告する
- ブラウザ（目視）：各敵の見た目と予兆、ボスBの突進・再出現・咆哮・警告、ミニマップの点、接近が遅くなった手応え

## 9. 未確定・後回し
- 近接テーマの数値の実プレイ調整（突進を止めるダメージ、出現間隔）
- 妨害テーマ（③c）、区間をまたぐタイマーの扱い
- ボス専用の効果音
