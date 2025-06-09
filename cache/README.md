# Cache 目录脚本说明

这个目录包含了用于管理网站内容的自动化脚本。

## 脚本列表

### 1. file.py - HTML文件自动处理脚本

**功能**: 从下载目录自动拷贝HTML文件到timeline目录，提取标题，更新metadata，并安全清理源文件。

**依赖**:
```bash
pip install beautifulsoup4
```

**使用方法**:
```bash
# 基本使用（只处理今天修改的HTML文件，推荐）
cd cache && python3 file.py

# 处理所有HTML文件（首次使用或批量处理）
cd cache && python3 file.py --all-files

# 预览模式（查看将要执行的操作，不实际执行）
cd cache && python3 file.py --dry-run

# 指定其他源目录
cd cache && python3 file.py --source ~/Desktop

# 保留源文件（不移动到回收站）
cd cache && python3 file.py --keep-source

# 删除前需要确认（处理多个文件时）
cd cache && python3 file.py --confirm-delete

# 组合使用
cd cache && python3 file.py --dry-run     # 先预览今天的文件
cd cache && python3 file.py               # 处理今天的文件（自动移动到回收站）
```

**工作流程**:
1. 扫描指定目录中的HTML文件（默认只处理今天修改的）
2. 提取每个文件的`<title>`标签作为标题
3. 根据标题生成安全的文件名，处理冲突
4. 拷贝文件到`../docs/timeline/`目录
5. 自动运行`update.py`更新metadata
6. 将源文件安全移动到回收站（可选）

**重要特性**:
- **智能过滤**: 默认只处理今天修改的文件，避免重复处理
- **安全删除**: 使用回收站而不是直接删除文件
- **冲突处理**: 自动处理文件名冲突，添加数字后缀
- **预览模式**: 可以先查看操作再执行
- **跨平台**: 支持 macOS、Linux、Windows 的回收站功能

### 2. update.py - Metadata更新脚本

**功能**: 更新timeline目录中HTML文件的元数据信息。通常由file.py自动调用，也可手动运行。

**使用方法**:
```bash
# 增量更新（只处理新文件）
cd cache && python3 update.py

# 全量更新（处理所有文件）
cd cache && python3 update.py --all

# 预览模式
cd cache && python3 update.py --dry-run
```

**重要特性**:
- **智能排序**: 按日期倒序，同日期时新文件在前（后来者居上）
- **最小变更**: 只插入新文件，不重新排序整个文件
- **标签占位符**: 为新文件生成"待生成"标签，需要AI助手生成实际标签

## 推荐工作流程

### 日常使用（推荐）
1. **下载HTML文件** 到 `~/Downloads` 目录
2. **预览今天的文件**:
   ```bash
   cd cache && python3 file.py --dry-run
   ```
3. **处理今天的文件**:
   ```bash
   cd cache && python3 file.py
   ```
4. **为新文章生成标签**: 使用AI助手替换metadata.json中的"待生成"标签

### 批量处理（首次使用）
1. **预览所有文件**:
   ```bash
   cd cache && python3 file.py --all-files --dry-run
   ```
2. **处理所有文件**:
   ```bash
   cd cache && python3 file.py --all-files
   ```
3. **生成标签**: 为所有新文章生成合适的标签

### 手动更新metadata
如果只需要更新metadata（文件已在timeline目录）:
```bash
cd cache && python3 update.py              # 增量更新
cd cache && python3 update.py --all        # 全量更新
```

## 重要特性

### 安全性
- **回收站删除**: 文件移动到回收站而不是直接删除，可以恢复
- **预览模式**: 所有操作都支持 `--dry-run` 预览
- **智能过滤**: 默认只处理今天的文件，避免重复处理

### 智能处理
- **文件名清理**: 自动清理特殊字符，确保文件系统兼容性
- **冲突处理**: 自动处理文件名冲突，添加数字后缀
- **标题提取**: 使用BeautifulSoup准确提取HTML标题

### 排序优化
- **最小变更**: 只插入新文件，不重新排序整个metadata
- **后来者居上**: 同日期的新文件自动排在前面
- **日期倒序**: 最新文章始终在前

## 注意事项

- **运行位置**: 所有脚本都需要在 `cache` 目录下运行
- **依赖安装**: `file.py` 需要安装 `beautifulsoup4` 依赖
- **预览优先**: 建议先使用 `--dry-run` 参数预览操作
- **标签生成**: 新文章的标签需要AI助手生成，脚本只提供占位符
- **文件命名**: 文件名就是文章标题，确保准确性

## 故障排除

- **工作目录检查**: 脚本会自动检查是否在正确目录运行
- **依赖检查**: 自动检查必要的Python包是否安装
- **详细日志**: 提供详细的错误信息和处理统计
- **回收站失败**: 如果回收站功能不可用，会询问是否直接删除
