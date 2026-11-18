#!/usr/bin/env python3
"""Build single-file study hub for sutskevers-list: markdown lessons -> embedded HTML.

与 cme295 版 build_site.py 同源但裁剪：无视频/文字稿/音频/Anki/分享版。
新增：批次分组导航、待精读(pending)视图、内化记录(## 内化记录…)自动折叠区块。

新课必改清单(全文搜 sutskevers-list 逐处替换):
  1. NOTES / OUT 两个路径常量
  2. LECTURES(slug/title/authors/year/link/blurb/batch/ready)
  3. doneKey/quizKey/srsKey/themeKey(localStorage 键,全站唯一)
  4. 页面标题/副题/hero 里的课名与篇数
"""
import json
import pathlib
import re
import markdown

ROOT = pathlib.Path("/Users/baoxiehao/Workspace/Creation/courses/sutskevers-list")
NOTES = ROOT / "notes"
OUT = ROOT / "study-hub" / "index.html"

B1 = "批次一 · 视觉革命"
B2 = "批次二 · 序列时代"
B3 = "批次三 · 注意力革命"
B4 = "批次四 · 记忆与推理"
B5 = "批次五 · 规模化与工程"
B6 = "批次六 · 压缩与复杂性"

def ax(i):
    return f"https://arxiv.org/abs/{i}"

LECTURES = [
    {"slug": "L01", "batch": B1, "ready": True, "title": "AlexNet", "paper": "ImageNet Classification with Deep CNNs",
     "authors": "Krizhevsky · Sutskever · Hinton", "year": 2012, "link": ax("1207.0580"),
     "blurb": "GPU+大数据+深卷积的第一次落地，ImageNet 断层夺冠，终结手工特征时代。Ilya 亲手参与的创世事件。"},
    {"slug": "L02", "batch": B1, "ready": True, "title": "ResNet", "paper": "Deep Residual Learning for Image Recognition",
     "authors": "何恺明 · Zhang · Ren · Sun", "year": 2015, "link": ax("1512.03385"),
     "blurb": "y = F(x) + x 一个恒等式解决退化问题，152 层首次超过人类；跳连成为此后一切架构的骨架。"},
    {"slug": "L03", "batch": B1, "ready": True, "title": "Identity Mappings", "paper": "Identity Mappings in Deep Residual Networks",
     "authors": "何恺明 · Zhang · Ren · Sun", "year": 2016, "link": ax("1603.05027"),
     "blurb": "ResNet 作者解剖自己：跳连有效因为通路干净。Pre-LN 与 GPT 残差结构的直系祖先。"},
    {"slug": "L04", "batch": B1, "ready": True, "title": "Dilated Convolutions", "paper": "Multi-Scale Context Aggregation by Dilated Convolutions",
     "authors": "Fisher Yu · Vladlen Koltun", "year": 2016, "link": ax("1511.07122"),
     "blurb": "9 个权重不动、采样点隔开撒——参数不增分辨率不降，视野指数扩张。语义分割的钥匙。"},
    {"slug": "L05", "batch": B1, "ready": False, "title": "CS231n 课程笔记", "paper": "Convolutional Neural Networks for Visual Recognition",
     "authors": "Karpathy · Fei-Fei Li 等", "year": 2015, "link": "https://cs231n.github.io/",
     "blurb": "CNN 时代的完整操作手册：张量设计与参数账、训练实战包、经典架构谱系、迁移学习——L01 地基的展开版。"},
    {"slug": "L06", "batch": B2, "ready": False, "title": "Unreasonable Effectiveness of RNNs", "paper": "The Unreasonable Effectiveness of Recurrent Neural Networks",
     "authors": "Andrej Karpathy", "year": 2015, "link": "http://karpathy.github.io/rnn.html",
     "blurb": "字符级 RNN 生成文本的动手博客，用鲜活的例子展示 RNN 能捕获多少结构。"},
    {"slug": "L07", "batch": B2, "ready": False, "title": "Understanding LSTM Networks", "paper": "Understanding LSTM Networks",
     "authors": "Christopher Olah", "year": 2015, "link": "https://colah.github.io/posts/2015-08-Understanding-LSTMs/",
     "blurb": "LSTM 门控如何携带信息穿越长序列的最清晰图解，公认的第一入门材料。"},
    {"slug": "L08", "batch": B2, "ready": False, "title": "RNN Regularization", "paper": "Recurrent Neural Network Regularization",
     "authors": "Zaremba · Sutskever · Vinyals", "year": 2014, "link": ax("1409.2329"),
     "blurb": "Dropout 用在 LSTM 非循环连接上才正确——大规模循环模型停止过拟合。Ilya 是二作。"},
    {"slug": "L09", "batch": B2, "ready": False, "title": "Order Matters", "paper": "Order Matters: Sequence to Sequence for Sets",
     "authors": "Vinyals · Bengio · Kudlur", "year": 2015, "link": ax("1511.06391"),
     "blurb": "序列到序列模型里输入输出顺序意味着什么，以及真正是集合的数据怎么办。"},
    {"slug": "L10", "batch": B3, "ready": False, "title": "Attention (Bahdanau)", "paper": "Neural Machine Translation by Jointly Learning to Align and Translate",
     "authors": "Bahdanau · Cho · Bengio", "year": 2014, "link": ax("1409.0473"),
     "blurb": "注意力机制的诞生：翻译模型不再依赖单一固定摘要，学会回头看相关的源词。"},
    {"slug": "L11", "batch": B3, "ready": False, "title": "Pointer Networks", "paper": "Pointer Networks",
     "authors": "Vinyals · Fortunato · Jaitly", "year": 2015, "link": ax("1506.03134"),
     "blurb": "输出指向输入位置的序列模型——答案是对输入的选择或排序时天生合适。注意力的前身。"},
    {"slug": "L12", "batch": B3, "ready": False, "title": "Attention Is All You Need", "paper": "Attention Is All You Need",
     "authors": "Vaswani 等 (Google)", "year": 2017, "link": ax("1706.03762"),
     "blurb": "Transformer。用自注意力彻底取代循环——支撑几乎所有现代大语言模型的架构。"},
    {"slug": "L13", "batch": B3, "ready": False, "title": "The Annotated Transformer", "paper": "The Annotated Transformer",
     "authors": "Sasha Rush 等", "year": 2018, "link": "https://nlp.seas.harvard.edu/annotated-transformer/",
     "blurb": "逐行可运行的 Transformer 复现，把原论文变成能跑、可读的代码。"},
    {"slug": "L14", "batch": B4, "ready": False, "title": "Neural Turing Machines", "paper": "Neural Turing Machines",
     "authors": "Graves · Wayne · Danihelka", "year": 2014, "link": ax("1410.5401"),
     "blurb": "给神经网络接上外部记忆和读写头——向可微分的算法行为迈出的一步。"},
    {"slug": "L15", "batch": B4, "ready": False, "title": "Relational Reasoning", "paper": "A Simple Neural Network Module for Relational Reasoning",
     "authors": "Santoro 等 (DeepMind)", "year": 2017, "link": ax("1706.01427"),
     "blurb": "关系网络：把「对象两两之间的关系」做成一个简单模块，推理变成可插拔组件。"},
    {"slug": "L16", "batch": B4, "ready": False, "title": "Relational RNN", "paper": "Relational Recurrent Neural Networks",
     "authors": "Santoro 等 (DeepMind)", "year": 2018, "link": ax("1806.01822"),
     "blurb": "用关系记忆替代 LSTM 记忆单元——记忆的对象是实体间的关系图。"},
    {"slug": "L17", "batch": B4, "ready": False, "title": "Neural Message Passing", "paper": "Neural Message Passing for Quantum Chemistry",
     "authors": "Gilmer 等", "year": 2017, "link": ax("1704.01212"),
     "blurb": "消息传递神经网络：图网络统一框架，在分子性质预测上大放异彩。"},
    {"slug": "L18", "batch": B5, "ready": False, "title": "Deep Speech 2", "paper": "Deep Speech 2: End-to-End Speech Recognition in English and Mandarin",
     "authors": "Dario Amodei 等 (Baidu)", "year": 2015, "link": ax("1512.02595"),
     "blurb": "端到端语音识别系统，CTC 训练横跨英中两种语言——规模化工程的范本。"},
    {"slug": "L19", "batch": B5, "ready": False, "title": "GPipe", "paper": "GPipe: Efficient Training of Giant Neural Networks using Pipeline Parallelism",
     "authors": "Yanping Huang 等 (Google)", "year": 2018, "link": ax("1811.06965"),
     "blurb": "流水线并行训练巨型网络——大模型跨卡/跨机的工程起点。"},
    {"slug": "L20", "batch": B5, "ready": False, "title": "Scaling Laws", "paper": "Scaling Laws for Neural Language Models",
     "authors": "Jared Kaplan 等 (OpenAI)", "year": 2020, "link": ax("2001.08361"),
     "blurb": "模型性能随规模幂律提升——Ilya「规模涌现」信念的定量化时刻。"},
    {"slug": "L21", "batch": B6, "ready": False, "title": "Flat Minima", "paper": "Flat Minima",
     "authors": "Hochreiter · Schmidhuber", "year": 1997, "link": "https://direct.mit.edu/neco/article/9/1/1/6027/Flat-Minima",
     "blurb": "平坦极小值=权重描述短=泛化好——MDL 视角下的泛化理论，「学习即压缩」世界观的早期源头。"},
    {"slug": "L22", "batch": B6, "ready": False, "title": "MDL Tutorial", "paper": "A Tutorial Introduction to the Minimum Description Length Principle",
     "authors": "Peter Grünwald", "year": 2004, "link": "https://30papers.com/",
     "blurb": "MDL 原理的教程式引入：最短描述 = 最好的模型。"},
    {"slug": "L23", "batch": B6, "ready": False, "title": "First Law of Complexodynamics", "paper": "The First Law of Complexodynamics",
     "authors": "Scott Aaronson", "year": 2011, "link": "https://30papers.com/",
     "blurb": "封闭系统复杂度先升后降的直觉论证——Ilya 反复引用的博客。"},
    {"slug": "L24", "batch": B6, "ready": False, "title": "Coffee Automaton", "paper": "Quantifying the Rise and Fall of Complexity in Closed Systems: The Coffee Automaton",
     "authors": "Aaronson 等", "year": 2014, "link": "https://30papers.com/",
     "blurb": "用元胞自动机模拟咖啡混合，量化「结构复杂度」的兴衰。"},
    {"slug": "L25", "batch": B6, "ready": False, "title": "Kolmogorov Complexity", "paper": "Kolmogorov Complexity (教材章节)",
     "authors": "Li · Vitányi", "year": 1993, "link": "https://30papers.com/",
     "blurb": "描述一个对象所需的最短程序长度——随机性与压缩的理论极限。"},
    {"slug": "L26", "batch": B6, "ready": False, "title": "Variational Lossy Autoencoder", "paper": "Variational Lossy Autoencoder",
     "authors": "Xi Chen 等", "year": 2016, "link": ax("1611.02731"),
     "blurb": "VAE 与自回归模型 learn to ignore——压缩视角下的表示学习。"},
    {"slug": "L27", "batch": B6, "ready": False, "title": "Machine Super Intelligence", "paper": "Machine Super Intelligence",
     "authors": "作者见原文", "year": 2008, "link": "https://30papers.com/",
     "blurb": "关于机器超级智能的系统性论述——List 的收官之作。"},
]

doneKey = "sutskevers-list-done"

MD_EXTENSIONS = ["tables", "fenced_code", "codehilite", "toc"]
MD_EXT_CONFIG = {"codehilite": {"noclasses": True, "pygments_style": "friendly"}}


def render_md(md_text: str) -> str:
    return markdown.markdown(md_text, extensions=MD_EXTENSIONS, extension_configs=MD_EXT_CONFIG)


QUIZ_HEAD = re.compile(r"^##\s+自测题", re.M)
RECAP_HEAD = re.compile(r"<h2[^>]*>内化记录.*?</h2>", re.S)


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
    n = 0
    for chunk in html.split("<li>")[1:]:
        if "<blockquote>" in chunk.split("</li>")[0]:
            n += 1
    return n


def wrap_recap(html: str) -> str:
    """Fold the 内化记录 section (rest of doc) into a collapsed details block."""
    m = RECAP_HEAD.search(html)
    if not m:
        return html
    head, recap = html[:m.start()], html[m.start():]
    return (head + '<details class="recap"><summary>内化记录 · 我的原答与批改</summary>'
            + f'<div class="markdown">{recap}</div></details>')


def load_lectures() -> list:
    data, questions = [], []
    for lec in LECTURES:
        item = dict(lec)
        guide = NOTES / f"{lec['slug']}-{SLUG_BY_NUM[lec['slug'][:3]]}.md"
        if guide.exists():
            md_text = guide.read_text(encoding="utf-8")
            html = wrap_recap(render_md(md_text))
            item["html"] = html
            item["quiz_count"] = quiz_count(html)
            item["ready"] = True
            for i, qa in enumerate(parse_quiz(md_text)):
                questions.append({"id": f"{lec['slug']}:{i}", "slug": lec["slug"],
                                  "title": lec["title"], "q": qa["q"], "a": qa["a"]})
        else:
            if lec.get("goto"):
                item["html"] = ('<p class="pending">本篇不单独成文：CS231n 的地基部分'
                                "（卷积两大机制、层级特征）已揉进 L01 精读的「CS231n 地基」一节，"
                                "点下面按钮直达即可，不用重复学两遍。</p>")
            else:
                item["html"] = (f'<p class="pending">本篇待精读（{lec["batch"]}）。'
                                "可以先读原文，精读上线后从这里系统学。</p>")
            item["quiz_count"] = 0
        data.append(item)
    return data, questions


SLUG_BY_NUM = {
    "L01": "alexnet", "L02": "resnet", "L03": "identity-mappings", "L04": "dilated-convolutions",
    "L05": "cs231n",
    "L06": "karpathy-rnn", "L07": "understanding-lstm", "L08": "rnn-regularization", "L09": "order-matters",
    "L10": "bahdanau-attention", "L11": "pointer-networks", "L12": "transformer", "L13": "annotated-transformer",
    "L14": "neural-turing-machines", "L15": "relational-reasoning", "L16": "relational-rnn", "L17": "message-passing",
    "L18": "deep-speech-2", "L19": "gpipe", "L20": "scaling-laws",
    "L21": "mdl-weights", "L22": "mdl-tutorial", "L23": "complexodynamics", "L24": "coffee-automaton",
    "L25": "kolmogorov", "L26": "vlae", "L27": "super-intelligence",
}

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
  text-transform:uppercase;margin:14px 10px 8px}
.sidebar .group-label:first-child{margin-top:0}
.nav-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;
  cursor:pointer;color:var(--ink);text-decoration:none;font-size:13.5px}
.nav-item:hover{background:var(--card)}
.nav-item.active{background:var(--card);box-shadow:var(--shadow);color:var(--accent);font-weight:700}
.nav-item.is-pending{color:var(--ink2)}
.nav-item .dot{width:7px;height:7px;border-radius:50%;background:var(--line);flex-shrink:0}
.nav-item .dot.ready{background:var(--ok)}
.nav-item .dot.done{background:var(--accent)}
.nav-item .num{font-size:11px;color:var(--ink2);font-variant-numeric:tabular-nums}
.main{padding:34px 44px 80px;min-width:0}
.view{display:none}.view.active{display:block;animation:fade .28s ease-out}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.crumb{color:var(--accent);text-decoration:none;font-size:14px}
.crumb:hover{text-decoration:underline;text-underline-offset:3px}
.hero h1{font-size:30px;line-height:1.3;letter-spacing:-.015em}
.hero .lede{color:var(--ink2);margin-top:10px;max-width:68ch}
.hero .meta{display:flex;gap:18px;margin-top:14px;font-size:13px;color:var(--ink2);flex-wrap:wrap}
.hero .meta b{color:var(--ink)}
.map{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:14px;margin-top:26px}
.lec-card{display:block;background:var(--card);border:1px solid var(--line);border-radius:13px;
  padding:16px 17px;color:var(--ink);text-decoration:none;cursor:pointer;position:relative;
  transition:transform .15s ease-out,box-shadow .15s ease-out}
.lec-card:hover{transform:translateY(-2px);box-shadow:var(--shadow)}
.lec-card.is-pending{opacity:.66}
.lec-card .no{font-size:11px;letter-spacing:.12em;color:var(--accent);font-weight:700}
.lec-card.is-pending .no{color:var(--ink2)}
.lec-card .bt{font-size:10.5px;color:var(--ink2);margin-left:8px;letter-spacing:.05em}
.lec-card h3{font-size:15.5px;margin:5px 0 6px;line-height:1.45}
.lec-card p{font-size:12.8px;color:var(--ink2);line-height:1.55}
.lec-card .who{margin-top:10px;font-size:12px;color:var(--ink2)}
.lec-card .who b{color:var(--ink);font-weight:600}
.lec-card .status{position:absolute;top:14px;right:15px;font-size:11px;color:var(--ok);
  display:inline-flex;align-items:center;gap:4px}
.lecture h1{font-size:26px;line-height:1.35}
.lecture .lecmeta{display:flex;gap:14px;flex-wrap:wrap;align-items:center;
  margin:10px 0 4px;font-size:13px;color:var(--ink2)}
.chip{font-size:12.5px;border:1px solid var(--line);border-radius:99px;
  padding:3px 11px;text-decoration:none;color:var(--ink2)}
.chip:hover{color:var(--accent);border-color:var(--accent)}
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
.markdown .pending{color:var(--ink2);background:var(--bg2);border:1px dashed var(--line);
  border-radius:11px;padding:14px 18px;font-size:14px;max-width:72ch}
.markdown li>textarea.myans{display:block;width:100%;min-height:54px;margin:9px 0 2px;padding:8px 11px;
  font:inherit;font-size:13.5px;line-height:1.6;color:var(--ink);background:var(--card);
  border:1px solid var(--line);border-radius:9px;resize:vertical;box-sizing:border-box}
.markdown li>textarea.myans::placeholder{color:var(--ink2);opacity:.75}
.markdown li>textarea.myans:focus{outline:none;border-color:var(--accent)}
.markdown li>details.quiz.answered summary{color:var(--ok);border-color:var(--ok)}
.markdown li>details.quiz{margin:7px 0 2px;background:none;border:none;padding:0}
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
.markdown li>details.quiz summary{display:inline-block;padding:3px 12px;font-size:12.5px;
  font-weight:600;color:var(--accent);background:var(--bg2);border:1px solid var(--line);
  border-radius:999px;list-style:none}
.markdown li>details.quiz summary::marker{content:none}
.markdown li>details.quiz summary:hover{border-color:var(--accent)}
.markdown li>details.quiz[open] summary{border-radius:11px 11px 0 0}
.markdown li>details.quiz blockquote{margin:0;background:var(--card)}
.markdown details.recap{background:var(--bg2);border:1px solid var(--line);
  border-radius:12px;margin-top:30px;max-width:none}
.markdown details.recap summary{color:var(--ink2);font-size:14px}
.markdown details.recap[open] summary{color:var(--accent)}
.markdown details.recap>div{padding:4px 18px 16px}
.markdown details.recap h2{font-size:16px;border-left-width:2px}
.markdown .goto-btn{display:inline-block;margin-top:14px}
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
const QUESTIONS = __QUESTIONS__;
const doneKey = '__DONE_KEY__-done';
let done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]'));
const quizKey = '__DONE_KEY__-quiz';
let quizAns = JSON.parse(localStorage.getItem(quizKey) || '{}');
const myAnsKey = '__DONE_KEY__-myans';
let myAns = JSON.parse(localStorage.getItem(myAnsKey) || '{}');
function saveMyAns(slug, idx, text){
  const o = myAns[slug] || {};
  o[idx] = text;
  myAns[slug] = o;
  localStorage.setItem(myAnsKey, JSON.stringify(myAns));
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
  const lines = ['# 内化答题导出 · ' + slug + ' · ' + l.title, '', '导出时间:' + new Date().toLocaleString('zh-CN'), ''];
  let n = 0;
  qs.forEach((q, i) => {
    const ans = (mine[String(i)] || '').trim();
    if (!ans) return;
    n++;
    lines.push('## Q' + (i + 1), '**题目**:' + q.q, '', '**我的原答**:' + ans, '');
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
const aiKey = '__DONE_KEY__-ai';
const gradeKey = '__DONE_KEY__-grade';
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
  const sys = '你是《Sutskever\\'s List》精读课程的助教,学生做完自测题后你负责批改。'
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
    return `<div class="mr-item"><div class="mr-q">Q${x.i + 1} · ${escapeHtml(x.q.q)}</div>${ansLine}${gLine}</div>`;
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
  const q = QUESTIONS.find(x => x.slug === slug && x.id.endsWith(':' + idx));
  if (!q) return false;
  btn.disabled = true;
  if (statusEl) statusEl.textContent = '批改中…';
  try {
    const text = await callLLM(q.q, q.a, mine);
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
  if (ok === todo.length) flash(btn, `已批改 ${ok} 题 ✓`);
}
function escapeHtml(s){
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  $('#prog').innerHTML = '已完成 <b>' + progress() + '</b> 篇 · 自测 <b>' + s + '/' + t + '</b> 题';
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

/* ---- spaced repetition: simplified SM-2, same loop as the other courses ---- */
const srsKey = '__DONE_KEY__-srs';
let srs = JSON.parse(localStorage.getItem(srsKey) || '{}');
const DAY = 864e5, SESSION_CAP = 25;
function saveSrs(){ localStorage.setItem(srsKey, JSON.stringify(srs)); }
function dueCards(){
  const now = Date.now();
  return QUESTIONS.filter(q => !srs[q.id] || srs[q.id].due <= now).sort((a, b) => {
    const ra = srs[a.id], rb = srs[b.id];
    if (!ra !== !rb) return !ra ? -1 : 1;
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
  let html = '', cur = null;
  LECTURES.forEach(l => {
    if (l.batch !== cur){ cur = l.batch; html += `<p class="group-label">${cur}</p>`; }
    const dot = l.ready ? (done.has(l.slug) ? 'done' : 'ready') : '';
    html += `<a class="nav-item ${l.ready ? '' : 'is-pending'}" href="#${l.slug}" data-slug="${l.slug}" id="nav-${l.slug}">
      <span class="dot ${dot}"></span><span class="num">${l.slug}</span>
      <span>${l.title.length > 20 ? l.title.slice(0, 19) + '…' : l.title}</span></a>`;
    html += `<div class="nav-toc" id="nav-toc-${l.slug}" hidden></div>`;
  });
  return html;
}
function cardsHtml(){
  return LECTURES.map(l => `
    <a class="lec-card ${l.ready ? '' : 'is-pending'}" href="#${l.slug}" data-slug="${l.slug}">
      <span class="status">${l.ready && done.has(l.slug) ? CHECK + ' 已读' : ''}</span>
      <div class="no">${l.slug}${l.ready ? '' : ' · 待精读'}<span class="bt">${l.batch.split(' · ')[1]}</span></div>
      <h3>${l.title}</h3>
      <p>${l.blurb}</p>
      <div class="who"><b>${l.authors}</b> · ${l.year}${l.quiz_count ? ' · 自测 ' + Math.min((quizAns[l.slug] || []).length, l.quiz_count) + '/' + l.quiz_count : ''}</div>
    </a>`).join('');
}
function lecHtml(l){
  const mark = l.ready
    ? `<button class="theme-btn mark-btn" data-slug="${l.slug}">${done.has(l.slug) ? '取消已读' : '标记已读'}</button>` : '';
  const goto = l.goto
    ? `<button class="rv-btn goto-btn" data-goto="${l.goto}" data-anchor="${l.anchor || ''}">前往 ${l.goto} 精读 →</button>` : '';
  const exp = l.ready && l.quiz_count
    ? `<button class="theme-btn myans-btn" data-export="${l.slug}">导出答题</button>` : '';
  const grader = l.ready && l.quiz_count
    ? `<button class="theme-btn grade-all-btn" data-grade="${l.slug}">AI 批改全部</button>` : '';
  return `
    <div class="view lecture" id="view-${l.slug}">
      <h1>${l.slug} · ${l.title}</h1>
      <div class="lecmeta">
        <span><b style="color:var(--ink)">${l.authors}</b> · ${l.year}</span>
        ${l.link ? `<a class="chip" href="${l.link}" target="_blank" rel="noopener">📄 原文</a>` : ''}
        ${quizBadgeHtml(l)}
        ${grader}
        ${exp}
        ${mark}
      </div>
      <div class="markdown">${l.html}${goto}</div>
    </div>`;
}
function render(){
  $('#nav-list').innerHTML = navHtml();
  $('#cards').innerHTML = cardsHtml();
  $('#ready-count').textContent = LECTURES.filter(l => l.ready).length + ' / ' + LECTURES.length + ' 篇就绪';
  const main = document.querySelector('.main');
  main.querySelectorAll('.lecture').forEach(e => e.remove());
  LECTURES.forEach(l => main.insertAdjacentHTML('beforeend', lecHtml(l)));
  bind();
  quizFold();
  LECTURES.forEach(l => renderRecapDyn(l.slug));
  refreshProgress();
  refreshReviewBadge();
}
function show(slug, anchor){
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

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('#view-' + slug).classList.add('active');
  const nav = $('#nav-' + slug);
  if(nav) nav.classList.add('active');
  history.replaceState(null, '', '#' + slug);
  if (slug === 'review') startReview();
  renderToc(slug);
  window.scrollTo({top:0});
  if (anchor){
    setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({block:'start'});
    }, 60);
  }
}
function quizFold(){
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
  document.querySelectorAll('.goto-btn').forEach(btn =>
    btn.addEventListener('click', () => show(btn.dataset.goto, btn.dataset.anchor || undefined)));
  document.querySelectorAll('a.tool[data-slug]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); show(a.dataset.slug); }));
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
  localStorage.setItem('__DONE_KEY__-theme', r.dataset.theme);
  syncThemeIcon();
});
const savedTheme = localStorage.getItem('__DONE_KEY__-theme');
if(savedTheme) document.documentElement.dataset.theme = savedTheme;
syncThemeIcon();
(function(){
  render();
  const h = location.hash.slice(1);
  if (h && document.getElementById('view-' + h)) show(h);
  else show('overview');
})();
addEventListener('hashchange', () => {
  const h = location.hash.slice(1);
  if (document.getElementById('view-' + h)) show(h);
});
"""

HTML_SHELL = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sutskever's List 学习中心 · 27 篇精读地图</title>
<style>__CSS__</style>
</head>
<body>
<header class="topbar">
  <div>
    <a class="crumb" href="../../" style="display:inline-block;margin-bottom:3px">← 课程索引</a>
    <div class="brand"><span class="course">Sutskever's List</span> 学习中心</div>
    <div class="sub">Ilya Sutskever 的 AI 论文阅读清单 · 27 篇精读 · 互动内化</div>
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
    <div id="nav-list"></div>
  </nav>
  <main class="main">
    <div class="view" id="view-review"></div>
    <div class="view" id="view-overview">
      <div class="hero">
        <h1>Sutskever's List<br>27 篇精读地图</h1>
        <p class="lede">传说中 Ilya Sutskever 递给 John Carmack 的阅读清单——他说这几篇覆盖了现代 AI「90% 最重要的东西」。每篇一份精读：来龙去脉、核心思想、实验逻辑、织进网里。读完先自测：遮住答案自己作答，再翻开对照——27 篇讲解<b>全部上线</b>，L01-L03 附<b>内化记录</b>（我的原答与批改）；L04 起的内化在站上进行——读讲解、答题，答完的篇目回填内化记录。</p>
        <div class="meta">
          <span>清单 <b>30papers.com</b>（27/30 篇，官方全 30 篇从未公开）</span>
          <span>配套书 <b>Manning《Sutskever's List》2026</b></span>
          <span>精读 <b id="ready-count"></b></span>
        </div>
      </div>
      <div class="map" id="cards"></div>
      <div class="toolbox">
        <h2>学习工具</h2>
        <div class="tool-grid">
          <a class="tool" href="#review" data-slug="review"><b>⚡ 间隔复习</b><span>站内 SRS：全部自测题按简化 SM-2 记忆曲线排期，忘了 10 分钟后再来，记住了按间隔倍增。</span></a>
          <a class="tool" href="https://30papers.com/" target="_blank" rel="noopener"><b>📄 30papers.com</b><span>原始清单网站：每篇论文的摘要与贡献者，27/30 篇。</span></a>
          <a class="tool" href="https://www.manning.com/books/sutskevers-list" target="_blank" rel="noopener"><b>📚 Manning 书页</b><span>《Sutskever's List》Richard Heimann 著，Manning 2026——本课程的平行参照系。</span></a>
          <a class="tool" href="https://manning.com/preview/sutskevers-list/chapter-1" target="_blank" rel="noopener"><b>🎁 第 1 章免费预览</b><span>「What Did Ilya See?」——List 的来龙去脉与 Ilya 世界观的入门。</span></a>
        </div>
      </div>
      <p class="foot-note">精读源文件位于 notes/ · 构建自 tools/build_site.py · 新篇目写入 notes/ 后重建即上线</p>
    </div>
  </main>
</div>
<script>__JS__</script>
</body>
</html>
"""


def main():
    data, questions = load_lectures()
    html = (HTML_SHELL
            .replace("__CSS__", CSS)
            .replace("__JS__", JS
                     .replace("__DATA__", json.dumps(data, ensure_ascii=False))
                     .replace("__QUESTIONS__", json.dumps(questions, ensure_ascii=False))
                     .replace("__DONE_KEY__", doneKey))
            )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    # ---- share.html:单文件分享版——唯一差异是返回死链换成清单来源,进度/自测在对方浏览器里独立存储 ----
    SHARE = ROOT / "study-hub" / "share.html"
    share_html = html.replace(
        '<a class="crumb" href="../../" style="display:inline-block;margin-bottom:3px">← 课程索引</a>',
        '<a class="crumb" href="https://30papers.com/" style="display:inline-block;margin-bottom:3px">← 清单来源 30papers.com</a>',
    )
    assert 'href="../../"' not in share_html, "分享版残留门户相对链接"
    SHARE.write_text(share_html, encoding="utf-8")

    # ---- self checks(注意:笔记内容经 json.dumps 进 DATA,引号被转义,内容断言须查 data/full 而非 html)----
    full = "".join(l["html"] for l in data)
    assert "cme295" not in html and "CME295" not in html, "模板残留: cme295 字串出现在产物中"
    assert "cme295" not in full, "笔记内容残留 cme295 字串"
    ready = [l for l in data if l["ready"]]
    n_notes = sum(1 for lec in LECTURES
                  if (NOTES / f"{lec['slug']}-{SLUG_BY_NUM[lec['slug'][:3]]}.md").exists())
    assert len(ready) == n_notes, f"ready 数({len(ready)}) != 笔记文件数({n_notes})"
    for l in ready:
        assert l["quiz_count"] >= 5, f"{l['slug']} 自测题数量异常: {l['quiz_count']}"
    recap_n = full.count('<details class="recap">')
    assert recap_n >= 3, f"内化记录折叠区块数量异常: {recap_n}"
    assert '<a id="cs231n">' in full, "L01 缺少 cs231n 锚点"
    quiz_total = sum(l["quiz_count"] for l in ready)
    assert len(questions) == quiz_total, f"SRS 卡数({len(questions)}) != 站内自测题数({quiz_total})"
    assert "myans" in html and "myAnsKey" in html, "原答输入/导出逻辑未进入产物"
    assert "gradeOne" in html and 'id="ai-modal"' in html, "AI 批改逻辑/设置弹窗未进入产物"
    assert "sk-" not in html.replace("sk-…", ""), "产物疑似泄漏 API Key"
    print(f"OK: {OUT}")
    print(f"  lectures: {len(data)} ({len(ready)} ready, {len(questions)} quiz cards)")
    for l in ready:
        print(f"  {l['slug']} {l['title']}: quiz={l['quiz_count']}, bytes={len(l['html'])}")


if __name__ == "__main__":
    main()
