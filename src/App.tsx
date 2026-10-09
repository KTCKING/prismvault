import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { useLibraryStore } from "@/stores/library";
import { useFilesStore } from "@/stores/files";
import { useTagsStore } from "@/stores/tags";
import { useUIStore } from "@/stores/ui";
import { useTheme } from "@/stores/theme";
import { Sidebar } from "@/components/Sidebar";
import { ThumbnailGrid } from "@/components/ThumbnailGrid";
import { StatusBar } from "@/components/StatusBar";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { InfoPanel } from "@/components/InfoPanel";
import { SearchBar } from "@/components/SearchBar";
import { ImageViewer } from "@/components/ImageViewer";
import { IndexingDialog } from "@/components/IndexingDialog";
import { SettingsModal } from "@/components/SettingsModal";
import { ContextMenu } from "@/components/ContextMenu";
import { ToastHost } from "@/components/Toast";
import { DialogHost } from "@/components/Dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "@/lib/tauri-api";
import { useViewerStore } from "@/stores/viewer";

export default function App() {
  const library = useLibraryStore();
  const files = useFilesStore();
  const tags = useTagsStore();
  const ui = useUIStore();
  const theme = useTheme();

  const viewer = useViewerStore();

  const [dragOver, setDragOver] = createSignal(false);

  onMount(async () => {
    // Watchdog: force-clear loading after 3s even if restore hangs
    const watchdog = setTimeout(() => {
      library.setIsRestoring(false);
    }, 3000);

    // Restore previously opened libraries
    try {
      const saved = await api.restoreLibraries();
      library.setRestoredLibraries(saved.libraries);
      
      if (saved.libraries.length === 1) {
        // Single library: auto-open it
        library.setLibraries(saved.libraries);
        library.setActiveLibraryId(saved.libraries[0].id);
        files.loadFiles(0);
        tags.loadTags();
      } else if (saved.libraries.length > 1) {
        // Multiple libraries: show picker
        library.setLibraries(saved.libraries);
        library.setShowLibraryPicker(true);
      }
      // 0 libraries: stays on welcome screen (no action needed)
    } catch (e) {
      console.error("Failed to restore libraries:", e);
    }
    library.setIsRestoring(false);
    clearTimeout(watchdog);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle app shortcuts when viewer is open (viewer handles its own keys)
      if (viewer.viewerOpen()) return;
      if (e.ctrlKey && e.key === "f") {
        e.preventDefault();
        ui.setShowSearch(true);
      }
      if (e.key === "Escape") {
        files.clearSelection();
        ui.setShowSearch(false);
        ui.setInfoPanelOpen(false);
      }
      if (e.key === "F5") {
        e.preventDefault();
        files.loadFiles(0);
      }
      if (e.key === "Delete" && files.selectedFiles().size > 0) {
        files.trashFiles();
        files.clearSelection();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    // Only folders should open a library. Image files can land here when a
    // card is dragged back over the window during an OS drag — ignore those.
    const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|tiff?|avif|svg|psd|raw|cr2|nef|arw|dng|heic|ico)$/i;

    const unlisten = await getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        setDragOver(true);
      } else if (event.payload.type === "leave") {
        setDragOver(false);
      } else if (event.payload.type === "drop") {
        setDragOver(false);
        const paths = event.payload.paths;
        if (paths.length > 0 && !IMAGE_EXT.test(paths[0])) {
          library.openLibrary(paths[0]).then(() => {
            files.loadFiles(0);
            tags.loadTags();
          });
        }
      }
    });

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      unlisten();
    });
  });

  const headerBg = "var(--bg-secondary)";
  const borderColor = "var(--border-color)";

  return (
    <div class="flex flex-col h-full" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Title Bar */}
      <header class="app-header flex items-center gap-3 px-4 py-2">
        <div class="flex items-center gap-2">
          <svg class="w-6 h-6" style={{ color: "var(--accent)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span class="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>PrismVault</span>
        </div>

        <Show when={library.activeLibrary()}>
          <span class="text-xs" style={{ color: "var(--text-muted)" }}>
            {library.activeLibrary()?.name}
          </span>
          <Show when={library.nasStatus()}>
            <span class="text-xs ml-2">
              {library.nasStatus()?.status === "local" && "💻"}
              {library.nasStatus()?.status === "online" && "🟢"}
              {library.nasStatus()?.status === "degraded" && "🟡"}
              {library.nasStatus()?.status === "offline" && "🔴"}
            </span>
          </Show>
        </Show>

        <div class="flex-1" />

        <SearchBar />

        {/* Theme Toggle */}
        <button
          class="btn-ghost text-xs px-2"
          onClick={theme.toggle}
          title={theme.theme() === "light" ? "切换到深色模式" : "切换到浅色模式"}
        >
          {theme.theme() === "light" ? "🌙" : "☀️"}
        </button>

        <button
          class="btn-ghost text-xs"
          onClick={() => ui.setSidebarOpen(!ui.sidebarOpen())}
        >
          {ui.sidebarOpen() ? "◀" : "▶"}
        </button>

        <button
          class="btn-ghost text-xs px-2"
          onClick={() => ui.setShowSettings(true)}
          title="设置"
        >
          ⚙
        </button>
      </header>

      {/* Main Content */}
      <div class="flex flex-1 overflow-hidden">
        <Show when={!library.isRestoring()} fallback={
          <div class="flex-1 flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
            <div class="text-center">
              <div class="text-3xl mb-3">⏳</div>
              <p class="text-sm" style={{ color: "var(--text-muted)" }}>正在加载...</p>
            </div>
          </div>
        }>
          <Show when={library.activeLibrary()} fallback={<WelcomeScreen onOpen={library.openLibrary} isIndexing={library.isIndexing()} />}>
          <Show when={ui.sidebarOpen()}>
            <Sidebar />
          </Show>

          <div class="flex-1 flex flex-col overflow-hidden">
            <ThumbnailGrid />
          </div>

          <Show when={ui.infoPanelOpen() && ui.infoPanelFile()}>
            <InfoPanel
              filePath={ui.infoPanelFile()!}
              onClose={() => {
                ui.setInfoPanelOpen(false);
                ui.setInfoPanelFile(null);
              }}
            />
          </Show>
        </Show>
        </Show>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Drag Overlay */}
      <Show when={dragOver()}>
        <div class="drop-zone">
          <div class="text-center">
            <div class="text-4xl mb-3">📁</div>
            <p class="text-lg font-medium" style={{ color: "var(--text-primary)" }}>拖放文件夹以打开图片库</p>
            <p class="text-sm mt-1" style={{ color: "var(--text-muted)" }}>支持本地文件夹和网络路径 (SMB)</p>
          </div>
        </div>
      </Show>

      {/* Image Viewer */}
      <ImageViewer />

      {/* Global context menu */}
      <ContextMenu />

      {/* Transient toasts (copy / trash feedback) */}
      <ToastHost />

      {/* In-app confirm / prompt dialog (window.confirm is unreliable here) */}
      <DialogHost />

      {/* Settings */}
      <Show when={ui.showSettings()}>
        <SettingsModal
          onClose={() => ui.setShowSettings(false)}
          onImported={() => {
            files.loadFiles(0);
            tags.loadTags();
          }}
        />
      </Show>

      {/* Indexing Progress & Completion */}
      <IndexingDialog />

      {/* Library picker dialog (multiple libraries available) */}
      <Show when={library.showLibraryPicker()}>
        <div class="fixed inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div class="rounded-xl p-6 w-96 shadow-2xl animate-scale-in" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <h2 class="text-lg font-semibold mb-4 text-center" style={{ color: "var(--text-primary)" }}>选择要打开的库</h2>
            <div class="flex flex-col gap-2 mb-4 max-h-60 overflow-y-auto">
              {library.restoredLibraries().map((lib) => (
                <button
                  class="text-left px-4 py-3 rounded-lg transition-colors w-full"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
                  onClick={() => {
                    library.setActiveLibraryId(lib.id);
                    library.setShowLibraryPicker(false);
                    files.loadFiles(0);
                    tags.loadTags();
                  }}
                >
                  <div class="text-sm font-medium truncate">{lib.name}</div>
                  <div class="text-2xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                    {lib.is_network ? "🌐 " : "💻 "}{lib.root_path} · {lib.file_count} 个文件
                  </div>
                </button>
              ))}
            </div>
            <button class="btn-secondary text-sm w-full" onClick={() => {
              library.setShowLibraryPicker(false);
            }}>
              取消
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}