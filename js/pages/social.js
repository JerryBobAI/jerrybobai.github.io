/**
 * 社交页面
 * 使用通用分类页面基类
 */

// 社交页面配置
const socialPageConfig = {
    categoryTag: '社交',
    categoryName: '社交',
    loggerPrefix: 'SOCIAL',
    articlesPerPage: 20,
    defaultTitle: '社交相关文章',
    filteredTitle: '筛选后的社交文章'
};

// 初始化社交页面
function initializeSocialPage() {
    // 等待基类加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            // 使用通用分类页面初始化函数
            initializeCategoryPage(socialPageConfig);
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，社交页面初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSocialPage);
} else {
    initializeSocialPage();
}