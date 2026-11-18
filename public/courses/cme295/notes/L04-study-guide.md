# CME295 Lecture 4 学习笔记：Reinforcement Learning with LLMs

> 讲者 Afshine & Shervine Amidi ｜ 配合视频 `lectures/L04-rl-with-llms [3Vaj0Oka_t4].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L04-transcript.md](L04-transcript.md)

---

## 一句话概览

**本讲补上 LLM 训练管线最后两块(preference tuning 与 reasoning)的损失推导，是全程第一次真正上数学**：从 max_θ E_{τ~π_θ}[R(τ)] 推出 policy gradient，暴露 on-policy 串行生成的昂贵；沿 vanilla 方法的三大挑战(高方差、无 token 级 credit assignment、不许乱偏离)，依次长出 **PPO**(value function + clipping + KL)、**GRPO**(组内相对 advantage,免 value function)，最后用 **on-policy distillation**(reverse KL)补上 token 级监督——PPO/GRPO 那些吓人公式从此不再从天而降。

---

## 分节要点(带时间锚点)

### [0:00] 课程定位与读论文避雷：约定不一才是最大混乱源

- 本讲位置：pretraining(数万亿 token、cross-entropy、next-token prediction,含 mid-training / long-context 等中间阶段)→ **SFT**(cross-entropy 只罚输出侧偏差,让模型从「懂文本」变「有用」)→ **preference tuning + reasoning**——后两步的损失函数长什么样，就是今天的全部内容。
- 讲者两个 disclaimer：① 全讲数学密集(读论文亦然)，解药三步——**先抓直觉**、补不熟的符号、**从第一性原理解释公式**，别被大公式吓住；② 更坑的是**各论文约定不一致**。
- [0:05] 三个具体的约定坑：① reward 记 r，但有的论文拿 r 表示概率 ratio——本讲 ratio 一律记 **ρ**；② policy 有 current / old / reference 多种，记号常被混用；③ 前几讲都在 **minimize loss L**，RL 里常 **maximize** 一个也叫 L 的量——动手前先分清要 min 还是 max。

### [0:08] RL → LLM 映射与 reward 的两大来源(RLHF / RLVR)

- RL 基本设定：agent 在环境处于某 state，按 **policy π_θ** 选 action、跳到新状态、领 reward；目标是最大化累计 reward。
- 映射到 LLM:agent = LLM,state = 输入，action = 下一个要采样的 token,π_θ = 模型输出的概率分布；token 级 reward 难定义，更常用 **response/completion 级**框架——prompt 进、整条 response 出，π_θ = P(response|prompt)，整条 response 拿一个 reward。
- [0:10] reward 两类：① **无绝对 ground truth**、偏主观(语气好坏)→ 人工偏好 + **Bradley-Terry** 成对损失训 reward model → **RLHF**;② **可确定性验证**(数学题有解、代码过 test cases)→ **RLVR(Reinforcement Learning with Verifiable Rewards)**，主战场是 reasoning。
- 目标函数雏形：调 θ 最大化 expected reward——preference tuning 用 **frozen** 的 RM 给(prompt, completion)打分，reasoning 只看 final answer。
- [0:13] 课堂 Q&A：① 整条 response 概率会极低 → 用 **log** 保数值稳定；② 不必每次生成都找人打分 → 先把人类偏好训进 reward model，训练循环里用 RM 替代 human-in-the-loop。

### [0:15] Policy gradient 推导：log-derivative trick 与 gradient ascent

- 复习：导数给出**最陡上升的方向与幅度**；n 维推广即 gradient(对输入各维求偏导)。
- 目标 max_θ E_{τ~π_θ}[R(τ)] 求梯度：R 不依赖 θ(冻结)、π_θ 依赖 → 把 ∇ 移进积分；用恒等式 **∇f = (∇log f)·f**(即 ∇log f = ∇f/f)得 **∇J = E_{τ~π_θ}[R(τ)∇log π_θ(τ)]**——全场反复出现的公式，必须知道它从哪来。
- [0:20] 直觉：reward 为正 → 梯度推高该 action 的采样概率；为负 → 压低；记号 **τ ~ π_θ** 读作 sampled from;LLM 场景的 expectation 实际是两层：先对 prompts、再对给定 prompt 的 responses。
- 更新用 **gradient ascent**:θ ← θ + α∇(要的是高 reward 概率变大,不是 descent)。
- 关键代价：**on-policy**——每次更新都要当前模型重新生成 response；rollout 逐 token 串行(问一次 → 拿一个 token → 再问)，无法并行，非常贵。

### [0:25] Importance sampling 与 vanilla 方法的三大挑战

- 改写 E_{τ~π_θ}[R(τ)] = E_{τ~π_fixed}[R(τ)·π_θ(τ)/π_fixed(τ)]：固定策略生成一次 batch，之后多次更新只需乘 **importance sampling ratio** 重加权，数学仍然成立——这是后续 PPO/GRPO 复用旧数据的全部基础。
- [0:30] Q&A 点破成本差：**evaluating policy ≠ generating rollout**——评估时整条 response 已知，一次性并行喂进 decoder-only 模型(masked self-attention 并行给出所有 token 概率),**便宜**；生成必须 token-by-token 串行，**贵**；贵的那一次可复用于多个 training step。
- 挑战 ① **梯度方差大**：无 baseline 时好答案 101 / 坏答案 100 都「很高」，正负两个方向都在猛更新、噪声大；应对比「该状态的期望 reward」(如均值 100.5)，±0.5 才有判别力；有 baseline 的 toy example 可证方差大降。
- 挑战 ② **无 token 级 credit assignment**:completion 级 reward 一荣俱荣——Teddy 在密封箱被搬到厨房，答案 kitchen 对了，但「Teddy climbs out / walks」的前提是错的，vanilla 方法会把整条 response 所有 token 一起推高。
- [0:35] 挑战 ③ **不许偏离太远 + reward hacking**：pretrain+SFT 后模型已经很好，过度优化新任务还会**遗忘旧能力**(别 regression on previous tasks)；而 reward 本身可能不完美——若只用「掌声强度」评价讲课，最优策略是全程讲段子 → 模型会 **game the reward model**，必须给偏离加约束。

### [0:40] PPO 之一：advantage 与 value function(附 GAE 提点)

- **PPO(Proximal Policy Optimization)**：照样最大化目标，但改两点——① 最大化 **advantage** 而非 reward;② 不偏离旧 policy 太远，**P 就是 proximity**。
- advantage 换问法：从「这个答案好不好」改成「**相对这个 prompt 的期望表现**，这个 response 好多少」。
- 例子：prompt「Teddy is in a box. Where is Teddy?」→ response「in the box」整条 reward +1；逐 token 问「给定部分补全，继续按 policy 采样，期望 final reward 是多少」：0.6 →(the)0.7 →(box)0.95 → 1;token "box" 的简单 advantage = 0.95 − 0.7 = **0.25**，单 token 贡献被精确剥离。
- **value function**:token 级定义，V(prompt + partial completion) = 继续按当前 policy 采样时的期望 final reward，充当 baseline；训练方式 = 给定 prompt+部分补全，预测 completion 末尾的 reward。
- [0:46] 训练机制 Q&A:value model 与 policy 是**两个模型、jointly trained**(同一 loss 含 value loss + policy loss,shared backbone)，但相互 disjoint,value 不作为 policy 的输入；**reward model 事先训好，value model 与 policy 同步训**——value 的定义就是「按正在训的 policy 继续采样」的期望，必须同步。
- **GAE(Generalized Advantage Estimation)**：一个 token 还会抬升后续 token 的收益(教朋友数学 → 考试通关 → 工作 → CEO 的链条)，GAE 把未来 value 的表现回连到该 token；超出本讲范围，感兴趣读原论文。

### [0:50] PPO 之二：ρ ratio 与 clipping

- 复用 batch：生成贵，所以一批 completions 做多次 update——生成 batch 时的 policy 记 **π_old**，目标变为 max E[**ρ·A**],ρ = π_θ/π_old 是修正「采样来源不是当前 policy」的 corrective term；有的论文把这个 ratio 写成 R(与 reward 撞名)——本讲记 ρ。
- [0:53] clipping 直觉：把 objective J 对 ρ 画图——A>0 时线性上升，若不干预梯度恒非零、一直推高 ρ；人为 clip 出一段 **0 梯度区**，ρ 离 1 稍远就不再有「继续增大该 action 概率」的激励，防止 policy 冲离 π_old；A<0 对称同理(压低概率的激励同样要被截断)。

### [0:57] PPO 之三：KL penalty、三种 policy 与 DPO 的 β 同源

- **KL divergence**：按「认定为真」的分布 p 加权 log 比值，衡量用 q 近似 p 有多糟(连续版取积分)；放进 loss 当 penalization，惩罚 π_θ 偏离 **π_ref**(SFT/base policy)——所以读论文时**每个 π 的下标都要看清**。
- 三种 policy 辨析：π_θ = 当前在训；π_old = 生成当前 batch 的；π_ref = 全程固定的 base model。流程：π_ref → 生成 batch(它成为 π_old)→ 多次 update → 再生成新 batch……π_ref 永远不动。
- [1:02:00] 与 DPO 同源：DPO loss −E[log σ(Rw−Rl)] 里 R = β log(π/π_ref)，这个 β 就是 KL penalty 的 β——β 大 → sigmoid 输入稍微偏离就进饱和区(≈1)→ policy 不敢偏离 π_ref;β 小 → 必须拉开更大差距才有梯度。
- Q&A:ρ_t 相对 π_old(当前 batch),KL 相对 π_ref;**两条缰绳同时用**——clipping 管 iteration 内相对 π_old、KL 管 absolute 相对 π_ref;KL 要在全词表上算、很贵 → 实践用 **estimator** 近似。
- [1:05:00] 读 PPO 论文两陷阱：**L 不是 loss，是 objective(要最大化)**;**R 是 ratio 不是 reward**。小结：PPO 回应三大挑战——baseline(顺带给出 token-level credit)+ clipping/KL 防偏离；但代价是**要额外训练并托管 value function，很麻烦**。

### [1:06:00] GRPO：免 value function 的组相对优化

- **GRPO(Group Relative Policy Optimization)**：照样最大化 advantage，但**不需要 value function**——近两年走红的根本卖点。
- 直觉：同一 prompt、正 temperature 下采样 g 条 response(各不相同)，分别算 reward；**减组均值、除组标准差**做标准化，就知道谁相对更好——组平均替代 value function 的 baseline；clipping 与 KL 两道缰绳照用。
- [1:10:00] 流程 walkthrough:prompt → policy 生成 g 条 → reward 打分(**RM 或确定性 verifier**)→ advantage = (r − mean)/std → 带上 clipping(防偏离 π_old)与 KL(防偏离 π_ref)更新；全程只需 **policy + reward model + reference model**，且 RLVR 场景下 RM 可省。
- PPO 对照：一条 response → RM 打分(KL penalty 的一种变体是并进 reward)→ value model 给 token 级期望 → vanilla advantage = value function 差分，实际用 **GAE** → 更新。
- 模型盘点：reference model 固定；reward model 可选、**事先训好**、本阶段不训；policy 在训；value model 仅 PPO 有、与 policy 联合训(必须同步)——**这正是 PPO 的 hassle：要为 value model 的训练留带宽**。
- [1:15:00] 两公式异同：相同处都有 ρ ratio、clipping、KL；差异 ① KL 放哪——GRPO 放 **loss**、PPO 常并入 **advantage**(每家论文实现都不同,别惊讶)；差异 ② advantage 算法——GRPO 在 **completion 级**对组内比较(公式带 (i,t) 下标但实际只是 i 的函数；token 级理论可行但需要 token 级贡献标注，一般不做),PPO 在 **token 级**靠 value function。
- GRPO 原作者跑数学/reasoning：性能上涨、推理链变长；但发现 **response 长度持续增长，即使 performance 已 plateau**——埋下节的雷。

### [1:20:00] GRPO 的坑与未偿之债：长度膨胀、std、ε 与 token 级 credit 缺失

- 长度膨胀根因 = 目标函数里的 **1/|O| 归一化**：短 response 中每个 token 的贡献被放大(1/O 大)、长 response 被稀释；于是负 advantage(坏答案)在长 response 里只是轻微下压、在短 response 里猛压 → 模型相对偏爱「**更长的坏答案**」，性能 plateau 而长度照涨。
- 修正：**DAPO**——按所有 outputs 的总和归一化，每个 token 贡献相同；**Dr. GRPO(GRPO done right)**——直接去掉该归一化项。
- 坑 ②：advantage 除以组内 reward 标准差，而 **std 随输入复杂度波动** → 引入 bias；可把 std 项去掉。
- 坑 ③：clipping 的 ε 上下界对称——对本来概率就极小的 action(如 0.001,ε=0.2)，留给它变大的余地很小 → **不鼓励探索/多样性**；上下界可用**不同的 ε**。
- GRPO 小结：组平均让梯度噪声更小，clipping+KL 管更新幅度，但**丢掉了 token-level credit assignment**——交棒 Shervine 展开这笔债。

- [1:25:00] 回到 Teddy 密封箱：verifiable reward **只看 answer** → 推理步骤错误也整条同分；g 条 completions 的步骤组合(全对/全错/一对一错)里，每个 token 都挂同一个 end reward、同一个 advantage——**错步骤被一起奖励**。
- 「平均下来会学对」不成立：每条 loss 项可能**奖惩错对象(局部噪声)**，正确行为只能靠长期平均显现，**效率很低**。
- process supervision 出路：GRPO 公式的 A(i,t) 本就支持 token 级，但需要**专门标注**；原论文按 **step 级**切片；step 内仍有歧义(Teddy walks:错在 walks 还是错在 walks to the kitchen?)可递归到 token 级 → **token 级 reward model 难训**，且回到「维护多模型权重」的老路——当初离开 PPO 就是为了免掉这件事。
- 要保住的：on-policy(用模型自己的输出训练)；要补的：token 级监督；约束：**不新增训练模型** → 提示：next-token prediction + 借用周围更强的模型 = ?(引出 distillation)。

### [1:30:00] On-policy distillation:reverse KL、self-distillation 与 multi-teacher

- KL **不对称**：KL(P‖Q) 按 P 加权——「在一个由 P 治理的世界里，用 Q 近似有多糟」；常规 distillation 是 KL(T‖S)，on-policy 要以 student 自身采样为准 → 取 **reverse KL，即 KL(S‖T)**。
- reverse KL 性质：T≠0、S≈0 的项**宽容(forgiving)**；T 小而 S 非零 → 比值爆炸、巨罚；叠加 student 自由度通常比 teacher 少 → **mode seeking**：student 集中学会 teacher 分布的峰。注意：原论文其实两种 KL 混用，reverse 并非显然更优。
- [1:35:00] Teddy 演练：student 逐 token 生成，teacher 在**同一 context** 下逐 token 打分——"Teddy" 合理；"climbs" 在 teacher 分布里低概率，被 reverse KL 罚；有趣的是 "works" **没被罚**:climbs 进了 context 后，teacher 把 Teddy 理解成「会爬的、也许是人」，walking 就不离谱——逐 token 条件化带来的灵活性。
- 特性：监督信号 **dense(token 级而非 outcome 级)**;**on-policy**(对着自己的补全变强,与 SFT 不同)；实践效果好，同算力**更划算**；对参数受限场景友好——Thinking Machines 博客的 toy ablation：不同 LoRA rank 下，先 SFT 再 on-policy distillation 能大幅缩短 SFT 留下的 performance gap。无 reward model → **无从 hack**；真要 hack，把 loss 压到 0 = 完全对齐 teacher 分布，恰好是好事。
- 局限 ①:**需要 teacher**——frontier model 没人能教你。
- [1:40:00] 变体 **self-distillation**：利用 teacher forcing，把 prompt + 完整答案(以及通往答案的一切)塞进**同一个模型**的输入，拿它的 next-token 分布当 teacher——「自问自答拿分布」；GLM 5 论文就用 self-distill 保住旧知识不遗忘。定位：最适合系列里的**快模型**(pro/flash 中的 flash 线)，pro 级前沿模型更适合 GRPO 这类基于硬标签、吃算力的方法。
- 局限 ②：信号是 **teacher 分布而非真标签**，可能不完美、领域覆盖不全 → **multi-teacher on-policy distillation**：用 verifiable rewards 在各领域训 expert，distill 时对相应领域 expert；单一 teacher 做后训练 RL 容易**遗忘**、一组参数被多个目标拉扯，multi-teacher 实证更高效。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 备注 |
|---|---|---|
| π_θ / π_old / π_ref | 当前在训的 / 生成当前 batch 的 / 全程固定的 base model；读论文先看下标 | 本讲约定 |
| Policy gradient | ∇J = E_{τ~π_θ}[R(τ)∇log π_θ(τ)]；正 reward 推高、负 reward 压低该 action 概率 | 由 ∇f = (∇log f)·f 恒等式推出 |
| Importance sampling ratio ρ | π_θ/π_old，固定策略生成一次、重加权复用多次；有的论文误记作 R | PPO/GRPO 公式公共项 |
| RLHF / RLVR | 无 ground truth 用人工偏好 + Bradley-Terry 训 RM；可验证任务(数学/代码)直接判对错 | reward 两大来源 |
| Advantage | 相对 baseline 的好坏：PPO 靠 value function 差分(实用为 GAE),GRPO 靠组内 (r−mean)/std | token 级 credit assignment 的载体 |
| Value function | 给定 prompt+部分补全、按当前 policy 继续采样时的期望 final reward,token 级 | 仅 PPO 需要，与 policy 联合训，是 PPO 的 hassle |
| Clipping | 把 J(ρ,A) 在 ρ 远离 1 处截出 0 梯度区，移除继续推大 ρ 的激励 | 防偏离 π_old，PPO 的 P(proximity) |
| KL penalty(+β) | loss 中惩罚 π_θ 偏离 π_ref;β 越大越不敢偏，与 DPO 的 β 同源；全词表计算贵，用 estimator | 防偏离 π_ref |
| On-policy distillation | student 自采样、teacher 同 context 逐 token 打分；reverse KL(S‖T) → mode seeking | dense token 级监督；可 self/multi-teacher |
| Reward hacking | reward 不完美被模型钻空子(只优化掌声就全程讲段子) | 三大挑战之三的动机 |

## 自测题

1. RL 的 agent / state / action / policy / reward 映射到 LLM 各是什么?RLHF 与 RLVR 的 reward 分别从哪来?
   > agent=LLM、state=输入、action=token(或整条 response)、policy π_θ=模型输出的概率分布、reward=回答好坏的量化；RLHF 无 ground truth，人工偏好 + Bradley-Terry 训 reward model;RLVR 可确定性验证(数学有解、代码过测试)，只看 final answer，多用于 reasoning。
2. Policy gradient 公式长什么样?直观含义是什么?更新为什么是 ascent?log 是怎么进来的?
   > ∇J = E_{τ~π_θ}[R(τ)∇log π_θ(τ)];reward 正→推高该 action 概率、负→压低；要最大化期望 reward 故 θ←θ+α∇(ascent);log 来自恒等式 ∇log f = ∇f/f，顺带解决整条 response 概率极低的数值稳定问题。
3. 为什么要 importance sampling ratio ρ = π_θ/π_old?「评估 policy 便宜、生成 rollout 贵」差在哪?
   > 生成要逐 token 串行、每次更新都重来太贵；固定 π_old 生成一次 batch，之后多次更新用 ρ 重加权仍数学等价；评估时整条 response 已知，并行喂入 decoder-only 模型(masked self-attention 一次算出全部概率)所以便宜；注意有的论文把 ratio 记作 R，与 reward 撞名。
4. Vanilla policy gradient 的三大挑战是什么?各配课堂上的例子。
   > ① 无 baseline 梯度方差大(好答案 101 vs 坏答案 100 双向猛更新,应对比期望 100.5 看 ±0.5);② completion 级 reward 无 token 级 credit assignment(Teddy 答对 kitchen 但 climbs/walks 错误步骤也被一起奖励);③ 无约束偏离已很好的初始 policy + reward 不完美导致 reward hacking(只优化掌声就全程讲段子)，过度优化还遗忘旧能力。
5. PPO 的 value function 是什么?「in the box」例子里 token "box" 的简单 advantage 怎么算?reward model 与 value model 训练时机有何不同?
   > value function = 给定 prompt+部分补全、继续按当前 policy 采样时的期望 final reward(token 级 baseline);box 的 advantage = 带它 0.95 − 不带它 0.7 = 0.25;reward model 事先训好、本阶段冻结，value model 与 policy 联合训练(同一 loss 含 value loss + policy loss,须同步因为 value 依赖当前 policy)。
6. PPO 用哪两道缰绳防偏离、各自相对哪个 policy?π_θ/π_old/π_ref 如何辨析?为什么说 DPO 的 β 与 KL penalty 的 β 是同一个?
   > clipping 把 J(ρ,A) 在 ρ 远离 1 处截出 0 梯度区，相对 π_old;KL penalty 在 loss 里惩罚偏离固定的 π_ref(SFT base);π_θ=当前在训、π_old=生成当前 batch 的、π_ref=全程不动；β 大→sigmoid 饱和快→微小偏离就够→不敢偏离 π_ref；读 PPO 论文注意 L 是 objective 要 maximize、R 是 ratio 不是 reward。
7. GRPO 怎么在不用 value function 的情况下算 advantage?与 PPO 的公式差异有哪些?为什么会出现「性能 plateau 但 response 越来越长」?
   > 同一 prompt 采 g 条 response,advantage=(r−组均值)/组标准差(completion 级)，组平均替代 baseline，只需 policy+RM(RLVR 可省)+reference；差异：KL 放 loss(GRPO)vs 并入 advantage(PPO)、组内比较 vs value function 的 token 级；长度膨胀源于 1/|O| 归一化——负 advantage 在长 response 里只是轻微下压，模型偏爱更长的坏答案；DAPO 改按 outputs 总和归一化，Dr. GRPO 直接去掉该项(另:除 std 有 bias、ε 对称压探索,均可修)。
8. On-policy distillation 为什么用 reverse KL?它有什么性质?两大局限与对应变体是什么?
   > on-policy 以 student 自身采样为准，故取 KL(S‖T) 而非 KL(T‖S)；性质：T≈0 而 S 非零巨罚、T≠0 而 S≈0 宽容 → mode seeking,student 学 teacher 分布的峰(原论文两种 KL 混用)；局限①需 teacher(frontier 无人可教)→ self-distillation:teacher forcing 把 prompt+答案喂给同一个模型拿分布(GLM 5 用它防遗忘,适合 flash 线)；局限②信号是 teacher 分布非真标签、覆盖不全 → multi-teacher：各领域训 expert、对领域 expert 蒸馏。
---
