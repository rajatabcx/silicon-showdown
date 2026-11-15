import type { MoveKey, SimDef } from '../sim/types';

// Every fighter is a fictional parody. Real names never appear in game data;
// the writer notes that map jokes to public record are in docs/research.md.

export type Face = {
  skin: string; hair: string;
  hairStyle: 'bald' | 'short' | 'wild' | 'side' | 'curly' | 'slick' | 'buzz';
  brows: 'angry' | 'flat' | 'raised';
  mouth: 'grin' | 'flat' | 'smirk' | 'open';
  glasses?: boolean; beard?: 'stubble' | 'full' | 'mustache';
  extra?: 'sunscreen' | 'eyeliner';
};

export type Look = {
  face: Face;
  /** Head size multiplier and per-axis squash. This is where the bobblehead distortion comes from. */
  head: [scale: number, wide: number, tall: number];
  shirt: string; pants: string; build: number;
  tie?: string; jacket?: string;
};

type MoveNames = Partial<Record<MoveKey, string>>;

export type FighterDef = {
  id: string; name: string; team: string; blurb: string; color: string;
  sim: SimDef; look: Look; moves: MoveNames;
  superName: string; superLine: string; superEmoji: string[];
  projectile?: string;
  lines: { intro: string; win: string; winded: string };
  sidekick: { name: string; look: Look; policy: string; line: string };
};

const suit = (skin: string, hair: string, tie: string, o: Partial<Face> = {}, jacket = '#27304a'): Look => ({
  face: { skin, hair, hairStyle: 'side', brows: 'flat', mouth: 'grin', ...o },
  head: [2.1, 1.05, 1], shirt: '#f1f1f1', pants: '#1d2233', build: 1.1, tie, jacket,
});

export const FIGHTERS: FighterDef[] = [
  {
    id: 'tusk', name: 'Melon Tusk', team: 'Team Mars', color: '#e5484d',
    blurb: 'Posts first, thinks never. Promises the same thing every year.',
    sim: { walk: 2.2, jump: 7.6, fitness: 0.7, sp1Projectile: true },
    look: {
      face: { skin: '#f0c9a8', hair: '#3a2a20', hairStyle: 'side', brows: 'raised', mouth: 'smirk' },
      head: [2.5, 1.18, 0.95], shirt: '#151515', pants: '#101010', build: 1.2,
    },
    moves: {
      sp1: 'Let That Sink In', sp2: 'Window Test', sweep: 'Efficiency Chainsaw', uppercut: 'Self-Driving (Next Year)',
      grab: 'Blue Check', finisher: 'Hardcore Mode', roundhouse: 'Hardcore Mode',
    },
    superName: 'FUNDING SECURED', superLine: '"Funding secured."', superEmoji: ['🚀', '📈', '💸'],
    projectile: '🚰',
    lines: { intro: 'Let that sink in.', win: 'Funding secured.', winded: 'Hold on, I need to post about this.' },
    sidekick: {
      name: 'Uncle Covfefe', policy: 'Tariff Everything', line: 'Nobody tags in better than me. Nobody.',
      look: suit('#f3a55b', '#f4d35e', '#d7263d', { hairStyle: 'slick', brows: 'angry', mouth: 'open' }),
    },
  },
  {
    id: 'carp', name: 'Alex Carp', team: 'Team Pallanteer', color: '#8b5cf6',
    blurb: 'Philosopher with a drone budget. Hates short sellers. Loves tai chi.',
    sim: { walk: 2.3, jump: 7.8, fitness: 1.1, sp1Projectile: true },
    look: {
      face: { skin: '#eec5a5', hair: '#8d8d8d', hairStyle: 'wild', brows: 'angry', mouth: 'open', glasses: true },
      head: [2.4, 1, 1.1], shirt: '#2b3a55', pants: '#22252e', build: 0.95,
    },
    moves: {
      sp1: 'Burn The Short Sellers', sp2: 'Wake Up Scared', sweep: 'Tai Chi Sweep', uppercut: 'Hair Raiser',
      grab: 'Data Harvest', finisher: 'The Ontology', roundhouse: 'The Ontology',
    },
    superName: 'LOWER PURPOSE', superLine: '"You need a higher purpose. And a lower one."', superEmoji: ['🛸', '💧', '💧'],
    projectile: '🔥',
    lines: { intro: 'Some of you will wake up scared.', win: 'Go to bed scared.', winded: 'I am breathing… dialectically.' },
    sidekick: {
      name: 'Senator Drone-Hawk', policy: 'Emergency Appropriation', line: 'The budget has been approved.',
      look: suit('#e8bf9f', '#d9d9d9', '#1f4fa3', { brows: 'angry', mouth: 'flat' }),
    },
  },
  {
    id: 'zuck', name: 'Mork Zuckerbot', team: 'Team Metaverse', color: '#3b82f6',
    blurb: 'Definitely human. Actually fit, so he rarely needs his senator.',
    sim: { walk: 2.4, jump: 7.9, fitness: 1.4, sp1Projectile: true },
    look: {
      face: { skin: '#f3d4bd', hair: '#7a5a3c', hairStyle: 'curly', brows: 'flat', mouth: 'flat', extra: 'sunscreen' },
      head: [2.3, 0.95, 1.08], shirt: '#6b7280', pants: '#1f2937', build: 1,
    },
    moves: {
      sp1: 'Senator, We Run Ads', sp2: 'Sunscreen Surf', sweep: 'Smoking Meats', uppercut: 'Masculine Energy',
      grab: 'Jiu-Jitsu Choke', finisher: 'Move Fast, Break Things', roundhouse: 'Move Fast, Break Things',
    },
    superName: 'METAVERSE EXILE', superLine: '"Legs are coming soon."', superEmoji: ['🥽', '🦵', '🚫'],
    projectile: '📢',
    lines: { intro: 'Senator, we run ads.', win: 'That was a very human victory.', winded: 'Rebooting.' },
    sidekick: {
      name: 'Senator Clueless', policy: 'Hearing Gavel', line: 'How does the internet make money?',
      look: suit('#ecc6a7', '#f2f2f2', '#8a1c1c', { hairStyle: 'bald', brows: 'raised', mouth: 'open', glasses: true }),
    },
  },
  {
    id: 'bozo', name: 'Jeff Bozo', team: 'Team Prime', color: '#f59e0b',
    blurb: 'Went to space and thanked you for paying for it.',
    sim: { walk: 2.2, jump: 7.6, fitness: 1, sp1Projectile: true },
    look: {
      face: { skin: '#e9bd9b', hair: '#e9bd9b', hairStyle: 'bald', brows: 'raised', mouth: 'grin' },
      head: [2.4, 1, 1.15], shirt: '#1e3a5f', pants: '#c8b48a', build: 1.35,
    },
    moves: {
      sp1: 'Same-Day Delivery', sp2: 'Two-Pizza Team', sweep: 'Day One', uppercut: 'Bald And Buff',
      grab: 'One-Click Buy', finisher: 'Customer Obsession', roundhouse: 'Customer Obsession',
    },
    superName: 'YOU PAID FOR THIS', superLine: '"Thank you, customers. You paid for all this."', superEmoji: ['📦', '🚀', '📦'],
    projectile: '📦',
    lines: { intro: "It's always Day One.", win: 'You guys paid for all this.', winded: 'Bathroom break. Timed, obviously.' },
    sidekick: {
      name: 'Senator Same-Day', policy: 'Tax Loophole', line: 'Delivered in two business days.',
      look: suit('#d9a983', '#3b2b20', '#f59e0b', { mouth: 'smirk' }),
    },
  },
  {
    id: 'teal', name: 'Peter Teal', team: 'Team Zero-To-One', color: '#14b8a6',
    blurb: 'Contrarian. Gives very long lectures about the end of the world.',
    sim: { walk: 2.1, jump: 7.4, fitness: 0.8, sp1Projectile: true },
    look: {
      face: { skin: '#f1cfb6', hair: '#6b4a2f', hairStyle: 'short', brows: 'angry', mouth: 'flat' },
      head: [2.3, 1.1, 0.98], shirt: '#f1f1f1', pants: '#1d2233', build: 1.05, jacket: '#1d2233',
    },
    moves: {
      sp1: 'Zero To One', sp2: 'Contrarian Kick', sweep: 'Monopoly Sweep', uppercut: 'Competition Is For Losers',
      grab: 'Young Blood', finisher: 'The Monopoly', roundhouse: 'The Monopoly',
    },
    superName: 'THE ANTICHRIST LECTURE', superLine: '"Part one of four."', superEmoji: ['📜', '💤', '🩸'],
    projectile: '1️⃣',
    lines: { intro: 'Competition is for losers.', win: 'Zero to one. You are the zero.', winded: 'I require… a transfusion.' },
    sidekick: {
      name: 'Hillbilly Veep', policy: 'Cat Lady Barrage', line: 'Have you said thank you once?',
      look: suit('#e9c2a2', '#4a3526', '#b91c1c', { hairStyle: 'short', beard: 'full', extra: 'eyeliner', mouth: 'flat' }),
    },
  },
  {
    id: 'ultman', name: 'Sam Ultman', team: 'Team Closed-AI', color: '#10b981',
    blurb: 'types in lowercase. gets fired, comes back five days later.',
    sim: { walk: 2.3, jump: 7.6, fitness: 0.9, sp1Projectile: true, revive: true },
    look: {
      face: { skin: '#f2d0b8', hair: '#5b4636', hairStyle: 'side', brows: 'raised', mouth: 'smirk' },
      head: [2.3, 1, 1.05], shirt: '#3f6b52', pants: '#2a2f3a', build: 0.9,
    },
    moves: {
      sp1: 'lowercase tweet', sp2: 'Feel The AGI', sweep: 'Scaling Laws', uppercut: 'Compute Uppercut',
      grab: 'Ads (Last Resort)', finisher: 'Rehired', roundhouse: 'Rehired',
    },
    superName: 'AGI ACHIEVED INTERNALLY', superLine: '"please look into the orb."', superEmoji: ['👁️', '💵', '💵'],
    projectile: '💬',
    lines: { intro: 'feel the agi.', win: 'the board has full confidence in me. again.', winded: 'need more compute.' },
    sidekick: {
      name: 'Stargate Senator', policy: '$500B Announcement', line: 'Five hundred billion. Maybe more.',
      look: suit('#e6b999', '#c9c9c9', '#0f766e', { mouth: 'grin', glasses: true }),
    },
  },
  {
    id: 'ambunny', name: "Mo'Cash Ambunny", team: 'Team Geo', color: '#ec4899',
    blurb: 'Gave everyone free data. Throws a wedding that lasts six months.',
    sim: { walk: 2.1, jump: 7.2, fitness: 0.6, sp1Projectile: true },
    look: {
      face: { skin: '#c68e63', hair: '#1c1c1c', hairStyle: 'side', brows: 'flat', mouth: 'grin' },
      head: [2.6, 1.22, 0.95], shirt: '#f5f5f5', pants: '#f5f5f5', build: 1.45, jacket: '#c9a227',
    },
    moves: {
      sp1: 'Free Data Tsunami', sp2: 'Tower Drop', sweep: 'Sutli Bomb', uppercut: 'Number One Uppercut',
      grab: 'The Merger', finisher: 'Unlimited Plan', roundhouse: 'Unlimited Plan',
    },
    superName: 'BIG FAT WEDDING SEASON', superLine: '"The pre-pre-wedding starts now."', superEmoji: ['🐘', '🎺', '💍'],
    projectile: '📶',
    lines: { intro: 'First month is free.', win: 'Everyone is invited. For six months.', winded: 'Somebody carry me.' },
    sidekick: {
      name: 'Minister Envelope', policy: 'Sealed Donation', line: 'What is inside is confidential.',
      look: { face: { skin: '#b9825a', hair: '#e8e8e8', hairStyle: 'short', brows: 'flat', mouth: 'grin', beard: 'mustache' },
        head: [2.1, 1.08, 1], shirt: '#fafafa', pants: '#fafafa', build: 1.2, jacket: '#e4572e' },
    },
  },
  {
    id: 'adonny', name: 'Gotham Adonny', team: 'Team Portfolio', color: '#0ea5e9',
    blurb: 'Owns the port, the airport and probably this stage.',
    sim: { walk: 2.2, jump: 7.4, fitness: 0.8 },
    look: {
      face: { skin: '#c18a60', hair: '#2b2b2b', hairStyle: 'short', brows: 'flat', mouth: 'smirk', beard: 'mustache' },
      head: [2.4, 1.15, 1], shirt: '#e8eef5', pants: '#28324a', build: 1.3, tie: '#0ea5e9', jacket: '#28324a',
    },
    moves: {
      sp1: 'Short Report Shield', sp2: 'Coal Wagon Rush', sweep: 'Green Energy Pivot', uppercut: 'Crane Lift',
      grab: 'Acquisition', finisher: 'Infrastructure', roundhouse: 'Infrastructure',
    },
    superName: 'PORTS, AIRPORTS, EVERYTHING-PORTS', superLine: '"I will take it. All of it."', superEmoji: ['🏗️', '✈️', '🚢'],
    lines: { intro: 'This stage is now under new ownership.', win: 'Added to the portfolio.', winded: 'Call it a strategic pause.' },
    sidekick: {
      name: 'Minister Clearance', policy: 'Fast-Track Approval', line: 'Approved. I did not read it.',
      look: { face: { skin: '#b07a52', hair: '#3a3a3a', hairStyle: 'bald', brows: 'raised', mouth: 'grin', glasses: true },
        head: [2.1, 1.05, 1], shirt: '#fafafa', pants: '#d6d6d6', build: 1.25, jacket: '#f2a33a' },
    },
  },
];

export const fighterById = (id: string) => FIGHTERS.find((f) => f.id === id) ?? FIGHTERS[0];

const GENERIC: Record<MoveKey, string> = {
  jab: 'Jab', kick: 'Kick', sp1: 'Special', sp2: 'Special Kick', lowJab: 'Low Jab', sweep: 'Sweep',
  uppercut: 'Uppercut', grab: 'Grab', finisher: 'Finisher', roundhouse: 'Roundhouse',
  airPunch: 'Air Punch', airKick: 'Air Kick', policy: 'Policy Move',
};
export const moveName = (def: FighterDef, key: MoveKey, sidekick: boolean) =>
  sidekick ? (key === 'policy' ? def.sidekick.policy : GENERIC[key]) : def.moves[key] ?? GENERIC[key];
