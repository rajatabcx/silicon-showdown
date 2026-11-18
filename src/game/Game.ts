import { playMusic, roundCall, sfx, startBed, stopBed, voice, type VoiceHandle } from './audio';
import { InputLatch } from './input';
import { sigInfo, simDef, VOICE_SECONDS, type FighterInfo, type VoiceId } from './data/roster';
import type { Assets } from './render/assets';
import { Renderer } from './render/renderer';
import { cpuInput, makeCpu, type Cpu, type Difficulty } from './sim/ai/cpu';
import { FPS, INTRO_FRAMES, ROUND_END_FRAMES } from './sim/constants';
import { newMatch, sigOf, step } from './sim/match';
import { BTN, type Ev, type Match, type SimDef } from './sim/types';

const KEYS: Record<string, number> = {
  KeyA: BTN.L, ArrowLeft: BTN.L, KeyD: BTN.R, ArrowRight: BTN.R,
  KeyW: BTN.U, ArrowUp: BTN.U, KeyS: BTN.D, ArrowDown: BTN.D,
  KeyJ: BTN.P, KeyK: BTN.K, KeyL: BTN.S, Space: BTN.G, Enter: BTN.X, NumpadEnter: BTN.X, KeyU: BTN.T,
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
  private keys = new InputLatch();
  private acc = 0;
  private last = 0;
  private raf = 0;
  private dead = false;
  /** A timed stretch of slow motion: seconds left (real time) and the speed. */
  private slow = { t: 0, k: 1 };
  /** One microphone: only one person speaks at a time. Higher priority cuts lower; lower waits its turn (is dropped). */
  private mic: { side: 0 | 1; prio: number; h: VoiceHandle; until: number } | null = null;
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
    this.keys.clear();
    this.slow.t = 0;
    startBed();
  }

  /** Back to the title screen. */
  stop() {
    this.running = false;
    this.renderer.attract = true;
    this.hushAll();
    playMusic('title');
    this.match = newMatch(); this.match.phase = 'fight';
    this.renderer.onEvent({ t: 'roundStart', round: 1 }, this.match);
  }

  /** Which menu the room is behind: the title (orbiting camera) or the select screen (both fighters, face on). */
  setLobby(view: 'title' | 'select') { this.renderer.lobby = view; }

  setPaused(p: boolean) { this.paused = p; this.keys.clear(); }

  /** Where a fighter's head is on screen, 0..1 from the top-left. */
  propRect(side: 0 | 1) { return this.renderer.propRect(side); }
  headOnScreen(side: 0 | 1, who?: 'boss' | 'sk') { return this.renderer.headOnScreen(side, this.match, who); }
  headRect(side: 0 | 1, who?: 'boss' | 'sk') { return this.renderer.headRect(side, this.match, who); }

  private onKey = (e: KeyboardEvent) => {
    const bit = KEYS[e.code];
    if (!bit || !this.running) return;
    e.preventDefault();
    if (e.type === 'keydown') { if (!e.repeat) this.keys.down(bit); } else this.keys.up(bit);
  };
  private onBlur = () => { this.keys.clear(); };
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
    dt *= this.timeScale(dt);
    this.acc += dt;
    let n = 0;
    while (this.acc >= 1 / FPS && n++ < 5) {
      this.acc -= 1 / FPS;
      const m = this.match;
      // Let the last line of a round finish before the next round (or the result) starts.
      if (m.phase === 'roundEnd' && m.phaseFrame >= ROUND_END_FRAMES - 2 && this.micBusy()) continue;
      step(m, this.keys.read(), this.debugCpu ?? cpuInput(this.cpu, m, 1, this.defs[1]), this.defs);
      for (const e of m.events) this.handle(e);
    }
    if (n >= 5) this.acc = 0;
    this.renderer.draw(this.match, dt);
  }

  /**
   * Slow motion. Timed stretches (the knockout blow, the moment a Super lands) and two that follow the fight:
   * the flash when a Super is called, and a sidekick's Policy Move once the line has been said.
   * A Super's own cinematic runs at full speed because a real voice clip plays under it; its slow motion is staged.
   */
  private timeScale(dt: number) {
    if (this.slow.t > 0) { this.slow.t -= dt; return this.slow.k; }
    const m = this.match;
    if (m.phase !== 'fight') return 1;
    if (m.f.some((f) => f.state === 'superStart')) return 0.4;
    if (m.proj.some((p) => p.sig === 3) || m.f.some((f) => f.tag > 0 && f.sig === 3 && f.state === 'sig' && f.af <= sigOf(this.defs[m.f.indexOf(f)], f).startup + 4)) return 0.3;
    return 1;
  }

  /** Dev only: fixed CPU buttons instead of the AI. */
  debugCpu: number | null = null;

  /** Dev only: drive the game by hand (the browser pauses animation frames in a hidden tab). */
  debugRun(seconds: number, keys?: number) {
    if (keys !== undefined) this.keys.set(keys);
    for (let t = 0; t < seconds; t += 1 / FPS) this.frame(1 / FPS);
  }

  /** Is anyone on the microphone right now? */
  private micBusy() { return !!this.mic && performance.now() < this.mic.until; }

  /**
   * Put clips on the microphone. Returns false (and plays nothing) if someone with equal or
   * higher priority is already speaking. Priorities: 0 bark, 1 hit bark, 2 signature line, 3 Super.
   */
  private say(side: 0 | 1, prio: number, clips: { id: VoiceId; at: number }[]) {
    if (this.micBusy() && this.mic!.prio >= prio && !(prio >= 2 && this.mic!.prio < 3 && this.mic!.side === side)) return false;
    this.mic?.h.stop();
    const hs = clips.map((c) => voice(c.id, c.at));
    const len = Math.max(0, ...clips.map((c) => c.at + (VOICE_SECONDS[c.id] ?? 1.5)));
    this.mic = { side, prio, h: { stop: () => hs.forEach((h) => h.stop()) }, until: performance.now() + len * 1000 + 150 };
    return true;
  }

  private bark(side: 0 | 1, id: VoiceId | undefined, chance = 1, prio = 0) {
    if (!id || Math.random() > chance) return;
    const now = performance.now();
    if (now - this.lastBark[side] < 6000) return;
    if (this.say(side, prio, [{ id, at: 0 }])) this.lastBark[side] = now;
  }

  /** Stop whatever this fighter is saying (a sidekick tagged in over them, ...). */
  private stopTalking(side: 0 | 1) { if (this.mic?.side === side) { this.mic.h.stop(); this.mic = null; } }

  private hushAll() { this.mic?.h.stop(); this.mic = null; }

  private handle(e: Ev) {
    const m = this.match;
    this.renderer.onEvent(e, m);
    switch (e.t) {
      case 'hit':
        sfx(e.heavy ? 'heavy' : 'hit');
        // A Policy Move landing gets the same slow, heavy beat as a Super; a signature's last hit a shorter one.
        if (e.move === 'sig' && m.f[e.by].tag > 0 && m.f[e.by].sig === 3) this.slow = { t: 0.5, k: 0.25 };
        else if (e.move === 'sig' && m.f[e.by].hit && this.slow.t <= 0) this.slow = { t: 0.3, k: 0.3 };
        if (e.move === 'sig') {
          const sg = sigInfo(this.infos[e.by], m.f[e.by].sig);
          if (sg?.bark) this.bark(e.by, sg.bark, 1, 1);
          if (sg?.prop === 'chainsaw') sfx('chainsaw');
          sfx('cheer');
        } else if (e.heavy) this.bark(e.by, this.infos[e.by].barks.heavy, 0.25);
        break;
      case 'block': sfx('block'); if (e.heavy) this.bark((1 - e.by) as 0 | 1, this.infos[1 - e.by].barks.block, 0.3); break;
      case 'whiff': sfx('whoosh'); break;
      case 'dodge': sfx('dodge'); break;
      case 'quote': {
        const line = sigInfo(this.infos[e.by], e.sig).line;
        if (line && line.clips.length) {
          let at = 0;
          this.say(e.by, 2, line.clips.map((c) => { const r = { id: c, at }; at += VOICE_SECONDS[c] ?? 1.5; return r; }));
        } else sfx('ui');
        break;
      }
      case 'sigGo': sfx('whoosh'); if (sigInfo(this.infos[e.by], e.sig).prop === 'chainsaw') sfx('chainsaw'); break;
      case 'throw': sfx('whoosh'); break;
      case 'tier': sfx('tier'); break;
      case 'superStart': sfx('superStart'); break;
      case 'superHit': {
        sfx('riser');
        this.say(e.by, 3, this.infos[e.by].super.audio.map((a) => ({ id: a.clip, at: a.at })));
        break;
      }
      case 'superDamage': sfx('superBoom'); sfx('cheer'); break;
      case 'superLand': sfx('stamp'); this.slow = { t: 0.9, k: 0.25 }; break;
      case 'ko':
        sfx('ko'); sfx('wasted'); sfx('cheer'); this.slow = { t: 1.5, k: 0.22 };
        this.hushAll();
        window.setTimeout(() => { if (this.match.phase === 'roundEnd') this.bark((1 - e.by) as 0 | 1, this.infos[1 - e.by].barks.taunt); }, 1500);
        break;
      case 'winded': sfx('wheeze'); break;
      case 'outOfOrder': sfx('gavel'); break;
      case 'tagIn': {
        this.stopTalking(e.by); sfx('whoosh'); sfx('cheer');
        const tv = this.infos[e.by].sidekick.tagVoice;
        if (tv) this.say(e.by, 1, [{ id: tv, at: 0.2 }]);
        break;
      }
      case 'tagOut': sfx(e.scandal ? 'boo' : 'whoosh'); if (e.scandal) sfx('stamp'); break;
      case 'roundStart': this.hushAll(); sfx('gavel'); roundCall(e.round, INTRO_FRAMES / FPS); break;
      case 'timeUp': this.hushAll(); break;
      case 'fight': sfx('gavel'); break;
      case 'matchEnd': playMusic('paper'); break;
    }
    for (const fn of this.listeners) fn(e, m);
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.hushAll();
    stopBed();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

