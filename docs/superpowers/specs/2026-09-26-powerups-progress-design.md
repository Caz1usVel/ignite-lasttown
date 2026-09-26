# 設計書：パワーアップ・ステージ進行・セーブ（サブプロジェクト②）

作成日: 2026-09-26
元資料: `docs/concept.md`、`docs/superpowers/specs/2026-09-26-core-stage1-design.md`（①の設計。本書はその続き）

## 1. スコープ

### ②に含むもの
- パワーアップ6種と、撃破10体ごとの2択選択
- ステージ選択、クリアによる次の面の解放、ステージごとの最高スコア
- セーブをv2に拡張し、v1から移行する
- ①のレビューで②に回した項目のうち、セーブ移行（本書 §5）

### ②に含まないもの
- 2〜7面の敵とボス（③）。②では2〜7面のタイルを「準備中」で見せる
- エンドレス2種、ボス撃破時のパワーアップ選択の発生（④）。選択の仕組みは②で作るが、ステージ制では使わない
- 日記（④）
- BGMの楽曲。iOSで `<audio>.volume` が効かない件は、楽曲を入れるときに対応する（②では曲を流さないので影響しない）

## 2. 確定済みの方針
- パワーアップはステージごとにリセットする（持ち越さない）
- コンティニューは「ステージの最初からやり直す」のみ。結果画面の「もう一度」がそれに当たる
- 2人協力は操作の分担だけで、プログラム上は区別しない（①のまま）

## 3. パワーアップ

### 3.1 定義（`js/game/powerups.js`）

| id | 名前 | 効果 | 上限 | 重み |
| --- | --- | --- | --- | --- |
| `fireRate` | 連射速度アップ | `fireRate = 4 × (1 + 0.15n)` | 5 | 10 |
| `damage` | 攻撃力アップ | `damage = 1 + 0.2n` | 5 | 10 |
| `pierce` | 貫通弾 | `pierce = n`（撃破した弾がさらに進める回数） | 3 | 10 |
| `turnSpeed` | 旋回速度アップ | `turnSpeed = 90 × (1 + 0.15n)` | 4 | 10 |
| `fov` | 視界拡大 | `fov = 70 + 8n`（度） | 3 | 5 |
| `life` | 残機+1 | 選んだ瞬間に `lives += 1` | 上限なし | 2 |

n は取得回数。基準値は `CONFIG` から取る。数値の根拠はコンセプト書「パワーアップ要素」の表。

### 3.2 状態
- `state.powerups`：`{ fireRate: 0, damage: 0, pierce: 0, turnSpeed: 0, fov: 0, life: 0 }`（取得回数）
- `state.nextOfferAt`：次の選択が発生する撃破数。初期値10、選択が発生するたびに+10
- `state.offer`：選択待ちのとき、提示中の2つ（または1つ）のid配列。それ以外は `null`
- 砲台には `pierce`（初期値0）を追加する

### 3.3 関数（すべて純粋。canvas・DOMに触れない）
- `POWERUPS`：上の定義テーブル（id、名前、説明、上限、重み、`apply`）
- `availablePowerups(counts): string[]`：上限に達していない種類のid
- `makeOffer(counts, rng): string[]`：候補から重み付き・重複なしで最大2つ選ぶ。候補が1種類ならその1つ、0種類なら空配列
- `applyPowerup(state, id)`：`state.powerups[id]` を+1し、砲台の能力を再計算する。`life` は `turret.lives += 1`
- `recomputeTurret(turret, counts)`：上の式から `fireRate / damage / pierce / turnSpeed / fov` を計算し直す（`lives` は触らない）

### 3.4 発生の流れ（`stepGame`）
1. 撃破の処理が終わり、`outcome` が決まっていないとき、`state.kills >= state.nextOfferAt` なら `makeOffer` を呼ぶ
2. 結果が空でなければ、`state.offer` に入れ、`nextOfferAt += 10`、イベント `{ type: 'offer', choices }` を返す。空なら、`nextOfferAt += 10` だけ行い、選択は発生させない
3. `state.offer` が `null` でない間、`stepGame` は何もせず `[]` を返す（時間・敵・弾が止まる）
4. `chooseOffer(state, id)`：`id` が `state.offer` に含まれるときだけ `applyPowerup` を呼び、`state.offer = null` にする。含まれなければ何もしない
5. ボス撃破によるクリア（`outcome === 'clear'`）のときは選択を出さない（ステージ制では意味がないため）。エンドレス（④）で使う `bossReward` の入口は作らない（YAGNI）

### 3.5 貫通（`collision.js`）
- 弾に `pierceLeft`（生成時に `turret.pierce`）だけを持たせる
- 撃破したとき、`pierceLeft > 0` なら `pierceLeft -= 1` して、その弾は消さずに掃引を続ける。`pierceLeft === 0` なら弾は消える
- 撃破できなかった（`hit`）ときは、弾は消える
- 倒した敵はすでに `dead` で、倒しきれない当たりでは弾が止まるため、当たった敵のリストは不要。同じ敵に同じ弾が二度当たることはない
- 結果として、1発で当たれる敵は最大 `pierce + 1` 体

### 3.6 選択画面（`js/scenes/powerup.js`）
- シーン名 `powerup`。play シーンが、`update` のあとで `state.offer !== null` を見つけたら、`setScene('powerup')` に切り替える
- 止まったプレイ画面（`playfield`）を背景にして、DOMオーバーレイにカード2枚を出す。カードには、名前、効果の説明、現在のレベルと次のレベル（例：`Lv 2 → 3`）を表示する。取得が上限に達する場合は「MAX」と併記する
- 選び方は、カードのクリック／タップ、または 1・2 キー
- 画面に入ってから0.5秒は、選択を受け付けない（連射中の誤選択を防ぐ）
- 選ぶと `chooseOffer` を呼び、効果音を鳴らして `setScene('play', { resume: true })` に戻る
- ポーズはこの画面では使えない（Esc を無視する）

### 3.7 HUD
- 取得済みのパワーアップを、小さなアイコン（絵文字またはCSSの図形）とレベルで並べる。`life` は残機のハート表示に反映されるので並べない
- 視界拡大で `fov` が変わっても、描画・照準・当たり判定は `turret.fov` を参照しているので、変更は不要（①で確認済み）

### 3.8 効果音
- 選択画面が出るとき、カードを選んだとき、の2つを `audio.se` に追加する

## 4. ステージ進行

### 4.1 データ（`js/data/stages.js`）
- `STAGES`：`{ 1: STAGE1 }`。②では1面だけ登録する
- `STAGE_COUNT = 7`
- `getStage(id)`：登録されていれば返す。なければ `null`

### 4.2 解放の規則（`js/core/progress.js`。純粋）
- `isStageAvailable(id)`：`getStage(id) !== null`（データがあるか）
- `isStageUnlocked(save, id)`：`id === 1` か、`save.stages[id - 1]?.cleared === true`
- `isStagePlayable(save, id)`：`isStageAvailable(id) && isStageUnlocked(save, id)`
- `nextPlayableStage(save, id)`：`id + 1` が遊べればその番号、遊べなければ `null`
- `recordResult(save, id, outcome, score): { newBest: boolean }`：`clear` なら `stages[id].cleared = true`。スコアが `best` を上回れば更新する（クリア・ゲームオーバーどちらでも記録）

### 4.3 画面の流れ
```
タイトル →（ひとりで／ふたりで）→ ステージ選択 → プレイ → 結果
                                      ↑                     │
                                      └── ステージ選択へ ←───┤
                                          もう一度 → プレイ（同じ面）
                                          次のステージへ → プレイ（次の面。クリアかつ遊べるときだけ）
```
- タイトルの「ひとりで」「ふたりで（PC）」は、`mode` を保持してステージ選択に進む。タイトルの「ハイスコア」表示は削除する
- ステージ選択（`js/scenes/stageselect.js`）：7つのタイルを並べる。タイルには番号、状態（クリア済み／遊べる／未解放／準備中）、最高スコアを表示する。遊べる面だけ押せる。「タイトルへ」ボタンを置く
- 2〜7面は、データが無いので「準備中」と表示して押せなくする（1面をクリアしても、2面は遊べるようにならない）
- 結果画面のボタン：クリア→「次のステージへ」（遊べるときだけ表示）／「もう一度」／「ステージ選択へ」。ゲームオーバー→「もう一度」／「ステージ選択へ」

### 4.4 シーンの受け渡し
- `play.enter({ stageId, mode })`：`getStage(stageId)` から出現表を読む。`createPlayState(stage, rng)` は①のまま。`stageId` は `state` に持たせず、シーンの変数に持つ
- `result.enter({ outcome, score, kills, mode, stageId })`
- 結果画面に入るとき、`recordResult` を呼んで `app.persist()` する

## 5. セーブ（v2）

- キーは `td_save_v1` のまま使う（名前を変えると既存の保存が読めなくなるため。名前は歴史的なもの）
- 形式：
```js
{
  version: 2,
  settings: { muted, bgmVol, seVol },
  stages: { "1": { cleared: false, best: 0 } }   // 取得済みの面だけキーを持つ
}
```
- `highScore` フィールドは廃止する
- **移行（v1→v2）**：`version === 1` のとき、`settings` はそのまま引き継ぐ。`highScore > 0` なら、`stages["1"] = { cleared: false, best: highScore }` にする（v1は1面しか無く、クリアの記録は無かったため、`cleared` は `false`）
- 壊れたデータ、未知のバージョン（3以上など）、例外は、既定値（①と同じ）
- `stages` の各エントリは検証する：`cleared` は真偽値（それ以外は `false`）、`best` は0以上の有限数（それ以外は0）。キーが `1`〜`STAGE_COUNT` の整数の文字列でなければ無視する
- `writeSave` は常にv2で書く

## 6. ファイル構成

新規：
```
js/game/powerups.js       定義、候補生成、適用、能力の再計算
js/data/stages.js         ステージの登録
js/core/progress.js       解放の判定、結果の記録
js/scenes/powerup.js      選択画面
js/scenes/stageselect.js  ステージ選択
tests/powerups.test.mjs
tests/progress.test.mjs
```
変更：
```
js/game/turret.js         pierce を追加
js/game/bullets.js        弾に pierceLeft を持たせる
js/game/collision.js      貫通、複数ヒットの掃引
js/game/state.js          powerups / nextOfferAt / offer を追加
js/game/step.js           選択待ちの間は止める、offer の発生
js/core/save.js           v2と移行
js/core/audio.js          効果音を2つ追加
js/scenes/play.js         stageId を受ける、offer で powerup シーンへ、HUD のパワーアップ表示
js/scenes/result.js       recordResult、ボタンの出し分け
js/scenes/title.js        ハイスコア表示の削除、ステージ選択へ
js/main.js                新しい dom id とシーンの登録
index.html, css/style.css 選択画面・ステージ選択・結果ボタン・HUDのアイコン
README.md                 遊び方（パワーアップ、ステージ選択）
tests/step.test.mjs       自動操縦が選択を自動で選ぶ、選択のテスト
tests/collision.test.mjs  貫通のテスト
tests/save.test.mjs       v2と移行のテスト
```

## 7. テスト（`node --test`）
- `powerups`：各種類の効果量（n=0,1,上限）、`availablePowerups` が上限の種類を除く、`makeOffer` が重複しない・候補が1種類・0種類のときの動き、重みが偏りをもつこと（シード固定で大量に引いて、`life` が最も少ない）、`applyPowerup` の `life` が残機を+1すること、`chooseOffer` が候補外のidを無視すること
- `collision`（貫通）：`pierce=0` は1体で止まる、`pierce=2` は3体目まで当たる、撃破できなければ止まる、同じ敵に二度当たらない
- `step`：撃破10体で `offer` が発生し `stepGame` が止まる、`chooseOffer` のあと再開する、上限に達した種類が出ない、全種類が上限なら発生しない、クリアの瞬間には発生しない、自動操縦が選択を自動で選んで1面をクリアできる
- `progress`：解放の規則、`recordResult`（クリア、最高スコアの更新、ゲームオーバーでも最高は更新）、準備中の面は遊べない
- `save`：v2の往復、v1からの移行（`highScore` の引き継ぎ、`settings` の引き継ぎ）、`stages` の検証（不正な値・不正なキー）、v3などの未知バージョンは既定値
- ブラウザ（目視）：選択画面の表示と誤選択の防止、HUDのアイコン、ステージ選択の各状態、結果画面のボタンの出し分け、スマホの縦横の表示

## 8. 未確定・後回し
- パワーアップの効果量の実プレイ調整（コンセプト書の未決定事項）
- 選択画面・ステージ選択のデザインの磨き込み（②では必要十分な見た目にとどめる）
- 攻撃力アップの小数ダメージは、Lv1〜4では HP2 の敵の必要弾数を変えない（HP2は攻撃力2.0=Lv5で1発）。③で敵HPを決めるときは、小数ダメージで段階的に効くHP（例：3、5）を選ぶ
- ボス撃破時の選択（④）、エンドレスでの選択の発生頻度（④）
