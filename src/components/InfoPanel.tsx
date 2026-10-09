import { createSignal, Show, createResource, createEffect, on, onMount, For } from "solid-js";
import { api } from "@/lib/tauri-api";
import { activeLibraryId } from "@/stores/library";
import { useTagsStore } from "@/stores/tags";
import { useFilesStore } from "@/stores/files";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  filePath: string;
  onClose: () => void;
}

export function InfoPanel(props: Props) {
  const tags = useTagsStore();
  const files = useFilesStore();

  const [notes, setNotes] = createSignal("");
  const [editingNotes, setEditingNotes] = createSignal(false);
  const [showTagPicker, setShowTagPicker] = createSignal(false);
  const [newTagName, setNewTagName] = createSignal("");
  const [busy, setBusy] = createSignal(false);

  const [fileInfo, { refetch }] = createResource(
    () => ({ libId: activeLibraryId(), path: props.filePath }),
    async ({ libId, path }) => { if (!libId) return null; return api.getFileInfo(libId, path); }
  );

  onMount(() => { tags.loadTags(); });

  // Reset transient edit state whenever the panel switches to another file
  createEffect(on(() => props.filePath, () => {
    setEditingNotes(false);
    setShowTagPicker(false);
    setNewTagName("");
    setNotes("");
  }));

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSaveNotes = async () => {
    const libId = activeLibraryId();
    if (!libId) return;
    setBusy(true);
    try {
      await api.updateFileNotes(libId, props.filePath, notes());
      await refetch();
      setEditingNotes(false);
    } finally {
      setBusy(false);
    }
  };

  const handleRating = async (star: number) => {
    const libId = activeLibraryId();
    if (!libId) return;
    const current = fileInfo()?.rating || 0;
    await api.updateFileRating(libId, props.filePath, current >= star ? 0 : star);
    await refetch();
  };

  const handleAddTag = async (tagId: number) => {
    const libId = activeLibraryId();
    if (!libId) return;
    setBusy(true);
    try {
      await api.addTagToFile(libId, props.filePath, tagId);
      await refetch();
      await files.updateFileTags(props.filePath);
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    const libId = activeLibraryId();
    if (!libId) return;
    setBusy(true);
    try {
      await api.removeTagFromFile(libId, props.filePath, tagId);
      await refetch();
      await files.updateFileTags(props.filePath);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAddTag = async () => {
    const name = newTagName().trim();
    if (!name) return;
    const created = await tags.createTag(name);
    if (created) await handleAddTag(created.id);
    setNewTagName("");
  };

  const s = {
    bg: "var(--bg-secondary)",
    border: "var(--border-color)",
    text: "var(--text-primary)",
    muted: "var(--text-muted)",
    accent: "var(--accent)",
    tertiary: "var(--bg-tertiary)",
  };

  return (
    <aside class="info-panel w-72 flex-shrink-0 flex flex-col animate-slide-up">
      <div class="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${s.border}` }}>
        <span class="text-sm font-medium" style={{ color: s.text }}>信息</span>
        <button class="btn-ghost text-xs px-1.5" onClick={props.onClose}>✕</button>
      </div>

      <Show when={fileInfo()} fallback={<div class="p-4 text-xs" style={{ color: s.muted }}>加载中...</div>}>
        {(info) => (
          <div class="flex-1 overflow-y-auto">
            <div class="aspect-square flex items-center justify-center" style={{ background: s.tertiary }}>
              <img src={convertFileSrc(props.filePath)} alt={info().filename}
                class="max-w-full max-h-full object-contain" draggable={false}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            </div>

            <div class="p-4 space-y-3">
              <div><label class="text-2xs uppercase" style={{ color: s.muted }}>文件名</label>
                <p class="text-sm break-all" style={{ color: s.text }}>{info().filename}</p></div>

              <div class="grid grid-cols-2 gap-2">
                <div><label class="text-2xs uppercase" style={{ color: s.muted }}>尺寸</label>
                  <p class="text-sm" style={{ color: s.text }}>{info().width && info().height ? `${info().width} × ${info().height}` : "未知"}</p></div>
                <div><label class="text-2xs uppercase" style={{ color: s.muted }}>大小</label>
                  <p class="text-sm" style={{ color: s.text }}>{formatSize(info().size_bytes)}</p></div>
                <div><label class="text-2xs uppercase" style={{ color: s.muted }}>格式</label>
                  <p class="text-sm uppercase" style={{ color: s.text }}>{info().extension}</p></div>
                <div><label class="text-2xs uppercase" style={{ color: s.muted }}>修改时间</label>
                  <p class="text-sm" style={{ color: s.text }}>{new Date(info().mtime).toLocaleDateString()}</p></div>
              </div>

              <div><label class="text-2xs uppercase" style={{ color: s.muted }}>评分</label>
                <div class="flex gap-0.5 mt-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button class="text-lg transition-colors"
                      style={{ color: (info().rating || 0) >= star ? "var(--star-color)" : s.muted }}
                      onClick={() => handleRating(star)}>★</button>
                  ))}
                </div>
              </div>

              <div>
                <label class="text-2xs uppercase" style={{ color: s.muted }}>标签</label>
                <div class="flex flex-wrap gap-1 mt-1">
                  <Show when={info().tags.length > 0} fallback={<span class="text-xs" style={{ color: s.muted }}>暂无标签</span>}>
                    {info().tags.map((tag) => (
                      <span class="tag-pill text-white" style={{ background: tag.color || "#6c757d" }}>
                        {tag.name}
                        <button class="ml-1 text-white/60 hover:text-white"
                          title="移除标签"
                          onClick={() => handleRemoveTag(tag.id)}>×</button>
                      </span>
                    ))}
                  </Show>
                  <button class="tag-pill" style={{ background: s.tertiary, color: s.muted }}
                    onClick={() => setShowTagPicker(!showTagPicker())}>
                    {showTagPicker() ? "收起" : "+ 添加标签"}
                  </button>
                </div>

                <Show when={showTagPicker()}>
                  <div class="mt-1.5 rounded-lg overflow-hidden" style={{ border: `1px solid ${s.border}`, background: s.tertiary }}>
                    <div class="max-h-40 overflow-y-auto py-1">
                      <Show when={tags.tags().length > 0} fallback={
                        <p class="px-2 py-1 text-xs" style={{ color: s.muted }}>还没有标签，先在下方新建</p>
                      }>
                        <For each={tags.tags()}>
                          {(tag) => {
                            const applied = () => info().tags.some((t) => t.id === tag.id);
                            return (
                              <div class="flex items-center gap-2 px-2 py-1 cursor-pointer text-xs transition-opacity hover:opacity-80"
                                style={{ color: applied() ? s.accent : s.text }}
                                onClick={() => applied() ? handleRemoveTag(tag.id) : handleAddTag(tag.id)}>
                                <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tag.color || s.muted }} />
                                <span class="truncate flex-1">{tag.name}</span>
                                <Show when={applied()}>
                                  <span style={{ color: s.accent }}>✓</span>
                                </Show>
                              </div>
                            );
                          }}
                        </For>
                      </Show>
                    </div>
                    <div class="flex gap-1 p-1.5" style={{ borderTop: `1px solid ${s.border}` }}>
                      <input class="input flex-1 text-xs py-1" placeholder="新建标签..." value={newTagName()}
                        onInput={(e) => setNewTagName(e.currentTarget.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateAndAddTag(); }} />
                      <button class="btn-primary text-xs px-2" onClick={handleCreateAndAddTag}>新建</button>
                    </div>
                  </div>
                </Show>
              </div>

              <div><label class="text-2xs uppercase" style={{ color: s.muted }}>备注</label>
                <Show when={editingNotes()} fallback={
                  <div class="text-sm mt-1 min-h-[2rem] cursor-text p-1 rounded whitespace-pre-wrap break-words"
                    style={{ color: info().notes ? s.text : s.muted }}
                    onClick={() => { setNotes(info().notes || ""); setEditingNotes(true); }}>
                    {info().notes || "点击添加备注..."}
                  </div>
                }>
                  <textarea class="input text-sm mt-1 min-h-[4rem] resize-none" value={notes()}
                    onInput={(e) => setNotes(e.currentTarget.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) handleSaveNotes(); if (e.key === "Escape") setEditingNotes(false); }} />
                  <div class="flex gap-1 mt-1 items-center">
                    <button class="btn-primary text-xs" disabled={busy()} onClick={handleSaveNotes}>保存</button>
                    <button class="btn-ghost text-xs" onClick={() => setEditingNotes(false)}>取消</button>
                    <span class="text-2xs ml-auto" style={{ color: s.muted }}>Ctrl+Enter 保存</span>
                  </div>
                </Show>
              </div>

              <div><label class="text-2xs uppercase" style={{ color: s.muted }}>路径</label>
                <p class="text-2xs break-all mt-0.5 allow-select" style={{ color: s.muted }}>{info().path}</p></div>
            </div>
          </div>
        )}
      </Show>

      <div class="p-3 flex gap-2" style={{ borderTop: `1px solid ${s.border}` }}>
        <button class="btn-secondary text-xs flex-1" onClick={() => api.openInExplorer(props.filePath)}>📂 在资源管理器中显示</button>
        <button class="btn-secondary text-xs flex-1" onClick={() => api.openFile(props.filePath)}>🔗 打开方式...</button>
      </div>
    </aside>
  );
}
