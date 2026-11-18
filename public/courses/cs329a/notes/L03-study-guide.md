# CS329A Lecture 3 学习笔记：Robust Verification

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配合视频 `lectures/…[p7TdPUcPoik].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L03-transcript.md](L03-transcript.md)

---

## 一句话概览

本讲用四篇论文(2021→2025)走完验证方法的演进：**训练 token 级 verifier 选答案**(GSM8K)→ **过程监督 PRM**(Let's Verify Step by Step,PRM800K)→ **无人工标注的自动步骤标注**(Math-Shepherd,兼做 RL 奖励)→ **不训新 verifier、用弱监督聚合现成验证器集成**(Weaver,蒸馏后省 99% 测试计算)——主线是缩小 generation-verification gap。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 本讲定位与 Paper 1 开场：GSM8K 与「训练 verifier」

- 承接 L02：repeated sampling 等测试时扩展让模型「能生成」正确答案，但如何**自动选出**正确答案、或在生成过程中引导模型，是本讲的 verification 主题。
- 四篇论文展示验证方法的**逐年演进**：2021 训练 verifier → 2023 过程监督 → 2023 无标注自动标注 → 2025 弱验证器集成。
- Paper 1：Training Verifiers to Solve Math Word Problems(OpenAI 2021)。动机：LLM 幻觉、会**自信地给出错误解法**——讲者点评「四年后依然如此」。
- 副产品 **GSM8K**：8,500 道小学数学题，设计强调**多步推理**(题目不难但需多步才能解出)，解法用自然语言而非纯数学；至今仍是小模型对比评测的常用基准，课程项目选评估集时可考虑。
- 核心思路：训练一个 **verifier**，输出「该解法正确」的概率——类比人做题时希望有一张判断对错的评估表。
- 标签构造：每题采 **100 个解**，与人工确认的最终答案(一次性离线定的 ground truth)比对，打 correct/incorrect 标签。

### [0:05–0:10] Verifier 的架构、双损失与测试时用法

- 测试时：生成大量候选解 → 用 verifier 打 log-prob 分 → 取**最高分**的解作为最终答案。
- **双损失**：二分类损失 + 普通语言建模的下一 token 预测损失；论文称两者结合有帮助。
- 架构：verifier 本身也是语言模型，加一个小**标量头**，对解法**每个 token** 输出二分类预测；问题(question)部分的 token 被**屏蔽**，不参与优化。
- 训练配方：生成器先微调 **2 epochs** → 每题采 100 解打标 → verifier 训 **1 epoch**。(讲者注:如今模型指令跟随已很强,新 verifier 或可跳过预先 SFT 直接训。)
- 标签粒度变体：**句子级**(每句末判断该步是否正确)或 **token 级**(噪声很大,期望每个 token 都沿向正确解法)。
- token 级打分的测试时用法：**取最后一个 token 的分数**代表整个解法——最终只需一个 yes/no。

### [0:10–0:20] Paper 1 结果与讨论：SFT 对比、规模权衡、400 样本饱和

- 例示：正确解的逐 token 分数中间偏低、结尾转绿(高分)；错误解中途转红，最后 token 为红 → 判负，与真实标签一致。
- 对比基线是直接 SFT:**6B 与 175B(GPT-3)**上，verifier 训练集越大，verification 越胜过 SFT;175B 训练集 **小于 1000 条**时 checker 帮助不大。
- verifier 的独特价值：**不动基座模型**——generator 保持通用，checker 可独立更换与引导；数据极多时两条路线大概收敛。
- 有趣实验(讲者建议可做课程项目)：**大 generator + 小 verifier 优于小 generator + 大 verifier**；直觉是生成(平均)比验证更难；最优配比是开放问题，如今 Hugging Face 上有 reward model 排行榜可测。
- 测试时扩展：**约 400 样本前 checker 增益显著，之后失效**(800 时相邻解分不开)；发布版实际停在 **100 样本**——收益大头已拿到且可复现。
- 呼应 L02:majority voting 在 **10–50 样本**后就追不上 coverage，而这里 checker 到 400 仍有效——差距即 generation-verification gap。
- 400 后下降的解释：不是覆盖问题，而是 verifier 在**相近解之间的区分精度**下降。

### [0:20–0:25] Paper 2:Let's Verify Step by Step——ORM vs PRM

- 时隔不到两年，OpenAI 面对同一问题：幻觉；一步走错就会**带偏整条解法**。
- 两类奖励模型：**ORM**(outcome-based reward model,给整个解法一个奖励,即上一篇文章的做法)vs **PRM**(process-based reward model,每一步各得一个奖励)。
- 训练数据差异：ORM 用最终答案 vs ground truth 打标即可；**PRM 需要人工标注员逐步走查**模型生成、给每步打分。
- PRM 的解法总分 = 各步奖励的**乘积**；测试时可对每步跑 PRM、乘出质量分，据此决定**采纳还是重试**——这就是 **process supervision**。
- PRM 是更精细的 **credit assignment**：把功劳/过错分到具体步骤，而非只看输出。
- 关键性质：process supervision 更能应对 **false positive**——模型可能「过程错但碰巧答案对」，ORM 只看结果会放过；PRM 逐步打分则不易漏。
- 顺带鼓励**可解释**的推理与经人审批的求解过程(标签本身来自人)。

### [0:25–0:30] PRM800K、convincing false responses 与 PRM 胜出的实验

- 产出开源数据集 **PRM800K**:**800,000** 条步级标签；每步标签为 positive / negative / neutral。
- 数据收集技巧：优先挑「**convincing false responses**」(最终答案对、中间步骤错的样本)给人标注，比随机采样**节省 2.6 倍**数据。
- 迭代改进：从简单 PRM 起步(甚至可以让 LLM 直接判某一步)→ 收数据 → 训 PRM → 提升数据质量，循环推进。
- 标注示例：分数问题前 5 步都对，最后一步计算错(X 应为 14 却写成别的)→ 该步标 incorrect。
- 底模 **GPT-4**：先做监督微调，再分别训 ORM / PRM；ORM 取 completion 最后 token 的分数，PRM 取各步概率的乘积。
- 结果：**PRM > ORM > majority voting**;majority voting 在约 **100 样本**后失效；PRM 能在正确解占比 **<5%** 的样本分布里挑出稀有正确解。

### [0:30–0:35] PRM 的泛化性、数据效率与 hacking 风险

- 数据效率：PRM 更省标签——每题 100 条 ORM 标注的数据预算 ≈ 每题 **1 条** PRM 标注；两者都随标签增多而变好，但 PRM 斜率更优。
- **泛化**：换到新域/新数据集时，ORM 泛化不如 majority voting，而 **PRM 全面最好**、可容忍更大的分布偏移。
- Q&A 风险一：PRM 可能给「看起来好但并不贡献答案」的步**错误记功**；近年做法常将 **PRM 与 ORM 结合**；PRM 的判定阈值是新增的**超参数**，需要调优。
- Q&A 风险二(reward hacking)：若用 PRM 做 RL 微调生成器，模型可能**跳步直接写答案**骗分；本讲的生成器**不被改动**，始终可要求它写步骤，人工标注也会惩罚跳步(「直接 x=14 没有意义」)。
- 成本记账：ORM 每题需 K 条标注，PRM 每题需 K×步数(步数难精确控制,论文尝试了对齐比较)。
- 术语澄清：majority voting = 不用任何 reward model，取**最终答案重复最多**的那个解。

### [0:35–0:45] Paper 3:Math-Shepherd——无人工标注的步骤自动标注

- 动机：更强 PRM 有潜力改进推理(尤其配合测试时扩展)，但**人工标注太贵**；Math-Shepherd(转写为 "Matt Shepard")把标签收集自动化。
- 两条线：①**自动标注**步骤质量；②把 reward model 经 **RL** 接入生成器优化循环(本讲简提)。
- 步骤质量定义：该步**到达正确最终答案的潜力**——从这一步出发采 n 条补全，看最终对错。
- **Strict estimation**:n 条补全**任一**到达正确答案 → 该步记 1;**Soft estimation**：取到达正确答案的**比例**(例:n=3 时 step 1 的 strict=1、soft=2/3)。
- 已知缺陷(课堂讨论)：罕见解法路径在 n=3 下看不见(n=100 才能暴露,却被记 0)；难题可能采不出任何信号；**中间错但终点对的轨迹仍被标对**(期望更多采样能暴露错误,但无保证)。
- 用法：采样-重采候选解 → PRM 打分 → 选最高分；再把 PRM 当 **RL 的奖励模型**微调生成器，鼓励它产出 PRM 打高分的步骤。
- n 的消融：n 增大时 soft 略优，但 **n=4** 收集标签已拿到最好结果，最终选 **strict**(更好测)。
- 结果(全程零人工标注):**SC(self-consistency,即 majority voting)< ORM < Math-Shepherd PRM**；在更难的 **MATH** 上还超过了用 PRM800K 训的方法，delta 更大。

### [0:45–0:50] Math-Shepherd 的 RL 用法与课堂讨论

- 跨模型验证：在 GSM8K 与 MATH 500 题上，相对 SC 基线的增益在 **Llama 70B、DeepSeek 67B** 等不同模型上都成立。
- RL 对比：用 PRM 做 PPO 的奖励显著优于只用 ORM；delta 略低于纯测试时扩展，但这是**另一条自我改进**路径——模型自生标注 → 训 PRM → 测试时与 RL 两头改进生成器。
- 限制：RL 优化会在某处**趋平(plateau)**；RL 之后的评估在 256 个输出上跑 verifier。
- Q&A(自我纠错)：可给模型一套 **rubric/规则**给步骤打分作额外信号，或让它调用**计算器/工具**核验计算——工具与 agent 式手段可增强验证过程。
- Q&A(算力分配)：测试时算力如何在「生成侧采样」与「验证侧采样」之间分配是开放问题；公平比较 ORM/PRM 需要**同一份训练数据**。

### [0:50–1:00:00] Paper 4:Weaver——弱验证器集成与弱监督聚合

- Paper 4:Shrinking the Generation-Verification Gap with Weak Verifiers(Stanford,2025)。换思路：**不训新 verifier**，而是用推理算力把**现成 verifier 集成**起来缩小 gap。
- 「弱」的含义：没有 verifier 是完美的——用的是**现有最好的** checker(并非故意选差的)；弱验证器与真标签相关但各有缺陷。
- 第三类 verifier：**LLM-as-judge**——直接让 LLM 看答案判对错，可配合工具与 rubric 产分；与 PRM/ORM 并列可用。
- 集成来源：不同实验室、不同数据集训练的 verifier 与 LM judge，各自对 query 输出分数。
- 朴素集成(直接平均)有效但**不单调**；给每个 checker 学一个权重(naive baseline / logistic regression)更好——用少量带标签数据拟合权重，再用于新测试数据。
- Weaver 管线：①各 verifier 打分并**归一化**到同一尺度；②**过滤**低于质量门槛的 verifier(讲者强调这一步很关键)；③用**弱监督**以极少标注估计各 verifier 准确率并加权合并出总分。
- 弱监督脉络：受 **Snorkel**(Alex Ratner 等,Stanford)启发——多路弱信号合成一个强信号。
- 问题设定：n 个 query × 每题 k 个解 × m 个 verifier = **n·k·m** 个标签；目标是估计 P(query i 的解 j 正确 | 所有标签)。
- 核心假设：**每个 verifier 捕捉正确性的一个独立侧面**——全体一致的评分不含新信息，信号来自 verifier 之间的**分歧**；由「条件独立假设 + 概率基本公式」两组方程写出优化，解出各 checker 权重；在 **GPQA Diamond、MMLU-Pro、MATH** 等本来就难的基准上收益最大(基线弱)。

### [1:00:00–1:12:00] Weaver 结果：验证算力标度、weak-to-strong、蒸馏与 recap

- 验证算力的扩展维度：采更多解(10→100→1000)、用更大的生成/验证模型、**扩大 verifier 池**——推理 flops 可以分配到不同环节。
- 对比链条：Pass@k oracle(虚线上界)> 有监督学权重(大量标签)> 无监督(仅 1% 标签)> 朴素集成；全部显著好于 **majority voting** 与 **MAV**(multi-agent verification:prompt 多个 LLM 按多方面 rubric 给解打分,实测比 majority voting 还差)。
- 难题上从 **约 40% 提到 70% 以上**，对应 **o3-mini** 一级；这里报告的是**整系统的最终答案准确率**，不是 coverage。
- **Weak-to-strong**：Llama 3.1 8B-Instruct 生成器 + 全部 **≤8B** 的验证器组，平均 **约 70%**，几乎追平 70B 类模型仅靠 majority voting 的水平；把同法用于 **70B 类**达平均 **86.2%**，与专有的 **o3-mini** 相当——验证侧的推理扩展能把小模型系统抬进大模型区间。
- 工程问题：集成要对每个解跑整个 verifier 池(×100 采样时更贵)→ 把训好的 Weaver **蒸馏**成约 **400M** 的小模型(原池为 70B 级)，保住集成 **97%** 的精度、测试时**省 99%** 计算；蒸馏版与原版 checkpoint 均开源。
- 效率曲线：蒸馏版(浅蓝)大幅更高效；原版 Weaver 在高精度区间也比朴素集成与 majority voting 更省算力。
- Recap(四篇四年)：验证同时改善**训练与推理**两端的产出质量；process rewards 优于 outcome rewards 但最好**两者结合**；verifier 数据越多越有效，并可用于 RL 微调生成器；Weaver 用「加入更多 verifier」实现另一种测试时扩展，且可蒸馏。
- 尾部 Q&A：验证不止数学——**编码**同样适用，如 CodeMonkeys 让模型在测试时生成**单元测试**充当 verifier；reasoning model 内在已用测试时扩展生成 RL 正轨迹，但仍能靠更多采样探索解空间；理想终态是「一次答对」，但过度收紧可能牺牲**创造力与解法多样性**；模型评自己的生成通常比异族 verifier 好，同族/异族、同尺寸/异尺寸的系统研究仍空缺。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Generation–verification gap | 能生成正确答案 ≠ 能自动选对答案；本讲全部方法都在缩小它 | L02 提出，本讲主线 |
| Verifier(2021 方案) | LM+小标量头，逐 token 输出解法正确概率；测试取最后 token 分 | Cobbe et al. 2021 |
| GSM8K | 8,500 道小学数学题；多步推理 + 自然语言解法 | Cobbe et al. 2021 |
| 双损失训练 | 二分类损失 + LM 下一 token 损失联合训练 verifier | Cobbe et al. 2021 |
| Generator–verifier 权衡 | 大 generator + 小 verifier 优于反向；最优配比开放 | Cobbe et al. 2021 |
| ORM / PRM | 整条解法一个奖励 vs 每步一个奖励(总分 = 各步乘积) | Lightman et al. 2023 |
| PRM800K | 800K 步级人工标注，开源 | Lightman et al. 2023 |
| Convincing false responses | 优先标「答案对步骤错」的样本，数据效率 2.6× | Lightman et al. 2023 |
| Process supervision 抗假阳性 | 逐步打分，不易放过「过程错但答案对」 | Lightman et al. 2023 |
| Strict / soft estimation | 步骤后 n 条补全任一对 = 1 vs 对的比例 | Math-Shepherd |
| Math-Shepherd | 模型自标步骤质量，PRM 用于重排 + RL 奖励，零人工 | Wang et al. 2023 |
| LLM-as-judge | 直接让 LLM(可带工具/rubric)给答案打分 | Weaver 前置讨论 |
| MAV | 多智能体验证：多 LLM 按 rubric 打分；实测不如 majority voting | Weaver 论文 |
| Weaver | 弱验证器集成：归一化 → 过滤 → 弱监督学权重聚合 | Stanford 2025 |
| 条件独立性假设 | 每个 verifier 捕捉正确性的独立侧面；信号来自分歧 | Weaver |
| Weak-to-strong | 8B 生成器 + ≤8B 验证器组 ≈70%;70B 类 86.2% ≈ o3-mini | Weaver |
| Weaver 蒸馏 | 400M 模型保留集成 97% 精度、省 99% 测试计算 | Weaver |

## 自测题(先遮住右侧再答)

1. GSM8K 数据集的规模与设计重点是什么?Paper 1 的 verifier 训练标签如何构造?
   > 8,500 道小学数学题，强调多步推理 + 自然语言解法；每题采 100 个解，与人工确认的最终答案比对打 correct/incorrect 标签。
2. Paper 1 的 verifier 架构与损失设计?测试时如何从逐 token 预测得到整解法判定?
   > 语言模型 + 小标量头逐 token 二分类，损失 = 二分类损失 + LM 下一 token 预测损失(问题 token 屏蔽)；取最后一个 token 的分数代表整个解法。
3. verifier 与直接 SFT 的对比结论?verifier 路线的独特好处是什么?
   > verifier 训练集够大时在 6B/175B 上都胜过 SFT，175B 训练集小于 1000 条时帮助不大；好处是基座模型保持通用，checker 可独立更换与引导。
4. generator 与 verifier 谁该更大?checker 的采样增益在多少样本后失效?
   > 大 generator + 小 verifier 更好(生成平均比验证难);checker 增益约 400 样本后失效(800 时分不开相近解)，发布版用 100;majority voting 10–50 样本就失效。
5. ORM 与 PRM 的区别?PRM800K 怎么来的、收集时用什么技巧提效多少?
   > ORM 给整解法一个分，PRM 每步打分、总分 = 各步乘积；PRM800K = 80 万步级人工标注；优先挑「convincing false responses」(答案对步骤错)标注，节省 2.6 倍数据。
6. PRM 相比 ORM 的两大优势?若把 PRM 用进 RL 训练生成器要防什么?
   > 更能应对 false positive(过程错答案对)且更省标签、泛化更好(优于 majority voting 与 ORM)；要防 reward hacking——模型跳步直接写答案骗分，PRM 阈值也是新增超参。
7. Math-Shepherd 的 strict 与 soft estimation 分别是什么?最后为何选 strict?
   > strict = 该步之后 n 条补全任一到达正确答案记 1；soft = 到达比例(n=3 时 step 1 的 strict=1、soft=2/3)；n=4 时两者结果已差不多，选 strict 因为更好测。
8. Weaver 的三步管线与核心假设?weak-to-strong 的关键数字?
   > 归一化分数 → 过滤低质 verifier → 弱监督学权重聚合(核心假设:每个 verifier 捕捉正确性的独立侧面,信号来自分歧)；8B 生成器 + ≤8B 验证器组约 70%，70B 类 86.2% ≈ o3-mini，蒸馏到 400M 保 97% 精度省 99% 计算。

---

*Generated from lecture transcript via deep-reader pipeline, 2026-11-18.*

