import { SITE } from '../config/site';

/** 站点支持的 locale；中文为默认，路径无前缀，英文走 /en/ 前缀 */
export const LOCALES = { zh: '中文', en: 'English' } as const;
export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = 'zh';

/** <html lang> 属性值 */
export const HTML_LANG: Record<Locale, string> = { zh: 'zh-CN', en: 'en' };

/** og:locale（Facebook 格式，下划线分隔） */
export const OG_LOCALE: Record<Locale, string> = { zh: 'zh_CN', en: 'en_US' };

/** 各语言站名展示形式（品牌名中文不变，英文用译名） */
export const SITE_NAME: Record<Locale, string> = { zh: SITE.name, en: "Jerry's Workshop" };

/**
 * UI 字符串字典。key 全站唯一，中文是基准集——新增 key 先补 zh 再补 en。
 */
const UI = {
  zh: {
    'site.tagline': SITE.tagline,
    'nav.aria': '主导航',
    'nav.blog': '文章',
    'nav.tags': '标签',
    'nav.ideas': '点子',
    'nav.projects': '项目',
    'nav.tools': '工具',
    'nav.about': '关于',
    'footer.archive': '文章归档',
    'langswitch.label': 'EN',
    'langswitch.title': 'Switch to English',
  },
  en: {
    'site.tagline': 'I build everything with code',
    'nav.aria': 'Main navigation',
    'nav.blog': 'Blog',
    'nav.tags': 'Tags',
    'nav.ideas': 'Ideas',
    'nav.projects': 'Projects',
    'nav.tools': 'Tools',
    'nav.about': 'About',
    'footer.archive': 'Archive',
    'langswitch.label': '中文',
    'langswitch.title': '切换到中文',
  },
} as const;

export type UiKey = keyof typeof UI['zh'];

/** 按语言取 UI 字符串；某语言缺 key 时回落中文 */
export function useTranslations(locale: Locale) {
  return (key: UiKey): string => UI[locale][key] ?? UI[DEFAULT_LOCALE][key];
}

/**
 * 拼出带 locale 前缀的路径：默认语言无前缀，其余语言加 /en 前缀。
 * 注意：仅当对应语言的页面真实存在时才用它生成链接（切换器语义）。
 */
export function localePath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return `/en${path === '/' ? '' : path}`;
}
