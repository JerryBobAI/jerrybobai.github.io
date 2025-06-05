// 布局组件 - header、footer、article-meta等页面布局相关组件

// =============== Header组件 ===============

// 渲染Header组件
function renderHeader(currentPath, isRoot) {
    const headerElement = document.querySelector('[data-component="header"]');
    if (!headerElement) return;
    headerElement.classList.add('header-component', 'glass-effect');

    // 路径处理逻辑改进，避免重复路径
    let prefix = '';
    if (!isRoot) {
        // 计算当前页面到网站根目录的路径
        const pathSegments = currentPath.split('/');
        // 如果是docs下的子目录，需要回退两级
        if (pathSegments.length >= 2 && pathSegments[0] === 'docs') {
            prefix = '../../';
        } else if (pathSegments.length >= 1) {
            // 其他情况回退一级
            prefix = '../';
        }
    }

    // 调试输出
    console.log('当前路径:', currentPath, '前缀:', prefix);

    // 设置导航激活状态
    let homeClass = isRoot ? 'active' : '';
    let aiClass = currentPath.includes('/docs/ai/') ? 'active' : '';
    let personalClass = currentPath.includes('/docs/personal/') ? 'active' : '';
    let familyClass = currentPath.includes('/docs/family/') ? 'active' : '';
    let workClass = currentPath.includes('/docs/work/') ? 'active' : '';
    let socialClass = currentPath.includes('/docs/social/') ? 'active' : '';

    // 生成绝对路径的链接
    const homeLink = `${prefix}index.html`;
    const aiLink = `${prefix}docs/ai/index.html`;
    const personalLink = `${prefix}docs/personal/index.html`;
    const familyLink = `${prefix}docs/family/index.html`;
    const workLink = `${prefix}docs/work/index.html`;
    const socialLink = `${prefix}docs/social/index.html`;

    headerElement.innerHTML = `
        <div class="container mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex items-center justify-between h-16">
                <div class="flex items-center">
                    <a href="${homeLink}" class="flex items-center hover:opacity-90 transition-opacity">
                        <img src="${prefix}images/logo.png" alt="Logo" class="h-10 w-10 rounded-full mr-3 flex-shrink-0">
                        <span class="text-xl sm:text-2xl font-bold text-gray-800">JerryBob</span>
                    </a>
                </div>

                <!-- 桌面端导航 -->
                <nav class="hidden md:flex space-x-6">
                    <a href="${homeLink}" class="nav-link ${homeClass}">首页</a>
                    <a href="${aiLink}" class="nav-link ${aiClass}">AI</a>
                    <a href="${personalLink}" class="nav-link ${personalClass}">个人</a>
                    <a href="${familyLink}" class="nav-link ${familyClass}">家庭</a>
                    <a href="${workLink}" class="nav-link ${workClass}">工作</a>
                    <a href="${socialLink}" class="nav-link ${socialClass}">社交</a>
                </nav>

                <!-- 移动端菜单按钮 -->
                <button class="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                        id="mobile-menu-button" aria-expanded="false">
                    <span class="sr-only">打开主菜单</span>
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            <!-- 移动端导航菜单 -->
            <div class="md:hidden hidden" id="mobile-menu">
                <div class="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
                    <a href="${homeLink}" class="mobile-nav-link ${homeClass}">首页</a>
                    <a href="${aiLink}" class="mobile-nav-link ${aiClass}">AI</a>
                    <a href="${personalLink}" class="mobile-nav-link ${personalClass}">个人</a>
                    <a href="${familyLink}" class="mobile-nav-link ${familyClass}">家庭</a>
                    <a href="${workLink}" class="mobile-nav-link ${workClass}">工作</a>
                    <a href="${socialLink}" class="mobile-nav-link ${socialClass}">社交</a>
                </div>
            </div>
        </div>
    `;

    // 添加移动端菜单交互
    setTimeout(() => {
        const mobileMenuButton = document.getElementById('mobile-menu-button');
        const mobileMenu = document.getElementById('mobile-menu');

        if (mobileMenuButton && mobileMenu) {
            mobileMenuButton.addEventListener('click', function() {
                const isExpanded = mobileMenuButton.getAttribute('aria-expanded') === 'true';

                if (isExpanded) {
                    mobileMenu.classList.add('hidden');
                    mobileMenuButton.setAttribute('aria-expanded', 'false');
                } else {
                    mobileMenu.classList.remove('hidden');
                    mobileMenuButton.setAttribute('aria-expanded', 'true');
                }
            });

            // 点击菜单项后关闭菜单
            const mobileNavLinks = mobileMenu.querySelectorAll('.mobile-nav-link');
            mobileNavLinks.forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.classList.add('hidden');
                    mobileMenuButton.setAttribute('aria-expanded', 'false');
                });
            });
        }
    }, 100);
}

// =============== Footer组件 ===============

// 渲染Footer组件
function renderFooter(isRoot) {
    const footerElement = document.querySelector('[data-component="footer"]');
    if (!footerElement) return;
    if (isRoot) {
        footerElement.innerHTML = `
            <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                <p class="footer-text">© 2025 JerryBob. All rights reserved.</p>
                <div class="flex space-x-4">
                    <a href="https://web.okjike.com/u/8d6e830c-4da1-4753-ab41-020b91002aec" target="_blank" class="social-button bg-yellow-400">
                        <span class="social-button-text">J</span>
                    </a>
                    <a href="https://x.com/JerryBobAI" target="_blank" class="social-button bg-black">
                        <span class="social-button-text">X</span>
                    </a>
                </div>
            </div>
        `;
        footerElement.style.display = 'block';
        footerElement.style.opacity = '1';
        console.log('首页显示footer');
    } else {
        footerElement.style.display = 'none';
        console.log('非首页不显示footer');
    }
}

// =============== Article Meta组件 ===============

// 渲染文章元信息组件 - 简化版本
function renderArticleMeta(currentPath, metadataCache) {
    console.log('🔍 开始渲染文章元信息，当前路径:', currentPath);

    // 仅在 docs 目录下且不是首页时显示
    const showMetaData = currentPath.includes('docs/') && !currentPath.endsWith('index.html');
    console.log('是否显示元信息:', showMetaData);

    if (!showMetaData) {
        console.log('❌ 不需要显示元信息，跳过');
        return;
    }

    // 检查是否已存在元信息组件
    let articleMetaElement = document.querySelector('[data-component="article-meta"]');

    // 如果不存在，创建新的元信息组件
    if (!articleMetaElement) {
        console.log('📝 创建新的元信息组件');
        articleMetaElement = document.createElement('div');
        articleMetaElement.setAttribute('data-component', 'article-meta');
        articleMetaElement.className = 'article-meta-component';

        // 简化插入逻辑：直接插入到 body 的开头
        const bodyElement = document.body;
        if (bodyElement && bodyElement.firstChild) {
            bodyElement.insertBefore(articleMetaElement, bodyElement.firstChild);
            console.log('✅ 元信息组件已插入到 body 开头');
        } else {
            console.warn('⚠️ 无法找到 body 元素或 body 为空');
            return;
        }
    }

    // 获取元数据
    const metadata = getPageMetadata(currentPath);
    console.log('📊 获取到的元数据:', metadata);

    // 设置默认值
    const today = new Date();
    const dateStr = metadata?.date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let tags = metadata && metadata.tags ? metadata.tags : ['博客'];

    console.log('📅 使用的日期:', dateStr);
    console.log('🏷️ 使用的标签:', tags);

    // 使用共享的标签构建函数
    let tagsHtml = '';
    if (typeof buildTagsHtml === 'function') {
        tagsHtml = buildTagsHtml(tags, {
            padding: 'px-3 py-1',
            withAnimation: true
        });
    } else {
        console.error('❌ buildTagsHtml 函数未定义，回退到原始方法');
        // 回退到原始方法
        const tagColors = getTagColorsForTags ? getTagColorsForTags(tags) : tags.map(tag => getTagColorClass(tag));
        tagsHtml = tags.map((tag, index) => {
            const colorClass = tagColors[index] || getTagColorClass(tag);
            return `<span class="inline-block ${colorClass} hover:opacity-80 transition-all duration-200 hover:scale-105 rounded-full px-3 py-1 text-xs font-medium border tag-animate" style="animation-delay: ${index * 0.1}s">${tag}</span>`;
        }).join('');
    }

    // 构建元信息 HTML
    let homeLink = "../../index.html";
    if (currentPath.split('/').length <= 2) {
        homeLink = "../index.html";
    }

    // 简化样式
    const styles = `
        <style>
            /* 移除重复的CSS，使用CSS文件中的统一样式 */
            .ultra-light-date {
                color: rgba(107, 114, 128, 0.7);
            }
            .ultra-light-date a {
                color: rgba(107, 114, 128, 0.7);
            }
            .ultra-light-date a:hover {
                color: rgba(107, 114, 128, 0.9);
            }
            /* 简化的 meta 信息样式 */
            .article-meta-component {
                position: sticky !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                width: 100vw !important;
                margin: 0 !important;
                z-index: 1000 !important;
                opacity: 0;
                transform: translateY(-20px);
                animation: slideInFromTop 0.6s ease-out forwards;
            }

            @keyframes slideInFromTop {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .article-meta-blur {
                transition: all 0.3s ease;
            }

            .tag-animate {
                opacity: 0;
                transform: translateY(10px);
                animation: tagFadeIn 0.4s ease-out forwards;
            }

            @keyframes tagFadeIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        </style>
    `;

    // 渲染 HTML 内容
    articleMetaElement.innerHTML = `
        ${styles}
        <div class="w-full article-meta-blur glass-effect">
            <div class="container mx-auto px-4 py-3 flex flex-wrap justify-between items-center">
                <div class="flex items-center ultra-light-date">
                    <a href="${homeLink}" class="home-link">
                        <i class="fa-solid fa-home mr-2" aria-hidden="true"></i>
                    </a>
                    <span class="text-sm font-medium">${dateStr}</span>
                </div>
                <div class="flex flex-wrap gap-2 mt-2 md:mt-0">
                    ${tagsHtml}
                </div>
            </div>
        </div>
    `;

    console.log('✅ 元信息组件渲染完成');
}

// =============== 布局系统初始化 ===============

// 初始化所有布局组件
async function initializeLayout() {
    console.log('🚀 开始初始化布局组件');

    // 等待核心系统初始化完成
    const coreState = await initializeCore();
    if (!coreState) {
        console.error('❌ 核心系统初始化失败');
        return;
    }

    const { currentPath, isRoot } = coreState;
    const metadataCache = getMetadataCache();

    // 渲染各布局组件
    renderHeader(currentPath, isRoot);
    renderArticleMeta(currentPath, metadataCache);
    renderFooter(isRoot);

    console.log('✅ 布局组件初始化完成');
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.renderHeader = renderHeader;
    window.renderFooter = renderFooter;
    window.renderArticleMeta = renderArticleMeta;
    window.initializeLayout = initializeLayout;
}

// 多种方式确保布局组件能够正确加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLayout);
} else if (document.readyState === 'interactive') {
    // DOM 已加载但资源可能还在加载
    setTimeout(initializeLayout, 100);
} else {
    // 页面完全加载
    initializeLayout();
}

// 备用方案：如果上面的都没执行，在 window.onload 时执行
window.addEventListener('load', function() {
    // 检查是否已经初始化过
    if (!document.querySelector('[data-component="article-meta"]')) {
        console.log('🔄 备用方案：在 window.onload 时初始化布局');
        initializeLayout();
    }
});
