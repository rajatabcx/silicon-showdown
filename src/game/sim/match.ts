import {
  BODY_WIDTH, CARDIO_REGEN, REACH_PAD, DODGE_FRAMES, DODGE_INVULN, DODGE_SLIDE, ENG_DECAY,
  ENG_HIT, ENG_QUIET_FRAMES, ENG_SIG_LAND, ENG_SIG_SAID, GRAVITY, INTRO_FRAMES,
  JUMP_SCALE, MOVES, ROUND_END_FRAMES, ROUND_FRAMES, STAGE_HALF, START_X,
  SUPER_BUFFER, SUPER_COST, SUPER_DAMAGE, SUPER_GAP, SUPER_STARTUP, TIER_DEALT, TIER_TAKEN, tierOf,
  WALK_SCALE, WINDED_FRAMES, SIG_CARDIO, SIG_COOLDOWN, SIG_REACH, TAG_FRAMES, TAG_MANUAL_CARDIO, SIDEKICK_HITS,
  SCANDAL_DAMAGE, SIDEKICK_DAMAGE, TAG_REGEN,
} from './constants';
import { BTN, type Fighter, type Match, type MoveKey, type SigDef, type SimDef } from './types';

type Defs = [SimDef, SimDef];

function newFighter(side: 0 | 1): Fighter {
  return {
    x: side === 0 ? -START_X : START_X, y: 0, vx: 0, vy: 0, facing: side === 0 ? 1 : -1,
    hp: 100, eng: 0, cardio: 100, state: 'idle', frame: 0, stun: 0,
    move: null, af: 0, hit: false, chain: 0, buf: 0, combo: 0, prev: 0, cur: 0,
    sig: 0, sigHits: 0, dropX: 0, sigCd: 0, quiet: 0, wins: 0,
    superUsed: false, superBuf: 0, tag: 0, skHits: 0, skOut: false, skPolicy: false,
  };
}

export function newMatch(roundsToWin = 2): Match {
  return {
    f: [newFighter(0), newFighter(1)], proj: [], frame: 0, timer: ROUND_FRAMES, round: 1,
    phase: 'intro', phaseFrame: 0, cineBy: 0, hitstop: 0, roundWinner: -1, winner: -1, roundsToWin, events: [],
  };
}

function resetRound(m: Match) {
  for (const i of [0, 1] as const) {
    const old = m.f[i];
    const f = newFighter(i);
    f.eng = Math.min(old.eng, 50); f.wins = old.wins;
    m.f[i] = f;
  }
  m.proj = []; m.timer = ROUND_FRAMES; m.hitstop = 0; m.roundWinner = -1; m.phaseFrame = 0;
}

/** The signature being said or done: 0..2 are the billionaire's, 3 is the sidekick's Policy Move. */
export const sigAt = (def: SimDef, k: number): SigDef => (k === 3 ? def.sidekick.policy : def.sigs[k]);
export const sigOf = (def: SimDef, f: Fighter): SigDef => sigAt(def, f.sig);

const isNeutral = (f: Fighter) => f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';
const dodging = (f: Fighter) => f.state === 'dodge' && f.frame >= DODGE_INVULN[0] && f.frame <= DODGE_INVULN[1];
const isInvincible = (f: Fighter) =>
  f.state === 'knockdown' || f.state === 'getup' || f.state === 'ko' || f.state === 'win' || f.state === 'superStart' || dodging(f);
const backBit = (f: Fighter) => (f.facing === 1 ? BTN.L : BTN.R);
const fwdBit = (f: Fighter) => (f.facing === 1 ? BTN.R : BTN.L);
const holdsBack = (f: Fighter) => (f.cur & backBit(f)) !== 0;
/**
 * Is fighter i staging a signature or a Policy Move: from the first word until the last hit has landed (thrown things
 * included)? The opponent is frozen for all of it, so it can't be interrupted, blocked, dodged or missed.
 */
export const staging = (m: Match, i: 0 | 1) => {
  const f = m.f[i];
  return f.state === 'quote' || (f.state === 'sig' && !f.hit) || m.proj.some((p) => p.owner === i);
};
const superReady = (f: Fighter) => f.tag <= 0 && f.eng >= SUPER_COST && !f.superUsed;
/**
 * A Super fires out of anything except lying on the floor: standing, walking, a punch or kick, a block, a jump, a line,
 * a dodge, getting up, being out of breath, and even while being hit (it breaks the combo).
 */
const SUPER_FROM = new Set<Fighter['state']>([
  'idle', 'walk', 'crouch', 'attack', 'blockstun', 'hitstun', 'jump', 'quote', 'sig', 'dodge', 'getup', 'winded',
]);
/**
 * Remember a Super press. Called on every tick for both fighters, including ticks where that fighter is frozen
 * (hit-stop, the other side's Super or Policy Move), so a press made with the gold mark lit is never thrown away.
 */
function noteSuper(f: Fighter, pressed: number) {
  if (pressed & BTN.X && superReady(f)) f.superBuf = SUPER_BUFFER;
}
const faceOpponent = (f: Fighter, o: Fighter) => { if (o.x !== f.x) f.facing = o.x > f.x ? 1 : -1; };
const canGuard = (f: Fighter) => (isNeutral(f) || f.state === 'blockstun') && holdsBack(f);
/** A signature can only start against someone standing in the fight (not on the floor, not mid-Super or mid-line). */
const canBeStaged = (o: Fighter) => !['knockdown', 'getup', 'ko', 'win', 'superStart', 'quote', 'sig'].includes(o.state);

function addEng(m: Match, i: 0 | 1, n: number) {
  const f = m.f[i];
  const before = tierOf(f.eng);
  f.eng = Math.max(0, Math.min(100, f.eng + n));
  const after = tierOf(f.eng);
  if (after > before) m.events.push({ t: 'tier', by: i, tier: after });
}

function startAttack(m: Match, i: 0 | 1, key: MoveKey, def: SimDef) {
  const f = m.f[i];
  f.state = 'attack'; f.move = key; f.af = 0; f.hit = false; f.buf = 0; f.frame = 0;
  if (f.tag <= 0) f.cardio -= MOVES[key].cardio / def.fitness;
  m.events.push({ t: 'whiff', by: i, move: key });
}

function airborne(f: Fighter) {
  f.y += f.vy; f.vy -= GRAVITY; f.x += f.vx;
  if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.vx = 0; return true; }
  return false;
}

function toIdle(f: Fighter) { f.state = 'idle'; f.move = null; f.frame = 0; f.af = 0; }

function tagIn(m: Match, i: 0 | 1, manual: boolean) {
  const f = m.f[i];
  f.tag = TAG_FRAMES; f.skHits = 0; f.skPolicy = false;
  toIdle(f); f.combo = 0;
  m.events.push({ t: 'tagIn', by: i, manual });
}

function tagOut(m: Match, i: 0 | 1, scandal: boolean) {
  const f = m.f[i];
  f.tag = 0;
  if (scandal) { f.skOut = true; f.hp = Math.max(1, f.hp - SCANDAL_DAMAGE); }
  if (f.state === 'quote' || f.state === 'sig' || f.state === 'attack') toIdle(f);
  m.events.push({ t: 'tagOut', by: i, scandal });
}

/**
 * Start a signature (0..2) or a Policy Move (3). The opponent is frozen from here on: whatever they were starting
 * (a punch, a jump, a dodge) is dropped and they stand where they are until the move has landed.
 */
function beginSig(m: Match, i: 0 | 1, k: number) {
  const f = m.f[i], o = m.f[1 - i];
  f.sig = k; f.sigHits = 0; f.state = 'quote'; f.frame = 0; f.quiet = 0; f.hit = false; f.move = null;
  faceOpponent(f, o);
  if (o.state === 'attack' || o.state === 'jump' || o.state === 'dodge' || o.state === 'walk' || o.state === 'crouch') {
    toIdle(o); o.y = 0; o.vy = 0; o.vx = 0;
  }
  m.events.push({ t: 'quote', by: i, sig: k });
}

function updateFighter(m: Match, i: 0 | 1, inp: number, defs: Defs) {
  const def = defs[i];
  const f = m.f[i];
  const o = m.f[1 - i];
  f.cur = inp;
  const pressed = inp & ~f.prev;
  f.prev = inp;
  if (f.sigCd > 0 && f.state !== 'quote' && f.state !== 'sig') f.sigCd--;

  // Super: once it fires, nothing can stop it. The press was checked against the meter when it was made; it then
  // waits (without running out) while the fighter is on the floor, and fires the moment they can move.
  noteSuper(f, pressed);
  if (f.superBuf > 0) {
    const can = f.tag <= 0 && !f.superUsed;
    if (!can) f.superBuf = 0;
    else if (SUPER_FROM.has(f.state) && o.state !== 'superStart' && m.phase === 'fight') {
      f.superBuf = 0; f.eng = 0; f.superUsed = true;
      f.state = 'superStart'; f.frame = 0; f.move = null; f.y = 0; f.vy = 0; f.vx = 0; f.stun = 0;
      faceOpponent(f, o);
      m.events.push({ t: 'superStart', by: i });
      return;
    } else if (SUPER_FROM.has(f.state)) f.superBuf--;
  }

  switch (f.state) {
    case 'idle': case 'walk': case 'crouch': {
      f.combo = 0; f.chain = 0; f.move = null;
      const sk = f.tag > 0;
      if (!sk && f.cardio <= 0) { f.state = 'winded'; f.frame = 0; m.events.push({ t: 'winded', by: i }); return; }
      if (!sk) f.cardio = Math.min(100, f.cardio + CARDIO_REGEN * def.fitness * (f.state === 'walk' ? 0.5 : 1));
      const fwd = (inp & fwdBit(f)) !== 0, back = (inp & backBit(f)) !== 0, down = (inp & BTN.D) !== 0;
      if (!sk && pressed & BTN.T && f.cardio < TAG_MANUAL_CARDIO && !f.skOut) { tagIn(m, i, true); return; }
      if (pressed & BTN.S && (sk ? !f.skPolicy : f.sigCd <= 0)) {
        // One speaker has the floor: no new line while the other side is still talking.
        if (o.state === 'quote' || o.state === 'sig') { m.events.push({ t: 'outOfOrder', by: i }); return; }
        // Someone on the floor can't be hit by one: wait for them to get up.
        if (canBeStaged(o)) {
          if (sk) f.skPolicy = true;
          else { f.cardio -= SIG_CARDIO / def.fitness; f.sigCd = SIG_COOLDOWN; }
          beginSig(m, i, sk ? 3 : down ? 2 : fwd ? 1 : 0);
          return;
        }
      }
      if (!sk && pressed & BTN.G) {
        f.state = 'dodge'; f.frame = 0; m.events.push({ t: 'dodge', by: i });
        return;
      }
      if (pressed & BTN.P) { f.chain = 1; startAttack(m, i, 'jab', def); return; }
      if (pressed & BTN.K) { f.chain = 0; startAttack(m, i, sk ? 'kick' : down ? 'sweep' : fwd ? 'kick' : 'upper', def); return; }
      if (inp & BTN.U) {
        f.state = 'jump'; f.vy = def.jump * JUMP_SCALE; f.frame = 0;
        f.vx = (fwd ? 1 : back ? -0.8 : 0) * f.facing * def.walk * WALK_SCALE * 1.25;
        f.cardio -= 5 / def.fitness;
        m.events.push({ t: 'jump', by: i }); return;
      }
      if (down) { f.state = 'crouch'; f.frame++; return; }
      if (fwd || back) {
        f.state = 'walk'; f.frame++;
        f.x += f.facing * (fwd ? 1 : -0.78) * (sk ? def.sidekick.walk : def.walk) * WALK_SCALE;
        return;
      }
      if (f.state !== 'idle') f.frame = 0;
      f.state = 'idle'; f.frame++;
      return;
    }
    case 'jump': {
      f.frame++;
      if (f.move) f.af++;
      else if (pressed & BTN.P) { f.move = 'airPunch'; f.af = 0; f.hit = false; m.events.push({ t: 'whiff', by: i, move: 'airPunch' }); }
      else if (pressed & BTN.K) { f.move = 'airKick'; f.af = 0; f.hit = false; m.events.push({ t: 'whiff', by: i, move: 'airKick' }); }
      if (airborne(f)) toIdle(f);
      return;
    }
    case 'attack': {
      const key = f.move!;
      const mv = MOVES[key];
      f.af++;
      if (mv.lunge && f.af <= mv.startup) f.x += (f.facing * mv.lunge) / mv.startup;
      if (mv.chain && pressed & (BTN.P | BTN.K)) f.buf = pressed & (BTN.P | BTN.K);
      if (f.buf && mv.chain && f.af > mv.startup + mv.active) {
        const punch = (f.buf & BTN.P) !== 0;
        f.chain++;
        if (f.tag > 0 && f.chain > 2) { f.buf = 0; return; }
        startAttack(m, i, f.chain === 2 ? (punch ? 'cross' : 'roundhouse') : punch ? 'hook' : 'roundhouse', def);
        return;
      }
      if (f.af >= mv.startup + mv.active + mv.recovery) toIdle(f);
      return;
    }
    case 'quote': {
      const sg = sigOf(def, f);
      if (++f.frame < sg.quote) return;
      addEng(m, i, ENG_SIG_SAID);
      f.state = 'sig'; f.af = 0; f.hit = false;
      faceOpponent(f, o);
      // A drop lands on the opponent; a melee move dashes in until it's in reach.
      if (sg.kind === 'drop') f.dropX = o.x;
      if (sg.kind === 'melee') f.dropX = Math.abs(o.x - f.x) > SIG_REACH ? o.x - f.facing * SIG_REACH : f.x;
      m.events.push({ t: 'sigGo', by: i, sig: f.sig });
      return;
    }
    case 'sig': {
      const sg = sigOf(def, f);
      f.af++;
      if (sg.kind === 'melee' && f.af <= sg.startup) f.x += (f.dropX - f.x) / (sg.startup - f.af + 1);
      if (sg.kind === 'projectile') {
        const n = sg.hits ?? 1;
        for (let k = 0; k < n; k++) {
          if (f.af !== sg.startup + k * 12) continue;
          const x0 = f.x + f.facing * 0.7, vx = f.facing * (sg.speed ?? 0.12);
          // Lobbed to land on the (frozen) opponent at chest height, however far away.
          const T = Math.max(1, Math.abs(o.x - x0) / Math.abs(vx));
          const vy = (-0.3 + 0.5 * GRAVITY * 0.8 * T * T) / T || 0.001;
          m.proj.push({
            owner: i, sig: f.sig, x: x0, y: 1.3, vx, vy,
            dmg: sg.damage, knockdown: !!sg.knockdown && k === n - 1,
          });
          m.events.push({ t: 'throw', by: i, sig: f.sig });
          if (k === n - 1) f.hit = true;
        }
      }
      if (f.af >= sg.startup + sg.active + sg.recovery) { f.hit = true; toIdle(f); if (f.sig !== 3) f.sigCd = SIG_COOLDOWN; }
      return;
    }
    case 'dodge': {
      if (f.frame >= DODGE_INVULN[0] && f.frame <= DODGE_INVULN[1]) f.x -= f.facing * DODGE_SLIDE;
      if (++f.frame >= DODGE_FRAMES) toIdle(f);
      return;
    }
    case 'hitstun': case 'blockstun': {
      f.stun--; f.x += f.vx; f.vx *= 0.82; f.frame++;
      if (f.stun <= 0) { toIdle(f); f.vx = 0; }
      return;
    }
    case 'knockdown': {
      if (f.y > 0 || f.vy > 0) { f.frame++; if (airborne(f)) f.frame = 0; }
      else if (++f.frame >= 40) { f.state = 'getup'; f.frame = 0; }
      return;
    }
    case 'getup': {
      if (++f.frame >= 26) { toIdle(f); f.combo = 0; }
      return;
    }
    case 'winded': {
      if (++f.frame >= WINDED_FRAMES) {
        if (f.skOut) { f.cardio = 40; toIdle(f); } else tagIn(m, i, false);
      }
      return;
    }
    case 'superStart': {
      if (++f.frame < SUPER_STARTUP) return;
      // A Super always plays in full: it can't be blocked, dodged or missed, so everyone gets to see it.
      // Both fighters are stood a fixed distance apart, facing each other, inside the room: the caller closes the
      // distance (or steps back), an airborne opponent is pulled down, and a pair in the corner is moved in together.
      faceOpponent(f, o);
      f.x = Math.max(-STAGE_HALF + (f.facing === 1 ? 0 : SUPER_GAP), Math.min(STAGE_HALF - (f.facing === 1 ? SUPER_GAP : 0), o.x - f.facing * SUPER_GAP));
      o.x = f.x + f.facing * SUPER_GAP;
      o.facing = -f.facing as 1 | -1;
      o.y = 0; o.vy = 0;
      m.phase = 'cine'; m.phaseFrame = 0; m.cineBy = i;
      if (o.tag > 0) tagOut(m, (1 - i) as 0 | 1, false);
      o.move = null; o.vx = 0; o.state = 'hitstun'; o.stun = 1;
      m.proj = [];
      m.events.push({ t: 'superHit', by: i });
      return;
    }
    case 'ko': case 'win': {
      if (f.y > 0 || f.vy > 0) airborne(f);
      f.frame++;
      return;
    }
  }
}

const clampX = (x: number) => Math.max(-STAGE_HALF, Math.min(STAGE_HALF, x));

/** How much of a hit lands on fighter `di`'s health, from the attacker's power and the defender's toughness. */
const scale = (defs: Defs, ai: number, di: number) => defs[ai].power * (100 / defs[di].health);

function dealHit(
  m: Match, defs: Defs, ai: 0 | 1, dir: number, base: number, key: MoveKey | 'sig',
  o: { hitstun: number; knockdown?: boolean; launch?: boolean; heavy?: boolean },
) {
  const a = m.f[ai], d = m.f[1 - ai];
  const dmg = base * Math.max(0.5, 1 - 0.1 * d.combo) * TIER_DEALT[tierOf(a.eng)] * TIER_TAKEN[tierOf(d.eng)] *
    (a.tag > 0 ? SIDEKICK_DAMAGE : 1) * scale(defs, ai, 1 - ai);
  d.combo++;
  const knock = !!o.knockdown || d.y > 0;
  // A sidekick soaks hits instead of the billionaire's health; three and it's a scandal.
  if (d.tag > 0) d.skHits++;
  else d.hp -= dmg;

  if (d.state === 'winded') d.cardio = Math.max(d.cardio, 30);
  addEng(m, ai, key === 'sig' ? ENG_SIG_LAND : ENG_HIT);
  a.quiet = key === 'sig' ? 0 : a.quiet;
  d.move = null; d.frame = 0;
  if (o.launch) { d.state = 'knockdown'; d.vy = 0.2; d.vx = dir * 0.03; }
  else if (knock) { d.state = 'knockdown'; d.vy = 0.1; d.vx = dir * 0.06; }
  else { d.state = 'hitstun'; d.stun = o.hitstun; d.vx = dir * 0.045; }
  m.hitstop = key === 'sig' ? 14 : o.heavy ? 10 : 6;
  m.events.push({ t: 'hit', by: ai, move: key, heavy: !!o.heavy || key === 'sig', x: d.x, y: d.y + 1.3, dmg, combo: d.combo });
}

function dealBlock(m: Match, defs: Defs, ai: 0 | 1, dir: number, blockstun: number, chip: number, heavy = false) {
  const d = m.f[1 - ai];
  d.state = 'blockstun'; d.stun = blockstun; d.vx = dir * 0.07; d.frame = 0;
  if (d.tag <= 0) { d.cardio -= heavy ? 9 : 4; d.hp = Math.max(1, d.hp - chip * scale(defs, ai, 1 - ai)); }
  m.hitstop = heavy ? 6 : 4;
  m.events.push({ t: 'block', by: ai, x: d.x, y: d.y + 1.3, heavy });
}

function inFront(a: Fighter, d: Fighter, range: number) {
  return (d.x - a.x) * a.facing >= -0.3 && Math.abs(d.x - a.x) <= range + REACH_PAD;
}

function resolveMelee(m: Match, ai: 0 | 1, defs: Defs) {
  const a = m.f[ai], d = m.f[1 - ai];
  if (!a.move || a.hit || (a.state !== 'attack' && a.state !== 'jump')) return;
  const mv = MOVES[a.move];
  if (a.af <= mv.startup || a.af > mv.startup + mv.active) return;
  if (isInvincible(d)) return;
  if (!inFront(a, d, mv.range)) return;
  const air = a.state === 'jump';
  if (air ? a.y - d.y > 1.7 : d.y > (mv.launch ? 2.4 : 1.3)) return;
  a.hit = true;
  const guarded = canGuard(d) && (mv.low ? (d.cur & BTN.D) !== 0 : mv.overhead ? (d.cur & BTN.D) === 0 : true);
  if (guarded) dealBlock(m, defs, ai, a.facing, mv.blockstun, mv.heavy ? 1 : 0, mv.heavy);
  else dealHit(m, defs, ai, a.facing, mv.damage, a.move, mv);
}

function resolveSig(m: Match, ai: 0 | 1, defs: Defs) {
  const a = m.f[ai];
  if (a.state !== 'sig') return;
  const sg: SigDef = sigOf(defs[ai], a);
  // The opponent has been frozen since the first word, so every hit lands: no range check, no guard.
  if (sg.kind === 'melee') {
    const n = sg.hits ?? 1;
    if (a.sigHits >= n || a.af <= sg.startup || a.af > sg.startup + sg.active) return;
    const due = Math.floor(((a.af - sg.startup - 1) * n) / sg.active);
    if (due < a.sigHits) return;
    a.sigHits++;
    const last = a.sigHits >= n;
    if (last) a.hit = true;
    dealHit(m, defs, ai, a.facing, sg.damage, 'sig', { hitstun: 30, knockdown: last && sg.knockdown, heavy: true });
  } else if (sg.kind === 'drop') {
    if (a.af !== sg.startup) return;
    a.hit = true;
    dealHit(m, defs, ai, a.facing, sg.damage, 'sig', { hitstun: 30, knockdown: sg.knockdown, heavy: true });
  }
}

/** Thrown signatures, all lobbed at a frozen opponent: each one lands (or, if it somehow can't, is removed). */
function resolveProjectiles(m: Match, owner: 0 | 1, defs: Defs) {
  for (let k = m.proj.length - 1; k >= 0; k--) {
    const p = m.proj[k];
    if (p.owner !== owner) continue;
    p.x += p.vx; p.y += p.vy; p.vy -= GRAVITY * 0.8;
    const d = m.f[1 - p.owner];
    if (Math.abs(p.x) > STAGE_HALF + 1.5 || p.y < 0) { m.proj.splice(k, 1); continue; }
    const reached = (p.x - d.x) * Math.sign(p.vx) > -0.55;
    if (reached && d.state !== 'superStart') {
      dealHit(m, defs, p.owner, Math.sign(p.vx), p.dmg, 'sig', { hitstun: 22, knockdown: p.knockdown, heavy: true });
      m.proj.splice(k, 1);
    }
  }
}

function checkKo(m: Match) {
  let ko = -1, both = false;
  for (const i of [0, 1] as const) {
    const f = m.f[i];
    if (f.hp > 0) continue;
    f.hp = 0; f.state = 'ko'; f.move = null; f.frame = 0;
    if (f.y <= 0 && f.vy <= 0) f.vy = 0.1;
    f.vx = -f.facing * 0.05;
    m.events.push({ t: 'ko', by: i });
    if (ko >= 0) both = true;
    ko = i;
  }
  if (ko < 0) return;
  m.phase = 'roundEnd'; m.phaseFrame = 0; m.hitstop = 24;
  m.roundWinner = both ? -1 : ((1 - ko) as 0 | 1);
}

function tagTick(m: Match, defs: Defs) {
  for (const i of [0, 1] as const) {
    const f = m.f[i];
    if (f.tag <= 0) continue;
    f.cardio = Math.min(100, f.cardio + CARDIO_REGEN * defs[i].fitness * TAG_REGEN);
    const busy = f.state === 'quote' || f.state === 'sig' || f.state === 'attack' || f.state === 'jump';
    if (f.skHits >= SIDEKICK_HITS && f.state !== 'hitstun' && f.state !== 'knockdown' && f.state !== 'getup') tagOut(m, i, true);
    else if (--f.tag <= 0 && busy) f.tag = 1;
    else if (f.tag <= 0) tagOut(m, i, false);
  }
}

/** Bozo is customer-obsessed: every hit he takes (not his sidekick) is feedback, and feedback is engagement. */
function feedback(m: Match, defs: Defs) {
  for (let k = m.events.length - 1; k >= 0; k--) {
    const e = m.events[k];
    if (e.t !== 'hit') continue;
    const v = (1 - e.by) as 0 | 1;
    if (defs[v].ego === 'customer' && m.f[v].tag <= 0) addEng(m, v, 2);
    // Carp: every hit is a short seller, and short sellers are crazy motivating.
    if (defs[v].ego === 'triggered' && m.f[v].tag <= 0) addEng(m, v, 3);
    // Jensen: his hits pump the stock; a heavy hit on him is bad news and it tanks.
    if (defs[e.by].ego === 'marketcap' && m.f[e.by].tag <= 0) addEng(m, e.by, 2);
    if (defs[v].ego === 'marketcap' && m.f[v].tag <= 0 && e.heavy) addEng(m, v, -6);
    // Mork: every hit he lands harvests the opponent's Engagement.
    if (defs[e.by].ego === 'harvest' && m.f[e.by].tag <= 0) { addEng(m, v, -2.5); addEng(m, e.by, 1); }
  }
}

function egoTick(m: Match, defs: Defs) {
  for (const i of [0, 1] as const) {
    const f = m.f[i], o = m.f[1 - i];
    f.quiet++;
    if (defs[i].ego === 'contrarian') {
      // Teal feeds on losing and on being booed; being ahead bores him.
      if (f.hp < o.hp - 5) addEng(m, i, 0.045);
      else if (f.hp > o.hp + 5) addEng(m, i, -ENG_DECAY);
      else if (f.quiet > ENG_QUIET_FRAMES) addEng(m, i, -ENG_DECAY * 0.5);
    } else if (defs[i].ego === 'hype') {
      // Ultman's meter never drains: there's always another announcement.
    } else if (f.quiet > ENG_QUIET_FRAMES) {
      // Tusk is needy: stop posting and the meter drains twice as fast. Bozo drains at the normal rate.
      addEng(m, i, -ENG_DECAY * (defs[i].ego === 'needy' ? 2 : 1));
    }
  }
}

/** Advance the match by one 60 Hz tick. Deterministic: same inputs give the same state. */
export function step(m: Match, in0: number, in1: number, defs: Defs) {
  m.events.length = 0;
  m.frame++;
  const ins = [in0, in1];

  if (m.phase === 'matchEnd') return;

  if (m.phase === 'intro') {
    if (m.phaseFrame === 0) m.events.push({ t: 'roundStart', round: m.round });
    for (const i of [0, 1] as const) { m.f[i].prev = ins[i]; m.f[i].cur = 0; m.f[i].frame++; }
    if (++m.phaseFrame >= INTRO_FRAMES) { m.phase = 'fight'; m.events.push({ t: 'fight' }); }
    return;
  }

  if (m.phase === 'cine') {
    for (const i of [0, 1] as const) { noteSuper(m.f[i], ins[i] & ~m.f[i].prev); m.f[i].prev = ins[i]; }
    const ai = m.cineBy, a = m.f[ai], d = m.f[1 - ai], sp = defs[ai].super, sd = SUPER_DAMAGE * scale(defs, ai, 1 - ai);
    const fr = ++m.phaseFrame;
    if (sp.drain) {
      const [from, to] = sp.drain;
      if (fr > from && fr <= to) d.hp = Math.max(0.0001, d.hp - sd / (to - from));
      if (fr === from + 1) m.events.push({ t: 'superDamage', by: ai });
    } else if (fr === sp.hitAt) {
      d.hp = Math.max(0.0001, d.hp - sd);
      m.events.push({ t: 'superDamage', by: ai });
    }
    if (fr < sp.frames) return;
    if (d.hp <= 0.001) d.hp = 0;
    // The cinematic already put them on the floor: they stay down and get up from there.
    d.state = 'knockdown'; d.y = 0; d.vy = 0; d.vx = 0; d.frame = 0; d.combo = 0;
    a.state = 'idle'; a.frame = 0;
    m.phase = 'fight'; m.hitstop = 8;
    m.events.push({ t: 'superLand', by: ai });
    checkKo(m);
    return;
  }

  if (m.hitstop > 0) {
    m.hitstop--;
    for (const i of [0, 1] as const) {
      const f = m.f[i];
      const pressed = ins[i] & ~f.prev;
      if (f.state === 'attack' && pressed & (BTN.P | BTN.K)) f.buf = pressed & (BTN.P | BTN.K);
      noteSuper(f, pressed);
      f.prev = ins[i]; f.cur = ins[i];
    }
    return;
  }

  if (m.phase === 'roundEnd') {
    for (const i of [0, 1] as const) {
      const f = m.f[i];
      if (isNeutral(f) && m.phaseFrame > 40 && m.roundWinner === i) { f.state = 'win'; f.frame = 0; }
      updateFighter(m, i, 0, defs);
    }
    separate(m);
    if (++m.phaseFrame < ROUND_END_FRAMES) return;
    if (m.roundWinner !== -1) m.f[m.roundWinner].wins++;
    const champ = m.f[0].wins >= m.roundsToWin ? 0 : m.f[1].wins >= m.roundsToWin ? 1 : -1;
    if (champ >= 0) {
      m.phase = 'matchEnd'; m.winner = champ as 0 | 1;
      m.events.push({ t: 'matchEnd', winner: champ as 0 | 1 });
    } else {
      m.round++; resetRound(m); m.phase = 'intro';
    }
    return;
  }

  // fight
  // Super flash: time stops for everyone but the fighter calling the Super.
  const caller = m.f[0].state === 'superStart' ? 0 : m.f[1].state === 'superStart' ? 1 : -1;
  if (caller >= 0) {
    const other = m.f[1 - caller];
    noteSuper(other, ins[1 - caller] & ~other.prev);
    other.prev = ins[1 - caller];
    updateFighter(m, caller as 0 | 1, ins[caller], defs);
    return;
  }
  // A signature or a Policy Move: the same freeze for the opponent from the first word until the last hit lands.
  const pi = ([0, 1] as const).find((i) => staging(m, i));
  if (pi !== undefined) {
    const other = m.f[1 - pi];
    noteSuper(other, ins[1 - pi] & ~other.prev);
    other.prev = ins[1 - pi];
    updateFighter(m, pi, ins[pi], defs);
    if (m.phase !== 'fight') return;
    resolveProjectiles(m, pi, defs);
    resolveSig(m, pi, defs);
    feedback(m, defs);
    separate(m);
    checkKo(m);
    return;
  }

  m.timer--;
  tagTick(m, defs);
  updateFighter(m, 0, in0, defs);
  if (m.phase !== 'fight') return;
  updateFighter(m, 1, in1, defs);
  if (m.phase !== 'fight') return;
  egoTick(m, defs);

  resolveProjectiles(m, 0, defs);
  resolveProjectiles(m, 1, defs);
  resolveMelee(m, 0, defs);
  resolveMelee(m, 1, defs);
  resolveSig(m, 0, defs);
  resolveSig(m, 1, defs);
  feedback(m, defs);
  separate(m);
  checkKo(m);

  // The clock can't cut off a Super that has already been called: it lands first.
  if (m.phase === 'fight' && m.timer <= 0 && m.f[0].state !== 'superStart' && m.f[1].state !== 'superStart') {
    m.events.push({ t: 'timeUp' });
    const [a, b] = m.f;
    m.roundWinner = Math.abs(a.hp - b.hp) < 0.01 ? -1 : a.hp > b.hp ? 0 : 1;
    m.phase = 'roundEnd'; m.phaseFrame = 0;
  }
}

/** Someone on the floor (or getting up) has no body to push: you walk past them instead of dragging them along. */
const grounded = (f: Fighter) => f.state === 'ko' || f.state === 'knockdown' || f.state === 'getup';
/** The most a fighter is pushed per frame. Walking into someone is well under this; standing up inside them eases apart. */
const PUSH_MAX = 0.05;

function separate(m: Match) {
  const [a, b] = m.f;
  if (a.y < 0.6 && b.y < 0.6 && !grounded(a) && !grounded(b)) {
    const dx = b.x - a.x;
    const overlap = BODY_WIDTH - Math.abs(dx);
    if (overlap > 0) {
      const s = dx >= 0 ? 1 : -1, push = Math.min(overlap / 2, PUSH_MAX);
      a.x -= s * push; b.x += s * push;
    }
  }
  for (const f of m.f) f.x = clampX(f.x);
  for (const i of [0, 1] as const) {
    const f = m.f[i], o = m.f[i === 0 ? 1 : 0];
    if (isNeutral(f) && f.x !== o.x) f.facing = o.x > f.x ? 1 : -1;
  }
}

/** Cheap state fingerprint, used by tests to prove determinism. */
export function hashMatch(m: Match) {
  const r = (n: number) => Math.round(n * 1000);
  return m.f.map((f) => [r(f.x), r(f.y), r(f.hp), r(f.eng), r(f.cardio), f.state, f.af, f.wins].join(',')).join('|') +
    `|${m.phase}|${m.timer}|${m.round}|${m.proj.length}`;
}
