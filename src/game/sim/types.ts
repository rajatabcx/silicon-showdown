// Pure simulation types. Nothing in sim/ may import three, React or the DOM.

/** Input bits. L/R/U/D move, P light (J), K heavy (K), S signature (L), G dodge (Space), X super (Enter), T tag sidekick (U). */
export const BTN = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, S: 64, G: 128, X: 256, T: 512 } as const;

export type MoveKey =
  | 'jab' | 'cross' | 'hook' | 'upper' | 'kick' | 'sweep' | 'roundhouse' | 'airPunch' | 'airKick';

export type MoveDef = {
  startup: number; active: number; recovery: number;
  damage: number; hitstun: number; blockstun: number;
  range: number; cardio: number;
  low?: boolean; overhead?: boolean; knockdown?: boolean; launch?: boolean;
  lunge?: number; heavy?: boolean; chain?: boolean;
};

/**
 * A signature move: the fighter starts a real line (the wind-up), then does the thing. The opponent is frozen from the
 * first word until the last hit, so it can't be interrupted, blocked or dodged, and it always lands.
 */
export type SigDef = {
  id: string;
  /** Frames of wind-up before the move goes (the line keeps playing over the move). */
  quote: number;
  /** Frames the whole line runs, from the first word. The move (and the opponent's freeze) lasts at least this long. */
  line?: number;
  kind: 'melee' | 'projectile' | 'drop';
  startup: number; active: number; recovery: number;
  damage: number; range: number;
  /** Melee: hits landed across the active frames (chainsaw). Projectile: how many are thrown. */
  hits?: number;
  knockdown?: boolean;
  /** Projectile launch speed. */
  speed?: number;
  /** Policy Move only: the MAGA move. Against Average Joe it sets off the blue wave and the politician is voted out. */
  wave?: boolean;
};

export type SuperDef = {
  frames: number;
  /** Frame the damage lands (one hit), or the range over which health drains. */
  hitAt: number;
  drain?: [from: number, to: number];
  /** Aimed at Average Joe: the frame he cuts it off, and how long the deflection runs in all. */
  deflect?: { cut: number; frames: number };
};

export type FState =
  | 'idle' | 'walk' | 'crouch' | 'jump' | 'attack' | 'hitstun' | 'blockstun'
  | 'knockdown' | 'getup' | 'winded' | 'dodge' | 'quote' | 'sig'
  | 'superStart' | 'ko' | 'win';

export type Ego = 'needy' | 'contrarian' | 'customer' | 'hype' | 'triggered' | 'marketcap' | 'harvest' | 'immune';

/** The stats the simulation needs about a fighter. Looks and lines live in data/. */
export type SimDef = {
  walk: number; jump: number; fitness: number;
  /** Toughness: 100 is the baseline. Every hit taken is scaled by 100 / health, so 120 lasts a fifth longer. */
  health: number;
  /** Damage dealt multiplier: 1 for everyone, above 1 only for the Hostile Takeover CPU. */
  power: number;
  sigs: [SigDef, SigDef, SigDef];
  super: SuperDef;
  ego: Ego;
  /** The funded politician who tags in when cardio runs out. Its one Policy Move is sig index 3. */
  sidekick: { walk: number; policy: SigDef };
  /**
   * Average Joe: no signatures, no Super, no sidekick. Supers aimed at him are deflected (no damage, the caller is left
   * winded), and a sidekick tagged in against him is a lame duck who gets voted out.
   */
  everyman?: boolean;
};

export type Fighter = {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; eng: number; cardio: number;
  state: FState; frame: number; stun: number;
  move: MoveKey | null; af: number; hit: boolean; chain: number; buf: number;
  combo: number; prev: number; cur: number;
  /**
   * Which signature is being said or done (0..2, 3 = the sidekick's Policy Move), how many hits it has landed, and
   * where it lands (drops) or where a melee one dashes to.
   */
  sig: number; sigHits: number; dropX: number;
  /** Frames until a signature can be used again. */
  sigCd: number;
  /** Frames since this fighter last landed or said something wild; Engagement decays after a while. */
  quiet: number;
  wins: number;
  /** Super already used this round (one per round). */
  superUsed: boolean;
  /** Frames left on a remembered Super press (so a press during hit-stop or a punch isn't lost). */
  superBuf: number;
  /** Frames the sidekick has left on stage (0 = the billionaire is fighting). */
  tag: number;
  /** Hits the sidekick has taken this tag; at SIDEKICK_HITS it is exposed (scandal). */
  skHits: number;
  /** The sidekick was exposed this round and can't come back. */
  skOut: boolean;
  /** The sidekick's Policy Move is spent for this tag. */
  skPolicy: boolean;
  /** This signature has already been negated by Average Joe (one retort per move, however many hits). */
  negated: boolean;
  /** Frames left of the line this fighter is saying (0 = not talking). */
  talk: number;
};

export type Projectile = { owner: 0 | 1; sig: number; x: number; y: number; vx: number; vy: number; dmg: number; knockdown: boolean };

export type Ev =
  | { t: 'hit'; by: 0 | 1; move: MoveKey | 'sig'; heavy: boolean; x: number; y: number; dmg: number; combo: number }
  | { t: 'block'; by: 0 | 1; x: number; y: number; heavy: boolean }
  | { t: 'whiff'; by: 0 | 1; move: MoveKey }
  | { t: 'jump'; by: 0 | 1 }
  | { t: 'dodge'; by: 0 | 1 }
  | { t: 'quote'; by: 0 | 1; sig: number }
  | { t: 'sigGo'; by: 0 | 1; sig: number }
  | { t: 'throw'; by: 0 | 1; sig: number }
  | { t: 'tier'; by: 0 | 1; tier: number }
  | { t: 'superStart'; by: 0 | 1 }
  | { t: 'superHit'; by: 0 | 1 }
  | { t: 'superDamage'; by: 0 | 1 }
  | { t: 'superLand'; by: 0 | 1 }
  | { t: 'winded'; by: 0 | 1 }
  | { t: 'outOfOrder'; by: 0 | 1 }
  | { t: 'tagIn'; by: 0 | 1; manual: boolean; lameDuck?: boolean }
  | { t: 'tagOut'; by: 0 | 1; scandal: boolean; votedOut?: boolean }
  | { t: 'deflect'; by: 0 | 1 }
  /** A signature or Policy Move by `by` landed on Average Joe and did nothing. */
  | { t: 'negate'; by: 0 | 1; sig: number; wave?: boolean }
  | { t: 'ko'; by: 0 | 1 }
  | { t: 'timeUp' }
  | { t: 'roundStart'; round: number }
  | { t: 'fight' }
  | { t: 'matchEnd'; winner: 0 | 1 };

export type Phase = 'intro' | 'fight' | 'cine' | 'roundEnd' | 'matchEnd';

export type Match = {
  f: [Fighter, Fighter];
  proj: Projectile[];
  frame: number; timer: number; round: number;
  phase: Phase; phaseFrame: number;
  cineBy: 0 | 1; hitstop: number;
  roundWinner: -1 | 0 | 1; winner: -1 | 0 | 1;
  roundsToWin: number;
  events: Ev[];
};
