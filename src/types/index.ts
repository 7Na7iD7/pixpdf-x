export interface PDFDocument {
  id: string;
  path: string;
  name: string;
  size: number;
  pageCount: number;
  createdAt: string;
  modifiedAt: string;
  thumbnail?: string;
  metadata?: PDFMetadata;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
}

export interface PDFPage {
  index: number;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface MergeJob {
  id: string;
  documents: PDFDocument[];
  outputName: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  outputPath?: string;
  error?: string;
}

export interface SplitJob {
  id: string;
  document: PDFDocument;
  pageRanges: PageRange[];
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  outputPaths?: string[];
  error?: string;
}

export interface PageRange {
  start: number;
  end: number;
  label: string;
}

export interface CompressJob {
  id: string;
  document: PDFDocument;
  quality: "low" | "medium" | "high" | "custom";
  targetSize?: number;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  originalSize: number;
  compressedSize?: number;
  outputPath?: string;
  error?: string;
}

export interface ConvertJob {
  id: string;
  document: PDFDocument;
  targetFormat: "png" | "jpg" | "txt" | "pdfa";
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  outputPath?: string;
  error?: string;
}

export interface SecuritySettings {
  userPassword?: string;
  ownerPassword?: string;
  allowPrinting: boolean;
  allowModifying: boolean;
  allowCopying: boolean;
  allowAnnotating: boolean;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  language: string;
  defaultZoom: number;
  autoSave: boolean;
  showThumbnails: boolean;
  recentFilesLimit: number;
  defaultOutputDir?: string;
}

export type HistoryAction =
  | "Opened"
  | "Merged"
  | "Split"
  | "Compressed"
  | "Converted"
  | "Encrypted"
  | "Decrypted"
  | "Edited";

export interface RecentFile {
  path: string;
  name: string;
  openedAt: string;
  pageCount?: number;
  size?: number;
  action?: HistoryAction;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

export type SidebarItem =
  | "dashboard"
  | "viewer"
  | "merge"
  | "split"
  | "compress"
  | "convert"
  | "editor"
  | "security"
  | "history"
  | "settings";