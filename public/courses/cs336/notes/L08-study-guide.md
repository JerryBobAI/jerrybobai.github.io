# CS336 Lecture 8 学习笔记：并行策略二

> 讲者：Percy Liang|配合视频 `lectures/L08-parallelism-2 [LHpr5ytssLo].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L08-transcript.md](L08-transcript.md)

---

## 一句话概览

L07 讲并行「是什么与为什么」，本讲（Percy 主讲）把概念钉进代码：上半场过集合通信原语(collective operations)的语义与 NCCL/torch.distributed 实现，并在单节点实测 all_reduce/reduce_scatter 带宽；下半场在一个深度 MLP 上手写数据并行、张量并行、流水线并行三种最小实现，末尾借 Jax/TPU 生态对比收束到课程母题——沿维度切分，在重算、存内存与跨卡通信之间权衡。

## 分节要点（带时间锚点）

### 一、定位与存储层级回顾
- 本讲是系统周第二讲：上周(L07)讲单 GPU 内的并行(fusion、tiling)，本周讲跨 GPU、跨节点；硬件图景 = 节点（通常 8 卡）→ GPU → 流式多处理器(SM)，计算只发生在 SM 的 ALU 上，内存与通信是配套的绿色部分([0:00])
- 数据可能远在天边：幸运时在 L1，次之在 HBM，本周最远在另一张 GPU；主旋律 = 组织计算避开传输瓶颈、保住算术强度(arithmetic intensity)，让 GPU 持续饱和运转([0:00])
- 互连层级从小快到大慢：L1 → HBM → NVLink（同节点卡间）→ NVSwitch（跨节点）；「最小化数据搬运」的概念与单卡一致（fusion/tiling 在 L1 上工作、有节制地写回 HBM），变的只是机制([0:02])
- 本讲两部分：① 集合通信原语 + NCCL/PyTorch 实现 + 基准测试；② 数据/张量/流水线并行在代码中的落地；这些原语至少 80 年代并行编程文献就有，久经考验，比自己管理点对点通信的抽象更好([0:04])

### 二、集合通信原语速览
- 术语：world size = 设备总数（例 4）；rank = 设备编号 0..N-1，与线性代数的「秩」无关([0:05])
- 六个原语：broadcast 把一份数据发到所有 rank;scatter 各发不同份；gather 收拢到某个 rank;reduce = gather + 逐元素结合律交换律运算（sum/min/max/平均）;all_gather = gather 到所有 rank;reduce_scatter = 归约后再按份 scatter([0:06])
- 恒等式与记忆法：all_reduce = reduce + all_gather（也 = reduce_scatter + all_gather）;reduce 指结合律交换律运算，all 前缀指目的地是全部设备；broadcast/scatter 与 gather 互逆([0:07])

### 三、硬件互连与软件栈：PCI-E 以太网 → NVLink/NVSwitch → NCCL
- 传统机器：GPU 间走 PCI-E 总线、经 CPU 内核中转，跨节点走以太网；数据要拷进缓冲、过协议栈，开销大；PCI-E 是通用总线，声卡、SSD 都挂在上面([0:08])
- 现代设计：NVLink 让 GPU 直连、绕过 CPU；NVSwitch 让跨节点 GPU 直连、绕过以太网——专为深度学习这类「一串 GPU 合干一件事」的负载优化([0:10])
- 带宽数量级：H100 每卡 18 条 NVLink gen4，合计 900 GB/s，远超 PCI-E 与以太网；但仍比 SM 读 HBM 慢约 4 倍；新 Blackwell 又提升 2-3 倍([0:11])
- `nvidia-smi topo` 类命令可查实际拓扑：8 卡节点两两 GPU 间都是 NV18；网卡(NIC)提供 PCI-E 与 CPU 的连接；CPU 当然仍要对话，只是数据不必经过它([0:12])
- NCCL（NVIDIA 集合通信库）：把 all_reduce 等原语翻译成 GPU 间要发的底层包；启动时设备互相通信探测拓扑、优化路径，真正调用时发射 CUDA kernel 收发数据——程序员只需说「这个张量要出现在所有机器上」([0:13])
- torch.distributed：PyTorch 的干净封装，多后端可换——GPU 用 NCCL，CPU 用 gloo（笔记本无 GPU 也能调试作业）；逻辑正确性与硬件性能解耦；它也封装了 FSDP，但课程秉持 from scratch 原则不直接用([0:15])

### 四、代码实操：集合操作与带宽基准
- 实验脚手架：用 multiprocessing 起 world_size 个进程跑同一函数；init_process_group 只负责进程互相发现（协调信令），数据本身走 NCCL；barrier = 等全组进程到齐的同步点（此处只为让打印聚在一起）([0:18])
- all_reduce 就地覆写：rank i 持有 [0,1,2,3]+i，求和后人人得 [6,10,14,18]；各 rank 异步执行、打印顺序不定；也可选异步版本来重叠通信与计算([0:19])
- reduce_scatter 不 in-place：输入各分量之和落到对应 rank、输出是标量；再接 all_gather 一步步还原出 all_reduce 的结果——亲手验证恒等式；张量某一维须对齐 world_size([0:20])
- 基准纪律：warmup 跑一次 + synchronize + barrier 之后再开始计时，把 kernel 加载等一次性干扰清场([0:22])
- all_reduce 带宽账本：每张量要发 world_size−1 份，且「发出 + 收回」两程(×2)；100M 个 float32、world_size=4 实测约 277 GB/s，对照 H100 标称 900 GB/s——实际收益因张量大小、卡数而异，必须实测([0:25])
- reduce_scatter 只有一程（归约后散出、无收回），实测约 70 GB/s；差距疑似与 SHARP 在网计算、NCCL 内部优化有关，难以纸面推理——这正是要基准测试的原因([0:27])

### 五、数据并行(DDP)：切 batch 维
- 教学载体选深 MLP：Transformer 的算力瓶颈在 MLP 不在 attention，简单架构仍有代表性；三种并行 = 沿不同维度切数据或模型([0:30])
- 实现：batch 128 ÷ world_size 4 = 每卡 local batch 32，按 rank 切行；每卡持有完整模型副本，前向反向与单机 SGD 逐行相同([0:32])
- DDP 的唯一改动：反向后对每层 param.grad 做 all_reduce 求平均，再照常更新；各 rank loss 不同（数据不同），梯度同步后参数始终保持一致——教科书式的 all_reduce 应用([0:35])
- 两个坑：all_reduce 是隐式同步点，某 rank 漏调一次全员挂起；初始参数在各 rank 相同（只是放到不同 GPU），靠相同随机种子保证([0:36])
- 不迁移优化器状态，而是每卡各自维护——「多算 vs 多传」的权衡，与 activation checkpointing 同源；本质是跑 world_size 份完全同步的 SGD([0:40])

### 六、张量并行(TP)与流水线并行(PP)
- TP 切 hidden 维：1024 ÷ 4 = 每卡 256 列参数，每层都拿 1/world_size；激活也随之变成 batch × 256——切模型的动机本来就是单卡装不下([0:41])
- TP 每层算完做 all_gather，把各卡的部分激活拼回完整的 batch × 1024 再进下一层，层层重复；通信量大，呼应 L07：TP 必须配高带宽互连([0:43])
- PP 按层切：4 层 2 卡各拿 2 层，每卡只分配自己那些层的参数；把 batch 128 切成 4 个 32 的 micro-batch 来填流水线气泡(pipeline bubble)([0:45])
- PP 用点对点 send/recv 而非集合通信：rank 0 收数据 → 算自己那两层 → 发给下一卡，逐 micro-batch 重复；末卡拿到完整前向结果，若做反向则从末卡逐卡回传([0:46])
- 朴素 PP 缺三样：send/recv 是同步的、该改异步（isend 返回 handle,最后统一 wait）；通信与计算不重叠；有了反向还要调度前反向交错([0:47])
- 问答补充：接收方按 source rank 收「下一到来消息」，张量变量名无所谓；同 rank 多次 send 在 stream 里保序；send 无人接收就一直阻塞；现代训练仍是同步范式——异步参数服务器(event-driven)是 10 多年前的路线([0:50])

### 七、Jax/TPU 生态与全课总结
- 真实框架(Megatron-LM、PyTorch FSDP)代码相当 hairy：要支持任意架构就得做大量参数/层的 bookkeeping；MLP 示例的好处是切分方式由人拍板([0:52])
- Jax/TPU 生态：声明式指定按哪个维度 sharding，编译器自动生成通信；Stanford 的 Levanter 里 FSDP 十行搞定；TP = 按 attention head 维 + model 维切([0:55])
- Jax 更高层（描述带维度的计算图并映射到 TPU,编译器生成搬运原语）；课程坚持 PyTorch 是为了看清底层；真实世界不该从零造轮子([1:00:00])
- 总结：一切并行 = 沿某个维度切（batch / 宽度 / 深度 / 上下文长度）；永恒权衡 = 重算 vs 存内存（付传输代价）vs 存别的卡再通信（更慢）；常受限于通信或内存，重算往往反而划算([1:01:00])
- 硬件层级不会消失：别指望「五年后全塞进 L1/HBM」——模型总会涨到贴着硬件上限；分层存储自计算机诞生就在，也将一直在([1:03:00])

### 八、Q&A 精选
- PyTorch 的 FSDP 是开箱即用的 wrapper（不上这门课就该直接用），但自定义 sharding 不如 Jax 成熟；生态光谱：Jax/TPU 声明式一条龙 ↔ DeepSeek 互连受限、下探到 NCCL 层抠性能——用哪套招数取决于身处哪个生态([1:05:00])
- activation checkpointing 有 API 可指定「重算哪些」：不必全存也不必全算，大约每隔几层、在大 matmul 后设检查点；matmul + 逐点非线性这种「一步可推」的组合存一份就够([1:06:00])
- 专用硬件：Groq、Cerebras 主打超大片上内存（近似巨型 L1,数据不必搬出）；GPU 为分支/通用计算设计的包袱，在深度学习场景是优化空间([1:07:00])
- 续训完全可行：训练单元就是梯度步，拿半程 checkpoint 接着跑即可，与从头训无本质区别([1:08:00])
- 节点不能无限大的物理约束：功耗、散热、带宽密度；Cerebras 用特殊制造工艺把内存放片上，代价是灵活性([1:10:00])
- 更深层的原因：GPU 延续 CPU 时代「代码是一等公民、数据为计算服务」的控制流思维；深度学习是静态数据流图，开局即知全部计算，理应更聪明地布局；计算图是概念性的，不真有一张图放上 GPU——CPU 是主驾驶，调 NCCL 发射 kernel 搬数据([1:11:00])

## 核心概念速查
| 术语 | 一句话解释 |
| --- | --- |
| world size / rank | 设备总数 / 每个设备的编号 0..N-1 |
| broadcast / scatter / gather | 一份发全网 / 各发不同份 / 收拢到某 rank |
| reduce / all_gather / reduce_scatter | gather+归约 / gather 到所有 rank / 归约后按份 scatter |
| all_reduce | = reduce + all_gather = reduce_scatter + all_gather；带宽公式含 ×2（发出+收回） |
| barrier | 等全组进程到齐的同步点 |
| NCCL / gloo | torch.distributed 的 GPU 后端 / CPU 后端（无 GPU 可调试） |
| NVLink / NVSwitch | 同节点 GPU 直连（绕过 CPU）/ 跨节点直连（绕过以太网）;H100 每卡 18 条 gen4 共 900 GB/s |
| SHARP | NVIDIA 在网计算加速，可省一次往返，影响带宽账本 |
| DDP | 数据并行：切 batch；每卡全模型副本；对每层 grad 做 all_reduce 求平均 |
| TP | 张量并行：切 hidden 维；每层后 all_gather 拼回完整激活，通信量大、须高带宽互连 |
| PP + micro-batch | 流水线并行：按层切；batch 切小份填气泡；点对点 send/recv |
| pipeline bubble | 流水线空转等待，靠 micro-batch 缓解；send/recv 应异步化以重叠通信计算 |
| Levanter / Jax | Stanford 基于 Jax 的训练库；声明式 sharding、编译器生成通信，FSDP 十行 |
| activation checkpointing | 重算换内存的权衡，API 可指定重算位置（如大 matmul 后） |

## 自测题
1. 集合通信里 all_reduce 等价于哪两个原语的组合？它的实测带宽公式里为什么有因子 2?
   > all_reduce = reduce_scatter + all_gather（即 reduce + all_gather）；每个 rank 要把数据发出去再收回结果，字节数按两程计。
2. DDP 相对单机 SGD 只需要加哪一行核心操作？之后各 rank 的 loss 和参数分别处于什么状态？
   > 反向后对每层 param.grad 做 all_reduce 求平均；loss 因数据不同各不相同，参数在同步后始终保持一致。
3. 为什么说 DDP 里的 all_reduce 是隐式同步点？某个 rank 漏调一次会发生什么？
   > 集合操作要求全组进程到齐才能完成；漏调的 rank 与其余 rank 互相等待，训练直接挂起。
4. 张量并行沿哪个维度切模型？每层前向需要什么通信、为什么它对互连带宽要求最高？
   > 沿 hidden 维切；每层算完部分激活后 all_gather 拼回完整激活，激活全量在卡间搬运，通信量最大。
5. 流水线并行用什么手段缓解流水线气泡？它的通信原语和 DDP/TP 有何本质不同？
   > 把 batch 切成 micro-batch 填满流水线；用点对点 send/recv 而非集合通信。
6. H100 单卡的 NVLink 总带宽是多少？它和 SM 读 HBM 的速度差多少倍？
   > 18 条 NVLink gen4 合计 900 GB/s；仍比读 HBM 慢约 4 倍。
7. 为什么「硬件未来会变大、并行不再必要」的想法不成立？
   > 模型规模总会涨到贴着硬件上限，L1→HBM→跨卡的存储层级自计算机诞生就在、不会消失。
