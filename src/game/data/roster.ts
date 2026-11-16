import { FPS } from '../sim/constants';
import type { SigDef, SimDef } from '../sim/types';

// Every fighter is a parody. Real names never appear in game data.
// Lines are short clips of the real person saying them; see docs/quotes.md for where each comes from.

export type VoiceId =
  | 'tusk_heart' | 'tusk_chainsaw' | 'tusk_chainsaw_yell' | 'tusk_blackmail' | 'tusk_gfy' | 'tusk_omg' | 'tusk_too_hard'
  | 'tusk_plus_side' | 'tusk_empathy' | 'tusk_next_year'
  | 'teal_hesitation' | 'teal_long_hes' | 'teal_losers' | 'teal_how_much_time' | 'teal_long_time' | 'teal_greta'
  | 'teal_armageddon' | 'teal_monopoly'
  | 'covfefe_maga' | 'veep_cat_ladies';

/** Seconds of each clip, from public/audio/voice/manifest.json. */
export const VOICE_SECONDS: Record<VoiceId, number> = {
  tusk_heart: 1.66, tusk_chainsaw: 3.82, tusk_chainsaw_yell: 1.3, tusk_blackmail: 5.46, tusk_gfy: 4.16, tusk_omg: 2.14,
  tusk_too_hard: 3.36, tusk_plus_side: 2.5, tusk_empathy: 5.28, tusk_next_year: 3.28,
  teal_hesitation: 11.4, teal_long_hes: 1.64, teal_losers: 1.48, teal_how_much_time: 1.08, teal_long_time: 2.14,
  teal_greta: 3.96, teal_armageddon: 5.68, teal_monopoly: 10.18,
  covfefe_maga: 4.8, veep_cat_ladies: 3.26,
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
} as const;

/** A line as said in the game: one or more clips back to back, the subtitle, and its source. */
export type Line = { clips: VoiceId[]; text: string; source: string; speaker?: string };
/** A line the person only ever typed: shown as a post card, not voiced. */
export type Post = { text: string; source: string; handle: string };

export type SigInfo = {
  name: string;
  /** What the fighter says before the move. Either voiced or a post card. */
  line?: Line; post?: Post;
  /** Plays when the move connects. */
  bark?: VoiceId;
  /** The 3D prop the move uses. */
  prop?: 'sink' | 'chainsaw' | 'gate' | 'pages' | null;
  sim: Omit<SigDef, 'quote'> & { quote?: number };
  /** Note slapped on the move when it's Fact-Checked. */
  context: string;
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
  model: 'covfefe' | 'veep'; height: number;
  walk: number;
  tagLine: string;
  /**
   * Text-only banter at the tag (no voice). Invented parody lines, shown as BANTER, never as a quote; each one only
   * riffs on something public (subsidies, tax returns, campaign funding, missed deadlines).
   * out: the billionaire leaving. in: the sidekick arriving. back: the sidekick leaving. scandal: benched.
   */
  banter: { out: string[]; in: string[]; back: string[]; scandal: string[] };
  /** The one Policy Move per tag: a real clip, then the move. Nobody can interrupt it (see match.ts inPolicy). */
  policy: { name: string; clips: VoiceId[]; text: string; source: string; prop: 'tariff' | 'cats'; sim: Omit<SigDef, 'quote'> };
};

export type FighterInfo = {
  id: 'tusk' | 'teal';
  name: string; title: string; color: string; accent: string;
  model: string; height: number;
  sigs: [SigInfo, SigInfo, SigInfo];
  super: SuperInfo;
  barks: { heavy?: VoiceId; block?: VoiceId; checked?: VoiceId; taunt?: VoiceId; winded?: VoiceId; intro?: VoiceId };
  ego: SimDef['ego'];
  egoNote: string;
  sidekick: SidekickInfo;
  stats: { walk: number; jump: number; fitness: number };
  win: string;
};

const lineFrames = (l?: Line, p?: Post) =>
  l ? Math.round(l.clips.reduce((s, c) => s + VOICE_SECONDS[c], 0) * FPS) + 6 : p ? Math.round(1.5 * FPS) : 30;

export const TUSK: FighterInfo = {
  id: 'tusk', name: 'Melon Tusk', title: 'Chief Posting Officer', color: '#e5484d', accent: '#ff9b6a',
  model: '/models/characters/tusk.glb', height: 1.0,
  ego: 'needy', egoNote: 'Needy: Engagement drains twice as fast when he goes quiet. His meltdowns last longest.',
  stats: { walk: 2.2, jump: 7.4, fitness: 0.75 },
  win: 'Considering taking this fight private.',
  sigs: [
    {
      name: 'My Heart Goes Out',
      line: { clips: ['tusk_heart'], text: 'My heart goes out to you.', source: SOURCES.rally },
      prop: null, context: 'Critics called the gesture a salute. He says it was his heart.',
      sim: { id: 'heart', kind: 'melee', startup: 9, active: 6, recovery: 26, damage: 13, range: 2.15, knockdown: true, lunge: 0.3 },
    },
    {
      name: 'Chainsaw for Bureaucracy',
      line: { clips: ['tusk_chainsaw'], text: 'This is the chainsaw for bureaucracy!', source: SOURCES.cpac },
      bark: 'tusk_chainsaw_yell', prop: 'chainsaw',
      context: 'Later post: in retrospect, it lacked empathy.',
      sim: { id: 'chainsaw', kind: 'melee', startup: 12, active: 36, recovery: 28, damage: 6, hits: 3, range: 2.35, knockdown: true, lunge: 0.7 },
    },
    {
      name: 'Let That Sink In',
      post: { text: 'Entering Twitter HQ – let that sink in!', source: SOURCES.post, handle: '@melontusk' },
      prop: 'sink', context: 'It was, in fact, just a sink.',
      sim: { id: 'sink', kind: 'projectile', startup: 14, active: 2, recovery: 26, damage: 12, range: 6, knockdown: true, speed: 0.12, arc: 0.11 },
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
  barks: { heavy: 'tusk_too_hard', block: 'tusk_plus_side', checked: 'tusk_omg', taunt: 'tusk_empathy' },
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
      prop: 'gate', context: 'Said while competing. In a fight.',
      sim: { id: 'losers', kind: 'drop', startup: 26, active: 2, recovery: 30, damage: 14, range: 4.2, knockdown: true },
    },
    {
      name: 'The Lecture',
      line: { clips: ['teal_how_much_time', 'teal_long_time'], text: 'How much time do we have? … I could talk about it for a long time.', source: SOURCES.podcast },
      prop: 'pages', context: 'Lecture ran over. Nobody stayed for questions.',
      sim: { id: 'lecture', kind: 'projectile', startup: 12, active: 26, recovery: 24, damage: 5, hits: 3, range: 7, speed: 0.15 },
    },
    {
      name: 'The Long Pause',
      line: { clips: ['teal_long_hes'], text: 'This is a long hesitation.', source: SOURCES.podcast, speaker: 'INTERVIEWER' },
      prop: null, context: 'Strike him mid-pause and he answers with his elbow.',
      sim: { id: 'pause', kind: 'counter', startup: 0, active: 0, recovery: 0, damage: 0, range: 0 },
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
  barks: { checked: 'teal_long_hes', taunt: 'teal_greta', intro: 'teal_losers' },
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
      sim: { id: 'cats', kind: 'projectile', startup: 10, active: 26, recovery: 22, damage: 4, hits: 3, range: 7, speed: 0.14, arc: 0.06 },
    },
  },
};

export const ROSTER = [TUSK, TEAL] as const;

export function simDef(f: FighterInfo): SimDef {
  const sigs = f.sigs.map((s) => ({ ...s.sim, quote: s.sim.quote ?? lineFrames(s.line, s.post) })) as SimDef['sigs'];
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
    prop: null, context: '', sim: p.sim,
  };
}
