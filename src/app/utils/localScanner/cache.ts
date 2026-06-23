// ─────────────────────────────────────────────────────────────────────────────
// cache.ts — Pool de caché para procesamiento y OCR de PDFs
// ─────────────────────────────────────────────────────────────────────────────

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // convertir a entero 32 bits
  }
  return hash.toString(16);
}

export const pdfTextCache = new Map<string, Promise<string>>();

export async function performOCR(pdfPath: string, ocrCache?: Map<string, string>): Promise<string> {
  if (ocrCache?.has(pdfPath)) return ocrCache.get(pdfPath)!;
  if (!window.electronAPI?.ocrExtractText) return "";
  const text = await window.electronAPI.ocrExtractText(pdfPath);
  if (ocrCache) ocrCache.set(pdfPath, text);
  return text;
}

export async function parsePdfCached(filePath: string, maxPages?: number, mtimeMs?: number): Promise<string> {
  const cacheKey = `${simpleHash(filePath)}:${mtimeMs ?? 0}:${maxPages || 'all'}`;
  
  if (pdfTextCache.has(cacheKey)) {
    return pdfTextCache.get(cacheKey)!;
  }
  
  const parsePromise = (async () => {
    try {
      const result = await window.electronAPI.parsePdf(filePath, maxPages);
      return result?.text ?? '';
    } catch (e) {
      console.warn('[parsePdfCached] Error parsing PDF for', filePath, e);
      return '';
    }
  })();

  pdfTextCache.set(cacheKey, parsePromise);
  return parsePromise;
}
