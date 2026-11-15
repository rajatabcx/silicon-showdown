import {
  BODY_WIDTH, CARDIO_REGEN, CINE_FRAMES, GRAVITY, INTRO_FRAMES, JUMP_SCALE, MOVES, PROJECTILE_SPEED,
  ROUND_END_FRAMES, ROUND_FRAMES, SCANDAL_DAMAGE, SK_COOLDOWN, SK_DAMAGE_SCALE, SK_FRAMES, SK_MAX_HITS,
  STAGE_HALF, START_X, SUPER_CHIP, SUPER_DAMAGE, SUPER_STARTUP, TAG_CARDIO_MAX, WALK_SCALE, WINDED_FRAMES,
} from './constants';
import { BTN, type Fighter, type Match, type MoveKey, type SimDef } from './types';

type Defs = [SimDef, SimDef];

function newFighter(side: 0 | 1): Fighter {
  return {
    x: side === 0 ? -START_X : START_X, y: 0, vx: 0, vy: 0, facing: side === 0 ? 1 : -1,
    hp: 100, hype: 0, cardio: 100, state: 'idle', frame: 0, stun: 0,
    move: null, af: 0, hit: false, chain: 0, buf: 0, combo: 0, prev: 0, cur: 0,
    sk: false, skTimer: 0, skHits: 0, skCooldown: 0, skDead: false, policyUsed: false,
    revived: false, wins: 0,
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
    f.hype = old.hype; f.wins = old.wins; f.revived = old.revived;
    m.f[i] = f;
  }
  m.proj = []; m.timer = ROUND_FRAMES; m.hitstop = 0; m.roundWinner = -1; m.phaseFrame = 0;
}

const isNeutral = (f: Fighter) => f.state === 'idle' || f.state === 'walk' || f.state === 'crouch';
const isInvincible = (f: Fighter) =>
  f.state === 'knockdown' || f.state === 'getup' || f.state === 'ko' || f.state === 'win' || f.state === 'superStart';
const backBit = (f: Fighter) => (f.facing === 1 ? BTN.L : BTN.R);
const fwdBit = (f: Fighter) => (f.facing === 1 ? BTN.R : BTN.L);
const holdsBack = (f: Fighter) => (f.cur & backBit(f)) !== 0;
const canGuard = (f: Fighter) => (isNeutral(f) || f.state === 'blockstun') && holdsBack(f);
export const canTag = (f: Fighter, def: SimDef) => !def.noSidekick && !f.sk && !f.skDead && f.skCooldown <= 0;

function tagIn(m: Match, i: 0 | 1) {
  const f = m.f[i];
  f.sk = true; f.skTimer = SK_FRAMES; f.skHits = 0; f.policyUsed = false;
  f.state = 'idle'; f.frame = 0; f.move = null;
  m.events.push({ t: 'tagIn', by: i });
}

function tagOut(m: Match, i: 0 | 1) {
  const f = m.f[i];
  f.sk = false; f.skCooldown = SK_COOLDOWN; f.cardio = Math.max(f.cardio, 60);
  m.events.push({ t: 'tagOut', by: i });
}

function startAttack(m: Match, i: 0 | 1, key: MoveKey, def: SimDef) {
  const f = m.f[i];
  f.state = 'attack'; f.move = key; f.af = 0; f.hit = false; f.buf = 0; f.frame = 0;
  if (!f.sk) f.cardio -= MOVES[key].cardio / def.fitness;
  m.events.push({ t: 'whiff', by: i, move: key });
}

function airborne(f: Fighter) {
  f.y += f.vy; f.vy -= GRAVITY; f.x += f.vx;
  if (f.y <= 0 && f.vy < 0) { f.y = 0; f.vy = 0; f.vx = 0; return true; }
  return false;
}

function updateFighter(m: Match, i: 0 | 1, inp: number, def: SimDef) {
  const f = m.f[i];
  const o = m.f[1 - i];
  f.cur = inp;
  const pressed = inp & ~f.prev;
  f.prev = inp;
  if (f.skCooldown > 0) f.skCooldown--;
  if (f.sk) { f.skTimer--; f.cardio = Math.min(100, f.cardio + CARDIO_REGEN * 4 * def.fitness); }

  switch (f.state) {
    case 'idle': case 'walk': case 'crouch': {
      f.combo = 0; f.chain = 0; f.move = null;
      if (f.sk && f.skTimer <= 0) tagOut(m, i);
      if (!f.sk) {
        if (f.cardio <= 0) { f.state = 'winded'; f.frame = 0; m.events.push({ t: 'winded', by: i }); return; }
        f.cardio = Math.min(100, f.cardio + CARDIO_REGEN * def.fitness);
      }
      const fwd = (inp & fwdBit(f)) !== 0, back = (inp & backBit(f)) !== 0, down = (inp & BTN.D) !== 0;
      if (pressed & BTN.S) {
        if (f.sk) { if (!f.policyUsed) { f.policyUsed = true; startAttack(m, i, 'policy', def); return; } }
        else if (f.hype >= 100) { f.hype = 0; f.state = 'superStart'; f.frame = 0; m.events.push({ t: 'superStart', by: i }); return; }
      }
      if (pressed & BTN.T && f.cardio < TAG_CARDIO_MAX && canTag(f, def)) { tagIn(m, i); return; }
      if (pressed & BTN.G || (pressed & BTN.P && inp & BTN.K) || (pressed & BTN.K && inp & BTN.P)) { startAttack(m, i, 'grab', def); return; }
      if (pressed & BTN.P) {
        f.chain = 1;
        startAttack(m, i, down && fwd ? 'uppercut' : down ? 'lowJab' : fwd ? 'sp1' : 'jab', def); return;
      }
      if (pressed & BTN.K) {
        f.chain = 1;
        startAttack(m, i, down ? 'sweep' : fwd ? 'sp2' : 'kick', def); return;
      }
      if (inp & BTN.U) {
        f.state = 'jump'; f.vy = def.jump * JUMP_SCALE; f.frame = 0;
        f.vx = (fwd ? 1 : back ? -0.8 : 0) * f.facing * def.walk * WALK_SCALE * 1.25;
        if (!f.sk) f.cardio -= 3 / def.fitness;
        m.events.push({ t: 'jump', by: i }); return;
      }
      if (down) { f.state = 'crouch'; return; }
      if (fwd || back) {
        f.state = 'walk'; f.frame++;
        f.x += f.facing * (fwd ? 1 : -0.78) * def.walk * WALK_SCALE;
        return;
      }
      f.state = 'idle'; f.frame++;
      return;
    }
    case 'jump': {
      f.frame++;
      if (f.move) f.af++;
      else if (pressed & BTN.P) { f.move = 'airPunch'; f.af = 0; f.hit = false; m.events.push({ t: 'whiff', by: i, move: 'airPunch' }); }
      else if (pressed & BTN.K) { f.move = 'airKick'; f.af = 0; f.hit = false; m.events.push({ t: 'whiff', by: i, move: 'airKick' }); }
      if (airborne(f)) { f.state = 'idle'; f.move = null; f.frame = 0; }
      return;
    }
    case 'attack': {
      const key = f.move!;
      const mv = MOVES[key];
      f.af++;
      if (mv.lunge && f.af <= mv.startup) f.x += (f.facing * mv.lunge) / mv.startup;
      if (key === 'sp1' && def.sp1Projectile && !f.sk && f.af === mv.startup) {
        f.hit = true;
        if (!m.proj.some((p) => p.owner === i)) {
          m.proj.push({ owner: i, x: f.x + f.facing * 0.8, y: 1.1, vx: f.facing * PROJECTILE_SPEED, dmg: mv.damage });
        }
      }
      if (f.hit && mv.chain && pressed & (BTN.P | BTN.K)) f.buf = pressed & (BTN.P | BTN.K);
      if (f.buf && mv.chain && f.chain < 3 && f.af > mv.startup + mv.active) {
        const punch = (f.buf & BTN.P) !== 0;
        f.chain++;
        startAttack(m, i, f.chain === 3 ? (punch ? 'finisher' : 'roundhouse') : punch ? 'jab' : 'kick', def);
        return;
      }
      if (f.af >= mv.startup + mv.active + mv.recovery) { f.state = 'idle'; f.move = null; f.frame = 0; }
      return;
    }
    case 'hitstun': case 'blockstun': {
      f.stun--; f.x += f.vx; f.vx *= 0.82;
      if (f.stun <= 0) { f.state = 'idle'; f.frame = 0; f.vx = 0; }
      return;
    }
    case 'knockdown': {
      if (f.y > 0 || f.vy > 0) { if (airborne(f)) f.frame = 0; }
      else if (++f.frame >= 34) { f.state = 'getup'; f.frame = 0; }
      return;
    }
    case 'getup': {
      if (++f.frame >= 18) { f.state = 'idle'; f.frame = 0; f.combo = 0; }
      return;
    }
    case 'winded': {
      if (++f.frame >= WINDED_FRAMES) {
        if (canTag(f, def)) tagIn(m, i);
        else { f.cardio = 35; f.state = 'idle'; f.frame = 0; }
      }
      return;
    }
    case 'superStart': {
      if (++f.frame < SUPER_STARTUP) return;
      if (canGuard(o)) {
        o.state = 'blockstun'; o.stun = 30; o.vx = f.facing * 0.09;
        o.hp = Math.max(1, o.hp - SUPER_CHIP);
        f.state = 'idle'; f.frame = 0;
        m.events.push({ t: 'superBlocked', by: i });
      } else if (isInvincible(o)) {
        f.state = 'idle'; f.frame = 0;
      } else {
        m.phase = 'cine'; m.phaseFrame = 0; m.cineBy = i;
        o.move = null; o.vx = 0;
        m.events.push({ t: 'superHit', by: i });
      }
      return;
    }
    case 'ko': case 'win': {
      if (f.y > 0 || f.vy > 0) airborne(f);
      f.frame++;
      return;
    }
  }
}

function dealHit(
  m: Match, ai: 0 | 1, dir: number, base: number, key: MoveKey,
  o: { hitstun: number; knockdown?: boolean; launch?: boolean; heavy?: boolean },
) {
  const a = m.f[ai], d = m.f[1 - ai];
  const dmg = base * Math.max(0.5, 1 - 0.1 * d.combo) * (a.sk ? SK_DAMAGE_SCALE : 1);
  d.combo++;
  let knock = !!o.knockdown || d.y > 0;
  if (d.sk) {
    if (++d.skHits >= SK_MAX_HITS) {
      tagOut(m, (1 - ai) as 0 | 1);
      d.skDead = true; d.hp -= SCANDAL_DAMAGE; knock = true;
      m.events.push({ t: 'scandal', by: (1 - ai) as 0 | 1 });
    }
  } else {
    d.hp -= dmg;
    if (d.state === 'winded') d.cardio = Math.max(d.cardio, 25);
  }
  a.hype = Math.min(100, a.hype + 5 + base * 0.6);
  d.hype = Math.min(100, d.hype + 4);
  d.move = null; d.frame = 0;
  if (o.launch) { d.state = 'knockdown'; d.vy = 0.2; d.vx = dir * 0.03; }
  else if (knock) { d.state = 'knockdown'; d.vy = 0.1; d.vx = dir * 0.06; }
  else { d.state = 'hitstun'; d.stun = o.hitstun; d.vx = dir * 0.06; }
  m.hitstop = o.heavy ? 10 : 6;
  m.events.push({ t: 'hit', by: ai, move: key, heavy: !!o.heavy, x: d.x, y: d.y + 1.3, dmg, combo: d.combo });
}

function dealBlock(m: Match, ai: 0 | 1, dir: number, blockstun: number, chip: number) {
  const a = m.f[ai], d = m.f[1 - ai];
  d.state = 'blockstun'; d.stun = blockstun; d.vx = dir * 0.07;
  d.hype = Math.min(100, d.hype + 2); a.hype = Math.min(100, a.hype + 2);
  if (!d.sk) { d.cardio -= 2; d.hp = Math.max(1, d.hp - chip); }
  m.hitstop = 4;
  m.events.push({ t: 'block', by: ai, x: d.x, y: d.y + 1.3 });
}

function resolveMelee(m: Match, ai: 0 | 1) {
  const a = m.f[ai], d = m.f[1 - ai];
  if (!a.move || a.hit || (a.state !== 'attack' && a.state !== 'jump')) return;
  const mv = MOVES[a.move];
  if (a.af <= mv.startup || a.af > mv.startup + mv.active) return;
  if (isInvincible(d)) return;
  if ((d.x - a.x) * a.facing < -0.3 || Math.abs(d.x - a.x) > mv.range) return;
  const air = a.state === 'jump';
  if (air ? a.y - d.y > 1.7 : d.y > (mv.launch ? 2.4 : 1.3)) return;
  if (a.move === 'grab' && (d.y > 0 || d.state === 'hitstun')) return;
  a.hit = true;
  const guarded = !mv.unblockable && canGuard(d) &&
    (mv.low ? (d.cur & BTN.D) !== 0 : mv.overhead ? (d.cur & BTN.D) === 0 : true);
  if (guarded) dealBlock(m, ai, a.facing, mv.blockstun, mv.heavy ? 1 : 0);
  else dealHit(m, ai, a.facing, mv.damage, a.move, mv);
}

function checkKo(m: Match, defs: Defs) {
  let ko = -1, both = false;
  for (const i of [0, 1] as const) {
    const f = m.f[i];
    if (f.hp > 0) continue;
    if (defs[i].revive && !f.revived) {
      f.revived = true; f.hp = 10;
      m.events.push({ t: 'revive', by: i });
      continue;
    }
    f.hp = 0; f.state = 'ko'; f.move = null; f.frame = 0;
    if (f.sk) f.sk = false;
    if (f.y <= 0 && f.vy <= 0) f.vy = 0.1;
    m.events.push({ t: 'ko', by: i });
    if (ko >= 0) both = true;
    ko = i;
  }
  if (ko < 0) return;
  m.phase = 'roundEnd'; m.phaseFrame = 0; m.hitstop = 14;
  m.roundWinner = both ? -1 : ((1 - ko) as 0 | 1);
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
    for (const i of [0, 1] as const) m.f[i].prev = ins[i];
    if (++m.phaseFrame < CINE_FRAMES) return;
    const ai = m.cineBy, a = m.f[ai], d = m.f[1 - ai];
    if (d.sk) { tagOut(m, (1 - ai) as 0 | 1); d.skDead = true; d.hp -= SUPER_DAMAGE / 2; m.events.push({ t: 'scandal', by: (1 - ai) as 0 | 1 }); }
    else d.hp -= SUPER_DAMAGE;
    d.state = 'knockdown'; d.vy = 0.22; d.vx = a.facing * 0.07; d.frame = 0; d.combo = 0;
    a.state = 'idle'; a.frame = 0;
    m.phase = 'fight'; m.hitstop = 12;
    m.events.push({ t: 'superLand', by: ai });
    checkKo(m, defs);
    return;
  }

  if (m.hitstop > 0) {
    m.hitstop--;
    for (const i of [0, 1] as const) {
      const f = m.f[i];
      const pressed = ins[i] & ~f.prev;
      if (f.state === 'attack' && f.hit && pressed & (BTN.P | BTN.K)) f.buf = pressed & (BTN.P | BTN.K);
      f.prev = ins[i]; f.cur = ins[i];
    }
    return;
  }

  if (m.phase === 'roundEnd') {
    for (const i of [0, 1] as const) {
      const f = m.f[i];
      if (isNeutral(f) && m.phaseFrame > 30 && m.roundWinner === i) { f.state = 'win'; f.frame = 0; }
      updateFighter(m, i, 0, defs[i]);
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
  m.timer--;
  updateFighter(m, 0, in0, defs[0]);
  if (m.phase !== 'fight') return;
  updateFighter(m, 1, in1, defs[1]);
  if (m.phase !== 'fight') return;

  for (let k = m.proj.length - 1; k >= 0; k--) {
    const p = m.proj[k];
    p.x += p.vx;
    const d = m.f[1 - p.owner];
    if (Math.abs(p.x) > STAGE_HALF + 1) { m.proj.splice(k, 1); continue; }
    if (Math.abs(p.x - d.x) < 0.55 && d.y < 1.4 && !isInvincible(d)) {
      const dir = Math.sign(p.vx);
      if (canGuard(d)) dealBlock(m, p.owner, dir, 12, 1);
      else dealHit(m, p.owner, dir, p.dmg, 'sp1', { hitstun: 20, heavy: true });
      m.proj.splice(k, 1);
    }
  }

  resolveMelee(m, 0);
  resolveMelee(m, 1);
  separate(m);
  checkKo(m, defs);

  if (m.phase === 'fight' && m.timer <= 0) {
    m.events.push({ t: 'timeUp' });
    const [a, b] = m.f;
    m.roundWinner = a.hp === b.hp ? -1 : a.hp > b.hp ? 0 : 1;
    m.phase = 'roundEnd'; m.phaseFrame = 0;
  }
}

function separate(m: Match) {
  const [a, b] = m.f;
  if (a.y < 0.6 && b.y < 0.6 && a.state !== 'ko' && b.state !== 'ko') {
    const dx = b.x - a.x;
    const overlap = BODY_WIDTH - Math.abs(dx);
    if (overlap > 0) {
      const s = dx >= 0 ? 1 : -1;
      a.x -= (s * overlap) / 2; b.x += (s * overlap) / 2;
    }
  }
  for (const f of m.f) f.x = Math.max(-STAGE_HALF, Math.min(STAGE_HALF, f.x));
  for (const i of [0, 1] as const) {
    const f = m.f[i], o = m.f[i === 0 ? 1 : 0];
    if (isNeutral(f) && f.x !== o.x) f.facing = o.x > f.x ? 1 : -1;
  }
}

/** Cheap state fingerprint, used by tests to prove determinism. */
export function hashMatch(m: Match) {
  const r = (n: number) => Math.round(n * 1000);
  return m.f.map((f) => [r(f.x), r(f.y), r(f.hp), r(f.hype), r(f.cardio), f.state, f.af, f.wins, f.sk].join(',')).join('|') +
    `|${m.phase}|${m.timer}|${m.round}|${m.proj.length}`;
}
