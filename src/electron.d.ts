// ─────────────────────────────────────────────────────────────────────────────
// electron.d.ts — Declaración de tipos globales para window.electronAPI
// Fix #9:  Elimina todos los @ts-ignore en componentes React que usan IPC
// Fix #3:  cancelScan tipado
// Fix #11: trimHistory / getDbStats tipados
// ─────────────────────────────────────────────────────────────────────────────

export interface DbStats {
  count: number;
  sizeMB: number;
  path: string;
}

interface ElectronAPI {
  // ── Diálogos ──────────────────────────────────────────────────────────────
  selectDirectory(): Promise<string | null>;

  // ── Sistema de archivos ───────────────────────────────────────────────────

  /** Fix #3: scanId habilita cancelación real via IPC */
  readDirectory(
    dirPath: string,
    options?: { ignoredFolders?: string[]; maxDepth?: number; scanId?: string }
  ): Promise<{ files: { filePath: string; mtimeMs: number }[]; totalScanned: number }>;

  /** Fix #3: Cancela la traversal de readDirectory identificada por scanId */
  cancelScan(scanId: string): Promise<boolean>;

  /** maxPages=1 → solo página 1 (identificación rápida). Sin maxPages → todas las páginas (extracción). */
  parsePdf(pdfPath: string, maxPages?: number): Promise<string | null>;

  openExternal(filePath: string): Promise<boolean>;

  exportFile(options: {
    defaultFilename: string;
    content: string | Uint8Array;
    filters?: { name: string; extensions: string[] }[];
  }): Promise<{ success: boolean; filePath?: string; error?: string }>;

  // ── Progreso de escaneo ───────────────────────────────────────────────────
  onScanProgress(
    callback: (data: { currentFile: string; scannedCount: number; foundCount: number }) => void
  ): void;
  offScanProgress(): void;

  // ── Watcher en tiempo real ────────────────────────────────────────────────
  startWatch(dirPath: string): Promise<boolean>;
  stopWatch(): Promise<boolean>;
  onFolderUpdated(callback: (data: { type: string; path: string }) => void): void;
  offFolderUpdated(): void;

  // ── Base de datos local ───────────────────────────────────────────────────
  getHistory(): Promise<any[]>;
  saveScan(scan: any): Promise<any[]>;
  deleteScan(id: string): Promise<any[]>;
  clearHistory(): Promise<void>;
  getSettings(): Promise<any | null>;
  saveSettings(settings: any): Promise<any>;

  /** Fix #11: Recorta el historial a los últimos `keepCount` escaneos */
  trimHistory(keepCount: number): Promise<any[]>;

  /** Fix #11: Retorna estadísticas del archivo database.json */
  getDbStats(): Promise<DbStats>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
