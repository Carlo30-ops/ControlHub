// ─────────────────────────────────────────────────────────────────────────────
// invoiceIdentifier.ts — Reglas de scoring y motor de identificación de facturas
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";
import { parsePdfCached, performOCR } from "./cache";

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

export function isTargetInvoiceFilename(filename: string): boolean {
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
    console.error('[identifyInvoicePdf] Error listando PDFs en', folderPath, e);
    return null;
  }

  if (pdfFiles.length === 0) return null;

  if (pdfFiles.length === 1) {
    const singleFilename = pdfFiles[0].filePath.split(/[\\\/]/).pop() || '';
    if (!isTargetInvoiceFilename(singleFilename)) {
      console.log('[identifyInvoicePdf] archivo único no es factura COTU explicita:', singleFilename);
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
      console.warn('[identifyInvoicePdf] Error leyendo pág. 1 de:', candidate.filename, e);
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
