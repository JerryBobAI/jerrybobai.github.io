# CS329A Lecture 4 学习笔记：Learning from Feedback with Tools/Code

> 讲者：Aakanksha Chowdhery 与 Azalia Mirhoseini(Stanford)|配合视频 `lectures/…[Lxh9RF5S-K0].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L04-transcript.md](L04-transcript.md)

---

## 一句话概览

本讲以「**自我改进的反馈从哪里来**」为主线讲三篇论文：**ReAct** 用环境观察给「思考-行动」循环做 grounding，**RLEF** 用执行反馈(测试通过/失败)做 RL 微调代码模型，**Constitutional AI** 用模型按人类书写的宪法自我批评、生成 AI 反馈——三者共同回答：反馈环有足够信号时，模型就能改进到训练数据之外。

---

## 分节要点(带时间锚点)

### [0:00–0:05] 本讲定位：三篇论文、三种反馈来源

- 承接前两讲的 test-time compute 与 robust verification：LLM 要在真实世界有用，必须能**与环境、工具、代码交互**并从交互中学习。
- 三篇论文：**ReAct**(首批把 reasoning 与 acting 结合的工作)、**RLEF**(执行反馈 grounding 代码 LLM)、**Constitutional AI**(模型批评自己作反馈)。
- 统一视角：三者的差别就在**反馈来源**——环境交互 / critique 机制 / 与已知正确答案的 grounding。
- 对比两种旧范式：CoT 的推理步骤基于模型**内部状态**、无外部反馈、可能不 grounded；WebGPT 类只学**动作**(与浏览器交互的 trace)但没有显式推理。ReAct 要把两个范式合并。
- 现在的模型 reasoning 已「内置」(thinking mode)，但历史上这不是开箱即来的能力。

### [0:05–0:10] ReAct 抽象：纯 prompting 实现思考-行动-观察循环

- ReAct 核心抽象：用 prompting 让模型先生成**verbal reasoning trace**，追加进 prompt，再问「基于此该做什么动作」——思考与行动交替。
- 三个任务都需要 grounding:**HotpotQA**(multi-hop 问答)、**FEVER**(事实核查)、**WebShop**(按指令网购,一系列工具调用完成购买)。
- 两个收益：①grounding 关键的任务性能提升；②trace **可解释**，人类能逐步核对从而信任模型。
- 让动作合法的技巧：把动作生成**framing 成分类任务**——给出合法动作子集 + 世界状态，再选下一步；讲者与 Google 机器人团队的合作论文同样靠受限动作列表保证 grounded。
- 实现很朴素：旧模型 PaLM(frozen LLM)+ few-shot 示例(动作/思考/观察)，每步决定「接着推理还是行动」。
- HotpotQA 例子(Apple remote 最初为何设备设计)：standard prompting 错、CoT 仍不对；ReAct 搜 Apple remote→发现它控制 Front Row→搜不到→改搜「front row software」→得出正确答案——观察驱动的查询改写是关键。
- 今天的 thinking 模型(如 Qwen)已把这类行为内化：它们在这些 trace 上做过蒸馏。

### [0:10–0:15] 课堂问答：模型知道自己知道什么吗

- 「模型是否知道自己所知」学界观点矛盾；较共识的观察：让模型自评置信度时普遍 **overconfident、校准不好**，仍是开放研究问题。
- 应用设计者的正确姿势：别纠结元认知，**给模型配对工具**让它拿到 grounded knowledge。
- 思考与行动严格**交错**：thought1→act1→thought2→act2，每步喂入下一步(像人渴了走向厨房、发现没水再改去超市)；可做并行采样但须显式设计。
- 搜索结果互相矛盾怎么办：majority voting、输出前验证等 guard rails；有搜索 grounding 的幻觉比纯内部状态**可控得多**。
- 思考 token 不算动作空间的一部分(左循环与右循环分开)；语言模型受益于用**语言抽象**承载推理 token。
- 开放问题：KV cache 里 thought 与 observation(环境给的、非模型生成)的表示是否有可分辨的交错模式——可作为课程项目。

### [0:15–0:20] ReAct 结果：知识密集任务与消融

- HotpotQA/FEVER 的动作空间极简：**Search[wiki 页]、Lookup[字符串]、Finish**——模拟人类交互 Wikipedia。
- 基线：Standard prompting(无思考无动作)、**CoT**、**CoT-SC**(SC=self-consistency=majority voting,同义词)、**Act**(只行动不思考,失败可 fallback 到 CoT-SC;SC 多数答案占比不足半数时可 back off 到 ReAct)。
- 结果：ReAct 稳定好于 Act-only；**不一定总赢 CoT**——FEVER 上更好，HotpotQA 上不总是；CoT-SC 与 ReAct 互相 fallback 的组合超过所有标准技术。
- 结论：价值在于**正确组合内部知识与外部知识**，以推理为中介决定检索什么。
- 失败分析：CoT 的主要失败模式是**幻觉**；ReAct 靠检索外部知识 grounding，错误更少、更可信。
- 谱系：prompting < 微调 < RL 环(下周讲)，能微调时 ReAct 更好，上 RL 环还要更好。

### [0:20–0:25] 决策任务、ReAct 局限与课堂讨论

- 决策任务 WebShop：模拟环境里按用户指令买商品(如「带抽屉的床头柜」)，看 score(中间步骤)与 success rate(完成任务)。
- 基线是 imitation learning(=微调)与 imitation learning+RL(=SFT+RL):ReAct 两项指标都更高，但**仍远低于人类专家——66.6 vs 82.1**,headroom 很大。
- 多步任务中任何一步出错都会**级联**，拖低成功率。
- ReAct 局限：动作空间大时需要太多 demonstration、塞不进上下文；多步推理抬高推理成本；换来的是 QA/事实核查/决策任务更好、幻觉更低、决策 trace 更可读。
- 讨论(环境反馈有噪声/误导)：加反思层、**backtracking**(防噪声把 agent 带进重复循环)、建立置信度度量、同一任务多次采样取最好。
- 讨论(还应纳入哪些认知机制)：任务分解、并行思路、**记忆/过往经验**、推理-行动配比(今天模型常 **overthink**,简单任务也想很长)、按各模型强项分派子任务的 compound system。

### [0:25–0:30] RLEF：执行反馈驱动的 RL 微调框架

- RLEF 是首批证明**执行反馈能大幅提升 coding LLM** 的工作；背景：工程编码任务大量交给 Claude Code 这类 agent，关键是理解用户意图并对生成代码拿到可迭代的反馈。
- 框架 = 端到端 RL 微调：action=生成的代码，observation=**执行反馈**(跑测试收集通过/失败)，据此给**二值奖励**，训练用 **PPO**。
- 两项核心技术：**two-tier test strategy**(双层测试)与 **hybrid token/turn-level policy**(turn-level critic)。
- 核心循环：自然语言题面→生成代码→跑 public 测试→失败则把反馈喂回 LLM 再试→直到通过或达到轮数上限→用 private 测试定奖励→进 PPO 更新。
- 两个阶段：exploitation(用当前 policy 跑推理期反馈循环)+ policy update(按执行结果更新策略)→持续自我改进。
- 例子(回文子串检测)：第一版解法在 public 测试**超时失败**；吃反馈后优化实现、通过 public 测试，再交 private 测试定奖励。

### [0:30–0:40] RLEF 机制与结果：双层测试、turn-level critic、为什么有用

- 双层测试：public 测试是小集合、供**推理期即时反馈**加快迭代；private 测试在生成期**完全隐藏**、只用于定奖励——模型无法**背下测试输出**，只能真用执行反馈改进。
- hybrid 粒度：policy **逐 token** 生成代码(精细控制)；value function 在 **turn 级**评估整个响应(用 prompt 最后一个 token,整轮单一 advantage)——讲者类比：更接近 **GSPO** 的序列级奖励，而非逐 token 奖励。
- Q&A：「测试失败」就是真的跑了 Python 测试没过；测试集来自 CodeContests 自带测试，自行划出 public/private 子集。
- 结果：在 llama 3.1 上用 CodeContests(竞赛编程)训练，solve rate 随采样预算上升(x 轴 **log scale**);solve@10@K 即生成 10 个解看通过的比率。
- 为什么有用：base 模型**只看错误解法+反馈并没有用**；有效的是「解里的错误」——训练时每轮展示执行反馈，模型学会修复，并**泛化到其他代码基准**。
- 逐轮错误统计：有 RLEF 时 turn 1→2→3 错误输出递减、编辑更**有的放矢**(能对着出错处改)，同时保持采样**多样性**；无迭代环时编辑不正确。
- Q&A：二值反馈对简单题够用，更难题可能需要 error trace 等元数据(项目点子)；**process vs outcome reward model** 之争未决，按领域选；SFT 在域内仍有效，RL 能解稍新的问题(略好泛化)；消融：RLEF 后 wrong output 更少但 **timeout 更多**(自我修复但没修对就超时)。

### [0:40–0:45] 长代码库讨论与 Constitutional AI 开场

- Takeaway：执行反馈能改进代码生成；竞赛编程是已验证场景，并泛化到其他代码生成基准。
- 课堂讨论「代码库塞不进上下文」：用搜索工具判断信息是否足够、把每个文件压缩成摘要、图分解+相似度检索(RAG)——讲者点明这正是 **Claude Code** 实际在做的；对应 benchmark 是 **SWE-bench**；Azalia 组的 **Code Monkeys** 论文同方向。
- RLHF 回顾：人类对成对输出排序(是否正确/有用/具体)→训**偏好模型(reward model)**→RL 微调；模型越大，RLHF 相对 SFT 优势越明显。
- 瓶颈：数万条人类标注**费时费力不可扩展**。
- Constitutional AI：利用模型会推理这一点，人类写一组原则「**constitution**」(16 条)描述期望行为；除写宪法外**人不进环**。
- 之所以可行：模型 instruction following 变强——能按要求格式回答，也能如实判断「这个回复是否具有某行为」。
- 两阶段：SFT(自我批评+修订生成的数据)+ RL(用 AI 反馈训偏好模型再微调)。

### [0:45–0:55] Constitutional AI 机制：批评-修订-偏好模型与规模化结果

- 宪法条目即 critique prompt 示例：输出是否**有害/不道德**?→修订要求删掉；是否有**性别偏见**?→消除痕迹；是否**不适合儿童**?→改写得体——每条都要求模型会识别行为+服从改写指令。
- SL 阶段：在自我批评+修订的数据上微调；**修订轮数越多 harmlessness 越高、helpfulness 略降**，但两者合计单调改善。
- RL 阶段：用第一阶段的回答+宪法训**偏好模型**，再微调 LLM 最大化它(回复 thoughtful、respectful、cordial)——把 RLHF 里的人类反馈换成宪法驱动的 AI 反馈。
- Q&A(宪法要修订怎么办)：post-training 只占预训练后约 **5%** 算力、更新频繁，改宪法跟着更新即可；让模型「遗忘」旧规则属于 continual learning / machine unlearning，**开放问题**。
- 规模化结果(训练序列数 vs **helpfulness ELO / harmlessness ELO**)：仅按原则自评，helpfulness 持平略降、**harmlessness 大幅升高**；这也是 Claude 模型无害性极强的技术来源，现已跨模型推广。
- 无害性与 helpfulness 存在反向张力，要找平衡。
- Q&A：SL 阶段没有显式反馈——本质是在自己生成的修订 trace 上做(小规模)SFT，规模小于预训练就不会丢原能力，但输出分布向修订风格偏移；偏好模型仍需**少量人类一致性校验**(非万级标注)。

### [0:55–1:10:00] Pareto 前沿、后续工作与回顾问答

- 前沿图(harmlessness ELO × helpfulness ELO):base model 起点低→helpful-only RLHF 推高 helpfulness→helpful+harmless RLHF→constitutional SL 逊于 RLHF→**constitutional RL + CoT 给出最佳 Pareto 前沿**(helpfulness 与 harmlessness 的最优权衡)。
- 可泛化：任何「模型要遵守一组可能互相冲突的指令」的 instruction following 都适用这套原则式方法。
- 后续工作：RLIF vs RLHF 的对比、**Self-Refine**(自反馈迭代精炼)、模型自我批评往往偏难——**多模型共识批评**有时更好(模型对所知 overconfident)、用 RL 教模型自我纠错——皆是活跃方向与项目点子。
- 回顾：ReAct 让推理+行动结合、决策 trace 极可解释，如今 tool calling 已 innate；RLEF 用 unit test 执行反馈做自我改进，**降低了达到 CodeContests 级 SOTA 所需预算**；Constitutional AI 用原则生成反馈形成自改进环。
- 总纲：反馈环信号足够强时，模型能改进到**训练数据之外**。
- Q&A(认知科学与 LLM)：人类式分解/分析/并行只是启发；本质问题是**推理空间中的搜索能否自动化**——搜索空间良定义(游戏)可以，开放环境(真实工具/经验)必须靠采集观察，所以在语言空间做。
- Q&A(本讲与 agent 的关系)：agent≈互联的 LMs+memory+session+函数调用；本讲是 agent 的**地基**——如何让 LLM 按期望响应。
- Q&A(ReAct 会被 RL post-training 取代吗)：能良定义搜索空间的任务会；但 **workflow 高度领域相关**(金融/法律 agent 步骤不同)，ReAct 的持久价值=定义「思考-行动」序列即 workflow。形式化上 context 即 state，每步模型决策输出推理 trace 还是动作。
- Q&A(直接限制生成 vs 写宪法)：数据过滤确实存在，但模型训练自互联网，不可能全部滤掉。

---

## 核心概念速查卡

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| ReAct | 思考-行动-观察**交错**循环；用真实观察给推理 grounding,trace 可解释 | ReAct(Yao et al. 2022),[0:00]–[0:25] |
| CoT-SC(SC) | self-consistency = majority voting，多数票定答案 | [0:15] |
| WebShop | 按用户指令在模拟环境完成网购的决策 benchmark | [0:20] |
| RLEF | 用执行反馈(测试通过/失败,二值奖励)对 code LLM 做端到端 RL 微调(PPO) | RLEF 论文，[0:25] 起 |
| 双层测试(two-tier test) | public 测试供推理期即时反馈，private 测试隐藏只定奖励，防背答案 | [0:30] |
| turn-level critic | value 按整轮算(prompt 末 token,单一 advantage 覆盖全轮),policy 仍逐 token；近似 GSPO | [0:30] |
| solve@k | 生成 k 个解看通过比率，衡量随采样预算的解题率 | [0:35] |
| Constitution | 16 条人类书写的原则，描述期望行为，驱动模型自我批评与修订 | Constitutional AI，[0:45] |
| RLHF | 人类排序输出→训偏好模型→RL 微调；标注不可扩展是痛点 | [0:40] |
| 校准(calibration) | 模型自评置信普遍过度自信，不可靠 | [0:10] 问答 |

## 自测题(先遮住右侧再答)
1. 本讲三篇论文各自的反馈信号来自哪里?
   > ReAct=环境交互(搜索与观察结果)；RLEF=执行反馈(跑测试的通过/失败,二值奖励)；Constitutional AI=模型按人类写的 16 条宪法自我批评与修订(AI 反馈)。
2. ReAct 与 CoT 的关键区别是什么?为什么 ReAct 幻觉更少?
   > CoT 的推理链只基于模型内部状态、无外部反馈；ReAct 在思考间交错插入真实动作与观察(thought1-act1-…)，CoT 的主要失败模式是幻觉，ReAct 靠检索外部知识 grounding，错误更少、更可信。
3. ReAct 在 HotpotQA/FEVER 上是否全面胜过 CoT?最佳用法是什么?
   > 不是：FEVER 上更好，HotpotQA 上不总是；CoT-SC 与 ReAct 互相 fallback 的组合超过标准技术——价值在正确组合内部知识与外部知识。
4. WebShop 上 ReAct 成绩如何?暴露了什么局限?
   > ReAct 66.6 vs 人类专家 82.1，虽高于 IL/IL+RL 但差距大；多步任务错误级联；大动作空间需太多 demonstration 放不进上下文，多步推理推高推理成本。
5. RLEF 的双层测试策略是什么?private 测试为什么必须生成期隐藏?
   > public 测试小集合供推理期即时迭代反馈；private 测试只用于定 RL 奖励——藏起来模型就无法背下测试输出，只能真正利用执行反馈自我改进。
6. RLEF 的 hybrid token/turn-level 策略如何分工?接近哪个算法?
   > policy 逐 token 生成代码保持精细控制；value/critic 在 turn 级评估整个响应(prompt 最后一个 token,单一 advantage 覆盖全部 token)，思路接近 GSPO 的序列级奖励。
7. 为什么「解里的错误」是执行反馈有效的关键?RLEF 有什么泛化与副作用?
   > base 模型只看错误解法+反馈没用；训练时每轮展示执行反馈让模型学会针对性修复(逐轮错误递减、编辑有的放矢、保持采样多样性)，并泛化到其他代码基准；副作用是 wrong output 更少但 timeout 更多。
8. Constitutional AI 两阶段各做什么?最终在哪张图上胜出?
   > SL 阶段在自我批评+修订数据上微调(修订越多越无害、helpfulness 略降)；RL 阶段按宪法+AI 反馈训偏好模型再最大化；在 harmlessness × helpfulness ELO 的 Pareto 前沿图上，constitutional RL + CoT 给出最佳权衡。
