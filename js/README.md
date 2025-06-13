# JavaScript 模块架构说明

## 文件结构

```
js/
├── main.js      # 主入口文件（统一加载器）
├── logger.js    # 统一日志系统
├── utils.js     # 共享工具函数
├── core.js      # 核心系统功能
├── layout.js    # 布局组件
└── widgets.js   # UI小部件
```

## 使用方法

### 在HTML文件中引用

只需要在HTML文件中添加一行：

```html
<script src="../../js/main.js"></script>
```

**注意：** 不需要再引用其他JavaScript文件，`main.js` 会自动按正确顺序加载所有必要的模块。

### 模块加载顺序

`main.js` 会按以下顺序自动加载模块：

1. `logger.js` - 统一日志系统
2. `utils.js` - 基础工具函数
3. `core.js` - 核心系统功能
4. `layout.js` - 布局组件
5. `widgets.js` - UI小部件

## 各模块功能

### main.js
- 统一的JavaScript入口点
- 自动按依赖顺序加载所有模块
- 处理模块加载错误
- 系统初始化协调

### logger.js
- 统一的日志记录系统
- 可配置的日志级别
- 模块化的日志分类
- 性能友好的条件日志

### utils.js
- 标签颜色生成函数
- 标签HTML构建函数
- 其他共享工具函数

### core.js
- 元数据管理系统
- 路径处理函数
- 系统核心初始化

### layout.js
- Header组件
- Footer组件
- Article Meta组件
- 布局相关功能

### widgets.js
- iframe预览卡片组件
- 文章卡片组件
- UI小部件管理

## 日志系统使用

### 基本用法

```javascript
// 错误日志
Logger.error('MODULE', '错误信息', errorObject);

// 警告日志
Logger.warn('MODULE', '警告信息');

// 信息日志
Logger.info('MODULE', '重要信息');

// 调试日志
Logger.debug('MODULE', '调试信息');

// 成功日志
Logger.success('MODULE', '操作成功');
```

### 模块分类

使用预定义的模块图标：
- `SYSTEM` 🚀 - 系统启动、初始化
- `LAYOUT` 🏗️ - 布局系统
- `HEADER` 📋 - 头部组件
- `MENU` 📱 - 菜单系统
- `DATA` 📊 - 数据处理
- `STYLE` 🎨 - 样式处理
- `ERROR` ❌ - 错误信息

### 日志级别

```javascript
// 设置日志级别（生产环境建议设为 INFO）
Logger.setLevel(LOG_LEVELS.INFO);
```

- `ERROR` (0) - 只显示错误
- `WARN` (1) - 显示警告和错误
- `INFO` (2) - 显示信息、警告和错误
- `DEBUG` (3) - 显示所有日志

## 添加新模块

如果需要添加新的JavaScript模块：

1. 在 `js/` 目录下创建新的 `.js` 文件
2. 在 `main.js` 的 `modules` 数组中添加新文件名
3. 确保按依赖关系正确排序
4. 如果新模块有初始化函数，在 `performInitialization()` 中调用

示例：
```javascript
// 在 main.js 中添加新模块
const modules = [
    'utils.js',
    'core.js',
    'layout.js',
    'widgets.js',
    'new-module.js'  // 新模块
];

// 在初始化函数中调用新模块的初始化
function performInitialization() {
    // ... 现有初始化代码 ...
    
    // 初始化新模块（如果存在）
    if (typeof window.initializeNewModule === 'function') {
        window.initializeNewModule();
    }
}
```

## 优势

1. **简化引用**：HTML文件只需引用一个文件
2. **依赖管理**：自动处理模块间的依赖关系
3. **错误处理**：统一的错误处理和日志记录
4. **易于维护**：添加新模块时不需要修改所有HTML文件
5. **加载优化**：按需加载，避免重复引用

## 调试

在浏览器控制台中可以看到详细的加载日志：
- `🚀 开始加载JavaScript模块系统...`
- `✅ 模块加载完成: xxx.js`
- `✅ 所有JavaScript模块加载完成`
- `🔧 开始初始化系统...`
- `✅ 系统初始化完成`
