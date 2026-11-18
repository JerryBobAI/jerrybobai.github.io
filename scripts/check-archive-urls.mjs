#!/usr/bin/env node
import { readdirSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const EXPECTED_COUNT = 368;
const dir = 'public/docs/timeline';
const files = readdirSync(dir).filter((f) => f.endsWith('.html'));

const errors = [];
if (files.length !== EXPECTED_COUNT) {
  errors.push(`期望 368 篇，实际 ${files.length} 篇`);
}
for (const dep of ['public/js/main.js', 'public/css/styles.css', 'public/images/logo/logo-original.png', 'public/cache/metadata.json']) {
  if (!existsSync(dep)) errors.push(`依赖缺失：${dep}`);
}
const spotChecks = ['体验 · 创造 · 连接：生命的三位一体.html', '人生是一座空园 · 耕耘的意义.html'];
for (const name of spotChecks) {
  if (!existsSync(`${dir}/${name}`)) errors.push(`抽查缺失：${name}`);
}
// 外链回归守卫：归档页禁止引用远程 CSS/JS（曾因国内访问 CDN 阻塞导致打开极慢）
const EXTERNAL_REF = /<(?:script[^>]*src|link[^>]*href)="https?:\/\/[^"]+"/;
// @import url(...) 不走 link/script 标签，曾被守卫漏掉（Google Fonts 被墙拖住整页渲染）
const CSS_IMPORT = /@import\s+url\(['"]?https?:\/\//;
const BLOCKED_HOST = /fonts\.(googleapis|gstatic)\.com/;
// 关键 CSS/JS 必须内联进 HTML（国内访问 GH Pages 高时延，串行外链请求 = 白屏放大器）
const MUST_INLINE = /<(?:link[^>]*tailwind-compiled\.css|script src="\/js\/article-bundle\.js)/;
for (const f of files) {
  const html = readFileSync(`${dir}/${f}`, 'utf-8');
  const m = html.match(EXTERNAL_REF) || html.match(CSS_IMPORT);
  if (m) errors.push(`${f} 引用了远程资源：${m[0].slice(0, 80)}`);
  const h = html.match(BLOCKED_HOST);
  if (h) errors.push(`${f} 引用了被墙字体域名：${h[0]}`);
  const i = html.match(MUST_INLINE);
  if (i) errors.push(`${f} 未内联关键资源（应内嵌而非外链）：${i[0].slice(0, 60)}`);
  if (html.includes('\\&') || html.includes("media=\\'")) errors.push(`${f} 事件属性含坏转义（\\& / \\'）`);
}
if (errors.length > 0) {
  console.error(`归档完整性检查失败，共 ${errors.length} 处：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`归档完整性检查通过：${files.length} 篇 + 依赖齐全 + 外链资源为零`);
