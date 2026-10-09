use tauri::State;
use tauri::Emitter;
use crate::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryInfo {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub is_network: bool,
    pub file_count: i64,
    pub thumbnail_cache_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenLibraryResult {
    pub library: LibraryInfo,
    pub initial_file_count: i64,
}

#[tauri::command]
pub async fn open_library(
    path: String,
    state: State<'_, AppState>,
) -> Result<OpenLibraryResult, String> {
    let root_path = std::path::PathBuf::from(&path);
    if !root_path.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    let mut engine = state.engine.lock().unwrap();
    let id = engine.open_library(&root_path)?;
    save_libraries_config(&engine);

    let lib = engine.get_library(&id).ok_or("打开后未找到图库")?;
    let lib = lib.lock().unwrap();

    let file_count = lib.db.count_files(None, None).unwrap_or(0);
    let cache_size = lib.thumbnail.cache_size();

    Ok(OpenLibraryResult {
        library: LibraryInfo {
            id: lib.id.clone(),
            name: lib.name.clone(),
            root_path: lib.root_path.to_string_lossy().to_string(),
            is_network: lib.is_network,
            file_count,
            thumbnail_cache_size: cache_size,
        },
        initial_file_count: file_count,
    })
}

/// Create a brand-new library: makes a folder named `name` inside `parent_dir`
/// and opens it as a library.
#[tauri::command]
pub async fn create_library(
    parent_dir: String,
    name: String,
    state: State<'_, AppState>,
) -> Result<OpenLibraryResult, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("库名称不能为空".to_string());
    }
    if name
        .chars()
        .any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("库名称不能包含 \\ / : * ? \" < > | 等字符".to_string());
    }

    let parent = std::path::PathBuf::from(&parent_dir);
    if !parent.exists() {
        return Err(format!("所选文件夹不存在: {}", parent_dir));
    }
    if !parent.is_dir() {
        return Err("所选路径不是文件夹".to_string());
    }

    let root_path = parent.join(&name);
    std::fs::create_dir_all(&root_path).map_err(|e| format!("创建文件夹失败: {e}"))?;

    let mut engine = state.engine.lock().unwrap();
    let id = engine.open_library(&root_path)?;
    save_libraries_config(&engine);

    let lib = engine.get_library(&id).ok_or("创建后未找到图库")?;
    let lib = lib.lock().unwrap();

    let file_count = lib.db.count_files(None, None).unwrap_or(0);
    let cache_size = lib.thumbnail.cache_size();

    Ok(OpenLibraryResult {
        library: LibraryInfo {
            id: lib.id.clone(),
            name: lib.name.clone(),
            root_path: lib.root_path.to_string_lossy().to_string(),
            is_network: lib.is_network,
            file_count,
            thumbnail_cache_size: cache_size,
        },
        initial_file_count: file_count,
    })
}

#[tauri::command]
pub async fn close_library(
    id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut engine = state.engine.lock().unwrap();
    engine.close_library(&id);
    save_libraries_config(&engine);
    Ok(())
}

/// Rename a library (updates the in-memory display name; the on-disk folder
/// name is intentionally left untouched).
#[tauri::command]
pub async fn rename_library(
    id: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let name = new_name.trim().to_string();
    if name.is_empty() {
        return Err("库名称不能为空".to_string());
    }
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&id).ok_or("未找到图库")?;
    let mut lib = lib.lock().unwrap();
    lib.name = name;
    drop(lib);
    save_libraries_config(&engine);
    Ok(())
}

/// Permanently delete a library. When `delete_files` is true the on-disk files
/// (and the `.prism` metadata folder) are also removed from disk. When false
/// the library is only closed and forgotten by the app.
#[tauri::command]
pub async fn delete_library(
    id: String,
    delete_files: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let root_path = {
        let mut engine = state.engine.lock().unwrap();
        let lib = engine.get_library(&id).ok_or("未找到图库")?;
        let root = lib.lock().unwrap().root_path.clone();
        engine.close_library(&id);
        save_libraries_config(&engine);
        root
    };

    if delete_files {
        if root_path.exists() {
            std::fs::remove_dir_all(&root_path)
                .map_err(|e| format!("删除文件夹失败: {e}"))?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_libraries(
    state: State<'_, AppState>,
) -> Result<Vec<LibraryInfo>, String> {
    let engine = state.engine.lock().unwrap();
    let mut libraries = Vec::new();

    // Iterate in the persisted user-defined order, not HashMap order.
    for id in engine.ordered_ids() {
        let Some(lib) = engine.libraries.get(&id) else { continue };
        let lib = lib.lock().unwrap();
        let file_count = lib.db.count_files(None, None).unwrap_or(0);
        libraries.push(LibraryInfo {
            id: lib.id.clone(),
            name: lib.name.clone(),
            root_path: lib.root_path.to_string_lossy().to_string(),
            is_network: lib.is_network,
            file_count,
            thumbnail_cache_size: lib.thumbnail.cache_size(),
        });
    }

    Ok(libraries)
}

/// Persist a new display order for the opened libraries.
#[tauri::command]
pub async fn reorder_libraries(
    ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut engine = state.engine.lock().unwrap();
    engine.reorder_libraries(ids);
    save_libraries_config(&engine);
    Ok(())
}

#[tauri::command]
pub async fn index_library(
    app_handle: tauri::AppHandle,
    library_id: String,
    state: State<'_, AppState>,
) -> Result<IndexProgress, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let mut lib = lib.lock().unwrap();

    let files = lib.indexer.scan_directory(&lib.root_path);
    let total = files.len() as u64;

    let _ = app_handle.emit("index-progress", IndexProgress {
        total, processed: 0, current_file: String::new(), stage: "scanning".to_string(),
    });

    // Fast path: single transaction, metadata only, skip per-file DB check
    let conn = lib.db.conn();
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        for (i, file_path) in files.iter().enumerate() {
            if let Some(entry) = crate::engine::indexer::Indexer::build_entry(file_path) {
                lib.db.insert_file(&entry).map_err(|e| e.to_string())?;
            }

            if i % 50 == 0 || i == files.len() - 1 {
                let _ = app_handle.emit("index-progress", IndexProgress {
                    total, processed: (i + 1) as u64,
                    current_file: file_path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    stage: "indexing".to_string(),
                });
            }
        }
        Ok(())
    })();

    if result.is_ok() {
        conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    } else {
        conn.execute("ROLLBACK", []).map_err(|e| e.to_string())?;
        return Err(result.unwrap_err());
    }

    let _ = app_handle.emit("index-progress", IndexProgress {
        total, processed: total, current_file: String::new(), stage: "complete".to_string(),
    });

    Ok(IndexProgress { total, processed: total, current_file: String::new(), stage: "complete".to_string() })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexProgress {
    pub total: u64,
    pub processed: u64,
    pub current_file: String,
    pub stage: String,
}

#[tauri::command]
pub async fn get_nas_status(
    library_id: String,
    state: State<'_, AppState>,
) -> Result<NasStatus, String> {
    let engine = state.engine.lock().unwrap();
    let lib = engine.get_library(&library_id).ok_or("未找到图库")?;
    let lib = lib.lock().unwrap();

    if !lib.is_network {
        return Ok(NasStatus {
            status: "local".to_string(),
            latency_ms: 0.0,
        });
    }

    let start = std::time::Instant::now();
    match std::fs::metadata(&lib.root_path) {
        Ok(_) => {
            let latency = start.elapsed().as_secs_f64() * 1000.0;
            let status = if latency > 100.0 {
                "degraded".to_string()
            } else {
                "online".to_string()
            };
            Ok(NasStatus { status, latency_ms: latency })
        }
        Err(_) => Ok(NasStatus {
            status: "offline".to_string(),
            latency_ms: 0.0,
        }),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NasStatus {
    pub status: String,
    pub latency_ms: f64,
}

/// Save library paths + cached file counts to config
#[derive(Serialize, Deserialize)]
struct LibraryConfigEntry {
    path: String,
    file_count: i64,
}

pub(crate) fn save_libraries_config(engine: &crate::engine::Engine) {
    let config_path = engine.data_dir.join("libraries.json");
    let entries: Vec<LibraryConfigEntry> = engine.ordered_ids().iter()
        .filter_map(|id| engine.libraries.get(id))
        .filter_map(|lib| lib.lock().ok())
        .map(|lib| LibraryConfigEntry {
            path: lib.root_path.to_string_lossy().to_string(),
            file_count: lib.db.count_files(None, None).unwrap_or(0),
        })
        .collect();
    if let Ok(json) = serde_json::to_string(&entries) {
        std::fs::write(&config_path, json).ok();
    }
}

/// Load saved library config (path + cached count)
fn load_libraries_config(data_dir: &std::path::Path) -> Vec<LibraryConfigEntry> {
    let config_path = data_dir.join("libraries.json");
    if let Ok(json) = std::fs::read_to_string(&config_path) {
        serde_json::from_str(&json).unwrap_or_default()
    } else {
        Vec::new()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RestoreResult {
    pub libraries: Vec<LibraryInfo>,
    pub failed_paths: Vec<String>,
}

#[tauri::command]
pub async fn restore_libraries(
    state: State<'_, AppState>,
) -> Result<RestoreResult, String> {
    let mut engine = state.engine.lock().unwrap();
    let config = load_libraries_config(&engine.data_dir);
    let mut result = Vec::new();
    let mut failed = Vec::new();
    let mut need_reindex = Vec::new();

    for entry in &config {
        let root_path = std::path::PathBuf::from(&entry.path);
        if !root_path.exists() {
            failed.push(entry.path.clone());
            continue;
        }
        if let Ok(id) = engine.open_library(&root_path) {
            // Use cached file count — skip DB query and directory walk for speed
            let cached_count = entry.file_count;
            let lib = engine.get_library(&id).unwrap();
            let lib = lib.lock().unwrap();
            
            result.push(LibraryInfo {
                id: lib.id.clone(),
                name: lib.name.clone(),
                root_path: lib.root_path.to_string_lossy().to_string(),
                is_network: lib.is_network,
                file_count: cached_count,
                thumbnail_cache_size: 0, // skip expensive directory walk
            });
            
            // If cached count is 0, queue a background re-index
            if cached_count == 0 {
                need_reindex.push(id.clone());
            }
        }
    }

    // Spawn background re-index for empty libraries (non-blocking)
    if !need_reindex.is_empty() {
        let engine = state.engine.clone();
        tauri::async_runtime::spawn(async move {
            for id in need_reindex {
                if let Ok(mut engine) = engine.lock() {
                    if let Some(lib) = engine.get_library(&id) {
                        let mut lib = lib.lock().unwrap();
                        let files = lib.indexer.scan_directory(&lib.root_path);
                        let conn = lib.db.conn();
                        conn.execute("BEGIN TRANSACTION", []).ok();
                        for file_path in &files {
                            if let Some(entry) = crate::engine::indexer::Indexer::build_entry(file_path) {
                                lib.db.insert_file(&entry).ok();
                            }
                        }
                        conn.execute("COMMIT", []).ok();
                    }
                }
            }
        });
    }

    Ok(RestoreResult { libraries: result, failed_paths: failed })
}