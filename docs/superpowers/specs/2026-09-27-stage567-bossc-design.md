# 設計書：5〜7面・妨害テーマ・ボスC・最終ボス・難易度調整（サブプロジェクト③c）

作成日: 2026-09-27
元資料: `docs/concept.md`（ステージ構成表・雑魚敵設計・ボス設計）、①②③a③bの設計書。実プレイの依頼（雑魚の難易度・物量とボス戦の難易度を下げる）を含む。

## 1. スコープと進め方

③cは大きいので、同じ設計書のもとで、2つの実装計画に分けて進める。

- **計画A（③c-1）**：難易度調整、整備、妨害テーマの敵（シールド・テレポート・妨害電波）、ボスC、5〜6面
- **計画B（③c-2）**：出現表の抽選（`pool`）、最終ボス、7面

### ③cに含まないもの
- 全ステージクリア後の演出・日記・ハードエンドレス（④）
- 効果音・BGMの作り込み（妨害・吸収の効果音を最小限に足すだけ）

## 2. 難易度調整（計画Aの最初のタスク）

| 対象 | 今 | 変更後 |
| --- | --- | --- |
| 出現の物量 | 出現間隔そのまま | 全ステージの出現間隔を ×1.35。`CONFIG.SPAWN_SCALE = 1.35` を、`createSpawner(stage, scale = CONFIG.SPAWN_SCALE)` で、数値の間隔と `every` に掛ける |
| 偵察ドローンの射撃 `DRONE.fireInterval` | 3.5 | 4.5 |
| 破片飛ばし敵の投擲 `THROWER.fireInterval` | 4.0 | 5.0 |
| 突き上げ敵の衝撃波 `BURROWER.waveOffsets` | `[-24,-12,0,12,24]`（5発） | `[-16,0,16]`（3発） |
| 突進敵の予兆 `CHARGER.waitTime` | 1.2 | 1.5 |
| ボスA 初期型（`BOSS_A_BASE`） | hp 40・`shotInterval` 4・`summonInterval` 6 | hp 30・5・7.5 |
| ボスA 強化型（`stage2.js`） | hp 60・`summonCount` 5・`summonInterval` 4.5 | hp 45・4・6 |
| ボスB 初期型（`BOSS_B_BASE`） | hp 50・`dashInterval` 9・`dashBreak` 8・`scatterInterval` 7・`scatterCount` 7 | hp 40・11・6・9・5 |
| ボスB 強化型（`stage4.js`） | hp 80・`dashInterval` 6.5・`dashTime` 2.3・`dashBreak` 8・`scatterInterval` 5 | hp 60・8.5・2.5・6・7 |

- 変えないもの：残機、連射、旋回、視界、無敵時間、接近時間の基準（14秒）、ボスの `firstDashDelay`、ボスBの `dashCount`、各面の出現表の数値そのもの（スケールで一律に薄める）
- 既存のテストが決め打ちしている値は、新しい値に直す（可能なら、エクスポートされた定数から計算する形にする）

## 3. 整備（③a・③bから持ち越し）

### 3.1 ボスのファイル分割と登録表
```
js/game/boss-a.js   BOSS_A_BASE, createBossA, updateBossA, pickSpreadAngles（今の boss.js の中身）
js/game/boss-b.js   （今のまま）
js/game/boss-c.js   新規（§6）
js/game/boss-d.js   新規（計画B・§7）
js/game/boss.js     登録表 BOSSES、createBoss、updateBoss だけ。BOSS_A_BASE と pickSpreadAngles は再エクスポートする（既存の import を壊さない）
```
- 登録表の各項目：`{ name, color, create, update }`。`color` は既定の色（`#rrggbb`）：`bossA '#8f7cff'`、`bossB '#c2418f'`、`bossC '#4fc3d9'`、`bossD '#e8c547'`
- `createBoss` は、作ったボスに `name` と `color`（`params.color ?? 登録表の color`）を付ける。`boss.p.color` はこれまでどおり `params` の値のまま（既定の色は入れない）
- 描画とエフェクトは `boss.color` を使う（`boss.p.color ?? …` の分岐をやめる）
- 描画は、`js/render/entities.js` の `drawBoss` を、種類→関数の表（`BOSS_DRAWERS`）で引く。表に無い種類は、マゼンタの目立つ代わりの図形
- 循環参照を避ける：`boss-a/b/c/d.js` は `boss.js` を読み込まない。`boss-d.js` は `boss-a.js`（召喚）と `boss-b.js`（突進の部品）を読み込む。`formation.js` は `boss-a.js` から `pickSpreadAngles` を読み込む

### 3.2 `createEnemy` の初期化を表にする
- `ENEMY_INITS = { drone(e, angle, rng, opts), burrower(...), thrower(...), charger(...), shard(...), … }` を作り、`createEnemy` は `ENEMY_INITS[type]?.(e, angle, rng, opts)` を呼ぶだけにする（挙動は変えない。乱数の消費順も変えない）

### 3.3 出現のタイマーを区間ごとに新しくする
- タイマーのキーを `` `${区間の番号}:${種類}` `` にする。区間に入ってから `every` 秒後が最初の出現になる。前の区間の余りは引き継がない
- 同じ種類の単体出現とまとめ出しを、同じ区間に置きたい場合は、抽選（`pool`、§7.2）を使う

### 3.4 自動操縦のテストを、合格率で見る
- 各ステージのテストを「5つのシードのうち4つ以上でクリアし、クリアしたものは残機が1つ以上残る」に変える（乱数の流れが変わって、固定のシードが偶然落ちるのを避けるため）
- 失敗メッセージには、シードごとの結果（クリア、時間、残機、ボスのHP・phase）を全部出す

### 3.5 角度の選び方の共通化
- `js/core/util.js` に `pickAngleOutside(center, half, rng)`（`-90〜+90` の中で、`center` から `half` 度以上離れた角度を、区間の長さで重み付けして一様に選ぶ。区間が無ければ、`center ≥ 0` なら -90、そうでなければ +90）を移す。`boss-b.js` の `pickHiddenAngle(heading, fov, margin, rng)` は、これを呼ぶだけにする（既存のテストがそのまま通ること）

## 4. 妨害テーマの敵（5面から）

### 4.1 定義（`js/game/enemies.js`）
```js
shielder:   { hp: 1, radius: 26, score: 200, countsAsKill: true,  behavior: 'shielder' },
teleporter: { hp: 2, radius: 22, score: 250, countsAsKill: true,  behavior: 'teleporter' },
jammer:     { hp: 2, radius: 24, score: 250, countsAsKill: true,  behavior: 'jammer' },
jamShot:    { hp: 1, radius: 12, score: 10,  countsAsKill: false, behavior: 'straight' },
decoy:      { hp: 1, radius: 40, score: 0,   countsAsKill: false, behavior: 'decoy' },
```
パラメータ：
```js
export const SHIELDER = { holdMin: 320, holdMax: 380, hoverTime: 14, cycle: 3.0, closedTime: 2.2, blinkTime: 0.3 };
export const TELEPORTER = { interval: 3.0, jitter: 0.5, warn: 0.4, minDelta: 30, flash: 0.3 };
export const JAMMER = { holdMin: 300, holdMax: 360, sway: 4, swayHz: 0.3, fireInterval: 5.0, hoverTime: 14 };
export const JAM_TIME = 1.5; // 妨害電波が届いたときの、攻撃不能の時間（秒）。CONFIG.JAM_TIME にも置く
```

### 4.2 シールド敵（`shielder`）
- 距離460から接近し、保持距離 320〜380（ランダム）で静止（`phase: 'hover'`）。保持14秒のあと、前進（`phase: 'advance'`、通常の接近速度）
- **シールド**：`e.shielded`。接近の間は常に `true`。保持と前進の間は、周期 `cycle = 3.0` 秒の繰り返しで、周期の最初の `closedTime = 2.2` 秒が `true`（閉じている）、残り0.8秒が `false`（開いている）。閉じる前の `blinkTime = 0.3` 秒の間、`e.blink = true`（描画の予兆）。周期は保持に入った時点から数える
- 閉じている間に当たった弾は **吸収** される（§4.6）

### 4.3 テレポート敵（`teleporter`）
- 通常の接近速度で、まっすぐ距離を詰める
- `tpT = interval ± jitter`（3.0 ± 0.5秒）ごとに瞬間移動する。移動の `warn = 0.4` 秒前から `e.warn = true`（点滅の予兆）。移動先は、角度を `pickAngleOutside(現在の角度, minDelta = 30, rng)` で選び、**距離はそのまま**。移動した瞬間から `flash = 0.3` 秒の間、`e.flashWarp = true`（描画用）
- 中心に近づいても、届くまで移動を続ける

### 4.4 妨害電波敵（`jammer`）
- 距離460から接近し、保持距離 300〜360で静止（`hover`、±4度の揺れ）。`fireInterval = 5.0` 秒ごとに、**妨害電波（`jamShot`）を1発**、敵の角度・`dist − radius`・速さ `ENEMY_SHOT_SPEED` で放つ。保持14秒のあと、前進
- `jamShot` は撃ち落とせる（HP1）。撃破数に数えない

### 4.5 妨害電波の効果
- `jamShot` が中心（`HIT_RADIUS_CORE`）に届いたとき：**残機は減らない**。`turret.jam = CONFIG.JAM_TIME`（1.5秒）にして、その `jamShot` は消える。ノックバックはしない
- `turret.jam` が正の間、`tryFire` は `false` を返す（撃てない）。`updateTurret` で毎フレーム減る
- `resolveCoreHits` は `jamShot` を数えない（従来どおり、被弾させる敵だけを数える）。新しく `resolveJamHits(state): number`（届いた `jamShot` を消し、`turret.jam` を設定して、その数を返す）を足す。`stepGame` は `resolveJamHits(state) > 0` のとき、イベント `{ type: 'jam' }` を返す
- 表示：`turret.jam > 0` の間、自機の近くに「⚡ 妨害中」を点滅させる

### 4.6 吸収（シールドの当たり判定）
- `resolveBulletHits` は、当たった対象が `t.shielded === true` のとき、ダメージも貫通も無しで、弾を消す（`b.dead = true; break sweep`）。イベント `{ type: 'block', target, x, y }`
- 対象がシールドの敵でなくても、`shielded` が真なら同じ（ボスCのシールドにも使う）。ボスは従来どおり倍率を掛けない

## 5. 偽像（`decoy`）
- `behavior: 'decoy'`：動かない。基準の角度 `baseAngle` を中心に、±3度、`0.6Hz` で揺れる。生成時に `baseAngle`、揺れの位相 `spin` を持つ
- 1発で消える（HP1）。スコア0、撃破数に数えない。当たった弾は消える（貫通の残りがあれば通り抜ける。倒した扱い）
- 半径40：見た目の倍率（距離340で約1.44倍）をかけると、ボスの半径56と同じ見た目・当たり判定になる

## 6. ボスC（`js/game/boss-c.js`）：視界撹乱

### 6.1 パラメータ（`BOSS_C_BASE`、凍結。強化型は `params` で上書き）

| キー | 初期型（5面） | 強化型（6面）で上書き | 意味 |
| --- | --- | --- | --- |
| `hp` | 45 | 70 | |
| `radius` | 56 | | |
| `dist` | 340 | | 本体・偽像の距離 |
| `moveSpeed` | 28 | | 進入速度 |
| `decoyCount` | 2 | 3 | 偽像の数 |
| `layoutRange` | 70 | | 配置する角度の範囲（±度） |
| `minSep` | 30 | | 本体と偽像の角度の間隔（度、最小） |
| `sway` | 3 | | 待機中の揺れ（±度） |
| `swapInterval` | 6 | 4.5 | 入れ替えの間隔（秒） |
| `swapFlash` | 0.4 | | 入れ替えの前の点滅の時間 |
| `shieldInterval` | 10 | 8 | シールドを展開する間隔（秒） |
| `shieldTime` | 3 | | シールドの持続（秒） |
| `jamInterval` | 9 | 7 | 妨害電波の間隔（秒） |
| `score` | 7000 | | |

### 6.2 動き（`updateBossC(boss, state, dt)`）
1. **進入**：距離460から `dist` まで `moveSpeed` で進む。着いたら `phase = 'idle'`、最初の配置（`layout`）を行い、`swapT = swapInterval`、`shieldT = shieldInterval`、`jamT = jamInterval`
2. **配置（`layout`）**：`decoyCount + 1` 個の角度を `pickSpreadAngles(decoyCount + 1, minSep, rng, −layoutRange, +layoutRange)` で選ぶ。そのうちの1つ（ランダム）が本体（`boss.baseAngle`）、残りが偽像。前の偽像は全部消し（`dead = true`）、新しい偽像を `state.enemies` に足す（距離は `dist`、`decoy`）
3. **待機（idle）**：本体は `baseAngle` を中心に `sway` で揺れる。`swapT` が0になったら `phase = 'swap'`、`phaseT = swapFlash`
4. **入れ替え（swap）**：本体と偽像が点滅する（描画）。`phaseT` が0になったら、`layout` をやり直して `phase = 'idle'`、`swapT = swapInterval`
5. **シールド**：`shieldT` が0になったら、`boss.shielded = true`、`shieldActive = shieldTime`。`shieldActive` が0になったら `shielded = false`、`shieldT = shieldInterval`（idle・swap のどちらでも数える）
6. **妨害電波**：`jamT` が0になったら、`jamShot` を1発、本体の位置（`boss.angle`）・`dist − radius`・速さ `ENEMY_SHOT_SPEED` で放ち、`jamT = jamInterval`
- 本体は、通常のボスとして撃たれ、HPバーが減る。シールドの間は `block`
- 偽像に当たると偽像が消える（次の入れ替えで復活）

### 6.3 ミニマップ・描画
- ミニマップ：本体と偽像（`decoy`）を、同じ大きさ・同じ色のボスの点で描く（見分けがつかない）
- ボスC：丸い体と頭の飾り。シールドの間は、体のまわりに輪（バブル）。入れ替えの点滅の間は、本体と偽像が同時に点滅する
- 偽像は、ボスCと同じ見た目で描く（`decoy` の描画は `drawBossCBody` を共用する）

## 7. 最終ボス（計画B）と出現表の抽選（計画B）

### 7.1 最終ボス（`bossD`、`js/game/boss-d.js`）

**パラメータ（`BOSS_D_BASE`、凍結）**

| キー | 値 |
| --- | --- |
| `hp` | 90 |
| `radius` | 64 |
| `dist` | 340 |
| `moveSpeed` | 28 |
| `angleRange` / `drift` | 50 / 8 |
| `restTime` | 3.0（モードの合間） |
| `finalRatio` | 0.35（HPがこの割合以下で最終フェーズ） |
| `summonCount` | `[2, 3]`（1回の召喚の方向数） |
| `summonMinSep` | 25 |
| `summonVolleys` | 2（1モードでの召喚の回数）、`summonGap` 3.0 |
| `minionApproach` | 7 |
| `decoyCount` | 2、`decoyMinSep` 30、`decoyLifetime` 8 |
| `dash` | `{ dashCount: 1, dashTime: 2.8, dashBreak: 6, settle: 0.5, telegraph: 1.0, vanish: 0.8, reappearDist: 440, reappearMargin: 15, roarTime: 2.2, roarMult: 1.5 }` |
| `finalSummonInterval` | 6（最終フェーズの召喚、2方向） |
| `finalDashInterval` | 7 |
| `score` | 10000 |

**モード**（最終フェーズより前）：`'rest'`（3.0秒）→ 次のモードを、前回と同じにならないようにランダムに選ぶ：
- `'summon'`：ボスAの召喚を弱くしたもの。`summonVolleys` 回、`summonGap` 秒おきに、`summonCount` の範囲の方向数の子機（`bossMinion`、到達 `minionApproach` 秒）を出す。最後の1回のあと2秒で `'rest'`
- `'dash'`：ボスBの瞬間突進を1回。内部に、ボスBのオブジェクト（`createBossB`、`dash` のパラメータ、`scatterInterval` は無限大）を持ち、`updateBossB` を呼んで進める。ボスDの `hidden` / `angle` / `dist` / `damageMult` / `hitCore` を、内部のボスBに合わせる（毎フレーム、更新の前にボスDの `damageTaken` を内部のボスBに写し、更新のあとに逆方向を写す）。内部のボスBが `'idle'` に戻ったら（突進と咆哮が終わったら）`'rest'`。ボスDの `phase` は、この間は内部の `phase`（`telegraph` / `vanish` / `settle` / `dash` / `roar`）にする（描画・警告のため）
- `'decoy'`：ボスCの偽像。`decoyCount` 体の偽像を、ボスの角度から `decoyMinSep` 以上離して出し、`decoyLifetime` 秒後に消して `'rest'`（撃たれて消えても、そのまま待つ）

**最終フェーズ**（`hp ≤ maxHp × finalRatio`）：モードの切り替えをやめ、次を**同時**に行う：
- 召喚：`finalSummonInterval` 秒ごとに、2方向の子機
- 偽像：常に `decoyCount` 体を保つ（消えたら2秒後に補充）
- 突進：`finalDashInterval` 秒ごとに、突進を1回（内部のボスBを使う。突進中も召喚・偽像は続く）

**待機（突進中を除く）の動き**：ボスAと同じく `angleRange` の範囲で左右に往復する。

- 6ボスの識別攻撃をすべて使うので、ボスDは中心に届く突進以外では、残機を奪わない（召喚・偽像は敵として撃てる）

**描画**：3ボスの特徴（角、飾り、大きな目）を合わせた見た目。金色。突進の予兆・咆哮は、ボスBと同じ表現を使う。

### 7.2 出現表の抽選（`pool`）
- `spawns` の値に、`{ every, pool: ['meteor', 'drone', …], formation: { count: [3, 4], minSep: 25 } }` を許す
- 抽選：**袋方式**。袋が空のとき、`pool` の全種類をシャッフル（`state.rng`、フィッシャー–イェーツ）して袋に入れ、`every` 秒ごとに1つ取り出す。取り出した種類が `formationDrone` なら、`formation` の設定で編隊を出す。それ以外は、1体を出す。全種類が1周するまで、同じ種類は出ない。袋の状態は、区間・タイマーのキーごとに持つ
- `every` に `SPAWN_SCALE` を掛けるのは、他の項目と同じ
- 検査（`validateStage`）：`pool` は空でない配列、各種類が `ENEMY_DEFS` にある、`formationDrone` を含むときは `formation` が必要
- 全テーマの敵を偏りなくランダムに出す7面で使う

## 8. 5〜7面のデータ（数値は仮。表の値は、`SPAWN_SCALE` を掛ける前の値）

```js
// STAGE5「防衛拠点・電子戦エリア」（125秒）
seg 0–20   : meteor 3.0, drone 10, shielder 12
seg 20–55  : meteor 2.8, drone 10, burrower 12, shielder 10, teleporter 12
seg 55–95  : meteor 2.6, drone 9, thrower 14, shielder 9, teleporter 10, formationDrone { every: 18, count: 3, minSep: 25 }
seg 95–125 : meteor 2.4, drone 9, burrower 11, thrower 12, shielder 8, teleporter 9, formationDrone { every: 14, count: [3, 4], minSep: 25 }
spawnEnd 125 / boss: bossC 初期型 { params: {} }

// STAGE6「防衛拠点・最終防衛線」（135秒）
seg 0–20   : meteor 3.0, shielder 12, teleporter 14, jammer 16
seg 20–55  : meteor 2.8, drone 10, burrower 12, shielder 10, teleporter 11, jammer 14
seg 55–95  : meteor 2.6, thrower 14, shielder 9, teleporter 10, jammer 12, charger 14, formationDrone { every: 18, count: 3, minSep: 25 }
seg 95–135 : meteor 2.4, burrower 12, thrower 12, shielder 8, teleporter 9, jammer 10, charger 12, formationDrone { every: 14, count: [3, 4], minSep: 25 }
spawnEnd 135 / boss: bossC 強化型 { hp: 70, decoyCount: 3, swapInterval: 4.5, shieldInterval: 8, jamInterval: 7, color: '#ff9fd0' }

// STAGE7「隕石本体・核心部」（110秒）：全区間で pool
seg 0–30   : pool { every: 1.6, types: [meteor, drone, formationDrone, burrower, thrower, charger, shielder, teleporter, jammer], formation: { count: 3, minSep: 25 } }
seg 30–70  : 同じ types、every 1.4（formation の count は [3, 4]）
seg 70–110 : 同じ types、every 1.2（formation の count は [3, 4]）
spawnEnd 110 / boss: bossD { params: {} }
```
- 各面の `name`：「防衛拠点・電子戦エリア」「防衛拠点・最終防衛線」「隕石本体・核心部」
- `STAGES` に `5, 6, 7` を足す（計画Aで5・6、計画Bで7）。7面のクリアで解放される次の面は無い（`nextPlayableStage` は `null`）
- README の「準備中」の記述を更新する

## 9. テスト（要点）
- **難易度調整**：§2の各値。1面〜4面の自動操縦が（合格率で）通る
- **整備**：ボスの登録（既定の色、`boss.color`、未知の種類）／`pickAngleOutside`（区間、優先、区間なしの場合）／`pickHiddenAngle` が同じ結果を返す／`ENEMY_INITS` の分割で乱数の消費順が変わらない（同じシードで同じ敵の値）／区間ごとのタイマー（区間に入ってから `every` 後に最初の出現、前の区間の余りを引き継がない）／`pool` は計画B
- **妨害テーマの敵**：シールド（閉じている間は弾を吸収し、ダメージなし／開いている間はダメージ／周期／点滅）、テレポート（間隔、角度差30度以上、距離が変わらない、予兆）、妨害電波（`jamShot` の発射間隔、届くと残機が減らず `turret.jam` が1.5になる、`tryFire` が止まる、`jam` イベント、時間で回復）
- **偽像**：揺れ、1発で消える、スコア・撃破数に影響しない
- **ボスC**：進入→配置、配置の角度の間隔と範囲、入れ替えで本体の位置が変わる（偽像が復活する）、シールドの間は無敵（`block`）、妨害電波、HPが減る、偽像を撃っても本体のHPが減らない
- **描画**：新しい敵・ボスCがNodeの動作確認でエラーなく描け、ブラウザで区別がつく
- **ステージ**：5・6面が `validateStage` を通る、6面にだけ妨害電波敵、シールド・テレポートは5面から
- **自動操縦**：5〜6面を合格率でクリア（数値は仮なので、テストのために調整してよい範囲は各計画に書く）。自動操縦の関数は、シールドが閉じている敵を狙わない

## 10. 未確定・後回し
- 5〜7面・最終ボスの数値の実プレイ調整
- 偽像の見た目の目印（区別がつかなすぎるときに足す）
- 全クリア後の演出（④）
