# Silicon Showdown: Build Plan

> A browser 3D fighting game. Bobble-headed tech billionaires fight; when they run out of breath, the politicians they funded tag in.
> The tone is political and corporate satire. Background research is in [research.md](./research.md). **Read it first.**
> This plan is written for an AI coding agent (Fable 5.2). Build phase by phase. Each phase ends with acceptance checks. Don't start the next phase until they pass.

> **Scope update (15 Nov 2026, from the owner):** the game is **single-player only**. Local 2-player and online rooms are cut; ignore anything below that mentions Player 2, PeerJS, netcode or rooms. The tournament is one human against CPU entrants. All fighter names are English-style parody names, including the Indian roster.

---

## 0. Ground rules (non-negotiable)

1. **Original IP only.** Tekken and Sansad Showdown are *genre* inspiration. Never use their names, characters, art, audio, logos or move names. Don't copy Bollywood film audio (e.g. *Welcome*) or any copyrighted song. All music is original (Suno, see §9).
2. **Parody names in game.** No fighter is called by their real name in the UI. Real names appear only in `docs/`, as writer notes. Faces are **hand-drawn or AI-generated caricatures, never photos** and never traced from photos.
3. **Jokes rest on public record.** Every gag maps to something in `research.md` §3. Never claim a crime that isn't a conviction. Allegations are joked about as *news cycles*, never as guilt. No sexual content, no jokes about race, religion or caste, no jokes about real people's family members or children.
4. **Satire gate.** The game opens with a satire notice (English and Hindi) and an "I understand · Continue" button. The text, roughly: *"Silicon Showdown is satire and parody. Characters are fictional caricatures. Nothing here is news or a factual claim about any real person or company."* The footer of every page links to the full disclaimer.
5. **This is not the Next.js you know.** Read `AGENTS.md`. Before writing any Next code, check `node_modules/next/dist/docs/`. The repo uses **Next 16.4, React 19.3, Tailwind 4, pnpm, and `cacheComponents: true`**.

---

## 1. Tech stack decision

The reference game uses **Three.js + TypeScript + WebRTC peer-to-peer**, with procedurally built fighters whose caricature faces are textured onto the heads. Our stack is the same, wrapped in Next.js:

| Concern | Choice | Why |
|---|---|---|
| Shell, menus, SEO, share pages | **Next.js 16 App Router** (already in the repo) | Landing page, OG images, character pages, deploys to Vercel |
| 3D rendering | **three** (latest stable, e.g. 0.18x), **vanilla, not React-Three-Fiber** | A fighting game needs to own a fixed-timestep loop. React reconciliation adds no value inside the canvas. |
| Game simulation | **Pure TypeScript, deterministic, fixed 60 Hz**, no DOM and no Three imports | Testable in Vitest, needed for netcode, and lets the CPU AI run headless |
| UI overlays (HUD, menus) | React components over the canvas; **zustand** store bridges sim → UI | HUD at 60fps via `requestAnimationFrame` reads, not React state per frame |
| Audio | **howler** (music/stingers) + Web Audio for SFX | Simple, reliable, handles mobile unlock |
| Persistence | `localStorage` (unlocks, settings, stats), wrapped in try/catch | No login |
| Tests | **vitest** for the sim; **playwright** smoke test for boot → fight | |
| Deploy | Vercel | |

Mount the game as a **client-only component** (`'use client'`, created inside `useEffect`, disposed on unmount). Check the Next 16 docs for the correct way to opt a route segment out of prerendering or caching under `cacheComponents`.

---

## 2. Folder structure

```
app/
  page.tsx                 # landing: logo, Play button, satire notice, trailer gif
  play/page.tsx            # mounts <GameRoot/>
  roster/page.tsx          # character gallery (static, SEO, share)
  legal/page.tsx           # full satire disclaimer
  api/og/...               # OG image for "The Daily Grift" share cards
src/game/
  sim/                     # PURE TS: no three, no DOM
    types.ts               # FighterDef, MoveDef, FrameData, Input, GameState
    constants.ts           # FPS=60, stage width, gravity, pushback
    input.ts               # 16-bit input bitmask + motion detection (→, ↓, ↓→)
    fighter.ts             # state machine
    combat.ts              # hitbox vs hurtbox, damage, hitstun, blockstun, meter gain
    tag.ts                 # stamina + sidekick tag-in logic
    match.ts               # rounds, timer, KO, best-of-3
    rng.ts                 # seeded RNG (mulberry32), the only randomness allowed
    ai/cpu.ts              # utility AI, difficulty profiles
  render/
    renderer.ts            # three scene, camera, lights, post (bloom optional)
    bobblehead.ts          # procedural fighter rig (see §6)
    animator.ts            # pose keyframes by fighter state + frame
    fx.ts                  # hit sparks, screen shake, hitstop flash, super cut-ins
    stages/*.ts            # one file per stage (geometry + crowd + hazards)
  audio/audio.ts
  modes/                   # arcade.ts, versus.ts, tournament.ts, survival.ts, training.ts
  ui/                      # React HUD, menus, select screen, results, newspaper
  data/
    fighters/*.ts          # one data file per fighter (see §5 schema)
    sidekicks/*.ts
    stages.ts
    newspaper.ts           # headline templates
    ticker.ts              # news ticker lines
public/
  faces/*.png              # caricature face textures (1024², transparent)
  audio/themes/*.mp3       # Suno tracks
  audio/sfx/*.ogg
```

---

## 3. Core rules

- **60 Hz fixed simulation** with rendering interpolated between ticks. Rounds are **60 s**, **best of 3**, **100 HP**.
- **Inputs:** Left, Right, Up (jump), Down (crouch), Punch (J), Kick (K), Grab (I or J+K), Super (L or Space), **Tag (U)**. Block = **hold back**. Pause = Esc ("ICE BATH BREAK" in global mode, "CHAI BREAK" in the Indian edition).
- **Mobile:** landscape only. Virtual stick on the left; PUNCH / KICK / GRAB / SUPER / TAG on the right. Show a rotate-device prompt in portrait.
- **Moves (shared grammar for every fighter):** jab (J), kick (K), →J special 1, →K special 2, ↓J low jab, ↓K sweep (knockdown), ↓→J uppercut (launcher), and the strings JJJ, JJK, JKK, KK, ↓J J, ↓J K. Grab beats block. Supers cost 100 meter.
- **Three meters per fighter:**
  1. **HP**: 100.
  2. **HYPE** (the "valuation" meter, our Shakti): 0–100. +6 per hit landed, +4 per hit taken, +2 per block. A Super does **30%** damage and has a cinematic cut-in (about 3 s, sim frozen; invincible during startup).
  3. **CARDIO** (stamina; *new, and it's our signature mechanic*): 0–100. Attacks, jumps and blocks drain it. It regenerates slowly while idle. Each fighter has a `fitness` stat that scales drain and regen.
- **Damage scaling in combos:** 100% / 90% / 80% / 70%, with a 50% floor. Hitstop is 6 frames on normal hits and 12 on heavy hits; camera shake on heavy hits.

### 3.1 The sidekick tag system (our signature twist)
- When CARDIO hits 0, the billionaire goes **"OUT OF BREATH"** and is wheezing and vulnerable for 1.5 s. Then their **funded politician** auto-tags in. The player can also tag manually with **U** when CARDIO is below 40%.
- The sidekick fights for **8 s** or until it takes **3 hits**. It has a simple, slightly worse moveset, its own taunt, and **one "Policy Move"** (a mini-super with no meter cost, usable once per tag).
- Meanwhile the billionaire recovers in a **"recovery corner"** at the back of the stage (oxygen tank, cold plunge, assistant fanning them), regaining CARDIO at 4× speed.
- **Scandal rule:** if the sidekick is "KO'd" (takes 3 hits), the billionaire takes 8 damage ("Donor exposed!" ticker), and the sidekick can't come back that round.
- The **fitness** stat sets the rhythm: high-fitness billionaires (Zuck-parody, Bryan-parody) rarely tag; low-fitness ones tag often. This is the main thing that makes fighters feel different.

---

## 4. Modes (from simple to stretch)

| Mode | Spec | Phase |
|---|---|---|
| **Arcade: "Series A → IPO"** | 6 CPU fights with rising difficulty → a **bonus stage** after fight 3 → fight 7 is a rival → **boss: THE AUDITOR**. Short intro and ending comic panels per fighter (3 static images plus text). Clearing it unlocks things. | 6 |
| **Vs CPU (quick match)** | Pick a fighter, the CPU's fighter and the difficulty. | 6 |
| **Tournament: "The IPO Cup"** | A 4- or 8-entrant single-elimination bracket: you against CPU entrants. Animated bracket screen between matches; the champion gets a gold "Public Company" trophy screen and a share card. | 7 |
| **Survival: "Bear Market"** | Endless CPU opponents. HP carries over with +15 between fights. Score = wins. Top-10 table kept locally. | 7 |
| **Training: "Sandbox"** | Dummy settings (stand / crouch / jump / block all / random block / CPU), infinite HP and meter toggles, input display, frame data readout, hitbox overlay (`H`). | 6 (needed for tuning) |
| **CPU vs CPU: "Board Meeting"** | Watch mode, useful for attract mode on the title screen. | 7 |
| **Daily Challenge** | A seeded daily fight with a modifier ("Tariffs: all damage +25%", "Remote Work: low gravity", "Layoffs: no sidekicks"). | 9 (stretch) |

### Difficulty levels
| Name | Reaction delay | Block chance | Combo use | Super use | Notes |
|---|---|---|---|---|---|
| **Intern** (Easy) | 30 frames | 18% | singles only | rarely | AI walks into hits |
| **Founder** (Normal) | 18 frames | 45% | 2–3-hit strings | when full | |
| **Hostile Takeover** (Hard) | 10 frames | 75% | full strings + anti-air | baits the Super | Boss has 2× HP and heals after 3 s without being hit |
| **Regulator** (unlockable) | 6 frames | 85% | optimal | punishes whiffs | Unlocked by clearing Arcade on Hard |

The CPU is a **utility AI**. Each tick it scores options (approach, retreat, poke, jump-in, anti-air, block, grab, super, tag) from distance, both players' states, its meter, its CARDIO and the difficulty profile. It acts only on the reaction-delayed opponent state.

### Unlocks and progression (localStorage)
- **Net Worth** currency: earned per win (more on harder difficulties). Spend it in **"The Yacht Shop"** on alternate outfits, stage variants and unlockable fighters.
- **Achievements** (toast and list), for example: "Funding Secured" (first win), "Touch Grass" (win without a Super), "Fully Vested" (clear Arcade), "Too Big To Fail" (win at 1 HP), "Hostile Takeover" (beat Hard), "Pivot!" (win after your sidekick was KO'd).

---

## 5. Data schema (the whole roster is data-driven)

```ts
type FighterDef = {
  id: string; displayName: string; team: string;      // e.g. "Melon Tusk", "Team Mars"
  tier: 'billionaire' | 'boss';
  edition: 'global' | 'india';
  stats: { walk: number; back: number; jump: number; fitness: number /*0.5–1.5*/; weight: number };
  look: { face: string; headScale: number; bodyColor: string; outfit: OutfitDef; props: PropDef[] };
  moves: Record<MoveSlot, MoveDef>;   // jab, kick, sp1, sp2, lowJab, sweep, uppercut, grab, roundhouse, comboFinisher
  super: SuperDef;                    // name, damage 30, cinematic script id
  sidekickId: string;
  lines: { intro: string[]; win: string[]; taunt: string[]; outOfBreath: string[]; tagIn: string[] };
  themeTrack: string;                 // /audio/themes/<id>.mp3
  stinger: string;                    // 5–8 s intro cut
};
type MoveDef = { name: string; startup: number; active: number; recovery: number;
  damage: number; hitstun: number; blockstun: number; hitbox: Box; knockdown?: boolean;
  launch?: boolean; low?: boolean; projectile?: ProjectileDef; vfx?: string; sfx?: string; cardioCost: number };
type SidekickDef = { id: string; displayName: string; look: LookDef; moves: Pick<..., 'jab'|'kick'|'sp1'>;
  policyMove: MoveDef & { name: string }; lines: {...} };
```

Every fighter uses the **same base frame data** at launch (as the reference game does: equal damage, different feel). Only the move names, VFX, props, `stats` and Super cinematics differ. Balance tuning comes later.

---

## 6. Art direction: "distorted bobblehead"

- **Bodies:** procedural low-poly, built from capsules, boxes and spheres in `bobblehead.ts`, on a shared joint hierarchy (hips → spine → chest → neck → head; shoulders → upper arm → forearm → hand; thighs → shins → feet). The animation is **code-driven keyframe poses** per state, interpolated with easing. This is the same approach as the reference game, so we don't need Mixamo or GLB rigs.
- **Heads:** **2.2–2.8× normal size**, wobbling on a spring (they lag body motion and jiggle on hits). The head mesh is a sphere deformed per character (jaw width, forehead height, chin), with the **caricature face texture** (a transparent PNG) projected onto the front. Exaggerate one feature per person (hair volume, a grin, eyebrows, a forehead).
- **Face art pipeline:** generate each caricature in a **consistent style**: flat cel-shaded, thick outline, slightly grotesque, editorial-cartoon look. **Not photoreal, and never from a photo used as a direct input.** Store the prompts in `docs/art-prompts.md`. Optional upgrade: run the caricature through an image-to-3D tool (Meshy, Tripo or Rodin) to get a sculpted head GLB, keeping the procedural body.
- **Shading:** toon (`MeshToonMaterial` with a 3-step gradient map) plus an inverted-hull outline. Bloom on Supers only.
- **Camera:** side-on 2.5D, tracking the midpoint between the fighters and zooming with their distance. During a Super cinematic it orbits and pushes in, then snaps back.
- **Performance budget:** 60fps on a mid-range phone. ≤150k triangles per scene, ≤60 draw calls, textures ≤1024². Shadows: one directional light with a small shadow map, or blob shadows on mobile.

---

## 7. Launch roster: 8 billionaires + boss (global and India editions share one roster)

Real names are writer notes only. Every gag traces back to `research.md` §3.

### 7.1 Melon Tusk (Musk) · Team Mars · fitness 0.7
- **Super: "FUNDING SECURED"**: tweets "funding secured" (giant tweet card). A rocket lifts off behind him, flips, and lands on the opponent, and a fake stock ticker spikes.
- sp1 **"Let That Sink In"** (throws a porcelain sink, a projectile) · sp2 **"Cybertruck Window Test"** (a steel ball; the arc "misses" first, then hits) · sweep **"DOGE Chainsaw"** · uppercut **"Self-Driving (Next Year)"** (rushes forward, stops short, then hits) · grab **"Blue Check"** (sells the opponent a checkmark) · combo finisher **"Hardcore Mode"**.
- Intro: "Let that sink in." · Win: "Funding secured." · Out of breath: "Hold on, I need to post about this."
- **Sidekick: Uncle Covfefe** (Trump parody; documented 2024 PAC funding). Policy Move **"Tariff Everything"**: a giant TARIFF stamp. Tag-in: "Nobody tags better than me."

### 7.2 Alex Carp (Karp) · Team Pallanteer · fitness 1.1 (he skis; qigong)
- **Super: "LOWER PURPOSE"**: a drone flies over and sprays a **cartoon-yellow mist** captioned "LIGHT 💧", tagging the opponent **"ANALYST"** (a 2 s slow debuff). Stylised and comedic; no needles or drug imagery. This is a direct reference to the Feb 2026 Sorkin quote.
- sp1 **"Burn the Short Sellers"** (a short flame burst) · sp2 **"Wake Up Scared"** (a scream projectile that makes the opponent flinch) · block stance **"Qigong Guard"** (a flowing-arms animation) · uppercut **"Hair Raiser"** (the hair grows on impact) · grab **"Data Harvest"** · finisher **"Ontology"**.
- Intro: "Some of you will wake up scared." · Win: "Go to bed scared."
- **Sidekick: Senator Drone-Hawk** (a fictional defence-budget senator). Policy Move **"Emergency Appropriation"**: a rain of contract papers.

### 7.3 Mork Zuckerbot (Zuckerberg) · Team Meta-verse · fitness 1.4 (genuinely fit, so he rarely tags)
- **Super: "METAVERSE EXILE"**: drags the opponent into a low-poly VR void where they have **no legs**. Floating "Legs coming soon" text, then an ejection slam.
- sp1 **"Senator, We Run Ads"** (a pop-up ad wall projectile) · sp2 **"Sunscreen Surf"** (a white-faced surfboard rush) · grab **"BJJ Rear-Naked Choke"** (his best move; extra damage) · sweep **"Smoking Meats"** (a BBQ sauce bottle) · uppercut **"Masculine Energy"** · finisher **"Move Fast & Break Things"**.
- Intro: "Senator, we run ads." · Win: "That was… very human of me."
- **Sidekick: Senator Clueless** (fictional; asks "how does the internet work?"). Policy Move **"Hearing Gavel"**.

### 7.4 Jeff Bozo (Bezos) · Team Prime · fitness 1.0 (newly buff)
- **Locked by the owner, 18 Nov 2026.** Same layout as Tusk and Teal: 3 signature moves, a Super, and a sidekick Policy Move. Clips are in `public/audio/voice/`.
  - Move 1 **"You Paid For This"**: throws a Prime box forward. Clip `bozo_paid` ("…because you guys paid for all this"; Blue Origin press conference, Jul 2021), with `bozo_paid_short` as the on-hit bark.
  - Move 2 **"Day One"**: a sweep. Clip `bozo_day_one` ("And that is why it is always day one"; Amazon all-hands).
  - Move 3 **"Can't Guarantee"**: a grab that steals the opponent's data. Clip `bozo_cant_guarantee` ("I can't guarantee you that that policy has never been violated"; House antitrust hearing, Jul 2020).
  - **Super "BEST DAY EVER"**: rides a suspiciously shaped rocket (a shape gag, PG) into orbit and rains Prime boxes on the opponent. Clips: `bozo_laugh`, then `bozo_best_day` ("Best day ever!"; landing, Jul 2021).
  - **Sidekick: Madame Producer** (Melania parody; replaces Senator Same-Day; see `docs/art-briefs.md`). Tag-in clip `melania_here_we_go` ("Here we go again"). Policy Move **"$40M Premiere"**: a giant movie poster drops on the opponent. Clip `melania_here_it_is` ("Everyone wants to know… so, here it is"); both clips are from the Amazon *MELANIA* trailer.
  - Spare real clips: `bozo_day_two`, `bozo_optimistic`, `bozo_help_him`, `bozo_policy`, `bozo_dont_remember`, `bozo_paid_long`, `melania_be_best`, `melania_peacemaker`.
- Older ideas (not in the locked set): sp2 "Two-Pizza Team", uppercut "Bald & Buff", finisher "Customer Obsession".

### 7.5 Peter Teal (Thiel) · Team Founders Fund · fitness 0.8
- **Super: "THE ANTICHRIST LECTURE"**: a lectern appears and a 4-part lecture series bores the opponent to sleep (Zzz). He then drains their HP with a **"Young Blood"** IV-bag beam (a parabiosis gag).
- sp1 **"Zero to One"** (a 0 → 1 number projectile) · sp2 **"Contrarian Kick"** (it comes from the opposite side) · grab **"Democracy? Incompatible."** · finisher **"Monopoly Combo"**.
- **Sidekick: Hillbilly Veep** (Vance parody; documented $15M funding). Policy Move **"Cat Lady Barrage"** (throws cartoon cats), referencing his "childless cat ladies" line. Wears eyeliner (a meme). Don't use any joke built on fabricated internet rumours about him.

### 7.6 Sam Ultman (Altman) · Team Closed-AI · fitness 0.9
- **Locked by the owner, 18 Nov 2026.**
  - Move 1 **"Quite Wrong"**: a glitchy AI projectile. Clip `ultman_quite_wrong` ("If this technology goes wrong, it can go quite wrong"; Senate testimony, May 2023).
  - Move 2 **"End of the World"**: a shockwave. Clip `ultman_end_short` ("I think AI will probably, most likely, sort of lead to the end of the world"; 2015 talk), or `ultman_end_world` for the full line.
  - Move 3 **"Last Resort"**: an ad-wall grab. Clip `ultman_last_resort` ("I kind of think of ads as like a last resort for us"; Harvard, May 2024).
  - **Super "WITHOUT YOU, MR. PRESIDENT"**: $500B of Stargate money rains down on the opponent. Clip `ultman_agi_here` (the full Stargate statement, ending "we wouldn't be able to do this without you, Mr. President"; White House, Jan 2025).
  - **Sidekick: Uncle Covfefe** (shared with Tusk; see `docs/art-briefs.md`). Uses his existing Tariff Policy Move. Replaces Stargate Senator.
  - Spare clip: `ultman_this_era`.
- Older ideas (not in the locked set): sp1 "lowercase tweet", sp2 "Feel the AGI", passive "Fired & Rehired", finisher "Scaling Laws".

### 7.7 Mo'Cash Ambunny (Mukesh Ambani) · Team Geo · India edition · fitness 0.6
- **Super: "BIG FAT WEDDING SEASON"**: the stage turns into a 6-month wedding. Pop-star **cardboard cutouts** (generic, no real likenesses) perform, the baraat stampedes over the opponent, and elephants (Vantara) finish the job.
- sp1 **"Free Data Tsunami"** (a wave of 4G bars and SIM cards) · sp2 **"Antilia Drop"** (a 27-storey building falls; slow but big) · grab **"Merger"** (absorbs the opponent briefly) · sweep **"Sutli Bomb"** (a Diwali firecracker trap) · finisher **"Ek Number Combo"**.
- Crowd vendor on his stage: "Aloo le lo, pyaaz le lo! Startup le lo!"
- **Sidekick: Minister Envelope** (a fictional electoral-bond politician). Policy Move **"Electoral Bond"** (a sealed envelope; its contents are "Redacted").

### 7.8 Gotham Adonny (Gautam Adani) · Team Portfolio · India edition · fitness 0.8
- **Super: "PORTS, AIRPORTS, EVERYTHING-PORTS"**: he buys the stage. Ownership signs pop up on every object, a port crane lifts the opponent, and a coal wagon dumps on them.
- sp1 **"Short Report Shield"** (a reflector: a "REPORT" document bounces back, a nod to the Hindenburg news cycle) · sp2 **"Coal Wagon Rush"** · grab **"Crane Lift"** · sweep **"Green Energy Pivot"** (a solar panel slide) · finisher **"Infrastructure Combo"**.
- **Sidekick: Minister Clearance** (fictional; rubber-stamps everything). Policy Move **"Fast-Track Approval"** (a giant APPROVED stamp).

### 7.9 Boss: THE AUDITOR (IRS / ED) · 200 HP
- Grey suit, briefcase and a calculator. Punches do **chip damage only**.
- **To beat him you must fill the COMPLIANCE meter**, which grows by blocking his attacks (the inverse of the reference game's "Shanti" idea). When it's full, he becomes vulnerable for 6 s; repeat three times.
- The **BAILOUT** button (B), once per round in the boss fight only: a helicopter drops cash, and the Auditor is stunned while he counts it.
- Super: **"FULL AUDIT"**: paperwork tornado, receipts, "Please explain this $44B purchase".
- On Hard: 2× HP, 1.15× power, heals after 3 s without being hit.

### 7.10 Unlockable fighters (phase 9), each with a sidekick
**Jacket Jensen** (the leather jacket; super "The More You Buy, The More You Save": a GPU rain that gets *bigger* the more meter you have) · **Larry Lanai** (super "Best Behavior": surveillance cameras freeze the opponent) · **Steve Sweatmer** (super "Developers ×3", a monkey-dance stampede; infinite cardio, so **no sidekick**) · **Don't-Die Bryan** (super "Plasma Swap"; 150-pill projectile; fitness 1.5) · **Seventy-Hour Murphy** (Murthy; super "70-Hour Week": the round timer jumps to 70 and the opponent's cardio drains 2×) · **Sunday Sir** (Subrahmanyan; super "How Long Can You Stare?": a giant wall clock reading SUNDAY, and the opponent is forced to work) · **Scooter Bro** (Aggarwal; super "Service Center Queue": the opponent is stuck in an endless queue; his own scooter breaks down 10% of the time as a gag) · **King of Good Times** (Mallya; can't be KO'd; at 0 HP he "leaves for London" and wins on a technicality unless you KO him before the timer… a joke mode).

---

## 8. The "Hustle Tier": millionaires who can't fight

They never take a fighter slot. They show up as:
1. **Crowd and commentary:** LinkedIn Guy in the stands holds signs ("Agree? 👇", "I'm humbled to announce this KO"). A 4 a.m. podcaster shouts "Rise and grind!" on hits.
2. **Assist cards (optional, Versus/Arcade):** pick one before a match. It's used once per round with a double-tap of Grab.
   - **Crypto Bro:** "Rug Pull", a carpet yanked from under the opponent.
   - **MLM Uncle:** recruits your opponent's sidekick so it can't tag in for 5 s ("Are you your own boss?").
   - **Viral Chaiwala** (fictional, generic): serves chai, +5 HP.
   - **Shark Tank Judge:** "Ye sab doglapan hai!" / "You're dead to me." Taunts that stun for 0.5 s.
   - **Fraud Founder** (generic Theranos-style, black turtleneck, deep voice): "One Drop", a fake test result that heals and then hurts.
3. **Bonus stage after Arcade fight 3: "LAYOFF SEASON"**: 30 s to smash a co-working office (bean bags, ping-pong table, kombucha tap) while tiny millionaires run around in panic. A scored mini-game like a car-smash bonus stage, but original.
4. **Stage hazards:** a delivery rider zooms across (it can hit both players) on the SF street; a WeWork-style "Vibes" sign falls on Burning Man.
5. **Between-fight "Pitch Meeting" (stretch):** pick 1 of 3 absurd startup pitches; picking right gives +Net Worth.

---

## 9. Audio: Suno entrance themes

- Each fighter gets a **theme** (60–90 s loop, used for their stage and character select) plus a **stinger** (6–8 s cut, played on the VS screen and the intro).
- **Suno rules:** never put a real artist's name or a real song title in the prompt; describe the genre, tempo and instruments. Lyrics should be short, hook-heavy and parodic. Use a paid Suno plan so the tracks can be used commercially. Keep the prompts in `docs/suno-prompts.md`.
- Mix **international pop parody** with **desi flavour** (the Indian billionaires get Bollywood-wedding brass and dhol; the US ones get trap, EDM, synthwave and arena rock).

Starter prompts:
| Fighter | Suno style | Hook lyric idea |
|---|---|---|
| Melon Tusk | Hyperpop / trap, 150 BPM, glitchy synths, rocket SFX | "Funding secured, funding secured / to the moon, I'm insured" |
| Alex Carp | Dark techno, 130 BPM, drone buzz, ominous choir | "Wake up scared, go to bed scared" |
| Mork Zuckerbot | 2000s pop-punk, palm-muted guitars | "Senator, we run ads (we run ads!)" |
| Jeff Bozo | Arena rock, stomps and claps, cash-register hits | "You paid for this, you paid for this" |
| Peter Teal | Gothic organ + baroque harpsichord + 808s | "Zero to one, the end has begun" |
| Sam Ultman | Lo-fi chillwave turning into a huge EDM drop | "feel the agi" (whispered, lowercase) |
| Mo'Cash Ambunny | Bollywood wedding baraat: dhol, brass, shehnai, auto-tune | "Free data, free data, sabko free data" |
| Gotham Adonny | Bhangra-EDM fusion, heavy dhol, industrial clangs | "Port bhi mera, airport bhi mera" |
| The Auditor | Elevator jazz → sudden dramatic orchestral hit | (instrumental, with calculator beeps) |
| Menu / title | Synthwave + tabla fusion, 110 BPM | "Silicon Showdown!" chant |

**SFX:** generate them with Web Audio or source CC0 sounds (whooshes, punches, cash register, crowd, tweet chirp). Every hit plays one, with pitch varied ±10%.

---

## 10. Stages (3 at launch + 1 unlockable)

1. **Senate Hearing Room**: wood panels, nameplates, senators asleep in the background, a bank of reporters' cameras flashing. Ticker: "Senator asks if WiFi is a cloud."
2. **Burning Man Playa** (at dusk): art cars, a giant effigy that burns during Supers, dust storms as a light visual hazard.
3. **San Francisco Street**: a hill, robotaxis passing, scooters, a pitch-deck billboard, the delivery-rider hazard.
4. **Mumbai Rooftop Wedding** (India edition and unlock): marigolds, LED stage, a dhol player, fireworks. Crowd vendor: "Aloo le lo, pyaaz le lo!"
- The camera shakes slightly when Supers land. The crowd cheers on combos of 3 hits or more.

---

## 11. Satire layer (the viral glue)
- **News ticker** along the bottom, reacting to events (first hit, combo, sidekick tag, scandal, Super, KO). 60+ lines in `data/ticker.ts`, for example: "BREAKING: Billionaire takes 2 damage, blames the media." "Markets react: HYPE up 30%." "Sidekick asks donor for more funding."
- **Commentary booth** in a small picture-in-picture TV: **Brock HotTake** (a shouting anchor) vs **Reply Guy Brigade** (a bot-farm avatar). They're text bubbles with SFX, not voiced, for the MVP.
- **End-of-match newspaper**: *The Daily Grift* / *The Valuation Times* / *Breaking Bubble* / *TechCrunched* (chosen at random). The headline is built from match stats ("TUSK CRUSHED IN 42 SECONDS; SHARES DOWN 9%"). It has **Download PNG** and **Share** buttons; share links go to `/` with an OG image.
- **Tip button**: "Buy the dev a matcha 🍵" (global) / "Chai pilao ☕" (India).
- **Seasonal live-ops hooks**: a `SEASON` config flag switches stage dressing and lines (Black Friday, Diwali, Wedding Season).

---

## 12. Build phases and acceptance criteria

**Phase 0: Setup.** Install three and vitest. Add the `/play` route with a client-only canvas, the satire gate, the `/legal` page and the folder skeleton.
✅ `pnpm build` passes · `/play` shows a spinning cube after the satire gate · `pnpm test` runs.

**Phase 1: Deterministic sim (no art).** Input bitmask, fighter state machine (idle, walk, back-walk, crouch, jump, attack startup/active/recovery, hitstun, blockstun, knockdown, getup, grabbed, super, tag-out/in, KO), hitboxes, damage, meter, rounds, timer. Two capsule placeholders.
✅ Vitest: the same inputs give the same final-state hash across 10,000 frames · hold-back blocks highs; crouch-block blocks lows · grab beats block · a 3-hit string scales damage correctly · KO ends the round · best-of-3 ends the match.

**Phase 2: Rendering and feel.** Bobblehead rig with a placeholder face texture, pose animator, camera, hit sparks, hitstop, screen shake, the HP/HYPE/CARDIO HUD, round announcer text ("ROUND 1 · FIGHT!" / "K.O.").
✅ 60fps on desktop · hits *feel* weighty (hitstop and shake visible) · the head wobbles.

**Phase 3: Supers and the tag system.** Cinematic system (sim pauses, scripted camera and VFX timeline), the CARDIO drain, the out-of-breath state, sidekick tag-in, the recovery corner, the scandal rule.
✅ Melon Tusk's "Funding Secured" plays end to end · the sidekick auto-tags when CARDIO hits 0 · a manual tag works below 40% · the scandal penalty applies.

**Phase 4: Roster and stages.** All 8 fighters, 8 sidekicks, the boss, 3 stages, the face art in place, move names and lines.
✅ Every fighter's Super cinematic plays without errors · there's a roster select screen with a portrait, stats bars and a theme preview.

**Phase 5: Audio.** Themes, stingers, SFX and the mobile audio unlock. M toggles music; N mutes everything; volume settings persist.

**Phase 6: Single-player and local modes.** Main menu, Vs CPU, local Versus, Arcade ladder with the comic panels and the Auditor boss fight, Training mode, the four difficulty profiles.
✅ An Intern CPU is beatable by a new player · a Hostile Takeover CPU blocks about 75% · Arcade can be cleared start to finish · Training shows the hitbox overlay.

**Phase 7: Extra modes.** IPO Cup tournament bracket (4 or 8 slots, mixed human and CPU), Bear Market survival, CPU-vs-CPU attract mode, unlocks, Net Worth, Yacht Shop, achievements.
✅ An 8-player bracket can be played to a champion · progress persists after a reload.

**Phase 8: (cut).** Online play was removed from scope.

**Phase 9: Mobile and polish.** Touch controls, landscape lock, PWA manifest (add to home screen), newspaper share cards, OG images, the news ticker and commentary, the Hustle Tier assists and the Layoff Season bonus stage, the unlockable fighters.
✅ A Lighthouse performance score of 85 or more on the landing page · playable at 60fps on a mid-range Android · the share card renders.

**Phase 10: Launch.** Deploy to Vercel, add analytics (page views, match starts, mode popularity), put the tip link live, and do a final pass on the disclaimer.

---

## 13. Things to decide before Phase 4 (owner input)
1. The final parody names (the ones in §7 are proposals).
2. Whether to ship **global and India editions as one roster** (recommended) or as separate toggles.
3. The face-art source: commission an illustrator, or AI-generate with a fixed style prompt.
4. Whether the Karp "Lower Purpose" super stays as written (it's stylised, but it's still a drug reference). It's a direct quote, which is good satire, but app stores and ad networks may object if you ever publish beyond the web.
