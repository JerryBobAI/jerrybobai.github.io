#!/usr/bin/env python3
"""Convert manual CC vtt captions to notes/LXX-transcript.md.

Manual CC tracks (*.en-en-*.vtt) are human-uploaded: no rolling-caption
echo, no <c> word tags, plain cues. Parse cues, join into one flowing
paragraph per ~5 min anchor. Anchor headings use two-part [h:mm] semantics
(hour:minute), matching build_site.ts_seconds. Run dedup_transcripts.py
after this; it is idempotent and handles any residual artifacts.
"""
import pathlib
import re

NOTES = pathlib.Path(__file__).resolve().parent.parent / "notes"
STEP = 300  # anchor every 5 minutes

TIME = re.compile(r"^(\d{1,2}):(\d{2}):(\d{2})[\.,]\d{3}\s*-->")
TAG = re.compile(r"<[^>]+>")


def parse(path):
    cues = []
    cur_start = None
    cur_text = []
    for line in path.read_text(encoding="utf-8").split("\n"):
        line = line.strip()
        m = TIME.match(line)
        if m:
            if cur_start is not None and cur_text:
                cues.append((cur_start, " ".join(cur_text).strip()))
            cur_start = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            cur_text = []
            continue
        if cur_start is None:
            continue  # WEBVTT header / NOTE / cue index
        t = TAG.sub("", line).replace("&nbsp;", " ").replace("&gt;", ">").replace("&lt;", "<").strip()
        if t:
            cur_text.append(t)
    if cur_start is not None and cur_text:
        cues.append((cur_start, " ".join(cur_text).strip()))
    return cues


def anchor(sec):
    return f"## [{sec // 3600}:{sec % 3600 // 60:02d}]"


def convert(vtt):
    slug = re.sub(r"\.en\.vtt$", "", vtt.name)
    cues = parse(vtt)
    if not cues:
        print(f"{slug}: NO CUES, skipped")
        return
    out = [
        f"# Transcript: {slug}",
        "",
        "> Manual captions, lightly deduplicated. Time anchors every ~5 min.",
        "",
        anchor(0),
        "",
    ]
    cur = 0
    para = []
    for start, text in cues:
        if start >= cur + STEP:
            out.append(" ".join(para))
            out.append("")
            cur = start - start % STEP
            out.append(anchor(cur))
            out.append("")
            para = []
        para.append(text)
    if para:
        out.append(" ".join(para))
    dst = NOTES / f"{slug[:3]}-transcript.md"
    dst.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{dst.name}: {len(cues)} cues, last at {cues[-1][0]}s")


def main():
    for v in sorted(NOTES.glob("*.en.vtt")):
        convert(v)


if __name__ == "__main__":
    main()
