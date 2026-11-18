/**
 * 个人页面
 * 使用通用分类页面基类
 */

// 个人页面配置
const personalPageConfig = {
    categoryTag: '个人',
    categoryName: '个人',
    loggerPrefix: 'PERSONAL',
    articlesPerPage: 20,
    defaultTitle: '个人相关文章',
    filteredTitle: '筛选后的个人文章'
};

// 初始化个人页面
function initializePersonalPage() {
    // 等待基类加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            // 使用通用分类页面初始化函数
            initializeCategoryPage(personalPageConfig);
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，个人页面初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePersonalPage);
} else {
    initializePersonalPage();
}