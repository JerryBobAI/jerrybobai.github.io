// UI小部件 - iframe预览卡片、文章卡片等可复用组件

// =============== iframe预览组件 ===============

// 定义一个全局函数，用于初始化iframe预览组件
function initializeIframePreviews() {
    // 初始化置顶文章预览
    initializePreviews('[data-component="pinned-previews"]', true);

    // 初始化普通文章预览
    initializePreviews('[data-component="iframe-previews"]', false);
}

// 通用预览初始化函数
function initializePreviews(selector, isPinned) {
    // 查找预览容器
    const previewsContainer = document.querySelector(selector);
    if (!previewsContainer) return;

    // 获取预览数据属性
    const previewsDataStr = previewsContainer.getAttribute('data-previews');
    if (!previewsDataStr) return;

    try {
        // 解析预览数据
        const previews = JSON.parse(previewsDataStr);
        if (!Array.isArray(previews) || previews.length === 0) return;

        // 根据是否置顶设置不同的样式
        let containerClass = 'grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 px-4 md:px-8 lg:px-12 w-full max-w-screen-xl mx-auto';
        let itemClass = 'preview-item hover:scale-105 transition-transform duration-300 ease-in-out';
        let iframeClass = 'preview-iframe w-full';
        let iframeHeight = '400px';

        // 置顶文章的特殊处理
        if (isPinned) {
            containerClass = 'grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 px-4 md:px-8 lg:px-12 w-full max-w-screen-xl mx-auto';
            itemClass = 'preview-item pinned-preview-item hover:scale-105 transition-transform duration-300 ease-in-out';
            iframeClass = 'preview-iframe w-full pinned-iframe';
            iframeHeight = '450px';
        }

        // 创建容器元素
        const containerWrapper = document.createElement('div');
        containerWrapper.className = 'mb-12';

        // 创建响应式容器
        const responsiveContainer = document.createElement('div');
        responsiveContainer.className = containerClass;

        // 生成预览HTML
        previews.forEach(preview => {
            const { title, link, src } = preview;

            const previewItem = document.createElement('div');
            previewItem.className = itemClass;

            // 添加置顶标记（如果是置顶文章）
            let pinnedBadge = '';
            if (isPinned) {
                pinnedBadge = `
                    <div class="pinned-badge" style="
                        position: absolute !important;
                        top: 16px !important;
                        right: 16px !important;
                        background: rgba(234, 230, 225, 0.95) !important;
                        color: #3D3D3D !important;
                        padding: 0.375rem 0.75rem !important;
                        border-radius: 1rem !important;
                        font-size: 0.75rem !important;
                        font-weight: 500 !important;
                        z-index: 10 !important;
                        display: flex !important;
                        align-items: center !important;
                        gap: 0.25rem !important;
                        box-shadow: 0 2px 8px rgba(61, 61, 61, 0.1) !important;
                        backdrop-filter: blur(8px) !important;
                        border: 1px solid rgba(104, 144, 148, 0.15) !important;
                        transition: all 0.3s ease !important;
                        font-family: 'Noto Sans SC', sans-serif !important;
                    ">
                        <i class="fas fa-star" style="
                            font-size: 0.625rem !important;
                            color: #689094 !important;
                        "></i>
                        <span>置顶</span>
                    </div>
                `;
            }

            // 构建日期和标签信息
            const metaInfo = buildPreviewMetaInfo(preview);

            previewItem.innerHTML = `
                <div class="preview-card">
                    <a href="${link}" target="_blank" title="${title || '查看完整内容'}" class="block w-full relative">
                        ${pinnedBadge}
                        <iframe
                            src="${src}"
                            class="${iframeClass}"
                            style="height: ${iframeHeight};"
                            frameborder="0"
                            scrolling="no"
                            title="${title || '内容预览'}">
                        </iframe>
                        ${metaInfo}
                    </a>
                </div>
            `;

            responsiveContainer.appendChild(previewItem);
        });

        // 将响应式容器添加到外层容器
        containerWrapper.appendChild(responsiveContainer);

        // 清空并设置容器的内容
        previewsContainer.innerHTML = '';
        previewsContainer.appendChild(containerWrapper);

        // 延迟检测背景色并应用深色模式样式
        setTimeout(() => {
            applyDarkModeToPreviewCards();
        }, 100);

        console.log(`${isPinned ? '置顶' : '普通'}文章预览组件初始化完成，共加载`, previews.length, '篇文章');

    } catch (error) {
        console.error('解析预览数据时出错:', error);
    }
}

// 构建预览meta信息
function buildPreviewMetaInfo(preview) {
    const date = preview.date || '';
    const tags = preview.tags || ['博客'];

    // 格式化日期
    let formattedDate = '';
    if (date) {
        try {
            const dateObj = new Date(date);
            formattedDate = dateObj.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (e) {
            formattedDate = date;
        }
    }

    // 使用共享的标签构建函数 - 自动检测背景色
    const tagsHtml = buildTagsHtml(tags, {
        padding: 'px-2 py-1',
        withAnimation: false  // iframe预览不需要动画
        // 不指定 isDarkBackground，让函数自动检测
    });

    return `
        <div class="preview-meta">
            <div class="flex items-center justify-between text-sm px-3 py-2">
                <div class="flex items-center gap-2">
                    <i class="far fa-calendar-alt" style="color: #9CA3AF;"></i>
                    <span class="font-context font-normal" style="color: #9CA3AF;">${formattedDate}</span>
                </div>
                <div class="flex flex-wrap gap-1 items-center">
                    ${tagsHtml}
                </div>
            </div>
        </div>
    `;
}

// =============== 深色模式适配 ===============

// 为预览卡片应用深色模式样式
function applyDarkModeToPreviewCards() {
    // 获取所有预览卡片
    const previewCards = document.querySelectorAll('.preview-card');
    if (previewCards.length === 0) {
        console.log('🎨 未找到预览卡片，跳过深色模式适配');
        return;
    }

    previewCards.forEach((card, index) => {
        try {
            // 获取iframe元素
            const iframe = card.querySelector('iframe');
            if (!iframe) return;

            // 等待iframe加载完成后检测背景色
            const checkIframeBackground = () => {
                try {
                    // 尝试访问iframe内容（可能受跨域限制）
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iframeDoc && iframeDoc.body) {
                        const iframeStyle = iframe.contentWindow.getComputedStyle(iframeDoc.body);
                        const bgColor = iframeStyle.backgroundColor;

                        console.log(`🎨 检测iframe ${index + 1} 背景色:`, bgColor);

                        // 简单的深色检测：检查背景色的亮度
                        const isIframeDark = isBackgroundDark(bgColor);

                        if (isIframeDark) {
                            card.classList.add('dark-bg');
                            console.log(`✅ 为预览卡片 ${index + 1} 应用深色模式样式`);
                        } else {
                            card.classList.remove('dark-bg');
                            console.log(`✅ 为预览卡片 ${index + 1} 应用浅色模式样式`);
                        }
                    }
                } catch (e) {
                    // 跨域限制，使用全局背景检测作为备选
                    console.log(`🎨 iframe ${index + 1} 跨域限制，使用全局背景检测`);

                    // 使用全局背景检测
                    if (typeof window.isDarkBackground === 'function') {
                        const isDark = window.isDarkBackground();
                        if (isDark) {
                            card.classList.add('dark-bg');
                            console.log(`✅ 为预览卡片 ${index + 1} 应用深色模式样式（全局检测）`);
                        } else {
                            card.classList.remove('dark-bg');
                            console.log(`✅ 为预览卡片 ${index + 1} 应用浅色模式样式（全局检测）`);
                        }
                    }
                }
            };

            // 等待iframe加载完成
            iframe.addEventListener('load', checkIframeBackground);
            // 备用方案：延迟检测
            setTimeout(checkIframeBackground, 500);

        } catch (e) {
            console.warn(`预览卡片 ${index + 1} 背景检测失败:`, e);
        }
    });

    console.log('🎨 预览卡片深色模式适配完成');
}

// 简单的背景色深浅检测函数
function isBackgroundDark(bgColor) {
    if (!bgColor || bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') {
        return false;
    }

    // 解析RGB值
    const rgb = bgColor.match(/\d+/g);
    if (!rgb || rgb.length < 3) return false;

    // 计算亮度 (使用相对亮度公式)
    const r = parseInt(rgb[0]);
    const g = parseInt(rgb[1]);
    const b = parseInt(rgb[2]);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // 亮度小于128认为是深色
    return brightness < 128;
}

// =============== 文章卡片组件 ===============

// 初始化文章卡片组件
function initializeArticleCards() {
    // 查找文章卡片容器
    const articleCardsContainer = document.querySelector('[data-component="article-cards"]');
    if (!articleCardsContainer) return;

    // 获取文章数据属性
    const articlesDataStr = articleCardsContainer.getAttribute('data-articles');
    if (!articlesDataStr) return;

    try {
        // 解析文章数据
        const articles = JSON.parse(articlesDataStr);
        if (!Array.isArray(articles) || articles.length === 0) return;

        // 生成文章卡片HTML
        const cardsHTML = articles.map(article => {
            const {
                title,
                subtitle,
                description,
                link,
                gradient = 'from-blue-600 to-indigo-700',
                textColor = 'text-blue-600'
            } = article;

            return `
                <a href="${link}" class="article-card">
                    <div class="article-card-inner bg-white">
                        <div class="p-6 bg-gradient-to-r ${gradient} text-white">
                            <h3 class="text-xl font-bold mb-2">${title}</h3>
                            <p class="opacity-90">${subtitle}</p>
                        </div>
                        <div class="p-6">
                            <p class="text-gray-700">${description}</p>
                            <div class="mt-4 flex justify-end">
                                <span class="inline-flex items-center ${textColor}">
                                    阅读全文 <i class="fas fa-arrow-right ml-2"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </a>
            `;
        }).join('');

        // 设置容器的HTML
        articleCardsContainer.innerHTML = cardsHTML;

        // 添加网格布局类
        articleCardsContainer.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-8', 'mb-16');

        console.log('文章卡片组件初始化完成，共加载', articles.length, '篇文章');

    } catch (error) {
        console.error('Error parsing article data:', error);
    }
}

// =============== 小部件系统初始化 ===============

// 初始化所有小部件
function initializeWidgets() {
    console.log('🚀 开始初始化UI小部件');
    
    // 初始化iframe预览组件
    initializeIframePreviews();
    
    // 初始化文章卡片组件
    initializeArticleCards();
    
    console.log('✅ UI小部件初始化完成');
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.initializeIframePreviews = initializeIframePreviews;
    window.initializeArticleCards = initializeArticleCards;
    window.initializeWidgets = initializeWidgets;
    window.buildPreviewMetaInfo = buildPreviewMetaInfo;
    window.applyDarkModeToPreviewCards = applyDarkModeToPreviewCards;
    window.isBackgroundDark = isBackgroundDark;
}

// 页面加载完成后自动初始化小部件
document.addEventListener('DOMContentLoaded', function() {
    // 如果页面上已经有预设的data-previews或data-articles属性，则直接初始化
    const previewsContainer = document.querySelector('[data-component="iframe-previews"]');
    const pinnedContainer = document.querySelector('[data-component="pinned-previews"]');
    const articleCardsContainer = document.querySelector('[data-component="article-cards"]');

    if ((previewsContainer && previewsContainer.getAttribute('data-previews')) ||
        (pinnedContainer && pinnedContainer.getAttribute('data-previews')) ||
        (articleCardsContainer && articleCardsContainer.getAttribute('data-articles'))) {
        initializeWidgets();
    }
    // 否则，等待其他脚本加载数据后再初始化
});
