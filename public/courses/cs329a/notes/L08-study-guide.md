# CS329A Lecture 8 学习笔记：Agentic Evaluations & Long-Horizon Tasks

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配套视频 `lectures/…[8JAqLnTaZu4].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L08-transcript.md](L08-transcript.md)

---

## 一句话概览

本讲用三篇 benchmark 论文回答「agentic 评估到底该测什么」：**METR time horizon**(模型能可靠完成多长的任务)、**GDPval**(真实经济价值任务上能否胜过行业专家)、**DeepScholar-Bench**(深度研究综合质量)——结论：能力在快速提升，但**可靠性、context 获取与引用可验证性**仍是主要缺口。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 开场：agentic 评估难在哪，三篇论文定调

- 开场课堂调查：同学项目里已用过的评估包括 **multi-hop QA、SWE-bench、hard QA、private wiki QA**——本讲聚焦这类评估为什么变难。
- 传统 benchmark(chat、单轮问答、single-shot)正在**快速饱和**；衡量 AI 进步需要同时看**能力**与**经济影响**。
- 三篇配套论文：**METR time horizon**(任务能做多长)、**GDPval**(OpenAI 出品,真实经济价值任务)、**DeepScholar-Bench**(Stanford 出品,live 生成式研究综合,给论文写 related work)。
- 两个核心度量：METR 用**人类专业人士校准的任务时长**；GDPval 用**模型 vs 专家的 win rate**。两者洞察相似，但趋势形状很不同。

### [0:05–0:10] METR 基准怎么造：三个任务套件 + 人类时间锚

- 核心问题两个：模型能完成的**任务时长**(duration)与**成功率**(reliability)；通用锚点是**人类专业人士完成该任务所需时间**。
- 三个任务套件，共约 **170 题**:**SWAA**(1-30 秒原子动作,66 题)、**HCAST**(1 分钟-30 小时软件/研究工程任务,97 题)、**RE-Bench**(完整 ML 研究任务,最长 8 小时,7 题)。
- 流程：收集并 vet 任务 → 人类跑(记录完成时间与难度感受)+ agent 跑(测可靠完成率)→ 拟合**成功率 vs 时间估计**曲线 → 读出 time horizon。
- 人类基线：**约 5 年经验**的专业人士记录成功尝试的耗时，难度评分取几何平均；坑在于**老手会低估任务难度**，与模型视角不一致。
- 课堂互动：查文献并核对 BibTeX 条目(几分钟,HCAST 型)；大规模代码重构(数小时到数天,接近 RE-Bench 型,还要有人验证正确性)。

### [0:10–0:15] METR 结果：每 7 个月翻倍的时间视野

- 谱系任务实例：找 shell 脚本(约 3 秒)、Wikipedia research、修仿真输入文件里的 bug(人类 10 分钟)、JSON 格式转换、实现 CUDA kernel 的回测工具(8 小时,追求性能提升)。
- 成功率曲线：**SWAA 小任务成功率高**；HCAST **全凭运气**(0~0.8)；RE-Bench 整体偏低——**任务越长，模型越难保持正轨**，这正是 agentic 评估难测的原因。
- 翻倍趋势：2019 GPT-2 只能做 **2 秒**级任务 → 2023 GPT-4 约 **8 分钟** → 2025 Claude 3.7 Sonnet 达 **59 分钟**;**每 7 个月翻倍**。
- 注意这全是 **50% 成功率**口径——像 intern 交差只有一半靠谱，始终有不确定性。

### [0:15–0:20] 什么在驱动进步(课堂讨论)

- 论文归纳的能力驱动：**逻辑推理、代码生成、工具使用、可靠性**(不再重复同样动作)、**错误恢复**、对最终目标与进度的**状态/记忆意识**——8 小时任务里必有出错步骤，恢复能力是刚需。
- 同学补充一：**context engineering**——跨多步更好地组织上下文(如 Claude Code 的 compaction window)。
- 同学补充二：产品反馈闭环——类似 Cursor 用在线 RL 从用户日志改进；用户指出错误后模型**重做**。
- 同学补充三：复杂问题先**显式 planning**、执行中**replanning**，减少按固定计划试错。
- memory 的作用：沉淀对环境(如 codebase)的理解，便于在相似代码库上继续工作。

### [0:20–0:25] 可靠性鸿沟与失败模式

- **80% 成功率**下，最新模型只能可靠完成约 **15 分钟**的任务(50% 口径是 59 分钟)——可靠性 gap 巨大，**真实部署时中等复杂度任务就会撞上可靠性问题**，在模型之上搭系统有大量 headroom。
- 失败模式分析(GPT-4 vs o1,非推理 vs 推理模型,失败类型高度相似)：
  - **poor planning**：不会把任务拆解成步骤；
  - **poor tool choice**：工具选错；
  - **mental math / reasoning 错误**：推理本身做错；
  - **过早放弃任务**：陷入重复后判断不了什么叫"完成"；
  - **重复循环**：失败后仍以高概率重复同一动作——GPT-4 很严重，o1 明显降低。
- 方法论：好的 benchmark 都要展示**模型在哪失败、常见失败模式是什么**；课程作业同样要求大家做 failure 分析与自我反思。

### [0:25–0:30] METR 的三个局限 + GDPval 登场

- METR 做对的：**首次量化**了模型可完成任务的时间视野。局限同样明显。
- 局限一：在 **messy**(无唯一正确答案、带复杂度)的任务上表现偏低。
- 局限二：**SWE-bench 被系统性低估**——标注者低估耗时，且模型训练时见过大部分 GitHub repo，估出的翻倍时间偏短(相当于在"已见过的 repo"上测)。
- 局限三：**内部代码库**上，无 context 的 contractor 比维护者慢 **5-18 倍**，而模型表现接近 contractor——**模型更像一个聪明但零上下文的人**，不是领域专家。
- GDPval 换了个问法：不是"AI 能不能做这个"，而是"**把任务交给模型而不是人，产出够不够好**"，直接与 **10 年以上经验的行业专家**比 win rate。
- 任务全部来自真实职业工作：行业覆盖房地产、政府、制造、专业/科学/技术服务、医疗、金融、零售、批发、信息(含影视剪辑)等；模型是多模态的，所以任务形态也多样。
- 示例任务：设计流水线电缆卷筒支架 3D 模型(制造工程师)、competitive landscape 调研(金融分析师)、看图写护理会诊报告(注册护士)、按脚本剪 intro reel(影视剪辑)、回客户投诉邮件(客服)、四口之家行程(concierge)、采购订单定价不一致审计、新房销售册(房产经纪)、vendor fair 摊位布局。

### [0:30–0:40] GDPval 数据集与总趋势：线性爬坡到 47.6%

- 规模：瞄准 **9 个行业、GDP top 5% 的经济价值任务**;**44 个职业**，约 **2020 题**，其中 **220 题**作为公开 gold set 放在 HuggingFace。
- 任务取自 **O*NET** 职业任务分类法，其中约 **60%** 是 computer-based 数字任务，对职业专家日常工作有代表性。
- 任务特征：完成时间平均可长达 **7 小时**(有的要数周)；文本+多模态(CAD、视频、音频、表格、演示);gold subset 平均价值约 **$400/任务**;**70%** 需要交互 reference files;**89%** 经专家核验为 well-specified。
- 总趋势：GPT-4o **12.4%**(2024)→ 25% → 30 多 → **Claude Opus 4.1 47.6%**(wins 口径,另报 wins+ties)；与 METR 的**指数翻倍**不同，这里更像**线性**——提醒大家：指数外推"能做 1 小时→明天能做几天"并不成立。
- 模型各有所长：有的模型强在美学/文档排版/PDF/表格/演示理解，**GPT-5** 强在指令遵循、计算正确性与纯文本任务。
- 最常见失败模式：**instruction following**——声称会查参考数据实际不看、用幻觉覆盖参考数据、格式错误；GPT-5 此类错误较少。
- 委派价值：约**一半**任务"可接受但 subpar"；仅约 **20%** 模型真的更好；**29%** bad/catastrophic；且人类评分者之间存在分歧，影响分析。
- Self-improving 视角：允许 **n 次尝试 + 自我修正**时，成本约 **1.6 倍**、耗时约 **1.4 倍**(换来胜率提升)，而成功任务的成本仍**低于人类专家工资的 10%**——某些职业上模型已能完整接活。

### [0:40–0:50] 分职业表现与 context 的核心教训

- 接近或达到**普通人类专家**水平的职业：counter & rental clerks、real estate brokers、shipping/receiving/inventory clerks、buyers & purchasing agents、computer & IT system managers、software developers。
- 多模型表现突出的职业：administrative service managers、compliance officers、medical & health service managers、personal financial advisors、customer service representatives；编辑类、调查性/新闻分析类、批发与制造销售代表类任务也在快速被接住。
- 按维度：**短任务(几小时内)明显更强，长任务下降**；多模态 vs 文本因模型而异；政府、零售、批发等部门已接近人类水平(注意对照的是"平均专家"而非顶尖专家)。
- **Underspecified prompt 实验**：去掉 prompt 里的 context 后 win rate 只掉几个点，更严重的是模型**不知道该做什么**——真人负责 **architect 问题**(决定做什么、context 放什么)，模型负责执行。
- 呼应 contractor 发现：真实工作是 **context-heavy** 的；本 benchmark 测的是"聪明人带着完整 context 能否做好"，**没有测获取 context 的能力**。
- 近期结论：**AI assistance + 人类监督**已在专业工作流中发生且划算；不同模型擅长不同任务类型，需要按任务选模型。
- 问答(美元数字可信吗)：重点不在美元，而在**任务类别**——deep research、代码生成、多源信息理解是模型天然占优的类别；该 benchmark 的贡献是给各职业任务一个**可量化、可验证的 taxonomy**。

### [0:50–1:00:00] DeepScholar-Bench:live 研究综合基准

- 动机(同学点题)：让 AI 给论文写 **related work**；Stanford 出品，测的是"AI 能否做 **deep research synthesis**"——研究一批参考文献、检索相关信息、综合成连贯且引用可验证的报告。
- 同类原型：OpenAI deep research、Gemini Deep Research、Perplexity、Stanford 的 STORM、Open Scholar；作业 3 里大家自己搭过 deep research agent。
- 数据集设计：近期 arXiv 论文、**PhD 级难度、22 个领域**；**每月重跑**保持 live；只用大模型训练截止之后的论文，**避免数据污染**。
- 三个评估轴：
  - **Knowledge synthesis**：组织是否连贯、是否抓住关键事实(key nuggets)；
  - **Retrieval quality**：参考文献相关性 + **citation counts / document importance** + reference coverage;
  - **Verifiability**：引用是否支撑论断(测 precision 与 coverage 两侧)；各指标经人工验证，**人机一致性 70-80%**。
- 核心结果：**没有任何现有系统总分超过 19%**(对比常规 benchmark 的 70-80% 饱和,headroom 巨大);OpenAI deep research 写得漂亮但 consistently 漏关键事实；retrieval 只是"okayish",document importance **<12.5%**;verifiability 上 DeepScholar-base 精度可达约 **90%**，而 OpenAI deep research 文笔好但可验证性低。
- 失败模式：找不到**综合性/奠基性文献**(专家靠多年积累 bookmark 的那批)；难以评估文献重要性；即使**喂给它完美文献**，关键事实覆盖也只有约 **50%**；synthesis 质量与 verifiability **没有系统两者兼得**。
- 教训：凡是需要**查参考数据/知识库**的 agentic 任务都非平凡——缺专家的背景知识、关键信息提取不全、引用 precision/recall 权衡达不到该职业可接受的门槛。

### [1:00:00–1:15:00] 三篇合观：能力边界、可靠性与 Q&A

- 时间视野合观：research synthesis 任务在 METR 里属 30 分钟-8 小时长任务，当前能力约 **50 分钟**，但**质量可能很差**(50% 成功率)——METR 上的"能做完"不等于经济价值意义上的"做好"。
- 三篇的测量偏差：METR **自动评分、单 agent、不罚错误、无资源约束**；GDPval 任务完全 specified、**one-shot 无迭代**，要求模型自带 **tacit knowledge**；DeepScholar-Bench 补上了检索+综合+验证的缺口。
- 已确认强项：isolated、well-specified 任务；**软件工程与 ML research** 进步最大("我们在自动化自己的工作")；强模型能生成组织很好的输出(尽管局部有错)。
- 低置信区间：需要大量 context 的任务、歧义 prompt、对抗环境、**95% 可靠性**、向软件/知识工作之外泛化、高质量信息源检索+事实核验。
- 两条趋势的张力：METR 每 7 个月翻倍(外推 **2028-2031** 可完成 1 个月级任务)vs GDPval 两年**线性**爬坡且很多任务 win rate 仍低——**需要时长、经济价值、综合质量三类指标并用，且都对照人类验证**。
- Q&A 要点：
  - 长尾最难的例子：**分布式系统**；"前 80% 容易，最后 20% 花了十年"。
  - 讲者(模型研发视角)展望：两年内的事很难预测；**AI scientist**(提出假设→跑实验→闭环)是其 AGI 定义——"AI 能造下一代模型时，我们就不必在场"；当下定位是 **AI co-scientist**；可靠性的长尾最难啃。
  - METR 50% 的语义澄清：**每个任务多次尝试**算出成功率，再在任务间平均，不是"每题都至少 50%"。
  - 职业判断：CS 不会消失，**推理 fundamentals + 给 AI 提供 context** 是关键技能；长尾难题是**数据 + 模型能力**双重缺口(如 robotics 领域整个创业生态押注数据收集)。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Time horizon (METR) | 模型能以 50% 成功率完成的任务所对应的人类专业人士耗时 | METR 论文 |
| SWAA / HCAST / RE-Bench | METR 三任务套件：1-30 秒原子动作 / 1 分钟-30 小时工程任务 / 最长 8 小时 ML 研究任务 | METR 论文 |
| 7 个月翻倍 | 50% 成功率任务时长每 7 个月翻倍：GPT-2 2 秒 → GPT-4 8 分钟 → Claude 3.7 Sonnet 59 分钟 | METR 论文 |
| 50% vs 80% 可靠性鸿沟 | Claude 3.7 在 80% 成功率下只能可靠完成约 15 分钟任务，与 59 分钟差距巨大 | METR 论文 |
| Contractor gap | 内部代码库上无 context 的 contractor 比维护者慢 5-18 倍，模型表现接近 contractor | METR 论文 |
| GDPval win rate | 模型产出与 10+ 年经验行业专家成对比较的胜率(wins / wins+ties 两种口径) | OpenAI GDPval |
| O*NET | 职业任务分类法；GDPval 约 60% 任务选自其中 computer-based 数字任务 | OpenAI GDPval |
| Tacit knowledge | GDPval 任务 one-shot、无迭代，要求模型自带专业背景知识 | OpenAI GDPval |
| DeepScholar-Bench | live 生成式研究综合基准：月更 arXiv 新论文防污染，为论文生成 related work | Stanford |
| Verifiability | 引文是否真支撑论断，分 precision 与 coverage 两侧 | DeepScholar-Bench |

## 自测题(先遮住右侧再答)

1. METR 的 time horizon 指标怎么定义?任务锚是什么?
   > 模型能以 50% 成功率完成的任务所对应的人类专业人士耗时；套件为 SWAA(1-30 秒,66 题)、HCAST(1 分钟-30 小时,97 题)、RE-Bench(最长 8 小时,7 题)，共约 170 题。
2. 时间视野翻倍趋势的关键数字链是什么?
   > 2019 GPT-2 仅 2 秒 → 2023 GPT-4 约 8 分钟 → 2025 Claude 3.7 Sonnet 59 分钟；每 7 个月翻倍，外推 2028-2031 可完成 1 个月级任务。
3. 50% 与 80% 成功率的差距说明了什么?
   > Claude 3.7 在 50% 口径是 59 分钟，80% 口径只剩约 15 分钟——高可靠要求下可用时长骤降，可靠性是当前最大的 headroom。
4. METR 关于 contractor 的发现是什么，隐喻什么?
   > 内部代码库任务上，无 context 的 contractor 比代码维护者慢 5-18 倍，模型表现接近 contractor——模型是"聪明但零上下文的人"，不会自己获取 context。
5. GDPval 怎么构造、怎么打分?
   > 9 行业(GDP top 5%)、44 职业、约 2020 道真实任务(220 题公开于 HuggingFace)；按与 10+ 年经验专家成对比较的 win rate 打分；89% 任务经专家核验 well-specified。
6. GDPval 与 METR 的趋势形状有何不同?
   > GDPval 从 GPT-4o 12.4%(2024)爬到 Claude Opus 4.1 47.6%，近似线性；METR 是每 7 个月翻倍的指数趋势——两者度量维度不同，不能直接互推。
7. GDPval 最常见的失败模式是什么?
   > instruction following：声称查了参考文件实际没看、用幻觉覆盖参考数据、格式错误；GPT-5 这类错误最少。
8. DeepScholar-Bench 的三个评估轴与最刺眼的结果?
   > knowledge synthesis / retrieval quality / verifiability；所有现有系统总分不到 19%,document importance <12.5%，喂完美文献也只有约 50% 关键事实覆盖率。
