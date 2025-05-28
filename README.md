# JerryBob 个人网站

## 项目简介

这是JerryBob的个人网站，通过GitHub Pages托管。网站以「鲸波月影」为主题，融合了数字与艺术的元素，展示了AI、个人、家庭、工作和社交等多个领域的内容。

网站地址：[https://jerrybobai.github.io](https://jerrybobai.github.io)

## 网站结构

网站主要分为以下几个部分：

- **首页**：展示网站的主题「鲸波月影」和基本介绍
- **AI**：关于AI技术的文章和项目
- **个人**：个人成长和经历分享
- **家庭**：家庭生活相关内容
- **工作**：职业发展和工作经验
- **社交**：社交网络和社区活动

## 技术实现

### 使用的技术

- HTML5/CSS3：网站的基本结构和样式
- JavaScript：实现动态组件加载和交互功能
- Tailwind CSS：用于快速构建响应式界面
- Font Awesome：提供丰富的图标资源
- Google Fonts：使用Noto Sans SC等字体美化页面

### 组件系统

网站采用了组件化的设计方式，主要组件包括：

1. **Header组件**：导航栏，根据当前页面路径自动高亮对应的菜单项
2. **Footer组件**：页脚信息，包含版权声明和社交媒体链接
3. **iframe预览组件**：用于展示嵌入式内容

## 路径处理

网站针对不同的访问路径进行了特殊处理，确保在各种环境下（本地开发和GitHub Pages）都能正确显示：

```javascript
// 检查是否在根目录（首页）
const isRoot = currentPath === '/' ||
            currentPath === '/index.html' ||
            currentPath === '/jerrybobai.github.io' ||
            currentPath === '/jerrybobai.github.io/' ||
            currentPath === '/jerrybobai.github.io/index.html' ||
            (currentPath.endsWith('/index.html') && !currentPath.includes('/docs/'));
```

## 目录结构

```text
/
├── css/            # 样式文件
├── docs/           # 文档和内容
│   ├── ai/         # AI相关内容
│   ├── family/     # 家庭相关内容
│   ├── personal/   # 个人相关内容
│   ├── social/     # 社交相关内容
│   ├── timeline/   # 时间线内容
│   └── work/       # 工作相关内容
├── images/         # 图片资源
├── js/             # JavaScript文件
│   └── components.js  # 组件系统实现
└── index.html      # 网站首页
```

## 本地开发

1. 克隆仓库：

   ```bash
   git clone https://github.com/jerrybobai/jerrybobai.github.io.git
   ```

2. 使用本地服务器运行网站（可以使用VS Code的Live Server插件或其他HTTP服务器）

3. 在浏览器中访问 `http://localhost:端口号` 查看效果

## 部署说明

本网站通过GitHub Pages自动部署。当代码推送到main分支后，GitHub会自动构建并发布网站。

## 常见问题

### 路径问题

在不同环境下（本地开发vs GitHub Pages），网站的路径处理可能有所不同。如果遇到资源加载或导航问题，请检查`components.js`中的路径处理逻辑。

### 调试方法

网站在控制台输出了当前路径和首页判断结果，可以通过浏览器开发者工具查看：

```javascript
console.log('当前路径:', currentPath);
console.log('是否为首页:', isRoot);
```

## 联系方式

- 即刻：[JerryBob](https://web.okjike.com/u/8d6e830c-4da1-4753-ab41-020b91002aec)
- Twitter/X：[@JerryBobAI](https://x.com/JerryBobAI)
