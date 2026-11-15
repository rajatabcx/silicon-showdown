// Procedural sound effects (Web Audio). Entrance themes from Suno will be added as files later.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let noise: AudioBuffer | null = null;

/** Must be called from a user gesture (browsers block audio until then). */
export function unlockAudio() {
  if (ctx) { void ctx.resume(); return; }
  try {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

export function setMuted(m: boolean) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export const isMuted = () => muted;

function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur);
}
function burst(dur: number, vol: number, freq: number, q = 1) {
  if (!ctx || !master || !noise) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise; f.type = 'bandpass'; f.frequency.value = freq * (0.9 + Math.random() * 0.2); f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
}

export type Sfx = 'hit' | 'heavy' | 'block' | 'swing' | 'ko' | 'super' | 'superLand' | 'ui' | 'tag' | 'bell' | 'wheeze' | 'scandal';

export function sfx(name: Sfx) {
  switch (name) {
    case 'hit': burst(0.09, 0.9, 1400, 0.8); tone('sine', 190, 70, 0.1, 0.7); break;
    case 'heavy': burst(0.16, 1, 800, 0.6); tone('sine', 150, 40, 0.24, 1); tone('square', 320, 90, 0.08, 0.25); break;
    case 'block': burst(0.05, 0.5, 3200, 3); tone('triangle', 520, 380, 0.06, 0.3); break;
    case 'swing': burst(0.08, 0.16, 600, 0.5); break;
    case 'ko': tone('sawtooth', 440, 55, 0.9, 0.5); burst(0.4, 0.9, 500, 0.4); break;
    case 'super': [0, 1, 2, 3, 4].forEach((i) => tone('square', 330 * Math.pow(1.26, i), 330 * Math.pow(1.26, i), 0.12, 0.22, i * 0.07)); break;
    case 'superLand': burst(0.5, 1, 300, 0.3); tone('sine', 120, 30, 0.6, 1); break;
    case 'ui': tone('square', 660, 880, 0.06, 0.15); break;
    case 'tag': tone('triangle', 392, 392, 0.1, 0.4); tone('triangle', 587, 587, 0.16, 0.4, 0.1); break;
    case 'bell': tone('sine', 1320, 1320, 0.5, 0.4); tone('sine', 1980, 1980, 0.3, 0.2); break;
    case 'wheeze': burst(0.35, 0.3, 900, 2); break;
    case 'scandal': tone('sawtooth', 300, 150, 0.3, 0.4); tone('sawtooth', 220, 110, 0.4, 0.4, 0.15); break;
  }
}
