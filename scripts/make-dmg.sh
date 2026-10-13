#!/usr/bin/env bash
#
# PrismVault — macOS dmg 打包（CI 友好 / 带兜底）
#
# 为什么需要这个脚本：
#   Tauri 的 dmg 打包内部内嵌了 create-dmg 1.2.1，它靠 AppleScript 遥控 Finder
#   给图标排版。在 CI（无 GUI 会话 / 无自动化授权）里这步会报
#   "Finder got an error: AppleEvent timed out. (-1712)"；
#   另外 hdiutil detach 阶段偶发被 DiskArbitration 卡住
#   （"timeout for DiskArbitration expired" / "drive not detached"）。
#   两种情况都会让整条 `tauri build --bundles dmg` 失败，而且 tauri-cli 只回一句
#   被吞掉详情的 "failed to run bundle_dmg.sh"，排查成本很高。
#
# 策略（层层兜底，保证有包可发）：
#   1) tauri 原生打包（保留 tauri.macos.conf.json 里的 DMG 窗口/图标位置），
#      失败则清掉残留挂载点与半成品 rw 镜像后重试一次；
#   2) 仍失败 → 用 hdiutil 直接把已经打好的 .app 封成 dmg。
#      不依赖 AppleScript、不依赖 create-dmg，必定能出包（代价是图标用 Finder 默认排布）。
#
# 用法：
#   bash scripts/make-dmg.sh <rust-target-triple> [out_dir]
#
# 示例：
#   bash scripts/make-dmg.sh aarch64-apple-darwin out      # CI：产物同时拷到 out/
#   bash scripts/make-dmg.sh x86_64-apple-darwin           # 只留在 bundle 目录
#   bash scripts/make-dmg.sh "$(rustc -vV | awk '/^host:/{print $2}')"
#
set -uo pipefail

TARGET="${1:-}"
OUT_DIR="${2:-}"

if [[ -z "$TARGET" ]]; then
  echo "用法: bash scripts/make-dmg.sh <rust-target-triple> [out_dir]" >&2
  echo "  例: bash scripts/make-dmg.sh aarch64-apple-darwin out" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APP_NAME="PrismVault"
BUNDLE_DIR="src-tauri/target/$TARGET/release/bundle"
DMG_DIR="$BUNDLE_DIR/dmg"
APP_DIR="$BUNDLE_DIR/macos"
APP_BUNDLE="$APP_DIR/$APP_NAME.app"

case "$TARGET" in
  aarch64-apple-darwin) ARCH="aarch64" ;;
  x86_64-apple-darwin)  ARCH="x86_64"  ;;
  *)                    ARCH="${TARGET%%-*}" ;;
esac

VERSION="$(node -p "require('./src-tauri/tauri.conf.json').version" 2>/dev/null || echo "0.0.0")"
DMG_NAME="${APP_NAME}_${VERSION}_${ARCH}.dmg"
FINAL_DMG="$DMG_DIR/$DMG_NAME"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✗ dmg 只能在 macOS 上构建，当前系统：$(uname -s)" >&2
  exit 1
fi

echo "==> PrismVault dmg 打包"
echo "    目标: $TARGET    版本: $VERSION    架构: $ARCH"
echo "    产物: $FINAL_DMG"

if command -v pnpm >/dev/null 2>&1; then PM="pnpm"; else PM="npx"; fi

# ── 清场：上一次失败的挂载点 / 半成品读写镜像会让下一次尝试同样失败 ──
cleanup_leftovers() {
  local v
  shopt -s nullglob
  for v in /Volumes/"$APP_NAME"* /Volumes/dmg.*; do
    if [[ -d "$v" ]]; then
      echo "    · 卸载残留挂载点 $v"
      hdiutil detach "$v" -force >/dev/null 2>&1 || true
    fi
  done
  shopt -u nullglob
  rm -f "$APP_DIR"/rw.*.dmg "$DMG_DIR"/rw.*.dmg 2>/dev/null || true
}

# ── 方案 1：tauri 原生打包 ───────────────────────────────────
try_tauri_dmg() {
  local n="$1" log="/tmp/prismvault-dmg-attempt-$n.log"
  echo "==> 第 $n 次尝试：tauri 原生打包（含 AppleScript 排版）…"
  # --verbose 会把内嵌 bundle_dmg.sh 的输出透出来，失败时才查得到真正原因
  set -o pipefail
  "$PM" tauri build --target "$TARGET" --bundles dmg --verbose 2>&1 | tee "$log"
  local rc=${PIPESTATUS[0]}
  if [[ $rc -ne 0 ]]; then
    echo "    ! 第 $n 次打包失败（退出码 $rc），关键行："
    grep -nE "AppleEvent|timed out|hdiutil|Resource busy|not detached|Failed running AppleScript|diskimages|No such file" "$log" 2>/dev/null | tail -n 20 || true
  fi
  return $rc
}

NATIVE_OK=0
for n in 1 2; do
  cleanup_leftovers
  if try_tauri_dmg "$n"; then NATIVE_OK=1; break; fi
  echo "    · 清场后准备重试 …"
  sleep 5
done

# ── 方案 2：hdiutil 兜底（不依赖 AppleScript） ────────────────
fallback_hdiutil() {
  if [[ ! -d "$APP_BUNDLE" ]]; then
    echo "✗ 兜底失败：找不到已构建的 .app（$APP_BUNDLE）" >&2
    echo "  说明应用本体就没构建出来，请往上看 cargo 的报错。" >&2
    return 1
  fi
  local stage rc
  stage="$(mktemp -d)"
  echo "==> 兜底方案：hdiutil 直接封装 $APP_NAME.app"
  # -R 保留符号链接与权限；.app 内部有 symlink，必须原样带过去
  cp -R "$APP_BUNDLE" "$stage/" || { rm -rf "$stage"; return 1; }
  ln -s /Applications "$stage/Applications"

  mkdir -p "$DMG_DIR"
  rm -f "$FINAL_DMG"
  hdiutil create \
    -volname "$APP_NAME" \
    -srcfolder "$stage" \
    -ov -format UDZO \
    "$FINAL_DMG"
  rc=$?
  rm -rf "$stage"
  return $rc
}

if [[ $NATIVE_OK -eq 1 && -f "$FINAL_DMG" ]]; then
  echo "==> tauri 原生打包成功"
else
  [[ $NATIVE_OK -eq 1 ]] && echo "    · tauri 报成功但没找到 dmg，转兜底"
  fallback_hdiutil || { echo "✗ 两种方案都没能产出 dmg" >&2; exit 1; }
fi

# ── 校验 ─────────────────────────────────────────────────────
if [[ ! -f "$FINAL_DMG" ]]; then
  echo "✗ 未产出 dmg：$FINAL_DMG" >&2
  exit 1
fi

SIZE="$(wc -c < "$FINAL_DMG" | tr -d ' ')"
if [[ "$SIZE" -lt 500000 ]]; then
  echo "✗ dmg 体积异常（$SIZE 字节），大概率是打包中途失败留下的残片" >&2
  exit 1
fi

# UDZO/UDIF 镜像最后 512 字节是 koly 尾部块
if [[ "$(tail -c 512 "$FINAL_DMG" | head -c 4)" == "koly" ]]; then
  echo "==> koly 尾部块校验通过"
else
  echo "✗ dmg 缺少 koly 尾部块，镜像可能不完整" >&2
  exit 1
fi

echo "==> 产物：$FINAL_DMG  ($(echo "$SIZE" | awk '{printf "%.2f MB", $1/1048576}'))"

# ── 拷到指定输出目录（CI 用） ────────────────────────────────
if [[ -n "$OUT_DIR" ]]; then
  mkdir -p "$OUT_DIR"
  cp -f "$FINAL_DMG" "$OUT_DIR/"
  echo "==> 已拷贝到 $OUT_DIR/ ："
  ls -lh "$OUT_DIR/"
fi

exit 0
