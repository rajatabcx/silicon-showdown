import type { MoveDef, MoveKey } from './types';

export const FPS = 60;
export const ROUND_FRAMES = 90 * FPS;
export const STAGE_HALF = 6.2;
export const START_X = 2.2;
export const GRAVITY = 0.0105;
export const WALK_SCALE = 0.022;
export const JUMP_SCALE = 0.025;
export const BODY_WIDTH = 1.35;
/** Extra reach added to every melee range and AI distance check, so a wider body doesn't change the fight. */
export const REACH_PAD = BODY_WIDTH - 1.0;

export const INTRO_FRAMES = 150;
export const ROUND_END_FRAMES = 240;
export const SUPER_STARTUP = 18;
/** A Super can't miss: when the cinematic starts the two fighters are stood this far apart, wherever they were. */
export const SUPER_GAP = 2.2;
/** Frames a Super press is remembered once the fighter is able to act (it doesn't run down while they're on the floor). */
export const SUPER_BUFFER = 30;
export const SUPER_DAMAGE = 32;

export const WINDED_FRAMES = 90;
/** Cardio regained per frame while standing still (x fitness). Walking regains half. */
export const CARDIO_REGEN = 0.05;
/** Cardio a signature move costs (/ fitness). */
export const SIG_CARDIO = 8;

// Sidekick tag system: at 0 cardio (or by choice below TAG_MANUAL_CARDIO) a funded politician tags in.
export const TAG_FRAMES = 8 * 60;
export const TAG_MANUAL_CARDIO = 40;
export const SIDEKICK_HITS = 3;
export const SCANDAL_DAMAGE = 8;
export const SIDEKICK_DAMAGE = 0.75;
/** The billionaire recovers this many times faster while the sidekick fights. */
export const TAG_REGEN = 4;

/** Dodge: invincible from frame 2 to 16, recovers at 26. Pressed in the last beat of a quote, it's a Fact-Check. */
export const DODGE_FRAMES = 26;
export const DODGE_INVULN: [number, number] = [2, 16];
export const DODGE_SLIDE = 0.035;
export const FACT_CHECK_WINDOW = 36;
export const STUN_FRAMES = 80;
export const MELTDOWN_FRAMES = 170;
export const BACKFIRE_DAMAGE = 6;
export const COUNTER_DAMAGE = 12;

/** Engagement: 0..100, three tiers. Viral unlocks the Super. */
export const TIERS = [34, 67, 100] as const;
export const SUPER_COST = 67;
export const ENG_SIG_LAND = 24;
export const ENG_SIG_SAID = 8;
export const ENG_HIT = 1.5;
export const ENG_FACT_CHECK = 22;
export const ENG_QUIET_FRAMES = 3 * FPS;
export const ENG_DECAY = 0.05;
/** Damage dealt and taken per tier (0..3). The higher you climb, the harder you hit and the harder you fall. */
export const TIER_DEALT = [1, 1.12, 1.25, 1.4];
export const TIER_TAKEN = [1, 1.08, 1.18, 1.3];

/** Every fighter shares this frame data; fighters differ by stats, signatures and Supers. */
export const MOVES: Record<MoveKey, MoveDef> = {
  jab:        { startup: 5,  active: 3, recovery: 10, damage: 4,  hitstun: 17, blockstun: 10, range: 1.55,  cardio: 5, chain: true },
  cross:      { startup: 6,  active: 3, recovery: 12, damage: 5,  hitstun: 18, blockstun: 11, range: 1.6, cardio: 5, chain: true, lunge: 0.18 },
  hook:       { startup: 8,  active: 3, recovery: 18, damage: 7,  hitstun: 26, blockstun: 14, range: 1.6, cardio: 7, heavy: true, lunge: 0.25 },
  roundhouse: { startup: 10, active: 4, recovery: 22, damage: 10, hitstun: 0,  blockstun: 18, range: 2.05,  cardio: 10, knockdown: true, heavy: true },
  upper:      { startup: 11, active: 4, recovery: 22, damage: 10, hitstun: 0,  blockstun: 24, range: 1.55,  cardio: 12, launch: true, heavy: true },
  kick:       { startup: 12, active: 4, recovery: 18, damage: 9,  hitstun: 0,  blockstun: 22, range: 2.0, cardio: 10, lunge: 0.4, knockdown: true, heavy: true },
  sweep:      { startup: 10, active: 4, recovery: 22, damage: 8,  hitstun: 0,  blockstun: 14, range: 1.95,  cardio: 10, low: true, knockdown: true },
  airPunch:   { startup: 4,  active: 8, recovery: 0,  damage: 6,  hitstun: 20, blockstun: 12, range: 1.55,  cardio: 5, overhead: true },
  airKick:    { startup: 5,  active: 10, recovery: 0, damage: 7,  hitstun: 20, blockstun: 12, range: 1.8, cardio: 5, overhead: true },
};

export const tierOf = (eng: number) => (eng >= TIERS[2] ? 3 : eng >= TIERS[1] ? 2 : eng >= TIERS[0] ? 1 : 0);
