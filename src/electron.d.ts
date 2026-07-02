// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// electron.d.ts â€” DeclaraciÃ³n de tipos globales para window.electronAPI
// Fix #8:  Tipado completo para eliminar (window as any).electronAPI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { ScanResult, AppSettings } from './shared/types';

export interface DbStats {
  count: number;
  sizeMB: number;
  sizeBytes: number;
  path: string;
}

export interface SidecarStatus {
  name: string;
  status: 'running' | 'failed' | 'reconnecting' | 'ok';
  code?: number;
  attempt?: number;
}

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface SelectFileOptions {
  filters?: FileFilter[];
  defaultPath?: string;
}

export interface ExportFileOptions {
  defaultFilename: string;
  content: string | Uint8Array;
  filters?: FileFilter[];
}

export interface ScanProgressData {
  currentFile: string;
  scannedCount: number;
  foundCount: number;
  stage?: 'exploring' | 'processing' | 'finalizing';
}

export interface FolderUpdatedData {
  type: 'add' | 'unlink' | 'change';
  path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces para payloads de Terapias
// ─────────────────────────────────────────────────────────────────────────────
export interface TerapiasPrepareData {
  input_name: string;
  filename: string;
  base_dest: string;
  [key: string]: unknown; // Permitir campos adicionales
}

export interface TerapiasFinalizeData {
  doc_path?: string;
  backup?: string;
  patient?: string;
  output_path?: string;
  backup_path?: string;
  patient_name?: string;
  [key: string]: unknown;
}

export interface TerapiasSearchPatientData {
  query: string;
  [key: string]: unknown;
}

export interface TerapiasResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Interfaces para payloads de PDFTools
// ─────────────────────────────────────────────────────────────────────────────
export interface PdfOperationData {
  input: string;
  output?: string;
  [key: string]: unknown;
}

export interface PdfOperationResult {
  ok: boolean;
  output?: string;
  error?: string;
  [key: string]: unknown;
}

interface ElectronAPI {
  // â”€â”€ DiÃ¡logos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectDirectory(): Promise<string | null>;
  selectFile(options?: SelectFileOptions | FileFilter[]): Promise<string | null>;
  selectFiles(options?: SelectFileOptions | FileFilter[]): Promise<string[] | null>;
  selectSavePath(options?: SelectFileOptions | FileFilter[]): Promise<string | null>;
  getPathForFile(file: File): string;
  getTempPath(): Promise<string>;
  security: {
    validateAndRegisterDroppedFile(path: string): Promise<{ ok: boolean; error?: string }>;
    syncActiveFiles(paths: string[]): Promise<{ ok: boolean; accepted?: number }>;
    registerApprovedDirectory(path: string): Promise<{ ok: boolean; error?: string }>;
  };

  // â”€â”€ Sistema de archivos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  readDirectory(
    dirPath: string,
    options?: { ignoredFolders?: string[]; maxDepth?: number; scanId?: string }
  ): Promise<{ files: { filePath: string; mtimeMs: number }[]; totalScanned: number }>;

  checkPathExists(path: string): Promise<{ exists: boolean }>;

  cancelScan(scanId: string): Promise<boolean>;

  parsePdf(pdfPath: string, maxPages?: number): Promise<{ text: string; numPages: number } | null>;

  readPdfAsBase64(pdfPath: string): Promise<{ success: boolean; data?: string; error?: string }>;

  listFiles(dirPath: string, extensions: string[]): Promise<string[]>;

  openExternal(filePath: string): Promise<boolean>;

  exportFile(options: ExportFileOptions): Promise<{ success: boolean; filePath?: string; error?: string }>;

  // â”€â”€ Progreso de escaneo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onScanProgress(callback: (data: ScanProgressData) => void): void;
  offScanProgress(): void;

  // â”€â”€ Watcher de carpeta en tiempo real â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  startWatch(dirPath: string): Promise<boolean>;
  stopWatch(): Promise<boolean>;
  onFolderUpdated(callback: (data: FolderUpdatedData) => void): void;
  offFolderUpdated(): void;

  // â”€â”€ Base de datos local â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  getHistory(): Promise<ScanResult[]>;
  saveScan(scan: ScanResult): Promise<ScanResult[]>;
  deleteScan(id: string): Promise<ScanResult[]>;
  clearHistory(): Promise<void>;
  getSettings(): Promise<AppSettings | null>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;

  ocrExtractText(pdfPath: string): Promise<string>;

  trimHistory(keepCount: number): Promise<ScanResult[]>;

  getDbStats(): Promise<DbStats>;

  shell: {
    openPath(path: string): Promise<void>;
    openFile(path: string): Promise<{ ok: boolean; error?: string }>;
    revealInFolder(path: string): Promise<{ ok: boolean; error?: string }>;
  };

  config: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
  };

  tesseract: {
    validate(exePath: string): Promise<{ ok: boolean; error?: string }>;
  };

  dashboard: {
    getStats(): Promise<{ pendingDocs: number }>;
  };

  // â”€â”€ MÃ³dulo de Terapias (Sidecar Python) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  onSidecarStatus(callback: (data: SidecarStatus) => void): void;
  offSidecarStatus(): void;
  reconnectSidecar(name: string): Promise<{ ok: boolean }>;

  terapias: {
    ping(): Promise<{ ok: boolean }>;
    checkWord(wordExecutablePath?: string): Promise<{ ok: boolean; word_installed: boolean; message?: string; error?: string }>;
    listDocs(sourceDir: string): Promise<{ ok: boolean; files: { name: string; modified: number; size: number }[]; error?: string }>;
    prepare(data: TerapiasPrepareData): Promise<TerapiasResponse & { folder?: string; doc_path?: string; patient?: string }>;
    finalize(data: TerapiasFinalizeData): Promise<TerapiasResponse & { pdf_path?: string; backup_path?: string }>;
    getHistory(): Promise<{ ok: boolean; history: unknown[]; error?: string }>;
    searchPatient(data: TerapiasSearchPatientData): Promise<{ ok: boolean; results: unknown[]; error?: string }>;
  };

  pdfTools: {
    ping(): Promise<{ ok: boolean }>;
    merge(data: PdfOperationData): Promise<PdfOperationResult>;
    compress(data: PdfOperationData): Promise<PdfOperationResult>;
    split(data: PdfOperationData): Promise<PdfOperationResult>;
    rotate(data: PdfOperationData): Promise<PdfOperationResult>;
    extract(data: PdfOperationData): Promise<PdfOperationResult>;
    wordToPdf(data: PdfOperationData): Promise<PdfOperationResult>;
    pdfToWord(data: PdfOperationData): Promise<PdfOperationResult>;
    excelToPdf(data: PdfOperationData): Promise<PdfOperationResult>;
    pptToPdf(data: PdfOperationData): Promise<PdfOperationResult>;
    deletePages(data: PdfOperationData): Promise<PdfOperationResult>;
    reorderPages(data: PdfOperationData): Promise<PdfOperationResult>;
    watermark(data: PdfOperationData): Promise<PdfOperationResult>;
    watermarkImage(data: PdfOperationData): Promise<PdfOperationResult>;
    crop(data: PdfOperationData): Promise<PdfOperationResult>;
    addPageNumbers(data: PdfOperationData): Promise<PdfOperationResult>;
    jpgToPdf(data: PdfOperationData): Promise<PdfOperationResult>;
    pdfToJpg(data: PdfOperationData): Promise<PdfOperationResult>;
    pdfThumbnail(data: { input: string; dpi?: number }): Promise<{ ok: boolean; thumb_path?: string; error?: string; page_count?: number }>;
    htmlToPdf(data: PdfOperationData): Promise<PdfOperationResult>;
    protect(data: PdfOperationData): Promise<PdfOperationResult>;
    unlock(data: PdfOperationData): Promise<PdfOperationResult>;
    repair(data: PdfOperationData): Promise<PdfOperationResult>;
    ocr(data: PdfOperationData): Promise<PdfOperationResult>;
    getPageInfo(data: PdfOperationData): Promise<{ ok: boolean; page_count?: number; pages?: Array<{ width: number; height: number }>; error?: string }>;
    copyOutputFile(source: string, destination: string): Promise<{ ok: boolean; error?: string }>;
    onProgress(callback: (data: { current: number; total: number; pages: number }) => void): () => void;
    // security moved to root level
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
