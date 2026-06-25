import { ipcRenderer, contextBridge, webUtils } from 'electron';

// ─────────────────────────────────────────────────────────────────────────────
// preload.ts — Bridge seguro entre Renderer y Main process
// Fix #9:  Todos los métodos bien tipados (se eliminaron @ts-ignore en renderer)
// Fix #3:  cancelScan expuesto para abortar traversal en main process
// Fix #11: trimHistory / getDbStats expuestos para gestión de almacenamiento
// ─────────────────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Diálogos ─────────────────────────────────────────────────────────────────────
  selectDirectory: () =>
    ipcRenderer.invoke('dialog:selectDirectory'),
  // New: Show Save Dialog
  selectSavePath: (options?: Electron.SaveDialogOptions) =>
    ipcRenderer.invoke('dialog-save-path', options),
  selectFile: (options?: { filters?: { name: string; extensions: string[] }[]; defaultPath?: string } | { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('dialog:selectFile', options),

  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  security: {
    validateAndRegisterDroppedFile: (path: string) =>
      ipcRenderer.invoke('security:validateAndRegisterDroppedFile', path),

    syncActiveFiles: (paths: string[]) =>
      ipcRenderer.invoke('security:syncActiveFiles', paths),

    registerApprovedDirectory: (path: string) =>
      ipcRenderer.invoke('security:registerApprovedDirectory', path),
  },

  // ── Sistema de archivos ─────────────────────────────────────────────────────────────

  /** Fix #3: Acepta scanId para habilitar cancelación IPC real */
  readDirectory: (
    dirPath: string,
    options?: { ignoredFolders?: string[]; maxDepth?: number; scanId?: string }
  ) => ipcRenderer.invoke('fs:readDirectory', dirPath, options),

  checkPathExists: (path: string) => ipcRenderer.invoke('fs:checkPath', path),

  /** Fix #3: Cancela la traversal activa con el scanId dado */
  cancelScan: (scanId: string) =>
    ipcRenderer.invoke('fs:cancelScan', scanId),

  /** maxPages=1 para identificación rápida, sin maxPages para extracción completa */
  parsePdf: (pdfPath: string, maxPages?: number) =>
    ipcRenderer.invoke('fs:parsePdf', pdfPath, maxPages),

  readPdfAsBase64: (pdfPath: string) => 
    ipcRenderer.invoke('fs:readPdfAsBase64', pdfPath),

  listFiles: (dirPath: string, extensions: string[]) =>
    ipcRenderer.invoke('fs:listFiles', dirPath, extensions),

  openExternal: (filePath: string) =>
    ipcRenderer.invoke('fs:openExternal', filePath),

  exportFile: (options: {
    defaultFilename: string;
    content: string | Uint8Array;
    filters?: { name: string; extensions: string[] }[];
  }) => ipcRenderer.invoke('fs:exportFile', options),

  // ── Progreso de escaneo ─────────────────────────────────────────────────────────────
  onScanProgress: (callback: (data: { currentFile: string; scannedCount: number; foundCount: number }) => void) => {
    ipcRenderer.on('scan-progress', (_event, data) => callback(data));
  },
  offScanProgress: () => {
    ipcRenderer.removeAllListeners('scan-progress');
  },

  // ── Watcher de carpeta en tiempo real ─────────────────────────────────────────────
  startWatch: (dirPath: string) => ipcRenderer.invoke('fs:startWatch', dirPath),
  stopWatch: () => ipcRenderer.invoke('fs:stopWatch'),
  onFolderUpdated: (callback: (data: { type: string; path: string }) => void) => {
    ipcRenderer.on('scanner:new-file', (_event, data) => callback(data));
  },
  offFolderUpdated: () => {
    ipcRenderer.removeAllListeners('scanner:new-file');
  },

  // ── Base de Datos Local ─────────────────────────────────────────────────────────────
  getHistory: () => ipcRenderer.invoke('db:getHistory'),
  saveScan: (scan: any) => ipcRenderer.invoke('db:saveScan', scan),
  deleteScan: (id: string) => ipcRenderer.invoke('db:deleteScan', id),
  clearHistory: () => ipcRenderer.invoke('db:clearHistory'),

  getSettings: () => ipcRenderer.invoke('db:getSettings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('db:saveSettings', settings),

  /** Fix: OCR Fallback desde el proceso principal */
  ocrExtractText: (pdfPath: string) => ipcRenderer.invoke('ocr:extractText', pdfPath),

  /** Fix #11: Recortar historial conservando solo los últimos `keepCount` escaneos */
  trimHistory: (keepCount: number) => ipcRenderer.invoke('db:trimHistory', keepCount),

  /** Fix #11: Obtener estadísticas del archivo de base de datos (tamaño, cantidad) */
  getDbStats: () => ipcRenderer.invoke('db:getStats'),

  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openFile: (path: string) => ipcRenderer.invoke('open-file', path),
    revealInFolder: (path: string) => ipcRenderer.invoke('reveal-in-folder', path),
  },

  // ── Configuración Persistente ─────────────────────────────────────────────────────
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
  },

  // ── Tesseract validation (C5) ─────────────────────────────────────────────────────
  tesseract: {
    validate: (exePath: string) => ipcRenderer.invoke('tesseract:validate', exePath),
  },

  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:stats'),
  },

  // ── Módulo de Terapias (Sidecar Python) ─────────────────────────────────────────────
  onSidecarStatus: (callback: (data: { name: string; status: string; code?: number }) => void) => {
    ipcRenderer.on('sidecar:status', (_event, data) => callback(data));
  },
  offSidecarStatus: () => {
    ipcRenderer.removeAllListeners('sidecar:status');
  },
  reconnectSidecar: (name: string) => ipcRenderer.invoke('sidecar:reconnect', name),

  terapias: {
    ping: () => ipcRenderer.invoke('terapias:ping'),
    checkWord: (wordExecutablePath?: string) => ipcRenderer.invoke('terapias:check_word', wordExecutablePath),
    listDocs: () => ipcRenderer.invoke('terapias:list_docs'),
    prepare: (data: any) => ipcRenderer.invoke('terapias:prepare', data),
    finalize: (data: any) => ipcRenderer.invoke('terapias:finalize', data),
    getHistory: () => ipcRenderer.invoke('terapias:get_history'),
    searchPatient: (data: any) => ipcRenderer.invoke('terapias:search_patient', data),
  },

  pdfTools: {
    ping: () => ipcRenderer.invoke('pdf:ping'),
    merge: (data: any) => ipcRenderer.invoke('pdf:merge', data),
    compress: (data: any) => ipcRenderer.invoke('pdf:compress', data),
    split: (data: any) => ipcRenderer.invoke('pdf:split', data),
    rotate: (data: any) => ipcRenderer.invoke('pdf:rotate', data),
    extract: (data: any) => ipcRenderer.invoke('pdf:extract', data),
    wordToPdf: (data: any) => ipcRenderer.invoke('pdf:word_to_pdf', data),
    pdfToWord: (data: any) => ipcRenderer.invoke('pdf:pdf_to_word', data),
    excelToPdf: (data: any) => ipcRenderer.invoke('pdf:excel_to_pdf', data),
    pptToPdf: (data: any) => ipcRenderer.invoke('pdf:ppt_to_pdf', data),
    // Nuevas herramientas
    deletePages: (data: any) => ipcRenderer.invoke('pdf:delete_pages', data),
    reorderPages: (data: any) => ipcRenderer.invoke('pdf:reorder_pages', data),
    watermark: (data: any) => ipcRenderer.invoke('pdf:watermark', data),
    watermarkImage: (data: any) => ipcRenderer.invoke('pdf:watermark_image', data),
    crop: (data: any) => ipcRenderer.invoke('pdf:crop', data),
    addPageNumbers: (data: any) => ipcRenderer.invoke('pdf:add_page_numbers', data),
    jpgToPdf: (data: any) => ipcRenderer.invoke('pdf:jpg_to_pdf', data),
    pdfToJpg: (data: any) => ipcRenderer.invoke('pdf:pdf_to_jpg', data),
    pdfThumbnail: (data: any) => ipcRenderer.invoke('pdf:pdf_thumbnail', data),
    htmlToPdf: (data: any) => ipcRenderer.invoke('pdf:html_to_pdf', data),
    protect: (data: any) => ipcRenderer.invoke('pdf:protect', data),
    unlock: (data: any) => ipcRenderer.invoke('pdf:unlock', data),
    repair: (data: any) => ipcRenderer.invoke('pdf:repair', data),
    ocr: (data: any) => ipcRenderer.invoke('pdf:ocr', data),
    getPageInfo: (data: any) => ipcRenderer.invoke('pdf:get_page_info', data),
    // (security moved to root level)
  },
});
