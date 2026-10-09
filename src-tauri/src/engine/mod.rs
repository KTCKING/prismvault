pub mod db;
pub mod indexer;
pub mod thumbnail;
pub mod watcher;
pub mod search;
pub mod dedup;
pub mod import;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::Mutex;
use crate::engine::db::Database;
use crate::engine::indexer::Indexer;
use crate::engine::thumbnail::ThumbnailEngine;
use crate::engine::watcher::FileWatcher;
use crate::engine::search::SearchEngine;
use crate::engine::dedup::DedupEngine;

pub struct Library {
    pub id: String,
    pub name: String,
    pub root_path: PathBuf,
    pub is_network: bool,
    pub db: Database,
    pub indexer: Indexer,
    pub thumbnail: ThumbnailEngine,
    pub watcher: Option<FileWatcher>,
    pub search: SearchEngine,
    pub dedup: DedupEngine,
}

unsafe impl Send for Library {}
unsafe impl Sync for Library {}

pub struct Engine {
    pub libraries: HashMap<String, Arc<Mutex<Library>>>,
    /// User-defined display order of library ids. `libraries` is a HashMap and
    /// therefore unordered, so this Vec is the single source of truth for order.
    pub library_order: Vec<String>,
    pub active_library_id: Option<String>,
    pub data_dir: PathBuf,
}

impl Engine {
    pub fn new() -> Self {
        let data_dir = Self::get_data_dir().unwrap_or_else(|| PathBuf::from("."));
        Engine {
            libraries: HashMap::new(),
            library_order: Vec::new(),
            active_library_id: None,
            data_dir,
        }
    }

    /// Library ids in the user-defined order. Stale ids are dropped and any
    /// untracked library is appended defensively so nothing is ever hidden.
    pub fn ordered_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self
            .library_order
            .iter()
            .filter(|id| self.libraries.contains_key(*id))
            .cloned()
            .collect();
        for id in self.libraries.keys() {
            if !ids.contains(id) {
                ids.push(id.clone());
            }
        }
        ids
    }

    /// Replace the user-defined order. Ids that are not open are ignored, and
    /// any open library the caller omitted is appended so no library is lost.
    pub fn reorder_libraries(&mut self, ordered: Vec<String>) {
        let mut next: Vec<String> = Vec::with_capacity(self.libraries.len());
        for id in ordered {
            if self.libraries.contains_key(&id) && !next.contains(&id) {
                next.push(id);
            }
        }
        for id in self.libraries.keys() {
            if !next.contains(id) {
                next.push(id.clone());
            }
        }
        self.library_order = next;
    }

    pub fn open_library(&mut self, root_path: &Path) -> Result<String, String> {
        // Check if this path is already open
        let canonical = root_path.canonicalize().unwrap_or_else(|_| root_path.to_path_buf());
        for (id, lib) in &self.libraries {
            if let Ok(lib) = lib.lock() {
                let lib_canonical = lib.root_path.canonicalize().unwrap_or_else(|_| lib.root_path.clone());
                if lib_canonical == canonical {
                    self.active_library_id = Some(id.clone());
                    return Ok(id.clone());
                }
            }
        }

        let id = uuid::Uuid::new_v4().to_string();
        let is_network = Self::is_network_path(root_path);
        let name = root_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let db_dir = if is_network {
            let local = self.data_dir.join("libraries").join(&id);
            std::fs::create_dir_all(&local).map_err(|e| e.to_string())?;
            local
        } else {
            root_path.join(".prism")
        };

        let db_path = db_dir.join("db.sqlite");
        let db = Database::open(&db_path).map_err(|e| e.to_string())?;

        let thumbnail_dir = db_dir.join("thumbnails");
        std::fs::create_dir_all(&thumbnail_dir).map_err(|e| e.to_string())?;

        let library = Library {
            id: id.clone(),
            name,
            root_path: root_path.to_path_buf(),
            is_network,
            db,
            indexer: Indexer::new(),
            thumbnail: ThumbnailEngine::new(&thumbnail_dir),
            watcher: None,
            search: SearchEngine::new(),
            dedup: DedupEngine::new(),
        };

        self.libraries.insert(id.clone(), Arc::new(Mutex::new(library)));
        self.library_order.push(id.clone());
        self.active_library_id = Some(id.clone());
        Ok(id)
    }

    pub fn close_library(&mut self, id: &str) {
        self.libraries.remove(id);
        self.library_order.retain(|x| x != id);
        if self.active_library_id.as_deref() == Some(id) {
            self.active_library_id = self.library_order.first().cloned();
        }
    }

    pub fn active_library(&self) -> Option<Arc<Mutex<Library>>> {
        self.active_library_id
            .as_ref()
            .and_then(|id| self.libraries.get(id).cloned())
    }

    pub fn get_library(&self, id: &str) -> Option<Arc<Mutex<Library>>> {
        self.libraries.get(id).cloned()
    }

    fn is_network_path(path: &Path) -> bool {
        let path_str = path.to_string_lossy();
        path_str.starts_with("\\\\") || path_str.starts_with("//")
    }

    fn get_data_dir() -> Option<PathBuf> {
        #[cfg(target_os = "windows")]
        {
            std::env::var("APPDATA")
                .ok()
                .map(|p| PathBuf::from(p).join("PrismVault"))
        }
        #[cfg(target_os = "macos")]
        {
            std::env::var("HOME")
                .ok()
                .map(|p| PathBuf::from(p).join("Library").join("Application Support").join("PrismVault"))
        }
        #[cfg(target_os = "linux")]
        {
            std::env::var("XDG_DATA_HOME")
                .ok()
                .map(PathBuf::from)
                .or_else(|| {
                    std::env::var("HOME")
                        .ok()
                        .map(|p| PathBuf::from(p).join(".local").join("share").join("PrismVault"))
                })
        }
    }
}