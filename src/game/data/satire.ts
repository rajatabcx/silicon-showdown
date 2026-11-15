// News ticker lines and end-of-match headlines. {w} = winner, {l} = loser, {s} = sidekick.

export const TICKER = {
  idle: [
    'BREAKING: Nothing has happened yet. Analysts call it "priced in".',
    'Reminder: this is satire. None of this is news.',
    'Senator asks whether the fight is "on the cloud".',
    'Crowd vendor reports record sales of overpriced matcha.',
    'LinkedIn user is "humbled to announce" he is watching this.',
    'Markets open flat ahead of scheduled punching.',
  ],
  hit: [
    '{l} takes a hit, blames the media.',
    'Analysts downgrade {l} to "ouch".',
    '{w} calls that punch "a 10x improvement".',
    '{l} says the bruise is a feature, not a bug.',
  ],
  combo: [
    'COMBO! {w} is scaling faster than expected.',
    '{l} enters "founder mode" (lying down).',
    '{w} ships three hits before the standup ends.',
  ],
  winded: [
    '{l} is out of breath. Wellness coach "deeply concerned".',
    '{l} pauses to "circle back" on breathing.',
  ],
  tagIn: [
    '{s} enters the ring. Donation records unavailable for comment.',
    'Sidekick {s} tags in: "This is totally unrelated to the funding."',
  ],
  scandal: [
    'SCANDAL: {s} knocked out. Donor {l} "barely knows him".',
    'DONOR EXPOSED: {l} loses 10 after {s} goes down.',
  ],
  super: [
    '{w} uses a Super. Valuation up 30%.',
    'Regulators "monitoring the situation" after {w} Super.',
  ],
  ko: [
    '{l} K.O. Shareholders asked to remain calm.',
    '{l} is down. Stock is, somehow, up.',
  ],
};

export const PAPERS = ['THE DAILY GRIFT', 'THE VALUATION TIMES', 'BREAKING BUBBLE', 'TECHCRUNCHED'];

export const HEADLINES = {
  win: [
    '{w} CRUSHES {l}; SHARES UP 9%',
    '{l} "PIVOTS TO LOSING" AFTER MEETING {w}',
    '{w} WINS, THANKS "THE CUSTOMERS WHO PAID FOR THIS"',
    '{l} HOSPITALISED; SAYS IT WAS "A LEARNING"',
  ],
  lose: [
    '{w} BEATS LOCAL PLAYER; MARKETS UNSURPRISED',
    'YOU LOST TO {w}. INVESTORS REQUEST A REMATCH',
    '{w} ACQUIRES YOUR DIGNITY IN ALL-CASH DEAL',
  ],
  sub: [
    'Sidekicks deny any connection to the funding.',
    'Experts agree nobody involved has ever done cardio.',
    'Fact-checkers confirm: this did not happen. It is a game.',
    'Analysts raise price target anyway.',
  ],
};

export const fill = (s: string, v: { w?: string; l?: string; s?: string }) =>
  s.replace('{w}', v.w ?? '').replace('{l}', v.l ?? '').replace('{s}', v.s ?? '');
export const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
