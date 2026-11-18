#!/usr/bin/env python3
"""Dedupe auto-caption artifacts in notes/*-transcript.md.

Rolling-caption overlap repeats fragments as A B A B ..., sometimes across
line and cue boundaries, and cues leak SRT timing lines ("00:34:56.700 -->
..."). All body text feeds one rolling token buffer, so the longest adjacent
repeated run collapses even across paragraph and list-item breaks; a
repeated single token only drops when it ends in punctuation (echoes like
"systems. systems."). Headings, quotes and blank lines pass through
untouched; list items are cleaned after their marker. Idempotent.
"""
import pathlib
import re

NOTES = pathlib.Path(__file__).resolve().parent.parent / "notes"

STRUCT_LINE = re.compile(r"^(#|>)")
LIST_PREFIX = re.compile(r"^(\s*(?:[-*+]|\d+\.)\s+)")
SRT_CUE = re.compile(r"\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\s*align:start position:0%\s*")
SPACE_PUNCT = re.compile(r" +([,.;:!?])")


def clean_doc(src: str) -> str:
    out = []
    buf = []  # rolling token context that survives line and item breaks

    for line in src.split("\n"):
        if not line.strip() or STRUCT_LINE.match(line):
            out.append(line.rstrip())
            continue
        prefix = ""
        body = line.strip()
        m = LIST_PREFIX.match(body)
        if m:
            prefix, body = m.group(1), body[m.end():]
        body = SPACE_PUNCT.sub(r"\1", re.sub(r"\s+", " ", SRT_CUE.sub(" ", body)).strip())
        kept = []
        i = 0
        words = body.split()
        while i < len(words):
            best = 0
            top = min(40, len(buf), len(words) - i)
            for k in range(top, 0, -1):
                if buf[-k:] == words[i:i + k]:
                    if k == 1 and not re.search(r"[.!?,;:]$", words[i]):
                        continue
                    best = k
                    break
            if best:
                i += best  # caption echo: skip the repeated run
            else:
                kept.append(words[i])
                buf.append(words[i])
                i += 1
        out.append(prefix + " ".join(kept) if kept else prefix.rstrip())
    return "\n".join(out)


def main():
    total_before = total_after = 0
    for f in sorted(NOTES.glob("*-transcript.md")):
        src = f.read_text(encoding="utf-8")
        dst = clean_doc(src)
        f.write_text(dst, encoding="utf-8")
        total_before += len(src)
        total_after += len(dst)
        print(f"{f.name}: {len(src)} -> {len(dst)} bytes")
    print(f"total: {total_before} -> {total_after} bytes")


if __name__ == "__main__":
    main()
