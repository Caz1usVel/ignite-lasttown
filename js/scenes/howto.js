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
