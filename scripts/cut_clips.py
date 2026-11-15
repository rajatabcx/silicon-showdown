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
    if not only: json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=2)

main()
