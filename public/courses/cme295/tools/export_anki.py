#!/usr/bin/env python3
"""Export study-guide quizzes to an Anki deck (.apkg).

Each lecture becomes a subdeck CME295::LXX Title; each quiz item becomes
one card: front = question, back = answer, inline markdown (**bold**,
`code`) rendered with the same engine as the site. Timestamps stay as
plain text on the cards. Output: anki/cme295-quiz.apkg (regeneratable).
"""
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_site import load_lectures, parse_quiz, NOTES, OUT  # noqa: E402

import markdown  # noqa: E402

try:
    import genanki
except ImportError:
    sys.exit("genanki missing: pip3 install --user genanki")

BASE = OUT.parent.parent
OUT_APKG = BASE / "anki" / "cme295-quiz.apkg"

MODEL_ID, DECK_ID = 1607392319, 2059400110

CSS_CARD = """
.card{font-family:-apple-system,'PingFang SC','Segoe UI',sans-serif;font-size:16px;
  color:#1a1a1a;background:#faf9f7;padding:18px 20px;text-align:left;line-height:1.65}
.q{font-weight:600}
.src{margin-top:10px;font-size:12px;color:#8a8a8a}
hr#answer{border:none;border-top:1px solid #ddd;margin:14px 0}
.night_mode .card,.nightMode .card{color:#e8e6e3;background:#26262a}
"""


def inline_html(text: str) -> str:
    return markdown.markdown(text, output_format="html5")


def main():
    lectures = load_lectures()
    decks, total = {}, 0
    model = genanki.Model(
        MODEL_ID, "CME295 Quiz",
        fields=[{"name": "Question"}, {"name": "Answer"},
                {"name": "Source"}, {"name": "Extra"}],
        templates=[{
            "name": "QA",
            "qfmt": '<div class="q">{{Question}}</div>{{#Source}}<div class="src">{{Source}}</div>{{/Source}}',
            "afmt": '{{FrontSide}}<hr id="answer">{{Answer}}',
        }],
        css=CSS_CARD,
    )
    for lec in lectures:
        md = (NOTES / f"{lec['slug']}-study-guide.md").read_text(encoding="utf-8")
        items = parse_quiz(md)
        if not items:
            continue
        deck = genanki.Deck(DECK_ID + int(lec["slug"][1:]),
                            f"CME295::{lec['slug'][:3]} {lec['title']}")
        decks[deck.name] = deck
        for i, it in enumerate(items):
            note = genanki.Note(
                model=model,
                fields=[inline_html(it["q"]), inline_html(it["a"]),
                        f"{lec['slug'][:3]} · {lec['title']}",
                        f"[{lec['slug'][:3]}] {lec['title']}"],
                guid=genanki.guid_for(lec["slug"], str(i)),
                tags=[lec["slug"][:3]],
            )
            deck.add_note(note)
            total += 1
    OUT_APKG.parent.mkdir(parents=True, exist_ok=True)
    genanki.Package(list(decks.values())).write_to_file(str(OUT_APKG))
    print(f"OK -> {OUT_APKG}  ({total} cards across {len(decks)} decks)")


if __name__ == "__main__":
    main()
