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
    
    console.log('🚀 开始加载JavaScript模块系统...');
    
    // 定义需要加载的模块列表（按依赖顺序）
    const modules = [
        'utils.js',      // 工具函数（最基础，其他模块可能依赖）
        'core.js',       // 核心系统（元数据管理、路径处理）
        'layout.js',     // 布局组件（header、footer、article-meta）
        'widgets.js'     // UI小部件（iframe预览、文章卡片）
    ];
    
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
                console.log(`✅ 模块加载完成: ${src}`);
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
            console.log('✅ 所有JavaScript模块加载完成');
            
            // 所有模块加载完成后，初始化系统
            initializeSystem();
            
        } catch (error) {
            console.error('❌ 模块加载过程中出现错误:', error);
        }
    }
    
    // 系统初始化
    function initializeSystem() {
        console.log('🔧 开始初始化系统...');
        
        // 等待DOM完全加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performInitialization);
        } else {
            performInitialization();
        }
    }
    
    // 执行实际的初始化
    function performInitialization() {
        try {
            // 初始化核心系统（如果存在）
            if (typeof window.initializeSystem === 'function') {
                window.initializeSystem();
            }
            
            // 初始化布局组件（如果存在）
            if (typeof window.initializeLayout === 'function') {
                window.initializeLayout();
            }
            
            // 初始化UI小部件（如果存在）
            if (typeof window.initializeWidgets === 'function') {
                window.initializeWidgets();
            }
            
            console.log('✅ 系统初始化完成');
            
        } catch (error) {
            console.error('❌ 系统初始化过程中出现错误:', error);
        }
    }
    
    // 开始加载模块
    loadAllModules();
    
})();
