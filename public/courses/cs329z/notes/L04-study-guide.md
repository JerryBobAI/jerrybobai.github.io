# CS329Z Lecture 4 学习笔记：Tools: Function Calling & MCP

> 讲者：Diyi Yang（Stanford NLP）｜配合视频 `lectures/How AI Agents Use Tools： Function Calling & MCP ｜ Stanford CS329Z Lecture 4 with Diyi Yang [s0S38lz6O7M].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L04-transcript.md](L04-transcript.md)

---

## 一句话概览

**工具 = 在 LLM 之外执行的程序的功能接口**：本讲先收尾 RAG 的失败模式（lost in the middle、引文幻觉），沿 **Toolformer → ToolkenGPT → ToolLLM → Gorilla** 四个训练范式讲「教模型用工具」，再转向不必重训的**标准接口三代演进（REST → Function Calling → MCP）**，最后用 BFCL / τ-bench 与 pass^k 收束评估话题。

---

## 分节要点（带时间锚点）

### [0:00–0:15] RAG 收尾：Lost in the Middle 与引文幻觉

- RAG 的四类问题：检索端 **permission leakage**（检索到用户无权看的内容）；阅读端 **lost in the middle** + distraction（被相似但无关内容带偏）+ 矛盾证据（"喝牛奶好不好"正反文章都搜得到）；环路端早期错误级联；查询端攻击者向检索文档注入恶意内容（后续课程专题）。
- Lost in the middle：正确文档放**开头或结尾**用得好，放中间性能骤降（U 形曲线），即 position bias。数字：GPT-3.5 Turbo 闭卷 56 → 给黄金文档 88（说明 RAG 有用）；但黄金文档放中间反而比不检索还差——**答案就在上下文里，模型却忽略它**。
- 文档数量实验：检索召回率（答案在结果集中）随文档数升到约 90%（~50 篇），但阅读准确率在 10–20 篇后饱和甚至下滑到 50–60%——**检索得多 ≠ 用得上**，要谨慎选 k 并 rerank。
- 引文幻觉：citation 由 LLM 生成，因此本身也会被幻觉（律师用 LLM 写状子、引例案是幻觉的经典案例）。量化：Bing / Perplexity / YouChat 用户 perceived usefulness 高达 4.5 / 4.48（5 分制），但引文 accuracy 仅 **75/100**——每 4 条链接约 1 条是假的。NeurIPS 论文里查出 **100+ 条幻觉引用**；CLEAR 会议（讲者任 program chair）已在会议层面因幻觉引用拒稿。
- Needle in a haystack：Claude 2.1（200k 上下文）随长度增加错误区扩散；GPT-4（128k）大多绿色但约 **73k 后开始退化**——**装得下 200k ≠ 能可靠用 200k**。
- Q&A：为什么会有 lost in the middle？① attention 难处理长程依赖；② position bias / 近因捷径（"更关注昨天、忘记上周"）。要不要弃用 RAG？——不。需要外部知识仍推荐 RAG，但要补校验：内容正确性、位置偏差、注入安全。

### [0:15–0:25] 为什么需要工具 + 工具到底是什么

- LLM 单打独斗的短板证据：问"现任美国总统 / 今天星期几"答不了；GPT-4 算 999×867 出错，乘法准确率仅 **59%**（AIME 成绩却很高）；o1 到四位数乘法就开始"变红"；拼图、动态规划随步数增加性能崩塌——**模型擅长小问题，步数一多就不行**。
- 应对思路：把做不好的环节**委托出去**——算术给 calculator、代码执行、符号求解器/验证器、搜索/RAG、新闻与实时 API、公司内部手册、函数调用/浏览器/机器人。
- 工具定义：**LLM 之外运行的程序的功能接口**。两个关键词：① *external*——模型只生成工具名和参数，外部程序执行；② *function interface*——不是"给你一辆车"，而是名字 + 描述 + 参数的文本流。文本形式恰好贴合 LLM 的训练目标。
- 能力扩展四类：知识/计算；真实世界（天气、定位、日历、邮件）；非文本模态（调图像生成工具做 meme，而非指望模型自己画）；已有系统当工具（训练好的机器翻译模型、词典）。
- 讲者观点：**会不会用工具**是判断"是不是 agent 系统"的重要因素。
- Q&A：类型检查/版本语义怎么办——模型靠模仿字符串格式生成调用，外部类型检查会失败，这是工具使用的一大失败来源（标准接口部分回应）。Q&A：模型能否即时自造工具——能，有研究支持；但新工具带幻觉风险，也可能是"背出了别人的工具"。

### [0:25–0:45] 教模型用工具（训练路线）：Toolformer 与 ToolkenGPT

（转写提示：字幕把 Toolformer 错听成 "toolkit / two shapers / instrumental cop"，把 ToolkenGPT 错听成 "GPT tokens"。）

**Toolformer**（Meta）四个决策：何时调用、用哪个工具、填什么参数、如何利用结果。最初只有 **5 种工具**：QA、calculator、搜索引擎、翻译、日历（对比今天 agent 可用数千工具）。
- 核心思路：把工具调用变成**语言建模问题**——在普通文本中插入特殊 token 形式的 API 调用构造数据集，微调 GPT-J；推理时模型见到前缀就生成调用。例：14,00 人参赛约 400 人通过 → 模型需要调用计算器得 29%；问期刊出版方 → 调 QA 系统。
- 插入位置 i：选让"在此处插入 API 调用"概率 p_i 最高的位置；选哪个工具：**真实执行**各候选 API（执行发生在外部），再用过滤损失比较——加权 cross-entropy，权重 w 随距离衰减（调用后紧跟的 token 权重大）。
- Pittsburgh "Steel City" 例：不调用 loss 2.5；调 QA 但无答案 2.1；调 QA 且有答案 **0.8** → 有用性 1.3，保留该调用；日历"周五开门"例用处不大、得分低，不保留。
- 结果：fact checking / QA / math / 时间 / 多语言五类任务上，比 GPT-3 小很多倍的模型**反超大模型**；GPT-2 级别加不加 Toolformer 差异显著。
- Q&A：可靠性疑虑——QA server 可能宕机、返回缓存错误答案、格式错误，损失比较会被污染；讲者承认**学习式方案未必最优**（引出标准接口）。Q&A：与现代 agent 的关系——Toolformer 在 token 流中触发工具；现代 agent 是一个 turn 后自己决定用什么工具、失败换下一个，留下完整的工具使用轨迹。

**ToolkenGPT**：把**每个工具当作一个 token**（toolken embedding）；生成中触发该 token → 补全参数 → 外部执行 → 结果接回原生成流；用大量合成数据训练 toolken 嵌入。
- 致命数字：single-hop 0.7 / 0.5 不错，**multi-hop 只有 0.03 / 0.09**。
- Q&A：多跳为什么难？① 工具序列的组合搜索空间巨大；② 训练数据与真实世界几乎全是单工具调用，工具序列样本稀缺。

### [0:45–1:00:00] 规模化到海量 API：ToolLLM 与 Gorilla

**ToolLLM**：**16,000+ API**。合成数据流水线：扫描网上 API → 让 ChatGPT 扮演用户生成"会触发该工具的请求 + 输入输出" → 再让 ChatGPT 用这些工具解题、失败就换工具，形成**树状解题轨迹**（即 ToolBench 数据集）→ 对 Llama 做 **SFT**。讲者点破：这是新一波**蒸馏**——不是 Hinton 经典知识蒸馏，而是拿强模型的推理轨迹 SFT 小模型（并提及近期厂商间的蒸馏争议）。
- 失败案例（说明通用模型调用 API 的幻觉）：让 GPT-4 做 speech-to-text，它从 Torch Hub 调 ASR 却填了不存在的参数（source=local）；Claude 则调成了**翻译**模型——库用错；正确做法是从 Torch Hub 加载转写模型。

**Gorilla**（Berkeley）：1,600 个 API（Hugging Face / Torch Hub / TensorFlow Hub，为 ToolLLM 的 1/10），GPT-4 生成合成指令数据微调。
- 关键设计① **retrieval-aware training**：微调时混入正确与错误的检索文档，让模型先学会辨别检索结果正误再生成（只见过正确文档的模型会照抄错误文档、调错 API）。
- 关键设计② **AST 幻觉量化**：把生成的调用解析成抽象语法树，与真实 API 库构建的树比对——是子树 = 合法调用；整棵树在 API 库中不存在 = **幻觉出不存在的 API**；节点错误 = mistake（错误，但不算幻觉）。效果：幻觉显著低于各基线、准确率更高。

### [1:00:00–1:05:00] 四个训练范式的尽头：为什么要标准接口

- 复盘 Toolformer / ToolkenGPT / ToolLLM / Gorilla：都是**改模型去适配工具**——每出现一个新 API 就得重训模型或重学 embedding，昂贵且不灵活。
- 思维转换：**改工具的描述，让任何模型运行时即插即用**——把工具列成通用格式（名字、能力、参数 schema），模型只要"会读格式"就会用。视角从学习转向工业/易用。
- 引申讨论：要不要**重新设计互联网**让它 agent-friendly？现有 API 都是以人为中心设计的。

### [1:05:00–1:15:00] 标准接口三代演进：REST → Function Calling → MCP

| 代际 | 面向谁 | 形式 | 局限 |
|---|---|---|---|
| REST API | 人（英文文档） | GET/POST/PUT/DELETE + URL 参数，如 `GET weather?city=SF` → 200 + 温度 | 模型必须知道 URL、参数名、响应格式；动作词汇有限 |
| Function Calling | 开发者/模型 | 工具写成 **JSON schema**，模型输出 name + arguments，外层可包一层校验（OpenAI 2023 年夏提出，各家跟进） | 工具一变 schema 就得重写，**不可扩展** |
| MCP | 生态（任何程序） | 协议：server 提供工具，client 运行时发现并调用；**server 写一次、处处复用** | 需实现协议（由框架代劳） |

- Function calling 的历史功绩：早期它是最好的快速工程手段——自由文本问答容易错，限定 JSON 输出成功率高。
- MCP 三角色：**Host**（你用的程序：chat、Claude Desktop、IDE、Claude Code）；**Server**（工具提供方：本地文件、数据库、远程服务）；**Client**（host 为每个 server 创建的连接对象：握手、tools/list、tools/call、回传结果）。4 个 client = 4 条开放连接，**不是 4 个用户**；host **永远不需要懂**文件或数据库格式，只要会说 MCP——一层抽象。
- 两个原语：`tools/list` → 返回每个工具的 name / description / JSON input schema，模型据此决定用不用；`tools/call` → name + 符合 schema 的 arguments，返回结果。
- 落地示例：课程 LMS 用 **FastMCP** 包成 MCP server，提供 list assignments / get assignment / post assessment；但"发布作业"不能人人能调——server 里加权限检查；**agent 永远看不到 LMS token，API 也看不到 agent token**，越权工具被禁用。
- 强调：那些底层 JSON 报文不用手写——MCP 是协议，详细报文由模型生成，开发者只写高层 spec。

### [1:15:00–1:18:00] 工具使用的数据集与评估

- **Berkeley Function Calling Leaderboard（BFCL）**：实时排行榜；评估手段包括 AST 匹配量化幻觉、执行评估、multi-step / multi-turn 的状态评估；数据按真实用例分类学构造，并故意加入正确答案是"没有可用工具 / 办不到"的**弃权题**——考模型会不会硬编一个工具。
- **ToolBench**：前述合成数据集，可量化系统能否正确使用工具。
- **τ-bench**：引入 **client（用户）角色**——用户与 agent 多轮交互（取消航班 / 改签），agent 必须选对工具调用；首版含 retail 与 airline 两个域（2024），两年间衍生出 τ²-bench（telecom）、voice 等一众变体。
- 关键指标对比：

| 指标 | 含义 | 适用场景 |
|---|---|---|
| pass@k | 试 K 次成功 1 次即算过 | 代码生成（上一讲的惯例） |
| **pass^k** | K 次必须全部成功 | 多轮交互型工具调用——用户不会试 8 次只求对 1 次，失败一次就发火 |

- τ-bench 上两个指标趋势差异很大——**指标选错，结论就错**（呼应 L1 的 Evaluation 层）。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Lost in the middle | 正确内容在上下文中部时性能骤降（U 形 position bias） | Lost in the Middle 论文，L04 [0:05] |
| 引文幻觉 | citation 由 LLM 生成，本身也可被编造；引文 accuracy 仅 75/100 | L04 [0:08] |
| Needle in a haystack | 长上下文中定位事实的测试；Claude 2.1 200k / GPT-4 128k 中部失效 | L04 [0:11] |
| Toolformer | 解码中触发 API 调用 + 过滤损失自监督学会 5 种工具 | Meta，L04 [0:31] |
| ToolkenGPT | 每个工具一个 embedding token，生成中触发即执行 | L04 [0:45] |
| ToolLLM / ToolBench | 16k API；ChatGPT 合成用户请求 + 树状解题轨迹；SFT Llama | L04 [0:50] |
| Gorilla | 1.6k API；retrieval-aware training + AST 幻觉量化 | Berkeley，L04 [0:55] |
| REST → Function Calling → MCP | 人读文档 → 模型读 JSON schema → 生态协议，server 写一次处处复用 | L04 [1:03:00] |
| MCP Host / Server / Client | 应用 / 工具提供方 / 每个 server 一条的连接对象 | L04 [1:10:00] |
| tools/list & tools/call | 运行时发现工具（name+description+schema）/ 按名 + 参数调用 | L04 [1:12:00] |
| BFCL | 函数调用实时排行榜：AST / 执行 / 状态评估 + 弃权题 | Berkeley，L04 [1:15:00] |
| τ-bench | 用户在环的多轮工具调用基准（retail / airline） | L04 [1:16:00] |
| pass@k vs pass^k | K 次中 1 次成功 vs K 次全部成功；交互场景必须用后者 | L04 [1:17:00] |

## 自测题（先遮住右侧再答）

1. Lost in the middle 的现象与两个解释？各给一个关键数字。
   > 正确文档在开头/结尾表现好、放中间骤降（U 形）。解释：① attention 难处理长程依赖；② position bias / 近因捷径。数字：GPT-3.5 Turbo 闭卷 56、给黄金文档 88，但黄金文档放中间反而更差；检索召回 ~90% 时阅读准确率只有 50–60%。
2. Toolformer 如何把"用工具"变成学习问题？四个决策和过滤损失怎么工作？
   > 决定何时调用（选 p_i 最大的插入位置）、用哪个工具（真实执行各候选）、填什么参数、如何利用结果；用随距离衰减的加权 cross-entropy 比较：不调 2.5 / 调无答案 2.1 / 调有答案 0.8 → 有用性 1.3。
3. ToolkenGPT 的 single-hop 与 multi-hop 数字说明什么？两个原因？
   > single-hop 0.7/0.5，multi-hop 0.03/0.09——工具序列使用极难。原因：① 组合搜索空间巨大；② 训练/真实数据几乎全是单工具调用，序列样本稀缺。
4. Gorilla 的两个关键设计？AST 评估如何区分幻觉与错误？
   > ① retrieval-aware training：微调时混入错误检索文档，学会先辨别再生成；② AST 子树匹配：匹配 = 合法调用，树在 API 库中不存在 = 幻觉，节点错误 = mistake 而非幻觉。
5. 三代标准接口各面向谁、局限是什么？（先默写再对表）
   > REST：人读英文文档，模型需知道 URL/参数名/响应格式；Function Calling：JSON schema 给模型读，工具一变 schema 就得改，不可扩展；MCP：生态协议，server 写一次、任何 client 复用。
6. MCP 中 host / client / server 各干什么？host 需要懂数据库格式吗？4 个 client 意味着 4 个用户吗？
   > host 是应用（Claude Desktop 等）；client 是 host 为每个 server 建的连接对象（握手/列工具/调用/回传）；server 提供工具。host 永不需要懂文件/数据库格式，只需会说 MCP；4 client = 4 条连接，不是 4 个用户。
7. pass@k 与 pass^k 的区别？为什么工具调用场景必须用后者？
   > pass@k 试 K 次成功 1 次即可；pass^k 要求 K 次全对。交互型系统的用户不会试 8 次只求对 1 次；τ-bench 上两指标趋势差异很大，选错指标会得出错误结论。

---

*Generated from lecture transcript via deep-reader pipeline, 2026-11-17.*
