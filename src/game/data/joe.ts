import { FPS } from '../sim/constants';
import type { FighterInfo, SidekickInfo, SuperInfo } from './roster';

// Average Joe: the only fighter who isn't a billionaire. No Super, no signatures, no sidekick, and nothing they
// have works on him. Every Super aimed at him starts as normal, then he cuts it off with one line, a headline about
// the billionaire drops in, and the Super falls apart. See docs/average-joe.md.
//
// Joe's retorts and the billionaires' reactions are invented parody lines (written, not voiced). Each headline is a
// paraphrase of real, widely reported news, stamped with where and when; none is a quote from a real paper.

type BillionaireId = Exclude<FighterInfo['id'], 'joe'>;

export type Deflect = {
  /** Seconds into the billionaire's Super when Joe cuts it off (the record scratch). Always after a full line. */
  cut: number;
  /** Joe's one line. */
  retort: string;
  /** The newspaper that drops in: a paraphrased headline and its source stamp. */
  headline: { text: string; sub: string };
  /** What the billionaire says, or does, as it falls apart. */
  react: string;
  /** How the billionaire takes it. flee: runs off the stage. */
  mood: 'reel' | 'shrug' | 'flee';
  /** Floating words over the crowd while they react (optional). */
  chant?: string;
  stamp: string;
};

/** Seconds from the cut to the end of a deflection. */
export const DEFLECT_TAIL = 6.4;

export const DEFLECTS: Record<BillionaireId, Deflect> = {
  tusk: {
    cut: 3.0,
    retort: 'I sold my Tesla.',
    headline: { text: 'TESLA SALES SLUMP IN EUROPE AS BUYERS TURN AWAY', sub: 'EUROPEAN NEW-CAR REGISTRATIONS · 2025' },
    react: 'Why is nobody reposting this?',
    mood: 'shrug', stamp: 'RATIO\'D.',
  },
  teal: {
    // Cut right after the question: Joe answers it.
    cut: 3.6,
    retort: 'Yes. Humans should survive. That took me one second.',
    headline: { text: 'BILLIONAIRE LOOKS INTO YOUNG-BLOOD TRANSFUSIONS TO LIVE LONGER', sub: 'MAGAZINE INTERVIEW · 2015' },
    react: 'I would… I would…',
    mood: 'shrug', stamp: 'ANSWERED.',
  },
  bozo: {
    cut: 2.6,
    retort: 'My package came three days late.',
    headline: { text: 'COMPANY ADMITS DRIVERS HAVE HAD TO URINATE IN BOTTLES', sub: 'COMPANY APOLOGY TO A CONGRESSMAN · APR 2021' },
    react: 'Have you tried Prime?',
    mood: 'reel', stamp: 'RETURN TO SENDER.',
  },
  ultman: {
    cut: 3.6,
    retort: 'I asked your chatbot about you. It said you got fired.',
    headline: { text: 'BOARD OUSTS CEO: "NOT CONSISTENTLY CANDID"', sub: 'BOARD STATEMENT · NOV 2023' },
    react: 'That was five days. I came back.',
    mood: 'shrug', stamp: 'NOT CONSISTENTLY CANDID.',
  },
  carp: {
    cut: 4.9,
    retort: "I'm not an analyst. I'm not anybody. Nothing to target.",
    headline: { text: 'DATA FIRM WINS $30M CONTRACT TO TRACK IMMIGRANTS', sub: 'FEDERAL CONTRACT AWARD · APR 2025' },
    react: 'No data? On a normal person? Impossible.',
    mood: 'reel', stamp: 'NO DATA FOUND.',
  },
  jensen: {
    // The owner's example: the affair plays, then Joe isn't in the market to crash.
    cut: 4.6,
    retort: "I never put a dollar in the stock market. I don't trust any of you guys.",
    headline: { text: 'CHIPMAKER LOSES ~$490 BILLION AFTER CEO AFFAIR REPORTS', sub: 'MARKET CLOSE · NOV 2026' },
    react: 'You have to buy something. The more you…',
    mood: 'reel', stamp: 'NO POSITION.',
  },
  mork: {
    cut: 5.8,
    retort: 'Your headset cost more than my rent. I never bought one.',
    headline: { text: 'NEW VR HEADSET PRICED AT $1,499', sub: 'VR KEYNOTE · OCT 2022' },
    // The long-running "lizard" meme: he goes shy and runs off.
    react: "I'm a human. I drink water. Like you.",
    mood: 'flee', chant: 'LIZARD! LIZARD!', stamp: 'PRICED OUT.',
  },
};

export const deflectOf = (atk: FighterInfo) => (atk.id === 'joe' ? null : DEFLECTS[atk.id]);

/**
 * The Super as it plays against Joe: the billionaire's title card and real clip up to the cut, then the record
 * scratch, his line, the headline, the reaction and the stamp. Same shape as a SuperInfo so the overlay can play it.
 */
export function deflectedSuper(atk: FighterInfo): SuperInfo {
  const d = deflectOf(atk);
  const sp = atk.super;
  if (!d) return sp;
  const c = d.cut;
  return {
    ...sp,
    audio: sp.audio.filter((a) => a.at < c),
    subs: sp.subs.filter((s) => s.at < c).map((s) => ({ ...s, to: Math.min(s.to, c) })),
    seconds: c + DEFLECT_TAIL, hitAt: undefined, drain: undefined,
    beats: [
      { at: 0, kind: 'contact' },
      { at: 0.6, kind: 'title' },
      { at: c, kind: 'scratch' },
      { at: c + 0.2, kind: 'bubble', side: 'vic', text: d.retort },
      { at: c + 1.4, kind: 'headline', text: d.headline.text, sub: d.headline.sub },
      { at: c + 3.6, kind: 'bubble', side: 'atk', text: d.react },
      { at: c + 5.4, kind: 'stamp', text: d.stamp },
    ],
  };
}

/** The Super a side plays in this matchup: deflected if it's aimed at Joe. */
export const superFor = (infos: readonly [FighterInfo, FighterInfo], by: 0 | 1): SuperInfo =>
  infos[1 - by].everyman ? deflectedSuper(infos[by]) : infos[by].super;

export const deflectFrames = (atk: FighterInfo) => {
  const d = deflectOf(atk);
  return d ? Math.round((d.cut + DEFLECT_TAIL) * FPS) : 0;
};

/**
 * Every sidekick tagged in against Joe is a lame duck (half the tag, then out for the round), and Joe has a line for
 * each one. Invented parody lines riffing on public record:
 * - covfefe: the 2024 campaign promise to bring prices down "starting on day one".
 * - veep: the Aug 2024 donut-shop visit ("we're just here to buy some donuts").
 * - melania: the $40M documentary; the owner's line.
 * - pete: years co-hosting weekend morning TV before the Pentagon.
 * - lootnick: Mar 2025, said his mother-in-law wouldn't call if a Social Security check was late.
 * - wite: UFC moved off pay-per-view onto a streaming service in 2026.
 * None repeats a NEGATES line for the same sidekick's Policy Move.
 */
export type Counter = {
  /** Joe, as they walk in. */
  joe: string;
  /** The sidekick's comeback. */
  back: string;
  /** The ticker while it plays. */
  ticker: string;
  /** The banner when they leave for the round. */
  stamp: string;
};

export const COUNTERS: Record<SidekickInfo['model'], Counter> = {
  covfefe: {
    joe: 'You said prices come down on day one. It\'s day 670.',
    back: 'Prices are way down. Everybody\'s saying it.',
    ticker: 'Grocery prices still up since the day-one promise. Joe kept the receipt.',
    stamp: 'PROMISE PENDING',
  },
  veep: {
    joe: 'I\'m just here to buy some donuts.',
    back: 'Can we… not film this?',
    ticker: 'Donut-shop standoff, take two. Nobody asked for a speech.',
    stamp: 'NO DONUT',
  },
  melania: {
    joe: 'I don\'t watch reality shows.',
    back: 'It is a documentary. Forty million dollars.',
    ticker: 'Joe has not seen the documentary. Joe will not be seeing the documentary.',
    stamp: 'NOT STREAMING',
  },
  pete: {
    joe: 'Weren\'t you on weekend TV? I used to fall asleep to you.',
    back: 'Best job I ever had. Don\'t tell anyone.',
    ticker: 'Secretary recognised from weekend morning TV. Not from the job.',
    stamp: 'OFF THE AIR',
  },
  lootnick: {
    joe: 'My mom calls when her Social Security is late. Every time.',
    back: 'Only fraudsters call. Everybody knows that.',
    ticker: 'Commerce Secretary hears from an actual mother. She is very upset.',
    stamp: 'MOM CALLED',
  },
  wite: {
    joe: 'I\'m not buying another streaming app to watch you.',
    back: 'It\'s in the bundle, bro. Everything\'s in the bundle.',
    ticker: 'Joe cancels the free trial before it charges him.',
    stamp: 'UNSUBSCRIBED',
  },
};

/**
 * The blue wave, only for the MAGA move (Uncle Covfefe's "Make Tariffs Great Again"): on the record, Democrats won both
 * chambers in the 3 Nov 2026 midterms, and on 18 Nov 2026 Musk said at DealBook "I'm not sure what MAGA means." So the
 * wave washes in, the billionaire disowns him and he's voted out. Tusk's line is his real words (shown as banter until
 * the clip is cut); the rest riff on public record. Only Tusk and Ultman have Covfefe.
 */
export const DISOWN: Partial<Record<BillionaireId, string[]>> = {
  tusk: ["I'm not sure what MAGA means.", 'I felt pretty foolish about that $400 million.'],
  ultman: ['I gave a million to the inauguration. Can I get a refund?', 'I am deeply non-partisan. Please disregard the dinner.'],
};

/** The politician arriving as a lame duck. */
export const LAME_DUCK = [
  'Wait. We lost the House?',
  'Is this still my seat?',
  'Lame duck, reporting for duty.',
  'Recount. I demand a recount.',
];


/**
 * Joe negates every signature and Policy Move too: the line plays and the move lands, then he shrugs it off with one
 * line and takes no damage. Keyed by signature id (data/roster.ts). Invented parody lines; none repeats a Super retort.
 */
export const NEGATES: Record<string, string> = {
  // Space Karen Tusk
  heart: 'Keep your heart. Pay your taxes.',
  chainsaw: 'You cut the one office that answers my calls.',
  sink: "My sink's been broken since March.",
  // Antichrist Teal
  losers: "Cool. I shop wherever's cheapest.",
  lecture: 'I clocked out ten minutes ago.',
  pause: "I'll wait. I'm on hold with the bank anyway.",
  // Prime Bozo
  paid: 'Then I want a refund.',
  dayone: 'Every day is day one on a paycheck.',
  guarantee: "I can't guarantee I read the terms either.",
  // Hype-Man Sam
  wrong: 'It already went wrong. Have you seen my feed?',
  end: "Then why'd you build it?",
  ads: "I've got an ad blocker.",
  // Drone Carp
  occasion: "Scare me? I've seen my rent.",
  poorer: "Can't make me poorer. Others got there first.",
  earnings: "My 401(k) isn't crushing it.",
  // Jacket Jensen
  gpus: 'The more I buy, the less I eat.',
  ceomath: "My math says I'm short on rent.",
  pain: "Already got it. It's called Monday.",
  // Lizard Mork
  runads: "Not to me. I don't have an account.",
  energy: "I wash my own dishes. That's my energy.",
  ribs: "Sweet Baby Ray's is eight bucks now.",
  // Policy Moves
  tariff: "Great again? I'd settle for affordable again.",
  cats: 'My cat-lady neighbour votes. Every time.',
  poster: "I'll wait till it's free on TV.",
  chat: "I'm not in the group chat.",
  export: "My phone's fourth best too. Still works.",
  octagon: 'Nine to six? Cute. Try a double shift.',
};
