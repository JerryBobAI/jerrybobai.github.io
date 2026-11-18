# CME295 Lecture 1 学习笔记：Transformers

> 讲者：Afshine & Shervine Amidi|配合视频 `lectures/L01-transformers [114i2Kz-LZA].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L01-transcript.md](L01-transcript.md)

---

## 一句话概览

本讲是全课程的「概念地图」：沿 tokenization → embeddings → Word2vec/RNN/LSTM 的局限 → attention → Transformer 架构 → 端到端数值走查这条线，把 2017 年 *Attention is All You Need* 的每块积木拆开讲一遍；全讲真正的核心只有一个公式 softmax(QKᵀ/√d_k)·V。讲师明说这是概念密度最高的一讲，后面所有讲次都在这副骨架上做加法与减法。

---

## 分节要点(带时间锚点)

### 一、课程定位与技术史脉络

- 讲者是一对双胞胎兄弟：Centrale Paris 本科毕业后，Afshine 去 MIT、Shervine 进 Stanford ICME 读研，先后同在 Uber、Google，现都在 Netflix；2021 年起以各种形式教这门课，成为正式 Stanford 课程后本期是第三届([0:01])。
- 三类目标受众：想走 research scientist 路线(开阔技术视野)、想做个人项目(coding agent 无处不在,得知道它擅长与不擅长什么)、以及任何岗位都在涨的 AI literacy 需求；先修只要求 linear algebra(矩阵与乘法)加 ML 基础概念(loss function、neural network、embedding)。
- 考核：无 homework，只有两次考试——midterm 考前 4 讲(约一个月后)、final 考后 5 讲，各占 50%;2025 年真题已挂在网站当 practice problems。配套教材 *Super Study Guide: Transformers and Large Language Models* 与两周前刚更新的 cheat sheet(约 15 种语言)；无正式 office hours，课后留答疑 + Ed 平台提问([0:05])。
- 课程有录像但内容逐年重写：这一版新增 post-training(如 policy distillation)、AI agents、以及 diffusion 等新一代建模范式；备考务必以今年讲义为准。
- 技术史三幕：2010s 一个 use case 一个专属模型(sentiment、翻译、NER 各训各的,RNN 当道)；2017 年 *Attention is All You Need* 提出 transformer——scalable 指加数据、加算力、加参数能换来远超以往的收益，此后大家沿模型规模与训练 token 数两个方向把它堆大；2022 年 11 月 ChatGPT 发布是产品拐点；2026 年的日常已是 coding agent，课程后半段会讲从对话助手到 agentic behavior 的演化([0:13])。

### 二、Tokenization：把文本变成模型能懂的数字

- 模型不懂文本、只懂数字，所以第一步是把文本切成「不可再分的实体」，这个切分过程叫 tokenization，切出的每个单元是一个 token([0:16])。
- 词表(vocabulary)= 所有可能 token 的集合；序列长度(sequence length)= 一段文本被切成的 token 数("A cute Teddy bear is reading" 切成 6 个)；词表大小与序列长度之间有紧密的权衡关系，直接决定 tokenizer 的选择。
- **word-level** 按空格切：简单、可解释(token 对应词)，但三个硬伤——①英文词形变化多(单复数、阴阳性)，词表爆炸；②bear 与 bears 得不到相近表示、无法共享知识；③训练语料没见过的词在推理时撞上 out-of-vocabulary([0:19])。
- **character-level** 按字符切：词表极小、彻底消灭 OOV、天然抗大小写与拼写错误；代价是序列长度暴涨——模型复杂度是序列长度的函数，算得慢，而且单个字母的 embedding 远比词抽象、不可解释([0:22])。

### 三、subword、BPE 与特殊 token

- **subword-level** 在词与字符之间折中：从训练语料学常见字母组合当 token，如 reading → "read"+"ing"。好处是词根共享(bear/bears 共享 "bear")、token 从数据里学出来；代价是多一道工序，且学出的词表高度依赖 tokenizer 训练语料——做 multilingual 应用务必让语料覆盖全部目标语言([0:25])。
- subword 是当今绝对主流；代表算法 **BPE(Byte Pair Encoding)**：从初始 token 集(如全部字母)出发，反复统计语料中最高频的相邻 token 对(如 "a"+"n" 高频共现)合并为新 token 入表，重复直到达到目标词表大小。合并学自数据 ⇒ 常见词不必拆碎 ⇒ 序列更短、推理更快([0:26])。
- 学生问 BPE 与 n-gram 的关系：两者是独立概念，n-gram 不是 tokenizer。
- 现代 LLM 词表量级约几十万(≈200,000)，需同时服务英文与其他语言；多语合一会让单语言场景序列变长(效率吃亏)，但跨语言共现的表示(如组织缩写)可能互相受益，表示质量层面利弊没有定论。
- **特殊 token**：unknown token 兜住词表外的文本；BOS/EOS 标记序列起止——生成时喂 BOS 起步、模型输出 EOS 表示说完了；padding 把不同长度序列补齐成统一长度，硬件喜欢规整的张量([0:31])。
- 记号不统一是常态：不同模型各有一套写法，user/assistant 等角色也会编成特殊 token；记住「这类 token 存在、用于传达模型该理解的元信息」即可。

### 四、Embeddings:one-hot 为什么不行，Word2vec 怎么做

- 最朴素的 token 表示是 one-hot encoding，但任意两个 one-hot 点积都是 0——完全正交，不含任何「谁跟谁相似」的信息；我们想要的是 Teddy bear 与 soft 相近、与 book 无关这种结构([0:35])。
- **Word2vec**(约 2013)用 proxy task 学表示：proxy task 不是最终目标，而是为学出好表示设的中间任务。两个版本——**CBOW** 用上下文词预测中间词；**skip-gram** 用一个词预测周围词([0:37])。
- 网络：one-hot(V 维)→ 矩阵乘到 hidden/latent 表示(D 维,D 是自选超参,通常远小于 V)→ 再乘回 V 维，softmax 归一化成概率，与 one-hot 标签算 cross-entropy loss，反向传播更新权重。
- 例：用 "a" 预测 "cute"——概率向量里 "cute" 那一维要被推向 1；换 "cute" 预测 "Teddy bear" 再来一遍，如此扫完整个语料。
- 训练完发现中间的 latent 表示「自己长出了语义」：相似 token 表示相近，还能做类比——Teddy bear之于soft，Paris之于France ≈ Berlin之于Germany([0:40])。

### 五、Word2vec 四大局限与 RNN/LSTM 的得与失

- 课堂现场答出的四个局限：①训练没见过的词无法表示；②表示维度随词表 V 涨(V 由 tokenizer 决定,非 Word2vec 特有)；③**多义词**共享同一表示——真心夸与讽刺的 cute、river bank 与银行的 bank 不加区分；④**词序无感**——The child is hugging the Teddy bear 与 The Teddy bear is hugging the child 词集合相同，embedding 完全一样([0:44])。
- **RNN** 的补法：额外维护一个 hidden state，编码「到目前为止看到的序列」的含义，每步自我更新并作为下一步预测的输入——词序信息由此进入模型；2010s 它无处不在：分类任务读到最后用状态预测 sentiment，逐词标注(名词/动词)用每个位置的表示，生成任务逐步输出([0:45])。
- RNN 死穴：**long-range dependency**——全部历史压进一个不断被改写的向量，远处的信息(如 it 指代很前面提到的 Teddy bear)捞不回来；变体 **LSTM** 加一条 cell state 专司长程携带，但没根治。
- 更深层的病灶是 **vanishing gradient**：反向传播穿长序列时梯度消失；且 RNN 必须 token 一个个串行处理，训练极慢——效果当年不错但称不上惊艳，这些共同催生了替代方案([0:50])。

### 六、Attention：给模型开「直连」

- 2010s 众多改进中，后见之明看真正胜出的是 **attention**：不再只靠 hidden state 间接携带历史，而是让模型对过去的 token 建立**直接连接**，自己学哪些连接重要，预测时重点看它们([0:52])。
- 翻译例子：英译法预测下一个法语词时，最想要的信息其实是「当前正在翻译的那个英语词」——RNN 只能经 hidden state 间接拿，attention 直接看([0:55])。
- **self-attention** 是 attention 的加强版：计算一个 token 的表示，不再以「hidden state+当前词」为自变量，而是把它表示成**序列中所有其他 token 的函数**。
- 学生当场指出：谁都能跟谁交互，词序不就丢了?vanilla self-attention 确实不知道 token 在哪，这个坑后面用 position encoding 补([0:57])。

### 七、Q/K/V 与核心公式 softmax(QKᵀ/√d_k)·V

- 三件套记号：**query** 负责搞清「我这个 token 是关于什么」，去找对构造自己表示有用的 token；**key** 是每个 token 供检索的标签；**value** 是被加权聚合的实际内容([1:00:00])。
- 流程：q(Teddy bear)与每个 k_i 做相似度(点积)得到权重，再对各 token 的 v_i 加权求和；例：问「什么最能描述 Teddy bear?」——cute 与它的点积很高，新表示就 heavily 依赖 cute。
- Q/K/V 不是手写的，是**学出来的投影矩阵**：每个 token 的输入表示分别乘 W_Q、W_K、W_V，投到 query/key/value 三个空间；公式里的 T 只是 transpose([1:03:00])。
- 矩阵化推导：所有 query 堆成 Q、所有 key 堆成 K，QKᵀ 一次算出全部两两点积 Q_i·K_j(n×n 相似度矩阵)，再乘 V 得到每个 token 的加权和——「相似度加权聚合」整个收进一次矩阵乘；softmax 把每一行相似度归一成和为 1 的权重。讲师点名：这个公式去年 midterm 考过([1:05:00])。

### 八、Transformer 架构：position embedding、encoder 与 decoder

- 名字由来：当时主流模型都是递归式(RNN)的；这篇说「不要 hidden state、不要递归，token 之间靠 self-attention 直连——attention 就够了」。论文场景是机器翻译：**encoder** 为源语言文本算有意义表示，**decoder** 拿这些表示加自己的内部 embedding 自回归生成译文([1:10:00])。
- **position embedding**：token embedding 本身与位置无关，必须另加位置信息才知道 token 在序列何处。两条路——学习式 embedding，或固定的多频率正弦/余弦函数。学习版硬伤：训练只见过 500 个位置、推理来 1000 个 token 就没辙；固定版可外推([1:13:00])。
- 多频率直觉来自手表：时针/分针/秒针各按不同频率旋转，合起来唯一确定时刻；正弦/余弦位置编码同样有「相近位置表示相似、远位置不相似」的好性质。
- **encoder** 内部两大件：self-attention 层(QKV 投影 + 公式,让每个 token 变成全序列的函数)+ feedforward neural network(投影到更高维 + 非线性激活学复杂特征);encoder 顶端输出每个 token 的 context-aware 表示([1:17:00])。

### 九、Decoder 自回归循环与五个训练技巧

- **decoder** 单步流程：喂 BOS(加位置编码)→ **masked self-attention**(只看自己与已生成的 token,不能偷看未来)→ **cross-attention**(query 来自 decoder 端,key/value 来自 encoder 输出——把「已生成内容」表示成「源文本」的函数,图上即两支箭头从 encoder 进来)→ feedforward → 线性层 + softmax 投到词表([1:18:00])。
- 挑出下一个 token 后拼回输入重走一遍，如此自回归直到输出 EOS——翻译被化归为不断「猜下一个 token」。
- **residual connection**：层输出写成 F(x)+x——是「修改 x」而非「彻底重写 x」；深层架构里让特征直通，助反向传播、学得更好([1:20:00])。
- **layer normalization** 归一化激活助收敛；masked 的实现是三角矩阵把「未来位置」置 -inf，softmax 后权重为 0——训练与推理都断掉向后的连接。
- **multi-head attention**：类比 CNN 的多个 filter，h 组独立投影矩阵并行做 attention，让模型从不同角度学同一件事([1:24:00])。
- **dropout**：训练时按概率随机丢单元，防止过度依赖个别特征、助泛化；**label smoothing**：不要求对正确词输出 100% 概率(如压到 90%,剩余摊给其他词)——语言本有多种合法接续(what a nice day/class/evening)，作者实测还能提升机器翻译指标(BLEU)。

### 十、端到端维度走查与真正的 secret sauce

- Shervine 用老朋友例句把全部积木拼起来：分词(刻意选一种任意切分,证明切法自由)→ 加 BOS/EOS → 查可学习的 embedding lookup table → 加正弦/余弦位置 embedding(同长度、逐元素相加)，得到 encoder 输入([1:26:00])。
- 维度账：输入 n×D_model；W_Q/W_K/W_V 分别为 D_model×D_q、D_model×D_k、D_model×D_v，构造上要求 D_q=D_k；QKᵀ 得 n×n 相似度矩阵，乘 V 后维度与 V 相同；除以 √d_k 是因为点积方差随维度增长，除以标准差才能保持数值规整([1:31:00])。
- **multi-head** 并行 h 份，各自输出拼接后过 W_O 投回 D_model；transformer 的漂亮性质是「多数操作保持 D_model 不变」，层与层之间才好堆叠。
- **FFN** 是单隐层网络：D_model → D_ff(通常远大于 D_model,留给复杂表示)→ 回到 D_model;encoder 块整体重复 N 次，原论文 N=6。
- decoder 端数值走查：BOS → 预测出 "un" → 拼回输入 → 预测出 Teddy bear 的法语对应词 → ……直到 EOS 停机；每个 decoder block 的 K/V 都是 encoder 最后一层的输出。
- 学生问「若只留一样，是什么让它 work?」——secret sauce 有二：**attention 层**(点题)与 **feedforward network**(绝大多数参数与容量都在这,learning 真正发生的地方)；其余组件全是「帮助学得更好的 tricks」，再叠加数据质量这一层。预告：后续讲次会看到很多组件被砍掉、只留反复堆叠的子集([1:41:00])。

---

## 核心概念速查

| 概念 | 一句话定义 |
|---|---|
| Tokenization | 把文本切成不可再分的 token;word/character/subword 三级粒度，subword 是现代主流 |
| BPE(Byte Pair Encoding)| 从初始 token 集迭代合并最高频相邻对直到目标词表；词表由数据学出、序列更短 |
| 特殊 token | unknown(兜词表外)、BOS/EOS(序列起止)、padding(补齐长度)；记号各家不统一 |
| Word2vec | 用 CBOW/skip-gram proxy task 学静态词向量；局限：OOV、维度随词表涨、多义词、词序无感 |
| RNN / LSTM | hidden state 编码已见序列(带词序);LSTM 加 cell state 长程携带；共同死穴是 long-range dependency 与 vanishing gradient |
| Self-attention | 每个 token 的表示 = 序列中所有 token 的函数；Q 检索、K 被比、V 被加权聚合 |
| softmax(QKᵀ/√d_k)·V | 核心公式；QKᵀ 一次算出全部两两相似度，√d_k 控制方差，softmax 归一成权重 |
| Position embedding | 与 token embedding 相加注入位置；可学习版不能外推，正弦/余弦版可外推且近密远疏 |
| Cross-attention | decoder 的 Q 对 encoder 的 K/V 做 attention，把已生成内容锚回源文本 |
| 训练技巧五件套 | residual connection(F(x)+x)、layer norm、multi-head(h 组投影并行)、dropout、label smoothing |

## 自测题(先遮住右侧再答)

1. word-level tokenization 为什么会词表爆炸并撞上 OOV?subword 如何同时缓解这两点?
   > 英文词形变化多(单复数/阴阳性)每个变体各占一个 token，训练没见过的词没有表示；subword 让词根共享(bear/bears 共享 "bear")缩小词表，未登录词可拆成已知子词组合。
2. BPE 是怎么从训练语料学出词表的?
   > 从初始 token 集(如全部字母)出发，反复统计语料中最高频相邻对并合并成新 token(如 a+n→an)，重复直到达到目标词表大小。
3. BOS 和 EOS 各在生成流程的哪一端?unknown 与 padding 各管什么?
   > BOS 在输入端提示开始生成、EOS 在输出端表示生成结束(停机信号)；unknown 兜住词表外文本，padding 把不同长度序列补齐成统一长度以利硬件批量计算。
4. one-hot 的根本缺陷是什么?Word2vec 靠什么机制学到表示，又有哪四大局限?
   > one-hot 完全正交不含相似度信息；Word2vec 用 proxy task(CBOW 用上下文预测中间词 / skip-gram 反向)训练，取中间 hidden 层当 embedding(能解 Paris-France ≈ Berlin-Germany 类比)；局限 = 训练外词汇无法表示、维度随词表涨、多义词同表示、词序无感。
5. RNN 靠什么拿到词序信息，为什么记不住远处的话?LSTM 补了什么、病根是什么?
   > 靠不断自我更新的 hidden state 编码已见序列；全部历史压进单个向量导致 long-range dependency，病根是 vanishing gradient；LSTM 加 cell state 长程携带但未根治，且必须串行处理、训练慢。
6. 用 Q/K/V 描述一次 self-attention 计算：Teddy bear 的新表示是怎么来的?
   > query(q_Teddy bear)与每个 token 的 key 做点积得相似度，softmax 成权重后对各 token 的 value 加权求和；cute 与它相似度高时其表示 heavily 依赖 cute；Q/K/V 由可学习投影矩阵 W_Q/W_K/W_V 从输入表示投出。
7. 写出 self-attention 核心公式；除以 √d_k 与 mask 里置 -inf 各是为什么?
   > softmax(QKᵀ/√d_k)·V；点积方差随维度 d_k 增长，除以 √d_k 保持数值规整；decoder 用三角矩阵把未来位置置 -inf、softmax 后权重为 0，禁止偷看未生成的 token。
8. transformer 的 secret sauce 是哪两个组件?cross-attention 的 Q 与 K/V 分别来自哪边?
   > attention 层(点题)+ feedforward network(绝大多数参数与容量所在,learning 真正发生);cross-attention 的 Q 来自 decoder 已生成 token,K/V 来自 encoder 最后一层输出，把生成内容锚回源文本。
---
