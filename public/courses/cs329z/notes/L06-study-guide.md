# CS329Z Lecture 6 学习笔记：AI Agent Design Patterns: ReAct, CodeAct & More

> 讲者：Michael Ryan（Stanford NLP）｜配合视频 `lectures/…[JC_pLC5EX_w].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L06-transcript.md](L06-transcript.md)

---

## 一句话概览

本讲把 agent 开发当成"设计模式"来讲：先用 **Anthropic 五大 workflow 模式**（链式、路由、并行、编排者-执行者、评估者-优化者）覆盖可预测场景，再用 **ReAct、Reflection、CodeAct、Plan-then-Execute** 四类 agent 模式覆盖灵活场景，最后落到上下文管理四策略与极简生产框架 **Pi**——核心信息：模式是半成品，真实系统都是组合，必须按任务定制并用评测验证。

---

## 分节要点（带时间锚点）

### [0:00–0:05] 设计模式引入与 workflow vs agent 回顾

- 类比 GoF《设计模式》教材：软件开发总结了 **23 种左右**的模式（如 Singleton），目标是写出可扩展、可读、可维护的代码；agent 系统同样需要设计模式。
- 关键提醒（讲座引用）：**设计模式是半成品方案**——永远需要自行改进、适配自己的环境；可以用来引导思路，但别过度依赖。
- 复习光谱：**model → workflow → agent**。控制流在代码里 = workflow（可预测、难灵活）；控制流在 LLM 里 = agent（灵活但更难评估、优化）。博客中的草图：Y 轴 predictability、X 轴 subjectivity。
- 典型例子：邮件提取事件 + 选 emoji + 写日历是 workflow；客户支持中"查政策自动起草回复"是 workflow，而"实际调查并解决工单"是 agent。
- Q&A（什么会长期稳定不折腾）：领域还很年轻，但 **ReAct 已经相当稳定**、**MCP 正在成为工具组织的通用方式**，这两块可以少折腾。

### [0:05–0:15] Workflow 五大设计模式（Anthropic 分类法）

| 模式 | 机制 | 讲座例子 |
|---|---|---|
| Prompt chaining（提示链） | 任务分解为多次 LLM 调用，可带 if-then 分支 | 邮件：先抽取事件，再选 emoji（牺牲延迟换准确率） |
| Routing（路由） | LLM 像"交换机"，按输入分发到不同模型/工作流/提示 | 数学题先判难度：简单题给 3B 小模型，难题给旗舰模型——省钱省时 |
| Parallelization（并行） | **sectioning**：切分独立工作同时跑；**voting**：同一输入跑多次投票 | sectioning：聊天机器人安全分类器与回答生成并行；10 条评分细则并行打分。voting：同一数学题做 5 次，3 次一致就采纳 |
| Orchestrator-workers | LLM **动态决定**需要几个子任务并分派给 worker | "从零写 Photoshop"：动态拆出 UI、调色板等子任务 |
| Evaluator-optimizer | 生成器 → 评估器反馈 → 循环优化 | 生效的两个前提：①**反馈可以明确定义**（何为好/坏）；②LLM 能给出这种反馈（人类偏好类反馈就不一定行） |

- 链式调用的延迟代价：两次调用几乎总比一次慢（例外：两次带推理 vs 一次不带推理）。

### [0:15–0:30] 模式组合实例：STORM 与 Archon

- 真实系统 = 基本模式的**组合**。案例一 **STORM**（2023–2024 论文）：输入一个主题（例：2024 年花莲地震），生成带引用的 Wikipedia 风格全文。流程 = orchestrator（LLM 自己决定生成多少个视角：地震学家、地质学家、政治人物、市民……）+ 类 evaluator-optimizer 的多轮问答对话循环 + prompt chaining（调研 → 计划 → 成文）+ parallelization（直接从主题到草稿计划的分支与对话分支并行汇合）。
- Q&A 洞见：
  - 为什么不直接一步生成？消融显示多视角问答流程**文章更多样、质量更高**（对比基线就是直接生成）。
  - 对话循环如何终止？最大对话轮数是超参数；prompt 里写"问完问题后说谢谢"，让模型自己跳出循环。
  - 有没有大模型监督小模型？STORM 没这么做（可能全程同尺寸 LLM）；可以按 evaluator-optimizer 设计更大评估器，但系统会**很贵**。
  - 多代理系统怎么评估？先定义你关心的维度（如成本），可画成本-准确率 Pareto 曲线（下一讲展开）。
  - 结果：与人工写作文章的相似度更高；LLM 按维度评分为 interest / organization / relevance / coverage 更高；基线包括直接生成与 "Oracle RAG"（直接喂给人类作者用过的引用链接）。
- 案例二 **Archon**：架构搜索框架。输入 = 要优化的 benchmark + 推理预算 + 可用 LLM；**推理时方法的积木**：Generator、Fuser（聚合多答案）、Critic（指出优劣）、Ranker（排序）、Verifier（判断并纠错）、Unit test generator（以单元测试为评分条件）；用贝叶斯搜索在候选架构上迭代。
  - Q&A：这些"模型"不训练，都是现成 LLM 直接 prompt；LLM 排序少量对象尚可，排上千个必崩。
  - 找到的数学题流水线：GPT-4o / Llama 3.1 / Qwen 2.5 / Wizard 各生成 5 个候选（共 20 个）→ Claude 分析属性 → Claude 3.5 Sonnet 重排 → fuser（GPT-4o）归组合并 → verifier（GPT-4o）纠错 → 汇成单一答案。
  - 结果：**放开 token 预算后搜出的架构在数学上超过了 o1**（发表时的最强数学模型）。讲师吐槽：这框架其实更适合明确的工作流而非数学；另有收敛风险（假设模型总会给出一个答案，可加大推理长度兜底）。

### [0:30–0:45] Agent 模式一 ReAct 与模式二 Reflection

- Agent 定义：LLM 调用 + 环境交互 + 拿到反馈 + **LLM 自己决定何时停止**；因此要设计"如何推理、如何行动"。
- **ReAct** = "给 agent 用的思维链"。HotpotQA 式例题：Apple Remote 之外还有什么设备能控制它最初配套的程序？直接答 iPod（错）；纯 CoT 答多个设备（也错）；纯 act 一直搜不到；ReAct：先想"我该搜什么" → 搜 Apple Remote 发现 **Front Row** 媒体中心 → 搜 Front Row 软件 → 答案：Apple Remote 或键盘功能键。核心思想：**行动前先推理**——事后看似显然，却是最重要的想法之一。
- 原论文反直觉发现：ReAct 式提示在 **540B 参数**模型上随规模增大反而变差，纯靠参数化知识更好；但对模型做 **fine-tuning（在推理+行动轨迹上训练）后效果突然变得非常好**。启示：把模型 post-train 成 agent 已是今天的普遍做法。
- **Reflection（Reflexion）**：actor 生成轨迹 → evaluator 分析 → 自我反思（哪些做对了/错了）→ 轨迹 + 反思一起写入长期记忆供下次使用。编程例：合法括号序列题——生成的代码只检查了括号总数、没检查匹配顺序，单元测试失败；反思后下一轮重写代码。加入反思后，准确率随尝试次数上升。
- 消融（EPM = episodic memory）：看不到过去轨迹的基线 < 能看过去轨迹 < 过去轨迹 + 反思（深紫线最高）——**自我反思帮助把经验固化进记忆**。
- 反思的边界：自纠错论文在 GSM8K 和 CommonSenseQA 上发现，基线设置正确时**自我反思反而降低性能**；Reflexion 有效靠的是外部环境反馈（跑单元测试）。后续批判论文给验证器**加了工具**（能搜索、调用工具的"更 agent 的验证器"）：无工具版（等同自我反思）远差于带工具版，oracle（直接给正确答案）最好——外部验证往往比纯自省更有用。
- Q&A：Reflection 全靠 prompt 实现（与 RL 无关，呼应 L1）；对内置推理的模型，建议先建立自己的 benchmark/评测，再尝试增删组件——反正搭 agent 很快，"试一百种配置"即可。

### [0:45–0:55] Agent 模式三 CodeAct 与模式四 Plan-then-Execute

- **CodeAct**：主张**代码是更好的动作形式**。例题：在美国/日本/德国/印度四国中找买 "CodeAct 1" 手机最划算的国家；工具含查关税、汇率换算、税、到手价、手机价、运费。ReAct 一步步 JSON/文本调用工具；CodeAct 直接写一段程序，把工具当函数调用，循环、min 等 Python 逻辑都在代码里完成。答案：日本，$904。
- 结果：code-as-action 在所有受测模型上**成功率更高、步数更少**（仅 text-davinci-003 上 JSON 偶有例外）。
- Q&A（工具太多会迷惑模型怎么办）：**procedural disclosure of information**——只在需要时才暴露工具。
- **ReWOO**（Reasoning Without Observation）：先一次性生成完整计划，用**占位符（#E1、#E2…）**标记工具输出之间的依赖（讲座例题：找出酿制某菜肴主要成分的白兰地酒庄名——计划 = 搜词条 → 从 #E1 提取主成分 → 搜该成分 → 结合 #E2 找酒庄），再由 workflow 按依赖逐步执行。效果：比 ReAct **更省 token 且准确率更高**；思想上与 CodeAct 相通（变量承载中间结果）。
- **LLMCompiler**：例题"微软市值要涨多少才能超过苹果？"→ 先并行搜两家市值、再做数学运算、可穿插 LLM 调用——整张**有向无环图（DAG）**并行执行；外部验证器失败时动态重新规划（Q&A：生成新计划重试的简单循环）。收益：更低延迟、保持准确率。
- 现状：plan-then-execute 在很大程度上**已被代码生成取代**（直接让模型写要执行的代码更灵活），但"规划"仍是编排（orchestration）里的重要概念——如 Claude Code 的子代理动态工作流。
- 小结：ReAct 教我们行动前思考；Reflection 已大量被推理模型的自我纠错吸收；CodeAct 说代码是好的动作形式；ReWOO/LLMCompiler 把动作编译成 DAG 一次执行——今天这些都体现为代码生成 + 并行工具调用。

### [0:55–1:10:00] Context Management：原则、四种模式与组合

- 背景：agent 循环里每次都要为 LLM 构造输入，这就是**上下文管理**系统；从"设计 prompt"（2022–2023）转向"设计 context"。事实一旦落进长上下文的中段，模型就难以据此推理——所以即使最好的模型也受益于好的上下文工程。
- 两大原则：**保持聚焦**（窗口里只放当前任务所需，别堆全部历史和观察）；**保持连续性**（改上下文时别弄丢需求、目标、约束与进度；实践上意味着 **KV cache 持久化**——打乱上下文会使 KV cache 失效、拉高延迟）。
- 模式（LangChain 博客分类：write / select / compress / isolate）：
  1. **永久事件日志**（OpenHands，Graham Neubig 的 CMU 项目兼创业公司）：用户消息、agent 动作、工具输出、观察全部追加进事件流；每次调用时从日志重建 LLM 输入（过滤 → 转消息）。压缩/删除只改变"投影"，日志本体不动，永远保留完整历史；还便于外部观察者挂钩子（如 LLM 一回复就触发下一个工具调用）。
  2. **Memory offloading**：把数据写进记忆/文件，需要时再取回（MemGPT 例：用户提到男友 James 烤了生日蛋糕 → agent 记住生日 2 月 7 日；当天再聊时主动问"生日过得怎么样"并从文件系统取回 Six Flags 之行）。RAG/工具检索是常见实现（详见 L7）。
  3. **Compaction 压缩**：最简单做法——把上下文截到短于模型真实容量，让模型总结成摘要；更 agent 化的做法是带工具的压缩（需要时可再检索），代价是要等它压。
  4. **Observation masking**（"The Complexity Trap" 一文）：编程类 agent 的 token 预算大头是**观察**（整页网页、整段命令输出），推理+动作只占小头。与其摘要，不如把"已经据此行动过"的旧观察裁成几行或直接删（例如 10 步后开始删早期观察）；配合事件日志写个转换器即可，纯软件实现、无摘要延迟。代价：每次改动输入都使 KV cache 失效 → 实践中每 5–10 轮批量裁剪。结果：与 LLM 摘要式压缩性能基本相当，有时略好。
  5. **上下文隔离**：① 子代理——搜索/文档分析类任务让子代理把自己的上下文填满，只给主代理回**简短摘要**；② 渐进式信息披露——**skill 文件**（如"如何处理 PDF"的说明+代码）：系统提示里只列技能名/位置，需要时才加载内容。
- 各策略**可组合**：先写入记忆再压缩、事件日志 + 裁剪观察；真实系统都是组合。
- Q&A：skill 与 tool 的区别——tool 直接作用于环境，skill 是把一整段操作指引注入工作记忆（agent 之后仍要调用工具去做）；上下文里只放技能清单（作为系统提示的一部分，压缩后仍保留），内容按需加载。

### [1:10:00–1:15:00] 生产案例解剖：Pi（极简 agent 框架）

- 设计哲学：**让 Pi 适配你的工作流，而不是反过来**。刻意没有：子代理、权限检查、规划模式、待办清单、后台 bash；所有操作都在一个工作会话里。
- 内置工具：read / write / bash / PowerShell / edit / grep / find / ls，**默认只开四个**（read、bash、edit、write）；其余本质都是 bash 的子集。
- Agent 工作流是 **ReAct**（先推理再 JSON 工具调用）；调用 bash 时写整段脚本 ≈ code-as-action。上下文组织成**树**，可以回到 earlier 分支重新展开。
- 上下文管理 = 事件日志 + 技能文件渐进披露 + 标准压缩：设定 cutoff（首个保留 ID 之前的内容压缩成摘要，之后逐字保留）；调用时输出 = 系统提示 + 摘要 + 未压缩的近期消息。
- 安全：**什么都没有**——以启动进程的同等权限运行，无任何权限弹窗，等于永远 auto-approve。Q&A：为什么这么简却好用？**基础模型已经强到不需要精致脚手架**；但安全正是 Pi "actively bad" 的地方，取决于你的使用场景。Q&A：能否"弱模型 + 好脚手架"省钱？强模型配最简脚手架、弱模型配高质量脚手架——这是一组可以实测的权衡。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Prompt chaining | 分解为多次 LLM 调用，延迟换准确率 | Anthropic《Building Effective Agents》 |
| Routing | LLM 按输入把任务分发到不同模型/流程 | 同上 |
| Parallelization | sectioning（切分）+ voting（投票聚合） | 同上 |
| Orchestrator-workers | LLM 动态决定子任务数量并分派 | 同上 |
| Evaluator-optimizer | 生成-反馈循环；前提是反馈可定义且 LLM 给得出 | 同上 |
| STORM | 多视角问答 + 计划 + 成文，生成 Wikipedia 式带引用文章 | 2023–2024 论文 |
| Archon | 用贝叶斯搜索在工作流积木（Generator/Fuser/Critic/Ranker/Verifier…）中搜架构 | 架构搜索论文 |
| ReAct | 思考-行动-观察循环；行动前先推理 | Yao et al. 2022 |
| Reflection / Reflexion | 轨迹 + 自我反思存入记忆，供后续复用 | Shinn et al. |
| CodeAct | 以可执行代码作为动作形式，成功率更高、步数更少 | Wang et al. 2024 |
| ReWOO | 一次性生成带占位符的完整计划，再按依赖执行；省 token | Xu et al. |
| LLMCompiler | 把动作编译成 DAG 并行执行，支持动态重规划 | LLMCompiler 论文 |
| 事件日志 | 只追加的完整历史；上下文是它的投影 | OpenHands |
| Compaction / Observation masking | 摘要压缩 vs 裁剪已消费的旧观察（更简单、无摘要延迟） | "The Complexity Trap" |
| 上下文隔离 | 子代理各自独立上下文 + skill 文件渐进披露 | Anthropic / LangChain 分类 |
| Pi | 极简 ReAct agent：默认 4 工具、树状上下文、无安全机制 | 生产案例分析 |

## 自测题（先遮住右侧再答）

1. Anthropic 的五种 workflow 模式是什么？evaluator-optimizer 生效的两个前提？
   > prompt chaining、routing、parallelization（sectioning/voting）、orchestrator-workers、evaluator-optimizer；前提：反馈可以明确定义 + LLM 能给出该反馈（否则考虑其他优化途径）。
2. STORM 由哪些模式组合而成？为什么比直接生成一篇好？
   > orchestrator（动态生成视角）+ 问答对话循环（类 evaluator-optimizer）+ prompt chaining + parallelization。消融显示多视角调研带来更多样、更高质量的文章。
3. ReAct 原论文的反直觉发现是什么？后来的实践结论？
   > 540B 模型上 ReAct 提示随规模反而变差、纯参数知识更好；但在推理+行动轨迹上 fine-tune 后效果非常好——把模型 post-train 成 agent 已是普遍做法。
4. 自我反思何时有害、何时有效？关键差异是什么？
   > GSM8K/CommonSenseQA 上纯自省反而降性能；Reflexion 有效靠外部环境反馈（跑单元测试）。批判论文给验证器加工具后远好于无工具自省——外部验证 > 纯自省。
5. CodeAct 相比 JSON/文本工具调用有哪两个优势？工具过多怎么办？
   > 成功率更高、完成步数更少（几乎所有受测模型）。用 procedural disclosure：只在需要时暴露工具。
6. ReWOO 与 ReAct 的执行模型有何不同？收益如何？
   > ReWOO 先一次性生成带 #E1/#E2 占位符的完整计划再按依赖执行（ReAct 边执行边观察）；token 更省、准确率更高。
7. Compaction 与 observation masking 如何取舍？共同代价是什么？
   > masking 更简单、纯软件、无摘要延迟，性能与 LLM 摘要基本持平但可能顶到上下文上限；两者改动历史都会使 KV cache 失效，需每 5–10 轮批量操作。
8. Pi 的设计哲学与最大短板？
   > 让工具适配你的工作流、极简（默认 4 工具、无子代理/权限检查）；好用是因为基础模型够强，最大短板是完全内置安全机制（等同启动进程权限、永远 auto-approve）。

---

*Generated from lecture transcript via deep-reader pipeline, 2026-11-17.*
