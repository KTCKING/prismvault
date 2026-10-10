import { createSignal, createEffect, Show, onMount, onCleanup } from "solid-js";
import type { FileInfo } from "@/lib/tauri-api";
import { convertFileSrc } from "@tauri-apps/api/core";

interface Props {
  file: FileInfo;
  thumbnailUrl?: string;
  isSelected: boolean;
  size: number;
  onSelect: (multi: boolean) => void;
  onRatingChange: (rating: number) => void;
  onOpen: () => void;
  onVisible: () => void;
  onDoubleClick: () => void;
  onContextMenu?: (e: MouseEvent, path: string) => void;
}

export function ThumbnailCard(props: Props) {
  const [showRating, setShowRating] = createSignal(false);
  const [imgLoaded, setImgLoaded] = createSignal(false);
  const [imgError, setImgError] = createSignal(false);
  // The image the <img> currently points at. Starts on the thumbnail (or the
  // original file when no thumbnail is ready yet) and degrades to the original
  // file if the thumbnail cannot be loaded (missing / undecodable format).
  const [imgSrc, setImgSrc] = createSignal("");

  let rootRef!: HTMLDivElement;

  const originalSrc = () => convertFileSrc(props.file.path);
  const preferredSrc = () => {
    const url = props.thumbnailUrl;
    return url && url !== "/placeholder.svg" ? convertFileSrc(url) : originalSrc();
  };

  createEffect(() => {
    setImgSrc(preferredSrc());
    setImgError(false);
    setImgLoaded(false);
  });

  onMount(() => {
    // Load the thumbnail lazily once the card scrolls into view. Previously
    // only the first 30 cards ever requested one, so everything further down
    // fell back to decoding the full-size original image.
    if (typeof IntersectionObserver === "undefined") {
      props.onVisible();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          props.onVisible();
          io.disconnect();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(rootRef);
    onCleanup(() => io.disconnect());
  });

  const handleImgError = () => {
    const orig = originalSrc();
    if (imgSrc() !== orig) {
      // Thumbnail failed to load -> fall back to the original file.
      setImgSrc(orig);
      setImgLoaded(false);
    } else {
      setImgError(true);
    }
  };

  const handleClick = (e: MouseEvent) => {
    props.onSelect(e.ctrlKey || e.metaKey);
    // Single click opens info panel
    props.onOpen();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div ref={rootRef} class="thumbnail-card" classList={{ selected: props.isSelected }}
      data-path={props.file.path}
      style={{ height: `${props.size + 40}px` }}
      onClick={handleClick}
      onContextMenu={(e) => props.onContextMenu?.(e, props.file.path)}
      onDblClick={(e) => { e.preventDefault(); props.onDoubleClick(); }}
      onMouseEnter={() => setShowRating(true)}
      onMouseLeave={() => setShowRating(false)}>

      <div class="relative overflow-hidden" style={{ background: "var(--bg-tertiary)", height: `${props.size}px` }}>
        <Show when={!imgError()}>
          <img src={imgSrc()} alt={props.file.filename}
            class="w-full h-full object-cover transition-opacity duration-200"
            classList={{ "opacity-0": !imgLoaded(), "opacity-100": imgLoaded() }}
            draggable={false}
            onLoad={() => setImgLoaded(true)} onError={handleImgError} loading="lazy" />
        </Show>
        <Show when={!imgLoaded() && !imgError()}>
          <div class="absolute inset-0 skeleton" />
        </Show>
        <Show when={imgError()}>
          <div class="absolute inset-0 flex items-center justify-center" style={{ background: "var(--bg-tertiary)" }}>
            <span class="text-2xl" style={{ color: "var(--text-muted)" }}>🖼️</span>
          </div>
        </Show>

        <div class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-2xs uppercase"
          style={{ background: "rgba(0,0,0,0.5)", color: "#ccc" }}>
          {props.file.extension}
        </div>

        <Show when={showRating() || props.file.rating}>
          <div class="thumbnail-actions">
            {[1, 2, 3, 4, 5].map((star) => (
              <button class="text-xs transition-colors"
                style={{ color: (props.file.rating || 0) >= star ? "var(--star-color)" : "rgba(255,255,255,0.5)" }}
                onClick={(e) => { e.stopPropagation(); props.onRatingChange((props.file.rating || 0) >= star ? 0 : star); }}>
                ★
              </button>
            ))}
          </div>
        </Show>
      </div>

      <div class="p-1.5 text-2xs">
        <div class="truncate font-medium" style={{ color: "var(--text-primary)" }} title={props.file.filename}>
          {props.file.filename}
        </div>
        <div class="flex items-center justify-between mt-0.5" style={{ color: "var(--text-muted)" }}>
          <span>{props.file.width && props.file.height ? `${props.file.width}×${props.file.height}` : formatSize(props.file.size_bytes)}</span>
          <Show when={props.file.tags.length > 0}>
            <div class="flex gap-0.5">
              {props.file.tags.slice(0, 3).map((tag) => (
                <span class="w-1.5 h-1.5 rounded-full" style={{ background: tag.color || "var(--text-muted)" }} title={tag.name} />
              ))}
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}