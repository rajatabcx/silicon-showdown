'use client';

import { useEffect, useRef, useState } from 'react';
import { unlockAudio } from '../audio';
import { BOSSES, ROSTER, sigInfo, type FighterInfo } from '../data/roster';
import { Game } from '../Game';
import { loadAssets, type Assets } from '../render/assets';
import { FightScreen } from './FightScreen';

/**
 * Dev only (/dev): fire any billionaire's signatures, Policy Move and Super on demand, at Average Joe (to see each
 * deflection and negation) or at another billionaire. The target stands still and health resets before every move.
 */
type Move = 0 | 1 | 2 | 3 | 'super';
const MOVES: Move[] = [0, 1, 2, 3, 'super'];
const TARGETS: readonly FighterInfo[] = [...BOSSES, ...ROSTER];
// Stable, so the fight screen doesn't re-subscribe (and drop its pending lines) on every render.
const noop = () => {};

export function DevLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [atkId, setAtkId] = useState<FighterInfo['id']>(ROSTER[0].id);
  const [tgtId, setTgtId] = useState<FighterInfo['id']>('joe');
  const [game, setGame] = useState<Game | null>(null);
  const [status, setStatus] = useState('Loading models…');
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);

  const atk = ROSTER.find((f) => f.id === atkId)!;
  const tgt = TARGETS.find((f) => f.id === tgtId && f.id !== atkId) ?? TARGETS.find((f) => f.id !== atkId)!;

  useEffect(() => { loadAssets().then(setAssets).catch((e: unknown) => setStatus(String(e))); }, []);

  // A new Game for each pairing: the target is the CPU, held idle.
  useEffect(() => {
    if (!assets || !canvasRef.current) return;
    const g = new Game({ canvas: canvasRef.current, assets, player: atk, cpu: tgt });
    g.debugCpu = 0;
    g.start('normal');
    // Skip the round intro.
    g.match.phase = 'fight';
    setGame(g); setStatus('Ready');
    return () => { autoRef.current = false; setAuto(false); g.dispose(); setGame(null); };
  }, [assets, atk, tgt]);

  const label = (k: Move) => (k === 'super' ? `SUPER · ${atk.super.name}` : k === 3 ? `POLICY · ${atk.sidekick.policy.name}` : `${['L', 'L+FWD', 'L+DOWN'][k]} · ${sigInfo(atk, k).name}`);

  const fire = (k: Move) => {
    if (!game) return;
    unlockAudio();
    game.devFire(k);
    setStatus(label(k));
  };

  /** Every move in turn, each one once the last has finished. */
  const playAll = async () => {
    if (!game || autoRef.current) return;
    unlockAudio();
    autoRef.current = true; setAuto(true);
    const idle = () => new Promise<void>((done) => {
      const t = setInterval(() => { if (!autoRef.current || !game.devBusy()) { clearInterval(t); done(); } }, 100);
    });
    for (const k of MOVES) {
      if (!autoRef.current) break;
      fire(k);
      await new Promise((r) => setTimeout(r, 400));
      await idle();
      await new Promise((r) => setTimeout(r, 900));
    }
    autoRef.current = false; setAuto(false); setStatus('Done');
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0b0910]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {game && <FightScreen game={game} onDone={noop} onQuit={noop} />}
      <div className="absolute bottom-16 left-3 z-20 flex w-72 flex-col gap-2 rounded-lg border border-white/15 bg-black/80 p-3 text-xs text-white/85 backdrop-blur">
        <div className="mono text-[10px] tracking-[0.3em] text-[#e3b95a]">DEV · MOVE LAB</div>
        <label className="flex items-center justify-between gap-2">
          <span>Attacker</span>
          <select className="rounded bg-white/10 px-2 py-1" value={atkId} onChange={(e) => setAtkId(e.target.value as FighterInfo['id'])}>
            {ROSTER.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Target</span>
          <select className="rounded bg-white/10 px-2 py-1" value={tgt.id} onChange={(e) => setTgtId(e.target.value as FighterInfo['id'])}>
            {TARGETS.filter((f) => f.id !== atkId).map((f) => <option key={f.id} value={f.id}>{f.name}{f.everyman ? ' (negates)' : ''}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          {MOVES.map((k) => (
            <button key={String(k)} disabled={!game || auto} onClick={() => fire(k)}
              className="rounded border border-white/15 bg-white/5 px-2 py-1.5 text-left hover:bg-white/15 disabled:opacity-40">
              {label(k)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button disabled={!game || auto} onClick={playAll} className="flex-1 rounded bg-[#e3b95a] px-2 py-1.5 font-semibold text-black disabled:opacity-40">Play all</button>
          {auto && <button onClick={() => { autoRef.current = false; }} className="rounded border border-white/30 px-2 py-1.5">Stop</button>}
        </div>
        <div className="mono truncate text-[10px] text-white/50">{status}</div>
      </div>
    </main>
  );
}
