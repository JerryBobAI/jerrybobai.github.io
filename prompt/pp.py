#!/usr/bin/env python3
"""
PP - Prompt Pipeline

一个基于文件系统的、可扩展的 Prompt 工作流引擎。
支持会话模式和交互模式两种使用方式。

使用方法：
  python pp.py "输入文字 |> prompt1 |> prompt2 |> ..."
  python pp.py "输入文字 |> prompt1" --interactive
  python pp.py --list
"""

import sys
import os
import re
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional
import argparse


class PromptPipeline:
    def __init__(self, prompt_dir: Path = None):
        """初始化Prompt Pipeline"""
        if prompt_dir is None:
            self.prompt_dir = Path(__file__).parent.resolve()
        else:
            self.prompt_dir = Path(prompt_dir).resolve()
        
        self.output_dir = self.prompt_dir / 'output'
        
    def parse_pipeline_command(self, command: str) -> Tuple[str, List[str]]:
        """解析管道命令"""
        parts = [part.strip() for part in command.split('|>')]
        
        if len(parts) < 2:
            raise ValueError("命令格式错误。正确格式：'输入文字 |> prompt1 |> prompt2 |> ...'")
        
        input_text = parts[0]
        prompt_steps = parts[1:]
        
        return input_text, prompt_steps
    
    def find_prompt_file(self, prompt_name: str) -> Optional[Path]:
        """智能查找prompt文件"""
        # 如果包含路径分隔符，直接使用相对路径
        if '/' in prompt_name or '\\' in prompt_name:
            prompt_path = self.prompt_dir / f"{prompt_name}.md"
            if prompt_path.exists():
                return prompt_path
        
        # 在所有子目录中搜索匹配的文件
        for md_file in self.prompt_dir.rglob("*.md"):
            # 跳过README.md、USAGE_EXAMPLES.md和output目录
            if (md_file.name in ["README.md", "USAGE_EXAMPLES.md"] or
                "output" in md_file.parts):
                continue
                
            # 检查文件名是否匹配（不包含扩展名）
            if md_file.stem == prompt_name:
                return md_file
                
            # 检查完整相对路径是否匹配
            relative_path = md_file.relative_to(self.prompt_dir)
            relative_path_str = str(relative_path).replace('.md', '')
            if relative_path_str == prompt_name:
                return md_file
        
        return None
    
    def load_prompt_content(self, prompt_file: Path) -> str:
        """加载prompt文件内容"""
        try:
            return prompt_file.read_text(encoding='utf-8')
        except Exception as e:
            raise RuntimeError(f"无法读取prompt文件 {prompt_file}: {e}")
    
    def save_output(self, content: str, prompt_chain: List[str], custom_filename: str = None) -> Path:
        """保存输出内容到文件"""
        # 创建今天的输出目录
        today = datetime.now().strftime("%Y-%m-%d")
        today_dir = self.output_dir / today
        today_dir.mkdir(parents=True, exist_ok=True)

        # 生成文件名
        if custom_filename:
            # 使用自定义文件名，保持原有扩展名
            filename = custom_filename
        else:
            # 生成默认文件名
            timestamp = datetime.now().strftime("%H%M%S")
            last_prompt = prompt_chain[-1] if prompt_chain else "output"
            # 清理文件名中的特殊字符
            clean_prompt_name = re.sub(r'[^\w\-_\u4e00-\u9fff]', '_', last_prompt)
            filename = f"{timestamp}_{clean_prompt_name}.md"

        # 保存文件
        output_path = today_dir / filename
        output_path.write_text(content, encoding='utf-8')

        return output_path
    
    def session_mode(self, command: str) -> str:
        """
        会话模式：生成格式化的会话请求，并在处理完成后自动保存结果
        """
        try:
            # 解析命令
            input_text, prompt_steps = self.parse_pipeline_command(command)

            # 检查保存指令（默认保存，除非明确指定不保存）
            save_file = True
            actual_prompts = []

            for step in prompt_steps:
                if step.lower() in ['不保存', '不保存文件', 'no save', 'nosave']:
                    save_file = False
                elif step.lower() in ['保存文件', '保存', 'save', 'save file']:
                    save_file = True  # 显式保存（虽然默认就是True）
                else:
                    actual_prompts.append(step)

            if not actual_prompts:
                return "❌ 错误：没有找到有效的prompt步骤"

            # 生成建议的文件名（用于保存说明）
            timestamp = datetime.now().strftime("%H%M%S")
            last_prompt = actual_prompts[-1] if actual_prompts else "output"
            clean_prompt_name = re.sub(r'[^\w\-_\u4e00-\u9fff]', '_', last_prompt)
            suggested_filename = f"{timestamp}_{clean_prompt_name}.md"

            # 生成会话请求
            separator = "=" * 60
            request_parts = []

            # 添加标题
            request_parts.append(f"""
{separator}
🚀 PROMPT PIPELINE 会话请求
{separator}

📊 **输入文本**：{input_text}
🔗 **处理链**：{' → '.join(actual_prompts)}
💾 **自动保存**：{'是' if save_file else '否'}
📁 **保存文件名**：{suggested_filename if save_file else '不保存'}

{separator}
""")

            # 为每个prompt生成处理步骤
            current_input = input_text

            for i, prompt_name in enumerate(actual_prompts, 1):
                # 查找prompt文件
                prompt_file = self.find_prompt_file(prompt_name)
                if not prompt_file:
                    return f"❌ 错误：找不到prompt文件 '{prompt_name}'"

                # 加载prompt内容
                prompt_content = self.load_prompt_content(prompt_file)

                # 生成步骤请求
                step_request = f"""
### 🔄 步骤 {i}/{len(actual_prompts)}: {prompt_name}

**Prompt文件**: `{prompt_file.relative_to(self.prompt_dir)}`

**Prompt内容**:
```
{prompt_content}
```

**当前输入**:
```
{current_input}
```

**请求**: 请根据上述prompt处理当前输入，直接输出处理结果。

---
"""
                request_parts.append(step_request)

                # 为下一步准备（如果有多个步骤）
                if i < len(actual_prompts):
                    current_input = f"[步骤{i}的输出结果]"

            # 添加自动保存说明
            if save_file:
                request_parts.append(f"""
### 💾 自动保存功能

**✨ 好消息**：处理完成后，我会自动为你保存最终结果！

**智能文件命名**：
- 📁 **HTML文件**：自动使用 `<title>` 标签内容作为文件名
- 📄 **Markdown文件**：自动使用第一个标题作为文件名
- 📂 **保存位置**：`prompt/output/{datetime.now().strftime('%Y-%m-%d')}/`

**自动保存命令**：
```bash
echo "你的AI最终处理结果" | python pp.py --auto-save "{suggested_filename}"
```

**使用步骤**：
1. 将上述prompt请求发送给AI，逐步完成所有处理
2. 获得最终的完整结果后，复制完整内容
3. 运行上述自动保存命令，粘贴内容并按 Ctrl+D
4. 系统将自动提取标题并保存文件

{separator}
""")

            return ''.join(request_parts)

        except Exception as e:
            return f"❌ 生成请求出错：{e}"

    def extract_title_from_content(self, content: str) -> str:
        """
        从内容中提取标题作为文件名
        """
        import re

        # 检查是否是HTML内容
        if '<title>' in content and '</title>' in content:
            # 提取HTML title
            title_match = re.search(r'<title>(.*?)</title>', content, re.IGNORECASE | re.DOTALL)
            if title_match:
                title = title_match.group(1).strip()
                # 清理HTML实体和特殊字符
                title = re.sub(r'&[^;]+;', '', title)  # 移除HTML实体
                title = re.sub(r'[^\w\s\-_\u4e00-\u9fff]', '', title)  # 只保留字母、数字、中文、空格、连字符
                title = re.sub(r'\s+', '_', title)  # 空格替换为下划线
                return f"{title}.html"

        # 检查是否是Markdown内容，提取第一个标题
        lines = content.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('# '):
                title = line[2:].strip()
                # 清理特殊字符
                title = re.sub(r'[^\w\s\-_\u4e00-\u9fff]', '', title)
                title = re.sub(r'\s+', '_', title)
                return f"{title}.md"
            elif line.startswith('## '):
                title = line[3:].strip()
                title = re.sub(r'[^\w\s\-_\u4e00-\u9fff]', '', title)
                title = re.sub(r'\s+', '_', title)
                return f"{title}.md"

        # 如果没找到标题，使用默认名称
        if '<html' in content.lower():
            return "untitled.html"
        else:
            return "untitled.md"

    def auto_save_result(self, content: str, suggested_filename: str) -> str:
        """
        自动保存处理结果，使用内容中的标题作为文件名
        """
        try:
            # 从内容中提取标题作为文件名
            filename = self.extract_title_from_content(content)

            # 从建议的文件名中提取prompt信息（用于内部记录）
            if '_' in suggested_filename:
                parts = suggested_filename.replace('.md', '').replace('.html', '').split('_')
                if len(parts) >= 2:
                    prompt_name = '_'.join(parts[1:])
                    prompt_chain = [prompt_name]
                else:
                    prompt_chain = ['output']
            else:
                prompt_chain = ['output']

            # 自动保存文件
            output_path = self.save_output(content, prompt_chain, custom_filename=filename)

            result = f"""
🎉 **自动保存完成！**

✅ **文件已保存**：`{output_path.name}`
📂 **完整路径**：`{output_path.relative_to(self.prompt_dir)}`
📊 **内容长度**：{len(content)} 字符
🕒 **保存时间**：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

你可以在以下位置找到保存的文件：
`{output_path}`
"""
            return result

        except Exception as e:
            return f"❌ 自动保存失败：{e}"
    

    
    def list_prompts(self) -> str:
        """列出所有可用的prompt"""
        result = ["📋 可用的Prompt列表：", "-" * 40]
        
        for md_file in self.prompt_dir.rglob("*.md"):
            if (md_file.name in ["README.md", "USAGE_EXAMPLES.md"] or
                "output" in md_file.parts):
                continue
            relative_path = md_file.relative_to(self.prompt_dir)
            prompt_name = str(relative_path).replace('.md', '')
            result.append(f"  • {prompt_name}")
            result.append(f"    文件：{relative_path}")
            result.append("")
        
        return '\n'.join(result)


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="PP - Prompt Pipeline 工作流引擎",
        epilog="示例: python pp.py \"你的文字 |> 文章改写 |> 极简侘寂 |> 保存文件\"",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "command",
        help="管道命令，格式：'输入文字 |> prompt1 |> prompt2 |> ...'",
        nargs='?'
    )

    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="列出所有可用的prompt"
    )
    parser.add_argument(
        "--save", "-s",
        type=str,
        help="保存从stdin读取的内容到指定文件名"
    )
    parser.add_argument(
        "--auto-save",
        type=str,
        help="自动保存AI处理结果（内部使用）"
    )
    
    args = parser.parse_args()
    
    pipeline = PromptPipeline()
    
    if args.list:
        print(pipeline.list_prompts())
        return

    if args.save:
        # 保存模式：从stdin读取内容并保存
        try:
            print(f"📝 准备保存到文件：{args.save}")
            print("请粘贴要保存的内容，完成后按 Ctrl+D (Mac/Linux) 或 Ctrl+Z+Enter (Windows)：")
            print("-" * 60)

            # 读取stdin内容
            content_lines = []
            try:
                while True:
                    line = input()
                    content_lines.append(line)
            except EOFError:
                pass

            content = '\n'.join(content_lines)

            if not content.strip():
                print("❌ 错误：没有接收到内容")
                return

            # 保存文件
            output_path = pipeline.save_output(content, [], custom_filename=args.save)
            print(f"\n✅ 内容已保存到：{output_path}")
            print(f"📁 相对路径：{output_path.relative_to(pipeline.prompt_dir)}")

        except KeyboardInterrupt:
            print("\n❌ 保存被用户中断")
        except Exception as e:
            print(f"❌ 保存失败：{e}")
        return

    if args.auto_save:
        # 自动保存模式：从stdin读取AI处理结果并自动保存
        try:
            # 读取stdin内容
            content_lines = []
            try:
                while True:
                    line = input()
                    content_lines.append(line)
            except EOFError:
                pass

            content = '\n'.join(content_lines)

            if not content.strip():
                print("❌ 错误：没有接收到AI处理结果")
                return

            # 调用自动保存
            result = pipeline.auto_save_result(content, args.auto_save)
            print(result)

        except KeyboardInterrupt:
            print("\n❌ 自动保存被用户中断")
        except Exception as e:
            print(f"❌ 自动保存失败：{e}")
        return
    
    if not args.command:
        print("❌ 错误：请提供管道命令")
        print("\n使用方法：")
        print("  python pp.py \"输入文字 |> prompt1 |> prompt2\"")
        print("  python pp.py --list  # 查看可用prompt")
        print("  python pp.py --save filename.md  # 保存内容到文件")
        print("  python pp.py --help  # 查看帮助")
        return
    
    result = pipeline.session_mode(args.command)
    
    print(result)


if __name__ == "__main__":
    main()
