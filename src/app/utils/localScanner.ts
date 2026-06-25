// ─────────────────────────────────────────────────────────────────────────────
// localScanner.ts — Motor de Escaneo COTU Analytics v3.3.0
// ─────────────────────────────────────────────────────────────────────────────
import Fuse from "fuse.js";
import pLimit from "p-limit";
import { Invoice, ScanStats, ScanOptions, ScanLocalResult } from "../../shared/types";
import { logger } from "./logger";
import { handleError, ErrorType, createError } from "./errorHandler";

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // convertir a entero 32 bits
  }
  return hash.toString(16);
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR Fallback con Tesseract.js (Vía IPC al Main Process)
// ─────────────────────────────────────────────────────────────────────────────
async function performOCR(pdfPath: string, ocrCache?: Map<string, string>): Promise<string> {
  if (ocrCache?.has(pdfPath)) return ocrCache.get(pdfPath)!;
  if (!window.electronAPI?.ocrExtractText) return "";
  const text = await window.electronAPI.ocrExtractText(pdfPath);
  if (ocrCache) ocrCache.set(pdfPath, text);
  return text;
}

const pdfTextCache = new Map<string, Promise<string>>();

async function parsePdfCached(filePath: string, maxPages?: number, mtimeMs?: number): Promise<string> {
  const cacheKey = `${simpleHash(filePath)}:${mtimeMs ?? 0}:${maxPages || 'all'}`;
  
  if (pdfTextCache.has(cacheKey)) {
    return pdfTextCache.get(cacheKey)!;
  }
  
  const parsePromise = (async () => {
    try {
      const result = await window.electronAPI.parsePdf(filePath, maxPages);
      return result?.text ?? '';
    } catch (e) {
      handleError(e, 'parsePdfCached');
      return '';
    }
  })();

  pdfTextCache.set(cacheKey, parsePromise);
  return parsePromise;
}

interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
  stage?: 'exploring' | 'processing' | 'finalizing';
  scannedCount?: number;
  foundCount?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes del dominio
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_IGNORED_FOLDERS = [
  '.git', 'node_modules', '$RECYCLE.BIN', 'System Volume Information',
  'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData',
  '.vscode', '.idea', '__pycache__', '.cache', 'temp', 'tmp', 'RIPS'
];

export const KNOWN_INSURERS: Record<string, string[]> = {
  'ALFA': ['alfa'],
  'ALLIANZ': ['allianz'],
  'AURORA': ['aurora'],
  'AXXA COLPATRIA': ['axa', 'colpatria', 'axxa', 'axxa colpatria'],
  'BOLIVAR': ['bolivar', 'seguros bolivar'],
  'CENFAR': ['cenfar'],
  'COLMENA': ['colmena'],
  'COLSANITAS': ['colsanitas', 'sanitas'],
  'EQUIDAD': ['equidad'],
  'ESTADO': ['seguros del estado', 'estado', 'seg estado'],
  'ESTADO SOAT': ['estado soat', 'soat estado'],
  'HDI': ['hdi'],
  'IPS WTA LATAM S.A.S': ['wta', 'ips wta', 'latam'],
  'LIBERTY': ['liberty'],
  'MAPFRE': ['mapfre'],
  'MEDIPORT': ['mediport'],
  'MUNDIAL': ['mundial'],
  'POSITIVA': ['positiva'],
  'PREVISORA': ['previsora'],
  'SOAT SURA': ['soat sura', 'sura soat'],
  'SOLIDARIA': ['solidaria'],
  'SURA': ['sura', 'suramericana'],
};

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

async function resolveTargetDayFolder(basePath: string, targetDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    handleError('checkPathExists no disponible, fallback a full scan', 'PRE-PROBE');
    return null;
  }

  try {
    const year = targetDate.getFullYear().toString();
    const monthIndex = targetDate.getMonth();
    const monthNum = String(monthIndex + 1).padStart(2, '0');
    const monthNameUpper = MONTH_NAMES[monthIndex].toUpperCase();
    const dayNum = String(targetDate.getDate()).padStart(2, '0');

    logger.debug('[PRE-PROBE] buscando:', { year, monthNum, monthNameUpper, dayNum, basePath });

    const monthFolderCandidates = [
      `${monthNum}-${monthNameUpper}`,
      `${monthNum}-DE ${monthNameUpper}`,
      `${monthNum}. ${monthNameUpper}`,
      `${monthNum} ${monthNameUpper}`,
    ];

    const dayFolderCandidates = [
      `${dayNum} DE ${monthNameUpper}`,
      `${dayNum} ${monthNameUpper}`,
      `${dayNum}`,
    ];

    // 1) Intentar estructura clásica: basePath\\YEAR\\MONTH_FOLDER\\DAY_FOLDER
    for (const monthFolder of monthFolderCandidates) {
      for (const dayFolder of dayFolderCandidates) {
        const candidate = `${basePath}\\${year}\\${monthFolder}\\${dayFolder}`;
        logger.debug('[PRE-PROBE] probando (con año):', candidate);
        const result = await window.electronAPI.checkPathExists(candidate);
        logger.debug('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
        if (result?.exists) {
          logger.debug('[PRE-PROBE] ✅ ENCONTRADO (con año):', candidate);
          return candidate;
        }
      }
    }

    // 2) Intentar variantes con el mes como carpeta raíz (sin año)
    const monthSimpleCandidates = [monthNameUpper, monthNum, ...monthFolderCandidates];
    for (const monthFolder of monthSimpleCandidates) {
      for (const dayFolder of dayFolderCandidates) {
        const candidate = `${basePath}\\${monthFolder}\\${dayFolder}`;
        logger.debug('[PRE-PROBE] probando (sin año):', candidate);
        const result = await window.electronAPI.checkPathExists(candidate);
        logger.debug('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
        if (result?.exists) {
          logger.debug('[PRE-PROBE] ✅ ENCONTRADO (sin año):', candidate);
          return candidate;
        }
      }
    }

    // 3) Si no encontramos por nombre exacto, buscar carpetas inmediatas que contengan el mes
    try {
      if (window.electronAPI?.readDirectory) {
        const listRes = await window.electronAPI.readDirectory(basePath, { maxDepth: 1 });
        const uniqueDirs = new Set<string>();
        for (const f of listRes.files || []) {
          const rel = f.filePath.replace(basePath, '').replace(/^\\|\//, '');
          const parts = rel.split(/[\\\/]/).filter(Boolean);
          if (parts.length > 0) uniqueDirs.add(parts[0]);
        }

        for (const dirName of Array.from(uniqueDirs)) {
          const dnUpper = dirName.toUpperCase();
          if (dnUpper.includes(monthNameUpper) || dnUpper === monthNum || dnUpper.startsWith(monthNum)) {
            for (const dayFolder of dayFolderCandidates) {
              const candidate = `${basePath}\\${dirName}\\${dayFolder}`;
              logger.debug('[PRE-PROBE] probando (child probe):', candidate);
              const result = await window.electronAPI.checkPathExists(candidate);
              logger.debug('[PRE-PROBE] resultado:', { candidate, exists: result?.exists });
              if (result?.exists) {
                logger.debug('[PRE-PROBE] ✅ ENCONTRADO (child probe):', candidate);
                return candidate;
              }
            }
          }
        }
      }
    } catch (err) {
      handleError(err, 'PRE-PROBE child probe');
    }

    logger.debug('[PRE-PROBE] ❌ no match found, usando full scan');
  } catch (err) {
    handleError(err, 'PRE-PROBE resolveTargetDayFolder');
  }

  return null;
}

async function resolveTargetMonthFolder(basePath: string, targetDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    return null;
  }

  const year = targetDate.getFullYear().toString();
  const monthIndex = targetDate.getMonth();
  const monthNum = String(monthIndex + 1).padStart(2, '0');
  const monthNameUpper = MONTH_NAMES[monthIndex].toUpperCase();

  const monthFolderCandidates = [
    `${monthNum}-${monthNameUpper}`,
    `${monthNum}-DE ${monthNameUpper}`,
    `${monthNum}. ${monthNameUpper}`,
    `${monthNum} ${monthNameUpper}`,
    monthNameUpper,
    monthNum,
  ];

  for (const monthFolder of monthFolderCandidates) {
    const candidate = `${basePath}\\${year}\\${monthFolder}`;
    const result = await window.electronAPI.checkPathExists(candidate);
    if (result?.exists) {
      logger.debug('[PRE-PROBE] ✅ ENCONTRADO mes (con año):', candidate);
      return candidate;
    }
  }

  for (const monthFolder of monthFolderCandidates) {
    const candidate = `${basePath}\\${monthFolder}`;
    const result = await window.electronAPI.checkPathExists(candidate);
    if (result?.exists) {
      logger.debug('[PRE-PROBE] ✅ ENCONTRADO mes (sin año):', candidate);
      return candidate;
    }
  }

  try {
    const yearPath = `${basePath}\\${year}`;
    const yearExists = await window.electronAPI.checkPathExists(yearPath);
    if (yearExists?.exists && window.electronAPI?.readDirectory) {
      const listRes = await window.electronAPI.readDirectory(yearPath, { maxDepth: 1 });
      const uniqueDirs = new Set<string>();
      for (const f of listRes.files || []) {
        const rel = f.filePath.replace(yearPath, '').replace(/^\\|\//, '');
        const parts = rel.split(/[\\\/]/).filter(Boolean);
        if (parts.length > 0) uniqueDirs.add(parts[0]);
      }

      for (const dirName of Array.from(uniqueDirs)) {
        const dnUpper = dirName.toUpperCase();
        if (dnUpper.includes(monthNameUpper) || dnUpper === monthNum || dnUpper.startsWith(monthNum)) {
          const candidate = `${yearPath}\\${dirName}`;
          logger.debug('[PRE-PROBE] ✅ ENCONTRADO mes por child probe en año:', candidate);
          return candidate;
        }
      }
    }
  } catch (err) {
    handleError(err, 'PRE-PROBE child probe month');
  }

  return null;
}

async function resolveTargetRangeFolder(basePath: string, startDate: Date, endDate: Date): Promise<string | null> {
  if (!window.electronAPI?.checkPathExists) {
    return null;
  }

  const basename = basePath.replace(/[\\\/]+$/, '').split(/[\\\/]/).pop()?.toUpperCase() || '';
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startMonth = startDate.getMonth();

  if (startDate.getTime() === endDate.getTime()) {
    return resolveTargetDayFolder(basePath, startDate);
  }

  if (basename === String(startYear) || basename === String(endYear)) {
    const baseExists = await window.electronAPI.checkPathExists(basePath);
    if (baseExists?.exists) {
      return basePath;
    }
  }

  if (startDate.getFullYear() === endDate.getFullYear()) {
    if (startDate.getMonth() === endDate.getMonth()) {
      const monthPath = await resolveTargetMonthFolder(basePath, startDate);
      if (monthPath) {
        return monthPath;
      }
    }

    const yearPath = `${basePath}\\${startYear}`;
    const yearExists = await window.electronAPI.checkPathExists(yearPath);
    if (yearExists?.exists) {
      logger.debug('[PRE-PROBE] ✅ ENCONTRADO año para rango:', yearPath);
      return yearPath;
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICACIÓN DE FACTURA — Capa 1: Scoring por nombre de archivo
// ─────────────────────────────────────────────────────────────────────────────

interface FilenameRule {
  pattern: RegExp;
  score: number;
  description: string;
}

const FILENAME_POSITIVE_RULES: FilenameRule[] = [
  { pattern: /^FAC_900175697_COTU/i,      score: 10, description: 'Prefijo oficial FAC_NIT_COTU (Colmena, Latam, Positiva)' },
  { pattern: /^FAC_900175697_/i,          score: 10, description: 'Prefijo oficial FAC_NIT_ (Allianz, Equidad, Previsora, Solidaria)' },
  { pattern: /^FACT_COTU/i,               score: 10, description: 'Prefijo oficial FACT_COTU (Bolívar)' },
  { pattern: /^900175697_COTU_/i,         score: 10, description: 'Prefijo oficial NIT_COTU_ (Sura)' },
  { pattern: /^#COTU(?!_DOC|_HC)/i,       score: 8,  description: '#COTU factura (Estado SOAT)' },
  { pattern: /^COTU/i,                    score: 2,  description: 'Prefijo COTU (señal débil, múltiples aseguradoras)' },
  { pattern: /FACTURA/i,                  score: 3,  description: 'Nombre contiene FACTURA' },
];

const FILENAME_NEGATIVE_RULES: FilenameRule[] = [
  { pattern: /^EPI_900175697_COTU/i,      score: -15, description: 'Prefijo EPI_ (Epicrisis)' },
  { pattern: /^DOC_900175697_COTU/i,      score: -15, description: 'Prefijo DOC_ (Documentos)' },
  { pattern: /^EPI_900175697_PREFIJO#/i,  score: -15, description: 'EPI_NIT_PREFIJO# (Epicrisis Positiva)' },
  { pattern: /^#COTU_DOC/i,               score: -15, description: 'Sufijo #COTU_DOC (Documentos Estado SOAT)' },
  { pattern: /^#COTU_HC_CL/i,             score: -15, description: 'Sufijo #COTU_HC_CL (Historia Clínica Estado SOAT)' },
  { pattern: /^DOC_/i,                    score: -12, description: 'Prefijo DOC_ genérico' },
  { pattern: /^EPI_/i,                    score: -12, description: 'Prefijo EPI_ genérico' },
  { pattern: /SOPORTE/i,                  score: -5,  description: 'Nombre contiene SOPORTE' },
];

export function scoreByFilename(filename: string): number {
  let score = 0;
  for (const rule of FILENAME_POSITIVE_RULES) {
    if (rule.pattern.test(filename)) score += rule.score;
  }
  for (const rule of FILENAME_NEGATIVE_RULES) {
    if (rule.pattern.test(filename)) score += rule.score;
  }
  return score;
}

// Patrones permitidos para considerar un PDF como factura COTU relevante
function isTargetInvoiceFilename(filename: string): boolean {
  const name = filename.replace(/\.pdf$/i, '').trim();

  // Excluir claramente documentos no facturas antes de aceptar patrones amplios.
  const rejectPatterns: RegExp[] = [
    /^EPI_/i,
    /^DOC_/i,
    /^#COTU_DOC/i,
    /^#COTU_HC/i,
    /HISTORIA\s*CL[IÍ]NICA/i,
    /EPICRISIS/i,
    /F[OÓ]RMULA\s+M[EÉ]DICA/i,
  ];
  if (rejectPatterns.some(p => p.test(name))) {
    return false;
  }

  const patterns: RegExp[] = [
    /^FAC_900175697_COTU/i,
    /^FAC_900175697_/i,
    /^FACT_COTU/i,
    /^FAC_COTU/i,
    /^900175697_COTU_/i,
    /^#COTU(?!_DOC|_HC)/i,
    /^COTU\d+/i,
    /FAC_900175697/i,
    /900175697_COTU/i,
  ];
  return patterns.some(p => p.test(name));
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICACIÓN DE FACTURA — Capa 2: Scoring por contenido (página 1)
// ─────────────────────────────────────────────────────────────────────────────

interface ContentRule {
  pattern: RegExp;
  weight: number;
  description: string;
}

const CONTENT_POSITIVE_RULES: ContentRule[] = [
  { pattern: /CUFE/i,                                              weight: 10, description: 'CUFE (único FE DIAN)' },
  { pattern: /FACTURA\s+ELECTR[OÓ]NICA\s+DE\s+VENTA/i,           weight: 15, description: 'Título oficial FE de venta' },
  { pattern: /T\s*O\s*T\s*A\s*L\s+V\s*E\s*N\s*T\s*A/i,          weight: 5,  description: 'TOTAL VENTA (kerning)' },
  { pattern: /TOTAL\s+VENTA/i,                                    weight: 5,  description: 'TOTAL VENTA' },
  { pattern: /FACTURA\s+DE\s+VENTA/i,                             weight: 4,  description: 'Factura de venta' },
  { pattern: /\bNIT\b/i,                                          weight: 2,  description: 'NIT' },
  { pattern: /\bSUBTOTAL\b/i,                                     weight: 2,  description: 'Subtotal' },
  { pattern: /VALOR\s+TOTAL/i,                                    weight: 2,  description: 'Valor Total' },
];

const CONTENT_NEGATIVE_RULES: ContentRule[] = [
  { pattern: /HISTORIA\s+CL[IÍ]NICA/i,                           weight: -6, description: 'Historia Clínica' },
  { pattern: /EPICRISIS/i,                                        weight: -6, description: 'Epicrisis' },
  { pattern: /F[OÓ]RMULA\s+M[EÉ]DICA/i,                         weight: -4, description: 'Fórmula Médica' },
  { pattern: /AUTORIZACI[OÓ]N\s+DE\s+SERVICIOS/i,                weight: -4, description: 'Autorización de Servicios' },
  { pattern: /CONSENTIMIENTO\s+INFORMADO/i,                       weight: -4, description: 'Consentimiento Informado' },
  { pattern: /ORDEN\s+M[EÉ]DICA/i,                               weight: -2, description: 'Orden Médica' },
];

export function scoreByContent(text: string): { score: number; hasCUFE: boolean } {
  let score = 0;
  let hasCUFE = false;

  for (const rule of CONTENT_POSITIVE_RULES) {
    if (rule.pattern.test(text)) {
      score += rule.weight;
    }
  }
  if (/CUFE/i.test(text)) hasCUFE = true;

  for (const rule of CONTENT_NEGATIVE_RULES) {
    if (rule.pattern.test(text)) score += rule.weight;
  }

  return { score, hasCUFE };
}

interface PdfCandidate {
  filePath: string;
  filename: string;
  filenameScore: number;
  contentScore: number;
  hasCUFE: boolean;
  totalScore: number;
  mtimeMs: number;
}

export async function identifyInvoicePdf(folderPath: string, ocrCache?: Map<string, string>): Promise<{ invoicePath: string; confidence: 'high' | 'medium' | 'low'; layer: 1 | 2; mtimeMs: number } | null> {
  if (!window.electronAPI?.readDirectory || !window.electronAPI?.parsePdf) return null;

  let pdfFiles: { filePath: string; mtimeMs: number }[] = [];
  try {
    const { files } = await window.electronAPI.readDirectory(folderPath, { maxDepth: 1 });
    pdfFiles = files.filter(f => f.filePath.toLowerCase().endsWith('.pdf'));
    // Filtrar por nombres que realmente correspondan a facturas COTU según la lista del usuario
    pdfFiles = pdfFiles.filter(f => isTargetInvoiceFilename((f.filePath.split(/[\\\/]/).pop() || '')));
  } catch (e) {
    handleError(e, 'identifyInvoicePdf');
    return null;
  }

  if (pdfFiles.length === 0) return null;

  if (pdfFiles.length === 1) {
    const singleFilename = pdfFiles[0].filePath.split(/[\\\/]/).pop() || '';
    if (!isTargetInvoiceFilename(singleFilename)) {
      logger.debug('[identifyInvoicePdf] archivo único no es factura COTU explicita:', singleFilename);
      return null;
    }
    return { invoicePath: pdfFiles[0].filePath, confidence: 'high', layer: 1, mtimeMs: pdfFiles[0].mtimeMs };
  }

  const candidates: PdfCandidate[] = pdfFiles.map(f => {
    const filename = f.filePath.split(/[\\\/]/).pop() ?? '';
    let filenameScore = scoreByFilename(filename);

    // CASO ESPECIAL: Colsanitas COTU = Historia Clínica, NO factura
    if (/colsanitas/i.test(f.filePath) && /^COTU/i.test(filename)) {
      filenameScore -= 20; // Penalización drástica
    }

    return {
      filePath: f.filePath,
      filename,
      filenameScore,
      contentScore: 0,
      hasCUFE: false,
      totalScore: filenameScore,
      mtimeMs: f.mtimeMs
    };
  });

  candidates.sort((a, b) => b.filenameScore - a.filenameScore);
  const best = candidates[0];
  const second = candidates[1];

  if (best.filenameScore >= 2 && (best.filenameScore - second.filenameScore) >= 2) {
    return { invoicePath: best.filePath, confidence: 'high', layer: 1, mtimeMs: best.mtimeMs };
  }

  await Promise.all(candidates.map(async (candidate) => {
    try {
      let text = await parsePdfCached(candidate.filePath, 1, candidate.mtimeMs);

      // Fallback OCR si el texto es insuficiente (PDF escaneado)
      if (!text || text.trim().length < 50) {
        text = await performOCR(candidate.filePath, ocrCache);
      }

      if (text) {
        const { score, hasCUFE } = scoreByContent(text);
        candidate.contentScore = score;
        candidate.hasCUFE = hasCUFE;
        candidate.totalScore = candidate.filenameScore + score;
      }
    } catch (e) {
      handleError(e, 'identifyInvoicePdf');
    }
  }));

  candidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.hasCUFE !== b.hasCUFE) return a.hasCUFE ? -1 : 1;
    return 0;
  });

  const winner = candidates[0];
  const confidence = winner.hasCUFE ? 'high' : winner.totalScore >= 3 ? 'medium' : 'low';
  return { invoicePath: winner.filePath, confidence, layer: 2, mtimeMs: winner.mtimeMs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsear número COP a float — soporta formatos colombiano y americano
// ─────────────────────────────────────────────────────────────────────────────
export function parseCOPNumber(raw: string): number {
  let cleaned = raw.trim();
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  if (lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    cleaned = cleaned.replace(/,/g, '');
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(',', '.');
  }
  return parseFloat(cleaned);
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer monto de texto PDF — Motor por Proximidad (v3.3.0)
// ─────────────────────────────────────────────────────────────────────────────
export function extractAmountFromText(text: string): number {
  // 1. Normalizar etiquetas espaciadas: "T O T A L" -> "TOTAL"
  const normalized = text.replace(/([A-Z])\s+(?=[A-Z]\b)/g, '$1');
  
  // 2. Encontrar todos los montos con formato "123,456.00", "123.456,00", "71.190" o "71190"
  const amountRegex = /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,}(?:[.,]\d{2})?)\b/g;
  const matches = [...normalized.matchAll(amountRegex)];
  
  if (matches.length === 0) return 0;

  const foundAmounts = matches.map(m => ({
    value: parseCOPNumber(m[1]),
    index: m.index || 0,
    raw: m[1]
  })).filter(a => a.value >= 1000 && a.value <= 5000000); // Límite máximo de 5M

  if (foundAmounts.length === 0) return 0;

  // 3. Buscar etiquetas clave y su posición
  const keys = [
    'TOTAL VENTA', 'SUBTOTAL', 'COPAGO', 'RETE FUENTE', 
    'RETENCION DE IVA', 'RETENCION DE ICA', 'VALOR TOTAL',
    'TOTAL A PAGAR', 'NETO A PAGAR'
  ];

  let bestAmount = 0;
  let minDistance = Infinity;

  keys.forEach(key => {
    const keyIndex = normalized.indexOf(key);
    if (keyIndex !== -1) {
      foundAmounts.forEach(amt => {
        const dist = amt.index - keyIndex;
        if (dist > 0 && dist < 500 && dist < minDistance) {
          minDistance = dist;
          bestAmount = amt.value;
        }
      });
    }
  });

  if (bestAmount > 0) return bestAmount;

  const filtered = foundAmounts
    .filter(a => a.value <= 5000000) // Re-validación del límite
    .sort((a, b) => b.value - a.value);
  
  return filtered.length > 0 ? filtered[0].value : 0;
}

function extractCotuFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  for (let i = parts.length - 2; i >= 0; i--) {
    if (/^COTU\d+$/i.test(parts[i])) {
      return parts[i].toUpperCase();
    }
  }
  return '';
}

/**
 * Extrae metadatos adicionales del contenido de la factura
 */
function extractExtendedMetadata(text: string, invoice: Invoice) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('PACIENTE:') || lines[i].match(/CC\s+\d+/i) || lines[i].includes('IDENTIFICACION:')) {
      for (let j = 1; j <= 3; j++) {
        const candidate = lines[i+j];
        if (candidate && /^[A-Z\sÁÉÍÓÚÑ]{10,40}$/.test(candidate) && !candidate.includes('FACTURA')) {
          invoice.patient = candidate.trim();
          break;
        }
      }
      if (invoice.patient) break;
    }
  }

  const nitMatches = [...text.matchAll(/NIT:\s*([\d\.\-]+)/gi)];
  if (nitMatches.length > 0) {
    const val = nitMatches[0][1];
    if (!val.includes(',')) invoice.nit = val;
  }
  
  if (!invoice.nit) {
    const bigNumbers = text.match(/\b\d{9,10}\b/g);
    if (bigNumbers) invoice.nit = bigNumbers[bigNumbers.length - 1];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear motor Fuse para matching de aseguradoras (una instancia por escaneo)
// ─────────────────────────────────────────────────────────────────────────────
export function createFuzzyEngine(
  customInsurers?: { name: string; aliases: string }[]
): Fuse<{ name: string; alias: string }> {
  const list: { name: string; alias: string }[] = [];

  if (customInsurers) {
    customInsurers.forEach(ci => {
      ci.aliases.split(',').forEach(al => {
        if (al.trim()) list.push({ name: ci.name, alias: al.trim().toLowerCase() });
      });
      list.push({ name: ci.name, alias: ci.name.toLowerCase() });
    });
  }

  Object.entries(KNOWN_INSURERS).forEach(([canon, aliases]) => {
    aliases.forEach(al => list.push({ name: canon, alias: al }));
  });

  return new Fuse(list, { keys: ['alias'], threshold: 0.25, ignoreLocation: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer metadata de un archivo
// ─────────────────────────────────────────────────────────────────────────────
function extractMetadataFromPath(
  fileData: { filePath: string; mtimeMs: number },
  fuseEngine: Fuse<{ name: string; alias: string }>
): Invoice | null {
  const { filePath, mtimeMs } = fileData;
  try {
    const pathParts = filePath.split(/[\\\/]/).filter(p => p.trim() !== '');
    const fileName = pathParts[pathParts.length - 1] || '';

    const cotuPattern = /COTU[\s\-_]*(\d+[A-Z0-9\-]*)/i;
    let cotuMatch = fileName.match(cotuPattern);
    let invoiceNumber = '';
    let matchedString = '';

    if (cotuMatch) {
      invoiceNumber = `COTU${cotuMatch[1].toUpperCase()}`;
      matchedString = cotuMatch[0];
    } else {
      for (let i = pathParts.length - 1; i >= 0; i--) {
        const pMatch = pathParts[i].match(cotuPattern);
        if (pMatch) {
          invoiceNumber = `COTU${pMatch[1].toUpperCase()}`;
          matchedString = pMatch[0];
          break;
        }
      }
    }

    if (!invoiceNumber) return null;

    let detailCleaned = fileName;
    if (matchedString) detailCleaned = detailCleaned.replace(new RegExp(matchedString, 'i'), '');
    detailCleaned = detailCleaned.replace(/\.pdf$/i, '').replace(/^[\s\-_]+|[\s\-_]+$/g, '').trim();
    if (!detailCleaned) detailCleaned = invoiceNumber;

    let company = 'SIN ASEGURADORA';
    let year = '';
    let month = '';
    let monthNum = '';
    let day = '';

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const partLower = part.toLowerCase();
      const isFile = i === pathParts.length - 1;

      if (!isFile) {
        if (/^\d{4}$/.test(part)) {
          year = part;
        } else if (!year) {
          const yMatch = part.match(/\b(20\d{2})\b/);
          if (yMatch) year = yMatch[1];
        }

        const monthIndex = MONTH_NAMES.findIndex(m => partLower.includes(m));
        if (monthIndex >= 0) {
          month = MONTH_NAMES[monthIndex].charAt(0).toUpperCase() + MONTH_NAMES[monthIndex].slice(1);
          monthNum = (monthIndex + 1).toString().padStart(2, '0');
        } else if (/^(0?[1-9]|1[0-2])$/.test(part)) {
          const mInt = parseInt(part);
          month = MONTH_NAMES[mInt - 1].charAt(0).toUpperCase() + MONTH_NAMES[mInt - 1].slice(1);
          monthNum = mInt.toString().padStart(2, '0');
        } else if (/^\d+\.\s*\w+/.test(part)) {
          const mMatch = part.match(/\d+\.\s*(\w+)/);
          if (mMatch) {
            const mn = mMatch[1].toLowerCase();
            const mi = MONTH_NAMES.findIndex(m => mn.includes(m));
            if (mi >= 0) {
              month = MONTH_NAMES[mi].charAt(0).toUpperCase() + MONTH_NAMES[mi].slice(1);
              monthNum = (mi + 1).toString().padStart(2, '0');
            }
          }
        }

        const dayMatches = part.match(/\b(0?[1-9]|[12]\d|3[01])\b/g);
        if (dayMatches && dayMatches.length > 0) {
          day = dayMatches[0].padStart(2, '0');
        }
      }

      const partLowerClean = partLower.replace(/[^a-z0-9\s]/g, '').trim();
      if (partLowerClean.length > 2) {
        const results = fuseEngine.search(partLowerClean);
        if (results.length > 0) company = results[0].item.name.toUpperCase();
      }
    }

    if (company === 'SIN ASEGURADORA' && pathParts.length >= 2) {
      for (let i = pathParts.length - 2; i >= 0; i--) {
        const part = pathParts[i];
        const pl = part.toLowerCase();
        if (
          !/^\d{4}$/.test(part) && !/\b20\d{2}\b/.test(part) &&
          !MONTH_NAMES.some(m => pl.includes(m)) &&
          !pl.includes('cotu') && !pl.includes('facturas') &&
          !pl.includes('documentos') && !pl.includes('archivos') &&
          !pl.includes('rad') && !pl.includes('paquete') &&
          !pl.includes('envio') && !pl.includes('caso') &&
          part.length > 2
        ) {
          company = part.toUpperCase();
          break;
        }
      }
    }

    const dateMtime = mtimeMs ? new Date(mtimeMs) : new Date();
    if (!year) year = dateMtime.getFullYear().toString();
    if (!month) {
      month = MONTH_NAMES[dateMtime.getMonth()].charAt(0).toUpperCase() + MONTH_NAMES[dateMtime.getMonth()].slice(1);
      monthNum = (dateMtime.getMonth() + 1).toString().padStart(2, '0');
    }
    if (!monthNum && month) {
      const idx = MONTH_NAMES.findIndex(m => m.toLowerCase() === month.toLowerCase());
      monthNum = (idx >= 0 ? idx + 1 : dateMtime.getMonth() + 1).toString().padStart(2, '0');
    }
    if (!day) day = dateMtime.getDate().toString().padStart(2, '0');

    const invoice: Invoice = {
      id: `invoice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      invoiceNumber,
      company,
      month,
      year,
      detail: detailCleaned,
      filePath,
      amount: 0,
      date: `${day}/${monthNum}/${year}`,
    };

    const cotuFromPath = extractCotuFromPath(invoice.filePath);
    if (cotuFromPath) {
      invoice.invoiceNumber = cotuFromPath;
    }

    return invoice;
  } catch (error) {
    handleError(error, 'extractInvoiceData');
    return null;
  }
}

function pathContainsCotuFolder(filePath: string): boolean {
  return filePath.split(/[\\\/]/).some(p => /cotu/i.test(p));
}

export function isFileSystemAccessSupported(): boolean { return true; }

export async function selectDirectoryFiles(): Promise<string | null> {
  if (window.electronAPI) return await window.electronAPI.selectDirectory();
  return null;
}

export async function scanLocalDirectory(
  dirPath: string,
  dateRange: { start: Date; end: Date },
  onProgress?: (progress: ScanProgress) => void,
  options?: ScanOptions
): Promise<ScanLocalResult> {
  const startTime = performance.now();
  
  // Limpiar caché de PDF al inicio de cada escaneo
  pdfTextCache.clear();
  const ocrCache = new Map<string, string>();

  if (!window.electronAPI) {
    handleError('Electron API no disponible', 'scanLocal');
    return {
      invoices: [], duration: 0,
      stats: {
        totalFilesProcessed: 0, skippedByExtension: 0, skippedByDateRange: 0,
        skippedDuplicates: 0, duplicatesLog: [], amountExtractionFailed: 0, amountExtractionSuccess: 0,
        invoicesIdentifiedByLayer1: 0, invoicesIdentifiedByLayer2: 0,
      },
    };
  }

  const maxDepth = options?.maxDepth ?? 10;
  const onlyCotuFolders = options?.onlyCotuFolders ?? false;
  const ignoreSystemFolders = options?.ignoreSystemFolders ?? true;
  const ignoredFolders = ignoreSystemFolders ? DEFAULT_IGNORED_FOLDERS : [];
  const scanId = options?.scanId ?? `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  let scanPath = dirPath;
  let scanMaxDepth = maxDepth;
  let preProbeFallback = false;

  if (options?.targetDate) {
    const resolvedPath = await resolveTargetDayFolder(dirPath, options.targetDate);
    if (resolvedPath) {
      scanPath = resolvedPath;
      scanMaxDepth = 3;
    } else {
      preProbeFallback = true;
    }
  } else if (options?.targetDateRange) {
    const resolvedPath = await resolveTargetRangeFolder(dirPath, options.targetDateRange.start, options.targetDateRange.end);
    if (resolvedPath) {
      scanPath = resolvedPath;
      scanMaxDepth = 4;
    } else {
      preProbeFallback = true;
    }
  }

  let abortHandler: (() => void) | null = null;
  if (options?.signal) {
    abortHandler = () => {
      window.electronAPI.cancelScan(scanId).catch(() => {});
    };
    options.signal.addEventListener('abort', abortHandler, { once: true });
  }

  window.electronAPI.offScanProgress();
  if (onProgress) {
    window.electronAPI.onScanProgress(data => {
      onProgress({
        current: data.scannedCount,
        total: Math.max(data.scannedCount, 1),
        currentFile: `Explorando: ${data.currentFile} (${data.scannedCount} analizados, ${data.foundCount} PDF${data.foundCount === 1 ? '' : 's'})`,
        stage: 'exploring',
        scannedCount: data.scannedCount,
        foundCount: data.foundCount,
      });
    });
  }

  try {
    const { files, totalScanned } = await window.electronAPI.readDirectory(
      scanPath, { ignoredFolders, maxDepth: scanMaxDepth, scanId }
    );

    window.electronAPI.offScanProgress();

    if (abortHandler && options?.signal) {
      options.signal.removeEventListener('abort', abortHandler);
      abortHandler = null;
    }

    if (options?.signal?.aborted) throw new Error('AbortError');

    const fuseEngine = createFuzzyEngine(options?.customInsurers);

    const pdfFiles = files.filter(f => f.filePath.toLowerCase().endsWith('.pdf'));
    const folderMap = new Map<string, { folderPath: string; sampleFile: string; mtimeMs: number }>();

    for (const fileData of pdfFiles) {
      const parentFolder = fileData.filePath.split(/[\\\/]/).slice(0, -1).join('\\');
      if (folderMap.has(parentFolder)) continue;
      const folderParts = parentFolder.split(/[\\\/]/);
      if (folderParts.some(p => DEFAULT_IGNORED_FOLDERS.includes(p))) continue;
      if (onlyCotuFolders && !pathContainsCotuFolder(parentFolder) && !pathContainsCotuFolder(fileData.filePath)) continue;
      folderMap.set(parentFolder, { folderPath: parentFolder, sampleFile: fileData.filePath, mtimeMs: fileData.mtimeMs });
    }

    const totalFiles = folderMap.size;
    const stats: ScanStats = {
      totalFilesProcessed: totalScanned || files.length,
      skippedByExtension: (totalScanned || files.length) - pdfFiles.length,
      skippedByDateRange: 0, skippedDuplicates: 0, duplicatesLog: [],
      amountExtractionFailed: 0, amountExtractionSuccess: 0,
      invoicesIdentifiedByLayer1: 0, invoicesIdentifiedByLayer2: 0,
    };

    if (onProgress) {
      onProgress({
        current: 0,
        total: Math.max(totalFiles, 1),
        currentFile: `Procesando ${totalFiles} carpeta${totalFiles === 1 ? '' : 's'} de factura...`,
        stage: 'processing',
      });
    }

    if (totalFiles === 0) {
      onProgress?.({
        current: 0,
        total: 1,
        currentFile: 'No se encontraron facturas',
        stage: 'finalizing',
      });
      return { invoices: [], duration: performance.now() - startTime, stats };
    }

    let processedFiles = 0;
    const invoiceNumbersMap = new Map<string, string>();
    let lastUpdateTime = performance.now();
    
    // Concurrency limit using p-limit (10 concurrent tasks)
    const limit = pLimit(10);
    const invoices: Invoice[] = [];

    const results = await Promise.all(
      Array.from(folderMap.values()).map(folderData => limit(async () => {
        if (options?.signal?.aborted) return null;

        const { folderPath, sampleFile, mtimeMs } = folderData;
        const fileName = folderPath.split(/[\\\/]/).pop() || folderPath;

        const invoicePreview = extractMetadataFromPath({ filePath: sampleFile, mtimeMs }, fuseEngine);
        if (!invoicePreview) {
          return { isSkipped: true, fileName };
        }

        let amountExtractionSuccess = false;
        let amountExtractionFailed = false;
        let invoice: Invoice | null = null;
        let pdfPath = sampleFile;

        try {
          const identified = await identifyInvoicePdf(folderPath, ocrCache);
          if (!identified) {
            return { isSkipped: true, fileName };
          }

          if (identified.layer === 1) stats.invoicesIdentifiedByLayer1++;
          else stats.invoicesIdentifiedByLayer2++;

          const identifiedInvoice = extractMetadataFromPath({ filePath: identified.invoicePath, mtimeMs: identified.mtimeMs }, fuseEngine);
          invoice = identifiedInvoice || invoicePreview;
          invoice.invoicePdfPath = identified.invoicePath;
          pdfPath = identified.invoicePath;

          logger.debug('[SCAN] Leyendo PDF (página 1):', identified.invoicePath);
          let text = await parsePdfCached(identified.invoicePath, 1, identified.mtimeMs);
          if (!text || text.trim().length < 100) {
            text = await performOCR(identified.invoicePath, ocrCache);
          }

          logger.debug('[SCAN] Texto extraído:', text ? text.substring(0, 200) : 'VACÍO');

          if (text) {
            const extracted = extractAmountFromText(text);
            if (extracted > 0) {
              invoice.amount = extracted;
              amountExtractionSuccess = true;
            } else {
              amountExtractionFailed = true;
            }
            extractExtendedMetadata(text, invoice);
          } else {
            amountExtractionFailed = true;
          }
        } catch (err) {
          handleError(err, 'SCAN process folder');
          amountExtractionFailed = true;
        }

        return { isSkipped: false, invoice, filePath: pdfPath, fileName, amountExtractionSuccess, amountExtractionFailed };
      }))
    );

      for (const result of results) {
        if (!result) continue;
        processedFiles++;
        const now = performance.now();
        if (now - lastUpdateTime > 100) {
          onProgress?.({
            current: processedFiles,
            total: totalFiles,
            currentFile: result.fileName,
            stage: 'processing',
          });
          lastUpdateTime = now;
        }

        if (result.isSkipped || !result.invoice) continue;

        const { invoice, filePath, amountExtractionSuccess, amountExtractionFailed } = result;

        const currentFolder = filePath!.split(/[\\\/]/).slice(0, -1).join('\\');
        if (invoiceNumbersMap.has(invoice.invoiceNumber)) {
          const firstOccurrencePath = invoiceNumbersMap.get(invoice.invoiceNumber)!;
          const firstOccurrenceFolder = firstOccurrencePath.split(/[\\\/]/).slice(0, -1).join('\\');

          if (currentFolder !== firstOccurrenceFolder) {
            stats.skippedDuplicates++;
            stats.duplicatesLog.push({
              invoiceNumber: invoice.invoiceNumber,
              keptPath: firstOccurrencePath,
              discardedPath: filePath!,
            });
            invoice.isDuplicate = true;
            invoice.invoiceNumber = `${invoice.invoiceNumber} (D${stats.skippedDuplicates})`;
          } else {
            continue;
          }
        } else {
          invoiceNumbersMap.set(invoice.invoiceNumber, filePath!);
          if (amountExtractionSuccess) stats.amountExtractionSuccess++;
          if (amountExtractionFailed) stats.amountExtractionFailed++;
        }

        logger.debug('[SCAN] Invoice a guardar:', JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          patient: invoice.patient,
          isDuplicate: invoice.isDuplicate,
          file: invoice.detail
        }));

        invoices.push(invoice);
      }

    onProgress?.({
      current: totalFiles,
      total: totalFiles,
      currentFile: 'Finalizando...',
      stage: 'finalizing',
    });

    // Filtrar por rango de fechas (Solo si applyDateFilter es true)
    const filteredInvoices = invoices.filter(invoice => {
      if (!options?.applyDateFilter) return true; // Si no hay filtro activo, pasan todas

      try {
        if (!invoice.date) return false;
        const [dayStr, monthStr, yearStr] = invoice.date.split('/');
        const invoiceDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr), 12, 0, 0);
        const startDate = new Date(dateRange.start.getFullYear(), dateRange.start.getMonth(), dateRange.start.getDate(), 0, 0, 0);
        const endDate = new Date(dateRange.end.getFullYear(), dateRange.end.getMonth(), dateRange.end.getDate(), 23, 59, 59);
        const inRange = invoiceDate >= startDate && invoiceDate <= endDate;
        if (!inRange) stats.skippedByDateRange++;
        return inRange;
      } catch {
        return false;
      }
    });

    filteredInvoices.sort((a, b) => {
      try {
        if (!a.date || !b.date) return 0;
        const [dA, mA, yA] = a.date.split('/').map(Number);
        const [dB, mB, yB] = b.date.split('/').map(Number);
        if (isNaN(dA) || isNaN(dB)) return 0;
        return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
      } catch {
        return 0;
      }
    });

    return { invoices: filteredInvoices, duration: performance.now() - startTime, stats, preProbeFallback: preProbeFallback || undefined };

  } finally {
    // Cleanup scanId in main process after completion (success, error or abort)
    if (window.electronAPI?.cancelScan && scanId) {
      window.electronAPI.cancelScan(scanId).catch(() => {});
    }
  }
}
