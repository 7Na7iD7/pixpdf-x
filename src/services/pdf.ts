import { invoke } from "@tauri-apps/api/core";
import type { PDFDocument, PDFMetadata, PDFPage } from "@apptypes/index";

// ---------- native file dialogs (replace the broken (file as any).path pattern) ----------

export async function pickFile(): Promise<string | null> {
  return invoke("pick_file");
}

export async function pickFiles(): Promise<string[]> {
  return invoke("pick_files");
}

export async function pickSavePath(defaultName: string): Promise<string | null> {
  return invoke("pick_save_path", { defaultName });
}

export async function pickFolder(): Promise<string | null> {
  return invoke("pick_folder");
}

// ---------- PDF operations ----------

export async function openPDF(path: string): Promise<PDFDocument> {
  const info = await invoke<any>("open_pdf", { path });
  return {
    id: info.id,
    path: info.path,
    name: info.name,
    size: info.size,
    pageCount: info.page_count,
    createdAt: info.created_at ?? new Date().toISOString(),
    modifiedAt: info.modified_at ?? new Date().toISOString(),
    metadata: info.metadata
      ? {
          title: info.metadata.title,
          author: info.metadata.author,
          subject: info.metadata.subject,
          keywords: info.metadata.keywords,
          creator: info.metadata.creator,
          producer: info.metadata.producer,
          creationDate: info.metadata.creation_date,
          modificationDate: info.metadata.modification_date,
        }
      : undefined,
  };
}

export async function getPDFMetadata(path: string): Promise<PDFMetadata> {
  return invoke("get_pdf_metadata", { path });
}

export async function getPDFPages(path: string): Promise<PDFPage[]> {
  const pages = await invoke<any[]>("get_pdf_pages", { path });
  return pages.map((p) => ({ index: p.index, width: p.width, height: p.height }));
}

/**
 * Renders a page to a base64 PNG data URL. Throws if the pdfium rendering
 * backend isn't wired up server-side yet — callers should catch this and
 * show a "preview unavailable" placeholder instead of crashing.
 */
export async function renderPage(
  path: string,
  pageIndex: number,
  scale: number
): Promise<string> {
  return invoke("render_page", { path, pageIndex, scale });
}

export async function mergePDFs(paths: string[], outputPath: string): Promise<string> {
  return invoke("merge_pdfs", { paths, outputPath });
}

export async function splitPDF(
  path: string,
  ranges: { start: number; end: number }[],
  outputDir: string
): Promise<string[]> {
  return invoke("split_pdf", { path, ranges, outputDir });
}

export async function compressPDF(
  path: string,
  outputPath: string,
  quality: "low" | "medium" | "high"
): Promise<{ outputPath: string; originalSize: number; compressedSize: number; rasterized: boolean }> {
  const result = await invoke<any>("compress_pdf", { path, outputPath, quality });
  return {
    outputPath: result.output_path,
    originalSize: result.original_size,
    compressedSize: result.compressed_size,
    rasterized: !!result.rasterized,
  };
}

export async function convertPDF(
  path: string,
  outputPath: string,
  format: "png" | "jpg" | "txt" | "pdfa"
): Promise<string> {
  return invoke("convert_pdf", { path, outputPath, format });
}

export async function encryptPDF(
  path: string,
  outputPath: string,
  userPassword: string,
  ownerPassword?: string
): Promise<string> {
  return invoke("encrypt_pdf", { path, outputPath, userPassword, ownerPassword });
}

export async function decryptPDF(
  path: string,
  outputPath: string,
  password: string
): Promise<string> {
  return invoke("decrypt_pdf", { path, outputPath, password });
}

export async function rotatePages(
  path: string,
  outputPath: string,
  pages: number[],
  angle: number
): Promise<string> {
  return invoke("rotate_pages", { path, outputPath, pages, angle });
}

export async function deletePages(
  path: string,
  outputPath: string,
  pages: number[]
): Promise<string> {
  return invoke("delete_pages", { path, outputPath, pages });
}

/** Human-readable error extraction — Tauri command errors arrive as plain strings/objects. */
export function pdfErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const obj = err as Record<string, unknown>;
    const key = Object.keys(obj)[0];
    const val = (obj as any)[key];
    if (typeof val === "string") return `${key}: ${val}`;
  }
  return "An unknown error occurred";
}