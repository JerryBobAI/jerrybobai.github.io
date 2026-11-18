#!/usr/bin/env python3
"""Playwright headless regression for the cme295 study hub.

Default: structural checks (progress bar, quiz folding, paper links,
share-build self-containment).  --full adds video seek / float-panel
checks — run only after all lecture mp4s are on disk.
Zero console errors / pageerrors is a hard gate."""
import json
import pathlib
import re
import subprocess
import sys

BASE = pathlib.Path(__file__).resolve().parent.parent
HUB = BASE / "study-hub"
FULL = "--full" in sys.argv

from playwright.sync_api import sync_playwright


def n_mp4() -> int:
    return len(list((BASE / "lectures").glob("*.mp4")))


def n_m4a() -> int:
    return len(list((BASE / "audio").glob("*.m4a")))


def main() -> None:
    errors: list[str] = []
    results: list[str] = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        results.append(f"{'PASS' if ok else 'FAIL'} {label}" + (f" — {detail}" if detail and not ok else ""))
        if not ok:
            errors.append(f"{label}: {detail}")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        console_errs: list[str] = []
        page.on("console", lambda m: console_errs.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: console_errs.append(str(e)))

        # ---------- local build ----------
        page.goto(f"file://{HUB}/index.html")
        page.wait_for_timeout(800)

        # progress bar
        body = page.inner_text("body")
        m = re.search(r"(\d+)\s*/\s*6\s*讲", body)
        check("progress bar shows x/6 讲", bool(m), body[:80])
        ready_note = page.locator(".brand, header, body").first.inner_text()

        # quiz details exist & collapsed (inside lecture view — SPA views)
        page.click("#nav-L01")
        page.wait_for_timeout(300)
        check("L01 view activates", page.locator("#view-L01.active").count() == 1)
        quizzes = page.locator("#view-L01 details.quiz").all()
        check("quiz details elements exist in L01 view", len(quizzes) >= 1, f"found {len(quizzes)}")
        if quizzes:
            check("first quiz collapsed by default", not quizzes[0].get_attribute("open"))
            quizzes[0].locator("summary").click()
            page.wait_for_timeout(200)
            got = page.evaluate("localStorage.getItem('cme295-quiz')")
            check("expanding quiz writes cme295-quiz", bool(got), str(got))

        # mark-done persistence (button inside lecture view)
        done_btns = page.locator("#view-L01 [data-done], #view-L01 .done-btn, #view-L01 button:has-text('已读'), #view-L01 .mark-done").all()
        if done_btns:
            done_btns[0].click()
            page.wait_for_timeout(200)
            check("mark-done writes cme295-done", bool(page.evaluate("localStorage.getItem('cme295-done')")))
        else:
            results.append("SKIP mark-done (no button matched generic selectors)")

        # audio bars == disk m4a count
        audio_bars = page.locator(".audio-bar, audio, [data-audio]").count()
        check("audio bars == disk m4a count", audio_bars == n_m4a(), f"page={audio_bars} disk={n_m4a()}")

        # paper links: lecture pages mount only papers whose filename matches
        # PAPER_MAP; papers.html lists the whole library (disk count)
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
        from build_site import PAPER_MAP
        frags = [f for lst in PAPER_MAP.values() for f in lst]
        expected_mounted = sum(1 for f in (BASE / "readings" / "arxiv").glob("*.pdf")
                               if any(frag in f.name for frag in frags))
        pdf_links = page.locator('a[href*="readings/arxiv"]').count()
        check(f"lecture-mounted paper links == {expected_mounted} (PAPER_MAP matches)",
              pdf_links == expected_mounted, f"found {pdf_links}")

        n_pdfs = len(list((BASE / "readings" / "arxiv").glob("*.pdf")))
        page.goto(f"file://{HUB}/papers.html")
        page.wait_for_timeout(400)
        papers_view = page.locator("li").count()
        check(f"papers.html lists whole library ({n_pdfs})", papers_view == n_pdfs, f"found {papers_view}")

        # local video elements present when mp4s on disk
        if FULL:
            page.goto(f"file://{HUB}/index.html")
            page.wait_for_timeout(500)
            vids = page.locator("video").count()
            check("video elements == disk mp4s", vids == n_mp4(), f"page={vids} disk={n_mp4()}")
            # timestamp click -> currentTime changes (inside L01 view)
            page.click("#nav-L01")
            page.wait_for_timeout(400)
            # the first anchor [0:00] legitimately seeks to 0 — pick one >= 2 min in
            target = page.evaluate("""() => {
              for (const a of document.querySelectorAll('#view-L01 a.ts[data-t]')) {
                const t = parseInt(a.dataset.t);
                if (t >= 120) return t;
              }
              return null;
            }""")
            if target:
                ts = page.locator(f'#view-L01 a.ts[data-t="{target}"], '
                                  f'#view-L01 a.ts[data-t^="{target}-"]').first
                ts.scroll_into_view_if_needed()
                ts.click()
                page.wait_for_timeout(600)
                cur = page.evaluate("""() => { const v = document.querySelector('video'); return v ? v.currentTime : -1 }""")
                check(f"timestamp click seeks video (to {target}s)",
                      cur != -1 and target - 2 <= cur <= target + 30,
                      f"target={target} currentTime={cur}")
                # float panel: scroll lecture body so video leaves viewport
                page.evaluate("window.scrollTo(0, document.body.scrollHeight * 0.6)")
                page.wait_for_timeout(400)
                fp = page.locator(".float-panel").count()
                check("video floats into .float-panel on scroll", fp == 1, f"float panels: {fp}")
                close = page.locator(".float-close")
                if close.count():
                    close.click()
                    page.wait_for_timeout(300)
                    paused = page.evaluate("() => { const v = document.querySelector('video'); return v.paused }")
                    kept = page.evaluate("() => { const v = document.querySelector('video'); return v.currentTime }")
                    check("float-close pauses but keeps currentTime", bool(paused) and kept > 1, f"paused={paused} t={kept}")
            else:
                check("timestamp anchors present", False, "no a.ts[data-t]")

        local_console = [e for e in console_errs if "net::ERR" not in e or FULL]
        # file:// missing mp4s raise net::ERR noise only when FULL-less; filter media load errors
        local_console = [e for e in local_console if "MEDIA" not in e and "net::ERR" not in e]
        check("local build: zero console errors", not local_console, "; ".join(local_console[:3]))

        # ---------- share build ----------
        page2 = browser.new_page()
        spage_errs: list[str] = []
        page2.on("console", lambda m: spage_errs.append(m.text) if m.type == "error" else None)
        page2.on("pageerror", lambda e: spage_errs.append(str(e)))
        page2.goto(f"file://{HUB}/share.html")
        page2.wait_for_timeout(800)
        shtml = page2.content()

        check("share title contains 分享版", "分享版" in page2.title(), page2.title())
        # rendered-element checks (content() includes <script> source text —
        # conditional template literals legitimately remain there)
        dom_bad = page2.locator(
            'a[href^="../lectures"], a[href^="../audio"], a[href^="../readings"], '
            'a[href^="../anki"], [src^="../lectures"], [src^="../audio"]').count()
        check("share DOM has no local asset refs (rendered)", not dom_bad, str(dom_bad))
        check("share DOM has no papers.html link (rendered)",
              page2.locator('a[href="papers.html"]').count() == 0)
        check("share DOM has no transcripts/ links (rendered)",
              page2.locator('a[href^="transcripts/"]').count() == 0)
        # timestamps -> youtu.be
        yt_ts = page2.locator('a.ts[href*="youtu.be"]').count()
        check("share timestamps link to youtu.be?t=", yt_ts >= 7, f"found {yt_ts}")
        # cover cards, zero iframes
        n_iframe = page2.locator("iframe").count()
        check("share build has zero iframes (cover cards)", n_iframe == 0, f"{n_iframe} iframes")
        # inlined transcripts details
        tx_details = page2.locator("details").count()
        check("share inlined transcript details >= 9", tx_details >= 9, f"{tx_details}")
        # no apkg download
        check("share has no .apkg download (rendered)",
              page2.locator('a[href*=".apkg"]').count() == 0)

        s_errs = [e for e in spage_errs if "MEDIA" not in e and "net::ERR" not in e]
        check("share build: zero console errors", not s_errs, "; ".join(s_errs[:3]))

        browser.close()

    print("\n".join(results))
    print(f"\n{'ALL PASS' if not errors else f'{len(errors)} FAILURES'}  (mode: {'full' if FULL else 'structural'})")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
