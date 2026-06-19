import fs from 'fs';
import pdf from 'pdf-parse';
import path from 'path';

function parseCOPNumber(raw) {
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

function extractAmountFromText(text) {
  // 1. Normalizar etiquetas espaciadas: "T O T A L" -> "TOTAL"
  const normalized = text.replace(/([A-Z])\s+(?=[A-Z]\b)/g, '$1');
  
  // 2. Encontrar todos los montos con formato "123,456.00", "123.456,00", "71.190" o "71190"
  const amountRegex = /\b(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d{4,}(?:[.,]\d{2})?)\b/g;
  const matches = [...normalized.matchAll(amountRegex)];
  
  console.log('[DEBUG] Matches detectados:', matches.map(m => m[1]));

  if (matches.length === 0) return 0;

  const foundAmounts = matches.map(m => ({
    value: parseCOPNumber(m[1]),
    index: m.index || 0,
    raw: m[1]
  })).filter(a => a.value >= 1000);

  console.log('[DEBUG] Found amounts (>= 1000):', foundAmounts);

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

  if (bestAmount > 0) {
    console.log('[DEBUG] Best amount by proximity:', bestAmount);
    return bestAmount;
  }

  const filtered = foundAmounts
    .filter(a => a.value < 100000000)
    .sort((a, b) => b.value - a.value);
  
  console.log('[DEBUG] Fallback (largest):', filtered.length > 0 ? filtered[0].value : 0);
  return filtered.length > 0 ? filtered[0].value : 0;
}

function extractExtendedMetadata(text) {
  const COTU_REGEX = /Nro\.?\s*COTU\s*(\d{4,5})\b/i;
  let invoiceNumber = 'NOT_FOUND';

  // 1. Prioridad: Buscar en los primeros 500 caracteres (Encabezado)
  const headerText = text.substring(0, 500);
  const headerMatch = headerText.match(COTU_REGEX);
  
  if (headerMatch) {
    invoiceNumber = `COTU${headerMatch[1]}`;
  } else {
    // 2. Segundo intento: Dinámicamente detectar rangos de resolución DIAN para excluirlos
    const resolutionRanges = [...text.matchAll(/COTU\s*(\d+)\s*(?:al|a)\s*COTU\s*(\d+)/gi)];
    const excludedNumbers = new Set();
    resolutionRanges.forEach(m => {
      excludedNumbers.add(m[1]);
      excludedNumbers.add(m[2]);
    });

    // Limpiar rangos de resolución del texto para evitar matches espurios
    const cleanText = text.replace(/COTU\s*\d{5,}\s*(?:al|a)\s*COTU\s*\d{5,}/gi, 'RANGO_RESOLUCION');
    const fullMatch = cleanText.match(COTU_REGEX);
    
    if (fullMatch && !excludedNumbers.has(fullMatch[1])) {
      invoiceNumber = `COTU${fullMatch[1]}`;
    } else {
      // 3. Fallback: Último COTU de 4-5 dígitos que no sea parte de una resolución detectada
      const cotuMatches = [...cleanText.matchAll(/COTU\s*(\d+)/gi)];
      const valid = cotuMatches
        .filter(m => m[1].length >= 4 && m[1].length <= 5)
        .filter(m => !excludedNumbers.has(m[1]));
      
      if (valid.length > 0) {
        invoiceNumber = `COTU${valid[valid.length - 1][1]}`;
      }
    }
  }
  return invoiceNumber;
}

const pdfPath = 'FACTURA DE MUESTRA/FAC_900175697_COTU76412.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function(data) {
    console.log('=== TEXTO CRUDO COMPLETO ===');
    console.log(data.text);
    console.log('============================');
    
    const amount = extractAmountFromText(data.text);
    console.log('MONTO DETECTADO:', amount);
    const invoiceNumber = extractExtendedMetadata(data.text);
    console.log('NÚMERO COTU DETECTADO:', invoiceNumber);
}).catch(err => {
    console.error('Error procesando el PDF:', err);
});
