// Pure simulation types. Nothing in sim/ may import three, React or the DOM.

export const BTN = { L: 1, R: 2, U: 4, D: 8, P: 16, K: 32, G: 64, S: 128, T: 256 } as const;

export type MoveKey =
  | 'jab' | 'kick' | 'sp1' | 'sp2' | 'lowJab' | 'sweep' | 'uppercut' | 'grab'
  | 'finisher' | 'roundhouse' | 'airPunch' | 'airKick' | 'policy';

export type PoseKind = 'punch' | 'kick' | 'low' | 'sweep' | 'upper' | 'grab' | 'heavy' | 'spin' | 'airP' | 'airK';

export type MoveDef = {
  startup: number; active: number; recovery: number;
  damage: number; hitstun: number; blockstun: number;
  range: number; cardio: number; pose: PoseKind;
  low?: boolean; overhead?: boolean; knockdown?: boolean; launch?: boolean;
  unblockable?: boolean; lunge?: number; heavy?: boolean; chain?: boolean;
};

export type FState =
  | 'idle' | 'walk' | 'crouch' | 'jump' | 'attack' | 'hitstun' | 'blockstun'
  | 'knockdown' | 'getup' | 'winded' | 'superStart' | 'ko' | 'win';

/** The stats the simulation needs about a fighter. Looks and jokes live in data/. */
export type SimDef = {
  walk: number; jump: number; fitness: number;
  sp1Projectile?: boolean;
  /** "Fired & rehired": survives the first KO of a match. */
  revive?: boolean;
  /** No sidekick (infinite-cardio characters). */
  noSidekick?: boolean;
};

export type Fighter = {
  x: number; y: number; vx: number; vy: number; facing: 1 | -1;
  hp: number; hype: number; cardio: number;
  state: FState; frame: number; stun: number;
  move: MoveKey | null; af: number; hit: boolean; chain: number; buf: number;
  combo: number; prev: number; cur: number;
  /** Sidekick tag state. */
  sk: boolean; skTimer: number; skHits: number; skCooldown: number; skDead: boolean; policyUsed: boolean;
  revived: boolean; wins: number;
};

export type Projectile = { owner: 0 | 1; x: number; y: number; vx: number; dmg: number };

export type Ev =
  | { t: 'hit'; by: 0 | 1; move: MoveKey; heavy: boolean; x: number; y: number; dmg: number; combo: number }
  | { t: 'block'; by: 0 | 1; x: number; y: number }
  | { t: 'whiff'; by: 0 | 1; move: MoveKey }
  | { t: 'jump'; by: 0 | 1 }
  | { t: 'superStart'; by: 0 | 1 }
  | { t: 'superHit'; by: 0 | 1 }
  | { t: 'superBlocked'; by: 0 | 1 }
  | { t: 'superLand'; by: 0 | 1 }
  | { t: 'winded'; by: 0 | 1 }
  | { t: 'tagIn'; by: 0 | 1 }
  | { t: 'tagOut'; by: 0 | 1 }
  | { t: 'scandal'; by: 0 | 1 }
  | { t: 'revive'; by: 0 | 1 }
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
