// 共享工具函数

// 标签颜色配置
const TAG_COLORS = [
    'bg-blue-50 text-blue-500 border-blue-200',
    'bg-indigo-50 text-indigo-500 border-indigo-200',
    'bg-purple-50 text-purple-500 border-purple-200',
    'bg-pink-50 text-pink-500 border-pink-200',
    'bg-red-50 text-red-500 border-red-200',
    'bg-orange-50 text-orange-500 border-orange-200',
    'bg-amber-50 text-amber-500 border-amber-200',
    'bg-yellow-50 text-yellow-500 border-yellow-200',
    'bg-lime-50 text-lime-500 border-lime-200',
    'bg-green-50 text-green-500 border-green-200',
    'bg-emerald-50 text-emerald-500 border-emerald-200',
    'bg-teal-50 text-teal-500 border-teal-200',
    'bg-cyan-50 text-cyan-500 border-cyan-200',
    'bg-sky-50 text-sky-500 border-sky-200',
    'bg-violet-50 text-violet-500 border-violet-200',
    'bg-fuchsia-50 text-fuchsia-500 border-fuchsia-200',
    'bg-rose-50 text-rose-500 border-rose-200',
    'bg-slate-50 text-slate-500 border-slate-200'
];

// 单个标签颜色分配函数（保持向后兼容）
function getTagColorClass(tag) {
    let sum = 0;
    for (let i = 0; i < tag.length; i++) {
        sum += tag.charCodeAt(i);
    }
    return TAG_COLORS[sum % TAG_COLORS.length];
}

// 为标签数组分配不重复的颜色
function getTagColorsForTags(tags) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return [];
    }

    // 如果标签数量超过可用颜色数量，使用原来的方法
    if (tags.length > TAG_COLORS.length) {
        return tags.map(tag => getTagColorClass(tag));
    }

    // 为每个标签生成一个基于内容的索引
    const tagIndices = tags.map(tag => {
        let sum = 0;
        for (let i = 0; i < tag.length; i++) {
            sum += tag.charCodeAt(i);
        }
        return { tag, index: sum };
    });

    // 排序确保相同标签总是得到相同的颜色
    tagIndices.sort((a, b) => a.index - b.index);

    // 分配不重复的颜色
    const usedColorIndices = new Set();
    const result = [];

    for (let i = 0; i < tagIndices.length; i++) {
        const { tag, index } = tagIndices[i];
        let colorIndex = index % TAG_COLORS.length;

        // 如果颜色已被使用，找下一个可用的颜色
        while (usedColorIndices.has(colorIndex)) {
            colorIndex = (colorIndex + 1) % TAG_COLORS.length;
        }

        usedColorIndices.add(colorIndex);
        result.push({
            tag: tag,
            colorClass: TAG_COLORS[colorIndex]
        });
    }

    // 按原始顺序返回
    return tags.map(tag => {
        const found = result.find(item => item.tag === tag);
        return found ? found.colorClass : getTagColorClass(tag);
    });
}

// 构建标签HTML的通用函数
function buildTagsHtml(tags, options = {}) {
    const {
        padding = 'px-3 py-1',           // 默认padding
        extraClasses = '',               // 额外的CSS类
        withAnimation = false            // 是否包含动画
    } = options;

    if (!Array.isArray(tags) || tags.length === 0) {
        return '';
    }

    const tagColors = getTagColorsForTags(tags);
    return tags.map((tag, index) => {
        const colorClass = tagColors[index];
        const animationClass = withAnimation ? 'tag-animate' : '';
        const animationStyle = withAnimation ? `style="animation-delay: ${index * 0.1}s"` : '';

        return `<span class="inline-block ${colorClass} hover:opacity-80 transition-all duration-200 hover:scale-105 rounded-full ${padding} text-xs font-medium border ${animationClass} ${extraClasses}" ${animationStyle}>${tag}</span>`;
    }).join('');
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.getTagColorClass = getTagColorClass;
    window.getTagColorsForTags = getTagColorsForTags;
    window.buildTagsHtml = buildTagsHtml;
    window.TAG_COLORS = TAG_COLORS;
}
