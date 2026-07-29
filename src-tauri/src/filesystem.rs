use serde::Serialize;
use std::path::Path;
use tauri::{command, AppHandle};
use tauri_plugin_dialog::DialogExt;

#[derive(Serialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub is_file: bool,
    pub extension: Option<String>,
}


#[command]
pub async fn pick_file(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("PDF Documents", &["pdf"])
        .pick_file(move |file_path| {
            let result = file_path.map(|p| p.to_string());
            let _ = tx.send(result);
        });

    rx.await.map_err(|e| e.to_string())
}

#[command]
pub async fn pick_files(app: AppHandle) -> Result<Vec<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .add_filter("PDF Documents", &["pdf"])
        .pick_files(move |file_paths| {
            let result = file_paths
                .unwrap_or_default()
                .into_iter()
                .map(|p| p.to_string())
                .collect();
            let _ = tx.send(result);
        });

    rx.await.map_err(|e| e.to_string())
}

#[command]
pub async fn pick_save_path(app: AppHandle, default_name: String) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("PDF Documents", &["pdf"])
        .save_file(move |file_path| {
            let result = file_path.map(|p| p.to_string());
            let _ = tx.send(result);
        });

    rx.await.map_err(|e| e.to_string())
}

#[command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();

    app.dialog().file().pick_folder(move |folder_path| {
        let result = folder_path.map(|p| p.to_string());
        let _ = tx.send(result);
    });

    rx.await.map_err(|e| e.to_string())
}

#[command]
pub async fn read_file_info(path: String) -> Result<FileInfo, String> {
    let path_obj = Path::new(&path);
    let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    Ok(FileInfo {
        path: path.clone(),
        name: path_obj
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string(),
        size: metadata.len(),
        is_file: metadata.is_file(),
        extension: path_obj
            .extension()
            .and_then(|e| e.to_str())
            .map(|s| s.to_lowercase()),
    })
}
