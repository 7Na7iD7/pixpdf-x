use crate::utils::errors::PDFError;
use pdfium_render::prelude::*;
use rayon::prelude::*;
use std::cell::RefCell;
use std::sync::Arc;

thread_local! {
    static PDFIUM: RefCell<Option<Result<Pdfium, String>>> = RefCell::new(None);
}

fn with_pdfium<T>(f: impl FnOnce(&Pdfium) -> Result<T, PDFError>) -> Result<T, PDFError> {
    PDFIUM.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            let bound = Pdfium::bind_to_system_library()
                .or_else(|_| {
                    let exe_dir = std::env::current_exe()
                        .ok()
                        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                        .unwrap_or_default();
                    Pdfium::bind_to_library(Pdfium::pdfium_platform_library_name_at_path(&exe_dir))
                })
                .map(Pdfium::new)
                .map_err(|e| {
                    format!(
                        "Could not load the pdfium library: {e}. Download a prebuilt pdfium \
                         binary for your OS from https://github.com/bblanchon/pdfium-binaries \
                         and place it next to the application executable."
                    )
                });
            *slot = Some(bound);
        }

        match slot.as_ref().unwrap() {
            Ok(pdfium) => f(pdfium),
            Err(msg) => Err(PDFError::ProcessingError(msg.clone())),
        }
    })
}

pub fn render_page_to_png(path: &str, page_index: u32, scale: f32) -> Result<Vec<u8>, PDFError> {
    with_pdfium(|pdfium| {
        let document = pdfium
            .load_pdf_from_file(path, None)
            .map_err(|e| PDFError::InvalidFile(format!("Could not open PDF for rendering: {e}")))?;

        let pages = document.pages();
        let page = pages
            .get(page_index as u16)
            .map_err(|e| PDFError::InvalidPage(format!("Page {page_index} unavailable: {e}")))?;

        let target_width = (page.width().value * scale).round().max(1.0) as i32;
        let target_height = (page.height().value * scale).round().max(1.0) as i32;

        let render_config = PdfRenderConfig::new()
            .set_target_width(target_width)
            .set_maximum_height(target_height);

        let bitmap = page
            .render_with_config(&render_config)
            .map_err(|e| PDFError::ProcessingError(format!("Render failed: {e}")))?;

        let image = bitmap.as_image();
        let mut buf: Vec<u8> = Vec::new();
        image
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .map_err(|e| PDFError::ProcessingError(format!("PNG encode failed: {e}")))?;

        Ok(buf)
    })
}

pub fn render_document_to_images(
    path: &str,
    output_dir: &str,
    format: &str,
    scale: f32,
) -> Result<Vec<String>, PDFError> {
    std::fs::create_dir_all(output_dir).map_err(PDFError::from)?;

    let image_format = match format {
        "png" => image::ImageFormat::Png,
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        other => return Err(PDFError::InvalidFormat(other.to_string())),
    };
    let ext = if format == "jpg" || format == "jpeg" { "jpg" } else { "png" };

    let file_bytes = Arc::new(std::fs::read(path).map_err(PDFError::from)?);

    let total_pages = with_pdfium(|pdfium| {
        let document = pdfium
            .load_pdf_from_byte_slice(&file_bytes, None)
            .map_err(|e| PDFError::InvalidFile(format!("Could not open PDF: {e}")))?;
        Ok(document.pages().len() as usize)
    })?;

    let output_dir = output_dir.to_string();
    let format = format.to_string();
    let worker_count = num_cpus::get().saturating_sub(1).max(1);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(worker_count)
        .build()
        .map_err(|e| PDFError::ProcessingError(format!("Could not build thread pool: {e}")))?;

    let chunk_size = ((total_pages + worker_count - 1) / worker_count).max(1);
    let chunks: Vec<(usize, usize)> = (0..total_pages)
        .step_by(chunk_size)
        .map(|start| (start, (start + chunk_size).min(total_pages)))
        .collect();

    let results: Result<Vec<Vec<(usize, String)>>, PDFError> = pool.install(|| {
        chunks
            .par_iter()
            .map(|&(start, end)| {
                let file_bytes = Arc::clone(&file_bytes);
                with_pdfium(|pdfium| {
                    let document = pdfium
                        .load_pdf_from_byte_slice(&file_bytes, None)
                        .map_err(|e| PDFError::InvalidFile(format!("Could not open PDF for rendering: {e}")))?;

                    let pages = document.pages();
                    let mut chunk_results = Vec::with_capacity(end - start);

                    for index in start..end {
                        let page = match pages.get(index as u16) {
                            Ok(p) => p,
                            Err(e) => {
                                log::warn!("Page {index} unavailable, skipping: {e}");
                                continue;
                            }
                        };

                        let target_width = (page.width().value * scale).round().max(1.0) as i32;
                        let target_height = (page.height().value * scale).round().max(1.0) as i32;

                        let render_config = PdfRenderConfig::new()
                            .set_target_width(target_width)
                            .set_maximum_height(target_height);

                        let bitmap = match page.render_with_config(&render_config) {
                            Ok(b) => b,
                            Err(e) => {
                                log::warn!("Render failed on page {index}, skipping: {e}");
                                continue;
                            }
                        };

                        let image = bitmap.as_image();
                        let file_path = format!(
                            "{}/page_{:03}.{}",
                            output_dir.trim_end_matches('/'),
                            index + 1,
                            ext
                        );
                        if let Err(e) = image.save_with_format(&file_path, image_format) {
                            log::warn!("Failed saving page {index}, skipping: {e}");
                            continue;
                        }

                        chunk_results.push((index, file_path));
                    }

                    Ok(chunk_results)
                })
            })
            .collect()
    });

    let mut flat: Vec<(usize, String)> = results?.into_iter().flatten().collect();
    flat.sort_by_key(|(index, _)| *index);
    Ok(flat.into_iter().map(|(_, path)| path).collect())
}
