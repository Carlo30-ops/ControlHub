// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// electron.d.ts â€” DeclaraciÃ³n de tipos globales para window.electronAPI
// Fix #8:  Tipado completo para eliminar (window as any).electronAPI
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  // â”€â”€ DiÃ¡logos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  selectDirectory(): Promise<string | null>;
  selectFile(options?: SelectFileOptions | FileFilter[]): Promise<string | null>;
  selectSavePath(options?: any): Promise<string | null>;

  // â”€â”€ Sistema de archivos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
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
    checkWord(): Promise<{ ok: boolean; word_installed: boolean; message?: string; error?: string }>;
    listDocs(): Promise<{ ok: boolean; files: { name: string; modified: number; size: number }[]; error?: string }>;
    prepare(data: any): Promise<{ ok: boolean; folder: string; doc_path: string; patient: string; error?: string }>;
    finalize(data: any): Promise<{ ok: boolean; pdf_path: string; backup_path: string; error?: string }>;
    getHistory(): Promise<{ ok: boolean; history: any[]; error?: string }>;
    searchPatient(data: any): Promise<{ ok: boolean; results: any[]; error?: string }>;
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
    pdfThumbnail(data: { input: string; dpi?: number }): Promise<{ ok: boolean; thumb_path?: string; error?: string }>;
    htmlToPdf(data: any): Promise<any>;
    protect(data: any): Promise<any>;
    unlock(data: any): Promise<any>;
    repair(data: any): Promise<any>;
    ocr(data: any): Promise<any>;
    getPageInfo(data: any): Promise<any>;
    // â”€â”€ Seguridad (IPC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    security: {
      /** Validate a dropped file path. Returns `{ok:true}` if allowed, otherwise `{ok:false, error}` */
      validateAndRegisterDroppedFile(path: string): Promise<{ ok: boolean; error?: string }>;
      /** Sync current active file list with the mainâ€‘process whitelist */
      syncActiveFiles(paths: string[]): Promise<{ ok: boolean; accepted?: number }>;
    };
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
