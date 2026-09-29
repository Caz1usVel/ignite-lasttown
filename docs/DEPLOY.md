# GitHub Pages への公開手順

ユーザー（あなた）が行う手順。ワークフロー（`.github/workflows/pages.yml`）は用意済み。

## 手順

1. GitHub でリポジトリを作る（README・.gitignore・ライセンスは追加せず、空のまま）
2. このフォルダで、リモートを設定して push する
   ```bash
   git remote add origin <リポジトリのURL>
   git push -u origin master
   ```
3. リポジトリの Settings → Pages → Source を「GitHub Actions」にする
4. `master` への push（または Actions タブからの手動実行）で、ワークフローが走る。テスト（`npm test`）と機械チェック（`node tools/check.mjs`）が通ると、公開される。公開 URL は、Actions の実行結果（deploy ジョブ）に出る

## 公開前のチェックリスト

- [ ] `npm test` が全て通る
- [ ] `npm run check` が全て通る
- [ ] ブラウザで、1面〜7面、エンドレス（通常・ハード）、日記を通して遊ぶ
- [ ] スマホ（タッチ操作）で、旋回・発射・パワーアップの選択・ポーズを確認する
- [ ] Google Fonts は外部（Google のサーバー）から読み込まれる。オフラインや、読み込みを止める環境では、フォントが代替になる。外部読み込みを避けたい場合は、フォントを同梱するか、読み込みをやめる

## 公開しないもの

`docs/`、`tests/`、`tools/`、`.superpowers/` は、公開用の `_site` にコピーしない（ワークフローの `cp` の対象は `index.html`、`css`、`js`、`bgm`、`se` だけ）。
