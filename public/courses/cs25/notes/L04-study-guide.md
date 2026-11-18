# CS25 Lecture 4 学习笔记：把训练铺到数千张 GPU——5D 并行、MoE 扩展与吞吐调优
> 讲者：Nouamane Tazi|配合视频 `lectures/L04-ultra-scale-training [I5BKi32IEa8].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L04-transcript.md](L04-transcript.md)

---

## 一句话概览

本讲把"训一个万亿参数模型"拆成三个工程问题：模型放不进显存、global batch 磨不完、通信吃不满 GPU。前半从数据并行(DP)出发，沿 ZeRO-1/2/3(FSDP)逐级解决显存、张量并行(TP)+序列并行(SP)解决"batch 用满之后还能怎么切"，全程贯穿一条主轴——AllReduce 本质是 reduce-scatter + all-gather，而吞吐取决于通信与计算的重叠程度。后半快讲流水线并行 PP(1F1B/DualPipe 消 bubble)、上下文并行 CP(ring attention)与专家并行 EP(MoE 的 all-to-all dispatch 与 CPU-GPU sync 硬件坑)，收尾给出五种并行正交可组合、按网络瓶颈与 global batch 选型的实战经验。

## 分节要点(带时间锚点)

### 一、开场：为什么要规模化，以及单卡的两个瓶颈

- 讲者背景：Hugging Face 四年，Ultra-Scale Playbook 主笔、Nanotron(字幕误作 Nanotronics)核心开发者，参与过 StarCoder 2(字幕误作 Star StarCoder 2)、SmolLM3(字幕误作 Small LLM 3)与 MoE scaling 项目；本讲主体取材于 Ultra-Scale Playbook 一书，但书已出版一年，故补充了 MoE scaling 等新内容 ([0:01])
- 规模化仍是大势：最新 LLM 越训越大且规模与智能呈相关(本周的 Kimi K2.6 就是 1T 参数)；当今模型量级约 1T 参数、15T 训练 token、100 万上下文；infra 视角的四个压力点——从存储持续加载 15T token 数据、每次迭代(哪怕 1T 模型)约 1 秒完成、受限于单卡显存、还要周期性写 checkpoint ([0:02])
- 单卡训练循环：forward → backward 求梯度 → optimizer step；但全局 batch 通常 100 万到 1000 万甚至 5000 万 token，一次迭代放不下，于是做梯度累积(gradient accumulation)——把大 batch 切小、多次 forward/backward 顺序累积梯度；隐含假设是模型本身放得进显存，且顺序训练太慢 ([0:03])
- 更多的卡怎么用：多种并行(parallelism)各管一个场景，本讲目标是建立"什么场景用哪种并行"的直觉；主讲 DP 与 TP 两个，PP/CP/EP 快速带过，方法可类推 ([0:04])

### 二、数据并行 DP：AllReduce 与通信重叠

- 适用面先行说明：这套方法不挑加速器(GPU/TPU 皆可)，适用于预训练、后训练、蒸馏、推理等一切 workload，而且不需要 1000 张卡——从 2 张卡起就有收益 ([0:05])
- 数据并行(DP, data parallelism)：每张卡喂不同 batch(因此得名)，各卡算出不同梯度，用 AllReduce(分布式求和)同步梯度后，所有卡做相同的 optimizer step；PyTorch 里用 DDP 类包装模型，backward 时自动完成 AllReduce ([0:06])
- 用 torch.profiler 看 CPU/GPU 时间线，三条健康标准：GPU 计算流要始终是满的(不许 idle)、CPU 要跑在 GPU 前面以便提前调度 kernel、通信要尽量与计算重叠 ([0:07])
- 重叠技巧：backward 从最后几层开始产出梯度，不必等整个 backward 结束——最后算好的梯度按 bucket 先行启动 AllReduce，bucket 大小在 PyTorch 里由 bucket_cap_mb(字幕误作 bucket cup micro-batch)控制；这就是所有做大模型工程的人心里的终极目标：让计算始终喂饱 tensor core、消灭空闲 ([0:08])

### 三、ZeRO-1/2/3：从分片优化器状态到 FSDP

- DP 的三大局限：optimizer step 在每张卡上重复做(浪费)、卡数涨则 global batch 一起涨(上限约千万级 token,不可能无限加卡)、最致命的是 DP 假设整个训练步放得进显存——万亿模型显然不满足 ([0:10])
- ZeRO-1：把 optimizer states 分片到各卡，backward 时用 reduce-scatter 替换 AllReduce，各卡只更新自己那片、算完再 all-gather 回完整参数；关键直觉：AllReduce 本来就等于 reduce-scatter + all-gather，所以拆开不增加任何通信量，这个等式是后面反复复用的核心 trick ([0:12])
- ZeRO-2 在此基础上更进一步：reduce-scatter 后把用不到的那部分梯度直接丢掉，再省一份显存；但"说易做难"，实现里随手丢东西很麻烦，大家常停留在 ZeRO-1；新约束来自 Muon 优化器——它要的梯度是完整 tensor(要做牛顿式更新)，不能像老做法那样把所有参数 flatten 成一维再切，分片时必须整只 tensor 分配给某张卡 ([0:14])
- ZeRO-3(即 FSDP, fully sharded data parallel)连参数也分片：优化器步后不急着 all-gather，各卡保留参数分片，forward 到哪一层就临时向其他卡要该层的分片、算完立刻释放，backward 同理；看似很慢，实际靠"计算当前层的同时预取下一层"把通信藏进计算，显存中同时最多只有 2 个 FSDP 模块，是显存优化做到极致的 DP 形态 ([0:17])
- FSDP 两个版本：FSDP1 是包装类 + wrap policy(等价于 bucket 大小)，但会 flatten 参数(Muon 类优化器遭殃)；FSDP2 用 fully_shard 函数一行转换，基于 DTensor、保留完整 tensor、天然能与其他并行组合——讲者推荐后者 ([0:19])

### 四、张量并行 TP：列切与行切的数学

- ZeRO-3 的使用纪律与 DP 的天花板：能 ZeRO-1 放下就别上 ZeRO-3(ZeRO-3 只会多通信、更慢，分片没有其他收益)；规模大到一定程度，FSDP 的每模块 all-gather 即使有重叠也藏不住(慢网络下尤甚)，解法是混合分片 HSDP——小圈子内 FSDP、大圈子外 vanilla DP；但 ZeRO-3 仍在数据并行范畴，global batch 用满(如 1000 卡时已到顶)就得换并行轴 ([0:21])
- 张量并行(TP, tensor parallelism)动机：保持同一份数据/batch 不变，把模型切开、多卡合起来做与单卡完全相同的计算，模型/梯度/优化器状态显存按卡数均分；经典面试题：TP 下激活是全量还是减半? ([0:23])
- 以矩阵乘法建立直觉：X·W 若把 W 按列切，算完 all-gather 输出即可；两个连续 matmul 时，第一个权重按列切、第二个按行切，算完做一次 AllReduce——于是两个 matmul 的分布式执行 = forward 一次 AllReduce + backward 一次 AllReduce(backward 乘转置、假设上游梯度相同)；套在 Transformer 的 MLP 上就是 column linear + row linear + 中间 AllReduce，而这一切成立的大前提是"各卡看到相同输入、相同上游梯度"——这是 TP 正确性的命门 ([0:25])
- attention 怎么切：按 head 数切(head 之间相互独立，激活与 TP=1 完全相同)，不能按 hidden 维切——softmax 里 Q·K 会被归约到残缺维度、破坏计算；通用校验问题只有一句："TP 后各卡算出的激活，与不用 TP 时一样吗?" ([0:29])
- TP 优缺点：同时省显存与样本(同一 batch 不复制)、无需梯度 AllReduce(各卡做的是同一份工作的不同部分)；但通信极重——每个 attention/MLP 块的 forward 和 backward 都有 AllReduce；TP 区域外的参数(layer norm 等)理论上无需同步，实际会因数值精度漂移，实践中仍然 all-reduce 它们的梯度(这是 TP 训练翻车的常见来源)；换新架构(如 MLA)时 TP 实现是头痛事 ([0:30])

### 五、序列并行 SP 与并行组合的正交性

- 序列并行(SP, sequence parallelism)动机：TP 区域内(attention/MLP)沿 hidden 维切，但区域外的 LayerNorm 等仍是复制态，实践中要一直操心同步；既然 AllReduce = reduce-scatter + all-gather，干脆把区域边界的 AllReduce 拆开——reduce-scatter 沿 sequence 维、原来的恒等变换换成 all-gather，区域外沿 sequence 切、区域内沿 hidden 切，两维来回切换 ([0:32])
- SP 的三重收益：存的激活尺寸恒定除以 TP(SBH 大激活消失)、通信总量不变(AllReduce 只是拆成了 RS+AG)、区域外参数不再需要复制同步 ([0:34])
- LayerNorm 的梯度同步"免费"解决：reduce-scatter 与 all-gather 互为逆操作，把 forward 换成 RS+AG 后 backward 自然变成 AG+RS，而 backward 中 layer norm 前恰好是 reduce-scatter——正好把各卡(不同 sequence 分片)的 LN 梯度同步好，数学上严丝合缝 ([0:36])
- TP+SP 优缺点 recap：既省显存又省样本、无需梯度 AllReduce、LN 梯度也被 RS 顺带同步；但仍然通信重、实现复杂——因此各分布式训练库的共同建议是 TP≤8，把 TP 通信关在单节点(8 卡)内，避免 forward/backward 卡在跨节点的 AllReduce/RS/AG 上 ([0:37])
- 组合并行的关键性质：正交性——batch 沿数据轴切则沿模型轴复制，模型沿 TP 轴切则沿数据轴复制，反之亦然；于是所有并行可织成一张网格(process mesh)，代码里先 init process group、划出 TP 组与 DP 组，再指定沿哪个轴做集合通信，TorchTitan/Megatron/Nanotron 都是这个模式 ([0:39])

### 六、流水线并行 PP：与 pipeline bubble 作战

- 流水线并行(PP, pipeline parallelism)：把层垂直切(前几层给卡 1、接着给卡 2……)比 TP 好懂；裸切的问题一眼可见——第一张卡开局无活可干、forward 走完后又干等，这就是 pipeline bubble；scheduler(调度器)定义各卡如何喂数据、如何与其它 rank 交换激活与梯度 ([0:40])
- 最简单的 all-forward-all-backward 调度：排满 8 个 micro-batch，全体先做完 forward 再做 backward，靠多个 batch 把空转压小，但 bubble 仍是 PP 的头号问题 ([0:41])
- 两种进阶：1F1B(one-forward-one-backward,backward 优先、forward/backward 交错)主要省显存、bubble 仍在；DeepSeek 的 DualPipe 把层 round-robin 铺开(第一层同时放在首末两张卡)，两端同时起 forward 与 backward、对向流动并重叠——方向正确但实现极复杂，要盯紧每个 batch 的激活与梯度发谁 ([0:43])
- PP 的优点：通信便宜——没有 AllReduce，只在相邻 stage 间传激活和梯度；分片高效、模型无关(只要模型有层就行) ([0:44])
- PP 的缺点：要为多个 micro-batch 同时保存激活(8 个 backward / 20 个 micro-batch 的例子，激活 ×20)——PP 与 FSDP 这类依赖激活的方案通常配 activation checkpointing 或 CPU offload；藏 bubble 要上 DualPipe 级别的高级 scheduler、实现难度大；且 global batch 必须随 PP size 放大才有足够 micro-batch 可排 ([0:45])

### 七、上下文并行 CP 与专家并行 EP：两条专用路线

- 上下文并行(CP, context parallelism,字幕误作 CPP)：序列一长激活就爆炸，TP/PP 都救不了；DP 切 batch 的思路照搬到序列维——每卡分一段序列；但 attention 要看全序列，于是有了 ring attention：借鉴 flash attention 的 online softmax 思想，各卡先算局部 softmax、环形交换 K 和 V、迭代更新 softmax 累计量 ([0:46])
- CP 优缺点：五种并行里唯一能高效切分长序列的；但每个 attention 块内都要传 K/V(通信重，可用 send-receive 或 all-gather)，且各卡数据不同所以仍需梯度 AllReduce；短序列没收益——只在长上下文训练时启用 ([0:48])
- 专家并行(EP, expert parallelism)为 MoE 而生：router 把 token 路由给各专家，专家切到不同卡上即可；路由依赖 all-to-all——最通用的集合通信，n 张卡各自把消息发给其余所有卡，近似 n² 通信，也是最复杂的一种；top-K 路由下先 dispatch(all-to-all 把 token 送到专家所在卡)、专家算完再 combine 拼回原序列；EP 只碰 MoE 不碰 attention，为避免 attention 部分重复劳动数据也要在 EP 维共享——所以这个意义上 EP 与 DP 并不正交(它顺手也切了数据)，且因各卡数据不同需要梯度 AllReduce ([0:49])
- EP 最大的工程坑：CPU-GPU sync——dispatch 前必须等 GPU 上的 router 算完 expert scores，才能确定 buffer 大小与每专家 token 数(dispatch preprocess)；解法是 DeepSeek 的 DeepEP、NVIDIA 的 hybrid EP，但都要新硬件(IBGDA[字幕误作 IBGDI]+RDMA,预分配专用 SM 与显存)；没有 InfiniBand(如只有 H100[字幕疑为 H hundreds])就卡死在这个 sync 上——这就是多数实验室 MoE 训练慢的硬件根因，DeepEP 也只在 IBGDA 上能跑 ([0:52])
- EP 实操结论：它是高效分布式 MoE 的唯一方式，代价是每个 MoE 块一次 all-to-all + 梯度 AllReduce + CPU-GPU sync；实践解法是 EP+PP 组合——用 1F1B 的思路让一个 batch 的 dispatch/combine 与另一个 batch 的 forward/backward 重叠，两个 batch(蓝/绿)交错填满通信间隙，Megatron 里两个 flag 即可开启 ([0:55])

### 八、经验总结与 Q&A

- 收尾资源：Ultra-Scale Playbook 里有按 GPU 数选并行的决策 cheat sheet 和 infra 章节的大量 benchmark；TPU 视角可看 Jax Scaling Book；欢迎给 Nanotron、Torchtitan、Megatron-LM 等库贡献代码；最后提醒：规模上去之后要关注能耗、负责任地用卡 ([0:56])
- Q1(MoE 负载均衡)：token 全涌向一张卡会让其余卡空转，怎么办?——load balancing：DeepSeek 早期在 loss 里加负载均衡项、惩罚不均匀分布；后来的 auxiliary-loss-free 方案在 router 计算时加一个 bias 项，自动把分布调平 ([0:57])
- Q2(并行策略影响收敛/scaling law 吗)：不影响——各种并行不改变 forward/backward 的数学，只要实现正确，效果等价于单卡，scaling law 原样成立，PP 换 EP 也不该有差别 ([0:59])
- Q3(RL 训练中 CPU 侧 checkpointing/环境数据处理成为瓶颈、GPU 空转怎么办)：以文本为例，预先分配大量 dataloader workers，把数据预处理提前到训练迭代开始之前，靠并行预处理填满流水线 ([1:00:00])
- Q4(有没有自动选最优并行的办法)：有论文尝试(Jax book 在 TPU 上玩过自动决策)，但答案依赖模型大小、数据量、global batch 和网络；最大决定因素是网络瓶颈——NVLink 带宽从 4、8 到最新的 32、72，决定了你敢用多重的通信型并行；GPU 通常以 32 卡 pod 为单位，人们敢在 32 卡 pod 上做 TP ([1:01:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| DP 数据并行 | 每卡喂不同 batch、各自算梯度，AllReduce 同步后做相同的 optimizer step；简单、模型无关，但假设模型放得进显存。 |
| ZeRO-1/2/3 | DP 的三级显存优化：分别对 optimizer states、再丢 gradients、再分片 parameters；能 ZeRO-1 放下就别上 ZeRO-3。 |
| FSDP 全分片数据并行 | ZeRO-3 的 PyTorch 落地：按需 all-gather 当前层、用完即释放、预取下一层，显存中最多 2 个 FSDP 单元；FSDP2 基于 DTensor、保留完整 tensor。 |
| AllReduce | 分布式求和集合通信；恒等式 AllReduce = reduce-scatter + all-gather，拆开零额外通信，是 ZeRO 与 SP 反复复用的 trick。 |
| TP 张量并行 | 同一份数据、切权重矩阵(列切 + 行切)多卡合算一次计算；每个 matmul 区域 forward/backward 各需一次 AllReduce，通信最重、宜限于单节点 ≤8 卡。 |
| SP 序列并行 | TP 的搭档：TP 区域外(LayerNorm 等)沿 sequence 维切，靠 RS/AG 互换完成，激活恒 ÷TP，还免费同步了 LN 梯度。 |
| PP 流水线并行 | 按层垂直切、只在相邻 stage 传激活与梯度(通信最便宜)；bubble 靠 all-forward-all-backward、1F1B、DualPipe 逐级压制。 |
| CP 上下文并行 | 沿 sequence 维切数据专攻长上下文；ring attention 用 online softmax 边环形交换 K/V 边更新，短序列无收益。 |
| EP 专家并行 | MoE 专用：专家切到各卡，all-to-all 做 dispatch/combine；瓶颈在路由前的 CPU-GPU sync，需 IBGDA/RDMA 级硬件(DeepEP 等)。 |
| HSDP 混合分片 | 小圈子内 FSDP、大圈子外 vanilla DP，应对慢网络下 ZeRO-3 通信藏不住的问题。 |

## 自测题

1. AllReduce 与 reduce-scatter + all-gather 是什么关系?讲者把这个等式用了两次，分别在哪?
   > AllReduce 本质就是 reduce-scatter + all-gather，拆开不增加任何通信；第一次用在 ZeRO-1(替换 backward 里的 AllReduce)，第二次用在序列并行(替换 TP 区域边界的 AllReduce)。
2. ZeRO-1/2/3 各自分片什么?为什么"能 ZeRO-1 放下就别上 ZeRO-3"?
   > ZeRO-1 分片 optimizer states，ZeRO-2 再丢掉用不到的 gradients，ZeRO-3 连 parameters 也分片；ZeRO-3 每层都要 all-gather 参数，模型放得下时 ZeRO-3 只会多通信、更慢，分片没有其他收益。
3. Muon 优化器给 ZeRO/FSDP 的分片实现带来了什么新约束?
   > Muon 需要在完整 tensor 上做牛顿式更新，不能像旧做法那样 flatten 全部参数再切；分片必须整只 tensor 分给某张卡，FSDP2 为此保留完整 tensor(并用 DTensor 便于组合其他并行)。
4. ZeRO-3(FSDP)"看起来很慢却实际很快"，靠的是什么机制?
   > 每层按需 all-gather 参数、用完立刻释放，看似开销大，但计算当前层的同时预取下一层，通信与计算重叠，显存中同时最多只有 2 个 FSDP 单元。
5. 张量并行切 attention 为什么按 head 切而不是按 hidden 维切?校验 TP 实现的通用问题是什么?
   > head 之间相互独立，按 head 切各卡激活与 TP=1 完全相同；按 hidden 切会让 QK 乘积的归约维度残缺、softmax 算错；通用校验问题："各卡算出的激活与不用 TP 时一样吗?"
6. 序列并行如何做到零额外通信，还顺手解决了 LayerNorm 的梯度同步?
   > 把 TP 边界的 AllReduce 拆成 reduce-scatter(沿 sequence)+ all-gather，通信总量不变；RS 与 AG 互为逆操作，backward 中出现在 LN 之前的 reduce-scatter 自动完成梯度同步。
7. 流水线并行的 pipeline bubble 是什么?讲者提到的三种应对是什么?
   > bubble 是流水线各 stage 的空转等待；应对：all-forward-all-backward 排满 micro-batch、1F1B(backward 优先)省显存但 bubble 仍在、DualPipe 层 round-robin 铺开两端同算以重叠消除。
8. 专家并行最大的工程瓶颈是什么?为什么很多实验室的 MoE 训练很慢?
   > 路由前 CPU 必须等 GPU 算完 router 的 expert scores 才知道 buffer 大小与每专家 token 数(CPU-GPU sync);DeepEP 等解法依赖 IBGDA+RDMA 新硬件，没有 InfiniBand 就卡死在这一步，DeepEP 也只在 IBGDA 上能跑。
