/**
 * 分类页面基类
 * 提供通用的标签过滤、分页等功能
 * 可被个人、工作、学习、社交、家庭等页面继承
 */

class CategoryPageBase {
    constructor(config = {}) {
        this.selectedTags = new Set();
        this.allTags = {};
        this.tagLayers = {};
        this.ALL_TAG = '全部';
        this.articlesPerPage = config.articlesPerPage || 20;

        // 分类配置
        this.categoryTag = config.categoryTag; // 第一级标签，如 '个人', '工作', '学习' 等
        this.categoryName = config.categoryName; // 显示名称，如 '个人', '工作', '学习' 等
        this.loggerPrefix = config.loggerPrefix || 'CATEGORY'; // 日志前缀

        // 页面标题配置
        this.defaultTitle = config.defaultTitle || `${this.categoryName}相关文章`;
        this.filteredTitle = config.filteredTitle || `筛选后的${this.categoryName}文章`;
    }

    /**
     * 初始化分类页面
     */
    async initialize() {
        try {
            // 加载文章数据（分类页面不显示置顶文章）
            await articleManager.loadArticlesData('../../cache/metadata.json', '../../');

            // 预过滤出分类相关文章
            this.preFilterCategoryArticles();

            // 获取分类相关标签统计信息
            const { allTags, tagLayers } = this.getCategoryTags();
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

            Logger.info(this.loggerPrefix, `${this.categoryName}页面初始化完成`);

        } catch (error) {
            Logger.error(this.loggerPrefix, `${this.categoryName}页面初始化失败:`, error);
            articleManager.showError('加载失败，请刷新页面重试');
        }
    }

    /**
     * 预过滤出分类相关文章
     * 基于标签层级：第一级标签匹配指定分类的文章
     */
    preFilterCategoryArticles() {
        const categoryArticles = articleManager.regularArticles.filter(article => {
            // 检查第一级标签（索引0）是否为指定分类
            return article.tags.length > 0 && article.tags[0] === this.categoryTag;
        });

        // 更新过滤后的文章列表
        articleManager.filteredArticles = categoryArticles;

        Logger.info(this.loggerPrefix, `过滤出 ${categoryArticles.length} 篇${this.categoryName}相关文章`);
    }

    /**
     * 获取分类相关标签及其统计信息
     */
    getCategoryTags() {
        const allTags = {};
        const tagLayers = {};

        // 统计分类相关文章的所有标签
        articleManager.filteredArticles.forEach(article => {
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
            count: articleManager.filteredArticles.length,
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

        // 检查是否需要显示折叠/展开按钮
        this.checkTagCloudHeight();
    }

    /**
     * 检查标签云高度，决定是否显示折叠/展开按钮
     */
    checkTagCloudHeight() {
        const tagCloudContainer = document.getElementById('tag-cloud');
        const toggleBtn = document.getElementById('toggle-tag-cloud-btn');

        if (!tagCloudContainer || !toggleBtn) return;

        // 临时移除折叠状态，获取真实高度
        const wasCollapsed = tagCloudContainer.classList.contains('collapsed');
        tagCloudContainer.classList.remove('collapsed');

        // 获取标签云的实际高度
        const actualHeight = tagCloudContainer.scrollHeight;
        const collapsedHeight = 116; // 7.25rem ≈ 116px (对应CSS中的max-height)

        // 如果实际高度小于等于折叠高度，隐藏按钮并移除折叠状态
        if (actualHeight <= collapsedHeight) {
            toggleBtn.style.display = 'none';
            // 不需要折叠状态
        } else {
            toggleBtn.style.display = 'inline-block';
            // 恢复折叠状态
            if (wasCollapsed) {
                tagCloudContainer.classList.add('collapsed');
            }
        }
    }

    /**
     * 应用标签过滤
     */
    applyFilters() {
        // 先获取分类相关文章（基于第一级标签）
        const categoryArticles = articleManager.regularArticles.filter(article => {
            return article.tags.length > 0 && article.tags[0] === this.categoryTag;
        });

        // 在分类相关文章中进一步按选中标签过滤
        if (this.selectedTags.size === 0) {
            articleManager.filteredArticles = categoryArticles;
        } else {
            articleManager.filteredArticles = categoryArticles.filter(article => {
                return article.tags.some(tag => this.selectedTags.has(tag));
            });
        }

        // 更新标题
        const articlesTitle = document.getElementById('articles-title');
        if (articlesTitle) {
            articlesTitle.textContent = this.selectedTags.size > 0 ? this.filteredTitle : this.defaultTitle;
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

/**
 * 通用分类页面初始化函数
 * @param {Object} config - 分类配置
 */
function initializeCategoryPage(config) {
    // 等待依赖加载完成后再初始化
    const waitForDependencies = (retryCount = 0) => {
        if (typeof articleManager !== 'undefined' &&
            typeof paginationManager !== 'undefined' &&
            typeof Logger !== 'undefined') {
            // 依赖已加载，开始初始化
            Logger.info(config.loggerPrefix, `开始初始化${config.categoryName}页面`);
            const categoryPage = new CategoryPageBase(config);
            categoryPage.initialize();
        } else if (retryCount < 20) {
            // 继续等待
            setTimeout(() => {
                waitForDependencies(retryCount + 1);
            }, 100);
        } else {
            console.error(`依赖加载超时，${config.categoryName}页面初始化失败`);
        }
    };
    waitForDependencies();
}

// 导出到全局
window.CategoryPageBase = CategoryPageBase;
window.initializeCategoryPage = initializeCategoryPage;