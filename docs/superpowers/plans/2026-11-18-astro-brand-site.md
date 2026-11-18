# Astro 品牌站重建 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec 重建 `jerrybobai.github.io`：Astro 外壳 + 五栏目 + 旧内容归档迁移（URL 不变）+ GEO 基建 + Pages 部署管线。

**Architecture:** 在仓库根手写 Astro 骨架（不用脚手架向导，避免在非空目录触发交互提示）；内容走 Content Collections（Zod 构建期校验）；旧 368 篇与旧运行时整体迁入 `public/` 保持原 URL；GEO = JSON-LD + llms.txt + robots.txt；官方 `withastro/action` 部署。

**Tech Stack:** Astro latest（v6 系）、Tailwind CSS 4（`@tailwindcss/vite` + `@tailwindcss/typography`）、`@astrojs/sitemap`、`@astrojs/check`、TypeScript strict。

**Spec:** `docs/superpowers/specs/2026-11-18-astro-brand-site-design.md`

## Global Constraints

- `site` 必须逐字为 `https://jerrybobai.github.io`（b-o-b-a-i，不是 blogai）
- 新内容英文 slug；旧归档中文文件名原样保留
- blog `summary` 必填；`origin ∈ {原创, 转载, 翻译}`，非原创必须带 `source`
- `draft: true` 的条目构建时跳过
- **本阶段所有提交只在本地，禁止 push**（用户明确指令）
- 禁破坏性 git 命令；**目录**删除走 `~/.Trash`，**单文件**可 rm
- 归档页依赖旧运行时：`js/ css/ images/ cache/metadata.json` 必须随迁 `public/`

---

### Task 1: Astro 骨架与构建管线

**Files:**
- Create: `astro.config.mjs`、`tsconfig.json`、`src/styles/global.css`、`src/pages/index.astro`（临时占位）、`public/favicon.svg`；`package.json` 由 npm 生成
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run build`（= `astro build`）、`npm run check`（= `astro check`）；`astro.config.mjs` 中 `site` 固定值

- [ ] **Step 1: 写配置文件**

`astro.config.mjs`：

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://jerrybobai.github.io',
  integrations: [sitemap()],
  vite: { plugins: [tailwindcss()] },
});
```

`tsconfig.json`：

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "public"]
}
```

`src/styles/global.css`：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
```

`public/favicon.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><text y="24" font-size="24">🌙</text></svg>
```

- [ ] **Step 2: 初始化 npm 并安装依赖（@latest 由 npm 解析版本）**

```bash
npm init -y
npm install astro@latest @astrojs/sitemap@latest tailwindcss@latest @tailwindcss/vite@latest @tailwindcss/typography@latest
npm install -D @astrojs/check@latest typescript@latest
```

- [ ] **Step 3: 设置 scripts 并更新 .gitignore**

```bash
npm pkg set scripts.dev="astro dev" scripts.build="astro build" scripts.preview="astro preview" scripts.check="astro check"
```

`.gitignore` 追加：

```
node_modules/
dist/
.astro/
```

- [ ] **Step 4: 临时首页占位（Task 4 整体替换）**

`src/pages/index.astro`：

```astro
---
---
<h1>骨架占位</h1>
```

- [ ] **Step 5: 验证构建**

Run: `npx astro build`
Expected: 出现 `build complete`，生成 `dist/index.html`，无 tailwind/sitemap 报错

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs tsconfig.json package.json package-lock.json src/styles/global.css src/pages/index.astro public/favicon.svg .gitignore
git commit -m "feat: Astro 项目骨架与构建管线"
```

### Task 2: 站点配置与内容集合 Schema

**Files:**
- Create: `src/config/site.ts`、`src/content.config.ts`、`src/data/tools.ts`、`src/lib/content.ts`

**Interfaces:**
- Produces: `SITE`、`NAV_ITEMS` 常量（`src/config/site.ts`）；collections `blog|ideas|projects`；`tools` 数组 + `ToolSchema`（`src/data/tools.ts`）；helpers `notDraft`、`byDateDesc`、`formatDate`（`src/lib/content.ts`）——后续所有页面任务消费这些名字

- [ ] **Step 1: `src/config/site.ts`**

```ts
export const SITE = {
  name: '数字海洋的月光',
  tagline: '鲸波深处，代码与月光共振',
  description: 'JerryBobAI 的个人品牌站：观点文章、创业点子、实战项目、在线产品与工具。',
  url: 'https://jerrybobai.github.io',
  author: 'GitHub',
  github: 'https://github.com/JerryBobAI',
} as const;

export const NAV_ITEMS = [
  { href: '/blog/', label: '文章' },
  { href: '/ideas/', label: '点子' },
  { href: '/projects/', label: '项目' },
  { href: '/tools/', label: '工具' },
  { href: '/about/', label: '关于' },
] as const;
```

- [ ] **Step 2: `src/content.config.ts`**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const shared = {
  title: z.string(),
  pubDate: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  summary: z.string(),
  draft: z.boolean().default(false),
};

const blog = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/blog' }),
  schema: z.object({
    ...shared,
    origin: z.enum(['原创', '转载', '翻译']).default('原创'),
    source: z.string().optional(),
  }),
});

const ideas = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/ideas' }),
  schema: z.object({
    ...shared,
    status: z.enum(['种子', '验证中', '已验证', '搁置']).default('种子'),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/projects' }),
  schema: z.object({
    ...shared,
    kind: z.enum(['实战项目', '在线产品']).default('实战项目'),
    link: z.string().url().optional(),
    status: z.enum(['进行中', '已上线', '维护中', '已归档']).default('进行中'),
    cover: z.string().optional(),
  }),
});

export const collections = { blog, ideas, projects };
```

- [ ] **Step 3: `src/data/tools.ts`**

```ts
import { z } from 'astro:content';

export const ToolSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  status: z.enum(['可用', '开发中', '规划中']).default('规划中'),
  order: z.number().optional(),
});

export type Tool = z.infer<typeof ToolSchema>;
export const tools: Tool[] = [];
```

- [ ] **Step 4: `src/lib/content.ts`**

```ts
import type { CollectionEntry } from 'astro:content';

export const notDraft = <T extends { data: { draft?: boolean } }>(entry: T): boolean =>
  !entry.data.draft;

type Dated = CollectionEntry<'blog' | 'ideas' | 'projects'>;
export const byDateDesc = (a: Dated, b: Dated): number =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

export const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

- [ ] **Step 5: 验证类型**

Run: `npx astro sync && npx astro check`
Expected: content collections 类型生成成功，check 无 error

- [ ] **Step 6: Commit**

```bash
git add src/config src/content.config.ts src/data src/lib
git commit -m "feat: 站点配置与内容集合 schema（Zod）"
```

### Task 3: 布局与 SEO/GEO 头部组件

**Files:**
- Create: `src/components/BaseHead.astro`、`src/components/SiteNav.astro`、`src/components/SiteFooter.astro`、`src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`（如需主题微调，保持最小）

**Interfaces:**
- Consumes: `SITE`、`NAV_ITEMS`（Task 2）
- Produces: `BaseLayout` props `{ title, description, jsonLd?: Record<string, unknown>[] }`——Task 4/6 的页面通过该 prop 注入 JSON-LD

- [ ] **Step 1: `src/components/BaseHead.astro`**

```astro
---
import { SITE } from '../config/site';

interface Props {
  title: string;
  description: string;
  image?: string;
}

const { title, description, image = '/images/logo/logo-original.png' } = Astro.props;
const canonical = new URL(Astro.url.pathname, SITE.url).href;
---
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
<meta property="og:type" content="website" />
<meta property="og:site_name" content={SITE.name} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={new URL(image, SITE.url).href} />
<meta name="twitter:card" content="summary" />
```

- [ ] **Step 2: `src/components/SiteNav.astro`**

```astro
---
import { SITE, NAV_ITEMS } from '../config/site';
---
<header class="border-b border-slate-200">
  <nav class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3" aria-label="主导航">
    <a href="/" class="text-lg font-bold">{SITE.name}</a>
    <ul class="flex gap-4 text-sm">
      {NAV_ITEMS.map((item) => (
        <li><a href={item.href} class="text-slate-600 hover:text-slate-900">{item.label}</a></li>
      ))}
    </ul>
  </nav>
</header>
```

- [ ] **Step 3: `src/components/SiteFooter.astro`**

```astro
---
import { SITE } from '../config/site';
const year = new Date().getFullYear();
---
<footer class="mt-16 border-t border-slate-200">
  <div class="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-500">
    <p>{SITE.tagline}</p>
    <p class="mt-2">
      <a href="/docs/timeline/" class="hover:text-slate-900">文章归档</a>
      <span class="mx-2">·</span>
      <a href={SITE.github} rel="me" class="hover:text-slate-900">GitHub</a>
      <span class="mx-2">·</span>
      <span>© {year} {SITE.author}</span>
    </p>
  </div>
</footer>
```

- [ ] **Step 4: `src/layouts/BaseLayout.astro`**

```astro
---
import BaseHead from '../components/BaseHead.astro';
import SiteNav from '../components/SiteNav.astro';
import SiteFooter from '../components/SiteFooter.astro';
import '../styles/global.css';

interface Props {
  title: string; description: string; jsonLd?: Record<string, unknown>[];
}
const { title, description, jsonLd = [] } = Astro.props;
---
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <BaseHead title={title} description={description} />
    {jsonLd.map((obj) => <script type="application/ld+json" set:html={JSON.stringify(obj)} />)}
  </head>
  <body class="min-h-screen bg-white text-slate-900 antialiased">
    <SiteNav />
    <main class="mx-auto max-w-3xl px-4 py-10">
      <slot />
    </main>
    <SiteFooter />
  </body>
</html>
```

- [ ] **Step 5: 验证**

Run: `npx astro build`
Expected: 构建成功；`dist/index.html` 含 `<nav` 与 og: 标签

- [ ] **Step 6: Commit**

```bash
git add src/components src/layouts
git commit -m "feat: 基础布局、导航页脚与 SEO/GEO 头部"
```

### Task 4: 五栏目页面 + 种子文章

**Files:**
- Modify: `src/pages/index.astro`（替换占位）
- Create: `src/pages/blog/index.astro`、`src/pages/blog/[slug].astro`、`src/pages/ideas/index.astro`、`src/pages/projects/index.astro`、`src/pages/tools/index.astro`、`src/pages/tools/[slug].astro`、`src/pages/about/index.astro`、`src/pages/docs/timeline/index.astro`、`src/content/blog/site-rebuild.md`

**Interfaces:**
- Consumes: Task 2 的 collections/helpers、Task 3 的 BaseLayout

- [ ] **Step 1: `src/pages/index.astro`（首页）**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import { SITE } from '../config/site';
import { notDraft, byDateDesc, formatDate } from '../lib/content';
import { tools } from '../data/tools';

const posts = (await getCollection('blog', notDraft)).sort(byDateDesc).slice(0, 3);
const projects = (await getCollection('projects', notDraft)).sort(byDateDesc).slice(0, 3);
const sortedTools = [...tools].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).slice(0, 3);

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    author: { '@type': 'Person', name: SITE.author, url: SITE.url },
  },
];
---
<BaseLayout title={`${SITE.name}`} description={SITE.description} jsonLd={jsonLd}>
  <section class="py-12 text-center">
    <h1 class="text-4xl font-bold">{SITE.name}</h1>
    <p class="mt-3 text-slate-600">{SITE.tagline}</p>
  </section>

  <section aria-labelledby="latest-posts" class="mt-8">
    <h2 id="latest-posts" class="border-b pb-2 text-xl font-bold">最新文章</h2>
    {posts.length === 0 && <p class="mt-4 text-slate-500">写作中，敬请期待。</p>}
    <ul class="mt-4 space-y-4">
      {posts.map((post) => (
        <li>
          <a href={`/blog/${post.id}/`} class="text-lg font-medium hover:underline">{post.data.title}</a>
          <p class="mt-1 text-sm text-slate-500">{formatDate(post.data.pubDate)} · {post.data.summary}</p>
        </li>
      ))}
    </ul>
    <a href="/blog/" class="mt-4 inline-block text-sm text-sky-700">查看全部 →</a>
  </section>

  <section aria-labelledby="latest-projects" class="mt-12">
    <h2 id="latest-projects" class="border-b pb-2 text-xl font-bold">项目与产品</h2>
    {projects.length === 0 && <p class="mt-4 text-slate-500">项目整理中，敬请期待。</p>}
    <ul class="mt-4 space-y-4">
      {projects.map((p) => (
        <li>
          <a href={p.data.link ?? `/projects/#${p.id}`} class="text-lg font-medium hover:underline">{p.data.title}</a>
          <p class="mt-1 text-sm text-slate-500">{p.data.summary}</p>
        </li>
      ))}
    </ul>
    <a href="/projects/" class="mt-4 inline-block text-sm text-sky-700">查看全部 →</a>
  </section>

  <section aria-labelledby="tools-section" class="mt-12">
    <h2 id="tools-section" class="border-b pb-2 text-xl font-bold">工具</h2>
    {sortedTools.length === 0 && <p class="mt-4 text-slate-500">工具制作中。每个工具独立成页，进入才加载交互代码。</p>}
    <ul class="mt-4 space-y-4">
      {sortedTools.map((t) => (
        <li>
          <a href={`/tools/${t.slug}/`} class="text-lg font-medium hover:underline">{t.title}</a>
          <p class="mt-1 text-sm text-slate-500">{t.description}</p>
        </li>
      ))}
    </ul>
  </section>
</BaseLayout>
```

- [ ] **Step 2: `src/pages/blog/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';
import { notDraft, byDateDesc, formatDate } from '../../lib/content';

const posts = (await getCollection('blog', notDraft)).sort(byDateDesc);
---
<BaseLayout title={`文章 · ${SITE.name}`} description="观点文章：原创为主，转载注明来源。">
  <h1 class="text-3xl font-bold">文章</h1>
  {posts.length === 0 && <p class="mt-6 text-slate-500">写作中，敬请期待。</p>}
  <ul class="mt-8 space-y-6">
    {posts.map((post) => (
      <li class="border-b pb-6">
        <a href={`/blog/${post.id}/`} class="text-xl font-medium hover:underline">{post.data.title}</a>
        <p class="mt-2 text-sm text-slate-500">
          {formatDate(post.data.pubDate)}
          <span class="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{post.data.origin}</span>
          {post.data.tags.map((t) => <span class="ml-1 text-xs text-slate-400">#{t}</span>)}
        </p>
        <p class="mt-2 text-slate-600">{post.data.summary}</p>
      </li>
    ))}
    </ul>
</BaseLayout>
```

- [ ] **Step 3: `src/pages/blog/[slug].astro`**

```astro
---
import { getCollection, render } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';
import { notDraft, formatDate } from '../../lib/content';

export async function getStaticPaths() {
  const posts = await getCollection('blog', notDraft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}

const { post } = Astro.props;
if (post.data.origin !== '原创' && !post.data.source) {
  throw new Error(`[${post.id}] origin 为 ${post.data.origin} 时必须填写 source`);
}
const { Content } = await render(post);

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.data.title,
    datePublished: post.data.pubDate.toISOString(),
    author: { '@type': 'Person', name: SITE.author, url: SITE.url },
    description: post.data.summary,
    mainEntityOfPage: new URL(Astro.url.pathname, SITE.url).href,
  },
];
---
<BaseLayout title={`${post.data.title} · ${SITE.name}`} description={post.data.summary} jsonLd={jsonLd}>
  <article>
    <h1 class="text-3xl font-bold">{post.data.title}</h1>
    <p class="mt-2 text-sm text-slate-500">
      {formatDate(post.data.pubDate)} · {post.data.origin}
      {post.data.source && <a href={post.data.source} class="ml-2 underline">原文</a>}
    </p>
    <div class="prose prose-slate mt-8 max-w-none">
      <Content />
    </div>
  </article>
</BaseLayout>
```

- [ ] **Step 4: ideas / projects / tools / about / 归档索引页**

`src/pages/ideas/index.astro`：

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';
import { notDraft, byDateDesc, formatDate } from '../../lib/content';

const entries = (await getCollection('ideas', notDraft)).sort(byDateDesc);
const STATUS_ORDER = ['种子', '验证中', '已验证', '搁置'] as const;
---
<BaseLayout title={`点子 · ${SITE.name}`} description="创业点子库：从种子到验证的全程记录。">
  <h1 class="text-3xl font-bold">创业点子</h1>
  {entries.length === 0 && <p class="mt-6 text-slate-500">点子库整理中，好东西攒够一轮就发。</p>}
  {STATUS_ORDER.map((status) => {
    const group = entries.filter((e) => e.data.status === status);
    if (group.length === 0) return null;
    return (
      <section class="mt-8">
        <h2 class="text-xl font-bold">{status}</h status-bug>
        <ul class="mt-3 space-y-3">
          {group.map((e) => (
            <li>
              <span class="font-medium">{e.data.title}</span>
              <span class="ml-2 text-sm text-slate-400">{formatDate(e.data.pubDate)}</span>
              <p class="mt-1 text-sm text-slate-500">{e.data.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  })}
</BaseLayout>
```

`src/pages/projects/index.astro`：

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';
import { notDraft, byDateDesc, formatDate } from '../../lib/content';

const entries = (await getCollection('projects', notDraft)).sort(byDateDesc);
const KINDS = ['实战项目', '在线产品'] as const;
---
<BaseLayout title={`项目 · ${SITE.name}`} description="实战项目与在线产品，产品外链直达，欢迎反链回来。">
  <h1 class="text-3xl font-bold">项目</h1>
  {entries.length === 0 && <p class="mt-6 text-slate-500">项目整理中，敬请期待。</p>}
  {KINDS.map((kind) => {
    const group = entries.filter((e) => e.data.kind === kind);
    if (group.length === 0) return null;
    return (
      <section class="mt-8">
        <h2 class="text-xl font-bold">{kind}</h2>
        <ul class="mt-3 space-y-3">
          {group.map((e) => (
            <li>
              {e.data.link
                ? <a href={e.data.link} class="font-medium underline">{e.data.title} ↗</a>
                : <span class="font-medium">{e.data.title}</span>}
              <span class="ml-2 text-sm text-slate-400">{formatDate(e.data.pubDate)}</span>
              <p class="mt-1 text-sm text-slate-500">{e.data.summary}</p>
            </li>
          ))}
        </ul>
      </section>
    );
  })}
</BaseLayout>
```

`src/pages/tools/index.astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';
import { tools } from '../../data/tools';

const sorted = [...tools].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
---
<BaseLayout title={`工具 · ${SITE.name}`} description="自制小工具，独立成页，按需加载。">
  <h1 class="text-3xl font-bold">工具</h1>
  {sorted.length === 0 && <p class="mt-6 text-slate-500">工具制作中。每个工具独立成页，进入才加载交互代码。</p>}
  <ul class="mt-6 space-y-4">
    {sorted.map((t) => (
      <li>
        <a href={`/tools/${t.slug}/`} class="text-lg font-medium hover:underline">{t.title}</a>
        <span class="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{t.status}</span>
        <p class="mt-1 text-sm text-slate-500">{t.description}</p>
      </li>
    ))}
  </ul>
</BaseLayout>
```

`src/pages/tools/[slug].astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { tools } from '../../data/tools';

export function getStaticPaths() {
  return tools.map((tool) => ({ params: { slug: tool.slug }, props: { tool } }));
}

const { tool } = Astro.props;
---
<BaseLayout title={`${tool.title} · 数字海洋的月光`} description={tool.description}>
  <h1 class="text-3xl font-bold">{tool.title}</h1>
  <p class="mt-2 text-slate-600">{tool.description}</p>
  <div class="mt-8 min-h-[200px] rounded border border-dashed border-slate-300 p-6 text-sm text-slate-400">
    <!-- 工具交互区：实现具体工具时在此挂载 island（client:visible） -->
  </div>
</BaseLayout>
```

`src/pages/about/index.astro`：

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../config/site';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: SITE.author,
    url: SITE.url,
    sameAs: [SITE.github],
    description: SITE.description,
  },
];
---
<BaseLayout title={`关于 · ${SITE.name}`} description={SITE.description} jsonLd={jsonLd}>
  <h1 class="text-3xl font-bold">关于</h1>
  <div class="mt-6 space-y-4 leading-relaxed text-slate-700">
    <p>我是 {SITE.author}。这里是我的个人品牌主页：观点文章、创业点子、实战项目、在线产品与工具。</p>
    <p>站点正在重建，内容陆续上线。</p>
    <p>GitHub：<a class="underline" href={SITE.github}>{SITE.github}</a></p>
  </div>
</BaseLayout>
```

`src/pages/docs/timeline/index.astro`（归档索引，构建时扫 public 目录生成列表）：

```astro
---
import fs from 'node:fs';
import path from 'node:path';
import BaseLayout from '../../../layouts/BaseLayout.astro';
import { SITE } from '../../../config/site';

const dir = path.resolve('public/docs/timeline');
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .sort();

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '文章归档',
    url: `${SITE.url}/docs/timeline/`,
  },
];
---
<BaseLayout title={`文章归档 · ${SITE.name}`} description={`重建前收集的文章，共 ${files.length} 篇。`} jsonLd={jsonLd}>
  <h1 class="text-3xl font-bold">文章归档</h1>
  <p class="mt-2 text-sm text-slate-500">重建前的 {files.length} 篇文章，全部保留在原路径。</p>
  <ul class="mt-6 space-y-2 text-sm">
    {files.map((name) => (
      <li>
        <a class="hover:underline" href={`/docs/timeline/${encodeURIComponent(name)}.html`}>{name}</a>
      </li>
    ))}
  </ul>
</BaseLayout>
```

- [ ] **Step 5: 种子文章 `src/content/blog/site-rebuild.md`**

```markdown
---
title: 站点重建说明
pubDate: 2026-11-18
tags: [站点公告]
summary: 本站已重建为 Astro 静态架构：加载更快、内容管线更干净，并补齐面向 AI 搜索的 GEO 基建。368 篇旧文章全部保留在原路径。
---
本站完成了一次彻底重建：

- **性能**：告别旧架构「首页 224 个请求、iframe 嵌套加载」，现在每页都是构建期生成的纯静态 HTML。
- **内容管线**：新文章以 Markdown 写作、提交即发布，不再手写 HTML 与维护生成脚本。
- **GEO**：全站输出 Schema.org JSON-LD、`llms.txt` 与放行 AI 爬虫的 `robots.txt`，让 AI 引擎读得懂、愿意引用。
- **归档**：此前收集的 368 篇文章在 `/docs/timeline/` 原路径完整保留。

规划栏目：文章、点子、项目、工具，更新陆续发布。
```

- [ ] **Step 6: 验证**

Run: `npx astro build`
Expected: 成功；`dist/blog/site-rebuild/index.html` 存在；`dist/docs/timeline/index.html` 此时尚无（迁移在 Task 5）——**注意**：归档索引页构建时读 `public/docs/timeline`，Task 4 构建会因目录不存在而失败。**执行顺序约束：本任务先建除归档索引外的页面并提交；归档索引页放 Task 5 迁移完成后创建。**

- [ ] **Step 7: Commit**

```bash
git add src/pages src/content
git commit -m "feat: 五栏目页面与种子文章"
```

### Task 5: 旧内容迁移（保 URL 不变）

**Files:**
- Move: `docs/timeline/ → public/docs/timeline/`、`js/ → public/js/`、`css/ → public/css/`、`images/ → public/images/`、`cache/metadata.json → public/cache/metadata.json`
- Create: `src/pages/docs/timeline/index.astro`（归档索引页，延后自此任务）
- Delete: `cache/file.py`、`cache/update.py`、`cache/README.md`（单文件 rm）、旧 `index.html`（单文件 rm）
- Trash: `docs/family|learn|personal|social|work|tags` 六个目录 → `~/.Trash/<名>-<时间戳>`

**Interfaces:**
- Produces: `public/docs/timeline/` 下恰好 368 个 html；Task 7 校验脚本以此数量为准

- [ ] **Step 1: 迁移（git mv 保历史）**

```bash
mkdir -p public/docs public/cache
git mv docs/timeline public/docs/timeline
git mv js public/js
git mv css public/css
git mv images public/images
git mv cache/metadata.json public/cache/metadata.json
```

- [ ] **Step 2: 删除废弃文件（单文件 rm）与空壳目录（Trash）**

```bash
rm cache/file.py cache/update.py cache/README.md index.html
ts=$(date +%Y%m%d-%H%M%S)
for d in family learn personal social work tags; do mv "docs/$d" "$HOME/.Trash/${d}-${ts}"; done
```

- [ ] **Step 3: 创建归档索引页 `src/pages/docs/timeline/index.astro`（代码见 Task 4 Step 4 末尾，原样创建）**

- [ ] **Step 4: 验证迁移**

```bash
find public/docs/timeline -name '*.html' | wc -l   # 期望 368
test -f public/js/main.js && test -f public/css/styles.css && test -f public/cache/metadata.json && echo deps-ok
npx astro build
ls dist/docs/timeline/*.html | wc -l              # 期望 369（368 + 索引页）
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: 迁移 368 篇归档与旧运行时到 public，URL 保持不变"
```

### Task 6: GEO 基建收尾

**Files:**
- Create: `src/pages/llms.txt.ts`、`public/robots.txt`

**Interfaces:**
- Consumes: collections + `notDraft/byDateDesc`（Task 2）

- [ ] **Step 1: `src/pages/llms.txt.ts`**

```ts
import { getCollection } from 'astro:content';
import { SITE } from '../config/site';
import { notDraft, byDateDesc } from '../lib/content';

export async function GET() {
  const posts = (await getCollection('blog', notDraft)).sort(byDateDesc);
  const lines = [
    `# ${SITE.name}`,
    '',
    `> ${SITE.description}`,
    '',
    '## 栏目',
    `- [文章](${SITE.url}/blog/): 观点文章，原创为主，转载注明来源`,
    `- [点子](${SITE.url}/ideas/): 创业点子库`,
    `- [项目](${SITE.url}/projects/): 实战项目与在线产品`,
    `- [工具](${SITE.url}/tools/): 自制小工具`,
    `- [关于](${SITE.url}/about/): 品牌介绍`,
    `- [文章归档](${SITE.url}/docs/timeline/): 368 篇历史文章`,
    '',
    '## 文章',
    ...posts.map((p) => `- [${p.data.title}](${SITE.url}/blog/${p.id}/): ${p.data.summary}`),
  ];
  return new Response(lines.join('\n') + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

- [ ] **Step 2: `public/robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://jerrybobai.github.io/sitemap-index.xml
```

- [ ] **Step 3: 验证 GEO**

```bash
npx astro build
grep -c 'application/ld+json' dist/index.html dist/about/index.html dist/blog/site-rebuild/index.html
grep -o '"@type":"WebSite"' dist/index.html
grep -o '"@type":"Article"' dist/blog/site-rebuild/index.html
grep -o '"@type":"Person"' dist/about/index.html
test -f dist/llms.txt && test -f dist/robots.txt && echo geo-files-ok
```

Expected: 三页各含 ld+json（首页可能 1 处，about 1 处，blog 文章页 1 处 + BaseHead 无）；类型标记全部命中；geo-files-ok

- [ ] **Step 4: Commit**

```bash
git add src/pages/llms.txt.ts public/robots.txt
git commit -m "feat: GEO 基建（llms.txt + robots.txt，JSON-LD 已随页面落地）"
```

### Task 7: 部署管线与归档校验脚本

**Files:**
- Create: `.github/workflows/deploy.yml`、`scripts/check-archive-urls.mjs`
- Modify: `package.json`（加 `verify:archive` script）

**Interfaces:**
- Produces: push main 即自动部署（远端生效需用户亲自 push）；`npm run verify:archive`

- [ ] **Step 1: `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: withastro/action@v3
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: `scripts/check-archive-urls.mjs`**

```js
#!/usr/bin/env node
import { readdirSync, existsSync } from 'node:fs';

const EXPECTED_COUNT = 368;
const dir = 'public/docs/timeline';
const files = readdirSync(dir).filter((f) => f.endsWith('.html'));

const errors = [];
if (files.length !== EXPECTED_COUNT) {
  errors.push(`归档页数量不符：期望 ${EXPECTED_COUNT}，实际 ${files.length}`);
}
for (const dep of [
  'public/js/main.js',
  'public/css/styles.css',
  'public/images/logo/logo-original.png',
  'public/cache/metadata.json',
]) {
  if (!existsSync(dep)) errors.push(`归档页依赖缺失：${dep}`);
}
const spotChecks = ['体验 · 创造 · 连接：生命的三位一体.html', '人生是一座空园 · 耕耘的意义.html'];
for (const name of spotChecks) {
  if (!existsSync(`${dir}/${name}`)) errors.push(`抽查文件缺失：${name}`);
}

if (errors.length > 0) {
  console.error('❌ 归档完整性检查失败：');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✅ 归档完整性检查通过：${files.length} 篇 + 依赖齐全`);
```

- [ ] **Step 3: 注册 script 并验证**

```bash
npm pkg set scripts.verify:archive="node scripts/check-archive-urls.mjs"
npm run verify:archive
```

Expected: `✅ 归档完整性检查通过`

- [ ] **Step 4: Commit**

```bash
git add .github scripts package.json
git commit -m "feat: GitHub Pages 部署管线与归档 URL 校验脚本"
```

### Task 8: 最终验证与修复循环

**Files:**
- Modify: 任何验证暴露问题的文件（修复后随本任务提交）

**Interfaces:**
- Consumes: 全部前序任务产物

- [ ] **Step 1: 全量构建与类型检查**

```bash
npm run build && npm run check
```
Expected: 双双通过。失败 → 修复 → 重跑（修复循环）

- [ ] **Step 2: 归档与 GEO 检查**

```bash
npm run verify:archive
grep -o '"@type":"WebSite"' dist/index.html
grep -o '"@type":"Article"' dist/blog/site-rebuild/index.html
grep -o '"@type":"Person"' dist/about/index.html
test -f dist/llms.txt && test -f dist/robots.txt && echo geo-ok
ls dist/docs/timeline/*.html | wc -l   # 369
```

- [ ] **Step 3: Lighthouse 性能验证（headless，对 dist 本地预览）**

```bash
npx astro preview --port 4321 &
sleep 3
npx lighthouse http://localhost:4321 --output=json --output-path=/tmp/lh-new.json --quiet --only-categories=performance --chrome-flags="--headless=new"
python3 -I -c "import json; print('Performance:', round(json.load(open('/tmp/lh-new.json'))['categories']['performance']['score']*100))"
kill %1
```
Expected: **≥ 90**（基线 32）。不达标 → 排查阻塞资源/字体/图片 → 修复 → 重测

- [ ] **Step 4: 收尾提交（如有修复）**

```bash
git add -A
git commit -m "fix: 最终验证修复"
```

## 执行说明

- 每 Task 完成即本地 commit，**全程不 push**
- Task 4 归档索引页与 Task 5 有依赖关系，已按「先页面后迁移」拆开执行顺序（索引页在 Task 5 Step 3 创建）
- Lighthouse 跑分前确认无残留 headless Chrome 进程（`pkill -f "headless"` 谨慎使用，仅杀本任务启动的）
