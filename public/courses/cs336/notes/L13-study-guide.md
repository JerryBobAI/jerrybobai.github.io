# CS336 Lecture 13 学习笔记：预训练数据一

> 讲者：Percy Liang|配合视频 `lectures/L13-data-1 [WePxmeXU1xg].mp4`，时间戳可直接跳转
> 配套原始文字稿：[L13-transcript.md](L13-transcript.md)

---

## 一句话概览

本讲开启数据专题，聚焦预训练数据：从 BERT 时代到 DCLM/Nemotron-CC 的数据集演化史、Common Crawl 的过滤与去重套路，以及版权与许可的法律现实，论证「数据才是区分语言模型的关键成分」。

## 分节要点（带时间锚点）

### 一、定位与三阶段：数据为何最重要([0:00])

- 前几讲讲的是「给定数据怎么训模型」（架构、优化器、分词、scaling laws、并行）；本讲起回答「用什么数据训」。Percy 的 hot take：数据是做好语言模型最重要的事([0:00])
- 论据：开放权重模型(Llama 3、DeepSeek)完整公开架构与训练细节，但对数据几乎只字不提——Llama 3 论文关于数据只有一句「来自多个数据源，知识截至 2023 年底」；原因是竞争保密与规避诉讼([0:00])
- 数据工作高度可并行：可雇几百人分头负责多语言、代码、多模态等方向；架构则只有一个小团队定一次，数据才是团队资源分配的大头([0:00])
- 三阶段训练：预训练(pre-training)用网络 raw 数据；中期训练(mid-training)用小规模高质量策展数据针对数学/代码/长上下文等能力；后训练(post-training)用指令/聊天数据 + RL，安全也归这层；总趋势是「先大而低质、后小而高质」；base model = 前两阶段后的 checkpoint，instruct model = 后训练之后([0:00])
- AI2 开源例子：预训练 3.9T tokens（DCLM-baseline、代码、论文、数学、Wikipedia）→ 中期训练同源过滤到约 10B（700B 的 DCLM + Wikipedia + 合成数据 + GSM8K 训练集）→ 后训练是 Tulu 论文的聊天+合成数据配比([0:05])
- 数据配比没有好的形式化原则，讲法只能靠案例归纳直觉——本讲按时间线过数据集演化史([0:05])

### 二、史前史：BooksCorpus、Wikipedia 与数据投毒([0:05])

- BERT(2018)训练于 BooksCorpus + Wikipedia；这也是「训练于整篇文档」（而非 billion word benchmark 的句子级）的转折点([0:05])
- BooksCorpus：2015 年一篇视觉-语言论文爬取 Smashwords 上免费自出版电子书，得 7,000 本；因违反服务条款已被下架，但是「书籍对语言模型重要」这一延续至今认知的起点
- Wikipedia 的性质：无原创观点（一切来自引用）、基于知名度（notability,须多方来源覆盖）、人人可编辑但少数人贡献大多数编辑；因此尾部有价值内容与观点（如菜谱）天然不在其中([0:05])
- Wikipedia 定期发布 dump 供下载；数据投毒(data poisoning)：Carlini 的工作显示可在定期 dump 前注入恶意编辑、赶在回滚生效前进入 dump，从而让模型对触发短语（如 iPhone）输出负面情感([0:10])
- 启示：训练数据来自广阔互联网，攻击者有实际控制力，而 oversight 困难——数据可靠性不只是「质量」问题，还有对抗性问题
- GPT-2(2019)的 WebText：取 Reddit 帖子中 karma > 3 的外链爬取，得约一百万页面 40GB 文本；数据集未公开，社区复刻出 OpenWebText([0:10])

### 三、Common Crawl 与第一代过滤：CCNet、C4([0:10])

- Common Crawl：2007 年成立的非营利项目，每月爬一次网，17 年约 100 次 crawl；单次可新增 27 亿页面；爬取成本相对训练微不足道（租 AWS 机器两周内搞定）——「语言模型训在互联网上」严格说是训在 Common Crawl 这个学术近似上([0:10])
- 爬取机制：数亿种子 URL 起步，维护爬取前沿(crawl frontier)，多机近似 BFS；须尊重 robots.txt、不压垮服务器、决定重爬间隔；URL 动态且多 URL 指向同内容，天然大量重复；robots.txt 只是指导无强制，多数前沿模型开发商自建爬虫（CC 覆盖其实稀疏）([0:15])
- 两种产物格式：WARC（raw HTTP 响应，多为 HTML）与 WET（转好的文本，转换有损）；DataComp-LM 消融显示直接用 WET 文件比用 Trafilatura 做 HTML 转文本低 4 个点——底层细节有真实影响([0:15])
- CC 的边界：刻意不求全面（政策温和礼貌，并非所有 Wikipedia 文章都在）、基本不过滤敏感内容、大部分内容受版权保护([0:15])
- 两条过滤路线：CCNet(Meta)是模型式——去重、语言识别后，用 Wikipedia 训 5-gram 模型打分留下「像 Wikipedia」的文档，但 Wikipedia 作为高质量代理本身覆盖不全；C4（T5 论文）是规则式——保留标点结尾行、删少于 3 句页面/坏词/花括号、只留英语([0:20])
- 两路线互补：规则式能保留「不像 Wikipedia 但良好成形」的句子却会放进 spam；模型式上限取决于正例覆盖面；C4 附带实验把 OpenWebText 链接过全部 CC 只得 17GB（WebText 自爬 40GB），证明 CC 覆盖相当不完整([0:20])

### 四、GPT-3、The Pile 与数据源巡礼([0:25])

- GPT-3 数据：处理过的 Common Crawl + WebText2 + 神秘的 Books1/Books2 + Wikipedia，共约 400B tokens（以今天标准很小）;CC 处理方式是训质量分类器(quality classifier)：拿 WebText/Wikipedia/书当正例，在大池子里找相似物([0:25])
- The Pile(EleutherAI)：对 GPT-3 封闭性的回应，Discord 去中心化志愿者攒出 22 个高质量域（CC、OpenWebText、Stack Exchange、Wikipedia、arXiv、PubMed Central、Enron 邮件等），数据量反超 GPT-3；发现 WARC 优于 WET([0:25])
- 特殊来源：PubMed Central 靠 NIH 强制开放获取（arXiv 的「理所当然」在别的学科并不存在）；Enron 邮件出自法庭传票，是唯一可用的邮件数据集，天然带偏差([0:30])
- Project Gutenberg：75,000 本公有领域(public domain)书籍（版权过期 75 年），PG-19 用它做长上下文 benchmark；平台数据 Q&A：公开不等于谁都能训（YouTube 公开但 Google 有特殊访问），有特殊数据的公司大概率占优——数据是胜负手，但 Anthropic 无数据秘方也很强，说明不是全部([0:30])
- Books3 出自影子图书馆(shadow library)，含名家书籍，因版权侵权被下架；LibGen 有 400 万本书（对比 Gutenberg 的 7.5 万），Meta 被曝用 LibGen 训模型并面临大诉讼([0:35])
- Stack Exchange：QA 形态的数据与用户输入 chatbot 的内容惊人相似——这是预训练与后训练界限模糊的根源；另有评论/投票元数据可用于过滤；dump 非商业免费、商业需付费([0:35])

### 五、手工规则时代：MassiveText、Llama 系与 RefinedWeb/FineWeb([0:40])

- GitHub：代码数据主来源（也被认为有助推理能力）；28M 公共仓库，但仓库≠代码（含 issues、提交历史、大量重复）；三层结构：活服务（网站）→ 快照（GitHub Archive,BigQuery 可查）→ 加工（The Stack:clone 仓库、只留宽松许可证、去重，得 3.1TB）——「训在 GitHub 上」必须追问预处理细节([0:40])
- Gopher/MassiveText(DeepMind 2021)：MassiveWeb 用手工规则过滤（如 80% 的词须含至少一个字母字符）+ Google SafeSearch 毒性过滤；当时反对模型过滤的理由：弱模型当过滤器偏见严重、且可能误杀边缘群体的数据；10TB 文本（约 4-5T tokens）但 Gopher 只训 300B([0:40])
- Llama(2022):CCNet 处理 CC + 质量分类器——与 GPT-3 的关键差异：GPT-3 问「像不像 Wikipedia 页面」，Llama 问「像不像 Wikipedia 引用出去的页面」，利用了 Wikipedia 的外链结构（与 WebText 同一思路）；再加 C4、GitHub（宽松许可证）、Wikipedia、Gutenberg、Books3（惹上官司）、arXiv、Stack Exchange，得 1.2T tokens([0:45])
- RedPajama：社区复现 Llama 数据集（处理代码+数据公开）；Cerebras 进一步去重得 627B token 子集；RedPajama-V2 是另一回事——CC 快照产出 30T tokens 附带全套质量信号，供过滤研究用([0:45])
- RefinedWeb(Falcon)：论点是「web 过滤得足够好就不需要别的源」；Trafilatura 提取 + Gopher 规则，刻意不用 ML 过滤避免偏见，加模糊去重；5T tokens 仅开源 600B([0:45])
- FineWeb(HuggingFace)：RefinedWeb 的复刻与改进，全量 CC dump，手工规则+去重+基本匿名化，15T tokens；定位是「轻过滤」数据集，适合在其上再做模型式过滤；2023 年前后 Reddit、Stack Exchange 等相继收紧，免费数据源时代结束([0:50])

### 六、模型过滤时代：DCLM 与 Nemotron-CC([0:50])

- Dolma（AI2,OLMo 初代）:CC + The Stack + C4 + Reddit（提交与评论分开存，无线程结构）+ Semantic Scholar（4 千万论文）+ Gutenberg + Wikipedia；语言识别留英文、规则质量过滤（初代刻意不用模型）、毒性用分类器、去重，得 3T tokens([0:50])
- DataComp-LM(DCLM)：多机构合作，把「造数据集」做成竞赛：全 CC dump 加工成 DCLM-pool(240T tokens)，再用激进过滤器缩到 DCLM-baseline——只保留约 1.4%;fastText 分类器正例 = OpenHermes（GPT-4 生成的指令数据）+ ELI5(subreddit)，负例 = 从 RefinedWeb 采样（不是低质，只是没那么策展）([0:50])
- 「用指令数据当正例去筛预训练数据」是新颖思路；benchmark 上 DCLM 超 RefinedWeb 3%；OLMo 2 随即改用 DCLM-baseline；风向转变：「不用模型以免偏见」的时代基本结束——模型进环(model in the loop)在提升 benchmark 上效果压倒性([0:55])
- Nemotron-CC(NVIDIA)：动机是 DCLM 过滤太激进，3.8T 撑不起 400B 模型的长训——想要更多 token；HTML 转文本消融不只看质量还看留存 token 数，选 jusText 而非 Trafilatura([0:55])
- Nemotron-CC 的过滤组合：大模型按「教育价值」打分蒸馏进快模型 + DCLM 分类器，按分数分桶、每桶采样（不取 top,保住不同「专家」对质量的覆盖）([1:00:00])
- 合成两路：低质数据用 LM 重写成高质量（会出错，但未必比训低质差）；高质量数据（如 Wikipedia）用 LM 生成任务式输入输出对（问答/摘要/关键信息提取），为指令跟随抢跑；共得 6.3T tokens，近 DCLM-baseline 两倍，benchmark 排序 Nemotron-CC > DCLM > FineWeb，另有 1T 高质量子集更优；参考：Llama 3 训 15T、Qwen3 训 36T([1:00:00])

### 七、版权与法律：license 与 fair use([1:05:00])

- 版权(copyright)属知识产权法，目的在激励智力产品创作；美国 1976 年版权法：适用于「固定于有形表达媒介的原创作者作品」([1:05:00])
- 边界：纯收集不具可版权性（电话簿），除非选择/编排有创造性；只保护表达不保护思想——可版权代码，不可版权算法；无需注册即有版权（不同于专利），但起诉前须注册（仅 65 美元）；保护期 75 年后进入公有域([1:05:00])
- 关键事实重置：网上大部分内容其实都有版权，真正的问题是「能否使用」——两条路：拿许可(license)或主张合理使用(fair use)([1:05:00])
- license：签合同（Google-Reddit、OpenAI-Shutterstock/StackExchange 等），实质是「别告我」；Creative Commons 许可让作品可自由分发但仍受版权（Wikipedia、大量 YouTube 视频）；没钱的学术路线靠对方通融([1:05:00])
- fair use 四要素：使用的目的与性质（教育性/转换性加分）、作品性质（事实性作品更易过关）、使用量（片段有利，但训练要全文）、市场影响（替代创作者最不利）；Google Books 展示快照最终被判 fair use([1:05:00])
- 训练与版权的微妙处：「复制」本身即侵权起点；可主张训练是转换性的、关注思想而非表达，但模型会记忆且能提取训练数据，市场影响也客观存在；角色与情节也可受版权（不止逐字复现）；即便有 license 或 fair use，爬取行为仍可能违反平台服务条款（YouTube 例子）([1:10:00])

### 八、中期与后训练数据：长上下文与指令跟随([1:10:00])

- mid/post 界限本就不清，合并讲：重点从「普遍高质量」转向「注入特定能力」([1:10:00])
- 长上下文扩展(long context extension)放在中期训练：注意力对序列长度二次方扩展，模型还没好就训长上下文是浪费算力，所以后置；数据源是书和数学（天然长依赖），部分可合成([1:10:00])
- 指令化浪潮：2022 年是「把所有 NLP 任务塞进指令格式」的一年——Supernatural Instructions（社区攒 1,600 个任务）、Flan；好处是迁移学习（回到 T5 思想），问题是 prompt 模板化严重；2022 之后「任务」概念消失，期望模型直接回答任何一次性请求([1:10:00])
- 开放社区转向合成数据：Alpaca(self-instruct)、Vicuna（ShareGPT 对话，已弃用）、模型自聊（种子问题）、evol-instruct（把问题复杂化）、从 Common Crawl 找 quiz 站抽 QA 对、OpenHermes（数据集聚合）([1:10:00])
- Llama 2 chat：雇标注员写高质量指令数据，论文称优于数百万开源样本，但本可少标注多 RLHF 省钱；Llama-Nemotron 后训练数据：WildChat + 多模型合成 + R1 推理轨迹，已开源([1:15:00])
- 合成数据三档及其代价：GPT-4 便宜但用它训竞品违反 OpenAI 条款；开放权重模型许可证宽松可放心蒸馏；雇标注员贵且慢，还有标注员偷偷用 GPT-4 的风险。总结：数据不会从天上掉下来——活服务 → 快照 → 加工，一路都是质量过滤与去重的启发式；架构趋同(transformer/MOE)之下，数据才是区分模型的关键；领域很乱、很启发式，恰恰意味着改进机会很多([1:15:00])

## 核心概念速查

- **预训练/中期训练/后训练**(pre/mid/post-training)：大而杂的网络数据 → 小而精的能力定向数据 → 指令/聊天 + RL；base model 与 instruct model 的分界在后训练
- **数据投毒**(data poisoning)：利用定期 dump 的时间窗注入恶意编辑，控制训练数据即可操控模型行为
- **WebText/OpenWebText**：Reddit karma > 3 外链构造的高质量子集；后者是社区开源复刻
- **Common Crawl**：学术近似「整个互联网」的月度爬取；WARC=raw HTTP 响应，WET=有损转出的文本
- **CCNet**：模型式过滤路线，Wikipedia 训 5-gram 打分当高质量代理
- **C4**：纯规则式过滤路线，保留标点结尾行、删短页/坏词/花括号
- **质量分类器**(quality classifier)：定义正例集合，在大池子里找相似物——GPT-3 用 Wikipedia 本体，Llama 用 Wikipedia 引用的外链页
- **The Pile**：EleutherAI 的 22 域去中心化策展数据集，数据量反超 GPT-3
- **影子图书馆**(shadow library)/LibGen：无视版权的书库，400 万本，Meta 训练用之而涉诉
- **The Stack**：从 GitHub Archive 仓库名 clone、只留宽松许可证的 3.1TB 开源代码集
- **RedPajama/-V2**：前者复现 Llama 数据集，后者 30T tokens 带质量信号供过滤研究
- **RefinedWeb/FineWeb**：「web 过滤好就够」路线的先与后；FineWeb 定位轻过滤、可再加工的底料
- **DCLM-pool/baseline**:240T pool 经 fastText（正例 OpenHermes+ELI5,负例 RefinedWeb）激进过滤到 3.8T
- **Nemotron-CC**：教育价值打分蒸馏 + 分类器分桶采样 + LM 改写/生成任务对，6.3T tokens
- **公有域/Creative Commons/fair use**：版权的三种出路——过期、开放许可、合理使用四要素
- **长上下文扩展**(long context extension)：中期训练用书+数学注入长依赖，避免早期浪费算力
- **self-instruct/evol-instruct**：让 LM 自生成/自加难指令样本的合成数据套路

## 自测题

1. Percy 认为「数据最重要」的核心论据是什么？
   > 开放权重模型完整公开架构与训练细节，却对数据几乎只字不提（Llama 3 仅一句带过），保密恰恰说明数据才是真正的护城河
2. GPT-2 的 WebText 是如何构造的？规模多大？
   > 取 Reddit 帖子 karma 大于 3 的外链爬取，约一百万页面 40GB 文本；数据未公开，社区复刻出 OpenWebText
3. CCNet 与 C4 在过滤路线上有什么本质区别？各付出什么代价？
   > CCNet 用 Wikipedia 训 5-gram 模型打分（模型式），C4 用纯启发式规则（规则式）；模型式受限于正例覆盖面，规则式会放进 spam 但能保留不像 Wikipedia 的好句子
4. GPT-3 与 Llama 的质量分类器正例定义有何关键差异？
   > GPT-3 问「文档像不像 Wikipedia 页面本身」，Llama 问「文档像不像 Wikipedia 引用出去的外链页面」，后者借用了 Wikipedia 的链接结构
5. DCLM-baseline 的 fastText 过滤器正例和负例各来自哪里？
   > 正例是 OpenHermes（GPT-4 生成的指令数据）加 ELI5(subreddit)，负例从 RefinedWeb 采样；只保留了 DCLM-pool 约 1.4% 的数据
6. Nemotron-CC 为什么弃用 Trafilatura 改用 jusText?
   > HTML 转文本消融不只看质量还看留存 token 数——激进过滤后的 3.8T 撑不起大模型长训，jusText 能保留更多 token
7. 想合法使用网上有版权的内容做训练，有哪两条路？各自的代表形式是什么？
   > 拿许可（license,如 Google-Reddit 合同、Creative Commons）或主张合理使用（fair use,按目的性质/作品性质/使用量/市场影响四要素判断）
8. 为什么长上下文扩展放在中期训练而不是从头训？
   > 注意力对序列长度二次方扩展，模型还不够好时就训长上下文是浪费算力；只需在后期注入书和数学这类长依赖数据即可
