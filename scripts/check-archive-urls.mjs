#!/usr/bin/env node
import { readdirSync, existsSync } from 'node:fs';

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
if (errors.length > 0) {
  console.error(`归档完整性检查失败，共 ${errors.length} 处：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`归档完整性检查通过：${files.length} 篇 + 依赖齐全`);
