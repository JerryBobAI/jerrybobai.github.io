/**
 * 分页相关的共享逻辑
 * 提供分页控制、页面跳转等通用功能
 */

class PaginationManager {
    constructor(articlesPerPage = 20) {
        this.currentPage = 1;
        this.articlesPerPage = articlesPerPage;
        this.totalArticles = 0;
        this.articles = [];
        this.onPageChange = null; // 页面变化回调函数
    }

    /**
     * 初始化分页
     * @param {Array} articles - 文章数组
     * @param {Function} onPageChange - 页面变化回调函数
     */
    initialize(articles, onPageChange) {
        this.articles = articles;
        this.totalArticles = articles.length;
        this.currentPage = 1;
        this.onPageChange = onPageChange;
        
        this.bindEvents();
        this.updateControls();
        
        // 显示或隐藏分页控制
        this.togglePaginationControls();
    }

    /**
     * 获取当前页的文章
     */
    getCurrentPageArticles() {
        const startIndex = (this.currentPage - 1) * this.articlesPerPage;
        const endIndex = startIndex + this.articlesPerPage;
        return this.articles.slice(startIndex, endIndex);
    }

    /**
     * 跳转到指定页面
     * @param {number} page - 页码
     */
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.updateControls();
        
        if (this.onPageChange) {
            this.onPageChange(this.getCurrentPageArticles(), this.currentPage);
        }
    }

    /**
     * 获取总页数
     */
    getTotalPages() {
        return Math.ceil(this.totalArticles / this.articlesPerPage);
    }

    /**
     * 更新分页控制UI
     */
    updateControls() {
        const totalPages = this.getTotalPages();
        
        // 更新页面信息
        const pageInfo = document.getElementById('page-info');
        if (pageInfo) {
            pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        }

        // 获取所有按钮
        const firstBtn = document.getElementById('first-page');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const lastBtn = document.getElementById('last-page');

        // 更新按钮状态
        const isFirstPage = this.currentPage === 1;
        const isLastPage = this.currentPage === totalPages;

        if (firstBtn) {
            firstBtn.disabled = isFirstPage;
            firstBtn.className = isFirstPage ? 'pagination-btn pagination-btn-disabled' : 'pagination-btn';
        }
        
        if (prevBtn) {
            prevBtn.disabled = isFirstPage;
            prevBtn.className = isFirstPage ? 'pagination-btn pagination-btn-disabled' : 'pagination-btn';
        }
        
        if (nextBtn) {
            nextBtn.disabled = isLastPage;
            nextBtn.className = isLastPage ? 'pagination-btn pagination-btn-disabled' : 'pagination-btn';
        }
        
        if (lastBtn) {
            lastBtn.disabled = isLastPage;
            lastBtn.className = isLastPage ? 'pagination-btn pagination-btn-disabled' : 'pagination-btn';
        }
    }

    /**
     * 绑定分页按钮事件
     */
    bindEvents() {
        // 避免重复绑定
        if (this.eventsBound) return;
        this.eventsBound = true;

        const firstBtn = document.getElementById('first-page');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const lastBtn = document.getElementById('last-page');

        if (firstBtn) {
            firstBtn.addEventListener('click', () => {
                this.goToPage(1);
                this.scrollToArticlesSection();
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage - 1);
                this.scrollToArticlesSection();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.goToPage(this.currentPage + 1);
                this.scrollToArticlesSection();
            });
        }

        if (lastBtn) {
            lastBtn.addEventListener('click', () => {
                this.goToPage(this.getTotalPages());
                this.scrollToArticlesSection();
            });
        }
    }

    /**
     * 显示或隐藏分页控制
     */
    togglePaginationControls() {
        const paginationControls = document.getElementById('pagination-controls');
        if (paginationControls) {
            if (this.totalArticles > this.articlesPerPage) {
                paginationControls.style.display = 'block';
            } else {
                paginationControls.style.display = 'none';
            }
        }
    }

    /**
     * 滚动到文章区域
     */
    scrollToArticlesSection() {
        const articlesSection = document.getElementById('iframe-previews');
        if (articlesSection) {
            const offsetTop = articlesSection.offsetTop - 100;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    }

    /**
     * 重置分页（当文章列表变化时）
     * @param {Array} newArticles - 新的文章数组
     */
    reset(newArticles) {
        this.articles = newArticles;
        this.totalArticles = newArticles.length;
        this.currentPage = 1;
        this.updateControls();
        this.togglePaginationControls();
    }
}

// 创建全局实例
window.paginationManager = new PaginationManager();
