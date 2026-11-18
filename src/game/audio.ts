// Audio: the real voice clips (files) plus synthesized hits, crowd and a placeholder music bed.
// Recorded music from Suno replaces the bed later.

import type { VoiceId } from './data/roster';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let bedBus: GainNode | null = null;
let voiceBus: GainNode | null = null;
let verb: ConvolverNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
const voices = new Map<VoiceId, AudioBuffer>();
let voiceLoad: Promise<void> | null = null;
let bed: { stop(): void } | null = null;
let ducks = 0;

const VOICE_FILES: VoiceId[] = [
  'tusk_heart', 'tusk_chainsaw', 'tusk_chainsaw_yell', 'tusk_blackmail', 'tusk_gfy', 'tusk_omg', 'tusk_too_hard', 'tusk_plus_side',
  'tusk_empathy', 'tusk_next_year', 'teal_hesitation', 'teal_long_hes', 'teal_losers', 'teal_how_much_time', 'teal_long_time',
  'teal_greta', 'teal_armageddon', 'teal_monopoly', 'covfefe_maga', 'veep_cat_ladies',
  'bozo_paid_short', 'bozo_always_day_one', 'bozo_cant_guarantee', 'bozo_laugh', 'bozo_best_day', 'bozo_optimistic',
  'ultman_quite_wrong', 'ultman_end_short', 'ultman_last_resort', 'ultman_agi_here', 'ultman_this_era',
  'melania_here_we_go', 'melania_here_it_is',
];

/** Recorded one-shot effects in /public/audio/sfx. */
const clips = new Map<string, AudioBuffer>();
function loadClip(c: AudioContext, name: string) {
  fetch(`/audio/sfx/${name}.mp3`).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => { clips.set(name, buf); })
    .catch(() => { /* a missing clip falls back to the synthesized sound */ });
}
function clip(name: string, delay = 0) {
  const buf = clips.get(name);
  if (!ctx || !sfxBus || !buf) return false;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 1.3;
  s.connect(g).connect(sfxBus);
  s.start(ctx.currentTime + delay);
  return true;
}

/**
 * The announcer at the start of each round (the owner's chosen clips). `say` is where "Round N" starts in the file and
 * `fight` where "Fight!" starts, in seconds, so the call can be lined up with the FIGHT banner.
 */
export const ROUND_CALLS = {
  1: { clip: 'round1', say: 0.29, fight: 1.55 },
  2: { clip: 'round2', say: 0.36, fight: 2.37 },
  3: { clip: 'roundFinal', say: 0.12, fight: 2.25 },
} as const;
const callFor = (round: number) => ROUND_CALLS[Math.min(3, Math.max(1, round)) as 1 | 2 | 3];

/** Seconds after the round starts at which the announcer says "Round N", when "Fight!" lands `fightIn` seconds in. */
export function roundSayAt(round: number, fightIn: number) {
  const c = callFor(round);
  return Math.max(0, fightIn - c.fight) + c.say;
}

/** Play the round call so its "Fight!" lands `fightIn` seconds from now. False if the clip isn't loaded. */
export function roundCall(round: number, fightIn: number) {
  const c = callFor(round);
  return clip(c.clip, Math.max(0, fightIn - c.fight));
}

/** Must be called from a user gesture (browsers block audio until then). */
export function unlockAudio() {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.7; sfxBus.connect(master);
    for (const n of ['wasted', 'round1', 'round2', 'roundFinal']) loadClip(ctx, n);
    bedBus = ctx.createGain(); bedBus.gain.value = 0.5; bedBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 1.15; voiceBus.connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // A short hall so hits and the gavel sit in the room.
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 1.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const x = ir.getChannelData(ch); for (let i = 0; i < len; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.22; verb.connect(wet).connect(master);
    void loadVoices();
  } catch { ctx = null; }
}

export function loadVoices() {
  if (!ctx) return Promise.resolve();
  if (voiceLoad) return voiceLoad;
  const c = ctx;
  voiceLoad = Promise.all(VOICE_FILES.map(async (id) => {
    try {
      const r = await fetch(`/audio/voice/${id}.mp3`);
      voices.set(id, await c.decodeAudioData(await r.arrayBuffer()));
    } catch { /* a missing clip just stays silent */ }
  })).then(() => undefined);
  return voiceLoad;
}

export function setMuted(m: boolean) { muted = m; if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02); }
export const isMuted = () => muted;

function duck(on: boolean) {
  if (!ctx || !bedBus) return;
  ducks = Math.max(0, ducks + (on ? 1 : -1));
  const g = ducks > 0 ? 0.12 : 0.5;
  bedBus.gain.setTargetAtTime(g, ctx.currentTime, 0.08);
}

export type VoiceHandle = { stop(): void };

/** Play a real voice clip, optionally after a delay (seconds). Music and crowd duck under it. */
export function voice(id: VoiceId, delay = 0): VoiceHandle {
  const buf = voices.get(id);
  if (!ctx || !voiceBus || !buf) return { stop() {} };
  const s = ctx.createBufferSource(); s.buffer = buf;
  const g = ctx.createGain(); g.gain.value = 1;
  s.connect(g).connect(voiceBus);
  const t = ctx.currentTime + delay;
  s.start(t);
  let done = false;
  const tid = window.setTimeout(() => duck(true), delay * 1000);
  s.onended = () => { if (!done) { done = true; duck(false); } };
  return {
    stop() {
      window.clearTimeout(tid);
      if (done) return;
      done = true;
      try { g.gain.setTargetAtTime(0, ctx!.currentTime, 0.03); s.stop(ctx!.currentTime + 0.15); } catch { /* already stopped */ }
      duck(false);
    },
  };
}

// ---------- synthesis helpers

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, wet = false) {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, vol, 0.004, dur);
  o.connect(g).connect(sfxBus); if (wet && verb) g.connect(verb);
  o.start(t); o.stop(t + dur + 0.05);
}

function hiss(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, delay = 0, wet = false, attack = 0.003) {
  if (!ctx || !sfxBus || !noise) return;
  const t = ctx.currentTime + delay, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; s.loopStart = Math.random(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  env(g, t, vol, attack, dur);
  s.connect(f).connect(g).connect(sfxBus); if (wet && verb) g.connect(verb);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + attack + 0.05);
}

export type Sfx =
  | 'hit' | 'heavy' | 'block' | 'whoosh' | 'ko' | 'superStart' | 'superBoom' | 'ui' | 'gavel' | 'wheeze' | 'factCheck'
  | 'wasted' | 'thud' | 'chainsaw' | 'riser' | 'tick' | 'stamp' | 'dodge' | 'tier' | 'cheer' | 'boo';

export function sfx(name: Sfx) {
  switch (name) {
    case 'hit':
      hiss(0.07, 0.9, 'lowpass', 2600, 500, 0.8); osc('sine', 160, 55, 0.12, 0.9); hiss(0.02, 0.5, 'highpass', 4000, 3000, 0.7);
      break;
    case 'heavy':
      hiss(0.14, 1, 'lowpass', 1800, 200, 0.7, 0, true); osc('sine', 120, 35, 0.32, 1.1); osc('triangle', 260, 70, 0.1, 0.5);
      hiss(0.03, 0.7, 'highpass', 3500, 2500, 0.7);
      break;
    case 'block': hiss(0.04, 0.6, 'bandpass', 3200, 2400, 3); osc('triangle', 900, 600, 0.12, 0.25); osc('square', 1800, 1500, 0.04, 0.08); break;
    case 'whoosh': hiss(0.16, 0.28, 'bandpass', 500, 2200, 1.5, 0, false, 0.05); break;
    case 'dodge': hiss(0.22, 0.25, 'bandpass', 1800, 400, 1.2, 0, false, 0.06); break;
    case 'ko':
      osc('sine', 90, 28, 1.2, 1.2); hiss(0.6, 1, 'lowpass', 1200, 80, 0.5, 0, true); osc('sawtooth', 220, 55, 0.6, 0.18, 0, true);
      break;
    // The knockout sting: our own sound, in the spirit of the "wasted" meme. A low hit, then a slow sinking chord.
    case 'wasted':
      // The owner's chosen knockout clip plays if it loaded; otherwise the synthesized sting below.
      if (clip('wasted', 0.35)) break;
      osc('sine', 60, 30, 0.9, 1.2, 0.45); hiss(0.5, 0.8, 'lowpass', 700, 60, 0.6, 0.45, true);
      for (const [f, d] of [[196, 0.5], [147, 0.56], [98, 0.62]] as const) { osc('sawtooth', f, f * 0.84, 2.2, 0.16, d, true); osc('triangle', f * 2, f * 1.68, 1.8, 0.07, d, true); }
      hiss(2.2, 0.22, 'bandpass', 900, 200, 1.2, 0.5, true, 0.3);
      break;
    case 'superStart': hiss(0.6, 0.5, 'bandpass', 300, 4000, 2, 0, true, 0.4); osc('sawtooth', 110, 440, 0.6, 0.12, 0, true); break;
    case 'riser': hiss(1.4, 0.35, 'bandpass', 200, 5000, 3, 0, true, 1.2); break;
    case 'superBoom':
      osc('sine', 70, 22, 1.6, 1.4); hiss(1.2, 1, 'lowpass', 2500, 60, 0.4, 0, true); hiss(0.08, 0.8, 'highpass', 5000, 3000, 0.5);
      break;
    case 'ui': osc('triangle', 1200, 1500, 0.05, 0.18); break;
    case 'tick': osc('square', 2400, 2400, 0.015, 0.12); hiss(0.01, 0.3, 'highpass', 6000, 6000); break;
    case 'gavel':
      for (const d of [0, 0.22]) { osc('triangle', 520, 300, 0.09, 0.9, d, true); hiss(0.05, 0.7, 'bandpass', 1500, 900, 2, d, true); osc('sine', 140, 90, 0.12, 0.6, d); }
      break;
    case 'wheeze': hiss(0.6, 0.35, 'bandpass', 1200, 700, 4, 0, false, 0.2); hiss(0.5, 0.3, 'bandpass', 900, 600, 4, 0.75, false, 0.2); break;
    case 'factCheck':
      osc('square', 180, 180, 0.22, 0.25); osc('square', 140, 140, 0.35, 0.25, 0.2);
      hiss(0.12, 0.9, 'lowpass', 900, 120, 0.6, 0.05, true); osc('sine', 110, 40, 0.3, 1, 0.05);
      break;
    case 'stamp': osc('sine', 110, 40, 0.25, 1.1); hiss(0.1, 0.9, 'lowpass', 1500, 150, 0.6, 0, true); break;
    case 'thud': osc('sine', 80, 30, 0.4, 1); hiss(0.2, 0.7, 'lowpass', 600, 80, 0.5, 0, true); break;
    case 'chainsaw': {
      if (!ctx || !sfxBus) return;
      const t = ctx.currentTime, o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 95; lfo.frequency.value = 32; lg.gain.value = 30;
      lfo.connect(lg).connect(o.frequency); f.type = 'lowpass'; f.frequency.value = 1800;
      env(g, t, 0.22, 0.02, 0.5);
      o.connect(f).connect(g).connect(sfxBus); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6);
      break;
    }
    case 'tier': osc('triangle', 660, 660, 0.1, 0.25); osc('triangle', 990, 990, 0.18, 0.25, 0.09, true); break;
    case 'cheer': crowdSwell(1); break;
    case 'boo': crowdSwell(-1); break;
  }
}

function crowdSwell(dir: number) {
  if (!ctx || !sfxBus || !noise) return;
  const t = ctx.currentTime;
  for (let k = 0; k < 3; k++) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; s.loop = true;
    f.type = 'bandpass'; f.Q.value = 2.2; f.frequency.value = dir > 0 ? 600 + k * 300 : 300 + k * 120;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 + k * 0.15);
    s.connect(f).connect(g).connect(sfxBus); if (verb) g.connect(verb);
    s.start(t, Math.random()); s.stop(t + 2);
  }
}

/** Placeholder music bed: a low pulse and a slow minor pad. Replaced by recorded tracks later. */
export function startBed() {
  if (!ctx || !bedBus || bed) return;
  const c = ctx, out = bedBus;
  const chords = [[55, 65.4, 82.4], [49, 58.3, 73.4], [43.7, 52, 65.4], [49, 61.7, 73.4]];
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(out);
  const pad = c.createGain(); pad.gain.value = 0.05; pad.connect(lp);
  const oscs = [0, 1, 2].flatMap(() => [0, 1].map((k) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.detune.value = k ? 7 : -7; o.connect(pad); o.start(); return o; }));
  const beat = 60 / 96;
  let step = 0, alive = true;
  const tick = () => {
    if (!alive) return;
    const t = c.currentTime + 0.05;
    const ch = chords[Math.floor(step / 16) % chords.length];
    oscs.forEach((o, i) => o.frequency.setTargetAtTime(ch[Math.floor(i / 2)] * 2, t, 0.3));
    if (step % 4 === 0) {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.3);
    }
    if (step % 8 === 4 && noise) {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = 3000;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.15);
    }
    step++;
  };
  const iv = window.setInterval(tick, (beat / 2) * 1000);
  bed = { stop() { alive = false; window.clearInterval(iv); oscs.forEach((o) => { try { o.stop(); } catch { /* */ } }); lp.disconnect(); bed = null; } };
}

export function stopBed() { bed?.stop(); }
