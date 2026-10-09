import { createSignal, createEffect } from "solid-js";
import { api, type FileInfo, type PaginatedFiles } from "@/lib/tauri-api";
import { activeLibraryId, libraries, setLibraries } from "./library";

const [files, setFiles] = createSignal<FileInfo[]>([]);
const [totalFiles, setTotalFiles] = createSignal(0);
const [selectedFiles, setSelectedFiles] = createSignal<Set<string>>(new Set());
const [currentSort, setCurrentSort] = createSignal({ by: "mtime", order: "DESC" });
const [filterExt, setFilterExt] = createSignal<string | undefined>();
const [filterTag, setFilterTag] = createSignal<number | undefined>();
const [isLoading, setIsLoading] = createSignal(false);
const [deletedFiles, setDeletedFiles] = createSignal<FileInfo[]>([]);

const PAGE_SIZE = 100;

export function useFilesStore() {
  const loadFiles = async (offset = 0) => {
    const libId = activeLibraryId();
    if (!libId) return;

    if (offset === 0) {
      setFiles([]);
      setTotalFiles(0);
    }
    setIsLoading(true);
    try {
      const result = await api.getFiles(
        libId,
        offset,
        PAGE_SIZE,
        currentSort().by,
        currentSort().order,
        filterExt(),
        filterTag()
      );
      if (offset === 0) {
        setFiles(result.files);
      } else {
        setFiles((prev) => [...prev, ...result.files]);
      }
      setTotalFiles(result.total);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (path: string, multi = false) => {
    setSelectedFiles((prev) => {
      const next = multi ? new Set(prev) : new Set<string>();
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  /**
   * Batch-set the selection (used by marquee / drag-select).
   * @param paths   file paths to mark as selected
   * @param additive  when true, union with `base` (Ctrl/Cmd-drag) instead of replacing
   * @param base    selection snapshot taken when the drag started
   */
  const setSelection = (paths: Iterable<string>, additive = false, base?: Set<string>) => {
    const next = additive ? new Set<string>(base ?? []) : new Set<string>();
    for (const p of paths) next.add(p);
    setSelectedFiles(next);
  };

  const selectAll = () => {
    setSelectedFiles(new Set<string>(files().map((f) => f.path)));
  };

  const clearSelection = () => {
    setSelectedFiles(new Set<string>());
  };

  const setFilesDirect = (newFiles: FileInfo[]) => {
    setFiles(newFiles);
  };

  const setTotalDirect = (total: number) => {
    setTotalFiles(total);
  };

  const updateRating = async (filePath: string, rating: number) => {
    const libId = activeLibraryId();
    if (!libId) return;
    await api.updateFileRating(libId, filePath, rating);
    setFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, rating } : f))
    );
  };

  /** Reflect the active library's file count in the sidebar (instant UI). */
  const syncLibraryCount = (count: number) => {
    const id = activeLibraryId();
    if (!id) return;
    setLibraries((prev) => prev.map((l) => (l.id === id ? { ...l, file_count: count } : l)));
  };

  const deleteFile = async (filePath: string) => {
    const libId = activeLibraryId();
    if (!libId) return;
    await api.deleteFile(libId, filePath);
    setFiles((prev) => prev.filter((f) => f.path !== filePath));
    setTotalFiles((p) => p - 1);
    syncLibraryCount(totalFiles() - 1);
  };

  /** Move files to trash (soft-delete). Accepts explicit paths or the current selection. */
  const trashFiles = async (paths?: string[]) => {
    const libId = activeLibraryId();
    if (!libId) return;
    const targets = paths && paths.length > 0 ? paths : [...selectedFiles()];
    if (targets.length === 0) return;
    await api.trashFiles(libId, targets);
    const targetSet = new Set(targets);
    setFiles((prev) => prev.filter((f) => !targetSet.has(f.path)));
    const newTotal = totalFiles() - targets.length;
    setTotalFiles(newTotal);
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const p of targets) next.delete(p);
      return next;
    });
    syncLibraryCount(newTotal);
  };

  /** Load the trash contents of the active library. */
  const loadDeletedFiles = async () => {
    const libId = activeLibraryId();
    if (!libId) return;
    const result = await api.getDeletedFiles(libId);
    setDeletedFiles(result);
  };

  /** Restore a file from trash back into the library. */
  const restoreFile = async (filePath: string) => {
    const libId = activeLibraryId();
    if (!libId) return;
    await api.restoreFile(libId, filePath);
    setDeletedFiles((prev) => prev.filter((f) => f.path !== filePath));
    syncLibraryCount(totalFiles() + 1);
  };

  /** Permanently delete a file from trash. */
  const purgeFile = async (filePath: string) => {
    const libId = activeLibraryId();
    if (!libId) return;
    await api.purgeFile(libId, filePath);
    setDeletedFiles((prev) => prev.filter((f) => f.path !== filePath));
    // Purging an already-deleted file doesn't change the active file count.
  };

  /** Permanently delete everything in the trash. */
  const emptyTrash = async () => {
    const libId = activeLibraryId();
    if (!libId) return;
    await api.emptyTrash(libId);
    setDeletedFiles([]);
    // Emptying the trash doesn't change the active file count, but re-sync
    // to be safe against any drift.
    syncLibraryCount(totalFiles());
  };

  /** Update a single file's metadata in the local list (for instant UI feedback). */
  const updateFileTags = async (filePath: string) => {
    const libId = activeLibraryId();
    if (!libId) return;
    try {
      const info = await api.getFileInfo(libId, filePath);
      setFiles((prev) => prev.map((f) => (f.path === filePath ? { ...f, tags: info.tags } : f)));
    } catch {
      // ignore
    }
  };

  return {
    files,
    totalFiles,
    selectedFiles,
    currentSort,
    filterExt,
    filterTag,
    isLoading,
    deletedFiles,
    loadFiles,
    toggleSelect,
    setSelection,
    selectAll,
    clearSelection,
    updateRating,
    deleteFile,
    trashFiles,
    loadDeletedFiles,
    restoreFile,
    purgeFile,
    emptyTrash,
    updateFileTags,
    setCurrentSort,
    setFilterExt,
    setFilterTag,
    setFiles: setFilesDirect,
    setTotalFiles: setTotalDirect,
  };
}

export { files, totalFiles, selectedFiles, isLoading, deletedFiles };