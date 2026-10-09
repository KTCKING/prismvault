#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use prismvault_lib::{AppState, commands};

fn main() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    let app_state = AppState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::library::open_library,
            commands::library::create_library,
            commands::library::close_library,
            commands::library::get_libraries,
            commands::library::index_library,
            commands::library::get_nas_status,
            commands::library::restore_libraries,
            commands::library::reorder_libraries,
            commands::library::rename_library,
            commands::library::delete_library,
            commands::files::get_files,
            commands::files::get_file_info,
            commands::files::update_file_rating,
            commands::files::update_file_notes,
            commands::files::delete_file,
            commands::files::trash_files,
            commands::files::get_deleted_files,
            commands::files::restore_file,
            commands::files::purge_file,
            commands::files::empty_trash,
            commands::files::get_thumbnail_path,
            commands::files::open_in_explorer,
            commands::files::open_file,
            commands::files::copy_files_to_clipboard,
            commands::tags::get_all_tags,
            commands::tags::create_tag,
            commands::tags::add_tag_to_file,
            commands::tags::remove_tag_from_file,
            commands::tags::batch_add_tags,
            commands::search::search_files,
            commands::search::search_by_color,
            commands::search::find_duplicates,
            commands::import::detect_library_kind,
            commands::import::import_eagle_library,
            commands::import::import_pixcall_library,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PrismVault");
}