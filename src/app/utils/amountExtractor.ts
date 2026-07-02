// ─────────────────────────────────────────────────────────────────────────────
// amountExtractor.ts — Motor de Extracción de Montos de Facturas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un string numérico con formato colombiano a número
 * Maneja formatos: "123.456,00", "123,456.00", "71.190", "71190"
 */
function parseCOPNumber(str: string): number {
  let cleaned = str.replace(/\s/g, '');
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasDot) {
    const lastDot = cleaned.lastIndexOf('.');
    const decimals = cleaned.length - lastDot - 1;
    if (decimals === 3) {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else if (hasComma) {
    const lastComma = cleaned.lastIndexOf(',');
    const decimals = cleaned.length - lastComma - 1;
    if (decimals === 3) {
      cleaned = cleaned.replace(/,/g, '');
    } else {
      cleaned = cleaned.replace(',', '.');
    }
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
  const keyDefinitions = [
    { label: 'TOTAL VENTA', priority: 1 },
    { label: 'VALOR TOTAL', priority: 1 },
    { label: 'TOTAL A PAGAR', priority: 1 },
    { label: 'NETO A PAGAR', priority: 1 },
    { label: 'COPAGO', priority: 2 },
    { label: 'RETE FUENTE', priority: 2 },
    { label: 'RETENCION DE IVA', priority: 2 },
    { label: 'RETENCION DE ICA', priority: 2 },
    { label: 'SUBTOTAL', priority: 3 },
  ];

  const customKeyDefinitions = customLabels.map(label => ({ label: label.toUpperCase(), priority: 1 }));
  const keys = [...customKeyDefinitions, ...keyDefinitions];

  const candidates: Array<{ value: number; priority: number; distance: number; key: string }> = [];

  keys.forEach(({ label, priority }) => {
    const keyIndex = normalized.indexOf(label);
    if (keyIndex !== -1) {
      foundAmounts.forEach(amt => {
        const dist = amt.index - keyIndex;
        if (dist > 0 && dist < maxDistance) {
          candidates.push({ value: amt.value, priority, distance: dist, key: label });
        }
      });
    }
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.distance - b.distance;
    });
    return candidates[0].value;
  }

  const filtered = foundAmounts
    .filter(a => a.value <= maxAmount)
    .sort((a, b) => b.value - a.value);
  
  return filtered.length > 0 ? filtered[0].value : 0;
}
