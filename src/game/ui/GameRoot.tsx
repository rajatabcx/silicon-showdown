'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfx, unlockAudio } from '../audio';
import { ROSTER, TUSK, type FighterInfo } from '../data/roster';
import { fill, HEADLINES, PAPERS, pick } from '../data/satire';
import { Game } from '../Game';
import { loadAssets } from '../render/assets';
import type { Difficulty } from '../sim/ai/cpu';
import { FightScreen } from './FightScreen';

type Screen = 'gate' | 'title' | 'fight' | 'result';
type Paper = { name: string; headline: string; sub: string; won: boolean };

const LEVELS: { id: Difficulty; name: string; note: string }[] = [
  { id: 'easy', name: 'Intern', note: 'He rarely Fact-Checks you.' },
  { id: 'normal', name: 'Founder', note: 'Fights back, checks some lines.' },
  { id: 'hard', name: 'Hostile Takeover', note: 'Reads every line. Punishes talk.' },
];

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [level, setLevel] = useState<Difficulty>('normal');
  const [progress, setProgress] = useState(0);
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<Paper | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Who you play. The CPU is whoever is left (two fighters for now; an opponent pick comes later).
  const [pickId, setPickId] = useState<FighterInfo['id']>(TUSK.id);
  const player = ROSTER.find((f) => f.id === pickId)!;
  const cpu = ROSTER.find((f) => f.id !== pickId)!;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load models while the satire notice is up, then build the room (with this matchup) behind the title screen.
  useEffect(() => {
    let g: Game | null = null, dead = false;
    loadAssets(setProgress).then((assets) => {
      if (dead || !canvasRef.current) return;
      g = new Game({ canvas: canvasRef.current, assets, player, cpu });
      setGame(g);
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
  const quit = useCallback(() => { game?.stop(); setScreen('title'); }, [game]);

  useEffect(() => {
    if (screen !== 'title') return;
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Enter' && game) start(); };
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
        <div className="absolute inset-0 z-10 flex flex-col bg-[linear-gradient(180deg,rgb(11_9_16/0.88),rgb(11_9_16/0.15)_38%,rgb(11_9_16/0.25)_62%,rgb(11_9_16/0.95))]">
          <div className="anim-rise flex flex-col items-center pt-[6vh] text-center">
            <div className="mono text-[11px] tracking-[0.35em] text-[#e3b95a]">COMMITTEE ON COMMERCE, SCIENCE AND HUBRIS</div>
            <h1 className="display mt-2 text-6xl leading-[0.85] text-[#f3ecdc] drop-shadow-[0_6px_0_#000] sm:text-[8.5rem]">Silicon Showdown</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="h-px w-10 bg-[#e3b95a]" />
              <span className="mono text-xs tracking-[0.3em] text-[#ffe6a3] sm:text-sm">THE HEARING · BEST OF THREE</span>
              <span className="h-px w-10 bg-[#e3b95a]" />
            </div>
          </div>
          <div className="flex-1" />
          <div className="anim-rise mx-auto grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-end gap-4 px-5 pb-[5vh]">
            <Card f={player} tag="YOU" />
            <div className="flex flex-col items-center gap-4 pb-1">
              <div className="flex flex-col items-center gap-1.5">
                <div className="mono text-[10px] tracking-[0.3em] text-white/50">PLAY AS</div>
                <div className="flex gap-2" role="radiogroup" aria-label="Play as">
                  {ROSTER.map((f) => (
                    <button key={f.id} className="btn-ghost" role="radio" aria-checked={pickId === f.id} data-on={pickId === f.id}
                      style={pickId === f.id ? { borderColor: f.color } : undefined}
                      onClick={() => { if (pickId !== f.id) { sfx('ui'); setPickId(f.id); } }}>{f.name}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2" role="radiogroup" aria-label="Difficulty">
                {LEVELS.map((l) => (
                  <button key={l.id} className="btn-ghost" role="radio" aria-checked={level === l.id} data-on={level === l.id} onClick={() => { sfx('ui'); setLevel(l.id); }}>{l.name}</button>
                ))}
              </div>
              <div className="mono -mt-2 text-[11px] text-white/50">{LEVELS.find((l) => l.id === level)!.note}</div>
              <button className="btn text-xl" disabled={!game} onClick={start}>{game ? 'Begin the hearing' : `Loading ${Math.round(progress * 100)}%`}</button>
              <button className="mono text-xs tracking-widest text-white/60 underline-offset-4 hover:text-white hover:underline" onClick={() => { sfx('ui'); setShowHelp(true); }}>HOW TO PLAY</button>
              {error && <div className="text-sm text-red-300">{error}</div>}
            </div>
            <Card f={cpu} tag="CPU" right />
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
              <button className="btn-ghost !border-black/30 !bg-transparent !text-black" onClick={() => { game?.stop(); go('title'); }}>Title</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Card({ f, tag, right }: { f: typeof TUSK; tag: string; right?: boolean }) {
  return (
    <div className={`panel flex flex-col gap-1 p-4 ${right ? 'items-end text-right' : 'items-start text-left'}`} style={{ borderColor: f.color }}>
      <span className="mono text-[10px] tracking-[0.25em]" style={{ color: f.accent }}>{tag} · {f.title.toUpperCase()}</span>
      <span className="display text-3xl leading-none text-white sm:text-5xl">{f.name}</span>
      <ul className="mt-2 hidden flex-col gap-0.5 text-xs text-white/70 sm:flex">
        {f.sigs.map((s, i) => (
          <li key={s.name}><span className="mono text-[10px] text-white/40">{['L', 'L+FWD', 'L+DOWN'][i]}</span> {s.name}</li>
        ))}
        <li><span className="mono text-[10px] text-white/40">ENTER</span> <span className="text-[#ffe6a3]">{f.super.name}</span></li>
      </ul>
      <p className="mt-2 hidden max-w-[16rem] text-[11px] leading-snug text-white/50 md:block">{f.egoNote}</p>
    </div>
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
            {row(['L'], 'Signature: say the line, then do it')}
            {row(['L', 'D'], 'Second signature (L + forward)')}
            {row(['L', 'S'], 'Third signature (L + down)')}
            {row(['Space'], 'Dodge. In a line’s last beat: Fact-Check')}
            {row(['Enter'], 'Super: needs Viral (the gold mark), once per round. It always lands and nobody can interrupt it')}
            {row(['U'], 'Tag in your sidekick when cardio is low')}
            {row(['Esc'], 'Pause')}
          </div>
          <div className="flex flex-col gap-3 text-sm leading-relaxed text-white/80">
            <p><b className="text-white">Say it, then do it.</b> Every signature starts with a real line. While a fighter talks they are open: hit them and the line is cut.</p>
            <p><b className="text-white">One speaker at a time.</b> Nobody can start a line while the other is still talking: the chair calls it out of order.</p>
            <p><b className="text-[#5fc8ff]">Fact-Check.</b> When the other fighter is talking, the bar in their speech bubble shows a blue window at the end. Press Space inside it and the move backfires.</p>
            <p><b className="text-[#ffb347]">Engagement.</b> Saying wild things fills it: Trending, Viral, Main Character. You hit harder and take more. Viral unlocks your Super: one per round, and time stops while it starts. Get Fact-Checked at Main Character and you are Ratioed: a Meltdown.</p>
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
