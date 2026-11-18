# CS329A Lecture 9 学习笔记：Future Research Areas

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配合视频 `lectures/L09-future-research [AyO6wyu4DEg].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L09-transcript.md](L09-transcript.md)

---

## 一句话概览

收官讲：先复盘全课程主线，再以三篇论文点出 self-improvement loop 的三大瓶颈——推理链**多样性**(多智能体微调)、**验证瓶颈**(DeepSeek-Math V2 的 meta-verification)、**训练数据瓶颈**(Absolute Zero 自提任务)；后半由 Azalia 用 **intelligence per watt** 视角讨论智能的效率侧：本地推理崛起与混合 serving 的未来。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 全课程回顾与本讲定位

- 课程主线回顾：LLM 概览 → **test-time scaling**(多采样 + majority voting)→ **train-time scaling**(跑 verifier 拿 reward,用 RL 甚至搜索算法在 math/coding 上爬山)→ evolutionary strategies / **open-endedness**(Alpha Evolve,在可定义的探索空间里自由探索)→ 工具调用搭端到端 agent 工作流 → 多步任务引入 retrieval 与 memory → planning 与多步推理 → 下一代模型评估 → 客座讲座(post-training、多模态 agent、机器人、reasoning、symbolic 技术补充合成数据)。
- **Agent 是 LLM 的泛化**：有目标，与环境交互、收集反馈、用反馈纠错——能自己引导流程、使用工具、达成目标的系统。
- 现状：LLM 单打独斗还不够驱动完整目标，常需**手写工作流**编排 LLM + verifier(LLM-as-judge)+ 工具调用 + 搜索算法(含并行 LLM 调用)；coding agent 已开始部分自主驱动这类工作流。
- 工作流要朝目标推进，就需要**规划、多步推理、纠错、持续自我提升**——self-improvement 的由来。
- 本讲组织：前半(Aakanksha)讲三篇 self-improvement 论文的关键思想，后半(Azalia)讲 **efficiency for intelligence**；领域移动太快，「也许下次开课每个方向都能讲一篇新论文」。

### [0:05–0:10] 三大研究缺口；论文一：多智能体微调的动机

- 缺口一 **推理链多样性**：test/train-time scaling 仍限于 math/coding 等窄域；推理链要足够多样才能持续驱动 self-improvement loop，如何泛化到其他域是重要研究方向。
- 缺口二 **验证**：self-improvement loop 的关键环节是验证；需要 robust 的 verification / **meta-verification** 技术，审查进入推理链的内容本身是否可靠。
- 缺口三 **数据瓶颈**：训练用 prompt 目前**静态选取、靠人挑**；要打破 human data 依赖，让 loop 自己挑对数据。
- 论文一动机：pre-training 是互联网规模数据的压缩，instruction tuning 又依赖人类偏好标注；替代路径是 **LLM 合成数据 + 迭代微调**：**rejection sampling**——生成候选解、过滤错误的、只对好的做 SFT(STaR 及其变体,可再加推理链)。
- 单模型痛点：同一个 LLM 生成的解高度相似，**即使高温采样也不够多样**，几十轮迭代后性能提升停滞；对比之下 pre-training 数据因人类长期积累而天然多样——解法直觉是多 agent、各有所长。

### [0:10–0:15] 多智能体微调：debate 机制与实验结果

- 方案：训练多个**专门化 generation agent**(同一 base model 微调)产出多样化初始解；**critic agent** 评估并精炼。
- 多轮 debate 流程：各 generation agent 给初始答案 → **汇总所有 agent 的回答**(模型总结或直接拼接)→ critic 对更新后的答案集做 critique → 汇总回填输入 → 所有模型再生成、再 majority voting、再总结，循环往复。
- 多 agent 结构 = **免费的 majority voting**；只要各 agent 训练得略有差异，多样性也免费。朴素替代(**poor man's version**)：直接用不同模型、不同 prompt 生成。
- Critic 微调数据：混合「一开始就对」与「经辩论才纠正」的轨迹，让 critic 学会**对比正确与错误答案**。
- 结果(x 轴 = 微调迭代数;y 轴 = negative log likelihood 作性能代理,或 embedding dissimilarity 作多样性)：两个开源模型多轮微调性能持续上升(**Llama 3** 对该技术响应更明显)，且回复多样性全程保持(数学数据集)。
- 三个开源模型、数学域：多 agent 微调持续提升，**单 agent 微调的 accuracy 崩掉或不继续提升**；相邻域 **GSM8K** 上微调后的 agent 同样更高——**泛化到训练域之外**。
- 技术细节：因为走的是微调路线，实验只能选开源模型。
- 启示：要 self-improvement，喂给模型的推理链必须多样；多模型 / 多 agent 生成是制造多样性的一条路。

### [0:15–0:20] 论文二：DeepSeek-Math V2 与 meta-verification

- 背景问题：RL 按最终答案是否对上 ground truth 给 reward(**outcome reward model**)，已让 AIME 等数学 benchmark 饱和；但**答案对、推理错**很常见；定理证明需要严格的 step-by-step derivation，最终答案给不了。
- **Process reward model 很难建**——这正是 outcome reward 盛行的原因；DeepSeek-Math V2 想证明的是：定理证明域可以做出自动化的自验证闭环。
- LLM 训练偏重定量推理，生成的证明常**数学上无效**；让它自查时，它会把无效证明判为有效——**LLM-as-judge 在此失效**；专家人类则能看出「下一步推不出上一步」的推理断层。
- 做法：让人类**在无参考解的情况下**指出证明问题 → 据此训练 LLM 找问题、改进证明，得到能 critique 证明本身的模型；再加一层 **meta-verifier** 审查 verifier 的分析是否成立。
- 架构：generator 产证明 → verifier 按 **0.5–1 刻度**给证明打分 → meta-verifier 审查 verifier 指出的问题是否站得住 → verifier 反过来改进 generator，generator 产出更难的证明又反过来改进 verifier——闭环。
- 种子数据就位后，问题标注可以**自动化**，不必一直靠人找证明错误。
- **Meta-verification 的意义**：verifier 可能在推理链错误时仍给对分(**fabricated errors**)；meta-verifier 检查「指出的问题是否真实存在、评分是否由问题推出」，即评估 verifier 干得好不好，再由专家标注该评估的质量——只加这一块，质量就提升。

### [0:20–0:25] DSM-V2 结果；论文三动机：打破数据瓶颈

- 结果：基于 **DeepSeek V3 base**、GRPO 式 RL 循环；在 **IMO 与 CNML** 上验证(Gemini 版此前客座讲师讲过,这是开源版);8 轮迭代 **pass@1** proof score 持续攀升；**best@32**(32 个证明里挑最好)在 **IMO 2024 shortlist** 上接近 **42%** proof score。
- 启示：最好的证明拿到更高验证分；generator 学会区分高质量与有缺陷证明；**验证可以是瓶颈，meta-verification 是破局方式**——但该方法仍限于验证较容易的域。
- 推广配方：①让 LLM verifier **无参考解找问题**;②加 meta-verification 降低 verifier 幻觉问题的概率；③给 generator 施加激励，用 deliberate reasoning 最大化回答质量。
- 论文三动机：SFT 靠人类整理的推理轨迹，RLVR 要专家出题——数学要数学专家、IMO 题要 IMO 专家、代码要强工程师；模型逼近并超过人类智能时，**找专家越来越难**，成为限制。
- 激进解法：单一模型**既 propose 任务又 solve 任务**，几乎不需要外部人类 prompt；论文选 **coding** 域(可执行验证)，奖励机制先选任务再解任务，对模型做联合更新而非单侧更新。
- 提案的目标是让任务落在模型**当前能力的边缘**(已学的边界处)，随能力增长持续向外推。

### [0:25–0:30] Absolute Zero：三类自提任务与难度奖励

- 三类任务(基于代码范式)：**deduction**——生成程序 + 输入，环境执行得输出；**abduction**——与 deduction 类似，生成程序与输入、由环境计算输出；**induction**——采样已有程序，为其生成新输入 + 描述函数的自然语言，环境执行以判断方向是否正确。
- Proposer **conditioned on 过往生成的样例**(显式放进 prompt)以促进多样性。
- 任务选择靠**难度奖励**：solver 成功率为 0 → reward 0；非 0 → **1 − 平均成功率**；于是选中的是「不平凡也不不可能」的**中等难度**任务——solver 有时成功有时失败，最利于学习。
- 模型变强，proposer 学会出更难的题——**随时间演化的 curriculum learning**。
- 防任务造假：代码域可执行**程序完整性**检查(直接跑一遍看报错)、安全检查、多次运行输出一致性(确定性)，任务进训练管线前先验证。
- 维护**任务 buffer**：存(输入、输出、程序)三元组 + 成败统计，proposer 从中采样参考。

### [0:30–0:35] 收获与共性：合成数据飞轮(SWiRL 呼应)

- 结果：prompt 侧零人工数据，拿到 coding benchmark **SOTA**，胜过用**数万专家样本**训练的模型；只在自产代码任务上爬山，却在**数学 benchmark 上也强**(意外,但可用领域已有结果解释)；**大模型收益更大**。
- 涌现行为：复杂度指标随时间上升；循环设对时，程序与答案的**多样性也在改善**；proposer 出题难度持续上升。
- 气质：**game theory**——proposer 与 solver 略微对抗，但整体互相成就；解的是「该拿什么任务训练模型」的瓶颈。
- 定位：人类能生成的 coding 数据终究有限，后期必然靠合成数据；这篇工作相当于**合成数据的 task 级变体**——在训练 loop 内、任务粒度上即时生成。
- Azalia 用 **SWiRL**(step-by-step RL with synthetic data)呼应同一趋势：模型自产合成数据不仅提升生成它的那个任务，还**迁移**到别的能力(多跳 QA + 检索 → 更会调 Python、解数学,反之亦然)；同样观察到**大模型更擅长吸收 data flywheel 并泛化**(至少在 RL 优化侧)。
- Aakanksha 三条收束：①真泛化需要推理链多样性(如何制造仍是开放问题)；②验证要去人类瓶颈——reward model 难建，越不被人类专家卡住越好；③训练数据选择要去人类瓶颈。
- Azalia 补充的研究方向：在可验证域极限 self-improve、喂回多样可验证任务，能否让能力**外溢**到没有自动验证的域、省掉其标注数据?(计算极重的实验)

### [0:35–0:40] 课堂讨论：非可验证域怎么办

- 起因是学生提问：哪些 AI 应用不落在可验证问题里?
- 两类**非可验证域**：①验证**慢**——芯片设计的仿真要跑几天才出一个 reward 信号，化学实验要进 wet lab；②**主观/创造性**——创意写作难以设计 reward function，建模稍有偏差就 **reward hacking**。
- 时标论证：test-time scaling 要求 verifier 接近即时(顶多等几分钟到 1 小时)；RL 训练要成百上千步迭代，**等不了几天**，也难靠人在环收集 reward。
- 应对路径(答学生问)：离线收集大量仿真/实验数据，训练**单独的 reward model 预测结果**，在 RL loop 中充当代理验证对象；但泛化性取决于数据量，预测不准会引入新问题。
- Stanford **KernelBench** 例子(讲者实验室)：简单 kernel 有 compiler execution 可验证；更难的是把 kernel 拼接后**读性能 profile**、定位未优化代码段——模型能力不够时，实际做法是把问题**分解**成子问题 + 参考解/知识库(正是一个 class project 在做的事)。

### [0:40–0:50] Intelligence per Watt：推理需求洪流与本地模型崛起(Azalia)

- 转场：self-improvement 意味着大量 inference,**智能有成本**;Azalia 讲效率(与 Professor Ray、John Hennessy 等合作的近期工作,看模型侧与硬件加速器侧趋势,推演未来 AI inference 的负载形态与所需加速器)。
- 现在是 **mainframe era**：ChatGPT/Gemini 级模型全在云端跑；闭源模型拿不到权重，大的开源模型本地也跑不动。
- 算力需求爆炸：Google Cloud 计算 serving 约 **1200x**(过去 12-20 个月)、NVIDIA **10x** 年同比；要服务当前需求约需 **250 GW** 数据中心；Google 处理 token 从去年 2 月 **160 trillion** 到今年 10 月 **1.3 quadrillion**——史上最快的算力需求增长。
- 负载侧：大规模 ChatGPT 用户数据集显示约 **77%** 请求是实用指导/信息获取/写作类，**不需要最强 frontier model**，小的本地模型就能答对；query 会越来越复杂，但大多数仍停留在简单侧。
- 硬件侧：2012 年以来本地加速器 GPU 内存 **126x** 提升；MacBook 已可配约 **100 GB** 内存，int8 量化下能本地装下最大的那批模型。
- 新指标 **intelligence per watt(IPW)**：平均任务准确率 ÷ 解决任务的平均功耗；capability 侧看模型可解决 query 的比例(单轮与推理类)，本地模型此处指 **≤20B active parameters**；efficiency 侧看本地硬件每瓦换到的有效计算。
- 实验规模：>20 个本地模型(GPTQ 量化、llama 3 等)、企业级与本地加速器都测、**100 万条 query**(ChatGPT 数据 + Natural Reasoning、MMLU Pro、SuperGPQA)，指标覆盖 accuracy/energy/latency/compute；数据**开源**。

### [0:50–1:05:00] 开放研究方向、Q&A 与课程收尾

- 核心发现：本地模型 2023 年以来可解 query 比例 **3.1x**(仅两年)，当前覆盖约 **88.7%**；IPW 两年提升 **5.3x**——**3.1x 来自模型进步、1.7x 来自硬件进步**；但 Apple M4 Max 的 IPW 仍比 **B200 低 1.5x**(企业芯片专为 LM 工作负载优化,本地芯片设计时没预设 LLM 本地跑)→ 更多流量将转向 edge(笔记本/手机)。
- 开放方向①：test-time scaling 与 **synthetic data flywheel** 的**基础原理**——为什么反复问同一问题，正确答案会涌现?把成功轨迹 distill 回模型的最佳实践是什么?由此自然衔接 continual learning。
- 开放方向② **continual learning**：人类越学越强是连续过程，模型却是离线的「攒经验 → 微调」两段式；要把正负经验更自然地回灌模型，替代当前异步的数据生成 + 微调范式。
- 开放方向③：**高吞吐低延迟 test-time scaling 的系统 infra**——重复采样、回改生成、工具调用与单轮聊天完全不同，系统与推理优化机会大；她实验室的 **Hydrogen、Tokamak** 类工作会越来越重要。
- 开放方向④⑤⑥：**hybrid serving**(按需在本地与云端模型/加速器之间平滑路由流量)、面向本地加速器的**节能推理**新架构与 kernel、把**能源**当作最宝贵资源(IPW 类能耗指标主流化)。
- 讲者坦承：本课程对 **pre-training** 着墨很少(Aakanksha 本人是 pre-training 专家)，重心放在 post-training 与 test-time scaling;fine-tuning、在线学习与 test-time scaling 交界处的 synthetic data flywheel + continual learning 是尚未解决的新地带。
- Q&A(continual learning 落点 + 记忆库 vs 权重)：第一步是让模型在多步推理中**从成败中学习、把技能留在权重里**(「学会学习」是当前不具备的能力,如看视频学会做事而非靠大量任务示范)；理想解是 infinite context——但现实中 1M+ 上下文时 ICL 推理能力已明显衰减；**cartridge**(课程讲过)不改权重、把知识装进 KV cache，是免微调做长期记忆的另一条路。知识库类信息改外挂数据库即可，但**跨域推理的技能迁移**(如周一讲的机器人 cross-embodiment 泛化)外挂记忆做不到，**必须更新权重**。
- Q&A(自建环境)：Absolute Zero 式环境的意义在**作为真实世界任务的 proxy**；游戏是有限空间容易用代码仿真；用 agent 建还是用软件建都好办，关键是能否合理代表模型与真实世界交互取反馈的方式。
- 收尾：领域演化极快——「现在教的内容，下次开课就成了历史」，但**基础技术长期有效**，新东西仍建立在基础技术之上；两位讲者感谢学生，课程本身也是边教边学，希望大家把方法带进自己的研究与工作。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| 多智能体微调 | 多个 generation agent 出多样化解 + critic agent 辩论精炼，让 rejection sampling 微调多轮不饱和 | 论文一，多智能体微调 |
| Rejection sampling | 生成候选解 → 过滤错误 → 只对正确样本做 SFT 的迭代自提升套路 | 课程已讲，论文一沿用 |
| Meta-verification | 在 verifier 之上再校验：它指出的问题是否真实存在、评分是否由问题推出 | DeepSeek-Math V2 |
| Outcome reward model | 只对比最终答案与 ground truth 的奖励；答案对推理错时失效 | 验证课回顾，DSM-V2 动机 |
| Absolute Zero | 单模型自提任务 + 自解任务、零人类 prompt 数据的自我博弈 RL 框架(coding 域) | 论文三 |
| 任务难度奖励 | solver 成功率 0 得 0 分、非 0 得 1−成功率，自动选中中等难度任务，形成 evolving curriculum | Absolute Zero |
| Synthetic data flywheel | 模型自产数据 → 训练 → 更强的自增强循环；能力可迁移到相邻任务(SWiRL 呼应) | Azalia 总结段 |
| SWiRL | step-by-step RL with synthetic data：自产合成数据做 RL，提升可迁移到工具调用、数学等相邻能力 | 课程已讲，本讲呼应 |
| Mainframe era | 现状比喻：大模型全跑云端机房、用户端只是终端，对应大型机时代 | Azalia 效率部分 |
| 非可验证域 | 验证太慢(芯片仿真、湿实验)或太主观(创意写作)而无法即时给 reward 的领域 | 课堂讨论 |
| Intelligence per watt(IPW) | 平均任务准确率 ÷ 平均功耗；本讲「本地模型」= ≤20B active parameters | Azalia 效率部分 |
| GRPO | 多数 RL 自提升循环所构建的基础 RL 算法；DSM-V2 即基于 DeepSeek V3 base + GRPO 式循环 | 验证课回顾，DSM-V2 |
| Cartridge | 不改权重、把长上下文知识装进 KV cache 的 in-context learning 方案，可作免微调的长期记忆 | 课程已讲， continual learning Q&A |
| Continual learning | 让模型在运行中持续从成败经验学习，替代离线异步微调范式 | 开放方向 |
| Hybrid serving | 按任务需要在本地与云端模型/加速器之间平滑路由推理流量的服务引擎 | 未来方向 |

## 自测题(先遮住右侧再答)

1. 单模型 rejection sampling 微调为什么会停滞?多智能体微调如何解决?
   > 单个 LLM 即使高温采样，生成的解也趋同(缺多样性)，几十轮后性能不再涨；多个专门化 generation agent 出多样化初始解 + critic agent 辩论精炼，相当于**免费的 majority voting**；数学域三个开源模型多轮微调持续提升，单 agent 的 accuracy 则崩掉。
2. DeepSeek-Math V2 为什么要引入 meta-verifier?它审查什么?
   > LLM 训练偏定量推理，会声称数学上无效的证明有效，LLM-as-judge 失效；meta-verifier 审查 verifier 的分析——指出的问题是否真实存在、0.5-1 评分是否有依据，降低幻觉问题，并让问题标注自动化。
3. DeepSeek-Math V2 的成绩数字是什么?方法还剩什么限制?
   > 基于 DeepSeek V3 base + GRPO 式循环，8 轮迭代 pass@1 proof score 持续攀升，best@32 在 IMO 2024 shortlist 接近 42%；但只适用于验证较容易的域。
4. Absolute Zero 的 proposer 如何用奖励实现「选中等难度任务」?
   > solver 成功率为 0 → reward 0；非 0 → 1−平均成功率；于是有时成功有时失败的任务得分最高；模型变强后自动出更难题形成 evolving curriculum，另有执行、安全、确定性校验防垃圾任务。
5. Absolute Zero 只用自产代码任务训练，结果如何?
   > prompt 侧零人工数据拿到 coding benchmark SOTA、胜过数万专家样本训练的模型；数学 benchmark 也意外变强；大模型收益更大。
6. 什么是非可验证域?举两个例子和一种应对方案。
   > 验证太慢(芯片仿真数天、湿实验化学)或太主观(创意写作,稍有偏差即 reward hacking)；应对：离线收集数据训练 reward model 预测仿真/实验结果，充当 RL loop 中的代理验证，但泛化受数据量限制。
7. Intelligence per watt 的定义，以及本讲给出的两组关键数字?
   > 平均任务准确率 ÷ 平均功耗(本地模型 = ≤20B active params)；本地模型两年 query 覆盖 3.1x、当前 88.7%;IPW 两年 5.3x = 模型 3.1x + 硬件 1.7x;Apple M4 Max 仍比 B200 低 1.5x。
8. 讲者如何回答「continual learning 靠外挂记忆库还是更新权重」?
   > 知识库类信息改数据库即可；但跨域推理这类技能迁移(如机器人 cross-embodiment 泛化)外挂记忆做不到，必须更新权重；infinite context 与 cartridge(KV cache)是免微调的另一条长期记忆路线。
