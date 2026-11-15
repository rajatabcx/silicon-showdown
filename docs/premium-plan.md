# Silicon Showdown: Premium Rebuild Plan (v2)

Written 15 Nov 2026, after the owner's review of the first playable build. This replaces the art, audio and combat sections of [build-plan.md](./build-plan.md). The single-player scope and the roster ideas there still stand.

**Owner's verdict on v1:** looks and feels like a children's game. No music. Emoji effects. Supers say nothing. Mechanics are a copy of the reference game. All correct.

---

## 1. Where the bar is

I played the reference game (fightkaro.com) to see what we're up against.

| | Sansad Showdown | Our v1 |
|---|---|---|
| Bodies | Rigged, skinned 3D characters with clothing folds and human proportions | Capsules and boxes |
| Faces | A face image per character (`/faces/*.webp`) on a sculpted head | Canvas doodles |
| Animation | Smooth, mocap-style clips (crouches, kicks, victory poses) | Code-driven joint angles |
| Stage | Detailed Parliament at night, string lights, lanterns, rangoli floor | Flat boxes |
| Audio | Recorded music (`intro`, `background`, `battle`), a voiced announcer (`round_1`, `fight`, `ko`, `perfect`), sound gags (`aloolelo.mp3`, `moo`, `chai_ting`) | Synth beeps |
| UI | Display font, gold-on-dark theme, live "TV debate" inset | Default sans, flat buttons |

So "premium" means: real character models, real animation, recorded music and voice, a lit and dressed stage, and designed UI. None of that is achievable with the procedural approach in v1; the art pipeline has to change.

---

## 2. The two references you shared

**"Posting something insane an AI executive said every day in 2026" (Instagram, @pano.dime).** Day 318 as of today. Every post names the executive and **cites the primary source** (interview, date). That makes it an index for our quote list. From about 100 posts I sampled, the people who appear most: Sam Altman, Jensen Huang, Alex Karp, Elon Musk, Peter Thiel, Marc Andreessen, Larry Ellison, Dario Amodei, Eric Schmidt, Mark Zuckerberg.

Leads worth chasing (these are the poster's summaries; **each must be checked word-for-word against the original interview before it goes in the game**):
- Karp: the Sorkin "lower purpose" drone line; "safe means the other side is scared" (Reagan Defense Forum, Dec 2024).
- Altman: getting the RAM out of people's computers and into his data centers (Cheeky Pint, Oct 2026); would give his vote to an AI (Mosaic Ventures, 2017).
- Musk: humans as a "biological bootloader" (X post, Oct 2026); work will be optional and money irrelevant (Economist, Jul 2026).
- Huang: no longer remembers his own address, zip code or phone number (Ezra Klein Show, Sep 2026); AI as "painful surgery".
- Ellison: citizens "on their best behavior" under constant AI recording; AI body cams.
- Thiel: the antichrist lectures; tech executives keeping their own families off their products (Aspen, Jun 2024).
- Zuckerberg: refusing to tell Senator Durbin which hotel he stayed in (Senate hearing, Apr 2018).
- Andreessen: higher prices are often better for customers (a16z outlook, Jan 2026).

The series also makes claims about people's private lives and job status. We don't use those; we use only what the person said on the record.

**"Billionaire Heaven" (Instagram, @noneofthisisok).** A hand-inked comic: thick black outlines, flat colour, faces pushed into sagging, squinting, smug caricature, and **every joke footnoted with a real, dated quote** ("Cybertruck will be waterproof enough to serve briefly as a boat" — 2022). Two things to take from it:
1. The face style: ink-line editorial caricature, ugly-funny rather than cute.
2. The citation habit: the footnote is the punchline. We put the source on screen.

We take the direction, not the drawings. Our character designs must be original.

---

## 3. Combat: our own system, built around the lines

v1 copied the reference game's inputs (strings, 30% super, same meters). The new system keeps the side-on 1v1 view, because that's what lets you play *as* a billionaire with a sidekick, but the core loop is ours.

### "Say it, then do it"
- **Signature moves start with the real quote.** The fighter stops, says the line (0.6–1.2 s, voiced, subtitled with source and year), then does the thing. Melon Tusk says "Let that sink in" and throws a 3D porcelain sink.
- **The quote is the wind-up, so it's also the opening.** The opponent can **Fact-Check** it: press Dodge in the last beat of the line. A successful Fact-Check slaps a "context added" note on the move, it backfires, and the speaker is stunned.
- **Let them finish and you eat the full move.** So every line is a decision for both players: commit to saying it, or bait the Fact-Check.

### Controls (keyboard-first, no motion inputs to memorise)
| Key | Action |
|---|---|
| A / D | Move. Double-tap to dash |
| W / S | Jump / duck |
| J | Light attack (tap for a 3-hit chain) |
| K | Heavy attack (hold to charge; breaks guard) |
| L | Signature move. L alone, L + forward, L + down = three signatures per fighter |
| Space | Dodge. Timed against a quote = Fact-Check |
| I | Call the sidekick |
| Enter | Super, when Receipts are full |

### Meters
- **Health.**
- **Cardio** (kept from v1; it's ours). Billionaires tire; the funded politician covers for them.
- **Receipts** (replaces the copied "hype" meter). Fills when you Fact-Check and when your signatures land. Full Receipts = Super: a 4–6 second cinematic with the fighter's most infamous line and a staged 3D set piece.

### Single-player structure
- Each opponent is a **designed boss with patterns**, not a symmetric bot: two or three phases, each built on a different signature, with tells you learn.
- Short **barks** on normal hits ("Hardcore!", "Day one!"), 2–3 words, never blocking.
- A campaign, "Earnings Season": 7 fights, a mid-run bonus stage, the Auditor as final boss.

### Alternatives I considered and rejected
- **Behind-the-shoulder boxing view** (dodge-and-counter duels). Shows the faces best, but you can't play as the billionaires with sidekicks.
- **Platform brawler** (knock them off the stage). Fun and keyboard-friendly, but lines and cinematics get lost in the chaos.

---

## 4. Art: real 3D models

### Style
Ink-outlined, cel-shaded editorial caricature. Human body proportions with a head about 1.5× normal, features pushed hard: jowls, squints, hairlines, smirks. No bobbleheads. No emoji anywhere in the game.

### Pipeline per character
1. **Concept sheet**: front and side view, neutral pose, original caricature design. I write the brief; an image generator or an illustrator draws it. You approve the face before anything else happens.
2. **Image → 3D**: Meshy is the usual pick for humanoids that need rigging; I'd test Tripo and Rodin on the first character and keep the best.
3. **Blender clean-up** (scripted, by me): reduce to ~25k triangles, fix the mesh, cel-shade material, ink outline, a jaw bone so the mouth moves when they talk, export GLB.
4. **Rig and animate**: Mixamo auto-rig plus about 35 fighting clips (idle, walk, dash, light/heavy chains, hit reactions, knockdown, get-up, block, wheeze, taunt, win). CC0 libraries (Quaternius, Rokoko) fill gaps. Signature-move animations are custom-keyed in Blender.
5. **In engine**: three.js GLTF loader and animation mixer with cross-fades, replacing the v1 box rig.

### Props (the "3D sink" problem)
I model these directly in Blender with scripts: sink, steel ball, chainsaw, rocket, drone, eyeball orb, delivery boxes, lectern, port crane, wedding elephant float. Hard-surface props are well within what I can script. Organic sculpting (faces) is not, which is why faces go through steps 1–2.

### Stage and lighting
One stage built properly before any second one: the Senate hearing room, with modelled dais, nameplates, press pit, flags, practical lights, environment lighting, rim light on fighters, bloom, vignette, depth of field in cinematics.

### Honest limits
- AI image-to-3D output varies. Expect two or three attempts per character and some hand-fixing.
- I can't see likeness the way an artist does; you are the judge at step 1 and step 3.
- Image generators sometimes refuse caricatures of named real people. Fallback: a commissioned illustrator for the 8 concept sheets.

---

## 5. Voice: exact words, on-screen receipts

- **The words are exact.** Each line is a verbatim quote with source and date, checked against the original. On screen: the subtitle, then a small stamp, e.g. `REAL QUOTE · CNBC · FEB 2026`.
- **The voice is a performed caricature, not a clone.** I won't build AI clones of real people's voices: it's the one part of this that stops being parody and becomes impersonation, the main voice tools block it (ElevenLabs' "no-go voices"), and a growing list of US states have laws against it. A cartoon impression is also funnier and matches the art.
- **How:** stock character voices from a text-to-speech tool, one distinct voice per fighter, directed for rhythm and accent; or a voice actor later for the hero lines.
- **Quote bible** (`docs/quotes.md`): 12–20 lines per fighter. Columns: exact words, source, date, link, where it's used (signature / super / bark / intro / win / out-of-breath).
- **Announcer**: a voiced "Round one", "Fight", "K.O.", "Fact-checked!", "Donor exposed!".

Using the real interview audio is the other option. It's the most "exact", but the recordings belong to the broadcasters, so a viral game invites takedowns. I'd keep it out.

---

## 6. Music (Suno, in the browser pane with your login)

| Track | Notes |
|---|---|
| Title theme | 90 s, the hook people remember |
| Character select | Loop |
| Battle loops ×3 | One per stage mood, 2 min, loopable |
| Entrance stinger per fighter | 8–10 s, with their quote as the sung hook |
| Win / lose jingles | 4 s each |
| Super sting | Riser + hit |

Prompts never name a real artist or song. I'll write them into `docs/suno-prompts.md`, generate in your Suno session, and you pick the takes.

Sound effects: a proper library of recorded hits, whooshes, crowd and UI sounds (CC0 or licensed) replaces the synth beeps.

---

## 7. What happens to the v1 code

- **Keep:** the deterministic fight engine and its tests, the CPU opponent framework, the screen flow, the satire notice, the ticker and newspaper.
- **Replace:** the renderer and all art, the audio, the UI skin, and the move set (new inputs, Fact-Check, Receipts).

---

## 8. Order of work, with approval gates

Nothing moves past a gate until you say it's good.

1. **Quote bible** for four fighters: Melon Tusk, Alex Carp, Sam Ultman, Mork Zuckerbot. *Gate: you approve the lines.*
2. **Art test**: Melon Tusk through the whole pipeline, shown on a turntable in the browser. *Gate: "does this look premium?"*
3. **Combat slice**: Tusk vs Carp on a grey stage with real animations, the new controls, Fact-Check and one signature each (the sink, the drone). *Gate: "does this feel good?"*
4. **Audio slice**: title theme, one battle loop, voiced lines and announcer for the two fighters.
5. **Vertical slice**: the Senate stage, lighting, redesigned UI, both Supers as full cinematics. *Gate: this is the quality bar for everything else.*
6. **Scale up**: remaining fighters, then the Indian roster, sidekicks, stages.
7. **Campaign**, the Auditor, bonus stage, extra modes.

Four fighters at this quality beat eight at v1 quality. The roster grows after the slice is approved.

---

## 9. What I need from you

| Need | Why |
|---|---|
| Blender installed (`brew install --cask blender`; I can run it) | Model clean-up, props, custom animations |
| A Meshy account (or Tripo), signed in in the browser pane | Image → 3D |
| An Adobe ID signed in to Mixamo | Rigging and fight animations |
| Suno signed in in the browser pane | Music |
| A text-to-speech tool you're happy with | Voice lines and announcer |
| A way to generate concept art, or an illustrator | The caricature sheets |

## 10. Decisions for you
1. **Combat**: go with "say it, then do it" + Fact-Check as described?
2. **Voice**: performed caricature voices with exact quotes on screen (my recommendation), or do you want to hold out for something else?
3. **Launch roster**: the four above first. The pano.dime series suggests Jensen Huang and Larry Ellison should come next, ahead of Bezos and Thiel.

---

Sources: [fightkaro.com](https://fightkaro.com/) · [@pano.dime series](https://www.instagram.com/p/DfvbrJLtdU0/) · [@noneofthisisok comic](https://www.instagram.com/p/DdBfZJ4EVWB/) · [AI 3D generator comparison](https://www.3daistudio.com/blog/best-ai-game-asset-generators-2026) · [Mixamo and alternatives](https://app.cinevva.com/guides/free-character-animations-rigging) · [ElevenLabs no-go voices](https://elevenlabs.io/docs/help-center/legal/what-are-no-go-voices.md)

---

## 11. Owner decisions, 15 Nov 2026 (these override anything above)

- **First two fighters:** Melon Tusk (Musk) and Peter Teal (Thiel). The combat slice is Tusk vs Teal. Draft lines are in [quotes.md](./quotes.md).
- **Voices are real interview clips**, cut with ffmpeg. No cartoon voices and no AI voices. Section 5's voice approach is dropped; the quote list, the on-screen source stamp and the announcer stay. Lines he only ever wrote appear as on-screen post cards, unvoiced. Risk accepted by the owner: the recordings belong to broadcasters, so clips stay short (under ~6 seconds) and takedown requests are possible.
- **Budget is tight.** Free tools first: Blender, Mixamo, CC0 animation and sound libraries, the owner's existing Suno plan. Pay for at most one month of one image-to-3D tool, and only after its free credits prove the result on Tusk.
- **Image-to-3D: start with Meshy.** It's the usual pick for humanoids because rigging and preset animations are built in, which may remove the need for Mixamo. Tripo is the fallback if Meshy's face comes out bland. Neither has been tested by us yet; the Tusk art test decides.

### The popularity meter: "Engagement" (replaces Receipts)

The more unhinged a fighter acts, the more Engagement they get. It feels like power. It's a trap.

- **Fills** when you use signature moves and taunts, i.e. when your fighter says the wild thing.
- **Tiers:** *Trending* (hits harder) → *Viral* (faster, Super unlocked) → *Main Character* (strongest, glowing, crowd chanting).
- **The catch:** the higher the tier, the more damage you take, and the bigger the crash. Getting Fact-Checked at *Main Character* means you're **Ratioed**: Engagement drops to zero and the fighter has a **Meltdown** (a few seconds of flailing, weak attacks, can't block).
- **It decays.** Stop posting and it drains, so the fighter has to keep escalating to hold the buff.
- **Each fighter's ego is fed differently:**
  - *Melon Tusk* is the neediest: his meter drains twice as fast and he can press a button to have "80 engineers" boost it for free, which makes the next crash worse. His Meltdown is the longest.
  - *Peter Teal* is contrarian: his fills when he's **losing** or when the crowd boos him, and drains when he's ahead.
