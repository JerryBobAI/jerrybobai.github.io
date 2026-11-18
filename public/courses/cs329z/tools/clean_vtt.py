#!/usr/bin/env python3
"""Clean YouTube auto-caption VTT into a readable transcript with time anchors."""
import re
import sys

def vtt_time_to_sec(ts: str) -> float:
    h, m, s = ts.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)

def fmt(sec: float) -> str:
    h = int(sec // 3600)
    m = int(sec % 3600 // 60)
    return f"{h}:{m:02d}"

def main(path: str, out: str):
    text = open(path, encoding="utf-8").read()
    # Strip WEBVTT header
    text = re.sub(r"^WEBVTT.*?\n\n", "", text, flags=re.S)
    blocks = re.split(r"\n\n+", text.strip())
    words_by_min = {}  # minute -> list of words
    for block in blocks:
        lines = [l for l in block.splitlines() if l.strip()]
        if not lines or "-->" not in lines[0]:
            continue
        start = vtt_time_to_sec(lines[0].split("-->")[0].strip().split(".")[0])
        # Auto-captions repeat the previous cue and append new words.
        # The deduped new content is the last non-empty line of the block.
        content = lines[-1]
        content = re.sub(r"<[^>]+>", "", content)  # strip inline tags
        content = content.replace("&nbsp;", " ").strip()
        if not content:
            continue
        minute = int(start // 60)
        words_by_min.setdefault(minute, []).append(content)

    with open(out, "w", encoding="utf-8") as f:
        f.write(f"# Transcript: {path.split('/')[-1].replace('.en.vtt', '')}\n\n")
        f.write("> Auto-generated captions, lightly deduplicated. Time anchors every ~5 min.\n\n")
        for minute in sorted(words_by_min):
            if minute % 5 == 0:
                f.write(f"\n## [{fmt(minute * 60)}]\n\n")
            f.write(" ".join(words_by_min[minute]) + "\n")
    print(f"OK -> {out}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
