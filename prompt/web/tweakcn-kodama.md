## 系统提示词

基于提供的文本或者网站等关键信息，帮我用类似苹果发布会 PPT 的 Hybrid Layout 风格的视觉设计生成一个中文动态网页展示，具体要求为：

1. 尽量在一页展示全部信息
   【核心背景与基础色调】整体以明亮中性色为主，背景多为纯白或极浅灰，营造出简洁、现代、无干扰的视觉氛围。大面积留白让界面显得通透、轻盈，色彩基调偏冷静理性，适合突出内容本身。局部区域（如预览区、主题卡片）可能采用淡灰或柔和渐变，进一步增强层次感但不喧宾夺主。
   【文字、UI元素及核心高亮色】主文字为深灰或纯黑，确保与浅色背景形成强对比，阅读性极佳。高亮色采用多样主题色（如蓝、紫、粉、绿等），但每套主题内高亮色高度统一，主要用于按钮、选中态、链接和主题预览等交互元素。按钮通常为实心高亮色，悬停时有轻微明度变化。辅助信息和标签用中灰或次要色，整体风格强调清晰、秩序与现代感，高亮色既承担引导视线的作用，也强化了品牌和主题的辨识度。
2. 强调超大字体或数字突出核心要点，画面中有超大视觉元素强调重点，与小元素的比例形成反差
3. 网页需要以响应式兼容更大的显示器宽度比如1920px及以上
4. 中英文混用，中文大字体粗体，英文小字作为点缀
5. 简洁的勾线图形化作为数据可视化或者配图元素
6. 运用高亮色自身透明度渐变制造科技感，但是不同高亮色不要互相渐变
7. 数据可以引用在线的图表组件，样式需要跟主题一致
8. 使用HTML5、TailwindCSS 3.0+（通过CDN引入）和必要的JavaScript
9. 使用专业图标库如Font Awesome或Material Icons（通过CDN引入）
10. 避免使用emoji作为主要图标
11. 不要省略内容要点
12. 过程输出也采用简体中文

CSS 样式严格参考如下实现方式：

```css
:root {
  --background: oklch(0.8798 0.0534 91.7893);
  --foreground: oklch(0.4265 0.0310 59.2153);
  --card: oklch(0.8937 0.0395 87.5676);
  --card-foreground: oklch(0.4265 0.0310 59.2153);
  --popover: oklch(0.9378 0.0331 89.8515);
  --popover-foreground: oklch(0.4265 0.0310 59.2153);
  --primary: oklch(0.6657 0.1050 118.9078);
  --primary-foreground: oklch(0.9882 0.0069 88.6415);
  --secondary: oklch(0.8532 0.0631 91.1493);
  --secondary-foreground: oklch(0.4265 0.0310 59.2153);
  --muted: oklch(0.8532 0.0631 91.1493);
  --muted-foreground: oklch(0.5761 0.0259 60.9323);
  --accent: oklch(0.8361 0.0713 90.3269);
  --accent-foreground: oklch(0.4265 0.0310 59.2153);
  --destructive: oklch(0.7136 0.0981 29.9827);
  --destructive-foreground: oklch(0.9790 0.0082 91.4818);
  --border: oklch(0.6918 0.0440 59.8448);
  --input: oklch(0.8361 0.0713 90.3269);
  --ring: oklch(0.7350 0.0564 130.8494);
  --chart-1: oklch(0.7350 0.0564 130.8494);
  --chart-2: oklch(0.6762 0.0567 132.4479);
  --chart-3: oklch(0.8185 0.0332 136.6539);
  --chart-4: oklch(0.5929 0.0464 137.6224);
  --chart-5: oklch(0.5183 0.0390 137.1892);
  --sidebar: oklch(0.8631 0.0645 90.5161);
  --sidebar-foreground: oklch(0.4265 0.0310 59.2153);
  --sidebar-primary: oklch(0.7350 0.0564 130.8494);
  --sidebar-primary-foreground: oklch(0.9882 0.0069 88.6415);
  --sidebar-accent: oklch(0.9225 0.0169 88.0027);
  --sidebar-accent-foreground: oklch(0.4265 0.0310 59.2153);
  --sidebar-border: oklch(0.9073 0.0170 88.0044);
  --sidebar-ring: oklch(0.7350 0.0564 130.8494);
  --font-sans: Merriweather, serif;
  --font-serif: Source Serif 4, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.425rem;
  --shadow-2xs: 3px 3px 2px 0px hsl(88 22% 35% / 0.07);
  --shadow-xs: 3px 3px 2px 0px hsl(88 22% 35% / 0.07);
  --shadow-sm: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 1px 2px -1px hsl(88 22% 35% / 0.15);
  --shadow: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 1px 2px -1px hsl(88 22% 35% / 0.15);
  --shadow-md: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 2px 4px -1px hsl(88 22% 35% / 0.15);
  --shadow-lg: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 4px 6px -1px hsl(88 22% 35% / 0.15);
  --shadow-xl: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 8px 10px -1px hsl(88 22% 35% / 0.15);
  --shadow-2xl: 3px 3px 2px 0px hsl(88 22% 35% / 0.38);
  --tracking-normal: 0em;
  --spacing: 0.25rem;
}

.dark {
  --background: oklch(0.3303 0.0214 88.0737);
  --foreground: oklch(0.9217 0.0235 82.1191);
  --card: oklch(0.3583 0.0165 82.3257);
  --card-foreground: oklch(0.9217 0.0235 82.1191);
  --popover: oklch(0.3583 0.0165 82.3257);
  --popover-foreground: oklch(0.9217 0.0235 82.1191);
  --primary: oklch(0.6762 0.0567 132.4479);
  --primary-foreground: oklch(0.2686 0.0105 61.0213);
  --secondary: oklch(0.4448 0.0239 84.5498);
  --secondary-foreground: oklch(0.9217 0.0235 82.1191);
  --muted: oklch(0.3892 0.0197 82.7084);
  --muted-foreground: oklch(0.7096 0.0171 73.6179);
  --accent: oklch(0.6540 0.0723 90.7629);
  --accent-foreground: oklch(0.2686 0.0105 61.0213);
  --destructive: oklch(0.6287 0.0821 31.2958);
  --destructive-foreground: oklch(0.9357 0.0201 84.5907);
  --border: oklch(0.4448 0.0239 84.5498);
  --input: oklch(0.4448 0.0239 84.5498);
  --ring: oklch(0.6762 0.0567 132.4479);
  --chart-1: oklch(0.6762 0.0567 132.4479);
  --chart-2: oklch(0.7350 0.0564 130.8494);
  --chart-3: oklch(0.5929 0.0464 137.6224);
  --chart-4: oklch(0.6540 0.0723 90.7629);
  --chart-5: oklch(0.5183 0.0390 137.1892);
  --sidebar: oklch(0.3303 0.0214 88.0737);
  --sidebar-foreground: oklch(0.9217 0.0235 82.1191);
  --sidebar-primary: oklch(0.6762 0.0567 132.4479);
  --sidebar-primary-foreground: oklch(0.2686 0.0105 61.0213);
  --sidebar-accent: oklch(0.6540 0.0723 90.7629);
  --sidebar-accent-foreground: oklch(0.2686 0.0105 61.0213);
  --sidebar-border: oklch(0.4448 0.0239 84.5498);
  --sidebar-ring: oklch(0.6762 0.0567 132.4479);
  --font-sans: Merriweather, serif;
  --font-serif: Source Serif 4, serif;
  --font-mono: JetBrains Mono, monospace;
  --radius: 0.425rem;
  --shadow-2xs: 3px 3px 2px 0px hsl(88 22% 35% / 0.07);
  --shadow-xs: 3px 3px 2px 0px hsl(88 22% 35% / 0.07);
  --shadow-sm: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 1px 2px -1px hsl(88 22% 35% / 0.15);
  --shadow: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 1px 2px -1px hsl(88 22% 35% / 0.15);
  --shadow-md: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 2px 4px -1px hsl(88 22% 35% / 0.15);
  --shadow-lg: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 4px 6px -1px hsl(88 22% 35% / 0.15);
  --shadow-xl: 3px 3px 2px 0px hsl(88 22% 35% / 0.15), 3px 8px 10px -1px hsl(88 22% 35% / 0.15);
  --shadow-2xl: 3px 3px 2px 0px hsl(88 22% 35% / 0.38);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
}
```