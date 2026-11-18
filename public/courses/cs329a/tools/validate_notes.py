#!/usr/bin/env python3
"""Validate study-guide format: anchors monotone & within lecture length,
quiz section well-formed and parseable by the site's own parse_quiz
(single source of truth for both site folding and Anki export)."""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_site import TS_RE, ts_seconds, parse_quiz, QUIZ_HEAD, LECTURES

BASE = pathlib.Path(__file__).resolve().parent.parent
NOTES = BASE / "notes"

# lecture durations in seconds (YouTube flat-playlist)
DUR = {"L01": 4182, "L02": 3801, "L03": 4379, "L04": 4273, "L05": 4496,
       "L06": 4359, "L07": 4347, "L08": 4518, "L09": 4062}


def quiz_section_raw(md: str) -> str:
    m = QUIZ_HEAD.search(md)
    if not m:
        return ""
    rest = md[m.start():]
    nxt = re.search(r"\n---\s*\n|\n## (?!自测题)", rest[1:])
    return rest[:nxt.start() + 1] if nxt else rest


def check(slug: str) -> list[str]:
    errs = []
    f = NOTES / f"{slug}-study-guide.md"
    if not f.exists():
        return [f"{slug}: missing {f.name}"]
    md = f.read_text(encoding="utf-8")

    # required sections
    for pat, label in [(r"^##\s+一句话概览", "一句话概览"),
                       (r"^##\s+.*(核心概念|速查)", "核心概念速查"),
                       (r"^##\s+自测题", "自测题")]:
        if not re.search(pat, md, re.M):
            errs.append(f"{slug}: missing section {label}")

    # transcript link (accept the real per-lecture filename, not just slug stem)
    if not re.search(r"\]\([^)]*transcript\.md\)", md):
        errs.append(f"{slug}: no transcript link")

    # anchors: monotone within the lecture-notes body only — the concept-card
    # table legitimately cites earlier anchors, so monotonicity applies to
    # everything before the 核心概念 section.
    body = re.split(r"\n## .*(?:核心概念|速查)", md)[0]
    secs = [ts_seconds(m) for m in TS_RE.finditer(body)]
    if not secs:
        errs.append(f"{slug}: no time anchors found")
    else:
        for a, b in zip(secs, secs[1:]):
            if b < a:
                errs.append(f"{slug}: anchor regression {a}->{b}s")
                break
        if secs[-1] > DUR[slug] + 30:
            errs.append(f"{slug}: anchor {secs[-1]}s > lecture {DUR[slug]}s")
        if secs[0] > 600:
            errs.append(f"{slug}: first anchor {secs[0]}s suspiciously late")
    # every anchor anywhere in the file (incl. concept-card citations) must
    # still point inside the lecture
    over = [s for s in (ts_seconds(m) for m in TS_RE.finditer(md)) if s > DUR[slug] + 30]
    if over:
        errs.append(f"{slug}: anchor(s) beyond lecture length: {over[:2]}")

    # quiz raw format: 3-space blockquotes; blank lines only warn (cs329z
    # L02 ships with them and folds fine) — the hard check is rendered HTML
    qraw = quiz_section_raw(md).rstrip()
    if qraw:
        qbody = qraw.split("\n", 1)[1] if "\n" in qraw else ""  # skip title line
        if re.search(r"\n\s*\n", qbody):
            print(f"WARN {slug}: blank line inside quiz section")
        bad_q = [ln for ln in qraw.split("\n") if ln.strip().startswith(">") and not ln.startswith("   >")]
        if bad_q:
            errs.append(f"{slug}: blockquote not 3-space indented: {bad_q[0][:50]}")
        # hard check: rendered quiz must keep every blockquote a direct child
        # of <li> (site folding selector is `li > blockquote`)
        from build_site import render_md
        html = render_md(qraw)
        n_li_bq = len(re.findall(r"<li>(?:(?!</li>).)*?<blockquote>", html, re.S))
        n_bq = html.count("<blockquote>")
        if n_bq and n_li_bq < n_bq:
            errs.append(f"{slug}: rendered quiz broke folding: {n_li_bq}/{n_bq} blockquote direct in li")
        if n_bq < len(parse_quiz(md)):
            errs.append(f"{slug}: rendered quiz lost answers ({n_bq} bq vs {len(parse_quiz(md))} items)")
    else:
        errs.append(f"{slug}: quiz section not found")

    # same-source parse: quiz count via the site's parser
    items = parse_quiz(md)
    if not 5 <= len(items) <= 9:
        errs.append(f"{slug}: parse_quiz got {len(items)} items (want 6-8)")
    return errs


def main() -> None:
    slugs = sys.argv[1:] or [l["slug"] for l in LECTURES]
    all_errs = []
    for slug in slugs:
        errs = check(slug)
        items = parse_quiz((NOTES / f"{slug}-study-guide.md").read_text(encoding="utf-8")) \
            if (NOTES / f"{slug}-study-guide.md").exists() else []
        status = "PASS" if not errs else "FAIL"
        print(f"{status} {slug}  quiz={len(items)}  {'; '.join(errs) if errs else ''}")
        all_errs += errs
    print(f"\n{'ALL PASS' if not all_errs else f'{len(all_errs)} problems'}")
    sys.exit(1 if all_errs else 0)


if __name__ == "__main__":
    main()
