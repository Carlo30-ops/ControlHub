// ─────────────────────────────────────────────────────────────────────────────
// extractors.ts — Extracción de metadatos de facturas
// ─────────────────────────────────────────────────────────────────────────────

import Fuse from "fuse.js";
import { Invoice } from "../../../shared/types";
import { MONTH_NAMES } from "./pathResolver";

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

export function extractCotuFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  for (let i = parts.length - 2; i >= 0; i--) {
    if (/^COTU\d+$/i.test(parts[i])) {
      return parts[i].toUpperCase();
    }
  }
  return '';
}

export function extractExtendedMetadata(text: string, invoice: Invoice): void {
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

export function extractMetadataFromPath(
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
    console.error(`Error procesando archivo ${filePath}:`, error);
    return null;
  }
}
