import { FPS, SIG_WINDUP } from '../sim/constants';
import type { SigDef, SimDef } from '../sim/types';

// Every fighter is a parody. Real names never appear in game data.
// Lines are short clips of the real person saying them; see docs/quotes.md for where each comes from.

export type VoiceId =
  | 'tusk_heart' | 'tusk_chainsaw' | 'tusk_chainsaw_yell' | 'tusk_blackmail' | 'tusk_gfy' | 'tusk_omg' | 'tusk_too_hard'
  | 'tusk_plus_side' | 'tusk_empathy' | 'tusk_next_year'
  | 'teal_hesitation' | 'teal_long_hes' | 'teal_losers' | 'teal_how_much_time' | 'teal_long_time' | 'teal_greta'
  | 'teal_armageddon' | 'teal_monopoly'
  | 'covfefe_maga' | 'veep_cat_ladies'
  | 'bozo_paid_short' | 'bozo_always_day_one' | 'bozo_cant_guarantee' | 'bozo_laugh' | 'bozo_best_day' | 'bozo_optimistic'
  | 'ultman_quite_wrong' | 'ultman_end_short' | 'ultman_last_resort' | 'ultman_agi_here' | 'ultman_this_era' | 'melania_here_we_go' | 'melania_here_it_is';

/** Seconds of each clip, from public/audio/voice/manifest.json. */
export const VOICE_SECONDS: Record<VoiceId, number> = {
  tusk_heart: 1.66, tusk_chainsaw: 3.82, tusk_chainsaw_yell: 1.3, tusk_blackmail: 5.46, tusk_gfy: 4.16, tusk_omg: 2.14,
  tusk_too_hard: 3.36, tusk_plus_side: 2.5, tusk_empathy: 5.28, tusk_next_year: 3.28,
  teal_hesitation: 11.4, teal_long_hes: 1.64, teal_losers: 1.48, teal_how_much_time: 1.08, teal_long_time: 2.14,
  teal_greta: 3.96, teal_armageddon: 5.68, teal_monopoly: 10.18,
  covfefe_maga: 4.8, veep_cat_ladies: 3.26,
  bozo_paid_short: 1.7, bozo_always_day_one: 4.82, bozo_cant_guarantee: 4.6, bozo_laugh: 4.01, bozo_best_day: 1.64, bozo_optimistic: 3.58,
  ultman_quite_wrong: 3.14, ultman_end_short: 4.58, ultman_last_resort: 3.2, ultman_agi_here: 11.92, ultman_this_era: 2.94, melania_here_we_go: 2.22, melania_here_it_is: 3.8,
};

/** On-screen source stamps. Venue and date only; no names of real people. */
export const SOURCES = {
  rally: 'INAUGURATION RALLY · JAN 2025',
  cpac: 'CPAC STAGE · FEB 2025',
  dealbook: 'DEALBOOK SUMMIT · NOV 2023',
  unveil: 'PICKUP TRUCK UNVEILING · NOV 2019',
  post: 'POST ON X · OCT 2022',
  podcast: 'NYT PODCAST INTERVIEW · JUN 2025',
  stanford: 'STANFORD LECTURE · 2014',
  inaugural: 'INAUGURAL ADDRESS · JAN 2017',
  cable: 'CABLE NEWS INTERVIEW · JUL 2021',
  presser: 'SPACE FLIGHT PRESS CONFERENCE · JUL 2021',
  landing: 'SPACE FLIGHT LANDING · JUL 2021',
  allHands: 'COMPANY ALL-HANDS Q&A · 2017',
  antitrust: 'HOUSE ANTITRUST HEARING · JUL 2020',
  senate: 'SENATE TESTIMONY · MAY 2023',
  talk2015: 'TECH CONFERENCE TALK · 2015',
  harvard: 'UNIVERSITY FIRESIDE CHAT · MAY 2024',
  stargate: 'WHITE HOUSE ANNOUNCEMENT · JAN 2025',
  trailer: 'DOCUMENTARY TRAILER · 2025',
} as const;

/** A line as said in the game: one or more clips back to back, the subtitle, and its source. */
export type Line = { clips: VoiceId[]; text: string; source: string; speaker?: string };
/** A line the person only ever typed: shown as a post card, not voiced. */
export type Post = { text: string; source: string; handle: string };

export type SigInfo = {
  name: string;
  /** What the fighter says as the move starts (it keeps playing over the move). Either voiced or a post card. */
  line?: Line; post?: Post;
  /** Plays when the move connects. */
  bark?: VoiceId;
  /** The 3D prop the move uses. */
  prop?: 'sink' | 'chainsaw' | 'gate' | 'pages' | 'box' | 'error' | 'end' | 'ads' | null;
  sim: Omit<SigDef, 'quote'> & { quote?: number };
};

export type Beat = { at: number; kind: string; text?: string; sub?: string; side?: 'atk' | 'vic' };

export type SuperInfo = {
  name: string; tag: string;
  /** Clips that run under the whole Super, with the second each starts. */
  audio: { clip: VoiceId; at: number }[];
  /** Subtitles of the real clip. */
  subs: { at: number; to: number; text: string; speaker?: string }[];
  source: string;
  seconds: number; hitAt?: number; drain?: [number, number];
  beats: Beat[];
};

/** The funded politician who tags in when the billionaire runs out of cardio. Parody name; no voice clips yet. */
export type SidekickInfo = {
  name: string; title: string;
  /** Rigged model (same skeleton as the billionaires) and its scale. */
  model: 'covfefe' | 'veep' | 'melania'; height: number;
  walk: number;
  tagLine: string;
  /** A real clip the sidekick says as it tags in (optional). */
  tagVoice?: VoiceId;
  /**
   * Text-only banter at the tag (no voice). Invented parody lines, shown as BANTER, never as a quote; each one only
   * riffs on something public (subsidies, tax returns, campaign funding, missed deadlines).
   * out: the billionaire leaving. in: the sidekick arriving. back: the sidekick leaving. scandal: benched.
   */
  banter: { out: string[]; in: string[]; back: string[]; scandal: string[] };
  /** The one Policy Move per tag: a real clip, then the move. Nobody can interrupt it (see match.ts inPolicy). */
  policy: { name: string; clips: VoiceId[]; text: string; source: string; prop: 'tariff' | 'cats' | 'poster'; sim: Omit<SigDef, 'quote'> };
};

export type FighterInfo = {
  id: 'tusk' | 'teal' | 'bozo' | 'ultman';
  name: string; title: string; color: string; accent: string;
  model: string; height: number;
  sigs: [SigInfo, SigInfo, SigInfo];
  super: SuperInfo;
  barks: { heavy?: VoiceId; block?: VoiceId; taunt?: VoiceId; winded?: VoiceId; intro?: VoiceId };
  ego: SimDef['ego'];
  egoNote: string;
  sidekick: SidekickInfo;
  stats: { walk: number; jump: number; fitness: number };
  win: string;
};

/** How long a line stays on screen, in seconds: its clips back to back, or long enough to read a post card. */
export const lineSeconds = (l?: Line, p?: Post) => (l ? l.clips.reduce((s, c) => s + VOICE_SECONDS[c], 0) : p ? 2.2 : 0.5);
const lineFrames = (l?: Line, p?: Post) => Math.round(lineSeconds(l, p) * FPS) + 6;

export const TUSK: FighterInfo = {
  id: 'tusk', name: 'Melon Tusk', title: 'Chief Posting Officer', color: '#e5484d', accent: '#ff9b6a',
  model: '/models/characters/tusk.glb', height: 1.0,
  ego: 'needy', egoNote: 'Needy: Engagement drains twice as fast when he goes quiet.',
  stats: { walk: 2.2, jump: 7.4, fitness: 0.75 },
  win: 'Considering taking this fight private.',
  sigs: [
    {
      name: 'My Heart Goes Out',
      line: { clips: ['tusk_heart'], text: 'My heart goes out to you.', source: SOURCES.rally },
      prop: null,
      sim: { id: 'heart', kind: 'melee', startup: 10, active: 6, recovery: 24, damage: 11, range: 2.15, knockdown: true },
    },
    {
      name: 'Chainsaw for Bureaucracy',
      line: { clips: ['tusk_chainsaw'], text: 'This is the chainsaw for bureaucracy!', source: SOURCES.cpac },
      bark: 'tusk_chainsaw_yell', prop: 'chainsaw',
      sim: { id: 'chainsaw', kind: 'melee', startup: 12, active: 30, recovery: 24, damage: 4, hits: 3, range: 2.35, knockdown: true },
    },
    {
      name: 'Let That Sink In',
      post: { text: 'Entering Twitter HQ – let that sink in!', source: SOURCES.post, handle: '@melontusk' },
      prop: 'sink',
      sim: { id: 'sink', kind: 'projectile', startup: 14, active: 2, recovery: 22, damage: 11, range: 6, knockdown: true, speed: 0.17 },
    },
  ],
  super: {
    name: 'FUNDING SECURED', tag: 'SUPER',
    audio: [{ clip: 'tusk_blackmail', at: 0.6 }, { clip: 'tusk_gfy', at: 6.2 }],
    subs: [
      { at: 0.6, to: 3.0, text: "If somebody's going to try to blackmail me with advertising," },
      { at: 3.0, to: 5.3, text: 'blackmail me with money,' },
      { at: 5.3, to: 6.1, text: 'go f— yourself.' },
      { at: 6.2, to: 8.6, text: 'Go f— yourself.' },
      { at: 8.9, to: 10.4, text: 'Is that clear?' },
    ],
    source: SOURCES.dealbook,
    seconds: 10.6, hitAt: 7.5,
    beats: [
      { at: 0, kind: 'contact' },
      { at: 0.6, kind: 'title' },
      { at: 2.4, kind: 'prop', sub: 'POST ON X · AUG 2018', text: 'Am considering taking Tesla private at $420. Funding secured.' },
      { at: 2.9, kind: 'bubble', side: 'atk', text: 'Considering taking this fight private.' },
      { at: 4.4, kind: 'insert', text: '$420' },
      { at: 5.4, kind: 'payoff', text: 'TO THE MOON' },
      { at: 7.5, kind: 'impact' },
      { at: 8.0, kind: 'bubble', side: 'vic', text: 'Wait, is the funding actually secured?!' },
      { at: 9.3, kind: 'stamp', text: 'SEC SETTLEMENT!' },
    ],
  },
  barks: { heavy: 'tusk_too_hard', block: 'tusk_plus_side', taunt: 'tusk_empathy' },
  sidekick: {
    name: 'Uncle Covfefe', title: 'Funded Politician',
    model: 'covfefe', height: 1.0,
    walk: 1.7,
    tagLine: 'DONOR NEEDS A BREATHER',
    banter: {
      out: [
        'Bringing in the big daddy. Now you will see.',
        'Back in a minute. Robotaxi minutes.',
        'I paid for this seat. Get in there.',
        'Taking a break. Government subsidized, obviously.',
      ],
      in: [
        "Daddy's home.",
        "I'll hide him like I hide my tax returns.",
        'Tremendous donor. The best donor. Very tired.',
        'Nobody does tariffs better than me. Nobody.',
      ],
      back: ['I have a tee time.', 'Total success. Many people are saying.'],
      scandal: ['Witch hunt! Total witch hunt!', 'I barely know the man.'],
    },
    policy: {
      name: 'Make Tariffs Great Again', prop: 'tariff', source: SOURCES.inaugural, clips: ['covfefe_maga'],
      text: 'Together, we will make America great again.',
      sim: { id: 'tariff', kind: 'drop', startup: 22, active: 2, recovery: 28, damage: 10, range: 4.5, knockdown: true },
    },
  },
};

export const TEAL: FighterInfo = {
  id: 'teal', name: 'Peter Teal', title: 'Contrarian-in-Chief', color: '#3e8ed0', accent: '#8fd3ff',
  model: '/models/characters/teal.glb', height: 1.04,
  ego: 'contrarian', egoNote: 'Contrarian: Engagement fills while he is losing and drains while he is ahead.',
  stats: { walk: 2.0, jump: 7.0, fitness: 0.85 },
  win: 'Competition is for losers.',
  sigs: [
    {
      name: 'Monopoly',
      line: { clips: ['teal_losers'], text: 'Competition is for losers.', source: SOURCES.stanford },
      prop: 'gate',
      sim: { id: 'losers', kind: 'drop', startup: 22, active: 2, recovery: 26, damage: 12, range: 4.2, knockdown: true },
    },
    {
      name: 'The Lecture',
      line: { clips: ['teal_how_much_time', 'teal_long_time'], text: 'How much time do we have? … I could talk about it for a long time.', source: SOURCES.podcast },
      prop: 'pages',
      sim: { id: 'lecture', kind: 'projectile', startup: 12, active: 26, recovery: 20, damage: 4, hits: 3, range: 7, speed: 0.18 },
    },
    {
      name: 'The Long Pause',
      line: { clips: ['teal_long_hes'], text: 'This is a long hesitation.', source: SOURCES.podcast, speaker: 'INTERVIEWER' },
      prop: null,
      // The pause is the wind-up (a long silence with a typing bubble), then the elbow.
      sim: { id: 'pause', kind: 'melee', quote: 66, startup: 8, active: 5, recovery: 24, damage: 11, range: 2, knockdown: true },
    },
  ],
  super: {
    name: 'THE HESITATION', tag: 'SUPER',
    audio: [{ clip: 'teal_hesitation', at: 0.6 }],
    subs: [
      { at: 0.6, to: 3.6, text: 'You would prefer the human race to endure, right?', speaker: 'INTERVIEWER' },
      { at: 5.1, to: 6.6, text: "You're hesitating.", speaker: 'INTERVIEWER' },
      { at: 6.7, to: 8.4, text: "Yes? I don't know. I would…" },
      { at: 10.1, to: 11.4, text: 'I would…' },
    ],
    source: SOURCES.podcast,
    seconds: 12.6, drain: [3.6, 11.4],
    beats: [
      { at: 0, kind: 'contact' },
      { at: 0.6, kind: 'title' },
      { at: 2.0, kind: 'prop', text: 'THE QUESTION' },
      { at: 3.6, kind: 'insert' },
      { at: 5.6, kind: 'freeze' },
      { at: 6.4, kind: 'bubble', side: 'vic', text: "It's a yes or no question!" },
      { at: 11.4, kind: 'payoff' },
      { at: 11.6, kind: 'stamp', text: 'STILL THINKING.' },
    ],
  },
  barks: { taunt: 'teal_armageddon', intro: 'teal_losers' },
  sidekick: {
    name: 'Hillbilly Veep', title: 'Funded Politician',
    model: 'veep', height: 1.03,
    walk: 1.8,
    tagLine: 'DONOR NEEDS A BREATHER',
    banter: {
      out: [
        'I funded your Senate run. Earn it.',
        "Contrarian take: I'm not tired. Tag.",
        'My Roth IRA needs me. Tax-free, of course.',
        "Don't worry. I'll be watching. Professionally.",
      ],
      in: [
        'Fifteen million dollars says I go in now.',
        'I used to be a never-Covfefe guy. Now look at me.',
        'I wrote a whole book about grit.',
        'Donor speaks, I fight.',
      ],
      back: ['Back to the Senate. Wait, I left the Senate.', 'Mentor, the floor is yours.'],
      scandal: ['That was a joke. Obviously a joke.', 'I barely know the man.'],
    },
    policy: {
      name: 'Cat Lady Barrage', prop: 'cats', source: SOURCES.cable, clips: ['veep_cat_ladies'],
      text: '…by a bunch of childless cat ladies who are miserable at their own lives…',
      sim: { id: 'cats', kind: 'projectile', startup: 10, active: 26, recovery: 22, damage: 4, hits: 3, range: 7, speed: 0.14 },
    },
  },
};

export const BOZO: FighterInfo = {
  id: 'bozo', name: 'Jeff Bozo', title: 'Chief Customer Officer', color: '#f29a1d', accent: '#ffd27a',
  model: '/models/characters/jeffbozo.glb', height: 1.0,
  ego: 'customer', egoNote: 'Customer-obsessed: every hit he takes is feedback. Engagement rises a little when he gets hit.',
  stats: { walk: 2.1, jump: 7.2, fitness: 1.0 },
  win: 'You paid for this.',
  sigs: [
    {
      name: 'You Paid For This',
      line: { clips: ['bozo_paid_short'], text: '…because you guys paid for all this.', source: SOURCES.presser },
      prop: 'box',
      sim: { id: 'paid', kind: 'projectile', startup: 13, active: 2, recovery: 22, damage: 11, range: 6, knockdown: true, speed: 0.17 },
    },
    {
      name: 'Day One',
      line: { clips: ['bozo_always_day_one'], text: 'It is always… Day One.', source: SOURCES.allHands },
      prop: null,
      sim: { id: 'dayone', kind: 'melee', startup: 11, active: 5, recovery: 24, damage: 11, range: 2.1, knockdown: true },
    },
    {
      name: "Can't Guarantee",
      line: { clips: ['bozo_cant_guarantee'], text: "…but I can't guarantee you that that policy has never been violated.", source: SOURCES.antitrust },
      prop: null,
      sim: { id: 'guarantee', kind: 'melee', startup: 10, active: 24, recovery: 22, damage: 5, hits: 2, range: 2.1, knockdown: true },
    },
  ],
  super: {
    name: 'BEST DAY EVER', tag: 'SUPER',
    audio: [{ clip: 'bozo_laugh', at: 0.6 }, { clip: 'bozo_best_day', at: 7.7 }],
    subs: [
      { at: 0.6, to: 4.6, text: '(laughs)' },
      { at: 7.7, to: 9.4, text: 'Best day ever!' },
    ],
    source: SOURCES.landing,
    seconds: 10.2, hitAt: 7.0,
    beats: [
      { at: 0, kind: 'contact' },
      { at: 0.6, kind: 'title' },
      { at: 2.4, kind: 'prop' },
      { at: 4.6, kind: 'insert' },
      { at: 5.2, kind: 'bubble', side: 'vic', text: 'I did NOT order this!' },
      { at: 7.0, kind: 'impact' },
      { at: 8.0, kind: 'payoff' },
      { at: 9.0, kind: 'stamp', text: 'THANK YOU, CUSTOMERS.' },
    ],
  },
  barks: { taunt: 'bozo_optimistic' },
  sidekick: {
    name: 'Madame Producer', title: 'Funded Producer',
    model: 'melania', height: 1.03,
    walk: 1.8,
    tagLine: 'BUYER NEEDS A BREATHER',
    tagVoice: 'melania_here_we_go',
    banter: {
      out: [
        'Forty million for the rights. Earn them.',
        'Tag. Consider it a distribution deal.',
        'I bought the documentary. You do the fighting.',
        'Two-day shipping on my breath. Go.',
      ],
      in: [
        'Thirty-five million on marketing. For this?',
        'Executive producer. I produce. You watch.',
        'Forty million. I am worth it.',
        'Roll camera.',
      ],
      back: ["That's a wrap.", 'The sequel is not confirmed.'],
      scandal: ['No comment. Watch the documentary.', 'The box office was a success. In spirit.'],
    },
    policy: {
      name: '$40M Premiere', prop: 'poster', source: SOURCES.trailer, clips: ['melania_here_it_is'],
      text: 'Everyone wants to know. So, here it is.',
      sim: { id: 'poster', kind: 'drop', startup: 22, active: 2, recovery: 28, damage: 10, range: 4.5, knockdown: true },
    },
  },
};

export const ULTMAN: FighterInfo = {
  id: 'ultman', name: 'Sam Ultman', title: 'Chief Hype Officer', color: '#2fb58a', accent: '#9ff0cf',
  model: '/models/characters/sam.glb', height: 0.96,
  ego: 'hype', egoNote: 'Hype: his Engagement never drains. There is always another announcement.',
  stats: { walk: 2.2, jump: 7.3, fitness: 0.9 },
  win: 'The most important fight of this era.',
  sigs: [
    {
      name: 'Quite Wrong',
      line: { clips: ['ultman_quite_wrong'], text: 'If this technology goes wrong, it can go quite wrong.', source: SOURCES.senate },
      prop: 'error',
      sim: { id: 'wrong', kind: 'projectile', startup: 12, active: 14, recovery: 20, damage: 6, hits: 2, range: 7, speed: 0.19 },
    },
    {
      name: 'End of the World',
      line: { clips: ['ultman_end_short'], text: 'I think AI will probably, like, most likely, sort of lead to the end of the world.', source: SOURCES.talk2015 },
      prop: 'end',
      sim: { id: 'end', kind: 'drop', startup: 22, active: 2, recovery: 26, damage: 12, range: 4.5, knockdown: true },
    },
    {
      name: 'Last Resort',
      line: { clips: ['ultman_last_resort'], text: 'I kind of think of ads as, like, a last resort for us for a business model.', source: SOURCES.harvard },
      prop: 'ads',
      sim: { id: 'ads', kind: 'melee', startup: 10, active: 24, recovery: 22, damage: 5, hits: 2, range: 2.1, knockdown: true },
    },
  ],
  super: {
    name: 'WITHOUT YOU, MR. PRESIDENT', tag: 'SUPER',
    audio: [{ clip: 'ultman_agi_here', at: 0.6 }],
    subs: [
      { at: 0.6, to: 3.6, text: 'I think this will be the most important project of this era,' },
      { at: 3.6, to: 5.6, text: 'and as Masa said, for AGI to get built here,' },
      { at: 5.6, to: 7.8, text: 'to create hundreds of thousands of jobs,' },
      { at: 7.8, to: 10.1, text: 'to create a new industry centered here.' },
      { at: 10.3, to: 12.6, text: "We wouldn't be able to do this without you, Mr. President." },
    ],
    source: SOURCES.stargate,
    seconds: 13.8, drain: [3.6, 11.6],
    beats: [
      { at: 0, kind: 'contact' },
      { at: 0.6, kind: 'title' },
      { at: 2.4, kind: 'prop', text: '$500,000,000,000' },
      { at: 3.6, kind: 'insert' },
      { at: 7.6, kind: 'bubble', side: 'vic', text: 'Is he still talking?' },
      { at: 11.6, kind: 'payoff' },
      { at: 12.4, kind: 'stamp', text: 'FUNDING ANNOUNCED.' },
    ],
  },
  barks: { taunt: 'ultman_this_era' },
  sidekick: {
    ...TUSK.sidekick,
    // Same daddy as Melon Tusk; the banter is his own.
    banter: {
      out: [
        'Daddy, please. I gave a million to the inauguration.',
        'Tag. Same daddy as Melon.',
        'Superintelligence can wait. You go.',
        'I would like to announce a tag.',
      ],
      in: [
        "Sam! Tremendous guy. I barely know him.",
        'Two of my billionaires. Same week!',
        'Nobody tags better than me. Nobody.',
        "I'll build the data centers. Huge ones.",
      ],
      back: ['I have a tee time.', 'Total success. Many people are saying.'],
      scandal: ['Witch hunt! Total witch hunt!', 'I barely know the man.'],
    },
  },
};

export const ROSTER = [TUSK, TEAL, BOZO, ULTMAN] as const;

export function simDef(f: FighterInfo): SimDef {
  // A signature goes after a short wind-up; the rest of its line plays over the move. A Policy Move (once per tag)
  // keeps its whole line first.
  const sigs = f.sigs.map((s) => ({ ...s.sim, quote: s.sim.quote ?? Math.min(SIG_WINDUP, lineFrames(s.line, s.post)) })) as SimDef['sigs'];
  const sp = f.super;
  return {
    ...f.stats, ego: f.ego, sigs,
    sidekick: { walk: f.sidekick.walk, policy: { ...f.sidekick.policy.sim, quote: lineFrames({ clips: f.sidekick.policy.clips, text: '', source: '' }) } },
    super: {
      frames: Math.round(sp.seconds * FPS), hitAt: Math.round((sp.hitAt ?? 0) * FPS),
      drain: sp.drain ? [Math.round(sp.drain[0] * FPS), Math.round(sp.drain[1] * FPS)] : undefined,
    },
  };
}

/** Display info for signature k (3 = the sidekick's Policy Move). */
export function sigInfo(f: FighterInfo, k: number): SigInfo {
  if (k !== 3) return f.sigs[k];
  const p = f.sidekick.policy;
  return {
    name: p.name, line: { clips: p.clips, text: p.text, source: p.source, speaker: f.sidekick.name },
    prop: null, sim: p.sim,
  };
}
