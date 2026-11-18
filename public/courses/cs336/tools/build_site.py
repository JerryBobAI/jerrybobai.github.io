#!/usr/bin/env python3
"""Build single-file study hub: markdown notes -> embedded HTML.

新课必改清单(全文搜 cme295 / CME295 逐处替换,别只改常量):
  1. 下面三个路径常量(NOTES/VIDEOS/OUT)——历史事故:搬家后残指旧路径,产物写进残迹目录
  2. LECTURES(slug/title/teacher/yt/blurb)
  3. PAPER_MAP(讲→论文名片段,空列表=该讲无论文)
  4. doneKey(localStorage 键,如 'cs336-done',全站唯一,防跨课串数据)
  5. 页面标题/副题里的课名与讲数(「CME295 学习中心」等字串)
下面以 cme295 为参考实现。
"""
import json
import pathlib
import re
import markdown
from urllib.parse import quote

NOTES = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/cs336/notes")
VIDEOS = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/cs336/lectures")
OUT = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/cs336/study-hub/index.html")

LECTURES = [
    {"slug": "L01", "title": "Overview & Tokenization", "teacher": "Percy Liang", "yt": "SQ3fZ1sAqXI",
     "blurb": "课程总览：语言建模任务定义、评测观、BPE 分词原理与实现、数据准备起步"},
    {"slug": "L02", "title": "PyTorch & Resource Accounting", "teacher": "Percy Liang", "yt": "msHyYioAyNE",
     "blurb": "PyTorch 基础：tensor 并行机、参数量/FLOPs/显存核算、训练循环与 checkpoint"},
    {"slug": "L03", "title": "Architectures & Hyperparameters", "teacher": "Tatsunori Hashimoto", "yt": "ptFiH_bHnJw",
     "blurb": "架构细节：注意力变体、位置编码、激活与归一化选择、超参数搜索策略"},
    {"slug": "L04", "title": "Mixture of Experts", "teacher": "Tatsunori Hashimoto", "yt": "LPv1KfUXLCo",
     "blurb": "MoE：路由机制、负载均衡损失、专家容量与稀疏激活的算力权衡"},
    {"slug": "L05", "title": "GPUs", "teacher": "Tatsunori Hashimoto", "yt": "6OBtO9niT00",
     "blurb": "GPU 硬件：内存层级、tensor core、roofline 模型、带宽与算力瓶颈分析"},
    {"slug": "L06", "title": "Kernels & Triton", "teacher": "Tatsunori Hashimoto", "yt": "E8Mju53VB00",
     "blurb": "Kernel 编程：CUDA 概念、Triton 编写融合算子、性能剖析与优化"},
    {"slug": "L07", "title": "Parallelism 1", "teacher": "Tatsunori Hashimoto", "yt": "l1RJcDjzK8M",
     "blurb": "并行策略一：数据并行、张量并行（Megatron）、通信原语与切分方式"},
    {"slug": "L08", "title": "Parallelism 2", "teacher": "Percy Liang", "yt": "LHpr5ytssLo",
     "blurb": "并行策略二：流水线并行、ZeRO/分片优化器状态、3D 并行组合实战"},
    {"slug": "L09", "title": "Scaling Laws 1", "teacher": "Tatsunori Hashimoto", "yt": "6Q-ESEmDf4Q",
     "blurb": "缩放定律一：Kaplan/Hoffmann 定律、Chinchilla 最优配比、幂律拟合方法"},
    {"slug": "L10", "title": "Inference", "teacher": "Percy Liang", "yt": "fcgPYo3OtV0",
     "blurb": "推理：KV cache、continuous batching、投机解码、量化与显存优化"},
    {"slug": "L11", "title": "Scaling Laws 2", "teacher": "Tatsunori Hashimoto", "yt": "OSYuUqGBQxw",
     "blurb": "缩放定律二：数据受限缩放、重复数据影响、下游指标与涌现能力"},
    {"slug": "L12", "title": "Evaluation", "teacher": "Percy Liang", "yt": "x-R5l2HsXqM",
     "blurb": "评测：困惑度与下游任务、基准基准污染、HELM 式多维评测、人评"},
    {"slug": "L13", "title": "Data 1", "teacher": "Percy Liang", "yt": "WePxmeXU1xg",
     "blurb": "预训练数据一：网页抓取、质量过滤、去重（MinHash）、数据集剖析"},
    {"slug": "L14", "title": "Data 2", "teacher": "Percy Liang", "yt": "9Cd0THLS1t0",
     "blurb": "预训练数据二：数据混合与配比、课程设计、合成数据、tokenizer 影响"},
    {"slug": "L15", "title": "Alignment: SFT & RLHF", "teacher": "Tatsunori Hashimoto", "yt": "Dfu7vC9jo4w",
     "blurb": "对齐一：SFT 指令微调、奖励模型训练、RLHF 三阶段管线"},
    {"slug": "L16", "title": "Alignment: RL 1", "teacher": "Tatsunori Hashimoto", "yt": "46f2QTDB08Q",
     "blurb": "对齐二：策略梯度在 LLM 上的应用、PPO 细节、KL 约束与奖励黑客"},
    {"slug": "L17", "title": "Alignment: RL 2", "teacher": "Percy Liang", "yt": "JdGFdViaOJk",
     "blurb": "对齐三：RLVR 可验证奖励、GRPO、推理能力对齐、DPO 及变体"},
]

MD_EXTENSIONS = ["tables", "fenced_code", "codehilite", "toc"]
MD_EXT_CONFIG = {"codehilite": {"noclasses": True, "pygments_style": "friendly"}}


def render_md(md_text: str) -> str:
    return markdown.markdown(md_text, extensions=MD_EXTENSIONS, extension_configs=MD_EXT_CONFIG)


TS_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?::(\d{2}))?(?:–(\d{1,2}):(\d{2})(?::(\d{2}))?)?\]")


def _sec(h: int, mnt: int, s) -> int:
    """Two-part x:yy anchors are hour:minute chapter marks (x*60+y minutes);
    three-part h:mm:ss is exact."""
    return h * 3600 + mnt * 60 + int(s) if s else (h * 60 + mnt) * 60


def ts_seconds(m: re.Match) -> int:
    return _sec(int(m.group(1)), int(m.group(2)), m.group(3))


def ts_links(html: str, href: str = "", yt: str = "") -> str:
    """Wrap [x:yy] / [x:yy:zz] (optionally –end) anchors. With yt, link
    straight to YouTube at that second (share build); with href, link to
    the notes page video (transcript pages); otherwise to the in-page
    player (study guides)."""
    def repl(m: re.Match) -> str:
        start = ts_seconds(m)
        end = f"-{_sec(int(m.group(4)), int(m.group(5)), m.group(6))}" if m.group(4) else ""
        t = f"{start}{end}"
        if yt:
            return (f'<a class="ts" href="https://youtu.be/{yt}?t={start}" '
                    f'target="_blank" rel="noopener">{m.group(0)}</a>')
        if href:
            return f'<a class="ts" href="{href}@{t}">{m.group(0)}</a>'
        return f'<a class="ts" href="#t={t}" data-t="{t}">{m.group(0)}</a>'
    return TS_RE.sub(repl, html)


# readings/arxiv papers assigned per lecture, by unique filename fragment
# CS336 作业 PDF 未按讲映射(作业跨讲);readings/arxiv 放官方 5 份 assignment PDF
PAPER_MAP = {
    "L01": [],
    "L02": [],
    "L03": [],
    "L04": [],
    "L05": [],
    "L06": [],
    "L07": [],
    "L08": [],
    "L09": [],
    "L10": [],
    "L11": [],
    "L12": [],
    "L13": [],
    "L14": [],
    "L15": [],
    "L16": [],
    "L17": [],
}


QUIZ_HEAD = re.compile(r"^##\s+自测题", re.M)


def parse_quiz(md_text: str) -> list:
    """Yield {q, a} from the 自测题 section: `1. question` + indented `> answer`."""
    items, cur = [], None
    in_sec = False
    for line in md_text.split("\n"):
        if QUIZ_HEAD.match(line):
            in_sec = True
            cur = None
            continue
        if not in_sec:
            continue
        if line.startswith("## ") or line.strip() == "---":
            if cur:
                items.append(cur)
                cur = None
            in_sec = False
            continue
        m = re.match(r"^(\d+)\.\s+(.*)$", line)
        if m:
            if cur:
                items.append(cur)
            cur = {"q": m.group(2).strip(), "a": ""}
            continue
        am = re.match(r"^\s*>\s?(.*)$", line)
        if am and cur is not None:
            cur["a"] += am.group(1).strip() + " "
    if cur:
        items.append(cur)
    return items


def quiz_count(html: str) -> int:
    """Number of quiz items = list items carrying a blockquote answer,
    mirroring the quizFold selector li > blockquote."""
    n = 0
    for chunk in html.split("<li>")[1:]:
        if "<blockquote>" in chunk.split("</li>")[0]:
            n += 1
    return n


def papers_for(slug: str, all_files: list, share: bool = False) -> list:
    out = []
    for frag in PAPER_MAP.get(slug, []):
        for f in all_files:
            if frag in f and f.lower().endswith(".pdf"):
                stem = re.sub(r"\.pdf$", "", f, flags=re.I).strip()
                title = re.sub(r"\s*\[[\w.-]+\]$", "", stem).strip()
                if share:
                    m = re.search(r"\[([A-Za-z0-9.-]{6,})\]$", stem)
                    if m:   # no arxiv id in filename -> can't link online, skip
                        out.append({"title": title,
                                    "href": f"https://arxiv.org/abs/{m.group(1)}"})
                else:
                    out.append({"title": title, "href": f"../readings/arxiv/{quote(f)}"})
                break
    return out


def load_lectures(share: bool = False) -> list:
    data = []
    num_to_slug = {lec["slug"][:3]: lec["slug"] for lec in LECTURES}
    # local mp4s matched by the trailing YouTube id in the filename
    video_by_id = {}
    for p in VIDEOS.glob("*.mp4"):
        m = re.search(r"\[([A-Za-z0-9_-]{11})\]", p.name)
        if m:
            video_by_id[m.group(1)] = p.name
    pdf_files = [p.name for p in (VIDEOS.parent / "readings" / "arxiv").glob("*.pdf")]
    for lec in LECTURES:
        guide = NOTES / f"{lec['slug']}-study-guide.md"
        transcript = NOTES / f"{lec['slug']}-transcript.md"
        item = dict(lec)
        if guide.exists():
            html = render_md(guide.read_text(encoding="utf-8"))
            if share:
                # single-file build: transcripts are inlined per lecture
                html = re.sub(r'href="L(\d\d)-transcript\.md"',
                              lambda m: f'href="#tx-{num_to_slug["L" + m.group(1)]}"', html)
                html = re.sub(r'>(\w{3})-transcript\.md<', '>站内文字稿<', html)
                # the header block mentions the local mp4 path; point at YouTube instead
                html = re.sub(r'配合视频 <code>[^<]*</code>，时间戳可直接跳转',
                              f'视频在 <a class="yt-link" href="https://youtu.be/{lec["yt"]}" '
                              f'target="_blank" rel="noopener">YouTube</a>，笔记时间戳直达对应位置', html)
                html = ts_links(html, yt=lec["yt"])
            else:
                # transcript pages live in study-hub/transcripts/, rendered at build time
                html = re.sub(r'href="L(\d\d)-transcript\.md"',
                              lambda m: f'href="transcripts/{num_to_slug["L" + m.group(1)]}.html"', html)
                html = ts_links(html)
            item["html"] = html
            item["quiz_count"] = quiz_count(html)
            item["ready"] = True
        else:
            item["html"] = "<p class='pending'>笔记蒸馏中——字幕已就绪，待处理。</p>"
            item["ready"] = False
        item["has_transcript"] = transcript.exists()
        item["video"] = (f"../lectures/{quote(video_by_id[lec['yt']])}"
                         if lec["yt"] in video_by_id and not share else "")
        audio = VIDEOS.parent / "audio" / f"{lec['slug'][:3]}.m4a"
        item["audio"] = f"../audio/{audio.name}" if audio.exists() and not share else ""
        item["papers"] = papers_for(lec["slug"][:3], pdf_files, share)
        if share and transcript.exists():
            tmd = transcript.read_text(encoding="utf-8")
            tmd = re.sub(r"^# Transcript: \S+",
                         f'# {lec["slug"][:3]} · {lec["title"]} — 原始文字稿', tmd, count=1)
            item["xcript_html"] = ts_links(render_md(tmd), yt=lec["yt"])
        data.append(item)
    return data


CSS = """
:root{
  --bg:#FAF8F5; --bg2:#F1EEE8; --card:#FFFFFF; --ink:#211D19; --ink2:#6B6459;
  --line:#E3DDD2; --accent:#8C1515; --accent2:#B33A3A; --ok:#2E6B3F;
  --code-bg:#F4F1EA; --shadow:0 1px 3px rgba(33,29,25,.08),0 8px 24px rgba(33,29,25,.06);
}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){
  --bg:#161311; --bg2:#1E1A17; --card:#211D19; --ink:#EDE7DE; --ink2:#9A9184;
  --line:#332D27; --accent:#D06A6A; --accent2:#C75B5B; --ok:#7FBF8E;
  --code-bg:#28231E; --shadow:0 1px 3px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3);
}}
:root[data-theme=dark]{
  --bg:#161311; --bg2:#1E1A17; --card:#211D19; --ink:#EDE7DE; --ink2:#9A9184;
  --line:#332D27; --accent:#D06A6A; --accent2:#C75B5B; --ok:#7FBF8E;
  --code-bg:#28231E; --shadow:0 1px 3px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.3);
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  background:var(--bg);color:var(--ink);line-height:1.75;font-size:16px}
a{color:var(--accent)}
::selection{background:color-mix(in srgb,var(--accent) 20%,transparent)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:5px}
*{scrollbar-width:thin;scrollbar-color:var(--line) transparent}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:var(--line);border-radius:99px;border:2px solid var(--bg)}
::-webkit-scrollbar-thumb:hover{background:var(--ink2)}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  html{scroll-behavior:auto}
}
.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:16px;
  padding:14px 28px;background:color-mix(in srgb,var(--bg) 86%,transparent);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.topbar .brand{font-weight:700;font-size:17px;letter-spacing:.02em}
.topbar .brand .course{color:var(--accent)}
.topbar .sub{font-size:12.5px;color:var(--ink2)}
.topbar .spacer{flex:1}
.progress-pill{font-size:12.5px;color:var(--ink2);border:1px solid var(--line);
  border-radius:99px;padding:4px 12px;background:var(--card);font-variant-numeric:tabular-nums}
.progress-pill b{color:var(--accent)}
.theme-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);
  border-radius:8px;padding:5px 10px;cursor:pointer;font-size:13px;
  display:inline-flex;align-items:center;gap:6px}
.theme-btn svg{display:block}
.theme-btn svg[hidden]{display:none}
.badge{font-size:12.5px;border:1px solid var(--line);border-radius:99px;
  padding:3px 11px;color:var(--ink2);display:inline-flex;align-items:center;gap:5px}
.badge svg{flex-shrink:0}
.layout{display:grid;grid-template-columns:var(--side-w,264px) 1fr;max-width:calc(1280px + var(--side-w,264px) - 264px);margin:0 auto}
.side-handle{position:absolute;top:0;right:-3px;width:7px;height:100%;cursor:col-resize;z-index:5}
.side-handle:hover,.side-handle.dragging{background:linear-gradient(90deg,transparent,var(--accent))}
.nav-toc{padding:2px 0 8px 10px;margin:2px 0 6px 16px;border-left:2px solid var(--line)}
.nav-sub{display:block;padding:4px 8px;border-radius:7px;font-size:12px;color:var(--ink2);text-decoration:none;line-height:1.45}
.nav-sub:hover{background:var(--bg2);color:var(--accent)}
.nav-sub .tno{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:10px;margin-right:5px;color:var(--accent)}
@media(max-width:880px){.nav-toc{display:none}}
.sidebar{position:sticky;top:63px;height:calc(100vh - 63px);overflow-y:auto;
  border-right:1px solid var(--line);padding:22px 14px;background:var(--bg2)}
.sidebar .group-label{font-size:11px;letter-spacing:.14em;color:var(--ink2);
  text-transform:uppercase;margin:0 10px 8px}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;
  cursor:pointer;color:var(--ink);text-decoration:none;font-size:13.8px}
.nav-item:hover{background:var(--card)}
.nav-item.active{background:var(--card);box-shadow:var(--shadow);color:var(--accent);font-weight:700}
.nav-item .dot{width:7px;height:7px;border-radius:50%;background:var(--line);flex-shrink:0}
.nav-item .dot.ready{background:var(--ok)}
.nav-item .dot.done{background:var(--accent)}
.nav-item .num{font-size:11px;color:var(--ink2);font-variant-numeric:tabular-nums}
.main{padding:34px 44px 80px;min-width:0}
.view{display:none}.view.active{display:block;animation:fade .28s ease-out}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
/* overview */
.hero{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:44px;align-items:center}
.hero h1{font-size:30px;line-height:1.3;letter-spacing:-.015em}
.hero .lede{color:var(--ink2);margin-top:10px;max-width:62ch}
.hero .meta{display:flex;gap:18px;margin-top:14px;font-size:13px;color:var(--ink2);flex-wrap:wrap}
.hero .meta b{color:var(--ink)}
.hero-fig{--hairline-plate:transparent;--hairline-stroke:1.1}
.hero-fig svg{max-width:100%}
@media(max-width:1180px){.hero{grid-template-columns:minmax(0,1fr) 250px;gap:30px}}
@media(max-width:880px){.hero{grid-template-columns:1fr}.hero-fig{display:none}}
/* motion singles */
.glyph-tray{position:relative;height:88px;margin-top:30px;cursor:crosshair;
  border-bottom:1px solid var(--line)}
.glyph-tray .tray-hint{position:absolute;right:2px;bottom:6px;font-size:11px;
  color:var(--ink2);opacity:.75;pointer-events:none;letter-spacing:.02em}
.gravity-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;touch-action:none;user-select:none;-webkit-user-select:none}
.gravity-layer .gl{position:absolute;top:0;left:0;font-weight:600;line-height:1;color:var(--accent);opacity:.9;
  transition:opacity .3s ease;will-change:transform;backface-visibility:hidden}
.gravity-layer .gl>span{display:inline-block;transform-origin:bottom center}
.brand{display:flex;align-items:center;gap:9px}
.fluid-orb{width:26px;height:26px;border-radius:50%;overflow:hidden;flex-shrink:0;
  box-shadow:0 0 0 1px var(--line);opacity:.95}
.fluid-orb canvas{width:100%;height:100%;display:block}
.lec-card{will-change:transform}
.lec-card.tilting{transition:none}
.yt-frame{position:relative;aspect-ratio:16/9;background:var(--code-bg);border:1px solid var(--line);
  border-radius:13px;overflow:hidden;margin:18px 0 4px;max-width:860px}
.yt-frame video{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#000}
.yt-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}
/* share build: thumbnail card opening YouTube (embeds are blocked per-video) */
.yt-card{display:block;text-decoration:none;overflow:hidden;
  background:linear-gradient(135deg,#3a332c,#211d19)}
.yt-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;opacity:.92}
.yt-card .yt-card-hint{position:absolute;left:0;right:0;bottom:0;padding:26px 16px 12px;color:#fff;
  font-size:13px;font-weight:600;text-shadow:0 1px 3px rgba(0,0,0,.7);
  background:linear-gradient(transparent,rgba(0,0,0,.65))}
.yt-card:hover img{opacity:1}
.yt-missing{display:flex;align-items:center;justify-content:center;gap:6px;
  font-size:13.5px;color:var(--ink2)}
.yt-missing a{color:var(--accent)}
.audio-bar{display:flex;align-items:center;gap:10px;margin:10px 0 4px;padding:10px 14px;
  background:var(--card);border:1px solid var(--line);border-radius:11px;font-size:13px;color:var(--ink2)}
.audio-bar audio{flex:1;height:34px;min-width:0}
@media (max-width:720px){.audio-bar{flex-direction:column;align-items:stretch}}
.yt-frame.float-panel{position:fixed;right:22px;bottom:22px;width:min(400px,44vw);max-width:860px;
  margin:0;z-index:70;box-shadow:0 14px 44px rgba(0,0,0,.4);animation:floatIn .28s cubic-bezier(.215,.61,.355,1)}
@keyframes floatIn{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.float-close{display:none;position:absolute;top:8px;right:8px;z-index:71;width:27px;height:27px;
  border-radius:50%;border:1px solid rgba(255,255,255,.45);background:rgba(0,0,0,.55);color:#fff;
  align-items:center;justify-content:center;font-size:15px;line-height:1;cursor:pointer;padding:0}
.float-close:hover{background:rgba(0,0,0,.78)}
.float-panel .float-close{display:flex}
@media (max-width:720px){.yt-frame.float-panel{left:12px;right:12px;bottom:12px;width:auto}}
/* transcript pages */
.crumb{color:var(--accent);text-decoration:none;font-size:14px}
.crumb:hover{text-decoration:underline;text-underline-offset:3px}
.tmain{max-width:860px;margin:0 auto;padding:38px 28px 90px}
.map{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px;margin-top:26px}
.lec-card{display:block;background:var(--card);border:1px solid var(--line);border-radius:13px;
  padding:16px 17px;color:var(--ink);text-decoration:none;cursor:pointer;
  transition:transform .15s ease-out,box-shadow .15s ease-out;position:relative}
.lec-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.lec-card .no{font-size:11px;letter-spacing:.12em;color:var(--accent);font-weight:700}
.lec-card h3{font-size:15.5px;margin:5px 0 6px;line-height:1.45}
.lec-card p{font-size:12.8px;color:var(--ink2);line-height:1.55}
.lec-card .who{margin-top:10px;font-size:12px;color:var(--ink2)}
.lec-card .who b{color:var(--ink);font-weight:600}
.lec-card .status{position:absolute;top:14px;right:15px;font-size:11px;color:var(--ok);
  display:inline-flex;align-items:center;gap:4px}
/* lecture content */
.lecture h1{font-size:26px;line-height:1.35}
.lecture .lecmeta{display:flex;gap:14px;flex-wrap:wrap;align-items:center;
  margin:10px 0 4px;font-size:13px;color:var(--ink2)}
.yt-link{font-size:12.5px;border:1px solid var(--line);border-radius:99px;
  padding:3px 11px;text-decoration:none;color:var(--ink2)}
.yt-link:hover{color:var(--accent);border-color:var(--accent)}
.markdown{margin-top:22px;font-size:15.5px}
.markdown h1,.markdown h2,.markdown h3{letter-spacing:-.015em}
.markdown h2{font-size:20px;margin:34px 0 12px;padding-left:12px;
  border-left:3px solid var(--accent);line-height:1.4}
.markdown h3{font-size:16.5px;margin:26px 0 10px}
.markdown p{margin:10px 0;max-width:72ch}
.markdown a{text-underline-offset:3px;text-decoration-thickness:1px}
.markdown ul,.markdown ol{margin:10px 0 10px 1.4em}
.markdown li{margin:4px 0}
.markdown blockquote{margin:14px 0;padding:10px 16px;border-left:3px solid var(--line);
  background:var(--bg2);border-radius:0 9px 9px 0;color:var(--ink2);font-size:14.5px}
.markdown code{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:.86em;
  background:var(--code-bg);padding:1.5px 6px;border-radius:5px}
.markdown pre{background:var(--code-bg);border:1px solid var(--line);border-radius:11px;
  padding:15px 17px;overflow-x:auto;margin:14px 0;line-height:1.6}
.markdown pre code{background:none;padding:0;font-size:13px}
.markdown table{border-collapse:collapse;margin:16px 0;font-size:14px;max-width:100%;
  display:block;overflow-x:auto}
.markdown th{background:var(--bg2);text-align:left;font-weight:700}
.markdown th,.markdown td{border:1px solid var(--line);padding:8px 13px;vertical-align:top}
.markdown tr:nth-child(even) td{background:color-mix(in srgb,var(--bg2) 55%,transparent)}
.markdown details{background:var(--card);border:1px solid var(--line);border-radius:11px;
  padding:0;margin:12px 0;max-width:76ch}
.markdown details summary{cursor:pointer;padding:11px 16px;font-weight:600;
  font-size:14.5px;list-style-position:inside}
.markdown details summary::marker{color:var(--accent)}
.markdown details[open] summary{border-bottom:1px dashed var(--line);color:var(--accent)}
.markdown details div{padding:11px 16px;font-size:14.5px}
.markdown hr{border:none;border-top:1px solid var(--line);margin:30px 0}
.markdown strong{font-weight:700}
.papers{margin-top:34px;padding:18px 20px;background:var(--card);border:1px solid var(--line);
  border-radius:13px;max-width:860px}
.papers h2{margin:0 0 10px;font-size:15px;letter-spacing:.04em;color:var(--ink2)}
.papers ul{list-style:none;margin:0;padding:0}
.papers li{margin:6px 0;font-size:14px}
.papers a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}
.papers a:hover{color:var(--accent);border-bottom-color:var(--accent)}
.papers-more{margin:12px 0 0;font-size:12.5px;color:var(--ink2)}
.markdown li>textarea.myans{display:block;width:100%;min-height:54px;margin:9px 0 2px;padding:8px 11px;
  font:inherit;font-size:13.5px;line-height:1.6;color:var(--ink);background:var(--card);
  border:1px solid var(--line);border-radius:9px;resize:vertical;box-sizing:border-box}
.markdown li>textarea.myans::placeholder{color:var(--ink2);opacity:.75}
.markdown li>textarea.myans:focus{outline:none;border-color:var(--accent)}
.markdown li>details.quiz.answered summary{color:var(--ok);border-color:var(--ok)}
.markdown li>.grade-row{display:flex;align-items:center;gap:10px;margin:6px 0 2px}
.grade-btn{font-size:12px;padding:3px 10px}
.grade-btn:disabled{opacity:.55;cursor:default}
.markdown li>.grade-out{display:none;margin:4px 0 2px;padding:8px 12px;font-size:13px;line-height:1.7;
  background:var(--bg2);border-left:3px solid var(--line);border-radius:0 9px 9px 0;color:var(--ink)}
.markdown li>.grade-out.show{display:block}
.markdown li>.grade-out.v-ok{border-left-color:var(--ok)}
.markdown li>.grade-out.v-part{border-left-color:#C08A2D}
.markdown li>.grade-out.v-miss{border-left-color:var(--accent2)}
.markdown li>.grade-out .gd-verdict{font-weight:700;margin-right:6px}
.my-recap{margin:18px 0 6px}
.my-recap>summary{cursor:pointer;font-weight:700;color:var(--accent);font-size:14.5px}
.my-recap>.my-recap-body{margin-top:8px;padding:12px 16px;background:var(--bg2);border-radius:11px;font-size:13.5px;line-height:1.75}
.my-recap .mr-item{margin:10px 0;padding-left:10px;border-left:2px solid var(--line)}
.my-recap .mr-q{font-weight:700}
.my-recap .mr-ans{color:var(--ink2)}
.modal-mask{position:fixed;inset:0;background:rgba(20,16,12,.45);display:none;align-items:center;justify-content:center;z-index:50}
.modal-mask.show{display:flex}
.modal{width:min(460px,92vw);background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px}
.modal h3{margin:0 0 6px;font-size:16px}
.modal p.hint{font-size:12.5px;color:var(--ink2);margin:0 0 14px;line-height:1.6}
.modal label{display:block;font-size:12.5px;color:var(--ink2);margin:10px 0 4px}
.modal input{width:100%;box-sizing:border-box;padding:7px 10px;font:inherit;font-size:13px;color:var(--ink);
  background:var(--bg);border:1px solid var(--line);border-radius:8px}
.modal input:focus{outline:none;border-color:var(--accent)}
.modal .modal-btns{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.markdown li>details.quiz{margin:7px 0 2px;background:none;border:none;padding:0}
.markdown li>details.quiz summary{display:inline-block;padding:3px 12px;font-size:12.5px;
  font-weight:600;color:var(--accent);background:var(--bg2);border:1px solid var(--line);
  border-radius:999px;list-style:none}
.markdown li>details.quiz summary::marker{content:none}
.markdown li>details.quiz summary:hover{border-color:var(--accent)}
.markdown li>details.quiz[open] summary{border-radius:11px 11px 0 0}
.markdown li>details.quiz blockquote{margin:0;background:var(--card)}
.markdown .ts{color:var(--accent);text-decoration:none;font-variant-numeric:tabular-nums;
  border-bottom:1px dashed color-mix(in srgb,var(--accent) 45%,transparent)}
.markdown .ts:hover{border-bottom-style:solid}
.foot-note{margin-top:40px;padding-top:16px;border-top:1px solid var(--line);
  color:var(--ink2);font-size:12.5px}
.toolbox{margin-top:44px}
.toolbox h2{margin:0 0 14px;font-size:15px;letter-spacing:.04em;color:var(--ink2)}
.tool-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.tool{display:flex;flex-direction:column;gap:7px;padding:16px 18px;background:var(--card);
  border:1px solid var(--line);border-radius:13px;text-decoration:none;color:var(--ink);
  transition:border-color .18s ease,transform .18s ease}
a.tool:hover{border-color:var(--accent);transform:translateY(-2px)}
.tool b{font-size:14.5px}
.tool span{font-size:12.5px;color:var(--ink2);line-height:1.55}
/* in-site spaced repetition */
.rv-badge{margin-left:auto;min-width:18px;text-align:center;background:var(--accent);color:#fff;
  border-radius:9px;padding:1px 6px;font-size:11px;font-variant-numeric:tabular-nums}
.rv-wrap{max-width:720px;margin:48px auto 0;padding:0 22px}
.rv-meta{display:flex;justify-content:space-between;gap:12px;font-size:12.5px;
  color:var(--ink2);margin-bottom:14px;font-variant-numeric:tabular-nums}
.rv-card{background:var(--card);border:1px solid var(--line);border-radius:14px;
  box-shadow:var(--shadow);padding:34px 32px;min-height:200px;cursor:pointer;
  font-size:16.5px;line-height:1.8}
.rv-q{font-weight:600}
.rv-q p{margin:0}
.rv-a{margin-top:18px;padding-top:16px;border-top:1px dashed var(--line)}
.rv-a p{margin:0}
.rv-hint{margin-top:24px;font-size:12.5px;color:var(--ink2)}
.rv-actions{display:flex;gap:12px;margin-top:18px;justify-content:center;flex-wrap:wrap}
.rv-actions[hidden]{display:none}
.rv-btn{border:1px solid var(--line);background:var(--card);color:var(--ink);
  padding:10px 18px;border-radius:10px;font-size:13.5px;cursor:pointer;
  transition:transform .12s ease,box-shadow .12s ease}
.rv-btn:hover{transform:translateY(-1px);box-shadow:var(--shadow)}
.rv-btn.good{border-color:var(--ok);color:var(--ok)}
.rv-btn.bad{border-color:var(--accent);color:var(--accent)}
.rv-done{text-align:center;padding:56px 20px}
.rv-done h1{font-size:24px}
.rv-big{font-size:19px;font-weight:700;margin:16px 0 8px}
.rv-sub{color:var(--ink2);font-size:13.5px;margin-bottom:26px}
.rv-link{margin-left:12px;color:var(--ink2);font-size:13px}
.rv-dl{margin-top:34px;text-align:center;font-size:12.5px}
.rv-dl a{color:var(--ink2)}
.rv-dl a:hover{color:var(--accent)}
/* share build: inlined raw transcript */
.xcript{margin-top:36px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.xcript summary{cursor:pointer;padding:13px 18px;font-size:13.5px;color:var(--ink2);font-weight:600}
.xcript summary:hover{color:var(--accent)}
.xcript .markdown{padding:4px 22px 20px;border-top:1px solid var(--line)}
/* share build: inlined papers index */
.pwrap{max-width:860px;margin:0 auto;padding:44px 26px 90px}
.pwrap h1{font-size:26px;margin:0 0 6px}
.pwrap .psub{color:var(--ink2);font-size:13.5px;margin:0 0 24px}
.paper-list{list-style:none;margin:0;padding:0}
.paper-list li{display:flex;align-items:baseline;gap:14px;padding:10px 2px;border-bottom:1px solid var(--line)}
.paper-list a{color:var(--ink);text-decoration:none;font-size:14.5px;line-height:1.55}
.paper-list a:hover{color:var(--accent)}
.paper-none{color:var(--ink2);font-size:14.5px}
.paper-tag{margin-left:auto;flex:none;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--accent);
  background:color-mix(in srgb, var(--accent) 10%, transparent);
  border:1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius:999px;padding:2px 10px}
@media(max-width:880px){
  .layout{grid-template-columns:1fr}
  .sidebar{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line);
    display:flex;gap:6px;overflow-x:auto;padding:12px 14px}
  .sidebar .group-label{display:none}
  .sidebar #nav-list{display:flex;gap:6px}
  .nav-item{white-space:nowrap;flex-shrink:0}
  .main{padding:26px 20px 60px}
}
"""

JS = """
const LECTURES = __DATA__;
const SHARE = __SHARE__;
const doneKey = 'cs336-done';
let done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]'));
const quizKey = 'cs336-quiz';
let quizAns = JSON.parse(localStorage.getItem(quizKey) || '{}');
/* ---- 站内原答与 AI 批改(自 sutskevers-list 移植):原答自动保存,批改调 OpenAI 兼容端点 ---- */
const myAnsKey = doneKey.replace(/-done$/, '-myans');
let myAns = JSON.parse(localStorage.getItem(myAnsKey) || '{}');
function saveMyAns(slug, idx, text){
  const o = myAns[slug] || {};
  o[idx] = text;
  myAns[slug] = o;
  localStorage.setItem(myAnsKey, JSON.stringify(myAns));
}
function stripHtml(h){ const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent; }
function escapeHtml(s){
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function downloadMd(text, slug){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/markdown'}));
  a.download = slug + '-myans.md';
  a.click();
  URL.revokeObjectURL(a.href);
}
function exportMyAns(slug, btn){
  const l = LECTURES.find(x => x.slug === slug);
  const qs = QUESTIONS.filter(q => q.slug === slug);
  const mine = myAns[slug] || {};
  const lines = ['# 内化答题导出 · ' + slug + ' · ' + (l ? l.title : slug), '', '导出时间:' + new Date().toLocaleString('zh-CN'), ''];
  let n = 0;
  qs.forEach((q, i) => {
    const ans = (mine[String(i)] || '').trim();
    if (!ans) return;
    n++;
    lines.push('## Q' + (i + 1), '**题目**:' + stripHtml(q.q), '', '**我的原答**:' + ans, '');
  });
  if (!n){ alert('本讲还没有作答——先在自测题下方的输入框写下你的回答。'); return; }
  const text = lines.join('\\n');
  const flash = msg => {
    const orig = btn.textContent;
    btn.textContent = msg;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(
      () => flash('已复制 ' + n + ' 题原答 ✓ 粘贴给 Claude 批改'),
      () => { downloadMd(text, slug); flash('已下载 md ✓'); });
  } else { downloadMd(text, slug); flash('已下载 md ✓'); }
}

/* ---- 站内 AI 批改:调 OpenAI 兼容端点,批改结果存 localStorage 并汇入内化记录 ---- */
const aiKey = doneKey.replace(/-done$/, '-ai');
const gradeKey = doneKey.replace(/-done$/, '-grade');
let aiCfg = Object.assign(
  {endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', key: ''},
  JSON.parse(localStorage.getItem(aiKey) || '{}'));
let grades = JSON.parse(localStorage.getItem(gradeKey) || '{}');
function saveAiCfg(){ localStorage.setItem(aiKey, JSON.stringify(aiCfg)); }
function saveGrades(){ localStorage.setItem(gradeKey, JSON.stringify(grades)); }
function verdictOf(text){
  if (text.includes('✅')) return 'ok';
  if (text.includes('⚠️') || text.includes('⚠')) return 'part';
  if (text.includes('❌')) return 'miss';
  return '';
}
const VERDICT_TXT = {ok: '✅ 通过', part: '⚠️ 部分正确', miss: '❌ 未命中'};
async function callLLM(question, ref, mine){
  if (!aiCfg.key) throw new Error('NOKEY');
  const sys = '你是精读视频课程的助教,学生做完自测题后你负责批改。'
    + '输出两行,格式严格如下:\\n'
    + '判定:✅ 通过 或 ⚠️ 部分正确 或 ❌ 未命中\\n'
    + '批语:2-4 句,先指出原答命中了哪些要点,再对照参考答案指出遗漏或纠错;简体中文,直接说,不客套。'
    + '原答若与参考答案语义等价即使措辞不同也算命中;确有明显错误才判 ❌。';
  const r = await fetch(aiCfg.endpoint, {
    method: 'POST',
    headers: {Authorization: 'Bearer ' + aiCfg.key, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: aiCfg.model,
      messages: [
        {role: 'system', content: sys},
        {role: 'user', content: '【题目】' + question + '\\n【参考答案】' + ref + '\\n【我的原答】' + mine}
      ],
      temperature: 0.3, max_tokens: 350
    })
  });
  if (!r.ok){
    const t = await r.text().catch(() => '');
    throw new Error('HTTP ' + r.status + (t ? ' ' + t.slice(0, 120) : ''));
  }
  const j = await r.json();
  return (j.choices && j.choices[0] && j.choices[0].message.content || '').trim();
}
function renderGrade(slug, idx){
  const g = (grades[slug] || {})[idx];
  const out = document.querySelector(`#view-${slug} li[data-idx="${idx}"] > .grade-out`);
  if (!out) return;
  if (!g){ out.className = 'grade-out'; out.innerHTML = ''; return; }
  const v = verdictOf(g.text);
  out.className = 'grade-out show' + (v ? ' v-' + v : '');
  const head = v ? `<span class="gd-verdict">${VERDICT_TXT[v]}</span>` : '';
  // 徽章已表达判定,正文里剥掉「判定:…」行避免重复
  const body = g.text.replace(/^\\s*判定[::].*(\\n|$)/, '').trim();
  out.innerHTML = head + escapeHtml(body).replace(/\\n/g, '<br>');
}
function renderRecapDyn(slug){
  const view = document.getElementById('view-' + slug);
  if (!view || view.querySelector('.my-recap')) return;
  const mine = myAns[slug] || {}, gd = grades[slug] || {};
  const qs = QUESTIONS.filter(q => q.slug === slug);
  const items = qs.map((q, i) => ({q, i, ans: (mine[String(i)] || '').trim(), g: gd[String(i)]}))
                  .filter(x => x.ans || x.g);
  if (!items.length) return;
  const rows = items.map(x => {
    const ansLine = x.ans ? `<div class="mr-ans">我的原答:${escapeHtml(x.ans)}</div>` : '';
    const gLine = x.g ? `<div class="mr-grade">${escapeHtml(x.g.text).replace(/\\n/g, '<br>')}</div>` : '';
    return `<div class="mr-item"><div class="mr-q">Q${x.i + 1} · ${escapeHtml(stripHtml(x.q.q))}</div>${ansLine}${gLine}</div>`;
  }).join('');
  const det = document.createElement('details');
  det.className = 'my-recap';
  det.open = true;
  det.innerHTML = `<summary>内化记录 · 站内原答与 AI 批改(${items.length} 题)</summary><div class="my-recap-body">${rows}</div>`;
  view.querySelector('.markdown').appendChild(det);
}
async function gradeOne(slug, idx, btn, statusEl){
  const mine = ((myAns[slug] || {})[idx] || '').trim();
  if (!mine){ if (statusEl) statusEl.textContent = '先写原答再批改'; return false; }
  const q = QUESTIONS.filter(x => x.slug === slug)[Number(idx)];
  if (!q) return false;
  btn.disabled = true;
  if (statusEl) statusEl.textContent = '批改中…';
  try {
    const text = await callLLM(stripHtml(q.q), stripHtml(q.a), mine);
    const o = grades[slug] || {};
    o[idx] = {text, ts: Date.now()};
    grades[slug] = o;
    saveGrades();
    renderGrade(slug, idx);
    if (statusEl) statusEl.textContent = '';
    return true;
  } catch(e){
    if (e.message === 'NOKEY'){ openSettings(); if (statusEl) statusEl.textContent = '先在设置里填 API Key'; }
    else if (statusEl) statusEl.textContent = '失败:' + e.message.slice(0, 60);
    return false;
  } finally { btn.disabled = false; }
}
async function gradeAllLec(slug, btn){
  const qs = QUESTIONS.filter(q => q.slug === slug);
  const todo = qs.map((q, i) => String(i)).filter(i => ((myAns[slug] || {})[i] || '').trim());
  if (!todo.length){ alert('本讲还没有作答——先在自测题输入框写下你的回答。'); return; }
  btn.disabled = true;
  let ok = 0;
  for (let k = 0; k < todo.length; k++){
    btn.textContent = `批改中 ${k + 1}/${todo.length}…`;
    const idx = todo[k];
    const li = document.querySelector(`#view-${slug} li[data-idx="${idx}"]`);
    const b = li && li.querySelector('.grade-btn');
    const st = li && li.querySelector('.grade-status');
    if (await gradeOne(slug, idx, b || btn, st)) ok++;
  }
  btn.disabled = false;
  btn.textContent = 'AI 批改全部';
  renderRecapDyn(slug);
  if (ok === todo.length){
    const orig = btn.textContent;
    btn.textContent = `已批改 ${ok} 题 ✓`;
    setTimeout(() => { btn.textContent = orig; }, 2400);
  }
}
function openSettings(){
  const m = document.getElementById('ai-modal');
  document.getElementById('set-endpoint').value = aiCfg.endpoint;
  document.getElementById('set-model').value = aiCfg.model;
  document.getElementById('set-key').value = aiCfg.key;
  m.classList.add('show');
}
function closeSettings(){ document.getElementById('ai-modal').classList.remove('show'); }
const $ = s => document.querySelector(s);
const CHECK = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function progress(){ return done.size + ' / ' + LECTURES.length; }
function quizTotals(){
  let seen = 0, total = 0;
  document.querySelectorAll('details.quiz').forEach(d => {
    const slug = d.closest('.view') && d.closest('.view').id.slice(5);
    if (!slug) return;
    total++;
    if ((quizAns[slug] || []).includes(d.dataset.qid)) seen++;
  });
  return [seen, total];
}
function refreshProgress(){
  const [s, t] = quizTotals();
  $('#prog').innerHTML = '已完成 <b>' + progress() + '</b> 讲 · 自测 <b>' + s + '/' + t + '</b> 题';
}
function quizBadgeHtml(l){
  if (!l.quiz_count) return '';
  const seen = Math.min((quizAns[l.slug] || []).length, l.quiz_count);
  const txt = seen >= l.quiz_count ? CHECK + ' 自测完成' : '自测 ' + seen + '/' + l.quiz_count;
  return `<span class="badge quiz-badge" data-quiz="${l.slug}">${txt}</span>`;
}
function updateQuizBadge(slug){
  const l = LECTURES.find(x => x.slug === slug);
  const el = l && document.querySelector(`[data-quiz="${slug}"]`);
  if (el) el.outerHTML = quizBadgeHtml(l);
}

/* ---- spaced repetition: the Anki loop, in-site ----
   Simplified SM-2: 忘了 → back in 10 min, ease −0.2; 记住了 → interval
   ×ease (first success = 1 day), ease +0.05, capped at 180 days.
   One session = up to 25 due cards, new cards first. */
const QUESTIONS = __QUESTIONS__;
const srsKey = 'cs336-srs';
let srs = JSON.parse(localStorage.getItem(srsKey) || '{}');
const DAY = 864e5, SESSION_CAP = 25;

function saveSrs(){ localStorage.setItem(srsKey, JSON.stringify(srs)); }
function dueCards(){
  const now = Date.now();
  return QUESTIONS.filter(q => {
    const r = srs[q.id];
    return !r || r.due <= now;
  }).sort((a, b) => {
    const ra = srs[a.id], rb = srs[b.id];
    if (!ra !== !rb) return !ra ? -1 : 1;   // never-answered cards first
    return (ra ? ra.due : 0) - (rb ? rb.due : 0);
  });
}
function dueCount(){ return dueCards().length; }
function nextIntervalDays(id){
  const r = srs[id];
  return r && r.interval >= 1 ? Math.min(180, Math.round(r.interval * r.ease)) : 1;
}
function schedule(id, ok){
  const now = Date.now();
  const r = srs[id] || { ease: 2.2, interval: 0, due: 0 };
  if (ok){
    r.ease = Math.min(3.2, r.ease + 0.05);
    r.interval = r.interval < 1 ? 1 : Math.min(180, Math.round(r.interval * r.ease));
    r.due = now + r.interval * DAY;
  } else {
    r.ease = Math.max(1.6, r.ease - 0.2);
    r.interval = 0;
    r.due = now + 10 * 60e3;
  }
  srs[id] = r;
  saveSrs();
}
let reviewQueue = [], reviewDone = 0, reviewGood = 0, reviewFace = 'front';
function startReview(){
  reviewQueue = dueCards().slice(0, SESSION_CAP);
  reviewDone = 0; reviewGood = 0;
  renderReview();
}
function refreshReviewBadge(){
  const due = dueCount();
  const b = $('#review-badge');
  b.textContent = due ? String(due) : '';
  b.hidden = !due;
}
function renderReview(){
  const host = $('#view-review');
  const due = dueCount();
  refreshReviewBadge();
  if (!reviewQueue.length){
    host.innerHTML = `<div class="rv-wrap"><div class="rv-done">
      <h1>间隔复习</h1>
      <p class="rv-big">${due ? '本轮完成 🎉' : '没有到期的卡片 🎉'}</p>
      <p class="rv-sub">${due
        ? `还有 ${due} 张卡到期，10 分钟后或明天再回来`
        : `共 ${QUESTIONS.length} 张卡，全部按记忆曲线排期中`}</p>
      <button class="rv-btn good" id="rv-again">${due ? '继续复习' : '检查一遍'}</button>
      <a class="rv-link" href="#overview">返回总览</a>
      ${SHARE ? '' : `<p class="rv-dl"><a href="../anki/cs336-quiz.apkg" download>📥 导出 Anki 卡组 (.apkg) · ${QUESTIONS.length} 张</a></p>`}
    </div></div>`;
    $('#rv-again').addEventListener('click', startReview);
    return;
  }
  const q = reviewQueue[0];
  reviewFace = 'front';
  host.innerHTML = `<div class="rv-wrap">
    <div class="rv-meta"><span>${q.slug} · ${q.title}</span><span>本轮 ${reviewDone + 1} / ${reviewQueue.length}${reviewGood ? ' · 记住 ' + reviewGood : ''} · 到期共 ${due} 张</span></div>
    <div class="rv-card" id="rv-card">
      <div class="rv-q">${q.q}</div>
      <div class="rv-a" hidden>${q.a}</div>
      <div class="rv-hint">先自己回忆，再点击卡片看答案</div>
    </div>
    <div class="rv-actions" id="rv-actions" hidden>
      <button class="rv-btn bad" id="rv-bad">😵 忘了 · 10 分钟后再来</button>
      <button class="rv-btn good" id="rv-good">😀 记住了 · ${nextIntervalDays(q.id)} 天后再见</button>
    </div>
    ${SHARE ? '' : `<p class="rv-dl"><a href="../anki/cs336-quiz.apkg" download>📥 导出 Anki 卡组 (.apkg) · ${QUESTIONS.length} 张</a></p>`}
  </div>`;
  const card = $('#rv-card'), acts = $('#rv-actions');
  card.addEventListener('click', () => {
    if (reviewFace !== 'front') return;
    reviewFace = 'back';
    card.querySelector('.rv-a').hidden = false;
    card.querySelector('.rv-hint').hidden = true;
    acts.hidden = false;
  });
  const answer = ok => {
    schedule(q.id, ok);
    if (ok) reviewGood++;
    reviewDone++;
    reviewQueue.shift();
    renderReview();
  };
  $('#rv-bad').addEventListener('click', () => answer(false));
  $('#rv-good').addEventListener('click', () => answer(true));
}

function navHtml(){
  return LECTURES.map(l => `
    <a class="nav-item" href="#${l.slug}" data-slug="${l.slug}" id="nav-${l.slug}">
      <span class="dot ${l.ready ? (done.has(l.slug) ? 'done' : 'ready') : ''}"></span>
      <span class="num">${l.slug}</span>
      <span>${l.title.length > 24 ? l.title.slice(0, 23) + '…' : l.title}</span>
    </a>
    <div class="nav-toc" id="nav-toc-${l.slug}" hidden></div>`).join('');
}
function cardsHtml(){
  return LECTURES.map(l => `
    <a class="lec-card" href="#${l.slug}" data-slug="${l.slug}">
      <span class="status">${done.has(l.slug) ? CHECK + ' 已读' : ''}</span>
      <div class="no">${l.slug} · ${l.ready ? 'NOTES READY' : 'PENDING'}</div>
      <h3>${l.title}</h3>
      <p>${l.blurb}</p>
      <div class="who"><b>${l.teacher}</b> · ${l.has_transcript ? CHECK + ' 文字稿' : '—'}${l.quiz_count ? ' · 自测 ' + Math.min((quizAns[l.slug] || []).length, l.quiz_count) + '/' + l.quiz_count : ''}</div>
    </a>`).join('');
}
function lecHtml(l){
  const exp = l.ready && l.quiz_count
    ? `<button class="theme-btn myans-btn" data-export="${l.slug}">导出答题</button>` : '';
  const grader = l.ready && l.quiz_count
    ? `<button class="theme-btn grade-all-btn" data-grade="${l.slug}">AI 批改全部</button>` : '';
  const player = SHARE
    ? `<a class="yt-frame yt-card" href="https://youtu.be/${l.yt}" target="_blank" rel="noopener">
        <img src="https://i.ytimg.com/vi/${l.yt}/hq720.jpg" alt="${l.slug} video" loading="lazy"
          onerror="if(!this.dataset.f){this.dataset.f=1;this.src='https://i.ytimg.com/vi/${l.yt}/hqdefault.jpg'}else{this.style.display='none'}">
        <span class="yt-card-hint">▶ 在 YouTube 播放（笔记里的时间戳直达对应位置）</span>
      </a>`
    : (l.video
        ? `<div class="yt-frame">
            <video controls preload="metadata" src="" data-video="${l.video}" title="${l.slug} lecture video"></video>
          </div>`
        : `<div class="yt-frame yt-missing">本地视频缺失 · <a href="https://youtu.be/${l.yt}" target="_blank" rel="noopener">在 YouTube 观看</a></div>`);
  return `
    <div class="view lecture" id="view-${l.slug}">
      <h1>${l.slug} · ${l.title}</h1>
      <div class="lecmeta">
        <span><b style="color:var(--ink)">${l.teacher}</b></span>
        <a class="yt-link" href="https://youtu.be/${l.yt}" target="_blank" rel="noopener">▶ YouTube</a>
        ${l.has_transcript ? '<span class="badge">' + CHECK + ' 文字稿就绪</span>' : ''}
        ${quizBadgeHtml(l)}
        ${grader}
        ${exp}
        <button class="theme-btn mark-btn" data-slug="${l.slug}">${done.has(l.slug) ? '取消已读' : '标记已读'}</button>
      </div>
      ${player}
      ${l.audio ? `<div class="audio-bar">🎧 听笔记（${l.slug} · 口播概要）<audio controls preload="none" src="${l.audio}"></audio></div>` : ''}
      <div class="markdown">${l.html}</div>
      ${l.papers && l.papers.length ? `<section class="papers">
        <h2>延伸阅读 · arxiv</h2>
        <ul>${l.papers.map(pp => `<li><a href="${pp.href}" target="_blank" rel="noopener">${pp.title}</a></li>`).join('')}</ul>
        ${SHARE ? '' : '<p class="papers-more">全部论文见 <a href="papers.html" data-nav="papers">论文索引</a></p>'}
      </section>` : ''}
      ${l.xcript_html ? `<details class="xcript" id="tx-${l.slug}"><summary>📄 原始文字稿（已清洗去重）</summary><div class="markdown">${l.xcript_html}</div></details>` : ''}
    </div>`;
}
function render(){
  $('#nav-list').innerHTML = navHtml();
  $('#cards').innerHTML = cardsHtml();
  $('#ready-count').textContent = LECTURES.filter(l => l.ready).length + ' / ' + LECTURES.length + ' 讲就绪';
  const main = document.querySelector('.main');
  main.querySelectorAll('.lecture').forEach(e => e.remove());
  LECTURES.forEach(l => main.insertAdjacentHTML('beforeend', lecHtml(l)));
  bind();
  quizFold();
  LECTURES.forEach(l => renderRecapDyn(l.slug));
  refreshProgress();
  refreshReviewBadge();
}
function show(slug, seekTo){
function renderToc(slug){
  document.querySelectorAll('.nav-toc').forEach(n => { n.hidden = n.id !== 'nav-toc-' + slug; });
  if (slug === 'papers') return;   // 论文清单 python 预填,展开即可
  const box = document.getElementById('nav-toc-' + slug);
  if (!box) return;
  const view = document.getElementById('view-' + slug);
  const hs = view ? [...view.querySelectorAll('.markdown h2[id]')] : [];
  box.innerHTML = hs.map((h, i) =>
    `<a class="nav-sub" href="#${slug}" data-hi="${i}"><span class="tno">${String(i + 1).padStart(2, '0')}</span>${h.textContent}</a>`).join('');
  box.hidden = !hs.length;
}
/* 侧栏宽度拖拽:pointer capture 拖分隔条,写 CSS 变量并持久化 localStorage */
(function(){
  const sb = document.querySelector('.sidebar');
  if (!sb) return;
  const h = document.createElement('div');
  h.className = 'side-handle';
  sb.appendChild(h);
  const KEY = doneKey.replace(/-done$/, '-sidew');
  const saved = parseInt(localStorage.getItem(KEY) || '', 10);
  if (saved >= 180 && saved <= 560) document.documentElement.style.setProperty('--side-w', saved + 'px');
  let sx = 0, sw = 0;
  h.addEventListener('pointerdown', e => {
    sx = e.clientX;
    sw = sb.getBoundingClientRect().width;
    h.classList.add('dragging');
    h.setPointerCapture(e.pointerId);
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  h.addEventListener('pointermove', e => {
    if (!h.classList.contains('dragging')) return;
    const w = Math.min(560, Math.max(180, Math.round(sw + e.clientX - sx)));
    document.documentElement.style.setProperty('--side-w', w + 'px');
  });
  const finish = e => {
    if (!h.classList.contains('dragging')) return;
    h.classList.remove('dragging');
    document.body.style.userSelect = '';
    try { h.releasePointerCapture(e.pointerId); } catch(_){}
    localStorage.setItem(KEY, String(Math.round(sb.getBoundingClientRect().width)));
  };
  h.addEventListener('pointerup', finish);
  h.addEventListener('pointercancel', finish);
})();

  unfloatAll();
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('#view-' + slug).classList.add('active');
  const nav = $('#nav-' + slug);
  if(nav) nav.classList.add('active');
  history.replaceState(null, '', '#' + slug + (seekTo != null ? '@' + seekTo : ''));
  const v = document.querySelector('#view-' + slug + ' video[data-video]');
  if (v && !v.getAttribute('src')) v.src = v.dataset.video;
  document.querySelectorAll('video[data-video]').forEach(el => {
    if (el.closest('.view') && el.closest('.view').id !== 'view-' + slug) el.pause();
  });
  if (seekTo != null && v) seekVideo(v, seekTo);
  if (slug === 'review') startReview();   // entering the view starts a session
  renderToc(slug);
  window.scrollTo({top:0});
}
function seekVideo(v, t){
  const apply = () => { v.currentTime = t; const p = v.play(); if (p) p.catch(()=>{}); };
  if (v.readyState >= 1) apply();
  else v.addEventListener('loadedmetadata', apply, { once: true });
}
/* [m:ss] anchors in notes seek the active player; hash may carry #L0X@sec.
   If the player is scrolled out of view it floats up as a mini-player so
   reading continues uninterrupted; the close button returns it inline. */
function floatify(v){
  const f = v.closest('.yt-frame');
  if (!f) return;
  if (!f.querySelector('.float-close')) {
    const x = document.createElement('button');
    x.className = 'float-close'; x.textContent = '×';
    x.setAttribute('aria-label', '收回视频小窗');
    f.appendChild(x);
  }
  f.classList.add('float-panel');
}
function unfloatAll(){
  document.querySelectorAll('.yt-frame.float-panel').forEach(f => f.classList.remove('float-panel'));
}
document.addEventListener('click', e => {
  const x = e.target.closest('.float-close');
  if (x) {
    const f = x.closest('.yt-frame');
    const v = f && f.querySelector('video');
    if (v) v.pause();  // keep currentTime, just stop playing
    unfloatAll();
    return;
  }
  const a = e.target.closest('.ts');
  if (!a || a.getAttribute('href') !== '#t=' + a.dataset.t) return;
  e.preventDefault();
  const v = document.querySelector('.view.active video[data-video]');
  if (!v) return;
  if (!v.getAttribute('src')) v.src = v.dataset.video;
  seekVideo(v, parseInt(a.dataset.t));
  const f = v.closest('.yt-frame');
  if (f){
    const r = f.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.height < 40) floatify(v);
  }
});
function quizFold(){
  /* self-test answers (li > blockquote) collapse into <details> so you answer first */
  document.querySelectorAll('.markdown li > blockquote').forEach(bq => {
    const li = bq.parentElement;
    if (!li || li.querySelector('details.quiz')) return;
    const d = document.createElement('details');
    d.className = 'quiz';
    const s = document.createElement('summary');
    s.textContent = '对照参考答案';
    bq.remove();
    d.appendChild(s);
    d.appendChild(bq);
    li.appendChild(d);
  });
  /* expanding an answer counts it as attempted; progress persists */
  document.querySelectorAll('details.quiz').forEach(d => {
    const view = d.closest('.view');
    if (!view || d.dataset.qid) return;
    const slug = view.id.slice(5);
    const idx = [...view.querySelectorAll('details.quiz')].indexOf(d);
    d.dataset.qid = String(idx);
    // 原答输入框常驻在本 li 内、对照折叠之前:先落笔,再点开对照
    const li = d.parentElement;
    if (li && !li.querySelector('textarea.myans')){
      li.dataset.idx = String(idx);
      const key = String(idx);
      const ta = document.createElement('textarea');
      ta.className = 'myans';
      ta.placeholder = '先写下你的回答,再对照参考答案——原答自动保存,可 AI 批改。';
      ta.value = (myAns[slug] || {})[key] || '';
      if (ta.value.trim()) d.classList.add('answered');
      ta.addEventListener('input', () => {
        saveMyAns(slug, key, ta.value);
        d.classList.toggle('answered', !!ta.value.trim());
      });
      const row = document.createElement('div');
      row.className = 'grade-row';
      row.innerHTML = `<button class="theme-btn grade-btn">AI 批改</button><span class="grade-status" style="font-size:12px;color:var(--ink2)"></span>`;
      row.querySelector('.grade-btn').addEventListener('click', e =>
        gradeOne(slug, key, e.currentTarget, li.querySelector('.grade-status')).then(() => renderRecapDyn(slug)));
      const out = document.createElement('div');
      out.className = 'grade-out';
      li.insertBefore(ta, d);
      li.insertBefore(row, d);
      li.insertBefore(out, d);
      renderGrade(slug, key);
    }
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      const arr = quizAns[slug] || [];
      if (arr.includes(String(idx))) return;
      arr.push(String(idx));
      quizAns[slug] = arr;
      localStorage.setItem(quizKey, JSON.stringify(quizAns));
      refreshProgress();
      updateQuizBadge(slug);
    });
  });
}
function bind(){
  document.querySelectorAll('[data-slug]').forEach(el =>
    el.addEventListener('click', e => {
      if(e.target.closest('.mark-btn')) return;
      e.preventDefault();
      const s = el.dataset.slug;
      const active = document.querySelector('.view.active');
      if (active && active.id === 'view-' + s){
        const box = document.getElementById('nav-toc-' + s);
        if (box && !box.hidden){ box.hidden = true; return; }
      }
      show(s);
    }));
  /* share build: in-page transcript links auto-open their collapsed block */
  document.querySelectorAll('a[href^="#tx-"]').forEach(a =>
    a.addEventListener('click', () => {
      const d = document.getElementById(a.getAttribute('href').slice(1));
      if (d) d.open = true;
    }));
  document.querySelectorAll('.myans-btn').forEach(btn =>
    btn.addEventListener('click', () => exportMyAns(btn.dataset.export, btn)));
  document.querySelectorAll('.grade-all-btn').forEach(btn =>
    btn.addEventListener('click', () => gradeAllLec(btn.dataset.grade, btn)));
  document.getElementById('ai-set-btn').addEventListener('click', openSettings);
  document.getElementById('ai-set-save').addEventListener('click', () => {
    aiCfg.endpoint = document.getElementById('set-endpoint').value.trim() || aiCfg.endpoint;
    aiCfg.model = document.getElementById('set-model').value.trim() || aiCfg.model;
    aiCfg.key = document.getElementById('set-key').value.trim();
    saveAiCfg();
    closeSettings();
  });
  document.getElementById('ai-set-cancel').addEventListener('click', closeSettings);
  document.getElementById('ai-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSettings();
  });
  document.querySelector('.sidebar').addEventListener('click', e => {
    const a = e.target.closest('.nav-sub');
    if (!a) return;
    e.preventDefault();
    const slug = a.closest('.nav-toc').id.replace('nav-toc-', '');
    const view = document.getElementById('view-' + slug);
    const el = a.dataset.hi != null ? (view && view.querySelectorAll('.markdown h2[id]')[Number(a.dataset.hi)])
                                     : document.getElementById(a.dataset.target);
    if (el) window.scrollTo({top: el.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth'});
  });
  document.querySelectorAll('.mark-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const s = btn.dataset.slug;
      done.has(s) ? done.delete(s) : done.add(s);
      localStorage.setItem(doneKey, JSON.stringify([...done]));
      render(); show(s);
    }));
}
function syncThemeIcon(){
  const r = document.documentElement;
  const dark = r.dataset.theme === 'dark' ||
    (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  $('#icon-sun').hidden = !dark;
  $('#icon-moon').hidden = dark;
}
$('#theme-btn').addEventListener('click', () => {
  const r = document.documentElement;
  const dark = r.dataset.theme === 'dark' ||
    (!r.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  r.dataset.theme = dark ? 'light' : 'dark';
  localStorage.setItem('cs336-theme', r.dataset.theme);
  syncThemeIcon();
});
const savedTheme = localStorage.getItem('cs336-theme');
if(savedTheme) document.documentElement.dataset.theme = savedTheme;
syncThemeIcon();
render();
function hashRoute(){
  const [h, t] = location.hash.slice(1).split('@');
  if (!h || !document.getElementById('view-' + h)) return;
  const sec = t != null && t !== '' ? parseInt(t, 10) : NaN;
  show(h, isFinite(sec) && sec >= 0 ? sec : undefined);
}
(function(){
  render();
  const h = location.hash.slice(1);
  hashRoute();
  if (!document.querySelector('.view.active')) show('overview');
})();
addEventListener('hashchange', () => {
  if (document.getElementById('view-' + location.hash.slice(1).split('@')[0])) hashRoute();
});
if (window.hairline) {
  const fig = document.getElementById('hairline-terminal');
  if (fig) window.hairline.terminal(fig, { intensity: 0.8 });
}

/* ---- motion singles (translated from rare-ui, vanilla) ---- */
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* fluid-orb: WebGL fbm blob, slow drift (rare-ui fluid-orb) */
(function initOrb(){
  const host = document.getElementById('fluid-orb');
  if (!host) return;
  const VERT = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.0,1.0);}';
  const FRAG = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
  precision highp float;
  #else
  precision mediump float;
  #endif
  uniform vec2 u_resolution;uniform float u_time;uniform vec3 u_color;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
  float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}
  float fbm(vec2 p){float v=0.0;float a=0.6;for(int i=0;i<3;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}
  void main(){
    vec2 uv=gl_FragCoord.xy/u_resolution.xy;
    float t=u_time*0.22;
    vec2 drift=vec2(sin(t)+0.6*sin(t*1.7+1.3),cos(t*0.8)+0.6*cos(t*1.3+2.1));
    vec2 p=vec2(uv.x*1.8,uv.y*1.0)+drift*0.7;
    vec2 q=vec2(fbm(p+drift),fbm(p+vec2(3.2,1.5)-drift));
    float f=fbm(p+1.2*q);
    float g=clamp(1.0-uv.y,0.0,1.0);
    float anchor=smoothstep(0.0,0.3,uv.y);
    float shade=clamp(g+(f-0.5)*0.8*anchor,0.0,1.0);
    vec3 white=vec3(0.99,1.0,1.0);
    vec3 light=mix(white,u_color,0.5);
    vec3 col=white;
    col=mix(col,light,smoothstep(0.28,0.52,shade));
    col=mix(col,u_color,smoothstep(0.58,0.88,shade));
    float edge=smoothstep(0.5,0.49,distance(uv,vec2(0.5)));
    gl_FragColor=vec4(col*edge,edge);
  }`;
  const cv = document.createElement('canvas');
  host.appendChild(cv);
  const gl = cv.getContext('webgl', {antialias:true, alpha:true});
  if (!gl) { host.remove(); return; }
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const prog = gl.createProgram();
  const vs = mk(gl.VERTEX_SHADER, VERT), fs = mk(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { host.remove(); return; }
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_resolution');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uColor = gl.getUniformLocation(prog, 'u_color');
  const hexToRgb = hex => {
    let h = hex.trim().replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    const n = parseInt(h, 16);
    return Number.isNaN(n) ? [0.55,0.08,0.08] : [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];
  };
  const accent = () => getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#8C1515';
  gl.uniform3fv(uColor, hexToRgb(accent()));
  const px = Math.round(26 * Math.min(devicePixelRatio || 1, 2));
  cv.width = px; cv.height = px;
  gl.viewport(0, 0, px, px); gl.uniform2f(uRes, px, px);
  const start = performance.now();
  const render = now => { gl.uniform1f(uTime, REDUCE ? 0 : (now - start)/1000); gl.drawArrays(gl.TRIANGLES, 0, 6); if (!REDUCE) requestAnimationFrame(render); };
  render(start);
  new MutationObserver(() => gl.uniform3fv(uColor, hexToRgb(accent())))
    .observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
})();

/* gravity-letters: heightmap piling glyphs (rare-ui gravity-letters, minus device tilt) */
(function initGravity(){
  const host = document.getElementById('glyph-tray');
  if (!host) return;
  const COL = 8, CLEARANCE = 24, SLOPE = 0.35, TILT = 26, BOUNCE = 0.22;
  const HOLD_MS = 300, POUR_MS = 120, LEAVE_MS = 350;
  const POOL = 'AGENTRAGMCPTOOLMEMORY';
  const rand = (a,b) => a + Math.random()*(b-a);
  const clamp = (v,a,b) => Math.min(Math.max(v,a),b);
  const spanOf = (x,w,cols) => {
    const from = Math.max(0, Math.floor(x/COL));
    return [from, Math.min(cols-1, Math.max(from, Math.ceil((x+w)/COL)-1))];
  };
  const restY = (hs,x,w,h,rot,H) => {
    const [from,to] = spanOf(x,w,hs.length), tan = Math.tan(Math.abs(rot)*Math.PI/180);
    let y = Infinity;
    for (let i=from;i<=to;i++){
      const cx = clamp((i+.5)*COL-x,0,w);
      y = Math.min(y, H - hs[i] - h + Math.min((rot>=0?w-cx:cx)*tan, h-1));
    }
    return y;
  };
  const deposit = (hs,x,w,h,rot,y,H) => {
    const [from,to] = spanOf(x,w,hs.length), tan = Math.tan(Math.abs(rot)*Math.PI/180);
    for (let i=from;i<=to;i++){
      const cx = clamp((i+.5)*COL-x,0,w);
      hs[i] = Math.max(hs[i], H - y - Math.min((rot>=0?cx:w-cx)*tan, h-1));
    }
  };
  const windowTop = (hs,from,to) => {
    if (from<0 || to>=hs.length) return Infinity;
    let t = 0; for (let i=from;i<=to;i++) t = Math.max(t,hs[i]); return t;
  };
  const groundTilt = (hs,x,w) => {
    const [from,to] = spanOf(x,w,hs.length);
    if (to<=from) return 0;
    const mid = Math.ceil((from+to)/2), hl = windowTop(hs,from,mid-1), hr = windowTop(hs,mid,to);
    if (!isFinite(hl) || !isFinite(hr)) return 0;
    return Math.atan2(hl-hr, Math.max(((to-from+1)/2)*COL,1)) * 180/Math.PI;
  };
  const findRestX = (hs,x,w,h,maxX,bias,eager) => {
    let cur = clamp(x,0,maxX);
    const drop = h*SLOPE*eager, step = Math.max(COL, Math.round(w/3));
    for (let i=0;i<64;i++){
      const [from,to] = spanOf(cur,w,hs.length), s = to-from+1;
      const top = windowTop(hs,from,to);
      const dl = top - windowTop(hs,from-s,from-1), dr = top - windowTop(hs,to+1,to+s);
      let next = cur;
      if (dl>drop && dr>drop && Math.abs(dl-dr)<=1) next = bias<0 ? Math.max(cur-step,0) : Math.min(cur+step,maxX);
      else if (dl>drop && dl>=dr) next = Math.max(cur-step,0);
      else if (dr>drop) next = Math.min(cur+step,maxX);
      if (next===cur) break; cur = next;
    }
    return cur;
  };
  const layer = document.createElement('div');
  layer.className = 'gravity-layer'; layer.setAttribute('aria-hidden','true');
  host.appendChild(layer);
  const bodies = new Map();
  let heights = [], raf = 0, last = 0, idSeq = 0, count = 0;
  const paint = b => { b.el.style.transform = `translate3d(${b.x+b.dx}px,${b.y+b.dy}px,0) rotate(${b.rot}deg)`; };
  const squash = b => b.el.firstChild.animate(
    [{transform:'scaleY(0.82)'},{transform:'scaleY(1)'}],
    {duration:160, easing:'cubic-bezier(0.215,0.61,0.355,1)'});
  const retarget = (b,W,H) => {
    const wind = 0, bias = Math.random()<.5 ? -1 : 1;
    const seekX = findRestX(heights, b.x, b.ew, b.eh, Math.max(W-b.ew,0), bias, 1);
    const sq = Math.min(1, b.eh/b.ew);
    const restRot = clamp(groundTilt(heights,seekX,b.ew)+rand(-1,1)*(2+8*sq), -TILT, TILT);
    const rad = Math.abs(restRot)*Math.PI/180;
    b.restRot = restRot;
    b.w = b.ew*Math.cos(rad)+b.eh*Math.sin(rad);
    b.h = b.ew*Math.sin(rad)+b.eh*Math.cos(rad);
    b.dx = (b.w-b.ew)/2; b.dy = (b.h-b.eh)/2;
    b.targetX = clamp(seekX-b.dx, 0, Math.max(W-b.w,0));
    b.targetY = restY(heights, b.targetX, b.w, b.h, restRot, H);
    deposit(heights, b.targetX, b.w, b.h, restRot, b.targetY, H);
    b.x0 = b.x; b.y0 = Math.min(b.y, b.targetY);
    b.sway = rand(-1,1)*Math.min(12,(b.targetY-b.y0)*0.05);
    b.bounced = false; b.done = false;
  };
  const rebuild = () => {
    const W = host.clientWidth, H = host.clientHeight;
    heights = new Array(Math.max(1, Math.ceil(W/COL))).fill(0);
    for (const b of [...bodies.values()].sort((a,z)=>z.y-a.y)) {
      b.spin = b.rot;
      const rest = restY(heights, b.x, b.w, b.h, b.restRot, H);
      if (b.y < rest-1 || b.leaving) { b.vy = 0; b.dx = 0; b.dy = 0; retarget(b, W, H); }
      else deposit(heights, b.x, b.w, b.h, b.restRot, b.y, H);
    }
  };
  const step = now => {
    const g = 800, dt = Math.max(0, Math.min((now-last)/1000, 1/30));
    last = now;
    let active = false;
    for (const b of bodies.values()) {
      if (b.done) continue;
      b.vy += g*dt; b.y += b.vy*dt; b.spin += b.vr*dt;
      const total = b.targetY-b.y0, p = total>0 ? Math.min((b.y-b.y0)/total,1) : 1;
      b.x = b.x0+(b.targetX-b.x0)*p*(2-p)+Math.sin(p*Math.PI)*b.sway;
      const blend = p*p*p;
      b.rot = b.spin*(1-blend)+b.restRot*blend;
      if (b.y >= b.targetY) {
        b.x = b.targetX; b.y = b.targetY; b.rot = b.restRot;
        const rebound = b.vy*BOUNCE;
        if (!b.bounced && rebound*rebound > g*6) {
          b.bounced = true; b.vy = -rebound;
          b.x0 = b.targetX; b.y0 = b.targetY; b.sway = 0; b.vr = 0; b.spin = b.restRot;
          paint(b); squash(b); active = true; continue;
        }
        b.done = true; paint(b);
        if (!b.bounced) squash(b);
        continue;
      }
      paint(b); active = true;
    }
    raf = active ? requestAnimationFrame(step) : 0;
  };
  const wake = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } };
  const addGlyph = (ch, x, y, still) => {
    const W = host.clientWidth, H = host.clientHeight;
    if (heights.length !== Math.max(1, Math.ceil(W/COL))) rebuild();
    const el = document.createElement('span');
    el.className = 'gl';
    el.style.fontSize = Math.round(22*rand(0.8,1.2))+'px';
    el.innerHTML = '<span>'+ch+'</span>';
    layer.appendChild(el);
    const ew = el.offsetWidth || 1, eh = el.offsetHeight || 1;
    const sq = Math.min(1, eh/ew);
    const b = {
      el, ew, eh, w:ew, h:eh, dx:0, dy:0, x0:0, y0:0,
      x: clamp(x-ew/2, 0, Math.max(W-ew,0)), y: y-eh/2,
      targetX:0, targetY:0, vy:0,
      spin: still ? 0 : rand(-1,1)*(4+10*sq), rot:0,
      vr: still ? 0 : rand(-1,1)*(50+130*sq),
      restRot:0, sway:0, bounced:false, done:false, leaving:false,
    };
    retarget(b, W, H);
    if (still) {
      b.x = b.x0 = b.targetX; b.y = b.y0 = b.targetY;
      b.rot = b.restRot; b.done = true;
    } else {
      b.rot = b.spin;
      let startY = Math.min(b.y, b.targetY-CLEARANCE);
      for (const o of bodies.values()) {
        if (o.targetX < b.targetX+b.w && b.targetX < o.targetX+o.w && !o.done)
          startY = Math.min(startY, o.y-b.h-8);
      }
      b.y = b.y0 = startY;
    }
    const key = idSeq++;
    bodies.set(key, b);
    paint(b);
    if (!still) el.firstChild.animate(
      [{transform:'scale(0.5)',opacity:.3},{transform:'scale(1)',opacity:1}],
      {duration:150, easing:'cubic-bezier(0.215,0.61,0.355,1)'});
    if (++count > 32) {
      for (const [k, ob] of bodies) {
        if (!ob.leaving) {
          ob.leaving = true; ob.el.style.opacity = 0;
          setTimeout(() => { ob.el.remove(); bodies.delete(k); rebuild(); }, LEAVE_MS);
          break;
        }
      }
    }
    if (!still) wake();
  };
  const dropAt = (cx, cy) => {
    const r = host.getBoundingClientRect();
    addGlyph(POOL[Math.floor(Math.random()*POOL.length)],
      clamp(cx-r.left,0,r.width), clamp(cy-r.top,0,r.height), REDUCE);
  };
  let pour = null;
  host.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dropAt(e.clientX, e.clientY);
    pour = {x:e.clientX, y:e.clientY,
      hold: setTimeout(() => { pour.timer = setInterval(() => dropAt(pour.x+rand(-8,8), pour.y), POUR_MS); }, HOLD_MS)};
  });
  host.addEventListener('pointermove', e => { if (pour) { pour.x = e.clientX; pour.y = e.clientY; } });
  const stopPour = () => { if (pour) { clearTimeout(pour.hold); clearInterval(pour.timer); pour = null; } };
  host.addEventListener('pointerup', stopPour);
  host.addEventListener('pointercancel', stopPour);
  host.addEventListener('pointerleave', stopPour);
  /* opening beat: A G E N T drops in one by one */
  'AGENT'.split('').forEach((ch, i) => {
    setTimeout(() => {
      const W = host.clientWidth;
      addGlyph(ch, W*0.18 + i*W*0.14, REDUCE ? host.clientHeight*0.5 : -10, REDUCE);
    }, 500 + i*160);
  });
})();

/* magnetic tilt on lecture cards (fine pointers only) */
(function initTilt(){
  if (REDUCE || !matchMedia('(pointer:fine)').matches) return;
  const MAX = 2.5;
  const cards = document.getElementById('cards');
  if (!cards) return;
  cards.addEventListener('pointerover', e => {
    const el = e.target.closest('.lec-card');
    if (el && !el._tiltBound) { el._tiltBound = true; bindCard(el); }
  });
  function bindCard(el){
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const mx = (e.clientX-r.left)/r.width - .5, my = (e.clientY-r.top)/r.height - .5;
      el.classList.add('tilting');
      el.style.transform = `perspective(600px) translateY(-2px) rotateX(${(-my*MAX).toFixed(2)}deg) rotateY(${(mx*MAX).toFixed(2)}deg)`;
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('tilting');
      el.style.transform = '';
    });
  }
})();
"""

HTML_SHELL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CS336 学习中心 · Language Modeling from Scratch__TITLE_TAIL__</title>
<style>__CSS__</style>
</head>
<body>
<header class="topbar">
  <div>
    <a class="crumb" href="../../" style="display:inline-block;margin-bottom:3px">← 课程索引</a>
    <div class="brand"><span class="fluid-orb" id="fluid-orb" aria-hidden="true"></span><span class="course">CS336</span> 学习中心</div>
    <div class="sub">Stanford · Language Modeling from Scratch · 17 Lectures</div>
  </div>
  <div class="spacer"></div>
  <div class="progress-pill" id="prog"></div>
  <button class="theme-btn" id="ai-set-btn" aria-label="AI 批改设置" title="AI 批改设置(API 端点与 Key)">
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
  </button>
  <button class="theme-btn" id="theme-btn" aria-label="切换深浅色主题">
    <svg id="icon-moon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg id="icon-sun" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
  </button>
</header>
<div class="modal-mask" id="ai-modal">
  <div class="modal">
    <h3>AI 批改设置</h3>
    <p class="hint">批改走 OpenAI 兼容端点，默认 DeepSeek。Key 只保存在本浏览器（localStorage），不进任何文件。</p>
    <label for="set-endpoint">API Endpoint</label>
    <input id="set-endpoint" placeholder="https://api.deepseek.com/v1/chat/completions">
    <label for="set-model">模型</label>
    <input id="set-model" placeholder="deepseek-chat">
    <label for="set-key">API Key</label>
    <input id="set-key" type="password" placeholder="sk-…">
    <div class="modal-btns">
      <button class="theme-btn" id="ai-set-cancel">取消</button>
      <button class="theme-btn" id="ai-set-save">保存</button>
    </div>
  </div>
</div>
<div class="layout">
  <nav class="sidebar">
    <p class="group-label">课程地图</p>
    <a class="nav-item" data-slug="overview" id="nav-overview"><span class="num">◈</span><span>总览</span></a>
    <a class="nav-item" data-slug="review" id="nav-review"><span class="num">⚡</span><span>间隔复习</span><span class="rv-badge" id="review-badge" hidden></span></a>
    __PAPERS_NAV__
    <p class="group-label">Lectures</p>
    <div id="nav-list"></div>
  </nav>
  <main class="main">
    <div class="view" id="view-review"></div>
    <div class="view" id="view-papers">__PAPERS_VIEW__</div>
    <div class="view" id="view-overview">
      <div class="hero">
        <div class="hero-copy">
          <h1>Language Modeling from Scratch<br>十七讲学习骨架</h1>
          <p class="lede">每讲一份蒸馏笔记：带时间锚点的分节要点、核心概念速查卡、自测题。时间戳可直接跳回视频对应位置——把 100 分钟的视频变成 10 分钟的复习。</p>
          <div class="meta">
            <span>讲师 <b>Percy Liang &amp; Tatsunori Hashimoto</b></span>
            <span>笔记 <b id="ready-count"></b></span>
            <span>原始素材 <b>17 视频 + 5 作业 PDF</b></span>
          </div>
        </div>
        <div class="hero-fig" id="hairline-terminal" aria-hidden="true"></div>
      </div>
      <div class="glyph-tray" id="glyph-tray">
        <span class="tray-hint">点击空白处 · 落一枚字母</span>
      </div>
      <div class="map" id="cards"></div>
      <div class="toolbox">
        <h2>学习工具</h2>
        <div class="tool-grid">
__TOOL_CARDS__
        </div>
      </div>
      <p class="foot-note">构建自 lectures/ 视频字幕 · 原始文字稿已渲染至 transcripts/ · 笔记源文件位于 notes/</p>
    </div>
  </main>
</div>
<script>__HAIRLINE__</script>
<script>__JS__</script>
</body>
</html>
"""


HAIRLINE_BUNDLE = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/cs336/study-hub/assets/hairline-terminal.js")

TRANSCRIPT_SHELL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__NUM__ 文字稿 · CS336 学习中心</title>
<style>__CSS__</style>
</head>
<body>
<header class="topbar">
  <div>
    <div class="brand"><a class="crumb" href="../index.html#__SLUG__">← 返回 __NUM__ 笔记</a></div>
    <div class="sub">CS336 · __TITLE__ · 原始文字稿（自动字幕，轻度去重）</div>
  </div>
  <div class="spacer"></div>
  <button class="theme-btn" id="theme-btn" aria-label="切换深浅色主题">
    <svg id="icon-moon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg id="icon-sun" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
  </button>
</header>
<main class="tmain"><article class="markdown">__HTML__</article></main>
<script>
(function(){
  const btn = document.getElementById('theme-btn');
  const dark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const sync = () => { document.getElementById('icon-sun').hidden = !dark(); document.getElementById('icon-moon').hidden = dark(); };
  btn.addEventListener('click', () => {
    document.documentElement.dataset.theme = dark() ? 'light' : 'dark';
    localStorage.setItem('cs336-theme', document.documentElement.dataset.theme);
    sync();
  });
  const saved = localStorage.getItem('cs336-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  sync();
})();
</script>
</body>
</html>
"""


def build_transcripts(data: list) -> int:
    tdir = OUT.parent / "transcripts"
    tdir.mkdir(parents=True, exist_ok=True)
    count = 0
    for lec in data:
        t = NOTES / f"{lec['slug']}-transcript.md"
        if not t.exists():
            continue
        md = t.read_text(encoding="utf-8")
        md = re.sub(r'^# Transcript: \S+', f'# {lec["slug"][:3]} · {lec["title"]} — 原始文字稿', md, count=1)
        # time anchors jump back to the notes page player at that second
        html = ts_links(render_md(md), href=f"../index.html#{lec['slug']}")
        page = (TRANSCRIPT_SHELL
                .replace("__CSS__", CSS)
                .replace("__SLUG__", lec["slug"])
                .replace("__NUM__", lec["slug"][:3])
                .replace("__TITLE__", lec["title"])
                .replace("__HTML__", html))
        (tdir / f"{lec['slug']}.html").write_text(page, encoding="utf-8")
        count += 1
    return count


PAPERS_SHELL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__PAGE_TITLE__</title>
<style>__CSS__</style>
<style>
main.pmain{max-width:880px;margin:0 auto;padding:34px 28px 90px}
.pmain h1{font-size:26px;margin:0 0 6px;letter-spacing:-.01em;color:var(--ink)}
.pmain .psub{color:var(--ink2);font-size:13.5px;margin:0 0 24px}
.paper-list{list-style:none;margin:0;padding:0}
.paper-list li{display:flex;align-items:baseline;gap:14px;padding:10px 2px;border-bottom:1px solid var(--line)}
.paper-list a{color:var(--ink);text-decoration:none;font-size:14.5px;line-height:1.55}
.paper-list a:hover{color:var(--accent)}
.paper-tag{margin-left:auto;flex:none;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--accent);
  background:color-mix(in srgb, var(--accent) 10%, transparent);
  border:1px solid color-mix(in srgb, var(--accent) 28%, transparent);
  border-radius:999px;padding:2px 10px}
.audio-row{list-style:none;padding:14px 2px;border-bottom:1px solid var(--line)}
.audio-row .ar-title{font-size:14.5px;font-weight:600;color:var(--ink);display:block;margin-bottom:8px}
.audio-row audio{width:100%}
.audio-row .ar-meta{font-size:12px;color:var(--ink2);margin-top:6px;display:block}
</style>
</head>
<body>
<header class="topbar">
  <div>
    <div class="brand"><a class="crumb" href="index.html">← 返回学习中心</a></div>
    <div class="sub">__PAGE_SUB__</div>
  </div>
  <div class="spacer"></div>
  <button class="theme-btn" id="theme-btn" aria-label="切换深浅色主题">
    <svg id="icon-moon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    <svg id="icon-sun" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" hidden><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>
  </button>
</header>
<main class="pmain">
  <h1>__PAGE_H1__</h1>
  <p class="psub">__PAGE_PSUB__</p>
  <ul class="paper-list">
__LIST__
  </ul>
</main>
<script>
(function(){
  const btn = document.getElementById('theme-btn');
  const dark = () => document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const sync = () => { document.getElementById('icon-sun').hidden = !dark(); document.getElementById('icon-moon').hidden = dark(); };
  btn.addEventListener('click', () => {
    document.documentElement.dataset.theme = dark() ? 'light' : 'dark';
    localStorage.setItem('cs336-theme', document.documentElement.dataset.theme);
    sync();
  });
  const saved = localStorage.getItem('cs336-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  sync();
})();
</script>
</body>
</html>
"""


def papers_rows(share: bool = False) -> list:
    """One <li> per arxiv PDF; share build links arxiv.org/abs (no id -> no link)."""
    adir = VIDEOS.parent / "readings" / "arxiv"
    files = sorted(p.name for p in adir.glob("*.pdf") if p.suffix.lower() == ".pdf")
    owner = {}
    for slug, frags in PAPER_MAP.items():
        for frag in frags:
            owner.setdefault(frag, slug[:3])
    rows = []
    for pi, f in enumerate(files, 1):
        stem = re.sub(r"\.pdf$", "", f, flags=re.I).strip()
        title = re.sub(r"\s*\[[\w.-]+\]$", "", stem).strip()
        tag = next((num for frag, num in owner.items() if frag in f), "")
        taghtml = f'<span class="paper-tag">{tag}</span>' if tag else ""
        if share:
            m = re.search(r"\[([A-Za-z0-9.-]{6,})\]$", stem)
            body = (f'<a href="https://arxiv.org/abs/{m.group(1)}" target="_blank" rel="noopener">{title}</a>'
                    if m else f'<span class="paper-none">{title}</span>')
        else:
            body = f'<a href="../readings/arxiv/{quote(f)}" target="_blank" rel="noopener">{title}</a>'
        rows.append(f'<li id="paper-{pi}">{body}{taghtml}</li>')
    return rows


def build_papers(data: list) -> int:
    rows = papers_rows()
    page = (PAPERS_SHELL.replace("__CSS__", CSS)
            .replace("__PAGE_TITLE__", "论文索引 · CS336 学习中心")
            .replace("__PAGE_SUB__", f"CS336 · 配套论文库 · 共 {len(rows)} 篇（readings/arxiv/）")
            .replace("__PAGE_H1__", "论文索引")
            .replace("__PAGE_PSUB__", "全部讲次配套阅读（readings/arxiv/），标签为归属讲次，点击打开本地 PDF。")
            .replace("__N__", str(len(rows)))
            .replace("__LIST__", "\n".join(f"    {r}" for r in rows)))
    (OUT.parent / "papers.html").write_text(page, encoding="utf-8")
    return len(rows)


def build_audio(data: list) -> int:
    """audio.html — 口播音频列表页;全部讲就绪才生成,否则连入口卡一起不显示
    (部分就绪也会被当成「生成中」占位的变体,用户裁决:全有才显示)。"""
    rows = []
    for d in data:
        if not d.get("audio"):
            continue
        rows.append(f'<li class="audio-row"><span class="ar-title">{d["slug"][:3]} · {d["title"]}</span>'
                    f'<audio controls preload="none" src="{d["audio"]}"></audio>'
                    '<span class="ar-meta">与笔记页顶部（视频下方）同款播放器，通勤复习用</span></li>')
    if len(rows) < len(LECTURES):
        (OUT.parent / "audio.html").unlink(missing_ok=True)  # 清掉上一轮可能留下的孤儿页
        return 0
    page = (PAPERS_SHELL.replace("__CSS__", CSS)
            .replace("__PAGE_TITLE__", "口播音频 · CS336 学习中心")
            .replace("__PAGE_SUB__", f"CS336 · 听笔记 · {len(rows)} 讲就绪")
            .replace("__PAGE_H1__", "口播音频")
            .replace("__PAGE_PSUB__", "每讲概要口播，通勤复习用；笔记页顶部（视频下方）有同款播放器。")
            .replace("__N__", str(len(rows)))
            .replace("__LIST__", "\n".join(f"    {r}" for r in rows)))
    (OUT.parent / "audio.html").write_text(page, encoding="utf-8")
    return len(rows)


def build_questions(data: list) -> list:
    """Flat card list for the in-site spaced-repetition reviewer.

    Same parse_quiz source as the Anki export, so deck and site stay in
    parity; q/a are rendered to HTML with the same inline engine."""
    out = []
    for d in data:
        if not d["ready"]:
            continue
        md = (NOTES / f"{d['slug']}-study-guide.md").read_text(encoding="utf-8")
        for i, it in enumerate(parse_quiz(md)):
            out.append({
                "id": f"{d['slug'][:3]}-{i}",
                "slug": d["slug"][:3],
                "title": d["title"],
                "q": markdown.markdown(it["q"], output_format="html5"),
                "a": markdown.markdown(it["a"], output_format="html5"),
            })
    return out


def tool_cards(data: list, share: bool) -> str:
    quiz_total = sum(d.get("quiz_count", 0) for d in data)
    cards = [(f'<a class="tool" data-slug="review" href="#review">'
              f'<b>⚡ 间隔复习 · {quiz_total} 张卡</b>'
              '<span>站内版 Anki：先回忆再翻面，「忘了」10 分钟后重来，「记住了」按记忆曲线拉长间隔'
              '（简化 SM-2，进度存在本浏览器）'
              + ('</span></a>' if share else '。想在 Anki 里长期记？复习页内有 .apkg 下载</span></a>'))]
    if share:
        cards.append('<div class="tool"><b>🌐 分享版说明</b>'
                     '<span>本文件自包含：笔记、自测、间隔复习全在内；视频与论文在线打开（YouTube / arxiv），'
                     '口播音频与本地 PDF 仅完整本地版包含</span></div>')
    else:
        n_audio = sum(1 for d in data if d.get("audio"))
        if n_audio == len(LECTURES):
            cards.append(f'<a class="tool" href="audio.html"><b>🎧 口播音频 · {n_audio}/{len(LECTURES)} 讲就绪</b>'
                         '<span>点开是全部音频列表；每讲笔记页顶部（视频下方）也有同款播放器，通勤复习用</span></a>')
        n_papers = len(papers_rows())
        cards.append(f'<a class="tool" href="papers.html"><b>📚 论文索引 · {n_papers} 篇</b>'
                     '<span>全部配套阅读，标注归属讲次，点击打开本地 PDF</span></a>')
    return "\n          ".join(cards)


def build_page(share: bool) -> str:
    data = load_lectures(share)
    js = (JS
          .replace("__DATA__", json.dumps(data, ensure_ascii=False))
          .replace("__QUESTIONS__", json.dumps(build_questions(data), ensure_ascii=False))
          .replace("__SHARE__", "true" if share else "false"))
    hairline = HAIRLINE_BUNDLE.read_text(encoding="utf-8") if HAIRLINE_BUNDLE.exists() else "/* hairline bundle missing */"
    if share:
        rows = papers_rows(share=True)
        _pt = []
        for _r in rows:
            _m = re.search(r'<a[^>]*>([^<]+)</a>', _r) or re.search(r'<span class="paper-none">([^<]+)</span>', _r)
            _pt.append(_m.group(1) if _m else '论文')
        papers_nav = ('<a class="nav-item" data-slug="papers" id="nav-papers">'
                      '<span class="num">📚</span><span>论文索引</span></a>'
                      + '<div class="nav-toc" id="nav-toc-papers" hidden>'
                      + ''.join(f'<a class="nav-sub" href="#papers" data-target="paper-{i + 1}">{_t}</a>'
                                for i, _t in enumerate(_pt))
                      + '</div>')
        papers_view = (f'<div class="pwrap"><h1>论文索引</h1>'
                       f'<p class="psub">全部配套阅读 · {sum(1 for r in rows if "arxiv.org" in r)} 篇有 arxiv 链接，'
                       f'{len(rows)} 篇总计 · 标签为归属讲次</p>'
                       f'<ul class="paper-list">{"".join(rows)}</ul></div>')
    else:
        papers_nav = ""
        papers_view = ""
    return (HTML_SHELL.replace("__CSS__", CSS)
            .replace("__HAIRLINE__", hairline)
            .replace("__JS__", js)
            .replace("__TOOL_CARDS__", tool_cards(data, share))
            .replace("__PAPERS_NAV__", papers_nav)
            .replace("__PAPERS_VIEW__", papers_view)
            .replace("__TITLE_TAIL__", "（分享版）" if share else "")
            .replace("构建自 lectures/ 视频字幕 · 原始文字稿已渲染至 transcripts/ · 笔记源文件位于 notes/",
                     "分享版 · 自包含单文件：笔记 / 自测 / 间隔复习离线可用，视频与论文在线打开"
                     if share else
                     "构建自 lectures/ 视频字幕 · 原始文字稿已渲染至 transcripts/ · 笔记源文件位于 notes/"))


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    for share, dest in ((False, OUT), (True, OUT.parent / "share.html")):
        html = build_page(share)
        dest.write_text(html, encoding="utf-8")
        data = load_lectures(share)
        ready = sum(1 for d in data if d["ready"])
        print(f"OK -> {dest}  ({dest.stat().st_size // 1024} KB, {ready}/{len(data)} lectures ready"
              + (", share build" if share else "") + ")")
    local_data = load_lectures()
    n = build_transcripts(local_data)
    np = build_papers(local_data)
    na = build_audio(local_data)
    print(f"transcripts: {n} pages, papers index: {np} entries, audio page: {na} tracks")


if __name__ == "__main__":
    main()
