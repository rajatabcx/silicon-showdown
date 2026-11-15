import { sfx } from './audio';
import type { FighterDef } from './data/fighters';
import { Renderer } from './render/renderer';
import type { StageId } from './render/stages';
import { cpuInput, makeCpu, type Cpu, type Difficulty } from './sim/ai/cpu';
import { FPS } from './sim/constants';
import { newMatch, step } from './sim/match';
import { BTN, type Ev, type Match, type SimDef } from './sim/types';

const KEYS: Record<string, number> = {
  KeyA: BTN.L, ArrowLeft: BTN.L, KeyD: BTN.R, ArrowRight: BTN.R,
  KeyW: BTN.U, ArrowUp: BTN.U, KeyS: BTN.D, ArrowDown: BTN.D,
  KeyJ: BTN.P, KeyZ: BTN.P, KeyK: BTN.K, KeyX: BTN.K, KeyI: BTN.G, KeyV: BTN.G,
  KeyL: BTN.S, Space: BTN.S, KeyC: BTN.S, KeyU: BTN.T,
};

export type GameOpts = {
  canvas: HTMLCanvasElement;
  player: FighterDef; cpu: FighterDef;
  difficulty: Difficulty; stage: StageId;
  onEvent(e: Ev, m: Match): void;
};

/** Owns one match: the fixed-step simulation, the CPU, the renderer and the input. */
export class Game {
  match: Match = newMatch();
  paused = false;
  private renderer: Renderer;
  private cpu: Cpu;
  private defs: [SimDef, SimDef];
  private keys = 0;
  private touch = 0;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private dead = false;

  constructor(private o: GameOpts) {
    this.renderer = new Renderer(o.canvas);
    this.renderer.load(o.player, o.cpu, o.stage);
    this.cpu = makeCpu(o.difficulty, (Math.random() * 2 ** 31) | 0);
    this.defs = [o.player.sim, o.cpu.sim];
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private onKey = (e: KeyboardEvent) => {
    const bit = KEYS[e.code];
    if (!bit) return;
    e.preventDefault();
    if (e.type === 'keydown') this.keys |= bit; else this.keys &= ~bit;
  };
  private onBlur = () => { this.keys = 0; this.touch = 0; };
  private onResize = () => this.renderer.resize();

  /** On-screen buttons call this. */
  setTouch(bit: number, down: boolean) { if (down) this.touch |= bit; else this.touch &= ~bit; }

  private loop = (now: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= 1 / FPS && n++ < 5) {
        this.acc -= 1 / FPS;
        const m = this.match;
        step(m, this.keys | this.touch, cpuInput(this.cpu, m, 1, this.defs[1]), this.defs);
        for (const e of m.events) this.handle(e);
      }
      if (n >= 5) this.acc = 0;
    }
    this.renderer.draw(this.match, this.paused ? 0 : dt);
  };

  private handle(e: Ev) {
    this.renderer.onEvent(e, this.match);
    switch (e.t) {
      case 'hit': sfx(e.heavy ? 'heavy' : 'hit'); break;
      case 'block': case 'superBlocked': sfx('block'); break;
      case 'whiff': sfx('swing'); break;
      case 'superStart': sfx('super'); break;
      case 'superLand': sfx('superLand'); break;
      case 'ko': sfx('ko'); break;
      case 'tagIn': case 'tagOut': case 'revive': sfx('tag'); break;
      case 'winded': sfx('wheeze'); break;
      case 'scandal': sfx('scandal'); break;
      case 'fight': case 'roundStart': sfx('bell'); break;
    }
    this.o.onEvent(e, this.match);
  }

  dispose() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
