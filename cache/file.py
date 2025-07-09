#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTML文件自动处理脚本

## 功能说明
从下载目录中自动拷贝最新的HTML文件到timeline目录，提取文件标题，
更新metadata，并清理源文件。

## 主要功能
1. **扫描下载目录**: 查找最新的HTML文件
2. **提取标题**: 从HTML文件的<title>标签中提取标题
3. **智能重命名**: 根据标题生成合适的文件名
4. **拷贝文件**: 将文件拷贝到timeline目录
5. **添加脚本引用**: 自动为HTML文件添加main.js脚本引用，确保页面组件正常显示
6. **更新metadata**: 自动运行update.py更新元数据
7. **清理源文件**: 将源文件安全移动到回收站

## 使用方法
注意：脚本需要在cache目录下运行
- cd cache && python3 file.py                    # 处理所有HTML文件
- cd cache && python3 file.py --dry-run          # 预览模式，不实际操作
- cd cache && python3 file.py --source ~/Downloads  # 指定下载目录

## 工作流程
1. 扫描指定的下载目录（默认为~/Downloads）
2. 找到所有HTML文件，按修改时间排序
3. 提取每个文件的<title>标签内容作为标题
4. 根据标题生成安全的文件名（去除特殊字符）
5. 检查目标文件是否已存在，避免重复
6. 拷贝文件到../docs/timeline/目录
7. 自动检查并添加main.js脚本引用（确保页面组件正常显示）
8. 运行update.py更新metadata.json
9. 将源文件移动到回收站（可选，安全删除）

## 注意事项
- 文件名会自动清理特殊字符，确保文件系统兼容性
- 如果标题为空或无效，会使用原文件名
- 支持预览模式，可以先查看将要执行的操作
- 自动跳过已存在的文件，避免覆盖
"""

import os
import shutil
import argparse
import subprocess
import re
import sys
from pathlib import Path
from datetime import datetime, timedelta

# 检查依赖
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ 缺少依赖: beautifulsoup4")
    print("💡 请运行: pip install beautifulsoup4")
    sys.exit(1)

def extract_title_from_html(file_path):
    """
    从HTML文件中提取title标签的内容
    
    Args:
        file_path (str): HTML文件路径
        
    Returns:
        str: 提取的标题，如果提取失败则返回文件名
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 使用BeautifulSoup解析HTML
        soup = BeautifulSoup(content, 'html.parser')
        title_tag = soup.find('title')
        
        if title_tag and title_tag.string:
            title = title_tag.string.strip()
            print(f"   📝 提取到标题: {title}")
            return title
        else:
            print(f"   ⚠️  未找到title标签，使用文件名")
            return Path(file_path).stem
            
    except Exception as e:
        print(f"   ❌ 提取标题失败: {e}")
        return Path(file_path).stem

def sanitize_filename(title):
    """
    清理标题，生成安全的文件名
    
    Args:
        title (str): 原始标题
        
    Returns:
        str: 清理后的文件名（不含扩展名）
    """
    # 移除或替换不安全的字符
    filename = re.sub(r'[<>:"/\\|?*]', '', title)  # 移除文件系统不允许的字符
    filename = re.sub(r'\s+', ' ', filename)       # 合并多个空格
    filename = filename.strip()                     # 去除首尾空格
    
    # 限制文件名长度
    if len(filename) > 100:
        filename = filename[:100]
    
    # 如果清理后为空，使用默认名称
    if not filename:
        filename = f"untitled_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    print(f"   🔧 生成文件名: {filename}")
    return filename

def find_html_files(source_dir, days=1):
    """
    在指定目录中查找HTML文件

    Args:
        source_dir (str): 源目录路径
        days (int): 查找最近几天的文件

    Returns:
        list: HTML文件路径列表，按修改时间排序（最新的在前）
    """
    source_path = Path(source_dir).expanduser()

    if not source_path.exists():
        print(f"❌ 源目录不存在: {source_path}")
        return []

    # 查找所有HTML文件
    html_files = list(source_path.glob('*.html')) + list(source_path.glob('*.htm'))

    if not html_files:
        print(f"📁 在 {source_path} 中未找到HTML文件")
        return []

    if days is not None:
        today = datetime.now().date()
        start_date = today - timedelta(days=days-1)
        filtered_files = []

        for file_path in html_files:
            try:
                mtime = datetime.fromtimestamp(file_path.stat().st_mtime).date()
                if start_date <= mtime <= today:
                    filtered_files.append(file_path)
            except Exception as e:
                print(f"   ⚠️  无法获取文件时间 {file_path.name}: {e}")
                continue

        html_files = filtered_files
        print(f"📁 在 {source_path} 中找到 {len(html_files)} 个最近 {days} 天的HTML文件")
    else:
        print(f"📁 在 {source_path} 中找到 {len(html_files)} 个HTML文件")

    if not html_files:
        return []

    # 按修改时间排序（最新的在前）
    html_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)

    return html_files

def ensure_main_js_script(file_path, dry_run=False):
    """
    确保HTML文件包含main.js脚本引用

    Args:
        file_path (Path): HTML文件路径
        dry_run (bool): 是否为预览模式

    Returns:
        bool: 是否成功添加或已存在脚本引用
    """
    try:
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 检查是否已经包含 main.js 脚本引用（更精确的检测）
        if '<script src="../../js/main.js"></script>' in content or 'src="../../js/main.js"' in content:
            print(f"   ✅ 已包含main.js脚本引用")
            return True

        # 检查是否有 </body> 标签
        if '</body>' not in content:
            print(f"   ⚠️  未找到</body>标签，跳过脚本添加")
            return False

        if dry_run:
            print(f"   🔍 [预览] 将添加main.js脚本引用")
            return True

        # 在 </body> 前添加脚本引用
        script_tag = '    <!-- 加载组件脚本 -->\n    <script src="../../js/main.js"></script>\n</body>'
        new_content = content.replace('</body>', script_tag)

        # 写回文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"   ✅ 已添加main.js脚本引用")
        return True

    except Exception as e:
        print(f"   ❌ 添加脚本引用失败: {e}")
        return False

def copy_file_to_timeline(source_file, target_filename, dry_run=False):
    """
    将文件拷贝到timeline目录

    Args:
        source_file (Path): 源文件路径
        target_filename (str): 目标文件名（不含扩展名）
        dry_run (bool): 是否为预览模式

    Returns:
        bool: 是否成功拷贝
    """
    timeline_dir = Path('../docs/timeline')
    target_file = timeline_dir / f"{target_filename}.html"

    # 处理文件名冲突
    counter = 1
    original_target_file = target_file
    while target_file.exists():
        target_filename_with_counter = f"{target_filename}_{counter}"
        target_file = timeline_dir / f"{target_filename_with_counter}.html"
        counter += 1

        if counter > 100:  # 防止无限循环
            print(f"   ❌ 文件名冲突过多，跳过: {original_target_file.name}")
            return False

    if target_file != original_target_file:
        print(f"   🔄 文件名冲突，重命名为: {target_file.name}")

    if dry_run:
        print(f"   🔍 [预览] 将拷贝到: {target_file}")
        return True

    try:
        # 确保目标目录存在
        timeline_dir.mkdir(parents=True, exist_ok=True)

        # 拷贝文件
        shutil.copy2(source_file, target_file)
        print(f"   ✅ 已拷贝到: {target_file.name}")

        # 确保拷贝的文件包含main.js脚本引用
        ensure_main_js_script(target_file, dry_run)

        return True

    except Exception as e:
        print(f"   ❌ 拷贝失败: {e}")
        return False

def run_update_script(dry_run=False):
    """
    运行update.py脚本更新metadata
    
    Args:
        dry_run (bool): 是否为预览模式
        
    Returns:
        bool: 是否成功运行
    """
    if dry_run:
        print("🔍 [预览] 将运行 update.py 更新metadata")
        return True
    
    try:
        print("🔄 运行 update.py 更新metadata...")
        result = subprocess.run(['python3', 'update.py'], 
                              capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0:
            print("✅ metadata更新完成")
            return True
        else:
            print(f"❌ update.py运行失败: {result.stderr}")
            return False
            
    except Exception as e:
        print(f"❌ 运行update.py失败: {e}")
        return False

def move_to_trash(file_path):
    """将文件移动到回收站（macOS/Linux安全删除）"""
    try:
        if os.name == 'posix':  # macOS/Linux
            if shutil.which('trash'):
                # 使用trash命令（需要安装：brew install trash）
                subprocess.run(['trash', str(file_path)], check=True)
                return True
            elif os.uname().sysname == 'Darwin':  # macOS
                # 使用macOS原生的回收站
                subprocess.run(['osascript', '-e', f'tell app "Finder" to delete POSIX file "{file_path}"'], check=True)
                return True
            else:
                # Linux - 移动到 ~/.local/share/Trash
                trash_dir = Path.home() / '.local/share/Trash/files'
                trash_dir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(file_path), str(trash_dir / file_path.name))
                return True
        else:  # Windows
            # Windows回收站
            try:
                import winshell
                winshell.delete_file(str(file_path))
                return True
            except ImportError:
                print("   ⚠️ Windows回收站功能需要安装winshell: pip install winshell")
                return False
    except Exception as e:
        print(f"   ⚠️ 移动到回收站失败: {e}")
        return False

def delete_source_file(source_file, dry_run=False, auto_confirm=True):
    """
    安全删除源文件（移动到回收站）

    Args:
        source_file (Path): 源文件路径
        dry_run (bool): 是否为预览模式
        auto_confirm (bool): 是否自动确认删除

    Returns:
        bool: 是否成功删除
    """
    if dry_run:
        print(f"   🔍 [预览] 将移动到回收站: {source_file.name}")
        return True

    if not auto_confirm:
        response = input(f"   ⚠️  确认将源文件移动到回收站 {source_file.name}? (y/N): ")
        if response.lower() not in ['y', 'yes']:
            print(f"   ⏭️  跳过删除: {source_file.name}")
            return False

    # 尝试移动到回收站
    if move_to_trash(source_file):
        print(f"   🗑️  已移动到回收站: {source_file.name}")
        return True
    else:
        # 回收站失败，询问是否直接删除
        if auto_confirm:
            print(f"   ⚠️ 回收站功能不可用，保留源文件: {source_file.name}")
            return False
        else:
            response = input(f"   ⚠️ 回收站功能不可用，是否直接删除 {source_file.name}? (y/N): ")
            if response.lower() in ['y', 'yes']:
                try:
                    source_file.unlink()
                    print(f"   🗑️  已直接删除: {source_file.name}")
                    return True
                except Exception as e:
                    print(f"   ❌ 删除失败: {e}")
                    return False
            else:
                print(f"   📝 保留源文件: {source_file.name}")
                return False

def check_working_directory():
    """
    检查当前工作目录是否正确
    脚本需要在cache目录下运行
    """
    current_dir = Path.cwd()
    if current_dir.name != 'cache':
        print("❌ 错误：脚本需要在cache目录下运行")
        print(f"   当前目录: {current_dir}")
        print("💡 请运行: cd cache && python3 file.py")
        sys.exit(1)

    # 检查必要的目录和文件是否存在
    if not Path('update.py').exists():
        print("❌ 错误：未找到update.py脚本")
        sys.exit(1)

    timeline_dir = Path('../docs/timeline')
    if not timeline_dir.exists():
        print(f"⚠️  timeline目录不存在，将自动创建: {timeline_dir}")

def main():
    """主函数"""
    # 检查工作目录
    check_working_directory()

    parser = argparse.ArgumentParser(
        description='自动处理HTML文件到timeline目录',
        epilog="""
使用示例:
  python3 file.py                           # 只处理今天修改的HTML文件（推荐）
  python3 file.py --all-files               # 处理所有HTML文件
  python3 file.py --dry-run                 # 预览模式，查看将要执行的操作
  python3 file.py --source ~/Desktop        # 指定其他源目录
  python3 file.py --keep-source             # 处理后保留源文件
  python3 file.py --dry-run                 # 预览今天的文件（推荐）
  python3 file.py --all-files --keep-source # 处理所有文件但保留源文件
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--source', default='~/Downloads',
                       help='源目录路径（默认: ~/Downloads）')
    parser.add_argument('--all-files', action='store_true',
                       help='处理所有HTML文件（默认只处理今天修改的文件）')
    parser.add_argument('--week', action='store_true',
                       help='处理最近7天的HTML文件')
    parser.add_argument('--dry-run', action='store_true',
                       help='预览模式，不实际执行操作')
    parser.add_argument('--keep-source', action='store_true',
                       help='保留源文件，不删除')
    parser.add_argument('--confirm-delete', action='store_true',
                       help='删除文件前需要确认（默认自动删除）')

    args = parser.parse_args()
    
    print("🚀 开始处理HTML文件...")
    print(f"📂 源目录: {args.source}")
    print(f"🎯 目标目录: ../docs/timeline/")
    
    if args.all_files:
        days = None  # 不限制
    elif args.week:
        days = 7
    else:
        days = 1  # 默认当天
    scope_str = '所有HTML文件' if days is None else f'最近 {days} 天的文件'
    print(f"📅 搜索范围: {scope_str}")

    if args.dry_run:
        print("🔍 预览模式：将显示操作但不实际执行")

    # 查找HTML文件
    html_files = find_html_files(args.source, days)
    if not html_files:
        return
    
    # 处理每个文件
    processed_count = 0
    skipped_count = 0
    error_count = 0

    # 智能确认逻辑：如果要处理多个文件且需要删除，询问一次总体确认
    need_delete_confirm = False
    if not args.keep_source and not args.dry_run and len(html_files) > 3:
        if args.confirm_delete:
            response = input(f"\n⚠️  将处理 {len(html_files)} 个文件并删除源文件，确认继续? (y/N): ")
            if response.lower() not in ['y', 'yes']:
                print("❌ 用户取消操作")
                return
        need_delete_confirm = args.confirm_delete and len(html_files) <= 3
    else:
        need_delete_confirm = args.confirm_delete

    for i, html_file in enumerate(html_files, 1):
        print(f"\n📄 处理文件 {i}/{len(html_files)}: {html_file.name}")

        try:
            # 提取标题
            title = extract_title_from_html(html_file)

            # 生成安全的文件名
            safe_filename = sanitize_filename(title)

            # 拷贝文件
            if copy_file_to_timeline(html_file, safe_filename, args.dry_run):
                processed_count += 1

                # 删除源文件（如果不是预览模式且未指定保留）
                if not args.keep_source:
                    delete_source_file(html_file, args.dry_run, not need_delete_confirm)
            else:
                skipped_count += 1

        except Exception as e:
            print(f"   ❌ 处理文件时出错: {e}")
            error_count += 1

    # 显示处理统计
    print(f"\n📊 处理统计:")
    print(f"   ✅ 成功处理: {processed_count} 个文件")
    print(f"   ⏭️  跳过文件: {skipped_count} 个文件")
    print(f"   ❌ 错误文件: {error_count} 个文件")

    # 更新metadata
    if processed_count > 0:
        print(f"\n🔄 更新metadata...")
        if run_update_script(args.dry_run):
            print("✅ 所有操作完成！")
        else:
            print("⚠️  文件处理完成，但metadata更新失败")
    else:
        print("\n📊 没有文件被处理")

    print("\n🎉 脚本执行完成！")

if __name__ == "__main__":
    main()
