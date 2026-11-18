export const SITE = {
  name: '数字海洋的月光',
  tagline: '鲸波深处，代码与月光共振',
  description: 'JerryBobAI 的个人品牌站：观点文章、创业点子、实战项目、在线产品与工具。',
  url: 'https://jerrybobai.github.io',
  author: 'JerryBobAI',
  github: 'https://github.com/JerryBobAI',
} as const;

export const NAV_ITEMS = [
  { href: '/blog/', label: '文章' },
  { href: '/tags/', label: '标签' },
  { href: '/ideas/', label: '点子' },
  { href: '/projects/', label: '项目' },
  { href: '/tools/', label: '工具' },
  { href: '/about/', label: '关于' },
] as const;
