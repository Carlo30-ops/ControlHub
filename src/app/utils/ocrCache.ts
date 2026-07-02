// ─────────────────────────────────────────────────────────────────────────────
// ocrCache.ts — Caché persistente de OCR usando IndexedDB
// ─────────────────────────────────────────────────────────────────────────────

interface OcrCacheEntry {
  filePath: string;
  text: string;
  fileSize: number;
  fileMtime: number;
  createdAt: number;
  lastAccessed: number;
}

const DB_NAME = 'ControlHubOCRCache';
const DB_VERSION = 1;
const STORE_NAME = 'ocrEntries';

let db: IDBDatabase | null = null;

/**
 * Inicializa la base de datos IndexedDB para el caché OCR
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'filePath' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
    };
  });
}

/**
 * Genera un hash simple de una ruta de archivo para usar como clave
 */
function hashPath(filePath: string): string {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a entero de 32 bits
  }
  return Math.abs(hash).toString(36);
}

/**
 * Obtiene el texto OCR del caché para un archivo específico
 * @param filePath Ruta del archivo PDF
 * @param fileSize Tamaño del archivo en bytes (para validación)
 * @param fileMtime Fecha de modificación del archivo (para validación)
 * @returns Texto OCR si existe en caché y es válido, null en caso contrario
 */
export async function getOcrFromCache(
  filePath: string,
  fileSize?: number,
  fileMtime?: number
): Promise<string | null> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(filePath);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as OcrCacheEntry | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // Validar que el archivo no haya cambiado
        if (fileSize !== undefined && entry.fileSize !== fileSize) {
          // Archivo cambió de tamaño, invalidar caché
          deleteOcrFromCache(filePath).catch(() => {});
          resolve(null);
          return;
        }

        if (fileMtime !== undefined && entry.fileMtime !== fileMtime) {
          // Archivo fue modificado, invalidar caché
          deleteOcrFromCache(filePath).catch(() => {});
          resolve(null);
          return;
        }

        // Actualizar último acceso
        updateLastAccessed(filePath).catch(() => {});

        resolve(entry.text);
      };
    });
  } catch (error) {
    console.error('Error getting OCR from cache:', error);
    return null;
  }
}

/**
 * Guarda texto OCR en el caché
 * @param filePath Ruta del archivo PDF
 * @param text Texto extraído por OCR
 * @param fileSize Tamaño del archivo en bytes
 * @param fileMtime Fecha de modificación del archivo
 */
export async function saveOcrToCache(
  filePath: string,
  text: string,
  fileSize: number,
  fileMtime: number
): Promise<void> {
  try {
    const database = await initDB();
    const entry: OcrCacheEntry = {
      filePath,
      text,
      fileSize,
      fileMtime,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error saving OCR to cache:', error);
  }
}

/**
 * Elimina una entrada específica del caché
 * @param filePath Ruta del archivo PDF
 */
export async function deleteOcrFromCache(filePath: string): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(filePath);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error deleting OCR from cache:', error);
  }
}

/**
 * Actualiza el último acceso de una entrada
 * @param filePath Ruta del archivo PDF
 */
async function updateLastAccessed(filePath: string): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(filePath);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as OcrCacheEntry | undefined;
        if (entry) {
          entry.lastAccessed = Date.now();
          const updateRequest = store.put(entry);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve();
        } else {
          resolve();
        }
      };
    });
  } catch (error) {
    console.error('Error updating last accessed:', error);
  }
}

/**
 * Limpia entradas del caché más antiguas que un número de días
 * @param days Número de días para mantener (default: 30)
 */
export async function cleanOldCacheEntries(days: number = 30): Promise<number> {
  try {
    const database = await initDB();
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastAccessed');
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
    });
  } catch (error) {
    console.error('Error cleaning old cache entries:', error);
    return 0;
  }
}

/**
 * Obtiene estadísticas del caché OCR
 */
export async function getOcrCacheStats(): Promise<{
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();
      const allRequest = store.getAll();

      countRequest.onerror = () => reject(countRequest.error);
      allRequest.onerror = () => reject(allRequest.error);

      countRequest.onsuccess = () => {
        allRequest.onsuccess = () => {
          const entries = allRequest.result as OcrCacheEntry[];
          const totalSize = entries.reduce((sum, entry) => sum + entry.text.length, 0);
          
          let oldestEntry: number | null = null;
          let newestEntry: number | null = null;

          if (entries.length > 0) {
            oldestEntry = Math.min(...entries.map(e => e.createdAt));
            newestEntry = Math.max(...entries.map(e => e.createdAt));
          }

          resolve({
            totalEntries: countRequest.result,
            totalSize,
            oldestEntry,
            newestEntry,
          });
        };
      };
    });
  } catch (error) {
    console.error('Error getting OCR cache stats:', error);
    return {
      totalEntries: 0,
      totalSize: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

/**
 * Limpia todo el caché OCR
 */
export async function clearOcrCache(): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error clearing OCR cache:', error);
  }
}
