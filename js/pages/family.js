/**
 * 家庭页面
 * 使用通用分类页面基类
 */

// 家庭页面配置
const familyPageConfig = {
    categoryTag: '家庭',
    categoryName: '家庭',
    loggerPrefix: 'FAMILY',
    articlesPerPage: 20,
    defaultTitle: '家庭相关文章',
    filteredTitle: '筛选后的家庭文章'
};

// 初始化家庭页面
function initializeFamilyPage() {
    // 等待基类加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            // 使用通用分类页面初始化函数
            initializeCategoryPage(familyPageConfig);
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，家庭页面初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFamilyPage);
} else {
    initializeFamilyPage();
}