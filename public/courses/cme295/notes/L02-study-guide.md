# CME295 Lecture 2 学习笔记：Large Language Models

> 讲者 Afshine & Shervine Amidi ｜ 配合视频 `lectures/L02-large-language-models [GaIeu3npx04].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L02-transcript.md](L02-transcript.md)

---

## 一句话概览

**本讲回答「从 transformer 原型到今天的 LLM，架构上到底改了什么」**:encoder/decoder 拆开玩出了三条路线，BERT（双向理解、需微调）与 GPT（自回归生成、一切皆 text-to-text）对决中 **decoder-only 笑到最后**；规模换性能有 **scaling law** 与 Chinchilla 的 20 tokens/parameter 配比，规模太大就靠 **sparse MoE** 让参数按需上班；五大现代组件（**RoPE** 位置编码、**sliding window**、**GQA**、**pre-norm**、**RMSNorm**）给 attention 与 norm 减负；解码侧 **greedy/beam 的确定性缺陷**引出 **temperature / top-k / top-p**，最后是不改权重的涨分三件套 ICL / **CoT** / self-consistency。

---

## 分节要点（带时间锚点）

### [0:00] Recap：transformer 的两半，以及拆开玩的两种玩法

- 上讲回顾链：模型不懂文本只懂数字 → **tokenization**（如今主流是 subword,词表大小与序列长度的折中）→ **embeddings**（Word2Vec 无上下文）→ **RNN**（循环结构会遗忘过去）→ 2017 **Attention is All You Need** 弃用循环、改用直连，用 query/key/value 让每个 token 决定该 attend 谁。
- 原版 transformer 两半：**encoder**（左，为输入文本算 meaningful embeddings,机器翻译里即源语言）与 **decoder**（右，autoregressive 一次生成一个 token,同时 attend 已生成的 token 和 encoder 的输出）。
- 本讲主线问题：机器翻译上这么强，别的领域能不能吃到红利？——做法就是把架构拆开试：**只留 encoder 会怎样？只留 decoder 会怎样？**

### [0:05] BERT:encoder-only 的「先理解、再微调」路线

- **BERT**(2018)= Bidirectional Encoder Representations from Transformers：只留 encoder，靠 multi-head self-attention 让**所有输入 token 互相 attend**（双向，名字由此来）。
- **CLS token**：序列最前面的特殊分类 token；因为自注意力全连通，它的 embedding 与所有 token 都交互过，可当**整句表示**用——投影到类别就做情感分类；取某个具体 token 的 embedding 也能做词性标注这类 token 级任务。
- 训练分两步：**pre-training**（proxy task,教模型「文本是怎么写的」,贵、只做一次）→ **fine-tuning**（拿小标注集把表示投影到具体任务，如 positive/negative）。
- Proxy task 之一 **MLM(Masked Language Modeling)**：随机选 token 把输入「弄坏」（实际 mask 策略更复杂，为的是不引入 bias），让模型用上下文还原被 mask 的原词——学的是**token 怎么放**。
- [0:10] Proxy task 之二 **NSP(Next Sentence Prediction)**：输入两句话，判断它们是否真的前后相连（正样本取真实连续句对、负样本乱配）——学的是**句子怎么排**，把理解从句子级提升到文档级。
- Pros：性能好；自注意力双向；fine-tuning 所需标注数据很少。Cons：fine-tuning 本身是必须做的工程量；而且 encoder-only 模型**怎么生成文本并不直观**（lecture 8 会讲其实可以，先按下不表）。

### [0:15] GPT:decoder-only 的 text-to-text 路线，笑到最后

- **GPT**(Generative Pre-trained Transformer)与 BERT 大致同期：只留 decoder，**任何任务都写成 text-to-text**——输入一段文本，唯一工作就是预测下一个 token，一次一个，即 **autoregressive decoding**。
- 情感分析示例：直接把「这句话是正面还是负面？」连同推文一起喂进去，模型自己答 positive/negative——**fine-tuning 非必需**（想让模型更好才做），这是它天生的吸引力。
- 与 encoder-decoder 的两点区别（都是生成文本时）：①**输入待遇不同**——enc-dec 的输入进 encoder，token 之间纯双向互看(bidirectional)；decoder-only 的输入只许看自己之前的 token(**causal attention**)。②decoder-only **不对输入做任何特殊处理**（不用额外的 encoder），机器翻译里源/目标分明尚有道理，纯文本生成场景「什么算输入」本来就模糊——所以它更简单、更通用。
- 行业裁决：两条路线都被人认真试过，生成文本的场景 **overwhelmingly 收敛到 decoder-only**，活到今天。
- 总括两大范式：**要么算好 embedding 再 fine-tune 到用例，要么把一切问题写成 text-to-text**（能不能高效是另一个问题）。

### [0:20] Scaling laws:FLOPs 之辨与「大模型更省 token」

- 为什么叫 LLM：**LM** = language model，给 token 序列分配概率、预测 next token 的模型；**L** = large，参数十亿到千亿甚至万亿级、训练数据数百亿到数十万亿 token、外加海量 GPU。
- decoder-only 的 backbone 长这样：原 decoder 里与 encoder 交互的 **cross-attention 也一并删掉**，只剩 **causal multi-head attention**（token 通信的地方）+ **feedforward network**（计算所在）。
- **Kaplan et al. 2020**：性能(test loss)随训练 token 数、模型大小、算力呈**幂律**可预测地变好；且**模型越大越 token-efficient**——达到同样性能所需的训练 token 更少（图上越亮的模型曲线越早下降）。于是 2020-2022 年大家一路堆参数堆数据。
- 易混单位：**FLOPs**（floating point operations,小写 s 是复数，衡量**计算量**,训练 LLM 约 10^25）vs **FLOPS / FLOP/s**（大写 S 或 /s,衡量**硬件计算速度**）——一字之差两个物理量。
- [0:25] **Chinchilla(Hoffmann et al. 2022)**：算力有限时，模型大小与训练 token 数之间存在 **sweet spot**；并发现当时模型普遍 **undertrained**（相对训练量来说模型太大）；实证：同一算力预算下，**70B 参数 × 1.4T token 的小模型打败了训得更少的大模型**；经验配比约 **1 个参数配 20 个 token**，此后人人回头检查自己 compute-optimal 没有。
- 两个边界补充：①数据质量——pre-training 阶段**规模比质量重要**，质量的重要性要到后训练(lecture 3)才凸显；②compute-optimal 只管训练，**生产环境高并发推理还有「模型别太大」的独立激励**。
- （课堂确认：损失就是 next token prediction 的 **cross-entropy**。）

### [0:30] MoE：让参数「按需上班」，绕开全员前向的开销

- 动机（教室类比）：问一个数学问题，不必问全班，只问数学专家——**每个输入未必要激活全部参数**，这样就能放大模型规模而不支付每次 forward 全量计算的成本。
- **MoE(Mixture of Experts)** 结构 = 一组 **experts**（数学家/物理学家/生物学家……）+ 一个 **gate/router**（决定给定输入该用哪些专家、用到什么程度）。
- **dense MoE**：激活所有专家、只是加权不同（数学题给数学专家高权重）——但参数还是全动了，**不省算力**；**sparse MoE**：router 只选 **top-k** 个专家激活（k=1、2、…固定），输出 = 被选中专家输出的 gate 加权和。LLM 语境下真正有用的是 **sparse**。
- MoE 放进 decoder-only 架构的哪一层？——**FFN 层**：计算都在这里；attention 层是 token 通信的场所，不做表示计算（有学生反问「为什么不把 attention 的各 head 当专家？」——讲到 GQA 时会回应「并非所有 head 都有用」,但 MoE 惯例是换 FFN）。
- [0:35] **routing collapse**：训练时模型倾向只依赖一小撮专家——早期被选中的专家先被更新、越来越好，没被选的一直闲置，「富者愈富」，有效模型尺寸缩水。解法：**load balancing auxiliary loss**，激励各专家分到的 token 比例趋近均匀。技术细节：top-k 离散选择不可导，用 **stop-grad** 把「路由到专家 i 的 token 比例」当常数，只对 routing probability 反传。
- 路由是 **token 级**的：输入句子里每个 token 各自决定去哪个专家。
- [0:40] **Mixtral of experts**(2024)可视化：每层把 token 按所去专家着色，颜色多样 = 专家利用充分。2026 年现状：frontier 开源 MoE 的专家数是**几百量级**（如 384、256），每次 forward 激活约 **8** 个；普遍加 **shared expert**——无论 router 选谁都必激活，承担「每个 token 都需要的通用计算」，免得所有专家都从零学一遍基础再特化。
- Chinchilla scaling law 是**稠密模型**上得出的；MoE 作者若认为自己的设计差异大，会自己跑小规模实验定标出适配自家架构的 law 再选参数。

### [0:45] 位置编码：自注意力天生「失忆」位置

- self-attention 全员直连，token 顺序信息被抹掉——必须显式注入位置。原论文试了两条路，性能大致相当（但确定性公式更优，也是本讲重点）。
- **方案一：learned position embeddings**——每个位置索引学一个 embedding，加到 token embedding 上。缺陷：推理时遇到**比训练更长的序列**，没见过的位置根本没有 embedding，无法外推。
- **方案二：deterministic 公式(sinusoidal)**——不用学、任意长度都能算，这才是值得展开的设计。
- [0:50] **时钟类比**：时针粗略定位、分针更细、秒针最细，三根不同频率的针合起来唯一定指一个时刻。sinusoidal PE 同理：位置 m 的第 2i 维取 sin(ωᵢ·m)、第 2i+1 维取 cos(ωᵢ·m)；**i 小 → 高频（随位置变化快），i 大 → 低频（变化慢）**——高频维度区分邻近位置，低频维度编码全局位置。
- **点积的漂亮性质**：cos(a−b)=cos a·cos b+sin a·sin b，逐维套用，两个位置 embedding 的点积 = Σᵢ cos(ωᵢ(m−n))——**只依赖相对距离 m−n**；cos(0) 最大，所以**相同位置相似度最大、近处高、远处低**（右边相似度矩阵沿对角线最亮）。
- [0:55] **加性 PE 的致命缺陷**：位置 embedding 加进 token embedding 后被**所有层**处理；但位置信息只有 attention 层需要（判断谁和谁相关），FFN 根本不该关心 token 在位置 5 还是 12——同一句话放在文中位置 1 或 24 都完全合理。所以人们要找**只作用于 attention 层**的「外科手术式」方案。
- （学生疑虑「远 token 交互变弱，不是 RNN 的老毛病吗？」——直接连接仍在、只是相对重要性衰减：长文档里同句内容大概率比十页开外的内容更相关，但仍保留交互的机会。）

### [1:00:00] RoPE：把位置编码做进 attention 的旋转

- 两款过渡产品：**T5 bias**——在 softmax 内部学一个随距离变化的 bias 项(attention 公式 softmax(QKᵀ/√d)·V 里加东西)，缺陷与 learned PE 同源：要学、训练数据自带距离偏置、不能外推到任意距离；**ALiBi**(Attention with Linear Biases)——bias 随距离线性衰减，不用学，但也不是今天的主流。
- 今天的主流是 **RoPE(Rotary Position Embedding)**：不加 bias，**直接按各自位置旋转 query 和 key**。
- [1:05:00] 2D 推导：向量 [r·cosθ, r·sinθ]ᵀ 左乘角度 φ 的旋转矩阵，得 [r·cos(θ+φ), r·sin(θ+φ)]ᵀ——**乘旋转矩阵 = 旋转向量**。让 q 按其位置 m 旋转、k 按其位置 n 旋转，两者内积时两个旋转**合成为角度 n−m 的旋转**——注意力分数只依赖**相对距离**。
- 好处：什么都不学、可外推到任意位置；qk 点积随距离**大致衰减**（非严格单调，但趋势正是「远的 token 相关性弱」）。
- d 维推广：把维度切**成对的 2D block**，每 block 各自做旋转，角度是维度索引的函数——又是「低维高频、高维低频」。
- 总结对照：原始 transformer 用**加性**位置编码（进所有层），如今主流 **RoPE**（只动 attention 里的 q/k）。

### [1:10:00] attention 减负与 norm 现代化：sliding window、KV cache、GQA、pre-norm、RMSNorm

- **sliding window attention**(= local attention)：每个 token 只 attend 自己前方窗口内的 token，不全员互看，省计算。直觉疑虑同前（RNN 遗忘重现？）——答案是**多层堆叠**：每层窗口 w，顶层 token 经层层中转能间接看到约 L·w 之外的信息；类比 CNN 的 **receptive field**。
- [1:15:00] **KV cache**：每预测一个 token，都要拿它的 query 对**全部历史 token** 的 keys 做匹配——keys/values 每步重算太浪费，**解码过程中缓存下来复用**。代价：KV 随解码变长持续膨胀，且 attention 是 multi-head 的，**每个 token 每层要存 h 份 K/V**——这就是「给 KV 挤水」的全部动机。
- **MQA**(multi-query)：所有 head 共享 **1 组** KV；**GQA**（grouped-query,更常用）：分成 g 组共享 KV；对照原版 **MHA**：每个 head 独立学习 K/V 投影。**query 不用省**——用一次就丢，只有要反复缓存的历史 KV 值得省。如今标配组合：**RoPE + sliding window + GQA**。
- **post-norm → pre-norm**：原 transformer 是 LayerNorm(x + Sublayer(x))（先残差再归一化）——x 被卷进 norm 里，违背了残差连接「让梯度直通」的设计初衷；如今是 **pre-norm**:x + Sublayer(Norm(x))，先归一化再进子层、残差通道保持干净。
- **LayerNorm → RMSNorm**:LayerNorm 要 recenter（减均值）再配 γ 缩放、β 偏移，帮训练稳定收敛；**RMSNorm**(Root Mean Square)只做 rescale、**不 recenter**，只学 **1 个**参数——效果一样好、更省。
- 本讲架构 checklist（如今 decoder-only 的默认配置）:**RoPE、local attention(sliding window)、GQA、pre-norm、RMS norm**。

### [1:20:00] 解码与采样：greedy/beam 的确定性问题、temperature、top-k/top-p、guided decoding

- 生成流程：decoder 堆 n 层 → 线性投影到词表 → 得到下一个 token 的**概率分布** → 怎么选？
- **greedy**：每步取 argmax。弱点：逐步局部最优 ≠ 整条序列**联合概率**最优。
- **beam search**：不算完整联合概率（太贵），始终跟踪 **k 条**最优路径，每步保留 k 个最好的候选继续。弱点：计算更多；且与 greedy 共享一个更根本的问题（课堂提问引出）：**deterministic**——同样输入永远同样输出。
- 确定性为什么对用户是坏事：每次问候都得到一字不差的回答，chatbot 显得 **robotic**、像重度工程产物（讲者补充：这是思想实验——实际部署里 context 会随时间等信息变化，不完全严格成立，但 robotic 感确实存在）。
- [1:25:00] 非确定性路线：回到概率分布**直接采样**。**top-k**：只在概率前 k 个 token 里采；**top-p**(nucleus)：在累积概率达到 p 的最小候选集里采。
- 什么时候**需要**确定性：要可复现的任务——摘要（每次同样输出）、**LLM as a judge**（评分要一致，后续 evaluation 课细讲）；其余场景非确定性路径更有吸引力。
- **temperature T**：线性层输出经 softmax 成分布，T 是 softmax 里的调节旋钮（连续、非开关）。**T→0：分布 sharpen**，最大 logit 的项概率趋近 1、其余趋近 0;**T→∞：分布趋 uniform**（exp 里指数被压平）;T=1 是标准 softmax。
- T=0 就完全确定了吗？理论上是（权重固定、运算固定），**实践否**：推理引擎会把你的请求与别人的 **batch** 在一起，**浮点加法不满足结合律**——先加大数再减掉 vs 分开算，结果可以不同；**batch invariance** 并不总被实现保证（推荐 Thinking Machines 的博客，讲了原理和怎么写满足不变性的 kernel）。
- [1:30:00] **guided decoding**：工业场景要结构化输出（如 JSON），格式错了下游解析就炸；只 prompt「用 JSON 格式」如今的模型大多能成但**不是 100%**；guided decoding 按**目标语法约束每一步可预测的 token 集合**（JSON 就必须先出特定符号……），拿到 100% 合法输出。

### [1:35:00] context window 的边界与不改权重的涨分：ICL、CoT、self-consistency

- prompting 词汇：**prompt** 是用户输入，模型 autoregressive 逐 token 续写；**context window** = 每步 next token prediction 的输入——**不只是用户输入**，已生成的 token 也要放回输入端，所以窗口大小与输出长度联动，别看到大数字就以为能随便塞。
- 数量级：input 上下文 ~**1M token**（行业标准）、output ~**100k**（讲两天前刚被新模型改写，输出可能也进百万级）；换算直觉：1 token ≈ 3/4 个词、一页 ≈ 500 token,**100k ≈ 一本书，1M ≈ 大部头**。
- 为什么不该无限上下文：**context rot**——**needle in a haystack** 测试（把关键信息埋进超长上下文再要求检索）显示**上下文越长、检索越难**；部分是模型自身问题，部分是概念性的：信息混在海量噪声里，精确检索本身就不现实。所以「多塞 input = 推高风险上升」，**context compaction、适时开新对话**仍是好实践。
- [1:40:00] **in-context learning**：不改权重，在 prompt 里给**示例 + 答案**教模型——zero-shot vs few-shot；模型学到的是格式甚至隐式推理路径。代价：示例占 input token，推高成本与延迟；且如今 **reasoning models 越来越强，few-shot 用得越来越少**（容易过拟合到给定的具体示例）；**prompt tuning** 的思路就是把示例提炼成手工指令。
- **Chain of Thought**：ICL 的进阶——few-shot 示例里把**推理路径**也写出来，作者发现模型学到了推理方式、整体性能提升；注意 CoT 不只是 ICL 技术之一，reasoning models 的 thinking token 是同一思想的内化（后续 reasoning 课细讲）。
- **self-consistency**：同一道题生成**多条推理路径**，再 **majority voting** 取多数一致的答案——让算术类输出更稳定。

---

## 核心概念速查

| 概念 | 一句话定义 |
|---|---|
| BERT(encoder-only) | 双向自注意力 + CLS token 当句表示；MLM/NSP 两个 proxy task 预训练，下游需 fine-tuning |
| GPT(decoder-only) | causal attention + next token prediction；一切任务皆 text-to-text,fine-tuning 非必需 |
| Chinchilla compute-optimal | 算力有限时模型大小与 token 数有 sweet spot，约 **1 参数 : 20 token**；当时模型普遍 undertrained |
| Sparse MoE | router 在 **FFN 层**按 token 选 top-k 专家激活；常配 shared expert + load balancing aux loss 治 routing collapse |
| Sinusoidal PE → RoPE | 加性确定性公式(点积 = Σcos(ωᵢ(m−n)))演进为只旋转 attention 里的 q/k，内积只依赖相对距离 |
| Sliding window attention | 只 attend 窗口内 token；多层堆叠下有效感受野 ≈ L·w（CNN receptive field 类比） |
| KV cache 与 MQA/GQA | 解码时缓存历史 K/V；MQA 全头共享 1 组 KV，GQA 分 g 组共享；query 用完即弃不用省 |
| Pre-norm 与 RMSNorm | 先归一化再进子层、残差通道干净；RMSNorm 不 recenter、只学 1 个参数 |
| Temperature / top-k / top-p | T→0 sharpen、T→∞ 趋 uniform;top-k 取前 k 个、top-p 取累积概率达 p 的候选集 |
| Context rot | 上下文越长 needle-in-a-haystack 检索越难；context window 含已生成 token，与输出长度联动 |
| ICL / CoT / self-consistency | 示例教格式与推理 / few-shot 里写推理路径 / 多路径 majority voting——全都不改权重 |

## 自测题（先遮住右侧再答）

1. BERT 的预训练用了哪两个 proxy task?各自教模型什么？下游怎么用？
   > MLM：随机 mask token 用上下文还原，学「token 怎么放」；NSP：判断两句是否连续，学「句子怎么排」（文档级）；预训练后取 CLS embedding 加投影层，用小标注集 fine-tune 到具体任务（如情感分类）。
2. decoder-only 与 encoder-decoder 都能自回归生成，两点关键区别是什么？行业为什么收敛到 decoder-only?
   > ①输入待遇：enc-dec 的输入在 encoder 里双向互看(bidirectional),decoder-only 只有 causal attention;②decoder-only 无需额外 encoder、对输入无特殊处理，更简单通用，故生成场景 overwhelmingly 选它。
3. Chinchilla(2022)的核心结论是什么？「undertrained」什么意思？部署时还要考虑什么？
   > 算力有限时模型大小与训练 token 数存在 sweet spot，约 1 参数配 20 token；当时模型相对训练量太大即 undertrained（同预算 70B×1.4T token 打败更大模型）；生产高并发推理还有「模型别太大」的独立激励，compute-optimal 只管训练侧。
4. MoE 应该放进 decoder-only 架构的哪一层、为什么？routing collapse 是什么、怎么治？
   > FFN 层（计算所在；attention 层是 token 通信场所）；routing collapse = 模型只依赖早期被选中的一小撮专家、富者愈富、有效尺寸缩水；用 load balancing auxiliary loss 激励 token 路由趋均匀，top-k 不可导处用 stop-grad 只对 routing probability 反传。
5. learned position embeddings 的缺陷是什么？RoPE 为什么让注意力分数只依赖相对位置、d 维怎么推广？
   > learned PE 在训练长度之外没有 embedding、无法外推；RoPE 让 q 按位置 m、k 按位置 n 分别旋转，内积中两旋转合成为角度 n−m 的旋转(2D：乘 R(φ) 即角度相加)，d 维按成对 2D block 分组、角度由维度索引决定；不学习、可外推任意位置。
6. 为什么必须缓存 KV?MHA/MQA/GQA 的区别？为什么 query 不用省？
   > 每预测一个 token 都要对全部历史 token 做匹配，K/V 重算太浪费；但 KV 随解码膨胀且每 token 每层 h 份；MHA 每 head 独立 KV，MQA 全头共享 1 组，GQA 分 g 组共享（更常用）；query 用一次即丢、只有要缓存的历史 K/V 值得省。
7. greedy 与 beam search 的共同弱点是什么？temperature T 如何调节分布？为什么 T=0 实践中仍不严格确定？
   > 都是 deterministic（同样输入永远同样输出），greedy 局部最优≠全序列联合最优、beam 多花计算；T→0 分布 sharpen（趋 one-hot）、T→∞ 趋 uniform；实践中推理引擎 batch 多请求、浮点加法不满足结合律，batch invariance 不总被保证。
8. context rot 是什么？few-shot 为什么正在被少用？CoT 与 self-consistency 各解决什么？
   > needle-in-a-haystack 显示上下文越长检索越难（模型问题+信息埋进噪声的概念性问题）；reasoning models 变强后 few-shot 易过拟合到具体示例且推高 input token 成本；CoT 在示例里教推理路径提升性能，self-consistency 多路径生成再 majority voting 稳定输出。
---


