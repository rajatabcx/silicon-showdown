import { describe, expect, it } from 'vitest';
import { cpuInput, makeCpu } from './ai/cpu';
import { INTRO_FRAMES, MOVES, SK_FRAMES } from './constants';
import { hashMatch, newMatch, step } from './match';
import { BTN, type Ev, type Match, type SimDef } from './types';

const DEF: SimDef = { walk: 2.2, jump: 7.6, fitness: 1 };
const DEFS: [SimDef, SimDef] = [DEF, DEF];

function started(): Match {
  const m = newMatch();
  for (let i = 0; i < INTRO_FRAMES; i++) step(m, 0, 0, DEFS);
  expect(m.phase).toBe('fight');
  return m;
}
/** Put the fighters in jab range. */
function close(m: Match) { m.f[0].x = -0.5; m.f[1].x = 0.5; }
/** Same, but with the defender's back to the wall so holding back can't walk out of range. */
function corner(m: Match) { m.f[0].x = 6; m.f[1].x = 7; }
function run(m: Match, frames: number, in0 = 0, in1 = 0, defs = DEFS) {
  const evs: Ev[] = [];
  for (let i = 0; i < frames; i++) { step(m, in0, in1, defs); evs.push(...m.events); }
  return evs;
}

function cpuMatch(seed: number) {
  const m = newMatch();
  const a = makeCpu('hard', seed), b = makeCpu('normal', seed + 1);
  let n = 0;
  while (m.phase !== 'matchEnd' && n++ < 60 * 60 * 8) step(m, cpuInput(a, m, 0, DEF), cpuInput(b, m, 1, DEF), DEFS);
  return m;
}

describe('fight simulation', () => {
  it('is deterministic', () => {
    expect(hashMatch(cpuMatch(7))).toBe(hashMatch(cpuMatch(7)));
  });

  it('cpu vs cpu matches finish with a winner', () => {
    for (const seed of [1, 2, 3]) {
      const m = cpuMatch(seed);
      expect(m.phase).toBe('matchEnd');
      expect(m.winner).toBeGreaterThanOrEqual(0);
    }
  });

  it('a jab hits an idle opponent', () => {
    const m = started(); close(m);
    step(m, BTN.P, 0, DEFS);
    const evs = run(m, 12);
    expect(evs.some((e) => e.t === 'hit')).toBe(true);
    expect(m.f[1].hp).toBe(100 - MOVES.jab.damage);
  });

  it('holding back blocks a mid, but not a low', () => {
    const m = started(); corner(m);
    step(m, BTN.P, BTN.R, DEFS);
    run(m, 12, 0, BTN.R);
    expect(m.f[1].hp).toBe(100);
    run(m, 30, 0, BTN.R);
    step(m, BTN.D | BTN.K, BTN.R, DEFS);
    run(m, 16, 0, BTN.R);
    expect(m.f[1].hp).toBeLessThan(100);
  });

  it('grab beats block', () => {
    const m = started(); corner(m);
    step(m, BTN.G, BTN.R, DEFS);
    run(m, 12, 0, BTN.R);
    expect(m.f[1].hp).toBeLessThan(100);
  });

  it('a 3-hit string scales damage and knocks down', () => {
    const m = started(); close(m);
    const evs: Ev[] = [];
    for (let i = 0; i < 70; i++) { step(m, i % 6 < 3 ? BTN.P : 0, 0, DEFS); evs.push(...m.events); }
    const hits = evs.filter((e) => e.t === 'hit');
    expect(hits.length).toBe(3);
    expect(hits[2].t === 'hit' && hits[2].move).toBe('finisher');
    expect(m.f[1].hp).toBeCloseTo(100 - (4 + 4 * 0.9 + 8 * 0.8));
  });

  it('KO ends the round and best of three ends the match', () => {
    const m = started(); close(m);
    m.f[1].hp = 1;
    step(m, BTN.P, 0, DEFS);
    run(m, 10);
    expect(m.phase).toBe('roundEnd');
    run(m, 400);
    expect(m.f[0].wins).toBe(1);
    expect(m.round).toBe(2);
    close(m); m.f[1].hp = 1;
    step(m, BTN.P, 0, DEFS);
    run(m, 400);
    expect(m.phase).toBe('matchEnd');
    expect(m.winner).toBe(0);
  });

  it('running out of cardio brings in the sidekick, who leaves after 8 seconds', () => {
    const m = started();
    m.f[0].cardio = 0;
    const evs = run(m, 100);
    expect(evs.some((e) => e.t === 'winded')).toBe(true);
    expect(m.f[0].sk).toBe(true);
    const later = run(m, SK_FRAMES + 5);
    expect(later.some((e) => e.t === 'tagOut')).toBe(true);
    expect(m.f[0].sk).toBe(false);
    expect(m.f[0].cardio).toBeGreaterThanOrEqual(60);
  });

  it('three hits on a sidekick cause a scandal', () => {
    const m = started(); close(m);
    m.f[1].cardio = 10;
    step(m, 0, BTN.T, DEFS);
    expect(m.f[1].sk).toBe(true);
    const evs: Ev[] = [];
    for (let i = 0; i < 70; i++) { step(m, i % 6 < 3 ? BTN.P : 0, 0, DEFS); evs.push(...m.events); }
    expect(evs.some((e) => e.t === 'scandal')).toBe(true);
    expect(m.f[1].hp).toBe(90);
    expect(m.f[1].skDead).toBe(true);
  });

  it('a full hype meter fires a super for 30 damage', () => {
    const m = started();
    m.f[0].hype = 100;
    step(m, BTN.S, 0, DEFS);
    const evs = run(m, 260);
    expect(evs.some((e) => e.t === 'superHit')).toBe(true);
    expect(m.f[1].hp).toBe(70);
  });
});
