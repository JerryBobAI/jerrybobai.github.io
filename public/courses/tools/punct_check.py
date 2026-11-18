#!/usr/bin/env python3
"""中文标点检查/纠错：扫描课程内容里中文语境的半角标点。

用法：
  python3 tools/punct_check.py            # 报告模式：只列出问题，不修改
  python3 tools/punct_check.py --fix      # 自动修正
  python3 tools/punct_check.py --fix --fix-parens   # 连内含中文的半角括号对一起改

规则：
  - 左邻是中文字符的半角标点 , ; : ? ! . → 对应全角
  - 半角括号对内含中文 → （），--fix-parens 才改；纯英文括号如 (LSTM) 不动
  - <code>/<pre>/markdown 围栏与行内码：完全不动
  - <script> 段：只动 JS 字符串字面量内的文本（课程数据/文案），语法位永不触碰
  - 嵌套括号需多轮收敛，脚本自动迭代
  - 添加新课程收尾时必跑：--fix 后再跑报告确认归零
"""
import re
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP_DIRS = {'lectures', 'audio', 'readings', 'repos', 'site', '.git'}
EXTS = {'.html', '.md', '.txt'}
CJK = r'一-鿿㐀-䶿'
MAP = {',': '，', ';': '；', ':': '：', '?': '？', '!': '！', '.': '。'}

# 保护段：script / 行内代码 / 代码块 / md 围栏（md 里不出现 script，无碍）
SEG = re.compile(
    r'(<script\b.*?</script>|<code\b.*?</code>|<pre\b.*?</pre>|```.*?```|`[^`\n]+`)', re.S)
# JS 字符串字面量（双/单引号、模板串，含 \ 转义）
JS_STR = re.compile(r'("(?:[^"\\]|\\.)*"|\'(?:[^\'\\]|\\.)*\'|`(?:[^`\\]|\\.)*`)', re.S)
PAREN = re.compile(r'\(([^()]*)\)')


def map_sub(seg, stats):
    """纯文本段：左邻 CJK 的半角标点 → 全角"""
    for half, full in MAP.items():
        seg, n = re.subn('(?<=[%s])[%s]' % (CJK, re.escape(half)), full, seg)
        if n:
            stats[half] = stats.get(half, 0) + n
    return seg


def paren_sub(seg, stats):
    """半角括号对内含中文 → 全角括号。嵌套按外层迭代收敛，单遍只处理最内层。"""
    count = 0

    def _r(m):
        nonlocal count
        inner = m.group(1)
        if re.search('[%s]' % CJK, inner):
            count += 1
            return '（%s）' % inner
        return m.group(0)

    seg = PAREN.sub(_r, seg)
    if count:
        stats['()'] = stats.get('()', 0) + count
    return seg


def fix_script(part, stats, fix_parens):
    """script 段：JS 字符串字面量内只做标点替换（左邻 CJK 才触发，语法位天然安全）。
    括号对替换在此禁用——正则字面量配对会被英文撇号（Sutskever's）带偏，
    一旦奇偶错位就会把语法位括号（如 alert(）当内容改掉，破坏 JS 语法。"""
    subs = JS_STR.split(part)
    for j in range(1, len(subs), 2):
        subs[j] = map_sub(subs[j], stats)
    return ''.join(subs)


def process(s, fix_parens=False):
    stats = {}
    parts = SEG.split(s)
    for i, part in enumerate(parts):
        if i % 2 == 0:  # 普通文本
            part = map_sub(part, stats)
            if fix_parens:
                for _ in range(5):
                    new = paren_sub(part, stats)
                    if new == part:
                        break
                    part = new
            parts[i] = part
        elif part.startswith('<script'):
            parts[i] = fix_script(part, stats, fix_parens)
        # code/pre/围栏：不动
    return ''.join(parts), stats


def count_problems(s):
    """报告模式：同样走 process 但只统计"""
    _, stats = process(s)
    return stats


def main():
    fix = '--fix' in sys.argv
    fix_parens = '--fix-parens' in sys.argv
    files_changed = total = 0
    for f in sorted(ROOT.rglob('*')):
        if f.suffix not in EXTS or not f.is_file():
            continue
        if any(p in SKIP_DIRS for p in f.relative_to(ROOT).parts):
            continue
        s = f.read_text(errors='ignore')
        if fix:
            new, stats = process(s, fix_parens)
            n = sum(stats.values())
            if n:
                f.write_text(new)
                files_changed += 1
                total += n
                print(f"{f.relative_to(ROOT)}: {n} 处 {stats}")
        else:
            stats = count_problems(s)
            if stats:
                files_changed += 1
                total += sum(stats.values())
                print(f"{f.relative_to(ROOT)}: {sum(stats.values())} 处 {stats}")
    print(f"\n{'已修正' if fix else '发现'}: {total} 处（{files_changed} 个文件）")
    if not fix:
        print("自动修正: python3 tools/punct_check.py --fix [--fix-parens]")


if __name__ == '__main__':
    main()
