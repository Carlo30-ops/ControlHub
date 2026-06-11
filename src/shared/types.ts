// ─────────────────────────────────────────────────────────────────────────────
// shared/types.ts — Fuente única de verdad para tipos compartidos
// Usado por: localScanner.ts, DataContext.tsx, database.ts, preload.ts
// ─────────────────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  invoiceNumber: string;
  company: string;
  month: string;
  year: string;
  detail: string;
  filePath: string;
  amount: number; // 0 si no fue posible extraer
  date: string;   // Formato "DD/MM/YYYY"
  invoicePdfPath?: string; // Ruta al PDF identificado como factura
  parseError?: boolean;    // Marcado explícito cuando el worker explota procesando este PDF
}

export interface DuplicateEntry {
  invoiceNumber: string;
  keptPath: string;
  discardedPath: string;
}

export interface ScanStats {
  totalFilesProcessed: number;
  skippedByExtension: number;
  skippedByDateRange: number;
  skippedDuplicates: number;
  duplicatesLog: DuplicateEntry[];
  amountExtractionFailed: number;
  amountExtractionSuccess: number;
  invoicesIdentifiedByLayer1: number; // Identificadas por nombre de archivo rápido
  invoicesIdentifiedByLayer2: number; // Identificadas por lectura de contenido (CUFE)
}

export interface ScanResult {
  id: string;
  timestamp: string;
  type: 'day' | 'week' | 'month' | 'year' | 'custom';
  dateRange: { start: string; end: string };
  basePath: string;
  totalInvoices: number;
  invoices: Invoice[];
  exportPath?: string;
  scanDuration: number;
  stats?: ScanStats;
}

export interface ColumnSettings {
  invoiceNumber: boolean;
  company: boolean;
  month: boolean;
  year: boolean;
  detail: boolean;
  filePath: boolean;
  amount: boolean;
}

export interface ScanningSettings {
  onlyCotuFolders: boolean;
  ignoreSystemFolders: boolean;
  maxDepth: number;
}

export interface DisplaySettings {
  rowsPerPage: number;
  compactMode: boolean;
}

export interface AppSettings {
  columns: ColumnSettings;
  scanning: ScanningSettings;
  display: DisplaySettings;
  customInsurers: { name: string; aliases: string }[];
}
