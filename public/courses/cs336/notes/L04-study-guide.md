# CS336 Lecture 4 学习笔记：专家混合模型(MoE)

> 讲者：Tatsunori Hashimoto|配合视频 `lectures/L04-mixture-of-experts [LPv1KfUXLCo].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L04-transcript.md](L04-transcript.md)

---

## 一句话概览

专家混合(mixture of experts,MoE)在 transformer 的 FFN 上做稀疏路由：每个 token 只激活少数专家，同训练 FLOPs 下参数更多、loss 更低，已是 Grok/DeepSeek/Llama 4 等前沿模型的标配。本讲是 dense 架构讲(L03)的延伸：从路由设计、负载均衡、系统与稳定性一路拆到 DeepSeek-V3 全栈，并为后续并行课埋下专家并行伏笔。

## 分节要点(带时间锚点)

### 一、MoE 是什么：同 FLOPs 白赚参数
- 2025 年最强模型标配：GPT-4 疑似 MoE(NVIDIA 泄露)、Grok/DeepSeek/Llama 4 全采用；同训练 FLOPs 下做得好就稳定优于 dense([0:00])
- 命名有严重误导：没有"编程专家/英语专家"；专家(expert)只是被稀疏激活的 FFN 副本，transformer 里唯一改动的部件就是 FFN，由路由器(router)挑少数几个执行([0:00])
- 直觉：若只选 1 个与 dense FFN 同大的专家，MoE 与 dense 的 FLOPs 完全相同、参数却更多；若相信参数负责记事实知识，等于白赚([0:00])
- Fedus et al. 2022(Switch 系工作)：FLOPs 匹配下专家数 8→256 训练 loss 一路下降，128 专家随训练更快达到更低困惑度([0:00])
- 现代规模复现：AI2 OlMoE 的受控消融中 MoE 训练损失明显低于同等 dense；DeepSeek-V2 名图的 x 轴是激活参数(activated parameters)而非总参数——只看训练+推理 FLOPs 时这张图确实成立([0:05])
- 附带红利：专家是模型切分到多设备的天然切点——专家并行(expert parallelism)，并行工具箱多一根轴，超大规模模型的必选项([0:05])

### 二、发展脉络：开源 MoE 与曾经的冷门
- 开源先锋在中国：Qwen、DeepSeek 早于西方开源圈大量实践 MoE；Qwen1.5 把 dense 模型上采样(upcycling)成 MoE，计算效率显著提升且总参数比其 7B dense 还少([0:05])
- DeepSeek MoE 论文做了严格同 FLOPs 对比：dense→朴素 MoE→switch MoE 各基准逐级提升；V3 与最早 2B 级的 DeepSeek MoE 架构几乎没差——架构很早就钉死，后面只是工程放大([0:10])
- 曾经不流行原因一：基础设施复杂——最大优势出现在多节点训练、本来就要切模型时；不到那个规模 MoE 不划算([0:10])
- 原因二：路由不可微——必须离散地"选定"专家，训练目标要么启发式要么不稳定，须精心工程([0:10])
- MoE attention 有人尝试但主流发布罕见，有说法称更不稳定，但缺消融证据([0:10])
- 设计三问：怎么路由(路由函数)、专家数量与大小、怎么训不可微的路由器；综述见 Fedus et al. 2022([0:15])

### 三、路由：设计空间收敛到 token choice top-K
- 三类路由：token choice(每 token 按 affinity 选 top-K 专家)/ expert choice(每专家选 top-K token,设备负载天然均衡)/ global assignment(解组合优化)；所有主流发布收敛到 token choice top-K([0:15])
- OlMoE 消融：token choice 验证损失衰减更快更稳；打分作用在 hidden state(含位置信息)上；路由器极轻量——向量内积+sigmoid/softmax，似一次 attention，做复杂收益有限(路由 FLOPs 自己买单、学习信号本就间接)([0:15])
- K 是超参数：K=2 是经典选择(第二臂提供探索信号，K=1 纯利用)；K>1 时 FLOPs 约翻倍，"xx 激活参数"的说法由此而来；输出按门控加权求和([0:20])
- 前向机制：残差流 u 与专家习得向量 e_i 内积→softmax 得亲和度 s_i，t→top-K、其余置零得门控 g→专家输出加权求和→加回残差流；e_i 是路由器自己的参数，与 FFN 权重无关([0:20])
- 反直觉：纯 hash 路由(零语义)也有增益——同类 token 确定性命中同一专家，Zipf 分布下高频词主导某专家，仍能特化；但与输入无关的纯随机路由会很糟([0:20])
- softmax 只是"归一到 1"操作；top-K 后权重不再和为 1 无所谓(下层 LayerNorm 会放大回来)，是否重归一化是风格选择；但绝不能去掉 top-K——否则训练要付全部 N 个专家的 FLOPs，训练与推理同时稀疏是 MoE 命门([0:25])

### 四、专家怎么切：细粒度专家 + 共享专家
- 基础款 MoE：复制 dense FFN 若干份、top-2 激活→激活参数是 dense 的 2 倍；人们很快想要"更多专家但不付参数代价"([0:30])
- 细粒度专家(fine-grained experts)：把 FFN 中间层切小——上讲金律 hidden×4 改成 ×2、×1 甚至更小，专家变小变多；DeepSeek MoE 首创(灵感部分来自 DeepSpeed-MoE)，现已是无脑该做([0:30])
- 共享专家(shared experts)：恒定激活的少量专家负责共性处理，免得所有参数都摊进路由；这套组合被几乎所有开源 MoE 继承([0:30])
- DeepSeek 消融：GShard 基线→加共享专家→加细粒度，逐级提升；"x out of y"=y 个路由专家中激活 x 个；专家变多常伴随激活数变多(FLOPs 仍近似免费，因为每个专家更小)([0:35])
- OlMoE 第三方复现：细粒度 8→32→64 收益明确；共享专家增益却不明显，OlMoE 最终没用——共享专家的价值存在争议([0:35])
- 配置谱系：早期 Google 论文(GShard/Switch/ST-MoE)专家数巨大→8-16 专家期(Mixtral/DBRX/Grok,top-2)→DeepSeek MoE 64 细粒度+6 激活+2 共享、每个 1/4 尺寸；Qwen1.5/DeepSeek-V3/MiniMax/Llama 4 全走同一路线([0:35])

### 五、训练路由：不可微问题与负载均衡
- 核心矛盾：训练也要稀疏(全开 N 个专家=N 倍 FLOPs,不可行)，但稀疏门控不可微——一个"恼人的 RL 式问题"；三条路：RL、随机探索、启发式损失([0:40])
- RL 路由(Clark et al.)：最讲道理的尝试，却打不过 S-BASE 线性分配基线；梯度方差大、难用，没有团队规模采用([0:40])
- 随机探索(Shazeer 2017 noisy top-K)：线性亲和度上加高斯噪声、可学 W_noise 控制探索-利用权衡，类似 epsilon-greedy；代价是专家特化变弱，后期论文已移除(乘性扰动同理被弃)([0:45])
- 实际胜出：负载均衡辅助损失(load balancing)——没有它就掉进"全部 token 给一个全能专家"的局部极小；Switch 的 f·P 损失：f_i=实际分给专家 i 的 token 比例、P_i=路由 softmax 想分的比例，求导可见下压力度∝token 占比([0:45])
- 均衡两层次：per-batch 专家均衡(DeepSeek 同款 f·P 结构)+ 设备级均衡(把"分给哪个专家"换成"分给哪个设备")，后者为专家并行的均匀利用率服务([0:50])
- DeepSeek-V3 的 auxiliary-loss-free balancing：弃 per-expert 辅助损失，给每专家可学偏置 b_i——只加在路由打分上、不进门控权重，在线更新：token 少则 +γ、多则 −γ；但论文随后又加回 sequence 级辅助损失，并非真 loss-free([0:50])

### 六、系统与稳定性：专家并行、丢 token、z-loss、微调、上采样
- 专家并行机制：每设备放一个/少数专家；路由后一次 all-to-all dispatch 把 token 送到目标设备，算完再一次 all-to-all combine 送回；FFN 够大就能摊薄通信，可与数据/模型并行组合([1:00:00])
- 设备内稀疏：MegaBlocks 等库利用 GPU 稀疏矩阵乘引擎，把同设备多专家的小 matmul 融合成一次大 matmul，不浪费 FLOPs([1:00:00])
- token dropping：专家超载(受 load factor 限制)时直接丢 token——MLP 输出 0、残差直通；谁被丢取决于同 batch 的其他请求→MoE 在训练与推理都引入跨 batch 随机性(GPT-4 API 时代 temperature=0 不确定的趣闻)([1:00:00])
- 稳定性(Zoph/ST-MoE)：softmax 永远是最大风险——路由计算全程 float32；加辅助 z-loss(softmax 归一化项 log-sum-exp 的平方)压住漂移，去掉它验证 loss 会周期性尖刺；z-loss 最早的用武之地就在这([1:05:00])
- 微调过拟合：BERT/T5 时代发现稀疏大模型小数据 train/val 差距大；解法一：交替 dense/MoE 层、只微调 dense 层；解法二：堆 SFT 数据(DeepSeek MoE 用 140 万样本)([1:05:00])
- 上采样(upcycling)：拿训好的 dense 模型复制 MLP、加扰动、路由器从头初始化，当 MoE 继续训；MiniCPM 成功，Qwen 用 2.7B 激活参数做到自家 7B dense 的水平——推理时不是所有 MLP 都激活，等效白得大模型([1:10:00])

### 七、DeepSeek 演化：V1 → V2 → V3
- DeepSeek MoE(v1)：16B 总参/2.8B 激活；2 共享+64 细粒度、约 6 个激活；标准 top-K 路由(softmax 在 top-K 之前)；训练只加专家级+设备级辅助损失([1:10:00])
- V2:236B 总参/21B 激活，架构照搬 v1；新增 device-limited routing：先按打分选 top-M 设备、再在设备内选 top-K——专家切太碎会逼 token 发往大量设备，先限设备直接控制通信成本([1:10:00])
- V2 还加通信均衡损失：专家有输入侧与输出侧(token 要送回原设备)，两侧通信都要均衡；这个细节被 V3 丢弃([1:10:00])
- V3:671B 总参/37B 激活；MoE 主体不变("if it works, don't change it")；门控改为 sigmoid(比指数更软)并归一到 1；均衡换成 b_i 偏置的 auxiliary-loss-free+sequence 级辅助损失；保留 top-M、丢掉通信损失([1:15:00])
- sequence 级均衡的动机：训练时 batch 级够用；推理时无法控制输入，OOD 序列可能压垮个别专家，需要序列内的强均衡([1:15:00])

### 八、MoE 之外：MLA 与 MTP，本讲收束
- MLA(multi-head latent attention)：不减头数，把 h_t 投影到低维潜向量 c 并只缓存 c，用时上投影还原 k/v→KV cache 大幅压缩；新增的 W_UK 矩阵乘凭结合律并入 Q 投影，不多付 FLOPs([1:15:00])
- 细节：训练时 query 也压缩(省显存，与 KV cache 无关)；RoPE 与该压缩不兼容——旋转矩阵卡在 Q 投影与上投影之间、矩阵乘无法重排，解法是在未压缩维度上做 RoPE([1:15:00])
- MTP(multi-token prediction)：主模型照常预测下一 token，另把隐状态喂给轻量单层 transformer 预测再下一个；实际只做了 1 个额外 token，论文复杂图示有点虚([1:20:00])
- 收束：MoE 已是构建高性能大系统的核心玩法；离散路由是最大挑战，但启发式居然稳定工作；FLOPs 受限场景下 MoE 就是该用([1:20:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| 专家(expert)| 被路由器稀疏激活的 FFN 副本，与"领域"无关 |
| 路由器(router)| 残差流与专家向量内积+softmax/sigmoid 打分，取 top-K 生成门控 |
| token choice / expert choice | 每 token 选 top-K 专家(主流)vs 每专家选 top-K token(设备天然均衡)|
| 细粒度专家(fine-grained experts)| 把 FFN 中间层切小(×4→×2→×1…)，专家更多更小，DeepSeek 首创 |
| 共享专家(shared experts)| 恒定激活的少量专家，负责共性处理；收益有争议(OlMoE 未采用)|
| 负载均衡辅助损失(f·P)| 实际分配比例与路由概率比例的内积，下压力度∝token 占比，防单专家垄断 |
| auxiliary-loss-free balancing | V3 用可学偏置 b_i 调路由打分(不进门控权重)，在线 +γ/−γ 更新 |
| device-limited routing(top-M 设备限制)| 先选 top-M 设备再在设备内 top-K，控制 all-to-all 通信成本(V2 起)|
| 专家并行(expert parallelism)| 每设备放若干专家，all-to-all dispatch/combine 两跳集体通信 |
| token dropping | 专家超载丢弃 token(零输出走残差)，batch 组成引入跨请求随机性 |
| z-loss | softmax 归一化项 log-sum-exp 的平方惩罚，防路由 logits 漂移(ST-MoE 首用)|
| 上采样(upcycling)| 从训好的 dense 模型复制 FFN 当 MoE 初始化继续训，MiniCPM/Qwen 验证 |
| MLA(multi-head latent attention)| KV 压到低维潜向量只缓存它，用时上投影还原；W_UK 靠结合律并入 Q 投影 |
| MTP(multi-token prediction)| 轻量单层 transformer 额外预测下下个 token,V3 实际只做 1 个 |

## 自测题

1. MoE 的"专家"为什么与"领域专家"的直觉完全不同?它实际是什么?
   > 专家只是被路由器稀疏激活的 FFN 副本，没有领域分工；transformer 中唯一改动的部件就是 FFN，其余与 dense 相同
2. 为什么说"同 FLOPs 下加专家是白赚"?真正的代价在哪里?
   > 稀疏激活让参数变多而 FLOPs 不变，更多参数可存事实知识；代价是显存占用与路由/并行带来的系统工程复杂度
3. 主流 MoE 收敛到了哪种路由?OlMoE 的消融支持它吗?
   > token choice top-K(每 token 按内积打分选 top-K 专家)；消融显示其验证损失比 expert choice 下降更快更稳
4. 路由器为什么做得这么轻量?把它做深做大行不行?
   > 路由 FLOPs 自己要买单，且 top-K 之外几乎没有梯度信号(top-2 才能互比)、学习间接，复杂路由器的收益无法覆盖成本
5. 训练时不加任何负载均衡损失会发生什么?
   > 路由塌缩到一两个专家、其余全死(OlMoE 消融:8 个专家死 6 个)，等效白花钱的小模型且 loss 更差
6. DeepSeek-V3 的 auxiliary-loss-free 均衡怎么工作?它真完全"loss-free"吗?
   > 每专家一个偏置 b_i 只加在路由打分上(不进门控权重)，token 少则 +γ、多则 −γ 在线更新；但 V3 仍保留 sequence 级辅助损失，并非真 loss-free
7. DeepSeek-V2 相比 v1 新增了什么系统侧机制?V3 又丢弃了什么?
   > V2 新增 top-M 设备限制(先选设备再选专家)控制 all-to-all 通信成本；V3 丢弃通信均衡损失但保留 top-M
8. MLA 如何压缩 KV cache?它为什么与 RoPE 不兼容?
   > 把 h_t 投影到低维潜向量 c 并只缓存 c、用时上投影还原 k/v；RoPE 旋转矩阵插在 Q 投影与上投影之间无法重排，只能在未压缩维度上做 RoPE
