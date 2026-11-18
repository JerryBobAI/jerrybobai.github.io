# CS336 Lecture 5 学习笔记：GPU 硬件

> 讲者：Tatsunori Hashimoto|配合视频 `lectures/L05-gpus [6OBtO9niT00].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L05-transcript.md](L05-transcript.md)

---

## 一句话概览

本讲拆掉 GPU 的魔法感：从执行模型(SM/warp/SIMT)与内存层次出发，给出让矩阵乘快起来的整套优化技巧(低精度、算子融合、重计算、合并访问、分块)，解开 matmul 性能曲线的波浪之谜(对齐与波量化)，最后用 FlashAttention 演示所有技巧如何合体——为作业 2 手写 FlashAttention-2 与后续并行化课程打地基。

## 分节要点(带时间锚点)

### 一、为什么硬件重要：从 Dennard 扩展到并行扩展
- 本讲定位：作业 1 今晚截止，作业 2 将用 Triton 实现 FlashAttention-2；两个学习目标——拆掉 CUDA/GPU 的魔法感(理解硬件为何快慢)、学会亲手加速新算法；延伸资料：Horace He 博客、CUDA mode 社区、Google TPU book([0:00])
- 动机：缩放定律(scaling laws)表明算力约等于性能(预训练与推理皆然)，但真正驱动进步的是更快硬件、更高利用率与更好的并行化——不懂硬件就吃不透这条曲线([0:00])
- 历史转折：Dennard scaling(Dennard 缩放)+ Moore's law 时代，晶体管翻倍带动时钟更快、功耗更低；1980s-2000 年代单线程性能饱和，晶体管密度仍在涨却不再转化为单线程吞吐([0:05])
- 出路是并行扩展：Bill Dally keynote 的曲线显示 GPU 每秒整数运算从 K20 到 H100 呈超指数增长——深度学习的故事就是从单线程扩展转向并行扩展([0:05])

### 二、CPU 与 GPU 的分野：延迟机与吞吐机
- CPU 为延迟而设计：大量芯片面积给控制单元与分支预测，线程少而快，单个任务尽早完成；GPU 为吞吐而设计：芯片大头全是 ALU，少量控制逻辑驱动海量并行计算，任务整体完成更快、单任务延迟反而更高([0:05])
- GPU 解剖：原子单元是流式多处理器(streaming multiprocessor, SM)，内含大量流式处理器(streaming processor, SP)与专用矩阵乘单元；SM 持有控制逻辑(能分支、决定执行什么)，SP 把同一指令套到不同数据上；A100 有 128 个 SM，远超 CPU 核数([0:05])
- 执行模型三层由粗到细：线程块(block,分派给某个 SM 的线程大组)→ 线程束(warp,block 内连续编号的 32 线程组成的执行组)→ 线程(thread)；同一 warp 全线程同一指令、不同数据，即单指令多线程(SIMT)([0:10])

### 三、内存层次与 TPU 对照
- 内存比计算更关键：速度由物理距离决定——L1/共享内存(shared memory)在 SM 内部，约 20 个时钟周期；L2 在芯片上、SM 旁边，慢约 10 倍；HBM(High Bandwidth Memory)/DRAM 在芯片外，要 200-300 个周期([0:10])
- 这个 10 倍差距是致命的：计算一旦要等 global memory，SM 就无活可干而空转，利用率崩塌——「围绕内存思考」是全讲的主旋律([0:10])
- 逻辑内存模型：寄存器(register)→ local → shared → global 逐级变慢；线程读写自己的寄存器与所在 block 的共享内存，跨 block 通信只能走 global memory——理想 kernel 是把小块数据装进共享内存后全程就地计算([0:15])
- TPU 对照：张量核心(tensor core)≈ GPU 的 SM，内含标量单元(控制)、向量单元、专做矩阵乘的 MXU 大块、片上快存与片外 HBM；结构上与 GPU 同构、只为矩阵乘而生所以更简单——操作对象是张量，但执行的计算始终是(批量)矩阵乘([0:15])
- GPU 成功的三个原因：扩容只需加 SM(不撞频率与散热墙)、SIMT 编程模型概念简单(一条指令扫一片数据)、线程极轻量可随时启停——这让每个 SM 都能维持高利用率([0:15])

### 四、矩阵乘是特权操作，内存是长期瓶颈
- 早年没有矩阵乘硬件，研究者靠 texture buffer 等 hack 在图形 GPU 上跑矩阵乘；V100 起加入张量核心专用硬件后，matmul FLOPs 与非 matmul FLOPs 拉开数量级差距([0:20])
- 架构设计铁律：深度学习负载的大头必须是矩阵乘；任何以非 matmul 运算为主的神经网络都会吃大亏([0:20])
- 扩展速率失衡是关键事实：主机互连(PCIe/NVLink)增长慢，global memory(GDDR→HBM2E)涨约 100 倍，而算力(matmul FLOPs)涨约 100,000 倍——瓶颈必然滑向内存([0:20])
- DRAM 很难继续扩展，差距只会更大：硬件高效算法的设计中心必须越来越偏向数据移动，而非 FLOPs 数量([0:20])

### 五、优化工具箱(上)：分支、低精度、算子融合
- 总纲是屋顶线模型(roofline model)：左侧 memory-bound(受算术强度(arithmetic intensity)即 FLOPs per byte 限制)，右侧 compute-bound(计算单元满载)；目标就是别待在左边([0:25])
- 唯一的非内存 trick：条件分支。SIMT 下 warp 只能执行一条指令，warp 内 if/else 会逼两拨线程暂停/唤醒、串行交替执行，性能严重受损——别在并行计算单元里写分支([0:25])
- 低精度是最大的招：GPU 多年进步的一大推手其实是数值表示(FP32→FP16→int8)；位数少则搬运少——ReLU 例：FP32 下每 FLOP 搬 8 字节，FP16 下 4 字节，内存瓶颈处的吞吐直接翻倍([0:30])
- 混合精度(mixed precision)是细致工程：输入/存储用 16-bit，部分和累加用 FP32 accumulator(张量核心返回 FP32 再降回 16-bit)；exp 类需要动态范围的算子用 bf16 防上溢/下溢——并非网络处处都能低精度([0:30])
- 算子融合(operator fusion)：工厂比喻——工厂(算力)再强，传送带(内存带宽)有限就白搭；naive 逐算子写回 global 等于让数据在内存与计算之间来回通勤；正确姿势是无依赖的算子链全留在计算单元内一口气算完，最后才回写([0:30])
- 融合实例：sin²x+cos²x 模块的 PyTorch 计算图会发 5 个来回搬运的 CUDA kernel；手写 CUDA 或 torch.compile 都能自动融合成一发——torch.compile 处处值得用([0:35])

### 六、优化工具箱(下)：重计算、合并访问、分块
- 重计算(recomputation)：用算力换内存带宽——不存激活，backward 时在 SM 本地现算；三层 sigmoid 例：内存访问从 8 次降到 5 次(5/8)；与 gradient checkpointing 同一技巧、不同动机——那边为省显存，这边为执行速度([0:35])
- 突发模式(burst mode)：DRAM 收到读一个地址的请求，会把整个 burst section(如连续 4 个值)一并返回——硬件上字节本就要先搬到放大器(amplifier)，这一步慢，顺路多给几乎免费；访问模式友好就能白拿数倍吞吐([0:40])
- 内存合并(memory coalescing)：warp 的 32 个线程若落在同一 burst section，硬件把查询合并成一次读取，内存吞吐最高 4 倍([0:40])
- 遍历方向很重要：行优先存储下，线程横着读同一行(地址相邻)才能合并；每线程竖着沿列下走会各自踩进不同 burst section——初看像反了，实际就是如此；方向写错内存访问慢数倍([0:45])
- 分块(tiling)：naive matmul 的元素被多个线程反复从 global 读入且访问不合并；解法是把 M、N 切成子块轮流装入共享内存，partial sums 就地累加进输出([0:45])
- 分块的收益与约束：global 读取从每个元素 N 次降到 N/T 次(shared 内读 T 次)，即 T 倍缩减，整块装载顺序任意可顺便合并；但 tile size 要兼顾合并访问、不超共享内存容量、维度尽量整除——257 这类尺寸产生稀疏 tile 令尾部 SM 闲置，且 SM 满载时共享内存已是瓶颈资源、prefetch 无处安放([0:50])

### 七、谜底：对齐与波量化；收束：FlashAttention
- 谜题收拢：约 1536 以下是屋顶线的 IO 瓶颈区——矩阵太小，装载与基本 IO 就吃满带宽；右侧上包络是可达峰值，但尺寸不对就会掉进各种怪坑([0:55])
- 谜底一(可整除性)：matmul 性能按尺寸能否被 32/16/8/2/1 整除分层着色，素数维度(K=1)最惨——tile 无法与 burst 读取对齐，别用素数维度([1:00:00])
- 谜底二(波量化(wave quantization))：tile 取 256×128 时尺寸从 1792 变 1794，tile 数从 7×14=98 涨到 120；A100 只有 108 个 SM——98 全并行满载，120 却要分两波，第一波满载跑完、剩 12 个 tile 以极低利用率补跑，利用率断崖；tile 数要么远大于 SM 数，别刚好略超([1:00:00])
- 工具箱总结：一切为了减少内存访问——coalescing 榨干免费读取、fusion 免去不必要读写、tiling 把读取搬进共享内存；再不然拿富余换稀缺：算力换内存是重计算，精度换内存是量化(quantization)([1:00:00])
- FlashAttention 论文自述：只用两个「老」技巧——tiling 与 recomputation——把精确 attention 的 HBM 访问从二次方压成亚二次方(计算仍是二次方,但让算力而非带宽付账)；难点在 softmax 的整行求和是全局操作，在线 softmax(online softmax)流式维护当前最大值、校正项与 running normalizer，逐 tile 算部分 softmax，全程无需物化(materialize)n² 矩阵([1:05:00])
- FlashAttention-2 全流程与收束：forward 是 tiled 的 QKᵀ 矩阵乘 → online softmax 增量更新 → 扫完所有 tile 时归一化分母已在手、就地完成归一化 → 最后与 V 的 tile 相乘；backward 逐 tile 重算激活，铁律是绝不存储任何 n² 规模的量——硬件是语言模型背后的推力，别只问怎么减 FLOPs，要问怎么让数据移动更高效([1:10:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| SM(streaming multiprocessor) | GPU 的原子计算单元，自带控制逻辑，A100 有 128 个 |
| SP(streaming processor) | SM 内部的计算单元，用同一指令处理不同数据 |
| block / warp / thread | 三层执行粒度：block 分派给 SM,warp 是 block 内 32 个连续线程的锁步执行组 |
| SIMT | 单指令多线程：同 warp 全线程执行同一指令，分支会被迫串行交替 |
| 张量核心(tensor core) | 专用矩阵乘硬件(V100 起)，使 matmul FLOPs 比其他运算快数量级 |
| MXU | TPU 里的矩阵乘大块，对应 GPU 的张量核心，TPU 因此更简单 |
| HBM / DRAM | 芯片外的慢内存，访问 200-300 周期，是长期瓶颈且最难扩展 |
| 共享内存(shared memory) | SM 内部的快存(~20 周期)，tiling 的目的地，容量有限 |
| 屋顶线模型(roofline model) | 左侧 memory-bound、右侧 compute-bound，由算术强度(FLOPs/字节)决定所处区域 |
| 算术强度(arithmetic intensity) | 每 字节内存访问能摊到多少 FLOPs，决定是否受内存限制 |
| burst mode | DRAM 读一个地址免费返回整个 burst section，是合并访问的硬件基础 |
| memory coalescing | warp 内线程访问同一 burst section 时合并为一次读取，吞吐最高 4 倍 |
| 算子融合(operator fusion) | 无依赖算子链在计算侧一口气算完再回写，免去来回搬运；torch.compile 可自动做 |
| 重计算(recomputation) | 不存激活、backward 现算，用闲置算力换内存带宽(5/8 例) |
| 分块(tiling) | 矩阵切块轮流装进共享内存，global 读取 N 次 → N/T 次，T 倍缩减 |
| 波量化(wave quantization) | tile 数略超 SM 数时分两波执行，利用率断崖；tile 数应远大于 SM 数 |
| online softmax | 流式维护 running max + 校正项 + running normalizer，使 softmax 可逐 tile 计算 |
| FlashAttention | tiling + online softmax + backward 重计算，attention 的 HBM 访问从 O(n²) 压成亚二次 |

## 自测题
1. CPU 和 GPU 在设计目标上的根本差异是什么?
   > CPU 为单任务延迟优化(大控制单元、分支预测、少量快线程)；GPU 为聚合吞吐优化(海量轻量线程加极少控制,整体完成更快)。
2. warp 是什么?由多少线程组成?
   > warp 是 GPU 的基本执行单位，由同一 block 内连续编号的 32 个线程组成，全 warp 执行同一条指令作用于不同数据(SIMT)。
3. 为什么设计新的神经网络架构时应让大部分计算是矩阵乘?
   > 自 V100 引入张量核心起，matmul FLOPs 比非 matmul 运算快几个数量级，以非 matmul 为主的架构会损失惨重。
4. 从 FP32 改用 FP16 为什么相当于免费翻倍内存带宽?
   > 以 ReLU 为例，每元素一读一写，FP32 是 8 字节/FLOP，FP16 减半到 4 字节/FLOP；要搬运的位数减半，内存瓶颈处吞吐即翻倍。
5. recomputation 和 gradient checkpointing 是同一技巧，动机有何不同?
   > checkpointing 为省显存；recomputation 是在内存受限、算力闲置时，用富余算力现场重算激活来换内存带宽、加速执行。
6. memory coalescing 依赖什么硬件机制?收益上限是多少?
   > 依赖 DRAM 的 burst mode(读一个地址免费返回整个 burst section)；warp 内 32 线程访问连续地址合并为一次读取，吞吐最高 4 倍。
7. 波量化(wave quantization)是怎么让 matmul 性能突然崩掉的?
   > tile 数刚好略超 SM 数(如 120 tiles 对 108 SM)时，第一波满载跑完、剩余 tile 以极低利用率补跑，利用率先满后断崖；tile 数应远大于 SM 数。
8. online softmax 解决了 FlashAttention 中的什么障碍?
   > softmax 的归一化分母需整行求和(全局操作)；online 版流式维护 running max、校正项与 running normalizer，使 softmax 可逐 tile 计算而无需物化 n² 矩阵。
