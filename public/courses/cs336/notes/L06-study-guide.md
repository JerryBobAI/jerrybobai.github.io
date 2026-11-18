# CS336 Lecture 6 学习笔记：Kernel 与 Triton

> 讲者：Tatsunori Hashimoto|配合视频 `lectures/L06-kernels-triton [E8Mju53VB00].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L06-transcript.md](L06-transcript.md)

---

## 一句话概览

以 gelu 与 softmax 为例，沿「naive PyTorch → PyTorch 内置 → CUDA C++ → Triton → torch.compile」五条路线逐一实现、benchmark、profile，一路下探到 PTX 近机器码层，讲透 kernel 融合(kernel fusion)为何是 GPU 性能命门；本讲是作业 2(手写 Triton 版 FlashAttention-2)的直接铺垫。

## 分节要点(带时间锚点)

### 一、GPU 执行模型回顾
- 本讲路线图：benchmarking/profiling → CUDA C++ kernel → Triton → torch.compile，并下探到 PTX(近机器码)看 GPU 到底在做什么；作业 2 要求自己写 Triton 版 FlashAttention-2([0:00])
- A100/H100 由大量 SM(streaming multiprocessor)组成，每个 SM 内含大量 Int32/FP32 运算单元并发射海量线程；内存层级是 DRAM(global memory,大而慢)→ cache → register file(每线程私有、最快)，高性能代码要重度利用寄存器([0:00])
- 执行模型：thread block 是调度原子单位、整体落在单个 SM 上；块内线程经 shared memory 通信(约 L1 cache 速度)，跨 block 通信昂贵且无法跨块同步——矩阵乘法需要线程间传数据，所以相关数据应留在同一 block/tile 内([0:00])
- warp = 32 个连续线程组成的同时执行单元；存在意义是摊薄控制电路——GPU 把硅面积优先给计算，CPU 则更多花在控制逻辑与分支预测上([0:05])
- wave(驻留批次)视角：thread block 数应远多于 SM 数、且尽量整除 SM 数，让每个 wave 负载均衡([0:05])
- 算术强度(arithmetic intensity)= flops/内存字节数，要尽量做高：矩阵乘是 compute bound，其余操作几乎都 memory bound，优化的本质是减轻 memory bound 程度([0:05])

### 二、基准测试(Benchmarking)
- 最高层的经验：想写高性能代码，先 benchmark 再 profile——见过太多人凭直觉花三小时优化，结果那根本不是瓶颈；工具会变，这条不变([0:05])
- benchmark = 测端到端 wall clock，用途：横向对比实现(手写 CUDA vs PyTorch vs Triton)、经验性回答「矩阵变大后慢多少」；理论(roofline 模型)有极限，库版本/硬件/microcode 差异最终都要靠端到端实测([0:10])
- 两个必做动作：①warm up——首次执行触发机器码编译、kernel 加载等一次性初始化，必须避开启动期、测稳态速度；②torch.cuda.synchronize——CPU/GPU 是两台独立设备，CPU 派发完 kernel 就继续往下跑，不同步计时根本测不到 GPU 真实执行([0:10])
- 多次 trial 取均值：单次测量受 GPU 温度等热特性波动影响([0:10])
- matmul 随尺寸超线性(super linear)变慢；但 1024/2048 小尺寸下耗时几乎不涨，被 kernel launch、CPU→GPU 传输等常因子开销掩盖([0:15])
- MLP 实验验证线性：steps 2→5、layers 2→5，耗时均随步数/层数线性增长(每次前向+反向约 5s 量级)([0:15])

### 三、性能剖析(Profiling):PyTorch 内置 profiler
- benchmark 只告诉你「慢」，profiling 告诉你「慢在哪」：能看到 PyTorch 接口之下的整层 CUDA 调用链，建立对硬件执行的真实直觉([0:15])
- 对照实验：sleep 函数 100% 时间耗在 cudaDeviceSynchronize(纯等待、无 GPU 工作)；矩阵加法则走 aten(PyTorch 的 C 接口)→ vectorized_elementwise_kernel → cudaLaunchKernel(CPU 把命令发给 GPU)→ synchronize,CPU 侧 1.4ms、GPU 侧仅 17μs([0:20])
- matmul:aten::mm → Cutlass(NVIDIA 高性能矩阵乘 CUDA 库)→ 带具体 tile size 的特定 kernel；换成 128×128 小矩阵则绕过 Cutlass、直接 dispatch 到另一个 GEMM 原语——同一个 `A@B` 底层 kernel 完全不同，性能特征随之不同([0:25])
- 实用技巧：torch.compile 可先 macrobenchmark 本机各 matmul kernel 再择优 dispatch，历史上能白拿约 10% 提速([0:25])
- 复合算子 torch.cdist 分解为 euclidean_dist → matmul/pow/sum/concat，各自对应 CUDA kernel:GEMM 占 GPU 时间 78%,copy+concat 6%、pow 5%、sum 3%——优化优先级一目了然([0:30])
- gelu、softmax 这类核心原语在 PyTorch 里已有现成融合 kernel：单次 launch、无 CPU↔GPU 往返([0:30])

### 四、Nsight Systems：看见 CPU 与 GPU 是两台机器
- torch profiler 对复杂模块表达力不足(如 aten::mm 找不到对应 kernel、时间占比对不上)，要上 NVIDIA Nsight Systems：上半屏 CUDA HW(GPU 时间线)、下半屏 threads(CPU 时间线)([0:30])
- 用 NVTX annotation 给代码段打标(define_model、step_0…)，profiler 时间线上逐段对号入座；注意 profiler 本身有开销、annotation 会轻微扭曲微秒级数字，但课程关心的大尺度结论不失真([0:35])
- 冷启动真相：程序前约 7.5s 全是库加载等初始化开销，模型构建时 GPU 内存才开始增长([0:35])
- CPU 永远跑在 GPU 前面：CPU 只是把 kernel 排进固定深度的队列就继续往下跑——CPU 在 layer 1 时 GPU 才刚启动 layer 0 之后的内容，极端时 CPU 领先整整一个 step([0:35])
- 一行 print(loss) 就能改变 GPU 执行布局：打印需要 CPU 拿到 loss 数值，必须等 GPU 算完，于是 cudaStreamSynchronize 把两边拽回同步；频繁打印会让 CPU 反复等待、无法提前发射 kernel，极端情况下引入 CPU bottleneck([0:40])
- 反过来这也是「Python 够用」的原因：Python 再慢也不是瓶颈，因为 CPU 靠领跑排队就能喂饱 GPU，这种 CPU/GPU 解耦是能用高级语言还拿满 GPU 利用率的关键([0:40])

### 五、Kernel 融合实战：gelu 的 CUDA C++ 实现
- kernel fusion 的工厂比喻：每个算子单独执行都要从 DRAM「仓库」往返搬运一次；融合成一个 kernel 就只搬一次，省掉全部中间运输成本([0:40])
- naive PyTorch gelu(手写 tanh 近似公式)拆成一堆小 CUDA kernel：实测约 8.1ms;PyTorch 内置融合版约 1.1ms，差约 8 倍(讲者口播单位 seconds 系口误，量级为毫秒)([0:45])
- CUDA 代码两层结构：kernel 函数(`__global__`,在 GPU 上执行计算)+ wrapper(CPU 上编排 launch)；调试必开 CUDA_LAUNCH_BLOCKING=1 才能拿到报错(代价是变慢)([0:50])
- wrapper 标配：assert x 在 CUDA 设备上 + assert contiguous(索引运算假设连续内存;transpose/view 是唯一常见反例，可在 wrapper 一侧转成连续再进 kernel)；用 torch::empty_like 分配输出(不必 zeros,反正要整块写入);cdiv = ceil(n/block_size) 上取整算 block 数，保证尾部元素被覆盖([0:50])
- kernel 侧：全局下标 i = blockIdx.x * blockDim.x + threadIdx.x；因 cdiv 上取整会多出线程，必须 `if (i < n)` 越界保护——CUDA 没有自动越界检查；launch 形如 `kernel<<<blocks, block_size>>>(指针, n)`，传指针不传值([0:50])
- 结果：CUDA 版约 1.8ms，单个 kernel 吃满 100% GPU 时间——融合问题本身已解决；element-wise 算子容易手写，带 reduction 的算子和 FlashAttention 会更复杂一些([0:50])

### 六、Triton：以 block 为单位的 Python GPU 编程
- Triton 是 OpenAI 2021 年发布的领域专用语言(DSL)：全程 Python、面向 thread block 编程而不再管单个线程；自动处理内存合并读取(coalescing,DRAM burst mode 一次白送 4 个相邻值)、shared memory 管理、SM 内线程调度；跨 SM 的调度仍需手动([1:00:00])
- 相比 CUDA 版，offsets 从单值变成向量(整块 range(block_size) 一次算出)，越界交给 mask 处理，tl.load/tl.store 把整块数据一次性搬入搬出——从线程视角换成 block 视角，其余心智模型不变([1:05:00])
- PTX(NVIDIA 近机器码的中间汇编)验证底层行为：临时值全落寄存器，ld.global 一次载 4 个值(合并读取)，e^x 用 2^x 乘 log2(e) 实现——每个线程一次处理 4 个元素，一看就是快代码([1:05:00])
- 成绩：Triton 1.848ms ≈ CUDA 1.84ms，没更快，但开发体验好得多——Python 可单步调试，复杂场景下内存细节由 Triton 代管([1:10:00])

### 七、torch.compile：让 JIT 编译器替你融合
- torch.compile 对 naive PyTorch 代码自动做算子融合等优化：gelu 案例实测约 1.47ms，比手写 CUDA/Triton 还快；底层生成的正是「fused add-mul-tanh」Triton kernel，且比手写版略更优化([1:10:00])
- 它的强项：简单算子融合、以及已知 shape 时选最优 matmul kernel；FlashAttention 1/2/3 属于非平凡优化(FA3 还要吃 H100 硬件特性)，JIT 编译器难以自行发明，手写 kernel 仍有空间([1:10:00])
- 行动准则：别给语言模型的每个算子都手写 kernel；写新架构遇到复杂组件、利用率上不去、且你判断有优化空间时，才是上 Triton 的时机([1:15:00])

### 八、Triton softmax：从 element-wise 到 reduction
- softmax 含 reduction(整行求和归一化)，不再是无脑逐元素；最优 block 设计：一个 block = 一行，整行装进单个 SM，块内 sum + divide 即可完成([1:15:00])
- 具体套路：block_size 用 tl.next_power_of_2(n_cols) 补齐到 2 的幂，block 数 = 行数；kernel 里按 stride 定位行、取列偏移、mask 越界([1:15:00])
- 主体逻辑与普通 Python 几乎一致：整行载入 SM 本地内存，减 max → exp → sum → divide → 写回全局内存——只要计算能装进一个 SM，Triton 写起来就像普通 Python 加上 load/store 与 block 记账([1:15:00])
- 成绩(毫秒级):naive 手写约 3.7,torch.compile 约 1.3(已知 shape 时比 PyTorch 原生 1.5 更快),Triton 约 1.9;profile 下 compiled/PyTorch/Triton 三者都是单个融合 kernel,naive 版则满屏小算子和内存读写([1:15:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| SM(streaming multiprocessor) | GPU 的计算单元，thread block 的调度归宿，内含大量 Int32/FP32 单元 |
| thread block | 调度到单个 SM 的线程组；块内 shared memory 约 L1 速度，跨 block 通信贵且不可同步 |
| warp | 32 个连续线程组成的同时执行单元，存在意义是摊薄控制电路 |
| wave | 同期驻留 SM 的一批 block；block 数宜远多于 SM 数且整除之，各 wave 负载才均衡 |
| register file | 每线程私有的最快存储，PTX 里所有中间值都落在这里 |
| 算术强度(arithmetic intensity) | flops/内存字节数；矩阵乘 compute bound，其余几乎全 memory bound |
| kernel fusion | 多算子合成一个 kernel，省掉中间结果的 DRAM 往返(运输成本) |
| warm up | benchmark 前先跑几轮，避开首次执行的编译与初始化开销，测稳态 |
| torch.cuda.synchronize | 强制 CPU 等待 GPU 队列清空；不同步则计时测不到真实 GPU 执行 |
| aten | PyTorch 的 C++ 算子层，Python 调用先落到这里再 dispatch 到 CUDA kernel |
| Cutlass | NVIDIA 高性能矩阵乘 CUDA 库，大矩阵 matmul 的实际执行者 |
| Nsight Systems | NVIDIA 细粒度 profiler，同屏对照 CPU/GPU 时间线；配 NVTX annotation 分段 |
| PTX | NVIDIA GPU 近机器码的中间汇编，可核对寄存器分配、coalescing 等底层行为 |
| coalescing | 相邻线程访问相邻内存，凑满 DRAM burst(一次 4 值)免费取数 |
| cdiv | ceil(n/block_size)：上取整算 block 数，配合 i<n 做越界保护 |

## 自测题
1. benchmark 之前为什么必须先跑几轮 warm up?
   > 首次执行会触发机器码编译、kernel 加载等一次性初始化开销，不 warm up 测到的是启动速度而非稳态速度。
2. 不调用 torch.cuda.synchronize 直接计时会得到什么结果，为什么?
   > 会严重偏小甚至「瞬间完成」：CPU 派发完 kernel 就继续往下跑、并不等待 GPU，synchronize 才把两边拽到同一状态再计时。
3. 为什么 thread block 内通信快、跨 block 通信昂贵?
   > block 整体调度在同一个 SM 上，块内经 shared memory 以约 L1 速度通信并同步；跨 block 没有这条通道，也无法跨块同步。
4. warp(32 线程组)存在的意义是什么?
   > 让 32 个线程共享一套控制电路、大幅减少控制机械——GPU 把硅面积优先给计算，CPU 则花在控制与分支预测上。
5. 同样是 A@B，2048 大矩阵和 128 小矩阵走的 CUDA kernel 一样吗?
   > 不一样：PyTorch 按尺寸 dispatch 不同 kernel(大矩阵走 Cutlass 分块 kernel,小矩阵直接走 GEMM 原语)，性能特征也随之不同。
6. naive 手写 gelu 为什么比 PyTorch 内置慢约 8 倍?
   > tanh、立方、乘加被拆成多个独立 CUDA kernel，每个都要从全局内存(DRAM)读写一遍、运费乘了倍数；内置版是单个融合 kernel。
7. 写 CUDA kernel 时 i = blockIdx.x*blockDim.x + threadIdx.x 与 if (i < n) 各在做什么?
   > 前者算当前线程负责的全局元素下标；后者是越界保护——cdiv 上取整后末尾 block 会多出线程，而 CUDA 没有自动越界检查。
8. 什么时候值得手写 Triton kernel，什么时候交给 torch.compile?
   > 简单融合与选 matmul kernel 交给 torch.compile(它甚至更快)；新架构复杂组件利用率上不去、或 FlashAttention 级含硬件特性的非平凡优化才手写。
