use crate::utils::errors::PDFError;
use image::ImageEncoder;
use pdfium_render::prelude::*;
use rayon::prelude::*;
use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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

pub fn rasterize_and_rebuild_pdf(
    path: &str,
    jpeg_quality: u8,
    target_dpi: f32,
) -> Result<Vec<u8>, PDFError> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    rasterize_and_rebuild_pdf_parallel(path, jpeg_quality, target_dpi, cancel_flag, |_, _| {})
}

pub fn rasterize_and_rebuild_pdf_parallel(
    path: &str,
    jpeg_quality: u8,
    target_dpi: f32,
    cancel_flag: Arc<AtomicBool>,
    on_progress: impl Fn(usize, usize) + Send + Sync + 'static,
) -> Result<Vec<u8>, PDFError> {
    use lopdf::{Dictionary, Document, Object, Stream};

    let file_bytes = Arc::new(std::fs::read(path).map_err(PDFError::from)?);

    let (total_pages, page_sizes): (usize, Vec<(f32, f32)>) = with_pdfium(|pdfium| {
        let doc = pdfium
            .load_pdf_from_byte_slice(&file_bytes, None)
            .map_err(|e| PDFError::InvalidFile(format!("Could not open PDF: {e}")))?;
        let pages = doc.pages();
        let sizes: Vec<(f32, f32)> = pages
            .iter()
            .map(|p| (p.width().value, p.height().value))
            .collect();
        let count = sizes.len();
        Ok((count, sizes))
    })?;

    if total_pages == 0 {
        return Err(PDFError::ProcessingError("Document has no pages".into()));
    }

    let scale = target_dpi / 72.0;
    let worker_count = num_cpus::get().saturating_sub(1).max(1);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(worker_count)
        .build()
        .map_err(|e| PDFError::ProcessingError(format!("Could not build thread pool: {e}")))?;

    let chunk_size = ((total_pages + worker_count - 1) / worker_count).max(1);
    let progress_counter = Arc::new(AtomicUsize::new(0));
    let on_progress = Arc::new(on_progress);

    let chunks: Vec<(usize, usize)> = (0..total_pages)
        .step_by(chunk_size)
        .map(|start| (start, (start + chunk_size).min(total_pages)))
        .collect();

    let results: Result<Vec<Vec<(usize, Vec<u8>, u32, u32)>>, PDFError> = pool.install(|| {
        chunks
            .par_iter()
            .map(|&(start, end)| {
                let file_bytes = Arc::clone(&file_bytes);
                let progress_counter = Arc::clone(&progress_counter);
                let on_progress = Arc::clone(&on_progress);
                let cancel_flag = Arc::clone(&cancel_flag);

                with_pdfium(|pdfium| {
                    let document = pdfium
                        .load_pdf_from_byte_slice(&file_bytes, None)
                        .map_err(|e| PDFError::InvalidFile(format!("Could not open PDF for rasterizing: {e}")))?;

                    let pages = document.pages();
                    let mut chunk_results = Vec::with_capacity(end - start);

                    for index in start..end {
                        if cancel_flag.load(Ordering::SeqCst) {
                            return Err(PDFError::ProcessingError("Cancelled by user".into()));
                        }

                        let (page_width_pt, page_height_pt) = page_sizes[index];

                        let page = match pages.get(index as u16) {
                            Ok(p) => p,
                            Err(e) => {
                                log::warn!("Page {index} unavailable, using blank placeholder: {e}");
                                let (buf, w, h) =
                                    blank_jpeg_placeholder(page_width_pt, page_height_pt, scale, jpeg_quality)?;
                                chunk_results.push((index, buf, w, h));
                                let done = progress_counter.fetch_add(1, Ordering::SeqCst) + 1;
                                on_progress(done, total_pages);
                                continue;
                            }
                        };

                        let render_config = PdfRenderConfig::new()
                            .set_target_width(((page_width_pt * scale) as i32).max(1))
                            .set_maximum_height(((page_height_pt * scale) as i32).max(1));

                        let (jpeg_buf, px_w, px_h) = match page.render_with_config(&render_config) {
                            Ok(bitmap) => {
                                let rgb = bitmap.as_image().to_rgb8();
                                let (px_w, px_h) = (rgb.width(), rgb.height());
                                let mut jpeg_buf: Vec<u8> = Vec::new();
                                let encode_ok = {
                                    let encoder =
                                        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut jpeg_buf, jpeg_quality);
                                    encoder
                                        .write_image(&rgb, px_w, px_h, image::ExtendedColorType::Rgb8)
                                        .is_ok()
                                };
                                if encode_ok {
                                    (jpeg_buf, px_w, px_h)
                                } else {
                                    log::warn!("JPEG encode failed on page {index}, using blank placeholder");
                                    blank_jpeg_placeholder(page_width_pt, page_height_pt, scale, jpeg_quality)?
                                }
                            }
                            Err(e) => {
                                log::warn!("Render failed on page {index}, using blank placeholder: {e}");
                                blank_jpeg_placeholder(page_width_pt, page_height_pt, scale, jpeg_quality)?
                            }
                        };

                        chunk_results.push((index, jpeg_buf, px_w, px_h));

                        let done = progress_counter.fetch_add(1, Ordering::SeqCst) + 1;
                        on_progress(done, total_pages);
                    }

                    Ok(chunk_results)
                })
            })
            .collect()
    });

    let mut flat: Vec<(usize, Vec<u8>, u32, u32)> = results?.into_iter().flatten().collect();
    flat.sort_by_key(|(index, _, _, _)| *index);

    let mut new_doc = Document::with_version("1.5");
    let pages_id = new_doc.new_object_id();
    let mut kids: Vec<Object> = Vec::new();

    for (index, jpeg_buf, px_w, px_h) in flat {
        let (page_width_pt, page_height_pt) = page_sizes[index];

        let mut img_dict = Dictionary::new();
        img_dict.set("Type", "XObject");
        img_dict.set("Subtype", "Image");
        img_dict.set("Width", px_w as i64);
        img_dict.set("Height", px_h as i64);
        img_dict.set("ColorSpace", "DeviceRGB");
        img_dict.set("BitsPerComponent", 8);
        img_dict.set("Filter", "DCTDecode");
        img_dict.set("Length", jpeg_buf.len() as i64);
        let img_id = new_doc.add_object(Object::Stream(Stream::new(img_dict, jpeg_buf)));

        let content = format!(
            "q {w:.2} 0 0 {h:.2} 0 0 cm /Im0 Do Q",
            w = page_width_pt,
            h = page_height_pt
        );
        let content_id = new_doc.add_object(Object::Stream(Stream::new(Dictionary::new(), content.into_bytes())));

        let mut xobjects = Dictionary::new();
        xobjects.set("Im0", img_id);
        let mut resources = Dictionary::new();
        resources.set("XObject", xobjects);

        let mut page_dict = Dictionary::new();
        page_dict.set("Type", "Page");
        page_dict.set("Parent", pages_id);
        page_dict.set(
            "MediaBox",
            vec![0.into(), 0.into(), page_width_pt.into(), page_height_pt.into()],
        );
        page_dict.set("Contents", content_id);
        page_dict.set("Resources", resources);
        let page_id = new_doc.add_object(Object::Dictionary(page_dict));
        kids.push(Object::Reference(page_id));
    }

    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", "Pages");
    pages_dict.set("Count", kids.len() as i64);
    pages_dict.set("Kids", kids);
    new_doc.objects.insert(pages_id, Object::Dictionary(pages_dict));

    let mut catalog = Dictionary::new();
    catalog.set("Type", "Catalog");
    catalog.set("Pages", pages_id);
    let catalog_id = new_doc.add_object(Object::Dictionary(catalog));
    new_doc.trailer.set("Root", catalog_id);
    new_doc.max_id = new_doc.objects.len() as u32;

    let mut buf = Vec::new();
    new_doc.save_to(&mut buf).map_err(PDFError::from)?;
    Ok(buf)
}

fn blank_jpeg_placeholder(
    page_width_pt: f32,
    page_height_pt: f32,
    scale: f32,
    jpeg_quality: u8,
) -> Result<(Vec<u8>, u32, u32), PDFError> {
    let px_w = ((page_width_pt * scale) as u32).max(1);
    let px_h = ((page_height_pt * scale) as u32).max(1);
    let rgb = image::RgbImage::from_pixel(px_w, px_h, image::Rgb([255, 255, 255]));
    let mut buf: Vec<u8> = Vec::new();
    {
        let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, jpeg_quality);
        encoder
            .write_image(&rgb, px_w, px_h, image::ExtendedColorType::Rgb8)
            .map_err(|e| PDFError::ProcessingError(format!("Placeholder JPEG encode failed: {e}")))?;
    }
    Ok((buf, px_w, px_h))
}
