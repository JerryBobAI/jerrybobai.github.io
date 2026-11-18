# CS25 Lecture 5 学习笔记：预训练的未来——两阶段配方、推理前置与 RLP

> 讲者：Shrimai Prabhumoye|配合视频 `lectures/L05-pretraining-future [e_H_tkpCAK4].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L05-transcript.md](L05-transcript.md)

---

## 一句话概览

本讲回答"预训练的未来"：在数据墙(2030 年前后 LLM 将消耗 95% 以上人类生成公开数据)逼近时，如何从同样的 token 里榨出更多智能。讲者用"四个孩子"(Pascal/Volta/Ampere/Hopper,同名 GPU 架构，数据全同、学习策略不同)寓言串起三项 NVIDIA 时期工作：两阶段预训练(Phase 1 多样性、Phase 2 高质量，Volta 比 Pascal 平均 +17%)、推理前置(推理数据放进预训练，收益持久复利，全流程后 +19%、AIME 上 +39%)、RLP(把强化学习当预训练目标:先让模型生成思考再预测下一 token,以相对无思考基线的信息增益为 dense 奖励，在 Qwen3 1.7B 与 Nemotron Nano 12B 上分别拿到 +19%/+35%,且不被下游对齐洗掉)。

## 分节要点(带时间锚点)

### 一、开场：SOTA LLM 四要素与本讲路线图

- 讲者背景：Shrimai Prabhumoye，Mistral AI AI 科学家(开场时刚入职当周一)兼 Boston University 兼职教授，此前是 NVIDIA Nemotron 系列模型的核心贡献者，主攻数据策划、预训练与 scaling，研究聚焦 LLM 推理能力 ([0:00])
- SOTA LLM 配方四要素：smart data(海量、多样、高质量，过滤去重)、smart architecture(transformer 正在向 Mamba2 hybrid 等演化)、smart algorithm(先进训练配方)、smart collaboration(预训练/后训练/研究/工程协同) ([0:01])
- smart data 成果盘点(全部开源在 Hugging Face):MIND(数学向合成对话)、Nemotron-CC-Math(从 Common Crawl 提炼数学)、Prismatic Sythesis(鼓励合成数据多样性)、Nemotron-CrossThink(数学代码之外的推理，发布当周即 NVIDIA 在 HF 最热数据集) ([0:02])
- 本讲聚焦 smart algorithm，三连击：最大化数据潜力(两阶段预训练)、推理前置(front-loading reasoning)、RLP(把强化学习当预训练目标) ([0:03])

### 二、四个孩子与两阶段预训练：框架、基线与量化收益

- 四个孩子寓言：同名 GPU 架构世代(Pascal/Volta/Ampere/Hopper)，数据完全相同，差别只在三种学习策略——curriculum(阅读顺序)、front-loading reasoning(高中修 AP 大学课类比:早学后面都受益)、learning through thinking 而非只观察 ([0:05])
- 策略矩阵：Pascal 随机乱读(无 curriculum、从不碰高质量推理数据、不想)；Volta 有 curriculum 但不用推理数据也不想；Ampere 有 curriculum + 用推理数据但不思考；Hopper 三者全占——四条线正好对应后面三组实验的对照 ([0:06])
- 数据墙：GPT-3(2021)训数千亿 token，Llama 3(2024 末)已训数十万亿；Epoch AI 分析预测约 2030 年 LLM 将消耗 95% 以上人类生成数据——问题从"找更多数据"变成"如何更高效地用数据" ([0:07])
- 最优混合 pipeline：先建质量分类器估计各数据源质量(同质量同权重、高质量更高权重)，再做 epoch 估计(每个源最多重复几遍才不收益递减)，据此造最优数据混合；配两阶段 curriculum——Phase 1 重多样性(大量含中低质的 web crawl,高质量数据少 epoch)，Phase 2 只强调高质量(math/Wikipedia/code 等)多 epoch ([0:08])
- 三条基线与结果：natural distribution(按各源 token 量比例抽样，不看质量、不排序)/ optimal blend(质量+epoch、随机顺序)/ two-phase(质量+epoch+顺序三轴全照顾);head-to-head 下 Volta 平均比 Pascal 好 17%、比随机顺序的 optimal blend 好 3.4% ([0:10])

### 三、推理前置：动机与研究设计

- 现行 pipeline 的批判：预训练只学世界知识与事实，SFT 学模仿推理格式的答案(本质是模仿学习)，到 RL 阶段才真正学推理——推理作为事后附加(post hoc)，打出来的是弱推理地基 ([0:13])
- 主张 front-loading reasoning：预训练阶段就学推理技能本身，后训练只做放大与精炼，为推理模型打更强地基 ([0:14])
- 研究设计：系统性地把推理数据注入训练管线不同阶段(预训练/SFT 等)，沿 diversity(多样性)/quality(质量)/quantity(数量)三轴刻画推理数据；对照组命名 reason base(预训练见过推理数据)vs no-reason base(没见过)；注意预训练模型与后训练模型用不同评测基准，数字不可直接横比 ([0:15])

### 四、推理前置的五个教训

- 教训一：预训练含推理数据立即受益——预训练刚结束，Ampere(reason base)平均比 Volta(no-reason base)好 16% ([0:16])
- 教训二：优势不被 SFT 洗掉反而继续长大——SFT 之后 Ampere 仍领先 9.3% ([0:17])
- 教训三：高质量推理数据会解锁"隐藏收益"——三数据集 SHQ(量少样少但高质量)/LDQ(量大样多但低质量)/LMQ(两者拼接)：预训练刚结束 LMQ≈LDQ(看不出高质量数据有用)，但后训练后 LMQ 比 LDQ 高 4.25%，且没有过拟合 ([0:18])
- 教训四：堆后训练算力追不上——no-reason base 用 2x SFT epoch 仍输只做 1 epoch 的 reason base 3%；固定推理数据预算下，分一部分给预训练比全留给 SFT 好(reason base 平均 +12%) ([0:19])
- 教训五：front-loading 创造持久优势——走完预训练+SFT+RL(RLVR)全流程后 Ampere 仍 +19%，且在 AIME 这类复杂数学基准上增益膨胀到 +39% ([0:20])

### 五、中场问答：数据配方的落地细节

- SHQ/LDQ 的实体：SHQ 用 OpenThoughts(重过滤、数学代码为主),LDQ 用已发布的 Nemotron SFT 数据集(覆盖多域、未重过滤、token 量大故质量较低)；质量也可按复杂度/难度标签(题目长度、已有 difficulty 标注)定义 ([0:21])
- "什么算推理数据"沿用社区惯例：问题 + 长推理轨迹 + 最终解答(数学奥赛题是典型形态)；语料偏 STEM(math/code 及 MMLU 相关领域)，没做法律等领域专项过滤 ([0:22])
- 配方自动化程度是"混合体"：质量估计与 epoch 估计全自动，但最终 data mixture 由人依据估计结果手工搭建 ([0:24])
- epoch 估计怎么做：以各源 1 遍的基线混合起步，逐步把某域加到 2/4 遍(权重从低质 crawl 那边挪过来)，观察下游任务影响找收益递减点；按 domain 类别(如整个 math)做而非逐个数据源 ([0:25])
- 顺序消融：把"先多样性后质量"换成"先质量后多样性"效果变差——探索(explore)先于利用(exploit)的两阶段顺序更优 ([0:26])

### 六、RLP：动机与核心机制

- 动机寓言(两个学习者)：Leo 边做边学，很快搭出简陋但能让玩具车通过的桥；Bolt 只靠观察，造出设计精美、精度完美却小到车过不去的悬索桥——learning by doing vs just watching；今天模型只会"看文本"(纯 next-token prediction)，RLP 要教模型通过自己的思考来学 ([0:27])
- 标准预训练的问题：SFT 阶段是模仿学习(预测对错给 yes/no 式反馈)，探索被推迟到很晚的 RLHF/RLVR，推理成了 afterthought；两个研究问题：推理能否在预训练阶段就烘焙?这些收益是持续还是被后训练洗掉?数据墙下这也是数据高效算法的一条路 ([0:28])
- 机制示例(photosynthesis 语境，下一词 sunlight)：vanilla 直接由上下文预测；RLP 给模型探索机会——先生成思考"光合作用依赖太阳能，所以下一词应是 sunlight"，下一 token 概率以(上下文+自生成思考)为条件，即 reasoning-driven prediction；生成思考的 prompt 要求写下一步、别直接跳到最终 boxed answer、不复述题干与元数据 ([0:31])
- 管线四组件：thought policy(对输入上下文做 rollout，既生成思考又生成下一 token，得 p_θ = P(下一 token|上下文，思考))、no-think baseline(同一上下文不加 prompt 的标准预测，得 p_φ)、信息增益奖励(log p_θ − log p_φ)、no-think 基线用指数移动平均(EMA)延迟更新 ([0:33])
- 奖励与基线的性质：只有思考真有贡献时奖励才为正，思考是垃圾可为负或 0；它不是 RLVR 式 0/1 而是 dense 奖励，可施加在文档任意位置、无需任何外部选择过程；EMA 延迟让基线"够新以提供有信息量的对比，又故意滞后以防 reward hacking" ([0:35])

### 七、RLP 实证：Qwen3 与 Nemotron 两组实验

- 实验 1 设计：Qwen3 1.7B-Base(字幕作 Qwen 31.7B)上做 RLP 训 1B tokens，语料是通用预训练数据(非推理专项，web crawl/书/论文都行)；对照组：base、同 1B tokens 继续预训练(下一 token 损失)、identical post-training(SFT+RLVR) ([0:36])
- 实验 1 结果：RLP 比 base 高 19%，比用同样 1B tokens 做下一 token 预测继续训练高 17%——这是 Ampere vs Hopper 的正面比较 ([0:37])
- 收益在下游对齐后复利：identical post-training 之后 Hopper(RLP)相对 Ampere 再好 8%——RLP 在预训练期建立的推理地基不会被下游对齐洗掉 ([0:38])
- flop-matched 对照：RL 因 rollout/多路 completions 天然比下一 token 预测贵，按 FLOPs 公式折算后 170M tokens 的 RLP ≈ 6B tokens 的下一 token 预测(TM=token-matched,FM=flop-matched);FM 下 RLP 仍平均高 14%，而对手多看了 35x 的数据 ([0:39])
- 实验 2(放大 + 跨架构):Nemotron Nano 12B v2(混合 Mamba2 架构;字幕作 Nemotron 12B v2)取 19.8T checkpoint 加 250M tokens RLP，对比训满 20T 的 base(少约 2000 亿 token,字幕误作 $200 billion)：平均 +35%、science 域提升最大；identical post-training 后仍 +3% absolute——收益随模型规模放大且跨架构成立 ([0:41])

### 八、与 RPT 对比、四孩子终局与收尾问答

- 早期推理相关工作三件套：Quiet-STaR、RPT(Reinforcement Pre-Training)、RLPT(RL on Pre-Training Data)；定性对比三维——奖励来源(NTP 无 / RPT·RLPT 需外部 verifier / RLP verifier-free 内在奖励)、奖励粒度(RPT·RLPT 稀疏二值 / RLP dense)、推理涌现(RPT·RLPT explicit-weak / RLP explicit-strong) ([0:43])
- 定量对比 RPT：同设置(Qwen3 1.7B-Base、OmniMath 数据、各训 170M tokens)下 RLP 平均高 4%；根源在机制——RPT 要用另一个模型预筛可算奖励的 token，稀疏 0/1 只强化选中 token 且忽略推理步骤本身，RLP 对文档任意 token 施加 dense 奖励、把整条推理轨迹计入信号 ([0:44])
- 四孩子终局与要点：Hopper(三策略齐用)相对 Pascal 最高 +60%；可带走的结论——两阶段配方(先多样性后高质量)有效、推理前置创造持久且复利的优势(部分收益 SFT 后才解锁)、RLP 把 RL 重构为预训练目标架起"下一 token 预测 ↔ 有用思维链涌现"的桥；只用 web crawl 或只用学术数据的消融也都有 7-9% 增益(未标注文本流即可教推理)，这打开了"模型如何学会推理"的新 scaling 轴 ([0:47])
- 收尾问答(数据质量怎么量化)：FineWeb-Edu 教育性 1-5 打分(HuggingFace 出品、NVIDIA 已适配其打分，是最流行的基础做法)；Essential Web 做更细分类(域:科学/数学，教育水平:中学/大学)；也可按 rubric 训 LLM 分类器；另确认 RLHF 仍少量混入 RLVR 阶段但占比已缩小，其讨好性偏置与幻觉缓解属 alignment 进行时(RLAIF 或可减少主观性) ([0:52])
- 收尾问答(RLP 实操与边界)：思维前缀在文档内随机选 token(不做基于熵的花哨选择)，回传奖励后整篇丢弃换新文档；RLP 跑在预训练混合语料上(含大量 web crawl)而非最高质量推理数据；与 GRPO 的关系——RLP 直接用 GRPO 算子，只把 0/1 奖励换成信息增益，advantage 计算不变；更早的 checkpoint 也可用——20% 预训练处(4T token checkpoint)做 RLP 相对基线仍有收益 ([0:55])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| 两阶段预训练 Two-Phase Pretraining | Phase 1 重多样性(大量中低质 web crawl + 高质量数据低 epoch)，Phase 2 只喂高质量数据(math/Wikipedia/code)多 epoch，同时照顾质量、epochs、顺序三轴。 |
| Epoch Estimation 重复次数估计 | 用消融实验测出每个数据源最多重复几遍才不收益递减，据此在混合中分配权重；按 domain 类别而非单个数据源做。 |
| Front-loading Reasoning 推理前置 | 把推理数据提前注入预训练阶段，后训练只做放大与精炼；收益持久且复利，部分增益要到 SFT 后才解锁。 |
| RLP 预训练期强化学习 | Reinforcement Learning during Pretraining：预测下一个 token 前先让模型生成思考(探索行为)，以相对无思考基线的信息增益为奖励。 |
| Thought Policy 思维策略 | RLP 中先做 rollout 生成思考、再基于(上下文+自生成思考)预测下一 token 的策略；同一模型既产思考又产下一 token。 |
| No-Think Baseline 无思考基线 | 同一上下文不加思维链提示的标准下一 token 预测基线；用指数移动平均(EMA)延迟更新，防 reward hacking。 |
| Information Gain Reward 信息增益奖励 | log p_θ − log p_φ，衡量思考让下一 token 预测变好的程度；dense、可负可零、文档任意位置可用、verifier-free。 |
| Reason Base / No-Reason Base | 预训练阶段见过/没见过推理数据的基座模型，对照衡量推理前置带来的持久收益。 |
| RPT / RLPT | 早期推理预训练的并行工作(Quiet-STaR 一脉)：依赖外部 verifier、稀疏二值奖励、需预筛 token；RLP 与之相反。 |
| FineWeb-Edu | HuggingFace 发布的教育性质量分类器，给 web 文档打 1-5 分，是量化 web 数据质量最流行的基线。 |

## 自测题

1. 两阶段预训练的两个阶段各自侧重什么?
   > Phase 1 重多样性：大量中低质量 web crawl + 高质量数据少 epoch；Phase 2 只喂高质量数据(math/Wikipedia/code)多 epoch——质量、epochs、顺序三轴全照顾。
2. 两阶段预训练相对基线的量化收益是多少?
   > Volta(两阶段)平均比 Pascal(natural distribution,按 token 量抽样无顺序)好 17%，比同样最优混合但随机顺序的 blend 好 3.4%。
3. 推理前置的五个教训合起来说明什么?
   > 预训练加推理数据：刚训完 +16%，SFT 后 +9.3%，全流程(含 RLVR)后 +19% 且 AIME 上膨胀到 +39%；高质量推理数据的部分收益 SFT 后才解锁(+4.25%)；堆 SFT 算力追不上(2x epoch 仍 +3%)，固定预算下应分一部分给预训练(+12%)。
4. RLP 的奖励函数怎么定义?为什么说它是 dense 的?
   > 奖励 = log p_θ(带思考的下一 token 预测)− log p_φ(无思考基线)，思考真有贡献才为正；它不是 RLVR 式终局 0/1，而是逐位置连续值、可为负或零，文档任意 token 位置都能算，无需外部选择器。
5. RLP 的 No-Think 基线为什么用指数移动平均(EMA)延迟更新?
   > 故意滞后以防 reward hacking(基线贴太近会被钻空子)，EMA 又保证基线足够新、训练中能提供有信息量的对比。
6. RLP 三组实验的关键数字分别是什么?
   > Qwen3 1.7B:1B tokens 后 vs base +19%、vs 同 token 继续预训练 +17%、同 post-training 后再 +8%;flop-matched(170M vs 6B tokens)+14%(对手多看 35x 数据);Nemotron Nano 12B v2:19.8T+250M vs 20T 少约 2000 亿 token 仍 +35%。
7. RLP 与 RPT/RLPT 的本质区别是什么?
   > RPT/RLPT 依赖外部 verifier 预筛 token、给稀疏二值奖励、无视推理步骤本身；RLP verifier-free、任意 token 可用、dense 信息增益奖励把整条推理轨迹计入(同设置下定量 +4%)。
8. 为什么说 RLP 开辟了新的 scaling 轴?
   > 数据墙已到(2030 年前后 LLM 将耗尽 95% 人类生成公开数据)，RLP 证明同样的 token 用"先思考再预测"学比纯下一 token 预测更高效——连未标注 web crawl 也能教出推理行为(7-9% 增益)，提升的是数据效率而非数据量。
