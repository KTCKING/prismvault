# PrismVault

> 高性能桌面图片管理软件。
> 基于 Tauri + Rust + SolidJS 构建。

## 功能特性

- ⚡ **极速浏览** — 10 万张图片，虚拟滚动即时浏览
- 🔒 **开放格式** — 标准 SQLite 数据库，永不锁定
- 🌐 **NAS 就绪** — 一流的 SMB/NFS 支持，离线自动降级
- 🏷️ **高级标签** — 层级标签、智能文件夹、评分
- 🔍 **全文搜索** — FTS5 + Tantivy 即时检索
- 🖼️ **WebP 缩略图** — 内容哈希去重，节省 50%+ 缓存空间
- 🔄 **实时同步** — 原生文件监听 + 网络驱动器轮询
- 👥 **团队就绪** — 多用户 NAS，个人元数据

## 架构

```
prismvault/
├── src/                    # SolidJS 前端
│   ├── components/         # UI 组件
│   │   ├── ThumbnailGrid   # 虚拟滚动网格
│   │   ├── ThumbnailCard   # 单个缩略图
│   │   ├── Sidebar         # 标签、筛选、图库
│   │   ├── InfoPanel       # 文件元数据面板
│   │   ├── SearchBar       # 快速搜索
│   │   ├── StatusBar       # 底部状态栏
│   │   └── WelcomeScreen   # 首次运行欢迎页
│   ├── stores/             # 响应式状态
│   │   ├── library.ts      # 图库管理
│   │   ├── files.ts        # 文件列表与选择
│   │   ├── tags.ts         # 标签 CRUD
│   │   └── ui.ts           # UI 状态
│   └── lib/
│       └── tauri-api.ts    # Tauri invoke + mock 层
│
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── engine/         # 核心引擎
│   │   │   ├── db.rs       # SQLite + FTS5
│   │   │   ├── indexer.rs  # 文件扫描器
│   │   │   ├── thumbnail.rs # WebP 生成
│   │   │   ├── watcher.rs  # 文件系统监听
│   │   │   ├── search.rs   # 全文搜索
│   │   │   └── dedup.rs    # 重复检测
│   │   ├── commands/       # Tauri IPC 命令
│   │   │   ├── library.rs  # 图库管理 API
│   │   │   ├── files.rs    # 文件操作 API
│   │   │   ├── tags.rs     # 标签操作 API
│   │   │   └── search.rs   # 搜索 API
│   │   └── utils/
│   │       ├── hash.rs     # BLAKE3 + 感知哈希
│   │       └── path.rs     # 路径工具
│   └── Cargo.toml
│
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

# 独立运行前端（mock 模式，无需 Tauri）
pnpm dev

# 使用 Tauri 运行（需要 Rust）
pnpm tauri dev

# 构建生产版本
pnpm tauri build
```

### 仅前端开发

前端可独立运行，使用 mock 数据 — 无需 Rust 工具链：

```bash
pnpm install
pnpm dev
# 打开 http://localhost:1420
```

## 各平台打包

> ⚠️ **重要**：`.dmg` 只能在 **macOS** 上构建，`.exe` / `.msi` 只能在 **Windows** 上构建。
> Tauri 不支持跨平台交叉编译桌面安装包 —— 每个平台的安装包必须在其对应系统上生成。

### Windows（exe + msi）

```bash
npm run build:tauri
# 产物：src-tauri/target/release/bundle/nsis/*.exe
#       src-tauri/target/release/bundle/msi/*.msi
```

### macOS（.app + .dmg）

在 Mac 上执行**一键脚本**（自动检查环境、装依赖、构建 dmg）：

```bash
bash scripts/build-macos.sh
# 产物：src-tauri/target/release/bundle/dmg/PrismVault_<version>_<arch>.dmg
#       src-tauri/target/release/bundle/macos/PrismVault.app
```

也可以手动执行：

```bash
npm install
npm run build:dmg          # = tauri build --bundles dmg
```

**首次打开未签名的 dmg** 会被 macOS Gatekeeper 拦截，任选其一解决：

1. 「系统设置 → 隐私与安全性」→ 找到被拦截提示 → 点「仍要打开」；
2. 命令行去除隔离标记：`xattr -dr com.apple.quarantine /Applications/PrismVault.app`

> 正式对外分发建议做 **代码签名 + 公证（notarization）**，需要 Apple 开发者账号，
> 在 `src-tauri/tauri.macos.conf.json` 中配置 `bundle.macOS.signingIdentity` 等参数。

### 把源码同步到 Mac

若在 Windows 上开发、需要到 Mac 上打 dmg，可先用脚本导出干净的源码包：

```bash
bash scripts/package-source.sh
# 生成 ../dist-src/PrismVault-src-<version>-<date>.zip
```

把 zip 拷到 Mac，解压后运行 `bash scripts/build-macos.sh` 即可。

### 平台专属配置

工程使用 Tauri 的平台配置合并机制，公共配置在 `tauri.conf.json`，平台差异拆到：

| 文件 | 作用 |
|------|------|
| `src-tauri/tauri.windows.conf.json` | Windows：`WebView2Loader.dll` 资源、NSIS 语言 |
| `src-tauri/tauri.macos.conf.json` | macOS：打包 `app`+`dmg`、DMG 窗口布局、最低系统版本 |

## 性能目标

| 场景 | 目标 |
|----------|--------|
| 冷启动（1 万文件） | < 1.5s |
| 冷启动（10 万文件） | < 3s |
| 内存（空闲） | < 200MB |
| 内存（浏览 10 万张） | < 400MB |
| 滚动帧率 | 60fps |
| 安装包体积 | < 15MB |

## 许可证

MIT
