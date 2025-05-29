// 组件系统 - 用于加载共享的HTML组件

// 常量定义
const REPO_NAME = 'jerrybobai.github.io';
const METADATA_PATH = '../cache/metadata.json'; // 使用相对路径解决CORS问题

// 缓存元数据信息
let metadataCache = {};

// 加载元数据缓存
async function loadMetadataCache() {
    try {
        const response = await fetch(METADATA_PATH);
        if (response.ok) {
            metadataCache = await response.json();
            console.log('元数据加载成功:', metadataCache);
        } else {
            console.error('无法加载元数据文件');
        }
    } catch (error) {
        console.error('加载元数据时出错:', error);
    }
}

// 获取当前页面的元数据
function getPageMetadata(path) {
    if (!metadataCache) return null;

    // 将路径标准化为相对路径
    let normalizedPath = path;

    // 如果是URL编码的路径，尝试解码
    console.log('解码前的路径:', normalizedPath);
    try {
        normalizedPath = decodeURIComponent(normalizedPath);
        console.log('解码后的路径:', normalizedPath);
    } catch (e) {
        console.log('路径解码失败:', e);
    }

    // 删除开头的斜杠
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
        console.log('删除开头斜杠后的路径:', normalizedPath);
    }

    // 删除仓库名前缀
    if (normalizedPath.includes(REPO_NAME + '/')) {
        normalizedPath = normalizedPath.substring(normalizedPath.indexOf(REPO_NAME + '/') + (REPO_NAME + '/').length);
        console.log('删除仓库名后的路径:', normalizedPath);
    }

    // 直接匹配标准化路径
    if (metadataCache[normalizedPath]) {
        console.log('匹配成功，找到元数据:', normalizedPath);
        return metadataCache[normalizedPath];
    }

    // 如果还是找不到，返回默认值
    console.log('未找到元数据，路径:', normalizedPath);
    return null;
}

document.addEventListener('DOMContentLoaded', async function() {
    // 加载元数据缓存
    await loadMetadataCache();

    // 获取当前路径（全局使用）
    let currentPath = window.location.pathname;

    // 调试信息 - 在控制台输出当前路径
    console.log('当前路径:', currentPath);

    // 检查是否在根目录（首页）（全局使用）
    const isRoot = currentPath === '/' ||
                currentPath === '/index.html' ||
                currentPath === '/' + REPO_NAME ||
                currentPath === '/' + REPO_NAME + '/' ||
                currentPath === '/' + REPO_NAME + '/index.html' ||
                (currentPath.endsWith('/index.html') && !currentPath.includes('/docs/'));

    // 调试信息
    console.log('是否为首页:', isRoot);

    // 加载header组件
    const headerElement = document.querySelector('[data-component="header"]');
    if (headerElement) {

        // 检查是否在docs目录下
        const isInDocs = currentPath.includes('/docs/');

        // 根据当前路径设置正确的相对路径前缀
        const prefix = isRoot ? '' : (isInDocs ? '../../' : '');

        // 确定当前活跃的导航项
        let homeClass = isRoot ? 'active' : '';
        let aiClass = currentPath.includes('/docs/ai/') ? 'active' : '';
        let personalClass = currentPath.includes('/docs/personal/') ? 'active' : '';
        let familyClass = currentPath.includes('/docs/family/') ? 'active' : '';
        let workClass = currentPath.includes('/docs/work/') ? 'active' : '';
        let socialClass = currentPath.includes('/docs/social/') ? 'active' : '';

        // 构建header HTML
        headerElement.innerHTML = `
            <div class="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
                <!-- Logo 和标题 -->
                <div class="flex items-center">
                    <a href="${prefix}index.html" class="flex items-center hover:opacity-90 transition-opacity">
                        <img src="${prefix}images/logo.png" alt="Logo" class="h-10 w-10 rounded-full mr-3">
                        <span class="text-2xl font-bold text-gray-800">JerryBob</span>
                    </a>
                </div>
                <!-- 菜单 -->
                <nav class="hidden md:flex space-x-6">
                    <a href="${prefix}index.html" class="nav-link ${homeClass}">首页</a>
                    <a href="${prefix}docs/ai/index.html" class="nav-link ${aiClass}">AI</a>
					<a href="${prefix}docs/personal/index.html" class="nav-link ${personalClass}">个人</a>
                    <a href="${prefix}docs/family/index.html" class="nav-link ${familyClass}">家庭</a>
                    <a href="${prefix}docs/work/index.html" class="nav-link ${workClass}">工作</a>
                    <a href="${prefix}docs/social/index.html" class="nav-link ${socialClass}">社交</a>
                </nav>
            </div>
        `;
    }

    // 渲染文章元信息组件
    const articleMetaElement = document.querySelector('[data-component="article-meta"]');

	// 检查是否在iframe中
    const isInIframe = window.self !== window.top;

    // 是否显示元信息：仅当docs目录下且不是index.html且不是iframe时显示
    const showMetaData = articleMetaElement && !isInIframe && currentPath.includes('/docs/') && !currentPath.endsWith('index.html');
    if (showMetaData) {
        // 获取当前页面的元数据
        const metadata = getPageMetadata(currentPath);
        console.log('当前页面元数据:', metadata);

        // 获取当前日期（如果元数据中没有）
        const today = new Date();
        const dateStr = metadata?.date || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            // 确定标签
            let tags = [];
            if (metadata && metadata.tags) {
                tags = metadata.tags;
                console.log('显示标签:', tags);
            } else {
                // 如果元数据中没有标签，使用默认标签
                tags = ['博客'];
                console.log('使用默认标签:', tags);
            }

            // 生成标签的多彩背景色
            function getTagColorClass(tag) {
                // 定义可用的所有颜色
                const colors = [
                    'bg-blue-50 text-blue-500 border-blue-200',
                    'bg-indigo-50 text-indigo-500 border-indigo-200',
                    'bg-purple-50 text-purple-500 border-purple-200',
                    'bg-pink-50 text-pink-500 border-pink-200',
                    'bg-green-50 text-green-500 border-green-200',
                    'bg-teal-50 text-teal-500 border-teal-200',
                    'bg-amber-50 text-amber-500 border-amber-200',
                    'bg-orange-50 text-orange-500 border-orange-200',
                    'bg-red-50 text-red-500 border-red-200',
                    'bg-sky-50 text-sky-500 border-sky-200',
                    'bg-cyan-50 text-cyan-500 border-cyan-200',
                    'bg-emerald-50 text-emerald-500 border-emerald-200',
                    'bg-violet-50 text-violet-500 border-violet-200',
                    'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-200',
                    'bg-rose-50 text-rose-500 border-rose-200',
                    'bg-lime-50 text-lime-500 border-lime-200',
                    'bg-yellow-50 text-yellow-500 border-yellow-200',
                    'bg-slate-50 text-slate-500 border-slate-200'
                ];

                // 根据标签字符串生成一个伪随机颜色
                let sum = 0;
                for (let i = 0; i < tag.length; i++) {
                    sum += tag.charCodeAt(i);
                }
                return colors[sum % colors.length];
            }

            // 生成标签 HTML
            const tagsHtml = tags.map(tag => {
                const colorClass = getTagColorClass(tag);
                return `<span class="inline-block ${colorClass} hover:opacity-80 transition-opacity rounded-full px-3 py-1 text-xs font-medium border">${tag}</span>`;
            }).join('');

            // 添加自定义样式到页面头部
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .ultra-light-date {
                    color: rgba(120, 120, 120, 0.7);
                }
                .ultra-light-date i {
                    color: rgba(120, 120, 120, 0.7);
                }
                .home-link {
                    display: inline-flex;
                    align-items: center;
                    margin-right: 8px;
                    transition: opacity 0.2s;
                }
                .home-link:hover {
                    opacity: 0.8;
                }
                .article-meta-blur {
                    backdrop-filter: blur(8px);
                    background: rgba(248, 249, 250, 0.85);
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
            `;
            document.head.appendChild(styleElement);

            // 构建元信息 HTML
            // 计算返回首页的路径
            let homeLink = "../../index.html";
            if (currentPath.split('/').length <= 2) {
                homeLink = "../index.html";
            }

            articleMetaElement.innerHTML = `
                <div class="w-full article-meta-blur">
                    <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap justify-between items-center">
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
    } else {
        // 在首页不显示元信息
        articleMetaElement.style.display = 'none';
    }

    // 加载footer组件
    const footerElement = document.querySelector('[data-component="footer"]');
    if (footerElement) {
        footerElement.innerHTML = `
            <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
                <!-- 左侧版权信息 -->
                <p class="footer-text">© 2025 JerryBob. All rights reserved.</p>
                <!-- 右侧社交链接 -->
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
    }
});
