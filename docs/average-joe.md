# Average Joe: design draft (20 Nov 2026)

A **boss** (CPU only), and the only fighter who isn't a billionaire. Modelled on the owner (`docs/concepts/joe_sheet.webp`, model `public/models/characters/joe.glb`). The final boss above him is **THE AUDITOR** (IRS), not built yet (build-plan §7.9). Until the Arcade ladder exists, Joe is fought by clicking his BOSS tile on the select screen, which makes him the CPU. A normal guy in a hoodie and jeans who wandered into a fight between people worth more than his country.

**The hook: nothing they have works on him.** Joe has no Super. Every billionaire's Super starts as normal (title card, the real clip), then Joe cuts it off with a one-line retort, a real newspaper headline about the billionaire drops in as the prop, and the Super falls apart. Joe takes no damage. He has to win with his fists.

## Stats (as built)

| | Joe | Why |
|---|---|---|
| Health | 170 | Boss. The billionaires top out at 106; the Auditor is spec'd at 200. |
| Fitness | 1.35 | Works two jobs. |
| Power | 1.25× | `BOSS_POWER`. |
| Signatures, Super, sidekick | none | Fists only. |
| Their Supers | deflected | Cut off by a retort and a headline. 0 damage; the caller is left winded. |
| Their signatures and Policy Moves | negated | The move plays, then a one-line retort (`NEGATES` in `src/game/data/joe.ts`). 0 damage, no knockdown. |
| Win line | "Back to my 9-to-5." | |

Tuned against a skilled player (a billionaire on normal stats played by the Hostile Takeover AI): on Intern the player wins about 4 in 5, on Founder Joe wins about 6 in 10, and on Hostile Takeover Joe wins nearly all. (Every signature now holds its opponent frozen until its line ends, which costs Joe fighting time; hence the higher numbers.) A test keeps Founder above 50% for Joe and Intern below.

## How a deflected Super plays

1. **Contact and title card**, exactly as now. The billionaire's real clip starts.
2. **Record scratch** at about 2 to 3 seconds. The clip cuts out, the stage lights come back up.
3. **Joe's retort** as a speech bubble (written, not voiced, unless the owner records it).
4. **The headline drops in as the prop**: a newspaper front page with a real headline about the billionaire, plus a venue-and-date source stamp, the way posts and news tickers are shown now.
5. **The billionaire's reaction beat**: they shrink, sulk or run off (Mork goes shy, lizard tongue and all).
6. **Closing stamp**, then back to the fight. Joe takes 0 damage; the attacker loses the Super and the meter as usual.

A deflection runs about 6 to 8 seconds, shorter than a full Super, so the fight keeps moving.

## The seven deflections

Each retort riffs on something public. Each headline is a paraphrase of real reporting on an invented masthead ("THE DAILY AVERAGE"), never a real paper's words; the stamp under it gives where and when. Per [[no-repeated-moves-in-super]], none of these reuse a billionaire's own signature or Super gags.

| Billionaire's Super | Cut at | Joe's retort | Headline (the prop) | Reaction | Stamp |
|---|---|---|---|---|---|
| Space Karen Tusk · FUNDING SECURED | "blackmail me with money" | "I sold my Tesla." | Tesla sales slump in Europe as buyers turn away | Tusk refreshes his phone, nobody reposts | RATIO'D. |
| Antichrist Teal · THE HESITATION | the pause | "I'll answer it: yes. Humans should survive. Next." | Billionaire's longevity spending (young-blood transfusion reports) | Teal keeps hesitating at an empty chair | ANSWERED. |
| Prime Bozo · BEST DAY EVER | the laugh | "My package came three days late." | Warehouse workers' bathroom-break reports | Bozo's rocket sputters and tips over | RETURN TO SENDER. |
| Hype-Man Sam · WITHOUT YOU, MR. PRESIDENT | "most important project" | "I asked your chatbot. It said you were fired." | Board fires CEO, "not consistently candid" (Nov 2023) | Ultman checks his badge; it doesn't scan | NOT CONSISTENTLY CANDID. |
| Drone Carp · LOWER PURPOSE | "lower purpose" | "I'm not an analyst. I'm not anything. You can't target me." | (to pick: a public surveillance-contract headline) | The drone can't lock on; a "NO DATA" card | NO DATA FOUND. |
| Jacket Jensen · TRILLION-DOLLAR AFFAIR | "I know people have affairs" | "I never put money in the stock market. I don't trust any of you." | Nvidia loses ~$490B after affair reports | The crash arrow bends back and hits Jensen | NO POSITION. |
| Lizard Mork · METAVERSE EXILE | "most requested feature" | "Your headset cost more than my rent. I couldn't buy it." | Then the crowd chants: "Lizard! Lizard!" | Mork blinks sideways, goes red and runs off stage | PRICED OUT. |

## Sidekicks against Joe (owner's call, 20 Nov 2026)

Every sidekick tagged in against Joe is a **lame duck**: half the tag time, then out for the round. Each one gets their own exchange as they walk in: Joe's line, then their comeback (`COUNTERS` in `src/game/data/joe.ts`), and their own banner when they leave.

| Sidekick (billionaire) | Joe | Comeback | Banner | Riffs on |
|---|---|---|---|---|
| Uncle Covfefe (Tusk, Ultman) | "You said prices come down on day one. It's day 670." | "Prices are way down. Everybody's saying it." | PROMISE PENDING | the 2024 "starting on day one" price promise |
| Hillbilly Veep (Teal) | "I'm just here to buy some donuts." | "Can we… not film this?" | NO DONUT | the Aug 2024 donut-shop visit |
| Madame Producer (Bozo) | "I don't watch reality shows." | "It is a documentary. Forty million dollars." | NOT STREAMING | the $40M documentary (owner's line) |
| Pete Hexseth (Carp) | "Weren't you on weekend TV? I used to fall asleep to you." | "Best job I ever had. Don't tell anyone." | OFF THE AIR | years co-hosting weekend morning TV |
| Howard Lootnick (Jensen) | "My mom calls when her Social Security is late. Every time." | "Only fraudsters call. Everybody knows that." | MOM CALLED | Mar 2025 mother-in-law remark |
| Dana Wite (Mork) | "I'm not buying another streaming app to watch you." | "It's in the bundle, bro. Everything's in the bundle." | UNSUBSCRIBED | UFC leaving pay-per-view for streaming, 2026 |

### The blue wave: only for the MAGA move

Democrats won both chambers in the 3 Nov 2026 midterms, widely called the biggest blue wave since Watergate. On 18 Nov 2026, at DealBook, Musk said "I'm not sure what MAGA means" and that he felt "pretty foolish" about the roughly $400M he spent on the midterms.

So only when Uncle Covfefe plays his MAGA Policy Move ("Make Tariffs Great Again") against Joe: Joe negates it ("Great again? I'd settle for affordable again."), then a curling blue wave rises behind Joe, rolls past him, scoops Covfefe up onto its crest and carries him off the stage, and sinks into the floor. The crowd flips blue. Covfefe panics ("Lame duck, reporting for duty."), is **voted out** 2 seconds after the hit (`WAVE_EXIT_FRAMES`), and the billionaire disowns him (Tusk: "I'm not sure what MAGA means.").

## Decided

- **Model:** the owner makes it in Meshy from their own photo (GLB, Mixamo skeleton). Until then Joe uses a stand-in body.
- **Voice:** written bubbles for now; recordings can drop in later.
- **Signatures:** none. Fists only.
