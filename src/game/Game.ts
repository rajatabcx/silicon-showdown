import { sfx, startAmbience, startBed, stopAmbience, stopBed, voice, type VoiceHandle } from './audio';
import { simDef, VOICE_SECONDS, type FighterInfo, type VoiceId } from './data/roster';
import type { Assets } from './render/assets';
import { Renderer } from './render/renderer';
import { cpuInput, makeCpu, type Cpu, type Difficulty } from './sim/ai/cpu';
import { FPS } from './sim/constants';
import { newMatch, step } from './sim/match';
import { BTN, type Ev, type Match, type SimDef } from './sim/types';

const KEYS: Record<string, number> = {
  KeyA: BTN.L, ArrowLeft: BTN.L, KeyD: BTN.R, ArrowRight: BTN.R,
  KeyW: BTN.U, ArrowUp: BTN.U, KeyS: BTN.D, ArrowDown: BTN.D,
  KeyJ: BTN.P, KeyK: BTN.K, KeyL: BTN.S, Space: BTN.G, Enter: BTN.X, NumpadEnter: BTN.X,
};

export type GameOpts = {
  canvas: HTMLCanvasElement;
  assets: Assets;
  player: FighterInfo; cpu: FighterInfo;
};

type Listener = (e: Ev, m: Match) => void;

/** Owns one match: the fixed-step simulation, the CPU, the renderer, the input and the voices. */
export class Game {
  match: Match = newMatch();
  paused = false;
  readonly defs: [SimDef, SimDef];
  readonly infos: [FighterInfo, FighterInfo];
  private renderer: Renderer;
  private cpu: Cpu;
  private keys = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private dead = false;
  private slow = 0;
  private talking: (VoiceHandle | null)[] = [null, null];
  private superVoice: VoiceHandle[] = [];
  private lastBark = [-999, -999];
  private listeners = new Set<Listener>();

  /** Subscribe to simulation events. Returns an unsubscribe function. */
  on(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  constructor(o: GameOpts) {
    this.infos = [o.player, o.cpu];
    this.defs = [simDef(o.player), simDef(o.cpu)];
    this.renderer = new Renderer(o.canvas, o.assets, [{ info: o.player, def: this.defs[0] }, { info: o.cpu, def: this.defs[1] }]);
    this.cpu = makeCpu('normal', 1);
    this.match.phase = 'fight';
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    startAmbience();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __game: Game }).__game = this;
  }

  /** False on the title screen: the fighters idle in the room and nothing is simulated. */
  running = false;

  /** Start (or restart) a best-of-three against the CPU. */
  start(difficulty: Difficulty) {
    this.match = newMatch();
    this.cpu = makeCpu(difficulty, (Math.random() * 2 ** 31) | 0);
    this.renderer.attract = false;
    this.running = true;
    this.paused = false;
    this.keys = 0;
    startBed();
  }

  /** Back to the title screen. */
  stop() {
    this.running = false;
    this.renderer.attract = true;
    this.stopTalking(0); this.stopTalking(1);
    this.superVoice.forEach((h) => h.stop());
    stopBed();
    this.match = newMatch(); this.match.phase = 'fight';
    this.renderer.onEvent({ t: 'roundStart', round: 1 }, this.match);
  }

  setPaused(p: boolean) { this.paused = p; }

  /** Where a fighter's head is on screen, 0..1 from the top-left. */
  headOnScreen(side: 0 | 1) { return this.renderer.headOnScreen(side); }

  private onKey = (e: KeyboardEvent) => {
    const bit = KEYS[e.code];
    if (!bit || !this.running) return;
    e.preventDefault();
    if (e.type === 'keydown') this.keys |= bit; else this.keys &= ~bit;
  };
  private onBlur = () => { this.keys = 0; };
  private onResize = () => this.renderer.resize();

  private loop = (now: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.frame(dt);
  };

  /** Advance real time by dt seconds: simulate whole 60 Hz frames and draw once. */
  private frame(dt: number) {
    if (!this.running) { this.renderer.draw(this.match, dt); return; }
    if (this.paused) { this.renderer.draw(this.match, 0); return; }
    // Slow motion on the knockout blow.
    if (this.slow > 0) { this.slow -= dt; dt *= 0.3; }
    this.acc += dt;
    let n = 0;
    while (this.acc >= 1 / FPS && n++ < 5) {
      this.acc -= 1 / FPS;
      const m = this.match;
      step(m, this.keys, this.debugCpu ?? cpuInput(this.cpu, m, 1, this.defs[1], this.defs[0]), this.defs);
      for (const e of m.events) this.handle(e);
    }
    if (n >= 5) this.acc = 0;
    this.renderer.draw(this.match, dt);
  }

  /** Dev only: fixed CPU buttons instead of the AI. */
  debugCpu: number | null = null;

  /** Dev only: drive the game by hand (the browser pauses animation frames in a hidden tab). */
  debugRun(seconds: number, keys?: number) {
    if (keys !== undefined) this.keys = keys;
    for (let t = 0; t < seconds; t += 1 / FPS) this.frame(1 / FPS);
  }

  private bark(side: 0 | 1, id: VoiceId | undefined, chance = 1) {
    if (!id || this.talking[side] || Math.random() > chance) return;
    const now = performance.now();
    if (now - this.lastBark[side] < 6000) return;
    this.lastBark[side] = now;
    const h = voice(id);
    this.talking[side] = h;
    window.setTimeout(() => { if (this.talking[side] === h) this.talking[side] = null; }, 2500);
  }

  private stopTalking(side: 0 | 1) { this.talking[side]?.stop(); this.talking[side] = null; }

  private handle(e: Ev) {
    const m = this.match;
    this.renderer.onEvent(e, m);
    switch (e.t) {
      case 'hit':
        sfx(e.heavy ? 'heavy' : 'hit');
        if (e.move === 'sig') {
          const sg = this.infos[e.by].sigs[m.f[e.by].sig];
          if (sg?.bark) voice(sg.bark);
          if (sg?.prop === 'chainsaw') sfx('chainsaw');
          sfx('cheer');
        } else if (e.heavy) this.bark(e.by, this.infos[e.by].barks.heavy, 0.25);
        break;
      case 'block': sfx('block'); if (e.heavy) this.bark((1 - e.by) as 0 | 1, this.infos[1 - e.by].barks.block, 0.3); break;
      case 'whiff': sfx('whoosh'); break;
      case 'dodge': sfx('dodge'); break;
      case 'quote': {
        this.stopTalking(e.by);
        const line = this.infos[e.by].sigs[e.sig].line;
        if (line) {
          let at = 0;
          const hs = line.clips.map((c) => { const h = voice(c, at); at += VOICE_SECONDS[c] ?? 1.5; return h; });
          this.talking[e.by] = { stop: () => hs.forEach((h) => h.stop()) };
        } else sfx('ui');
        break;
      }
      case 'sigGo': this.talking[e.by] = null; sfx('whoosh'); if (this.infos[e.by].sigs[e.sig].prop === 'chainsaw') sfx('chainsaw'); break;
      case 'throw': sfx('whoosh'); break;
      case 'quoteCut': this.stopTalking(e.by); break;
      case 'factCheck': {
        const s = (1 - e.by) as 0 | 1;
        this.stopTalking(s);
        sfx('factCheck'); sfx('cheer');
        window.setTimeout(() => this.bark(s, this.infos[s].barks.checked), 450);
        break;
      }
      case 'counter': sfx('heavy'); break;
      case 'tier': sfx('tier'); break;
      case 'superStart': sfx('superStart'); break;
      case 'superWhiff': case 'superBlocked': sfx('thud'); break;
      case 'superHit': {
        this.stopTalking(0); this.stopTalking(1);
        sfx('riser');
        this.superVoice = this.infos[e.by].super.audio.map((a) => voice(a.clip, a.at));
        break;
      }
      case 'superDamage': sfx('superBoom'); sfx('cheer'); break;
      case 'superLand': sfx('stamp'); this.superVoice = []; break;
      case 'ko':
        sfx('ko'); sfx('cheer'); this.slow = 0.6;
        this.stopTalking(e.by);
        this.superVoice.forEach((h) => h.stop());
        window.setTimeout(() => this.bark((1 - e.by) as 0 | 1, this.infos[1 - e.by].barks.taunt), 1500);
        break;
      case 'winded': sfx('wheeze'); break;
      case 'roundStart': sfx('gavel'); break;
      case 'fight': sfx('gavel'); break;
      case 'matchEnd': stopBed(); break;
    }
    for (const fn of this.listeners) fn(e, m);
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.stopTalking(0); this.stopTalking(1);
    this.superVoice.forEach((h) => h.stop());
    stopBed(); stopAmbience();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

