// Pure simulation types. Nothing in sim/ may import three, React or the DOM.

/** Input bits. L/R/U/D move, P light (J), K heavy (K), S signature (L), G dodge (Space), X super (Enter). */
export const BTN = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, S: 64, G: 128, X: 256 } as const;

export type MoveKey =
  | 'jab' | 'cross' | 'hook' | 'upper' | 'kick' | 'sweep' | 'roundhouse' | 'airPunch' | 'airKick';

export type MoveDef = {
  startup: number; active: number; recovery: number;
  damage: number; hitstun: number; blockstun: number;
  range: number; cardio: number;
  low?: boolean; overhead?: boolean; knockdown?: boolean; launch?: boolean;
  lunge?: number; heavy?: boolean; chain?: boolean;
};

/** A signature move: the fighter says a real line (the wind-up), then does the thing. */
export type SigDef = {
  id: string;
  /** Frames of the spoken line (or post card). The last FACT_CHECK_WINDOW frames can be Fact-Checked. */
  quote: number;
  kind: 'melee' | 'projectile' | 'drop' | 'counter';
  startup: number; active: number; recovery: number;
  damage: number; range: number;
  /** Melee: hits landed across the active frames (chainsaw). Projectile: how many are thrown. */
  hits?: number;
  knockdown?: boolean;
  lunge?: number;
  /** Projectile launch speed and arc. */
  speed?: number; arc?: number;
};

export type SuperDef = {
  frames: number;
  /** Frame the damage lands (one hit), or the range over which health drains. */
  hitAt: number;
  drain?: [from: number, to: number];
};

export type FState =
  | 'idle' | 'walk' | 'crouch' | 'jump' | 'attack' | 'hitstun' | 'blockstun'
  | 'knockdown' | 'getup' | 'winded' | 'dodge' | 'quote' | 'sig' | 'stunned'
  | 'superStart' | 'superWhiff' | 'ko' | 'win';

export type Ego = 'needy' | 'contrarian';

/** The stats the simulation needs about a fighter. Looks and lines live in data/. */
export type SimDef = {
  walk: number; jump: number; fitness: number;
  sigs: [SigDef, SigDef, SigDef];
  super: SuperDef;
  ego: Ego;
};

export type Fighter = {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; eng: number; cardio: number;
  state: FState; frame: number; stun: number;
  move: MoveKey | null; af: number; hit: boolean; chain: number; buf: number;
  combo: number; prev: number; cur: number;
  /** Which signature is being said or done (0..2), and how many hits it has landed. */
  sig: number; sigHits: number; dropX: number;
  /** Frames since this fighter last landed or said something wild; Engagement decays after a while. */
  quiet: number;
  /** Meltdown frames left after being Ratioed: weak attacks, can't block, no signatures. */
  melt: number;
  wins: number;
};

export type Projectile = { owner: 0 | 1; sig: number; x: number; y: number; vx: number; vy: number; dmg: number; knockdown: boolean };

export type Ev =
  | { t: 'hit'; by: 0 | 1; move: MoveKey | 'sig' | 'counter'; heavy: boolean; x: number; y: number; dmg: number; combo: number }
  | { t: 'block'; by: 0 | 1; x: number; y: number; heavy: boolean }
  | { t: 'whiff'; by: 0 | 1; move: MoveKey }
  | { t: 'jump'; by: 0 | 1 }
  | { t: 'dodge'; by: 0 | 1 }
  | { t: 'quote'; by: 0 | 1; sig: number }
  | { t: 'quoteCut'; by: 0 | 1; sig: number }
  | { t: 'sigGo'; by: 0 | 1; sig: number }
  | { t: 'throw'; by: 0 | 1; sig: number }
  | { t: 'counter'; by: 0 | 1 }
  | { t: 'factCheck'; by: 0 | 1; sig: number; ratioed: boolean }
  | { t: 'tier'; by: 0 | 1; tier: number }
  | { t: 'superStart'; by: 0 | 1 }
  | { t: 'superHit'; by: 0 | 1 }
  | { t: 'superWhiff'; by: 0 | 1 }
  | { t: 'superBlocked'; by: 0 | 1 }
  | { t: 'superDamage'; by: 0 | 1 }
  | { t: 'superLand'; by: 0 | 1 }
  | { t: 'winded'; by: 0 | 1 }
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
