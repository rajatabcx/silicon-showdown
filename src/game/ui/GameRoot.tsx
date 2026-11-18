'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx, unlockAudio } from '../audio';
import { ROSTER, TUSK, type FighterInfo } from '../data/roster';
import { fill, HEADLINES, PAPERS, pick } from '../data/satire';
import { Game } from '../Game';
import { loadAssets } from '../render/assets';
import { makePortraits } from '../render/portraits';
import type { Difficulty } from '../sim/ai/cpu';
import { FightScreen } from './FightScreen';

type Screen = 'gate' | 'title' | 'select' | 'fight' | 'result';
type Portraits = Partial<Record<FighterInfo['id'] | FighterInfo['sidekick']['model'], string>>;
type Paper = { name: string; headline: string; sub: string; won: boolean };

const LEVELS: { id: Difficulty; name: string; note: string }[] = [
  { id: 'easy', name: 'Intern', note: 'Slow to react, rarely blocks.' },
  { id: 'normal', name: 'Founder', note: 'Fights back and blocks some.' },
  { id: 'hard', name: 'Hostile Takeover', note: 'Blocks a lot, never lets up.' },
];

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [level, setLevel] = useState<Difficulty>('normal');
  const [progress, setProgress] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [portraits, setPortraits] = useState<Portraits>({});
  // Who you play, and who the CPU plays: drawn at random from the rest of the roster each time you pick.
  const [pickId, setPickId] = useState<FighterInfo['id']>(TUSK.id);
  const [cpuPref, setCpuPref] = useState<FighterInfo['id']>('teal');
  const drawCpu = (not: FighterInfo['id']) => {
    const rest = ROSTER.filter((f) => f.id !== not);
    setCpuPref(rest[Math.floor(Math.random() * rest.length)].id);
  };
  const player = ROSTER.find((f) => f.id === pickId)!;
  const cpu = ROSTER.find((f) => f.id === cpuPref && f.id !== pickId) ?? ROSTER.find((f) => f.id !== pickId)!;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load models while the satire notice is up, then build the room (with this matchup) behind the title screen.
  useEffect(() => {
    let g: Game | null = null, dead = false;
    loadAssets(setProgress).then((assets) => {
      if (dead || !canvasRef.current) return;
      g = new Game({ canvas: canvasRef.current, assets, player, cpu });
      setGame(g);
      setPortraits((p) => (p.tusk ? p : makePortraits({
        tusk: assets.tusk, teal: assets.teal, bozo: assets.bozo, ultman: assets.ultman, carp: assets.carp, covfefe: assets.covfefe, veep: assets.veep, melania: assets.melania, pete: assets.pete,
      })));
    }).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load the models.'));
    return () => { dead = true; g?.dispose(); setGame(null); };
  }, [player, cpu]);

  const go = (s: Screen) => { sfx('ui'); setScreen(s); };
  const start = () => { if (!game) return; unlockAudio(); sfx('gavel'); game.start(level); setScreen('fight'); };
  const done = useCallback((won: boolean) => {
    const w = won ? player.name : cpu.name, l = won ? cpu.name : player.name;
    setPaper({ name: pick(PAPERS), headline: fill(pick(won ? HEADLINES.win : HEADLINES.lose), { w: w.toUpperCase(), l: l.toUpperCase() }), sub: pick(HEADLINES.sub), won });
    setScreen('result');
  }, [player, cpu]);
  const quit = useCallback(() => { game?.stop(); setScreen('select'); }, [game]);
  const choose = (id: FighterInfo['id']) => { if (id !== pickId) { sfx('ui'); setPickId(id); drawCpu(id); } };

  // The room behind the menus: orbiting on the title, both fighters face-on while you pick.
  useEffect(() => { game?.setLobby(screen === 'select' ? 'select' : 'title'); }, [game, screen]);

  // Menus work from the keyboard: Enter moves on; on the select screen A/D pick (the CPU's fighter is drawn at random) and W/S set the CPU level.
  useEffect(() => {
    if ((screen !== 'title' && screen !== 'select') || showHelp) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (screen === 'title') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); drawCpu(pickId); go('select'); } return; }
      const step = e.code === 'KeyA' || e.code === 'ArrowLeft' ? -1 : e.code === 'KeyD' || e.code === 'ArrowRight' ? 1 : 0;
      const lv = e.code === 'KeyW' || e.code === 'ArrowUp' ? -1 : e.code === 'KeyS' || e.code === 'ArrowDown' ? 1 : 0;
      if (step) { e.preventDefault(); const i = ROSTER.findIndex((f) => f.id === pickId); choose(ROSTER[(i + step + ROSTER.length) % ROSTER.length].id); }
      else if (lv) { e.preventDefault(); const i = LEVELS.findIndex((l) => l.id === level); sfx('ui'); setLevel(LEVELS[Math.max(0, Math.min(LEVELS.length - 1, i + lv))].id); }
      else if (e.code === 'Enter') { e.preventDefault(); start(); }
      else if (e.code === 'Escape') go('title');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0b0910]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {screen === 'fight' && game && <FightScreen game={game} onDone={done} onQuit={quit} />}

      {screen === 'gate' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0b0910] p-5">
          <div className="anim-rise flex max-w-xl flex-col items-center gap-6 text-center">
            <Seal />
            <div className="mono text-xs tracking-[0.3em] text-[#e3b95a]">SATIRE NOTICE</div>
            <h1 className="display text-4xl leading-none text-[#f3ecdc] sm:text-6xl">Before the hearing begins</h1>
            <p className="text-base leading-relaxed text-white/80">
              Silicon Showdown is satire and parody. The fighters are caricatures with made-up names. Every line they speak is a short
              clip of something the real person said on the record, shown with its source. Everything else (the fight, the jokes,
              the headlines) is invented and is not news or a claim about anyone.
            </p>
            <button className="btn" onClick={() => { unlockAudio(); go('title'); }}>I understand · Continue</button>
            <div className="flex items-center gap-3 text-xs text-white/40">
              <Link href="/legal" className="underline hover:text-white/70">Full disclaimer</Link>
              <span>·</span>
              <span className="mono">{progress < 1 ? `Loading the room ${Math.round(progress * 100)}%` : 'Room ready'}</span>
            </div>
          </div>
        </div>
      )}

      {screen === 'title' && (
        <div className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center bg-[linear-gradient(180deg,rgb(11_9_16/0.9),rgb(11_9_16/0.1)_42%,rgb(11_9_16/0.2)_60%,rgb(11_9_16/0.95))]" onClick={() => { drawCpu(pickId); go('select'); }}>
          <div className="anim-rise flex flex-col items-center pt-[7vh] text-center">
            <div className="mono text-[11px] tracking-[0.35em] text-[#e3b95a]">COMMITTEE ON COMMERCE, SCIENCE AND HUBRIS</div>
            <h1 className="display mt-2 text-6xl leading-[0.85] text-[#f3ecdc] drop-shadow-[0_6px_0_#000] sm:text-[8.5rem]">Silicon Showdown</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-10 bg-[#e3b95a]" />
              <span className="mono text-xs tracking-[0.3em] text-[#ffe6a3] sm:text-sm">THE GREAT HEARING ROOM FIGHT</span>
              <span className="h-px w-10 bg-[#e3b95a]" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="flex flex-col items-center gap-4 pb-[7vh]">
            <div className="display anim-pulse text-2xl tracking-[0.12em] text-[#ffe6a3] drop-shadow-[0_3px_0_#000] sm:text-4xl" style={{ animationDuration: '1.4s' }}>
              {game ? 'Press Enter / click to start' : `Loading the room ${Math.round(progress * 100)}%`}
            </div>
            <button className="mono text-xs tracking-widest text-white/60 underline-offset-4 hover:text-white hover:underline" onClick={(e) => { e.stopPropagation(); sfx('ui'); setShowHelp(true); }}>HOW TO PLAY</button>
            <div className="mono max-w-md text-center text-[10px] leading-relaxed tracking-wider text-white/40">
              Satire and parody. Not connected to or endorsed by any person or company. <Link href="/legal" className="underline hover:text-white/70" onClick={(e) => e.stopPropagation()}>Disclaimer</Link>
            </div>
            {error && <div className="text-sm text-red-300">{error}</div>}
          </div>
        </div>
      )}

      {screen === 'select' && (
        <div className="absolute inset-0 z-10 flex flex-col bg-[linear-gradient(180deg,rgb(11_9_16/0.96),rgb(11_9_16/0.9)_14%,rgb(11_9_16/0.05)_30%,rgb(11_9_16/0.05)_52%,rgb(11_9_16/0.96)_80%)]">
          <div className="anim-rise flex flex-col items-center pt-[3vh] text-center">
            <div className="mono text-[10px] tracking-[0.35em] text-[#e3b95a]">SILICON SHOWDOWN · THE HEARING · BEST OF THREE</div>
            <h1 className="display mt-1 text-4xl leading-none text-[#f3ecdc] drop-shadow-[0_5px_0_#000] sm:text-7xl">Select your billionaire</h1>
          </div>
          {/* VS, between the two fighters standing in the room */}
          <div className="pointer-events-none flex flex-1 items-center justify-center">
            <span className="display text-6xl italic text-[#ffe6a3] sm:text-8xl" style={{ textShadow: '0 6px 0 #000, 0 0 40px rgb(227 185 90 / .5)' }}>VS</span>
          </div>
          <div className="anim-rise mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 px-4 pb-2 sm:gap-5">
            <Plate f={player} tag="1P · YOU" portraits={portraits} />
            <div className="flex flex-col items-center gap-2.5">
              <div className="display text-lg tracking-[0.14em] text-[#ffe6a3] drop-shadow-[0_2px_0_#000] sm:text-2xl">Pick your billionaire</div>
              <div className="flex gap-2" role="radiogroup" aria-label="Play as">
                {ROSTER.map((f) => (
                  <Tile key={f.id} name={f.name} src={portraits[f.id]} color={f.color} on={pickId === f.id}
                    badges={[pickId === f.id ? '1P' : '', cpu.id === f.id ? 'CPU' : '']} onClick={() => choose(f.id)} />
                ))}
                <Tile name="???" locked boss />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
                <div className="flex items-center gap-1.5" role="radiogroup" aria-label="CPU level">
                  <span className="mono text-[10px] tracking-[0.25em] text-white/50">CPU</span>
                  {LEVELS.map((l) => (
                    <button key={l.id} className="btn-ghost !px-2.5 !py-1.5 !text-[11px]" role="radio" aria-checked={level === l.id} data-on={level === l.id} onClick={() => { sfx('ui'); setLevel(l.id); }}>{l.name}</button>
                  ))}
                </div>
              </div>
              <div className="mono text-[11px] text-white/50">{LEVELS.find((l) => l.id === level)!.note}</div>
              <button className="btn !px-12 !py-3 text-3xl" disabled={!game} onClick={start}>{game ? 'Fight!' : `Loading ${Math.round(progress * 100)}%`}</button>
            </div>
            <Plate f={cpu} tag="CPU" right portraits={portraits} />
          </div>
          <div className="mono flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-black/60 px-3 py-1.5 text-[11px] text-white/60">
            <span><b className="kbd">A</b> <b className="kbd">D</b> pick</span>
            <span><b className="kbd">W</b> <b className="kbd">S</b> CPU level</span>
            <span><b className="kbd">Enter</b> fight</span>
            <span><b className="kbd">Esc</b> back</span>
            <button className="tracking-widest underline-offset-4 hover:text-white hover:underline" onClick={() => { sfx('ui'); setShowHelp(true); }}>HOW TO PLAY</button>
            {error && <span className="text-red-300">{error}</span>}
          </div>
        </div>
      )}

      {showHelp && <Help onClose={() => { sfx('ui'); setShowHelp(false); }} />}

      {screen === 'result' && paper && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm">
          <div className="anim-pop w-full max-w-xl rotate-[-1.5deg] bg-[#f3ecdc] p-6 text-[#15110a] shadow-[0_30px_80px_rgba(0,0,0,.7)]">
            <div className="flex items-center justify-between border-b-2 border-black pb-1 text-[10px] tracking-widest">
              <span className="mono">LATE EDITION</span><span className="mono">PRICE: ONE TWEET</span>
            </div>
            <div className="py-2 text-center font-serif text-4xl font-black tracking-tight sm:text-5xl">{paper.name}</div>
            <div className="border-y-4 border-double border-black py-3 text-center">
              <div className="display text-3xl leading-tight sm:text-5xl">{paper.headline}</div>
            </div>
            <p className="mt-3 text-center font-serif text-base italic">{paper.sub}</p>
            <div className={`mono mt-4 text-center text-sm font-semibold ${paper.won ? 'text-[#1d6a2e]' : 'text-[#a3212f]'}`}>{paper.won ? 'YOU WON THE HEARING' : 'YOU LOST THE HEARING'}</div>
            <div className="mt-5 flex justify-center gap-3">
              <button className="btn" onClick={start}>Rematch</button>
              <button className="btn-ghost !border-black/30 !bg-transparent !text-black" onClick={() => { game?.stop(); go('select'); }}>Change fighter</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** A fighter's name plate on the select screen: who they are, their Super, their sidekick and their three lines. */
function Plate({ f, tag, right, portraits }: { f: FighterInfo; tag: string; right?: boolean; portraits: Portraits }) {
  const sk = portraits[f.sidekick.model];
  return (
    <div key={f.id} className={`panel anim-rise flex min-w-0 flex-col gap-1 border-2 p-3 sm:p-4 ${right ? 'items-end text-right' : 'items-start text-left'}`}
      style={{ borderColor: f.color, clipPath: right ? 'polygon(18px 0, 100% 0, 100% 100%, 0 100%)' : 'polygon(0 0, calc(100% - 18px) 0, 100% 100%, 0 100%)' }}>
      <span className="display px-2 py-0.5 text-sm tracking-wider text-black" style={{ background: f.accent }}>{tag}</span>
      <span className="display text-3xl leading-none text-white drop-shadow-[0_3px_0_#000] sm:text-5xl">{f.name}</span>
      <span className="mono text-[10px] tracking-[0.25em]" style={{ color: f.accent }}>{f.title.toUpperCase()}</span>
      <span className="mt-1 text-sm text-white/80"><span className="mono mr-1.5 text-[10px] tracking-widest text-white/45">SUPER</span><span className="display tracking-wide text-[#ffe6a3]">{f.super.name}</span></span>
      <div className={`flex items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a data URL photographed from the 3D model */}
        {sk && <img src={sk} alt="" className="h-9 w-9 rounded-full border border-[#e3b95a]/60 bg-black/50 object-cover" />}
        <span className="text-sm text-white/80"><span className="mono mr-1.5 text-[10px] tracking-widest text-white/45">SIDEKICK</span>{f.sidekick.name}</span>
      </div>
      <ul className="mt-1 hidden flex-col gap-0.5 text-xs text-white/70 lg:flex">
        {f.sigs.map((s, i) => (
          <li key={s.name}><span className="mono text-[10px] text-white/40">{['L', 'L+FWD', 'L+DOWN'][i]}</span> {s.name}</li>
        ))}
      </ul>
      <p className="mt-1 hidden max-w-[18rem] text-[11px] leading-snug text-white/50 md:block">{f.egoNote}</p>
    </div>
  );
}

/** One square of the roster grid. Locked squares are fighters that aren't in the game yet. */
function Tile({ name, src, color, on, locked, boss, badges, onClick }: {
  name: string; src?: string; color?: string; on?: boolean; locked?: boolean; boss?: boolean; badges?: string[]; onClick?(): void;
}) {
  return (
    <button type="button" role={locked ? undefined : 'radio'} aria-checked={locked ? undefined : !!on} aria-label={locked ? `${name} (locked)` : name}
      disabled={locked} onClick={onClick}
      className={`relative h-24 w-[4.5rem] overflow-hidden border-2 bg-[#0b0910] transition-transform sm:h-32 sm:w-24 ${locked ? 'cursor-default border-white/15' : 'cursor-pointer hover:-translate-y-0.5'} ${on ? '-translate-y-1' : ''}`}
      style={locked ? undefined : { borderColor: on ? '#ffe6a3' : `${color}99`, boxShadow: on ? `0 0 0 2px #000, 0 0 22px ${color}` : '0 0 0 2px #000' }}>
      {locked ? (
        <span className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,#15121c_0_8px,#0e0c13_8px_16px)]">
          <span className={`display text-4xl ${boss ? 'text-[#c8202f]/70' : 'text-white/20'}`}>?</span>
        </span>
      ) : (
        <span className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 35%, ${color}cc, #0b0910 78%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URL photographed from the 3D model */}
          {src && <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />}
        </span>
      )}
      {boss && <span className="display absolute left-0 top-0 bg-[#c8202f] px-1 text-[10px] tracking-wider text-white">BOSS</span>}
      <span className={`display absolute inset-x-0 bottom-0 truncate bg-black/80 px-1 py-0.5 text-center text-[11px] tracking-wide sm:text-sm ${locked ? 'text-white/35' : 'text-white'}`}>{name}</span>
      {badges?.[0] && <i className="display absolute left-0 top-0 bg-[#ffe6a3] px-1.5 text-xs not-italic tracking-wider text-black">{badges[0]}</i>}
      {badges?.[1] && <i className="display absolute right-0 top-0 bg-[#3a3f55] px-1.5 text-xs not-italic tracking-wider text-white">{badges[1]}</i>}
    </button>
  );
}

function Help({ onClose }: { onClose(): void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const row = (keys: string[], what: string) => (
    <div className="flex items-center justify-between gap-6 border-b border-white/10 py-2">
      <span className="flex gap-1">{keys.map((k) => <span key={k} className="kbd">{k}</span>)}</span>
      <span className="text-right text-sm text-white/80">{what}</span>
    </div>
  );
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" onClick={onClose}>
      <div className="panel anim-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="display text-4xl text-[#ffe6a3]">How the hearing works</div>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            {row(['A', 'D'], 'Move. Hold back to block')}
            {row(['W', 'S'], 'Jump, duck (duck blocks low)')}
            {row(['J'], 'Light. Tap three times for a string')}
            {row(['K'], 'Heavy. Forward+K kicks, down+K sweeps')}
            {row(['L'], 'Signature: says the line and does it. Always lands; then all three rest for 5 seconds')}
            {row(['L', 'D'], 'Second signature (L + forward)')}
            {row(['L', 'S'], 'Third signature (L + down)')}
            {row(['Space'], 'Dodge')}
            {row(['Enter'], 'Super: needs Viral (the gold mark), once per round. It always lands and nobody can interrupt it')}
            {row(['U'], 'Tag in your sidekick when cardio is low')}
            {row(['Esc'], 'Pause')}
          </div>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-white/80">
            <p><b className="text-white">Say it, do it.</b> Every signature is a real line. The room freezes while it plays, so it can&apos;t be blocked, dodged or interrupted, and it always lands. Then your three signatures rest for 5 seconds (the bar under cardio).</p>
            <p><b className="text-white">One speaker at a time.</b> Nobody can start a line while the other is still talking: the chair calls it out of order.</p>
            <p><b className="text-[#ffb347]">Engagement.</b> Saying wild things fills it: Trending, Viral, Main Character. You hit harder and take more. Viral unlocks your Super: one per round, and time stops while it starts.</p>
            <p><b className="text-[#7fd3ff]">Cardio.</b> Every swing, jump and block costs breath. Run out and your funded politician tags in for 8 seconds while you recover. Let it take 3 hits and it&apos;s a scandal: you lose 8 health and it&apos;s benched for the round.</p>
            <p className="text-white/60">Melon Tusk goes quiet badly: his meter drains twice as fast. Peter Teal gains Engagement while losing.</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end"><button className="btn" onClick={onClose}>Got it</button></div>
      </div>
    </div>
  );
}

function Seal() {
  return (
    <svg viewBox="0 0 120 120" className="h-20 w-20" aria-hidden>
      <circle cx="60" cy="60" r="57" fill="none" stroke="#e3b95a" strokeWidth="3" />
      <circle cx="60" cy="60" r="46" fill="#111a33" stroke="#e3b95a" strokeWidth="1.5" />
      <g transform="rotate(-30 60 60)" fill="#e3b95a"><rect x="30" y="54" width="52" height="12" rx="2" /><rect x="74" y="44" width="14" height="32" rx="2" /></g>
      <rect x="34" y="80" width="52" height="6" fill="#e3b95a" />
    </svg>
  );
}
