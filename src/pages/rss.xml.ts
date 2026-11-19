import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { SITE } from '../config/site';
import { notDraft, byDateDesc } from '../lib/content';

export async function GET(context: { site: URL }) {
  const posts = (await getCollection('blog', notDraft)).sort(byDateDesc);
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.summary,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}/`,
      categories: [...post.data.tags],
      // enclosure.length 必须是文件字节数，构建时从 public/ 读出
      ...(post.data.cover && {
        enclosure: {
          type: 'image/jpeg',
          url: post.data.cover,
          length: statSync(join(process.cwd(), 'public', post.data.cover)).size,
        },
      }),
    })),
    customData: '<language>zh-CN</language>',
  });
}
