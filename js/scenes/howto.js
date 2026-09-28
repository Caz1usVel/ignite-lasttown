import { drawBackground } from '../render/background.js';

// 基本コンセプトのページだけに出す、簡単な図解（視界の扇形・見える敵/見えない敵・旋回の向き）
const CONCEPT_DIAGRAM = `
<svg viewBox="0 0 260 175" xmlns="http://www.w3.org/2000/svg">
  <path d="M130,150 L55,44 A130,130 0 0 1 205,44 Z" fill="rgba(95,227,208,0.16)" stroke="#5fe3d0" stroke-width="1.5"/>
  <text x="130" y="30" text-anchor="middle" font-size="10" fill="#5fe3d0">視界（明るい範囲）</text>
  <circle cx="130" cy="94" r="8" fill="#ff9ecb"/>
  <text x="130" y="76" text-anchor="middle" font-size="10" fill="#f4f2ff">見える敵</text>
  <circle cx="32" cy="118" r="8" fill="#555b78"/>
  <text x="32" y="140" text-anchor="middle" font-size="10" fill="#9aa2c9">見えない敵</text>
  <rect x="123" y="120" width="14" height="26" rx="3" fill="#ffd866"/>
  <circle cx="130" cy="152" r="12" fill="#bfe6ff"/>
  <text x="130" y="172" text-anchor="middle" font-size="10" fill="#9aa2c9">◀ 旋回 ▶</text>
</svg>`;

// 遊び方（タイトルの「遊び方」から、いつでも見られる。初回はタイトルより先に強制で開く）
const SLIDES = [
  {
    title: '① 基本コンセプト',
    diagram: CONCEPT_DIAGRAM,
    body: '砲台は画面の中心に固定されていて、位置を動かすことはできません。できるのは「旋回」だけです。旋回して視界（明るい扇形の範囲）の向きを変え、その中に入ってきた敵だけを狙って撃ちます。視界の外にいる敵は、狙うことも撃つこともできません。',
  },
  {
    title: '② 操作方法（PC）',
    body: '旋回：A/D キー、または ←→ キー。\n照準・発射：マウスを動かして狙い、クリックで発射。\n長押し：クリックしたままにすると、連射になります。',
  },
  {
    title: '③ 操作方法（スマホ）',
    body: '旋回：画面下の ◀ ▶ ボタン。\n照準・発射：狙いたい敵をタップすると、その方向へ発射します。\n長押し：タップしたままにすると、連射になります。',
  },
  {
    title: '④ 画面の見方',
    body: '左上のハートは残機です（0になると終了）。\nスコアは右上、経過時間は下部のタイマーに表示されます。\n中央の明るい扇形が「視界」で、旋回すると向きが変わります。\n空が赤くなっている間は、ボスなど強い敵が出ている「危険」な状態です。\n敵を10体倒すごとに、パワーアップを2択で選べる通知が出ます。\nミニマップ（画面上部）には、視界の外の敵も点で映ります。',
  },
  {
    title: '⑤ 2人協力プレイの役割分担',
    body: '1P（プレイヤー1）は旋回だけを担当します（A/D または ←→ キー）。\n2P（プレイヤー2）はマウスで狙って発射だけを担当します。\n1人が視界を合わせ、もう1人が狩る、という役割分担のプレイです。',
  },
  {
    title: '⑥ モード紹介',
    body: '全7ステージ：決められた敵の出現パターンをクリアしていく、通常のモードです。クリアすると、その面の日記が1つ解放されます（全7面クリアで、日記も全て解放）。\n通常エンドレス：時間とともに敵が増えていく、終わりのないモードです。\nハードエンドレス：全7ステージをクリアすると解放される、より難しいエンドレスです。',
  },
  {
    title: '⑦ 攻略のコツ',
    body: '旋回できる範囲は、前方180度（左右90度ずつ）だけです。背後には旋回そのものができないので、早めに旋回して広く見渡し、敵の出現に早く気づくことが大切です。\nパワーアップには系統（火力・連射・防御・回復など）があります。状況に応じて得意な系統を選ぶと、立ち回りやすくなります。',
  },
];

export function createHowtoScene(app) {
  const { dom } = app;
  let index = 0;
  let forced = false;

  function render() {
    const slide = SLIDES[index];
    dom.howtoTitle.textContent = slide.title;
    dom.howtoDiagram.innerHTML = slide.diagram ?? '';
    dom.howtoDiagram.classList.toggle('hidden', !slide.diagram);
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
