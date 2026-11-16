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
