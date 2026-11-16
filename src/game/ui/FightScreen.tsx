'use client';

import { useEffect, useRef, useState } from 'react';
import { isMuted, setMuted, sfx } from '../audio';
import type { FighterInfo, SigInfo } from '../data/roster';
import { fill, pick, TICKER } from '../data/satire';
import type { Game } from '../Game';
import { FACT_CHECK_WINDOW, FPS, SUPER_COST, tierOf } from '../sim/constants';

type Props = { game: Game; onDone(won: boolean): void; onQuit(): void };

type Banner = { k: number; text: string; sub?: string; dur: number; tone?: 'gold' | 'red' | 'white' };
type Check = { k: number; speaker: 0 | 1; context: string; ratioed: boolean };
type Quote = { side: 0 | 1; sig: SigInfo; frames: number } | null;
type Callout = { k: number; side: number; text: string; tone: string };
type CineView = { by: 0 | 1; title: boolean; sub: number; bubbles: number[]; stamp: number; question: boolean } | null;

const TIER_NAMES = ['', 'TRENDING', 'VIRAL', 'MAIN CHARACTER'];

export function FightScreen({ game, onDone, onQuit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [quote, setQuote] = useState<Quote>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [cine, setCine] = useState<CineView>(null);
  const [ticker, setTicker] = useState(TICKER.idle[0]);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const infos = game.infos;

  useEffect(() => {
    const timers: number[] = [];
    let id = 0;
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const announce = (text: string, sub?: string, dur = 1.2, tone: Banner['tone'] = 'gold') => {
      const k = ++id;
      setBanner({ k, text, sub, dur, tone });
      later(() => setBanner((b) => (b?.k === k ? null : b)), dur * 1000);
    };
    const callout = (side: number, text: string, tone = '#ffe6a3') => {
      const k = ++id;
      setCallouts((c) => [...c.slice(-2), { k, side, text, tone }]);
      later(() => setCallouts((c) => c.filter((x) => x.k !== k)), 1300);
    };
    const news = (pool: string[], w: number) => setTicker(fill(pick(pool), { w: infos[w].name, l: infos[1 - w].name }));

    const off = game.on((e, m) => {
      switch (e.t) {
        case 'roundStart':
          setCine(null); setQuote(null);
          later(() => announce(m.round === 3 ? 'FINAL ROUND' : `ROUND ${e.round}`, 'The hearing will come to order.', 1.7), 250);
          break;
        case 'fight': announce('FIGHT', undefined, 0.8, 'white'); break;
        case 'hit':
          if (e.combo >= 3) { callout(e.by, `${e.combo} HIT COMBO`); news(TICKER.combo, e.by); }
          else if (Math.random() < 0.15) news(TICKER.hit, e.by);
          if (e.move === 'counter') callout(e.by, 'COUNTERED', '#8fd3ff');
          break;
        case 'quoteCut': callout(1 - e.by, 'INTERRUPTED', '#ffffff'); break;
        case 'factCheck': {
          const k = ++id, speaker = (1 - e.by) as 0 | 1;
          setCheck({ k, speaker, context: infos[speaker].sigs[e.sig].context, ratioed: e.ratioed });
          later(() => setCheck((c) => (c?.k === k ? null : c)), 2600);
          news(TICKER.factCheck, e.by);
          break;
        }
        case 'tier': callout(e.by, TIER_NAMES[e.tier], e.tier === 3 ? '#ff8f6b' : '#ffe6a3'); break;
        case 'winded': callout(e.by, 'OUT OF BREATH', '#9fd8ff'); break;
        case 'superWhiff': callout(e.by, 'MISSED', '#ffffff'); break;
        case 'superBlocked': callout(1 - e.by, 'BLOCKED', '#8fd3ff'); break;
        case 'superHit': news(TICKER.super, e.by); break;
        case 'ko': announce('K.O.', `${infos[1 - e.by].name}: "${infos[1 - e.by].win}"`, 2.6, 'red'); news(TICKER.ko, 1 - e.by); break;
        case 'timeUp': announce('TIME', 'The chair has run out of patience.', 1.8); break;
        case 'matchEnd': later(() => onDone(e.winner === 0), 2200); break;
      }
    });

    // The HUD is written straight to the DOM every frame; React state would be too slow.
    const el: Record<string, HTMLElement> = {};
    rootRef.current?.querySelectorAll<HTMLElement>('[data-hud]').forEach((n) => { el[n.dataset.hud!] = n; });
    let raf = 0;
    let lastQuote = '';
    let lastCine = '';
    let stampShown = '';
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const m = game.match;
      m.f.forEach((f, i) => {
        const hp = Math.max(0, f.hp) / 100;
        el[`hp${i}`]?.style.setProperty('transform', `scaleX(${hp})`);
        el[`lag${i}`]?.style.setProperty('transform', `scaleX(${hp})`);
        el[`eng${i}`]?.style.setProperty('transform', `scaleX(${f.eng / 100})`);
        el[`cardio${i}`]?.style.setProperty('transform', `scaleX(${Math.max(0, f.cardio) / 100})`);
        const tier = tierOf(f.eng);
        const te = el[`tier${i}`];
        if (te) {
          te.textContent = f.melt > 0 ? 'MELTDOWN' : f.eng >= SUPER_COST ? `${TIER_NAMES[tier]} · SUPER READY` : TIER_NAMES[tier] || 'ENGAGEMENT';
          te.dataset.hot = String(f.eng >= SUPER_COST || f.melt > 0);
        }
        const w = el[`wins${i}`];
        if (w) [...w.children].forEach((c, k) => ((c as HTMLElement).dataset.on = String(k < f.wins)));
      });
      if (el.timer) el.timer.textContent = String(Math.max(0, Math.ceil(m.timer / FPS)));

      // Quote subtitle and its Fact-Check window.
      const qi = m.f.findIndex((f) => f.state === 'quote');
      const qKey = qi >= 0 ? `${qi}-${m.f[qi].sig}-${m.round}` : '';
      if (qKey !== lastQuote) {
        lastQuote = qKey;
        setQuote(qi >= 0 ? { side: qi as 0 | 1, sig: infos[qi].sigs[m.f[qi].sig], frames: game.defs[qi].sigs[m.f[qi].sig].quote } : null);
      }
      if (qi >= 0) {
        const f = m.f[qi], total = game.defs[qi].sigs[f.sig].quote;
        el.qbar?.style.setProperty('transform', `scaleX(${Math.min(1, f.frame / total)})`);
        const open = f.frame >= total - FACT_CHECK_WINDOW && game.defs[qi].sigs[f.sig].kind !== 'counter';
        if (el.qwin) el.qwin.dataset.open = String(open);
      }

      // Super overlays, keyed to the same seconds as the 3D script.
      let cv: CineView = null;
      if (m.phase === 'cine') {
        const by = m.cineBy, sp = infos[by].super, t = m.phaseFrame / FPS;
        const titleAt = sp.beats.find((b) => b.kind === 'title')!.at;
        const next = sp.beats.find((b) => b.at > titleAt)?.at ?? titleAt + 1.8;
        cv = {
          by,
          title: t >= titleAt && t < next,
          sub: sp.subs.findIndex((s) => t >= s.at && t < s.to),
          bubbles: sp.beats.map((b, k) => (b.kind === 'bubble' && t >= b.at && t < b.at + 2.4 ? k : -1)).filter((k) => k >= 0),
          stamp: sp.beats.findIndex((b) => b.kind === 'stamp' && t >= b.at),
          question: infos[by].id === 'teal' && t >= 2.0 && t < 11.4,
        };
      }
      const cKey = JSON.stringify(cv);
      if (cKey !== lastCine) {
        if (cv && cv.stamp >= 0 && stampShown !== `${m.round}-${m.frame - m.phaseFrame}`) { stampShown = `${m.round}-${m.frame - m.phaseFrame}`; sfx('stamp'); }
        lastCine = cKey; setCine(cv);
      }
      if (cv) for (const k of cv.bubbles) {
        const b = el[`bubble${k}`];
        const side = infos[cv.by].super.beats[k].side === 'atk' ? cv.by : (1 - cv.by) as 0 | 1;
        if (b) { const p = game.headOnScreen(side); b.style.left = `${Math.min(80, Math.max(8, p.x * 100))}%`; b.style.top = `${Math.max(14, p.y * 100 - 4)}%`; }
      }
    };
    raf = requestAnimationFrame(frame);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') { game.setPaused(!game.paused); setPaused(game.paused); sfx('ui'); }
      if (e.code === 'KeyM') { setMuted(!isMuted()); setMutedState(isMuted()); }
    };
    window.addEventListener('keydown', onKey);
    return () => { off(); cancelAnimationFrame(raf); timers.forEach(clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [game, infos, onDone]);

  const sp = cine ? infos[cine.by].super : null;

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 select-none overflow-hidden">
      {/* Letterbox in Supers */}
      <div className="absolute inset-x-0 top-0 bg-black transition-[height] duration-300" style={{ height: cine ? '9%' : 0 }} />
      <div className="absolute inset-x-0 bottom-0 bg-black transition-[height] duration-300" style={{ height: cine ? '9%' : 0 }} />

      {/* Top HUD */}
      <div className={`absolute inset-x-0 top-0 px-3 pt-3 transition-opacity duration-300 sm:px-6 sm:pt-4 ${cine ? 'opacity-40' : ''}`}>
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
          <Side i={0} info={infos[0]} />
          <Timer />
          <Side i={1} info={infos[1]} />
        </div>
      </div>

      {/* Callouts */}
      {callouts.map((c) => (
        <div key={c.k} className={`display anim-pop absolute top-[23%] text-2xl drop-shadow-[0_3px_0_#000] sm:text-4xl ${c.side === 0 ? 'left-[8%]' : 'right-[8%]'}`} style={{ color: c.tone }}>
          {c.text}
        </div>
      ))}

      {/* Round / KO banners */}
      {banner && (
        <div key={banner.k} className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="display anim-banner text-7xl sm:text-9xl" style={{ ['--dur' as string]: `${banner.dur}s`, color: banner.tone === 'red' ? '#ff5a52' : banner.tone === 'white' ? '#fff' : '#ffe6a3', textShadow: '0 6px 0 #000, 0 0 40px rgb(0 0 0 / .6)' }}>
            {banner.text}
          </div>
          {banner.sub && <div className="anim-rise mono rounded bg-black/70 px-3 py-1 text-xs tracking-widest text-white/90 sm:text-sm">{banner.sub}</div>}
        </div>
      )}

      {/* The line being said, with its source and the Fact-Check window */}
      {quote && !cine && <QuoteBox q={quote} info={infos[quote.side]} isCpu={quote.side === 1} />}

      {/* Fact-Check result */}
      {check && (
        <div key={check.k} className="absolute inset-x-0 top-[30%] flex flex-col items-center gap-4">
          <div className="stamp anim-slam text-5xl text-[#5fc8ff] sm:text-7xl" style={{ textShadow: '0 4px 0 #000', background: 'rgb(0 0 0 / .35)' }}>
            {check.ratioed ? 'RATIOED' : 'FACT-CHECKED'}
          </div>
          <div className="anim-rise max-w-md border-l-4 border-[#5fc8ff] bg-[#0d1626]/95 px-4 py-3 text-left shadow-2xl">
            <div className="mono text-[11px] tracking-[0.18em] text-[#5fc8ff]">READERS ADDED CONTEXT</div>
            <div className="mt-1 text-sm text-white sm:text-base">{check.context}</div>
            {check.ratioed && <div className="mono mt-2 text-[11px] tracking-widest text-[#ff8f6b]">{infos[check.speaker].name.toUpperCase()} IS HAVING A MELTDOWN</div>}
          </div>
        </div>
      )}

      {/* Super: title card, real-clip subtitles, bubbles, closing stamp */}
      {cine && sp && (
        <>
          {cine.title && (
            <div className="absolute inset-x-0 top-[36%] flex justify-center">
              <div className="anim-sweep relative flex w-[115%] items-center justify-center border-y-4 border-[#e3b95a] bg-gradient-to-r from-[#0b0910] via-[#1a1430] to-[#0b0910] py-4 sm:py-6" style={{ ['--dur' as string]: '1.8s' }}>
                <div className="flex flex-col items-center" style={{ transform: 'skewX(12deg)' }}>
                  <span className="mono text-xs tracking-[0.3em] text-[#e3b95a] sm:text-sm">{infos[cine.by].name.toUpperCase()} · {sp.tag}</span>
                  <span className="display text-5xl italic text-[#ffe6a3] sm:text-8xl" style={{ textShadow: '0 5px 0 #000' }}>{sp.name}</span>
                </div>
              </div>
            </div>
          )}
          {cine.question && (
            <div className="anim-rise absolute left-1/2 top-[12%] -translate-x-1/2 bg-[#c8202f] px-4 py-1.5 text-center">
              <span className="mono text-[11px] tracking-[0.2em] text-white/80">THE QUESTION · </span>
              <span className="text-sm font-semibold text-white sm:text-base">Would you prefer the human race to endure?</span>
            </div>
          )}
          {cine.bubbles.map((k) => (
            <div key={k} data-hud={`bubble${k}`} className="anim-pop absolute max-w-[16rem] -translate-x-1/2 -translate-y-full rounded-2xl border-[3px] border-black bg-white px-3 py-2 text-center text-sm font-bold leading-tight text-black shadow-[4px_4px_0_#000] sm:text-base">
              {sp.beats[k].text}
            </div>
          ))}
          {cine.sub >= 0 && (
            <div key={cine.sub} className="anim-rise absolute inset-x-0 bottom-[12%] flex flex-col items-center gap-1 px-4">
              <div className="max-w-3xl bg-black/80 px-4 py-2 text-center text-lg font-semibold text-white sm:text-2xl">
                {sp.subs[cine.sub].speaker && <span className="mono mr-2 text-xs tracking-widest text-white/60">{sp.subs[cine.sub].speaker}:</span>}
                {sp.subs[cine.sub].text}
              </div>
              <div className="mono text-[10px] tracking-[0.2em] text-[#e3b95a] sm:text-xs">REAL QUOTE · {sp.source}</div>
            </div>
          )}
          {cine.stamp >= 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="stamp anim-slam text-6xl text-[#ff5a52] sm:text-9xl" style={{ textShadow: '0 6px 0 #000', background: 'rgb(0 0 0 / .25)' }}>
                {sp.beats[cine.stamp].text}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lower third: live crawl and the controls */}
      <div className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${cine ? 'opacity-0' : ''}`}>
        <div className="flex items-stretch bg-[#0b0910]/85 text-xs sm:text-sm">
          <span className="display flex items-center bg-[#c8202f] px-3 tracking-wider text-white">LIVE</span>
          <span className="mono flex items-center bg-[#e3b95a] px-3 text-[10px] font-semibold tracking-widest text-black sm:text-xs">SENATE HEARING ROOM</span>
          <span key={ticker} className="anim-rise truncate px-3 py-2 text-white/90">{ticker}</span>
        </div>
        <div className="mono hidden flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-black/70 px-3 py-1.5 text-[11px] text-white/70 md:flex">
          <span><K>A</K><K>D</K> move · hold back to block</span>
          <span><K>W</K> jump <K>S</K> duck</span>
          <span><K>J</K> light (tap 3x)</span>
          <span><K>K</K> heavy</span>
          <span><K>L</K> say it · <K>L</K>+fwd · <K>L</K>+<K>S</K></span>
          <span><K>Space</K> dodge / Fact-Check</span>
          <span><K>Enter</K> Super</span>
          <span><K>Esc</K> pause <K>M</K> {muted ? 'unmute' : 'mute'}</span>
        </div>
      </div>

      {paused && (
        <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="panel anim-pop flex w-80 flex-col items-center gap-4 p-6">
            <div className="display text-4xl text-[#ffe6a3]">RECESS</div>
            <button className="btn w-full" onClick={() => { game.setPaused(false); setPaused(false); sfx('ui'); }}>Resume</button>
            <button className="btn-ghost w-full" onClick={() => { setMuted(!isMuted()); setMutedState(isMuted()); }}>{muted ? 'Sound off' : 'Sound on'}</button>
            <button className="btn-ghost w-full" onClick={() => { sfx('ui'); onQuit(); }}>Leave the hearing</button>
          </div>
        </div>
      )}
    </div>
  );
}

function K({ children }: { children: React.ReactNode }) {
  return <span className="mx-0.5 inline-block rounded-sm bg-white/90 px-1 text-[10px] font-semibold text-black">{children}</span>;
}

function Timer() {
  return (
    <div className="relative mt-1 flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-[#e3b95a] bg-[radial-gradient(circle,#1d2a52,#0b0910)] shadow-[0_0_0_3px_#000] sm:h-20 sm:w-20">
      <span data-hud="timer" className="display text-3xl leading-none text-[#ffe6a3] sm:text-4xl">90</span>
      <span className="mono text-[8px] tracking-[0.2em] text-[#e3b95a]">SECONDS</span>
    </div>
  );
}

function Side({ i, info }: { i: 0 | 1; info: FighterInfo }) {
  const right = i === 1;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${right ? 'items-end' : 'items-start'}`}>
      <div className={`flex w-full items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="display truncate text-xl leading-none text-white drop-shadow-[0_2px_0_#000] sm:text-3xl">{info.name}</span>
        <span className="mono hidden truncate text-[10px] tracking-[0.18em] text-[#e3b95a] sm:inline">{info.title.toUpperCase()}{i === 1 ? ' · CPU' : ''}</span>
        <span data-hud={`wins${i}`} className={`flex gap-1 ${right ? 'mr-auto' : 'ml-auto'}`}>
          {[0, 1].map((k) => <span key={k} className="h-3 w-3 rotate-45 border border-[#e3b95a] data-[on=true]:bg-[#ffe6a3]" />)}
        </span>
      </div>
      {/* Health */}
      <div className="h-5 w-full skew-x-[-14deg] border-2 border-black bg-[#2a0e10] shadow-[0_0_0_1px_#e3b95a] sm:h-7" style={{ transform: `skewX(${right ? 14 : -14}deg)` }}>
        <div className={`bar ${right ? 'flip' : ''}`}>
          <div data-hud={`lag${i}`} className="lag bg-[#fff1c9]" />
          <div data-hud={`hp${i}`} className="fill" style={{ background: `linear-gradient(180deg, ${info.accent}, ${info.color} 60%, #5a1414)` }} />
        </div>
      </div>
      {/* Engagement */}
      <div className={`flex w-[88%] items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <div className="relative h-2.5 flex-1 border border-black bg-black/60 sm:h-3">
          <div className={`bar ${right ? 'flip' : ''}`}><div data-hud={`eng${i}`} className="fill bg-gradient-to-r from-[#7a5cff] via-[#ff5ab4] to-[#ffb347]" style={{ transform: 'scaleX(0)' }} /></div>
          <span className="absolute inset-y-0 left-[34%] w-px bg-white/50" />
          <span className="absolute inset-y-0 left-[67%] w-0.5 bg-[#ffe6a3]" />
        </div>
        <span data-hud={`tier${i}`} className="mono shrink-0 text-[9px] tracking-[0.16em] hud-tier text-white/60 sm:text-[10px]">ENGAGEMENT</span>
      </div>
      {/* Cardio */}
      <div className={`flex w-[60%] items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <div className="h-1 flex-1 bg-black/60"><div className={`bar ${right ? 'flip' : ''}`}><div data-hud={`cardio${i}`} className="fill bg-[#7fd3ff]" /></div></div>
        <span className="mono text-[8px] tracking-[0.16em] text-white/40">CARDIO</span>
      </div>
    </div>
  );
}

function QuoteBox({ q, info, isCpu }: { q: NonNullable<Quote>; info: FighterInfo; isCpu: boolean }) {
  const counter = q.sig.sim.kind === 'counter';
  return (
    <div className="absolute inset-x-0 bottom-[13%] flex flex-col items-center gap-2 px-4">
      {q.sig.post ? (
        <div className="anim-pop w-[min(26rem,92vw)] rounded-2xl border border-white/20 bg-white p-4 text-left text-black shadow-2xl">
          <div className="flex items-center gap-2">
            <div className="display flex h-9 w-9 items-center justify-center rounded-full bg-black text-lg text-white">{info.name[0]}</div>
            <div className="leading-tight"><div className="font-bold">{info.name}</div><div className="text-xs text-black/50">{q.sig.post.handle}</div></div>
          </div>
          <div className="mt-2 text-lg font-medium">{q.sig.post.text}</div>
          <div className="mono mt-2 text-[10px] tracking-widest text-black/50">REAL POST · {q.sig.post.source}</div>
        </div>
      ) : (
        <div className="anim-rise flex max-w-3xl flex-col items-center gap-1">
          <div className="mono text-[10px] tracking-[0.22em] text-[#e3b95a]">{(q.sig.line?.speaker ?? info.name).toUpperCase()} · {q.sig.name.toUpperCase()}</div>
          <div className="bg-black/80 px-4 py-2 text-center text-xl font-semibold text-white sm:text-3xl">&ldquo;{q.sig.line?.text}&rdquo;</div>
          <div className="mono text-[10px] tracking-[0.2em] text-white/60 sm:text-xs">REAL QUOTE · {q.sig.line?.source}</div>
        </div>
      )}
      {!counter && (
        <div className="relative h-2 w-[min(26rem,80vw)] bg-white/15">
          <div data-hud="qbar" className="absolute inset-0 origin-left bg-white/70" style={{ transform: 'scaleX(0)' }} />
          <div data-hud="qwin" className="group absolute inset-y-[-3px] right-0 border border-[#5fc8ff] bg-[#5fc8ff]/25 data-[open=true]:bg-[#5fc8ff]" style={{ width: `${(FACT_CHECK_WINDOW / q.frames) * 100}%` }}>
            <span className="mono absolute -top-5 right-0 whitespace-nowrap text-[10px] tracking-widest text-[#5fc8ff]">
              {isCpu ? 'SPACE TO FACT-CHECK' : 'FACT-CHECK WINDOW'}
            </span>
          </div>
        </div>
      )}
      {counter && <div className="mono text-[10px] tracking-widest text-[#8fd3ff]">HE IS NOT ANSWERING. DON&apos;T HIT HIM.</div>}
    </div>
  );
}
