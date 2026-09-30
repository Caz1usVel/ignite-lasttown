// Twitch サブスク向けなどの配布コード → スキンID。行を1本足すだけでコードを増やせる。
// 前作と同様、推測されにくいランダムな英数字（8文字、4文字-4文字のハイフン区切り）を使う。
// コードは常に大文字・ハイフン無視で比較する（入力側で正規化する）。
// 以下は配布用の本番コード。コードを増やす・差し替えるときは、同じ形式のランダムな値を使う。
export const CODE_TO_SKIN = Object.freeze({
  'ZF8K-3RTN': 'crimson-vanguard',
  'H6D2-YK9P': 'violet-thunder',
  'T3M8-BQ4X': 'frostbite-silver',
  'R7L2-GN5W': 'celestial-gold',
});
