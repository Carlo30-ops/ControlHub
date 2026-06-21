// ─────────────────────────────────────────────────────────────────────────────
// shared/types.ts — Fuente única de verdad para tipos compartidos
// Unificado: Consolida definiciones de localScanner, DataContext y database.ts
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
  parseError?: boolean;    // Marcado explícito cuando el worker falla procesando este PDF
  isDuplicate?: boolean;   // Marcado si es un COTU repetido en diferentes carpetas
  
  // Campos de Extracción Avanzada (desde contenido)
  patient?: string;
  nit?: string;
  policyNo?: string;
  identification?: string;
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
  stats?: ScanStats; // estadísticas de escaneo
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

/** 
 * Configuración global de la aplicación.
 * Unifica 'Settings' de DataContext y 'AppSettings' de shared.
 */
export interface AppSettings {
  columns: ColumnSettings;
  scanning: ScanningSettings;
  display: DisplaySettings;
  customInsurers: { name: string; aliases: string }[];
  
  // Campos de Operador y Módulos extra
  operatorName?: string;
  operatorEmail?: string;
  terapiasDir?: string;
  tesseractPath?: string;
  // Theme and recent folder (migrated from legacy localStorage)
  theme?: 'light' | 'dark';
  lastScanPath?: string;
}

/** Opciones para el motor de escaneo localScanner */
export interface ScanOptions {
  maxDepth?: number;
  onlyCotuFolders?: boolean;
  ignoreSystemFolders?: boolean;
  customInsurers?: { name: string; aliases: string }[];
  signal?: AbortSignal;
  scanId?: string;
  applyDateFilter?: boolean;
}
