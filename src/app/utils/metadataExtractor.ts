// ─────────────────────────────────────────────────────────────────────────────
// metadataExtractor.ts — Extracción de Metadatos Adicionales de Facturas
// ─────────────────────────────────────────────────────────────────────────────
import { Invoice } from "../../shared/types";

/**
 * Extrae metadatos adicionales del contenido de la factura
 * @param text - Texto extraído del PDF
 * @param invoice - Objeto Invoice a completar con metadatos
 */
export function extractExtendedMetadata(text: string, invoice: Invoice): void {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // Extraer nombre del paciente
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('PACIENTE:') || lines[i].match(/CC\s+\d+/i) || lines[i].includes('IDENTIFICACION:')) {
      for (let j = 1; j <= 3; j++) {
        const candidate = lines[i + j];
        if (candidate && /^[A-Z\sÁÉÍÓÚÑ]{10,40}$/.test(candidate) && !candidate.includes('FACTURA')) {
          invoice.patient = candidate.trim();
          break;
        }
      }
      if (invoice.patient) break;
    }
  }

  // Extraer NIT
  const nitMatches = [...text.matchAll(/NIT:\s*([\d\.\-]+)/gi)];
  if (nitMatches.length > 0) {
    const val = nitMatches[0][1];
    if (!val.includes(',')) invoice.nit = val;
  }
  
  // Fallback: buscar números grandes (9-10 dígitos) como NIT
  if (!invoice.nit) {
    const bigNumbers = text.match(/\b\d{9,10}\b/g);
    if (bigNumbers) invoice.nit = bigNumbers[bigNumbers.length - 1];
  }
}
