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
    // 站内相对路径（如 /die-daily/）或完整外链均可
    link: z.string().optional(),
    status: z.enum(['进行中', '已上线', '维护中', '已归档']).default('进行中'),
    cover: z.string().optional(),
    // 卡片统计行（如「30 关」「每关 3 目标」）
    stats: z.array(z.string()).default([]),
    // 卡片 CTA 文案（默认「查看详情」）
    cta: z.string().optional(),
  }),
});

export const collections = { blog, ideas, projects };
