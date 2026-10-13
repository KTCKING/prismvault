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
- 🖼️ **两级缩略图** —— 网格 448px + 预览栏 1600px（按需生成）；内容/路径哈希去重，优先直接抽取 EXIF 内嵌缩略图。4K 图库实测全库缩略图仅约 45 MB（原图 10.5 GB）
- 🔄 **实时同步** —— 原生文件监听 + 网络驱动器轮询
- 🗂️ **四维时间** —— 每张图片记录**创建 / 修改 / 导入 / 更新**四种时间
- 🙈 **不污染你的文件夹** —— 图库元数据只写在库内 `.prism/`，并在 Windows 上显式标记为**隐藏 + 不参与索引**（macOS / Linux 靠点前缀隐藏），原图目录保持干净
- 📋 **Pixcall 风格信息栏** —— 右侧「文件信息 / 基本信息」可折叠分区，属性行左标签右值；面板**占位**显示（开启后网格自动从 6 列收成 5 列，不遮挡图片），可一键显示 / 隐藏，未选中文件时显示当前图库文件总数
- 🛡️ **GPU 崩溃自愈** —— WebView2 的 GPU 进程若在本机起不来，首次崩溃后自动降级到软件渲染并持久化，之后启动不再白屏
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
│   │   ├── gpu.rs            # GPU 崩溃哨兵 + 软件渲染降级（窗口在此创建）
│   │   ├── lib.rs
│   │   └── main.rs
│   ├── tauri.conf.json               # 公共配置
│   ├── tauri.windows.conf.json       # Windows 差异
│   ├── tauri.macos.conf.json         # macOS 差异
│   └── Cargo.toml
│
├── scripts/                  # 构建脚本
│   ├── build-windows.sh      # Windows：exe + msi，并自动覆盖安装到本机
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

> `build-windows.sh` 在打包完成后会**自动覆盖安装到本机**（`NO_INSTALL=1` 可跳过）。
> 桌面 / 开始菜单快捷方式指向的是 NSIS 安装目录 `%LOCALAPPDATA%\PrismVault\prismvault.exe`，
> 而不是 `target/release` 下的构建产物 —— 所以**只构建、不安装**的话，点图标启动的
> 会是上一次安装进去的旧版本，看起来就像改动没生效。

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
>
> 主窗口**不在** `tauri.conf.json` 里声明（`"windows": []`），而是在
> `main.rs` 的 `setup()` 中用 `WebviewWindowBuilder` 创建 —— 因为 WebView2 的
> 启动参数只能在创建时传入，而是否禁用 GPU 取决于上一次运行是否崩溃。

### 把源码同步到 Mac

若在 Windows 上开发、需要到 Mac 上打 dmg，可先用脚本导出干净的源码包：

```bash
bash scripts/package-source.sh
# 生成 ../dist-src/PrismVault-src-<version>-<date>.tar.gz
```

把压缩包拷到 Mac，解压后运行 `bash scripts/build-macos.sh` 即可。

## 故障排查

### 打开后白屏，并弹出「msedgewebview2 已停止工作 / Error launching CrashSender.exe」

WebView2 的 **GPU 子进程起不来**时，Chromium 会执行
`LOG_FATAL: GPU process isn't usable. Goodbye.` 直接中止浏览器进程 → 宿主窗口只剩白屏。
常见诱因：安全软件拦截 GPU 子进程、显卡驱动异常、WebView2 运行时状态损坏。

PrismVault 已内置自愈：**崩溃一次后自动改用软件渲染并持久化**，之后启动直接正常。
状态记录在：

| 平台 | 路径 |
|------|------|
| Windows | `%APPDATA%\PrismVault\gpu-state.json` |
| macOS | `~/Library/Application Support/PrismVault/gpu-state.json` |

环境变量可用于人工干预：

```bash
# 重新尝试硬件渲染（并重置状态）
PRISMVAULT_FORCE_GPU=1 prismvault.exe
# 强制软件渲染
PRISMVAULT_FORCE_SOFTWARE_RENDER=1 prismvault.exe
```

根治办法是把系统 WebView2 运行时修好（Windows「应用和功能」里找到
**Microsoft Edge WebView2 Runtime** → 修改 → 修复），修好后再用
`PRISMVAULT_FORCE_GPU=1` 启动一次即可恢复硬件加速。

### macOS 提示「已损坏，无法打开」

Gatekeeper 隔离属性所致：

```bash
xattr -dr com.apple.quarantine /Applications/PrismVault.app
```

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
| 队列自愈 | 任务表按 key 记录任务本体，队列空但仍有未完成任务时会重新排队，避免线程异常退出后卡片永久骨架屏 |
| 前端渲染 | 缩略图地址按 **每张图一个独立信号** 存放 —— 一张就绪只刷新那一张卡片（列表视图上百行时差别极大） |
| 兜底 1 | 队列跑空后前端把仍未拿到结果的图片重新问一遍，补上「事件订阅晚于请求」的竞态 |
| 兜底 2 | `<img>` 加载失败（asset 协议不可用的环境）→ 记日志 + 改走 `read_thumb_data_url` 的 base64 data URL，保证出图 |

### 尺寸与体积（2026-10-13 调优）

| 参数 | 值 | 说明 |
|------|-----|------|
| 网格缩略图 | **448 px** 长边 | 前端滑块范围只有 120–400px，512 属于过量供给 |
| 预览图 | **1600 px** 长边 | 右侧信息栏专用，**按需生成**，不做整库预热 |
| JPEG 质量 | **70** | 与 75 在这个尺寸下肉眼无差，体积小约 12% |
| 重采样 | **CatmullRom** | 比双线性锐利，正好补偿分辨率下降 |
| 缓存版本哨兵 | `.prism/thumb-version` | 参数变更时自动清掉上一版缓存，避免磁盘留两套 |

实测 4K 图库（2396 张）：缩略图中位 **28 KB → 约 19 KB**，全库 **67.5 MB → 约 45 MB**
（原图合计 10.5 GB）。

> 预览图为什么按需生成：1600px 单张约 250 KB，2400 张全量预热就是 600 MB，
> 而绝大多数图不会被点开。首次点开某张图会触发一次后台生成（结果由
> `preview-ready` 事件推回），之后长期复用。

> 顺带修掉一处死代码：`preview_size` 字段以前定义了 `2048` 但从未被调用过，
> 右侧信息栏一直在直接解码原图（中位 2.6 MB / 约 200 ms / 展开瞬间 30 MB 内存）。

## 数据落在哪里（磁盘目录与隐藏属性）

PrismVault 只往三个地方写东西，**从不修改你的原图**：

| 位置 | 内容 | 可见性 |
|------|------|--------|
| `<图库目录>/.prism/` | `db.sqlite`（索引、标签、评分、备注）、`thumbnails/`、`thumb-version` | **Windows 上显式标记为隐藏**；macOS / Linux 靠点前缀隐藏 |
| `%APPDATA%\PrismVault\`<br>macOS：`~/Library/Application Support/PrismVault/` | `libraries.json`（图库清单）、`gpu-state.json`（崩溃哨兵）、`render-debug.log` | 系统约定的应用数据目录，默认不可见 |
| `%LOCALAPPDATA%\com.prismvault.app\EBWebView\`<br>macOS：`~/Library/WebKit/com.prismvault.app/` | WebView2 / WebKit 运行时缓存 | 同上，由运行时自行管理 |

### 为什么要给 `.prism` 打隐藏属性

Windows **不认识点前缀** —— 资源管理器会把 `.prism` 当成一个普通文件夹，直接摆在
你的照片堆里。同一个软件在 macOS 上「看不见」、在 Windows 上「看得见」，行为不一致；
更麻烦的是用户整理照片时很容易顺手把它删掉。

所以创建 / 打开图库时会显式调用 `SetFileAttributesW`，打上：

```
FILE_ATTRIBUTE_HIDDEN | FILE_ATTRIBUTE_NOT_CONTENT_INDEXED
```

实现在 `src-tauri/src/utils/winattr.rs`（直接声明 kernel32 导出函数，不引入任何新依赖）。

- **不参与索引** 的意义：库里躺着上万张缩略图和几个 SQLite 文件，它们既不该被
  Windows 搜索去扫，也不该混进「在这台电脑上搜索图片」的结果里。
- **幂等**：已经是期望状态就跳过写入，不会在同步盘上反复制造时间戳变动。
- **老图库自动补齐**：图库打开 / 恢复时都会走一遍，用户不需要手动作任何事。
- **失败不影响可用性**：属性只是观感与防误删，写入失败（只读介质、无权限）静默忽略。
- 网络库（SMB / NFS）的元数据本来就不放在库根下，而是放在应用数据目录（`AppData`
  自身即为隐藏），无需额外处理。
- 可用性不受影响：Tauri 的 asset 协议作用域只做**路径字符串**匹配，不读文件属性，
  所以隐藏之后缩略图照样正常加载。

> 删掉 `.prism` 等于删掉这个图库的**全部非破坏性编辑**（标签、评分、备注）和缩略图
> 缓存 —— 原图不受影响，但重新打开需要重建索引。隐藏它就是为了少一次误伤。

## 排查：图片显示不出来

图片看不见多半卡在 WebView2 内部（asset 协议、`<img>` 加载失败），JS 侧的错误
外部看不到。所以前端会把关键线索写进后端日志：

| 平台 | 日志文件 |
|------|----------|
| Windows | `%APPDATA%\PrismVault\render-debug.log` |
| macOS | `~/Library/Application Support/PrismVault/render-debug.log` |

日志里会包含：启动时的软件渲染开关、页面加载事件、前端 `ui_ready` 上报，
以及缩略图链路的 `[fe:thumb]`（前 25 个请求结果）、`[fe:img]` / `[fe:preview]`
（**所有**加载失败）。每次启动会清空重写。

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
