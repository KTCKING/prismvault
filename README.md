# PrismVault

> 高性能桌面图片管理软件 —— 基于 **Tauri 2 + Rust + SolidJS** 构建。

[![Build macOS DMG](https://github.com/KTCKING/prismvault/actions/workflows/build-dmg.yml/badge.svg)](https://github.com/KTCKING/prismvault/actions/workflows/build-dmg.yml)
[![Latest Release](https://img.shields.io/github/v/release/KTCKING/prismvault?color=blue)](https://github.com/KTCKING/prismvault/releases/latest)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#许可证)

---

## 下载安装

前往 [**Releases**](https://github.com/KTCKING/prismvault/releases/latest) 下载对应平台的安装包：

| 平台 | 文件 | 适用机型 |
|------|------|----------|
| macOS（Apple Silicon） | `PrismVault_<版本>_aarch64.dmg` | M1 / M2 / M3 / M4 |
| macOS（Intel） | `PrismVault_<版本>_x64.dmg` | Intel 芯片 |
| Windows | `PrismVault_<版本>_x64-setup.exe` | 推荐，NSIS 安装程序 |
| Windows | `PrismVault_<版本>_x64_en-US.msi` | MSI 安装包 |

**macOS 首次打开提示「无法验证开发者」？** 安装包未经 Apple 公证，属正常现象。任选其一解决：

1. 右键点击 App → **打开** → 在弹窗中再次点「打开」；
2. 「系统设置 → 隐私与安全性」→ 找到拦截提示 → 点「仍要打开」；
3. 命令行去除隔离标记：

   ```bash
   xattr -dr com.apple.quarantine /Applications/PrismVault.app
   ```

**Windows 出现 SmartScreen 警告？** 点「更多信息」→「仍要运行」。

## 功能特性

- ⚡ **极速浏览** —— 10 万张图片，虚拟滚动即时浏览
- 🚀 **后台缩略图预生成** —— 导入 / 打开图库后自动排队补齐缩略图（多线程并行），滚动时不再现解原图，大图库也不卡
- 🔒 **开放格式** —— 标准 SQLite 数据库，永不锁定
- 🌐 **NAS 就绪** —— 一流的 SMB/NFS 支持，离线自动降级
- 🏷️ **高级标签** —— 层级标签、智能文件夹、评分
- 🔍 **全文搜索** —— FTS5 + Tantivy 即时检索
- 🖼️ **JPEG 缩略图** —— 内容/路径哈希去重，优先直接抽取 EXIF 内嵌缩略图
- 🔄 **实时同步** —— 原生文件监听 + 网络驱动器轮询
- 🗂️ **四维时间** —— 每张图片记录**创建 / 修改 / 导入 / 更新**四种时间
- 📋 **Pixcall 风格信息栏** —— 右侧「文件信息 / 基本信息」可折叠分区，属性行左标签右值；面板悬浮于网格之上不挤压列数，可一键显示 / 隐藏，未选中文件时显示当前图库文件总数
- 🗑️ **安全回收** —— 删除进回收站，支持还原与一键清空
- 👥 **团队就绪** —— 多用户 NAS，个人元数据

## 技术栈

| 层 | 技术 |
|----|------|
| 桌面框架 | Tauri 2 |
| 后端 | Rust —— `rusqlite`（SQLite + FTS5）、`image`、`blake3`、`notify`、`rayon` |
| 前端 | SolidJS + TypeScript + Tailwind CSS |
| 构建 | Vite 6 · pnpm 10 |

## 架构

```
prismvault/
├── src/                      # SolidJS 前端
│   ├── components/           # UI 组件
│   │   ├── ThumbnailGrid     # 虚拟滚动网格（指针事件拖拽）
│   │   ├── ThumbnailCard     # 单个缩略图
│   │   ├── Sidebar           # 图库 / 标签 / 垃圾篓
│   │   ├── InfoPanel         # 文件信息栏（Pixcall 风格可折叠分区 + 四种时间）
│   │   ├── SearchBar         # 快速搜索
│   │   ├── StatusBar         # 底部状态栏
│   │   ├── ContextMenu       # 全局右键菜单
│   │   ├── Dialog            # 自绘确认弹窗
│   │   ├── Toast             # 轻提示
│   │   ├── ImageViewer       # 图片查看器
│   │   ├── IndexingDialog    # 索引进度
│   │   ├── SettingsModal     # 设置
│   │   └── WelcomeScreen     # 首次运行欢迎页
│   ├── stores/               # 响应式状态
│   │   ├── library.ts        # 图库管理
│   │   ├── files.ts          # 文件列表与选择
│   │   ├── tags.ts           # 标签 CRUD
│   │   ├── ui.ts             # UI 状态（菜单 / Toast）
│   │   ├── theme.ts          # 主题
│   │   └── viewer.ts         # 查看器状态
│   ├── lib/
│   │   └── tauri-api.ts      # Tauri invoke + mock 层
│   └── styles/globals.css
│
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── engine/           # 核心引擎
│   │   │   ├── db.rs         # SQLite + FTS5（含文件时间戳字段）
│   │   │   ├── indexer.rs    # 文件扫描器
│   │   │   ├── import.rs     # 导入流水线
│   │   │   ├── thumbnail.rs  # 缩略图生成（EXIF 内嵌优先，1MB 头部读取）
│   │   │   ├── thumbs.rs     # 后台缩略图队列（rayon 并行 + 事件推送）
│   │   │   ├── watcher.rs    # 文件系统监听
│   │   │   ├── search.rs     # 全文搜索
│   │   │   └── dedup.rs      # 重复检测
│   │   ├── commands/         # Tauri IPC 命令
│   │   │   ├── library.rs    # 图库管理 API
│   │   │   ├── files.rs      # 文件操作 API
│   │   │   ├── import.rs     # 导入 API
│   │   │   ├── tags.rs       # 标签操作 API
│   │   │   └── search.rs     # 搜索 API
│   │   ├── utils/
│   │   │   ├── hash.rs       # BLAKE3 + 感知哈希
│   │   │   └── path.rs       # 路径工具
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── tauri.conf.json               # 公共配置
│   ├── tauri.windows.conf.json       # Windows 差异
│   ├── tauri.macos.conf.json         # macOS 差异
│   └── Cargo.toml
│
├── scripts/                  # 构建脚本
│   ├── build-windows.sh      # Windows：exe + msi
│   ├── build-macos.sh        # macOS：app + dmg
│   ├── sync-build.sh         # 同步源码到英文路径构建目录
│   ├── package-source.sh     # 导出干净源码包
│   └── open-bundle.cjs       # 构建后打开产物目录
│
├── .github/workflows/build-dmg.yml   # CI：自动构建 macOS dmg
├── patches/indexmap-1.9.3/           # Windows GNU 工具链补丁
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── index.html
```

## 快速开始

### 环境要求

- **Windows**：[Rust](https://rustup.rs)、[Node.js 18+](https://nodejs.org)、[pnpm](https://pnpm.io)
- **macOS**：[Rust](https://rustup.rs)、[Node.js 18+](https://nodejs.org) + Xcode 命令行工具（`xcode-select --install`）
- **Linux**：`libwebkit2gtk-4.1-dev`、`libvips-dev`

### 开发

```bash
# 安装依赖
pnpm install

# 独立运行前端（mock 模式，无需 Tauri / Rust）
pnpm dev

# 使用 Tauri 运行（需要 Rust 工具链）
pnpm tauri dev

# 构建生产版本（当前平台）
pnpm tauri build
```

### 仅前端开发

前端可独立运行并使用 mock 数据，无需 Rust 工具链：

```bash
pnpm install
pnpm dev
# 打开 http://localhost:1420
```

## 打包

> ⚠️ **重要**：`.dmg` 只能在 **macOS** 上构建，`.exe` / `.msi` 只能在 **Windows** 上构建。
> Tauri 不支持跨平台交叉编译桌面安装包 —— 每个平台的安装包必须在其对应系统上生成。

### Windows（exe + msi）

```bash
bash scripts/build-windows.sh      # 自动把便携版 MinGW 加入 PATH
# 或
pnpm tauri build
# 产物：src-tauri/target/release/bundle/nsis/*.exe
#       src-tauri/target/release/bundle/msi/*.msi
```

> 在中文路径下工作时，建议先用 `bash scripts/sync-build.sh` 把源码同步到英文路径目录再构建（GNU 链接器对非 ASCII 路径不友好）。

### macOS（本地，app + dmg）

在 Mac 上执行一键脚本（自动检查环境、装依赖、构建 dmg）：

```bash
bash scripts/build-macos.sh
# 产物：src-tauri/target/release/bundle/dmg/PrismVault_<version>_<arch>.dmg
#       src-tauri/target/release/bundle/macos/PrismVault.app
```

也可以手动执行：

```bash
pnpm install
pnpm build:dmg          # = tauri build --bundles dmg
```

> 正式对外分发建议做 **代码签名 + 公证（notarization）**，需要 Apple 开发者账号，
> 在 `src-tauri/tauri.macos.conf.json` 中配置 `bundle.macOS.signingIdentity` 等参数。

### macOS dmg（GitHub Actions 自动构建，推荐）

仓库内置工作流 [`.github/workflows/build-dmg.yml`](.github/workflows/build-dmg.yml)，
在 GitHub 的 macOS 机器上同时构建 **Apple Silicon** 与 **Intel** 两种架构的 dmg：

| 触发方式 | 结果 |
|----------|------|
| 推送 `v*` tag（如 `git tag v0.2.0 && git push origin v0.2.0`） | 构建完成后**自动创建 Release** 并附上两个 dmg |
| Actions 页面点 **Run workflow** | 构建 dmg 并作为 **Artifact**（保留 90 天） |

- Apple Silicon 跑在 `macos-14`（aarch64），Intel 跑在 `macos-15-intel`（x86_64）。
- 推送普通提交到 `main` **不会**触发构建，避免消耗 macOS 构建配额。

### 平台专属配置

工程使用 Tauri 的平台配置合并机制，公共配置在 `tauri.conf.json`，平台差异拆到：

| 文件 | 作用 |
|------|------|
| `src-tauri/tauri.windows.conf.json` | Windows：`WebView2Loader.dll` 资源、NSIS 语言 |
| `src-tauri/tauri.macos.conf.json` | macOS：打包 `app`+`dmg`、DMG 窗口布局、最低系统版本 |

> 注意：平台配置合并时**数组是整体替换**（而非追加），需重复声明要保留的项。

### 把源码同步到 Mac

若在 Windows 上开发、需要到 Mac 上打 dmg，可先用脚本导出干净的源码包：

```bash
bash scripts/package-source.sh
# 生成 ../dist-src/PrismVault-src-<version>-<date>.tar.gz
```

把压缩包拷到 Mac，解压后运行 `bash scripts/build-macos.sh` 即可。

## 性能设计：为什么大图库滚动不再卡

导入 2400 张照片时卡顿的根因有两个，都在缩略图这条链路上：

1. **前端回退原图**：卡片在缩略图就绪前会直接加载原片。一张 4000×3000 的
   JPEG 解码后约 50MB 内存，整屏几十张一起解就是几百 MB 加肉眼可见的掉帧。
   现在缩略图未就绪时只显示骨架屏 —— **绝不用原图顶替**，只有后端明确回报
   「这张生成不出缩略图」时才回退原图。
2. **后端同步解码 + 全程持锁**：`get_thumbnail_path` 以前会现场整解码原图，
   而且整个过程握着引擎互斥锁，所有其他请求都得排队。2400 张图滚动过去，
   等于把整个应用的 IPC 串行化在一次次全图解码后面。

现在的缩略图流水线：

| 阶段 | 行为 |
|------|------|
| IPC 查询 | 只做「缩略图文件在不在」的判断；已出结果的直接内存命中返回，**零解码、零持锁** |
| 未命中 | 任务入队，立刻返回 `pending`；卡片保持骨架屏 |
| 后台任务 | 独立线程 + `rayon` 并行批次解码，不持有任何锁；每批结果通过 `thumb-ready` 事件推给前端 |
| 触发时机 | 导入完成、打开库、恢复库、索引结束都会自动排队补齐 |
| 生成策略 | JPEG 优先直接抽取 EXIF 内嵌缩略图（只读文件头 1MB），失败才整解码 |
| 兜底 | 队列跑空后前端会把仍未拿到结果、又不在 `pending` 的图片重新问一遍，避免漏事件导致的空白卡片 |

## 性能目标

| 场景 | 目标 |
|------|------|
| 冷启动（1 万文件） | < 1.5s |
| 冷启动（10 万文件） | < 3s |
| 内存（空闲） | < 200MB |
| 内存（浏览 10 万张） | < 400MB |
| 滚动帧率 | 60fps |
| 安装包体积 | < 15MB |

## 许可证

MIT
