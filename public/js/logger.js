/**
 * 统一日志系统 - 提供结构化、可配置的日志记录
 * 
 * 功能特点：
 * 1. 统一的日志格式和图标
 * 2. 可配置的日志级别
 * 3. 模块化的日志分类
 * 4. 性能友好的条件日志
 * 5. 扩展性强的架构
 */

(function() {
    'use strict';

    // 日志级别定义
    const LOG_LEVELS = {
        ERROR: 0,   // 错误：系统错误、功能失败
        WARN: 1,    // 警告：潜在问题、降级处理
        INFO: 2,    // 信息：重要状态变化、用户操作
        DEBUG: 3    // 调试：详细执行流程、开发调试
    };

    // 当前日志级别（生产环境建议设为 INFO）
    let currentLogLevel = LOG_LEVELS.INFO;

    // 模块分类和对应图标
    const MODULE_ICONS = {
        // 系统核心
        SYSTEM: '🚀',      // 系统启动、初始化
        CORE: '⚙️',        // 核心功能、元数据
        
        // 布局组件
        LAYOUT: '🏗️',      // 布局系统
        HEADER: '📋',      // 头部组件
        FOOTER: '📄',      // 底部组件
        MENU: '📱',        // 菜单系统
        
        // UI组件
        WIDGET: '🧩',      // UI小部件
        CARD: '🃏',        // 卡片组件
        TAG: '🏷️',        // 标签系统
        
        // 数据处理
        DATA: '📊',        // 数据处理
        FILE: '📁',        // 文件操作
        PATH: '🔄',        // 路径处理
        
        // 用户交互
        USER: '👤',        // 用户操作
        CLICK: '🖱️',       // 点击事件
        NAVIGATION: '🧭',  // 导航操作
        
        // 样式和主题
        STYLE: '🎨',       // 样式处理
        THEME: '🌓',       // 主题切换
        
        // 网络和加载
        LOAD: '📦',        // 资源加载
        NETWORK: '🌐',     // 网络请求
        
        // 状态和流程
        STATE: '📍',       // 状态变化
        FLOW: '➡️',        // 流程控制
        
        // 性能和优化
        PERF: '⚡',        // 性能相关
        CACHE: '💾',       // 缓存操作
        
        // 错误和调试
        ERROR: '❌',       // 错误信息
        WARN: '⚠️',        // 警告信息
        SUCCESS: '✅',     // 成功信息
        DEBUG: '🔍'        // 调试信息
    };

    // 日志级别对应的控制台方法和图标
    const LEVEL_CONFIG = {
        [LOG_LEVELS.ERROR]: { method: 'error', icon: '❌' },
        [LOG_LEVELS.WARN]:  { method: 'warn',  icon: '⚠️' },
        [LOG_LEVELS.INFO]:  { method: 'log',   icon: 'ℹ️' },
        [LOG_LEVELS.DEBUG]: { method: 'log',   icon: '🔍' }
    };

    /**
     * 核心日志函数
     * @param {number} level - 日志级别
     * @param {string} module - 模块名称
     * @param {string} message - 日志消息
     * @param {*} data - 可选的附加数据
     */
    function log(level, module, message, data = null) {
        // 检查日志级别
        if (level > currentLogLevel) {
            return;
        }

        const config = LEVEL_CONFIG[level];
        const moduleIcon = MODULE_ICONS[module] || '📝';
        const timestamp = new Date().toLocaleTimeString();
        
        // 构建日志消息
        const logMessage = `${moduleIcon} ${message}`;
        
        // 输出日志
        if (data !== null) {
            console[config.method](logMessage, data);
        } else {
            console[config.method](logMessage);
        }
    }

    /**
     * 便捷的日志方法
     */
    const Logger = {
        // 设置日志级别
        setLevel: function(level) {
            currentLogLevel = level;
            this.info('SYSTEM', `日志级别设置为: ${Object.keys(LOG_LEVELS)[level]}`);
        },

        // 错误日志
        error: function(module, message, data) {
            log(LOG_LEVELS.ERROR, module, message, data);
        },

        // 警告日志
        warn: function(module, message, data) {
            log(LOG_LEVELS.WARN, module, message, data);
        },

        // 信息日志
        info: function(module, message, data) {
            log(LOG_LEVELS.INFO, module, message, data);
        },

        // 调试日志
        debug: function(module, message, data) {
            log(LOG_LEVELS.DEBUG, module, message, data);
        },

        // 成功日志（特殊的信息日志）
        success: function(module, message, data) {
            const moduleIcon = MODULE_ICONS[module] || '📝';
            const logMessage = `✅ ${message}`;
            if (data !== null && data !== undefined) {
                console.log(logMessage, data);
            } else {
                console.log(logMessage);
            }
        },

        // 分组日志开始
        group: function(module, title) {
            if (currentLogLevel >= LOG_LEVELS.DEBUG) {
                const moduleIcon = MODULE_ICONS[module] || '📝';
                console.group(`${moduleIcon} ${title}`);
            }
        },

        // 分组日志结束
        groupEnd: function() {
            if (currentLogLevel >= LOG_LEVELS.DEBUG) {
                console.groupEnd();
            }
        },

        // 性能计时开始
        time: function(label) {
            if (currentLogLevel >= LOG_LEVELS.DEBUG) {
                console.time(`⚡ ${label}`);
            }
        },

        // 性能计时结束
        timeEnd: function(label) {
            if (currentLogLevel >= LOG_LEVELS.DEBUG) {
                console.timeEnd(`⚡ ${label}`);
            }
        }
    };

    // 预定义的常用日志方法（保持向后兼容）
    const CommonLogs = {
        // 系统相关
        systemStart: (message) => Logger.info('SYSTEM', `开始${message}`),
        systemComplete: (message) => Logger.success('SYSTEM', `${message}完成`),
        systemError: (message, error) => Logger.error('SYSTEM', `${message}失败`, error),

        // 组件相关
        componentInit: (name) => Logger.info('LAYOUT', `初始化${name}组件`),
        componentReady: (name) => Logger.success('LAYOUT', `${name}组件就绪`),
        componentError: (name, error) => Logger.error('LAYOUT', `${name}组件错误`, error),

        // 用户交互
        userAction: (action) => Logger.info('USER', action),
        clickEvent: (target) => Logger.debug('CLICK', `点击: ${target}`),
        navigationChange: (from, to) => Logger.info('NAVIGATION', `导航: ${from} → ${to}`),

        // 数据处理
        dataLoad: (type) => Logger.info('DATA', `加载${type}数据`),
        dataProcess: (type, count) => Logger.info('DATA', `处理${type}数据: ${count}项`),
        dataError: (type, error) => Logger.error('DATA', `${type}数据错误`, error),

        // 文件操作
        fileLoad: (filename) => Logger.debug('FILE', `加载文件: ${filename}`),
        fileProcess: (filename) => Logger.info('FILE', `处理文件: ${filename}`),
        fileError: (filename, error) => Logger.error('FILE', `文件错误: ${filename}`, error),

        // 样式和主题
        styleApply: (style) => Logger.debug('STYLE', `应用样式: ${style}`),
        themeChange: (theme) => Logger.info('THEME', `切换主题: ${theme}`),

        // 性能相关
        perfStart: (operation) => Logger.time(operation),
        perfEnd: (operation) => Logger.timeEnd(operation)
    };

    // 导出到全局
    if (typeof window !== 'undefined') {
        window.Logger = Logger;
        window.CommonLogs = CommonLogs;
        window.LOG_LEVELS = LOG_LEVELS;
        window.MODULE_ICONS = MODULE_ICONS;
    }

    // 初始化日志系统
    Logger.info('SYSTEM', 'Logger系统初始化完成');

})();
