# CS329A Lecture 6 学习笔记：Train-Time Scaling / Scaling RL

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配合视频 `lectures/…[yVnmHSAy3ck].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L06-transcript.md](L06-transcript.md)

---

## 一句话概览

**Train-time scaling = 把模型自己的输出过滤后喂回训练闭环**：本讲沿 **STaR → DeepSeekMath(GRPO)→ DAPO** 三篇论文递进，讲清小模型如何靠自举推理链 + RL 系统工程在 AIME 上反超大参数模型——但只提升一致性(maj@K)，不提升根本能力(pass@K)。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 动机：AIME 上小模型反超大模型

- 课程脉络承接：前几讲是 test-time scaling、feedback/tools/code、robust verification；本讲**闭环**——用验证过的输出反过来改进模型。
- 三篇论文路线图：**STaR**(Stanford 作者，自举推理)、**DeepSeekMath**(数学推理 RL)、**DAPO**(长推理链 RL 稳定化)。
- 为什么换基准：GSM8K/MATH 已饱和且**被大多数模型污染**，改用 AIME 2024/2025(homework 1 同款)。
- AIME 对比：GPT-3.5(据信 175B)约 **5%**;DeepSeekMath 7B(7B!)**51.7%**、加 tricks 约 60%;DAPO + Qwen 32B **50%**。
- 三条核心洞察：①允许模型**从自己的输出中学习**(聪明过滤)可进一步提升；②训练时投入的 compute 可**部分替代参数量**；③RL 的**实现细节**极重要，小 fix 决定成败。
- 三范式定位：pre-training(互联网数据)→ fine-tuning/RLHF(人类偏好数据)→ test-time scaling(majority voting 等纯推理时技术)。

### [0:05–0:15] 闭环定义与思考模型的推理行为

- 本讲最重要的一张图：**test-time scaling 的输出过滤后拿去 fine-tune = train-time scaling**，两者构成闭环；记住这个 loop 就懂了本讲。
- o1 on AIME:train-time compute 与 test-time compute **两条轴都能提升 pass@1**(log-linear 图)。
- 为什么数学有效：**可验证性**——能判断哪个输出正确，才能挑选正确输出喂回训练。
- thinking 模型 CoT 的四种行为模式：**problem analysis**(先弄清输入输出)、**task decomposition**(拆子步骤)、**self-evaluation / backtracking**(发现公式错了换公式重算)、并行尝试多种方法。
- o1 实例：bash 矩阵转置脚本(先分析格式再拆解步骤)、chemistry pH 题(中途意识到公式用错并自纠)。
- win rate over GPT-4o(非 thinking)：编程/数据分析/数学 **>50%**；写作与文本编辑提升很小——**可验证域收益更大**。
- 讨论：test-time compute 便宜且可无限搜索(有 verifier 就行)；train-time scaling 需要闭环里有**足够的成功样本**才能转起来。
- 比喻：test-time scaling 像往墙上扔意大利面且**知道它会落在哪**；train-time scaling 是提高一次扔中的概率，但仍需验证闭环。
- 学生问「练难题会不会回归简单题」：一般不会，除非推理链坏掉——即**overthinking**(重复的推理链)。

### [0:15–0:20] STaR：自举推理链

- 回顾：CoT 既提供**可解释性**也提升数学/常识推理(第一讲已讲)；目标是让模型获得强的逐步推理能力。
- 现有方法为什么不行：互联网**没有大规模推理步骤数据**；人工标注太贵；按已知解法模板自动生成只适用特定域；few-shot prompting 不如大数据集 fine-tune。
- **STaR 核心循环**：少量带 rationale 的种子示例 → 对约 **10k 个问题** few-shot 生成解题过程 → **只保留答案正确的** → SFT → 迭代重复。
- **Rationalization**：对答错的题，把正确答案作为 **hint** 给模型，让它「倒着解释」生成 rationale，再按「直接解出」的样子(不显示 hint)加入训练集。
- 意义：训练集从「模型已会的简单题」扩展到难题；作者称其为 **bare bones off-policy RL**。

### [0:20–0:30] STaR 的假设、实验与局限

- 三个假设：①**最终答案正确 = 推理质量的代理**(数学里一般成立)；②模型拿到答案 hint 后能生成有效 rationale；③**初始模型足够强**(问题不能完全超出能力范围，否则迭代无从启动)。
- 实验设置：**GPTJ 6B**(GPT-3 风格开源模型)；小 warm-up + 恒定学习率；外循环多次迭代，内循环步数逐步增加(慢启动)。
- 数据集：GSM8K(约 9K 样本)、CommonsenseQA(日常多选题，如「结账前把葡萄放哪→grocery cart B」)、多位数加法(合成)。种子 rationale 数据集很小，真正的训练数据靠模型自己生成。
- 结果：相比 supervised fine-tuning,STaR 达到 51.7% 且只用 **70–87% 的数据**(答错的被丢弃);rationalization 提升数据效率——用 86% 数据即可达到 72.5%。
- 人类评估：CommonsenseQA 上 STaR 生成的 rationale 被评为合理。
- 反直觉发现：**GSM8K 上 rationalization 没有帮助**——问题太简单，CoT 与 rationalization 的计算步数差不多，直接 fine-tune 就能拿到类似收益。
- 局限：多轮迭代后**plateau**(不是真 RL)；step 3 的 rationale **没有二次过滤**，给答案生成的推理链可能错，会学进错误推理；按最终答案过滤会有 true negatives / false positives。

### [0:30–0:35] STaR 谱系与「什么限制了 STaR」

- 变体：**V-STaR** = 在循环里再加一个 **generator + verifier** 联合训练；**Quiet-STaR** = 把推理步骤从语言空间搬进**隐空间**(MLPs)——「何必用英文思考」。
- 课堂讨论(什么 bound STaR 的性能)：**base model 的能力**是天花板——不会做出训练数据里没有的 logical leap；答案是否容易倒推也有关(如 225 → 容易联想到 15×15,别的数未必)；初始模型太弱则 rationalization 产出一堆噪声样本。
- 学生质疑：实践中可以直接**蒸馏** frontier 模型的输出来训练小模型；讲者回应：STaR 的意义在于理解「从自己的输出改进自己」的机制，蒸馏不在本讲范围。
- 关键伏笔：**从正例学习已经可行(有非零 reward 就能闭环)，从负例学习还没被解决**——今天的论文大多直接过滤掉失败样本。

### [0:35–0:45] DeepSeekMath：数据策展 + GRPO

- 背景图：MATH benchmark(比 AIME 简单、更早)上，精度随模型规模增长；**DeepSeekMath 7B 突然跃升**——关键Leap是把 RL 环节做对了。
- 数据第一步(对比 Minerva 在 PaLM 上堆 arXiv 数据改进 STEM 的路线)：**arXiv 的数学覆盖并不足**；DeepSeek 从 **DeepSeek Coder**(代码预训练模型)起步，在 **Common Crawl** 上策展数学内容(OpenWebMath)，获得大得多的 token 产量与数学域覆盖。
- **code → math 迁移显著有效**：代码预训练让模型推理和工具使用更好——首次证明从 coding 模型起步做数学更强。
- PPO 的内存墙：要同时维护 **old policy、new policy、critic、reward model 四份模型**，7B 还行，放大就撑不住。
- **GRPO**：去掉 critic/value 网络，用**组基线**替代：每题采样一组答案、reward model 打分，**advantage = (reward − 组均值) / 组标准差**。
- 直觉：reward model 本来就是训练来做**比较**的；给一个组上下文即可省掉一整份模型 → RL 可以扩展了。
- 成绩：MATH 上 **46.8 → 51.7**，首个无 critic、跨过 50% 的开源 7B 模型。

### [0:45–0:50] GRPO 统一视角与奖励分布难题

- 统一框架：各 RL 变体改的其实是两件事——**数据源**与**梯度系数**的计算方式。
- 频谱：**STaR**(一次性生成，对/错 0-1 奖励)→ **online rejection sampling**(在线生成，只留 reward=1)→ **GRPO**(在线生成 + 组基线 advantage)。
- 关键条件：**奖励必须有分布**——一组样本全对或全错时，标准化后 advantage 全为 0，没有 hill-climbing 信号。
- 推论：题目不能全太难(全 0 学不到)也不能太简单(全 1 学不到)；需要**有梯度的奖励分布**。
- 学生讨论的补充手段：加 **KL divergence** 项防止偏离模型已会的能力；或只更新部分参数(低秩/子集)。
- 重要发现：GRPO 提升的是 **majority@K**(32 次采样的多数投票正确率)，**不是 pass@K**——模型变得更**一致**，并没有变得更聪明。

### [0:50–1:00:00] DAPO：把 naive GRPO 修到 50%

- 起点：naive GRPO 直接上 **Qwen 32B**,AIME 只有 **30%**；病症：**熵塌缩**(过度自信)、训练不稳、**response length 爆炸**。参照：DeepSeek R1 论文在 AIME 有 47%。
- **Clip-higher**：标准 PPO clipping 对称对待概率上升与下降 → 低概率 token 爬不上去、高概率 token 也被削，**探索崩溃**；改成**不对称 clipping** 允许低概率 token 更大提升，熵保持稳定。
- **Dynamic sampling**：oversample 后**过滤全对 / 全错的组**，只保留有信号的组，维持**有效 batch size**——不浪费梯度(全对/全错的 advantage 本来就是 0)。
- **Token-level loss**:sample-level loss 让「长垃圾答案」与「短好答案」同权重；改成按 token 计 loss 可同时控制**熵**与**平均 response length**。
- **Soft overlong punishment**：推理链越来越长、在末尾被截断的样本会引入大量噪声；加渐进惩罚让训练稳定(另一路做法是在 RL loop 中加大 context length)。
- 消融阶梯(Qwen 32B on AIME):**30 → 36**(overlong filtering)**→ 38**(asymmetric clipping)**→ 41**(soft overlong punishment)**→ 42**(token-level loss)**→ 50**(dynamic sampling)——超过 DeepSeek R1 蒸馏到 Qwen 32B 的水平，自己 hill climb 到了强分数。
- 讲者提醒：64 采样只是展示性数字，实际取多少取决于基准难度与 base model 能力。

### [1:00:00–1:05:00] SFT vs RL、三技术选型与开放问题

- RL 监控三原则：loss 本身不是充分指标，还要盯 **response length**、**entropy**(不能太低也不能太高)、**全对样本比例**(决定该采多少样)。
- 症状→诊断：response length 爆炸 → 用 loss 控制长度；训练若干步不涨 → **reward model 饱和**了。
- SFT vs RL：RL 在有强奖励信号的域里**数据效率高、能 hill climb**，但很难调；SFT 有大量高质量数据时更快，但**不会带来推理能力**。
- 三技术选型：约 100 个带推理的样本 + 无 RL 基建 → **STaR**(GSM8K 级别简单任务有合理提升);GPU 有限 + 标准数学推理 → **DeepSeekMath / GRPO**(省内存、已被充分验证)；推理链更长(通常对应更难的题)、要 SOTA、竞赛级(AIME/IMO)→ **DAPO**。
- 三者的共同天花板：提升 **maj@K**、答案格式、多步一致性；**都不提升 pass@K**、不教模型解新问题、不出域泛化。能力跃迁历史上来自 breakthrough 或某个维度的 scaling。
- 开放问题：①为什么只有 maj@K 涨、pass@K 不涨；②推理行为(回溯/自评/自纠)是**真涌现**还是本来就存在、只是统计上变得更普遍；③**如何从失败中学习**(现在大多直接过滤掉)。
- 可探索方向：数据维度(生成更好的训练数据)、算法维度(RL 对 reward 噪声更鲁棒、该用什么奖励)、以及 **STaR 式 rationalization + DAPO 技术的结合**。

### [1:05:00–1:10:00] 收尾：reward hacking 与「够不够爬坡」的数据观

- RL 循环的双向难题：模型太强 → **reward 被 hack**；reward model 信号不足 → 无法 hill climb——优化因此更难。
- 可验证域盘点：数学/代码有最终正确答案、**RLEF**(执行反馈)、单元测试；问题是有多少域具备这种信号，以及能否用 **verifier ensemble** 弥补单个 verifier 的信号盲区。
- 算力占比：RL 占 pretraining 的比例从去年约 **99:1** 涨到现在约 **5%**；Grok 4 宣称 50% RL 但没有相应跃升——瓶颈正是 reward 不够强或有噪声。
- 数据稀缺的正确抽象：不是「数据够不够」，而是「**有没有足够的数据去 hill climb**」(即 dynamic sampling 不至于把 batch 过滤空)；RL 本身数据高效。
- 学生追问的定论：RL 更像是让模型**在已知能力的设计空间里探索得更好**，靠探索与搜索到达解，而非根本性的新推理。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Train-time scaling | 把模型自己的输出过滤后喂回训练的闭环；与 test-time scaling 构成循环 | 本讲主线 |
| STaR | 对问题生成解题过程 → 只留答案正确的 → SFT → 迭代；可视为 bare bones off-policy RL | Zelikman et al. 2022 |
| Rationalization | 答错的题把正确答案当 hint，让模型倒着生成 rationale，按直接解出加入训练 | STaR |
| GRPO | 去掉 critic 的 RL：组内奖励标准化 (r−mean)/std 作 advantage，四份模型减为三份 | DeepSeekMath |
| Clip-higher | 不对称 clipping，放宽低概率 token 的提升上限，防止探索/熵塌缩 | DAPO |
| Dynamic sampling | oversample 后过滤全对/全错组，保留有奖励方差的组，维持有效 batch size | DAPO |
| Token-level loss | 按 token 而非按样本计 loss，防止长垃圾答案稀释信号，控制熵与 response length | DAPO |
| Soft overlong punishment | 对超长被截断的推理链加渐进惩罚，消除截断噪声、稳定训练 | DAPO |
| maj@K vs pass@K | maj@K=K 次采样多数投票正确率(一致性)；pass@K=至少一次正确(能力上限) | 本讲核心区分 |
| PPO 内存墙 | old policy + new policy + critic + reward model 四份模型同驻内存，放大即崩 | 本讲(引出 GRPO) |
| V-STaR / Quiet-STaR | 前者加 verifier 联合循环训练；后者把推理搬进隐空间(MLPs) | 本讲提及 |
| RLEF | 用代码执行反馈做奖励，是数学/代码之外少数可验证信号源 | 本讲提及 |
| Reward hacking | 模型太强时 reward model 被钻空子；信号不足时又无法爬坡 | 本讲收尾 |
| Overthinking | 重复/坏掉的推理链；练难题一般不伤简单题，除非陷入此状态 | 本讲 Q&A |

## 自测题(先遮住右侧再答)

1. AIME 上 GPT-3.5(175B)、DeepSeekMath 7B、DAPO+Qwen 32B 的准确率各是多少?这组数字说明什么?
   > 约 5%、51.7%(加 tricks 约 60%)、50%——train-time scaling 让小模型反超大参数模型，训练 compute 可部分替代参数量。
2. STaR 的完整循环是什么?对答错的题如何处理(rationalization)?
   > few-shot 生成解题过程→只留答案正确的→SFT→迭代；答错的题把正确答案当 hint 让模型倒推 rationale，按直接解出(不带 hint)加入训练集。
3. STaR 成立依赖哪三个假设?
   > ①最终答案正确是推理质量的代理；②模型拿到答案 hint 后能生成有效 rationale；③初始模型足够强，问题不完全超出其能力范围。
4. GRPO 相比 PPO 省掉了什么?advantage 怎么算?
   > 去掉 critic/value 网络(四份模型减三份)；每题采样一组答案打分，advantage = (reward − 组均值) / 组标准差。
5. 为什么 GRPO 要求一组样本的奖励有方差?什么情况下学习失效?
   > 全对或全错时标准化后 advantage 全为 0，没有 hill-climbing 信号；题全太难(全 0)或全太简单(全 1)都学不到东西。
6. DAPO 的四个技术各自解决什么病?
   > clip-higher 治对称 clipping 导致的探索/熵塌缩；dynamic sampling 治全对/全错组浪费梯度；token-level loss 治长垃圾答案同权重、控熵和长度；soft overlong punishment 治截断推理链噪声。
7. DAPO 在 Qwen 32B 上的消融阶梯数字?最终超过了谁?
   > 30→36(overlong filtering)→38(clip-higher)→41(soft overlong)→42(token-level loss)→50(dynamic sampling)，超过 DeepSeek R1 蒸馏到 Qwen 32B 的成绩。
8. 本讲三种技术共同提升什么、共同不提升什么?
   > 提升 maj@K、答案格式、多步一致性；不提升 pass@K、不教新问题、不出域泛化——模型变一致而非变聪明，能力跃迁靠 breakthrough 或 scaling。
