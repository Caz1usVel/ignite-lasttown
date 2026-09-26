// キー・マウス・タッチを1か所で扱う。ポインターは pointerId ごとに追跡する（旋回ボタンと発射の同時押し）。
const TURN_LEFT = ['ArrowLeft', 'KeyA'];
const TURN_RIGHT = ['ArrowRight', 'KeyD'];

export function createInput(canvas, viewport, leftBtn, rightBtn) {
  const keys = new Set();
  const firePointers = new Map(); // pointerId -> 仮想座標
  const turnPointers = { left: new Set(), right: new Set() };
  let mouse = null;
  let lastType = window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse';

  const input = {
    onPause: null,
    turnAxis() {
      const l = TURN_LEFT.some((k) => keys.has(k)) || turnPointers.left.size > 0;
      const r = TURN_RIGHT.some((k) => keys.has(k)) || turnPointers.right.size > 0;
      return (r ? 1 : 0) - (l ? 1 : 0);
    },
    isFiring() {
      return firePointers.size > 0;
    },
    aim() {
      let last = null;
      for (const p of firePointers.values()) last = p;
      return last ?? mouse;
    },
    isTouch() {
      return lastType === 'touch';
    },
    notePointer(e) {
      if (e.pointerType) lastType = e.pointerType;
    },
    reset() {
      keys.clear();
      firePointers.clear();
      turnPointers.left.clear();
      turnPointers.right.clear();
      leftBtn.classList.remove('active');
      rightBtn.classList.remove('active');
    },
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (!e.repeat) input.onPause?.();
      return;
    }
    if (TURN_LEFT.includes(e.code) || TURN_RIGHT.includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => input.reset());

  canvas.addEventListener('pointerdown', (e) => {
    input.notePointer(e);
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    canvas.setPointerCapture?.(e.pointerId);
    firePointers.set(e.pointerId, viewport.toVirtual(e.clientX, e.clientY));
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = viewport.toVirtual(e.clientX, e.clientY);
    if (e.pointerType === 'mouse') mouse = p;
    if (firePointers.has(e.pointerId)) firePointers.set(e.pointerId, p);
  });
  const endFire = (e) => firePointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', endFire);
  canvas.addEventListener('pointercancel', endFire);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function bindTurn(btn, set) {
    btn.addEventListener('pointerdown', (e) => {
      input.notePointer(e);
      btn.setPointerCapture?.(e.pointerId);
      set.add(e.pointerId);
      btn.classList.add('active');
      e.preventDefault();
    });
    const end = (e) => {
      set.delete(e.pointerId);
      if (set.size === 0) btn.classList.remove('active');
    };
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);
    btn.addEventListener('lostpointercapture', end);
  }
  bindTurn(leftBtn, turnPointers.left);
  bindTurn(rightBtn, turnPointers.right);

  return input;
}
