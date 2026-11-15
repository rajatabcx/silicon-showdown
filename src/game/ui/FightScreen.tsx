'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { isMuted, setMuted, sfx } from '../audio';
import { moveName, type FighterDef } from '../data/fighters';
import { fill, pick, TICKER } from '../data/satire';
import { Game } from '../Game';
import type { StageId } from '../render/stages';
import type { Difficulty } from '../sim/ai/cpu';
import { CINE_FRAMES, FPS, SK_MAX_HITS } from '../sim/constants';
import { BTN, type MoveKey } from '../sim/types';

type Props = {
  player: FighterDef; cpu: FighterDef; difficulty: Difficulty; stage: StageId; label: string;
  onDone(won: boolean): void; onQuit(): void;
};
type Callout = { k: number; side: number; text: string };
type Banner = { k: number; text: string; sub?: string };

const NAMED: MoveKey[] = ['sp1', 'sp2', 'sweep', 'uppercut', 'grab', 'finisher', 'roundhouse', 'policy'];

export function FightScreen({ player, cpu, difficulty, stage, label, onDone, onQuit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [ticker, setTicker] = useState(TICKER.idle[0]);
  const [superCard, setSuperCard] = useState<FighterDef | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const done = useEffectEvent(onDone);

  useEffect(() => {
    const defs = [player, cpu];
    const timers: number[] = [];
    let id = 0;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const say = (side: number, text: string) => {
      const k = ++id;
      setCallouts((c) => [...c.slice(-3), { k, side, text }]);
      later(() => setCallouts((c) => c.filter((x) => x.k !== k)), 950);
    };
    const announce = (text: string, sub?: string, ms = 1100) => {
      const k = ++id;
      setBanner({ k, text, sub });
      later(() => setBanner((b) => (b?.k === k ? null : b)), ms);
    };
    const news = (pool: string[], by: number) =>
      setTicker(fill(pick(pool), { w: defs[by].name, l: defs[1 - by].name, s: defs[1 - by].sidekick.name }));

    const game = new Game({
      canvas: canvasRef.current!, player, cpu, difficulty, stage,
      onEvent(e, m) {
        switch (e.t) {
          case 'roundStart': announce(`ROUND ${e.round}`, e.round === 1 ? `${player.name}: "${player.lines.intro}"` : undefined, 1500); break;
          case 'fight': announce('FIGHT!', undefined, 650); break;
          case 'hit':
            if (NAMED.includes(e.move)) say(e.by, moveName(defs[e.by], e.move, m.f[e.by].sk));
            if (e.combo >= 3) { say(e.by, `${e.combo} HITS!`); news(TICKER.combo, e.by); }
            else if (Math.random() < 0.2) news(TICKER.hit, e.by);
            break;
          case 'winded': say(e.by, 'OUT OF BREATH!'); news(TICKER.winded, 1 - e.by); break;
          case 'tagIn':
            say(e.by, `${defs[e.by].sidekick.name} TAGS IN`);
            setTicker(fill(pick(TICKER.tagIn), { s: defs[e.by].sidekick.name }));
            break;
          case 'tagOut': say(e.by, `${defs[e.by].name} IS BACK`); break;
          case 'scandal':
            announce('DONOR EXPOSED!', `${defs[e.by].sidekick.name} is down. ${defs[e.by].name} loses health.`, 1500);
            news(TICKER.scandal, 1 - e.by);
            break;
          case 'superStart': say(e.by, 'SUPER!'); break;
          case 'superBlocked': say(1 - e.by, 'BLOCKED!'); break;
          case 'superHit':
            setSuperCard(defs[e.by]);
            later(() => setSuperCard(null), (CINE_FRAMES / FPS) * 1000);
            news(TICKER.super, e.by);
            break;
          case 'revive': announce('FIRED… AND REHIRED', 'The board has reversed its decision.', 1500); break;
          case 'ko': announce('K.O.', `${defs[1 - e.by].name}: "${defs[1 - e.by].lines.win}"`, 2400); news(TICKER.ko, 1 - e.by); break;
          case 'timeUp': announce('TIME UP', undefined, 1500); break;
          case 'matchEnd': later(() => done(e.winner === 0), 700); break;
        }
      },
    });
    gameRef.current = game;

    // The HUD is updated straight on the DOM every frame; React state would be too slow.
    const el: Record<string, HTMLElement> = {};
    rootRef.current?.querySelectorAll<HTMLElement>('[data-hud]').forEach((n) => { el[n.dataset.hud!] = n; });
    let raf = 0;
    const hud = () => {
      raf = requestAnimationFrame(hud);
      const m = game.match;
      m.f.forEach((f, i) => {
        const hp = el[`hp${i}`], hype = el[`hype${i}`], cardio = el[`cardio${i}`], sk = el[`sk${i}`], wins = el[`wins${i}`];
        if (hp) hp.style.width = `${Math.max(0, f.hp)}%`;
        if (hype) { hype.style.width = `${f.hype}%`; hype.dataset.full = String(f.hype >= 100 && !f.sk); }
        if (cardio) { cardio.style.width = `${Math.max(0, f.cardio)}%`; cardio.dataset.low = String(f.cardio < 25); }
        if (sk) {
          sk.textContent = f.sk ? `fighting · ${Math.ceil(f.skTimer / FPS)}s · ${SK_MAX_HITS - f.skHits} hits left`
            : f.skDead ? 'exposed' : f.skCooldown > 0 ? `resting ${Math.ceil(f.skCooldown / FPS)}s` : 'ready';
        }
        if (wins) wins.textContent = '●'.repeat(f.wins) + '○'.repeat(Math.max(0, m.roundsToWin - f.wins));
      });
      if (el.timer) el.timer.textContent = String(Math.max(0, Math.ceil(m.timer / FPS)));
    };
    raf = requestAnimationFrame(hud);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { game.paused = !game.paused; setPaused(game.paused); sfx('ui'); }
      if (e.code === 'KeyM') { setMuted(!isMuted()); setMutedState(isMuted()); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', onKey);
      game.dispose();
      gameRef.current = null;
    };
  }, [player, cpu, difficulty, stage]);

  const resume = () => { if (gameRef.current) gameRef.current.paused = false; setPaused(false); };
  // One delegated handler for all touch buttons; each button carries its input bit in data-bit.
  const touch = (e: React.PointerEvent) => {
    const bit = Number((e.target as HTMLElement).dataset.bit);
    if (!bit) return;
    e.preventDefault();
    gameRef.current?.setTouch(bit, e.type === 'pointerdown');
  };

  const panel = (i: number, def: FighterDef) => (
    <div className={`flex flex-1 flex-col gap-1 ${i ? 'items-end text-right' : ''}`}>
      <div className={`flex items-baseline gap-2 ${i ? 'flex-row-reverse' : ''}`}>
        <span className="text-base font-black italic uppercase tracking-tight sm:text-xl" style={{ color: def.color }}>{def.name}</span>
        <span data-hud={`wins${i}`} className="text-sm text-yellow-300" />
      </div>
      <div className={`flex h-5 w-full overflow-hidden rounded-sm border-2 border-white/80 bg-red-950 sm:h-6 ${i ? 'justify-end' : ''}`}>
        <div data-hud={`hp${i}`} className="h-full bg-gradient-to-b from-yellow-300 to-amber-500 transition-[width] duration-150" style={{ width: '100%' }} />
      </div>
      <div className={`flex w-4/5 items-center gap-1.5 ${i ? 'flex-row-reverse' : ''}`}>
        <span className="w-12 shrink-0 text-[10px] font-bold text-sky-300">HYPE</span>
        <div className={`flex h-2.5 flex-1 overflow-hidden rounded-sm bg-black/60 ${i ? 'justify-end' : ''}`}>
          <div data-hud={`hype${i}`} className="h-full bg-sky-400 data-[full=true]:animate-pulse data-[full=true]:bg-fuchsia-400" style={{ width: '0%' }} />
        </div>
      </div>
      <div className={`flex w-4/5 items-center gap-1.5 ${i ? 'flex-row-reverse' : ''}`}>
        <span className="w-12 shrink-0 text-[10px] font-bold text-emerald-300">CARDIO</span>
        <div className={`flex h-2.5 flex-1 overflow-hidden rounded-sm bg-black/60 ${i ? 'justify-end' : ''}`}>
          <div data-hud={`cardio${i}`} className="h-full bg-emerald-400 data-[low=true]:bg-red-500" style={{ width: '100%' }} />
        </div>
      </div>
      <div className="text-[11px] text-white/80">
        🤝 {def.sidekick.name}: <span data-hud={`sk${i}`} className="font-semibold text-white" />
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="fixed inset-0 select-none overflow-hidden bg-black text-white" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-3 bg-gradient-to-b from-black/70 to-transparent p-3 sm:gap-6 sm:p-4">
        {panel(0, player)}
        <div className="flex w-16 flex-col items-center">
          <span data-hud={'timer'} className="text-3xl font-black tabular-nums sm:text-4xl">60</span>
          <span className="text-center text-[10px] uppercase leading-tight text-white/70">{label}</span>
          <button aria-label="Pause" onClick={() => { if (gameRef.current) gameRef.current.paused = true; setPaused(true); }}
            className="pointer-events-auto mt-1 rounded bg-white/15 px-2 text-sm [@media(pointer:fine)]:hidden">⏸</button>
        </div>
        {panel(1, cpu)}
      </div>

      {callouts.map((c, n) => (
        <div key={c.k} className={`pointer-events-none absolute animate-bounce text-xl font-black italic uppercase text-yellow-300 drop-shadow-[0_2px_0_#000] sm:text-3xl ${c.side ? 'right-6 text-right' : 'left-6'}`}
          style={{ top: `${30 + n * 8}%` }}>{c.text}</div>
      ))}

      {banner && (
        <div key={banner.k} className="pointer-events-none absolute inset-x-0 top-[34%] flex flex-col items-center gap-2 px-4 text-center">
          <span className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_5px_0_#e5484d] sm:text-8xl">{banner.text}</span>
          {banner.sub && <span className="max-w-xl rounded bg-black/70 px-3 py-1 text-sm sm:text-base">{banner.sub}</span>}
        </div>
      )}

      {superCard && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex flex-col items-center border-y-4 border-white py-3 text-center" style={{ background: superCard.color }}>
          <span className="text-3xl font-black italic tracking-tight sm:text-5xl">{superCard.superName}</span>
          <span className="text-sm font-semibold sm:text-lg">{superCard.name}: {superCard.superLine}</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/85 px-3 py-1.5 text-xs sm:text-sm">
        <span className="shrink-0 rounded-sm bg-red-600 px-1.5 font-black">BREAKING BUBBLE</span>
        <span className="min-w-0 flex-1 truncate">{ticker}</span>
        <span className="hidden shrink-0 text-white/50 xl:inline">
          A/D move · W jump · S crouch · hold back = block · J punch · K kick · I grab · L super · U tag · Esc pause · M {muted ? 'unmute' : 'mute'}
        </span>
      </div>

      {/* Touch controls: shown only on touch screens. */}
      <div onPointerDown={touch} onPointerUp={touch} onPointerOut={touch} onPointerCancel={touch}
        className="absolute inset-x-0 bottom-9 hidden items-end justify-between px-4 [@media(pointer:coarse)]:flex">
        <div className="grid grid-cols-3 gap-1.5 text-xl">
          <span /><button data-bit={BTN.U} className="touch-btn">▲</button><span />
          <button data-bit={BTN.L} className="touch-btn">◀</button>
          <button data-bit={BTN.D} className="touch-btn">▼</button>
          <button data-bit={BTN.R} className="touch-btn">▶</button>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-[11px] font-black">
          <button data-bit={BTN.T} className="touch-btn">TAG</button>
          <button data-bit={BTN.G} className="touch-btn">GRAB</button>
          <button data-bit={BTN.S} className="touch-btn bg-fuchsia-600/70">SUPER</button>
          <span />
          <button data-bit={BTN.P} className="touch-btn bg-amber-500/70">PUNCH</button>
          <button data-bit={BTN.K} className="touch-btn bg-red-600/70">KICK</button>
        </div>
      </div>

      {paused && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80">
          <span className="text-5xl font-black italic">🧊 ICE BATH BREAK</span>
          <span className="text-white/70">The meeting is paused until further notice.</span>
          <div className="flex gap-3">
            <button onClick={resume} className="menu-btn">Resume</button>
            <button onClick={onQuit} className="menu-btn bg-zinc-700">Quit to menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
