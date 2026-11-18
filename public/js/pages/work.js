/**
 * 工作页面
 * 使用通用分类页面基类
 */

// 工作页面配置
const workPageConfig = {
    categoryTag: '工作',
    categoryName: '工作',
    loggerPrefix: 'WORK',
    articlesPerPage: 20,
    defaultTitle: '工作相关文章',
    filteredTitle: '筛选后的工作文章'
};

// 初始化工作页面
function initializeWorkPage() {
    // 等待基类加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            // 使用通用分类页面初始化函数
            initializeCategoryPage(workPageConfig);
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，工作页面初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWorkPage);
} else {
    initializeWorkPage();
}