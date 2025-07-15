/**
 * 学习页面
 * 使用通用分类页面基类
 */

// 学习页面配置
const learnPageConfig = {
    categoryTag: '学习',
    categoryName: '学习',
    loggerPrefix: 'LEARN',
    articlesPerPage: 20,
    defaultTitle: '学习相关文章',
    filteredTitle: '筛选后的学习文章'
};

// 初始化学习页面
function initializeLearnPage() {
    // 等待基类加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            // 使用通用分类页面初始化函数
            initializeCategoryPage(learnPageConfig);
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，学习页面初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLearnPage);
} else {
    initializeLearnPage();
}