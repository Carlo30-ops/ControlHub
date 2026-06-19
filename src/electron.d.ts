// ─────────────────────────────────────────────────────────────────────────────
// electron.d.ts — Declaración de tipos globales para window.electronAPI
// Fix #8:  Tipado completo para eliminar (window as any).electronAPI
// ─────────────────────────────────────────────────────────────────────────────

import { ScanResult, AppSettings } from './shared/types';

export interface DbStats {
  count: number;
  sizeMB: number;
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
}

export interface FolderUpdatedData {
  type: 'add' | 'unlink' | 'change';
  path: string;
}

interface ElectronAPI {
  // ── Diálogos ──────────────────────────────────────────────────────────────
  selectDirectory(): Promise<string | null>;
  selectFile(options?: SelectFileOptions | FileFilter[]): Promise<string | null>;
  selectSavePath(options?: any): Promise<string | null>;

  // ── Sistema de archivos ───────────────────────────────────────────────────
  readDirectory(
    dirPath: string,
    options?: { ignoredFolders?: string[]; maxDepth?: number; scanId?: string }
  ): Promise<{ files: { filePath: string; mtimeMs: number }[]; totalScanned: number }>;

  cancelScan(scanId: string): Promise<boolean>;

  parsePdf(pdfPath: string, maxPages?: number): Promise<{ text: string; numPages: number } | null>;

  readPdfAsBase64(pdfPath: string): Promise<{ success: boolean; data?: string; error?: string }>;

  listFiles(dirPath: string, extensions: string[]): Promise<string[]>;

  openExternal(filePath: string): Promise<boolean>;

  exportFile(options: ExportFileOptions): Promise<{ success: boolean; filePath?: string; error?: string }>;

  // ── Progreso de escaneo ───────────────────────────────────────────────────
  onScanProgress(callback: (data: ScanProgressData) => void): void;
  offScanProgress(): void;

  // ── Watcher en tiempo real ────────────────────────────────────────────────
  startWatch(dirPath: string): Promise<boolean>;
  stopWatch(): Promise<boolean>;
  onFolderUpdated(callback: (data: FolderUpdatedData) => void): void;
  offFolderUpdated(): void;

  // ── Base de datos local ───────────────────────────────────────────────────
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
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };

  dashboard: {
    getStats(): Promise<{ pendingDocs: number }>;
  };

  // ── Módulo de Terapias (Sidecar Python) ───────────────────────────────────
  onSidecarStatus(callback: (data: SidecarStatus) => void): void;
  offSidecarStatus(): void;
  reconnectSidecar(name: string): Promise<{ ok: boolean }>;

  terapias: {
    ping(): Promise<{ ok: boolean }>;
    checkWord(): Promise<{ ok: boolean; word_installed: boolean; message?: string; error?: string }>;
    listDocs(): Promise<{ ok: boolean; files: { name: string; modified: number; size: number }[]; error?: string }>;
    prepare(data: { input_name: string; filename: string; base_dest: string }): Promise<{ ok: boolean; folder: string; doc_path: string; patient: string; error?: string }>;
    finalize(data: { doc_path: string; backup: string; patient: string }): Promise<{ ok: boolean; pdf_path: string; backup_path: string; error?: string }>;
    getHistory(): Promise<{ ok: boolean; history: any[]; error?: string }>;
    searchPatient(data: { query: string; dest_root: string }): Promise<{ ok: boolean; results: any[]; error?: string }>;
  };

  pdfTools: {
    ping(): Promise<{ ok: boolean }>;
    merge(data: any): Promise<any>;
    compress(data: any): Promise<any>;
    split(data: any): Promise<any>;
    rotate(data: any): Promise<any>;
    extract(data: any): Promise<any>;
    wordToPdf(data: any): Promise<any>;
    pdfToWord(data: any): Promise<any>;
    excelToPdf(data: any): Promise<any>;
    pptToPdf(data: any): Promise<any>;
    deletePages(data: any): Promise<any>;
    reorderPages(data: any): Promise<any>;
    watermark(data: any): Promise<any>;
    watermarkImage(data: any): Promise<any>;
    crop(data: any): Promise<any>;
    addPageNumbers(data: any): Promise<any>;
    jpgToPdf(data: any): Promise<any>;
    pdfToJpg(data: any): Promise<any>;
    htmlToPdf(data: any): Promise<any>;
    protect(data: any): Promise<any>;
    unlock(data: any): Promise<any>;
    repair(data: any): Promise<any>;
    ocr(data: any): Promise<any>;
    getPageInfo(data: any): Promise<any>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
