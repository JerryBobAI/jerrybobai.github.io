# CME295 Lecture 3 学习笔记：LLM Training

> 讲者 Afshine & Shervine Amidi(Stanford)|配合视频 `lectures/L03-llm-training [S3bCDcJhz4s].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L03-transcript.md](L03-transcript.md)

---

## 一句话概览

**从零到可用的 LLM 是一条五段流水线**：pretraining 学语言(数万亿 token 的 next-token prediction)→ midtraining 注入任务知识并拉长上下文 → SFT 教会助手行为 → RLHF/DPO 对齐人类偏好(或用可验证奖励训练 reasoning)→ on-policy distillation 补上「稠密信号 + on-policy」两全的监督；最后借 GLM-5 技术报告把全流程落到实战。

---

## 分节要点(带时间锚点)

### [0:00–0:10] 预训练：transfer learning 动机与 next-token prediction 机制

- 回顾 L2:decoder-only 架构 + scaling laws + Chinchilla(每参数约 20 token,许多大模型其实 undertrained)+ MoE(放进 FFN,那里算力最集中)+ RoPE / Sliding Window / GQA 等架构改进。
- 15 年前的传统做法是**一个用例训一个模型**(spam 检测一个、情感分析一个、翻译一个)；现代思路是 **transfer learning**：先做一次性的大规模 **pretraining 学语言**，再针对用例微调，第二阶段才是 **tuning for a specific use case**。

- 数据 = 全网文本(多语言)+ 代码(Python 等)+ 数学科学语料；训练方式是 **next-token prediction**：喂 BOS，预测第一个 token，再把它喂进去预测下一个，循环。
- 不必顺序进行——**高度可并行**：把整段输入一次性喂入，同时预测所有位置的下一 token，本质是一次大矩阵乘法；这叫 **teacher forcing**：无论模型实际预测了什么，下一步的输入永远是文本里的真实 token。
- 学生提问的痛点(训练/推理不匹配，即 exposure bias)被点名，将在后续课程给出解法；只喂 BOS 时模型学到的只是「什么样的 token 适合开头」。
- 并行化的钥匙是 **masked self-attention**：每个位置只能 attend 到自己和之前的 token，与推理时的因果设定一致。

### [0:10–0:15] 损失函数：从最大似然推导 cross-entropy，以及 BPB

- 形式化：输入 x1…x(t-1)，求 pθ(xt | x<t)；目标 = 最大化模型看到训练数据的概率 pθ(x1…xn)。
- 链式法则拆成 ∏ pθ(xt|x<t)；连乘容易下溢 → 取 log 变求和；ML 习惯最小化 → 加负号；再除以 token 数 T 去量纲 → 得到 **cross-entropy loss**。别背公式，从「最大似然」第一性原理推即可。
- 变体 **Bits Per Byte(BPB)**:cross-entropy 的绝对值依赖 tokenizer，不同 tokenizer 的模型之间不可比；BPB 把损失 × tokens/bytes × 1/log2，变成**无关于 tokenizer 的比特单位**，才可跨模型对比。
- 学生问：mask 是否只属于 decoder?——本讲是 decoder-only；encoder-only 不能这样逐 token 预测，相关玩法留到 Lecture 8。

### [0:15–0:20] 预训练数据：规模、重复与配比

- 语料规模在 **数万亿 token** 量级，GLM-5 用了 30T;infra 细节留给 Lecture 5。
- **数据受限场景下可以重复数据**：data-constrained regime 的研究表明同一 token 重复训练**最多 4 个 epoch 仍有收益**，之后该去扩数据而非硬重复。
- **DataComp-LM**：固定架构归一化，专门剥离「数据质量」对性能的贡献，避免把架构红利误记在数据头上。
- 配比方法：训多个小模型跑不同 mixture(20% 代码 / 50% web 之类)，用小模型表现反推大模型的最优配比；Olmo 3 的数据管线图说明数据准备是重度工程。
- **knowledge cutoff**：预训练数据截止日期写进 model card(如 GPT-6 Astra 到 2026-04-30)，截止之后的事模型一无所知——后面会讲绕过手段。

### [0:20–0:30] midtraining 与长上下文训练(YaRN)

- **midtraining**：仍做 next-token prediction，但换**更高质量、更贴近目标用例**的数据(想推理就多喂代码和数学)；它与 SFT 的区别是**没有 prompt→answer 的行为塑造**，仍然只是语料预测。
- 预训练出于效率通常只用**几千 token 的序列**，但真实输入可达几万到几十万 token；不处理的话模型**没见过长序列对应的 RoPE 旋转角**，会犯迷糊。
- **YaRN 等 RoPE 扩展**：把长位置差**插值到短上下文训练时见过的频率范围内**；目标长度是**预先规划**的(GLM-5:4K → 128K/200K)，插值后的频率也沿用到推理。
- 为什么难：①self-attention 是 O(n²)，序列拉长计算爆炸；②很难找到「远距离依赖」的真实数据(前文信息真的被用于远处的预测)——这类样本需要专门构造。
- **curriculum learning**：按阶段循序渐进安排训练内容，而非一步到位。

### [0:30–0:40] SFT：从只会补全到助手行为

- 问「Can I put my teddy bear in the washer?」——只做过预训练的模型不会回答，而是**续写**：「Teddy bears are often made of materials like polyester and cotton…」。它学的是文本分布，不是有用性。

- **Supervised Fine-Tuning** 用 **instruction/response 对**,loss 只算在**答案的 token** 上——输入 prompt 不惩罚(那是给定条件)，这等价于把 loss 局部化到 response 区间；目标函数仍是 next-token prediction + cross-entropy。
- 与 midtraining 的分界：SFT 是「给 x 模仿 y」的**行为改变**，midtraining 是「换更好的语料」。
- 数据量级：极专用用例几百~几千条；通用助手百万量级——都比预训练低若干个数量级。
- SFT 后模型答「No, it might get damaged, try hand-washing instead」——已经像助手，但语气、风格还想再调 → 引出偏好对齐。
- SFT 三大挑战：①**数据质量要求极高**，模型会精确复刻你教的行为；②**prompt 分布失衡**会让模型在某些问法上偏置，伤泛化与评估；③全参数微调的计算代价(下一节解决)。

### [0:40–0:45] LoRA：低秩适配的参数高效微调

- 动机：模型已装满知识，SFT 只是在**转向**，不需要动全部几十亿参数的自由度。
- **LoRA(Low-Rank Adaptation)**：把权重更新分解为 W0(冻结的预训练权重)+ BA(低秩可调矩阵)，训练参数量骤减，性能却大致持平(取决于数据与任务)。
- **存储红利**：每个用例(spam / sentiment / translation)只存自己的 B、A，W0 全局共享一份——否则每个用例都要存整套权重。
- 位置：原作者建议放在 **self-attention** 的矩阵上；最新共识是 **FFN 里的矩阵也要加**——那是算力与参数最密集的地方，收益更大(推荐 Thinking Machines 的文章)。
- 学生追问澄清：通用助手不会为每个问题切模型；LoRA 适合极定制的用例；微调一次然后反复复用，比每次都在 prompt 里塞长指令更省成本。

### [0:45–1:00:00] 偏好数据与 reward modeling(Bradley-Terry)

- 新问题：SFT 只教了「该做什么」，没教「**不该做什么**」；「建议你别陪泰迪熊了」这种回答合规但不合心意。
- 数据形态：每个 prompt 配一条 **chosen**(正面)与一条 **rejected**(负面)。选 pairwise 是因为**人类做相对判断远比绝对判断容易**。
- 三种收集方式：**pointwise**(绝对打分，难)、**pairwise**(二选一，主流)、**listwise**(整列排序)。
- 额外红利：模型 misbehave 的案例反过头帮我们**审计 SFT 数据**——是不是混进了不想要的数据；且偏好调优对 prompt 分布**没有 SFT 那么敏感**。

- **RLHF(Reinforcement Learning from Human Feedback)** 两段：先用人类偏好数据训 **reward model** 学会分辨好坏；再用它当裁判做 RL 对齐 LLM。本讲只讲直觉，数学留到 L4。
- **Bradley-Terry formulation**:P(yw ≻ yl) = σ(rw − rl)，偏好概率 = 两个 reward 差的 sigmoid(σ 趋 −∞ 为 0、+∞ 为 1)。
- 训练推导与 cross-entropy 同构：最大化「winning 被偏好」的概率 → 取 log(单调、防下溢)→ 变最小化 → **loss = −log σ(rθ(x,yw) − rθ(x,yl))**，对所有偏好对求期望。
- reward model 架构两种：①**decoder-only backbone 取最后一个 token 的表示**接分类头；②**encoder-only** 模型直接打分；两者皆可。
- 学生问 E 是什么：是**对全体数据的期望**，可理解为求和或平均。

### [1:00:00–1:10:00] RLHF 的 RL 阶段与 DPO

- 冻结 reward model,**只更新 LLM 的权重**(LLM 从 SFT checkpoint 初始化);prompt → 模型生成 → reward model 打分 → 用分数更新 LLM。
- 目标函数两股张力：**最大化 reward** + **别偏离 reference model 太远**(KL 惩罚项)——因为 reward model 不完美，防止模型被带偏太远回不了头；RL 观测数据量比 reward model 的训练数据大几个量级。
- **reward hacking**：模型钻 reward model 的空子，迎合打分器却没真正变好——这正是要「别偏离太远」的另一个理由。
- 权重具体怎么更新(PPO 之类)留给下一周。

- RL 太复杂(要 reward model、调超参、两阶段);**DPO(Direct Preference Optimization)** 用监督学习一步到位，loss 形式与 reward model 的 pairwise loss 高度相似。
- 关键代换：令 r = β·log(π_模型/π_reference)，则拉大 rw − rl 等价于——**调高 winning 相对 reference 的概率**、**压低 losing 相对 reference 的概率**，完全不需要显式 reward model。
- π 就是 policy(策略)的符号，是 RL 术语，下一周正式展开；reference model 就是**起点那个 SFT 模型**。
- 效果示例：同样的问题，偏好调优后的模型答「It's better not to. Your teddy could get hurt! A gentle hand wash is safer.」——语气更友好。
- **RLHF vs DPO 对比**：RLHF 两阶段、要训多个模型、算力重；DPO 是监督式、更省事，但**在固定数据上训练 = off-policy**，模型自己生成的输出没有参与 loss——这个问题下一节正面处理。

### [1:10:00–1:25:00] Reasoning：可验证奖励、GRPO 与 on-policy distillation

- reasoning 定义：**解决问题的能力**(与知识问答相对)；例：问课程代码是查记忆，问「熊 2020 年出生现在几岁」需要推理。
- Chain-of-Thought(L2)靠 few-shot 示例**引出**推理链，但每次都要在 prompt 里说；目标是让模型**自主**先想再答。
- 时间线：2024-09 OpenAI 率先用此类方法在数学/代码上涨分；**DeepSeek-R1(2025-01)是第一个公开「怎么训」的开源权重模型**，其论文是 reasoning 训练的第一次完整披露。
- 现在几乎全是 reasoning 模型，UI 只剩 **thinking effort** 一个开关；推理链含用户对话信息与训练价值，厂商既怕泄漏隐私也怕被别人拿去蒸馏，所以 2025 年后默认不再展示完整 chain(曾有论文用 API 玩花招恢复出完整推理链)。
- **reasoning token 计费**：推理链是 output token 的一部分，预算有限时要记得为「看不见的思考」付钱；模型自己会判断哪些 prompt 值得多想。

- 与偏好 RL 的区别：数学/代码的答案**客观可验证**(数学对 ground truth、代码跑 test cases)，不需要 reward model——**verifiable rewards**。
- reward 设计：答案正确 + 输出包含 reasoning tokens，两项叠加。
- **GRPO(Group Relative Policy Optimization)** 直觉(数学在 L4)：同一 prompt 采一组回答，算**advantage**(相对组内好坏)，好的多做、差的少做，同时惩罚偏离 reference——与 RLHF 同一套心智模型，只是奖励源换成了可验证的 ground truth。
- 训练动态：RL step 越多性能越高，**推理链长度也随之越来越长**。

- 核心权衡：①**sequence-level reward**(RLHF/GRPO)是 on-policy 但**稀疏**——整条输出只有对/错一个信号；②**token-level 信号**(如 SFT 类方法)是**稠密**但 **off-policy**——训在模型自己不会生成的序列上，分布有偏。
- **on-policy distillation** 两全其美：学生模型自己生成序列，**teacher 对每个 token 给出它的预测分布**，逐 token 惩罚师生偏差——既 on-policy(用的是学生的生成)又稠密(token 级)。
- 变体：**on-policy self-distillation**(没有现成 teacher 时，用同一个模型但把答案告诉它，让它「带着答案」示范)；还有**专项 teacher** 组合——数学一个、工程一个，对学生做稠密监督。
- 已成为多数 frontier 开源模型的标配组件。

### [1:25:00–1:40:00] 实战全景：GLM-5 技术报告逐阶段拆解

- **Artificial Analysis Intelligence Index**：把各家 benchmark 聚合成单一智能分，便于排名；开源模型通常略落后闭源前沿，但**公开配方与权重**，是最好的学习材料；GLM-5 是本节的技术报告范本。
- 预训练数据：**Common Crawl** 起步(全网都有，但 AI 生成污染严重)，启发式过滤后**通常只剩约 1%**；Wikipedia 等权威源补主线知识，长尾事实需专门策展；代码(GitHub 系)从预训练就进——**agent 本质是换着花样的代码问题**；论文/数学/科学语料补 reasoning 底子。
- GLM-5 数量级：预训练在 **~4K 上下文**；分两段——先纯 web 学语言结构，再混入代码 + reasoning(web 退居次要)。

- 预训练喂 batch 的方式很粗暴：**切 chunk、把文档拼起来填满上下文**，batch 未必以 BOS 开头——目的只是学语言，不是产出成句。
- **model collapse**：真实分布的长尾在有限采样里注定捕捉不全，加上模型本身只是近似器，输出分布必然退化；再叠加人类偏好后期注入的词频失真("load-bearing"、"byte-identical" 这类词被严重过表示)——所以开头的数据策展是生死线。
- epoch 数：常见约 1；高质量数据(过分类器的)可以多跑几轮。

- GLM-5 的 midtraining 目标很纯粹：**拉长上下文**；数据换成长文本形态——代码用 **PR + issue + diff**(天然长)，整本书也放得下了；并借合成数据缓解 **context rot**(把事实埋在长文中间、后文回指它)。
- 打包策略从「切 chunk 硬拼」升级为 **best-fit packing**：文档尽量完整装箱，塞不下就 padding；目标长度仍分阶段递进。
- SFT：质量再上台阶、token 量级再骤降；注入大量 reasoning + 代码数据；**tool call 前插 reasoning** 的样本、**think tokens**(隐藏草稿区，计费但不可见)都在这一步铺垫；loss 只算答案，不算用户输入。

- GLM-5 把 RL 拆三块：**reasoning RL**(数学竞赛类，答案可验证)、**agentic RL**(模型进 harness,跑测试验证——如修 bug 让 fail 变 pass)、**general RL**(更开放:instruction following、专家标注的「什么叫有帮助」、任务特定质量)。
- 机制与前面一致：生成答案 → 按结果上/下调 token 概率；细节在 L4。
- **on-policy cross-stage distillation**：防「多阶段训练把学过的能力练丢」——用 **SFT 后 checkpoint** 与**第一段 RL 后 checkpoint** 当 teacher，对学生做 token 级蒸馏。
- 两个延伸观察：①开源技术报告的「secret sauce」未必全写出来，业内也确有互蒸馏的指控——保持批判眼光；②**Pi coding agent** 的启示：模型 reasoning 越强，harness 越薄，harness engineering 的需求会持续下降；reasoning 训练已经外溢到数学前沿(OpenAI 最近公布了若干 open problems 的解)。

---

## 核心概念速查

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| Teacher forcing | 不管模型预测了什么，下一步永远喂真实 token；配合 masked self-attention 全并行 | 本讲预训练节 |
| Cross-entropy loss | 由最大似然推导：-1/T·Σ log pθ(xt\|x<t);BPB 是去 tokenizer 依赖的 bits 版 | 本讲推导 |
| YaRN | 把长位置差插值进短上下文见过的 RoPE 频率范围，支撑 4K→128K/200K | 本讲 midtraining 节 |
| SFT | instruction/response 对上做行为对齐；loss 只算答案 token，不算 prompt | 本讲 |
| LoRA | W=W0+BA 低秩分解；FFN 矩阵也要加；每任务只存 delta,W0 全局一份 | LoRA 作者 + Thinking Machines 文章 |
| Bradley-Terry | P(yw≻yl)=σ(rw−rl)，配 −log σ(·) pairwise loss 训 reward model | 本讲 reward modeling 节 |
| RLHF | 冻结 RM 做 RL：最大化 reward + KL 惩罚偏离 SFT reference；防 reward hacking | 本讲 |
| DPO | r=β·log(π_模型/π_reference) 代换后变监督学习，无需 reward model;off-policy | DPO 论文 |
| GRPO / verifiable rewards | 数学对 ground truth、代码跑测试；同 prompt 采一组按相对 advantage 更新 | DeepSeek-R1 |
| On-policy distillation | teacher 逐 token 监督学生的自生成序列，稠密 + on-policy 两全 | 本讲 reasoning 节 |

## 自测题(先遮住右侧再答)

1. 为什么预训练可以「一次喂整段、同时预测所有下一 token」?这个技巧的正式名称是什么?
   > teacher forcing + masked self-attention：每位置只 attend 自己和之前，整段并行算 cross-entropy，本质是一次大矩阵乘法。
2. cross-entropy loss 是怎么从「最大化模型看到训练数据的概率」推出来的?为什么要再定义 BPB?
   > 链式法则拆连乘 → 取 log 防下溢 → 加负号变最小化 → 除以 T 去量纲；BPB 把损失换算成 bits/byte，消除 tokenizer 差异，才能跨模型对比。
3. midtraining 与 pretraining、SFT 各差在哪一件事上?长上下文训练为什么需要 YaRN?
   > midtraining=换更高质量/更贴用例的数据仍是纯语料预测；SFT=instruction→response 的行为塑造且 loss 只算答案；YaRN 把长位置差插值进短上下文见过的 RoPE 频率范围，否则模型没见过那些旋转角。
4. LoRA 的参数分解怎么写?最新共识把它加到哪些矩阵上?存储上省在哪?
   > W=W0+BA，B、A 低秩可调、W0 冻结；除了 attention 矩阵，FFN 里的矩阵也要加(参数与算力最密集)；每个任务只存自己的 BA，delta 级别，W0 全局一份。
5. 为什么偏好数据用 pairwise 收集?Bradley-Terry 怎么把「偏好」变成可训练的量?
   > 人类做相对判断比绝对打分容易；P(yw≻yl)=σ(rw−rl)，对偏好对最小化 −log σ(rθ(x,yw)−rθ(x,yl))，即以成对比较训练 reward model。
6. RLHF 的 RL 阶段里谁冻结谁更新?目标函数为什么带「别偏离 reference」的惩罚?reward hacking 是什么?
   > reward model 冻结、只更新 LLM(从 SFT checkpoint 初始化)；因 reward model 不完美，惩罚偏离防止被带偏太远；reward hacking=模型迎合打分器却没真正变好。
7. DPO 如何不用 reward model 完成同样的对齐?它与 RLHF 的 on/off-policy 差异是什么?
   > 代换 r=β·log(π_模型/π_reference)，loss 变成监督式：调高 winning、压低 losing 相对 reference 的概率；DPO 训在固定输出上=off-policy，RLHF 用模型自己生成的输出=on-policy。
8. GRPO 与 RLHF 的奖励源差在哪?on-policy distillation 又补上了什么两难?
   > GRPO 用可验证奖励(数学对 ground truth、代码跑测试)无需 reward model，同 prompt 采一组按相对 advantage 更新、贴着 reference;distillation 让 teacher 对学生自生成序列逐 token 打分，兼顾稠密与 on-policy。
