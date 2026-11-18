# CS336 Lecture 17 学习笔记：对齐三：强化学习（下）

> 讲者：Percy Liang|配合视频 `lectures/L17-alignment-rl-2 [JdGFdViaOJk].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L17-transcript.md](L17-transcript.md)

---

## 一句话概览

承接上讲 RLVR 概览，本讲不引入新主题而是深挖机制：从语言模型特有的 RL 设定出发，重推朴素策略梯度，讲透 baseline/优势函数为何能降方差，再用一个排序 toy 任务逐行过 GRPO 代码（deltas、ratio、clip、KL 惩罚），最后落到三模型架构、reward 设计的不可 hack 性与 RL 系统工程比预训练更复杂的收尾判断。

## 分节要点（带时间锚点）

### 一、本讲定位与语言模型里的 RL 设定([0:00])

- 本讲承接 Tatsu 上讲的 RLVR 概览(PPO/GRPO)，不追新主题，而是对策略梯度与 GRPO 的机制做深挖，配代码与数学([0:00])
- MDP 三要素：状态 = prompt + 已生成的 response，动作 = 生成下一个 token，奖励 = 整个 response 的好坏；课程聚焦可验证的结果奖励(outcome reward)——确定性函数直接返回，不用问人类([0:00])
- 奖励只在末尾，故 RL 常见的 discounting（折扣）与 bootstrapping 在此不适用；代价是奖励稀疏且延迟，好处是概念思考被简化([0:00])
- 转移动态(transition dynamics)只是"追加"操作：已知世界模型就能模拟 → 可做规划与测试时计算(test-time compute)，机器人学家梦寐以求([0:00])
- 状态是"编造的"：机器人状态受物理世界约束（关节角、图像），LM 状态就是自己写下的 token，可自造 scratchpad；挑战不是"到达某状态"（总能到），而是让 token 序列真的通向正确的 ground truth([0:00])
- 策略 = 语言模型（通常从预训练模型微调）；rollout/episode/trajectory 三个名字同义：从初始状态生成一串 token，结尾拿到一个数([0:00])

### 二、朴素策略梯度与稀疏奖励困境([0:05])

- 记号简化：用 a 表示整个 response（outcome reward 下等价于一次生成全部动作）；目标 E[R] 对 prompt 分布 p 与策略 π 的采样取期望([0:05])
- 策略梯度定理(policy gradient theorem)本质是 log 的链式法则(log-derivative trick)：∇E[R] = E[R·∇log π(a|s)]；朴素策略梯度 = 采一个 prompt、采一个 response，按期望内那项做 SGD 式更新([0:05])
- 0/1 奖励的直觉：错误 response 被 R=0 清零，只有答对的样本参与更新——相当于对模型自己生成的正确数据做 SFT；数据集随策略迭代不断重采，期望越变越好([0:05])
- RL 的噪声/方差是另一个量级：监督学习里梯度再噪，大 batch 也能扛，且至少保证朝某个方向更新；稀疏奖励下差策略几乎全 0 奖励 → 零梯度 → 彻底卡死([0:10])
- 学生问答：把错误奖励设为 −1 推开错答案？——baseline 机制会自动实现；奖励只在生成完才拿得到？——那是过程奖励(process reward/process supervision)的领地，可信时应尽早评估，但 LM 中难拿到好的过程信号（不跑偏就难判断好坏）([0:10])

### 三、baseline：降方差的核心机制([0:15])

- baseline = 任何只依赖状态的函数 b(s)（不依赖动作与策略）；减入目标只是常数平移，优化问题不变，却能大幅压低单样本更新的方差——与统计里的控制变量(control variates)同源([0:15])
- toy 例：S1→A1 奖励 11、S1→A2 奖励 9，S2→A1 奖励 0、S2→A2 奖励 2；最优策略是 S1 选 A1、S2 选 A2，但 9 > 2，naive 更新会按 9 激进推 S1→A2、按 2 轻推 S2→A2，单样本看与全局最优相反([0:15])
- 初始策略不知道哪个动作好，随机偏向 A2 后越选越推，概率质量吸进 A2、A1 归零，卡进局部最优——期望上数学都对，但单个样本的方差让你看不到全局([0:15])
- 数值演示：uniform 初始策略下梯度方差 5.3，取 b(S1)=10、b(S2)=1 后降到 1.1；方差越小收敛越快([0:20])
- 什么算"常数"：frozen 模型可作常数，但必须持住一份拷贝、不对其求导；实践中通常持 old policy/价值函数一段再更新——理论要求（b 不依赖 π）与工程做法之间有默契空间([0:20])
- 最优 baseline 有闭式解（E[∇logπ²·R]/E[∇logπ²],多维含协方差）但难算；实用启发式：b(s) = E[R|s]，即给定状态的期望奖励([0:20])

### 四、优势函数与统一更新形式([0:25])

- 价值函数 V(s)=E[R|s],Q 函数 Q(s,a)=给定状态取动作的期望回报；outcome reward 且 a=整个 response 时 Q 与 R 重合（一般 RL 里 R 指从该状态起的累计回报）([0:25])
- 优势函数(advantage)A(s,a) = Q(s,a) − V(s)：动作 a 比"随大流走"好多少；取 b(s)=E[R|s] 时，R − b(s) 恰好就是优势([0:25])
- 所有算法(PPO、GRPO……)共享同一骨架：∇log π × δ，δ 填什么就是哪种算法——R（朴素）/ R−组均值(centered)/（R−均值）/（标准差+ε）（GRPO 标准化）([0:25])
- δ 的具体形态并不关键（明年会有 GRPO 2），概念框架不变；速查：baseline 定义 = 任何只依赖 s 的函数塞进策略梯度更新([0:30])

### 五、GRPO 的由来与排序 toy 任务([0:30])

- GRPO 是 PPO 的简化（而非"从简单到复杂"演进的例外）；它能在 2024 年成立，靠的是语言模型设定的自然结构——同一 prompt 并行采一组 response，天然 group 给出 baseline = 组内平均奖励([0:30])
- 目的仍是降方差，group 是天然比较集，这就是"relative（相对于组）"的含义；经典 RL（机器人走路）没有 group 结构，GRPO 说不通，只能回 value function 聚合全部状态动作([0:30])
- toy 任务：排序 n 个数，prompt 是乱序 n 数、response 是排好的 n 数；奖励若设"全对 = 1 否则 0"会撞上稀疏奖励问题，起步阶段学不动([0:30])
- 部分分奖励 v1：逐位置数 response 与 ground truth 的匹配数（正确 4 分，碰对 1 个位置 1 分）——但"差得远"与"接近"可能同分([0:35])
- 更细的 v2：inclusion reward（prompt 中每个 token 出现于 response 得 1 分）+ 每个相邻有序对得 1 分，求和——注意这个奖励有漏洞(loophole)，Percy 留给观众找([0:35])
- toy 模型刻意简化：prompt/response 定长且等长、独立位置参数捕捉位置信息、每个位置独立解码（非自回归；真实场景一般不用，仅部分 speculative decoding 类似），绕开自回归生成后代码全是矩阵运算([0:35])

### 六、deltas、ratio 与 GRPO loss 实现([0:40])

- forward pass 与采样：embed prompt → per-position 矩阵编码、sum 掉 position 维 → 每 prompt 一个向量 → per-position 解码 → vocab logits → torch.multinomial 采样出 responses(batch×trial×position)；真实管线这一步就是 LLM 推理调用([0:40])
- compute_deltas 菜单：δ = R（朴素）/ centered（减组均值）/ 标准化（再除以标准差+ε,防除零，对奖励整体缩放不变）([0:40])
- centered 的效果：奖励 1 与一堆 0 时均值 ≈0.1，减完负样本以负值参与更新——自动回应"为何不用 −1 奖励"的提问；全组同奖励则全 0 → 不更新（组内无相对信号，弃权等别的样本）；私货玩法（论文没做）：组内非最大奖励全置 0(all-or-nothing)，防部分分诱导策略扑向 low-hanging fruit 的局部最优([0:45])
- log probs 与 naive loss:responses 过模型取 log softmax，升维后用 responses 索引出选中 token 的 log prob;loss = mean(δ × log probs),outcome reward 的 δ 无位置维、广播到每个 token（有过程奖励才按位置给）([0:45])
- 冻结与 clip:ratio = π/π_old 中 π_old 必须 no_grad 当常数（同参数连通则比值恒 1、梯度为 0）;GRPO loss = −min(ratio·δ, clip(ratio, 1−ε, 1+ε)·δ),ratio 出界时更新幅度被 1±ε 封顶；outcome reward 不 discounting——credit assignment 未知（早期决策可能更关键），干脆把 credit 均摊到所有 token([0:50])
- KL 惩罚的低方差估计：naive 的 E_P[log(P/Q)] 无偏但方差高；改用 Q/P − log(Q/P) − 1——因 E[Q/P]=1 两式期望相同而后者方差更低；实现对 vocab 维求和、对 batch/trial/position 取均值([0:55])

### 七、完整算法、三模型架构与实验观察([1:00:00])

- 全算法与三模型：外层 epoch 循环 →（用 KL 时）freeze 模型作 reference → 采样 responses → 算 rewards 与 deltas →（KL 需 reference log probs,clip 需 current log probs）→ 内层对同一批 responses 做多个梯度步（推理贵，一批 rollout 榨干）；三模型 = π_ref（KL 正则，要存整份副本、内存翻倍）、π_old（算 ratio,只需存那批 responses 的 log probs 更省）、π_theta（在线更新）；真实 GRPO 代码三循环，此处简化为两循环([1:00:00])
- 学生问答：KL 为什么对 reference 而不是对 old?——RL 的"目标函数"本是为算梯度而设的谎言，更新几步目标就变了，变得越快越不是真的在优化它；两个正则机制分工：clip 作用于 π_old，KL 作用于 π_ref；另答：第一轮内层 π_old = π 不浪费——ratio=1 不会被 clip，更新照做，old 只是个常数缩放([1:05:00])
- 实验观察（naive δ 100 epochs×10 步：reward 2→3 出头，但"数字大概来自 prompt、未真正排序";centered δ:推向高分远离低分，全同分是 no-op——此前对全等差的糟糕样本也更新其实没道理；末期部分样本拿到 4 分甚至正确 permutation,部分卡住——δ 全 0 这批无信号，重新生成才有新样本；部分分奖励是双刃剑，标准化这次作用不大）([1:05:00])
- loss 曲线不可信：reward 在涨而 loss 看着糟糕——"最小化 loss"是谎言，response 集合随训练自变(self-circular)，没有同一参照点，监控 loss 意义不大，只能盯 reward([1:10:00])
- 收尾判断：RL 是让模型超越人类能力的关键——标注数据只能模仿，labeled data 有上限，"能测量就能优化(if you can measure it, you can optimize it)"；更大的问题是如何设计不可 hack 的 reward 与可泛化的 environment（活跃研究方向）([1:10:00])
- RL 系统工程比预训练复杂得多：推理本身就是一摊事，还要管理多个模型（训练 policy、PPO 的 critic、inference worker 要 ship 模型过去、agent 环境要起服务，再加 π_old/π_ref），全部并行分布式协同——课程没时间展开，有兴趣可找 Percy 要 pointers([1:15:00])

## 核心概念速查

| 术语 | 一句话解释 |
| --- | --- |
| 策略梯度(policy gradient) | ∇E[R] = E[R·∇log π(a\|s)]，本质是 log 的链式法则；按奖励加权的模仿更新 |
| 朴素策略梯度(naive policy gradient) | δ 直接取 R；0/1 奖励下只对答对的样本做 SFT，差策略会零梯度卡死 |
| 基线(baseline) | 只依赖状态的函数 b(s)，减入目标不改变最优解、只为降方差；与控制变量(control variates)同源 |
| 优势函数(advantage) | A(s,a) = Q(s,a) − V(s)，动作比状态平均回报好多少；b(s)=E[R\|s] 时 R−b(s) 就是它 |
| GRPO 组标准化 | 同一 prompt 采一组 response,δ = （R−组均值）/（组标准差+ε）；对奖励尺度缩放不变 |
| 重要性比率(ratio) | π(a\|s)/π_old(a\|s);π_old 须 no_grad 冻结，否则比值恒 1、梯度为 0 |
| 裁剪(clip) | ratio 限幅到 [1−ε, 1+ε] 再与原 ratio 取 min；出界时单步更新幅度封顶 |
| KL 惩罚 | 向参考模型 π_ref 正则防漂移；低方差估计用 Q/P − log(Q/P) − 1 |
| 结果奖励 vs 过程奖励 | outcome：整个 response 一个数（本讲默认）；process：逐步打分，更好但难得 |
| 稀疏奖励问题 | "全对=1"型奖励下差策略全拿 0 → 零梯度卡死；解法 = 部分分奖励 + baseline |

## 自测题

1. 在语言模型的 RL 设定中，state、action、reward 分别是什么？为什么这里不需要 discounting?
   > state=prompt+已生成的 response,action=下一个 token,reward=对整个 response 的可验证结果奖励；奖励只在末尾、无中间奖励，故 discounting/bootstrapping 不适用。
2. 为什么说语言模型的 RL 转移动态简单到"机器人学家梦寐以求"?由此带来什么独特能力？
   > 转移就是把动作 token 追加进状态（一个加法）；已知世界模型就能模拟，可以做规划与测试时计算。
3. 朴素策略梯度在 0/1 可验证奖励下等价于什么？最大的失败模式是什么？
   > 等价于只对答对的 response 做按奖励加权的 SFT（数据集随策略不断重采）；若策略差到全 0 奖励则梯度为 0，训练卡死。
4. baseline 为什么合法？实用中最该取什么函数？
   > b(s) 只依赖状态、与策略无关，减入目标只是常数平移，不改变优化问题还降方差；实用取 b(s)=E[R|s]，此时 R−b(s) 恰为优势函数。
5. GRPO 为什么在语言模型设定里自然成立，在经典 RL（机器人）里说不通？
   > 同一 prompt 可并行采一组 response，天然 group 结构给出组均值/方差作 baseline；经典 RL 无 group，只能回 value function 聚合。
6. GRPO 中某组 response 的奖励完全相同时会发生什么？背后的设计直觉是什么？
   > centered/标准化后 δ 全 0、不产生更新；组内无相对差异、没有理由偏爱谁，弃权等别的样本提供信号。
7. 计算 ratio π/π_old 时为什么必须用 no_grad 冻结 π_old?
   > 若 π_old 与当前策略同参数连通，比值恒为 1、梯度恒 0；冻结后 π_old 只是常数，梯度才能非零。
8. 为什么 RL 训练中盯着 loss 曲线看基本没有意义？应该看什么？
   > response 集合随策略更新自变(self-circular)、无同一参照点，"最小化 loss"只是为算梯度而设的谎言；只能盯 reward。
