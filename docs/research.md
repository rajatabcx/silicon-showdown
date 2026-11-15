# Silicon Showdown: Research Notes

Research done 15 Nov 2026. It's the background for [build-plan.md](./build-plan.md).

---

## 1. The reference game: Sansad Showdown (a.k.a. FightKaro / "The Great Kursi Fight")

| Fact | Detail |
|---|---|
| Developer | Shivam Maindola ("ShivamBuilds", Instagram @shivmbuilds) |
| Official site | fightkaro.com (mirror: takkar.shivambuilds.app) |
| Timeline | Domain registered 27 Oct 2026 → first YouTube gameplay 30 Oct → Deccan Herald 3 Nov → Prabhat Khabar 4 Nov → Sportsdigest 5 Nov. New fighters were added on 4 Nov and 10 Nov. A Diwali Special was live on 13 Nov. "Chapter 2: Operation Kohinoor" has been teased. |
| How it went viral | Free, no install, no login, no ads. It's a satire 1v1 fighter with politician caricatures, nicknamed "the Modi game". Gameplay clips spread on YouTube Shorts, X and Instagram, then the press picked it up. Online rooms come with a "Share on WhatsApp" button. |
| Tech stack | **Three.js + TypeScript + WebRTC peer-to-peer rooms**. 3D assets stream in the browser. It runs on Chrome, Edge, Safari and Firefox with WebGL. Gamepads aren't mapped. |
| Likely art pipeline | Two clone projects show how this is usually done: **procedural, articulated low-poly fighters with caricature faces mapped onto the heads** (sraveshnandan/fight-karo-game uses `fighterModel.js`, `kinematics.js`, `combat.js`, `ai.js`, `fx.js` and `stage.js` on three ^0.182 + Vite, and procedural Web Audio for sound). There's no GLB/Mixamo pipeline; the animation is code-driven. |
| Monetisation | A tip button labelled "Mithai khilao · Support". |
| Legal posture | Opens with a bilingual satire notice ("I Understand · Continue"). The game names **no real person**; everyone has a nickname. |

### Mechanics we can borrow (they're genre mechanics, not IP)
- Move with A/D or arrows. Jump W, crouch S, **hold back to block** (there's no block key).
- J punch, K kick, I (or J+K) grab, L or Space for the Super when the meter is full. Esc pauses (they call it "CHAI BREAK"). M toggles music, N mutes.
- Directional specials: →J, →K, ↓K sweep. Strings: JJJ, JJK, JKK, KK, ↓J J, ↓J K.
- **Shakti meter** (0–100) fills from hitting, getting hit and blocking. A Super does 30% damage.
- Every fighter has 100 HP and the same damage. Fighters differ only in walk speed and jump height (2.1–2.4 walk, 7.6 jump), plus their move names and gags.
- Rounds last 60 s, best of three.
- Modes: vs CPU (Easy/Normal/Hard, with CPU block chance 18% / 45% / 75%), and online 1v1 rooms using 4-character codes. The codes leave out I, L, O, 0 and 1.
- Mobile works in landscape only: a joystick on the left and PUNCH/KICK/GRAB/SUPER buttons on the right.
- **Boss "Mbapu"** (a Gandhi caricature). He has 200 HP. A "Shanti" meter fills while you block. On Hard he has 2× HP and 1.15× power, and he heals after 3 s without being hit. The "Nirmala's Budget" button (B) gives one assist per round, in the boss fight only. He used to unlock after 3 CPU wins in a row (saved in localStorage).
- Extra gags: a live news ticker that reacts to hits; fake TV channels ("Breaking Bakwas" anchor Shor Sharma vs "Troll Army" Tweety Trollwala); a mock front page after each match (randomly titled "The Daily Jumla", "Sansad Times", "Breaking Bakwas" or "The Kursi Express"); crowd vendors ("Mithai le lo! Kaju katli!"); an end-of-match share card.
- Stages: Sansad Bhavan at sunset, Jantar Mantar (the protest ground), Desi Sadak (an Indian street).

### Full roster and their references

| Fighter (parody of) | Super | Meme sources behind the moves |
|---|---|---|
| MitraMan (Modi) | Mitra Chakra: rises up, a spinning chakra grows, he throws it | "Mitron!" speech opener; Demonetization Palm; GST Sweep; Lamba Bhashan (long-speech) combo; Hugplomacy grab (hug diplomacy); "Vikas" (development) |
| Yatra Boy (Rahul Gandhi) | Aloo Se Sona: turns the foe into a potato and feeds it to a machine, gold comes out | The "potato-to-gold machine" speech meme; Bharat Jodo Yatra; "Mohabbat ki dukaan" (shop of love); aikido |
| Deedee (Mamata Banerjee) | Jadu Hobe: stirs a black-magic pot to a "humba humba" chant and turns the foe into a frog | "Khela hobe"; dharna (sit-in protest); chappal slap |
| Tariff Taau (Trump) | Tariff Tsunami: golden executive order, crates in a vortex, giant stamp | Tariffs; "tremendous"; "Nobody does it better than me" |
| Dozer Dada (Yogi Adityanath) | Dozer Ka Dhamaka: laser eyes, then a bulldozer bucket slams three times | "Bulldozer justice" |
| Toll Man (Nitin Gadkari) | Gaddha Blast: pothole, sugarcane becomes E20 fuel, he flicks a match | Highways, tolls, E20 ethanol blend, potholes, flyovers, "udghatan" (ribbon cuttings) |
| Sutti Babu (Ravi Kishan) | Time Is Money: a coin-clock freezes time, a coin-dragon, a rolling coin | "Jaldi the late", "Home from work", "Money follows" and "Zindagi jhand ba, phir bhi ghamand ba" (the Ghamandwa Kick) |
| Rail Raja (Lalu Prasad Yadav) | Rail Raja Express: a steam train out of a fire tunnel | Railway minister era, kulhad (clay) cups, buffalo, samosa |
| Ghar Mantri (Amit Shah) | Shah-Maat: the floor becomes a chessboard, the crowd switches sides, a golden knight | "Chanakya" strategist, "Chronology samjhiye", booth management, Z-plus security |
| Fact Bhai (Dhruv Rathee) | Doomscroll: calendar pages, a giant phone, German Shepherds burst out of a reel | "Namaskar doston", fact-check videos, thumbnails |
| Mbapu (Gandhi), boss | Manch Chhodo (spinning wheel of light, wraps foe in cloth) | Charkha, khadi, non-violence ("Shanti se bada koi mukka nahi") |

**References you mentioned that I couldn't find in any source.** No guide, clone repo or article mentions **"Sutli bomb"** or **"Aloo lelo, pyaaz lelo" (Welcome)**. They may be voice or crowd lines that only exist in the live game, like the vendor shout "Mithai le lo! Kaju katli!". We'll use them anyway as *our own* lines (see §3), written fresh rather than copied from the film audio.

---

## 2. Sansad references → international / Silicon Valley equivalents

This is how each joke type in the source game translates into our world. Use it as a writer's guide.

| Sansad Showdown device | What it is | Silicon Showdown equivalent |
|---|---|---|
| "Mitron!" speech opener | A signature greeting everyone recognises | "Hey guys, quick update" (founder video), "Let that sink in", "lowercase tweet energy" |
| Jumla (empty promise) | A promise that never comes true | "Full self-driving next year" (promised every year since 2016), "Mars by 2024", "AGI next quarter" |
| Demonetization Palm | A policy shock that freezes your money | "Withdrawals Paused" (FTX freeze), "Rug Pull" |
| Aloo Se Sona (potato → gold) | Magical-economics alchemy | "Community-Adjusted EBITDA" (WeWork), "Pivot to AI": anything in, a $10B valuation out |
| Jadu Hobe (witch's pot) | A cauldron of mystery | "Single Drop of Blood" (Theranos' magic box) |
| Khela hobe ("game on") | Battle cry | "It's so over / We're so back", "Founder mode" |
| Bulldozer | Demolition as an identity | "Move fast and break things", the DOGE chainsaw |
| Toll / pothole / E20 | Infrastructure that never quite works | Hyperloop, Boring Company tunnel, a Cybertruck stuck in a car wash |
| Tariff stamp | A trade-war prop | Kept as it is (already global); used by the sidekick, not by Trump himself |
| Chai Break (pause) | A desi pause ritual | "Ice Bath Break" or "Touch Grass Break" (the Indian edition keeps "Chai Break") |
| Mithai khilao (tip) | Pay the dev a sweet | "Buy the dev a matcha" / "Tip in Doge (joke)" |
| The Daily Jumla front page | A fake newspaper after the match | **The Daily Grift**, *The Valuation Times*, *Breaking Bubble*, *TechCrunched* |
| Shor Sharma / Troll Army | Shouting anchor vs troll army | "Brock HotTake" (cable-news shouter) vs "Reply Guy Brigade" (a blue-check bot farm), plus an Indian-edition anchor |
| Crowd vendor "Mithai le lo!" | Ambient vendor shout | US stage: "Get your NFTs! Two for a dollar!"; Indian stage: "Aloo le lo, pyaaz le lo! Startup le lo!" |
| Sutli bomb (Diwali firecracker) | Desi explosive | Cherry bomb / M-80 / Fourth of July firework; we keep "Sutli Bomb" as an Indian-billionaire item |
| Sansad Bhavan stage | Seat of power | **Senate Hearing Room** ("Senator, we run ads") |
| Jantar Mantar (protest ground) | Where the angry public gathers | **Burning Man playa** / Sand Hill Road VC row |
| Desi Sadak | The street | **San Francisco street** with robotaxis and scooters; plus a Mumbai street for the Indian edition |
| Diwali Special | Seasonal live-ops event | Black Friday sale, Met Gala, Super Bowl ad special, "Big Fat Ambani-style Wedding Special" |
| Mbapu boss (moral icon, beaten by patience) | You win by not fighting | **THE AUDITOR** (IRS, or the ED in the Indian edition). Punches don't hurt them; you fill a "Compliance" meter by blocking, and a "Bailout" button replaces Nirmala's Budget. |
| Hinglish voice gags | Code-switch humour | Founder-speak ("let's circle back", "10x", "we're a family"), plus Hinglish for the Indian roster |

---

## 3. Billionaire material (real, attributable statements and public moments)

**Rule: every joke rests on something they publicly said or did.** We don't invent crimes, health claims or private life. Where a claim is legally only an *allegation*, the joke is about the news cycle, not about guilt.

### US / global tech
| Person | Verified public material to riff on |
|---|---|
| **Alex Karp** (Palantir). *You wrote "Alex Kirk"; this is the person with the drone quote.* | Feb 2026, to Andrew Ross Sorkin, on his "lower purpose": he'd love "a drone… having light fentanyl-laced urine spraying on analysts that tried to screw us" (clip on X via @jawwwn_). In 2024 on CNBC he said he loves "burning the short sellers" and claimed short sellers bet against companies "to pay for their coke". His enemies "wake up scared and go to bed scared". He practises qigong and has wild hair. |
| **Elon Musk** | "Funding secured" (2018 tweet, SEC settlement); "Let that sink in" (carrying a sink into Twitter HQ, 2022); the Cybertruck window smash at its 2019 launch; the DOGE chainsaw at CPAC 2025; renaming Twitter to X; "Full self-driving next year" for years; giving ~$290M to Trump-aligned PACs in 2024; Davos 2026 predictions ("more robots than humans"); telling people to skip 401(k)s because of AI (2026). |
| **Mark Zuckerberg** | "Senator, we run ads" (2018 hearing); the metaverse's legless avatars; Hawaii surfing in heavy white sunscreen; the Sweet Baby Ray's "smoking meats" livestream; winning medals in Brazilian jiu-jitsu (**he's genuinely fit**); the cage match with Musk that never happened; "masculine energy" (2025 podcast); $1M to the 2025 inauguration. |
| **Jeff Bezos** | Thanking Amazon employees and customers because "you guys paid for all this" after his 2021 spaceflight; the infamous rocket shape; the 2017 "laugh" meme; turning buff and bald; the 2025 Venice wedding; the two-pizza team rule; $1M to the 2025 inauguration. |
| **Peter Thiel** | His 2025 "Antichrist" lecture series; "I no longer believe that freedom and democracy are compatible" (2009); his interest in young-blood parabiosis (2015 interview); ~$15M to JD Vance's 2022 Senate run. |
| **Sam Altman** | Lowercase tweets; fired and rehired in five days (Nov 2023); Worldcoin's eyeball-scanning Orb; "Feel the AGI"; the $500B Stargate announcement; having said ads in ChatGPT were a "last resort". |
| **Jensen Huang** | The leather jacket; "The more you buy, the more you save"; signing autographs on anything; calling AI criticism "extremely hurtful" (Jan 2026). *Not evil, just quotable.* |
| **Larry Ellison** | "Citizens will be on their best behavior because we are constantly recording" (2024); owning the island of Lanai; yachts; briefly the world's richest person in 2025. |
| **Steve Ballmer** | "Developers developers developers"; the "monkey dance"; endless energy. *Not evil; great comic relief.* |
| **Bryan Johnson** | "Don't Die"; plasma transfusions from his son; 100+ pills a day; measuring everything about his body. |
| **Marc Andreessen** | The Techno-Optimist Manifesto; the egg-shaped-head meme. |

### Indian billionaires
| Person | Verified public material |
|---|---|
| **Mukesh Ambani** | Jio's free data in 2016 (it upended the telecom market); Antilia, the 27-storey home; Anant Ambani's months-long 2024 wedding season with global pop stars; the Vantara animal rescue centre. |
| **Gautam Adani** | Ports, airports, coal and green energy; the Hindenburg short report (Jan 2023), which the group called an "attack on India"; a 2024 US indictment that the group denies. **Treat that indictment as an allegation only; don't joke that he's guilty.** |
| **N. R. Narayana Murthy** | "Young Indians should work 70 hours a week" (2023). He doubled down later, saying he'd worked 85–90 hours himself. |
| **S. N. Subrahmanyan** (L&T) | 90-hour weeks and "how long can you stare at your wife?" (Jan 2025); work on Sundays. |
| **Bhavish Aggarwal** (Ola) | Says he works 20 hours a day, 7 days a week; the "pronoun illness" LinkedIn post (2024); his spat with Kunal Kamra over Ola service centres; the Krutrim AI launch. |
| **Vijay Mallya** | "The King of Good Times"; left India in 2016 and was declared a fugitive economic offender (2019). |
| **Sunny Varkey** | "Work 24/7 to succeed" (Aug 2025). |

### Smaller rich: millionaires who can't fight
Shark Tank judges (Ashneer Grover's "Doglapan", Kevin O'Leary's "You're dead to me"), LinkedIn hustle influencers, crypto bros, MLM uncles, 4 a.m. "morning routine" podcasters, WeWork's Adam Neumann, and the convicted fraud founders SBF and Elizabeth Holmes (their convictions are public record). See the build plan's "Hustle Tier" for how they show up.

---

## 4. Sources
- Sportsdigest, "Sansad Showdown: How To Play The Viral Game": https://sportsdigest.in/sansad-showdown-how-to-play/228377/amp/
- Deccan Herald on Fightkaro: https://www.deccanherald.com/amp/story/india/literally-fight-as-indian-politicians-fightkaro-a-new-political-satire-game-gaining-traction-on-social-media-4205714
- Fan guides (unofficial): https://sansadshowdowngame.com/ (characters, secrets, how-to-beat-mbapu), https://fightkaro.org/characters/, https://fightkaro.org/controls/, https://sansadgame.com/
- Directory listing (tech stack): https://ported2browser.org/games/sansad-showdown/
- Clone repos: https://github.com/sraveshnandan/fight-karo-game, https://github.com/Theaayynn/fightkaro
- Karp's urine-drone quote: https://x.com/jawwwn_/status/2023207418922959234 and https://www.thecanary.co/skwawkbox/2026/02/17/palantir-piss/
- Karp on short sellers: https://www.sherwood.news/tech/the-weirdest-best-unhinged-quotes-from-palantirs-q4-earnings-call/
- 2026 tech quotes: https://www.techbrew.com/stories/2026/01/30/big-tech-quotes-predictions-2026
- Indian work-hours remarks: https://en.wikipedia.org/wiki/S._N._Subrahmanyan, https://www.theregister.com/2024/07/09/ola_founder_70_hour_weeks/, https://www.newsbytesapp.com/news/business/sunny-varkey-sparks-debate-after-saying-success-needs-24-7-work-ethic/story
- Ravi Kishan memes: https://www.outlookindia.com/national/from-jaldi-the-late-to-home-from-work-why-ravi-kishans-viral-clips-keep-taking-over-social-media

Statements in §3 not linked above are long-documented public events (2016–2025) and were taken from general knowledge. Writers should double-check each line against a primary source before shipping it.
