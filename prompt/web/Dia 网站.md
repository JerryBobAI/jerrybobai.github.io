## 系统提示词

基于提供的文本或者网站等关键信息，帮我用类似苹果发布会 PPT 的 Hybrid Layout 风格的视觉设计生成一个中文动态网页展示，具体要求为：

1. 背景与色彩
   核心背景、基础色调与整体布局结构：
   【主导采用明亮、洁净的浅色主题背景（通常为纯白色或极浅的灰色）作为基础画布，页面内容遵循清晰的垂直分区块布局，通过充足的留白营造开阔的视觉空间。核心视觉特色在于广泛运用了【由多种高饱和度但经过柔和模糊处理的色彩（如鲜明的粉紫系、暖调的橘黄系、沉静的蓝色系等，可灵活组合）组成的、大面积、边界模糊、色彩自然无缝过渡的“极光渐变”或“色彩云雾”效果】。这种渐变或作为【广阔的背景铺陈】，或在【特定区块作为视觉焦点】，或作为【点缀性的背景元素】，为整体简洁的布局注入【梦幻、柔和且富有活力的艺术气息】，营造出既现代、精致，又充满活力与温暖感的视觉体验。】
   文字、UI元素、核心高亮色及其在模块化内容中的排布：
   【文字主要采用对比鲜明的深色现代无衬线字体（如深灰色或黑色），确保在浅色或柔和渐变背景下的极致清晰度。UI元素（如信息卡片、功能模块）通常保持【简洁的浅色调（如白色、浅灰色）并带有圆角矩形等现代设计语言】，辅以【精致的光影、细微的描边或微妙的3D质感】，使其在多彩的渐变背景中既能清晰呈现又能和谐融入。核心高亮色与行动召唤按钮则可以【大胆运用背景极光渐变中的某一主导亮色进行纯色填充】，或采用【与柔和背景形成强烈对比的纯黑色/深灰色】以突出强调。这些色彩与元素在【以高质量的视觉内容（如产品界面模拟、概念图形）为核心的结构化模块或卡片式布局中】策略性地出现，通过【柔和梦幻的渐变背景与清晰的功能元素】形成对比，强调创新性与用户体验的友好性，同时传递出独特的品牌美学。】
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
12. 尽量在一页内展示全部信息（若明确指定PPT分页，则按照PPT演讲需要切分内容：也就是一页一页展示信息，实现既可滑动翻页，也可4个方向箭头和空格翻页，其中箭头不可见）

CSS 样式严格参考如下实现方式：

```css
<style>
	/* 自定义全局样式 */
	@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap');

	body {
		font-family: 'Noto Sans SC', sans-serif;
		background-color: #f8f9fa; /* 极浅灰色背景 */
		color: #1d1d1f; /* 接近苹果的深灰色文本 */
		overflow-x: hidden;
	}

	/* 核心：色彩云雾/极光渐变背景 */
	.aurora-background {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: -10;
		overflow: hidden;
	}

	.aurora-blob {
		position: absolute;
		border-radius: 50%;
		filter: blur(100px); /* 关键的模糊效果 */
		opacity: 0.25;
		animation: move 30s infinite alternate;
	}

	.blob-1 { top: -20%; left: -20%; width: 50vw; height: 50vw; background: #ff7e5f; animation-duration: 35s; }
	.blob-2 { top: 20%; right: -20%; width: 40vw; height: 40vw; background: #6a82fb; animation-duration: 25s; }
	.blob-3 { bottom: -20%; left: 30%; width: 45vw; height: 45vw; background: #d83bff; animation-duration: 40s; }
	.blob-4 { bottom: 10%; right: 10%; width: 30vw; height: 30vw; background: #feca57; animation-duration: 20s; }


	@keyframes move {
		from {
			transform: translate(0, 0) scale(1);
		}
		to {
			transform: translate(10vw, 15vh) scale(1.2);
		}
	}

	/* 滚动触发动画的基础样式 */
	.scroll-reveal {
		opacity: 0;
		transform: translateY(30px);
		transition: opacity 0.8s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1);
	}

	.scroll-reveal.visible {
		opacity: 1;
		transform: translateY(0);
	}

	/* 高亮色辉光效果 */
	.tech-glow-blue::after {
		content: '';
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		width: 150%;
		height: 100px;
		background: radial-gradient(circle, rgba(106, 130, 251, 0.3) 0%, rgba(106, 130, 251, 0) 70%);
		z-index: -1;
	}

	.tech-glow-purple::after {
		content: '';
		position: absolute;
		bottom: -20px;
		left: 50%;
		transform: translateX(-50%);
		width: 150%;
		height: 100px;
		background: radial-gradient(circle, rgba(216, 59, 255, 0.3) 0%, rgba(216, 59, 255, 0) 70%);
		z-index: -1;
	}

</style>
```