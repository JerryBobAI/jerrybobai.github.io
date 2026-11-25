export const SITE = {
  name: 'Jerry 的造物间',
  tagline: '我用代码造一切',
  description: 'Jerry 的造物间：我用代码造一切——文章、点子、实战项目、在线产品与工具。',
  url: 'https://jerrybobai.github.io',
  author: 'JerryBobAI',
  github: 'https://github.com/JerryBobAI',
} as const;

/**
 * 导航栏目。locales 标注该栏目有哪些语言版本（缺省仅中文）；
 * SiteNav 只渲染当前语言下真实存在的栏目，避免点进去 404 或被扔回另一语言。
 */
export const NAV_ITEMS = [
  { href: '/blog/', key: 'nav.blog', locales: ['zh', 'en'] },
  { href: '/tags/', key: 'nav.tags' },
  { href: '/ideas/', key: 'nav.ideas' },
  { href: '/projects/', key: 'nav.projects' },
  { href: '/tools/', key: 'nav.tools' },
  { href: '/about/', key: 'nav.about', locales: ['zh', 'en'] },
] as const;
