import { MOVES } from '../constants';
import { canTag } from '../match';
import { makeRng, type Rng } from '../rng';
import { BTN, type Match, type SimDef } from '../types';

export type Difficulty = 'easy' | 'normal' | 'hard';

type Profile = {
  /** Frames of dithering between decisions. */
  think: number;
  block: number; aggro: number; chain: number; superUse: number; antiAir: number; grabVsBlock: number;
};

export const PROFILES: Record<Difficulty, Profile> = {
  easy:   { think: 34, block: 0.18, aggro: 0.45, chain: 0.25, superUse: 0.02, antiAir: 0.05, grabVsBlock: 0.05 },
  normal: { think: 18, block: 0.45, aggro: 0.7,  chain: 0.6,  superUse: 0.08, antiAir: 0.3,  grabVsBlock: 0.25 },
  hard:   { think: 9,  block: 0.75, aggro: 0.9,  chain: 0.9,  superUse: 0.3,  antiAir: 0.7,  grabVsBlock: 0.55 },
};

export type Cpu = { rng: Rng; p: Profile; queue: [mask: number, frames: number][]; blocked: number };

export function makeCpu(difficulty: Difficulty, seed: number): Cpu {
  return { rng: makeRng(seed), p: PROFILES[difficulty], queue: [], blocked: 0 };
}

/** Returns the input bitmask the CPU presses this tick for fighter `me`. */
export function cpuInput(cpu: Cpu, m: Match, me: 0 | 1, def: SimDef): number {
  const f = m.f[me], o = m.f[1 - me];
  if (m.phase !== 'fight') { cpu.queue.length = 0; return 0; }
  const { rng, p } = cpu;
  const fwd = f.facing === 1 ? BTN.R : BTN.L;
  const back = f.facing === 1 ? BTN.L : BTN.R;
  const dist = Math.abs(o.x - f.x);
  const neutral = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';

  // Reflex: decide once per incoming attack whether to guard it.
  const threat = (o.state === 'attack' && o.move && o.af === 1 && dist < MOVES[o.move].range + 0.9) ||
    (o.state === 'superStart' && o.frame === 1);
  if (threat && (neutral || f.state === 'blockstun')) {
    if (rng() < p.block) {
      const mv = o.move ? MOVES[o.move] : null;
      const frames = mv ? mv.startup + mv.active + 4 : 30;
      cpu.queue = [[back | (mv?.low ? BTN.D : 0), frames]];
      cpu.blocked++;
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

  if (!f.sk && f.cardio < 22) {
    if (canTag(f, def)) { q.push([BTN.T, 2]); return 0; }
    q.push([back, 26]); return 0;
  }
  if (f.sk && !f.policyUsed && dist < 2.1 && rng() < 0.5) { q.push([BTN.S, 2]); rest(); return 0; }
  if (!f.sk && f.hype >= 100 && dist < 5 && rng() < p.superUse) { q.push([BTN.S, 2]); return 0; }
  if (o.state === 'jump' && dist < 1.9 && rng() < p.antiAir) { q.push([BTN.D | fwd | BTN.P, 2]); rest(); return 0; }
  if (o.state === 'knockdown' || o.state === 'getup') { q.push([dist > 1.4 ? fwd : 0, 8]); return 0; }

  if (dist > 2.3) {
    const r = rng();
    if (def.sp1Projectile && !f.sk && r < 0.14 * p.aggro) { q.push([fwd | BTN.P, 2]); rest(); }
    else if (r < 0.22 * p.aggro) { q.push([BTN.U | fwd, 3]); q.push([0, 14]); q.push([BTN.K, 2]); }
    else q.push([fwd, 6 + Math.round(rng() * p.think)]);
    return 0;
  }
  if (dist > 1.45) {
    if (rng() < p.aggro * 0.4) { q.push([(rng() < 0.5 ? fwd : 0) | BTN.K, 2]); rest(); }
    else q.push([fwd, 5]);
    return 0;
  }

  if (rng() > p.aggro) {
    if (rng() < 0.5) q.push([back, 10 + Math.round(rng() * 14)]); else rest();
    return 0;
  }
  const oppGuarding = o.state === 'blockstun' || ((o.cur & (o.facing === 1 ? BTN.L : BTN.R)) !== 0);
  if (oppGuarding && rng() < p.grabVsBlock) { q.push([BTN.G, 2]); rest(); return 0; }
  const r = rng();
  if (r < 0.42) {
    // Jab string: J, then J or K, then J or K.
    q.push([BTN.P, 2]);
    if (rng() < p.chain) { q.push([0, 5]); q.push([rng() < 0.6 ? BTN.P : BTN.K, 2]); }
    if (rng() < p.chain) { q.push([0, 7]); q.push([rng() < 0.5 ? BTN.P : BTN.K, 2]); }
  } else if (r < 0.6) {
    q.push([BTN.K, 2]);
    if (rng() < p.chain) { q.push([0, 8]); q.push([BTN.K, 2]); }
  } else if (r < 0.72) q.push([BTN.D | BTN.K, 2]);
  else if (r < 0.82) q.push([fwd | BTN.P, 2]);
  else if (r < 0.9) q.push([fwd | BTN.K, 2]);
  else if (r < 0.95) q.push([BTN.D | BTN.P, 2], [0, 5], [BTN.K, 2]);
  else q.push([BTN.G, 2]);
  rest();
  return 0;
}
