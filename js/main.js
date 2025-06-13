/**
 * 主入口文件 - 统一管理所有JavaScript模块
 * 
 * 这个文件负责：
 * 1. 按正确顺序加载所有JavaScript模块
 * 2. 提供统一的初始化入口
 * 3. 简化HTML文件的引用（只需引用这一个文件）
 * 
 * 使用方法：
 * 在HTML文件中只需要添加：
 * <script src="../../js/main.js"></script>
 */

(function() {
    'use strict';

    // 检查是否在iframe中，如果是则跳过模块加载
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
        console.log('⚠️ 在iframe中，跳过模块系统加载');
        return;
    }

    // 使用更强的全局标志防止重复加载
    if (window.top.moduleSystemLoaded) {
        console.log('⚠️ 模块系统已加载，跳过重复加载');
        return;
    }

    // 立即设置标志到顶层窗口，防止并发加载
    window.top.moduleSystemLoaded = true;

    // 如果正在加载中，也跳过
    if (window.top.moduleSystemLoading) {
        console.log('⚠️ 模块系统正在加载中，跳过重复加载');
        return;
    }
    window.top.moduleSystemLoading = true;

    console.log('🚀 开始加载JavaScript模块系统...');
    
    // 检测当前页面类型
    const currentPath = window.location.pathname;
    const isHomepage = currentPath === '/' || (currentPath.endsWith('/index.html') && !currentPath.includes('/docs/'));
    const isTagsPage = currentPath.includes('/docs/tags/');

    console.log('🔍 页面检测信息:', {
        currentPath,
        isHomepage,
        isTagsPage
    });

    // 定义需要加载的模块列表（按依赖顺序）
    const coreModules = [
        'logger.js',           // 日志系统（最基础，其他模块都会使用）
        'utils.js',            // 工具函数（基础工具，其他模块可能依赖）
        'core.js',             // 核心系统（元数据管理、路径处理）
        'shared/articles.js',  // 共享文章管理逻辑
        'shared/pagination.js', // 共享分页逻辑
        'layout.js',           // 布局组件（header、footer、article-meta）
        'widgets.js'           // UI小部件（iframe预览、文章卡片）
    ];

    // 根据页面类型添加特定模块
    const pageModules = [];
    if (isHomepage) {
        pageModules.push('pages/homepage.js');
    } else if (isTagsPage) {
        pageModules.push('pages/tags.js');
    }

    const modules = [...coreModules, ...pageModules];
    
    // 获取当前脚本的基础路径
    function getBasePath() {
        const scripts = document.getElementsByTagName('script');
        const currentScript = scripts[scripts.length - 1];
        const src = currentScript.src;
        return src.substring(0, src.lastIndexOf('/') + 1);
    }
    
    const basePath = getBasePath();
    
    // 动态加载JavaScript文件
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = basePath + src;
            script.onload = () => {
                // logger.js加载完成后，后续模块都可以使用Logger
                if (src === 'logger.js') {
                    console.log(`✅ 模块加载完成: ${src}`);
                } else {
                    Logger.success('LOAD', `模块加载完成: ${src}`);
                }
                resolve();
            };
            script.onerror = () => {
                console.error(`❌ 模块加载失败: ${src}`);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }
    
    // 按顺序加载所有模块
    async function loadAllModules() {
        try {
            for (const module of modules) {
                await loadScript(module);
            }
            Logger.success('SYSTEM', `所有JavaScript模块加载完成 - 页面类型: ${isHomepage ? '首页' : isTagsPage ? '标签页' : '其他'}`);

            // 清除加载中标志
            window.top.moduleSystemLoading = false;

            // 所有模块加载完成后，初始化系统
            initializeSystem();

        } catch (error) {
            Logger.error('SYSTEM', '模块加载过程中出现错误', error);
            // 重置标志，允许重试
            window.top.moduleSystemLoaded = false;
            window.top.moduleSystemLoading = false;
        }
    }
    
    // 系统初始化
    function initializeSystem() {
        Logger.info('SYSTEM', '开始初始化系统...');
        
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performInitialization);
        } else {
            performInitialization();
        }
    }
    
    // 执行实际的初始化
    function performInitialization() {
        // 防止重复初始化
        if (window.top.systemInitialized) {
            Logger.debug('SYSTEM', '系统已初始化，跳过重复初始化');
            return;
        }
        window.top.systemInitialized = true;

        try {
            // 初始化布局组件（如果存在）
            if (typeof window.initializeLayout === 'function') {
                window.initializeLayout();
            }

            // 初始化UI小部件（如果存在）
            if (typeof window.initializeWidgets === 'function') {
                window.initializeWidgets();
            }

            Logger.success('SYSTEM', `系统初始化完成 - 页面类型: ${isHomepage ? '首页' : isTagsPage ? '标签页' : '其他'}`);

            // 页面特定的模块会自动初始化，无需在这里调用

        } catch (error) {
            Logger.error('SYSTEM', '系统初始化过程中出现错误', error);
            // 重置标志，允许重试
            window.top.systemInitialized = false;
        }
    }
    
    // 开始加载模块
    loadAllModules();
    
})();
