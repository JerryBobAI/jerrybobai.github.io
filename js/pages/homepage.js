/**
 * 首页特有逻辑
 * 处理首页的置顶文章、"鲸波月影"标题、显示更多按钮等
 */

class Homepage {
    constructor() {
        this.showingAll = false;
        this.articlesPerPage = 20;
        this.currentPage = 1;
    }

    /**
     * 初始化首页
     */
    async initialize() {
        try {
            // 立即触发首页动画
            this.initializeAnimations();

            // 加载文章数据
            await articleManager.loadArticlesData();

            // 显示置顶文章
            this.displayPinnedArticles();

            // 初始显示前10篇普通文章
            this.displayInitialArticles();

            // 绑定事件
            this.bindEvents();

            Logger.info('HOMEPAGE', '首页初始化完成');

        } catch (error) {
            Logger.error('HOMEPAGE', '首页初始化失败:', error);
            articleManager.showError('加载失败，请刷新页面重试');
        }
    }

    /**
     * 初始化首页动画
     */
    initializeAnimations() {
        // 立即触发首页内容的渐入动画
        const whaleMoonTitle = document.getElementById('whale-moon-title');
        const heroContent = document.getElementById('hero-content');

        // 防止全局动画系统影响这些元素
        const protectFromGlobalAnimations = () => {
            [whaleMoonTitle, heroContent].forEach(element => {
                if (element) {
                    // 移除可能被全局系统添加的动画类
                    element.classList.remove('scroll-fade', 'fade-in', 'visible');
                    // 移除子元素的动画类
                    element.querySelectorAll('.scroll-fade, .fade-in, .visible').forEach(child => {
                        child.classList.remove('scroll-fade', 'fade-in', 'visible');
                    });
                }
            });
        };

        // 立即保护元素
        protectFromGlobalAnimations();

        // 触发自定义动画
        if (whaleMoonTitle) whaleMoonTitle.classList.add('show');
        if (heroContent) heroContent.classList.add('show');

        // 标记动画准备就绪，让其他元素可以开始动画
        setTimeout(() => {
            document.body.classList.add('animations-ready');
            // 触发文章预览卡片的交错动画
            this.animatePreviewCards();
        }, 200);

        // 延迟再次保护，防止后续的全局系统影响
        setTimeout(protectFromGlobalAnimations, 100);
        setTimeout(protectFromGlobalAnimations, 500);
        setTimeout(protectFromGlobalAnimations, 1000);
    }

    /**
     * 文章预览卡片动画
     */
    animatePreviewCards() {
        const previewItems = document.querySelectorAll('.preview-item');
        previewItems.forEach((item, index) => {
            // 移除之前的动画类，重置状态
            item.classList.remove('animate-in');

            setTimeout(() => {
                item.classList.add('animate-in');
            }, index * 50); // 每个卡片延迟50ms出现
        });
    }

    /**
     * 显示置顶文章
     */
    displayPinnedArticles() {
        if (articleManager.pinnedArticles.length > 0) {
            articleManager.displayArticles(
                articleManager.pinnedArticles, 
                'pinned-previews', 
                true
            );
        }
    }

    /**
     * 显示初始文章（前10篇）
     */
    displayInitialArticles() {
        const initialArticles = articleManager.regularArticles.slice(0, 10);
        articleManager.displayArticles(initialArticles);

        // 如果文章数量超过10篇，显示"显示所有"按钮
        if (articleManager.regularArticles.length > 10) {
            document.getElementById('article-controls').style.display = 'block';
        }
    }

    /**
     * 显示所有文章（分页模式）
     */
    showAllArticles() {
        this.showingAll = true;
        this.currentPage = 1;
        
        // 隐藏"显示所有"按钮
        document.getElementById('show-all-btn').style.display = 'none';

        if (articleManager.regularArticles.length > this.articlesPerPage) {
            // 需要分页
            document.getElementById('pagination-controls').style.display = 'block';
            
            // 初始化分页管理器
            paginationManager.articlesPerPage = this.articlesPerPage;
            paginationManager.initialize(
                articleManager.regularArticles,
                (articles, page) => this.onPageChange(articles, page)
            );
            
            // 显示第一页
            this.onPageChange(paginationManager.getCurrentPageArticles(), 1);
        } else {
            // 不需要分页，直接显示所有
            articleManager.displayArticles(articleManager.regularArticles);
            this.showHomepageElements();
        }
    }

    /**
     * 页面变化回调
     * @param {Array} articles - 当前页文章
     * @param {number} page - 当前页码
     */
    onPageChange(articles, page) {
        this.currentPage = page;
        articleManager.displayArticles(articles);
        
        // 控制首页元素的显示/隐藏
        if (page > 1) {
            this.hideHomepageElements();
        } else {
            this.showHomepageElements();
        }
    }

    /**
     * 显示首页特有元素
     */
    showHomepageElements() {
        const whaleMoonTitle = document.getElementById('whale-moon-title');
        const heroContent = document.getElementById('hero-content');
        const pinnedContainer = document.getElementById('pinned-previews');
        const paginationSpacer = document.getElementById('pagination-spacer');

        if (whaleMoonTitle) {
            whaleMoonTitle.classList.remove('hidden');
            whaleMoonTitle.classList.add('show');
        }
        
        if (heroContent) {
            heroContent.classList.remove('hidden');
            heroContent.classList.add('show');
        }
        
        if (pinnedContainer) {
            pinnedContainer.style.display = 'block';
        }
        
        if (paginationSpacer) {
            paginationSpacer.classList.add('hidden');
        }
    }

    /**
     * 隐藏首页特有元素
     */
    hideHomepageElements() {
        const whaleMoonTitle = document.getElementById('whale-moon-title');
        const heroContent = document.getElementById('hero-content');
        const pinnedContainer = document.getElementById('pinned-previews');
        const paginationSpacer = document.getElementById('pagination-spacer');

        if (whaleMoonTitle) {
            whaleMoonTitle.classList.add('hidden');
            whaleMoonTitle.classList.remove('show');
        }
        
        if (heroContent) {
            heroContent.classList.add('hidden');
            heroContent.classList.remove('show');
        }
        
        if (pinnedContainer) {
            pinnedContainer.style.display = 'none';
        }
        
        if (paginationSpacer) {
            paginationSpacer.classList.remove('hidden');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // "显示所有文章"按钮
        const showAllBtn = document.getElementById('show-all-btn');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                this.showAllArticles();
            });
        }
    }
}

// 初始化函数
function initializeHomepage() {
    // 等待依赖加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof articleManager !== 'undefined' &&
            typeof paginationManager !== 'undefined' &&
            typeof Logger !== 'undefined') {
            // 依赖已加载，开始初始化
            Logger.info('HOMEPAGE', '开始初始化首页');
            const homepage = new Homepage();
            homepage.initialize();
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，首页初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeHomepage);
} else {
    initializeHomepage();
}
