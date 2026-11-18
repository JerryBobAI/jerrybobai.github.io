# CS329Z Lecture 5 学习笔记：DSPy vs. LangGraph: AI Agent Frameworks

> 讲者：Michael Ryan（Stanford NLP，DSPy 作者之一）｜配合视频 `lectures/DSPy vs. LangGraph： AI Agent Frameworks Explained ｜ Stanford CS329Z Lecture 5 with Michael Ryan [q0Q-Hy8TTps].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L05-transcript.md](L05-transcript.md)

---

## 一句话概览

框架 = 把底层系统细节抽象掉（PyTorch 之于手写反向传播）；本讲沿 **agency 光谱（model → workflow → agent）** 现场实操两大框架——**DSPy**（signatures / modules / optimizers，把 prompt 变成可优化对象）与 **LangGraph**（state / nodes / edges 图编排），再纵览开源 agent harness、Temporal 可靠性编排与可观测性工具，收束于「简单起步、为失败设计、evals 驱动决策」的最佳实践。

---

## 分节要点（带时间锚点）

### [0:00–0:05] 为什么要框架 + 工程 AI 系统的三支柱

- 开场类比：手写 backprop（一大片求导数学）vs PyTorch 写 forward 再 `loss.backward()`——**框架抽象掉底层系统细节**，但数学仍然值得懂。课程其余部分讲底层，本讲专门学抽象。
- 现场演示环境：讲者让 Claude 搭的 tinycal 日历应用（增/删/移事件）作为外部工具调用环境，便于可视化；GitHub repo + Jupyter notebook，用课程发的 OpenRouter key 跑全程**不到 1 美元**。
- **工程 AI 系统三支柱**：System（模型 / 复合系统 / agent）、Data（训练数据、rollouts、示范、人类反馈）、Evaluation / Metric（pass rate、exact match、LLM-as-judge）。**没有数据和 evals 也能 build 一个 agent，但要 engineer 一个 AI 系统三者缺一不可**——这是贯穿全课的主线。

### [0:05–0:10] 框架版图：agency 光谱

| 层级 | 控制流在哪 | 代表工具 |
|---|---|---|
| Model | — | OpenAI API 直接调用 |
| Workflow / compound AI system | **程序里**（写死"调 3 次模型、按情况路由"） | DSPy、LangGraph |
| Agent | **模型里**（模型自己决定用哪个工具、何时结束） | agent 专用库（DSPy / LangGraph 也能做） |
| 可靠性 | — | Temporal（长时运行、崩溃自动恢复） |
| 可观测性 | — | Langfuse、MLflow、LangSmith |

- 就业市场佐证：搜 agent engineering 职位，**DSPy 和 LangGraph 常被列为必备/推荐技能**——不是"从 GitHub 随手抓的项目"。
- Q&A：observability vs reliability 的区别——observability 把问题**呈现给你**去修（traces、报错）；reliability 工具在此之上还要**自动恢复**（崩溃拉起、自愈、持续运行）。讲者自认这是他构造的分类学，实际边界模糊。

### [0:10–0:25] DSPy：Signatures 与 Modules（现场代码）

- DSPy 三核心：**Signature**（严格定义模型输入输出契约）、**Module**（如何推理该 signature：predict / ChainOfThought / Best-of-N）、**Optimizer**（自动改进 prompt 与权重）。讲者自曝立场：曾在 DSPy 团队负责 optimizer。
- Signature 演进：字符串式 `message -> response` 搭聊天；情感分类实测发现输出不受控（positive 小写、Negative 大写）→ 加类型：`sentiment: Literal[positive, negative, neutral]` + `confidence: float`。
- **Adapter** 把 signature **确定性地**转成 prompt（不经 LLM）：chat adapter 失败回退 JSON adapter，可自定义，最终失败才报错；DSPy 再做格式校验。
- Class-based signature：从邮件提取事件——event_name / date / time（可加 "use 24-hour clock" 提示）/ duration_in_minutes，均可 `string or None`。字段名 + 类型就是模型看到的全部信息：**没写进 signature 的东西模型不能输出**——严格受控 vs agentic 自由发挥的分野；class docstring 充当**系统提示**（讲者自认是 hack；好处是每模块恰一个系统提示，类型写错在结构上不可能——回应了"为什么用注释而不是变量"的提问）。
- Module 组合 + Python 逻辑：`UpdateCalendarFromEmail(dspy.Module)` 初始化两个 ChainOfThought 子模块，`forward()`（命名致敬 PyTorch）里写业务规则：缺 date/time/name → 返回 "no event found in email"；否则选 emoji、调 tinycal API（未给时长默认 1 小时）→ 日历应用里真的多了一条会议。

### [0:25–0:40] DSPy：Optimizers 与内置 agent

- 实验设定：GPT-5.4 nano 测试集 **100%**；换成小的开源权重模型 **Gemma 3 12B**（OpenRouter 上较小、开箱勉强能做）只得 **55%**（11/20）。数据：50 封合成邮件 + 金标注（30 train / 20 test），metric 是对 date / start time / duration 的 **exact match**（name 不计分）；可选返回纯文本 feedback 帮助优化器。
- **GEPA** 优化器：多次 rollout + 反思 → 重写 instruction（算法两周后专讲；本地真实跑约 5 分钟，讲者用缓存 0.6 秒演示）。结果 **55% → 100%**，变化只有 prompt：优化器自己写出了完整的字段抽取说明——"这些你都能手写，但可以让优化器代劳"。
- 成本 Q&A：优化要把程序跑几百遍，**约百万 token 量级**；一次性成本换持久收益，注意预算。
- 泛化 Q&A：train/dev/test 纪律照旧——只在 train 上优化，100% 是 **test 集**成绩；有的优化器会做 in-context learning，防过拟合与 ML 同理。
- 确定性 Q&A：DSPy 有磁盘缓存——同输入同超参必得同输出；无缓存则不保证复现。
- 怪 prompt 警告：有人用讲者写的优化器去优化数学能力，结果写出**"你是 Starfleet 舰长"**（Star Trek 场景）的 prompt——数学真变好了，但很怪；两年前常见，现在少多了。教训：**metric 若可被 hack，就会优化出 hack 的 prompt**——eval 测的必须是你真正在意的。
- 内置 agent 模块：`dspy.ReAct`——signature（request → summary）+ 工具列表（tinycal.tools），**一行代码建 agent**；演示"和 John 约课后 30 分钟咖啡、给所有课加书 emoji"，agent 自主完成两件事。
- `dspy.RLM`（recursive language models，见 L2）：把整个 inbox（50 封，也可以想象百万封）当**变量**放进 REPL 执行环境，模型对 prompt 变量跑代码（如 grep "gates"）而非全文塞上下文——回答"Gates 楼里有哪些活动、各在哪天"。
- Q&A：想手写 prompt？写在 docstring 里即可；用优化器则**从你的 prompt 出发继续优化**。优化器需指定 teacher model（示例中用 GPT-3.5-turbo，按字幕转写）。
- 小结：signatures 定契约 → modules 组合推理策略（predict / CoT / Best-of-N）→ optimizers 给数据 + metric 改 prompt/权重 → `dspy.react` / `dspy.rlm` 开箱即 agent。

### [0:40–0:55] LangGraph：State / Nodes / Edges（现场代码）

- 定位：介于 DSPy 与编排库之间。**State 是整张图的共享工作区**（被图修改的对象）；**Node** 是读/写 state 的函数（只碰哪个字段就只更新哪个字段）；**Edge** 定义控制流，**条件边**= 一个返回下一节点名的 route 函数；agent 图即 LLM↔tools 循环，state 可以就是 message history。
- 同一程序重写：`with_structured_output(EventDetails)` 锁结构化输出；StateGraph builder 加 extract 节点 + START/END + 边 + compile——可视化是一条直线；invoke 后返回整个 state（email + details）。
- 条件边示例：`route(state)` 检查是否提取到 event name / date / start time——有 → pick_emoji（LLM 选 emoji）→ add_to_calendar（调 tinycal）；没有 → 直通 END。正例（dentist 确认邮件）入日历；反例（OpenRouter credits 到账通知）只回 event name、不入日历。
- LangGraph 建 agent：`create_agent`（LangChain，与 LangGraph 相通）+ LLM + 工具，底层类似 ReAct；演示"把我与 John 的咖啡往后挪 30 分钟"→ 成功挪到 3:30–4:00。
- Q&A 精华——**DSPy vs LangGraph**：

| | DSPy | LangGraph |
|---|---|---|
| 灵魂 | 控制流写在 Python + **优化 prompt** | 健壮的**图编排**（重试节点、可观测、分布式） |
| 抽象 | signatures、modules | state、nodes、edges |
| 有无优化器 | 有（prompt / weights） | 讲者所知没有 |
| 典型场景 | 想让小模型达到大模型效果 | 海量分布式并行编排、状态机式思维 |

- 其余 Q&A：图由开发者定义，终端用户无感；**不同节点可配不同模型**（节点内是自由代码）；想要超越 model+tools 循环可看 deep agents 包。大规模数据加工且要一致格式：两者结构化输出都行，**分布式并行编排是选 LangGraph 的理由**，同时可以把 DSPy 嵌进图节点做 prompt 优化——**两者可组合而非二选一**。

### [0:55–1:05:00] 开源 Agent Harness：设计选择大观

- Harness = LLM 之外、外部环境之前的所有东西（L1 的 planning/memory/tools）。差异维度：给哪些工具、memory/context 管理、工具如何执行、结果如何回填上下文；好 harness 要平衡**任务成功率、成本、延迟、用户控制度**（Claude Code 这类交互产品用户控制很重要；纯解题 harness 则无所谓）。
- 各家一览：

| Harness | 关键设计 |
|---|---|
| Mini-SWE-Agent | 极简：只有 Bash；上下文 = 全部历史直接堆栈（像 ChatGPT 聊天）；`subprocess.run` 每次开**新终端**（无状态 shell，省去 Docker 评估麻烦） |
| OpenHands | 每步存为 event 再**重建上下文**；持久终端；多种失败自终止机制 |
| Pi agent | 只有 4 个工具、无权限系统 |
| （字幕转写为 "Sto-"，名称存疑） | 上下文历史存成**树**而非列表 |
| OpenClaw | 出圈主流；常驻长进程、**每 30 分钟自唤醒**；用 markdown 文件构建身份；每晚存记忆 |

- 结论：**没有唯一正确的 harness 造法**。L2 那张图——同一模型在不同 harness 上 Terminal Bench 成功率不同，harness × model 配对要一起看。
- Meta harness（研究）：让 LLM **写自己的 harness** 并对下游 eval 优化（做科学任务就自己造化学工具），在 Terminal Bench 2 上能自我进化；但与 Claude Code 的对比不完全公平——它是对着 TB 任务优化出来的，Claude Code 要通用，**听的时候打个折扣**。
- 研究例 Shepherd：meta agent 专职观测层，拦截出错的工具调用并 fork 到新分支重试；多个编码基准上带观测层均优于不带。
- 作业：**HW1 就是造一个 agent harness**——上下文怎么管、暴露哪些工具（部分课程指定）、memory 怎么办。
- Q&A：有没有用订阅额度而非 API 计费的玩法——Claude Code 本身就走订阅；开源 harness 这么做可能违反 ToS，注意阅读条款。

### [1:05:00–1:10:00] 编排与遥测：Temporal + 可观测性

- 背景：LLM 发布日期 vs 任务时长（**人时**）的图——模型能解的任务越来越长；agent 长时运行 → 基础设施必须可靠，否则机器一挂任务必死。软件工程的老课迁移到 agent 工程。
- Temporal 结构：**Activity**（可失败的功能单元）→ 链成 **Workflow**；**Worker** 真正执行代码（每个 activity/workflow 可配 worker）；**Server** 维护派发队列 + 全部执行历史与状态。
- 演示（跳过代码、直接看 UI，localhost：8233）：flaky worker 场景——pick emoji **重试 3 次**才成功入日历（耗时 2 秒）；事件历史里每个时间戳可查，用于调试；内置健壮重试机制。讲者强烈建议课后 clone repo 看代码。
- 可观测性工具：MLflow（看输入输出与实际执行）；LangSmith（LangGraph 生态配套：token 数、延迟、评估分数）；Langfuse（长期看可靠性与成本）。共同点：**掀开盖子看系统内部**。
- 回收：**编排让 agent 可靠，可观测性让调试与监控成为可能**；evals + 监控 + durable execution 正是 "build agent" 与 "engineer agent" 的分界线。

### [1:10:00–1:20:00] 最佳实践与挑战

- ① **Keep it simple**：不是所有任务都需要 agent——固定小任务（"所有邮件加进日历"）用 workflow 更可靠、更好调试；开放式任务（"帮我管日历的助理"）才值得 agent；数据多时甚至可能回到光谱最左端**直接训练专用模型**（如微调做信息抽取，替代多步 workflow）。
- ② **让失败可观测、可恢复**：追踪模型调用 / 工具调用 / 状态变化 / 错误；设 timeout、重试上限、执行预算、记录输出。Claude Code 例子：工具调用失败时 harness 把报错回传给模型让它重试；Shepherd 是研究版答案。
- ③ **跑评估**：设计决策要落在 evals 上；**评估使优化成为可能**（先有邮件 exact-match eval，才有 GEPA 优化）。"没有好评估就是开枪瞎打"；项目第一件事就该是把 eval 建好。指标选准：准确率之外还有成本、延迟——面向用户时延迟致命；测试要覆盖代表性 / 多样 / 边缘 / 失败场景，别只跑 happy path。
- ④ **优化自己的领域，不是 headline 基准**：做日历 agent 就建日历 eval，别去刷 SWE-bench；只有做通用编码 harness 时 SWE-bench / Terminal Bench 才是对的工具。
- 挑战与局限：抽象让你远离底层（PyTorch/反向传播类比重现——要愿意掀盖子，这正是本课存在的意义）；复杂系统（几十上百次模型调用）定位失败源难——用 trace、观测工具甚至 agent 来诊断；框架 = 依赖外部库的长期维护（要做 5–10 年的系统要考虑库还活着吗）；引用博客 meme：**"Show me the prompt"**——别让框架的黑魔法替你思考。
- 收尾循环：**build → run → evaluate → improve**；不要以为第一版就能 ship；起步简单、任何复杂度都要有依据；为失败与恢复设计（Temporal）；用证据与评估裁决质量 / 成本 / 延迟；完全理解你的系统。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| 三支柱 | System / Data / Evaluation——engineering 三者缺一不可 | L05 [0:04] |
| Agency 光谱 | model → workflow → agent；看控制流在程序还是模型 | L05 [0:04] |
| DSPy Signature | 严格定义模型输入输出契约（可带类型；docstring = 系统提示） | L05 [0:11] |
| Adapter | 把 signature 确定性转成 prompt；chat → JSON 回退，再校验 | L05 [0:12] |
| DSPy Module | 推理策略：predict / ChainOfThought / Best-of-N | L05 [0:20] |
| DSPy Optimizer | 给数据 + metric 自动改 prompt/权重（示例：GEPA，55%→100%） | L05 [0:26] |
| dspy.ReAct / dspy.RLM | 内置 agent 模块 / prompt 当变量进 REPL 的长上下文方案 | L05 [0:36] |
| LangGraph State / Node / Edge | 共享工作区 / 读写 state 的函数 / 控制流（可条件） | L05 [0:42] |
| create_agent | LangChain 一键建 ReAct 式 agent（LLM + tools 循环） | L05 [0:51] |
| Agent harness | LLM 外的环境封装：工具集、记忆/上下文管理、执行与回填 | L05 [0:57] |
| Meta harness | LLM 写自己的 harness 并对下游 eval 自我进化（对比要打折扣） | L05 [1:00:00] |
| Temporal | activity/workflow/worker/server 的可靠编排 + 重试与执行历史 | L05 [1:06:00] |
| Observability vs Reliability | 呈现问题给你修 vs 自动恢复保运行 | L05 [0:07] |

## 自测题（先遮住右侧再答）

1. "build agent" 与 "engineer AI system" 的差别？
   > 后者必须齐备三支柱：System、Data、Evaluation/Metric。没有数据与 evals 也能拼出一个能跑的 agent，但那不是工程。
2. DSPy 三个核心概念各管什么？adapter 起什么作用？
   > Signature = 输入输出契约；Module = 推理策略（predict / CoT / Best-of-N）；Optimizer = 给数据 + metric 自动改 prompt 与权重。Adapter 把 signature 确定性转成 prompt（chat 失败回退 JSON），并做格式校验。
3. 讲出 GEPA 实验的完整故事线（含数字）。
   > GPT-5.4 nano 100%；Gemma 3 12B 55%（11/20）→ GEPA 重写 instruction → 100%。只在 30 条 train 上优化、20 条 test 上评估；成本约百万 token 量级；警惕 metric 可被 hack（"Starfleet 舰长"prompt 案例）。
4. LangGraph 四件套是什么？条件边怎么实现？
   > State（共享工作区）/ Node（读写 state 的函数）/ Edge（控制流）/ 条件边 = 一个返回下一节点名的 route 函数：有 event name/date/start → pick_emoji，否则直通 END。
5. DSPy 与 LangGraph 怎么选？能否一起用？LangGraph 有优化器吗？
   > DSPy：Python 控制流 + prompt 优化；LangGraph：健壮图编排（重试 / 可观测 / 分布式）。可以组合：DSPy 调用作为 LangGraph 图的节点。LangGraph 无优化器（讲者所知）。
6. Mini-SWE-Agent 与 OpenHands 在上下文和 shell 上有何分歧？
   > Mini-SWE-Agent：历史直接堆栈 + subprocess.run 每次开新终端（无状态，评估省事）；OpenHands：每步存 event 重建上下文 + 持久终端 + 多种失败自终止机制。
7. 本讲的最佳实践是哪几条？
   > ① keep it simple（未必需要 agent，数据多时可回到专用模型）；② 让失败可观测、可恢复（trace / timeout / 重试 / 预算）；③ 跑评估——先建好自己领域的 eval，别刷 headline 基准（做日历 agent 就建日历 eval）。

---

*Generated from lecture transcript via deep-reader pipeline, 2026-11-17.*
