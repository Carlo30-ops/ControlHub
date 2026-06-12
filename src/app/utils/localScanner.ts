// ─────────────────────────────────────────────────────────────────────────────
// localScanner.ts — Motor de Escaneo COTU Analytics v3.2.0
//
// FIX CRÍTICO — Problema 0: Identificación de cuál PDF es la factura
//   Nueva función identifyInvoicePdf() con sistema de scoring en 2 capas:
//   Capa 1: Scoring por nombre de archivo (O(1), sin leer PDFs)
//           Patrones directamente derivados de la tabla real de aseguradoras
//   Capa 2: Scoring por contenido de página 1 con keywords de FE colombiana
//           Solo se ejecuta si Capa 1 no produce un ganador claro
//   Extracción: Solo sobre el PDF ganador, leyendo TODAS las páginas
//
// Fix #1:  Memory leak — offScanProgress antes de registrar listener
// Fix #2:  fuseInsurers — ya NO es variable global mutable
// Fix #3:  AbortSignal con cancelación IPC real
// Fix #16: Día — primer match regex, no el último
// Fix #17: Regex COTU con sufijos alfanuméricos
// ─────────────────────────────────────────────────────────────────────────────
import Fuse from "fuse.js";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  company: string;
  month: string;
  year: string;
  detail: string;
  filePath: string;
  amount: number;
  date: string; // "DD/MM/YYYY"
  invoicePdfPath?: string; // Ruta al PDF identificado como factura electrónica
  parseError?: boolean;    // Marcado explícito si el worker de Electron crashea procesando esto
}

export interface ScanStats {
  totalFilesProcessed: number;
  skippedByExtension: number;
  skippedByDateRange: number;
  skippedDuplicates: number;
  duplicatesLog: { invoiceNumber: string; keptPath: string; discardedPath: string }[];
  amountExtractionFailed: number;
  amountExtractionSuccess: number;
  invoicesIdentifiedByLayer1: number;
  invoicesIdentifiedByLayer2: number;
}

interface ScanProgress {
  current: number;
  total: number;
  currentFile: string;
}

export interface ScanOptions {
  maxDepth?: number;
  onlyCotuFolders?: boolean;
  ignoreSystemFolders?: boolean;
  customInsurers?: { name: string; aliases: string }[];
  signal?: AbortSignal;
  scanId?: string;
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

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICACIÓN DE FACTURA — Capa 1: Scoring por nombre de archivo
//
// Patrones derivados directamente de la tabla real de nomenclatura por aseguradora:
//   ALLIANZ:   FAC_900175697_         → señal fuerte de factura
//   BOLIVAR:   FACT_COTU              → señal fuerte de factura
//   COLMENA:   FAC_900175697_COTU     → señal fuerte de factura
//   POSITIVA:  FAC_900175697_COTU     → señal fuerte de factura
//   PREVISORA: FAC_900175697_COTU     → señal fuerte de factura
//   LATAM:     FAC_900175697_COTU     → señal fuerte de factura
//   SOLIDARIA: FAC_900175697_         → señal fuerte de factura
//   SURA:      900175697_COTU_        → señal fuerte (NIT + COTU)
//   ESTADO SOAT: #COTU (sin _DOC ni _HC_CL) → señal moderada
//   El resto: COTU solo               → señal base positiva
//
//   EPI_    → Epicrisis (documento médico)      → señal fuerte NEGATIVA
//   DOC_    → Documentos varios                 → señal fuerte NEGATIVA
//   _HC_CL  → Historia Clínica                 → señal fuerte NEGATIVA
//   COTU_DOC, COTU_HC → variantes SOAT SURA     → señal fuerte NEGATIVA
// ─────────────────────────────────────────────────────────────────────────────

interface FilenameRule {
  pattern: RegExp;
  score: number;
  description: string;
}

const FILENAME_POSITIVE_RULES: FilenameRule[] = [
  // Prefijos explícitos de factura según la tabla
  { pattern: /^FAC_/i,                    score: 4, description: 'Prefijo FAC_ (múltiples aseguradoras)' },
  { pattern: /^FACT_/i,                   score: 4, description: 'Prefijo FACT_ (Bolívar)' },
  // SURA: empieza con NIT (9 dígitos) seguido de _COTU
  { pattern: /^\d{6,}_COTU/i,             score: 4, description: 'NIT_COTU_ (Sura)' },
  // ESTADO SOAT: #COTU sin sufijos de otros documentos
  { pattern: /^#COTU(?!_DOC|_HC)/i,       score: 3, description: '#COTU sin sufijo (Estado SOAT factura)' },
  // Nombre contiene explícitamente FACTURA
  { pattern: /FACTURA/i,                  score: 3, description: 'Nombre contiene FACTURA' },
  // Empieza con COTU (la mayoría de aseguradoras para la factura)
  { pattern: /^COTU/i,                    score: 1, description: 'Prefijo COTU base' },
];

const FILENAME_NEGATIVE_RULES: FilenameRule[] = [
  // Prefijos de Epicrisis/Historia Clínica
  { pattern: /^EPI_/i,                    score: -5, description: 'Prefijo EPI_ (Epicrisis)' },
  { pattern: /^DOC_/i,                    score: -5, description: 'Prefijo DOC_ (Documentos)' },
  // Sufijos de Historia Clínica
  { pattern: /_HC_CL/i,                   score: -5, description: 'Sufijo _HC_CL (Historia Clínica)' },
  // Variantes SOAT SURA / ESTADO SOAT para documentos
  { pattern: /^COTU_DOC/i,               score: -4, description: 'COTU_DOC (documentos SOAT SURA)' },
  { pattern: /^COTU_HC/i,                score: -4, description: 'COTU_HC (historia SOAT SURA)' },
  { pattern: /^#COTU_DOC/i,              score: -4, description: '#COTU_DOC (documentos Estado SOAT)' },
  { pattern: /^#COTU_HC/i,              score: -4, description: '#COTU_HC_CL (historia Estado SOAT)' },
  // Palabra SOPORTE en nombre
  { pattern: /SOPORTE/i,                  score: -3, description: 'Nombre contiene SOPORTE' },
];

function scoreByFilename(filename: string): number {
  let score = 0;
  for (const rule of FILENAME_POSITIVE_RULES) {
    if (rule.pattern.test(filename)) score += rule.score;
  }
  for (const rule of FILENAME_NEGATIVE_RULES) {
    if (rule.pattern.test(filename)) score += rule.score; // score ya es negativo
  }
  return score;
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICACIÓN DE FACTURA — Capa 2: Scoring por contenido (página 1)
//
// Keywords positivas únicas de una Factura Electrónica colombiana (DIAN)
// Keywords negativas que identifican documentos médicos/administrativos
// ─────────────────────────────────────────────────────────────────────────────

interface ContentRule {
  pattern: RegExp;
  weight: number;
  description: string;
}

const CONTENT_POSITIVE_RULES: ContentRule[] = [
  // CUFE es el identificador único de una FE colombiana — tiebreaker definitivo
  { pattern: /CUFE/i,                                              weight: 5, description: 'CUFE (único FE DIAN)' },
  // Título exacto de factura electrónica
  { pattern: /FACTURA\s+ELECTR[OÓ]NICA\s+DE\s+VENTA/i,           weight: 4, description: 'Título FE de venta' },
  // Total Venta — campo estándar en FE colombiana
  { pattern: /T\s*O\s*T\s*A\s*L\s+V\s*E\s*N\s*T\s*A/i,          weight: 3, description: 'TOTAL VENTA (con kerning)' },
  // Variante sin kerning roto
  { pattern: /TOTAL\s+VENTA/i,                                    weight: 3, description: 'TOTAL VENTA' },
  // Factura de venta (versión simplificada)
  { pattern: /FACTURA\s+DE\s+VENTA/i,                             weight: 2, description: 'Factura de venta' },
  // NIT del emisor
  { pattern: /\bNIT\b/i,                                          weight: 1, description: 'NIT del emisor' },
  // Campos comunes en FE
  { pattern: /\bSUBTOTAL\b/i,                                     weight: 1, description: 'Subtotal' },
  { pattern: /VALOR\s+TOTAL/i,                                    weight: 1, description: 'Valor Total' },
];

const CONTENT_NEGATIVE_RULES: ContentRule[] = [
  // Documentos clínicos — imposible que sea factura
  { pattern: /HISTORIA\s+CL[IÍ]NICA/i,                           weight: -6, description: 'Historia Clínica' },
  { pattern: /EPICRISIS/i,                                        weight: -6, description: 'Epicrisis' },
  // Otros documentos médicos/administrativos
  { pattern: /F[OÓ]RMULA\s+M[EÉ]DICA/i,                         weight: -4, description: 'Fórmula Médica' },
  { pattern: /AUTORIZACI[OÓ]N\s+DE\s+SERVICIOS/i,                weight: -4, description: 'Autorización de Servicios' },
  { pattern: /CONSENTIMIENTO\s+INFORMADO/i,                       weight: -4, description: 'Consentimiento Informado' },
  { pattern: /ORDEN\s+M[EÉ]DICA/i,                               weight: -2, description: 'Orden Médica' },
];

function scoreByContent(text: string): { score: number; hasCUFE: boolean } {
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

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFICACIÓN DE FACTURA — Orquestador principal
//
// Algoritmo:
//   1. Si solo hay 1 PDF → ese es la factura (siempre hay una según el dominio)
//   2. Capa 1: Scoring por nombre de archivo en todos los PDFs (O(1), sin I/O)
//      Si hay un ganador claro (score ≥ 2 y único) → retornar sin leer PDFs
//   3. Capa 2: Leer página 1 de cada PDF en paralelo y aplicar scoring de contenido
//      El PDF con mayor score total (nombre + contenido) es la factura
//   4. Tiebreaker: si empatan, gana el que tenga CUFE en su texto
// ─────────────────────────────────────────────────────────────────────────────

interface PdfCandidate {
  filePath: string;
  filename: string;
  filenameScore: number;
  contentScore: number;
  hasCUFE: boolean;
  totalScore: number;
}

async function identifyInvoicePdf(folderPath: string): Promise<{ invoicePath: string; confidence: 'high' | 'medium' | 'low'; layer: 1 | 2 } | null> {
  if (!window.electronAPI?.readDirectory || !window.electronAPI?.parsePdf) return null;

  // Listar todos los PDFs en el raíz de la carpeta COTU
  let pdfFiles: { filePath: string }[] = [];
  try {
    const { files } = await window.electronAPI.readDirectory(folderPath, { maxDepth: 1 });
    pdfFiles = files.filter(f => f.filePath.toLowerCase().endsWith('.pdf'));
  } catch (e) {
    console.error('[identifyInvoicePdf] Error listando PDFs en', folderPath, e);
    return null;
  }

  if (pdfFiles.length === 0) return null;

  // Solo hay un PDF → ese es la factura (el dominio garantiza que siempre hay una, esto cuenta como Capa 1 por no usar I/O)
  if (pdfFiles.length === 1) {
    return { invoicePath: pdfFiles[0].filePath, confidence: 'high', layer: 1 };
  }

  // ── Capa 1: Scoring por nombre de archivo (sin I/O de PDFs) ──────────────
  const candidates: PdfCandidate[] = pdfFiles.map(f => {
    const filename = f.filePath.split(/[\\\/]/).pop() ?? '';
    const filenameScore = scoreByFilename(filename);
    return {
      filePath: f.filePath,
      filename,
      filenameScore,
      contentScore: 0,
      hasCUFE: false,
      totalScore: filenameScore,
    };
  });

  // Buscar ganador claro por nombre (sin empate, score suficientemente alto)
  candidates.sort((a, b) => b.filenameScore - a.filenameScore);
  const best = candidates[0];
  const second = candidates[1];

  // Si el mejor tiene score ≥ 2 y supera al segundo por al menos 2 puntos → ganador claro
  if (best.filenameScore >= 2 && (best.filenameScore - second.filenameScore) >= 2) {
    console.log(`[identifyInvoicePdf] Ganador por nombre resolvió Capa 1: ${best.filename} (score: ${best.filenameScore})`);
    return { invoicePath: best.filePath, confidence: 'high', layer: 1 };
  }

  // ── Capa 2: Scoring por contenido — página 1 de cada PDF en paralelo ─────
  await Promise.all(candidates.map(async (candidate) => {
    try {
      // Solo leer página 1 para identificación — CUFE siempre está en pág. 1
      const res = await window.electronAPI.parsePdf(candidate.filePath, 1);
      const text = res?.text;
      if (text) {
        const { score, hasCUFE } = scoreByContent(text);
        candidate.contentScore = score;
        candidate.hasCUFE = hasCUFE;
        candidate.totalScore = candidate.filenameScore + score;
      }
    } catch (e) {
      // Si falla la lectura del PDF, ese candidato queda como está
      console.warn('[identifyInvoicePdf] Error leyendo pág. 1 de:', candidate.filename, e);
    }
  }));

  // Ordenar: mayor totalScore primero, CUFE como tiebreaker definitivo
  candidates.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (a.hasCUFE !== b.hasCUFE) return a.hasCUFE ? -1 : 1;
    return 0;
  });

  const winner = candidates[0];
  const confidence = winner.hasCUFE ? 'high' : winner.totalScore >= 3 ? 'medium' : 'low';

  console.log(`[identifyInvoicePdf] Ganador por contenido resolvió Capa 2: ${winner.filename} (confianza: ${confidence})`);

  return { invoicePath: winner.filePath, confidence, layer: 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsear número COP a float — soporta formatos colombiano y americano
// ─────────────────────────────────────────────────────────────────────────────
function parseCOPNumber(raw: string): number {
  const cleaned = raw.trim();
  // Formato colombiano: puntos como miles, coma como decimal → "1.500.000,50"
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  // Formato americano: comas como miles, punto como decimal → "1,500,000.50"
  if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  // Número simple con posible decimal → "1500000" o "1500000.50"
  if (/^\d+([.,]\d{1,2})?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return NaN;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraer monto de texto PDF — Motor multi-patrón
//
// Lee TODAS las páginas del PDF de factura (ya identificado previamente)
// Estrategia: 11 patrones explícitos en orden de especificidad → fallback a mayor valor
// ─────────────────────────────────────────────────────────────────────────────
function extractAmountFromText(text: string): number {
  // Preprocesar: eliminar NITs comunes para evitar confusión con montos
  const cleanText = text.replace(/\bNIT\s*[:\.]?\s*[\d.]+(-\d)?\b/gi, 'NIT_ID');

  // NUM estricto. (1 a 3 dígitos + separadores de miles) O (4+ dígitos sin separador).
  const NUM = `(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d{4,}(?:[.,]\\d{1,2})?)`;

  const explicitPatterns: RegExp[] = [
    new RegExp(`T\\s*O\\s*T\\s*A\\s*L\\s+V\\s*E\\s*N\\s*T\\s*A[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`TOTAL\\s+(?:A\\s+PAGAR|NETO|FACTURA|GENERAL)[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`VALOR\\s+(?:TOTAL|A\\s+PAGAR|NETO|DE\\s+LA\\s+P[ÓO]LIZA)[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`PRIMA\\s+(?:TOTAL|NETA|BRUTA|A\\s+PAGAR)[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`TOTAL[^0-9]{0,10}?(?!\\s*%|\\s*d[ií]as)[^0-9]{0,20}?${NUM}`, 'gi'),
    new RegExp(`(?:SALDO\\s+)?A\\s+PAGAR[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`NETO\\s+A\\s+PAGAR[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`IMPORTE\\s+(?:TOTAL|NETO|A\\s+PAGAR)?[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`SUBTOTAL[^0-9]{0,40}?${NUM}`, 'gi'),
    new RegExp(`\\$\\s*${NUM}`, 'gi'),
    new RegExp(`COP\\s*${NUM}`, 'gi'),
  ];

  for (const pattern of explicitPatterns) {
    const matches = [...cleanText.matchAll(pattern)];
    for (const match of matches) {
      const value = parseCOPNumber(match[1]);
      if (!isNaN(value) && value >= 1_000 && value <= 500_000_000) return value;
    }
  }

  // Fallback: Encontrar TODOS los montos con formato correcto, ordenarlos, 
  // e ignorar el mayor si es irrazonablemente gigante (>50M) asumiendo que es suma asegurada.
  const fallbackMatches = [...cleanText.matchAll(/\b\d{1,3}(?:[.,]\d{3}){1,3}(?:[.,]\d{1,2})?\b/g)];
  const validAmounts: number[] = [];
  
  for (const raw of fallbackMatches) {
    const value = parseCOPNumber(raw[0]);
    if (!isNaN(value) && value >= 10_000 && value <= 500_000_000) {
      validAmounts.push(value);
    }
  }

  validAmounts.sort((a, b) => b - a); // Descendente

  if (validAmounts.length > 0) {
    if (validAmounts[0] > 50_000_000 && validAmounts.length > 1) {
      return validAmounts[1];
    }
    return validAmounts[0];
  }
  
  return 0;
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
// Extraer metadata de un archivo (Fix #2: fuseEngine como parámetro, no global)
// ─────────────────────────────────────────────────────────────────────────────
function extractMetadataFromPath(
  fileData: { filePath: string; mtimeMs: number },
  fuseEngine: Fuse<{ name: string; alias: string }>
): Invoice | null {
  const { filePath, mtimeMs } = fileData;
  try {
    const pathParts = filePath.split(/[\\\/]/).filter(p => p.trim() !== '');
    const fileName = pathParts[pathParts.length - 1] || '';

    // Fix #17: Regex COTU con sufijos alfanuméricos
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

        // Fix Día v2: ÚLTIMO número válido en el path gana (igual que month).
        // Si el path tiene "04 ABRIL\21 ABRIL", day='04' se sobreescribe con '21'.
        // Fix #16 usaba `if (!day)` pero eso causaba que la carpeta de mes (p.ej. '04 ABRIL')
        // estableciera el día y la carpeta del día real ('21 ABRIL') quedara ignorada.
        // La carpeta COTU ya está excluida (isFile) así que no hay riesgo de sobreescritura espuria.
        const dayMatches = part.match(/\b(0?[1-9]|[12]\d|3[01])\b/g);
        if (dayMatches && dayMatches.length > 0) {
          day = dayMatches[0].padStart(2, '0');
        }
      }

      // Fix #2: fuseEngine pasado como parámetro, sin estado global
      const partLowerClean = partLower.replace(/[^a-z0-9\s]/g, '').trim();
      if (partLowerClean.length > 2) {
        const results = fuseEngine.search(partLowerClean);
        if (results.length > 0) company = results[0].item.name.toUpperCase();
      }
    }

    // Fallback: carpeta padre más cercana como compañía
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

    // Fallback temporal: fecha de modificación
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

    return {
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
  } catch (error) {
    console.error(`Error procesando archivo ${filePath}:`, error);
    return null;
  }
}

function pathContainsCotuFolder(filePath: string): boolean {
  return filePath.split(/[\\\/]/).some(p => /cotu/i.test(p));
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────
export function isFileSystemAccessSupported(): boolean { return true; }

export async function selectDirectoryFiles(): Promise<string | null> {
  if (window.electronAPI) return await window.electronAPI.selectDirectory();
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal de escaneo
// ─────────────────────────────────────────────────────────────────────────────
export async function scanLocalDirectory(
  dirPath: string,
  dateRange: { start: Date; end: Date },
  onProgress?: (progress: ScanProgress) => void,
  options?: ScanOptions
): Promise<{ invoices: Invoice[]; duration: number; stats: ScanStats }> {
  const startTime = performance.now();

  if (!window.electronAPI) {
    console.error('Electron API no disponible.');
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

  // Fix #3: Abort listener → cancela traversal en main process
  let abortHandler: (() => void) | null = null;
  if (options?.signal) {
    abortHandler = () => {
      window.electronAPI.cancelScan(scanId).catch(() => {});
    };
    options.signal.addEventListener('abort', abortHandler, { once: true });
  }

  // Fix #1: Limpiar listener previo antes de registrar el nuevo
  window.electronAPI.offScanProgress();
  if (onProgress) {
    window.electronAPI.onScanProgress(data => {
      onProgress({
        current: data.foundCount, total: 0,
        currentFile: `Explorando: ${data.currentFile} (${data.scannedCount} analizados)`,
      });
    });
  }

  // Fix #3: Pasar scanId para cancelación real
  const { files, totalScanned } = await window.electronAPI.readDirectory(
    dirPath, { ignoredFolders, maxDepth, scanId }
  );

  window.electronAPI.offScanProgress();

  if (abortHandler && options?.signal) {
    options.signal.removeEventListener('abort', abortHandler);
    abortHandler = null;
  }

  if (options?.signal?.aborted) throw new Error('AbortError');

  // Fix #2: Motor Fuse creado UNA vez por escaneo — no global mutable
  const fuseEngine = createFuzzyEngine(options?.customInsurers);

  const totalFiles = files.length;
  let processedFiles = 0;
  const invoiceNumbersMap = new Map<string, string>();
  let lastUpdateTime = performance.now();
  const CONCURRENCY_LIMIT = 5;
  const invoices: Invoice[] = [];

  const stats: ScanStats = {
    totalFilesProcessed: totalScanned || totalFiles,
    skippedByExtension: (totalScanned || totalFiles) - files.length,
    skippedByDateRange: 0, skippedDuplicates: 0, duplicatesLog: [],
    amountExtractionFailed: 0, amountExtractionSuccess: 0,
    invoicesIdentifiedByLayer1: 0, invoicesIdentifiedByLayer2: 0,
  };

  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    if (options?.signal?.aborted) throw new Error('AbortError');

    const chunk = files.slice(i, i + CONCURRENCY_LIMIT);

    const chunkResults = await Promise.all(
      chunk.map(async (fileData: { filePath: string; mtimeMs: number }) => {
        const { filePath } = fileData;
        const fileName = filePath.split(/[\\\/]/).pop() || '';

        const pathParts = filePath.split(/[\\\/]/);
        if (pathParts.some(p => DEFAULT_IGNORED_FOLDERS.includes(p))) {
          return { isSkipped: true, fileName };
        }
        if (onlyCotuFolders && !pathContainsCotuFolder(filePath)) {
          return { isSkipped: true, fileName };
        }

        const invoice = extractMetadataFromPath(fileData, fuseEngine);
        if (!invoice) return { isSkipped: true, fileName };

        let amountExtractionSuccess = false;
        let amountExtractionFailed = false;

        try {
          // ── PROBLEMA 0 Fix: Identificar cuál PDF es la factura ────────────
          // Fix #18: Pasar carpeta (dirPath) no el archivo completo
          const folderPath = filePath.split(/[\\\/]/).slice(0, -1).join('\\');
          const identified = await identifyInvoicePdf(folderPath);

          if (identified && window.electronAPI.parsePdf) {
            
            // Loguear estadística de observabilidad (Problema 0, futuro riesgo)
            if (identified.layer === 1) stats.invoicesIdentifiedByLayer1++;
            else stats.invoicesIdentifiedByLayer2++;

            // Leer TODAS las páginas del PDF de factura identificado
            const res = await window.electronAPI.parsePdf(identified.invoicePath);
            const text = res?.text; // Soporta retorno {text, pageCount}
            invoice.invoicePdfPath = identified.invoicePath;

            if (text) {
              const extracted = extractAmountFromText(text);
              if (extracted > 0) {
                invoice.amount = extracted;
                amountExtractionSuccess = true;
              } else {
                amountExtractionFailed = true;
              }
            } else {
              amountExtractionFailed = true;
            }
          } else {
            amountExtractionFailed = true;
          }
        } catch (e: any) {
          console.warn('[scan] Error en identificación/extracción para', filePath, e);
          amountExtractionFailed = true;
          // Marcar el fallo explícitamente si el proceso (Worker/UtilityProcess) crashó
          if (e.message && e.message.includes('Worker crashed')) {
            invoice.parseError = true;
          }
        }

        return { isSkipped: false, invoice, filePath, fileName, amountExtractionSuccess, amountExtractionFailed };
      })
    );

    for (const result of chunkResults) {
      processedFiles++;
      const now = performance.now();
      if (now - lastUpdateTime > 100) {
        onProgress?.({ current: processedFiles, total: totalFiles, currentFile: result.fileName });
        lastUpdateTime = now;
      }

      if (result.isSkipped || !result.invoice) continue;

      const { invoice, filePath, amountExtractionSuccess, amountExtractionFailed } = result;

      if (invoiceNumbersMap.has(invoice.invoiceNumber)) {
        stats.skippedDuplicates++;
        stats.duplicatesLog.push({
          invoiceNumber: invoice.invoiceNumber,
          keptPath: invoiceNumbersMap.get(invoice.invoiceNumber)!,
          discardedPath: filePath!,
        });
        invoice.invoiceNumber = `${invoice.invoiceNumber} (D${stats.skippedDuplicates})`;
      } else {
        invoiceNumbersMap.set(invoice.invoiceNumber, filePath!);
      }

      if (amountExtractionSuccess) stats.amountExtractionSuccess++;
      if (amountExtractionFailed) stats.amountExtractionFailed++;

      invoices.push(invoice);
    }
  }

  onProgress?.({ current: totalFiles, total: totalFiles, currentFile: 'Finalizando...' });

  // Filtrar por rango de fechas
  const filteredInvoices = invoices.filter(invoice => {
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
      // Ordenar por fecha descendente (más recientes primero)
      return new Date(yB, mB - 1, dB).getTime() - new Date(yA, mA - 1, dA).getTime();
    } catch {
      return 0;
    }
  });

  return { invoices: filteredInvoices, duration: performance.now() - startTime, stats };
}
