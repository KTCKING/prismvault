# PrismVault 架构与功能全清单

> 对应版本 **v0.5.0**。上层是功能清单（用户看到什么），下层是模块地图（代码在哪），
> 中间用一张分层图串起来 —— 改功能前先在这里定位归属。

---

## 一、整体架构

```
┌───────────────────────────────────────────────────────────────────┐
│ ① 前端 SolidJS（src/）                                             │
│    App / Sidebar / ThumbnailGrid / Card / InfoPanel / Viewer       │
│    ContextMenu / Settings / Dialog / Toast                         │
│    stores（library files tags ui viewer theme）· tauri-api.ts       │
└──────────────────────────┬────────────────────────────────────────┘
                           │ Tauri IPC（invoke / event）
┌──────────────────────────▼────────────────────────────────────────┐
│ ② Rust 命令层 + engine                                            │
│    commands  library  files  tags  search  import                  │
│    engine    db  indexer  thumbs  thumbnail  import  eaglepack     │
│              watcher  search  dedup                                │
│    utils     hash  media  path  winattr  priority                  │
│    gpu.rs    GPU 哨兵 · 软件渲染降级（窗口在此创建）                │
└──────────────────────────┬────────────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────────────┐
│ ③ 存储（每个库自包含，拷走即迁移）                                  │
│    <库根>/.prism/db.sqlite           schema v3，WAL                 │
│    <库根>/.prism/thumbnails/         blake3 键：448 / 1600 / LQIP   │
│    %APPDATA%/PrismVault/libraries.json  库清单与顺序                │
└────────────────────────────────────────────────────────────────────┘
```

**关键设计取舍**

| 决策 | 原因 |
| --- | --- |
| 元数据放库内 `.prism` | 库可整目录搬走、可放网盘，离线仍能浏览；Windows 上打隐藏属性 |
| 缩略图不落库表、按 blake3 键存文件 | 换尺寸只加文件不改 schema；`prune_stale` 负责清理 |
| 视频不入缩略图队列 | 没有解码器，硬排只会每轮开库白试一遍；卡片自己画播放角标 |
| 网格绝不回退原图 | 12MP 解码 36–50 MB/张，滚两屏就吃光内存；未就绪显骨架屏 |
| 虚拟化只挂可见 ±2 行 | 10 万张时 DOM 数量与总张数无关 |

> **关于网页摘取**：浏览器扩展与本地桥接服务（`bridge.rs` / `extension/`）在
> **v0.5.0 已移除** —— 那是综合性素材管理软件（PixVault）才需要的能力，
> PrismVault 定位为纯本地图库浏览器。`is_video_ext` 这类被共用的工具沉到了
> `utils/media.rs`，功能不受影响。

---

## 二、功能全清单

### 1. 资源库（Library）
- 多库并存，侧栏「库」区切换，可拖拽排序，重启恢复上次打开的库
- 建库：选空目录新建 / 打开已有库（自动识别 PrismVault·Eagle·Pixcall 三种布局）
- 库右键菜单：**重命名**、在资源管理器中打开、从列表移除（保留文件）、**删除库及所有文件**
- **删除三道闸**：弹窗逐字输入库名 → 后端复核库名 → 路径闸（磁盘根 / 网络共享根 /
  用户主目录及其桌面文档下载 / 缺 `.prism` 的目录）
- 网络库（SMB/NFS）：元数据落 AppData，离线可浏览已索引内容

### 2. 浏览与视图
- 三种布局：网格 / 瀑布流 / 列表；缩略图尺寸滑杆
- 虚拟滚动（10 万张即时滚动）
- 侧栏四个分区：**文件夹** / **标签** / **智能文件夹** / **搜索筛选**
- 回收站视图（软删、还原、彻底删除、清空）
- 多选：单击 / Ctrl / Shift / 套索框选
- 排序：时间 / 名称 / 大小 / 评分

### 3. 信息与编辑
- 右侧信息面板（可折叠分区）：标签、描述、评分、尺寸、时间、完整路径
- 单张 / 批量打标签（可新建标签）
- 编辑描述、评分
- 打开方式：预览器 / 系统默认程序 / 资源管理器定位

### 4. 预览器
- 全屏预览，← → 切换，滚轮缩放，拖拽平移，Esc 关闭
- **视频**：`video` 标签直接播放，WebView 不支持的容器提示改用系统播放器
- 1600px 预览图按需生成（不预热）

### 5. 缩略图管线
- 双档：网格 448px（整库预热）+ 预览 1600px（按需）
- 32px LQIP 占位图先到，铺底淡入，绝不回退原图
- Worker 池：urgent（LIFO，当前视口）/ bulk（FIFO，预热）
- **视口窗口调度**：滚动去抖 120 ms 整屏提交，窗口外 urgent 降回 bulk
- **交互感知节流**：滚动时只跑 urgent，bulk 停发
- 进程 / 解码线程降优先级，后台不让风扇抢戏
- 侧栏进度环显示预热进度，可在设置里关闭预热
- 「补齐缺失缩略图」手动入口

### 6. 导入
- **Eagle 素材包 `.eaglepack`**：流式解压、两种布局自动识别、按 Eagle 内文件夹层级
  **真搬盘重组**、清掉 `<ID>.info` 壳、重名加 `(2)`、逐条目进度、可取消
- Eagle 资源库原地导入（不搬盘）
- Pixcall 资源库导入
- 单目录扫描导入（`index_library`）

### 7. 文件操作
- 删除 → 回收站（软删）；还原 / 彻底删除 / 清空
- 拖出窗口交给 OS（可丢进 QQ / 微信 / 资源管理器）
- 复制文件到剪贴板
- 重复文件查找（blake3）

### 8. 设置与系统
- 外观：深 / 浅 / 跟随系统
- 渲染方式：自动 / 硬件加速 / 软件渲染（重启生效，崩溃自动降级并持久化）
- 缩略图预热开关
- 导入统计（条目数 / 解包体积 / 按文件夹重组 / 重名改名）

### 9. 交互细节（踩过坑的地方）
- 开 / 关信息面板时网格列数变化，目标图用 rAF 平移补锚点留在原位
- Esc 只关最上面一层（捕获阶段快照浮层状态，不靠注册顺序）
- 侧栏缩进基线 18 px（`px-2` 容器 + `px-2.5` 条目）

---

## 三、模块地图

```
src/                      前端（SolidJS + Tailwind）
├── App.tsx               布局 · 全局快捷键 · 拖放入口
├── components/
│   ├── Sidebar.tsx       四个分区 tab + 库右键 + 预热进度环
│   ├── ThumbnailGrid.tsx 三种布局 + 虚拟化 + 视口窗口提交
│   ├── ThumbnailCard.tsx LQIP 占位 · 视频角标 · 悬浮操作条
│   ├── ImageViewer.tsx   图片 / 视频预览
│   ├── InfoPanel.tsx     右侧信息面板
│   ├── ContextMenu.tsx   文件 / 库 / 分组三类菜单
│   └── SettingsModal.tsx 设置（外观 / GPU / 预热 / 导入）
├── stores/               files  library  tags  ui  viewer  theme
└── lib/                  tauri-api.ts（invoke 封装）  thumbs.ts（URL 缓存）

src-tauri/src/
├── main.rs               窗口创建（GPU 门控在此）· 命令注册（46 个）
├── lib.rs                AppState · 事件 · 启动时恢复库
├── gpu.rs                GPU 哨兵 / 模式
├── engine/
│   ├── db.rs             SQLite schema v3 · 分页查询 · 标签
│   ├── indexer.rs        目录扫描（图片 + 视频扩展名）
│   ├── thumbs.rs         缩略图 worker 池 + 预热批次
│   ├── thumbnail.rs      448/1600 双档 · LQIP · downscale 统一重采样
│   ├── import.rs         Eagle / Pixcall 库导入
│   ├── eaglepack.rs      .eaglepack 解包 + 重组
│   ├── search.rs         FTS5 + LIKE 兜底
│   ├── dedup.rs          blake3 重复查找
│   └── watcher.rs        目录变更监听
├── commands/             library files tags search import
└── utils/                hash  media（视频判定）  path  winattr  priority
```

---

## 四、数据模型（schema v3）

```
files        id, path(UNIQUE), filename, extension, size_bytes, width, height,
             blake3_hash, phash, mtime, ctime, rating, color_label, notes,
             is_deleted, created_at(导入时间), updated_at
tags         id, name(UNIQUE), parent_id, color, icon
file_tags    file_id × tag_id
smart_folders / snapshots / library_meta(schema_version)
files_fts    FTS5 镜像（filename / path / notes）
```

- `created_at` = 导入时间（UPSERT 不回退），`updated_at` = 记录刷新时间
- `ctime` / `mtime` 是文件系统时间（UTC 无标记，前端按 UTC 解析）
- 重新索引是 UPSERT：只刷派生字段，**不碰**评分 / 备注
- 文件夹视图用前缀范围匹配，不用 LIKE

---

## 五、版本演进

| 版本 | 主题 |
| --- | --- |
| v0.1.0 | 库 + 网格 + 缩略图管线 + 玻璃拟态界面 + GPU 开关 |
| v0.2.0 | 浏览器扩展摘取 + 视频入库 + `.eaglepack` 导入 + 删库三道闸 |
| v0.3.0 | 采集面板可选文件夹 / 打标签 · iframe 内采集 · 失败重试 |
| v0.4.0 | 整页截图（逐屏拼长图） |
| **v0.5.0** | **去掉浏览器扩展与本地桥接，回归纯本地图库** |
