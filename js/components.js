// 组件系统 - 用于加载共享的HTML组件
document.addEventListener('DOMContentLoaded', function() {
    // 加载header组件
    const headerElement = document.querySelector('[data-component="header"]');
    if (headerElement) {
        let currentPath = window.location.pathname;

        // 检查是否在根目录（首页）
        const isRoot = currentPath === '/' ||
                    (currentPath === '/index.html' && !currentPath.includes('/docs/'));

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
            <div class="container flex items-center justify-between h-16">
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

    // 加载footer组件
    const footerElement = document.querySelector('[data-component="footer"]');
    if (footerElement) {
        footerElement.innerHTML = `
            <div class="container flex justify-between items-center">
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
