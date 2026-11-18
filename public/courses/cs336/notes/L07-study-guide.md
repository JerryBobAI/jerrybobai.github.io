# CS336 Lecture 7 学习笔记：并行策略一

> 讲者：Tatsunori Hashimoto|配合视频 `lectures/L07-parallelism-1 [l1RJcDjzK8M].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L07-transcript.md](L07-transcript.md)

---

## 一句话概览

本讲是系统课第二讲，从单 GPU 优化转向多机并行：以集合通信原语为分析工具，依次讲透数据并行(ZeRO 三阶段与 FSDP)、流水线并行、张量并行与序列并行的原理、通信开销与取舍，最后给出 3D/4D 并行的组合经验法则，并用 Megatron-LLM、DeepSeek、Llama3、Gemma 2 等真实训练案例收尾。

## 分节要点(带时间锚点)

### 一、为什么要多机并行：算力与内存双重压力
- 本讲定位：基础系统课第二讲，主题从「优化单 GPU 吞吐」升级为跨机并行——模型大到单卡装不下(内存约束)，同时要用满所有服务器尽快训完(算力约束)，还要应对层级化的异构通信([0:00])
- 单 GPU 的 flops 曲线虽然超指数增长，但要等几年才有下一档；想今天训最强模型只能靠多机并行——最强超算已是 exaflop 量级([0:00])
- 内存侧同样吃紧：参数量增长快于 GPU 显存增长，数十亿参数装不进单卡，内存与算力是并行的两大核心资源([0:00])
- 硬件层级心智模型(以 GPT NeoX 8 卡机为例)：机内 8 GPU 经 NVSwitch 高速互联，跨机走 HDR InfiniBand 每车道慢约 8 倍；这个层级直接决定了并行策略的落位([0:00])
- GPU 世界还有一个 256 GPU 阈值：节点间 all-to-all 直连只到约一机架规模，再往上要经更慢的 leaf/spine 交换层级([0:05])

### 二、集合通信原语与关键恒等式
- 集合通信(collective communication)成本速记：all-reduce 约 2× 数据量、broadcast 约 1× 输出量；真正构建并行算法的基石是 all-gather(各 rank 的分片复制给所有人)与 reduce-scatter(归约后各 rank 只留一个分片)([0:05])
- 关键恒等式：all-reduce = reduce-scatter + all-gather——带宽受限下两者成本相当，是「免费改写」；中间还能夹计算，这是后面 ZeRO 近乎免费的关键伏笔([0:05])
- GPU 与 TPU 的组网差异：GPU 用节点+交换机 all-to-all 直连(上限约 256 GPU)，TPU 用环面网格(toroidal mesh)只连邻居但易扩展；而 all-reduce 这类集合通信在环面网格上可以跑得和 all-to-all 一样快——为集合通信优化时 TPU 拓扑反而合理([0:05])
- 并行算法的新分析框架：计算单元从 GPU 升级为整个数据中心，目标是线性内存扩展(最大可训模型随卡数线性涨)与线性算力扩展；性能分析只需数集合通信原语的调用次数，不必下探底层实现([0:10])
- 三类并行的总纲：数据并行(data parallelism)复制参数、切 batch；模型并行(model parallelism)切开模型各管一段；激活并行(activation parallelism)管住随序列变长越来越大的激活内存([0:10])

### 三、数据并行与 ZeRO 三阶段
- 朴素数据并行 = 切 batch 跑 SGD：每卡拿 B/M 的 micro-batch 各算梯度，梯度步前用 all-reduce 同步梯度；计算扩展好(单卡 batch 够大就能吃满算力)，通信开销 2× 参数/step，batch 大时可以掩盖；但内存完全不扩展——每卡都复制参数+优化器状态([0:15])
- 内存比看上去更糟：每参数约 16 字节、共约 5 份拷贝——BF16 参数 2B + BF16 梯度 2B + FP32 master 权重 4B + Adam 一阶矩 4B + 二阶矩 4B；大头是 Adam 优化器状态，7.5B 模型摊 64 卡仍要 120GB 且随卡数线性涨([0:15])
- ZeRO(零冗余优化器)的递进思路：依次分片优化器状态(stage 1,120→31.4GB)→ 再分梯度(stage 2,→16.6GB)→ 再分参数(stage 3,→1.9GB)([0:15])
- stage 1 为什么可行：每卡虽有全部参数与梯度(足以算出完整梯度)，但只持有自己 shard 的优化器状态，因此只负责更新自己的参数 shard；流程为各卡算全梯度 → reduce-scatter 梯度 → 各卡更新自己 shard → all-gather 新参数([0:20])
- 通信量口径提醒：讲义中的 2× 参数等均为集群总量而非单机([0:20])
- 顺带的问答：Adam 对参数近似对角独立，二阶预处理方法(K-FAC 等)虽有探索但尚未撼动 Adam 的地位([0:20])
- stage 1 为什么近乎免费：reduce-scatter + all-gather 的通信量与原来一次 all-reduce 相同(恒等式)，中间夹了优化器更新却换来了优化器状态全分片——带宽受限下白赚内存([0:25])
- stage 2 的额外复杂度：backward 不能先实例化完整梯度向量(会爆显存)，必须逐层算完立即 reduce-scatter 给负责该层的卡并就地释放；通信总量不变，但多了逐层同步的小开销([0:25])

### 四、FSDP(ZeRO stage 3)：按需通信与重叠
- ZeRO stage 3 = FSDP(全分片数据并行)：参数、梯度、优化器状态全部分片，一切内存除以卡数，收益最大；要点是前向、反向边走边按需 all-gather 参数、用完即释放，不让大向量躺在显存里([0:30])
- 单步流程：前向 = all-gather 参数 → 算该层 → 释放权重，逐层重复；反向 = all-gather 参数 → 算梯度 → reduce-scatter 梯度 → 释放；全程激活要留存，成为后续问题([0:30])
- 代价与惊喜：通信从 2× 参数涨到 3×(前向两次 all-gather + 反向一次 reduce-scatter)，还有等待通信的空泡；但实测开销低得出人意料([0:30])
- 低开销的关键 = 通信与计算重叠(prefetch)：CPU 提前把下一层的 all-gather 派发给通信子系统，与当前层矩阵乘并行跑；以 y=(W1·W0+W2·W0)x 为例，all-gather 1 在 all-gather 0 结束时即启动，等前向 1 需要参数时早已就位，几乎无气泡([0:30])
- 时间线细节：权重复用(如 W0 用两次)不需重新通信；反向开头开销更高，因为要穿插 reduce-scatter 与 all-gather([0:35])
- 三阶段总结：stage 1 免费(同通信量白得分片)、stage 2 同为 2× 但有逐层释放梯度的开销、stage 3 为 3×；数据并行对架构完全无感，所以 FSDP 一个 wrapper 就能包任意网络，这正是它流行的原因([0:35])
- 收益直观：8×A100 80GB 节点上，朴素方式只装得下约 6B 模型，用 ZeRO stage 3 能装约 50B([0:40])
- 与模型并行的分界：ZeRO/FSDP 虽分片了参数，但仍靠「搬参数」工作；真正的模型并行让参数整块驻留单卡、只传激活——这是下一节的转折点([0:40])

### 五、流水线并行(pipeline parallelism)
- 动机与资源观：数据并行的并行度上限 = batch size(每卡至少一个样本)，而 batch 超过临界值(critical batch size)后收益急剧递减——梯度噪声已压得差不多，再大就受限于梯度步数本身；所以 batch size 是要精打细算花的稀缺资源([0:40])
- 模型并行的另一种动机：把参数整块切开让模型完全分开驻留，激活内存也跟着减——ZeRO 1/2 不缩内存、stage 3 又慢且不减激活，需要新轴([0:40])
- 流水线并行(pipeline parallelism)= 按层边界切模型，每卡管连续几层，只传激活；概念最直观，实现最可怕([0:45])
- 朴素版(单 microbatch)不可用：前向逐卡接力、反向倒序接力，GPU 活跃时间只占 1/stages，加 4 卡得到 1 卡吞吐([0:45])
- 解法 = microbatch 流水线：第 1 个 microbatch 的激活一发走就开始算第 2 个，通信与计算重叠；气泡占比 =(stages−1)/microbatches——又一批 batch size 被消耗，同一 batch 可花在数据并行或压气泡上([0:45])
- 流水线的存在理由：省内存(参数与激活都分片)、通信只依赖激活且是点对点，适合机间、跨机架等慢速链路；Google 透露 TPU 因为网速均匀、没有 256 卡断档，几乎不用流水线([0:50])
- NVIDIA 论文实测：batch 8 时加大流水线规模利用率骤降，batch 128 则能撑住较大流水线——batch size 是掩盖气泡的关键([0:50])
- 进阶调度 zero bubble pipeline(DeepSeek 称 dual pipe)：把反向拆成激活回传 B(有串行依赖)与权重梯度 W(无依赖、随时可算)，在 1F-1B 调度的空闲气泡里填 W，把利用率进一步拉高([0:50])
- 实现警告：要干预 autodiff 的计算顺序并维护队列，复杂度极高；有前沿实验室段子——组里只有一个人懂自家流水线并行，而那个人离职了([0:50])

### 六、张量并行与序列并行
- 张量并行(tensor parallelism)= 沿宽度切矩阵乘：把 X·A 拆成子矩阵分块计算再求和；概念不如流水线直观，但实现干净得多，是大模型训练的主力模型并行([0:55])
- MLP 实例：Y = GeLU(X·A) 把 A 切成 A1/A2、B 切成 B1/B2，前向把 X 复制给各卡分别算、再 all-reduce 求和；反向同理，梯度复制后 all-reduce——前向、后向各恰一次 all-reduce，作为同步屏障([0:55])
- 代价：每层前向+后向要传两遍残差激活量级的通信、且是 all-reduce，带宽需求极高 → 经验法则：张量并行只在单机内用(如 8 卡 NVLink 机型)([0:55])
- HuggingFace 实测吞吐损失：TP=8 约 10-12%(可接受),TP=16 骤降 42%,TP=32 降 65%——张量并行停在 8 是硬甜点([1:00:00])
- 与流水线对比：无气泡、不消耗 batch size、实现复杂度低(只需知道大矩阵乘在哪)；缺点是通信量大得多——流水线每 microbatch 只传 batch×seq×residual 的点对点，张量并行每层约 8 倍于此且是 all-reduce([1:00:00])
- 组合问答：大规模训练通常张量并行打底、流水线叠加；讲者所知唯一只做流水线不做张量并行的是 DeepSeek V3([1:00:00])
- 激活内存是最后的硬骨头：训练内存动态变化——参数静态、优化器状态从 0 涨起、激活前向涨反向降、梯度反向涨，峰值出现在反向中段；激进并行后参数与优化器内存不再涨，激活却随模型变大持续增长([1:05:00])
- 每层激活公式：sbh·(34 + 5as/h)——左边 sbh·34 来自 MLP 与逐点操作，右边乘开是 as²b，来自 attention softmax 等二次项(flash attention + 重计算可大幅消掉)([1:05:00])
- 张量并行后仍剩 sbh·10 的钉子户：LayerNorm、Dropout、attention/MLP 输入等非矩阵乘组件不随 TP 下降([1:05:00])
- 序列并行(sequence parallelism)收尾：这些逐点操作在序列位置之间互不依赖，沿序列维切开分给各卡；前向 all-gather 进、reduce-scatter 出，反向两者对偶反转——最终激活下限 sbh·34/t([1:05:00])

### 七、组合策略与实战案例
- 两个延伸策略：上下文并行(context parallelism)/ ring attention——query 分片驻留、key/value 沿环传递，本质是 flash attention 的分块在线计算搬到多卡；专家并行(expert parallelism)——把大 MLP 切成稀疏激活的专家分到各卡，世界观念似张量并行，但路由不可预测、通信更复杂([1:10:00])
- 四策略总结表：DDP/ZeRO-1 通信合理但零内存扩展且吃 batch size；FSDP 有内存扩展但逐层开销、同步屏障伤利用率；流水线线性扩内存、不占每批通信，但吃 batch size 且极难搭；张量并行带宽最贵，却是唯一不碰 batch size 的策略([1:10:00])
- 三种要平衡的稀缺资源：内存、带宽+算力、batch size(非常规但真实有限,可花在数据并行、压气泡或梯度积累上)([1:10:00])
- Google TPU 手册的选择图：按 batch/GPU 比值选策略——batch 太小永远 communication-bound；中等时 FSDP+张量并行混合可到 compute-bound;batch 足够大时纯 FSDP 就够([1:10:00])
- 3D/4D(乃至传闻的 5D)并行的经验法则：①内存放不下 → 先张量并行加到单机上限；②还不够 → 跨机用 ZeRO-3 或流水线并行直到放下；③剩余 GPU 全给数据并行吃满算力；④batch 太小用梯度积累(gradient accumulation)换通信效率——同步更少、等效 batch 更大([1:15:00])
- Megatron-LLM(2021)实测：1.7B 到 1T 参数利用率 40-52% 峰值 flops；张量并行 1→8 封顶，模型放不下时加流水线，数据并行相应让位——3D 并行调好后每卡 flops 曲线平坦 = 总吞吐线性扩展；TP=8 + 激活重计算换大 batch，反过来掩盖流水线开销，重计算多花的 flops 能自己挣回来([1:15:00])
- 现役模型配置盘点：OLMo 7B 用 FSDP；DeepSeek V1 用 ZeRO-1+序列并行+流水线，V3 用 16 路流水线+64 路专家并行+ZeRO-1；Yi 用 ZeRO-1+张量+流水线，Yi-lightning 因 MoE 用专家并行替代张量并行([1:20:00])
- Llama3 报告值得精读：TP8 + CP(仅长上下文阶段)+ 流水线 + 数据并行，按带宽需求从高到低排序，数据并行最能容忍长延迟(可异步取分片权重)；同时暴露规模训练的另一面——148 次 GPU 故障占全部中断约 30%，更可怕的是 GPU 静默出错产生脏数据毁掉整个 run([1:20:00])
- Gemma 2 是 TPU 侧样本：ZeRO-3 + 模型并行 + 数据并行，TPU 均匀组网让模型并行能拉得更远；总结：没有单一银弹，三种并行按 strengths 组合 + 简单可解释的经验法则即可([1:20:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| 集合通信(collective communication) | 跨 rank 的通信原语家族：all-reduce、broadcast、reduce、all-gather、reduce-scatter |
| all-reduce | 全员数据归约后复制到每个 rank，通信约 2× 数据量 |
| all-gather | 各 rank 持有的分片拼齐复制给所有 rank |
| reduce-scatter | 归约后每个 rank 只留一个分片；与 all-gather 组合即 all-reduce(关键恒等式) |
| NVLink/NVSwitch vs InfiniBand | 机内 GPU 高速互联 vs 跨机网络，每车道慢约 8 倍；GPU all-to-all 直连上限约 256 卡 |
| toroidal mesh | TPU 环面网格，只连邻居但集合通信效率与 all-to-all 相当 |
| ZeRO stage 1/2/3 | 依次分片优化器状态/梯度/参数，通信 2×/2×/3×;stage 3 = FSDP |
| 16 字节/参数 | BF16 训练每参数内存：参数 2 + 梯度 2 + master 权重 4 + Adam 一二阶矩 8，优化器状态是大头 |
| FSDP | 全分片数据并行：按需 all-gather 参数、用完即释放，靠预取把通信藏进计算 |
| 通信-计算重叠 | 提前派发下一层的 all-gather 与当前层计算并行，FSDP 低开销的关键 |
| pipeline bubble | 流水线空闲占比 =(stages−1)/microbatches，靠大 batch(多 microbatch)摊薄 |
| 1F-1B / zero bubble | 交错流水线调度；zero bubble(dual pipe)把反向拆出无依赖的权重梯度填气泡 |
| 张量并行(tensor parallelism) | 沿宽度切矩阵乘到多卡，每层前向后向各一次 all-reduce，限单机 8 卡内 |
| 序列并行(sequence parallelism) | 沿序列维切 LayerNorm/Dropout 等逐点操作，补上 TP 省不掉的 sbh·10 激活 |
| ring attention / context parallel | query 分片驻留、key/value 环形传递，flash attention 分块计算的多卡化 |
| expert parallelism | 稀疏激活的专家 MLP 分片上卡，观念似张量并行但路由不可预测 |
| 3D/4D 并行 | TP(单机)+ ZeRO-3 或 PP(跨机)+ DP(铺满)的组合法则，batch size 是第四维资源 |

## 自测题
1. all-reduce 等价于哪两个集合通信原语的组合?带宽代价相比如何?
   > reduce-scatter + all-gather；带宽受限下与一次 all-reduce 相当(约 2× 数据量)，是免费改写，且两者之间还能夹计算。
2. ZeRO 三个 stage 各分片什么，通信开销分别是多少?
   > stage 1 分优化器状态(2×,与朴素数据并行相同、近乎免费);stage 2 再分梯度(2×,逐层同步小开销);stage 3 再分参数即 FSDP(3×)。
3. BF16 训练时每个参数约占 16 字节，大头在哪?
   > 参数 2B + 梯度 2B + FP32 master 权重 4B + Adam 一阶矩 4B + 二阶矩 4B；优化器状态占 12B，比参数与梯度本身还大。
4. FSDP 要不停地搬参数，为什么实际开销反而很低?
   > 通信与计算重叠：提前 all-gather 下一层参数(预取)与当前层矩阵乘并行执行，等到要用时参数已就位，气泡很小。
5. 单 microbatch 的朴素流水线并行 GPU 利用率是多少?气泡占比公式是什么?
   > 利用率只有 1/stages；气泡/有效计算 =(stages−1)/microbatches，所以靠大 batch 切出更多 microbatch 来摊薄。
6. zero bubble pipeline(DeepSeek 的 dual pipe)的核心技巧是什么?
   > 把反向拆成激活回传(有串行依赖,须按序)与权重梯度计算(无依赖、随时可算)，用后者填原本的空闲气泡。
7. 张量并行为什么只在单机 8 卡内使用?
   > 每层前向+后向各一次 all-reduce 同步屏障、每层通信约为流水线的 8 倍，必须低延迟高带宽互联；跨机后吞吐骤降(16 路 −42%、32 路 −65%)。
8. 3D/4D 并行的经验法则分配顺序是什么?
   > 放不下先张量并行加到单机上限 → 跨机用 ZeRO-3 或流水线并行直到放下 → 剩余 GPU 全给数据并行；batch 太小再用梯度积累换通信效率。
