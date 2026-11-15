'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { sfx, unlockAudio } from '../audio';
import { FIGHTERS, fighterById, type Face } from '../data/fighters';
import { fill, HEADLINES, PAPERS, pick } from '../data/satire';
import { drawFace } from '../render/faces';
import { STAGES } from '../render/stages';
import type { Difficulty } from '../sim/ai/cpu';
import { FightScreen } from './FightScreen';

type Screen = 'gate' | 'menu' | 'help' | 'select' | 'fight' | 'result' | 'champion';
type Mode = 'arcade' | 'quick';
type Paper = { name: string; headline: string; sub: string; won: boolean };

const LEVELS: Difficulty[] = ['easy', 'normal', 'hard'];
const LEVEL_NAMES: Record<Difficulty, string> = { easy: 'Intern', normal: 'Founder', hard: 'Hostile Takeover' };

function Portrait({ face, className = '' }: { face: Face; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawFace(face, ref.current); }, [face]);
  return (
    <div className={`aspect-square overflow-hidden ${className}`}>
      <canvas ref={ref} className="-ml-[50%] h-full w-[200%] max-w-none" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-white/60">{label}</span>
      <div className="h-2 flex-1 rounded bg-white/15"><div className="h-full rounded bg-yellow-300" style={{ width: `${Math.round(value * 100)}%` }} /></div>
    </div>
  );
}

export function GameRoot() {
  const [screen, setScreen] = useState<Screen>('gate');
  const [mode, setMode] = useState<Mode>('arcade');
  const [playerId, setPlayerId] = useState(FIGHTERS[0].id);
  const [rivalId, setRivalId] = useState<string | null>(null);
  const [level, setLevel] = useState<Difficulty>('normal');
  const [ladder, setLadder] = useState<string[]>([]);
  const [rung, setRung] = useState(0);
  const [fightKey, setFightKey] = useState(0);
  const [paper, setPaper] = useState<Paper | null>(null);

  const player = fighterById(playerId);
  const cpu = fighterById(ladder[rung] ?? FIGHTERS[1].id);
  const base = LEVELS.indexOf(level);
  const fightLevel = mode === 'quick' ? level : LEVELS[Math.max(0, Math.min(2, base + (rung < 2 ? -1 : rung < 5 ? 0 : 1)))];
  const go = (s: Screen) => { sfx('ui'); setScreen(s); };

  const start = () => {
    const others = FIGHTERS.filter((f) => f.id !== playerId).map((f) => f.id);
    for (let i = others.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [others[i], others[j]] = [others[j], others[i]]; }
    setLadder(mode === 'arcade' ? others : [rivalId ?? others[0]]);
    setRung(0); setFightKey((k) => k + 1); go('fight');
  };

  const finish = (won: boolean) => {
    const v = { w: (won ? player : cpu).name.toUpperCase(), l: (won ? cpu : player).name.toUpperCase() };
    setPaper({ name: pick(PAPERS), headline: fill(pick(won ? HEADLINES.win : HEADLINES.lose), v), sub: pick(HEADLINES.sub), won });
    if (won && mode === 'arcade' && rung === ladder.length - 1) {
      try {
        const done: string[] = JSON.parse(localStorage.getItem('ss:cleared') ?? '[]');
        localStorage.setItem('ss:cleared', JSON.stringify([...new Set([...done, playerId])]));
      } catch { /* storage unavailable: progress just isn't saved */ }
      setScreen('champion');
    } else setScreen('result');
  };

  const next = () => { if (paper?.won && mode === 'arcade') setRung((r) => r + 1); setFightKey((k) => k + 1); go('fight'); };

  if (screen === 'fight') {
    return (
      <FightScreen key={fightKey} player={player} cpu={cpu} difficulty={fightLevel}
        stage={STAGES[(rung + (mode === 'quick' ? fightKey : 0)) % STAGES.length].id}
        label={mode === 'arcade' ? `Fight ${rung + 1} of ${ladder.length} · ${LEVEL_NAMES[fightLevel]}` : LEVEL_NAMES[fightLevel]}
        onDone={finish} onQuit={() => go('menu')} />
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_50%_0%,#3b1d5a,#0b0a12_70%)] p-5 text-white">
      {screen === 'gate' && (
        <div className="flex max-w-xl flex-col items-center gap-5 text-center">
          <h1 className="text-4xl font-black italic tracking-tighter sm:text-5xl">SATIRE NOTICE</h1>
          <p className="text-white/85">
            Silicon Showdown is satire and parody. Every character is a fictional caricature. Nothing in this game is news,
            or a factual claim about any real person, company, party or government.
          </p>
          <p className="text-white/70" lang="hi">
            यह खेल व्यंग्य और पैरोडी है। सभी पात्र काल्पनिक हैं। इसका किसी वास्तविक व्यक्ति, कंपनी, पार्टी या सरकार से कोई संबंध नहीं है।
          </p>
          <button className="menu-btn" onClick={() => { unlockAudio(); go('menu'); }}>I understand · Continue</button>
          <Link href="/legal" className="text-xs text-white/50 underline">Full disclaimer</Link>
        </div>
      )}

      {screen === 'menu' && (
        <div className="flex flex-col items-center gap-6 text-center">
          <div>
            <h1 className="text-6xl font-black italic leading-none tracking-tighter drop-shadow-[0_6px_0_#e5484d] sm:text-8xl">SILICON<br />SHOWDOWN</h1>
            <p className="mt-4 text-lg font-semibold text-yellow-300">The Great Cap Table Fight</p>
          </div>
          <div className="flex w-64 flex-col gap-3">
            <button className="menu-btn" onClick={() => { setMode('arcade'); go('select'); }}>Arcade · IPO Run</button>
            <button className="menu-btn bg-sky-600" onClick={() => { setMode('quick'); go('select'); }}>Quick Fight</button>
            <button className="menu-btn bg-zinc-700" onClick={() => go('help')}>How to play</button>
          </div>
          <p className="max-w-md text-xs text-white/50">Billionaires get tired fast. When they run out of breath, the politician they funded fights for them.</p>
        </div>
      )}

      {screen === 'help' && (
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 className="text-3xl font-black italic">HOW TO PLAY</h2>
          <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <li><b>A / D</b> or arrows: move</li><li><b>W</b>: jump · <b>S</b>: crouch</li>
            <li><b>Hold back</b>: block (crouch to block low hits)</li><li><b>J</b>: punch · <b>K</b>: kick</li>
            <li><b>I</b> (or J+K): grab, beats a block</li><li><b>Forward + J / K</b>: special moves</li>
            <li><b>Down + K</b>: sweep · <b>Down + Forward + J</b>: uppercut</li><li><b>J J J</b>, <b>J J K</b>, <b>J K K</b>: combos</li>
            <li><b>L</b> or <b>Space</b>: Super, when HYPE is full</li><li><b>U</b>: call your sidekick when CARDIO is low</li>
            <li><b>Esc</b>: pause · <b>M</b>: mute</li>
          </ul>
          <p className="text-sm text-white/80">
            <b>CARDIO</b> drains when you attack and jump. At zero your billionaire wheezes, then their funded politician tags in for 8 seconds
            while they recover at the back. If the sidekick takes 3 hits, that&apos;s a scandal: you lose health and the sidekick is gone for the round.
            A Super does 30% damage unless the opponent blocks it.
          </p>
          <button className="menu-btn w-40" onClick={() => go('menu')}>Back</button>
        </div>
      )}

      {screen === 'select' && (
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <h2 className="text-3xl font-black italic">{mode === 'arcade' ? 'ARCADE · PICK YOUR BILLIONAIRE' : 'QUICK FIGHT · PICK YOUR BILLIONAIRE'}</h2>
          <div className="grid gap-5 md:grid-cols-[1fr_20rem]">
            <div className="grid grid-cols-4 gap-2 self-start">
              {FIGHTERS.map((f) => (
                <button key={f.id} onClick={() => { sfx('ui'); setPlayerId(f.id); if (rivalId === f.id) setRivalId(null); }}
                  className={`overflow-hidden rounded-lg border-4 text-left transition ${f.id === playerId ? 'scale-105 border-yellow-300' : 'border-white/15 hover:border-white/60'}`}>
                  <Portrait face={f.look.face} />
                  <div className="truncate px-1.5 py-1 text-xs font-black italic uppercase" style={{ background: f.color }}>{f.name}</div>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 rounded-lg bg-black/40 p-4">
              <div>
                <div className="text-2xl font-black italic uppercase" style={{ color: player.color }}>{player.name}</div>
                <div className="text-xs text-white/60">{player.team}</div>
              </div>
              <p className="text-sm text-white/85">{player.blurb}</p>
              <Stat label="Fitness" value={player.sim.fitness / 1.5} />
              <Stat label="Speed" value={(player.sim.walk - 1.9) / 0.6} />
              <div className="text-sm"><span className="text-white/60">Super:</span> <b>{player.superName}</b></div>
              <div className="text-sm"><span className="text-white/60">Sidekick:</span> <b>{player.sidekick.name}</b> ({player.sidekick.policy})</div>
            </div>
          </div>
          {mode === 'quick' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/60">Opponent:</span>
              <button onClick={() => setRivalId(null)} className={`chip ${rivalId === null ? 'chip-on' : ''}`}>Random</button>
              {FIGHTERS.filter((f) => f.id !== playerId).map((f) => (
                <button key={f.id} onClick={() => setRivalId(f.id)} className={`chip ${rivalId === f.id ? 'chip-on' : ''}`}>{f.name}</button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/60">Difficulty:</span>
            {LEVELS.map((l) => (
              <button key={l} onClick={() => setLevel(l)} className={`chip ${level === l ? 'chip-on' : ''}`}>{LEVEL_NAMES[l]}</button>
            ))}
          </div>
          <div className="flex gap-3">
            <button className="menu-btn w-40" onClick={start}>Fight!</button>
            <button className="menu-btn w-32 bg-zinc-700" onClick={() => go('menu')}>Back</button>
          </div>
        </div>
      )}

      {screen === 'result' && paper && (
        <div className="flex flex-col items-center gap-5">
          <article className="w-full max-w-lg -rotate-1 bg-[#f3ecd9] p-6 text-center text-black shadow-2xl">
            <div className="border-y-4 border-double border-black py-1 font-serif text-3xl font-black tracking-tight">{paper.name}</div>
            <h2 className="mt-4 font-serif text-3xl font-black leading-tight sm:text-4xl">{paper.headline}</h2>
            <p className="mt-3 font-serif italic">{paper.sub}</p>
            <p className="mt-4 text-[10px] uppercase tracking-widest text-black/50">Satire · Not real news</p>
          </article>
          <div className="flex gap-3">
            <button className="menu-btn" onClick={next}>
              {paper.won ? (mode === 'arcade' ? `Next: ${fighterById(ladder[rung + 1]).name}` : 'Fight again') : 'Rematch'}
            </button>
            <button className="menu-btn bg-zinc-700" onClick={() => go('menu')}>Menu</button>
          </div>
        </div>
      )}

      {screen === 'champion' && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-7xl">🏆</div>
          <h2 className="text-5xl font-black italic tracking-tighter drop-shadow-[0_5px_0_#e5484d]">IPO COMPLETE</h2>
          <p className="max-w-md text-white/85">
            {player.name} beat every other billionaire and is now a public company. &quot;{player.lines.win}&quot;
          </p>
          <p className="text-xs text-white/50">Coming next: The Auditor boss fight.</p>
          <button className="menu-btn" onClick={() => go('menu')}>Back to menu</button>
        </div>
      )}
    </main>
  );
}
