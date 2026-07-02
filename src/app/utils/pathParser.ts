// ─────────────────────────────────────────────────────────────────────────────
// pathParser.ts — Extracción de Metadatos desde Rutas de Archivos
// ─────────────────────────────────────────────────────────────────────────────
import Fuse from "fuse.js";
import { Invoice } from "../../shared/types";

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Extrae código COTU de la ruta del archivo
 */
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
 * Extrae metadatos de un archivo desde su ruta
 * @param fileData - Datos del archivo (ruta y timestamp)
 * @param fuseEngine - Motor Fuse para matching de aseguradoras
 * @returns Objeto Invoice con metadatos extraídos o null
 */
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
    console.error('Error en extractMetadataFromPath:', error);
    return null;
  }
}
