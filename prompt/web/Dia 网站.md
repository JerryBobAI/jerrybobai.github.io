## 系统提示词

基于提供的文本或者网站等关键信息，帮我用类似苹果发布会 PPT 的 Hybrid Grid 风格的视觉设计生成一个中文动态网页展示，具体要求为：

1. 尽量在一页展示全部信息
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
12. 过程输出也采用简体中文

## 样例输入

面对疾病，你的身体是战场。
医学，是你最精锐的“外部军队”。
意念，是你最坚韧的“内在抵抗”。
只靠抵抗，无法赢得战争。
没有抵抗，军队将孤立无援。
所以，请让你的医生，去治你的“病”。
而你，用你的意念，去疗愈你的“生命”。
这，才是完整的回归之路。

## 样例输出

好的，收到您的需求。这是一个非常富有哲理和力量的文本，非常适合用苹果发布会那种宏大、简洁、充满情感张力的 Hybrid Grid 风格来呈现。

我将严格按照您的要求，为您构建一个单页动态网站。

### 设计思路解析

1.  **叙事结构**：我将把您的文本拆分为五个核心叙事章节，每个章节占据一整个屏幕视区，通过滚动来逐一展现，营造出 PPT 翻页的沉浸感。
	*   **章节一：战场 (The Battlefield)** - 引入核心隐喻。
	*   **章节二：两股力量 (The Forces)** - 对比呈现“医学”与“意念”。
	*   **章节三：依存关系 (The Synergy)** - 阐述两者缺一不可的逻辑。
	*   **章节四：分工与疗愈 (The Mission)** - 明确医生和患者各自的使命。
	*   **章节五：回归之路 (The Path Home)** - 升华主题，点明最终目标。

2.  **视觉设计**：
	*   **背景**：我将创建一个贯穿整个页面的、动态缓变的“色彩云雾”背景。它会由您提到的粉紫、暖橘和静蓝色调柔和地融合而成，作为整个页面的视觉灵魂。
	*   **字体与排版**：使用超大号、粗体的中文字体作为视觉锤，牢牢抓住用户的注意力。小号、大写、有间距的英文作为副标题或点缀，增加设计的国际感和精致度。
	*   **图形元素**：关键概念（如军队、抵抗、病、生命）将使用简洁的SVG勾线图形来可视化，既符合现代审美，又能清晰传达信息。
	*   **色彩**：主色调为黑、白、灰，确保信息的可读性。高亮色将从背景的色彩云雾中提取，比如用沉静的蓝色代表“医学”，用充满活力的粉紫色代表“意念”。这些高亮色会以纯色块或透明度渐变的形式出现，制造科技感和视觉焦点。
	*   **布局**：大量留白，采用居中或对称的网格布局，使每个章节的视觉焦点都极其突出，形成强烈的视觉反差。

3.  **技术实现**：
	*   **框架**：使用 HTML5 和通过 CDN 引入的 TailwindCSS v3.4.1。
	*   **动态效果**：使用原生 JavaScript 和 Intersection Observer API 实现滚动到视区时的元素淡入、上浮等动画效果，增强页面的动态感和叙事节奏。
	*   **图标**：通过 CDN 引入 Font Awesome 6，用于辅助性图标。
	*   **响应式**：代码将完全兼容从桌面到超宽屏（1920px及以上）的显示。

---

### 动态网页成品

以下是为您生成的完整 HTML 代码。您只需将此代码保存为一个 `.html` 文件，然后用浏览器打开即可看到最终效果。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>完整的回归之路 - The Complete Path Home</title>

    <!-- TailwindCSS via CDN -->
    <script src="https://cdn.tailwindcss.com/3.4.1"></script>

    <!-- Font Awesome via CDN -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

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
</head>
<body class="antialiased">

    <!-- 动态极光背景 -->
    <div class="aurora-background">
        <div class="aurora-blob blob-1"></div>
        <div class="aurora-blob blob-2"></div>
        <div class="aurora-blob blob-3"></div>
        <div class="aurora-blob blob-4"></div>
    </div>

    <main class="relative z-10">

        <!-- Section 1: 战场 -->
        <section class="min-h-screen w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden">
            <div class="scroll-reveal">
                <p class="text-xl md:text-2xl text-gray-500 mb-4 tracking-widest uppercase">The Battlefield</p>
                <h1 class="text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-gray-800 leading-none">战场</h1>
                <p class="mt-8 text-2xl md:text-3xl lg:text-4xl max-w-4xl mx-auto text-gray-700">
                    面对疾病，你的身体是战场。
                </p>
            </div>
        </section>

        <!-- Section 2: 两股力量 -->
        <section class="min-h-screen w-full flex items-center justify-center p-8 overflow-hidden">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24 w-full max-w-7xl mx-auto">
                <!-- 左侧：医学 -->
                <div class="scroll-reveal text-center md:text-left bg-white/30 backdrop-blur-xl rounded-3xl p-8 lg:p-12 shadow-xl">
                    <p class="text-base text-blue-600 mb-2 tracking-widest uppercase">External Army</p>
                    <h2 class="text-5xl md:text-6xl font-bold tracking-tight mb-4">医学</h2>
                    <p class="text-xl md:text-2xl text-gray-600 mb-8">
                        是你最精锐的<span class="font-bold text-blue-600">“外部军队”</span>。
                    </p>
                    <div class="text-6xl text-blue-500 relative inline-block tech-glow-blue">
                        <i class="fa-solid fa-shield-virus"></i>
                    </div>
                </div>
                <!-- 右侧：意念 -->
                <div class="scroll-reveal text-center md:text-right bg-white/30 backdrop-blur-xl rounded-3xl p-8 lg:p-12 shadow-xl" style="transition-delay: 200ms;">
                    <p class="text-base text-purple-600 mb-2 tracking-widest uppercase">Internal Resistance</p>
                    <h2 class="text-5xl md:text-6xl font-bold tracking-tight mb-4">意念</h2>
                    <p class="text-xl md:text-2xl text-gray-600 mb-8">
                        是你最坚韧的<span class="font-bold text-purple-600">“内在抵抗”</span>。
                    </p>
                    <div class="text-6xl text-purple-500 relative inline-block tech-glow-purple">
                         <i class="fa-solid fa-brain"></i>
                    </div>
                </div>
            </div>
        </section>

        <!-- Section 3: 依存关系 -->
        <section class="min-h-screen w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden">
             <div class="scroll-reveal mb-12">
                <p class="text-xl md:text-2xl text-gray-500 mb-4 tracking-widest uppercase">The Synergy</p>
                <h2 class="text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter text-gray-800 leading-none">缺一不可</h2>
             </div>
             <div class="flex flex-col md:flex-row gap-8 max-w-5xl w-full">
                <div class="scroll-reveal w-full p-8 bg-white/20 backdrop-blur-lg rounded-2xl text-center border border-white/20">
                    <p class="text-2xl md:text-3xl text-gray-700">只靠抵抗，<br><span class="opacity-50">无法赢得战争。</span></p>
                </div>
                <div class="scroll-reveal w-full p-8 bg-white/20 backdrop-blur-lg rounded-2xl text-center border border-white/20" style="transition-delay: 200ms;">
                    <p class="text-2xl md:text-3xl text-gray-700">没有抵抗，<br><span class="opacity-50">军队将孤立无援。</span></p>
                </div>
             </div>
        </section>

        <!-- Section 4: 分工与疗愈 -->
        <section class="min-h-screen w-full flex flex-col items-center justify-center p-8 space-y-24 overflow-hidden">
            <div class="scroll-reveal text-center max-w-4xl">
                <p class="text-xl md:text-2xl text-gray-500 mb-4 tracking-widest uppercase">The Mission</p>
                <p class="text-2xl md:text-3xl lg:text-4xl text-gray-700">
                    所以，请让你的医生，去治你的<span class="text-blue-600 font-bold">“病”</span>。
                </p>
                <h2 class="text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter text-blue-500/80 leading-none my-4">病</h2>
                <!-- 勾线图形化 - 靶向治疗 -->
                 <svg class="w-24 h-24 mx-auto text-blue-400" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="50" cy="50" r="10" stroke="currentColor" stroke-width="2"/>
                    <path d="M50 0V25" stroke="currentColor" stroke-width="2"/>
                    <path d="M50 100V75" stroke="currentColor" stroke-width="2"/>
                    <path d="M0 50H25" stroke="currentColor" stroke-width="2"/>
                    <path d="M100 50H75" stroke="currentColor" stroke-width="2"/>
                    <path d="M25 25L40 40" stroke="currentColor" stroke-width="2"/>
                    <path d="M75 75L60 60" stroke="currentColor" stroke-width="2"/>
                    <path d="M25 75L40 60" stroke="currentColor" stroke-width="2"/>
                    <path d="M75 25L60 40" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>

            <div class="scroll-reveal text-center max-w-4xl" style="transition-delay: 300ms;">
                 <p class="text-2xl md:text-3xl lg:text-4xl text-gray-700">
                    而你，用你的意念，去疗愈你的<span class="text-purple-600 font-bold">“生命”</span>。
                </p>
                <h2 class="text-8xl md:text-9xl lg:text-[12rem] font-black tracking-tighter text-purple-500/80 leading-none my-4">生命</h2>
                <!-- 勾线图形化 - 生命活力 -->
                <svg class="w-24 h-24 mx-auto text-purple-400" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M50 15C30.67 15 15 30.67 15 50C15 69.33 30.67 85 50 85C69.33 85 85 69.33 85 50" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M50 15C69.33 15 85 30.67 85 50" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 8"/>
                    <path d="M50 35C41.7157 35 35 41.7157 35 50C35 58.2843 41.7157 65 50 65C58.2843 65 65 58.2843 65 50C65 41.7157 58.2843 35 50 35Z" stroke="currentColor" stroke-width="2"/>
                </svg>
            </div>
        </section>

        <!-- Section 5: 回归之路 -->
        <section class="min-h-screen w-full flex flex-col items-center justify-center p-8 text-center overflow-hidden">
            <div class="scroll-reveal">
                <p class="text-xl md:text-2xl text-gray-500 mb-8 tracking-widest uppercase">The Complete Path Home</p>
                <h2 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 max-w-4xl mx-auto">
                    这，才是完整的
                </h2>
                <h1 class="text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-amber-400">
                    回归之路
                </h1>
                 <!-- 勾线图形化 - 完整的回归之路 -->
                 <svg class="w-48 h-16 mx-auto mt-16 text-gray-400" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 25C35 5, 65 45, 100 25S 165 5, 195 25" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="195" cy="25" r="4" fill="currentColor"/>
                </svg>
            </div>
        </section>

    </main>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, {
                threshold: 0.2 // 元素可见20%时触发
            });

            const hiddenElements = document.querySelectorAll('.scroll-reveal');
            hiddenElements.forEach(el => observer.observe(el));
        });
    </script>

</body>
</html>
```