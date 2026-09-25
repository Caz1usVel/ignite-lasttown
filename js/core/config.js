// プロトタイプ検証で確定したパラメータと、①の初期値。数値はここだけで持つ。
export const GAME_TITLE = '防衛砲台（仮）';

export const CONFIG = Object.freeze({
  VIRTUAL_SIZE: 1000,
  CENTER_X: 500,
  CENTER_Y: 500,

  FOV: 70,              // 度
  TURN_SPEED: 90,       // 度/秒
  HEADING_LIMIT: 90,    // ±度（敵の出現範囲も同じ）

  SPAWN_DIST: 460,
  APPROACH_TIME: 10,    // 秒
  APPROACH_JITTER: 0.15,

  BULLET_SPEED_PC: 600,
  BULLET_SPEED_MOBILE: 1500,
  BULLET_RADIUS: 6,
  BULLET_MAX_DIST: 520,
  FIRE_RATE: 4,         // 発/秒

  LIVES: 3,
  INVINCIBLE_TIME: 1.5,
  HIT_RADIUS_CORE: 40,
  KNOCKBACK_RADIUS: 200,
  KNOCKBACK_DIST: 80,
  HITBOX_RATIO: 0.65,

  DT_MAX: 0.05,
  DPR_MAX: 2,
});
