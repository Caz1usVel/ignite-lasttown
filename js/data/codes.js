// Twitch サブスク向けなどの配布コード → スキンID。行を1本足すだけでコードを増やせる。
// 前作と同様、推測されにくいランダムな英数字（8文字、4文字-4文字のハイフン区切り）を使う。
// コードは常に大文字・ハイフン無視で比較する（入力側で正規化する）。
// 以下はテスト用の仮コード。実際の配布コードに差し替える。
export const CODE_TO_SKIN = Object.freeze({
  'K3H7-QX2M': 'code-crimson',
  'P9R4-VB6L': 'code-violet',
  'ZF8K-3RTN': 'crimson-vanguard',
  'H6D2-YK9P': 'violet-thunder',
  'T3M8-BQ4X': 'frostbite-silver',
  'R7L2-GN5W': 'celestial-gold',
});
