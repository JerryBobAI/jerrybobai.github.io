// 共享工具函数

// 标签颜色配置 - 适配深色背景的柔和配色
const TAG_COLORS = [
    'bg-blue-500/20 text-blue-200 border-blue-400/30',
    'bg-indigo-500/20 text-indigo-200 border-indigo-400/30',
    'bg-purple-500/20 text-purple-200 border-purple-400/30',
    'bg-pink-500/20 text-pink-200 border-pink-400/30',
    'bg-red-500/20 text-red-200 border-red-400/30',
    'bg-orange-500/20 text-orange-200 border-orange-400/30',
    'bg-amber-500/20 text-amber-200 border-amber-400/30',
    'bg-yellow-500/20 text-yellow-200 border-yellow-400/30',
    'bg-lime-500/20 text-lime-200 border-lime-400/30',
    'bg-green-500/20 text-green-200 border-green-400/30',
    'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
    'bg-teal-500/20 text-teal-200 border-teal-400/30',
    'bg-cyan-500/20 text-cyan-200 border-cyan-400/30',
    'bg-sky-500/20 text-sky-200 border-sky-400/30',
    'bg-violet-500/20 text-violet-200 border-violet-400/30',
    'bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30',
    'bg-rose-500/20 text-rose-200 border-rose-400/30',
    'bg-slate-500/20 text-slate-200 border-slate-400/30'
];

// 浅色背景的标签颜色配置（用于首页等浅色背景）
const TAG_COLORS_LIGHT = [
    'bg-blue-50 text-blue-600 border-blue-200',
    'bg-indigo-50 text-indigo-600 border-indigo-200',
    'bg-purple-50 text-purple-600 border-purple-200',
    'bg-pink-50 text-pink-600 border-pink-200',
    'bg-red-50 text-red-600 border-red-200',
    'bg-orange-50 text-orange-600 border-orange-200',
    'bg-amber-50 text-amber-600 border-amber-200',
    'bg-yellow-50 text-yellow-600 border-yellow-200',
    'bg-lime-50 text-lime-600 border-lime-200',
    'bg-green-50 text-green-600 border-green-200',
    'bg-emerald-50 text-emerald-600 border-emerald-200',
    'bg-teal-50 text-teal-600 border-teal-200',
    'bg-cyan-50 text-cyan-600 border-cyan-200',
    'bg-sky-50 text-sky-600 border-sky-200',
    'bg-violet-50 text-violet-600 border-violet-200',
    'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200',
    'bg-rose-50 text-rose-600 border-rose-200',
    'bg-slate-50 text-slate-600 border-slate-200'
];

// 单个标签颜色分配函数（保持向后兼容）
function getTagColorClass(tag, isDarkBackground = true) {
    let sum = 0;
    for (let i = 0; i < tag.length; i++) {
        sum += tag.charCodeAt(i);
    }
    const colors = isDarkBackground ? TAG_COLORS : TAG_COLORS_LIGHT;
    return colors[sum % colors.length];
}

// 为标签数组分配不重复的颜色
function getTagColorsForTags(tags, isDarkBackground = true) {
    if (!Array.isArray(tags) || tags.length === 0) {
        return [];
    }

    const colors = isDarkBackground ? TAG_COLORS : TAG_COLORS_LIGHT;

    // 如果标签数量超过可用颜色数量，使用原来的方法
    if (tags.length > colors.length) {
        return tags.map(tag => getTagColorClass(tag, isDarkBackground));
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
        let colorIndex = index % colors.length;

        // 如果颜色已被使用，找下一个可用的颜色
        while (usedColorIndices.has(colorIndex)) {
            colorIndex = (colorIndex + 1) % colors.length;
        }

        usedColorIndices.add(colorIndex);
        result.push({
            tag: tag,
            colorClass: colors[colorIndex]
        });
    }

    // 按原始顺序返回
    return tags.map(tag => {
        const found = result.find(item => item.tag === tag);
        return found ? found.colorClass : getTagColorClass(tag, isDarkBackground);
    });
}

// 检测背景色是否为深色
function isDarkBackground() {
    try {
        // 获取body的背景色
        const bodyStyle = window.getComputedStyle(document.body);
        const backgroundColor = bodyStyle.backgroundColor;

        // 只在DEBUG级别记录详细信息
        Logger.debug('STYLE', `检测到的body背景色: ${backgroundColor}`);

        // 如果没有背景色，检查html元素
        if (!backgroundColor || backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent') {
            const htmlStyle = window.getComputedStyle(document.documentElement);
            const htmlBackgroundColor = htmlStyle.backgroundColor;
            Logger.debug('STYLE', `检测到的html背景色: ${htmlBackgroundColor}`);
            if (htmlBackgroundColor && htmlBackgroundColor !== 'rgba(0, 0, 0, 0)' && htmlBackgroundColor !== 'transparent') {
                const result = isColorDark(htmlBackgroundColor);
                Logger.debug('STYLE', `背景色检测结果 (html): ${result ? '深色' : '浅色'}`);
                return result;
            }
        }

        // 解析RGB值并计算亮度
        const result = isColorDark(backgroundColor);
        Logger.debug('STYLE', `背景色检测结果 (body): ${result ? '深色' : '浅色'}`);
        return result;
    } catch (e) {
        Logger.warn('STYLE', '无法检测背景色，使用默认深色方案', e);
        return true; // 默认假设是深色背景
    }
}

// 判断颜色是否为深色
function isColorDark(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
        return true; // 默认假设是深色
    }

    // 解析RGB值
    const rgb = color.match(/\d+/g);
    if (!rgb || rgb.length < 3) {
        return true; // 解析失败，默认深色
    }

    const r = parseInt(rgb[0]);
    const g = parseInt(rgb[1]);
    const b = parseInt(rgb[2]);

    // 使用相对亮度公式计算
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // 亮度小于0.5认为是深色背景
    return luminance < 0.5;
}

// 构建标签HTML的通用函数
function buildTagsHtml(tags, options = {}) {
    const {
        padding = 'px-3 py-1',           // 默认padding
        extraClasses = '',               // 额外的CSS类
        withAnimation = false,           // 是否包含动画
        isDarkBackground = null          // 是否为深色背景，null表示自动检测
    } = options;

    if (!Array.isArray(tags) || tags.length === 0) {
        return '';
    }

    // 如果没有指定背景类型，自动检测
    let useDarkColors;
    if (isDarkBackground !== null) {
        useDarkColors = isDarkBackground;
        Logger.debug('TAG', `使用指定的背景类型: ${useDarkColors ? '深色' : '浅色'}`);
    } else {
        // 调用全局的背景检测函数
        useDarkColors = window.isDarkBackground ? window.isDarkBackground() : true;
        Logger.debug('TAG', `自动检测背景类型: ${useDarkColors ? '深色' : '浅色'}`);
    }

    const tagColors = getTagColorsForTags(tags, useDarkColors);
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
    window.isDarkBackground = isDarkBackground;
    window.isColorDark = isColorDark;
    window.TAG_COLORS = TAG_COLORS;
    window.TAG_COLORS_LIGHT = TAG_COLORS_LIGHT;
}
