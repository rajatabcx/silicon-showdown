import { FACT_CHECK_WINDOW, MOVES, SUPER_COST, SUPER_REACH } from '../constants';
import { makeRng, type Rng } from '../rng';
import { BTN, type Match, type SimDef } from '../types';

export type Difficulty = 'easy' | 'normal' | 'hard';

type Profile = {
  /** Frames of dithering between decisions. */
  think: number;
  block: number; aggro: number; chain: number; superUse: number; antiAir: number;
  /** Chance to try a Fact-Check on a line, and how sloppy the timing is (frames). */
  check: number; checkJitter: number;
  /** Chance per decision to go for a signature. */
  sig: number;
};

export const PROFILES: Record<Difficulty, Profile> = {
  easy:   { think: 34, block: 0.18, aggro: 0.45, chain: 0.25, superUse: 0.25, antiAir: 0.05, check: 0.15, checkJitter: 40, sig: 0.06 },
  normal: { think: 18, block: 0.42, aggro: 0.7,  chain: 0.6,  superUse: 0.5,  antiAir: 0.3,  check: 0.35, checkJitter: 26, sig: 0.1 },
  hard:   { think: 9,  block: 0.7,  aggro: 0.88, chain: 0.85, superUse: 0.85, antiAir: 0.65, check: 0.6,  checkJitter: 14, sig: 0.13 },
};

export type Cpu = { rng: Rng; p: Profile; queue: [mask: number, frames: number][]; checkAt: number };

export function makeCpu(difficulty: Difficulty, seed: number): Cpu {
  return { rng: makeRng(seed), p: PROFILES[difficulty], queue: [], checkAt: -1 };
}

/** Returns the input bitmask the CPU presses this tick for fighter `me`. */
export function cpuInput(cpu: Cpu, m: Match, me: 0 | 1, def: SimDef, oppDef: SimDef): number {
  const f = m.f[me], o = m.f[1 - me];
  if (m.phase !== 'fight') { cpu.queue.length = 0; cpu.checkAt = -1; return 0; }
  const { rng, p } = cpu;
  const fwd = f.facing === 1 ? BTN.R : BTN.L;
  const back = f.facing === 1 ? BTN.L : BTN.R;
  const dist = Math.abs(o.x - f.x);
  const neutral = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';

  // The opponent started a line: decide once whether to Fact-Check it, and when to press.
  if (o.state === 'quote' && o.frame === 1) {
    const sg = oppDef.sigs[o.sig];
    cpu.checkAt = -1;
    if (sg.kind !== 'counter' && rng() < p.check) {
      const target = sg.quote - FACT_CHECK_WINDOW / 2;
      cpu.checkAt = Math.round(target + (rng() - 0.5) * p.checkJitter);
    } else if (sg.kind !== 'counter' && dist < 1.85 && rng() < p.aggro) {
      // Or just punch them while they talk.
      cpu.queue = [[BTN.P, 2], [0, 4], [BTN.P, 2], [0, 4], [BTN.P, 2]];
    } else if (sg.kind === 'counter') {
      cpu.queue = [[back, Math.min(sg.quote, 40 + Math.round(rng() * 30))]];
    }
  }
  if (cpu.checkAt >= 0 && o.state === 'quote' && o.frame >= cpu.checkAt) {
    cpu.checkAt = -1; cpu.queue.length = 0;
    return neutral ? BTN.G : 0;
  }
  if (o.state !== 'quote') cpu.checkAt = -1;

  // Reflex: decide once per incoming attack whether to guard it.
  const threat = (o.state === 'attack' && o.move && o.af === 1 && dist < MOVES[o.move].range + 0.9) ||
    (o.state === 'superStart' && o.frame === 1) || (o.state === 'sig' && o.af === 1);
  if (threat && (neutral || f.state === 'blockstun')) {
    if (rng() < p.block) {
      const mv = o.move ? MOVES[o.move] : null;
      const frames = mv ? mv.startup + mv.active + 4 : 60;
      cpu.queue = [[back | (mv?.low ? BTN.D : 0), frames]];
    }
  }

  if (cpu.queue.length) {
    const head = cpu.queue[0];
    if (--head[1] <= 0) cpu.queue.shift();
    return head[0];
  }
  if (!neutral) return 0;

  const q = cpu.queue;
  const rest = () => q.push([0, Math.round(p.think * (0.4 + rng()))]);

  if (f.cardio < 18) { q.push([back, 30]); return 0; }
  if (f.eng >= SUPER_COST && dist < SUPER_REACH - 0.4 && f.melt <= 0 && rng() < p.superUse * 0.2) { q.push([BTN.X, 2]); rest(); return 0; }
  if (f.eng >= SUPER_COST && dist >= SUPER_REACH - 0.4) { q.push([fwd, 10]); return 0; }
  if (o.state === 'jump' && dist < 2.15 && rng() < p.antiAir) { q.push([BTN.K, 2]); rest(); return 0; }
  if (o.state === 'knockdown' || o.state === 'getup') { q.push([dist > 1.65 ? fwd : 0, 8]); return 0; }

  // Signatures: pick by range.
  if (f.melt <= 0 && rng() < p.sig) {
    const opts: number[] = [];
    def.sigs.forEach((s, k) => {
      if (s.kind === 'projectile' && dist > 2.65) opts.push(k);
      if (s.kind === 'drop' && dist > 1.85 && dist < s.range) opts.push(k);
      if (s.kind === 'melee' && dist < s.range + 0.6) opts.push(k);
      if (s.kind === 'counter' && dist < 2.05 && (o.state === 'walk' || o.state === 'attack')) opts.push(k);
    });
    if (opts.length) {
      const k = opts[Math.floor(rng() * opts.length)];
      q.push([BTN.S | (k === 1 ? fwd : k === 2 ? BTN.D : 0), 2]); rest();
      return 0;
    }
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
