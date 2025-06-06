#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简单的metadata更新脚本

## 生成规则和要求

### 标签生成规则
1. **数量限制**: 每篇文章严格限制为3个标签
2. **分层逻辑**: 按照从大到小的分层逻辑排列（大分类 → 细分类 → 具体标签）
3. **标签简洁**: 每个标签1-3个字，简洁明了
4. **准确反映**: 标签要准确反映文章的核心主题和内容

### 标题生成规则
1. **使用文件名**: 标题直接使用HTML文件名（去掉.html后缀）
2. **保持原样**: 不对文件名进行额外处理，保持原始命名

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
1. 脚本检测docs/timeline/目录下的所有HTML文件（从cache目录运行时使用../docs/timeline/）
2. 对比现有metadata.json，找出新增文件（增量模式）或处理所有文件（全量模式）
3. 为每个文件提取标题（文件名）和日期（创建时间）
4. 标签需要手动指定或通过AI助手生成
5. 按日期倒序排列所有条目，同日期时遵循"后来者居上"原则
6. 保存为格式化的JSON文件

### 注意事项
- 标签生成需要结合文章内容，建议使用AI助手根据文件名和内容生成
- 脚本只负责基础信息提取和格式化，标签内容需要人工或AI辅助完善
- 排序遵循"后来者居上"原则：同日期文件中，新添加的文件会自动排在前面
- 保持metadata.json文件的备份，避免意外丢失数据
"""

import json
import os
import argparse
from datetime import datetime
from pathlib import Path

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
    """从文件名提取标题"""
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

        # 标签需要手动指定或通过其他方式生成
        print(f"   标签: 需要手动指定")

        # 添加或更新metadata（暂时不包含标签）
        if args.all or file_key not in metadata:
            metadata[file_key] = {
                "title": title,
                "date": date,
                "tags": ["待定", "待定", "待定"]  # 占位符
            }
            updated_count += 1
    
    # 按日期倒序排列metadata，同日期时后来者居上
    if updated_count > 0:
        print("\n📅 按日期倒序排列（同日期后来者居上）...")
        # 获取原始顺序索引，用于同日期时的排序
        original_order = {key: idx for idx, key in enumerate(metadata.keys())}

        sorted_metadata = dict(sorted(metadata.items(),
                                    key=lambda x: (x[1]['date'], -original_order.get(x[0], 0)),
                                    reverse=True))
        metadata = sorted_metadata

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
            print("💡 请手动更新标签或使用AI助手生成标签")
        except Exception as e:
            print(f"❌ 保存metadata.json失败: {e}")
    else:
        print(f"\n🔍 预览模式：将{'更新' if args.all else '新增'} {updated_count} 条记录")

if __name__ == "__main__":
    main()
