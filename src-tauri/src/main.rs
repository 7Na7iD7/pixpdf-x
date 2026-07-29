#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commands;
mod converters;
mod filesystem;
mod pdf;
mod render;
mod security;
mod utils;
mod workers;

use commands::{
    cancel_compress, compress_pdf, convert_pdf, decrypt_pdf, delete_pages, encrypt_pdf,
    get_pdf_metadata, get_pdf_pages, merge_pdfs, open_pdf, render_page, rotate_pages, split_pdf,
    CompressState,
};
use filesystem::{pick_file, pick_files, pick_folder, pick_save_path, read_file_info};

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(CompressState::default())
        .invoke_handler(tauri::generate_handler![
            open_pdf,
            get_pdf_metadata,
            get_pdf_pages,
            render_page,
            merge_pdfs,
            split_pdf,
            compress_pdf,
            cancel_compress,
            convert_pdf,
            encrypt_pdf,
            decrypt_pdf,
            rotate_pages,
            delete_pages,
            pick_file,
            pick_files,
            pick_folder,
            pick_save_path,
            read_file_info,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PixPDF X application");
}
