# CS329A Lecture 2 学习笔记：Test-Time Compute Scaling

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配合视频 `lectures/…[-Ggc37xLj_Y].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L02-transcript.md](L02-transcript.md)

---

## 一句话概览

**推理时计算(test-time compute)是 pre-training / fine-tuning 之外第三根可预测扩展的杠杆**：同一问题重复采样再用 verifier 挑答案，就能让开源小模型在数学与代码上反超闭源大模型；本讲沿「推理 scaling law → generation-verification gap → compute-optimal 策略 → Archon 架构搜索」把这条杠杆讲透。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 三阶段框架与 Large Language Monkeys：重复采样本身就能涨分

- LLM 开发三阶段：**pre-training**(耗时数月、海量 GPU、数万亿 token)→ **fine-tuning**(数据量小若干个数量级)→ **inference**；本讲主题 = 不改参数、不做微调，只在推理时让模型变强。
- **Large Language Monkeys**(Brown et al. 2024)设定：同一输入问题重复问 K 次(10 次、100 次……)，不再只生成一次回答。
- 系统输出由 **verifier** 决定：它判断哪个候选是正确回答，选中者即最终输出。
- 效果：单次尝试不如 GPT-4o 的较弱模型(如 Llama 3 8B/70B)，靠重复采样加挑选可显著反超更大、闭源的模型；在很难的数学、代码、问答任务上都成立。
- 讲者直觉：小模型「其实已经知道」这些难题的答案，重复采样是**把答案诱导、显现出来**(eliciting)，只是第一次没说出口。
- 该范式在 agentic 基准上也成立：**SWE-bench**(字幕残缺作 "bbench",模仿软件工程师改代码、打 patch)上，DeepSeek(V3)采样 1000 次后的 coverage 能超过 Claude 3.5 Sonnet 与 o1-preview。
- **coverage** = 至少被一个样本解出的问题比例；有单元测试当 verifier 时，这就是从开源模型**端到端自动造出更强模型**的路径。
- 与上讲预训练 scaling law 对照：预训练靠数据/算力/参数可预测地降 test loss；本讲要给推理侧找一个类似的规律。

### [0:05–0:10] 推理 scaling law:coverage 对 K 服从幂律，充要条件是「难题长尾」

- **推理侧 scaling law**：coverage C 与并行采样数 K 之间服从**指数型幂律(exponential power law)**，A、B 为拟合出的系数。
- 用途：由此可**反推达到某个目标 coverage 需要多少样本、该分配多少资源**。
- 实证范围：Llama 3 8B/70B、Gemma、Pythia 等，**参数量从 70M 到 70B**，预测曲线都紧贴实测 coverage；连 70M 的小模型也有同样 scaling 行为，且跨领域成立。
- 单题层面并不神秘：对问题 i，若 pass@1 概率为 p，则 **pass@k = 1-(1-p)^k**(1-p 即 K 个答案全错的概率)——纯指数衰减。
- 悖论在数据集层面：整套题上观察到的却是**幂律**；什么样的题目分布能解释它?——引出长尾条件。
- **How Do Large Language Monkeys Get Their Power (Laws)?** 回答了原因：幂律 scaling 的**充要条件是 pass@1 难度呈长尾分布**——大量简单题 pass@1 很高，难题 pass@1 一路走低拖出长尾；实证检查确认该条件成立。
- 工程含义：公司过去花数亿到数十亿美元在预训练、少量在微调、每次推理几乎不花算力；新范式下**推理算力可以离线烧**——放出 agent 持续生成 token、持续改进答案质量。

### [0:10–0:15] 验证从哪来：形式化证明、单元测试、AI as a compiler

- 重复采样的前提是**自动化验证**：拿到一堆样本，得知道哪个是对的、怎么挑。
- 数学：给定证明策略，用**形式化证明软件**逐步验证每一步是否正确。
- 代码：写**单元测试**当 verifier；写测试常比写完整解题程序简单得多(可以由人来写)。
- 实验室项目 **AI as a compiler**：用 LLM 把 PyTorch 源码编译成 CUDA 级硬件感知低层代码；之所以可验证，是因为**对任意输入对比 CUDA 输出与 PyTorch 输出是否一致**即可。
- **KernelBench**(CUDA 代码生成基准)上看到同样规律：样本数增加，coverage 持续提升，且这里天然有「完美 verifier」。
- 推广：任何**两种语言间的翻译/移植**(Python、C++、Java 互转)都能用等价性判定，天然可验证。

### [0:15–0:20] 没有验证器的领域：generation-verification gap

- 无 verifier 的领域里，**best-of-n 类方法(majority voting、model-based ranker)与真实 coverage 之间有一条大沟**——即 **generation-verification gap**：模型能生成正确答案，但验证端接不住。
- **majority voting** = 选出现次数最多的答案；实验中它在 **10–50 个样本后就 plateau**，而 oracle(完美 selector)的 coverage 远在其上；难题越多沟越深。
- 数据集对比：**MATH 比 GSM8K 更难**；即使换上 reward model(LLM 训练而来、给回答打分)及其与 voting 的组合，差距仍然很大。
- 失效机理：最难的问题在 1000–10000 个样本里**只被解出 1–3 次**，正确答案太稀有，majority voting 结构上捞不到。
- 对照面：GSM8K 简单、答案频率高，voting 对多数题仍有效——但最难的那批题正确频率照样低，验证依然困难。
- 预告：reward model / verifier 下周一讲；本讲每题 10000 个样本的数据集已放在 HuggingFace，可用来研究缩小这个 gap。

### [0:20–0:25] 课堂讨论：把 gap 变成研究题

- 学生共识：① 有好 verifier 时重复采样非常有效；② **verifier 本身的质量是这套方法的命门**。
- 提出的方向：序贯修订(先给一版再改)、知识图谱 + RAG 的混合检索提效、先探索领域再并行采样(self-study)。
- 「证伪比证真容易」：可保留进化式过滤，用模拟器、工具或另一个模型剔除明显错误的答案；也有学生提醒物理/机器人等领域的验证器本身带噪。
- 讲者回应：self-study search、tool use 都是后续课程内容；**缩小 generation-verification gap 可作本课程研究项目**。
- 多 verifier 集成：实验室在做弱监督 verifier ensembling(约 10–20 个,不是上千个)，方向可取但算力代价高。
- 验证器质量检查：数学题答案人工抽查约九成准确；**单元测试没有真正覆盖代码**是典型失败模式。

### [0:25–0:35] Snell et al.：并行 vs 序贯、ORM vs PRM、PRM 引导的 beam search

- **Scaling LLM Test-Time Compute Optimally**(Snell et al. 2024)把扩展方式分成两轴：
  - **并行采样(parallel sampling)**：一次问 N 遍，选最好的；
  - **序贯修订(sequential revisions)**：模型先给初始解，再不断自我修改、换角度补充，直到有信心才输出(可用 prompt 做到;reasoning models 已把这种行为训进内部)。
- 选择答案的两类学习型打分器：**ORM(outcome reward model)**只看最终结果打分；**PRM(process reward model)**给解法的**每一步**打分。
- PRM 细节：分数约在 0–1；**不是 per token**，而是按「有语义的一步」打分(一步可定义为一个推理上有意义的块或一句话)，训练数据靠人工标注每步好坏。
- PRM 由语言模型微调而来，**域内任务效果最好、跨任务也有一定泛化**；可直接拿现成预训练 PRM 用，也可用自己的数据自训。
- **PRM 引导的 beam search**：每层预算 4 个样本 → PRM 选 top-2 → 从它们继续扩展 → 逐层剪枝，只留有希望的分支。
- 组合玩法：给每个并行样本各自配一段序贯修订(如并行 2 路、每路带修订)，再用 PRM/ORM 从最终答案里挑最好——并行与序贯可以正交叠加。
- 实验设定：数学数据集约 12k 训练 / 500 测试，PaLM 系模型；按 pass@1 把题目分成 **5 个难度桶**；还专门微调了做修订的模型(如今指令微调模型 prompt 一下就会修订)。
- 核心经验：**ORM + 并行 best-of-n + 序贯修订组合起来效果更好**，但怎么混合匹配仍是开放问题。

### [0:35–0:45] compute-optimal 观察：难度决定该烧哪种算力

- 评估视角把 token 当旋钮：**给定目标 accuracy，求最小 generation budget**。
- 曲线对比：随预算增长比较 majority voting、ORM、PRM 与「混合调配」(compute-optimal)；**怎么混合匹配仍是未开垦的研究方向**。
- 难度分桶发现：**简单题偏向多序贯、少并行**(sequential-to-parallel 比值高时准确率最高)；难题(桶 4→5)的最优配比更难断言。
- 本讲最重要的观察(讲者认为至今成立)：**简单与中等难度题，加大 test-time compute 比扩预训练更划算**；**最难的问题，更大、预训练更多的 frontier 模型仍占优**，即使给很大的推理预算。
- 学生追问：预训练只做一次，test-time scaling 每次推理都要重新花，这样比公平吗?——讲者：确实如此，但问题应表述为「给定总算力，两边怎么分」。
- 「是不是不用再做预训练了?」——不是：① 最难题仍靠预训练；② 预训练贵到不是谁都做得起，而 test-time scaling **人人可负担**，因此让开源/小模型越来越有用。
- 学生讨论的直觉：简单题哪条路都能走到答案(序贯足够)；难题可行路径稀少，**需要更多并行探索**才捞得到正确解；tree search 是两者的混合，PRM 在每层剪枝。

### [0:45–0:55] Archon：把推理时扩展当作架构设计问题

- **Archon: An Architecture Research Framework for Inference-Time Scaling**(Saad-Falcon et al. 2024,课程 TA 是作者之一)：把「混合匹配推理技术与模型」形式化为**推理架构设计问题**，目标是 accuracy–cost 前沿。
- 输入：目标 benchmarks、**inference call budget**、可用 LLM 集合、推理技术集合；优化器 **ITAS(inference-time architecture search)** 搜出具体架构；全部技术靠 **prompting 实现**，不专门训练。
- 推理算子：**generation**(采样 N 个候选)、**fusion**(把 K 个候选连同原题交给 LLM 综合成一个答案,属序贯更新)、**critic**(指出回答强弱项)、**ranker**(按质量排序)、**verifier**(给出选择并附打分理由)。
- **unit test generation**：让模型为编码/数学/推理题生成单元测试；例(括号平衡题)：「奇数个括号 → 输出 no」「闭括号必须匹配最近一个未匹配的开括号」，还能让模型把测试写成代码。
- **unit test evaluation**：更激进——不真运行测试，直接让模型**判断某个回答是否通过这些测试**。
- 关键实验(重复样本 1–10)：随机选 < 模型 ranker < oracle selection，而 **fusion 的 win rate 甚至超过 oracle selection**；先按 ranker 取 top-5 再 fusion 又更好。
- 换成多模型 ensemble(1、2、…、10 个模型各出 1 个答案)趋势保持一致；随机基线反而变差，因为被对比的单模型本身就是 ensemble 里较强的那个。
- ensemble 按最强→次强顺序加入；rank 与 fusion 统一由其中的 1 号(最强)模型执行。

### [0:55–1:03] Archon 的搜索与结果：开源模型反超 GPT-4o 14.1%

- 找到的架构是**深层堆叠**：generation(多模型)→ critic → ranker → 多个 fuser → 再 critic/ranker……像深度学习加层一样，**层数堆上去准确率显著上涨**(多模型 ensemble + 3 层 critic/fuser + 末级 fuser,明显好于最强模型单次或 8 次 + 单层 fusion)。
- 动机：完整搜索要跑海量 inference call、非常贵，所以先做离线预处理砍小搜索空间(gen→critique→ranker→fuser 这条好序列即离线测出)。
- 搜索约束：每层只用一种技术、第一层必为 generator、critic 排在 ranker/fuser 之前、unit test generator 后必接 evaluator。
- 优化器用 **Bayesian optimization**(目标 = accuracy vs inference call 数)，比 greedy/随机搜索**省得多配置次数**；可按任务定制(task-specific)，也可训成跨任务的 general-purpose 版。
- 结果：**纯开源模型的 Archon,pass@1 平均超过当时的 GPT-4o / Claude 3.5 Sonnet 14.1%**(跨指令遵循、推理、数学、代码)。
- general-purpose 版(优化时不锁定单一任务)同样整体优于 frontier 模型——**推理架构的好处能泛化到训练任务之外**。
- 结尾留讨论题，预告下周一讲 reward models / verifiers。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Test-time compute | 推理时额外花费的算力，不改参数不微调也能涨能力 | 本讲主题 |
| Repeated sampling | 同一问题重复采样 K 次，用 verifier 挑正确答案 | Large Language Monkeys(Brown et al. 2024) |
| Coverage | 至少被一个样本解出的问题比例；对 K 服从幂律 | Large Language Monkeys |
| pass@k | 单题至少一个正确样本的概率 1-(1-p)^k | 本讲推导 |
| 长尾条件 | 难题 pass@1 长尾分布是幂律 scaling 的充要条件 | How Do LLM Monkeys Get Their Power (Laws)? |
| Generation-verification gap | 模型能生成正确答案但验证端捞不出来的差距 | 本讲 |
| Majority voting | 选出现最多的答案；10–50 样本即 plateau | 本讲 |
| ORM | outcome reward model，只给最终结果打分 | Snell et al. 2024 |
| PRM | process reward model，给解法每一步打分(约 0–1) | Snell et al. 2024 |
| Sequential revisions | 模型反复自我修改初始解再输出；reasoning models 已内化 | Snell et al. 2024 |
| Compute-optimal | 给定 accuracy 求最小推理预算；易/中题偏推理算力，最难题仍偏预训练 | Snell et al. 2024 |
| Fusion | 把 K 个候选连同原题交给 LLM 合成一个答案，可超 oracle selection | Archon(Saad-Falcon et al. 2024) |
| ITAS | inference-time architecture search,Archon 的架构优化器 | Archon |
| KernelBench | CUDA 代码生成基准，天然完美 verifier | 本讲实验室项目 |
| AI as a compiler | LLM 把 PyTorch 编译成 CUDA，输出等价性即验证 | 本讲实验室项目 |
| SWE-bench | 模仿工程师改代码打 patch 的 agentic 基准；DeepSeek 1000 样本超闭源 | 本讲 |
| PRM beam search | 每层采样后按 PRM 分留 top 分支再扩展，逐层剪枝 | Snell et al. 2024 |
| Critic / Ranker / Verifier | Archon 三种 prompting 算子：评强弱 / 排序 / 附理由选答案 | Archon |
| Unit test generation & evaluation | 模型写测试 + 模型判卷(不真跑测试) | Archon |
| Bayesian optimization | Archon 的架构搜索算法，比 greedy/随机省配置次数 | Archon |

## 自测题(先遮住右侧再答)

1. Large Language Monkeys 的系统是怎么搭的?举一个「小模型反超大模型」的具体结果。
   > 同一问题重复采样 K 次 + verifier 挑正确答案；Llama 3 8B/70B 单次不如 GPT-4o，重复采样后可反超；SWE-bench 上 DeepSeek V3 采样 1000 次 coverage 超 Claude 3.5 Sonnet / o1-preview。
2. 推理侧 scaling law 长什么样?成立的充要条件是什么?
   > coverage C 对采样数 K 服从指数型幂律(A、B 为拟合系数)；充要条件 = 数据集 pass@1 难度呈长尾(大量易解题 + 越难 pass@1 越低的长尾)，单题层面只是 1-(1-p)^k 的指数。
3. generation-verification gap 是什么?majority voting 为什么在难题上失效?
   > 模型能生成正确答案但验证方法接不住的差距；majority voting 在 10–50 样本就 plateau，而最难问题在 1000–10000 样本中只被解出 1–3 次，正确答案太稀有投不出来(MATH 比 GSM8K 更严重)。
4. 哪些领域天然自带 verifier?AI as a compiler 为什么可验证?
   > 数学(形式化证明软件逐步验证)、代码(单元测试,常比解题程序好写)、语言间翻译/移植(等价性判定)；AI as a compiler 用「任意输入下 CUDA 输出与 PyTorch 输出一致」验证，KernelBench 上 coverage 随样本数持续上升。
5. ORM 与 PRM 的区别?PRM 怎么进入搜索?
   > ORM 只对最终结果打分；PRM 对解法每一步打分(非 per token,按有语义的步骤、可人工标注训练)；PRM 引导 beam search，每层采样(如 4 个)后留 top(如 2 个)分支剪枝扩展。
6. Snell et al. 的核心结论：什么题该烧推理算力，什么题该靠预训练?
   > 简单/中等题加 test-time compute 比扩预训练更划算，且偏向多序贯少并行；最难的问题更大、预训练更多的模型仍占优(即使推理预算很大)；预训练贵到非人人可做，test-time scaling 人人可用。
7. Archon 的 fusion 操作是什么?为什么让讲者惊讶?
   > 把 K 个候选连同原题交给 LLM 合成一个答案；其 win rate 竟超过 oracle selection(完美验证器挑最好)，先 ranker 取 top-5 再 fusion 还会更好。
8. Archon 用什么优化器、给了哪些搜索约束?最终成绩如何?
   > Bayesian optimization(目标 = accuracy vs inference call 数,比 greedy/随机省配置;约束:每层一种技术、首层必 generator、critic 在 ranker/fuser 前、unit test generator 后必接 evaluator)；纯开源模型 pass@1 平均超 GPT-4o / Claude 3.5 Sonnet 14.1%。
