use tauri::State;
use crate::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileInfo {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub size_bytes: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub rating: Option<i32>,
    pub color_label: Option<String>,
    pub notes: Option<String>,
    pub mtime: String,
    pub tags: Vec<crate::engine::db::Tag>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedFiles {
    pub files: Vec<FileInfo>,
    pub total: i64,
    pub offset: i64,
    pub limit: i64,
}

#[tauri::command]
pub async fn get_files(
    library_id: String,
    offset: i64,
    limit: i64,
    sort_by: String,
    sort_order: String,
    filter_ext: Option<String>,
    filter_tag: Option<i64>,
    state: State<'_, AppState>,
) -> Result<PaginatedFiles, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();

    let entries = lib.db.get_files_paginated(
        offset, limit, &sort_by, &sort_order,
        filter_ext.as_deref(), filter_tag,
    ).map_err(|e| e.to_string())?;

    // Filter out .prism metadata files
    let entries: Vec<_> = entries.into_iter()
        .filter(|e| !e.path.contains("/.prism/") && !e.path.contains("\\.prism\\") && !e.path.contains("/.prism") && !e.path.contains("\\.prism"))
        .collect();

    let total = lib.db.count_files(filter_ext.as_deref(), filter_tag)
        .map_err(|e| e.to_string())?;

    let files: Vec<FileInfo> = entries.into_iter().map(|e| {
        let tags = lib.db.get_file_tags(e.id).unwrap_or_default();
        FileInfo {
            id: e.id, path: e.path, filename: e.filename, extension: e.extension,
            size_bytes: e.size_bytes, width: e.width, height: e.height,
            rating: e.rating, color_label: e.color_label, notes: e.notes,
            mtime: e.mtime, tags,
        }
    }).collect();

    Ok(PaginatedFiles { files, total, offset, limit })
}

#[tauri::command]
pub async fn get_file_info(
    library_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<FileInfo, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();

    let entry = lib.db.get_file_by_path(&file_path)
        .map_err(|e| e.to_string())?
        .ok_or("未找到文件")?;
    let tags = lib.db.get_file_tags(entry.id).unwrap_or_default();

    Ok(FileInfo {
        id: entry.id, path: entry.path, filename: entry.filename, extension: entry.extension,
        size_bytes: entry.size_bytes, width: entry.width, height: entry.height,
        rating: entry.rating, color_label: entry.color_label, notes: entry.notes,
        mtime: entry.mtime, tags,
    })
}

#[tauri::command]
pub async fn update_file_rating(
    library_id: String,
    file_path: String,
    rating: i32,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.update_file_rating(&file_path, rating).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_file_notes(
    library_id: String,
    file_path: String,
    notes: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.update_file_notes(&file_path, &notes).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_file(
    library_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.soft_delete_file(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn trash_files(
    library_id: String,
    file_paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    let mut n = 0;
    for p in &file_paths {
        lib.db.soft_delete_file(p).map_err(|e| e.to_string())?;
        n += 1;
    }
    Ok(n)
}

#[tauri::command]
pub async fn get_deleted_files(
    library_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<FileInfo>, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();

    let entries = lib.db.get_deleted_files().map_err(|e| e.to_string())?;
    let files: Vec<FileInfo> = entries.into_iter().map(|e| {
        let tags = lib.db.get_file_tags(e.id).unwrap_or_default();
        FileInfo {
            id: e.id, path: e.path, filename: e.filename, extension: e.extension,
            size_bytes: e.size_bytes, width: e.width, height: e.height,
            rating: e.rating, color_label: e.color_label, notes: e.notes,
            mtime: e.mtime, tags,
        }
    }).collect();
    Ok(files)
}

#[tauri::command]
pub async fn restore_file(
    library_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.restore_file(&file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn purge_file(
    library_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.purge_file(&file_path).map_err(|e| e.to_string())
}

/// Permanently delete every file in the trash (empty the trash).
#[tauri::command]
pub async fn empty_trash(
    library_id: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();
    lib.db.purge_all_deleted().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_thumbnail_path(
    library_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let mut lib = lib.lock().unwrap();

    let entry = lib.db.get_file_by_path(&file_path)
        .map_err(|e| e.to_string())?
        .ok_or("未找到文件")?;

    // Use path-based hash for fast thumbnail identification
    let hash = entry.blake3_hash.unwrap_or_else(|| {
        crate::utils::hash::blake3_hash_bytes(file_path.as_bytes())
    });

    let thumb_path = lib.thumbnail.thumbnail_path(&hash, 512);

    // Generate the thumbnail on the fly when it is missing. If generation
    // fails — e.g. the decoder cannot handle the format (HEIC / RAW are common
    // on macOS) — fall back to returning the ORIGINAL file path so the WebView
    // can still render it with its own decoder instead of showing a blank card.
    if !thumb_path.exists() {
        let source = std::path::Path::new(&file_path);
        if lib.thumbnail.generate(source, &hash).is_err() || !thumb_path.exists() {
            return Ok(file_path);
        }
    }

    Ok(thumb_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_in_explorer(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let path = std::path::Path::new(&file_path);
        std::process::Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        // `open -R` reveals the file in Finder.
        std::process::Command::new("open")
            .arg("-R")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn open_file(file_path: String) -> Result<(), String> {
    opener::open(&file_path).map_err(|e| e.to_string())
}

/// Copy image files to the OS clipboard as files so they can be pasted into
/// Explorer / QQ / WeChat etc. On Windows we shell out to PowerShell's
/// Set-Clipboard (avoids pulling in a heavy clipboard crate).
#[tauri::command]
pub async fn copy_files_to_clipboard(file_paths: Vec<String>) -> Result<usize, String> {
    if file_paths.is_empty() {
        return Ok(0);
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // Join paths with commas; PowerShell treats a comma-separated list of
        // file paths as a file-collection clipboard payload.
        let list = file_paths
            .iter()
            .map(|p| format!("'{}'", p.replace('\'', "''")))
            .collect::<Vec<_>>()
            .join(", ");
        let script = format!("Set-Clipboard -Path {}", list);
        // `CREATE_NO_WINDOW` + `-WindowStyle Hidden` keep this fully silent so
        // no console flashes when copying.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let status = std::process::Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .status()
            .map_err(|e| format!("启动 PowerShell 失败: {e}"))?;
        if !status.success() {
            return Err("复制到剪贴板失败".to_string());
        }
    }

    #[cfg(target_os = "macos")]
    {
        // Put real file references on the macOS pasteboard so they can be
        // pasted into Finder / Mail / other apps. `POSIX file` yields an
        // alias/file object; a list of them works for multi-selection.
        let alias_list = file_paths
            .iter()
            .map(|p| format!("(POSIX file \"{}\")", p.replace('\\', "\\\\").replace('"', "\\\"")))
            .collect::<Vec<_>>()
            .join(", ");
        let script = format!("set the clipboard to {{{}}}", alias_list);
        let status = std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .status()
            .map_err(|e| format!("启动 osascript 失败: {e}"))?;
        if !status.success() {
            return Err("复制到剪贴板失败".to_string());
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Linux: no portable way to copy *files* to the clipboard without an
        // extra crate, so report unsupported.
        return Err("当前平台暂不支持复制图片到剪贴板".to_string());
    }

    Ok(file_paths.len())
}