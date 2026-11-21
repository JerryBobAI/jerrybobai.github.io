export const SITE = {
  name: 'Jerry 的造物间',
  tagline: '我用代码造一切',
  description: 'Jerry 的造物间：我用代码造一切——文章、点子、实战项目、在线产品与工具。',
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
