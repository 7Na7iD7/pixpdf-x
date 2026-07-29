use lopdf::{Document, Object, ObjectId};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;
use tauri::command;

use crate::utils::errors::PDFError;

#[derive(Serialize)]
pub struct PDFDocumentInfo {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub page_count: u32,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub metadata: Option<PDFMetadata>,
}

#[derive(Serialize)]
pub struct PDFMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub subject: Option<String>,
    pub keywords: Option<String>,
    pub creator: Option<String>,
    pub producer: Option<String>,
    pub creation_date: Option<String>,
    pub modification_date: Option<String>,
}

#[derive(Serialize)]
pub struct PDFPageInfo {
    pub index: u32,
    pub width: f64,
    pub height: f64,
}


#[command]
pub async fn open_pdf(path: String) -> Result<PDFDocumentInfo, PDFError> {
    let path_obj = Path::new(&path);
    if !path_obj.exists() {
        return Err(PDFError::InvalidFile(format!("File not found: {}", path)));
    }
    let doc = Document::load(&path).map_err(PDFError::from)?;
    let metadata = extract_metadata(&doc);
    let page_count = doc.get_pages().len() as u32;
    let name = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    let file_meta = std::fs::metadata(&path).ok();
    let created_at = file_meta
        .as_ref()
        .and_then(|m| m.created().ok())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
    let modified_at = file_meta
        .as_ref()
        .and_then(|m| m.modified().ok())
        .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());

    Ok(PDFDocumentInfo {
        id: uuid::Uuid::new_v4().to_string(),
        path,
        name,
        size,
        page_count,
        created_at,
        modified_at,
        metadata: Some(metadata),
    })
}

#[command]
pub async fn get_pdf_metadata(path: String) -> Result<PDFMetadata, PDFError> {
    let doc = Document::load(&path).map_err(PDFError::from)?;
    Ok(extract_metadata(&doc))
}

#[command]
pub async fn get_pdf_pages(path: String) -> Result<Vec<PDFPageInfo>, PDFError> {
    let doc = Document::load(&path).map_err(PDFError::from)?;
    let mut pages = Vec::new();

    for (index, (_page_num, object_id)) in doc.get_pages().into_iter().enumerate() {
        let (width, height) = get_page_dimensions(&doc, object_id).unwrap_or((595.0, 842.0));
        pages.push(PDFPageInfo {
            index: index as u32,
            width,
            height,
        });
    }
    Ok(pages)
}

fn get_page_dimensions(doc: &Document, object_id: ObjectId) -> Option<(f64, f64)> {
    let dict = doc.get_dictionary(object_id).ok()?;
    let media_box = dict
        .get(b"MediaBox")
        .and_then(|o| o.as_array())
        .ok()
        .or_else(|| {
            let mut current = dict.get(b"Parent").and_then(|o| o.as_reference()).ok();
            while let Some(parent_id) = current {
                if let Ok(parent_dict) = doc.get_dictionary(parent_id) {
                    if let Ok(mb) = parent_dict.get(b"MediaBox").and_then(|o| o.as_array()) {
                        return Some(mb);
                    }
                    current = parent_dict.get(b"Parent").and_then(|o| o.as_reference()).ok();
                } else {
                    break;
                }
            }
            None
        })?;

    if media_box.len() == 4 {
        let x0 = media_box[0].as_float().unwrap_or(0.0) as f64;
        let y0 = media_box[1].as_float().unwrap_or(0.0) as f64;
        let x1 = media_box[2].as_float().unwrap_or(595.0) as f64;
        let y1 = media_box[3].as_float().unwrap_or(842.0) as f64;
        return Some(((x1 - x0).abs(), (y1 - y0).abs()));
    }
    None
}


#[command]
pub async fn render_page(path: String, page_index: u32, scale: f32) -> Result<String, PDFError> {
    let doc = Document::load(&path).map_err(PDFError::from)?;
    let page_count = doc.get_pages().len() as u32;
    if page_index >= page_count {
        return Err(PDFError::InvalidPage(format!(
            "Page {} out of range (0..{})",
            page_index, page_count
        )));
    }

    let path_clone = path.clone();
    let png_bytes = tauri::async_runtime::spawn_blocking(move || {
        crate::render::render_page_to_png(&path_clone, page_index, scale.max(0.1))
    })
    .await
    .map_err(|e| PDFError::ProcessingError(format!("Render task panicked: {e}")))??;

    let encoded = base64_encode(&png_bytes);
    Ok(format!("data:image/png;base64,{}", encoded))
}

fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

#[command]
pub async fn merge_pdfs(paths: Vec<String>, output_path: String) -> Result<String, PDFError> {
    if paths.len() < 2 {
        return Err(PDFError::ProcessingError(
            "At least two PDFs are required to merge".into(),
        ));
    }

    let mut max_id = 1;
    let mut documents_pages: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut documents_objects: BTreeMap<ObjectId, Object> = BTreeMap::new();
    let mut document = Document::with_version("1.5");

    for path in &paths {
        let mut doc = Document::load(path).map_err(PDFError::from)?;
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        documents_pages.extend(
            doc.get_pages()
                .into_iter()
                .filter_map(|(_, object_id)| {
                    doc.get_object(object_id)
                        .ok()
                        .map(|obj| (object_id, obj.to_owned()))
                }),
        );
        documents_objects.extend(doc.objects);
    }

    let mut catalog_object: Option<(ObjectId, Object)> = None;
    let mut pages_object: Option<(ObjectId, Object)> = None;

    for (object_id, object) in documents_objects.iter() {
        match object.type_name().unwrap_or("") {
            "Catalog" => {
                catalog_object = Some((*object_id, object.clone()));
            }
            "Pages" => {
                if let Ok(dict) = object.as_dict() {
                    let mut dict = dict.clone();
                    if let Some(existing) = &pages_object {
                        if let Ok(existing_dict) = existing.1.as_dict() {
                            dict.extend(existing_dict);
                        }
                    }
                    pages_object = Some((*object_id, Object::Dictionary(dict)));
                }
            }
            "Page" | "Outlines" | "Outline" => {}
            _ => {
                document.objects.insert(*object_id, object.clone());
            }
        }
    }

    let pages_object =
        pages_object.ok_or_else(|| PDFError::ProcessingError("No Pages root found in source PDFs".into()))?;
    let catalog_object = catalog_object
        .ok_or_else(|| PDFError::ProcessingError("No Catalog found in source PDFs".into()))?;

    for (object_id, object) in &documents_pages {
        if let Ok(dict) = object.as_dict() {
            let mut dict = dict.clone();
            dict.set("Parent", pages_object.0);
            document.objects.insert(*object_id, Object::Dictionary(dict));
        }
    }

    let mut pages_dict = pages_object
        .1
        .as_dict()
        .map_err(PDFError::from)?
        .clone();
    pages_dict.set("Count", documents_pages.len() as u32);
    pages_dict.set(
        "Kids",
        documents_pages
            .keys()
            .map(|id| Object::Reference(*id))
            .collect::<Vec<_>>(),
    );
    document
        .objects
        .insert(pages_object.0, Object::Dictionary(pages_dict));

    let mut catalog_dict = catalog_object
        .1
        .as_dict()
        .map_err(PDFError::from)?
        .clone();
    catalog_dict.set("Pages", pages_object.0);
    document
        .objects
        .insert(catalog_object.0, Object::Dictionary(catalog_dict));

    document.trailer.set("Root", catalog_object.0);
    document.max_id = document.objects.len() as u32;
    document.renumber_objects();
    document.compress();

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    document.save(&output_path).map_err(PDFError::from)?;
    Ok(output_path)
}

#[derive(Deserialize)]
pub struct PageRange {
    pub start: u32,
    pub end: u32,
}

#[command]
pub async fn split_pdf(
    path: String,
    ranges: Vec<PageRange>,
    output_dir: String,
) -> Result<Vec<String>, PDFError> {
    std::fs::create_dir_all(&output_dir).map_err(PDFError::from)?;

    let source = Document::load(&path).map_err(PDFError::from)?;
    let page_count = source.get_pages().len() as u32;
    let mut output_paths = Vec::new();

    for (i, range) in ranges.iter().enumerate() {
        if range.start < 1 || range.end < range.start || range.end > page_count {
            return Err(PDFError::InvalidPage(format!(
                "Invalid range {}-{} for a {}-page document",
                range.start, range.end, page_count
            )));
        }

        let mut doc = Document::load(&path).map_err(PDFError::from)?;
        let pages = doc.get_pages();
        let to_delete: Vec<u32> = pages
            .keys()
            .filter(|&&num| num < range.start || num > range.end)
            .copied()
            .collect();
        doc.delete_pages(&to_delete);
        doc.renumber_objects();
        doc.compress();

        let output_path = format!("{}/part_{}.pdf", output_dir.trim_end_matches('/'), i + 1);
        doc.save(&output_path).map_err(PDFError::from)?;
        output_paths.push(output_path);
    }

    Ok(output_paths)
}


#[command]
pub async fn rotate_pages(
    path: String,
    output_path: String,
    pages: Vec<u32>,
    angle: i32,
) -> Result<String, PDFError> {
    let mut doc = Document::load(&path).map_err(PDFError::from)?;
    let doc_pages = doc.get_pages();
    let normalized_angle = ((angle % 360) + 360) % 360;

    for page_num in pages {
        if let Some(&object_id) = doc_pages.get(&page_num) {
            if let Ok(Object::Dictionary(ref mut page_dict)) = doc.get_object_mut(object_id) {
                let current_rot = page_dict
                    .get(b"Rotate")
                    .and_then(|r| r.as_i64())
                    .unwrap_or(0) as i32;
                let new_rot = ((current_rot + normalized_angle) % 360 + 360) % 360;
                page_dict.set("Rotate", Object::Integer(new_rot as i64));
            }
        } else {
            return Err(PDFError::InvalidPage(format!("Page {} does not exist", page_num)));
        }
    }

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    doc.save(&output_path).map_err(PDFError::from)?;
    Ok(output_path)
}


#[command]
pub async fn delete_pages(
    path: String,
    output_path: String,
    pages: Vec<u32>,
) -> Result<String, PDFError> {
    let mut doc = Document::load(&path).map_err(PDFError::from)?;
    let total_pages = doc.get_pages().len() as u32;

    if pages.len() as u32 >= total_pages {
        return Err(PDFError::ProcessingError(
            "Cannot delete every page in the document".into(),
        ));
    }

    let mut sorted_pages: Vec<u32> = pages;
    sorted_pages.sort_unstable();
    sorted_pages.dedup();
    doc.delete_pages(&sorted_pages);
    doc.renumber_objects();
    doc.compress();

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent).ok();
    }
    doc.save(&output_path).map_err(PDFError::from)?;
    Ok(output_path)
}


fn extract_metadata(doc: &Document) -> PDFMetadata {
    let mut metadata = PDFMetadata {
        title: None,
        author: None,
        subject: None,
        keywords: None,
        creator: None,
        producer: None,
        creation_date: None,
        modification_date: None,
    };

    let info_id = doc.trailer.get(b"Info").and_then(|i| i.as_reference()).ok();

    if let Some(info_id) = info_id {
        if let Ok(dict) = doc.get_dictionary(info_id) {
            metadata.title = get_string_from_dict(dict, "Title");
            metadata.author = get_string_from_dict(dict, "Author");
            metadata.subject = get_string_from_dict(dict, "Subject");
            metadata.keywords = get_string_from_dict(dict, "Keywords");
            metadata.creator = get_string_from_dict(dict, "Creator");
            metadata.producer = get_string_from_dict(dict, "Producer");
            metadata.creation_date = get_string_from_dict(dict, "CreationDate");
            metadata.modification_date = get_string_from_dict(dict, "ModDate");
        }
    }
    metadata
}

fn get_string_from_dict(dict: &lopdf::Dictionary, key: &str) -> Option<String> {
    dict.get(key.as_bytes()).ok().and_then(|obj| match obj {
        Object::String(bytes, _) => {
            if bytes.len() >= 2 && bytes[0] == 0xFE && bytes[1] == 0xFF {
                let utf16: Vec<u16> = bytes[2..]
                    .chunks_exact(2)
                    .map(|c| u16::from_be_bytes([c[0], c[1]]))
                    .collect();
                String::from_utf16(&utf16).ok()
            } else {
                String::from_utf8(bytes.clone())
                    .ok()
                    .or_else(|| Some(bytes.iter().map(|&b| b as char).collect()))
            }
        }
        _ => None,
    })
}
