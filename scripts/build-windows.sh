#!/usr/bin/env bash
#
# PrismVault — Windows 构建脚本（GNU 工具链）
# 自动把便携版 MinGW-w64 加入 PATH（windres / gcc / ld 等资源编译器），
# 然后执行 tauri 打包，产出 exe + msi。
#
# 用法：bash scripts/build-windows.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 便携版 MinGW-w64 的位置（提供 windres，tauri-winres 打包图标/版本资源时必需）
MINGW_BIN="${MINGW_BIN:-$HOME/mingw64/mingw64/bin}"
if [[ -d "$MINGW_BIN" ]]; then
  export PATH="$MINGW_BIN:$PATH"
  echo "==> 已加入 MinGW 到 PATH: $MINGW_BIN"
else
  echo "⚠ 未找到 MinGW 目录（$MINGW_BIN）。若构建时报 windres 缺失，"
  echo "  请设置 MINGW_BIN 指向含 windres.exe 的目录。"
fi

if ! command -v windres >/dev/null 2>&1; then
  echo "✗ 仍然找不到 windres，构建会失败。请检查 MinGW 安装。" >&2
  exit 1
fi
echo "    windres: $(command -v windres)"

echo "==> 开始 Windows 构建 …"
npm run build:tauri

echo ""
echo "✅ 构建完成。产物："
ls -lh src-tauri/target/release/bundle/nsis/*.exe 2>/dev/null | awk '{print "   📦 " $NF "  (" $5 ")"}'
ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null | awk '{print "   📦 " $NF "  (" $5 ")"}'
