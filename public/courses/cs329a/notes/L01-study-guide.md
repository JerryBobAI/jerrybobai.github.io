# CS329A Lecture 1 学习笔记：Course Overview

> 讲者：Aakanksha Chowdhery（Stanford 兼职教授、Reflection AI 研究员）| Azalia Mirhoseini（Stanford CS 助理教授，前 Google Brain / Google DeepMind,参与 Gemini）|配合视频 `lectures/…[6YnLB0XbTnI].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L01-transcript.md](L01-transcript.md)

---

## 一句话概览

本讲上半场用 40 分钟复盘 LLM 五年主线——**scaling laws → 涌现能力 → 后训练三部曲 → 推理时扩展 → 测试时数据回灌训练**，下半场回答「为什么现在需要 agent」并交代课程后勤；全课主轴由此定调：让模型从会聊天、会推理，走向**端到端完成任务并自我改进**。

---

## 分节要点（带时间锚点）

### [0:00–0:05] 讲者阵容与 scaling laws 三要素

- 第二次开课，两位讲者自述背景；课程网站 cs329a.stanford.edu。
- 本讲结构：LLM 与 scaling 趋势回顾 → 课程内容预览 → 课程后勤（直接影响成绩，重点听）。
- **Scaling laws**：三张曲线图——加大**算力**、加大**数据集**、加大**参数量**，测试 loss 都随之下降；这是 GPT-3 以来预训练的根基。
- 模型规模的指数增长：BERT 3.4 亿 → GPT-2 15 亿 → GPT-3 1750 亿 → PaLM 5400 亿 → GPT-4 估计**万亿级**参数。
- 2018–2024 规模一路推高；「去年开始」预训练这条曲线出现**饱和**迹象——为后面转向推理时扩展埋下伏笔。

### [0:05–0:10] 变大带来什么：few-shot、CoT 与 ChatGPT 时刻

- 模型变大的三类收益：benchmark 持续提升；**few-shot learning**（不用微调，给几个示例即可套模板，原型开发变极易）;**涌现行为**（推理等能力只在足够大的模型上出现）。
- zero-shot = 只有任务描述；few-shot = 任务描述 + 几个示例（课上用英译法任务、cheese 一词演示）。
- **Chain of Thought**：在示例中连推理过程一起给出（Roger 有 5 个网球，再买 2 罐每罐 3 个，5+6=11），让模型学会「过程」再解新题；它是今天所有 reasoning/thinking 模型的地基。
- CoT 有规模门槛：LaMDA 8B、GPT-3 约 7B 用 CoT 无收益，更大的模型才能利用；modular arithmetic、word unscramble 也是到某个规模**突然出现**。
- 前沿实验室因此仍愿意继续推 scaling——更大的模型可能带来不可预知的新涌现行为。
- ChatGPT 2022 年 11 月上线，**5 天达到 100 万用户**，远快于此前知名软件；两个关键增量：**instruction tuning + RLHF**。

### [0:10–0:20] 后训练三部曲：对齐微调 → instruction tuning → RLHF/RLAIF

- 预训练只是下一 token 预测；模型「知道世界的统计」但不会听指令、不分对错——后训练解决这个 gap。
- 第一步：在**更高质量数据**（书籍、创意文章；公司为此花数百万到数亿美元采购）上继续 next-token 微调；也可针对 sensibleness、safety 用精选数据做对齐微调。
- 第二步 **instruction tuning**：instruction + 问答对（课上例：氮的沸点），或带推理链的 CoT 微调样本；数据集的质量与泛化性直接决定这一步产出模型的质量。
- 第三步 **RLHF**：让人（有时是专家）对模型多个输出做偏好评分 → 训出 **reward model** → 用它替代人类、引导 LLM 参数往「reward 说好」的方向生成。
- reward 可按维度定义：correctness / helpfulness / specificity / harmlessness，按需加权；用 AI 代替人类给偏好即 **RLAIF**。
- 这三步正是 ChatGPT 与 GPT-3 拉开差距的原因；约一年半前起，**推理(inference)成为让模型变强的第二个前沿**。

### [0:20–0:25] Large Language Monkeys：重复采样 + verifier

- Azalia 实验室项目，名字致敬**无限猴子定理**；做法：同一问题并行采样多次（LLM 当猴子），再用 **verifier**（如代码的 unit tests）挑出正确答案作为最终输出。
- 模型输出有随机性，**temperature** 可调节多样性；经验上超过约 1.2 就开始胡言乱语。
- 实验：每题采样数从 1 拉到 **10,000**，衡量 **coverage**（至少一个样本解对的问题比例）;Llama 3 8B / 7B 单样本时不如 GPT-4o，采样拉满后**反超 GPT-4o**。
- 结论：模型已经「会」的东西远多于单次采样所能展示的；有的题 10,000 个解里只有 3-4 个对，但足以覆盖 AIME 级难题。
- 问答：并行采样可并行跑，延迟不是主要问题，**成本**才是 trade-off；没有 verifier 时怎么办（LLM judge、LLM reward、带工具的 LLM）课程有专门一讲。

### [0:25–0:30] 测试时扩展回灌训练：self-improving 的雏形

- DeepSeek（2024 年 12 月发布）、OpenAI o1 系列、Gemini thinking 的共同点：把**微调与测试时扩展合流**。
- 测试时大量生成可以变成**合成数据源**：数学题有标准答案就筛出通向正确答案的链；代码题可批量产出高质量解——回灌进训练集再微调。
- 这就是课程标题里 **self-improving** 的第一块拼图：生成→筛选→再训练的闭环，且「模型能变多好」目前看不到边界。
- 对照两条 log-linear 曲线：LLM monkeys 是 coverage vs 采样数；o1（去年 9 月发布）展示 **pass@1 vs 测试时算力**（AIME 级数学基准）同样成立，且全程不改参数。
- 动机类比人类：难题多想、多试几种策略。

### [0:30–0:40] 思考模型的行为拆解与课堂问答

- 思考模型的典型步骤：**问题分析、任务分解、自我进化策略**（跑测试/用计算器/自判答案拿反馈再优化）、**自我纠错、提出替代方案与回溯**。
- 这些技能一部分来自人工整理的训练数据，更大一部分是模型在微调 + RL（合成数据）过程中自己习得的。
- o1 写 bash 矩阵转置脚本的例子：模型**自己产出**思维链——与当年在 prompt 里给 CoT 的本质区别就在「谁在生成推理」。
- 能力边界：对比 GPT-4o，推理模型在数学计算、数据分析、编程上全面更强，**个人写作与文案编辑并非强项**。
- 问答①：增益的来源是「数据让模型成为通用思考者」，分解/回溯/分析这些技能已泛化，不只是 prompt 里那句 step by step。
- 问答②：base model + 重复采样对应 pass@k / coverage；训练与测试时扩展教会模型**选出正确的那条链**，所以推理模型涨的是 pass@1。
- 问答③：推理能力随模型规模上升——想省算力就用大模型产推理 trace、小模型总结答案；且**模型更偏爱自己的 trace**（哪怕 trace 来自更强的模型），课程会讲 swirl 这篇论文。
- 问答④：如何教会推理没有公开定论，是「CoT 模板数据 + 模型自身泛化」的叠加；**outcome reward model 与 process reward model** 的区别后续课程展开。

### [0:40–0:45] 从 LLM 到 Agent：目标-行动-反馈-停止

- 转折点：chatbot / reasoning model 本质是**单轮**——好玩但不替你完成任务；最近几个月 Claude Code、Deep Research 让人第一次跑通真实工作流。
- Deep Research 例子：租房选址研究——自己上多个网站、分析汇总、给出各地利弊；Claude Code 例子：英语指令即可改文件、找测试用例，已成为软件工程师日常生产力工具。
- **Agent 的定义性循环**：给定目标 → 规划步骤 → 与环境交互 → 依据反馈纠正 → 达成目标或报告「做不到」；可能调用外部工具，并需要 **memory** 跟踪任务状态。
- 现实进度：少数场景端到端可行（编码、研究），多数仍是**人工编排的静态 agentic workflow**——如一个模型出解、另一个模型评审再决定是否采纳。

### [0:45–0:50] Workflow 模式大全与 coding agent 循环

- 工作流常见构件：LLM 调用、**verifier**（专讲一课）、**critic/judge**（LLM-as-judge,作业覆盖）、**tool call**（搜网页、查天气）。
- 六种编排模式：**prompt chaining**（子任务串链）、**routing**（按复杂度分流到繁/简流程）、**parallelization**（Deep Research 多关键词并行后聚合）、**orchestrator**（中央 LLM 做规划，Claude Code 即此）、**evaluator/judge**、**verifier**（跑 unit test 验证输出）。
- 在可验证域（**math、code、规则明确**的领域），verifier 的反馈能让模型自我纠错——全课反复出现的主线。
- 这些 workflow 对模型的新要求：**更好的规划、多步推理、自我改进**（错了能自己纠正）——单靠推理模型还不够，是后续讲次的地图。
- Coding agent 循环：英语指令 → 导航 repo、搜索/查看/编辑文件 → 终端执行命令 → 依据输出决定下一步；这套循环去年还不可靠，现在开始可靠。
- 为什么是现在：模型更强 + **RL with verifiable rewards** + train-time scaling 起效；模型变好后 **self-improvement loop** 接棒（自动生成任务，任务越来越可靠）;Code Monkeys 论文用「给生成代码再生成 unit tests」做验证。

### [0:50–1:00:00] Generator-verifier gap、落地场景与「CoT 是否涌现」之争

- **Generator-verifier gap**：生成大量候选容易，判断哪条有用难；有可靠反馈的域才能持续改进，创造性写作只能靠人类反馈——**反馈成为瓶颈**；robust verification 很难，Azalia 后面会讲她实验室组合多个 verifier 的工作。
- 学生好问题：预训练里明明已有这些能力，RL 为什么还能带来这么大的跳变？——回答：活跃研究领域、**尚无共识**；预训练多样数据与 RL 都有贡献，整个闭环「初步看到生命迹象就被商业化」，远未被理解。
- Coding agent 补充：**澄清用户意图**是第一步（用户经常说不清需求），收尾要靠测试验证——甚至测试也可能是模型自己生成的；o3 这类模型见过大量端到端 trace，所以能规划、多步推理、给出结论。
- 最先落地的场景是**重复性任务**：代码迁移、版本升级、代码库重构、数据工程（抽取/清洗）、数仓迁移、单元级任务。
- 客户支持四件套：实时转写、knowledge assist（查知识库并给出相关文章，优于纯索引检索）、smart replies、call summary。
- 研究报告场景：给复杂题目（例：2022 冬奥开幕式）→ 自动确定要查的参考文献 → 列大纲 → 逐篇总结 → 合成完整长文；作业里会亲手做一个。
- 更前沿的 **AI scientist**（AI scientist 论文）：idea 生成/brainstorm、实验迭代、论文写作全程辅助；虽然会幻觉，但读遍网页的模型能给出「跳出框」的想法，brainstorm 价值已被认可。
- 收尾问答：CoT 当年是**被发现的**而非设计出来的（GSM8K 论文首个 signs of life,PaLM 能解释笑话令人惊艳）；今天的 reasoning 模型则是**专门训练**出来的——自我纠错/回溯算不算涌现，「很难说」。

### [1:00:00–1:09:42] 课程后勤：作业、项目标准与评分

- 主题清单 + **frontier lab 客座讲座**（post-training 演进、多模态 agent、机器人等）；信息走 Canvas，讲义尽量课前上传，due date 已挂网站。
- 本季 **3 个 homework**（比上一季多一个，TA 新设计）。
- **Course project**：自选题——搭 agentic 系统或深挖一个问题并设计实验；**提供 API credits**；组队 **2–4 人**（1 人也行，组队共享更多 credits）；往年优秀项目会上网站展示。
- 合格项目示例：新的评测数据集/benchmark、评估现有 agentic 系统的可靠性、在现有 benchmark 上 hill-climb、质疑/改进/评测课上论文的某个决策。
- 反面示例：**survey 论文、纯 demo app**；必须 researchy——有假设、有问题、有想看到的改进或想分析的性质，「不止是 live coding」。
- 里程碑：尽早开跑——**project proposal 约 10 月初**；proposal 两周后的 **midterm 展示要有真实进展**（提按时就想好要跑哪些实验）；final report 权重最大；期末 **poster 展示 12 月 12 日 16:00–18:00**，业界人士到场；上一季有学生把项目做成了论文发表。
- 评分：**homework 50% + project 50%**；遵守 honor code。
- 其他：提问发 Ed/Stem 并公开（你有的问题别人大概率也有）；GradeScope 交作业与里程碑；迟交政策宽松但**班级太大不予例外**；**不接受 audit**；录像最终会上 YouTube。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Scaling laws | 算力/数据/参数三轴加大，测试 loss 可预测地下降 | 本讲开场，GPT-3 以来 |
| Few-shot learning | 不微调，只在 prompt 里给几个示例模型即可套用模板 | GPT-3/PaLM 时代能力 |
| 涌现能力 | 推理、modular arithmetic、word unscramble 等超过某规模才突然出现 | 本讲 |
| Chain of Thought | 示例中附推理过程，模型学会「过程」再解新题 | GSM8K 首现 signs of life |
| Instruction tuning | instruction + 问答对微调，教会模型听指令 | ChatGPT 两大增量之一 |
| RLHF | 人类偏好评分 → reward model → 引导 LLM 参数 | ChatGPT 两大增量之一 |
| RLAIF | 用 AI 代替人类提供偏好/奖励信号 | 本讲 |
| Large Language Monkeys | 同一问题重复采样至 10,000 次 + verifier 选优 | Azalia 实验室 2024 |
| Coverage | 至少一个采样解对的问题比例，随采样数 log-linear 上涨 | LLM monkeys |
| Test-time scaling | 不动参数，推理时多花算力换 pass@1(o1/AIME log-linear) | o1,2024 年 9 月 |
| Self-improving loop | 测试时生成合成数据 → 筛选 → 回灌训练 | DeepSeek/o1 共同点 |
| Verifier | 可程序化判对错的选择机制（如 unit tests）；课程有专讲 | 本讲 |
| Agentic workflow | 人工编排的静态调用图：chaining/routing/parallelization/orchestrator/judge/verifier | 本讲 |
| Generator-verifier gap | 生成候选容易、验证哪条对难；反馈是自我改进的瓶颈 | 本讲 |

## 自测题（先遮住右侧再答）

1. 预训练 scaling laws 的三条曲线分别以什么为横轴？模型规模的典型数字序列？
   > 横轴分别是算力、数据集大小、参数量，纵轴测试 loss;BERT 340M → GPT-2 1.5B → GPT-3 175B → PaLM 540B → GPT-4 估万亿级。
2. CoT 涌现有什么规模门槛证据？还有哪些能力也是「到某个规模突然出现」?
   > LaMDA 8B、GPT-3 约 7B 用 CoT 无收益，更大模型才能利用；modular arithmetic、word unscramble 同样是超过某规模突然出现。
3. ChatGPT 相对 GPT-3 的两个关键增量是什么？用户增长速度数字？
   > instruction tuning + RLHF（人类偏好对齐）;2022 年 11 月上线后 5 天达到 100 万用户，快于此前知名软件。
4. RLHF 的完整流程？reward 可以按哪些维度定义？
   > 人类（含专家）对模型多个输出做偏好评分 → 训 reward model → 用它引导 LLM 参数；维度：correctness/helpfulness/specificity/harmlessness，可加权。
5. Large Language Monkeys 的实验设置与关键结论？
   > 同题重复采样 1→10,000 次 + verifier（如 unit tests）选答案；Llama 3 8B/7B 单样本不如 GPT-4o，采样拉满后 coverage 反超——模型会的比单次采样显示的多。
6. coverage/pass@k 与 pass@1 分别对应什么设定？
   > 重复采样(LLM monkeys)看 coverage/pass@k；训练与测试时扩展（推理模型）教会模型选对链，涨的是 pass@1（o1 在 AIME 上 log-linear）。
7. LLM 到 Agent 的关键转变是什么？Agent 循环包含哪几步？
   > 从单轮对话到端到端完成任务：给目标 → 规划步骤 → 与环境/工具交互 → 依反馈纠正 → 完成或报告失败，且需要 memory 跟踪任务。
8. 什么是 generator-verifier gap?哪些域适合、哪些域受限？
   > 生成候选容易、验证哪条对难；math/code/规则明确域可用 verifier（如 unit tests）持续改进，创造性写作只能靠人类反馈而成瓶颈。
