# 分类页面架构说明

## 概述

本项目采用了基于继承的分类页面架构，通过一个通用的 `CategoryPageBase` 基类来避免代码重复，轻松创建各种分类页面。

## 架构优势

### 🎯 消除重复代码
- 所有分类页面共享相同的核心逻辑
- 标签过滤、分页、事件处理等功能统一实现
- 大幅减少代码维护成本

### 🚀 快速创建新页面
创建一个新的分类页面只需要：
1. 创建一个简单的配置对象
2. 调用通用初始化函数
3. 总共不到30行代码

### 🔧 高度可配置
每个分类页面可以独立配置：
- 分类标签和显示名称
- 页面标题
- 每页文章数量
- 日志前缀

## 使用方法

### 创建新的分类页面

```javascript
// 1. 定义页面配置
const newCategoryConfig = {
    categoryTag: '分类标签',      // 第一级标签，如 '个人', '工作', '学习'
    categoryName: '分类名称',     // 显示名称
    loggerPrefix: 'LOG_PREFIX',  // 日志前缀
    articlesPerPage: 20,         // 每页文章数量
    defaultTitle: '默认标题',     // 默认页面标题
    filteredTitle: '筛选后标题'   // 筛选后的标题
};

// 2. 初始化页面
function initializeNewCategoryPage() {
    const waitForDependencies = (retryCount = 0) => {
        if (typeof initializeCategoryPage !== 'undefined') {
            initializeCategoryPage(newCategoryConfig);
        } else if (retryCount < 20) {
            setTimeout(() => waitForDependencies(retryCount + 1), 100);
        } else {
            console.error('依赖加载超时，页面初始化失败');
        }
    };
    waitForDependencies();
}

// 3. 绑定初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNewCategoryPage);
} else {
    initializeNewCategoryPage();
}
```

## 现有页面示例

### 个人页面 (`personal.js`)
```javascript
const personalPageConfig = {
    categoryTag: '个人',
    categoryName: '个人',
    loggerPrefix: 'PERSONAL',
    articlesPerPage: 20,
    defaultTitle: '个人相关文章',
    filteredTitle: '筛选后的个人文章'
};
```

### 工作页面 (`work.js`)
```javascript
const workPageConfig = {
    categoryTag: '工作',
    categoryName: '工作',
    loggerPrefix: 'WORK',
    articlesPerPage: 20,
    defaultTitle: '工作相关文章',
    filteredTitle: '筛选后的工作文章'
};
```

### 学习页面 (`learn.js`)
```javascript
const learnPageConfig = {
    categoryTag: '学习',
    categoryName: '学习',
    loggerPrefix: 'LEARN',
    articlesPerPage: 20,
    defaultTitle: '学习相关文章',
    filteredTitle: '筛选后的学习文章'
};
```

## 核心文件

### `shared/category-page.js`
- `CategoryPageBase` 类：通用分类页面基类
- `initializeCategoryPage()` 函数：通用初始化函数
- 包含所有共享的页面逻辑

### 页面特定文件
- `pages/personal.js` - 个人页面
- `pages/work.js` - 工作页面
- `pages/learn.js` - 学习页面
- `pages/social.js` - 社交页面
- `pages/family.js` - 家庭页面

## 标签层级系统

系统基于标签的层级结构进行过滤：
- **第一级标签**：分类标识（如 `个人`、`工作`、`学习`）
- **后续标签**：具体分类（如 `哲学`、`心理`、`技术`）

示例：
```json
{
  "tags": ["个人", "哲学", "思考"]
  //       ↑第一级   ↑第二级  ↑第三级
}
```

## 扩展性

### 添加新分类
1. 确保文章的第一级标签使用新的分类名
2. 创建对应的页面配置
3. 在 `main.js` 中添加页面检测逻辑（如需要）

### 自定义功能
如果某个分类页面需要特殊功能，可以：
1. 继承 `CategoryPageBase` 类
2. 重写或扩展特定方法
3. 保持与基类的兼容性

## 维护建议

1. **统一修改**：核心逻辑修改只需要更新 `CategoryPageBase`
2. **配置驱动**：新功能优先通过配置实现
3. **向后兼容**：修改基类时保持接口稳定性
4. **文档更新**：新增配置项时及时更新文档