import { MOVES, REACH_PAD, SUPER_COST, TAG_FRAMES, TAG_MANUAL_CARDIO } from '../constants';
import { makeRng, type Rng } from '../rng';
import { BTN, type Match, type SimDef } from '../types';

export type Difficulty = 'easy' | 'normal' | 'hard';

type Profile = {
  /** Frames of dithering between decisions. */
  think: number;
  block: number; aggro: number; chain: number; superUse: number; antiAir: number;
  /** Chance per decision to go for a signature. */
  sig: number;
  /** Chance to punish a whiffed attack, and to hit back the moment a block ends. */
  punish: number;
  /** Damage dealt and toughness, applied to the CPU's fighter. Hostile Takeover is a boss fight. */
  power: number; health: number;
};

export const PROFILES: Record<Difficulty, Profile> = {
  easy:   { think: 34, block: 0.18, aggro: 0.45, chain: 0.25, superUse: 0.25, antiAir: 0.05, sig: 0.05, punish: 0,    power: 0.85, health: 1 },
  normal: { think: 18, block: 0.42, aggro: 0.7,  chain: 0.6,  superUse: 0.5,  antiAir: 0.3,  sig: 0.09, punish: 0.2,  power: 1,    health: 1 },
  // Hostile Takeover: reads almost everything, punishes every mistake, and hits like a boss. Beatable, barely.
  hard:   { think: 4,  block: 0.93, aggro: 0.94, chain: 0.95, superUse: 1,    antiAir: 0.92, sig: 0.18, punish: 0.9,  power: 1.35, health: 1.35 },
};

/** The CPU's fighter for a difficulty: the same moves, with that level's damage and toughness. */
export function cpuDef(def: SimDef, difficulty: Difficulty): SimDef {
  const p = PROFILES[difficulty];
  return { ...def, power: def.power * p.power, health: def.health * p.health };
}

export type Cpu = { rng: Rng; p: Profile; queue: [mask: number, frames: number][]; lastBlock: number };

export function makeCpu(difficulty: Difficulty, seed: number): Cpu {
  return { rng: makeRng(seed), p: PROFILES[difficulty], queue: [], lastBlock: -99 };
}

/** Returns the input bitmask the CPU presses this tick for fighter `me`. */
export function cpuInput(cpu: Cpu, m: Match, me: 0 | 1, def: SimDef): number {
  const f = m.f[me], o = m.f[1 - me];
  if (m.phase !== 'fight') { cpu.queue.length = 0; return 0; }
  const { rng, p } = cpu;
  const fwd = f.facing === 1 ? BTN.R : BTN.L;
  const back = f.facing === 1 ? BTN.L : BTN.R;
  // Measured as if bodies were 1 m wide: REACH_PAD keeps every threshold below unchanged.
  const dist = Math.abs(o.x - f.x) - REACH_PAD;
  const neutral = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';

  // A signature freezes whoever it's aimed at: drop whatever was planned.
  if (o.state === 'quote' && o.frame === 1) cpu.queue.length = 0;

  // Reflex: decide once per incoming attack whether to guard it.
  const threat = (o.state === 'attack' && o.move && o.af === 1 && dist < MOVES[o.move].range + 0.9) ||
    (o.state === 'superStart' && o.frame === 1);
  if (threat && (neutral || f.state === 'blockstun')) {
    if (rng() < p.block) {
      const mv = o.move ? MOVES[o.move] : null;
      const frames = mv ? mv.startup + mv.active + 4 : 60;
      cpu.queue = [[back | (mv?.low ? BTN.D : 0), frames]];
    }
  }

  // Punish: an attack that missed is wide open while it recovers; so is the attacker the moment our block ends.
  if (p.punish > 0 && neutral && !cpu.queue.length && dist < 1.05) {
    const mv = o.state === 'attack' && o.move ? MOVES[o.move] : null;
    const whiffed = mv && !o.hit && o.af > mv.startup + mv.active;
    const blocked = cpu.lastBlock > 0 && m.frame - cpu.lastBlock < 4;
    if ((whiffed || blocked) && rng() < p.punish) {
      cpu.queue = [[BTN.P, 2], [0, 5], [BTN.P, 2], [0, 7], [BTN.K, 2]];
    }
  }
  if (f.state === 'blockstun') cpu.lastBlock = m.frame;

  if (cpu.queue.length) {
    const head = cpu.queue[0];
    if (--head[1] <= 0) cpu.queue.shift();
    return head[0];
  }
  if (!neutral) return 0;

  const q = cpu.queue;
  const rest = () => q.push([0, Math.round(p.think * (0.4 + rng()))]);

  const sk = f.tag > 0;
  if (!sk && f.cardio < TAG_MANUAL_CARDIO * 0.6 && !f.skOut && rng() < 0.03) { q.push([BTN.T, 2]); return 0; }
  if (!sk && f.cardio < 18) { q.push([back, 30]); return 0; }
  const canSuper = !sk && f.eng >= SUPER_COST && !f.superUsed;
  // A Super can't miss, so the CPU fires it as soon as it is ready (once the opponent isn't mid-line).
  if (canSuper && o.state !== 'quote' && o.state !== 'sig') { q.push([BTN.X, 2]); rest(); return 0; }
  if (o.state === 'jump' && dist < 2.15 && rng() < p.antiAir) { q.push([BTN.K, 2]); rest(); return 0; }
  if (o.state === 'knockdown' || o.state === 'getup') { q.push([dist > 1.65 ? fwd : 0, 8]); return 0; }

  // The sidekick's one Policy Move: it can't be interrupted or missed, so it comes out soon after the tag.
  if (sk && !f.skPolicy && o.state !== 'quote' && o.state !== 'sig' && f.tag < TAG_FRAMES - 90 && rng() < 0.25) {
    q.push([BTN.S, 2]); rest(); return 0;
  }
  // Signatures always land, so any of the three will do once they're off cooldown.
  if (!sk && f.sigCd <= 0 && o.state !== 'quote' && rng() < p.sig) {
    const k = Math.floor(rng() * def.sigs.length);
    q.push([BTN.S | (k === 1 ? fwd : k === 2 ? BTN.D : 0), 2]); rest();
    return 0;
  }

  if (dist > 2.55) {
    const r = rng();
    if (r < 0.15 * p.aggro) { q.push([BTN.U | fwd, 3]); q.push([0, 14]); q.push([BTN.K, 2]); }
    else q.push([fwd, 6 + Math.round(rng() * p.think)]);
    return 0;
  }
  if (dist > 1.7) {
    if (rng() < p.aggro * 0.35) { q.push([fwd | BTN.K, 2]); rest(); }
    else q.push([fwd, 5]);
    return 0;
  }

  if (rng() > p.aggro) {
    if (rng() < 0.5) q.push([back, 10 + Math.round(rng() * 14)]); else rest();
    return 0;
  }
  const r = rng();
  if (r < 0.5) {
    q.push([BTN.P, 2]);
    if (rng() < p.chain) { q.push([0, 5]); q.push([BTN.P, 2]); }
    if (rng() < p.chain) { q.push([0, 7]); q.push([rng() < 0.6 ? BTN.P : BTN.K, 2]); }
  } else if (r < 0.65) q.push([BTN.K, 2]);
  else if (r < 0.8) q.push([BTN.D | BTN.K, 2]);
  else q.push([fwd | BTN.K, 2]);
  rest();
  return 0;
}
