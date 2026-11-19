# JerryBob 个人网站

以「鲸波月影」为主题的个人品牌站：鲸波深处，代码与月光共振。

**线上地址**：[https://jerrybobai.github.io](https://jerrybobai.github.io)

## 网站栏目

- **文章**：观点文章，原创为主（支持标签筛选与 `?tag=` 链入过滤）
- **标签**：全站标签索引
- **点子**：想法与灵感碎片
- **项目**：实战项目与在线产品，卡片直达（含 [Courses 学习中心](https://jerrybobai.github.io/courses/)、[DieDaily](https://jerrybobai.github.io/die-daily/) 等）
- **工具**：在线小工具
- **关于**：个人介绍

## 技术栈

- [Astro](https://astro.build)（静态生成，零客户端框架）
- [Tailwind CSS v4](https://tailwindcss.com) + `@tailwindcss/typography`（长文排版）
- 纯浅色主题；Open Graph 社交分享卡片（文章页用封面图）；RSS feed（`/rss.xml`）
- GitHub Actions 自动部署到 GitHub Pages

## 本地开发

```bash
npm install
npm run dev       # 开发服务器 localhost:4321
npm run build     # 构建到 dist/
npm run preview   # 预览构建产物
```

## 内容管理

内容集合在 `src/content/`，均为带 frontmatter 的 Markdown：

| 集合 | 目录 | 说明 |
|---|---|---|
| `blog` | `src/content/blog/` | 文章：`title / pubDate / tags / summary / origin / cover(可选) / draft` |
| `projects` | `src/content/projects/` | 项目卡：`kind / status / cover / link / stats / cta` |
| `ideas` | `src/content/ideas/` | 点子：`status`（种子→验证中→已验证→搁置） |

新建文章：在 `src/content/blog/` 新建 `.md` 文件即可，构建时自动进列表与标签索引。

## 子项目托管

`public/` 下的静态子站随主站一同部署：

- `public/courses/` — Courses 学习中心（6 门课，蒸馏笔记 + 时间戳 seek 视频 + 论文库 + 间隔复习）
- `public/die-daily/` — DieDaily 每日一死小游戏

新项目产物通过 `scripts/sync-projects.sh` 一键同步：构建 → rsync 进 `public/` → 统一本地提交（脚本顶部 `PROJECTS` 表登记，只本地提交、push 需人工确认）。

## 目录结构

```
src/
├── content/          # 内容集合（blog / projects / ideas）
├── content.config.ts # 集合 schema 定义
├── layouts/          # BaseLayout 等
├── components/       # SiteNav / BackLink 等
├── pages/            # 路由：blog / projects / ideas / tags / tools / docs / about
└── lib/              # 内容工具函数（排序、过滤、日期）
public/               # 构建直出资源（covers / courses / die-daily）
scripts/              # sync-projects.sh 项目产物同步
```

## 许可

文章内容版权归 JerryBob 所有；代码部分可参考，转载文章请注明来源。
