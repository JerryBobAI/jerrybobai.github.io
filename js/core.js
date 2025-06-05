// 核心系统 - 元数据管理、路径处理、系统初始化

// =============== 路径处理工具 ===============

// 路径归一化工具，确保本地和线上环境一致
function normalizePath(path) {
    let normalizedPath = path;

    // 先尝试解码URL编码的字符
    try {
        normalizedPath = decodeURIComponent(normalizedPath);
    } catch (e) {
        console.log('⚠️ 路径解码失败，使用原始路径:', path);
    }

    const REPO_NAME = 'jerrybobai.github.io';
    const repoIndex = normalizedPath.indexOf(REPO_NAME + '/');
    if (repoIndex !== -1) {
        normalizedPath = normalizedPath.substring(repoIndex + REPO_NAME.length + 1);
    } else {
        const docsIndex = normalizedPath.indexOf('docs/timeline/');
        if (docsIndex !== -1) {
            normalizedPath = normalizedPath.substring(docsIndex);
        }
    }

    // 移除开头的斜杠
    if (normalizedPath.startsWith('/')) {
        normalizedPath = normalizedPath.substring(1);
    }

    console.log('🔄 路径归一化: ', path, ' -> ', normalizedPath);
    return normalizedPath;
}

// 判断当前路径是否为首页
function isRootPath(path) {
    const REPO_NAME = 'jerrybobai.github.io';
    return (
        path === '' ||
        path === 'index.html' ||
        path === REPO_NAME ||
        path === REPO_NAME + '/' ||
        path === REPO_NAME + '/index.html' ||
        (path.endsWith('index.html') && !path.includes('docs/'))
    );
}

// =============== 元数据管理 ===============

// 简化的元数据路径计算
function getMetadataPath() {
    const currentPath = window.location.pathname;
    console.log('🔍 当前页面路径:', currentPath);

    // 简化逻辑：如果在 docs/timeline 目录下，使用 ../../cache/metadata.json
    if (currentPath.includes('docs/timeline/')) {
        console.log('📁 检测到 timeline 目录，使用相对路径');
        return '../../cache/metadata.json';
    }
    // 如果在 docs 目录下，使用 ../cache/metadata.json
    else if (currentPath.includes('docs/')) {
        console.log('📁 检测到 docs 目录，使用相对路径');
        return '../cache/metadata.json';
    }
    // 根目录使用直接路径
    else {
        console.log('📁 根目录，使用直接路径');
        return 'cache/metadata.json';
    }
}

let metadataCache = null; // 全局缓存，避免重复加载

async function loadMetadata() {
    console.log('开始加载元数据, 当前缓存状态:', metadataCache);
    if (metadataCache) {
        console.log('使用缓存的元数据');
        return metadataCache;
    }

    const METADATA_PATH = getMetadataPath();
    console.log('尝试从路径加载元数据:', METADATA_PATH);

    try {
        const response = await fetch(METADATA_PATH);
        console.log('元数据请求响应状态:', response.status);
        if (response.ok) {
            metadataCache = await response.json();
            console.log('元数据加载成功:', Object.keys(metadataCache).length, '条记录');
        } else {
            console.error('无法加载元数据文件, 状态码:', response.status);
        }
    } catch (error) {
        console.error('加载元数据时出错:', error.message);
    }
    return metadataCache;
}

// 获取当前页面的元数据 - 增强调试版本，专门处理空格编码问题
function getPageMetadata(path) {
    console.log('🔍 查找页面元数据');
    console.log('📍 原始路径:', path);
    console.log('📊 元数据缓存状态:', metadataCache ? '已加载' : '未加载');

    if (!metadataCache) {
        console.log('❌ 元数据缓存为空');
        return null;
    }

    // 获取文件名（处理URL编码）
    const filename = path.split('/').pop();
    let decodedFilename = filename;
    try {
        decodedFilename = decodeURIComponent(filename);
    } catch (e) {
        console.log('⚠️ 文件名解码失败，使用原始文件名');
    }

    // 创建多种路径变体来处理各种编码情况
    const pathVariants = new Set(); // 使用Set避免重复

    // 基础路径变体
    pathVariants.add(path);
    pathVariants.add(normalizePath(path));
    pathVariants.add(path.replace(/^\/+/, ''));

    // 文件名变体
    pathVariants.add('docs/timeline/' + filename);
    pathVariants.add('docs/timeline/' + decodedFilename);

    // 处理URL解码
    try {
        const decodedPath = decodeURIComponent(path);
        pathVariants.add(decodedPath);
        pathVariants.add(decodedPath.replace(/^\/+/, ''));
        pathVariants.add(normalizePath(decodedPath));
    } catch (e) {
        console.log('⚠️ 路径解码失败');
    }

    // 特别处理空格编码问题
    // 将 %20 替换为空格
    const spaceDecodedPath = path.replace(/%20/g, ' ');
    pathVariants.add(spaceDecodedPath);
    pathVariants.add(spaceDecodedPath.replace(/^\/+/, ''));
    pathVariants.add(normalizePath(spaceDecodedPath));
    pathVariants.add('docs/timeline/' + spaceDecodedPath.split('/').pop());

    // 将空格替换为 %20
    const spaceEncodedPath = path.replace(/ /g, '%20');
    pathVariants.add(spaceEncodedPath);
    pathVariants.add(spaceEncodedPath.replace(/^\/+/, ''));
    pathVariants.add('docs/timeline/' + spaceEncodedPath.split('/').pop());

    const pathVariantsArray = Array.from(pathVariants);
    console.log('🔍 尝试的路径变体:', pathVariantsArray);
    console.log('📁 原始文件名:', filename);
    console.log('📁 解码文件名:', decodedFilename);

    // 精确匹配
    for (const variant of pathVariantsArray) {
        if (metadataCache[variant]) {
            console.log('✅ 找到精确匹配的元数据:', variant, metadataCache[variant]);
            return metadataCache[variant];
        }
    }

    // 如果精确匹配失败，尝试模糊匹配
    console.log('🔍 精确匹配失败，尝试模糊匹配');
    console.log('🔍 元数据中可用的键（前10个）:', Object.keys(metadataCache).slice(0, 10));

    // 获取不带路径的纯文件名进行模糊匹配
    const pureFilename = filename.replace(/^.*\//, '');
    const decodedPureFilename = decodedFilename.replace(/^.*\//, '');

    console.log('📁 纯文件名:', pureFilename);
    console.log('📁 解码纯文件名:', decodedPureFilename);

    const matchingKeys = Object.keys(metadataCache).filter(key => {
        const keyFilename = key.split('/').pop();
        return keyFilename === pureFilename ||
               keyFilename === decodedPureFilename ||
               key.includes(pureFilename) ||
               key.includes(decodedPureFilename);
    });

    console.log('📝 模糊匹配找到的键:', matchingKeys);

    // 使用第一个匹配的键
    if (matchingKeys.length > 0) {
        console.log('🎯 使用模糊匹配找到的第一个键:', matchingKeys[0]);
        return metadataCache[matchingKeys[0]];
    }

    console.log('❌ 未找到匹配的元数据');
    return null;
}

// =============== 系统初始化 ===============

// 注入全局样式
function injectGlobalStyles() {
    const globalStyleElement = document.createElement('style');
    globalStyleElement.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .scroll-fade {
            opacity: 0;
            transform: translateY(12px);
            transition: opacity 0.5s ease-out, transform 0.5s ease-out;
        }
        .scroll-fade.visible {
            opacity: 1;
            transform: translateY(0);
        }
        /* 头部、元信息、内容区块等动画样式略... 可根据需求补充 */
    `;
    document.head.appendChild(globalStyleElement);
}

// 设置滚动动画
function setupScrollAnimations() {
    const sections = document.querySelectorAll('.content-section, section, .card, .grid > div, .style-card, .layout-card');
    const textElements = document.querySelectorAll('h1:not(.fade-in), h2:not(.fade-in), h3:not(.fade-in), p:not(.fade-in), img:not(.fade-in), .chinese-title:not(.fade-in), .chinese-heading:not(.fade-in), .chinese-main-text:not(.fade-in)');
    sections.forEach(section => {
        if (!section.classList.contains('scroll-fade') && !section.classList.contains('fade-in')) {
            section.classList.remove('content-section');
            section.classList.add('scroll-fade');
        }
    });
    textElements.forEach(element => {
        if (!element.classList.contains('scroll-fade') && !element.classList.contains('fade-in')) {
            element.classList.add('scroll-fade');
        }
    });
    function checkVisibility() {
        const scrollElements = document.querySelectorAll('.scroll-fade');
        scrollElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementBottom = element.getBoundingClientRect().bottom;
            const isVisible = (elementTop < window.innerHeight - 50) && (elementBottom > 0);
            if (isVisible) {
                element.classList.add('visible');
            }
        });
    }
    setTimeout(checkVisibility, 100);
    window.addEventListener('scroll', checkVisibility);
}

// 主系统初始化函数
async function initializeCore() {
    // 只在主页面执行组件渲染逻辑
    const isInIframe = window.self !== window.top;
    console.log('🔍 是否在iframe中:', isInIframe);
    if (isInIframe) return;

    console.log('🚀 开始初始化核心系统');

    // 注入全局样式
    injectGlobalStyles();

    // 获取当前路径和首页状态
    const currentPath = normalizePath(window.location.pathname);
    const isRoot = isRootPath(currentPath);
    console.log('📍 当前归一化路径:', currentPath);
    console.log('🏠 是否为首页:', isRoot);

    // 加载元数据
    await loadMetadata();

    // 启动滚动动画
    setupScrollAnimations();

    console.log('✅ 核心系统初始化完成');

    // 返回系统状态供其他模块使用
    return {
        currentPath,
        isRoot,
        metadataCache
    };
}

// 导出函数供其他模块使用
if (typeof window !== 'undefined') {
    window.normalizePath = normalizePath;
    window.isRootPath = isRootPath;
    window.loadMetadata = loadMetadata;
    window.getPageMetadata = getPageMetadata;
    window.injectGlobalStyles = injectGlobalStyles;
    window.setupScrollAnimations = setupScrollAnimations;
    window.initializeCore = initializeCore;

    // 提供获取元数据缓存的方法
    window.getMetadataCache = () => metadataCache;
}
