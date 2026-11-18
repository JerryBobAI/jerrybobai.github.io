#!/usr/bin/env python3
"""Validate study-guide notes: anchor monotonicity + quiz format.

Two historic fire pits:
- two-part [x:yy] means hour:minute (total minutes); >=1h must be [h:mm:ss]
- quiz lines: `N. stem` then EXACTLY-3-space-indented `> answer`,
  no blank lines inside the quiz block
"""
import pathlib
import re
import sys

NOTES = pathlib.Path(__file__).resolve().parent.parent / "notes"

TS = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?(?:–(\d{1,2}):(\d{2})(?::(\d{2}))?)?\]")
QUIZ_ITEM = re.compile(r"^(\d+)\. (.+)$")
ANSWER = re.compile(r"^   > (.+)$")

def secs(h, m, s):
    return h * 3600 + m * 60 + int(s or 0)

fail = 0
for f in sorted(NOTES.glob("L*-study-guide.md")):
    problems = []
    src = f.read_text(encoding="utf-8")

    # ---- anchors: monotonic non-decreasing, semantics per notes-format ----
    anchors = []
    for m in TS.finditer(src):
        v = secs(int(m.group(1)), int(m.group(2)), m.group(3))
        # format rule: >=1h must be written three-part
        if v >= 3600 and m.group(3) is None:
            problems.append(f"anchor {m.group(0)} >=1h but two-part (semantics trap)")
        anchors.append((m.group(0), v))
    for i in range(1, len(anchors)):
        if anchors[i][1] < anchors[i - 1][1]:
            problems.append(f"anchor regression: {anchors[i-1][0]} -> {anchors[i][0]}")
    if anchors and anchors[-1][1] > 4 * 3600:  # lecture <2h; 4h = clearly wrong semantics
        problems.append(f"last anchor {anchors[-1][0]} beyond any plausible lecture length")

    # ---- quiz block: starts at "## 自测题", ends at --- or next ## ----
    lines = src.split("\n")
    in_quiz = False
    quiz_lines = []
    for i, ln in enumerate(lines):
        if ln.startswith("## 自测题"):
            in_quiz = True
            continue
        if in_quiz and (ln.strip() == "---" or ln.startswith("## ")):
            in_quiz = False
        if in_quiz:
            quiz_lines.append((i + 1, ln))

    n_stem = n_ans = 0
    # the blank line(s) right after the ## heading are legal markdown,
    # not part of the quiz block
    while quiz_lines and not quiz_lines[0][1].strip():
        quiz_lines.pop(0)
    for k, (lineno, ln) in enumerate(quiz_lines):
        if not ln.strip():
            # blank line inside quiz: ok only directly before trailing ---
            after = [l for _, l in quiz_lines[k + 1:] if l.strip()]
            if not (len(after) == 0 or (len(after) == 1 and after[0].strip() == "---")):
                problems.append(f"quiz blank line at {lineno} (breaks li>blockquote folding)")
            continue
        if QUIZ_ITEM.match(ln):
            n_stem += 1
        elif ANSWER.match(ln):
            n_ans += 1
        elif ln.strip().startswith(">"):
            problems.append(f"line {lineno}: blockquote indent not exactly 3 spaces")
        else:
            problems.append(f"line {lineno}: unexpected content in quiz: {ln[:40]}")
    if n_stem != n_ans:
        problems.append(f"quiz stems={n_stem} != answers={n_ans}")
    if not 6 <= n_stem <= 8:
        problems.append(f"quiz count {n_stem} outside 6-8")

    tag = "OK " if not problems else "FAIL"
    print(f"{tag} {f.name}: {len(anchors)} anchors, quiz {n_stem}q")
    for p in problems:
        print(f"     - {p}")
        fail += 1

sys.exit(1 if fail else 0)
