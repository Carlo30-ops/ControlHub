// ─────────────────────────────────────────────────────────────────────────────
// amountExtractor.ts — Motor de Extracción de Montos de Facturas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un string numérico con formato colombiano a número
 * Maneja formatos: "123.456,00", "123,456.00", "71.190", "71190"
 */
function parseCOPNumber(str: string): number {
  let cleaned = str.replace(/\s/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  if (lastComma === -1 && lastDot === -1) {
    return parseFloat(cleaned);
  }
  
  if (lastComma > lastDot) {
    // Formato europeo: 123.456,00 -> 123456.00
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot !== -1) {
    // Formato americano: 123,456.00 -> 123456.00
    cleaned = cleaned.replace(/,/g, '');
  }
  return parseFloat(cleaned);
}

/**
 * Extrae monto de texto PDF — Motor por Proximidad (v3.3.0)
 * @param text - Texto extraído del PDF
 * @param options - Opciones configurables
 * @returns Monto extraído o 0 si no se encuentra
 */
export interface AmountExtractorOptions {
  maxAmount?: number; // Límite máximo de monto (default: 5000000)
  minAmount?: number; // Límite mínimo de monto (default: 1000)
  maxDistance?: number; // Distancia máxima entre etiqueta y monto (default: 500)
  customLabels?: string[]; // Etiquetas personalizadas para buscar
}

export function extractAmountFromText(text: string, options: AmountExtractorOptions = {}): number {
  const {
    maxAmount = 5000000,
    minAmount = 1000,
    maxDistance = 500,
    customLabels = []
  } = options;

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
  })).filter(a => a.value >= minAmount && a.value <= maxAmount);

  if (foundAmounts.length === 0) return 0;

  // 3. Buscar etiquetas clave y su posición
  const keys = [
    'TOTAL VENTA', 'SUBTOTAL', 'COPAGO', 'RETE FUENTE', 
    'RETENCION DE IVA', 'RETENCION DE ICA', 'VALOR TOTAL',
    'TOTAL A PAGAR', 'NETO A PAGAR',
    ...customLabels
  ];

  let bestAmount = 0;
  let minDistance = Infinity;

  keys.forEach(key => {
    const keyIndex = normalized.indexOf(key);
    if (keyIndex !== -1) {
      foundAmounts.forEach(amt => {
        const dist = amt.index - keyIndex;
        if (dist > 0 && dist < maxDistance && dist < minDistance) {
          minDistance = dist;
          bestAmount = amt.value;
        }
      });
    }
  });

  if (bestAmount > 0) return bestAmount;

  // Fallback: tomar el monto más grande
  const filtered = foundAmounts
    .filter(a => a.value <= maxAmount)
    .sort((a, b) => b.value - a.value);
  
  return filtered.length > 0 ? filtered[0].value : 0;
}
