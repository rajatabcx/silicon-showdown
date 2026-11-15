import type { MoveDef, MoveKey } from './types';

export const FPS = 60;
export const ROUND_FRAMES = 60 * FPS;
export const STAGE_HALF = 7;
export const START_X = 2.4;
export const GRAVITY = 0.0105;
export const WALK_SCALE = 0.022;
export const JUMP_SCALE = 0.025;
export const BODY_WIDTH = 0.8;

export const INTRO_FRAMES = 100;
export const ROUND_END_FRAMES = 170;
export const SUPER_STARTUP = 24;
export const CINE_FRAMES = 170;
export const SUPER_DAMAGE = 30;
export const SUPER_CHIP = 8;

export const WINDED_FRAMES = 90;
export const SK_FRAMES = 8 * FPS;
export const SK_MAX_HITS = 3;
export const SK_COOLDOWN = 5 * FPS;
export const SK_DAMAGE_SCALE = 0.7;
export const SCANDAL_DAMAGE = 10;
export const TAG_CARDIO_MAX = 40;
export const CARDIO_REGEN = 0.16;

/** Every fighter shares this frame data; fighters differ by stats, names and effects. */
export const MOVES: Record<MoveKey, MoveDef> = {
  jab:        { startup: 4,  active: 3, recovery: 9,  damage: 4,  hitstun: 17, blockstun: 10, range: 1.3,  cardio: 3, pose: 'punch', chain: true },
  kick:       { startup: 7,  active: 3, recovery: 12, damage: 6,  hitstun: 19, blockstun: 12, range: 1.55, cardio: 4, pose: 'kick', chain: true },
  lowJab:     { startup: 5,  active: 3, recovery: 9,  damage: 3,  hitstun: 16, blockstun: 9,  range: 1.25, cardio: 3, pose: 'low', low: true, chain: true },
  sp1:        { startup: 11, active: 4, recovery: 17, damage: 9,  hitstun: 22, blockstun: 14, range: 1.6,  cardio: 7, pose: 'heavy', lunge: 0.5, heavy: true },
  sp2:        { startup: 13, active: 4, recovery: 19, damage: 10, hitstun: 22, blockstun: 15, range: 1.8,  cardio: 7, pose: 'spin', lunge: 0.9, heavy: true, knockdown: true },
  sweep:      { startup: 9,  active: 4, recovery: 20, damage: 7,  hitstun: 0,  blockstun: 12, range: 1.65, cardio: 6, pose: 'sweep', low: true, knockdown: true },
  uppercut:   { startup: 6,  active: 5, recovery: 24, damage: 10, hitstun: 0,  blockstun: 16, range: 1.25, cardio: 7, pose: 'upper', launch: true, heavy: true },
  grab:       { startup: 5,  active: 2, recovery: 22, damage: 9,  hitstun: 0,  blockstun: 0,  range: 1.05, cardio: 6, pose: 'grab', unblockable: true, knockdown: true, heavy: true },
  finisher:   { startup: 8,  active: 4, recovery: 20, damage: 8,  hitstun: 0,  blockstun: 16, range: 1.6,  cardio: 5, pose: 'heavy', lunge: 0.3, knockdown: true, heavy: true },
  roundhouse: { startup: 9,  active: 4, recovery: 21, damage: 9,  hitstun: 0,  blockstun: 16, range: 1.75, cardio: 5, pose: 'spin', knockdown: true, heavy: true },
  airPunch:   { startup: 4,  active: 8, recovery: 0,  damage: 6,  hitstun: 20, blockstun: 12, range: 1.3,  cardio: 3, pose: 'airP', overhead: true },
  airKick:    { startup: 5,  active: 10, recovery: 0, damage: 7,  hitstun: 20, blockstun: 12, range: 1.5,  cardio: 3, pose: 'airK', overhead: true },
  policy:     { startup: 14, active: 5, recovery: 24, damage: 14, hitstun: 0,  blockstun: 18, range: 2.2,  cardio: 0, pose: 'heavy', lunge: 0.4, knockdown: true, heavy: true },
};

export const PROJECTILE_SPEED = 0.14;
