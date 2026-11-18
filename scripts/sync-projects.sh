#!/usr/bin/env bash
# 一键同步项目构建产物到品牌站（触发口令：「项目部署同步」）
#
# 用法：
#   scripts/sync-projects.sh            # 同步所有已登记项目
#   scripts/sync-projects.sh die-daily  # 只同步指定项目
#
# 新增项目：在下方 PROJECTS 表登记一行「名称|构建目录|构建命令|产物源|站内目标」
# 流程：逐个构建 + rsync → 品牌站统一 build → 所有变化合并成一个本地 commit
# 注意：按用户规范，脚本只做本地提交，push 必须等用户明示同意
set -euo pipefail

SITE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 名称|构建目录|构建命令|产物源目录（尾斜杠）|站内目标路径
PROJECTS=(
  "die-daily|$HOME/Workspace/Creation/die-daily/app|npm run build|$HOME/Workspace/Creation/die-daily/app/dist/|public/die-daily/"
)

# ---- 解析参数，筛出要同步的项目 ----
requested="${*:-}"
targets=()
names=()
for p in "${PROJECTS[@]}"; do
  name="${p%%|*}"
  names+=("$name")
  if [ -z "$requested" ] || [ "$requested" = "$name" ]; then
    targets+=("$p")
  fi
done

if [ ${#targets[@]} -eq 0 ]; then
  echo "未找到项目「${requested}」，已登记：${names[*]}" >&2
  exit 1
fi

cd "$SITE_DIR"

# ---- 逐个项目：构建 + rsync ----
synced=()
for p in "${targets[@]}"; do
  IFS='|' read -r name build_dir build_cmd src dest <<<"$p"
  echo "==> [$name] 构建（${build_cmd}）"
  (cd "$build_dir" && $build_cmd)
  echo "==> [$name] rsync 产物 → $dest/"
  rsync -a --delete --exclude='.DS_Store' "$src" "$SITE_DIR/$dest/"
  synced+=("$name")
done

# ---- 品牌站统一构建 ----
echo "==> 品牌站构建（astro build）"
npm run build

# ---- 所有产物变化合并为一个本地提交 ----
echo "==> 本地提交（不 push）"
if [ -z "$(git status --porcelain -- public)" ]; then
  echo "产物无变化，跳过提交"
else
  git add public
  git commit -m "chore: 同步项目构建产物 (${synced[*]}) $(date +%Y-%m-%d %H:%M)

Co-Authored-By: Claude Code <noreply@anthropic.com>"
fi

echo ""
echo "✅ 同步完成（${synced[*]}）：已本地提交，preview :4321 可预览，等确认后再 push。"
