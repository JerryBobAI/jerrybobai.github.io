#!/usr/bin/env python3
"""Turn study-guide markdown into a spoken-style narration script.

Drops the header quotes, quiz section and pipeline signature; converts
headings into spoken cues, bullets into sentences and tables into
per-row sentences; strips inline markdown and timestamp anchors. Output
goes to audio/scripts/LXX.txt next to the site.
"""
import pathlib
import re

BASE = pathlib.Path(__file__).resolve().parent.parent
NOTES = BASE / "notes"
OUT = BASE / "audio" / "scripts"

TS = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?(?:–(\d{1,2}):(\d{2})(?::(\d{2}))?)?\]")
LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
SLUGS = {}


def inline(text: str) -> str:
    text = LINK.sub(r"\1", text)
    text = TS.sub("", text)                     # anchors carry no audio info
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)   # bold
    text = re.sub(r"`([^`]*)`", r"\1", text)          # code
    text = text.replace("→", "到").replace("｜", "，")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in sorted(NOTES.glob("*-study-guide.md")):
        num = f.name[:3]
        lines = f.read_text(encoding="utf-8").split("\n")
        out = []
        in_quiz = in_table = False
        table_rows = []
        for line in lines:
            s = line.strip()
            if s.startswith("## "):
                title = s[3:].strip()
                in_quiz = title.startswith("自测题")
                if in_quiz:
                    continue
                if title == "一句话概览":
                    out.append("整体概览。")
                elif "分节要点" not in title:
                    out.append(f"{title}。")
                continue
            if in_quiz or not s or s.startswith(">") or s == "---":
                continue
            if s.startswith("# "):
                t = inline(s[2:])
                t = t.split("：", 1)[1] if "学习笔记" in t and "：" in t else t
                out.append(f"{num} 学习笔记,{t}。")
                continue
            if s.startswith("### "):
                h = TS.sub("", s[4:].strip()).strip()
                out.append(f"下一节,{inline(h)}。")
                continue
            if s.startswith("|"):
                cells = [c.strip() for c in s.strip("|").split("|")]
                if all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
                    continue
                table_rows.append(cells)
                in_table = True
                continue
            if in_table and table_rows:
                out.append(table_to_sentence(table_rows))
                table_rows = []
                in_table = False
            if s.startswith(("- ", "* ")):
                out.append(inline(s[2:]) + "。")
            elif re.match(r"^\d+\.\s", s):
                out.append(inline(re.sub(r"^\d+\.\s*", "", s)) + "。")
            else:
                out.append(inline(s) + "。")
        if table_rows:
            out.append(table_to_sentence(table_rows))
        text = "\n".join(x for x in out if x.strip())
        text = re.sub(r"。{2,}", "。", text)
        text = text.replace(",", ",").replace(";", ";")
        (OUT / f"{num}.txt").write_text(text, encoding="utf-8")
        print(f"{num}.txt: {len(text)} chars")


def table_to_sentence(rows: list) -> str:
    head = rows[0]
    body = rows[1:] if len(rows) > 1 else [head]
    parts = []
    for row in body:
        cells = [c for c in row if c]
        parts.append(",".join(inline(c) for c in cells))
    return "对比:" + ";".join(parts) + "。"


if __name__ == "__main__":
    main()
