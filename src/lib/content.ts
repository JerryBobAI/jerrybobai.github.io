import type { CollectionEntry } from 'astro:content';

export const notDraft = <T extends { data: { draft?: boolean } }>(entry: T): boolean =>
  !entry.data.draft;

type Dated = CollectionEntry<'blog' | 'blogEn' | 'ideas' | 'projects'>;

export const byDateDesc = (a: Dated, b: Dated): number =>
  b.data.pubDate.valueOf() - a.data.pubDate.valueOf();

export const formatDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
