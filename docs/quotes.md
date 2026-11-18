# Quote list: first two fighters (draft 1)

Every voiced line in the game is a clip of the person saying it, so each line needs a recording, not just a written source. **Status** says how sure the wording is:

- **Checked** = wording confirmed in a source I read today.
- **Known** = widely documented and I'm confident of the wording, but I haven't re-checked it today.
- **Lead** = I know roughly what was said; the exact words must be taken from the recording.
- **Text only** = he wrote it, never said it aloud. Shown on screen (as a post card), not voiced.

Final wording for every line gets fixed when the clip is cut: what's in the audio is what goes in the subtitle.

---

## Melon Tusk (Elon Musk)

| # | Line | Where and when | Status | Use in game |
|---|---|---|---|---|
| 1 | "My heart goes out to you." | Inauguration rally, Capital One Arena, 20 Jan 2025, said right after the straight-arm gesture | Checked | **Signature: "My Heart Goes Out"** — he thumps his chest and throws the arm out; the arm is the hit |
| 2 | "This is the chainsaw for bureaucracy!" | CPAC, 20 Feb 2025 | Checked | **Signature: Chainsaw** — 3D chainsaw sweep |
| 3 | "Go f— yourself. … Is that clear?" | NYT DealBook Summit, 29 Nov 2023, to advertisers | Known | **Super** opener (bleeped or not: your call) |
| 4 | "Oh my f—ing God. Well, maybe that was a little too hard." | Cybertruck unveiling, 21 Nov 2019, after the window broke | Known | **Signature: Window Test** — throws the steel ball; when the move is Fact-Checked, this is the backfire line |
| 5 | "Room for improvement." | Same event | Known | Line when he gets hit hard |
| 6 | "The fundamental weakness of Western civilization is empathy." | Joe Rogan Experience, 28 Feb 2025 | Known | Taunt after a knockdown |
| 7 | A "full self-driving … next year" promise (there are many; pick the clearest recording) | Various, 2016–2023 | Lead | **Signature: Self-Driving** — he charges, stops short, then hits |
| 8 | "Milei gave me the chainsaw backstage and I ran with it, but, in retrospect, it lacked empathy." | Post on X, Jul 2025 | Text only | Post card shown when the chainsaw move gets Fact-Checked |
| 9 | "Am considering taking Tesla private at $420. Funding secured." | Tweet, 7 Aug 2018 | Text only | Post card in the **Super: Funding Secured** |
| 10 | "Entering Twitter HQ – let that sink in!" | Tweet with video, 26 Oct 2022 | Text only | Post card for **Signature: The Sink**. If no recording exists of him *saying* it, this stays a silent post card plus the 3D sink |
| 11 | "What am I apologizing for?" (on paying others to level up his game accounts) | Private message published by a YouTuber, Jan 2025 | Lead, second-hand | Possible line when his Engagement crashes; only if a recording of him on the topic exists |
| 12 | Humans as the "biological bootloader" for digital superintelligence | Tweet 2014; repeated on X, Oct 2026 | Lead | Win line, if he has said it on tape |

**The straight-arm gesture.** It happened on camera and was widely described as resembling a Nazi salute; he denied that's what it was. The game shows the gesture and plays his own words over it, and the ticker reports it the way the press did ("Critics call it a salute. He calls it his heart."). The game doesn't state what he meant.

**Not using: his father.** What's on record is that Errol Musk had children with his *stepdaughter* (not Elon's sister, and they didn't marry). It's about his father's private life, not anything Elon said or did, so it stays out. His insecurity is easy to show from his own record instead:
- After a Super Bowl tweet got fewer views than the President's, 80 engineers were told to boost his posts; his tweets were pushed by a factor of 1,000 (Platformer, Feb 2023).
- He admitted paying others to level up his game characters while streaming as a top player (Jan 2025).
- He was booed on stage at a comedy show (Dec 2022).

These drive his version of the popularity meter (see the plan).

---

## Peter Teal (Peter Thiel)

| # | Line | Where and when | Status | Use in game |
|---|---|---|---|---|
| 1 | Asked "You would prefer the human race to endure, right?": "Uh—" … "Well, I don't know. I would— I would—" | Interesting Times with Ross Douthat (NYT), Jun 2025 | Checked | **His defining move: "The Hesitation"** — he freezes mid-fight for a long beat. It's his block/counter stance, and his out-of-breath line |
| 2 | "Competition is for losers." | Stanford "How to Start a Startup" lecture, 2014 (also a WSJ essay title) | Known; confirm he says the exact phrase aloud | **Signature: Monopoly** — intro line too |
| 3 | An Antichrist line from his lecture series (e.g. that the Antichrist would be someone who wants to stop technology) | San Francisco lectures, Sep–Oct 2025; also the Douthat interview | Lead | **Super: The Antichrist Lecture** — lectern rises, four-part lecture |
| 4 | "We wanted flying cars, instead we got 140 characters." | Founders Fund manifesto; he has said it in talks | Known; need a recording | Taunt |
| 5 | On tech executives keeping their own families off their products | Aspen Ideas, 27 Jun 2024 | Lead | Line when he Fact-Checks someone |
| 6 | Whatever the "proud of being evil" moment is | Cambridge Union, 10 Jul 2024 | Lead | Win line |
| 7 | "I no longer believe that freedom and democracy are compatible." | Cato Unbound essay, 2009 | Text only | Shown as an on-screen card during a signature |
| 8 | On being interested in young-blood transfusion research | Inc. magazine interview, 2016 | Text only | Card for **Signature: Young Blood** (drains health) |

---

## Clips cut so far (16 Nov 2026)

Cut from the original recordings by `scripts/cut_clips.py` into `public/audio/voice/`. "Heard" is a machine transcription of the finished clip, used as a check. **I can't listen to audio, so please play each one**: the wording and length are verified, but not whether a clip starts or ends cleanly, or how much crowd noise is in it.

| Clip | Length | Heard in the clip | Planned use |
|---|---|---|---|
| `tusk_heart` | 1.7 s | "My heart goes out to you." | Signature: the straight-arm move |
| `tusk_heart_long` | 8.3 s | "My heart goes out to you. It is thanks to you that the future of civilization is assured." | Alternative Super clip |
| `tusk_chainsaw` | 3.8 s | "This is the chainsaw for bureaucracy." | Signature: Chainsaw |
| `tusk_chainsaw_yell` | 1.3 s | "Chainsaw!" | Bark on the chainsaw hit |
| `tusk_blackmail` | 5.5 s | "If somebody's going to try to blackmail me with advertising, blackmail me with money, go f— yourself." | Super, first half |
| `tusk_gfy` | 4.2 s | "Go f— yourself. Is that clear?" | Super, second half |
| `tusk_dealbook` | 14.6 s | The whole exchange, including the long silence in the middle | Reference only; too long as one piece |
| `tusk_omg` | 2.1 s | "Oh my God." | When his own move is Fact-Checked |
| `tusk_too_hard` | 3.4 s | "Well, maybe that was a little too hard." | After he lands a heavy hit |
| `tusk_plus_side` | 2.5 s | "It didn't go through, so that's a plus side." | When he blocks |
| `tusk_empathy` | 5.3 s | "The fundamental weakness of Western civilization is empathy." | Taunt after a knockdown |
| `tusk_two_years` | 7.6 s | "I think we're basically less than two years away from complete autonomy." | Signature: Self-Driving (long version) |
| `tusk_next_year` | 3.3 s | "I think probably by the end of next year…" | Signature: Self-Driving |
| `teal_hesitation` | 11.4 s | "You would prefer the human race to endure, right?" / "You're hesitating." / "Yes? I don't know. I would… I would…" | Super: The Hesitation |
| `teal_long_hes` | 1.6 s | (interviewer) "This is a long hesitation." | Plays when he stalls |
| `teal_losers` | 1.5 s | "Competition is for losers." | Signature: Monopoly; intro line |
| `teal_monopoly` | 10.2 s | "You always want to aim for monopoly, and you want to always avoid competition. And so, hence, competition is for losers." | Alternative Super clip |
| `teal_how_much_time` | 1.1 s | "How much time do we have?" | Opens the Antichrist lecture move |
| `teal_long_time` | 2.1 s | "I could talk about it for a long time." | Second beat of the lecture move |
| `teal_greta` | 4.0 s | "In our world, it's far more likely to be Greta Thunberg." | Punchline of the lecture move |
| `teal_armageddon` | 5.7 s | "You have the one-world state of the Antichrist, or we're sleepwalking towards Armageddon." | Body of the lecture move |
| `covfefe_maga` | 4.8 s | "Together, we will make America great again." | Sidekick Uncle Covfefe's Policy Move "Make Tariffs Great Again". From the 2017 inaugural address (ABC News full-speech upload, YouTube sRBsJNdK1t0, about 16:40) |
| `veep_cat_ladies` | 3.3 s | "…by a bunch of childless cat ladies who are miserable at their own lives…" | Sidekick Hillbilly Veep's Policy Move "Cat Lady Barrage". From Tucker Carlson Tonight, Jul 2021 (his Senate campaign's upload, YouTube Ry_pkfj9sN0, about 1:35) |

Notes:
- The DealBook and Cybertruck recordings are **broadcast versions with the swearing bleeped**. An unbleeped DealBook cut would come from the NYT's full event video.
- `tusk_empathy` comes from a commentary video that opens with the Rogan clip, not from the full episode. Worth re-cutting from the original episode later.
- The "self-driving" clips come from a compilation video; the original interviews and dates still need identifying.
- Still without a recording: the Cambridge Union and Aspen lines for Thiel, and anything Musk only typed.

## What I need to finish this list
1. Your ears on the clips above.
2. Your pick on the DealBook line: bleeped (what we have) or uncensored.

**Recordings to fetch:** Trump inauguration rally 20 Jan 2025 · CPAC 20 Feb 2025 · DealBook Summit 29 Nov 2023 · Cybertruck unveiling 21 Nov 2019 · Joe Rogan #2281 (28 Feb 2025) · Interesting Times with Peter Thiel (Jun 2025) · Stanford CS183B lecture 5 (2014) · Thiel at Cambridge Union (Jul 2024) · Thiel at Aspen Ideas (Jun 2024).

Sources checked today: [NPR on the gesture and the line](https://www.ctpublic.org/2025-01-23/elon-musk-tried-to-turn-the-salute-controversy-into-a-joke) · [chainsaw line and later regret](https://www.mediaite.com/media/news/elon-musk-admits-infamous-chainsaw-stunt-was-a-mistake-it-lacked-empathy) · [Thiel hesitation transcript](https://thenation.com/article/society/peter-thiel-billionaires-abandoning-humanity) · [engineers boosting his tweets](https://platformer.news/yes-elon-musk-created-a-special-system/) · [game account boosting](https://gigazine.net/gsc_news/en/20250122-elon-musk-boost-accounts)

---

## Alex Carp (Alex Karp) and sidekick Pete Hexseth (Pete Hegseth): clips cut 19 Nov 2026

Recordings in `recordings/` (YouTube IDs in brackets):
- `karp_urine`: 40 s excerpt of an interview where he's asked "What's a lower purpose?" [fZ_65R7yG6k]. Press coverage names Andrew Ross Sorkin as the interviewer; the full original still needs identifying (**Lead**).
- `karp_kill`: closing remarks of Palantir's Q4 2024 earnings call, 3 Feb 2025 [G5gC_fParbY].
- `karp_burry`: CNBC, morning after the Q3 2025 results, Nov 2025 [mqa1yEd891o]. The "bat-shit" is unbleeped in this upload.
- `hegseth_texting`: C-SPAN, Hawaii, 24 Mar 2025, the day the Atlantic Signal-chat story broke [Ym7_3ESCpSg].
- `hegseth_dow`: ABC News, Oval Office order renaming the Pentagon the "Department of War", 5 Sep 2025 [JWgcndjkUGs].
- `hegseth_woke`: WFAA, Quantico speech to senior officers, 30 Sep 2025 [mMh2vpKMBtk]. Only the "resign" line is used; the "dudes in dresses" line in the same speech is left out (punches down).

| Clip | Length | Heard in the clip | Planned use |
|---|---|---|---|
| `carp_lower_purpose` | 4.3 s | "You need a higher purpose and I also think you often need a lower purpose." | Super opener |
| `carp_urine` | 8.2 s | "Well, I love the idea of getting a drone and having light fentanyl-laced urine spraying on analysts who tried to screw us." | **Super: Lower Purpose** (body) |
| `carp_urine_tag` | 1.7 s | "So that's my lower purpose." | Super payoff |
| `carp_kill` | 11.7 s | "Palantir is here to disrupt … and when it's necessary to scare enemies and on occasion kill them." | Reference / long version |
| `carp_kill_short` | 2.7 s | "Scare enemies and on occasion kill them." | **Signature: On Occasion** |
| `carp_poorer` | 7.2 s | "…every time they short us, we just are like tripling down on getting the better numbers, in part, honestly, to make them poorer." | **Signature: Make Them Poorer** |
| `carp_be_my_guest` | 4.2 s | "If you want to short that, be my guest." | Short version of the above |
| `carp_doing_it` | 1.6 s | "We're doing it!" | **Signature: Earnings Call** (start) |
| `carp_crushing` | 2.8 s | "Every Palantirian, we are crushing it." | **Signature: Earnings Call** (hit) |
| `carp_batshit` | 5.3 s | "The idea that chips and ontology is what you want to short is bat-shit crazy." | Taunt |
| `carp_dancing` | 3.7 s | "And I'm going to be dancing around when it's proven wrong." | Win line |
| `carp_misunderstand` | 3.7 s | "Well, there are lots of easy ways to misunderstand me. I misunderstand myself." | Line when he gets hit hard / is Fact-Checked |
| `hexseth_texting` | 5.1 s | "Nobody was texting war plans, and that's all I have to say about that." | **Policy Move: Group Chat** |
| `hexseth_texting_short` | 3.8 s | "Nobody was texting war plans." | Tag-in voice |
| `hexseth_lethality` | 7.8 s | "Maximum lethality, not tepid legality. Violent effect, not politically correct." | Alternative Policy Move / banter |
| `hexseth_back` | 15.1 s | "So this War Department, Mr. President, just like America, is back. … brought to you by the War Department. We're back." | Trim later; tag-out line ("We're back.") |
| `hexseth_resign` | 8.5 s | "If the words I'm speaking today are making your heart sink, then you should do the honorable thing and resign." | Taunt at a low-health opponent |

### Proposed moves (draft, not built)
- **Super: LOWER PURPOSE** (owner's pick). Karp bounces on his toes and delivers `carp_lower_purpose`. A Palantir-grey drone rises, locks on (targeting reticle with an "ANALYST" tag), and sprays the opponent; `carp_urine` plays over it. Payoff `carp_urine_tag`. Stamp: "PRICE TARGET: DOWNGRADED." The spray stays a cartoon yellow stream; the fentanyl part lives only in his own words and a "LIGHTLY LACED" warning label on the drone tank.
- **Signature 1: On Occasion.** A targeting grid flashes over the opponent, then a short-range strike. `carp_kill_short`. Melee, knockdown.
- **Signature 2: Make Them Poorer.** A counter stance: if the opponent attacks during it (they "short" him), he triples down and hits back for extra. `carp_poorer`, or `carp_be_my_guest` as the short version. Fits his Ego meter: getting attacked fuels him.
- **Signature 3: Earnings Call.** A hyper jumping flurry, his on-stage bouncing turned into a three-hit combo. `carp_doing_it` then `carp_crushing`.
- **Taunt:** `carp_batshit`. **Win:** `carp_dancing`.
- **Hexseth Policy Move: Group Chat.** He thumbs his phone; a chat card pops up ("Signal: WAR PLANS 🇺🇸, *you* were added"). The opponent has been added by mistake and stops to read it: a stun of about 2 s while the bubbles pile up over their head. `hexseth_texting` plays as he pockets the phone.

---

## Jacket Jensen (Jensen Huang) and sidekick Howard Lootnick (Howard Lutnick); Mork Zuckerbot (Mark Zuckerberg) and sidekick Dana Wite (Dana White): clips cut 19 Nov 2026

Sidekicks locked by the owner, 19 Nov 2026. Real links: Lutnick's Commerce Department controls Nvidia's chip exports to China, and Huang called him "the person I talk to most in the administration". Dana White joined Meta's board in Jan 2025.

**News this rests on (Nov 2026):** Huang resigned as Nvidia CEO around 12 Nov 2026, after reports of an affair with a woman at Megaspeed (an Nvidia customer) whom US intelligence suspects of spying for China, and then a second affair. The stock fell about 36%, close to $1T. In a written statement he admitted "serious mistakes in my personal life". The spy part is an **allegation**, so the game frames it as a news ticker, never as fact. It doesn't name or show the women. Huang testifies on 3 Dec and Lutnick on 10 Dec. Sources: Bloomberg [9xP22C0pHZE], CBS [MFD3ilY51zs], Sky [GKyrZyy5sPc], NBC [jgB5UxN4pkU].

Recordings in `recordings/` (YouTube IDs in brackets):
- `huang_more_buy`: GTC 2018 keynote supercut [XDpDesU_0zo]. `huang_computex`: Computex 2024 [ZuslzLNS5ec]. `huang_pain`: Stanford GSB, Mar 2024 (clip upload) [J2ZcBR_6mV4].
- `lutnick_testify`: a news compilation of original clips (confirmation hearing Jan 2025; CNBC Jul 2025; Trump and Sen. Kennedy, Nov 2026) [yLXKlCyrxD4]. Swap in the originals later if the quality isn't good enough. `jensen_howard` comes from this compilation, and its event and date are still a **Lead**.
- `zuck_legs`: Meta Connect 2022 legs segment (CNET highlights) [njvp-E8gzqA].
- `white_board`, `white_board2`: Dana White on joining Meta's board, Forbes clips [mrI06qAax_k, FELib7VsDwE].

| Clip | Heard | Planned use |
|---|---|---|
| `jensen_common_sense` | "This is like common sense. The more GPUs you buy, the more money you save." | **Super: Trillion-Dollar Affair** opener |
| `jensen_pain_short` | "I wish upon you plenty of pain and suffering." | Super payoff |
| `jensen_more_buy` | "The more you buy, the more you save." | Signature: The More You Buy |
| `jensen_ceo_math` | "It is not accurate, but it is correct. Okay, that's called CEO math." | Signature: CEO Math |
| `jensen_pain` | "…I wish upon you greatness, which by my way of saying it, I wish upon you plenty of pain and suffering." | Signature: Pain and Suffering |
| `jensen_howard` | "The reason why Howard is the person I talk to most in the administration…" | Tag call |
| `lootnick_fourth_best` | "We don't sell them our best stuff, not our second best stuff, not even our third best. I think fourth best is where we've come out that we're cool." | **Policy Move: Fourth Best** |
| `lootnick_say_no` | "When we say no, the answer's got to be no." | Tag-in |
| `lootnick_addicted`, `lootnick_whack_a_mole` | export-control lines | spares |
| `covfefe_spy` | Trump: "…if the woman was a spy, yes. If the woman was not a spy, perhaps it would be different." | spare (Super cameo) |
| `kennedy_spy` | Sen. Kennedy: "…you ought to make sure it's not with a Chinese spy." | spare (Super ticker voice) |
| `mork_roadmap` → `mork_legs_full` → `mork_legs_hard` | "…the most requested feature on our roadmap: legs." / "Legs! I know you've been waiting for this." / "But seriously, legs are hard…" | **Super: Metaverse Exile** |
| `wite_nine_to_six` | "These board meetings start at nine o'clock in the morning. They go till six." | **Policy Move: Board Meeting** |
| `wite_animal` | "So Zuckerberg is an animal." | Tag-in |
| `wite_why_here`, `wite_shut_up` | board-meeting lines (the second is uncensored) | spares |
| `mork_run_ads` | "Senator, we run ads." | **Signature: Senator, We Run Ads** (added 19 Nov 2026) |
| `mork_run_ads_long` | Sen. Hatch: "Well, if so, how do you sustain a business model in which users don't pay for your service?" / "Senator, we run ads." / "I see. That's great." | Intro / long version |
| `mork_masculine` | "There's something… the kind of masculine energy, I think, is good." | **Signature: Masculine Energy** (`zuck_masculine`, Jan 2025 podcast) |
| `mork_beat` | "…we're just like beat each other a bit. I don't know, it's good." | Masculine Energy bark, taunt |
| `mork_aggression`, `mork_neutered` | "…a culture that celebrates the aggression a bit more…" / "…the corporate world is pretty culturally neutered." | spares |
| `mork_ribs` | "Maybe throw some Sweet Baby Ray's on the ribs and take it from there." | **Signature: On the Ribs** (`zuck_meats`, smoked-meats livestream) |
| `mork_ribs_short` | "That is going on the ribs." | Block bark |

Recording `zuck_ads`: NBC News upload of the Senate Commerce and Judiciary hearing, 10 Apr 2018 [n2H8wx1aBiQ].
