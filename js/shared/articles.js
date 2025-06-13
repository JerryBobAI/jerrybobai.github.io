/**
 * 文章相关的共享逻辑
 * 提供文章加载、显示、过滤等通用功能
 */

class ArticleManager {
    constructor() {
        this.allArticles = [];
        this.filteredArticles = [];
        this.pinnedArticles = [];
        this.regularArticles = [];
    }

    /**
     * 加载文章数据
     * @param {string} metadataPath - metadata.json的路径
     * @param {string} basePath - 文章的基础路径
     */
    async loadArticlesData(metadataPath = 'cache/metadata.json', basePath = '') {
        try {
            const response = await fetch(metadataPath);
            const metadata = await response.json();

            // 将数据转换为数组格式
            const articles = Object.entries(metadata).map(([path, info]) => {
                return {
                    title: info.title,
                    link: `${basePath}${path}`,
                    src: `${basePath}${path}`,
                    date: info.date,
                    tags: info.tags || ['博客'],
                    pinned: info.pinned || false
                };
            });

            this.allArticles = articles;
            
            // 分离置顶和普通文章
            this.pinnedArticles = articles.filter(article => article.pinned);
            this.regularArticles = articles.filter(article => !article.pinned);

            // 按日期倒序排列
            this.pinnedArticles.sort((a, b) => new Date(b.date) - new Date(a.date));
            this.regularArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 初始化过滤后的文章为所有普通文章
            this.filteredArticles = [...this.regularArticles];

            Logger.info('ARTICLES', `文章数据加载完成: ${this.allArticles.length} 篇文章`);
            return this.allArticles;

        } catch (error) {
            Logger.error('ARTICLES', '加载文章数据失败:', error);
            throw error;
        }
    }

    /**
     * 显示文章列表
     * @param {Array} articles - 要显示的文章数组
     * @param {string} containerId - 容器元素ID
     * @param {boolean} isPinned - 是否为置顶文章
     */
    displayArticles(articles, containerId = 'iframe-previews', isPinned = false) {
        const container = document.getElementById(containerId);
        if (!container) {
            Logger.error('ARTICLES', `容器元素 ${containerId} 不存在`);
            return;
        }

        // 设置数据属性
        container.setAttribute('data-previews', JSON.stringify(articles));
        if (isPinned) {
            container.setAttribute('data-pinned', 'true');
        }

        // 初始化iframe预览组件
        this.initializePreviewsWithRetry(containerId);
    }

    /**
     * 带重试机制的预览组件初始化
     * @param {string} containerId - 容器ID
     * @param {number} retryCount - 重试次数
     */
    initializePreviewsWithRetry(containerId, retryCount = 0) {
        if (typeof initializeIframePreviews === 'function') {
            initializeIframePreviews();

            // 触发动画（如果是首页）
            setTimeout(() => {
                this.triggerPreviewAnimations();
            }, 50);
        } else if (retryCount < 10) {
            setTimeout(() => {
                this.initializePreviewsWithRetry(containerId, retryCount + 1);
            }, 100);
        } else {
            Logger.error('ARTICLES', 'initializeIframePreviews 函数加载失败');
        }
    }

    /**
     * 触发预览卡片动画
     */
    triggerPreviewAnimations() {
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
     * 按标签过滤文章
     * @param {Set} selectedTags - 选中的标签集合
     */
    filterByTags(selectedTags) {
        if (selectedTags.size === 0) {
            this.filteredArticles = [...this.regularArticles];
        } else {
            this.filteredArticles = this.regularArticles.filter(article => {
                return article.tags.some(tag => selectedTags.has(tag));
            });
        }
        return this.filteredArticles;
    }

    /**
     * 获取所有标签及其统计信息
     */
    getAllTags() {
        const allTags = {};
        const tagLayers = {};

        this.regularArticles.forEach(article => {
            article.tags.forEach((tag, idx) => {
                allTags[tag] = (allTags[tag] || 0) + 1;
                if (!(tag in tagLayers) || idx < tagLayers[tag]) {
                    tagLayers[tag] = idx; // 记录最上层出现的位置
                }
            });
        });

        return { allTags, tagLayers };
    }

    /**
     * 显示错误信息
     * @param {string} message - 错误信息
     * @param {string} containerId - 容器ID
     */
    showError(message, containerId = 'iframe-previews') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center text-red-500 py-12">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="text-lg">${message}</p>
                </div>
            `;
        }
    }

    /**
     * 显示加载状态
     * @param {string} containerId - 容器ID
     */
    showLoading(containerId = 'iframe-previews') {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-12">
                    <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                    <p>正在加载文章...</p>
                </div>
            `;
        }
    }
}

// 创建全局实例
window.articleManager = new ArticleManager();
