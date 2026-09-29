import { SKINS, isSkinUnlocked, redeemCode } from '../data/skins.js';
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
      if (skin.unlock.type === 'code' && !unlocked) continue; // 配布コード限定スキンは、コードを入れるまでアイコンごと隠す
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'skin-swatch' + (skin.id === app.save.selectedSkinId ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.dataset.id = skin.id;
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

  dom.skinCodeRedeemBtn.addEventListener('click', () => {
    const raw = dom.skinCodeInput.value;
    dom.skinCodeInput.value = '';
    const result = redeemCode(app.save, raw);
    if (result.status === 'empty') return;
    if (result.status === 'unknown') {
      dom.skinCodeStatus.textContent = 'そのコードは見つかりませんでした';
      return;
    }
    const skin = SKINS.find((s) => s.id === result.skinId);
    if (result.status === 'already') {
      dom.skinCodeStatus.textContent = `「${skin?.name ?? ''}」はすでに解放済みです`;
      return;
    }
    app.persist();
    dom.skinCodeStatus.textContent = `「${skin?.name ?? ''}」を解放しました！`;
    build(); // 解放されたスキンを選べるように、一覧を作り直す
    if (skin) select(skin, true);
  });

  return {
    enter() {
      build();
      dom.skinCodeStatus.textContent = '';
      dom.skinCodeInput.value = '';
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
