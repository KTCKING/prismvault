/**
 * Tauri API abstraction layer
 * Uses Tauri invoke when running inside Tauri, falls back to mock data for dev.
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";

// Detect if running inside Tauri
const isTauri = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    return tauriInvoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args);
}

// ── Mock Data ────────────────────────────────────

const mockFiles: FileInfo[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  path: `C:\\Photos\\IMG_${String(i + 1).padStart(4, "0")}.jpg`,
  filename: `IMG_${String(i + 1).padStart(4, "0")}.jpg`,
  extension: "jpg",
  size_bytes: Math.floor(Math.random() * 10_000_000) + 500_000,
  width: Math.random() > 0.3 ? 4000 + Math.floor(Math.random() * 2000) : null,
  height: Math.random() > 0.3 ? 3000 + Math.floor(Math.random() * 1500) : null,
  rating: Math.random() > 0.6 ? Math.floor(Math.random() * 5) + 1 : null,
  color_label: null,
  notes: null,
  mtime: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 3600 * 1000)).toISOString(),
  tags: [],
}));

const mockTags: Tag[] = [
  { id: 1, name: "风景", parent_id: null, color: "#4c6ef5", icon: null },
  { id: 2, name: "人像", parent_id: null, color: "#e64980", icon: null },
  { id: 3, name: "界面设计", parent_id: null, color: "#12b886", icon: null },
  { id: 4, name: "参考素材", parent_id: null, color: "#fab005", icon: null },
  { id: 5, name: "Logo", parent_id: null, color: "#7950f2", icon: null },
];

// ── Mock Implementation ──────────────────────────

async function mockInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));

  switch (cmd) {
    case "open_library": {
      return {
        library: {
          id: "mock-lib-1",
          name: "示例图库",
          root_path: args?.path || "C:\\Photos",
          is_network: false,
          file_count: 50,
          thumbnail_cache_size: 0,
        },
        initial_file_count: 50,
      } as unknown as T;
    }

    case "create_library": {
      const name = (args?.name as string) || "新建图库";
      return {
        library: {
          id: "mock-lib-new",
          name,
          root_path: `${args?.parentDir || "C:\\Photos"}\\${name}`,
          is_network: false,
          file_count: 0,
          thumbnail_cache_size: 0,
        },
        initial_file_count: 0,
      } as unknown as T;
    }

    case "get_libraries": {
      return [] as unknown as T;
    }

    case "get_files": {
      const offset = (args?.offset as number) || 0;
      const limit = (args?.limit as number) || 50;
      return {
        files: mockFiles.slice(offset, offset + limit),
        total: mockFiles.length,
        offset,
        limit,
      } as unknown as T;
    }

    case "get_file_info": {
      const path = args?.file_path as string;
      const file = mockFiles.find((f) => f.path === path) || mockFiles[0];
      return file as unknown as T;
    }

    case "update_file_rating":
    case "update_file_notes":
    case "delete_file":
      return null as unknown as T;

    case "get_thumbnail_path": {
      return "/placeholder.svg" as unknown as T;
    }

    case "get_all_tags": {
      return mockTags as unknown as T;
    }

    case "create_tag": {
      return {
        id: mockTags.length + 1,
        name: args?.name as string,
        parent_id: args?.parent_id || null,
        color: args?.color || null,
        icon: null,
      } as unknown as T;
    }

    case "add_tag_to_file":
    case "remove_tag_from_file":
    case "batch_add_tags":
      return null as unknown as T;

    case "search_files": {
      return {
        files: mockFiles.slice(0, 20),
        total: 20,
        query_time_ms: 5,
      } as unknown as T;
    }

    case "find_duplicates": {
      return [] as unknown as T;
    }

    case "get_nas_status": {
      return { status: "local", latency_ms: 0 } as unknown as T;
    }

    case "index_library": {
      return { total: 50, processed: 50, stage: "complete" } as unknown as T;
    }

    case "reorder_libraries":
      return null as unknown as T;

    case "detect_library_kind":
      return "unknown" as unknown as T;

    case "import_eagle_library":
    case "import_pixcall_library":
      return {
        kind: "eagle",
        detected: true,
        total_items: 0,
        imported_files: 0,
        created_tags: 0,
        errors: [],
        library: {
          id: "mock-lib-2",
          name: "导入的库",
          root_path: "C:\\Imported",
          is_network: false,
          file_count: 0,
          thumbnail_cache_size: 0,
        },
      } as unknown as T;

    case "get_deleted_files":
      return [] as unknown as T;

    case "trash_files":
      return 0 as unknown as T;

    case "restore_file":
    case "purge_file":
      return null as unknown as T;

    case "empty_trash":
      return 0 as unknown as T;

    default:
      console.warn(`Mock: unknown command "${cmd}"`);
      return null as unknown as T;
  }
}

// ── Exported Types ───────────────────────────────

export interface FileInfo {
  id: number;
  path: string;
  filename: string;
  extension: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  rating: number | null;
  color_label: string | null;
  notes: string | null;
  mtime: string;
  tags: Tag[];
}

export interface Tag {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  icon: string | null;
}

export interface LibraryInfo {
  id: string;
  name: string;
  root_path: string;
  is_network: boolean;
  file_count: number;
  thumbnail_cache_size: number;
}

export interface PaginatedFiles {
  files: FileInfo[];
  total: number;
  offset: number;
  limit: number;
}

export interface NasStatus {
  status: "local" | "online" | "degraded" | "offline";
  latency_ms: number;
}

export interface ImportSummary {
  kind: string;
  detected: boolean;
  total_items: number;
  imported_files: number;
  created_tags: number;
  errors: string[];
  library: LibraryInfo;
}

export interface SearchResult {
  files: FileInfo[];
  total: number;
  query_time_ms: number;
}

export interface DuplicateGroup {
  hash: string;
  file_count: number;
  wasted_bytes: number;
  match_type: "exact" | "perceptual";
  files: FileInfo[];
}

// ── API Functions ────────────────────────────────

export const api = {
  // Library
  openLibrary: (path: string) =>
    invoke<{ library: LibraryInfo; initial_file_count: number }>("open_library", { path }),

  createLibrary: (parentDir: string, name: string) =>
    invoke<{ library: LibraryInfo; initial_file_count: number }>("create_library", { parentDir, name }),

  closeLibrary: (id: string) =>
    invoke<void>("close_library", { id }),

  renameLibrary: (id: string, newName: string) =>
    invoke<void>("rename_library", { id, newName }),

  deleteLibrary: (id: string, deleteFiles: boolean) =>
    invoke<void>("delete_library", { id, deleteFiles }),

  getLibraries: () =>
    invoke<LibraryInfo[]>("get_libraries"),

  indexLibrary: (libraryId: string) =>
    invoke<{ total: number; processed: number; stage: string }>("index_library", { libraryId }),

  getNasStatus: (libraryId: string) =>
    invoke<NasStatus>("get_nas_status", { libraryId }),

  // Files
  getFiles: (
    libraryId: string,
    offset: number,
    limit: number,
    sortBy = "mtime",
    sortOrder = "DESC",
    filterExt?: string,
    filterTag?: number
  ) =>
    invoke<PaginatedFiles>("get_files", {
      libraryId,
      offset,
      limit,
      sortBy,
      sortOrder,
      filterExt,
      filterTag,
    }),

  getFileInfo: (libraryId: string, filePath: string) =>
    invoke<FileInfo>("get_file_info", { libraryId, filePath }),

  updateFileRating: (libraryId: string, filePath: string, rating: number) =>
    invoke<void>("update_file_rating", { libraryId, filePath, rating }),

  updateFileNotes: (libraryId: string, filePath: string, notes: string) =>
    invoke<void>("update_file_notes", { libraryId, filePath, notes }),

  deleteFile: (libraryId: string, filePath: string) =>
    invoke<void>("delete_file", { libraryId, filePath }),

  trashFiles: (libraryId: string, filePaths: string[]) =>
    invoke<number>("trash_files", { libraryId, filePaths }),

  getDeletedFiles: (libraryId: string) =>
    invoke<FileInfo[]>("get_deleted_files", { libraryId }),

  restoreFile: (libraryId: string, filePath: string) =>
    invoke<void>("restore_file", { libraryId, filePath }),

  purgeFile: (libraryId: string, filePath: string) =>
    invoke<void>("purge_file", { libraryId, filePath }),

  emptyTrash: (libraryId: string) =>
    invoke<number>("empty_trash", { libraryId }),

  getThumbnailPath: (libraryId: string, filePath: string) =>
    invoke<string>("get_thumbnail_path", { libraryId, filePath }),

  openInExplorer: (filePath: string) =>
    invoke<void>("open_in_explorer", { filePath }),

  openFile: (filePath: string) =>
    invoke<void>("open_file", { filePath }),

  copyFilesToClipboard: (filePaths: string[]) =>
    invoke<number>("copy_files_to_clipboard", { filePaths }),

  // Tags
  getAllTags: (libraryId: string) =>
    invoke<Tag[]>("get_all_tags", { libraryId }),

  createTag: (libraryId: string, name: string, parentId?: number, color?: string) =>
    invoke<Tag>("create_tag", { libraryId, name, parentId, color }),

  addTagToFile: (libraryId: string, filePath: string, tagId: number) =>
    invoke<void>("add_tag_to_file", { libraryId, filePath, tagId }),

  removeTagFromFile: (libraryId: string, filePath: string, tagId: number) =>
    invoke<void>("remove_tag_from_file", { libraryId, filePath, tagId }),

  batchAddTags: (libraryId: string, filePaths: string[], tagIds: number[]) =>
    invoke<string[]>("batch_add_tags", { libraryId, filePaths, tagIds }),

  // Search
  searchFiles: (libraryId: string, params: { text?: string }) =>
    invoke<SearchResult>("search_files", { libraryId, text: params.text || null }),

  // Persist the display order of the opened libraries
  reorderLibraries: (ids: string[]) =>
    invoke<void>("reorder_libraries", { ids }),

  // Third-party library import
  detectLibraryKind: (path: string) =>
    invoke<string>("detect_library_kind", { path }),

  importEagleLibrary: (sourcePath: string) =>
    invoke<ImportSummary>("import_eagle_library", { sourcePath }),

  importPixcallLibrary: (sourcePath: string) =>
    invoke<ImportSummary>("import_pixcall_library", { sourcePath }),

  // Restore
  restoreLibraries: () =>
    invoke<{ libraries: LibraryInfo[]; failed_paths: string[] }>("restore_libraries"),

  searchByColor: (libraryId: string, colorHex: string) =>
    invoke<FileInfo[]>("search_by_color", { libraryId, colorHex }),

  findDuplicates: (libraryId: string) =>
    invoke<DuplicateGroup[]>("find_duplicates", { libraryId }),
};