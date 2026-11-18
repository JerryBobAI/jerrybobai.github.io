#!/usr/bin/env python3
"""Convert notes/*.en.vtt (YouTube auto-subs) to notes/*-transcript.md.

Strips WEBVTT headers, cue-timing lines and inline <...> tags, folds all
cue text inside a 5-minute block into one paragraph, and inserts a
`## [x:yy]` anchor (hour:minute) at every 5-minute boundary — three-part
`[h:mm:ss]` once the lecture passes one hour, matching TS_RE semantics.
Output feeds tools/dedup_transcripts.py (idempotent cleanup) next.
"""
import pathlib
import re

NOTES = pathlib.Path(__file__).resolve().parent.parent / "notes"

INLINE_TAG = re.compile(r"<[^>]+>")


def anchor(sec: int) -> str:
    h, rem = divmod(sec, 3600)
    m, _ = divmod(rem, 60)
    if h:
        m = (m // 5) * 5
        return f"[{h}:{m:02d}:00]"
    m = (m // 5) * 5
    return f"[0:{m:02d}]"


def convert(vtt: pathlib.Path) -> None:
    cur_block = 0
    chunks: list[tuple[int, str]] = []
    buf: list[str] = []
    for raw in vtt.read_text(encoding="utf-8", errors="replace").split("\n"):
        line = raw.strip()
        m = re.match(r"^(\d{2}):(\d{2}):(\d{2})\.\d{3}\s*-->", line)
        if m:
            sec = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
            new_block = sec // 300
            if new_block != cur_block and buf:
                chunks.append((cur_block, " ".join(buf)))
                buf = []
            cur_block = new_block
            continue
        if (not line or line == "WEBVTT"
                or line.startswith(("Kind:", "Language:")) or line.isdigit()):
            continue
        text = INLINE_TAG.sub("", line).strip()
        if text:
            buf.append(text)
    if buf:
        chunks.append((cur_block, " ".join(buf)))

    out = [f"# Transcript: {vtt.stem.replace('.en', '')}",
           "",
           "> Auto-generated captions, lightly deduplicated. Time anchors every ~5 min.",
           ""]
    for block, text in chunks:
        out += ["", f"## {anchor(block * 300)}", "", text]
    dest = vtt.with_name(vtt.stem.split("-")[0] + "-transcript.md")
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{dest.name}: {len(chunks)} blocks, {dest.stat().st_size} bytes")


def main() -> None:
    for vtt in sorted(NOTES.glob("*.en.vtt")):
        convert(vtt)


if __name__ == "__main__":
    main()
