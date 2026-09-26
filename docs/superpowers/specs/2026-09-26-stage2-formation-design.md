# 設計書：2面・編隊ドローン・まとめ出し（サブプロジェクト③a）

作成日: 2026-09-26
元資料: `docs/concept.md`（ステージ構成表・雑魚敵設計・ボス設計）、①②の設計書

## 1. スコープ

③（2〜7面）はテーマ別に3つに分ける。

- **③a（本書）**：2面（テーマA・激化）。編隊ドローン群、ボスAの強化型、複数の敵を「まとめて出す」出現表の書き方
- ③b：3〜4面（近接テーマ4種の敵＋ボスB）
- ③c：5〜7面（妨害テーマ＋ボスC＋7面専用ボス）

### ③aに含むもの
- 敵 `formationDrone`（編隊ドローン）
- 出現表の「まとめて出す」書き方と、その処理
- 2面のデータ（出現表・ボスAの強化型）と登録
- 面の名前の表示（開始時のヒントの先頭）
- ボスの色を引数で変えられること
- ②のテスト（1面だけが登録されている前提のもの）の更新

### ③aに含まないもの
- 近接・妨害テーマの敵、ボスB・C（③b・③c）
- 「旧テーマの敵を一定頻度で混ぜる」ための特別な仕組み。出現表に敵の種類を並べれば足りるので、③bで表に書くだけにする
- 7面の「全テーマを偏りなく投入」（③c）

## 2. 編隊ドローン（`formationDrone`）

### 2.1 敵の定義（`js/game/enemies.js`）
```js
formationDrone: { hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight' }
```
- 動きは隕石と同じ直進（`straight`）
- 撃破数に数える。スコアは子機と同じ50

### 2.2 編隊の生成（`js/game/formation.js`、新規・純粋）
```js
createFormation(type, count, minSep, rng): Enemy[]
```
- 角度：`pickSpreadAngles(count, minSep, rng)`（`boss.js`）で、-90〜+90度から、互いに `minSep` 度以上離れた角度を選ぶ。角度は「取り得るすべての配置から一様に選ぶ」（棄却サンプリングはしない。物理的に不可能な条件のときだけ等間隔）
- 接近速度：編隊で1つの基準ジッタ `j = randRange(rng, -0.15, 0.15)` を決め、各機は `speed = SPAWN_DIST / (APPROACH_TIME × (1 + j + randRange(rng, -0.03, 0.03)))`。ほぼ同時に中心へ届くようにする
- 各機は `createEnemy(type, angle, rng, { speed })` で作る（距離は `SPAWN_DIST`）
- 循環参照を避けるため、`formation.js` は `boss.js` と `enemies.js` を読み込み、`spawner.js` が `formation.js` を読み込む

### 2.3 見た目
- 偵察ドローンの図形（`drawDrone`）を使う。半径が小さいので小さく見える
- 色は新しい `COLORS.formation = '#8dffb0'`（偵察ドローンの水色と区別できる、ミントグリーン）にする

## 3. 出現表：まとめて出す書き方

### 3.1 書き方
`spawns` の値は、次のどちらでもよい。
```js
spawns: {
  meteor: 1.8,                                                    // 数値：その間隔（秒）で1体
  formationDrone: { every: 14, count: 3, minSep: 25 },            // まとめ：every秒ごとに count 機
  // count は数値、または [最小, 最大]（この範囲の整数を等確率で選ぶ）
  // formationDrone: { every: 11, count: [3, 4], minSep: 25 },
}
```

### 3.2 処理（`js/game/spawner.js`）
- 数値の場合は今までどおり（1体ずつ、範囲 -90〜+90度のランダムな角度）
- オブジェクトの場合は、`every` を間隔として同じタイマーで管理し、発火するたびに `createFormation(type, n, minSep, rng)` の結果をすべて `state.enemies` に追加する。`n` は `count` が数値ならその値、配列なら `randInt`（`[最小, 最大]` の範囲）
- `every` が正の数でない、`count` が1未満、`minSep` が数値でない場合は、ステージのデータの誤りなので例外を投げる（起動時ではなく、その項目を最初に処理するとき）
- 既知の課題（①のレビューで持ち越し）：区間をまたぐとき、前の区間で溜まったタイマーが引き継がれる。②③の間は許容する

### 3.3 補助関数
`js/core/util.js` に `randInt(rng, lo, hi)`（`lo`〜`hi` の整数を等確率で返す。両端を含む）を追加する。

## 4. 2面のデータ（`js/data/stage2.js`）

数値は仮。実プレイで調整する。

```js
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
  boss: { type: 'bossA', params: { hp: 60, summonCount: 5, summonInterval: 4.5, color: '#ff8f6b' } },
});
```
- 110秒で出現を止め、雑魚がいなくなったらボスAの強化型が出る（①と同じ）
- **ボスAの強化型**：初期型（`BOSS_A_BASE`）から、HP 40→60、分散召喚の同時数 3→5、召喚間隔 6→4.5秒、体の色を変える。それ以外（直進弾、突進、往復）は初期型のまま
- `STAGE1` にも `name: '上空・隕石帯（序盤）'` を追加する（ヒントの表示用）

## 5. ボスの色

- `createBoss(type, params)` の `params` に `color`（CSSの色文字列）を渡せるようにする（`BOSS_A_BASE` には `color` を入れない。`p.color` は未指定なら `undefined`）
- `drawBoss` は `boss.p.color ?? COLORS.boss` を体の色に使う。リングとドームの色は、その色から `lightenColor` で導く（今と同じ）

## 6. 面の名前の表示

- 開始時に出すヒント（5秒間）の先頭に、面の名前を付ける：`${stage.id}面：${stage.name}　` に続けて、今までの操作説明
- `stage.name` が無いときは、面の番号だけ（`${stage.id}面　`）

## 7. 登録と解放（②の仕組みの利用）

- `js/data/stages.js` の `STAGES` に `2: STAGE2` を足す
- 1面をクリアすると2面が解放され、結果画面に「次のステージへ」が出る（②の `nextPlayableStage` がそのまま働く）
- 3〜7面は引き続き「準備中」
- ②のテストのうち、「2面にデータが無い」ことを前提にしたものは、差し替えた登録（`getStageFn`）を使う形に直す（`tests/progress.test.mjs`）

## 8. テスト

- `formation`：3〜5機で、互いの角度が `minSep` 以上離れる／範囲は-90〜+90度／接近時間の差が小さい（最も遅い機と最も速い機の到達時間の差が1.5秒未満）／`count` が1のとき1機
- `randInt`：両端を含む、範囲内、同じシードで同じ列
- `spawner`：まとめ書き方で、`every` ごとに `count` 機が同時に出る／`count` が配列のとき範囲内に収まる／不正な値は例外／数値の書き方は今までどおり（1面のテストが変わらない）
- 2面のデータ：区間が連続して隙間がない／`spawnEnd` が最後の区間の終わりと一致する／ボスの設定が初期型より強く、`BOSS_A_BASE` を書き換えていない
- 自動操縦で2面をクリアできる（複数のシードで、残機が1つ以上残る）。出現の数値は仮なので、このテストを通すために **`stage2.js` の出現数値を調整してよい**（調整した最終の数値と、そのときの残機は報告する）
- ブラウザ（目視）：2面の編隊ドローンの見た目、ボスAの強化型の色と5方向の子機、ヒント表示、1面クリア後の「次のステージへ」、ステージ選択の表示

## 9. 未確定・後回し
- 2面の出現数値の実プレイ調整
- 「旧テーマ混在」の頻度の考え方（③b以降）
- 区間をまたぐタイマーの引き継ぎ（③bで実際に問題になるなら直す）
- ③bで扱うこと：
  - ボスの種類ごとの登録（create/update/draw）の仕組み
  - ボスのオーラ色を色から導く
  - color は #rrggbb のみ対応（lightenColor の制約）
  - drawEnemy に未知の種類のフォールバック
  - 区間をまたぐタイマーの扱い（種類ごとのタイマーは、区間に無い間は止まる。同じ種類の単体出現とまとめ出現は同じ区間に置けない）
