# CS329Z Lecture 2 学习笔记：Context Engineering

> 讲者：Michael Ryan（DSPy 作者之一）｜配合视频 `lectures/LLMs for Agent Builders： Context Engineering ｜ Stanford CS329Z Lecture 2 with Michael Ryan [Vr1NzH8bT44].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L02-transcript.md](L02-transcript.md)

---

## 一句话概览

**用 LLM 之前先懂 LLM**：从语言模型的概率定义讲到 Transformer/注意力、线性注意力、训练（预训练数据 → post-training → agent RL）与推理（prefill/decode、KV cache、test-time scaling），最后落到本讲主题——**Context Engineering**：agent 的上下文里放什么、怎么放、何时压缩、何时递归分治。

---

## 分节要点（带时间锚点）

### [0:00–0:05] 课程定位：LLM 三层技术栈

- Michael 首次独立讲课。他个人把 LLM 领域划成三层：**LLM engineering**（训练集群配置、GPU kernel、scaling laws、post-training）→ **适配层**（继续训练、蒸馏、in-context 适配、低秩适配 LoRA）→ **应用层**（agent、chatbot、RAG）。
- 课程地图：CS336 = 底层从零造模型；CS224N = 中层 NLP 入门；**CS329Z 在栈顶**——基于 LLM 构建系统（三层圆圈有少量重叠）。
- 本讲目标：理解训练与推理的**关键设计决策**（KV cache 怎么工作、注意力有哪些变体），这些知识让你能判断「这个模型适合我的长上下文应用吗」。

### [0:05–0:15] 语言模型是什么：概率、采样与解码策略

- LM 基本式：P(序列) = ∏ P(当前 token | 之前所有 token)。示例：p("the")=0.0377，p("class"|"the")=0.0001；实践中取**对数求和**（概率太小，数值稳定是真问题）。
- 生成式 vs 判别式边界模糊：LM 能给**任意 token 序列**打概率，所以归为生成式（若只对固定标签集训练才会更像判别式）。因为能对全词表打分，我们就能从中**采样**生成文本。
- 解码策略：**greedy**（总选最高概率）、**top-p**（按累计概率截断，讲座以 30% 为例）、**top-k**（只在前 k 个候选里选）、**beam search**（多路深探，时间和空间复杂度都更高）。
- **Temperature**：logits 除以 T 再归一化；T 高 → 分布摊平、文本更多样，T 低 → 接近最优。
- Q&A 洞见：T 只是缩放系数（问「temperature=5 是什么意思」没有意义）；词表大小 128,000 是 tokenizer 的设计决策；推理中途换 temperature 不会使 KV cache 失效；beam search 没有传统搜索的目标函数，可接外部 verifier/价值函数或让 LM 自己评估哪条 beam 更好；训练一般不用 temperature（无梯度信号），但 RL 采样 rollout 时要用；temperature 同样影响 reasoning 模型。

### [0:15–0:30] Transformer 架构与注意力机制（本讲核心之一）

- 架构简史：N-gram 数频（2010s 前）→ 2003 首个神经 LM → 2010 RNN → 2014 LSTM → 2017 Google《Attention Is All You Need》encoder-decoder；现代 LLM 几乎都是**decoder-only**。
- 解码器逐步拆解：token 嵌入 + **位置嵌入**（架构本身不含位置信息，必须额外混入）→ layer norm → 三次矩阵乘（W_Q / W_K / W_V）→ QKᵀ 得 n×n 注意力分数 → **causal mask**（"about" 可看 "the"，反之不行）→ 除以维度缩放稳定数值 → softmax（每行和为 1）→ 乘 V → 投影回模型维度 → 残差连接（利于梯度流动）。
- **多头注意力** = 堆叠多组 QKV 权重再拼接投影回去，让同一序列有多种表示；注意力层 + layer norm + 残差 + 前馈层 = **一个 transformer block**；堆很多 block，最后 LM head 把隐层映射到词表 logits。
- Q&A 洞见：QKV 旁的小点是 bias；权重随机初始化（第一次前向输出全是废话）；位置嵌入是固定数值；**为什么有了 causal mask 还要位置编码**——mask 只保证不看未来，没有位置向量时模型无法区分 token 先后，得靠归纳式「脑内推理」恢复顺序，不如直接给数字好学。
- 复杂度对比（原论文表格）：注意力**顺序操作 O(1)**——整段文本一次前向并行处理，这是 Transformer 在 GPU 上训练快的主因（RNN 是 O(N) 顺序）；但上下文长度是 **O(N²)**——长上下文极贵。原论文约 2 亿参数，如今前沿模型是万亿级。

### [0:30–0:35] 线性注意力与现代架构

| 维度 | Full softmax attention | 线性注意力 |
|---|---|---|
| 复杂度 | O(N²)（随上下文长度） | O(N) |
| 长上下文 | 所有 token 可回看全部历史 → 好 | 压缩进固定 d×d 状态 → 差（needle-in-haystack 弱） |
| 内存 | KV cache 随 N 线性增长 | 常数（固定状态矩阵） |
| 代表 | Llama | RWKV、Mamba |

- 做法：去掉 softmax → 整串矩阵乘变成线性 → **改结合律先算 K·V**；状态更新 = 移位丢弃旧记忆 + 加上新 token 的外积。代价是「大海捞针」时模型必须把一切压进小矩阵，而不是回头去找。
- 上下文长度没有硬性架构上限（位置嵌入除外）——实际上限取决于**训练时喂了多长的文档**。
- 实践是混合：**DeltaNet** 用线性注意力层 + 少量全局注意力层；检索类任务（从上下文抽取信息）加滑动窗口/全局注意力会提升，简单常识问答反而略降。
- **Qwen3** 剖析：线性注意力 + 前馈层 + 在 latent 表示上做的 multi-head attention（MLA 风格）+ 门控——看完这节你已能读懂现代前沿开源模型的架构图。
- 对 agent 的意义：agent 要处理超长上下文、推理效率是硬约束；选型时须知道候选模型的注意力形态（长任务选 full attention 还是线性混合），这节给了你讨论与试错的词汇表。

### [0:35–0:52] 训练：预训练数据、mid-training 与 post-training

- Loss：正确 token 的负对数概率（cross-entropy + one-hot 指示），概率给得越高 loss 越小。
- 预训练数据管线：网页 HTML → 规则工具抽取纯文本（如 Mozilla Readability）→ 语言检测 → 规则过滤（符号远多于字母、大量重复 = 垃圾）→ 模型质量过滤 → **去重** → 得到训练集。**DCLM** 把这套流程做成开源竞赛：从 Common Crawl 层层过滤后**只留 1.4%**。真实数据长啥样：黑客动漫论坛帖、烹饪学院文章、汇编语言 shift 函数文档——主题极杂，为的是给模型广博知识；The Pile 则补充学术、对话等互联网外来源（书籍因版权可能被移除）。
- **数据配比**（30% 网页、20% GitHub…）靠训一堆小模型做代理实验来优化；**mid-training** 把配比向目标域倾斜（开源项目 Marin：预训练与收尾两套 mixture，收尾期上调 business software 等权重）。证据：把目标域数据掺进预训练再微调，域内 loss 改善，**而且顺带帮到其他域**——mid-training 是通向目标 θ 的桥梁。
- Post-training：**指令微调/SFT**（「氮的沸点是多少」+ 好答案，定向数据而非全网大杂烩）→ **RLHF**（InstructGPT，ChatGPT 的地基）：SFT → 人对多个答案排序 → 训 reward model → RL 放大人类喜欢的输出。人类反馈的坑：标注**不一致**（讲者做个性化研究：同一个人几周后改选另一个答案）、人与人偏好不同 → 优化出虚假激励；人爱听好话 → 模型变**谄媚**；且标注工作伦理存疑——低收入地区的标注员拿微薄工资看恶劣内容。
- 替代方案 **RLVR**（可验证奖励的 RL）：数学看答案对不对、代码看过不过测试，绕开人类偏好。
- **Agent RL 训练**：拿 GitHub 仓库装起来做成 Docker 环境 → 程序化注入 bug（用 LM 回滚 PR、往函数里塞错）→ 生成 issue 描述 → 测试通过即成功。效果：**Qwen 2.5 32B 在 SWE-bench Verified 上从约 9% 训到 40%**——纯靠合成环境。
- Q&A 洞见：长上下文扩展也是训练的一部分（位置嵌入要在更长文档上继续训）；做 RL 环境的公司如今是一门好生意，代码是最常见域；如今每天生成数万亿 token 合成数据，开源模型预训练一般用不超 36T token——理论上已能全合成预训练，但不推荐（**互联网的多样性正是其价值**），未来互联网榨干后要靠 RL 继续推进；预训练 vs 继续训练的边界很主观：预训练时你其实不知道数据里有什么，继续训练时你清楚自己在训什么。

### [0:52–1:05:00] 推理：prefill / decode、KV cache 与 test-time scaling

- GPU vs CPU：GPU 不擅长控制流和分支，只管堆算力吃并行。**Roofline 模型**：峰值 FLOPS 与显存带宽（GB/s）两条线——数据喂不满算力时是**内存受限**，喂得超过则是**计算受限**。
- **Prefill**（一次性并行算完整个 prompt，如「帮我改 essay」+ 全文）= 计算受限；**Decoding**（每步只有一个 token，注意力只剩最上面一行）= 内存带宽受限。
- 解码时大部分中间激活可以丢，但**历史的 K、V 激活必须全留**——这就是 **KV cache**，随生成不断增长。两个关键指标：time to first token（prefill）与每输出 token 耗时（decoding）。
- **Speculative decoding**：小 draft 模型一口气起草一批 token，大模型**并行验证**（如 greedy 下比对 logits），不匹配处拒绝、从草稿模型继续。结果：接受率在 HumanEval（代码）上明显高于 XSum（摘要）——**代码更可预测、更易压缩**。
- **Test-time scaling**：CoT（「let's think step by step」）是老经典；现在的 reasoning 模型被专门训练来细想——推理链里会自我纠错（「wait，这里约不掉…」），出现「顿悟时刻」，更准但更贵。发布会曲线：X 轴任务成本（token 数）、Y 轴分数，多推理 token → 更高分。
- 推理缩放的妙处：**完全在用户手里**——难题就多花 token。GPT-OSS 在 system prompt 里设 reasoning effort low/medium/high。
- 两种实现：Thinking Machines 的 Inkling——RLVR 奖励之上按档位对 token 花销罚分，教会模型「low 档就该少写」；**Kimi K3**（转写 "Chimera 3"）：答对 +1、答错 0、**答错且超预算 −1**（对的时候可稍微超预算，错的时候别超）——训 9 个教师模型（通用 agent + 代码 agent × 三档）再蒸馏成一个学生模型。
- 无硬 verifier 时：多次采样 + **self-consistency** 多数投票（$18、$26、$18 → 取 $18）；有硬 verifier 时直接 best-of-N 挑正确答案——两者都有随采样数增长的 scaling 曲线。

### [1:05:00–1:10:00] 结构化输入/输出

- 模型越来越多地嵌在复杂系统里，需要与工具调用等「约定接口」。
- **受限解码（constrained decoding）**：想要 JSON 就把格式编译成**有限状态机**（SGLang 的做法）——下一个 token 已确定的步骤直接跳过模型，有分叉时把词表限到候选 token；既保证格式合规又**解码更快**。
- **DSPy signatures**：声明输入输出字段（message → name, email, intent），「I'm Sarah. Let's meet Thursday」+ 邮箱 → 结构化结果；框架背后生成格式化 prompt 并可对接 SGLang 兜底。
- **分类头**：拿模型嵌入训个小 head 做二分类——当下热议的「System 1 模型」本质是旧事物；公开参考是 Stanford 博客的例子：把状态（Mario 位置）和动作（left/right/jump）分别嵌入、点积比相似度 → 选 jump。
- **工具调用**：关键是输出必须**可解析**（Toolformer 时代就如此）——模型说什么不重要，解析不出就不知道该调计算器还是搜索；今天最常用且最有效的形式是让模型**直接写代码/执行 bash**。

### [1:10:00–1:15:00] Context Engineering 实践原则（本讲主题）

- 从 prompt engineering（ChatGPT 早期「不回答世界就毁灭」式咒语）进化到 context engineering：**信息这么多，关键是结构化与缩短**。上下文构成：system prompt、消息历史、记忆（L7 详讲）、工具调用结果（文件/搜索结果）、附件。
- 为什么不全塞进去：注意力 O(N²) 很贵，而且就算付得起也不该——**ULong** 基准（多文档问答「9 月还是 8 月经济新闻多」）显示：Gemini 短上下文近 90–100% 准确率，文档一多掉到**约 10%**。没有唯一正确的上下文构建法——HW1 就是给你的 agent 设计上下文。
- 实践清单：
  1. **砍掉多余东西**：「harness tool attacks」博客对比 Codex / Claude Code / Pi（极简工具集：只有读、写、编辑、bash）——几乎每个被测模型配 Pi 都在 **Terminal-Bench** 上最好：聚焦的小工具集胜过堆一堆冗余工具。
  2. **检索**：用 prompt 搜文档，只把命中的放进上下文（下讲主题）。
  3. **顺序追加**：别在对话中途把文档插到上下文开头——后面所有 token 位移、位置编码改变 → **KV cache 整体失效**；信息应随时间顺序加入。
  4. **经验评估**：Toolformer 式消融（带/不带工具各跑一遍）；上下文用 Markdown 还是 YAML 也该实测——把上下文决策变成工程实验。

### [1:15:00–1:18:00] 压缩的陷阱与递归语言模型（RLM）

- **压缩**：上下文过长时必做的设计决策是「保留什么」。失败故事（呼应 L1 OpenClaw）：邮箱代理被告知「可删邮件但删前需确认」→ 整箱读入超长 → 系统立刻压缩并把这条指令当垃圾丢掉 → **直接开始删邮件**。压缩会无声地丢掉关键约束，务必小心。
- **递归语言模型（RLM）**：另一种避免压缩的哲学——把 prompt 当作**环境的一部分**（放进一个变量），模型在代码环境里操作它（「看前 100 个字符」「切分 prompt」），还能**调用自己**：prompt 传给 subagent 时又成为 subagent 的 prompt。用 subagent 分治处理超长上下文、只回传需要的部分。
- 效果：RLM 让 **GPT-5 mini 在 ULong 基准上超过 GPT-5** 拿到最好成绩。
- 收尾回顾：LM 是什么 → 架构 → 训练 → 推理 → 为 agent 用 LLM；之后课程不再深挖 LLM 内部，直接使用它们。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| LM 基本式 | P(序列)=∏P(token\|前文)，实践取对数和 | 本讲开头 |
| Temperature / Top-p / Top-k / Beam | 四种解码策略，多样性与开销各有权衡 | 采样节 |
| Causal mask | 屏蔽未来 token，保证训练与生成行为一致 | Transformer 节 |
| 位置嵌入 | 架构不含位置信息，需外加；上下文上限取决于训练长度 | Transformer 节 |
| 线性注意力 | 去 softmax、改结合律先算 K·V；常数内存但长上下文弱 | RWKV / Mamba |
| DeltaNet 混合 | 线性层 + 少量全局注意力层，兼得效率与检索能力 | 本讲 |
| KV cache | 解码只需保留历史 K/V 激活，随长度线性增长 | 推理节 |
| Prefill vs Decode | 预填充计算受限、解码内存带宽受限（Roofline） | 推理节 |
| Speculative decoding | 小模型起草、大模型并行验证，代码接受率最高 | 推理节 |
| Test-time scaling | 多花 token 换准确率；档位用户可调 | GPT-OSS / Kimi K3 |
| RLVR | 用数学/代码测试等客观奖励替代人类偏好 | post-training |
| 受限解码 | FSM 限定输出格式，确定处跳过模型、更快更稳 | SGLang |
| DSPy signature | 声明输入输出字段，框架生成格式约束 | DSPy |
| Context Engineering | 决定什么进上下文、如何组织/追加/压缩 | 本讲主题 |
| RLM | prompt 进变量，模型在代码环境中递归/分治处理 | 递归语言模型 |

## 自测题（先遮住右侧再答）

1. Temperature 到底是什么？训练时用吗？
   > logits 除以 T 再归一化的缩放系数，没有固定取值范围；T 低→确定、T 高→多样。训练一般不用（无梯度信号），但 RL 采样 rollout 和推理都要用；对 reasoning 模型同样生效。
2. 已有 causal mask 编码「不能看未来」，为什么还要位置编码？
   > mask 只保证方向，不提供顺序数值；没有位置向量时模型无法分辨 token 先后，只能靠归纳式推理硬猜，模型学不好——直接给位置数字即可。
3. Full softmax attention 与线性注意力如何权衡？实践中怎么用？
   > O(N²) 但可回看全部历史、KV cache 随 N 增长 vs O(N) 常数状态但必须把历史压进 d×d 矩阵（needle-in-haystack 弱）；实践用 DeltaNet 式混合（线性层 + 少量全局注意力层），检索类任务受益、常识问答略降。
4. Prefill 和 decoding 的瓶颈各是什么？对应哪两个指标？
   > Prefill 一次并行算完整个 prompt → 计算受限；decoding 每步一个 token、搬运 KV cache → 内存带宽受限；指标分别为 time to first token 与每输出 token 耗时。
5. Speculative decoding 的原理？为什么代码任务收益最大？
   > 小 draft 模型起草一批 token，大模型并行验证、不匹配处拒绝回退；代码更可预测、更易压缩，HumanEval 接受率高于 XSum。
6. 举两种用奖励塑造 reasoning effort 的设计。
   > Inkling：RLVR + 按低/中/高档位对 token 花销罚分；Kimi K3：对 +1、错 0、错且超预算 −1，训 9 个教师模型再蒸馏成一个学生。
7. 为什么不能在对话中途把文档插到上下文开头？压缩有什么风险？
   > 插入使后续 token 全部位移、位置编码改变 → KV cache 整体失效，信息应顺序追加；压缩可能无声丢掉关键约束——邮箱代理压缩时丢掉「删前确认」指令后直接删邮件。

---

*Generated from lecture transcript via deep-reader pipeline, 2026-11-17.*
