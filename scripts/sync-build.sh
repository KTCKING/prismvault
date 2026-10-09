#!/usr/bin/env bash
#
# 把工作区的源码同步到英文路径的构建目录（Windows 上构建用）。
# 中文路径下 Rust/GNU 链接器可能出错，因此构建统一在英文路径目录进行。
#
# 用法：
#   bash scripts/sync-build.sh            # 同步到 ../prismvault-build
#   bash scripts/sync-build.sh <目标目录>
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${1:-$HOME/prismvault-build}"

if [[ ! -d "$DEST" ]]; then
  echo "✗ 目标构建目录不存在: $DEST" >&2
  echo "  请先创建，或传入正确的目录路径。" >&2
  exit 1
fi

echo "==> 同步 $ROOT_DIR → $DEST"

mkdir -p "$DEST/src" "$DEST/src-tauri/src" "$DEST/scripts"

# 前端源码
cp -r "$ROOT_DIR/src/." "$DEST/src/"

# 后端源码
cp -r "$ROOT_DIR/src-tauri/src/." "$DEST/src-tauri/src/"

# 配置文件与图标
cp -f "$ROOT_DIR/src-tauri/tauri.conf.json" \
      "$ROOT_DIR/src-tauri/tauri.windows.conf.json" \
      "$ROOT_DIR/src-tauri/tauri.macos.conf.json" \
      "$ROOT_DIR/src-tauri/app-icon.svg" \
      "$ROOT_DIR/src-tauri/Cargo.toml" \
      "$DEST/src-tauri/" 2>/dev/null || true

rm -rf "$DEST/src-tauri/icons"
cp -r "$ROOT_DIR/src-tauri/icons" "$DEST/src-tauri/"

# 脚本、包配置、说明
cp -f "$ROOT_DIR/scripts/." "$DEST/scripts/" 2>/dev/null || true
cp -f "$ROOT_DIR/package.json" "$DEST/" 2>/dev/null || true

echo "✅ 同步完成"
