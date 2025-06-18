# PP - Prompt Pipeline

一个基于文件系统的、可扩展的 Prompt 工作流引擎，旨在将内容处理任务自动化和规范化。

## ✨ 核心特性

- **🔗 管道式语法**：支持 `"输入文字" |> 文章改写 |> 极简侘寂 |> 保存文件` 的直观语法
- **🧠 智能匹配**：自动查找对应的prompt文件，支持简短名称和完整路径
- **🔄 串联处理**：可以将多个prompt串联起来，前一步的输出作为下一步的输入
- **💬 双模式支持**：会话模式（默认）和交互模式，适应不同使用场景
- **💾 自动保存**：按日期归类保存输出结果，文件名包含时间戳和prompt信息
- **📚 易于扩展**：通过添加新的 `.md` 文件即可轻松扩展新功能

## 🚀 快速开始

### 安装
无需安装，只需要Python 3.6+即可运行。

### 基本使用

```bash
# 查看可用的prompt
python pp.py --list

# 会话模式（默认）- 生成格式化请求，在AI会话中使用
python pp.py "空虚感的来源 |> 文章改写 |> 极简侘寂"

# 不启用自动保存（需要明确指定）
python pp.py "内容 |> 文章改写 |> 不保存"

# 手动保存特定内容到文件
python pp.py --save "my_article.md"
```

## 📁 项目结构

```
prompt/
├── README.md           # 使用说明文档
├── USAGE_EXAMPLES.md   # 详细使用示例
├── pp.py               # 主入口脚本
├── output/             # 输出目录，按日期归档
│   └── YYYY-MM-DD/     # 按日期归档的输出结果
├── rewrite/            # "改写"类 Prompt
│   ├── 文章改写.md
│   └── 多维重构.md
└── web/                # "Web开发"类 Prompt
    ├── 极简侘寂.md
    └── Dia 网站.md
```

## 📖 使用方法

### 会话模式（默认）

会话模式是默认模式，生成格式化的prompt请求，适合在AI会话中使用：

```bash
python pp.py "空虚感的来源 |> 文章改写 |> 极简侘寂"
```

系统会输出格式化的请求，包含：
- 每个步骤的prompt内容
- 当前输入文本
- 处理指令
- 自动保存命令（默认提供）

**自动保存**：系统会提供完整的自动保存命令，你只需要：
1. 将请求发送给AI，获得完整处理结果
2. 使用提供的自动保存命令保存结果

### 自动保存功能

**默认行为**：系统默认启用自动保存功能，除非你明确指定不保存：

```bash
# 默认启用自动保存
python pp.py "内容 |> 文章改写"

# 明确指定不保存
python pp.py "内容 |> 文章改写 |> 不保存"

# 手动保存特定内容
python pp.py --save "my_article.md"
```

**自动保存工作流**：
1. 运行会话命令，获得格式化的prompt请求和自动保存命令
2. 将请求发送给AI，获得完整的处理结果
3. 使用系统提供的自动保存命令保存结果：
   ```bash
   echo "AI的完整处理结果" | python pp.py --auto-save "任意名称"
   ```
4. 系统自动提取内容中的标题作为文件名并保存到 `output/YYYY-MM-DD/` 目录

**智能文件命名**：
- **HTML文件**：自动使用 `<title>` 标签内容作为文件名
- **Markdown文件**：自动使用第一个 `#` 或 `##` 标题作为文件名
- **特殊字符处理**：自动清理特殊字符，空格替换为下划线

## 🎯 命令参考

### 基本语法

```bash
python pp.py "输入文字 |> prompt1 |> prompt2 |> ..." [选项]
```

### 选项

- `--list`, `-l`：列出所有可用的prompt
- `--save filename`, `-s filename`：保存从stdin读取的内容到指定文件
- `--help`, `-h`：显示帮助信息

### 管道语法

- `|>`：连接输入文本和prompt步骤
- `保存文件`：在管道末尾添加此指令可自动保存结果

### 示例

```bash
# 单个prompt处理
python pp.py "这是一段需要改写的文本 |> 文章改写"

# 多prompt串联
python pp.py "Ship30创始人的故事 |> 文章改写 |> 极简侘寂"

# 串联处理（默认提供保存工具）
python pp.py "原始内容 |> 文章改写 |> 极简侘寂"

# 明确指定不保存
python pp.py "内容 |> 文章改写 |> 不保存"

# 保存AI响应
python pp.py --save "my_result.md"

# 查看可用prompt
python pp.py --list
```

## 🔧 Prompt文件管理

### 创建新Prompt

在相应的分类目录下创建新的Markdown文件：

```bash
# 创建翻译类prompt
mkdir -p prompt/translate
echo "你的prompt内容" > prompt/translate/中英翻译.md

# 立即可用
python pp.py "Hello World |> 中英翻译"
```

### Prompt文件格式

Prompt文件是标准的Markdown文件，建议包含：

```markdown
## 系统提示词

这里是你的prompt内容...

## 示例（可选）

输入：...
输出：...
```

### 命名规范

- 使用有意义的中文名称，如 "文章改写"、"极简侘寂"
- 按功能分类放入不同目录，如 `rewrite/`、`web/`、`translate/` 等
- 避免使用特殊字符和空格

## 🎨 扩展和自定义

### 智能匹配

系统支持多种prompt名称格式：

```bash
# 完整路径
python pp.py "文本 |> rewrite/文章改写"

# 简短名称（自动匹配）
python pp.py "文本 |> 文章改写"

# 混合使用
python pp.py "文本 |> 文章改写 |> web/极简侘寂"
```

### 输出管理

- 输出文件自动保存到 `output/YYYY-MM-DD/` 目录
- 文件名格式：`HHMMSS_最后一个prompt名称.md`
- 支持版本控制和历史追踪

## 💡 最佳实践

1. **先测试单个prompt**：在串联之前，先单独测试每个prompt
2. **使用有意义的输入**：提供足够详细的输入文本，获得更好的处理效果
3. **保存重要结果**：对于满意的输出，记得添加 `|> 保存文件`
4. **组织prompt文件**：按功能分类组织prompt，便于管理和查找
5. **版本控制**：将prompt文件纳入版本控制，跟踪变更历史

## 📝 详细使用示例

### 复杂工作流示例

#### 内容创作工作流
```bash
python pp.py "我想分享一个关于时间管理的个人经验 |> 文章改写 |> 保存文件"
```

这个工作流会：
1. 将个人经验改写成有吸引力的文章
2. 保存到今天的output目录

#### 网站内容生成工作流
```bash
python pp.py "产品介绍：我们的AI写作助手 |> 文章改写 |> 极简侘寂 |> 保存文件"
```

这个工作流会：
1. 将产品介绍改写成吸引人的文案
2. 转换成极简侘寂风格的网页
3. 保存完整的HTML文件

### 创建专用prompt组合

你可以创建专门的prompt来实现常用的组合：

```markdown
<!-- prompt/workflow/博客发布.md -->
## 系统提示词

这是一个组合prompt，请按以下步骤处理输入文本：

1. 首先使用"文章改写"的方法优化内容
2. 然后转换为适合博客发布的格式
3. 添加适当的标题和标签建议

请直接输出最终的博客文章格式。
```

然后使用：
```bash
python pp.py "我的想法 |> 博客发布 |> 保存文件"
```

这样可以将复杂的工作流封装成单个prompt，提高效率。

## 🔍 故障排除

### 常见问题

**Q: 找不到prompt文件？**
A: 使用 `python pp.py --list` 查看可用的prompt，确保名称正确。

**Q: 如何处理包含特殊字符的文本？**
A: 使用引号包围整个命令：`python pp.py "包含|特殊>字符的文本 |> 文章改写"`

**Q: 输出文件保存在哪里？**
A: 保存在 `prompt/output/YYYY-MM-DD/` 目录下，按日期自动归档。

**Q: 输出文件的命名规则是什么？**
A: 智能提取内容中的标题作为文件名：
- **HTML文件**：使用 `<title>` 标签内容，如 `宇宙尺度上的生命意义.html`
- **Markdown文件**：使用第一个标题，如 `情绪的本源探索.md`
- **自动清理**：移除特殊字符，空格替换为下划线
- **保存位置**：`output/YYYY-MM-DD/` 目录下

**Q: 如何创建新的Prompt？**
A: 在相应的分类目录下创建 `.md` 文件即可：

```bash
# 创建新的翻译类prompt
mkdir -p prompt/translate
echo "你的prompt内容" > prompt/translate/中英翻译.md

# 立即可用
python pp.py "Hello World |> 中英翻译"
```

### 获取帮助

- 查看帮助：`python pp.py --help`
- 列出prompt：`python pp.py --list`
- 查看prompt文件：浏览 `rewrite/`、`web/` 等目录

## 📚 更多资源

- [Prompt文件目录](./rewrite/) - 查看现有的prompt文件
- [输出示例](./output/) - 查看历史输出结果

---

**PP - Prompt Pipeline** 让内容处理变得简单、高效、可扩展。开始你的prompt工作流之旅吧！🚀
