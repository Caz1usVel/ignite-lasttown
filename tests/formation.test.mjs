import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFormation } from '../js/game/formation.js';
import { ENEMY_DEFS } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';

test('formationDrone の定義：HP1・半径16・50点・撃破数に数える・直進', () => {
  assert.deepEqual(ENEMY_DEFS.formationDrone, {
    hp: 1, radius: 16, score: 50, countsAsKill: true, behavior: 'straight',
  });
});

test('編隊：機数どおり、種類・距離・HPが正しい', () => {
  for (const n of [1, 3, 4, 5]) {
    const f = createFormation('formationDrone', n, 25, mulberry32(n));
    assert.equal(f.length, n);
    for (const e of f) {
      assert.equal(e.type, 'formationDrone');
      assert.equal(e.dist, 460);
      assert.equal(e.hp, 1);
    }
  }
});

test('編隊：角度は-90〜+90度で、互いに minSep 以上離れる', () => {
  for (let seed = 1; seed <= 200; seed++) {
    for (const n of [3, 4, 5]) {
      const angles = createFormation('formationDrone', n, 25, mulberry32(seed)).map((e) => e.angle).sort((a, b) => a - b);
      for (let i = 0; i < angles.length; i++) {
        assert.ok(angles[i] >= -90 && angles[i] <= 90, `angle ${angles[i]}`);
        if (i > 0) assert.ok(angles[i] - angles[i - 1] >= 25 - 1e-9, `gap ${angles[i] - angles[i - 1]} (n=${n}, seed=${seed})`);
      }
    }
  }
});

test('編隊：ほぼ同時に中心へ届く（到達時間の差が1.5秒未満、8.5〜11.5秒の範囲）', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const times = createFormation('formationDrone', 5, 25, mulberry32(seed)).map((e) => e.dist / e.speed);
    assert.ok(Math.max(...times) - Math.min(...times) < 1.5, `spread ${Math.max(...times) - Math.min(...times)}`);
    for (const t of times) assert.ok(t >= 8.5 - 0.35 && t <= 11.5 + 0.35, `t=${t}`);
  }
});

test('編隊：同じシードなら同じ結果', () => {
  const a = createFormation('formationDrone', 4, 25, mulberry32(42)).map((e) => [e.angle, e.speed]);
  const b = createFormation('formationDrone', 4, 25, mulberry32(42)).map((e) => [e.angle, e.speed]);
  assert.deepEqual(a, b);
});
