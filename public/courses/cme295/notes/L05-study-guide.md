# CME295 Lecture 5 学习笔记：LLM Systems

> 讲者 Afshine & Shervine Amidi ｜ 配合视频 `lectures/L05-llm-systems [25KIyaeI_Fg].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L05-transcript.md](L05-transcript.md)

---

## 一句话概览

**LLM 系统课回答两个根本问题：模型怎么塞得进硬件(fit)、怎么跑得快(fast)**——decoder 堆到底就是一堆矩阵乘法，而显存装不下千亿参数、自回归解码天生 memory-bound；解法分三路：单卡内 **Flash Attention** 把 softmax 融合进 SRAM(不碰大而慢的 HBM)、训练侧五种并行(Data/Tensor/Pipeline/Context/Expert)摊薄显存与时间、推理侧 KV cache 三连(paged attention / GQA / MLA)加 **speculative decoding** 把「验证便宜、生成贵」变成速度。

---

## 分节要点(带时间锚点)

### [0:00] 为什么 LLM 天生是硬件问题：decoder 就是矩阵乘法

- LLM = 把 transformer 的 decoder 部分单独放大：参数量数十亿到万亿级，pre-training 喂进数万亿甚至数十万亿 token；前四讲是理论，本讲回答「实践上怎么跑起来」。
- decoder 拆开只有两层：**masked multi-head attention + feedforward network**，本质都是矩阵乘法——矩阵每个输出元素都是一个独立 dot product，天然可并行，这正是 **GPU**(大量 core + 专用硬件)的主场。
- 两个易混指标(lecture 2 用过前者,本讲两个都用):**FLOPs**(floating point operations,计算量/compute budget)vs **FLOP/s**(floating point operations per second,衡量硬件计算速度)。
- [0:06] 以 NVIDIA **H200** 的 datasheet 为标尺：计算速度以 teraflops 计、显存 **141 GB**、数据搬运速度 TB/s 量级。
- Napkin math:100B 参数 × 每参数 2 bytes(fp16 = 16 bit)= **200 GB > 141 GB**——光放参数就爆，还没算 activations、gradients、optimizer states，而训练时这些全都要驻留显存。
- 由此确立全讲路线图，围绕两个问题：①**怎么让模型 fit 进硬件?** ②**怎么让它 fast?**——先单卡讲 Flash Attention(exact 方法,不做任何近似)，再多卡讲训练并行，最后讲推理优化。

### [0:11] GPU 记忆层级：HBM 大而慢、SRAM 小而快，attention 的 n×n 账单

- masked self-attention 要算(甚至要存)**QK^T 这个 n×n 矩阵**(n = 序列长度,可到几万):n=1000 就有 100 万个条目，存储本身就是灾难。
- GPU 里两块记忆分工：**HBM**(high bandwidth memory,off-chip)就是 datasheet 上那 141 GB，大但相对慢(读写 ~1 TB/s 量级)；**SRAM**(on-chip,与 compute unit 同片)快一个数量级(~几十 TB/s)但只有几百 MB，装不下大中间结果。(学生确认:141 GB 指 HBM;计算在片上 compute unit 发生,数据要进出片外的 HBM。)
- 所以单卡优化的目标 = **最小化对大而慢的 HBM 的读写次数**。
- [0:15] softmax 是主要障碍：分母 = 整行 exp 之和，**不可能只看单个分量就算出 softmax**；naive 流程被迫物化整个矩阵——Q·K^T 写入 HBM → 读回做 softmax 再写回 → 再读回乘 V，大矩阵多次进出 HBM。
- Flash Attention 的核心提问：能否**迭代式、融合式(fused)**地算 softmax·V，从头到尾不物化 n×n 矩阵?

### [0:21] Flash Attention 核心：把 softmax(s)·V 拆成可迭代的分子/分母

- 目标量 softmax(s)·V = 按 attention score 加权的 values 和 = **Σᵢ exp(sᵢ)vᵢ / Σⱼ exp(sⱼ)**——把求和号提进分子后，分子 n_t 与分母 d_t 都可以**流式累积**，不必先算完整行。
- 板书三元素例(s 为 q 与 k₁,k₂,k₃ 的点积):n₁ = exp(s₁)v₁、d₁ = exp(s₁);n₂ = n₁ + exp(s₂)v₂、d₂ = d₁ + exp(s₂)……递推式 **n_{t+1} = n_t + exp(s_{t+1})·v_{t+1}**，最终输出就是 n₃/d₃。
- [0:26] 这样可以一边收 key/value 一边更新分子分母，永远不需要「先算完整行、再归一化、再乘 V」三步走。
- 新问题：**exp 会爆大** → 数值不稳定。第一步观察：分子分母**同乘常数 C 比值严格不变**——所以只需挑一个能把数值压小的 C。
- [0:31] 取 **C = exp(-max so far)**：维护 running maximum m；第一轮算 exp(s₁-m₁)；第二轮 m₂ = max(s₁,s₂)，新项乘 exp(-m₂),**旧累积和整体重缩放**乘 c₂/c₁ = exp(m₁-m₂)。
- 两个细节：exp 相乘 = 指数相加，所以先算 s-m 再 exp，不会直接算出 C 本身；某量小到无法表示 ≈ 0 无害(它本来就不该贡献和)，**大数无法表示才致命**(它明明贡献和却被丢掉)。

### [0:36] Flash Attention 结算：exact、SRAM 落地、backward 现场重算

- 把递推搬回 attention：每轮只把**小块的 qᵢ、kᵢ、vᵢ 搬进 SRAM**，片上更新 n/d 并循环所有 key——输出逐步填好，**n×n 矩阵从头到尾不物化**，HBM 读写大幅减少。
- 文献里那些吓人的公式只承载两个 idea：①分子分母可迭代；②用 running max 重缩放防数值爆炸。
- [0:41] 训练 bonus：**backward 不复用 forward 存下的中间矩阵，现场重算(recompute)**——表上 GFLOPS 反而更高(75.2 vs 66.6)，但省掉大矩阵进出 HBM，runtime 显著更短。「算过的东西不重算」是常态，但当它很大且躺在慢介质上时，丢弃重算反而更快。
- [0:46] 学生高频问答：这是 **exact computation，零近似**，公式与 naive 逐项相同，只是搬运方式更聪明；recompute 技巧只有训练侧需要(要算梯度)，forward/inference 用融合技巧即可。
- 文献里的 **Flash Attention 2/3/4**：同一思想上针对 GPU 代际(**H100/H200 = Hopper,B100/B200 = Blackwell**)做进一步架构特化。
- 本节收口：fit = 不存 n×n 矩阵；fast = 少碰大而慢的 HBM。

### [0:51] 训练侧：一张 GPU 的显存账单，data parallelism 与 ZeRO

- 即使有 Flash Attention，模型太大单卡照样爆：显存要装 ①**parameters**(数十亿~万亿);②**activations**(forward 算 loss 时产生,随模型大小、**序列长度与 batch size** 增长——每个 token 都要与所有 token 交互,每 token 一份激活);③**gradients**(backward 求出);④**optimizer states**(如今模型多用 Adam 及其变体训练,要额外追踪好几个量)。
- **Data parallelism**：把数据切到多卡各自 forward/backward；naive 做法 = 每卡完整复制参数+梯度+优化器状态，冗余巨大。
- **ZeRO(zero redundancy optimizer)**：把 optimizer states / gradients / parameters **分片(shard)**摊到各卡，不存重复；代价 = 计算时缺的参数要**跨卡通信**取回，不是 free lunch。
- [0:56] 学生易混点：ZeRO **不是 model parallelism**——给定子批数据的全部模型计算仍在这张卡上完成(缺什么向别的卡要什么)；model parallelism 是把模型计算本身切到不同卡上。分片参数时，梯度与优化器状态跟着参数走，各卡只留与自己那部分参数相关的量。
- 时间换空间的哲学：加载参数确实慢，但「**训得慢**」好过「**训不了**」。

### [1:02:00] 模型并行四件套：tensor / pipeline / context / expert

- **Tensor parallelism**：把单个矩阵乘法切到多卡——multi-head attention 各 head 本来独立，一卡一 head，各自算投影再合并；FFN 同理，矩阵 A 按行切、B 按列切。与 data parallelism **不互斥，可叠加**(显存不够就一起上)。
- [1:04:00] **Pipeline parallelism**：按层/组件切，device0→device1→…接力；forward 传递信息、各 stage 留存 activation 供 backward 用；代价是 **bubble**(GPU 空转等接力)，业界有一堆缓解策略(本讲不展开)。
- [1:06:00] **Context parallelism**：按**序列长度**切——queries 分组驻留各卡、keys/values 在邻居间轮转(两卡两 token 例:各算各的 q/k/v,算完交换 KV 再来一轮,token 多了就分组循环);**Expert parallelism**:MoE 的专家放不同卡，token 按 router 送到专家所在卡计算再回来。
- 「五个 D」全家福：**Data / Tensor / Pipeline / Context / Expert** parallelism，可任意混用；但并行不白给——GPU 按小时计费(利用率低 = 烧钱)+ 通信开销(如 ZeRO-3 要传参数)。
- 训练侧答卷：fit = 把 parameters/activations/gradients/states 摊到多卡；fast = data parallelism 并行 batch + model parallelism 并行模型计算。

### [1:11:00] 推理延迟解剖：prefill 快、decode 慢、TTFT/TPOT/TTLT

- 开场对比(Shervine 交给全班答):10-token 输入要 10k-token 输出 vs 10k-token 输入只要 10-token 输出，**后者快**——prefill 是 **teacher forcing** 式并行吃进全部 prompt token,decode 是 **autoregressive** 一个 token 一个 token 蹦。
- 一次请求的延迟组成：**Tq**(排队时间,provider 有多个用户,受其 batching 策略影响)+ **T_prefill**(并行,相对快)+ autoregression 时间(大头)。
- 三个监控指标：**TTFT**(time to first token)、**TPOT**(time per output token)、**TTLT**(time to last token);infra 重点盯前两个(反映排队/并行/解码策略好坏)。
- [1:13:00] TTLT 反而少盯：它被模型行为天然污染——长 reasoning 链、用户爱要 teddy bear 长故事都会拉高 TTLT，不代表系统差。
- [1:15:00] 价格直觉：大 lab 定价**输出 ≈ 5 × 输入**(纯经验值,无理论必然)——decode 的自回归本质决定了它贵；系统 owner 的目标 = 在 τ₁/τ₂ 这类延迟与成本约束内做到 fast & cheap。

### [1:16:00] Arithmetic intensity 与 roofline:memory-bound vs compute-bound

- 三个硬件量：**computational throughput**(datasheet 上的 teraflops,**强依赖数据类型**)、**memory bandwidth**(HBM→SRAM→compute unit 的搬运速度,TB/s 量级)、**arithmetic intensity** = 计算数 / 内存搬运数(把前两者连起来的比值)。
- HBM 做不快是硬件设计折中：更快意味着更大面积与成本，所以 HBM 大慢、SRAM 小快各有定位；理想世界当然想要最大的 SRAM + 无限算力，可惜造不出来。
- [1:21:00] **Roofline model**：横轴 arithmetic intensity、纵轴 computational throughput，可达性能有一条形似屋顶的上限线；拐点叫 **ridge point**——既不 memory-bound 也不 compute-bound 的临界点(注意图是对数坐标,不该从非零画起)。
- 推理定位：**decode = memory-bound**(每出一个 token 都要把整包权重从 HBM 搬一遍,计算极少);**prefill = compute-bound**(做了 flash attention 类优化后计算密集,瓶颈在算力)。
- [1:24:00] **KV caching**:decode 时复用历史 keys/values,provider 对 cached 输入只收约 **1/10** 价格；注意区分两种「缓存」——decode 时的 KV cache(计价含在输出价里)vs **跨 turn 的 prompt cache**(新 query 锚定之前已算好的状态,不算新输入);causal mask 不用专门操心，乘个三角矩阵就搞定。

### [1:26:00] 给 KV cache 挤水：paged attention、GQA、MLA

- 显存分配的坑：provider 按请求声明的 **max output** 预留 KV cache 空间，而实际 completion 往往短得多 → 大量「**预留了却用不上、别人也用不了**」的显存碎片；查询多了碎片越积越多。
- [1:29:00] **Paged attention**：不再连续摆放 KV，改用逻辑视图——切成大小 **B** 的 block + 元数据查找表记录「谁的 KV 在哪个 block」；B 太小 → 元数据爆炸，B 太大 → 碎片回归；实践取 **B=16**，碎片被限制在 block 级。
- **GQA**(grouped-query attention):h 个 query 头只配 **g 个 KV 头**,queries 分组共享；两个极端——g=h 退回 **MHA**,g=1 是 **MQA**(每 token 只剩一对 K/V,表达力不够,太激进)；量级感受：g=2、h=24 → 显存省 **1 - 2/24 ≈ 91%**;g 靠 grid search / ablation 调，太靠近 h 提升只有边际。
- [1:31:00] **MLA**(multi-latent attention)：不只求少、还求小——把每 token 的 2h(或 2g)个 KV 向量压成**一个小的 latent 向量**；LoRA 式**低秩分解**：先投影出共享低秩表示，再训练一个 decoder 从 latent 还原 K/V(还原结果不存储,只存共享 latent)；魔法在**第一个投影矩阵跨所有 head、且 K/V 共用**，于是每 token 只存一个向量。

### [1:33:00] Speculative decoding：验证便宜、生成贵，输出分布可证一致

- 立意：autoregression 慢，但「**生成 token 一次一个、验证 token 可以像 prefill/训练一样并行喂入**」——用便宜的验证去捡贵的生成。
- 流程：**draft model** 先连生成 k 个 token(d₁…d_k)，连同 prompt 一起并行喂给 **target model** 验证；接受规则(rejection sampling):target 比 draft 更有信心 → 直接接受，否则按概率比 **min(1, T(x)/D(x))** 接受；被拒 → 从 **residual distribution** [T(x)-D(x)]₊ / Σ[T(x')-D(x')]₊ 重采样。
- [1:38:00] 无损证明(全概率公式 + 联合概率公式)：接受分支贡献 P(d=x)·min(1, T/D) = min(D(x)，T(x))；拒绝分支用「1 = ΣT(x')」技巧化成残差项；两项相加**恰好等于 T(x)**——speculative decoding 输出分布与 target 严格一致，零分布偏移。
- 彩蛋与代价：喂给 target 的所有 token 都被算过，**验证通过后下一个 token 免费**；但 **reject = 提前退出循环**，draft 在那之后的活全白干 → 希望 draft/target 分布尽量对齐。
- [1:45:00] 两条对齐路：①**knowledge distillation**——拿小模型拟合 teacher 的 next-token 分布，分布对齐则 reject 变少；②**multi-token prediction**——同一个 LLM 训 k 个线性+softmax 输出头，k 个头当 draft、第 1 个头当 verifier。
- 全讲答卷：fit = paged attention + GQA/MLA(更少更小的 KV 表示);fast = speculative decoding 一次生成更多 token；行业佐证：Artificial Analysis 基准聚合站首页 2/3 版面都是推理相关图——推理优化是当前 top of mind。

---

## 核心概念速查

| 概念 | 中英对照与一句话定义 |
|---|---|
| HBM vs SRAM | HBM(off-chip)大而慢 ~141GB/~1TB/s;SRAM(on-chip)小而快几十 TB/s；单卡优化的主旋律 = 少碰 HBM |
| Flash Attention | 把 softmax(QK^T)V 拆成可流式累积的分子/分母 + running max 重缩放，小块进 SRAM 融合计算，exact 无近似；backward 现场重算(75.2 vs 66.6 GFLOPS,runtime 反而更短) |
| ZeRO | zero redundancy optimizer:data parallelism 下把 optimizer states/gradients/parameters 分片去冗余，代价是跨卡通信 |
| 五个 D | Data/Tensor/Pipeline/Context/Expert parallelism：数据批/矩阵/层/序列/MoE 专家五个维度，可混用 |
| TTFT / TPOT / TTLT | time to first token / time per output token / time to last token;infra 重点监控前两个，TTLT 被模型行为污染 |
| Roofline & ridge point | arithmetic intensity(计算/搬运)对 throughput 的上限线；ridge point = memory-bound 与 compute-bound 的临界点 |
| KV cache | 复用历史 keys/values；cached 输入约 1/10 价格；decode 缓存计价在输出价内，跨 turn 缓存是另一回事 |
| Paged attention | KV cache 按 B=16 的 block + 元数据表管理，把「按 max output 预留导致」的碎片限制在 block 级 |
| GQA / MQA / MLA | h 个 query 头共享 g 个 KV 头(g=h→MHA,g=1→MQA);MLA 低秩分解把每 token KV 压成一个共享 latent |
| Speculative decoding | draft 生成 k 个 token、target 并行验证，min(1,T/D) 接受 + residual 重采样，输出分布严格等于 target |

## 自测题(先自己答,再看答案)
1. 为什么显存 141GB 的 H200 连一个 100B 参数的模型都放不下?训练时除了参数还要在显存里放什么?
   > fp16 每参数 2 字节，仅参数就要 200GB > 141GB；训练还需 activations(随序列长度与 batch 增长)、gradients、optimizer states(Adam 变体额外追踪多个量)。
2. Flash Attention 要解决什么瓶颈?softmax 为什么是主要障碍?
   > n×n 注意力矩阵要反复进出大而慢的 HBM；softmax 分母需整行求和，naive 实现被迫物化整个矩阵，QK^T→softmax→乘 V 多次大读写；Flash Attention 把它拆成可迭代累积的分子/分母在 SRAM 里融合算完。
3. Flash Attention 是近似方法吗?为什么 backward 多算了计算量反而更快?
   > 不是，数学上与原式逐项相等(exact)；backward 不复用 forward 存的中间矩阵而现场重算，GFLOPS 升(75.2 vs 66.6)但省掉大矩阵进出 HBM 的读写，runtime 更短。
4. ZeRO 属于 data parallelism 还是 model parallelism?为什么?
   > data parallelism：给定子批的全部模型计算仍在一卡上完成，缺的参数/梯度/优化器状态从其他卡通信取回；model parallelism 则是把模型计算本身切到不同卡上。
5. 「五个 D」并行各沿什么维度切?pipeline 的 bubble 和 context 的 KV 轮转分别是什么?
   > Data 切数据批、Tensor 切矩阵乘(head 各卡独立/FFN 行列切)、Pipeline 按层接力(GPU 空转等接力即 bubble)、Context 按序列切(queries 驻留、KV 在邻居间轮转)、Expert 按 MoE 专家分卡路由 token；五者可混用。
6. 用 roofline 模型解释：为什么 decode 是 memory-bound 而 prefill 是 compute-bound?
   > decode 每生成一个 token 都要搬全部权重、arithmetic intensity 极低，落在 roofline 的 memory-bound 侧；prefill 并行处理所有 prompt token、计算密集(配 flash attention 类优化)，落在 compute-bound 侧；ridge point 是分界。
7. Paged attention 解决什么问题?GQA 和 MLA 又怎么进一步给 KV cache 挤水?
   > naive 按声明 max output 预留显存产生大量碎片，paged attention 用 B=16 的 block + 元数据表把碎片限制在 block 级；GQA 让 h 个 query 头共享 g 个 KV 头(g=2/h=24 省约 91%,g=1 即 MQA 过激)；MLA 低秩分解把每 token 的 KV 向量压成一个共享 latent，存小不存大。
8. Speculative decoding 的机制与无损性?draft 不行会发生什么、怎么补救?
   > draft 连生成 k 个 token 给 target 并行验证，按 min(1,T/D) 接受、拒绝则从 residual distribution 重采样，可证明输出分布严格等于 target;reject 意味着提前退出循环、draft 后续白干，故用 knowledge distillation 或 multi-token prediction 对齐分布。

---

