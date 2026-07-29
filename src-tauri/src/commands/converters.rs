use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::utils::errors::PDFError;

#[derive(Default)]
pub struct CompressState {
    pub cancel_flag: Arc<AtomicBool>,
}

#[derive(Serialize)]
pub struct CompressResult {
    pub output_path: String,
    pub original_size: u64,
    pub compressed_size: u64,
    pub rasterized: bool,
}

#[derive(Serialize, Clone)]
pub struct CompressProgress {
    pub stage: String,
    pub done: usize,
    pub total: usize,
    pub percent: u8,
}

#[command]
pub fn cancel_compress(state: State<'_, CompressState>) {
    state.cancel_flag.store(true, Ordering::SeqCst);
}

/// Compression is delegated entirely to Ghostscript, the same engine behind
/// virtually every production PDF compressor (Adobe Acrobat's own backend,
/// iLovePDF, Smallpdf, `ps2pdf`, etc). This replaces an earlier hand-rolled
/// lopdf-based approach that would hang on `Document::compress()` for large
/// scan-heavy PDFs (CCITTFax/JBIG2-encoded pages) — a known limitation of
/// lopdf's compression pass on unusual object structures. Ghostscript
/// handles every embedded image format correctly, downsamples images to the
/// target quality, and — critically — never touches any real text layer, so
/// born-digital pages keep their selectable text.
///
/// SETUP REQUIRED: install Ghostscript and make sure it's on PATH:
///   - Windows: https://ghostscript.com/releases/gsdnld.html (the command is
///     `gswin64c` on 64-bit Windows — add its install folder to PATH, or the
///     installer usually offers to do this for you)
///   - macOS:   `brew install ghostscript`
///   - Linux:   `apt install ghostscript` / `dnf install ghostscript` / etc.
///
/// Also required — Tauri v2's shell plugin is permission-gated, same as the
/// existing qpdf integration in security.rs. Add an allow rule for `gs` (and
/// `gswin64c` on Windows) in `src-tauri/capabilities/default.json`:
///
/// {
///   "permissions": [
///     { "identifier": "shell:allow-execute" }
///   ]
/// }
///
/// and register it as an allowed binary in your shell plugin scope. Consult
/// the Tauri v2 shell plugin docs for the exact scope syntax for your
/// version. If `compress_pdf` fails with a permission/scope error rather
/// than "Failed to start Ghostscript", that's the fix needed.
#[command]
pub async fn compress_pdf(
    app: AppHandle,
    state: State<'_, CompressState>,
    path: String,
    output_path: String,
    quality: String,
) -> Result<CompressResult, PDFError> {
    state.cancel_flag.store(false, Ordering::SeqCst);
    let cancel_flag = Arc::clone(&state.cancel_flag);

    let original_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let total_pages = {
        let path_clone = path.clone();
        tauri::async_runtime::spawn_blocking(move || {
            lopdf::Document::load(&path_clone)
                .map(|doc| doc.get_pages().len())
                .unwrap_or(0)
        })
        .await
        .unwrap_or(0)
    }
    .max(1);

    let preset = match quality.as_str() {
        "low" => "/screen",
        "medium" => "/ebook",
        "high" => "/printer",
        _ => "/ebook",
    };

    let _ = app.emit(
        "compress-progress",
        CompressProgress { stage: "analyzing".into(), done: 0, total: total_pages, percent: 0 },
    );

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let gs_binary = if cfg!(target_os = "windows") { "gswin64c" } else { "gs" };

    let (mut rx, child) = app
        .shell()
        .command(gs_binary)
        .args([
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            &format!("-dPDFSETTINGS={preset}"),
            "-dNOPAUSE",
            "-dBATCH",
            "-dSAFER",
            &format!("-sOutputFile={output_path}"),
            &path,
        ])
        .spawn()
        .map_err(|e| {
            PDFError::ProcessingError(format!(
                "Failed to start Ghostscript ({e}). Is it installed and on PATH? \
                 See compress_pdf's doc comment in converters.rs for install instructions."
            ))
        })?;

    let mut stderr_output = String::new();
    let mut stdout_tail = String::new();
    let mut exit_code: Option<i32> = None;
    let mut pages_done: usize = 0;
    let mut cancelled = false;

    while let Some(event) = rx.recv().await {
        if cancel_flag.load(Ordering::SeqCst) {
            let _ = child.kill();
            cancelled = true;
            break;
        }

        match event {
            CommandEvent::Stdout(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                stdout_tail.push_str(&text);
                for line in text.lines() {
                    if let Some(rest) = line.trim().strip_prefix("Page ") {
                        if let Ok(page_num) = rest.trim().parse::<usize>() {
                            pages_done = page_num;
                            let percent = 5 + ((pages_done as f64 / total_pages as f64) * 90.0) as u8;
                            let _ = app.emit(
                                "compress-progress",
                                CompressProgress {
                                    stage: "compressing".into(),
                                    done: pages_done,
                                    total: total_pages,
                                    percent: percent.min(95),
                                },
                            );
                        }
                    }
                }
            }
            CommandEvent::Stderr(bytes) => {
                stderr_output.push_str(&String::from_utf8_lossy(&bytes));
            }
            CommandEvent::Error(err) => {
                stderr_output.push_str(&err);
            }
            CommandEvent::Terminated(payload) => {
                exit_code = payload.code;
            }
            _ => {}
        }
    }

    if cancelled {
        std::fs::remove_file(&output_path).ok();
        return Err(PDFError::ProcessingError("Cancelled by user".into()));
    }

    if exit_code != Some(0) {
        std::fs::remove_file(&output_path).ok();
        return Err(PDFError::ProcessingError(format!(
            "Ghostscript exited with code {:?}: {}",
            exit_code,
            if stderr_output.trim().is_empty() {
                stdout_tail.trim()
            } else {
                stderr_output.trim()
            }
        )));
    }

    let compressed_size = std::fs::metadata(&output_path).map(|m| m.len()).unwrap_or(0);

    let _ = app.emit(
        "compress-progress",
        CompressProgress { stage: "finalizing".into(), done: total_pages, total: total_pages, percent: 100 },
    );

    Ok(CompressResult {
        output_path,
        original_size,
        compressed_size,
        rasterized: false,
    })
}

#[command]
pub async fn convert_pdf(path: String, output_path: String, format: String) -> Result<String, PDFError> {
    use lopdf::Document;

    let doc = Document::load(&path).map_err(PDFError::from)?;

    match format.as_str() {
        "txt" => {
            let page_numbers: Vec<u32> = doc.get_pages().keys().copied().collect();
            let mut text = String::new();
            for page_num in page_numbers {
                if let Ok(page_text) = doc.extract_text(&[page_num]) {
                    text.push_str(&page_text);
                    text.push('\n');
                }
            }
            if let Some(parent) = Path::new(&output_path).parent() {
                std::fs::create_dir_all(parent).ok();
            }
            std::fs::write(&output_path, text).map_err(PDFError::from)?;
            Ok(output_path)
        }
        "pdfa" => {
            let mut doc = doc;
            doc.version = "1.7".to_string();
            if let Some(parent) = Path::new(&output_path).parent() {
                std::fs::create_dir_all(parent).ok();
            }
            doc.save(&output_path).map_err(PDFError::from)?;
            Ok(output_path)
        }
        "png" | "jpg" => {
            let output_dir = output_path.clone();
            let format = format.clone();
            let path_clone = path.clone();

            let pages = tauri::async_runtime::spawn_blocking(move || {
                crate::render::render_document_to_images(&path_clone, &output_dir, &format, 2.0)
            })
            .await
            .map_err(|e| PDFError::ProcessingError(format!("Render task panicked: {e}")))??;

            Ok(pages
                .first()
                .map(|_| output_path.clone())
                .unwrap_or(output_path))
        }
        other => Err(PDFError::InvalidFormat(other.to_string())),
    }
}
