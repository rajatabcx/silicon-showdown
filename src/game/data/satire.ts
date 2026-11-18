// Lower-third crawl lines and end-of-match headlines. {w} = winner / actor, {l} = loser / target.
// These are the game's own jokes, not claims about anyone: they comment on the fight, not on real life.

export const TICKER = {
  idle: [
    'LIVE: Committee hearing on extremely online billionaires enters its ninth hour.',
    'Reminder: this is satire. Every quote is real; nothing else here is news.',
    'Senator asks whether the fight is "on the cloud".',
    'Gallery reminded that cheering is not permitted. Gallery cheers.',
    'Chair notes the witnesses have declined to sit at the witness table.',
  ],
  hit: [
    '{l} takes a hit, blames the media.',
    'Analysts downgrade {l} to "ouch".',
    '{w} calls that punch "a 10x improvement".',
    '{l} says the bruise is a feature, not a bug.',
  ],
  combo: [
    '{w} lands three in a row. Senators check their notes.',
    '{l} enters "founder mode" (lying down).',
  ],
  super: [
    '{w} uses a Super. Committee "deeply concerned".',
    'Regulators "monitoring the situation" after {w} Super.',
  ],
  ko: [
    '{l} is down. Shareholders asked to remain calm.',
    '{l} is down. Stock is, somehow, up.',
  ],
};

export const PAPERS = ['THE DAILY HEARING', 'THE VALUATION TIMES', 'THE CONGRESSIONAL RECORDER'];

export const HEADLINES = {
  win: [
    '{w} WINS HEARING; {l} "STILL THINKING"',
    '{l} "PIVOTS TO LOSING" AFTER MEETING {w}',
    '{w} WINS, THANKS "THE CUSTOMERS WHO PAID FOR THIS"',
    '{l} CALLS DEFEAT "A LEARNING"',
  ],
  lose: [
    '{w} BEATS LOCAL PLAYER; MARKETS UNSURPRISED',
    'YOU LOST TO {w}. INVESTORS REQUEST A REMATCH',
    '{w} ACQUIRES YOUR DIGNITY IN ALL-CASH DEAL',
  ],
  sub: [
    'Committee adjourns; nobody answered the question.',
    'Experts agree nobody involved has ever done cardio.',
    'Every line spoken in the fight was real. The fight was not.',
    'Analysts raise price target anyway.',
  ],
};

export const fill = (s: string, v: { w?: string; l?: string }) => s.replaceAll('{w}', v.w ?? '').replaceAll('{l}', v.l ?? '');
export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
