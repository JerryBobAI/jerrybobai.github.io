# 个人品牌站 Astro 重建 — 设计文档

日期：2026-11-18
状态：已批准（方案 A + GEO 增补）

## 1. 背景与目标

现站 `jerrybobai.github.io`（GitHub Pages 用户站）审计结论：

- Lighthouse 移动端性能 **32/100**（LCP 13.3s，首页 224 请求 / 2.3 MB）
- 首页用 `<iframe>` 嵌入 14 篇完整文章做预览，每篇各自加载 Tailwind Play CDN（官方禁止生产使用）
- 自造 CMS：`cache/update.py` 生成 `metadata.json` 索引 → 运行时 fetch + JS 注入渲染，索引失配即页面空白
- 对 AI 引擎（GEO）基本不可见：内容靠运行时 JS 渲染，爬虫拿到空 HTML
- 现有分类（family/learn/personal/social/work）是生活日志结构，与品牌目标不匹配

**目标**：长成个人品牌主页，五个内容方向——观点文章（原创为主）、创业点子库、实战项目、赚钱网站（反链回本站）、工具引流。

**现状资产**：368 篇 timeline 文章（收集类，HTML）+ 223 个 prompt md（14 分类）+ logo 图片，110 条提交历史。

## 2. 选型结论

**Astro**（最新稳定版），构建产物纯静态，继续托管 GitHub Pages，`main` 分支自动部署。

五条硬性标准（内容工作流 / 交互能力 / 性能 / 维护成本 / 生态寿命）上 Astro 是唯一全过候选。反悔条件：

1. 维护框架的心思超过写作本身 → 降级 Hugo 或纯 HTML
2. 出现真后端需求（账号/支付）→ 加 Supabase，框架不动
3. 国内访问成硬伤 → 换 Cloudflare Pages 托管，框架不动

## 3. 信息架构（方案 A）

| 路径 | 内容 | 说明 |
|---|---|---|
| `/` | 新首页 | hero + 三栏精选（blog/projects/tools 各取最新，空集合显示引导空状态） |
| `/blog/` `/blog/<slug>/` | 观点文章 | 列表页带 原创/转载 筛选 |
| `/ideas/` | 创业点子库 | 按 status 分组展示 |
| `/projects/` | 实战项目 + 在线产品 | 同页两分组（kind 字段），产品卡片带外链 |
| `/tools/` `/tools/<slug>/` | 工具引流 | 交互部分 island 按需加载（client:visible） |
| `/about/` | 关于我 | 品牌介绍 + 渠道入口，含 Person JSON-LD |
| `/docs/timeline/<原中文名>.html` | 旧 368 篇归档 | **URL 一字不动**；主导航不出现，页脚放「文章归档」入口 |

导航：文章 / 点子 / 项目 / 工具 / 关于（5 项）。赚钱网站不占独立栏目，作为 `/projects/` 的「在线产品」分组；将来产品 >5 个可升格为独立 `/products/`（加法升级，不返工）。

新内容一律英文 slug；旧归档保持中文文件名原样。

## 4. 内容集合 Schema（Astro Content Collections + Zod）

```yaml
# blog
title:        string
pubDate:      date
tags:         string[]      # 默认 []
origin:       原创 | 转载 | 翻译   # 默认 原创
source:       string?       # origin ≠ 原创 时必填（原文链接）
summary:      string        # 必填：列表摘要 + meta description + AI 引用锚点
draft:        bool          # 默认 false，true 则构建跳过

# ideas
title / pubDate / tags / summary / draft 同上
status:       种子 | 验证中 | 已验证 | 搁置   # 默认 种子

# projects
title / pubDate / tags / summary / draft 同上
kind:         实战项目 | 在线产品   # 默认 实战项目
link:         string?       # 在线产品外链（赚钱站地址）
status:       进行中 | 已上线 | 维护中 | 已归档
cover:        string?

# tools（代码页非 md；不用 collections，用 src/data/tools.ts 单文件注册表 + 同一 Zod schema 校验）
title / slug / description
status:       可用 | 开发中 | 规划中
order:        number?
```

所有字段 Zod 校验，构建期报错。

## 5. 内容迁移映射

| 现路径 | 去向 | 理由 |
|---|---|---|
| `docs/timeline/*.html`（368 篇） | `git mv` → `public/docs/timeline/` | URL 不变 |
| `js/`（18 文件） | `git mv` → `public/js/` | 归档页全部引用 `../../js/main.js` |
| `css/`（6 文件） | `git mv` → `public/css/` | 39 篇引用 `../../css/styles.css` |
| `images/`（5 文件） | `git mv` → `public/images/` | logo 等被引用 |
| `cache/metadata.json` | `git mv` → `public/cache/` | 旧 js 运行时依赖，避免 404 报错 |
| `cache/*.py`、`cache/README.md` | 删除 | 生成脚本不再需要（git 历史可找回） |
| `docs/family|learn|personal|social|work|tags`（6 空壳落地页） | 删除 | 旧 IA 导航壳，接受断链（记录在案） |
| 旧 `index.html` | 删除（被 Astro 首页替换） | 重写目的本身 |
| `prompt/`（223 md） | 留在仓库根 | 不进 `public/` 即不部署，符合「暂不上站」 |
| `RULES.md` `README.md` | 留在仓库根 | 工作文档，不部署 |

**明确不做（YAGNI）**：prompt 站点化、评论系统、后端功能、真后端账号体系、视觉精修（骨架先行，视觉在内容导入后迭代）。

## 6. GEO 基建

| 项目 | 做法 |
|---|---|
| 结构化数据 | 全站 JSON-LD：`WebSite`（首页）、`Person`（about，含 sameAs 渠道）、`Article`（每篇 blog：headline/datePublished/author） |
| `/llms.txt` | 站点一句话简介 + 五栏目链接 + 精选文章清单；构建时从 collections 生成（`src/pages/llms.txt.ts` endpoint） |
| robots.txt | `public/robots.txt`：允许全部（含 GPTBot / ClaudeBot / PerplexityBot / Google-Extended）+ sitemap 指向 |
| 必填 summary | blog `summary` 必填 → meta description，AI 引用的标准答案 |
| 语义化 HTML | 布局组件统一 `article` / `nav` / `h1-h3` 层级 |

## 7. 部署

`.github/workflows/deploy.yml`：官方 Astro GitHub Pages 流程——push `main` → `npm ci && astro build` → upload dist → deploy。本阶段**只提交本地，不推远端**；远端部署在用户明确 push 后生效。

## 8. 验收标准

1. `astro build` 零报错；`npm run check`（astro check）通过
2. Lighthouse 移动端性能 ≥ 90（基线 32）
3. 旧 URL 完整性：脚本核对 `public/docs/timeline/` 下 368 个文件与迁移清单一致，抽查 `/docs/timeline/<name>.html`、`/js/main.js`、`/css/styles.css` 路径可达
4. 五栏目导航可达；种子内容落地：blog 写入一篇《站点重建说明》（如实记录本次迁移，可后续修改/删除），构建后首页「文章」栏展示该文
5. GEO：blog 页面源码含 `Article` JSON-LD；首页含 `WebSite`；about 含 `Person`；`/llms.txt` 与 `robots.txt` 进构建产物
6. 归档页在无 JS 拦截下正常渲染（文章正文 + 旧导航不报错）
