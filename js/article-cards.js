// 文章卡片组件 - 用于生成文章卡片列表
document.addEventListener('DOMContentLoaded', function() {
    // 查找文章卡片容器
    const articleCardsContainer = document.querySelector('[data-component="article-cards"]');
    if (!articleCardsContainer) return;

    // 获取文章数据属性
    const articlesDataStr = articleCardsContainer.getAttribute('data-articles');
    if (!articlesDataStr) return;
    
    try {
        // 解析文章数据
        const articles = JSON.parse(articlesDataStr);
        if (!Array.isArray(articles) || articles.length === 0) return;
        
        // 生成文章卡片HTML
        const cardsHTML = articles.map(article => {
            const {
                title,
                subtitle,
                description,
                link,
                gradient = 'from-blue-600 to-indigo-700',
                textColor = 'text-blue-600'
            } = article;
            
            return `
                <a href="${link}" class="article-card">
                    <div class="article-card-inner bg-white">
                        <div class="p-6 bg-gradient-to-r ${gradient} text-white">
                            <h3 class="text-xl font-bold mb-2">${title}</h3>
                            <p class="opacity-90">${subtitle}</p>
                        </div>
                        <div class="p-6">
                            <p class="text-gray-700">${description}</p>
                            <div class="mt-4 flex justify-end">
                                <span class="inline-flex items-center ${textColor}">
                                    阅读全文 <i class="fas fa-arrow-right ml-2"></i>
                                </span>
                            </div>
                        </div>
                    </div>
                </a>
            `;
        }).join('');
        
        // 设置容器的HTML
        articleCardsContainer.innerHTML = cardsHTML;
        
        // 添加网格布局类
        articleCardsContainer.classList.add('grid', 'grid-cols-1', 'md:grid-cols-2', 'gap-8', 'mb-16');
        
    } catch (error) {
        console.error('Error parsing article data:', error);
    }
});
