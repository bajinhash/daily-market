#!/bin/bash
# publish.sh — 一键发布今日行情到 daily-market 仓库
#
# 用法：
#   ./publish.sh              # 自动找最新日期的 JSON，复制 + 提交 + push
#   ./publish.sh 2026-05-13   # 指定日期
#
# 配置：源仓路径通过环境变量 MARKET_FETCH_SRC 指定。
#   方式 A：export MARKET_FETCH_SRC=/path/to/source
#   方式 B：在仓库根目录创建 .env 写一行：MARKET_FETCH_SRC=/path/to/source
#   .env 已加入 .gitignore，不会被提交。

set -euo pipefail

DST_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$DST_DIR/data"

# 加载 .env（如果存在）
if [ -f "$DST_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$DST_DIR/.env"; set +a
fi

if [ -z "${MARKET_FETCH_SRC:-}" ]; then
  echo "❌ 未配置数据源路径"
  echo "   请设置环境变量 MARKET_FETCH_SRC 或在仓库根目录创建 .env 文件"
  echo "   示例 .env 内容：MARKET_FETCH_SRC=/path/to/your/fetch/script/dir"
  exit 1
fi

SRC_DIR="$MARKET_FETCH_SRC"

if [ ! -d "$SRC_DIR" ]; then
  echo "❌ 源目录不存在：$SRC_DIR"
  exit 1
fi

# 1. 决定要复制的日期
if [ $# -ge 1 ]; then
  DATE="$1"
else
  # 取源目录中最新的主 JSON
  LATEST=$(ls -1 "$SRC_DIR"/*.json 2>/dev/null | grep -v onchain | tail -1 || true)
  if [ -z "$LATEST" ]; then
    echo "❌ 源目录无 JSON 文件，先跑数据采集脚本"
    exit 1
  fi
  DATE=$(basename "$LATEST" | cut -d'-' -f1-3)
fi

echo "📦 发布日期：$DATE"

# 2. 复制 JSON
COPIED=0
for slot in 早盘 午盘 晚盘 凌晨; do
  for suffix in "" "-onchain"; do
    SRC_FILE="$SRC_DIR/${DATE}-${slot}${suffix}.json"
    if [ -f "$SRC_FILE" ]; then
      cp "$SRC_FILE" "$DATA_DIR/"
      echo "  ✓ ${DATE}-${slot}${suffix}.json"
      COPIED=$((COPIED + 1))
    fi
  done
done

if [ $COPIED -eq 0 ]; then
  echo "❌ 该日期无 JSON 文件可发布"
  exit 1
fi

# 3. 更新 manifest
echo ""
echo "🔄 更新 manifest..."
cd "$DST_DIR"
python3 update_manifest.py

# 4. git add + commit + push
echo ""
echo "📤 提交到 Git..."
cd "$DST_DIR"
git add data/
if git diff --cached --quiet; then
  echo "  ⚠ 无变更，跳过提交"
  exit 0
fi
git commit -m "data: $DATE"
git push 2>&1 || {
  echo "  ⚠ push 失败（可能远端未配置或无网络）"
  exit 0
}

echo ""
echo "✅ 发布成功"
