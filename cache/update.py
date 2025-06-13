#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Metadata更新脚本

本脚本用于更新timeline目录中HTML文件的元数据信息。
通常由file.py自动调用，也可以手动运行进行增量或全量更新。

## 生成规则和要求

### 标签生成规则
1. **数量限制**: 每篇文章严格限制为3个标签
2. **三层分层逻辑**: 按照从大到小的分层逻辑排列（顶层分类 → 细分领域 → 具体标签）
3. **标签简洁**: 每个标签1-3个字，简洁明了
4. **准确反映**: 标签要准确反映文章的核心主题和内容

### 三层标签体系定义
**第一层（顶层分类）- 必须选择其中一个**：
- `个人` - 个人成长、修行、哲学思考、心理健康、情感表达
- `家庭` - 亲子关系、家庭生活、育儿教育、家庭情感
- `工作` - 职场发展、创业经历、技能提升、商业思考
- `社交` - 人际关系、沟通技巧、社会观察、群体互动
- `学习` - 知识获取、技能学习、书籍摘要、方法论

**第二层（细分领域）- 根据第一层选择对应领域**：
- 个人：`成长`、`修行`、`哲学`、`心理`、`健康`、`情感`、`创作`
- 家庭：`亲子`、`教育`、`关系`、`生活`
- 工作：`职场`、`创业`、`技术`、`AI`、`设计`、`商业`、`效率`
- 社交：`沟通`、`关系`、`社会`、`人性`
- 学习：`书摘`、`方法`、`认知`、`思维`、`技巧`

**第三层（具体标签）- 文章的核心主题词**：
- 具体主题：`冥想`、`意义`、`写作`、`理财`、`时间`、`AI`、`设计`等
- 情感词汇：`诗意`、`温柔`、`回归`、`觉知`、`当下`等
- 行为动作：`思考`、`探索`、`创造`、`连接`、`治愈`等

### 标题生成规则
1. **使用文件名**: 标题直接使用HTML文件名（去掉.html后缀）
2. **文件名即标题**: 文件复制到timeline目录时应该已经用HTML的<title>标签重命名
3. **保持原样**: 不对文件名进行额外处理，保持重命名后的标题

### 日期生成规则
1. **文件创建时间**: 使用文件的实际创建时间作为日期
2. **格式标准**: 日期格式为YYYY-MM-DD
3. **备选方案**: 如果无法获取创建时间，使用文件修改时间

### 更新模式
1. **默认增量更新**: 默认只处理新增的HTML文件（diff模式）
2. **全量更新**: 使用--all参数时更新所有文件
3. **预览模式**: 使用--dry-run参数可预览更改而不实际保存

### 格式要求
1. **Tags一行显示**: tags数组在JSON中显示为一行，如 "tags": ["AI", "技术", "应用"]
2. **日期倒序排列**: 所有条目按date字段倒序排列，最新文章在前
3. **同日期后来者居上**: 如果日期相同，新添加的文件排在前面（后来者居上原则）
4. **JSON格式**: 保持JSON格式的可读性和一致性
5. **编码格式**: 使用UTF-8编码，ensure_ascii=False保持中文显示

### 使用方法
注意：脚本需要在cache目录下运行
- cd cache && python3 update.py              # 增量更新(只处理新文件)
- cd cache && python3 update.py --all        # 全量更新所有文件
- cd cache && python3 update.py --dry-run    # 预览模式，不实际保存
- cd cache && python3 update.py --all --dry-run  # 全量预览模式

### 工作流程
1. 使用file.py处理下载目录中的HTML文件（提取标题并重命名，自动调用update.py）
2. 脚本检测docs/timeline/目录下的所有HTML文件（从cache目录运行时使用../docs/timeline/）
3. 对比现有metadata.json，找出新增文件（增量模式）或处理所有文件（全量模式）
4. 为每个文件提取标题（文件名）和日期（创建时间）
5. 标签需要通过AI助手生成
6. 智能插入新文件到正确位置，保持日期倒序和"后来者居上"原则
7. 保存为格式化的JSON文件

### 注意事项
- 文件应该先通过file.py处理，确保文件名就是文章标题
- 标签需要通过AI助手生成，脚本只提供占位符
- 排序遵循"后来者居上"原则：同日期文件中，新添加的文件会自动排在前面
- 只对新文件进行插入排序，不会重新排序整个文件
- 保持metadata.json文件的备份，避免意外丢失数据
"""

import json
import os
import argparse
from datetime import datetime
from pathlib import Path

def get_tag_generation_guide():
    """
    返回标签生成指南，供AI助手参考
    """
    return """
## 标签生成指南

### 分层逻辑示例：
1. **个人成长类文章**：["个人", "成长", "具体主题"]
   - 例：人生哲学 → ["个人", "哲学", "意义"]
   - 例：冥想修行 → ["个人", "修行", "冥想"]
   - 例：情感表达 → ["个人", "情感", "诗意"]

2. **工作技能类文章**：["工作", "领域", "具体技能"]
   - 例：AI技术 → ["工作", "技术", "AI"]
   - 例：职场能力 → ["工作", "职场", "能力"]
   - 例：创业经验 → ["工作", "创业", "商业"]

3. **学习方法类文章**：["学习", "类型", "具体内容"]
   - 例：读书笔记 → ["学习", "书摘", "具体书名主题"]
   - 例：学习方法 → ["学习", "方法", "具体技巧"]

### 标签选择原则：
- 第一个标签：必须是五大顶层分类之一（个人/家庭/工作/社交/学习）
- 第二个标签：选择对应的细分领域，体现文章的主要方向
- 第三个标签：文章的核心主题或关键词，最具体和独特

### 常见标签映射：
- 哲学思考、人生感悟 → ["个人", "哲学", "具体主题"]
- 心理健康、情绪管理 → ["个人", "心理", "具体主题"]
- 冥想、修行、精神成长 → ["个人", "修行", "具体主题"]
- 写作、创作、艺术表达 → ["个人", "创作", "具体主题"]
- AI、技术、编程 → ["工作", "技术", "具体技术"]
- 职场发展、能力提升 → ["工作", "职场", "具体能力"]
- 创业、商业思考 → ["工作", "创业", "具体主题"]
- 书籍摘要、读书笔记 → ["学习", "书摘", "具体主题"]
"""



def get_file_creation_date(file_path):
    """获取文件的创建时间"""
    try:
        stat = os.stat(file_path)
        # 尝试获取创建时间（macOS支持st_birthtime）
        if hasattr(stat, 'st_birthtime'):
            timestamp = stat.st_birthtime
        else:
            # 使用修改时间作为备选
            timestamp = stat.st_mtime
        return datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d')
    except:
        return datetime.now().strftime('%Y-%m-%d')

def extract_title_from_filename(file_path):
    """从文件名提取标题

    注意：文件应该已经通过file.py处理，
    文件名就是从HTML <title>标签提取的标题
    """
    filename = os.path.basename(file_path)
    return filename.replace('.html', '').strip()



def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='简单更新metadata.json文件')
    parser.add_argument('--all', action='store_true', help='全量更新所有文件（默认为增量更新diff）')
    parser.add_argument('--dry-run', action='store_true', help='预览模式，不实际保存文件')
    args = parser.parse_args()
    
    mode = "全量更新" if args.all else "增量更新(diff)"
    print(f"🚀 开始{mode}metadata.json文件...")

    # 读取现有的metadata.json
    metadata_path = 'metadata.json'
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        print(f"📖 已加载现有metadata，包含 {len(metadata)} 条记录")
    except FileNotFoundError:
        print("❌ metadata.json文件不存在")
        return
    except Exception as e:
        print(f"❌ 读取metadata.json失败: {e}")
        return

    # 获取所有HTML文件
    timeline_dir = Path('../docs/timeline')
    html_files = list(timeline_dir.glob('*.html'))
    print(f"📁 找到 {len(html_files)} 个HTML文件")

    # 确定需要处理的文件
    if args.all:
        files_to_process = html_files
        print(f"🔄 全量更新模式：将处理所有 {len(files_to_process)} 个文件")
    else:
        files_to_process = []
        for html_file in html_files:
            # 将路径标准化为相对于项目根目录的路径
            file_key = str(html_file).replace('\\', '/').replace('../', '')
            if file_key not in metadata:
                files_to_process.append(html_file)
        print(f"🆕 增量更新模式：发现 {len(files_to_process)} 个新文件需要添加")
    
    if not files_to_process:
        print("✅ 没有需要处理的文件")
        return
    
    # 处理文件
    updated_count = 0
    files_to_process_paths = []  # 记录新处理的文件路径
    for html_file in files_to_process:
        # 将路径标准化为相对于项目根目录的路径
        file_key = str(html_file).replace('\\', '/').replace('../', '')
        print(f"\n📝 处理文件: {file_key}")

        # 提取标题（使用文件名）
        title = extract_title_from_filename(html_file)
        print(f"   标题: {title}")

        # 获取日期（文件创建时间）
        date = get_file_creation_date(html_file)
        print(f"   日期: {date}")

        # 标签需要AI助手生成
        print(f"   标签: 需要AI助手生成（请使用三层分层逻辑）")
        print(f"   标签指南: {get_tag_generation_guide()}")

        # 添加或更新metadata（标签暂时为占位符）
        if args.all or file_key not in metadata:
            metadata[file_key] = {
                "title": title,
                "date": date,
                "tags": ["待生成", "待生成", "待生成"]  # 占位符，需要AI按三层逻辑生成
            }
            files_to_process_paths.append(file_key)  # 记录新处理的文件
            updated_count += 1
    
    # 只对新文件进行智能插入，不重新排序整个文件
    if updated_count > 0:
        print(f"\n📅 将 {updated_count} 个新文件插入到正确位置...")

        # 获取所有条目并按日期分组
        all_items = list(metadata.items())

        # 分离新文件和已存在文件
        new_files = [(k, v) for k, v in all_items if k in files_to_process_paths]
        existing_files = [(k, v) for k, v in all_items if k not in files_to_process_paths]

        # 对新文件按日期排序（同日期按文件名排序保证一致性）
        new_files.sort(key=lambda x: (x[1]['date'], x[0]), reverse=True)

        # 重新构建metadata：合并新文件和已存在文件，保持日期倒序
        result = []
        i, j = 0, 0

        while i < len(existing_files) or j < len(new_files):
            if j >= len(new_files):
                # 新文件已处理完，添加剩余已存在文件
                result.extend(existing_files[i:])
                break
            elif i >= len(existing_files):
                # 已存在文件已处理完，添加剩余新文件
                result.extend(new_files[j:])
                break
            else:
                existing_date = existing_files[i][1]['date']
                new_date = new_files[j][1]['date']

                # 新文件优先：日期更新或同日期时新文件在前
                if new_date > existing_date:
                    result.append(new_files[j])
                    j += 1
                elif new_date == existing_date:
                    # 同日期时，新文件排在前面
                    result.append(new_files[j])
                    j += 1
                else:
                    result.append(existing_files[i])
                    i += 1

        # 重建metadata字典
        metadata = dict(result)

    # 保存更新后的metadata
    if not args.dry_run:
        try:
            # 自定义JSON编码器，让tags数组在一行显示
            class CompactJSONEncoder(json.JSONEncoder):
                def encode(self, obj):
                    if isinstance(obj, dict):
                        items = []
                        for key, value in obj.items():
                            if isinstance(value, dict):
                                # 处理每个文章条目
                                sub_items = []
                                for sub_key, sub_value in value.items():
                                    if sub_key == 'tags' and isinstance(sub_value, list):
                                        # tags数组放在一行
                                        tag_str = json.dumps(sub_value, ensure_ascii=False)
                                        sub_items.append(f'    "{sub_key}": {tag_str}')
                                    else:
                                        sub_items.append(f'    "{sub_key}": {json.dumps(sub_value, ensure_ascii=False)}')
                                value_str = "{\n" + ",\n".join(sub_items) + "\n  }"
                                items.append(f'  "{key}": {value_str}')
                            else:
                                items.append(f'  "{key}": {json.dumps(value, ensure_ascii=False)}')
                        return "{\n" + ",\n".join(items) + "\n}"
                    return super().encode(obj)

            with open(metadata_path, 'w', encoding='utf-8') as f:
                f.write(CompactJSONEncoder().encode(metadata))

            print(f"\n✅ metadata.json更新完成，现在包含 {len(metadata)} 条记录")
            print(f"🆕 {'更新' if args.all else '新增'}了 {updated_count} 条记录")
            print("🤖 请使用AI助手为新文章生成标签（替换'待生成'占位符）")
            print("📋 标签生成要求：")
            print("   - 第一层：顶层分类（个人/家庭/工作/社交/学习）")
            print("   - 第二层：细分领域（成长/修行/哲学/技术/职场等）")
            print("   - 第三层：具体标签（冥想/意义/AI/写作等）")
            print("   - 示例：['个人', '哲学', '意义'] 或 ['工作', '技术', 'AI']")
        except Exception as e:
            print(f"❌ 保存metadata.json失败: {e}")
    else:
        print(f"\n🔍 预览模式：将{'更新' if args.all else '新增'} {updated_count} 条记录")

if __name__ == "__main__":
    main()
