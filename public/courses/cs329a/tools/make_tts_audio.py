#!/usr/bin/env python3
"""Synthesize narration scripts into per-lecture audio via the local
VoxCPM2 speak server (127.0.0.1:3917).

Splits each audio/scripts/LXX.txt into chunks at section cues (hard-cut
on sentence ends past the cap), synthesizes each chunk to
audio/parts/LXX-NN.wav (existing parts are kept, so the batch resumes),
then concatenates parts into audio/LXX.wav with the stdlib wave module.
"""
import argparse
import json
import pathlib
import re
import time
import urllib.request
import wave

BASE = pathlib.Path(__file__).resolve().parent.parent
SCRIPTS = BASE / "audio" / "scripts"
PARTS = BASE / "audio" / "parts"
OUT = BASE / "audio"
SERVER = "http://127.0.0.1:3917/speak"
# bypass system proxies: the speak server is loopback-only
OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
CAP = 800          # max chars per request
SECTION = re.compile(r"^下一节,")


def chunks_of(text: str) -> list:
    paras = [p for p in text.split("\n") if p.strip()]
    blocks, cur = [], ""
    for p in paras:
        if SECTION.match(p) and len(cur) > CAP // 2:
            blocks.append(cur.strip())
            cur = ""
        cur += p
        if len(cur) >= CAP:                     # hard cut at a sentence end
            m = None
            for m_ in re.finditer(r"[。!?]", cur[CAP:]):
                m = m_
                break
            if m:
                cut = CAP + m.end()
            else:
                cut = len(cur)
            blocks.append(cur[:cut].strip())
            cur = cur[cut:]
    if cur.strip():
        blocks.append(cur.strip())
    return blocks


def synth(text: str, voice: str, dest: pathlib.Path) -> dict:
    body = json.dumps({"text": text, "voice": voice, "out": str(dest)}).encode()
    req = urllib.request.Request(SERVER, data=body,
                                 headers={"Content-Type": "application/json"})
    with OPENER.open(req, timeout=1800) as r:
        return json.loads(r.read())


def concat(parts: list, dest: pathlib.Path):
    with wave.open(str(parts[0]), "rb") as w0:
        params = w0.getparams()
    with wave.open(str(dest), "wb") as out:
        out.setparams(params)
        for p in parts:
            with wave.open(str(p), "rb") as w:
                out.writeframes(w.readframes(w.getnframes()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="luyu")
    ap.add_argument("--lectures", default="L01,L02,L03,L04,L05,L06,L07,L08")
    args = ap.parse_args()
    PARTS.mkdir(parents=True, exist_ok=True)

    for num in args.lectures.split(","):
        script = SCRIPTS / f"{num}.txt"
        if not script.exists():
            print(f"{num}: no script, skip")
            continue
        text = script.read_text(encoding="utf-8")
        blocks = chunks_of(text)
        parts = []
        redo_audio = False
        for i, blk in enumerate(blocks):
            part = PARTS / f"{num}-{i:02d}.wav"
            if not part.exists():
                t0 = time.time()
                meta = synth(blk, args.voice, part)
                print(f"  {num}-{i:02d}: {meta['duration']:.0f}s audio "
                      f"({time.time()-t0:.0f}s wall, {len(blk)} chars)", flush=True)
            else:
                print(f"  {num}-{i:02d}: cached", flush=True)
            parts.append(part)
        dest = OUT / f"{num}.wav"
        concat(parts, dest)
        with wave.open(str(dest), "rb") as w:
            dur = w.getnframes() / w.getframerate()
        print(f"{num}: -> {dest} {dur/60:.1f} min, {len(parts)} parts", flush=True)


if __name__ == "__main__":
    main()
