import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEnemy, updateEnemies, removeDead, ENEMY_DEFS, DRONE, ENEMY_SHOT_SPEED } from '../js/game/enemies.js';
import { mulberry32 } from '../js/core/util.js';
import { CONFIG } from '../js/core/config.js';

// 分割前の実装で得た createEnemy(type, 10, mulberry32(seed)) の JSON
const GOLDENS = {
  "meteor@1": "{\"type\":\"meteor\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":22,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887}",
  "meteor@2": "{\"type\":\"meteor\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":22,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543}",
  "meteor@3": "{\"type\":\"meteor\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":22,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708}",
  "drone@1": "{\"type\":\"drone\",\"angle\":10,\"dist\":460,\"hp\":2,\"radius\":24,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887,\"phase\":\"approach\",\"holdDist\":342.1957631967962,\"baseAngle\":10,\"hoverT\":0,\"fireT\":4.5}",
  "drone@2": "{\"type\":\"drone\",\"angle\":10,\"dist\":460,\"hp\":2,\"radius\":24,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543,\"phase\":\"approach\",\"holdDist\":322.8236844204366,\"baseAngle\":10,\"hoverT\":0,\"fireT\":4.5}",
  "drone@3": "{\"type\":\"drone\",\"angle\":10,\"dist\":460,\"hp\":2,\"radius\":24,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708,\"phase\":\"approach\",\"holdDist\":336.4953754097223,\"baseAngle\":10,\"hoverT\":0,\"fireT\":4.5}",
  "burrower@1": "{\"type\":\"burrower\",\"angle\":10,\"dist\":322.1957631967962,\"hp\":1,\"radius\":12,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887,\"phase\":\"burrowed\",\"burrowT\":3.481050967471674}",
  "burrower@2": "{\"type\":\"burrower\",\"angle\":10,\"dist\":302.8236844204366,\"hp\":1,\"radius\":12,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543,\"phase\":\"burrowed\",\"burrowT\":3.037955157458782}",
  "burrower@3": "{\"type\":\"burrower\",\"angle\":10,\"dist\":316.4953754097223,\"hp\":1,\"radius\":12,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708,\"phase\":\"burrowed\",\"burrowT\":2.5749280096497387}",
  "thrower@1": "{\"type\":\"thrower\",\"angle\":10,\"dist\":460,\"hp\":3,\"radius\":26,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887,\"phase\":\"approach\",\"holdDist\":331.64682239759713,\"baseAngle\":10,\"hoverT\":0,\"fireT\":5}",
  "thrower@2": "{\"type\":\"thrower\",\"angle\":10,\"dist\":460,\"hp\":3,\"radius\":26,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543,\"phase\":\"approach\",\"holdDist\":317.11776331532747,\"baseAngle\":10,\"hoverT\":0,\"fireT\":5}",
  "thrower@3": "{\"type\":\"thrower\",\"angle\":10,\"dist\":460,\"hp\":3,\"radius\":26,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708,\"phase\":\"approach\",\"holdDist\":327.37153155729175,\"baseAngle\":10,\"hoverT\":0,\"fireT\":5}",
  "charger@1": "{\"type\":\"charger\",\"angle\":10,\"dist\":440,\"hp\":2,\"radius\":24,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887,\"phase\":\"wait\",\"waitT\":1.5}",
  "charger@2": "{\"type\":\"charger\",\"angle\":10,\"dist\":440,\"hp\":2,\"radius\":24,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543,\"phase\":\"wait\",\"waitT\":1.5}",
  "charger@3": "{\"type\":\"charger\",\"angle\":10,\"dist\":440,\"hp\":2,\"radius\":24,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708,\"phase\":\"wait\",\"waitT\":1.5}",
  "shard@1": "{\"type\":\"shard\",\"angle\":30,\"dist\":300,\"hp\":1,\"radius\":10,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887,\"baseAngle\":10,\"offset\":20,\"startDist\":300}",
  "shard@2": "{\"type\":\"shard\",\"angle\":30,\"dist\":300,\"hp\":1,\"radius\":10,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543,\"baseAngle\":10,\"offset\":20,\"startDist\":300}",
  "shard@3": "{\"type\":\"shard\",\"angle\":30,\"dist\":300,\"hp\":1,\"radius\":10,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708,\"baseAngle\":10,\"offset\":20,\"startDist\":300}",
  "enemyShot@1": "{\"type\":\"enemyShot\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":9,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887}",
  "enemyShot@2": "{\"type\":\"enemyShot\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":9,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543}",
  "enemyShot@3": "{\"type\":\"enemyShot\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":9,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708}",
  "bossMinion@1": "{\"type\":\"bossMinion\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":15,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887}",
  "bossMinion@2": "{\"type\":\"bossMinion\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":15,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543}",
  "bossMinion@3": "{\"type\":\"bossMinion\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":15,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708}",
  "formationDrone@1": "{\"type\":\"formationDrone\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":16,\"speed\":31.650554646907803,\"t\":0,\"dead\":false,\"spin\":0.017189043124069887}",
  "formationDrone@2": "{\"type\":\"formationDrone\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":16,\"speed\":30.699711905676143,\"t\":0,\"dead\":false,\"spin\":2.0420253747133543}",
  "formationDrone@3": "{\"type\":\"formationDrone\",\"angle\":10,\"dist\":460,\"hp\":1,\"radius\":16,\"speed\":30.820868625983568,\"t\":0,\"dead\":false,\"spin\":0.24292151888489708}"
};

const mkState = () => ({ enemies: [], rng: mulberry32(7) });

test('隕石は接近時間の基準±15%で中心に届く速さ', () => {
  const rng = mulberry32(3);
  const lo = CONFIG.APPROACH_TIME * (1 - CONFIG.APPROACH_JITTER);
  const hi = CONFIG.APPROACH_TIME * (1 + CONFIG.APPROACH_JITTER);
  for (let i = 0; i < 50; i++) {
    const e = createEnemy('meteor', 0, rng);
    assert.equal(e.dist, 460);
    assert.equal(e.hp, 1);
    const time = 460 / e.speed;
    assert.ok(time >= lo - 1e-9 && time <= hi + 1e-9, `time=${time}`);
  }
});

test('共通調整の値：接近時間14秒、敵弾85、自弾 900/2200（連射・旋回・残機は据え置き）', () => {
  assert.equal(CONFIG.APPROACH_TIME, 14);
  assert.equal(ENEMY_SHOT_SPEED, 85);
  assert.equal(CONFIG.BULLET_SPEED_PC, 900);
  assert.equal(CONFIG.BULLET_SPEED_MOBILE, 2200);
  assert.equal(CONFIG.FIRE_RATE, 4);
  assert.equal(CONFIG.TURN_SPEED, 90);
  assert.equal(CONFIG.LIVES, 3);
});

test('隕石は直進する', () => {
  const s = mkState();
  const e = createEnemy('meteor', 10, s.rng, { speed: 50 });
  s.enemies.push(e);
  updateEnemies(s, 1);
  assert.equal(e.dist, 410);
  assert.equal(e.angle, 10);
});

test('ドローンは接近→ホバリング→4.5秒ごとに撃つ→15秒後に再接近', () => {
  const s = mkState();
  const d = createEnemy('drone', 20, s.rng);
  assert.equal(d.hp, 2);
  assert.ok(d.holdDist >= DRONE.holdMin && d.holdDist <= DRONE.holdMax);
  s.enemies.push(d);
  const dt = 1 / 60;
  while (d.phase === 'approach') updateEnemies(s, dt);
  assert.equal(d.phase, 'hover');
  assert.equal(d.dist, d.holdDist);

  for (let i = 0; i < Math.round((DRONE.fireInterval + 0.1) / dt); i++) updateEnemies(s, dt);
  const shots = s.enemies.filter((e) => e.type === 'enemyShot');
  assert.equal(shots.length, 1);
  assert.equal(shots[0].speed, ENEMY_SHOT_SPEED);
  assert.ok(Math.abs(d.angle - 20) <= DRONE.sway + 1e-9);

  for (let i = 0; i < Math.round((15.6 - DRONE.fireInterval - 0.1) / dt); i++) updateEnemies(s, dt);
  assert.equal(d.phase, 'advance');
  const before = d.dist;
  updateEnemies(s, 1);
  assert.ok(d.dist < before);
});

test('未知の敵タイプは例外', () => {
  assert.throws(() => createEnemy('nope', 0, mulberry32(1)));
});

test('敵弾は撃破数に数えない', () => {
  assert.equal(ENEMY_DEFS.enemyShot.countsAsKill, false);
  assert.equal(ENEMY_DEFS.meteor.countsAsKill, true);
});

test('removeDead は dead を取り除く', () => {
  const list = [{ dead: false }, { dead: true }, { dead: false }];
  removeDead(list);
  assert.equal(list.length, 2);
});

test('敵の初期化を表に移しても、同じシードで同じ初期値になる（乱数の消費順が変わらない）', () => {
  const snap = (type, seed, opts = {}) => JSON.stringify(createEnemy(type, 10, mulberry32(seed), opts));
  for (const [key, expected] of Object.entries(GOLDENS)) {
    const [type, seed] = key.split('@');
    assert.equal(snap(type, Number(seed), type === 'shard' ? { offset: 20, dist: 300 } : {}), expected, key);
  }
});
