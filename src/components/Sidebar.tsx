import { For, Show, createSignal, onCleanup, createEffect } from "solid-js";
import { useLibraryStore } from "@/stores/library";
import { useFilesStore } from "@/stores/files";
import { useTagsStore } from "@/stores/tags";
import { useUIStore, type SidebarTab } from "@/stores/ui";
import { open } from "@tauri-apps/plugin-dialog";

export function Sidebar() {
  const library = useLibraryStore();
  const files = useFilesStore();
  const tags = useTagsStore();
  const ui = useUIStore();

  // Trash drop state is driven by the pointer-based drag in ThumbnailGrid.
  const trashActive = () => ui.trashHover();

  const tabs: { id: SidebarTab; label: string; icon: string }[] = [
    { id: "folders", label: "文件夹", icon: "📁" },
    { id: "tags", label: "标签", icon: "🏷️" },
    { id: "smart-folders", label: "智能", icon: "⚡" },
    { id: "search", label: "搜索", icon: "🔍" },
  ];

  // Custom drag state
  const [dragFrom, setDragFrom] = createSignal<number | null>(null);
  const [dragOver, setDragOver] = createSignal<number | null>(null);
  const [dragY, setDragY] = createSignal(0);
  let dragStartY = 0;
  let dragThreshold = 5;
  let isDragging = false;
  let sidebarRef!: HTMLElement;

  const handleMouseDown = (e: MouseEvent, idx: number) => {
    // Only start drag on left button
    if (e.button !== 0) return;
    dragStartY = e.clientY;
    setDragFrom(idx);
    setDragOver(idx);
    setDragY(e.clientY);
    isDragging = false;
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (dragFrom() === null) return;
    setDragY(e.clientY);
    
    if (!isDragging && Math.abs(e.clientY - dragStartY) < dragThreshold) return;
    isDragging = true;

    // Find which item we're over
    const items = sidebarRef.querySelectorAll('[data-lib-index]');
    let overIdx = dragFrom()!;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const idx = parseInt((item as HTMLElement).dataset.libIndex || '0');
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        overIdx = idx;
      }
    });
    setDragOver(overIdx);
  };

  const handleMouseUp = () => {
    const from = dragFrom();
    const to = dragOver();
    if (from !== null && to !== null && from !== to && isDragging) {
      library.moveLibrary(from, to);
    }
    setDragFrom(null);
    setDragOver(null);
    isDragging = false;
  };

  // Attach global listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    onCleanup(() => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    });
  }

  const [newTagName, setNewTagName] = createSignal("");
  const [showNewTag, setShowNewTag] = createSignal(false);

  const handleCreateTag = async () => {
    const name = newTagName().trim();
    if (!name) return;
    await tags.createTag(name);
    setNewTagName("");
    setShowNewTag(false);
  };

  // ── Trash handling ───────────────────────────────

  const openTrash = async () => {
    ui.setShowTrash(true);
    await files.loadDeletedFiles();
  };

  const closeTrash = () => {
    ui.setShowTrash(false);
  };


  const s = {
    bg: "var(--bg-secondary)",
    border: "var(--border-color)",
    text: "var(--text-primary)",
    muted: "var(--text-muted)",
    accent: "var(--accent)",
    hover: "var(--bg-hover)",
  };

  return (
    <aside class="w-56 flex-shrink-0 flex flex-col"
      style={{ background: s.bg, borderRight: `1px solid ${s.border}` }}
      onContextMenu={(e) => {
        // Right-click on empty sidebar space (not on a library or the trash
        // entry) opens the "new / open library" menu.
        e.preventDefault();
        ui.setContextMenu({
          x: e.clientX,
          y: e.clientY,
          target: { kind: "sidebar" },
        });
      }}
    >
      {/* Tab Selector */}
      <div class="flex border-b" style={{ borderColor: s.border }}>
        <For each={tabs}>
          {(tab) => (
            <button
              class="flex-1 py-2 text-xs font-medium transition-colors"
              style={{
                color: ui.sidebarTab() === tab.id ? s.accent : s.muted,
                borderBottom: ui.sidebarTab() === tab.id ? `2px solid ${s.accent}` : "2px solid transparent",
              }}
              onClick={() => { ui.setShowTrash(false); ui.setSidebarTab(tab.id); }}
            >
              {tab.icon}
            </button>
          )}
        </For>
      </div>

      {/* Trash — always-visible entry inside the sidebar menu area */}
      <div class="p-2 flex-shrink-0" style={{ borderBottom: `1px solid ${s.border}` }}>
        <div
          class="sidebar-item"
          classList={{ active: ui.showTrash() }}
          data-trash-drop
          style={trashActive() ? { background: "var(--accent)", color: "#fff", outline: "2px dashed var(--accent)", outlineOffset: "2px" } : {}}
          onClick={openTrash}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            ui.setContextMenu({
              x: e.clientX,
              y: e.clientY,
              target: { kind: "trash", paths: [] },
            });
          }}
          title="垃圾篓：把图片拖到此处删除"
        >
          <span class="text-xs">🗑</span>
          <span class="truncate">{trashActive() ? "松开以移入垃圾篓" : "垃圾篓"}</span>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto">
        {/* Trash view (overrides tab content while open) */}
        <Show when={ui.showTrash()}>
          <div class="sidebar-section" onContextMenu={(e) => e.stopPropagation()}>
            <div class="flex items-center justify-between mb-2">
              <span class="text-2xs font-semibold uppercase tracking-wider" style={{ color: s.muted }}>🗑 垃圾篓</span>
              <button class="text-xs" style={{ color: s.muted }} onClick={closeTrash} title="返回">←</button>
            </div>
            <Show when={files.deletedFiles().length > 0}>
              <button
                class="w-full text-xs py-1 px-2 rounded mb-2 transition-colors"
                style={{ color: "var(--danger)", background: "var(--bg-tertiary)" }}
                onClick={() => {
                  const n = files.deletedFiles().length;
                  ui.requestConfirm({
                    title: "清空垃圾篓",
                    message: `确定要彻底删除垃圾篓中的 ${n} 个文件吗？此操作不可恢复。`,
                    confirmText: "彻底删除",
                    danger: true,
                    onConfirm: async () => { await files.emptyTrash(); },
                  });
                }}
              >清空垃圾篓</button>
            </Show>
            <Show when={files.deletedFiles().length > 0} fallback={
              <p class="text-xs" style={{ color: s.muted }}>垃圾篓是空的</p>
            }>
              <div class="flex flex-col gap-1">
                <For each={files.deletedFiles()}>
                  {(f) => (
                    <div
                      class="flex items-center gap-2 px-2 py-1.5 rounded"
                      style={{ background: s.hover }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        ui.setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          target: { kind: "trash", paths: [f.path] },
                        });
                      }}
                    >
                      <span class="truncate text-xs flex-1" style={{ color: s.text }} title={f.path}>{f.filename}</span>
                      <button
                        class="text-xs px-1 rounded hover:bg-green-500/20 transition-colors"
                        style={{ color: s.accent }}
                        title="恢复"
                        onClick={async () => { await files.restoreFile(f.path); await files.loadFiles(0); }}
                      >↩</button>
                      <button
                        class="text-xs px-1 rounded hover:bg-red-500/20 transition-colors"
                        style={{ color: s.muted }}
                        title="彻底删除"
                        onClick={async () => { await files.purgeFile(f.path); }}
                      >✕</button>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={ui.sidebarTab() === "tags" && !ui.showTrash()}>
          <div class="sidebar-section">
            <div class="flex items-center justify-between mb-2">
              <span class="text-2xs font-semibold uppercase tracking-wider" style={{ color: s.muted }}>标签</span>
              <div class="flex items-center gap-1">
                <Show when={files.filterTag() !== undefined}>
                  <button class="text-2xs" style={{ color: s.accent }}
                    onClick={async () => {
                      files.setFilterTag(undefined);
                      tags.setSelectedTagIds(new Set());
                      await files.loadFiles(0);
                    }}>清除筛选</button>
                </Show>
                <button class="text-xs" style={{ color: s.muted }} onClick={() => setShowNewTag(!showNewTag())}>+</button>
              </div>
            </div>

            <Show when={showNewTag()}>
              <div class="flex gap-1 mb-2">
                <input class="input flex-1 text-xs py-1" placeholder="新建标签..." value={newTagName()}
                  onInput={(e) => setNewTagName(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()} />
                <button class="btn-primary text-xs px-2" onClick={handleCreateTag}>✓</button>
              </div>
            </Show>

            <For each={tags.tags()}>
              {(tag) => (
                <div class="sidebar-item" classList={{ active: files.filterTag() === tag.id }}
                  title={files.selectedFiles().size > 0 ? "把此标签加到已选文件" : "按此标签筛选"}
                  onClick={async () => {
                    // Files are selected in the grid -> assign the tag to them
                    if (files.selectedFiles().size > 0) {
                      await tags.batchAddTags([...files.selectedFiles()], [tag.id]);
                      await files.loadFiles(0);
                      return;
                    }
                    // Otherwise toggle a tag filter
                    const next = files.filterTag() === tag.id ? undefined : tag.id;
                    files.setFilterTag(next);
                    tags.setSelectedTagIds(new Set(next !== undefined ? [next] : []));
                    await files.loadFiles(0);
                  }}>
                  <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tag.color || s.muted }} />
                  <span class="truncate">{tag.name}</span>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={ui.sidebarTab() === "folders" && !ui.showTrash()}>
          <div class="sidebar-section" ref={sidebarRef}>
            <span class="text-2xs font-semibold uppercase tracking-wider" style={{ color: s.muted }}>库</span>
            <For each={library.libraries()}>
              {(lib, index) => (
                <div
                  class="sidebar-item group"
                  classList={{ 
                    active: library.activeLibraryId() === lib.id,
                    'opacity-50': dragFrom() === index() && isDragging,
                  }}
                  data-lib-index={index()}
                  style={{
                    cursor: dragFrom() !== null ? 'grabbing' : 'pointer',
                    ...(dragOver() === index() && dragFrom() !== index() && dragFrom() !== null
                      ? { 'border-top': `2px solid ${s.accent}` }
                      : {}),
                  }}
                  onMouseDown={(e) => handleMouseDown(e, index())}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    ui.setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      target: { kind: "library", libraryId: lib.id },
                    });
                  }}
                  onClick={() => { 
                    if (!isDragging) {
                      library.setActiveLibraryId(lib.id); 
                      files.loadFiles(0); 
                    }
                  }}>
                  <span class="text-xs">{lib.is_network ? "🌐" : "💻"}</span>
                  <span class="truncate">{lib.name}</span>
                  <span class="ml-auto text-2xs" style={{ color: s.muted }}>{lib.file_count}</span>
                  <button
                    class="ml-1 px-1 text-xs rounded hover:bg-red-500/20 transition-colors"
                    style={{ color: "var(--text-muted)" }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      await library.closeLibrary(lib.id);
                      files.loadFiles(0);
                    }}
                    title="移除库"
                  >✕</button>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={ui.sidebarTab() === "smart-folders" && !ui.showTrash()}>
          <div class="sidebar-section">
            <span class="text-2xs font-semibold uppercase tracking-wider" style={{ color: s.muted }}>智能文件夹</span>
            <p class="text-xs mt-2" style={{ color: s.muted }}>智能文件夹会根据规则自动收集符合条件的文件。</p>
            <button class="btn-secondary text-xs mt-2 w-full">+ 创建智能文件夹</button>
          </div>
        </Show>

        <Show when={ui.sidebarTab() === "search" && !ui.showTrash()}>
          <div class="sidebar-section">
            <span class="text-2xs font-semibold uppercase tracking-wider" style={{ color: s.muted }}>筛选</span>
            <div class="mt-2 space-y-2">
              <label class="text-xs" style={{ color: s.muted }}>文件类型</label>
              <select class="input text-xs" value={files.filterExt() || ""}
                onChange={(e) => { files.setFilterExt(e.currentTarget.value || undefined); files.loadFiles(0); }}>
                <option value="">全部类型</option>
                <option value="jpg">JPEG</option>
                <option value="png">PNG</option>
                <option value="webp">WebP</option>
                <option value="gif">GIF</option>
                <option value="svg">SVG</option>
                <option value="psd">PSD</option>
                <option value="raw">RAW</option>
              </select>
            </div>
          </div>
        </Show>
      </div>

      <div class="p-2" style={{ borderTop: `1px solid ${s.border}` }}>
        <button class="btn-secondary text-xs w-full" onClick={async () => {
          const selected = await open({ directory: true, multiple: false, title: "选择文件夹作为图片库" });
          if (selected && typeof selected === "string") {
            await library.openLibrary(selected);
            await files.loadFiles(0);
            await tags.loadTags();
          }
        }}>+ 打开库</button>
      </div>
    </aside>
  );
}