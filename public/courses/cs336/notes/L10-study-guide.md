# CS336 Lecture 10 学习笔记：推理

> 讲者：Percy Liang|配合视频 `lectures/L10-inference [fcgPYo3OtV0].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L10-transcript.md](L10-transcript.md)

---

## 一句话概览

在 scaling laws 间隙插入的推理专题：推理因逐 token 串行生成而 memory-limited——prefill 快(并行、compute-limited)、generation 慢(串行、memory-limited)；提速主线有三条，改架构砍 KV 缓存(KV cache)(GQA/MLA/CLA/局部注意力)、走出 Transformer(状态空间模型/线性注意力/扩散语言模型)，以及无损的投机解码(speculative decoding)，辅以量化、剪枝与 vLLM 式动态服务。Percy 的核心论点：推理的大机会在建模与架构侧，你真正关心的不是「怎么跑某个特定模型」，而是「在资源预算内交付好精度」。

## 分节要点(带时间锚点)

### 一、为什么推理重要：无处不在且随使用重复计费
- 推理无处不在：聊天、代码补全、批处理数据加工直接要生成；评测指令遵循、test-time compute(先思考再输出答案)、RL 训练里采样响应再算奖励，底下全是推理——它是语言模型一切基本功能的底座([0:00])
- 训练是一次性成本，推理随使用反复发生且占比持续上升：OpenAI 每天生成约 1000 亿词，Cursor 每天约 10 亿行被采纳的代码([0:00])
- 三个服务指标：首 token 时间(Time-To-First-Token, TTFT,用户等到第一个 token 的等待)、延迟(latency,首 token 之后逐 token 到达速度)、吞吐(throughput,全体用户总 token 速率，批处理关心)；高吞吐不等于低延迟——延迟是个体请求的最坏情况([0:00])
- 训练与推理的本质差异：监督训练能看到全部 token、可沿序列并行(整个序列一个大张量做矩阵乘)；推理必须逐 token 串行生成，难以吃满算力，并注定 memory-limited([0:05])
- 因此真正在线 serving 模型的厂商(闭源与开放权重皆然)比学界重视推理得多；也有一批开源推理包值得一看([0:05])

### 二、算术强度：生成慢的第一性解释
- 记号速览：B 批次、L 层数、T 生成/查询的 token 数、S 条件(prompt)长度、V 词表、D 模型维度、F MLP 隐维(通常为 4D)、H 头维度、N query 头数；GQA 下 K 个 KV 头、G 组、K·G=N([0:05])
- 前向 FLOPs 随 token 数×参数量增长，attention 另有 T² 项；分析工具是矩阵乘的算术强度(arithmetic intensity)，即每传输一字节做多少 FLOPs([0:05])
- 单个矩阵乘 X(B×D)·W(D×F)：FLOPs=2BDF，传输字节≈2(BD+DF+BF)，两者之比化简后 ≈ B——大批次才吃得满算力([0:10])
- 加速器强度 = 硬件 FLOPs/s ÷ 显存带宽，H100 为 989 TFLOPs ÷ 3.3 TB/s ≈ 295：算术强度高于它则 compute-limited(好事)，低于它则 memory-limited(坏事)([0:10])
- B=1 退化为矩阵-向量乘，强度只剩 1：读一遍 D×F 权重却只做等量 FLOPs；自回归生成本质就是不断重复 B=1 的计算——这就是生成慢的第一性解释([0:10])

### 三、KV 缓存与两阶段：prefill 快、generation 慢
- 朴素做法：每生成一个 token 就把整个前缀重跑一遍 transformer，每 token O(T²) 且大量重复计算；而因果 transformer 里前缀的中间结果其实完全不变，理应复用([0:15])
- KV 缓存(KV cache)：把各层的 K、V 存进 HBM，prompt 经 prefill 算一次，此后每步只为新 token 增量计算，每 token 复杂度从 T² 降到约 T([0:15])
- cache 代价：每序列每 token 每层每头各存一个 H 维向量(K、V 各一份)，显存随序列长度线性增长——本讲剩下的内容都在跟这个账本搏斗([0:15])
- prefill(预填充)：并行编码整个 prompt，等价于训练式前向，compute-limited，序列够长效率就好([0:20])
- generation(生成)：一次一个 token(T=1)，memory-limited，效率只能靠大批次(即大量并发请求)来救——效率取决于用户流量的起伏([0:20])

### 四、强度账本与延迟/吞吐实例
- MLP 层算术强度 ≈ B×T：prefill 时 T=S 足够大、没问题；generation 时 T=1，强度只剩 B，完全取决于并发请求数([0:20])
- attention 层强度 = S·T/(S+T):prefill 时 T=S、约为 O(S) 还行；generation 时 ≈ S/(S+1) ≈ 1，且与 batch 完全无关([0:20])
- 直觉：MLP 权重被整个 batch 共享、读取可摊薄；attention 的 KV cache 每序列独享(「每条序列都是独特的雪花」)，batch 起来毫无节省([0:25])
- 总结论：prefill compute-limited、generation memory-limited;attention 强度恒 ≤1 且系统手段无法改善——只能动架构([0:25])
- 餐巾纸数学实例(Llama-2 13B @ H100,S=1000)：内存 = bf16 参数(无梯度、无优化器状态)+ B×每序列 KV cache；B=1 约 8ms/token、124 tok/s；B=16 延迟略升吞吐大增；B=256 需约 240GB，单张 H100 根本放不下——吞吐收益递减且被显存封顶([0:30])
- 推理的数据并行反而最简单：起 M 份模型副本、零通信(参数不用更新)，延迟不变、吞吐 ×M；TTFT ≈ prefill 时间、基本 compute-limited；更大模型单卡装不下时才需要分片参数、甚至分片 KV cache([0:35])

### 五、砍 KV cache：改架构而不是只改系统
- 大前提：推理 memory-limited，省内存字节比省 FLOPs 更重要；KV cache 是最大瓶颈，本节所有招数本质都是「为推理快而改模型架构」([0:35])
- GQA(分组查询注意力，grouped-query attention)：KV 头数减为 query 头数的若干分之一(MQA 是极端=1 个 KV 头，表达力不足)；Llama-2 13B 改成 1 个 KV 头配 5 个 query 头后内存降、吞吐大增、还能塞更大 batch(B=256 从放不下变可行)，精度与全注意力基本持平；Llama 2 70B 已用、Llama 3 全面采用([0:40])
- MLA(多头潜在注意力，multi-head latent attention,DeepSeek V2)：不动 KV 头数，把 KV 投影进低维潜空间(16k→512 的激进压缩)；与 RoPE 不兼容，需额外补几个维度带回位置信息([0:40])
- CLA(跨层注意力，cross-layer attention)：GQA 跨头共享，CLA 跨层共享同一份 KV 投影(投影权重也要共享以保一致)；实测改善「困惑度-KV cache 大小」的 Pareto 前沿([0:45])
- 局部注意力(local attention)：只保留最近 K 个 token 的 KV、滑出窗口即弃，cache 恒定不随序列涨(Longformer、Mistral 等)；代价是丢长程依赖——当初选 attention 不选 RNN 就是为了长程建模([0:45])
- 混合架构(Character.ai)：每 6 层 1 个全局注意力 + 5 个局部注意力，再叠加 KV 共享，多条技巧组合；超长 prompt 另有 gist token/摘要压缩类思路([0:50])

### 六、走出 Transformer：SSM、线性注意力与扩散语言模型
- 动机：transformer 是为训练效率设计的，「自回归 + 全注意力」的组合正是推理瓶颈；两路激进替代——状态空间模型与扩散模型([0:50])
- S4：借信号处理/控制论的线性动态系统，兼有 RNN 与卷积两种解读，长上下文合成任务很强，但语言建模不行([0:55])
- 病根被定位为联想回忆(associative recall)：给一串键值对、查远处的键输出值，依赖任意长——局部注意力记不住，SSM 抽不出特定键值对；hyena/H3/Mamba 逐步改造后，1B 规模追平 transformer([1:00:00])
- 混合与复兴：Jamba(52B MoE,AI21)= 8 层 transformer + 其余 mamba 层，仍省出大头；线性注意力(linear attention)复兴——把 exp 核做泰勒展开写成非线性映射的点积，行为像 RNN、对序列长度线性([1:00:00])
- 规模化证据：MiniMax 用线性注意力训到 456B MoE(大部分层换成线性/局部注意力，偶尔保留全注意力)；BASED 等论文刻画「KV 大小 vs 各类 recall 能力」的权衡曲线([1:00:00])
- 扩散语言模型(diffusion LM)：全部 token 并行生成、再迭代精炼，绕开自回归；Inception Labs 代码模型的 tokens/s 远超 transformer 与 Jamba，精度差距可用算力补；要点：非全注意力层把 O(T) 的 KV cache 换成常数状态，只要精度追上就赢([1:05:00])

### 七、有损捷径：量化与剪枝
- 量化(quantization)= 降低数值精度：FP32 只用于训练，BF16 是推理默认，再往下 FP8/INT8 甚至 INT4；更少字节→更低延迟、更高吞吐，代价是精度风险([1:05:00])
- 两条路线：训练时量化(要重训)与更常见的后训练量化(post-training quantization,拿现成模型直接压、尽量别压坏)([1:05:00])
- LLM.int8()：大网络里存在毁掉 INT8 的离群值(outliers)，把它们单独用 FP16 处理、其余绝大多数走 INT8；可行但略慢，动机更多是「把模型塞进显存」而非提速([1:05:00])
- AWQ(激活感知量化，activation-aware quantization)：按激活分布判断哪些权重重要，重要的单独处理、其余压到 INT4，显存大降并获得约 3× 加速([1:05:00])
- 剪枝(pruning,NVIDIA)：小校准集给层/注意力头/隐维度打分，删掉不重要的部分，再从原模型蒸馏(distillation)修复——不从零训，起点虽差但保留原模型的结构性质([1:10:00])
- 效果与总结：15B→8B 几乎无损、→4B 有一定下降；有损捷径两条路——从头定义快架构直接训，或把慢模型蒸馏进快架构；缺点是总有「新模型可能不如原版」的疑虑([1:10:00])

### 八、投机解码与动态服务
- 出发点不对称：检查给定 token(prefill)是 compute-limited 的并行计算，生成是 memory-limited 的串行——检查比生成便宜，投机解码(speculative decoding)正是利用这个对称性破缺([1:10:00])
- 算法：小草稿模型(draft model)p 自回归跑出 K 个 token → 目标模型 q 并行打分 → 逐个以 min(1, q/p) 概率接受，遇到拒绝则从修正分布 (q−p)⁺ 采样([1:10:00])
- 数学保证输出仍是目标模型的精确样本(与 Metropolis-Hastings/拒绝采样同源)，精度零损失；实测约 2× 加速([1:15:00])
- 配置与改进：draft 越接近目标模型越好(可用蒸馏)，典型如目标 8B 配 draft 1B；Medusa 让 draft 一次并行出多 token，EAGLE 把目标模型高层特征喂给 draft——draft 不必独立存在([1:15:00])
- 真实流量异质(到达/结束时间、长度、前缀共享各不相同)：连续批处理(continuous batching)「班车不发车」，worker 每生成一步就交还调度器、插入新请求；选择性批处理(selective batching)把 attention 拆开逐请求处理、MLP(计算大头)把变长张量拉平进 batch([1:15:00])
- PagedAttention(vLLM 背后的论文)：借操作系统虚拟内存思想把 KV cache 切成连续小块按需放置，消除预留浪费(内部碎片)与请求间填充(外部碎片)；共享前缀用引用计数 + 写时复制(copy-on-write)([1:20:00])

## 核心概念速查

| 术语 | 一句话解释 |
|---|---|
| TTFT(Time-To-First-Token)| 用户等到首个 token 出现的时间，≈ prefill 耗时，决定交互体验 |
| 延迟 / 吞吐 | 单请求逐 token 速度(个体最坏情况) vs 全体用户总 token 速率(批处理关心) |
| 算术强度(arithmetic intensity)| FLOPs ÷ 传输字节数；高于加速器强度才 compute-limited |
| 加速器强度 | H100 = 989 TFLOPs ÷ 3.3 TB/s ≈ 295，算术强度的及格线 |
| KV 缓存(KV cache)| 每序列每 token 每层每 KV 头各存 K、V 向量；免重算前缀，但随序列线性膨胀 |
| Prefill / Generation | 并行编码 prompt(compute-limited,快) vs 逐 token 生成(memory-limited,慢) |
| GQA(分组查询注意力)| KV 头数减为 query 头数的若干分之一；MQA 是 1 个 KV 头的极端，表达力不足 |
| MLA(多头潜在注意力)| DeepSeek V2：KV 投影到低维潜空间(16k→512)再缓存，需补维度兼容 RoPE |
| CLA(跨层注意力)| 相邻层共享同一份 KV 投影，改善困惑度-KV 大小 Pareto 前沿 |
| 局部注意力(local attention)| 只看最近 K 个 token，KV cache 恒定；长程依赖受损 |
| 联想回忆(associative recall)| 给键查值的合成任务；SSM 早期败因，也是 KV 容量与能力的下界 |
| SSM / Mamba | 线性动态系统建模序列，把 O(T) KV cache 换成常数状态；Jamba 混 8 层 transformer |
| 线性注意力(linear attention)| exp 核泰勒展开为非线性映射点积，行为像 RNN、序列线性复杂度；MiniMax 456B 在用 |
| 扩散语言模型(diffusion LM)| 全 token 并行生成再迭代精炼；Inception Labs 速度碾压，精度待验证 |
| LLM.int8() | 离群值单独 FP16、其余 INT8 的混合精度；偏慢，动机是塞进显存 |
| AWQ(激活感知量化)| 按激活分布挑重要权重保精度，其余压到 INT4，约 3× 加速 |
| 剪枝+蒸馏(pruning+distillation)| 校准集打分删层/头/维度，再从原模型蒸馏修复；15B→8B 几乎无损 |
| 投机解码(speculative decoding)| draft 跑 K 个 token、目标模型并行验证，接受率 min(1,q/p)；无损约 2× |
| 连续批处理(continuous batching)| 班车不发车，worker 每步交还调度器插入新请求 |
| PagedAttention(分页注意力)| vLLM 借 OS 分页管理 KV cache 块，消碎片；共享前缀走写时复制 |

## 自测题
1. 为什么语言模型推理天生 memory-limited?给出直觉解释和 H100 上的具体数字。
   > 生成逐 token 串行，等价于反复做 B=1 的矩阵-向量乘：算术强度≈1，远低于 H100 及格线 295(989 TFLOPs ÷ 3.3 TB/s)，读权重的时间远多于计算。
2. 为什么加大 batch 也救不了 attention 层的算术强度?
   > 强度=S·T/(S+T)，与 B 无关：MLP 权重全 batch 共享可摊薄读取，而 KV cache 每序列独享，batch 越大要读的总量同步膨胀，约掉后强度恒约 1。
3. 每生成一个 token，KV cache 要新占多少显存(用讲义记号)?
   > 每序列 2(K 与 V)×2(bf16 字节)×K(KV 头数)×H×L 字节；GQA/MLA/CLA/局部注意力分别从头数、向量维度、层数、序列长度四个方向砍它。
4. GQA、MLA、CLA 各从哪个维度削减 KV cache?
   > GQA 减少 KV 头数量；MLA 把 KV 向量投影到低维潜空间(16k→512)；CLA 让相邻层共享同一份 KV 投影。
5. 早期 SSM(如 S4)为什么在语言建模上失败，后来靠什么补回来的?
   > 败在 associative recall(远距离键值查找)类任务；Mamba/H3 等改造状态空间追平到 1B 规模，Jamba 等 52B 级混合架构再保留少量全注意力层。
6. 投机解码为什么能做到输出分布与直接用目标模型采样完全一致?
   > 以 min(1,q/p) 概率接受 draft token，拒绝时从修正分布 (q−p)⁺ 采样——这是 Metropolis-Hastings 式拒绝采样，数学保证精确，代价只是偶尔退化为直接采样。
7. B=1 时 Llama-2 13B 在 H100 上约多快?batch 调大后各指标怎么变、上限在哪?
   > 约 8ms/token、124 tok/s；batch 增大则延迟升、吞吐先大增后收益递减，最终被 KV cache 显存卡死(B=256 需约 240GB,单卡放不下)。
8. vLLM 的 PagedAttention 解决什么问题、借了操作系统的哪些机制?
   > 按请求预留 KV cache 造成内部碎片、请求间填充造成外部碎片；借虚拟内存分页把 cache 切成连续小块按需放置，共享前缀再加引用计数与写时复制(copy-on-write)。
