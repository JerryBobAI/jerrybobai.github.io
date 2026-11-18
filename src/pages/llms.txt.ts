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
