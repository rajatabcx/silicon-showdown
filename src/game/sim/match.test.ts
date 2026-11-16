import { describe, expect, it } from 'vitest';
import { simDef, TEAL, TUSK } from '../data/roster';
import { cpuInput, makeCpu } from './ai/cpu';
import {
  FACT_CHECK_WINDOW, INTRO_FRAMES, MOVES, SCANDAL_DAMAGE, SUPER_COST, SUPER_DAMAGE, SUPER_STARTUP, TAG_FRAMES, WINDED_FRAMES,
} from './constants';
import { hashMatch, newMatch, step } from './match';
import { BTN, type Ev, type Match, type SimDef } from './types';

const DEFS: [SimDef, SimDef] = [simDef(TUSK), simDef(TEAL)];

function started(): Match {
  const m = newMatch();
  for (let i = 0; i < INTRO_FRAMES; i++) step(m, 0, 0, DEFS);
  expect(m.phase).toBe('fight');
  return m;
}
/** Put the fighters in jab range. */
function close(m: Match) { m.f[0].x = -0.5; m.f[1].x = 0.5; }
/** Same, but with the defender's back to the wall so holding back can't walk out of range. */
function corner(m: Match) { m.f[0].x = 5; m.f[1].x = 6; }
function run(m: Match, frames: number, in0 = 0, in1 = 0) {
  const evs: Ev[] = [];
  for (let i = 0; i < frames; i++) { step(m, in0, in1, DEFS); evs.push(...m.events); }
  return evs;
}

function cpuMatch(seed: number) {
  const m = newMatch();
  const a = makeCpu('hard', seed), b = makeCpu('normal', seed + 1);
  let n = 0;
  while (m.phase !== 'matchEnd' && n++ < 60 * 60 * 12) {
    step(m, cpuInput(a, m, 0, DEFS[0], DEFS[1]), cpuInput(b, m, 1, DEFS[1], DEFS[0]), DEFS);
  }
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
    expect(m.f[1].hp).toBeCloseTo(100 - MOVES.jab.damage);
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

  it('J, J, J is a three-hit string that scales damage', () => {
    const m = started(); close(m);
    const evs: Ev[] = [];
    for (let i = 0; i < 80; i++) { step(m, i % 6 < 3 ? BTN.P : 0, 0, DEFS); evs.push(...m.events); }
    const hits = evs.filter((e): e is Extract<Ev, { t: 'hit' }> => e.t === 'hit');
    expect(hits.slice(0, 3).map((h) => h.move)).toEqual(['jab', 'cross', 'hook']);
    expect(m.f[1].hp).toBeLessThan(100 - 4 - 5 * 0.9);
  });

  it('a signature says the line first, then lands', () => {
    const m = started(); close(m);
    step(m, BTN.S, 0, DEFS);
    expect(m.f[0].state).toBe('quote');
    const quote = DEFS[0].sigs[0].quote;
    const evs = run(m, quote + 30);
    const go = evs.findIndex((e) => e.t === 'sigGo');
    const hit = evs.findIndex((e) => e.t === 'hit' && e.move === 'sig');
    expect(go).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(go);
    expect(m.f[1].hp).toBeLessThan(100);
    expect(m.f[0].eng).toBeGreaterThan(20);
  });

  it('dodging in the last beat of a line Fact-Checks it', () => {
    const m = started(); close(m);
    step(m, BTN.S, 0, DEFS);
    const quote = DEFS[0].sigs[0].quote;
    run(m, quote - FACT_CHECK_WINDOW / 2);
    const evs: Ev[] = [];
    step(m, 0, BTN.G, DEFS); evs.push(...m.events);
    evs.push(...run(m, 60));
    expect(evs.some((e) => e.t === 'factCheck')).toBe(true);
    expect(evs.some((e) => e.t === 'sigGo')).toBe(false);
    expect(m.f[0].hp).toBeLessThan(100);
    expect(m.f[1].hp).toBe(100);
  });

  it('dodging too early is just a dodge', () => {
    const m = started(); close(m);
    step(m, BTN.S, 0, DEFS);
    run(m, 10);
    step(m, 0, BTN.G, DEFS);
    expect(m.events.some((e) => e.t === 'factCheck')).toBe(false);
    expect(m.events.some((e) => e.t === 'dodge')).toBe(true);
  });

  it('getting Fact-Checked at Main Character means a Meltdown', () => {
    const m = started(); close(m);
    m.f[0].eng = 100;
    step(m, BTN.S, 0, DEFS);
    run(m, DEFS[0].sigs[0].quote - 10);
    step(m, 0, BTN.G, DEFS);
    const fc = m.events.find((e) => e.t === 'factCheck');
    expect(fc && fc.t === 'factCheck' && fc.ratioed).toBe(true);
    expect(m.f[0].eng).toBe(0);
    expect(m.f[0].melt).toBeGreaterThan(0);
  });

  it('hitting a talking fighter cuts the line', () => {
    const m = started(); close(m);
    step(m, BTN.S, 0, DEFS);
    step(m, 0, BTN.P, DEFS);
    const evs = run(m, 12);
    expect(evs.some((e) => e.t === 'quoteCut')).toBe(true);
    expect(m.f[0].state).not.toBe('quote');
  });

  it("Teal's long pause counters a punch", () => {
    const m = started(); close(m);
    step(m, 0, BTN.S | BTN.D, DEFS);
    expect(m.f[1].state).toBe('quote');
    step(m, BTN.P, 0, DEFS);
    const evs = run(m, 12);
    expect(evs.some((e) => e.t === 'counter')).toBe(true);
    expect(m.f[0].hp).toBeLessThan(100);
    expect(m.f[1].hp).toBe(100);
  });

  it('the Monopoly gate drops where the opponent stood', () => {
    const m = started();
    m.f[0].x = -2; m.f[1].x = 1;
    step(m, 0, BTN.S, DEFS);
    const evs = run(m, DEFS[1].sigs[0].quote + DEFS[1].sigs[0].startup + 4);
    expect(evs.some((e) => e.t === 'hit' && e.by === 1)).toBe(true);
  });

  it('a Super needs Viral engagement and lands for full damage', () => {
    const m = started(); close(m);
    step(m, BTN.X, 0, DEFS);
    expect(m.f[0].state).not.toBe('superStart');
    m.f[0].eng = SUPER_COST;
    step(m, 0, 0, DEFS);
    step(m, BTN.X, 0, DEFS);
    expect(m.f[0].state).toBe('superStart');
    const evs = run(m, DEFS[0].super.frames + 40);
    expect(evs.some((e) => e.t === 'superHit')).toBe(true);
    expect(evs.some((e) => e.t === 'superLand')).toBe(true);
    expect(m.f[1].hp).toBeCloseTo(100 - SUPER_DAMAGE);
  });

  it("Teal's Super drains health over the silence", () => {
    const m = started(); close(m);
    m.f[1].eng = 100;
    step(m, 0, BTN.X, DEFS);
    run(m, 30);
    expect(m.phase).toBe('cine');
    const [from, to] = DEFS[1].super.drain!;
    run(m, from + (to - from) / 2 - 12);
    expect(m.f[0].hp).toBeGreaterThan(100 - SUPER_DAMAGE);
    expect(m.f[0].hp).toBeLessThan(100);
    run(m, DEFS[1].super.frames);
    expect(m.f[0].hp).toBeCloseTo(100 - SUPER_DAMAGE);
  });

  it('KO ends the round and best of three ends the match', () => {
    const m = started(); close(m);
    m.f[1].hp = 1;
    step(m, BTN.P, 0, DEFS);
    run(m, 30);
    expect(m.phase).toBe('roundEnd');
    run(m, 500);
    expect(m.f[0].wins).toBe(1);
    expect(m.round).toBe(2);
    close(m); m.f[1].hp = 1;
    step(m, BTN.P, 0, DEFS);
    run(m, 500);
    expect(m.phase).toBe('matchEnd');
    expect(m.winner).toBe(0);
  });

  it('running out of cardio leaves a fighter winded', () => {
    const m = started();
    m.f[0].cardio = 0;
    const evs = run(m, 5);
    expect(evs.some((e) => e.t === 'winded')).toBe(true);
  });

  it('only one fighter can talk at a time', () => {
    const m = started(); m.f[0].x = -3; m.f[1].x = 3;
    step(m, BTN.S, 0, DEFS);
    expect(m.f[0].state).toBe('quote');
    const evs = run(m, 2, 0, BTN.S);
    expect(m.f[1].state).not.toBe('quote');
    expect(evs.some((e) => e.t === 'outOfOrder' && e.by === 1)).toBe(true);
  });

  it('a Super stops time for the opponent', () => {
    const m = started(); close(m);
    m.f[0].eng = 100;
    step(m, BTN.X, 0, DEFS);
    const x = m.f[1].x, timer = m.timer;
    run(m, SUPER_STARTUP - 2, 0, BTN.P);
    expect(m.f[1].state).toBe('idle');
    expect(m.f[1].x).toBe(x);
    expect(m.f[0].hp).toBe(100);
    expect(m.timer).toBe(timer);
  });

  it('a Super can be used once per round', () => {
    const m = started(); m.f[0].x = -5; m.f[1].x = 5;
    m.f[0].eng = 100;
    step(m, BTN.X, 0, DEFS);
    run(m, 120);
    m.f[0].eng = 100;
    const evs = run(m, 1, BTN.X);
    expect(evs.some((e) => e.t === 'superStart')).toBe(false);
  });

  it('out of cardio, the sidekick tags in and soaks hits; three is a scandal', () => {
    const m = started(); close(m);
    m.f[1].cardio = 0;
    const evs = run(m, WINDED_FRAMES + 2);
    expect(evs.some((e) => e.t === 'tagIn' && e.by === 1)).toBe(true);
    expect(m.f[1].tag).toBeGreaterThan(0);
    const hp = m.f[1].hp;
    const out: Ev[] = [];
    for (let k = 0; k < 3; k++) {
      close(m); m.f[0].state = 'idle'; m.f[1].state = 'idle';
      step(m, BTN.P, 0, DEFS); out.push(...run(m, 30));
    }
    out.push(...run(m, 60));
    expect(m.f[1].skHits).toBeGreaterThanOrEqual(3);
    expect(out.some((e) => e.t === 'tagOut' && e.scandal)).toBe(true);
    expect(m.f[1].hp).toBeCloseTo(hp - SCANDAL_DAMAGE);
    expect(m.f[1].skOut).toBe(true);
  });

  it('the sidekick leaves after its time and the billionaire is rested', () => {
    const m = started(); m.f[0].x = -5; m.f[1].x = 5;
    m.f[0].cardio = 30;
    step(m, BTN.T, 0, DEFS);
    expect(m.f[0].tag).toBe(TAG_FRAMES);
    const evs = run(m, TAG_FRAMES + 2);
    expect(evs.some((e) => e.t === 'tagOut' && !e.scandal)).toBe(true);
    expect(m.f[0].cardio).toBeGreaterThan(80);
  });

  it('cardio drains under steady pressure', () => {
    const m = started(); close(m);
    for (let k = 0; k < 12; k++) { step(m, BTN.K, 0, DEFS); run(m, 40); close(m); m.f[1].hp = 100; }
    expect(m.f[0].cardio).toBeLessThan(40);
  });
});
