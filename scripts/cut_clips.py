#!/usr/bin/env python3
"""Cut voice clips from recordings/ into public/audio/voice/.

For each clip: take a rough window from the full transcript, get word-level
timestamps for that window with whisper, trim to the first and last words of
the wanted line, normalise loudness, then re-transcribe the result as a check.

Usage: recordings/.venv/bin/python scripts/cut_clips.py   (needs ffmpeg; pip install mlx-whisper in that venv)
"""
import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REC, OUT = os.path.join(ROOT, "recordings"), os.path.join(ROOT, "public/audio/voice")

# id, source file, rough start (s), rough end (s), first words, last words
CLIPS = [
    ("tusk_heart",        "musk_rally",       77, 83,  "my heart",          "out to you"),
    ("tusk_heart_long",   "musk_rally",       77, 89,  "my heart",          "is assured"),
    ("tusk_chainsaw",     "musk_chainsaw",    35, 42,  "this is the",       "for bureaucracy"),
    ("tusk_chainsaw_yell","musk_chainsaw",    41.6, 46, "chainsaw",         "chainsaw"),
    ("tusk_blackmail",    "musk_dealbook",    28, 39,  "if",                "yourself"),
    ("tusk_dealbook",     "musk_dealbook",    28, 47,  "if",                "that clear"),
    ("tusk_gfy",          "musk_dealbook",    38, 47,  "go",                "that clear"),
    ("tusk_omg",          "musk_cybertruck",  80, 86,  "oh",                "god"),
    ("tusk_too_hard",     "musk_cybertruck",  82, 90,  "well maybe",        "too hard"),
    ("tusk_plus_side",    "musk_cybertruck",  91, 98,  "it didn't",         "plus side"),
    ("tusk_empathy",      "musk_empathy",      0, 7,   "the fundamental",   "is empathy"),
    ("tusk_two_years",    "musk_fsd",         75, 90,  "i think we're",     "complete autonomy"),
    ("tusk_next_year",    "musk_fsd",        126, 137, "i think probably",  "next year"),
    ("teal_hesitation",   "thiel_douthat",  2296, 2311,"you would prefer",  "would i would"),
    ("teal_long_hes",     "thiel_douthat",  2308.5, 2311.4,"this is a long", "hesitation"),
    ("teal_losers",       "thiel_competition", 43, 49, "competition is",    "for losers"),
    ("teal_monopoly",     "thiel_competition", 32, 49, "you always want",   "for losers"),
    ("teal_how_much_time","thiel_douthat",  2759, 2764,"how much",          "we have"),
    ("teal_long_time",    "thiel_douthat",  2766, 2772,"i could talk",      "long time"),
    ("teal_greta",        "thiel_douthat",  2993, 3001,"in our world",      "thunberg"),
    ("teal_armageddon",   "thiel_douthat",  2901, 2913,"you have the",      "armageddon"),
    # Sidekick Policy Moves.
    ("covfefe_maga",      "trump_inaugural", 1000, 1009,"together",         "great again"),
    ("veep_cat_ladies",   "vance_cats",       94, 103, "a bunch of",        "own lives"),
    # Jeff Bozo, Madame Producer (Melania) and Sam Ultman: candidates for their Supers / Policy Move.
    ("bozo_paid",         "bezos_paid",        14, 30, "i want to thank",    "all of this"),
    ("bozo_paid_short",   "bezos_paid_ctv",    66, 75, "you guys",           "for all this"),
    ("bozo_paid_long",    "bezos_paid_ctv",    64, 75, "every amazon",       "for all this"),
    ("melania_here_we_go","melania_trailer",    0, 6,  "here we go",         "again"),
    ("melania_peacemaker","melania_trailer",   12, 19, "i promise",          "peacemaker"),
    ("melania_here_it_is","melania_trailer",   36, 50, "everyone",           "here it is"),
    ("melania_be_best",   "melania_bebest",    28, 40, "so today",           "be best"),
    ("ultman_quite_wrong","altman_wrong",     416, 426, "if this technology", "quite wrong"),
    ("ultman_last_resort","altman_harvard",  2385, 2393, "i kind of think",   "business model"),
    ("ultman_end_world",  "altman_end_world",   1, 12, "i think ai",         "machine learning"),
    ("ultman_end_short",  "altman_end_world",   1, 9,  "i think ai",         "the world"),
    ("ultman_this_era",   "altman_stargate",  546, 553, "i think this",      "this era"),
    ("ultman_agi_here",   "altman_stargate",  546, 561, "i think this",      "mr president"),
    # More Jeff Bozo.
    ("bozo_best_day",     "bezos_bestday",    146, 160, "best day",           "ever"),
    ("bozo_day_two",      "bezos_day1",        25, 51, "day two",            "by death"),
    ("bozo_day_one",      "bezos_day1",        52, 63, "and that",           "day one"),
    ("bozo_always_day_one","bezos_day1",       55, 63, "it is always",       "day one"),
    ("bozo_optimistic",   "bezos_dealbook",     1, 12, "i'm actually",       "this time around"),
    ("bozo_help_him",     "bezos_dealbook",    13, 24, "if i can help",      "going to help him"),
    ("bozo_cant_guarantee","bezos_hearing",    26, 32, "but i can't",        "been violated"),
    ("bozo_policy",       "bezos_hearing",     16, 32, "i can't answer",     "been violated"),
    ("bozo_dont_remember","bezos_hearing",    116, 123, "i cannot",          "remember it"),
    # Alex Carp (Alex Karp) and his sidekick Pete Hexseth (Pete Hegseth).
    ("carp_lower_purpose","karp_urine",         0, 5,   "you need",          "lower purpose"),
    ("carp_urine",        "karp_urine",         7.5, 17, "well i love",      "screw us"),
    ("carp_urine_tag",    "karp_urine",        17.5, 21, "so that's",        "lower purpose"),
    ("carp_doing_it",     "karp_kill",          5.5, 9.5, "we're doing",     "doing it"),
    ("carp_crushing",     "karp_kill",         40, 45.5, "every",            "crushing it"),
    ("carp_kill",         "karp_kill",         63, 75.5, "palantir is",      "kill them"),
    ("carp_kill_short",   "karp_kill",         70, 75.5, "scare enemies",    "kill them"),
    ("carp_misunderstand","karp_burry",        51, 55.5, "well there",       "misunderstand myself"),
    ("carp_poorer",       "karp_burry",       225.5, 237, "every time",      "them poorer"),
    ("carp_be_my_guest",  "karp_burry",       420.5, 427, "if you want",     "my guest"),
    ("carp_dancing",      "karp_burry",       478.5, 485.5, "i'm going to",  "proven wrong"),
    ("carp_batshit",      "karp_burry",       612, 619, "the idea that",     "crazy"),
    ("hexseth_texting",   "hegseth_texting",   86.5, 92, "nobody",           "about that"),
    ("hexseth_texting_short","hegseth_texting", 86.5, 91, "nobody",          "war plans"),
    ("hexseth_lethality", "hegseth_dow",       72.5, 81.5, "maximum",        "politically correct"),
    ("hexseth_back",      "hegseth_dow",       84.5, 100, "so this war",     "we're back"),
    ("hexseth_were_back", "hegseth_dow",       98.5, 101, "we're back",      "we're back"),
    ("hexseth_resign",    "hegseth_woke",      46, 57,   "if the words",     "and resign"),
    # Jacket Jensen (Jensen Huang) and his sidekick Howard Lootnick (Howard Lutnick).
    ("jensen_more_buy",   "huang_more_buy",    13.5, 19.5, "the more you buy", "you save"),
    ("jensen_common_sense","huang_more_buy",    0, 14.5, "this is like",      "money you save"),
    ("jensen_ceo_math",   "huang_computex",    16, 22.5, "it is not",         "ceo math"),
    ("jensen_pain",       "huang_pain",        67, 76,   "and so i would",    "suffering"),
    ("jensen_pain_short", "huang_pain",        71, 76,   "i wish upon you plenty", "and suffering"),
    ("jensen_howard",     "lutnick_testify",  496, 506,  "the reason why",    "industry quickly"),
    ("lootnick_say_no",   "lutnick_testify",   89, 94.5, "when we say",       "be no"),
    ("lootnick_fourth_best","lutnick_testify", 481.5, 491, "we don't sell",   "we're cool"),
    ("lootnick_addicted", "lutnick_testify",  413.5, 421.5, "you want to sell", "technology stack"),
    ("lootnick_whack_a_mole","lutnick_testify",1404, 1419, "what this showed", "over there"),
    ("covfefe_spy",       "lutnick_testify",  160, 174.6, "the big thing",    "be different"),
    ("kennedy_spy",       "lutnick_testify",  214.5, 231.5, "i mean i'm not",  "chinese spy"),
    # Mork Zuckerbot (Mark Zuckerberg) and his sidekick Dana Wite (Dana White).
    ("mork_roadmap",      "zuck_legs",        290.3, 297.6, "there's one more", "legs"),
    ("mork_legs",         "zuck_legs",        300.8, 304,  "legs",              "waiting for this"),
    ("mork_legs_full",    "zuck_legs",        296.2, 304,  "legs",              "waiting for this"),
    ("mork_legs_hard",    "zuck_legs",        305.3, 311.3, "but seriously",    "don't have them either"),
    ("mork_run_ads",      "zuck_ads",          36.3, 40.6, "senator we run",   "run ads"),
    ("mork_run_ads_long", "zuck_ads",          31.4, 44.4, "well if so",       "that's great"),
    ("mork_masculine",    "zuck_masculine",    24.5, 31.7, "there's something", "is good"),
    ("mork_aggression",   "zuck_masculine",    45.4, 54.1, "and i think having", "really positive"),
    ("mork_beat",         "zuck_masculine",    67.1, 71.4, "we just",           "it's good"),
    ("mork_neutered",     "zuck_masculine",     0, 9.6,  "for me",            "culturally neutered"),
    ("mork_ribs",         "zuck_meats",        29.8, 35.4, "maybe throw",      "from there"),
    ("mork_ribs_short",   "zuck_meats",        17.1, 19.1, "that is going",    "the ribs"),
    ("wite_animal",       "white_board",       36, 50,   "so zuckerberg",     "an animal"),
    ("wite_nine_to_six",  "white_board",       44, 57,   "these board",       "till six"),
    ("wite_shut_up",      "white_board2",      36.8, 49, "i'm going to shut", "first board meeting"),
    ("wite_why_here",     "white_board2",      43, 46.2, "i go",              "why i'm here"),
]

norm = lambda s: re.sub(r"[^a-z' ]", "", s.lower()).split()

def run(*a): return subprocess.run(a, check=True, capture_output=True, text=True).stdout

def words(wav):
    """Word-level timestamps. mlx-whisper's are accurate to about 0.1 s; whisper-cli's are not."""
    import mlx_whisper
    r = mlx_whisper.transcribe(wav, path_or_hf_repo="mlx-community/whisper-large-v3-turbo", word_timestamps=True, language="en")
    out = []
    for seg in r["segments"]:
        for w in seg["words"]:
            for t in norm(w["word"]):
                out.append((t, w["start"], w["end"]))
    return out

def find(ws, phrase, end=False, after=0.0):
    """Start time of the first match of `phrase`, or (end=True) the end time of the first match after `after`."""
    p = norm(phrase)
    for i in range(len(ws) - len(p) + 1):
        if [w[0] for w in ws[i:i + len(p)]] == p and ws[i][1] >= after:
            return ws[i + len(p) - 1][2] if end else ws[i][1]
    return None

def main():
    os.makedirs(OUT, exist_ok=True)
    only = set(sys.argv[1:])
    manifest = {}
    with tempfile.TemporaryDirectory() as tmp:
        for cid, src, a, b, first, last in CLIPS:
            if only and cid not in only: continue
            seg = os.path.join(tmp, cid + ".wav")
            run("ffmpeg", "-v", "error", "-y", "-ss", str(a), "-to", str(b), "-i", f"{REC}/{src}.m4a", "-ar", "16000", "-ac", "1", seg)
            ws = words(seg)
            s = find(ws, first)
            e = None if s is None else find(ws, last, end=True, after=s)
            if s is None or e is None or e <= s:
                print(f"!! {cid}: could not align ({' '.join(w[0] for w in ws)})"); continue
            s, e = max(0, s - 0.06), e + 0.12
            dst = f"{OUT}/{cid}.mp3"
            run("ffmpeg", "-v", "error", "-y", "-ss", f"{a + s:.2f}", "-to", f"{a + e:.2f}", "-i", f"{REC}/{src}.m4a",
                "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=0.03", "-ac", "1", "-ar", "44100", "-b:a", "96k", dst)
            chk = os.path.join(tmp, cid + "_chk.wav")
            run("ffmpeg", "-v", "error", "-y", "-i", dst, "-ar", "16000", "-ac", "1", chk)
            text = " ".join(w[0] for w in words(chk))
            manifest[cid] = {"file": f"/audio/voice/{cid}.mp3", "seconds": round(e - s, 2), "heard": text, "source": src}
            print(f"{cid:20s} {e - s:5.2f}s  {text}")
    # A partial run (clip ids on the command line) updates those entries and keeps the rest.
    path = f"{OUT}/manifest.json"
    if only and os.path.exists(path): manifest = {**json.load(open(path)), **manifest}
    json.dump(manifest, open(path, "w"), indent=2)

main()
