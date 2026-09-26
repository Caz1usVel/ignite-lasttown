// プロトタイプ検証で確定したパラメータと、①の初期値。数値はここだけで持つ。
export const GAME_TITLE = '防衛砲台（仮）';

export const CONFIG = Object.freeze({
  VIRTUAL_SIZE: 1000,
  CENTER_X: 500,
  CENTER_Y: 900,        // 砲台は画面の下寄り（上に広く使う）
  VERT_SCALE: 1.5,      // 縦方向だけ引き伸ばす（横は 距離=ピクセルのまま）。奥行きを広く見せる

  FOV: 70,              // 度
  TURN_SPEED: 90,       // 度/秒
  HEADING_LIMIT: 90,    // ±度（敵の出現範囲も同じ）

  SPAWN_DIST: 460,
  APPROACH_TIME: 10,    // 秒（縦を引き伸ばして見つけやすくしたので、14秒から10秒に戻した）
  APPROACH_JITTER: 0.15,
  MAX_ACTIVE: 5,        // 同時に画面にいる敵（本体）の上限。いっぱいの間は新しく出ない
  SPAWN_SCALE: 1.35,    // 全ステージの出現間隔に掛ける（実プレイで「物量が多い」ため、薄くした）

  BULLET_SPEED_PC: 900,      // 飛ぶ速さだけを上げた（連射速度は据え置き）
  BULLET_SPEED_MOBILE: 2200,
  BULLET_RADIUS: 6,
  BULLET_MAX_DIST: 520,
  FIRE_RATE: 4,         // 発/秒

  LIVES: 3,
  INVINCIBLE_TIME: 1.5,
  HIT_RADIUS_CORE: 40,
  KNOCKBACK_RADIUS: 200,
  KNOCKBACK_DIST: 80,
  HITBOX_RATIO: 0.65,
  FAR_SCALE: 0.6,       // 遠い敵ほど大きく描く（出現距離で 1+FAR_SCALE 倍、当たり判定も同じ倍率）
  SHOT_PENALTY: 50,     // 敵の弾が中心に届いたときの減点（残機は減らない。スコアは0未満にならない）
  JAM_TIME: 1.5,        // 妨害電波が届いたとき、攻撃できなくなる時間（秒）

  DT_MAX: 0.05,
  DPR_MAX: 2,
  STAGE_COUNT: 7,
});
