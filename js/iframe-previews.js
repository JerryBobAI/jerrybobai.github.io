// iframe预览组件 - 用于生成iframe预览卡片
document.addEventListener('DOMContentLoaded', function() {
    // 查找iframe预览容器
    const iframePreviewsContainer = document.querySelector('[data-component="iframe-previews"]');
    if (!iframePreviewsContainer) return;

    // 获取预览数据属性
    const previewsDataStr = iframePreviewsContainer.getAttribute('data-previews');
    if (!previewsDataStr) return;
    
    try {
        // 解析预览数据
        const previews = JSON.parse(previewsDataStr);
        if (!Array.isArray(previews) || previews.length === 0) return;
        
        // 创建响应式容器
        const responsiveContainer = document.createElement('div');
        responsiveContainer.className = 'grid grid-cols-1 md:grid-cols-2 gap-12 mt-12 px-4 md:px-8 lg:px-12 w-full max-w-screen-xl mx-auto';
        
        // 生成预览HTML
        previews.forEach(preview => {
            const { title, link, src } = preview;
            
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item hover:scale-105 transition-transform duration-300 ease-in-out';
            
            previewItem.innerHTML = `
                <a href="${link}" target="_blank" title="${title || '查看完整内容'}" class="block w-full h-full">
                    <iframe
                        src="${src}"
                        class="preview-iframe w-full border border-solid border-gray-200 rounded-lg shadow-md"
                        style="height: 400px;"
                        frameborder="0"
                        scrolling="no"
                        title="${title || '内容预览'}">
                    </iframe>
                </a>
            `;
            
            responsiveContainer.appendChild(previewItem);
        });
        
        // 清空并设置容器的内容
        iframePreviewsContainer.innerHTML = '';
        iframePreviewsContainer.appendChild(responsiveContainer);
        
    } catch (error) {
        console.error('Error parsing iframe previews data:', error);
    }
});
