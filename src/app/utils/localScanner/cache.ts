// ─────────────────────────────────────────────────────────────────────────────
// cache.ts — Pool de caché para procesamiento y OCR de PDFs
// ─────────────────────────────────────────────────────────────────────────────
import { logger } from "../logger";
import { getOcrFromCache, saveOcrToCache } from "./ocrCache";

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // convertir a entero 32 bits
  }
  return hash.toString(16);
}

export const pdfTextCache = new Map<string, Promise<string>>();

export async function performOCR(
  pdfPath: string, 
  ocrCache?: Map<string, string>,
  fileMtime?: number,
  enableOcrCache?: boolean,
  fileSize?: number,
  minFileSizeForOcr?: number,
  maxFileSizeForOcr?: number
): Promise<string> {
  // Primero verificar caché en memoria (sesión actual)
  if (ocrCache?.has(pdfPath)) return ocrCache.get(pdfPath)!;
  
  // Verificar caché persistente (IndexedDB) si está habilitado
  if (enableOcrCache && fileMtime !== undefined) {
    const cachedText = await getOcrFromCache(pdfPath, undefined, fileMtime);
    if (cachedText) {
      logger.debug('[OCR] Texto recuperado del caché persistente:', pdfPath);
      if (ocrCache) ocrCache.set(pdfPath, cachedText);
      return cachedText;
    }
  }
  
  // Verificar tamaño del archivo antes de intentar OCR
  if (fileSize !== undefined) {
    const minSize = minFileSizeForOcr ?? 1024; // 1KB default
    const maxSize = maxFileSizeForOcr ?? 10485760; // 10MB default
    
    if (fileSize < minSize) {
      logger.debug('[OCR] Archivo demasiado pequeño para OCR:', pdfPath, fileSize);
      return "";
    }
    
    if (fileSize > maxSize) {
      logger.debug('[OCR] Archivo demasiado grande para OCR:', pdfPath, fileSize);
      return "";
    }
  }
  
  // Si no está en caché, realizar OCR
  if (!window.electronAPI?.ocrExtractText) return "";
  const text = await window.electronAPI.ocrExtractText(pdfPath);
  
  // Guardar en caché de memoria
  if (ocrCache) ocrCache.set(pdfPath, text);
  
  // Guardar en caché persistente si está habilitado y tenemos metadatos del archivo
  if (enableOcrCache && fileMtime !== undefined && text) {
    await saveOcrToCache(pdfPath, text, 0, fileMtime);
    logger.debug('[OCR] Texto guardado en caché persistente:', pdfPath);
  }
  
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
      logger.error('[parsePdfCached] Error parsing PDF for', filePath, e);
      return '';
    }
  })();

  pdfTextCache.set(cacheKey, parsePromise);
  return parsePromise;
}
