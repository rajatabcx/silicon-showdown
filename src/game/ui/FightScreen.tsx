'use client';

import { useEffect, useRef, useState } from 'react';
import { isMuted, roundSayAt, setMuted, sfx } from '../audio';
import { lineSeconds, ROSTER, sigInfo, type FighterInfo, type SigInfo } from '../data/roster';
import { fill, pick, TICKER } from '../data/satire';
import type { Game } from '../Game';
import { FPS, INTRO_FRAMES, SIDEKICK_HITS, SIG_COOLDOWN, SUPER_COST, TAG_FRAMES, TAG_MANUAL_CARDIO, tierOf } from '../sim/constants';
import { staging } from '../sim/match';
import { placeBubble, type Placement } from './bubbles';

type Props = { game: Game; onDone(won: boolean): void; onQuit(): void };

type Banner = { k: number; text: string; sub?: string; dur: number; tone?: 'gold' | 'red' | 'white' };
type Quote = { k: number; side: 0 | 1; sig: SigInfo; policy: boolean } | null;
type Tag = { hits: number } | null;
type Callout = { k: number; side: number; text: string; tone: string };
/** The running combo count for one side: one line that updates in place, never a pile of them. */
type Combo = { k: number; n: number } | null;
/** A short text-only banter line over a head at a tag (never voiced, never a quote). */
type Chat = { k: number; side: 0 | 1; who: 'boss' | 'sk'; name: string; text: string };
type CineView = { by: 0 | 1; title: boolean; sub: number; bubbles: number[]; stamp: number; question: boolean } | null;

const TIER_NAMES = ['', 'TRENDING', 'VIRAL', 'MAIN CHARACTER'];

export function FightScreen({ game, onDone, onQuit }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [quote, setQuote] = useState<Quote>(null);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [combos, setCombos] = useState<[Combo, Combo]>([null, null]);
  const [cine, setCine] = useState<CineView>(null);
  /** The camera has left the fight view (Super or Policy Move): letterbox bars on, lower third off. */
  const [cinema, setCinema] = useState(false);
  const [ticker, setTicker] = useState(TICKER.idle[0]);
  const [paused, setPaused] = useState(false);
  const [muted, setMutedState] = useState(isMuted());
  const [tags, setTags] = useState<[Tag, Tag]>([null, null]);
  const [chats, setChats] = useState<Chat[]>([]);
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
    // One banter line at a time: a new one replaces whatever is up.
    const chat = (side: 0 | 1, who: Chat['who'], text: string, delay: number, dur: number) => later(() => {
      const k = ++id;
      const name = who === 'sk' ? infos[side].sidekick.name : infos[side].name;
      setChats([{ k, side, who, name, text }]);
      later(() => setChats((c) => c.filter((x) => x.k !== k)), dur);
    }, delay);
    const news = (pool: string[], w: number) => setTicker(fill(pick(pool), { w: infos[w].name, l: infos[1 - w].name }));

    const off = game.on((e, m) => {
      switch (e.t) {
        case 'roundStart':
          setCine(null); setCinema(false); setQuote(null); setChats([]); setCombos([null, null]); setCallouts([]);
          {
            // In step with the announcer: the banner goes up as he says "Round N" and comes down before "Fight!".
            const at = roundSayAt(e.round, INTRO_FRAMES / FPS);
            later(() => announce(m.round === 3 ? 'FINAL ROUND' : `ROUND ${e.round}`, 'The hearing will come to order.', Math.max(0.9, INTRO_FRAMES / FPS - at - 0.1)), at * 1000);
          }
          break;
        case 'fight': announce('FIGHT', undefined, 0.8, 'white'); break;
        case 'hit':
          if (e.combo >= 3) {
            const k = ++id, by = e.by;
            setCombos((c) => (by === 0 ? [{ k, n: e.combo }, c[1]] : [c[0], { k, n: e.combo }]));
            later(() => setCombos((c) => (c[by]?.k === k ? (by === 0 ? [null, c[1]] : [c[0], null]) : c)), 1500);
            news(TICKER.combo, e.by);
          }
          else if (Math.random() < 0.15) news(TICKER.hit, e.by);
          break;
        // The line stays up for as long as it's being said, which runs on past the move itself.
        case 'quote': {
          const k = ++id, sig = sigInfo(infos[e.by], e.sig);
          setQuote({ k, side: e.by, sig, policy: e.sig === 3 });
          later(() => setQuote((q) => (q?.k === k ? null : q)), (lineSeconds(sig.line, sig.post) + 0.35) * 1000);
          break;
        }
        case 'tier': callout(e.by, TIER_NAMES[e.tier], e.tier === 3 ? '#ff8f6b' : '#ffe6a3'); break;
        case 'winded': callout(e.by, 'OUT OF BREATH', '#9fd8ff'); break;
        case 'outOfOrder': callout(e.by, 'OUT OF ORDER', '#ffffff'); break;
        case 'tagIn':
          callout(e.by, `TAG IN: ${infos[e.by].sidekick.name.toUpperCase()}`, '#ffe6a3');
          setTicker(`${infos[e.by].name} is out of breath. ${infos[e.by].sidekick.name} has been sent in by the donor.`);
          chat(e.by, 'boss', pick(infos[e.by].sidekick.banter.out), 0, 1900);
          chat(e.by, 'sk', pick(infos[e.by].sidekick.banter.in), 1950, 2300);
          break;
        case 'tagOut':
          if (e.scandal) {
            announce('DONOR EXPOSED', `${infos[e.by].sidekick.name} is out for the round · ${infos[e.by].name} -8`, 1.6, 'red');
            setTicker(`SCANDAL: ${infos[e.by].sidekick.name}'s funding traced back to ${infos[e.by].name}. Sidekick benched.`);
            chat(e.by, 'sk', pick(infos[e.by].sidekick.banter.scandal), 0, 2000);
          } else {
            callout(e.by, 'BACK IN', '#ffffff');
            if (m.phase !== 'cine') chat(e.by, 'sk', pick(infos[e.by].sidekick.banter.back), 0, 1900);
          }
          break;
        case 'superStart': setChats([]); setQuote(null); break;
        case 'superHit': news(TICKER.super, e.by); break;
        // The knockout: the room goes grey and slow first, then the word lands.
        case 'ko': { const w = 1 - e.by; later(() => announce('WASTED', `${infos[w].name}: "${infos[w].win}"`, 2.8, 'red'), 550); news(TICKER.ko, w); break; }
        case 'timeUp': announce('TIME', 'The chair has run out of patience.', 1.8); break;
        case 'matchEnd': later(() => onDone(e.winner === 0), 2200); break;
      }
    });

    // The HUD is written straight to the DOM every frame; React state would be too slow.
    const el: Record<string, HTMLElement> = {};
    rootRef.current?.querySelectorAll<HTMLElement>('[data-hud]').forEach((n) => { el[n.dataset.hud!] = n; });
    let raf = 0;
    let lastCine = '';
    /** Where each bubble was put last frame, so it only moves to another spot when it has to. */
    const placed = new Map<string, Placement>();
    let stampShown = '';
    let lastCinema = false;
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
          const ready = f.eng >= SUPER_COST && !f.superUsed && f.tag <= 0;
          te.textContent = ready ? 'SUPER READY · ENTER' : f.superUsed ? `${TIER_NAMES[tier] || 'ENGAGEMENT'} · SUPER USED` : TIER_NAMES[tier] || 'ENGAGEMENT';
          te.dataset.hot = String(ready);
        }
        const ce = el[`clabel${i}`];
        if (ce) {
          const can = f.tag <= 0 && !f.skOut && f.cardio < TAG_MANUAL_CARDIO;
          ce.textContent = f.tag > 0 ? 'RECOVERING' : f.skOut ? 'CARDIO · NO SIDEKICK' : can ? (i === 0 ? 'CARDIO · U TO TAG' : 'CARDIO · CAN TAG') : 'CARDIO';
          ce.dataset.hot = String(can);
        }
        el[`sktime${i}`]?.style.setProperty('transform', `scaleX(${f.tag / TAG_FRAMES})`);
        // Signature cooldown: the bar refills; the label says when the three moves are back.
        const cd = f.tag > 0 ? 0 : f.sigCd;
        el[`sigcd${i}`]?.style.setProperty('transform', `scaleX(${1 - cd / SIG_COOLDOWN})`);
        const sl = el[`slabel${i}`];
        if (sl) {
          sl.textContent = f.tag > 0 ? 'MOVES · SIDEKICK' : cd > 0 ? `MOVES · ${Math.ceil(cd / FPS)}s` : i === 0 ? 'MOVES READY · L' : 'MOVES READY';
          sl.dataset.hot = String(cd <= 0 && f.tag <= 0);
        }
        const w = el[`wins${i}`];
        if (w) [...w.children].forEach((c, k) => ((c as HTMLElement).dataset.on = String(k < f.wins)));
      });
      if (el.timer) el.timer.textContent = String(Math.max(0, Math.ceil(m.timer / FPS)));
      const tagKey = m.f.map((f) => (f.tag > 0 ? f.skHits : -1));
      setTags((t) => (t[0]?.hits ?? -1) === tagKey[0] && (t[1]?.hits ?? -1) === tagKey[1] ? t
        : [tagKey[0] >= 0 ? { hits: tagKey[0] } : null, tagKey[1] >= 0 ? { hits: tagKey[1] } : null]);

      // Anything directed by the camera: a Super (its flash and its cinematic), a signature or a Policy Move.
      const policy = m.phase === 'fight' && (staging(m, 0) || staging(m, 1));
      const cinema = m.phase === 'cine' || policy || (m.phase === 'fight' && m.f.some((f) => f.state === 'superStart'));
      if (cinema !== lastCinema) { lastCinema = cinema; setCinema(cinema); }

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

      // Every speech bubble (the line, tag banter, a Super's asides) sits next to its speaker's head and never over
      // anyone's face, from whatever angle the camera is at: above the head if there's room, else beside it.
      const root = rootRef.current;
      if (root) {
        const R = root.getBoundingClientRect();
        const zone = el.hudzone?.getBoundingClientRect();
        // Never over the health bars, cinematic or not.
        const top = zone ? (zone.bottom - R.top) / R.height + 0.01 : 0.25;
        const bottom = cinema ? 0.9 : 0.86;
        const faces = ([0, 1] as const).map((i) => game.headRect(i)).filter((r) => !!r);
        const put = (b: HTMLElement, key: string, side: 0 | 1, who?: 'boss' | 'sk') => {
          const head = game.headRect(side, who);
          const other = game.headRect((1 - side) as 0 | 1);
          const spot = placeBubble({
            w: b.offsetWidth / R.width, h: b.offsetHeight / R.height, head, other, faces, top, bottom, last: placed.get(key),
          });
          placed.set(key, spot);
          b.style.left = `${spot.x * 100}%`; b.style.top = `${spot.y * 100}%`;
          b.style.visibility = 'visible';
          b.dataset.tail = spot.kind === 'above' ? 'down' : spot.kind === 'left' ? 'right' : spot.kind === 'right' ? 'left' : 'none';
        };
        const qb = root.querySelector<HTMLElement>('[data-hud="qbubble"]');
        if (qb) put(qb, 'q', Number(qb.dataset.side) as 0 | 1);
        root.querySelectorAll<HTMLElement>('[data-chat]').forEach((b) => {
          const [side, who] = b.dataset.chat!.split('-') as ['0' | '1', 'boss' | 'sk'];
          if (qb || cinema) { b.style.visibility = 'hidden'; return; }
          put(b, `chat-${who}`, Number(side) as 0 | 1, who);
        });
        if (cv) for (const k of cv.bubbles) {
          const b = el[`bubble${k}`] ?? root.querySelector<HTMLElement>(`[data-hud="bubble${k}"]`);
          const side = infos[cv.by].super.beats[k].side === 'atk' ? cv.by : (1 - cv.by) as 0 | 1;
          if (b) put(b, `sup-${k}`, side);
        }
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
      <div className="absolute inset-x-0 top-0 bg-black transition-[height] duration-300" style={{ height: cinema ? '9%' : 0 }} />
      <div className="absolute inset-x-0 bottom-0 bg-black transition-[height] duration-300" style={{ height: cinema ? '9%' : 0 }} />

      {/* Top HUD. The combo count and the callouts sit in the same column as the bars, one line each. */}
      <div data-hud="hudzone" className={`absolute inset-x-0 top-0 px-3 pt-3 transition-opacity duration-300 sm:px-6 sm:pt-4 ${cine ? 'opacity-40' : ''}`}>
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-5">
          {([0, 1] as const).map((i) => (
            <div key={i} className={i === 1 ? 'order-3 min-w-0' : 'min-w-0'}>
              <Side i={i} info={infos[i]} tag={tags[i]} health={game.defs[i].health} />
              <div className={`mt-1 flex flex-col gap-0.5 ${i === 1 ? 'items-end text-right' : 'items-start'}`}>
                {combos[i] && (
                  <div key={combos[i]!.k} className="display anim-pop whitespace-nowrap text-2xl leading-none text-[#ffe6a3] drop-shadow-[0_3px_0_#000] sm:text-4xl">
                    <span className="text-[1.25em] text-white">{combos[i]!.n}</span> HIT COMBO
                  </div>
                )}
                {callouts.filter((c) => c.side === i).map((c) => (
                  <div key={c.k} className="display anim-pop whitespace-nowrap text-xl leading-none drop-shadow-[0_3px_0_#000] sm:text-3xl" style={{ color: c.tone }}>
                    {c.text}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="order-2 flex flex-col items-center">
            <Timer />
            <button
              type="button"
              aria-label="Pause"
              title="Pause (Esc)"
              className="pointer-events-auto mt-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#e3b95a] bg-[#0b0910]/85 text-[#ffe6a3] shadow-[0_0_0_2px_#000] transition hover:bg-[#1d2a52] active:scale-95 sm:h-7 sm:w-7"
              onClick={(e) => { e.currentTarget.blur(); game.setPaused(true); setPaused(true); sfx('ui'); }}
            >
              <svg viewBox="0 0 10 10" className="h-3 w-3" aria-hidden><rect x="1.5" y="1" width="2.4" height="8" rx="0.5" fill="currentColor" /><rect x="6.1" y="1" width="2.4" height="8" rx="0.5" fill="currentColor" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Round / KO banners */}
      {banner && (
        <div key={banner.k} className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          {banner.text === 'WASTED' && <div className="anim-rise absolute inset-x-0 top-1/2 h-[30%] -translate-y-1/2 bg-gradient-to-r from-transparent via-black/75 to-transparent" />}
          <div className="display anim-banner relative text-7xl sm:text-9xl" style={{ ['--dur' as string]: `${banner.dur}s`, color: banner.tone === 'red' ? '#ff5a52' : banner.tone === 'white' ? '#fff' : '#ffe6a3', textShadow: '0 6px 0 #000, 0 0 40px rgb(0 0 0 / .6)' }}>
            {banner.text}
          </div>
          {banner.sub && <div className="anim-rise mono relative rounded bg-black/70 px-3 py-1 text-xs tracking-widest text-white/90 sm:text-sm">{banner.sub}</div>}
        </div>
      )}

      {/* The line being said, with its source */}
      {quote && !cine && <SpeechBubble key={quote.k} q={quote} info={infos[quote.side]} />}

      {/* Tag banter */}
      {chats.map((c) => (
        <div key={c.k} data-chat={`${c.side}-${c.who}`} className="bubble absolute" style={{ left: '50%', top: '40%', visibility: 'hidden' }}>
          <div className="anim-pop relative max-w-[min(18rem,70vw)] rounded-[1.2rem] border-[3px] border-black bg-[#fff8e6] px-3.5 pb-2 pt-1.5 text-black shadow-[4px_4px_0_#000]">
            <div className="flex items-center gap-2">
              <span className="display rounded-sm bg-black px-1.5 py-0.5 text-[10px] tracking-wider text-[#ffe6a3]">BANTER</span>
              <span className="mono truncate text-[10px] tracking-widest text-black/55">{c.name.toUpperCase()}</span>
            </div>
            <div className="mt-1 text-base font-bold leading-snug sm:text-lg">{c.text}</div>
            <Tail fill="#fff8e6" />
          </div>
        </div>
      ))}

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
            <div key={k} data-hud={`bubble${k}`} className="bubble absolute" style={{ visibility: 'hidden' }}>
              <div className="anim-pop relative max-w-[16rem] rounded-2xl border-[3px] border-black bg-white px-3 py-2 text-center text-sm font-bold leading-tight text-black shadow-[4px_4px_0_#000] sm:text-base">
                {sp.beats[k].text}
                <Tail fill="#fff" />
              </div>
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
              <div
                className="stamp anim-slam whitespace-nowrap text-[#ff5a52]"
                style={{ textShadow: '0 6px 0 #000', background: 'rgb(0 0 0 / .25)', fontSize: `min(8rem, ${(170 / Math.max(12, (sp.beats[cine.stamp]?.text ?? "").length)).toFixed(2)}vw)` }}
              >
                {sp.beats[cine.stamp].text}
              </div>
            </div>
          )}
        </>
      )}

      {/* Lower third: live crawl and the controls */}
      <div className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${cinema ? 'opacity-0' : ''}`}>
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
          <span><K>Space</K> dodge</span>
          <span><K>Enter</K> Super (gold mark, once a round)</span>
          <span><K>U</K> tag sidekick (low cardio)</span>
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

const MAX_HEALTH = Math.max(...ROSTER.map((f) => f.stats.health));

function Side({ i, info, tag, health }: { i: 0 | 1; info: FighterInfo; tag: Tag; health: number }) {
  const right = i === 1;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${right ? 'items-end' : 'items-start'}`}>
      <div className={`flex w-full items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="display truncate text-xl leading-none text-white drop-shadow-[0_2px_0_#000] sm:text-3xl">{tag ? info.sidekick.name : info.name}</span>
        <span className="mono hidden truncate text-[10px] tracking-[0.18em] text-[#e3b95a] sm:inline">
          {tag ? `SIDEKICK FOR ${info.name.toUpperCase()}` : `${info.title.toUpperCase()}${i === 1 ? ' · CPU' : ''}`}
        </span>
        <span data-hud={`wins${i}`} className={`flex gap-1 ${right ? 'mr-auto' : 'ml-auto'}`}>
          {[0, 1].map((k) => <span key={k} className="h-3 w-3 rotate-45 border border-[#e3b95a] data-[on=true]:bg-[#ffe6a3]" />)}
        </span>
      </div>
      {/* Health */}
      {/* Longer bar = more health: the toughest fighter's fills the side, the rest are shorter, anchored at the timer. */}
      <div className="h-5 w-full skew-x-[-14deg] border-2 border-black bg-[#2a0e10] shadow-[0_0_0_1px_#e3b95a] sm:h-7"
        style={{ transform: `skewX(${right ? 14 : -14}deg)`, width: `${Math.min(100, (health / MAX_HEALTH) * 100).toFixed(1)}%`, alignSelf: right ? 'flex-start' : 'flex-end' }}>
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
      <div className={`flex w-[70%] items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <div className="h-1.5 flex-1 border border-black bg-black/60"><div className={`bar ${right ? 'flip' : ''}`}><div data-hud={`cardio${i}`} className="fill bg-[#7fd3ff]" /></div></div>
        <span data-hud={`clabel${i}`} className="mono hud-tier shrink-0 text-[8px] tracking-[0.16em] text-white/50 sm:text-[9px]">CARDIO</span>
      </div>
      {/* Signature cooldown */}
      <div className={`flex w-[70%] items-center gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <div className="h-1.5 flex-1 border border-black bg-black/60"><div className={`bar ${right ? 'flip' : ''}`}><div data-hud={`sigcd${i}`} className="fill bg-[#ffb347]" /></div></div>
        <span data-hud={`slabel${i}`} className="mono hud-tier shrink-0 text-[8px] tracking-[0.16em] text-white/50 sm:text-[9px]">MOVES READY</span>
      </div>
      {/* Sidekick on stage: time left and the hits it can still take */}
      <div className={`flex w-[70%] items-center gap-2 ${right ? 'flex-row-reverse' : ''} ${tag ? '' : 'invisible'}`}>
        <div className="h-1 flex-1 bg-black/60"><div className={`bar ${right ? 'flip' : ''}`}><div data-hud={`sktime${i}`} className="fill bg-[#ffe6a3]" /></div></div>
        <span className="flex gap-1">
          {Array.from({ length: SIDEKICK_HITS }, (_, k) => (
            <span key={k} className={`h-2 w-2 rounded-full border border-[#ff8f6b] ${tag && k < tag.hits ? 'bg-[#ff5a52]' : 'bg-transparent'}`} />
          ))}
        </span>
        <span className="mono text-[8px] tracking-[0.16em] text-[#ff8f6b]">SCANDAL</span>
      </div>
    </div>
  );
}

/** A comic speech bubble beside the speaker's head: who is talking, which move it is, the real line and its source. */
function SpeechBubble({ q, info }: { q: NonNullable<Quote>; info: FighterInfo }) {
  const speaker = q.sig.line?.speaker ?? info.name;
  const kind = q.policy ? 'POLICY MOVE' : 'SIGNATURE';
  return (
    <div data-hud="qbubble" data-side={q.side} className="bubble absolute" style={{ left: '50%', top: '40%', visibility: 'hidden' }}>
      <div className="anim-pop relative w-[min(22rem,70vw)] rounded-[1.4rem] border-[3px] border-black bg-white px-4 pb-3 pt-2.5 text-black shadow-[5px_5px_0_#000]">
        <div className="flex items-center gap-2">
          <span className="display rounded-sm px-1.5 py-0.5 text-xs tracking-wider text-white" style={{ background: info.color }}>{kind}</span>
          <span className="display truncate text-base tracking-wide">{q.sig.name}</span>
          <span className="mono ml-auto truncate text-[10px] tracking-widest text-black/55">{speaker.toUpperCase()}</span>
        </div>
        {q.sig.post ? (
          <div className="mt-2 rounded-xl border border-black/15 bg-[#f7f9f9] p-2.5">
            <div className="flex items-center gap-2">
              <div className="display flex h-7 w-7 items-center justify-center rounded-full bg-black text-sm text-white">{info.name[0]}</div>
              <div className="text-sm font-bold leading-tight">{info.name} <span className="font-normal text-black/50">{q.sig.post.handle}</span></div>
            </div>
            <div className="mt-1.5 text-lg font-semibold leading-snug">{q.sig.post.text}</div>
          </div>
        ) : (
          <div className="mt-1.5 text-lg font-bold leading-snug sm:text-xl">&ldquo;{q.sig.line?.text}&rdquo;</div>
        )}
        <div className="mono mt-1.5 text-[9px] tracking-[0.18em] text-black/50">
          {q.sig.post ? 'REAL POST' : 'REAL QUOTE'} · {q.sig.post?.source ?? q.sig.line?.source}
        </div>
        <Tail fill="#fff" />
      </div>
    </div>
  );
}

/**
 * The bubble's tail, pointing at the speaker. Its direction comes from the bubble's data-tail (set each frame by the
 * placement): down when the bubble is above the head, left or right when it's beside it.
 */
function Tail({ fill }: { fill: string }) {
  return (
    <>
      <span className="tail tail-ink" />
      <span className="tail tail-fill" style={{ ['--fill' as string]: fill }} />
    </>
  );
}
