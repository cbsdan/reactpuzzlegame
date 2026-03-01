/* ── Game Constants ──────────────────────────────────── */
export const GAME_DURATION = 2700; // 45 min countdown
export const TRASH_SLOW_DURATION = 7; // seconds of slowed movement after trash
export const TRASH_SHAKE_DURATION = 1; // seconds of camera shake after trash
export const SLOW_FACTOR = 0.4; // movement multiplier during slow
// Score points per stage (indexed 0–6): easy stages low, hard stages high
export const STAGE_MAX_SCORES = [100, 150, 250, 400, 600, 800, 1000];

// Per-stage time penalties (indexed by stage 0–6): increases each stage
export const STAGE_WRONG_TIME_PENALTY = [15, 20, 25, 30, 35, 40, 45]; // seconds deducted per wrong answer
export const STAGE_TRASH_TIME_PENALTY = [5, 8, 12, 15, 20, 25, 30]; // seconds deducted per trash interaction

export const INTERACT_DIST = 3.5;
export const MOVE_SPEED = 8;
export const TURN_SPEED = 3;
export const BOUNDARY = 18;
export const CART_POS = [0, 0, -10];
export const CART_INTERACT_DIST = 4;
export const DASH_SPEED = 22;
export const DASH_DURATION = 0.25; // seconds
export const DASH_COOLDOWN = 1.5; // seconds
export const JUMP_COOLDOWN = 1.5; // seconds
export const JUMP_HEIGHT = 2.5;
export const JUMP_DURATION = 0.5; // seconds
export const PUSH_DIST = 2;
export const PUSH_FORCE = 18;
export const POSITION_SYNC_MS = 150;
export const TOTAL_STAGES = 7;
export const STAGE_MAX_SCORE = 1000;

export const PLAYER_COLORS = [
  0xff6b6b, 0x48dbfb, 0xfeca57, 0xff9ff3, 0x54a0ff, 0x5f27cd, 0x01a3a4,
  0xf368e0,
];

/* ── Wall layout — maze style ───────────────────────── */
export const WALL_SEGMENTS = [
  // Perimeter walls (match BOUNDARY=18)
  { x: 0,   z: -18, w: 38, d: 1.2, h: 3.2 },
  { x: 0,   z:  18, w: 38, d: 1.2, h: 3.2 },
  { x: -18, z:   0, w: 1.2, d: 38, h: 3.2 },
  { x:  18, z:   0, w: 1.2, d: 38, h: 3.2 },
  // ── Interior corridors (trimmed to fit ~±15) ──
  { x: -10, z:  -8, w:  8, d: 0.6, h: 2.6 },
  { x:   8, z:  -8, w:  8, d: 0.6, h: 2.6 },
  { x: -10, z:   8, w:  8, d: 0.6, h: 2.6 },
  { x:   8, z:   8, w:  8, d: 0.6, h: 2.6 },
  { x: -10, z:   0, w: 0.6, d: 16, h: 2.6 },
  { x:  10, z:  -2, w: 0.6, d: 12, h: 2.6 },
  { x:  -2, z:  -4, w:  6, d: 0.6, h: 2.6 },
  { x:   2, z:   4, w:  6, d: 0.6, h: 2.6 },
];
