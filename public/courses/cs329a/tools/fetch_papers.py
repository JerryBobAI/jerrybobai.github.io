#!/usr/bin/env python3
"""Batch-download CS329A paper readings into readings/arxiv/.
Papers with a known arxiv id download directly; id=None entries resolve
via arxiv API title search (first hit). AlphaCode 2 (Google tech report,
no arxiv) goes to readings/articles/. Every PDF is verified with `file`
and a minimum-size check."""
import pathlib
import re
import subprocess
import urllib.request
import urllib.parse

BASE = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/cs329a")
ARXIV = BASE / "readings" / "arxiv"
ARTICLES = BASE / "readings" / "articles"
ARXIV.mkdir(parents=True, exist_ok=True)
ARTICLES.mkdir(parents=True, exist_ok=True)

# (title, arxiv_id_or_None)
PAPERS = [
    # L02 test-time compute
    ("Large Language Monkeys - Scaling Inference Compute with Repeated Sampling", "2407.21787"),
    ("Archon - An Architecture Search Framework for Inference-Time Techniques", "2409.15246"),
    ("Scaling LLM Test-Time Compute Optimally Can be More Effective than Scaling Model Parameters", "2408.03314"),
    ("How Do Large Language Monkeys Get Their Power (Laws)", None),
    # L03 robust verification
    ("Shrinking the Generation-Verification Gap with Weak Verifiers", None),
    ("Training Verifiers to Solve Math Word Problems", "2110.14168"),
    ("Lets Verify Step by Step", "2305.20050"),
    ("Math-Shepherd - Verify and Reinforce LLMs Step-by-step without Human Annotations", "2312.08935"),
    # L04 feedback with tools/code
    ("ReAct - Synergizing Reasoning and Acting in Language Models", "2210.03629"),
    ("RLEF - Grounding Code LLMs in Execution Feedback with Reinforcement Learning", "2410.02089"),
    ("Constitutional AI - Harmlessness from AI Feedback", "2212.08073"),
    # L05 planning / multi-step
    ("SWiRL - Synthetic Data Generation and Multi-Step RL for Reasoning and Tool Use", None),
    ("Language Agent Tree Search Unifies Reasoning Acting and Planning in Language Models", "2310.04406"),
    ("SPRINT - Enabling Interleaved Planning and Parallelized Execution in Reasoning Models", None),
    ("ADaPT - As-Needed Decomposition and Planning with Language Models", "2311.05772"),
    ("Wider or Deeper - Scaling LLM Inference-Time Compute with Adaptive Branching Tree Search", None),
    # L06 train-time scaling
    ("STaR - Bootstrapping Reasoning With Reasoning", "2203.14465"),
    ("DeepSeekMath - Pushing the Limits of Mathematical Reasoning in Open Language Models", "2402.03314"),
    ("DAPO - An Open-Source LLM Reinforcement Learning System at Scale", "2503.14476"),
    # L07 self-improvement / deep research
    ("Automated Design of Agentic Systems", "2408.08435"),
    ("The AI Scientist - Towards Fully Automated Open-Ended Scientific Discovery", "2408.06292"),
    ("AlphaEvolve - A Gemini-powered coding agent for designing advanced algorithms", "2506.13131"),
    ("Competition-Level Code Generation with AlphaCode", "2203.07814"),
    ("Search-o1 - Agentic Search-Enhanced Large Reasoning Models", "2501.05366"),
    # L13 software engineering
    ("CodeMonkeys - Scaling Test-Time Compute for Software Engineering", "2501.14723"),
    ("KernelBench - Can LLMs Write Efficient GPU Kernels", "2502.10517"),
    ("Improving Parallel Program Performance with LLM Optimizers via Agent-System Interfaces", None),
    # L14 memory
    ("Cartridges - Lightweight and general-purpose long context representations via self-study", "2506.06266"),
    ("MemGPT - Towards LLMs as Operating Systems", "2310.08560"),
    ("CacheBlend - Fast Large Language Model Serving for RAG with Cached Knowledge Fusion", "2405.16420"),
    # L17 evaluations
    ("Measuring AI Ability to Complete Long Tasks", "2403.15710"),
    ("GDPVal - Evaluating AI Model Performance on Real-World Economically Valuable Tasks", None),
    ("DeepScholar-Bench - A Live Benchmark and Automated Evaluation for Generative Research Synthesis", None),
]

PROXY = "http://127.0.0.1:7890"


def fetch(url: str, dest: pathlib.Path) -> bool:
    """Download via curl (direct, then proxy fallback); verify real PDF."""
    for extra in ([], ["--proxy", PROXY]):
        r = subprocess.run(
            ["curl", "-sL", "--max-time", "90", *extra, url, "-o", str(dest)],
            capture_output=True)
        if r.returncode == 0 and dest.exists():
            kind = subprocess.run(["file", "-b", str(dest)],
                                  capture_output=True, text=True).stdout
            ok = "PDF" in kind and dest.stat().st_size > 50_000
            if ok:
                return True
    if dest.exists():
        dest.unlink()
    return False


def arxiv_search(title: str) -> str | None:
    """First arxiv id whose title matches the query."""
    q = urllib.parse.quote(title)
    url = f"http://export.arxiv.org/api/query?search_query=ti:%22{q}%22&max_results=3"
    for extra in ([], [("proxy", PROXY)]):
        try:
            if extra:
                opener = urllib.request.build_opener(
                    urllib.request.ProxyHandler({"http": PROXY, "https": PROXY}))
                xml = opener.open(url, timeout=30).read().decode("utf-8", "replace")
            else:
                xml = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")
            m = re.search(r"<id>http://arxiv.org/abs/([\w.\-/]+?)</id>", xml, re.S)
            got = m.group(1) if m else None
            if got and "/" not in got:  # skip old-style cs/0301012 ids only if needed
                return got
            if got:
                return got
        except Exception as e:
            print(f"  search err ({e})")
    return None


def main() -> None:
    ok, fail = [], []
    for title, pid in PAPERS:
        dest = ARXIV / f"{title} [{pid}].pdf" if pid else None
        if dest and dest.exists():
            print(f"= skip existing: {title[:60]}")
            ok.append(title)
            continue
        if not pid:
            print(f"? searching: {title[:60]}")
            pid = arxiv_search(title)
            if not pid:
                fail.append((title, "no arxiv hit"))
                continue
            print(f"  -> {pid}")
            dest = ARXIV / f"{title} [{pid}].pdf"
        url = f"https://arxiv.org/pdf/{pid}"
        if fetch(url, dest):
            print(f"+ ok: {title[:60]} [{pid}]")
            ok.append(title)
        else:
            fail.append((title, pid))
    print(f"\n=== {len(ok)} ok, {len(fail)} fail ===")
    for t, why in fail:
        print(f"FAIL: {t} ({why})")


if __name__ == "__main__":
    main()
