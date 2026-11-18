# CS336 Lecture 3 学习笔记：架构与超参数

> 讲者：Tatsunori Hashimoto|配合视频 `lectures/L03-architectures [ptFiH_bHnJw].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L03-transcript.md](L03-transcript.md)

---

## 一句话概览

本讲用「进化论」视角复盘 2017-2025 约 19 个密集模型(dense model)的架构选择，提炼出已收敛的共识(pre-norm、RMSNorm、无偏置、SwiGLU、RoPE)与仍在分叉的少数选项；随后给出可直接照抄的超参数定式(FFN 比、头比、宽深比、词表、正则化)，最后讲训练稳定性技巧(z-loss、QK norm、soft-cap)与推理侧注意力变体(GQA/MQA、稀疏注意力)——是从「会实现 Transformer」到「会做架构决策」的桥梁，MoE 与 DeepSeek-V3 留给下一讲。

## 分节要点(带时间锚点)

### 一、本讲定位：从 19 篇论文里读出趋同演化

- 本讲主题是「从他人的经验中学习」：自己训不起所有架构，就通读近一年约 19 个新发布的密集模型论文做演化分析，找出真正让 Transformer 成立的组件([0:01])
- 作业要求实现的已不是 2017 原版 Transformer：pre-norm 结构、旋转位置编码(RoPE)、SwiGLU 前馈层、线性层去偏置——本讲逐一论证这些改动为何成为共识([0:02])
- 一年内的 Command A、OLMo 2、SmolLM、Phi-4、Gemma 3、Qwen 2.5、InternLM 等新模型大多只是小改；但把所有选择汇成大表就能看到「趋同演化」，最典型的是位置编码从绝对/相对/ALiBi 百花齐放收敛到 2023 年后清一色 RoPE([0:04])
- 讲座三大板块：架构变体(激活、前馈、注意力、位置编码)→ 超参数(隐藏维度、FFN 宽度、词表大小等如何聪明地选)→ 时间允许再补注意力变体([0:05])

### 二、归一化：pre-norm 铁律与 RMSNorm

- 原版 Transformer 把 LayerNorm 放在残差流(residual stream)内的子层之后(post-norm)；把 LayerNorm 挪到残差分支入口(pre-norm)极早期就被发现全面更好，几乎所有现代 LM 都是 pre-norm，唯一例外 OPT-350M(讲者猜是训练中改架构留下的孤儿)([0:06])
- post-norm 的毛病是训练不稳：需要精细的学习率预热(warmup)才能收敛，早期论文(Xiong 2020 等)里 post-norm 的梯度范数尖刺频发；残差流内插归一化会破坏「从底到顶的恒等梯度通路」——这是课堂问答给出的直觉解释([0:08])
- 新变化「双重 norm」(讲者戏称 double norm,尚无公认名字)：Grok 与 Gemma 2 在块前、块后都放 LayerNorm，OLMo 2 只在注意力与 FFN 之后补——pre-norm 一统多年后开始出现新变体，评测显示略更稳定([0:09])
- RMSNorm 是 LayerNorm 的简化：去掉减均值、去掉偏移项 β，只做方差归一化再乘可学习缩放；LLaMA 系、PaLM、Chinchilla、T5 都已切换([0:11])
- RMSNorm 的收益不在算力在访存：矩阵乘占 Transformer 约 99.8% 的 FLOPs，但归一化类操作以 0.17% 的 FLOPs 占掉约 25% 运行时间(Ivanov et al 2023 剖析)——它们是显存搬运大户；Narang et al 2020 消融显示 RMSNorm 从每秒 3.5 步升到 3.68 步且最终 loss 更低，近乎免费的双赢([0:13])
- 共识收束：现代模型普遍还去掉了线性层偏置(效果不变、参数更少、训练更稳)；铁律 = 归一化必须在残差流之外，RMSNorm 近乎人人用(例外:Cohere Command A 与 R+ 用 LayerNorm,原因不明)；可泛化的三条经验——恒等残差连接、防激活尺度漂移、架构设计要算系统账([0:19])

### 三、激活函数：GLU 门控成为标配

- 演化路径：ReLU(原版 Transformer)→ GeLU(乘高斯 CDF,底部有小斜率、更可微，GPT-1/2/3 与 GPT-J 用)→ 门控线性单元(GLU / gated linear unit)变体；2023 年后的模型几乎清一色 GLU 系(GeGLU、SwiGLU 等)，Google 系(PaLM、T5)最先把这条路推开([0:20])
- GLU 机制：FFN 隐层在非线性之外再逐元素乘一个门 x·V(新增 V 投影矩阵)，即 (act(x·W1) ⊙ x·V)·W2;SwiGLU 的 act 用 swish(x·sigmoid(x))，形状近似 GeLU([0:22])
- 课堂问答：swish/GeLU 在负半轴非单调、导数会变号，会不会困住优化?实践中优化器带着大学习率与动量，激活值不会停在 0 附近，这一小段影响可忽略([0:23])
- 参数对齐惯例：加门多出一个 V 矩阵，所以 GLU 系把 FFN 隐藏维度缩到 2/3，使总参数量与无门版持平(即 d_ff = 8/3·d_model,见下一节)([0:25])
- 有效性证据：Shazeer 的 GLU 论文在 CoLA/SST-2 上 GLU 变体一致更优(还附了标准差)，Narang et al 2020 在 T5 风格模型上同样看到 GLU 系 loss 一致更低，该模式至今成立([0:26])
- 但 GLU 不是必要条件：GPT-3 未用门控，Nemotron 340B 用平方 ReLU，Falcon 211B 用 ReLU，都是高性能模型——GLU 是「一致的小增益」而非必需品([0:27])

### 四、串并行层与位置编码：RoPE 一统江湖

- 默认 Transformer 块是串行(先注意力后 FFN)；并行层(parallel layers)让二者同时算再一起加进残差流，GPT-J 首创、PaLM 敢在超大尺度用：实现得当时可共享 LayerNorm、融合矩阵乘，系统效率更高，但表达力略降(相加 vs 复合)；近一年新模型多回到串行，例外是 Cohere Command A、Command R+ 与 Falcon 2 11B([0:28])
- 位置编码演化：原版用正弦(sine)编码，GPT/OPT 用可学习绝对位置向量，T5/Gopher 用在注意力上加向量的相对编码，如今收敛到 RoPE(旋转位置编码，RoPE / Rotary Position Embedding)，由开源的 GPT-J 首开([0:32])
- RoPE 的设计目标：找到 f 使 <f(x,i), f(y,j)> = g(x,y,i-j)，即内积只依赖内容与相对距离；正弦编码会经交叉项泄漏绝对位置，相对编码虽相对却不作用于内积，都不满足该约束——RoPE 利用「内积对旋转不变」这条性质破局([0:33])
- 机制：把位置当旋转角，将 D 维向量切成 D/2 个二维块，各块按不同转速 θ 旋转(快块管近距离高频、慢块管远距离低频，精神同正弦编码的频率阶梯)；实现就是乘固定的 2×2 旋转矩阵，θ 是固定日程而非可训练参数，训练无额外困难(问答)([0:36])
- 关键细节：RoPE 不在嵌入层底部加位置向量，而是在每层注意力算 Q、K 时现场旋转它们(LLaMA 实现里用 cos/sin 旋转 query 与 key)，这样才能严格保持纯相对信息([0:37])
- 收敛验证：讲者通读的 19 篇论文如今全部用 RoPE——既因它是各类上下文长度外推(context length extrapolation)算法的载体，也因小规模、短上下文下效果就够好([0:38])

### 五、超参数定式：FFN 比、头比、宽深比、词表

- FFN 宽度：ReLU 风格 MLP 惯例 d_ff = 4·d_model(纯约定，无自然律);GLU 系缩 2/3 后即 d_ff ≈ (8/3)·d_model ≈ 2.67,LLaMA-1、Qwen、DeepSeek、Yi、T5 都落在附近(PaLM、Mistral、LLaMA-2 略大)([0:41])
- 大胆的离经叛道：T5 11B 的 d_model=1024 而 d_ff=65536(64 倍!)，Gemma 2 也用 8 倍；但后续 T5 v1.1 回归 GeGLU 的 2.5 倍标准比且效果更好——Google 自己也把 64 倍收了回去([0:43])
- 量化证据来自缩放定律(scaling laws)论文的超参数附录(Kaplan et al)：d_ff/d_model 在 1-10 之间是很宽的盆地，4 就在盆地里；问答补充了比值的意义——更宽的 d_ff 换来更肥的矩阵乘、把串行计算换成并行，表达力略亏但系统上可能赚(T5 的 64 倍原始动机正是如此)([0:46])
- 注意力头：共识是「头维 × 头数 = d_model」(比值 1)，GPT-3、T5、LaMDA、PaLM、LLaMA2 全遵守(T5 的 16 倍是唯一例外)；Bhojanapalli et al 2020 警告头越多每头秩越低，实践中并未观察到明显的低秩瓶颈([0:49])
- 宽深比(aspect ratio)：用残差流宽度 d_model 控宽，共识约每层 128 个隐藏维度(GPT-3、LLaMA 系)；Kaplan 在 50M/274M/1.5B 三个尺度上最优点都在 100 附近且跨数量级基本不漂移；深度 vs 宽度看 loss 时只有参数量重要，但同 FLOPs 下更深的模型下游可能更好(Yi Tay 等，公开后续少)；宽深比还受并行策略约束——流水线并行按层切、容忍高延迟网络，张量并行切片、要快网络([0:51])
- 词表：从早期单语模型的 3 万-5 万 token(GPT-2、早期 LLaMA)涨到多语量产模型的 10 万-25 万(GPT-4 及跟随者约 10 万，Command A 更大)；模型越大越能利用大词表，且大词表能把低资源语言打包进更少 token、直接省推理成本(Cohere 的卖点)([0:54])

### 六、正则化：dropout 消失，weight decay 反而常驻

- 反直觉现状：预训练只过一遍数据、几乎不可能过拟合，dropout 已退流行，weight decay 却几乎人人还在用([0:56])
- weight decay 的作用不是控过拟合：不同强度并不改变 train/val loss 差距(零 decay 也不见过拟合)；它真正与学习率日程复杂互动——高 decay 在大学习率阶段训得差，而在 cosine 降温尾段获得隐式加速、最终训练 loss 更低([0:58])
- 结论：用 weight decay 不是为了正则化，而是为了拿到更好的训练 loss——这是优化动力学效应，也是各家报告里「我们用 weight decay」的真正原因([1:00:00])

### 七、训练稳定性：softmax 是问题儿童

- 近一年核心架构变化不大，最大主题是稳定性技巧(stability tricks)：模型越大、训得越久，梯度范数尖刺越致命(OLMo 2 论文是学术圈 LLM 训练稳定性结果的大成:loss 曲线看似正常，梯度范数早已尖刺连天)([1:02:00])
- 问题集中在两个 softmax(输出层与注意力内)：指数运算数值恶劣、还带除法可能除零([1:03:00])
- z-loss：在损失里加辅助项 α·log²(z) 逼 softmax 归一化子 z 靠近 1，指数与 log 相消后输出变成数值良态；思想可追溯到 Devlin 的机器翻译工作(讲者称 2014)，PaLM 以 1e-4 系数率先用于 LM，Baichuan 2 是最早跟进者，其后 DCLM、OLMo 2 等相继采用([1:04:00])
- QK norm：对 Q、K 各过一层 LayerNorm 再做内积，从源头限制 softmax 输入的幅度；源自视觉/多模态社区(Dehghani 2023 训超大 ViT,Chameleon、IDEFICS 用于多模态)，被 Gemma 2、DCLM、OLMo 2 引入文本训练；推理时照常保留——LayerNorm 有可学习参数，去掉等于换模型(问答)([1:07:00])
- 软上限(soft-cap)：注意力内积后过 c·tanh(x/c) 做软裁剪(Gemma 2、OLMo 2 用)；NVIDIA 的对比实验：基线困惑度(perplexity)11.19，soft-capping 更差，QK norm 更好——因为能用更激进的学习率；LayerNorm 的「稳定性万金油」属性至此第三次得到印证([1:09:00])

### 八、注意力变体：GQA/MQA 与稀疏注意力

- GQA/MQA 不改变训练行为，却决定推理成本，也是理解 LLaMA 4 宣称 1000 万 token 上下文的钥匙(靠结构化的注意力图案)；训练侧的账：算术运算 b·n·d²、访存 b·n·d(外加 softmax 矩阵 b·h·n²)，两者之比即算术强度(arithmetic intensity)，训练的大矩阵天然算术强度高、GPU 喂得饱([1:12:00])
- 推理侧：自回归逐 token 生成无法并行，只能增量做注意力——即 KV 缓存(KV cache)：历史 token 的 K/V 不变、缓存起来，注意力矩阵每次只补一行([1:15:00])
- KV cache 的代价：总运算量不变(b·n·d²)，但参数反复搬进搬出使访存恶化，算术强度变成 n/d + 1/b——要么超大 batch，要么短序列/大模型，而 n/d 一项与愿望正好相反，这就是推理成本的核心矛盾([1:18:00])
- 对策：多查询注意力(MQA / multi-query attention)让多个 query 头共享一组 K/V 头，K/V 搬运量骤降；分组查询注意力(GQA / grouped-query attention)按组共享、在推理效率与表达力间调旋钮——有工作表明 GQA 基本无损，更激进的 MQA 则有损([1:20:00])
- 稀疏/结构化注意力是老思想：OpenAI 2019 稀疏 Transformer 用局部窗口+对角线跨块传播，GPT-3 发布时靠交替稠密/稀疏拉大窗口；滑动窗口注意力(sliding window attention)每层只看局部，有效感受野 = 窗口 × 层数([1:24:00])
- 现代形态(LLaMA 4、Gemma、Command A)：每 4 个块一组——最底下 1 块用全注意力且完全不带位置编码(无 RoPE)，上面 3 块用带 RoPE 的滑动窗口；系统上全注意力偶尔才发生，外推上超长程信息没有位置编码、可激进外推，一石二鸟([1:25:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| pre-norm / post-norm | 归一化放残差分支入口 = pre(铁律)；放残差流内子层之后 = post(原版，已弃) |
| RMSNorm | 去均值、去偏置的 LayerNorm：效果相当，省参数更省访存 |
| 双重 norm | 块前+块后都放归一化(Grok/Gemma 2;OLMo 2 只在后)，更稳的新变体 |
| SwiGLU / GeGLU | 门控 FFN:(act(x·W1) ⊙ x·V)·W2;swish = x·sigmoid(x),2023 后标配 |
| d_ff 定式 | ReLU 系 4×d_model;GLU 系 ×2/3 → 8/3≈2.67×d_model，参数对齐 |
| RoPE | 位置 = Q/K 二维块的旋转角，内积只剩相对位置；作用于注意力层内 |
| 宽深比 | d_model/层数 ≈ 128;Kaplan 最优 ~100 且跨尺度稳定 |
| z-loss | 辅助项 α·log²(z) 压输出 softmax 归一化子趋近 1(PaLM 1e-4 起用) |
| QK norm | Q/K 各过 LayerNorm 再内积，限制 softmax 输入幅度(源自多模态) |
| soft-cap | logits 过 c·tanh(x/c) 软裁剪(Gemma 2)，实测不如 QK norm |
| 算术强度 | 运算量/访存量；GPU 效率核心指标，后续系统课反复出现 |
| KV cache | 推理增量缓存历史 K/V；运算量不变、访存恶化，算术强度 n/d+1/b |
| MQA / GQA | 多 query 头共享 1 组(或少数组)K/V 头；GQA 基本无损、MQA 有损 |
| 全局+滑窗交错 | 每 4 块：1 个无位置编码的全注意力 + 3 个带 RoPE 的滑窗(LLaMA 4/Gemma/Command A) |

## 自测题

1. 现代语言模型几乎都把 LayerNorm 放在残差流之外(pre-norm)，原版 Transformer 的 post-norm 为什么被抛弃?
   > 残差恒等通路是从底到顶的梯度高速公路，归一化插进残差流会破坏梯度传播；post-norm 必须靠精细学习率预热才稳、梯度范数尖刺频发，pre-norm 不需要且更稳。
2. RMSNorm 只省了约 0.17% 的 FLOPs，为什么几乎所有新模型都换成它?
   > 归一化操作是显存搬运大户(0.17% FLOPs 却占约 25% 运行时间)，RMSNorm 少一次减均值、少读一组偏置参数，省的是访存不是算力，实测更快且 loss 还略低。
3. SwiGLU 里的「门控」具体指什么?为什么用它要把 FFN 隐藏维度缩到 2/3?
   > 隐层激活被逐元素乘上另一路投影 x·V 作门；多出的 V 矩阵会撑大参数量，缩 2/3(即 d_ff=8/3·d_model≈2.67)使总参数与无门 FFN 持平。
4. RoPE 凭什么保证注意力内积只依赖两个 token 的相对距离?
   > 把绝对位置变成 Q/K 向量的旋转角(高维切成二维块、各块固定转速 θ)，而内积对旋转不变，剩下的只有相对角度差；旋转发生在注意力层的 Q/K 上而非嵌入层。
5. 预训练只过一遍数据、谈不上过拟合，为什么各家还坚持用 weight decay?
   > 它不是在控过拟合(train/val 差距不随 decay 变化)，而是与学习率降温互动、在训练尾段带来隐式加速，最终拿到更低的训练 loss。
6. z-loss 和 QK norm 分别从哪个环节稳定 softmax?实测谁更有效?
   > z-loss 用 α·log²(z) 把输出 softmax 的归一化子压向 1;QK norm 在注意力 softmax 的输入端用 LayerNorm 给 Q/K 限幅；NVIDIA 实验里 QK norm 更好(能推更大学习率),soft-cap 反而更差。
7. 推理时注意力为什么变成访存瓶颈?算术强度公式里哪一项最致命?
   > 自回归逐 token 生成加 KV cache，运算量不变但访存恶化，算术强度变为 n/d+1/b，其中 n/d 项意味着要短序列或大模型，与真实需求正好相反。
8. GQA 在多头注意力和 MQA 之间扮演什么角色?
   > 折中方案：多个 query 头分组共享 K/V 头，省推理访存；实证上 GQA 基本无损，而把 K/V 全共享的 MQA 更激进、有损。
