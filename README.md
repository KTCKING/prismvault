# PrismVault

> 高性能桌面图片管理软件 —— 基于 **Tauri 2 + Rust + SolidJS** 构建。

[![Build Installers](https://github.com/KTCKING/prismvault/actions/workflows/build-installers.yml/badge.svg)](https://github.com/KTCKING/prismvault/actions/workflows/build-installers.yml)
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
- 🧩 **浏览器扩展摘取** —— 网页上的图片 / 视频一键存进当前图库（面板多选、悬停速存、右键保存）；字节由浏览器带着你的登录态去取，防盗链、`blob:`、canvas 画出来的图都能存下来（见下节）
- 🎬 **视频入库** —— mp4 / webm / mov 等直接进库，卡片显示播放角标，双击在预览器里播放（WebView 解不了的容器会提示改用系统播放器）
- 📦 **导入 Eagle 素材包** —— `.eaglepack` 流式解压，按 Eagle 里的文件夹层级重组落盘，逐条目进度、可取消（见下节）
- 🔐 **删库三道闸** —— 「删除库及所有文件」不可逆也不进回收站，所以要求**逐字输入库名**、后端复核同一名字、路径闸再拦磁盘根目录 / 用户主目录 / 缺 `.prism` 的目录
- 👥 **团队就绪** —— 多用户 NAS，个人元数据

---

## 从网页摘取（浏览器扩展）

安装包内置一个 Chrome / Edge 扩展（源码在 `extension/`，编译期用 `include_str!` 嵌进二进制），
把网页上的图片和视频直接存进当前图库。思路和 Eagle / Pixcall 一致，但**字节交给浏览器去取**：

```
浏览器扩展（MV3）                        PrismVault（Rust）
┌────────────────────────┐             ┌──────────────────────────────┐
│ content.js             │             │ bridge.rs                    │
│  扫描 img / video /    │  1. POST    │  127.0.0.1:41596（只看本机）   │
│  srcset / 背景图 /     │  ─────────▶ │  POST /api/ingest?name&page   │
│  懒加载属性            │  文件字节   │   ↓                          │
│  采集面板（多选）       │             │  Origin 白名单 + 令牌校验      │
│  悬停速存按钮          │  2. 落盘    │   ↓                          │
├────────────────────────┤  ◀───────── │  文件名清洗 → 写进当前库       │
│ background.js          │   JSON      │  → insert_file               │
│  fetch(带站点 cookie)  │             │  → 排队生成缩略图             │
│  串行上传队列 + 徽标    │             │  → emit bridge-ingested      │
└────────────────────────┘             └──────────────────────────────┘
```

为什么不让应用自己去下载 URL？因为**只有浏览器知道那张图真正的字节**：带 cookie 的
防盗链、`blob:` 地址（canvas 画出来的图、流媒体）、要 Referer 的图床、登录后才可见的
原图 —— 应用直接发请求，拿回来的经常是 302 到一张占位图。

| 方式 | 操作 | 适合 |
| --- | --- | --- |
| 整页挑选 | 点扩展图标 →「打开采集面板」，或网页里按 `Alt` + `S` | 一页里挑几张 |
| 单张速存 | 鼠标悬停在图片上，点左上角浮出的方块 | 逛图站顺手存 |
| 右键菜单 | 图片 / 视频上右键 →「保存到 PrismVault」 | 最快的一步 |

**安装**：设置 → **浏览器扩展** →「导出扩展到文件夹…」→ 浏览器打开 `chrome://extensions`
（Edge 用 `edge://extensions`）→ 开启「开发者模式」→「加载已解压的扩展程序」→ 选导出的
`prismvault-extension` 文件夹 → 点扩展图标进设置，填面板里的**端口**和**访问令牌**。

装好之后，**已经打开的网页要刷新一次**才会出现悬停按钮和快捷键 —— 浏览器不会给已存在
的页面补注入脚本。

**安全上按「本机半个写入接口」来对待**：只监听 `127.0.0.1`；CORS 头只回给浏览器扩展，
普通网页硬发请求也读不到响应；访问令牌存在 `%APPDATA%\PrismVault\bridge.json`，网页脚本
拿不到，可随时重新生成；文件名逐字符清洗（`<>:"/\|?*`、保留名 `CON`/`LPT1`、结尾的点和
空格、超长截断），路径只允许落在当前图库之内；没有打开图库时直接拒收。

**会自动处理**：`srcset` 取最大一档 · 懒加载 `data-src` · CSS 背景图 · `<picture>` ·
指向图片文件的链接 · `blob:` · 需登录 / 防盗链 · 同名自动加 `(2)` · 网页来源写进备注。
默认按站点建子文件夹（`库根/example.com/图片.jpg`），可在扩展设置里改。单文件上限 512 MB。

---

## 导入 Eagle 素材包（`.eaglepack`）

设置 → 导入 →「选择 Eagle 素材包」，先看统计（布局、条目数、文件夹数、解压后大小），
确认后再选目标文件夹解压。解出来的目录直接作为新图库打开，**源包不动**。

Eagle 的素材包有两种布局（`pack.json` + `<ID>.info/`，或 `metadata.json` + `images/<ID>.info/`），
两种都认。`<ID>.info` 是 Eagle **单条素材的容器**，不是用户的文件夹 —— 所以导入时按
`folders` 关系把原图搬到 `库根/<父>/<子>/<文件名>.<ext>`，再把空壳目录删掉，
Eagle 的记账文件（`metadata.json` / `mtime.json` / `pack.json`）提到库根。
磁盘上不会留下一堆 `<ID>.info`。

- 同名文件自动加 `(2)`；文件夹名和文件名都按 Windows 规则清洗（`:` `*` `?` 建不出来）
- 搬失败的文件按原路径入库并计入「跳过」，绝不因为一次 `rename` 失败丢掉整条素材
- 逐条目进度，随时可取消；取消或失败会把半成品目录整个删掉，不留半截库

---

## 技术栈

> 完整的功能清单、模块地图、桥接协议和数据模型见 [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md)。

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
│   │   │   ├── path.rs       # 路径工具
│   │   │   ├── winattr.rs    # Windows 隐藏属性（.prism）
│   │   │   └── priority.rs   # 进程 / 解码线程降优先级（后台任务让路）
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
│   ├── make-dmg.sh           # macOS：dmg 打包（原生失败自动重试 + hdiutil 兜底）
│   ├── check-platform-api.sh # 预检「Windows 有、macOS 没有」的 Tauri API
│   ├── sync-build.sh         # 同步源码到英文路径构建目录
│   ├── package-source.sh     # 导出干净源码包
│   └── open-bundle.cjs       # 构建后打开产物目录
│
├── .github/workflows/build-installers.yml  # CI：macOS dmg + Windows exe/msi
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
npm install

# 独立运行前端（mock 模式，无需 Tauri / Rust）
npm run dev

# 使用 Tauri 运行（需要 Rust 工具链）
npm run tauri -- dev

# 构建生产版本（当前平台）
npm run build:tauri
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

> **平台门控 API 预检**：`build-windows.sh` 在构建前会跑
> [`scripts/check-platform-api.sh`](scripts/check-platform-api.sh)，扫描 Tauri 中
> 「Windows 有、macOS 没有」的 API 调用（目前是 `transparent`）。
> 原因：本地只编译 Windows，一旦用了这类方法，本地一切正常，**要等 CI 的
> dmg 任务编译失败才会发现**；而在 Windows 上又做不了 macOS 的交叉 `cargo check`
> （依赖链里的 `objc2-exception-helper` 需要 macOS 的 C 工具链）。
> 跳过预检：`SKIP_PLATFORM_CHECK=1`。
>
> 曾踩过的坑：`WebviewWindowBuilder::transparent` 的门控是
> `#[cfg(any(not(target_os = "macos"), feature = "macos-private-api"))]`
> —— Windows 上存在、macOS 上默认不存在，直接让两个 dmg 任务报 `E0599`。

### macOS（本地，app + dmg）

在 Mac 上执行一键脚本（自动检查环境、装依赖、构建 dmg）：

```bash
bash scripts/build-macos.sh
# 产物：src-tauri/target/<host-triple>/release/bundle/dmg/PrismVault_<version>_<arch>.dmg
#       src-tauri/target/<host-triple>/release/bundle/macos/PrismVault.app
```

也可以手动执行：

```bash
pnpm install
pnpm build:dmg          # = tauri build --bundles dmg
```

> **DMG 打包会失败？** Tauri 的 dmg 打包内嵌了 `create-dmg 1.2.1`。CI 环境下
> tauri-cli 会自动加 `--skip-jenkins` 跳过 AppleScript 排版，但 `hdiutil` 的
> attach/detach/convert 阶段仍会偶发卡死（`timeout for DiskArbitration expired`、
> 残留 `/Volumes` 挂载点），整条命令直接失败，而 tauri-cli 只会吐出一句被吞掉详情的
> `failed to run bundle_dmg.sh`。
> 用 [`scripts/make-dmg.sh`](scripts/make-dmg.sh) 代替，三步走：
> ① 先**单独**打 `.app` 并暂存（`--bundles dmg` 成功后会清理掉它，兜底就没得封装）；
> ② 试原生 dmg，失败清场（卸残留挂载点 + 删 `rw.*.dmg`）后重试一次；
> ③ 仍失败就用 `hdiutil` 从暂存 `.app` 直接封包 —— 不依赖 AppleScript，必定出包
> （代价是图标按 Finder 默认排布）。出口做体积下限 + `koly` 尾部块校验。
> `build-macos.sh` 已经默认走这条路径。
>
> ```bash
> bash scripts/make-dmg.sh "$(rustc -vV | awk '/^host:/{print $2}')"
> ```
>
> 注意产物名沿用 Tauri 的规则：x86_64 也是 **`_x64`**（不是 `_x86_64`）。

> 正式对外分发建议做 **代码签名 + 公证（notarization）**，需要 Apple 开发者账号，
> 在 `src-tauri/tauri.macos.conf.json` 中配置 `bundle.macOS.signingIdentity` 等参数。

### 全平台安装包（GitHub Actions 自动构建，推荐）

仓库内置工作流 [`.github/workflows/build-installers.yml`](.github/workflows/build-installers.yml)，
在 GitHub 的机器上一次性产出**两个平台的全部安装包**：

| 平台 | Runner | 产物 |
|------|--------|------|
| macOS Apple Silicon | `macos-14`（aarch64） | `PrismVault_<ver>_aarch64.dmg` |
| macOS Intel | `macos-15-intel`（x86_64） | `PrismVault_<ver>_x64.dmg` |
| Windows x64 | `windows-latest`（MSVC） | `PrismVault_<ver>_x64-setup.exe`（NSIS）、`PrismVault_<ver>_x64_en-US.msi` |

| 触发方式 | 结果 |
|----------|------|
| 推送 `v*` tag（如 `git tag v0.2.0 && git push origin v0.2.0`） | 构建完成后**自动创建 Release** 并挂上全部四个安装包 |
| Actions 页面点 **Run workflow** | 只产出 **Artifact**（保留 90 天）；填 `tag` 输入框可指定发布到某个已有 Release |
| 推送普通提交到 `main` | **不触发**，避免消耗 macOS 构建配额 |

- 为什么必须分三个 runner：**桌面安装包无法跨平台交叉编译** —— dmg 只能在 macOS 上打，
  exe/msi 只能在 Windows 上打，所以每个平台都得在自己的机器上构建。
- **dmg 任务用 `scripts/make-dmg.sh` 而不是裸的 `tauri build --bundles dmg`**：
  CI runner 上 `hdiutil` 的 attach/detach/convert 偶发卡死（AppleScript 那步
  已被 `--skip-jenkins` 跳过）。脚本会先单独打 `.app` 并暂存，再试原生 dmg
  （失败清场重试一次），最后用 `hdiutil` 兜底出包，避免一次偶发失败就整轮红掉。
- Windows 任务走 `windows-latest` 的默认 MSVC 工具链（本地开发用的是 GNU/MinGW，
  两者产出等价）；仓库里没有 `.cargo/config` 强制工具链，直接跟默认走即可。
- 上传到 Release 用 `gh release upload --clobber`，**同名文件会被覆盖** —— 也就是说
  对同一个 tag 重跑一次工作流，就能把该 Release 的全部安装包刷新到当前代码。

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
# 重新尝试硬件渲染（等价于在设置里选「硬件加速」，会把选择持久化）
PRISMVAULT_FORCE_GPU=1 prismvault.exe
# 强制软件渲染
PRISMVAULT_FORCE_SOFTWARE_RENDER=1 prismvault.exe
```

> **更推荐从界面里改**：设置 → 渲染 → 硬件加速 / 软件渲染。环境变量对双击快捷方式
> 启动的用户基本不可达，而界面里的选择是持久化的（重启后生效），详见
> [渲染方式（GPU）](#渲染方式gpu)。

根治办法是把系统 WebView2 运行时修好（Windows「应用和功能」里找到
**Microsoft Edge WebView2 Runtime** → 修改 → 修复），修好后再选一次「硬件加速」
（或 `PRISMVAULT_FORCE_GPU=1` 启动一次）即可恢复硬件加速。

### macOS 提示「已损坏，无法打开」

Gatekeeper 隔离属性所致：

```bash
xattr -dr com.apple.quarantine /Applications/PrismVault.app
```

## 一个 Esc 为什么关了三样东西

双击图片进预览、按 Esc 想退出预览，结果右侧信息栏（连同搜索框）也一起关了。

原因是 `App` 和 `ImageViewer` 都往 `window` 上挂了 `keydown` 监听器，而 `App` 那边的
守卫是「预览开着就直接跳过」：

```ts
if (viewer.viewerOpen()) return;   // ← 读到的是已经被改过的状态
```

`ImageViewer` 是子组件，`onMount` 早于父组件，所以它先收到事件、先把自己关掉
（`viewerOpen` 变 `false`）；等 `App` 的监听器执行时守卫已经不成立，于是继续往下走，
把 `setInfoPanelOpen(false)` 和 `setShowSearch(false)` 也一并做了。一次按键，两处状态。

修法不是加 `stopPropagation()`（同为目标 `window` 的两个监听器互相拦不住，只有
`stopImmediatePropagation` 能拦，而且得依赖注册顺序）——改成在**捕获阶段**先把状态
拍成快照。捕获阶段的监听器一定早于所有冒泡监听器，与注册顺序无关：

```ts
let overlayWasOpen = false;
window.addEventListener("keydown", () => {
  overlayWasOpen = viewer.viewerOpen() || ui.contextMenu() !== null || ui.dialog() !== null;
}, true);
// 后面所有判断都用快照，而不是现读 viewerOpen()
```

顺手把同一类问题一起收了：**Esc 只关最上面那一层**。预览、右键菜单、确认弹窗都算浮层，
只要事件开始时它们开着，`App` 这层就不动背景状态 —— 否则在缩略图上右键、按 Esc 想收起
菜单，会顺手把选中项清空；而弹窗里按 Esc 也会先把背景的选中状态抹掉。

同一次事件里，剩下的键本来就没受影响：`Delete` / `F5` 的守卫看到的仍是「浮层开着」，
是对的 —— 只有 Esc 会因为浮层自身改变了状态而穿帮。

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
| IPC 查询 | **整屏批量**一次调用（`get_thumbnails`）：一次锁、一次遍历，替代过去每张卡片一次 `invoke`。已出结果的直接内存命中返回，**零解码、零持锁** |
| 未命中 | 任务入队，立刻返回 `pending`；卡片保持骨架屏（或模糊占位图） |
| 后台任务 | 独立线程 + `rayon` 并行批次解码，不持有任何锁；每批结果通过 `thumb-ready` 事件推给前端 |
| 触发时机 | 导入完成、打开库、恢复库、索引结束都会自动排队补齐 |
| 生成策略 | JPEG 优先直接抽取 EXIF 内嵌缩略图（只读文件头 1MB），失败才整解码 |
| 队列顺序 | 可见插队（urgent）用**后进先出** —— 最近提交的窗口就是用户此刻看的那一屏；整库补齐（bulk）保持先进先出按 mtime 推进 |
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

### 快速下滑为什么不再长时间白屏（2026-10-14）

图片是**滑到眼前才开始生成**的，所以「还没轮到」造成的空白是正常的。问题在于
以前有三件事把它放大成几十秒的空白：

1. **队列顺序错位**：可见任务（urgent）是先进先出的，快速下滑会把滑过去的每一屏
   都按顺序塞进队首方向。用户真正盯着的那一屏排在几百张之后 —— **滑得越快、
   队列越长、等得越久**（800 张 × 200 ms ÷ 4 线程 ≈ 40 秒）。
2. **`IntersectionObserver` 会漏触发**：卡片若在两次回调之间「进又出」，可能
   永远不报 `isIntersecting`；而前端一旦记下「这张已请求」就不再重问，这些格子
   会一直空着，只能等队列跑空后的兜底重扫（而那要几分钟）。
3. **逐张 IPC 抢同一把锁**：每张卡片一次 `invoke`，每次都取引擎锁 + 图库锁 +
   查一次 SQLite，几百个请求在该锁上串行排队。

现在对应的三处改造：

| 改造 | 做法 |
|------|------|
| **视口窗口** | 前端维护「当前可见集合」，滚动中**一个请求都不发**；停稳 120 ms 后整屏批量提交，并声明这就是窗口 |
| **窗口替换** | 后端收到新窗口即把窗口外那些还没做完的 urgent 任务**降级回整库队列** —— 队列里只剩用户真正在看的一屏（`ThumbWorker::enqueue_window`） |
| **后进先出** | urgent 从队尾取：最近提交的窗口最先被解 |
| **批量 IPC** | `get_thumbnails(library_id, paths, window?)` 一次锁、一次遍历；`window` 不传时只解析窗口（整库兜底重扫用，避免误降级当前视口） |
| **真虚拟化** | 网格 / 列表只把「可见 ± 2 行」的卡片挂进 DOM（约 60–100 个节点），而不是整库 2400 个；滚动条高度由行数算出来撑住 |
| **模糊占位图（LQIP）** | 解码前先跑一遍**只读文件头**的 EXIF 内嵌缩略图抽取，压成 32px（约 1 KB data URL）推给前端，卡片先显示模糊轮廓、真图随后淡入覆盖 |

虚拟化还顺手解决了上面第 2 条：**视口窗口不再依赖 `IntersectionObserver`**。网格和
列表的行列都是规则网格 —— 列数由容器宽度算、行高由缩略图尺寸算，于是「现在屏幕上
是哪几张」可以直接由 `scrollTop` 同步算出来，不存在漏报；同时也省掉了每个卡片一个
观察器的开销（2 万个观察器换成 0 个）。范围变化（滚动跨过一行）就重算窗口并重置
120 ms 去抖计时器，所以**滚动中依然一个请求都不发**。

只有瀑布流模式没有虚拟化 —— CSS columns 的列高不均，算不出精确的行位置，那里仍由
卡片的观察器上报可见性。

#### 点开信息面板后，那张图为什么还钉在原位（2026-10-23）

右侧信息面板是 `w-[19rem]` 的固定宽度兄弟节点，一开就把网格挤窄 → 列数变少 →
**同一张图换了行**。以前点一下卡片，信息面板弹出的同时这张图被推到更靠后的行、
滑出可视区，看起来像"点了就跳走了"。

因为列数变化只改行号、不改行高，把 `scrollTop` 平移「行差 × 行高」就能让它逐像素
不动（不是"滚到可见"，而且鼠标指针仍然停在它上面）。三个实现细节：

- **时机用 `requestAnimationFrame`**：rAF 一定在 DOM 更新之后、本帧绘制之前。此时
  `containerRef.clientWidth` 已是新宽度，而 `virtual()` 里的列数还是旧的（ResizeObserver
  要等本帧的 rAF 回调之后才派发）—— 正好一旧一新可以对比，用户也看不到"先跳走再
  跳回"的中间态。
- **先记旧 `scrollTop` 再让新宽度进信号**：列数一变，撑起滚动高度的行数也跟着变，
  浏览器可能趁机把 `scrollTop` 夹一下；用绝对目标值（旧位置 + 行差）而不是累加才稳。
- **平移后立刻 `syncViewport()`**：否则要等滚动事件 / ResizeObserver 补上那一帧，
  这一帧的切片还是按旧位置算的，会闪一下空白。

关面板同样走这套（`onClose` 会先把 `infoPanelFile` 清空，所以额外记住"最后打开过的
那张"当锚点）。瀑布流没有行位置可算，退回元素实测矩形：出了可视区就往回滚到边缘。

LQIP 之所以便宜，是因为它和网格缩略图的取舍**方向相反**：网格嫌内嵌缩略图
160×120 太糊而退回整图解码，而 32px 的占位图正好需要小图 —— 这条近乎免费的
快路径（读 1 MB 文件头，毫秒级）在占位用途上终于派上用场。没有内嵌图的
（PNG / 截图）会在整图解码完成后用刚生成的缩略图补一张，并**缓存在缓存目录**
（`{hash}_lqip.jpg`），所以下次滑到同一片区域是即时命中。

### 后台预热与进度环（2026-10-14）

打开、导入或恢复图库时，缺缩略图的图片会被**整批排进后台队列**慢慢补齐 —— 这叫
预热，**默认启用**，不需要用户点任何按钮。好处是把成本从「用户滑动时」前移到
「用户还没在看的时候」：等真的开始浏览，大部分图已经是即时命中。

进度以**圆形进度环 + 已处理数量**显示在图库名旁边（`CircleProgress`，SVG 的
`stroke-dasharray` 画弧），整库补完自动收起。实现上有两个取舍值得记一笔：

- **进度按库统计**，用的是「本轮预热批次的任务键集合」而不是全局计数 —— 用户滚动
  触发的按需任务同样流经这条流水线，但它们不该算进预热进度里。
- **已经在内存结果表里出过结论的候选直接记为已完成**，否则进度环会永远差那么几个
  到不了 100%。

设置里可以关掉自动预热（`打开图库时在后台生成缩略图`，本地持久化在
`localStorage`，启动时同步给后端）。关掉后只是不再自动排队，**滚动到哪张生成哪张
的按需路径完全不受影响**；设置页的「立即补齐当前图库」也不受开关影响。

### 预热速度与 CPU 占用（2026-10-14）

先量了一轮：4K 图库（2398 张、中位 7.0MP JPEG）整库预热 **140 秒 / 17.1 张每秒**。
把单张拆开看（16 张取平均，单张 210ms）：

| 阶段 | 耗时 | 占比 |
|------|------|------|
| 读文件 | 3ms | 1% |
| **解码**（全图，zune-jpeg） | 95ms | 45% |
| **重采样**（`resize(CatmullRom)`） | **105ms** | **49%** |
| JPEG 编码 q70 | 6ms | 3% |
| 落盘 | 1ms | 1% |

结论有点反直觉：**重采样比解码还贵**。降采样倍率是 8.6 倍（4000 → 448），带卷积核的
CatmullRom 要逐像素加权求和，每个输出像素得算几十个输入像素；而 `imageops::thumbnail`
用的是「整数块面积平均」，同样是抗混叠，但每个源像素只参与一次累加。

于是这一轮做了三件事。

**1. 重采样换成 `thumbnail()`（按倍率自选算法）**

`engine/thumbnail.rs` 新增 `downscale(img, bounds)`，统一接管原来散在各处的
`resize(..., CatmullRom)`：

- 倍率 **≥ 2** → `thumbnail()`（面积平均，实测 105ms → **10.6ms**，快 9.9 倍）
- 倍率 **< 2** → 退回 `resize(CatmullRom)`

为什么要留退路：`thumbnail()` 在倍率接近 1 时会**整个跳过**一部分源像素，出现锯齿 /
摩尔纹（官方文档原话 *"may give aliasing artifacts if new size is close to old size"*）。
8 倍降采样时每个输出像素平均掉几十个源像素，抗混叠比卷积核更彻底；1.2 倍的时候就只剩
最近邻效果了。实际命中：网格图（448）几乎全是 8 倍以上，全走快路；预览图（1600）对
4000px 原片是 2.5 倍，也能走；只有「略大于 1600」的源图会落回慢路，而它们是按需生成、
数量极少，不影响体感。

单张 210ms → **118ms（-44%）**，整库 140 秒 → 约 78 秒。

> **刻意没有升 `CACHE_VERSION`。** 输出字节确实变了，但 448px 下 box 面积平均和
> CatmullRom 肉眼分不出来，而升版的代价是「整库重算一遍」—— 拿一分钟的确定开销去换
> 一个看不出来的差异不划算。新旧缓存混着用没有副作用，新生成的图自然就是新算法。
> 想完整重测就删掉 `<图库>/.prism/thumbnails/` 再来一轮。

**2. 去掉 LQIP 的 `filter: blur(10px)`**

32px 的小图被 `object-cover` 拉满整格，本身已经糊到看不出像素块，再叠一层 10px 高斯
模糊只是给每张卡片白烧一次 CPU —— 几百张同时挂载时，在软件渲染（GPU 被降级）下滚动
会明显掉帧。顺带去掉了配套的 `transform: scale(1.08)`：它唯一的用途是遮住模糊产生的
半透明边缘，没有模糊就不需要，去掉反而少一个要重新光栅化的合成层。

**3. 后台任务让路：进程 + 线程两级降优先级**

新增 `utils/priority.rs`（和 `winattr.rs` 一样直接声明系统符号，不引任何依赖）：

| 层级 | 动作 | 意图 |
|------|------|------|
| 进程 | `BELOW_NORMAL_PRIORITY_CLASS` | 别的程序要 CPU 时让路；系统空闲时照旧拿满全部核心 |
| 解码线程 | `THREAD_PRIORITY_BELOW_NORMAL` | 进程内部也是「界面 / 事件循环 > 解码」 |

三个容易踩的点：

- **进程降级必须放在窗口建好之后**（`main.rs` 里紧跟 `builder.build()`）。WebView2 会
  派生自己的浏览器 / 渲染 / GPU 进程，而子进程默认**继承父进程的优先级类** —— 提前
  降级会把渲染进程一起拖到 Below Normal，正好和「让界面更跟手」的目标相反。
- 线程那一档用 rayon 的 **`start_handler`** 而不是 `spawn_handler`：不接管线程创建，
  线程名、栈大小仍归 rayon 自己管，少一处可能出错的地方。
- 刻意**不用** `IDLE_PRIORITY_CLASS`：那个档位只在系统完全空闲时才被调度，实测会把整库
  预热拖到几倍时长。`BELOW_NORMAL` 才是「让路但仍全力」。

不需要这个行为（或想做性能对比）时，用 `PRISMVAULT_PRIORITY=normal` 启动即可全部关掉。

**这一轮没做的（仍在候选池）**：`MAX_PARALLEL` 从 4 提到 8~12（预计再降到约 26 秒，
但峰值内存 144MB → 430MB，且和「降低占用」的目标相冲）；JPEG DCT 缩放解码（`zune-jpeg`
不支持，要引 C 依赖 / 改 CI）；`opt-level` 从 `"s"` 提到 3（实测 105ms → 103ms，纯噪声，
已划掉）。

**评估后放弃：两阶段预热（先用 112px 铺满整库，空闲再精修 448）。**
这个想法的前提是「小尺寸能省掉解码」，但实测数据不支持 —— 单张 116ms 里解码占 95ms
（82%），而 **zune-jpeg 必须整图解码，输出多大都一样**。所以：

| | 单张耗时 | 整库（2398 张） |
|---|---|---|
| 直接出 448（现方案） | 116ms | 约 78 秒 |
| 先 112px 再 448 | 104ms + 116ms = 220ms | 约 147 秒 |

第一阶段只比直接做快 10%（省下的仅是重采样与编码的差价），却把总工时翻了一倍，而且
**「第一张图出现的时间」一点没变**。更关键的是，这个想法想解决的问题（等待时看不见内容）
已经被 32px 的 LQIP 占位图解决了 —— 占位图在毫秒级就铺满整屏。

要让它成立，前提是先做 **JPEG DCT 缩放解码**（解 1/8 尺寸只需约 15ms）；有那个之后
第一阶段才真的「秒级」，而第二阶段也能直接从中间图生成、不必再解一次原图。

### 交互感知节流（2026-10-14）

CPU 占用高的另一半来自「用户操作时后台还在抢」。现在前端在**滚动 / 拖拽框选**时会通过
`thumbs_interaction` 上报一次，后端随后 **约 460ms 内只处理 urgent 队列**（用户此刻盯着
的那一屏），整库预热（bulk）整个停下，并且每轮 `sleep(60ms)` —— 是真把 CPU 还回去，
而不是满核空转。静默窗口到期自动恢复满速。

因为判断完全基于时间戳，所以**不需要上报「交互结束」**，前端也不用维护状态机：

- 「最近一次交互」是一个 `AtomicU64`（相对单调时钟 `Instant` 的毫秒数），不加锁。
- 限流放在**前端**（120ms 一次、fire-and-forget），后端只回答「最近一次交互是什么时候」。
- 460ms 比常见滚动惯性停顿（300–400ms）略长，免得手指连续滑动的间隙里后台插进来抢 CPU；
  又不至于长到预热肉眼可见地变慢。

实现上有个必须小心的点：**被节流时 `running` 要保持 true**。如果这时候走「两个队列都空」
的收工分支，worker 线程会退出，预热就永久停摆，只能等下次入队才重新拉起 —— 代码里为
这一条单独留了一个 `yielded` 分支。

### 渲染方式（GPU）

设置里可以选三种，**重启后生效**（WebView2 的启动参数只在创建窗口时能传）：

| 选项 | 行为 |
|------|------|
| 自动（默认） | GPU 能起就用；崩过一次就退回软件渲染并记住结论 |
| 硬件加速 | 强制再试一次（清掉上次的崩溃结论） |
| 软件渲染 | 完全不用 GPU —— 省电，也能避开某些驱动导致的画面异常 |

**为什么必须补这个开关**：原来的恢复手段只有环境变量 `PRISMVAULT_FORCE_GPU=1`，而桌面
应用的用户基本都是双击快捷方式启动的，**拿不到自定义环境变量**。于是一旦自动降级，就
等于永久锁在软件渲染上，后来驱动修好了也没法自己恢复。

**崩溃保护仍然保留**：选了「硬件加速」之后真崩了（上次启动没走到「界面就绪」），下次启动
会自动退回「自动 + 软件渲染」并在设置页说明原因 —— 否则「白屏 → 进不去设置页 → 改不
回来」会变成死循环。想再试随时可以再选一次。

实现上有个容易写错的点：`mark_ready()`（前端渲染成功时注销哨兵）以前写的是
`GpuState::default()`，那会把用户刚选的「硬件加速」在第一次成功启动后**悄悄改回「自动」**。
现在它会原样带上 `mode`。

## 图标系统（2026-10-15）

界面图标全部是内联 SVG（`src/components/icons/`），不再用 emoji。emoji 的问题很实际：
不同系统字形不统一、颜色不可控、尺寸随字号跳动、深浅主题下观感随机——在做了黑白两套
玻璃拟态主题之后，这些不一致会被放大。

两套风格 + 一档描边变体按场景混用，不是单选：

| 风格 | 用途 | 特征 |
|------|------|------|
| A · Fluent 线性 | 界面小图标（菜单、面板、查看器、工具栏） | 24×24 viewBox、1.5px 圆角描边、`currentColor` 上色 |
| A′ · 侧栏导航 | 侧栏顶部四个 tab（文件夹 / 标签 / 智能 / 搜索） | 同 A 但统一 1.7px 描边；**激活态由容器承担**（实心强调色胶囊 + 反色图标） |
| C · 灰阶 3D | 欢迎页 logo、特性图标、空状态 | 多层不透明度叠白色高光，纯黑白 |

> 侧栏导航一开始是独立的「B · 圆角实心」风格，现已废弃。原因很直接：四个图标里
> 文件夹 / 标签 / 智能是实心块、搜索是细圆环，实心与线条并排时视觉重量差近一倍，
> 看着参差；而"哪个 tab 是激活的"当时靠贴底的 2px 下划线表达，指示条离图标隔了
> 十几像素。现在描边统一，激活态换成等宽胶囊里的实心强调色 —— 描边粗细和填充
> 状态不必再互相迁就。

两个设计约束：

- **颜色全部走 `currentColor`**（C 风格的高光层除外）——黑白两套主题自动跟随，不需要
  为每套主题各存一份图标，也不出现「深色主题下浅色图标」的漏网之鱼。
- **C 风格刻意不用 SVG 渐变**：同页面多实例时 `id` 会冲突（浏览器只认第一个定义），改用
  多层 `opacity` 出层次，效果等价且没有 id 管理问题。

应用图标（`src-tauri/icons/app-icon.svg`，`tauri icon` 生成全套）用的是「山 + 太阳」意象：
深色圆角底板、右上白日、两层山（远 30% / 近 90% 白）出纵深，顶部一条薄高光呼应界面的
玻璃质感。32px 下仍是可辨的剪影——这是小尺寸图标的设计底线。

替换时有个语义细节点：原 emoji 里 `⛔` 实际承担了三种操作（清空垃圾篓 / 彻底删除 /
删除库及所有文件）、`↩` 承担了两种（恢复 / 移除库但保留文件），所以拆成了
`IconTrashX` 与 `IconUndo` / `IconLogOut`，没有笼统复用。

### 侧栏的四处对齐修正（2026-10-15）

- **顶部 tab 改成分段控件**：`flex-1` + 贴底下划线 → `p-1.5` + `gap-1` 的四等宽胶囊
  （`.sidebar-tab`，32px 高）。激活项是 `--accent` 实心 + `--accent-contrast` 图标，
  和 `.btn-primary` 同一套语言。不用 `--bg-elevated` 当激活底：浅色主题下它是
  "白叠白"，和侧栏只差 2 个色阶，指示太虚。
- **资源库图标从「显示器」换成 `IconLibrary`**（照片堆叠：后一张只露右上两条边，
  前一张里画山与太阳，呼应应用图标）。显示器会被读成"屏幕 / 远程 / 显示器设备"，
  和图片库没有任何关系。
- **缩进收敛到同一条 18px 基线**：以前 `.sidebar-section` 和 `.sidebar-item` 各带
  `px-3`，两层叠加后内容是 24px，而分组标题只有 12px、垃圾篓 20px —— 三条线各走
  各的。现在 section `px-2` + item/title `px-2.5`，标题、垃圾篓、库项图标、底部
  按钮全部落在同一条线上，右侧的计数与 ✕ 也对称地离边 18px。
- **库行的「移除」✕ 平时收起**（`opacity-0` + `group-hover:opacity-100`）。用
  `opacity` 而不是 `display`：几何不变，行高和数字列不会因悬停而跳动。

`IconProps` 另外加了 `strokeWidth`（默认 1.5），这样"某套图标整体粗一档"不需要
再复制一份 path。

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
