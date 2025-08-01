## 系统提示词

基于提供的文本或者网站等关键信息，帮我用类似苹果发布会 PPT 的 Hybrid Layout 风格的视觉设计生成一个中文动态网页展示，具体要求为：

1. 背景与色彩
   【核心背景与基础色调】整体界面风格清新、现代，以浅灰色或米白色作为背景，各个模块以圆角卡片的形式呈现。卡片内部有部分使用了深灰或纯白，使界面有较好的区分度。
   【文字、UI元素及核心高亮色】主要文字颜色为深灰色或黑色，保证可读性。数字和图表使用了鲜艳的绿色和紫色作为高亮色，用于突出关键数据。在深色背景的卡片中，文字会相应地变成浅色。各模块使用统一致的圆角，整体观感和谐统一。
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
12. 默认尽量在一页内展示全部信息（允许纵向滚动显示）
13. 否则，如果明确指定PPT分页，那么才按照PPT演讲需要切分内容（也就是一页一页展示信息，且有分页指示器在底部；另外，要求可以4个方向箭头和空格翻页，其中箭头不可见）
