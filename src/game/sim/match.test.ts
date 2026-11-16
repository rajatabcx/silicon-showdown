import { describe, expect, it } from 'vitest';
import { simDef, TEAL, TUSK } from '../data/roster';
import { cpuInput, makeCpu } from './ai/cpu';
import {
  FACT_CHECK_WINDOW, INTRO_FRAMES, MOVES, SCANDAL_DAMAGE, STAGE_HALF, SUPER_COST, SUPER_DAMAGE, SUPER_GAP, SUPER_STARTUP, TAG_FRAMES,
  WINDED_FRAMES,
} from './constants';
import { hashMatch, newMatch, step } from './match';
import { makeRng } from './rng';
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

  it("a Super can't be blocked, dodged or missed, even from across the room", () => {
    for (const setup of ['block', 'dodge', 'far'] as const) {
      const m = started();
      if (setup === 'far') { m.f[0].x = -5; m.f[1].x = 5; } else close(m);
      m.f[0].eng = 100;
      step(m, BTN.X, 0, DEFS);
      const hold = setup === 'block' ? BTN.R : setup === 'dodge' ? BTN.G : 0;
      const evs = run(m, SUPER_STARTUP + 2, 0, hold);
      expect(evs.some((e) => e.t === 'superHit')).toBe(true);
      expect(m.phase).toBe('cine');
    }
  });

  it("a sidekick's Policy Move freezes the opponent and always lands", () => {
    for (const side of [0, 1] as const) {
      const m = started();
      m.f[0].x = -5; m.f[1].x = 5;
      m.f[side].cardio = 10;
      const tap = (b: number) => (side === 0 ? step(m, b, 0, DEFS) : step(m, 0, b, DEFS));
      tap(BTN.T); tap(0);
      expect(m.f[side].tag).toBeGreaterThan(0);
      tap(BTN.S);
      expect(m.f[side].state).toBe('quote');
      const other = m.f[1 - side], x = other.x;
      // The opponent holds back to block, and tries to walk and dodge: none of it may happen.
      const back = side === 0 ? BTN.R : BTN.L;
      const evs: Ev[] = [];
      for (let k = 0; k < 400; k++) {
        step(m, side === 0 ? 0 : back | (k % 20 === 0 ? BTN.G : 0), side === 0 ? back | (k % 20 === 0 ? BTN.G : 0) : 0, DEFS);
        evs.push(...m.events);
        if (m.f[side].state === 'quote' || m.f[side].state === 'sig') expect(other.x).toBe(x);
      }
      expect(evs.some((e) => e.t === 'hit' && e.by === side)).toBe(true);
      expect(evs.some((e) => e.t === 'block')).toBe(false);
    }
  });

  it('stress: every Super that starts plays in full and lands, whatever else is going on', () => {
    let supers = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const m = newMatch();
      const a = makeCpu('hard', seed), b = makeCpu('hard', seed + 100);
      let r = seed * 9301;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      // Watch each Super: who called it, the frame it started, the defender's health then, and whether it landed.
      const live: ({ at: number; hp: number; hit: boolean } | null)[] = [null, null];
      let n = 0;
      while (m.phase !== 'matchEnd' && n++ < 60 * 60 * 8) {
        // Engagement is handed out generously and both sides mash random buttons on top of the CPU, Super included.
        if (n % 240 === 0) for (const f of m.f) f.eng = Math.min(100, f.eng + 40);
        const noise = () => (rnd() < 0.08 ? 1 << Math.floor(rnd() * 10) : 0);
        step(m, cpuInput(a, m, 0, DEFS[0], DEFS[1]) | noise(), cpuInput(b, m, 1, DEFS[1], DEFS[0]) | noise(), DEFS);
        for (const e of m.events) {
          if (e.t === 'superStart') { expect(live[e.by]).toBeNull(); live[e.by] = { at: n, hp: m.f[1 - e.by].hp, hit: false }; supers++; }
          if (e.t === 'superHit') { expect(live[e.by]).not.toBeNull(); live[e.by]!.hit = true; expect(n - live[e.by]!.at).toBe(SUPER_STARTUP); }
          if (e.t === 'superLand') {
            const s = live[e.by]!;
            expect(s.hit).toBe(true);
            expect(s.hp - m.f[1 - e.by].hp).toBeGreaterThanOrEqual(Math.min(s.hp, SUPER_DAMAGE) - 0.01);
            live[e.by] = null;
          }
          // Nobody lays a hand on a fighter whose Super is running.
          if (e.t === 'hit' || e.t === 'block' || e.t === 'counter') expect(live[e.by === 0 ? 1 : 0]).toBeNull();
        }
        if (m.phase !== 'fight' && m.phase !== 'cine') { live[0] = null; live[1] = null; }
      }
    }
    expect(supers).toBeGreaterThan(40);
  });

  it('a Super pressed during hit-stop or mid-punch still fires', () => {
    const m = started(); close(m);
    m.f[0].eng = 100; m.f[1].eng = 0;
    step(m, BTN.P, 0, DEFS);
    let fired = false;
    for (let k = 0; k < 30 && !fired; k++) {
      step(m, k === 6 ? BTN.X : 0, 0, DEFS);
      fired = m.f[0].state === 'superStart' || m.phase === 'cine';
    }
    expect(fired).toBe(true);
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

// Every way the owner saw a Super fail in live play. The rule: with the gold mark lit, Enter always gives the
// whole cinematic and the whole damage, and nothing the other side does can stop it.
describe('a Super cannot be lost or interrupted', () => {
  /** Runs until the Super has landed; returns every event, and fails if it never starts. */
  function playSuper(m: Match, by: 0 | 1, max = 400) {
    const evs: Ev[] = [];
    let n = 0;
    const going = () => m.f[by].state === 'superStart' || (m.phase === 'cine' && m.cineBy === by);
    while (!going() && n++ < max) { step(m, 0, 0, DEFS); evs.push(...m.events); }
    expect(going(), 'the Super started').toBe(true);
    n = 0;
    while (!evs.some((e) => e.t === 'superLand' && e.by === by) && n++ < 1200) { step(m, BTN.P | BTN.L, BTN.P | BTN.K | BTN.G, DEFS); evs.push(...m.events); }
    expect(evs.some((e) => e.t === 'superLand' && e.by === by), 'the Super landed').toBe(true);
    return evs;
  }

  it('pressed while being hit, it breaks the combo and fires at once', () => {
    const m = started(); close(m);
    m.f[0].eng = 100;
    step(m, 0, BTN.P, DEFS);
    while (m.f[0].state !== 'hitstun') step(m, 0, 0, DEFS);
    const hp = m.f[1].hp;
    const evs = run(m, 12, BTN.X);
    expect(evs.some((e) => e.t === 'superStart' && e.by === 0)).toBe(true);
    playSuper(m, 0, 0);
    expect(m.f[1].hp).toBeCloseTo(hp - SUPER_DAMAGE, 1);
  });

  it('pressed while knocked down, it waits and fires as he gets up', () => {
    const m = started(); close(m);
    m.f[0].eng = 100;
    step(m, 0, BTN.D | BTN.K, DEFS);
    while (m.f[0].state !== 'knockdown') step(m, 0, 0, DEFS);
    run(m, 10);
    step(m, BTN.X, 0, DEFS);
    step(m, 0, 0, DEFS);
    expect(m.f[0].state).toBe('knockdown');
    playSuper(m, 0);
  });

  it('pressed during hit-stop in the middle of his own combo, it still fires', () => {
    const m = started(); close(m);
    m.f[0].eng = 100;
    step(m, BTN.P, 0, DEFS);
    while (m.hitstop === 0) step(m, 0, 0, DEFS);
    step(m, BTN.X, 0, DEFS);
    playSuper(m, 0, 40);
  });

  it("pressed while the other side's Policy Move has him frozen, it fires when the freeze ends", () => {
    const m = started(); m.f[0].x = -2; m.f[1].x = 2;
    m.f[0].cardio = 30; m.f[1].eng = 100;
    step(m, BTN.T, 0, DEFS);
    run(m, 3);
    step(m, BTN.S, 0, DEFS);
    expect(m.f[0].state).toBe('quote');
    run(m, 20);
    step(m, 0, BTN.X, DEFS);
    run(m, 5);
    expect(m.f[1].state).not.toBe('superStart');
    playSuper(m, 1, 600);
  });

  it('pressed in the air after jumping over the opponent, he lands facing them', () => {
    const m = started(); m.f[0].x = -1; m.f[1].x = 0.6;
    m.f[0].eng = 100;
    step(m, BTN.U | BTN.R, 0, DEFS);
    while (m.f[0].x < m.f[1].x + 0.3 && m.f[0].state === 'jump') step(m, BTN.R, 0, DEFS);
    expect(m.f[0].state).toBe('jump');
    step(m, BTN.X, 0, DEFS);
    expect(m.f[0].state).toBe('superStart');
    run(m, SUPER_STARTUP + 1);
    expect(m.phase).toBe('cine');
    expect(Math.sign(m.f[1].x - m.f[0].x)).toBe(m.f[0].facing);
    expect(m.f[1].facing).toBe(-m.f[0].facing);
    expect(m.f[0].y).toBe(0);
  });

  it('in either corner the pair is stood a fixed distance apart, inside the room', () => {
    for (const [ax, vx] of [[-STAGE_HALF, -STAGE_HALF + 1.4], [STAGE_HALF - 1.4, STAGE_HALF], [STAGE_HALF, STAGE_HALF - 1.4], [-5, 5]]) {
      const m = started(); m.f[0].x = ax; m.f[1].x = vx;
      step(m, 0, 0, DEFS);
      m.f[0].eng = 100;
      step(m, BTN.X, 0, DEFS);
      run(m, SUPER_STARTUP + 1);
      expect(m.phase).toBe('cine');
      expect(Math.abs(m.f[0].x - m.f[1].x)).toBeCloseTo(SUPER_GAP);
      for (const f of m.f) expect(Math.abs(f.x)).toBeLessThanOrEqual(STAGE_HALF + 1e-9);
      expect(Math.sign(m.f[1].x - m.f[0].x)).toBe(m.f[0].facing);
    }
  });

  it('when both press on the same frame, both Supers play, one after the other', () => {
    const m = started(); close(m);
    m.f[0].eng = 100; m.f[1].eng = 100;
    step(m, BTN.X, BTN.X, DEFS);
    const evs = playSuper(m, 0, 0);
    expect(evs.some((e) => e.t === 'superStart' && e.by === 1)).toBe(false);
    const second = playSuper(m, 1, 300);
    expect(second.some((e) => e.t === 'superDamage' && e.by === 1)).toBe(true);
    expect(m.f[0].hp).toBeCloseTo(100 - SUPER_DAMAGE, 0);
    expect(m.f[1].hp).toBeLessThan(100 - SUPER_DAMAGE + 1);
  });

  it('against a tagged-in sidekick, the billionaire is called back and takes all of it', () => {
    const m = started(); close(m);
    m.f[1].cardio = 30;
    step(m, 0, BTN.T, DEFS);
    expect(m.f[1].tag).toBeGreaterThan(0);
    m.f[0].eng = 100;
    const hp = m.f[1].hp;
    step(m, BTN.X, 0, DEFS);
    const evs = playSuper(m, 0, 0);
    expect(evs.some((e) => e.t === 'tagOut' && e.by === 1 && !e.scandal)).toBe(true);
    expect(m.f[1].tag).toBe(0);
    expect(m.f[1].hp).toBeCloseTo(hp - SUPER_DAMAGE, 1);
  });

  it("the clock running out can't cut off a Super that was already called", () => {
    const m = started(); close(m);
    m.f[0].eng = 100; m.timer = 1;
    step(m, BTN.X, 0, DEFS);
    expect(m.phase).toBe('fight');
    const evs = playSuper(m, 0, 0);
    expect(evs.some((e) => e.t === 'timeUp')).toBe(false);
    expect(m.f[1].hp).toBeCloseTo(100 - SUPER_DAMAGE, 1);
    expect(run(m, 20).some((e) => e.t === 'timeUp')).toBe(true);
  });

  it('a press made out of breath or mid-dodge still fires', () => {
    for (const setup of ['winded', 'dodge'] as const) {
      const m = started(); close(m);
      m.f[0].eng = 100;
      if (setup === 'winded') { m.f[0].cardio = 0; run(m, 3); } else { step(m, BTN.G, 0, DEFS); run(m, 3); }
      expect(m.f[0].state).toBe(setup);
      step(m, BTN.X, 0, DEFS);
      expect(m.f[0].state).toBe('superStart');
    }
  });

  it('fuzz: random mashing on both sides never loses a press or cuts a Super short', () => {
    const all = [BTN.L, BTN.R, BTN.U, BTN.D, BTN.P, BTN.K, BTN.S, BTN.G, BTN.T];
    let supers = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = makeRng(seed * 7919);
      const m = started();
      const hold = [0, 0], until = [0, 0];
      /** Frame each side tapped Enter with the Super ready, until it starts. */
      const asked: (number | null)[] = [null, null];
      let live: { by: 0 | 1; frames: number; hp: number; startup: number } | null = null;
      for (let n = 0; n < 60 * 45 && m.phase !== 'matchEnd'; n++) {
        const ins = [0, 0];
        for (const i of [0, 1] as const) {
          const f = m.f[i];
          if (m.phase === 'fight' && rng() < 0.01) { f.eng = 100; f.cardio = Math.max(f.cardio, rng() < 0.5 ? 10 : 80); }
          if (n >= until[i]) {
            hold[i] = 0;
            for (const b of all) if (rng() < 0.22) hold[i] |= b;
            until[i] = n + 1 + Math.floor(rng() * 14);
          }
          ins[i] = hold[i];
          const ready = f.tag <= 0 && f.eng >= SUPER_COST && f.melt <= 0 && !f.superUsed;
          if (ready && m.phase === 'fight' && asked[i] === null && rng() < 0.05 && !(f.prev & BTN.X)) { ins[i] |= BTN.X; asked[i] = n; }
        }
        const wasStop = m.hitstop > 0, phase = m.phase;
        step(m, ins[0], ins[1], DEFS);
        if (live && phase === 'cine') live.frames++;
        for (const e of m.events) {
          if (e.t === 'superStart') {
            expect(live, `seed ${seed}: a second Super started during one`).toBeNull();
            live = { by: e.by, frames: 0, hp: m.f[1 - e.by].hp, startup: 0 };
            asked[e.by] = null; supers++;
          }
          if (e.t === 'roundStart') { asked[0] = asked[1] = null; }
          if (live && e.t === 'superLand') {
            expect(live.frames, `seed ${seed}: full cinematic`).toBe(DEFS[live.by].super.frames);
            const d = m.f[1 - live.by];
            expect(live.hp - d.hp, `seed ${seed}: full damage`).toBeGreaterThanOrEqual(Math.min(SUPER_DAMAGE, live.hp) - 0.01);
            live = null;
          }
          if (live && (e.t === 'hit' || e.t === 'block' || e.t === 'ko' || e.t === 'timeUp' || e.t === 'tagIn' || e.t === 'quote')) {
            throw new Error(`seed ${seed}: ${e.t} happened during a Super`);
          }
        }
        if (live && phase === 'fight' && !wasStop && m.f[live.by].state === 'superStart') {
          expect(++live.startup, `seed ${seed}: the flash is not held up`).toBeLessThanOrEqual(SUPER_STARTUP + 1);
        }
        // A remembered press can only be waiting on the floor, a freeze, or the round ending.
        for (const i of [0, 1] as const) {
          const f = m.f[i];
          if (asked[i] === null) continue;
          if (m.phase === 'roundEnd' || m.phase === 'intro' || m.phase === 'matchEnd' || f.tag > 0 || f.melt > 0) { asked[i] = null; continue; }
          const waiting = f.state === 'knockdown' || f.state === 'ko' || m.phase === 'cine' || m.hitstop > 0 || live !== null ||
            m.f[1 - i].tag > 0;
          if (!waiting) expect(n - asked[i]!, `seed ${seed}: side ${i} pressed Enter at ${asked[i]} and is ${f.state}`).toBeLessThan(3);
          else asked[i] = n;
        }
      }
    }
    expect(supers).toBeGreaterThan(40);
  });
});
