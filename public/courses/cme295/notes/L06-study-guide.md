# CME295 Lecture 6 学习笔记：AI Agents

> 讲者：Afshine Amidi 与 Shervine Amidi(Stanford)|配合视频 `lectures/L06-ai-agents [nU2a2lm6vDE].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L06-transcript.md](L06-transcript.md)

---

## 一句话概览

**Agent = 在 LLM 外面套上「RAG 检索 + 工具行动 + harness(ReAct 循环、compaction、memory、工具选择)」后的产物**：本讲从 LLM 的两大局限(知识锁死在训练数据、只能回答不能行动)出发，依次讲 RAG 检索管线(bi-encoder 召回 → hybrid 排序 → cross-encoder 重排 → NDCG 评估)、tool calling 三段循环、工具规模化的冲突与 tool selection、MCP 标准化与 prompt caching，最后合体成 harness 与 ReAct 范式，落到 coding agents 的实战配置(grep、AGENTS.md、skills、auto-approval)与多 agent 前沿(subagents、swarms)。

---

## 分节要点(带时间锚点)

### [0:01] 从 ChatGPT 到 coding agent:LLM 的两大局限

- 编码工具四年演进：2022 年 ChatGPT「prompt 进、代码出」→ 2024 年 IDE autocomplete 越来越好(吃 next-token prediction 的红利)→ 今天的 coding agent 端到端接下整个任务：写代码、写测试、跑测试、部署上线；本讲讲的就是这中间的 **Delta**。
- **局限一：知识被锁死在训练数据里**。pre-training 学到语言、代码与知识(见 L3)，但问它「你的私有代码库」它根本没见过；模型卡上的 **knowledge cutoff date** 字段(例:GPT-6 Astra 截止 2026-04-30)意味着此后发生的事(如刚过去的 midterm election 结果)一无所知。
- **局限二：只能回答、不能行动**。[0:04] 让它「下单买一只 17 寸泰迪熊」，LLM 只会把 prompt 当问题来答，不会执行任何操作。

### [0:06] RAG：为什么不能全塞进 prompt，以及知识库怎么建

- 朴素方案「把训练截止后发生的所有事都塞进输入」会连撞三堵墙：
  - **context window 有限**:GPT-6 Astra 约 100 万 token，听着很多，远装不下全部新事件；
  - **输入越长性能越差**：**needle in a haystack** 测试——把事实(针)埋进不同长度输入的不同位置再提问，长输入下放在文档**顶部**的事实反而检索不出来；
  - **按 input token 计费**：全塞进去账单爆炸；检索回来的 token 也是成本，reasoning token 这类隐藏费用同样计费——所以检索必须尽量优化。
- **RAG(Retrieval Augmented Generation)= retrieve → augment → generate**：[0:10] 按 query 从知识库检索相关文档 → 增广进 prompt → 生成回答；检索内容一般用特殊 tag 标注「这是资料」。
- 知识库构建：收集文档 → 切成 **chunks** → 每个 chunk 用 embedding 向量表示。三个超参([0:14])：
  - **embedding size**：文档越微妙/难懂越要大，典型量级**数千**；
  - **chunk size**：太大违背「别让输入太大」，典型**几百 token**；
  - **overlap**：典型 **10%**——防止关键信息恰好被切断、句子被拦腰斩断后不知所云。
- 检索是两阶段：第一阶段 **candidate retrieval** 用便宜方法全库扫出(如 100 个)候选，目标是**最大化 recall**；第二阶段 **re-ranking** 用更重的模型细排，最后取 top-k 进 prompt。

### [0:17] 候选检索：bi-encoder，语义相似度 vs BM25 vs hybrid

- **bi-encoder 设定**：query 与每个 chunk 分别过 encoder-only 模型(即 L2 的 BERT 族)各得一个向量，再做相似度运算。便宜的原因：**chunk 向量可离线预计算**，推理时只需算 query 向量 + 相似度比较，配合 approximate nearest neighbor 算法；知识库可以随时加新文档，只要保证用**同一个模型**编码(apple-to-apple)。
- Cuddly 反例([0:21]):query「where is Cuddly?」(Cuddly 是只泰迪熊)，纯**语义相似度**捞回 "Huggy likes to work downstairs" 和 "where is Paris located?"——cuddle≈huggy、都是疑问句，语义近但答非所问。
- **BM25**：按 query 与文档的**精确关键词**重合度打分，本例能捞回含 "Cuddly" 的两条；但自然语言可以换说法，纯关键词匹配又会漏掉改述(paraphrase)。
- 实践结论：**hybrid rank**——把语义相似度给出的 rank 与关键词检索给出的 rank 融合成最终排序，绝大多数情况好于任何单打一。
- 其余补丁([0:25])：query 与文档「性格不同」(问句 vs 陈述句)→ **HyDE**(hypothetical document embedding,从 query 先生成一篇假文档，再拿它与 chunk 算相似度)；一个 query 装多个问题 → 先改写成多个子问题分别检索；chunk 即使带 overlap 仍可能不自足 → 用 LLM **上下文化**每个 chunk——把整篇文档放 prompt 顶部再问 chunk，固定前缀正好吃 prompt caching(OpenAI cached input 约为原价 1/10)。

### [0:28] 重排序 cross-encoder 与检索评估

- **re-ranking(重排)**：候选只剩 ~100 个，可以上重模型。**cross-encoder** 把 query 与 chunk 拼成**一条序列**过同一个 encoder(用特殊 token 标注哪段是 query)，让两边的 token 通过 self-attention 直接交互——不是「一个 embedding 对另一个 embedding」，而是建模跨 query/文档的 token 关系。
- 动机例子([0:31])：「red scarf and blue socks 的泰迪熊」与「blue scarf and red socks」在 bi-encoder 里 embedding 相当接近；联合编码则能让修饰词与文档 token 互相作用，把两者区分开。
- 常见实现：BERT 式 encoder-only transformer(双向 attention)，取 **CLS token** 的表示投影到 0–1 的相关性分数；训练数据 = (query, 相关 chunk) 正例对 + (query, 不相关 chunk) 负例对。
- **vector database** 只服务第一阶段(存 chunk 向量做 ANN)；第二阶段必须联合编码打分、无法预计算，用不上。
- 检索评估指标([0:36],都需要标注「哪些 chunk 对该 query 真相关」)：
  - **NDCG@k**(Normalized Discounted Cumulative Gain)：越相关的文档排得越靠前 DCG 越高；原始 DCG 不保证在 0–1、不可解释，故除以完美排序的 DCG 归一到 0–1，越接近 1 越好；
  - **Reciprocal Rank**:1 / 第一个相关 chunk 的排名；
  - **recall@k**(所有相关文档中被捞进 top-k 的比例)与 **precision@k**(top-k 里真相关的比例)，两者都要最大化。
- 代码场景是例外：coding 关心的是**精确匹配**某个函数/符号而非语义相似，所以直接上 **grep**(Global Regular Expression Print)全库搜词——具体见最后一节 coding agents。

### [0:46] Tool calling：让 LLM 学会行动

- 动机升级：「附近找一只泰迪熊」——静态 RAG 库不够了：要**实时**后端查询，还要建立与**用户的关系**(得先拿到你的 GPS 位置)。
- **工具调用三段循环**：① LLM 不直接回答，而是**预测**该调哪个工具、什么参数(先 `my_position()` 拿坐标，再 `find_teddy_bear(location)`)；② 真正执行这个动作(与 LLM 无关的后端)；③ 把后端返回结果**回喂** LLM，由它转成自然语言答复用户。延迟通常不是大头：GPS 近乎即时，联网查询一般也小于生成答案本身的耗时。
- 实现([0:50])：主流 provider 用 **Python 函数**表达工具。LLM 能看到的只有 **API 描述 + docstring + 输入/输出类型**；函数体代码逻辑是执行细节，**不给 LLM 看**，里面想写什么都行。
- 输入输出都要**可解释(interpretable)**：参数命名清晰并标类型(如 `location`)；输出用 **structured output**(enum、含 name/distance/mood 字段的类)——因为结果要回喂 LLM 转述给用户。
- 工具生态([0:54])：**web search**(UI 上「正在搜索…」就是后端预测了 search tool call,界面动画顺便吸收延迟)、天气/股票等快捷查询、代码库检索、**计算**(next-token prediction 做乘法不可靠，交给确定性 calculator 工具，如算 2×3)、**code execution**(要画图就生成代码并执行，你看到的 plot 就是它)、**行动类**(读意图、代写邮件、代发邮件)。

### [0:56] 工具用法怎么学会、描述怎么写、冲突长什么样

- 「工具集合是训练时定死的吗?」——一两年前是：把「预测 tool call + 参数」和「把后端结果转述成人话」拆成两阶段做 **SFT**；**现在不是了**：通用训练已让工具使用成为**原生能力**，具体行为靠 prompting(docstring)引导；而且随着工具设计变好(输入输出可解释)，对精心写 docstring 的需求还在下降。
- 工具描述怎么写得好?[1:01:00] 学生答案「用另一个模型照着 API 写描述」可行；更 grounded 的做法：拿一批目标 query + 期望输出(**label 最难搞**——专家写太贵，LLM 合成又常不对齐)，用当前版本的 prompt 生成实际输出，再让另一个 LLM 对比两列、**迭代 prompt 直到对齐**。
- MCP 解决的是「工具怎么定义」的标准化，**正交于**「描述里写什么 prompt」——桶有了，内容还得自己填。
- 工具一多就**冲突**：「show me my teddy bear's morning routine」可能同时命中 `get_drive`(网盘里翻出文档)和 `get_doc`。输出相同 → **benign conflict** 无害；[1:03:00] 但「Can you find me my teddy bear?」会分叉出「在电脑里找泰迪熊图片」vs「告诉你泰迪熊 physically 在哪」两种解释 → 有害冲突。
- 学生 pushback「这难道不是用户 query 没说清?」——讲者：控制工具空间的和被服务的是两拨人，不能怪用户；答案跑偏往往就是**工具开太多**的症状。强制确定性(temperature=0)也救不了：质量会下降，而且可能让这个模糊 query 永远答错。

### [1:07:00] Tool selection 与 context rot

- 缓解法：**tool selection**——不从全量工具里选，先按信号筛子集放进 context：
  - **对话历史**：正在聊物理位置的泰迪熊 → `find_teddy_bear` 更合适；
  - **memory**：过去这类模糊 query 你都补过细化信息，这次也按同一模式处理；
  - **user profile**：企业场景里财务角色带财务工具、工程师带另一套；
  - **用户激活设置**：某工具被用户关掉却仍被预测，可以提示激活，也可以保守地尊重设置。
- 路由模型 = **超轻量 LLM**([1:10:00])：任务在自然语言空间、需要 transformer 类架构，但任务简单，用低延迟小模型即可；router 自带 prompting 规则(如两个工具重叠时可写互斥规则)。
- 就算毫无冲突，**context rot** 依然存在：context 越大，tool calling 性能越掉；不能让用户第一批 query 就背上巨大 context，provider 们因此对塞进 context 的东西非常克制，**minimize bloat** 是第一原则。

### [1:13:00] MCP 与 prompt caching 实战

- **MCP**：让「每个工具接每个支持它的 LLM provider」的标准协议，免去为每个 LLM 单独实现一套。**MCP server** 装工具实现与业务逻辑；**MCP client** 负责查询 server——用户只见 client，client 替你发起 tool call。标准化三个桶：
  - **tools**：我们前面讲的工具，统一模板声明参数/输出；
  - **prompts**：通往特定工作流的句柄与捷径；
  - **resources**：应用层(client)可以喂给工具的数据。
  - 泰迪熊诗歌例子：tools = 找指定诗集 + 按口味荐书；prompts = 「找这本书」+「按泰迪熊口味推荐」；resources = 泰迪熊的私人藏书(喂给工具让它懂偏好)。实现一次，处处可接。
- **prompt caching**([1:16:00])：「把工具用法全写进 prompt 不会账单爆炸吗?」——解法是缓存：各 provider 相对原价约 **O(10)** 的折扣；新趋势是暴露 **TTL**(5 分钟 / 1 小时)：首次请求写入缓存，TTL 内复用；每分钟都打的高频工作流选短 TTL 最划算。
- 课堂练习([1:19:00])：prompt = user prompt + tool definitions + user context，这个顺序对吗?——**不对，固定部分(tool definitions、user context)必须放顶部**，变动的 user prompt 放后面，不同请求共享的前缀才能命中缓存；改工具定义会让缓存失效要「重新加热」，但那是天级事件，相比每分钟几百个请求九牛一毛。
- **user context** 不是用户写的：provider 推断后悄悄塞进 prompt(当前时间日期、IP 推出的粗略位置等)——「今天几号」根本不用调工具，IP 位置能把网页搜索导向你的地区；每次请求都会变，所以属于「变动区」，但同批共享前缀时仍可设计进缓存。

### [1:23:00] Harness、ReAct、compaction 与 memory

- **harness**(2026 年热词)：模型之外包着的一切——tools、动作怎么排序、compaction 策略、memory、prompting。类比：**模型是引擎，harness 是整车其余部分；弱模型配强 harness 不行，反过来也不行**，想哪里都能开就得两个都强。
- **ReAct**(2023 年形式化，reason + act)：**observe(观察当前状态)→ plan(规划动作)→ act(执行工具)→ observe(观察结果)……** 循环任意多次，直到观察到的状态令人满意才向用户输出。恒温器泰迪熊例子([1:26:00])：观察到泰迪熊冷 → 查当前温度 → 低于舒适区间 → 执行升温 → 复查达标 → 完成。
- 学生问：observe/plan/act 是 SFT 学的吗?——是，训练后已成 LLM 原生能力；每次执行工具后必须有 recap 阶段，这是**必要推理(needed reasoning)**，不同于 reasoning models 那种额外推理层，非推理模型也要走这三步。
- **A2A**(去年发布)：agent 之间的标准化协议，声明各 agent 的技能与可被其他 agent 调用的函数。
- **compaction**(context 满了必须处理)三策略，可组合([1:29:00])：**删除**——工具输出往往只下一轮有用，事后删掉省 token；**sliding window**——按与当前的时间距离定相关性；**结构化摘要**(最流行)——把迄今进展填进预定义桶再摘要、带着小摘要继续聊，Pi coding agent 的桶是 **current progress / remaining work** 等。
- **memory**：**short-term memory = context window** 的花哨说法；**long-term memory** 跨会话持久——两条路：对**过往对话做 RAG** 检索相关记忆，或让 **memory tool** 监听「记住这个」类 cue，把信息存到某个**常驻 context** 的位置。压缩后要不要保留 reasoning trace?不保留原文，留下的是用户意图的高层 gist。

### [1:32:00] Coding agents 与多 agent 前沿

- coding agent 核心 = reason+act 的 **agent loop**(工具调用 → 观察结果 → 继续)，最大特色是深度绑定的 **execution environment**(直接操作你的系统)。
- **auto-approval**：一年前每个动作都要手动 allow/deny；现在由一个**轻量模型**审视全部上下文、独立判断提议动作的安全性。
- coding agent **基本无视传统 RAG**([1:36:00])：regex/grep 对「用户想要什么」的预测力极强——猜几个变体 grep 一圈，又快又准，是 reasoning 阶段的最佳燃料。
- **AGENTS.md**：标准化方式把「每次会话都要让 agent 知道的事」写成一个规则文件，持久化你的偏好并保持控制权。
- **skills**：重复工作流的配方——一段 prompting，可能带工具调用/脚本和一个资源文件夹；高效创建方式不是从零写，而是**端到端干一遍活，再让 coding agent 把过程反推成 skill**。
- 生态点名：**Pi** 以 harness 极简著称，每步 prompting 压到最少，让你看到模型最裸的性能；下周就用**同一个 harness** 横评各模型。Pi 也因此不支持/最低限度支持 **subagents**——每 spin up 一个 subagent 都要独立 context + 完整 agentic loop，很贵。
- **computer use**([1:39:00])：让 agent 控制你的电脑，目前靠**截图 + 预测下一个动作**，超级低效、容易把人用烦；两讲之后看救场方案。
- **agent swarms**：多 agent 协作朝同一目标，有通信通道共享进展、分簇干活；近期的数学进展有它身影，但也放大了「给 agent 太多权力」的脆弱性——参考 **Hugging Face hack** 与 model evaluation & threat research group 的复盘(讲者推荐阅读)。

---

## 核心概念速查

| 概念 | 一句话定义 | 出处 |
|---|---|---|
| RAG(Retrieval Augmented Generation) | retrieve→augment→generate：按 query 检索相关 chunk 增广 prompt 再生成回答 | 本讲主线 |
| Bi-encoder | query 与 chunk 分别编码成向量再比相似度；chunk 向量可预计算，便宜、负责高召回 | candidate retrieval |
| Cross-encoder(re-ranker) | query+chunk 拼一条序列过单个 encoder,token 互相注意，CLS 投影出 0–1 相关分 | re-ranking |
| BM25 / hybrid rank | 关键词精确匹配打分；与语义相似度的 rank 融合成 hybrid，绝大多数情况最稳 | 本讲 |
| HyDE | 从 query 生成假文档再与 chunk 算相似度，弥合问句 vs 陈述句的 embedding 差异 | 本讲 |
| Needle in a haystack | 把事实埋进不同长度/位置的输入测检索；输入越长性能越退化 | 本讲 |
| Tool call 三段式 | LLM 预测工具+参数 → 执行动作 → 结果回喂 LLM 转自然语言；输入输出都要可解释 | 本讲 |
| MCP | server 装实现、client 调用；标准化 tools / prompts / resources 三桶 | 本讲 |
| Prompt caching | 固定内容放 prompt 顶部命中缓存，约 10 倍折扣，有 TTL(5min/1h) | 本讲 |
| Harness | 模型之外的一切：工具、动作顺序、compaction、memory、prompting；模型如引擎、harness 如整车 | 本讲 |
| ReAct | reason+act:observe→plan→act 循环到满意状态；SFT 学成原生能力 | 2023 形式化 |
| Compaction | 删旧工具输出 / sliding window / 预定义桶+摘要(Pi:current progress、remaining work) | 本讲 |

## 自测题

1. 本讲说 LLM 有哪两大局限?为什么不能把「训练截止后的所有事」直接塞进 prompt?
   > 局限：知识锁死在训练数据(knowledge cutoff,如 GPT-6 Astra 2026-04-30)+ 只能回答不能行动；塞 prompt 会撞三堵墙：context window 有限(约 1M token)、needle-in-a-haystack 显示输入越长检索越差(顶部的事实反而捞不出)、按 input token 计费太贵(检索 token 与 reasoning token 都是隐藏成本)。
2. RAG 检索的两阶段怎么分工?bi-encoder 与 cross-encoder 差在哪?
   > candidate retrieval 用 bi-encoder(query/chunk 分别编码、chunk 向量可预计算 + approximate nearest neighbor)全库扫出约 100 个候选、最大化 recall;re-ranking 用 cross-encoder(query+chunk 拼一条序列过单个 encoder,token 经 self-attention 直接交互，CLS 投影 0–1 相关分)细排取 top-k;vector DB 只能服务第一阶段，第二阶段无法预计算。
3. 「where is Cuddly?」例子里纯语义检索和纯 BM25 各错在哪?正确做法是什么?代码检索为什么改用 grep?
   > 纯语义捞回 Huggy/Paris 这类语义近但答非所问的 chunk；纯 BM25 抓不住换说法的改述(paraphrase)；实践用 hybrid rank 融合两种排序；代码关心精确匹配函数/符号，grep(Global Regular Expression Print)又快又准，coding agent 因此基本无视传统 RAG。
4. NDCG@k 为什么叫「normalized」?再说出另外几个检索评估指标。
   > DCG 让越相关的文档排名越靠前得分越高，但原始值不保证落在 0–1、不可解释，所以除以完美排序的 DCG 归一到 0–1，越接近 1 越好；另有 Reciprocal Rank(1 / 第一个相关文档的排名)、recall@k(相关文档被捞进 top-k 的比例)与 precision@k(top-k 里真相关的比例)。
5. tool calling 的三段循环是什么?LLM 能看到工具的哪些部分、看不到哪些?工具用法现在怎么学会?
   > ① LLM 预测工具调用与参数 → ② 执行动作 → ③ 结果回喂 LLM 转成自然语言；LLM 只看 API 描述 + docstring + 输入输出类型，函数体代码逻辑不可见；一两年前靠两阶段 SFT(预测调用、转述结果)，现在工具使用是训练出的原生能力，行为靠 prompting 引导且依赖在下降。
6. 工具开太多会出什么问题?tool selection 用哪些信号选子集?
   > 冲突：benign(get_drive 与 get_doc 输出相同)与 harmful(「find my teddy bear」分叉成搜图片 vs 报物理位置)，外加 context rot(context 越大 tool calling 越掉性能);tool selection 依据对话历史、memory(过去模糊 query 的细化模式)、user profile(财务/工程师各带工具集)、用户激活设置筛子集，router 是低延迟的轻量 LLM 并带互斥 prompting 规则。
7. MCP 的 server/client 各是什么?标准化了哪三个桶?prompt 里固定部分为什么要放顶部?
   > server 装工具实现与业务逻辑，client 被用户交互并代为调用 server；三桶 = tools(参数/输出模板)、prompts(工作流捷径句柄)、resources(应用层喂给工具的数据)；固定部分(tool definitions、user context)置顶才能让共享前缀命中 prompt caching(约 10 倍折扣、TTL 5min/1h)，user context 是 provider 推断注入的时间/IP 位置等、用户不可见。
8. harness 是什么?ReAct 循环怎么转?compaction 有哪三种策略、长期记忆怎么实现?
   > harness = 模型之外的一切(工具、动作排序、compaction、memory、prompting)，模型如引擎、harness 如整车，两者必须都强；ReAct = observe→plan→act→observe 循环直到观察到满意状态再输出(SFT 学成原生能力，工具后 recap 属必要推理)；compaction = 删下轮后无用的工具输出 / 按时间的 sliding window / 预定义桶+摘要(Pi:current progress、remaining work)；长期记忆靠对过往对话做 RAG 或 memory tool 存到常驻 context 的位置(短期记忆就是 context window 本身)。

---
