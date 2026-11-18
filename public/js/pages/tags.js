/**
 * 标签页特有逻辑
 * 处理标签云、标签过滤等功能
 */

class TagsPage {
    constructor() {
        this.selectedTags = new Set();
        this.allTags = {};
        this.tagLayers = {};
        this.ALL_TAG = '全部';
        this.articlesPerPage = 20;
    }

    /**
     * 初始化标签页
     */
    async initialize() {
        try {
            // 加载文章数据（标签页不显示置顶文章）
            await articleManager.loadArticlesData('../../cache/metadata.json', '../../');

            // 获取标签统计信息
            const { allTags, tagLayers } = articleManager.getAllTags();
            this.allTags = allTags;
            this.tagLayers = tagLayers;

            // 生成标签云
            this.generateTagCloud();

            // 初始化分页管理器
            paginationManager.articlesPerPage = this.articlesPerPage;
            paginationManager.initialize(
                articleManager.filteredArticles,
                (articles) => this.onPageChange(articles)
            );

            // 显示第一页文章
            this.displayCurrentPage();

            // 绑定事件
            this.bindEvents();

            Logger.info('TAGS', '标签页初始化完成');

        } catch (error) {
            Logger.error('TAGS', '标签页初始化失败:', error);
            articleManager.showError('加载失败，请刷新页面重试');
        }
    }

    /**
     * 生成标签云
     */
    generateTagCloud() {
        const tagCloudContainer = document.getElementById('tag-cloud');
        if (!tagCloudContainer) return;

        // 构建带层级信息的数组
        const tagsArray = Object.entries(this.allTags).map(([tag, count]) => ({
            tag,
            count,
            layer: this.tagLayers[tag] ?? 999
        }));

        // 在最前面插入虚拟"全部"标签
        tagsArray.unshift({ 
            tag: this.ALL_TAG, 
            count: articleManager.regularArticles.length, 
            layer: -1 
        });

        // 按层级（小值优先）-> 频次排序
        tagsArray.sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            return b.count - a.count;
        });

        const tagElements = tagsArray.map(({ tag, count }) => {
            const activeClass = (this.selectedTags.size === 0 && tag === this.ALL_TAG) || 
                               this.selectedTags.has(tag) ? 'active' : '';
            return `<span class="tag-item tag-size-3 ${activeClass}"
                         data-tag="${tag}"
                         data-count="${count}">
                        ${tag} (${count})
                    </span>`;
        }).join('');

        tagCloudContainer.innerHTML = tagElements;
    }

    /**
     * 应用标签过滤
     */
    applyFilters() {
        // 过滤文章
        articleManager.filterByTags(this.selectedTags);

        // 更新标题
        const articlesTitle = document.getElementById('articles-title');
        if (articlesTitle) {
            articlesTitle.textContent = this.selectedTags.size > 0 ? '筛选后的文章' : '所有文章';
        }

        // 重置分页并显示
        paginationManager.reset(articleManager.filteredArticles);
        this.displayCurrentPage();
    }

    /**
     * 显示当前页文章
     */
    displayCurrentPage() {
        const articles = paginationManager.getCurrentPageArticles();
        articleManager.displayArticles(articles);
        this.updateArticlesCount();
    }

    /**
     * 更新文章数量显示
     */
    updateArticlesCount() {
        const countElement = document.getElementById('articles-count');
        if (!countElement) return;

        const totalCount = articleManager.filteredArticles.length;
        const currentPageArticles = paginationManager.getCurrentPageArticles().length;
        
        if (totalCount === 0) {
            countElement.textContent = '';
            return;
        }

        if (totalCount > this.articlesPerPage) {
            const startIndex = (paginationManager.currentPage - 1) * this.articlesPerPage + 1;
            const endIndex = Math.min(startIndex + currentPageArticles - 1, totalCount);
            countElement.textContent = `(第 ${startIndex}-${endIndex} 篇，共 ${totalCount} 篇)`;
        } else {
            countElement.textContent = `(${totalCount} 篇)`;
        }
    }

    /**
     * 页面变化回调
     * @param {Array} articles - 当前页文章
     */
    onPageChange(articles) {
        articleManager.displayArticles(articles);
        this.updateArticlesCount();
    }

    /**
     * 处理标签点击
     * @param {string} tag - 点击的标签
     */
    handleTagClick(tag) {
        if (tag === this.ALL_TAG) {
            this.selectedTags.clear();
        } else {
            if (this.selectedTags.has(tag)) {
                this.selectedTags.delete(tag);
            } else {
                this.selectedTags.add(tag);
            }
        }

        // 重新渲染标签云和应用过滤
        this.generateTagCloud();
        this.applyFilters();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 标签点击事件
        const tagCloud = document.getElementById('tag-cloud');
        if (tagCloud) {
            tagCloud.addEventListener('click', (e) => {
                if (e.target.classList.contains('tag-item')) {
                    const tag = e.target.dataset.tag;
                    this.handleTagClick(tag);
                }
            });
        }
    }
}

// 初始化函数
function initializeTagsPage() {
    // 等待依赖加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof articleManager !== 'undefined' &&
            typeof paginationManager !== 'undefined' &&
            typeof Logger !== 'undefined') {
            // 依赖已加载，开始初始化
            Logger.info('TAGS', '开始初始化标签页');
            const tagsPage = new TagsPage();
            tagsPage.initialize();
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error('依赖加载超时，标签页初始化失败');
        }
    };
    waitForDependencies();
}

// 立即初始化或等待DOM加载完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTagsPage);
} else {
    initializeTagsPage();
}
