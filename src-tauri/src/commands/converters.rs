use lopdf::{Dictionary, Document, Object, ObjectId};
use image::ImageEncoder;
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{command, AppHandle, Emitter, State};

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

    let path_clone = path.clone();
    let quality_clone = quality.clone();
    let app_clone = app.clone();

    let (doc_bytes, rasterized) =
        tauri::async_runtime::spawn_blocking(move || -> Result<(Vec<u8>, bool), PDFError> {
            let _ = app_clone.emit(
                "compress-progress",
                CompressProgress { stage: "analyzing".into(), done: 0, total: 1, percent: 0 },
            );

            let mut doc = Document::load(&path_clone).map_err(PDFError::from)?;
            let original_len = std::fs::metadata(&path_clone).map(|m| m.len()).unwrap_or(0);

            let (jpeg_quality, max_dimension, target_dpi) = match quality_clone.as_str() {
                "low" => (35u8, Some(1200u32), 100.0f32),
                "medium" => (60u8, Some(1800u32), 150.0f32),
                "high" => (85u8, None, 220.0f32),
                _ => (60u8, Some(1800u32), 150.0f32),
            };

            let _ = app_clone.emit(
                "compress-progress",
                CompressProgress { stage: "recompressing-images".into(), done: 0, total: 1, percent: 5 },
            );

            let (jpeg_images_found, jpeg_images_recompressed) =
                recompress_images(&mut doc, jpeg_quality, max_dimension);
            log::info!(
                "compress_pdf: {jpeg_images_found} DCTDecode-filtered images found, \
                 {jpeg_images_recompressed} successfully recompressed"
            );
            doc.compress();
            if quality_clone == "low" || quality_clone == "medium" {
                strip_optional_content(&mut doc);
            }

            let mut buf = Vec::new();
            doc.save_to(&mut buf).map_err(PDFError::from)?;

            let stream_recompress_saved_enough =
                original_len > 0 && (buf.len() as f64) < (original_len as f64) * 0.9;

            if !stream_recompress_saved_enough && (quality_clone == "low" || quality_clone == "medium") {
                let path_for_raster = path_clone.clone();
                let app_for_progress = app_clone.clone();
                let cancel_flag_for_raster = Arc::clone(&cancel_flag);

                let raster_bytes = crate::render::rasterize_and_rebuild_pdf_parallel(
                    &path_for_raster,
                    jpeg_quality,
                    target_dpi,
                    cancel_flag_for_raster,
                    move |done, total| {
                        let percent = 10 + ((done as f64 / total as f64) * 85.0) as u8;
                        let _ = app_for_progress.emit(
                            "compress-progress",
                            CompressProgress {
                                stage: "rasterizing".into(),
                                done,
                                total,
                                percent: percent.min(95),
                            },
                        );
                    },
                )?;

                let _ = app_clone.emit(
                    "compress-progress",
                    CompressProgress { stage: "finalizing".into(), done: 1, total: 1, percent: 100 },
                );

                if raster_bytes.len() < buf.len() {
                    return Ok((raster_bytes, true));
                }
            } else {
                let _ = app_clone.emit(
                    "compress-progress",
                    CompressProgress { stage: "finalizing".into(), done: 1, total: 1, percent: 100 },
                );
            }

            Ok((buf, false))
        })
        .await
        .map_err(|e| PDFError::ProcessingError(format!("Compression task panicked: {e}")))??;

    let original_size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    std::fs::write(&output_path, &doc_bytes).map_err(PDFError::from)?;
    let compressed_size = doc_bytes.len() as u64;

    Ok(CompressResult {
        output_path,
        original_size,
        compressed_size,
        rasterized,
    })
}

fn recompress_images(doc: &mut Document, jpeg_quality: u8, max_dimension: Option<u32>) -> (usize, usize) {
    let candidate_ids: Vec<ObjectId> = doc
        .objects
        .iter()
        .filter_map(|(id, obj)| {
            if let Object::Stream(stream) = obj {
                if is_image(&stream.dict) && filter_is_dct(&stream.dict) {
                    return Some(*id);
                }
            }
            None
        })
        .collect();

    let found = candidate_ids.len();
    let mut recompressed = 0usize;

    for id in candidate_ids {
        let Some(Object::Stream(stream)) = doc.objects.get_mut(&id) else {
            continue;
        };

        let original_len = stream.content.len();
        let decoded = match image::load_from_memory_with_format(&stream.content, image::ImageFormat::Jpeg) {
            Ok(img) => img,
            Err(_) => continue,
        };

        let resized = if let Some(max_dim) = max_dimension {
            if decoded.width() > max_dim || decoded.height() > max_dim {
                decoded.resize(max_dim, max_dim, image::imageops::FilterType::Lanczos3)
            } else {
                decoded
            }
        } else {
            decoded
        };

        let mut buf: Vec<u8> = Vec::new();
        let rgb = resized.to_rgb8();
        let encode_result = {
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, jpeg_quality);
            encoder.write_image(
                &rgb,
                resized.width(),
                resized.height(),
                image::ExtendedColorType::Rgb8,
            )
        };
        if encode_result.is_err() {
            continue;
        }

        if buf.len() < original_len {
            stream.dict.set("Width", resized.width() as i64);
            stream.dict.set("Height", resized.height() as i64);
            stream.dict.set("Length", buf.len() as i64);
            stream.dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
            stream.dict.remove(b"DecodeParms");
            stream.content = buf;
            recompressed += 1;
        }
    }

    (found, recompressed)
}

fn is_image(dict: &Dictionary) -> bool {
    dict.get(b"Subtype")
        .and_then(|o| o.as_name())
        .map(|n| n == b"Image")
        .unwrap_or(false)
}

fn filter_is_dct(dict: &Dictionary) -> bool {
    match dict.get(b"Filter") {
        Ok(Object::Name(n)) => n == b"DCTDecode",
        Ok(Object::Array(arr)) => arr.iter().any(|o| {
            matches!(o, Object::Name(n) if n == b"DCTDecode")
        }),
        _ => false,
    }
}

fn strip_optional_content(doc: &mut Document) {
    if let Ok(info_ref) = doc.trailer.get(b"Info").and_then(|i| i.as_reference()) {
        doc.objects.remove(&info_ref);
        doc.trailer.remove(b"Info");
    }
}

#[command]
pub async fn convert_pdf(path: String, output_path: String, format: String) -> Result<String, PDFError> {
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
