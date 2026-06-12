import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn, ChildProcess } from 'child_process';
import chokidar, { FSWatcher } from 'chokidar';
import Store from 'electron-store';
import { dbOptions } from './database';
import { WorkerPool } from './workerPool';

// ─────────────────────────────────────────────────────────────────────────────
// main.ts — Proceso principal de Electron — ControlHub v1.0.0
// ─────────────────────────────────────────────────────────────────────────────

const store = new Store();
const DEFAULT_TERAPIAS_DIR = "C:\\Users\\factu\\OneDrive\\Documentos 1\\TERAPIAS\\DOCUMENTOS PARA ARMAR";

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app?.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let win: BrowserWindowType | null;
let globalWatcher: FSWatcher | null = null;

// Fix #10: Pool de Workers PDF — creado al primer uso, reutilizado durante toda la sesión
let pdfWorkerPool: WorkerPool | null = null;

// Fix #3: Set de scan IDs activos — cuando se elimina el ID, el traversal se detiene
const activeScanIds = new Set<string>();

// Fix #15: Mapa de timers de debounce por ruta de archivo
const watcherDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

// ─────────────────────────────────────────────────────────────────────────────
// Sidecar Manager: Gestión unificada de procesos Python
// ─────────────────────────────────────────────────────────────────────────────
class SidecarManager {
  private process: ChildProcess | null = null;
  private name: string;
  private scriptPath: string;
  private pendingResolvers: Array<(value: any) => void> = [];
  private stdoutBuffer: string = "";

  constructor(name: string, scriptPath: string) {
    this.name = name;
    this.scriptPath = scriptPath;
  }

  start() {
    console.log(`[main] Iniciando Sidecar ${this.name}:`, this.scriptPath);
    const pythonExe = getPythonExecutable();
    this.process = spawn(pythonExe, [this.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    if (win) {
      win.webContents.send('sidecar:status', { name: this.name, status: 'running' });
    }

    this.process.stdout?.on("data", (data) => {
      this.stdoutBuffer += data.toString();
      let lineEndIndex;
      while ((lineEndIndex = this.stdoutBuffer.indexOf("\n")) !== -1) {
        const line = this.stdoutBuffer.slice(0, lineEndIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(lineEndIndex + 1);
        
        if (line) {
          try {
            const parsed = JSON.parse(line);
            const resolver = this.pendingResolvers.shift();
            if (resolver) resolver(parsed);
          } catch {
            console.error(`[${this.name}] JSON inválido o output inesperado:`, line);
          }
        }
      }
    });

    this.process.stderr?.on("data", (data) => {
      console.error(`[${this.name} Error]`, data.toString());
    });

    this.process.on("error", (err) => {
      console.error(`[${this.name}] Error al iniciar el proceso:`, err);
    });

    this.process.on("close", (code) => {
      console.log(`[${this.name}] Proceso finalizado con código ${code}`);
      this.process = null;
      if (win) {
        win.webContents.send('sidecar:status', { name: this.name, status: 'closed', code });
      }
    });
  }

  send(payload: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        return reject(new Error(`El proceso Python ${this.name} no está iniciado.`));
      }

      this.pendingResolvers.push(resolve);
      this.process.stdin?.write(JSON.stringify(payload) + "\n");
    });
  }

  kill() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

// Instancias de Sidecar
const getSidecarPath = (fileName: string) => {
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, 'sidecar', fileName);
  }
  const sidecarPath = path.join(__dirname, `sidecar/${fileName}`);
  return fs.existsSync(sidecarPath) 
    ? sidecarPath 
    : path.join(__dirname, `../electron/sidecar/${fileName}`);
};

const getPythonExecutable = () => {
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, 'python-embed', 'python.exe');
  }
  return "python";
};

const terapiasSidecar = new SidecarManager(
  "Terapias",
  getSidecarPath("terapias_bridge.py")
);
const pdfSidecar = new SidecarManager(
  "PDF",
  getSidecarPath("pdf_bridge.py")
);

// IPC Handlers para Terapias
ipcMain.handle('terapias:ping', () => terapiasSidecar.send({ cmd: 'ping' }));
ipcMain.handle('terapias:check_word', () => terapiasSidecar.send({ cmd: 'check_word' }));
ipcMain.handle('terapias:list_docs', () => {
  const sourceDir = store.get('terapiasSourceDir', DEFAULT_TERAPIAS_DIR) as string;
  return terapiasSidecar.send({ cmd: 'list_docs', data: { source_dir: sourceDir } });
});
ipcMain.handle('terapias:prepare', (_, data) => {
  const sourceDir = store.get('terapiasSourceDir', DEFAULT_TERAPIAS_DIR) as string;
  return terapiasSidecar.send({ cmd: 'prepare', data: { ...data, source_dir: sourceDir } });
});
ipcMain.handle('terapias:finalize', async (_, data) => {
  try {
    const docPath = data.doc_path;
    const pdfPath = docPath.replace(/\.(docx|doc)$/i, '.pdf');
    
    // 1. Convertir usando PDF Sidecar (Motor único)
    console.log('[Main] Solicitando conversión Word->PDF a PDF Sidecar...');
    const convRes = await pdfSidecar.send({ 
      cmd: 'word_to_pdf', 
      data: { input: docPath, output: pdfPath } 
    });

    if (!convRes.ok) return convRes;

    // 2. Realizar backup usando Terapias Sidecar
    console.log('[Main] Conversión exitosa. Solicitando backup a Terapias Sidecar...');
    const backupRes = await terapiasSidecar.send({ 
      cmd: 'finalize_backup', 
      data: { doc_path: docPath, backup: data.backup } 
    });

    if (backupRes.ok) {
        // Combinar resultados para la UI
        return { ...backupRes, pdf_path: pdfPath };
    }
    return backupRes;
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// IPC Handlers para PDF Tools
ipcMain.handle('pdf:ping', () => pdfSidecar.send({ cmd: 'ping' }));
ipcMain.handle('pdf:merge', (_, data) => pdfSidecar.send({ cmd: 'merge', data }));
ipcMain.handle('pdf:compress', (_, data) => pdfSidecar.send({ cmd: 'compress', data }));
ipcMain.handle('pdf:split', (_, data) => pdfSidecar.send({ cmd: 'split', data }));
ipcMain.handle('pdf:rotate', (_, data) => pdfSidecar.send({ cmd: 'rotate', data }));
ipcMain.handle('pdf:extract', (_, data) => pdfSidecar.send({ cmd: 'extract', data }));
ipcMain.handle('pdf:word_to_pdf', (_, data) => pdfSidecar.send({ cmd: 'word_to_pdf', data }));
ipcMain.handle('pdf:pdf_to_word', (_, data) => pdfSidecar.send({ cmd: 'pdf_to_word', data }));
ipcMain.handle('pdf:excel_to_pdf', (_, data) => pdfSidecar.send({ cmd: 'excel_to_pdf', data }));
ipcMain.handle('pdf:pdf_to_excel', (_, data) => pdfSidecar.send({ cmd: 'pdf_to_excel', data }));
ipcMain.handle('pdf:ppt_to_pdf', (_, data) => pdfSidecar.send({ cmd: 'ppt_to_pdf', data }));
ipcMain.handle('pdf:pdf_to_ppt', (_, data) => pdfSidecar.send({ cmd: 'pdf_to_ppt', data }));

// Handlers adicionales para PDF Tools
ipcMain.handle('pdf:delete_pages', (_, data) => pdfSidecar.send({ cmd: 'delete_pages', data }));
ipcMain.handle('pdf:reorder_pages', (_, data) => pdfSidecar.send({ cmd: 'reorder_pages', data }));
ipcMain.handle('pdf:watermark', (_, data) => pdfSidecar.send({ cmd: 'watermark', data }));
ipcMain.handle('pdf:watermark_image', (_, data) => pdfSidecar.send({ cmd: 'watermark_image', data }));
ipcMain.handle('pdf:crop', (_, data) => pdfSidecar.send({ cmd: 'crop', data }));
ipcMain.handle('pdf:add_page_numbers', (_, data) => pdfSidecar.send({ cmd: 'add_page_numbers', data }));
ipcMain.handle('pdf:jpg_to_pdf', (_, data) => pdfSidecar.send({ cmd: 'jpg_to_pdf', data }));
ipcMain.handle('pdf:pdf_to_jpg', (_, data) => pdfSidecar.send({ cmd: 'pdf_to_jpg', data }));
ipcMain.handle('pdf:html_to_pdf', (_, data) => pdfSidecar.send({ cmd: 'html_to_pdf', data }));
ipcMain.handle('pdf:protect', (_, data) => pdfSidecar.send({ cmd: 'protect', data }));
ipcMain.handle('pdf:unlock', (_, data) => pdfSidecar.send({ cmd: 'unlock', data }));
ipcMain.handle('pdf:repair', (_, data) => pdfSidecar.send({ cmd: 'repair', data }));
ipcMain.handle('pdf:ocr', (_, data) => pdfSidecar.send({ cmd: 'ocr', data }));
ipcMain.handle('pdf:get_page_info', (_, data) => pdfSidecar.send({ cmd: 'get_page_info', data }));

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Configuración Persistente
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('config:get', (_, key) => store.get(key));
ipcMain.handle('config:set', (_, key, value) => store.set(key, value));

// IPC Handlers para Dashboard
ipcMain.handle('dashboard:stats', async () => {
  try {
    const sourceDir = store.get('terapiasSourceDir', DEFAULT_TERAPIAS_DIR) as string;
    if (!fs.existsSync(sourceDir)) return { pendingDocs: 0 };
    
    const files = fs.readdirSync(sourceDir);
    const docxFiles = files.filter(f => f.toLowerCase().endsWith('.docx') || f.toLowerCase().endsWith('.doc'));
    
    return { pendingDocs: docxFiles.length };
  } catch (err) {
    console.error('[Dashboard Stats Error]', err);
    return { pendingDocs: 0 };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ventana principal
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
  if (!app) return;
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      plugins: true,
    },
    width: 1280,
    height: 800,
  });

  win?.setMenu(null);

  win?.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win?.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win?.loadFile(path.join(process.env.DIST || '', 'index.html'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// App lifecycle
// ─────────────────────────────────────────────────────────────────────────────
app?.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app?.quit();
    win = null;
  }
});

app?.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Fix #10: Limpiar el pool de Workers al cerrar la app
app?.on('before-quit', () => {
  pdfWorkerPool?.terminate().catch(() => {});
  pdfWorkerPool = null;
  // Finalizar sidecars Python
  terapiasSidecar.kill();
  pdfSidecar.kill();
  // Fix #15: Limpiar timers de debounce pendientes
  for (const timer of watcherDebounceMap.values()) clearTimeout(timer);
  watcherDebounceMap.clear();
});

app?.whenReady()?.then(() => {
  // Sidecars Python
  terapiasSidecar.start();
  pdfSidecar.start();
  
  // Protocolo custom para servir PDFs locales sin abrir el explorador
  protocol.handle('cotu', (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'pdf') {
      const pathArg = url.searchParams.get('path');
      if (pathArg) {
        return net.fetch('file:///' + pathArg.replace(/\\/g, '/'));
      }
    }
    return new Response('Not Found', { status: 404 });
  });
  createWindow();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Seleccionar directorio
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('dialog:selectDirectory', async () => {
  if (!win) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain?.handle('dialog:selectFile', async (_, filters) => {
  if (!win) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || []
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('shell:openPath', (_, path) => {
  shell.openPath(path);
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Leer directorio con filtros
// Fix #3: Acepta `scanId` — si se recibe 'fs:cancelScan' con ese ID,
//         la traversal se detiene en el próximo punto de control async.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('fs:readDirectory', async (
  event: any,
  dirPath: string,
  options?: { ignoredFolders?: string[]; maxDepth?: number; scanId?: string }
) => {
  const ignoredFolders = options?.ignoredFolders ?? [
    '.git', 'node_modules', '$RECYCLE.BIN', 'System Volume Information',
    'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData',
    '.vscode', '.idea', '__pycache__', '.cache', 'temp', 'tmp', 'RIPS'
  ];
  const maxDepth = options?.maxDepth ?? 10;
  const scanId = options?.scanId;

  // Registrar el escaneo como activo
  if (scanId) activeScanIds.add(scanId);

  try {
    const arrayOfFiles: { filePath: string; mtimeMs: number }[] = [];
    let totalFilesScanned = 0;

    const getAllFiles = async function (dir: string, currentDepth: number) {
      // Fix #3: Punto de control — abortar si el scanId fue removido
      if (scanId && !activeScanIds.has(scanId)) return;
      if (currentDepth > maxDepth) return;

      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return; // Carpeta sin permisos — se ignora
      }

      for (const entry of entries) {
        // Fix #3: Verificar cancelación en cada entrada
        if (scanId && !activeScanIds.has(scanId)) return;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (ignoredFolders.includes(entry.name)) continue;

          totalFilesScanned++;

          if (totalFilesScanned % 250 === 0) {
            event.sender.send('scan-progress', {
              currentFile: entry.name,
              scannedCount: totalFilesScanned,
              foundCount: arrayOfFiles.length
            });
          }

          if (entry.name.toLowerCase().includes('cotu')) {
            let stat: fs.Stats;
            try {
              stat = await fs.promises.stat(fullPath);
            } catch {
              continue;
            }
            arrayOfFiles.push({ filePath: fullPath, mtimeMs: stat.mtimeMs });
            continue;
          }

          await getAllFiles(fullPath, currentDepth + 1);
        } else {
          totalFilesScanned++;
        }
      }
    };

    await getAllFiles(dirPath, 0);
    return { files: arrayOfFiles, totalScanned: totalFilesScanned };
  } catch (err) {
    console.error('Error reading directory:', err);
    return { files: [], totalScanned: 0 };
  } finally {
    // Siempre limpiar el scanId, tanto en éxito como en cancelación
    if (scanId) activeScanIds.delete(scanId);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Cancelar escaneo en curso
// Fix #3: Al eliminar el scanId, la traversal se detiene en el próximo await
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('fs:cancelScan', async (_: any, scanId: string) => {
  activeScanIds.delete(scanId);
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Parsear PDF para extraer texto
// Fix #10: Usa el WorkerPool en vez de crear un Worker nuevo por cada PDF
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('fs:parsePdf', async (_: any, pdfPath: string, maxPages?: number) => {
  if (!pdfWorkerPool) {
    const workerPath = path.join(__dirname, 'pdfWorker.js');
    const cpuCount = os.cpus().length;
    const poolSize = Math.min(5, cpuCount);
    pdfWorkerPool = new WorkerPool(poolSize, workerPath);
    console.log(`[main] PDF WorkerPool inicializado con ${poolSize} workers (CPUs: ${cpuCount}).`);
  }
  return pdfWorkerPool.parsePdf(pdfPath, maxPages);
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Exportar archivo al sistema de archivos
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('fs:exportFile', async (
  _: any,
  options: { defaultFilename: string; content: string | Uint8Array; filters?: Electron.FileFilter[] }
) => {
  if (!win) return { success: false, error: 'Window not available' };

  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    defaultPath: options.defaultFilename,
    filters: options.filters ?? [
      { name: 'Todos los archivos', extensions: ['*'] }
    ],
  });

  if (canceled || !filePath) return { success: false, error: 'Cancelado por el usuario' };

  try {
    if (typeof options.content === 'string') {
      fs.writeFileSync(filePath, options.content, { encoding: 'utf-8' });
    } else {
      fs.writeFileSync(filePath, Buffer.from(options.content));
    }
    shell.showItemInFolder(filePath);
    return { success: true, filePath };
  } catch (err: any) {
    console.error('Error exportando archivo:', err);
    return { success: false, error: err.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Auto-Watcher Chokidar
// Fix #15: awaitWriteFinish espera a que el archivo termine de escribirse.
//           debounce de 500ms por ruta para no inundar el renderer.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('fs:startWatch', async (_: any, dirPath: string) => {
  if (globalWatcher) {
    // Limpiar timers de debounce del watcher anterior
    for (const timer of watcherDebounceMap.values()) clearTimeout(timer);
    watcherDebounceMap.clear();
    globalWatcher.close();
  }

  globalWatcher = chokidar.watch(dirPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    depth: 10,
    ignoreInitial: true,
    // Fix #15: Esperar a que el archivo esté completamente escrito antes de emitir
    awaitWriteFinish: {
      stabilityThreshold: 2000, // ms sin cambios en el archivo
      pollInterval: 100,
    },
  });

  globalWatcher.on('add', (filePath: string) => {
    if (
      filePath.toLowerCase().endsWith('.pdf') &&
      filePath.toLowerCase().includes('cotu')
    ) {
      // Fix #15: Debounce — coalescer eventos duplicados en 500ms
      const existing = watcherDebounceMap.get(filePath);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        watcherDebounceMap.delete(filePath);
        if (win) win.webContents.send('scanner:new-file', { type: 'add', path: filePath });
      }, 500);

      watcherDebounceMap.set(filePath, timer);
    }
  });

  return true;
});

ipcMain?.handle('fs:stopWatch', async () => {
  if (globalWatcher) {
    // Limpiar debounces pendientes al detener el watcher
    for (const timer of watcherDebounceMap.values()) clearTimeout(timer);
    watcherDebounceMap.clear();
    await globalWatcher.close();
    globalWatcher = null;
  }
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Base de Datos Local
// ─────────────────────────────────────────────────────────────────────────────
ipcMain?.handle('db:getHistory', () => dbOptions.getHistory());
ipcMain?.handle('db:saveScan', (_: any, scan: any) => dbOptions.saveScan(scan));
ipcMain?.handle('db:deleteScan', (_: any, id: string) => dbOptions.deleteScan(id));
ipcMain?.handle('db:clearHistory', () => dbOptions.clearHistory());
ipcMain?.handle('db:getSettings', () => dbOptions.getSettings());
ipcMain?.handle('db:saveSettings', (_: any, settings: any) => dbOptions.saveSettings(settings));
// Fix #11: Trim y stats del historial
ipcMain?.handle('db:trimHistory', (_: any, keepCount: number) => dbOptions.trimOldScans(keepCount));
ipcMain?.handle('db:getStats', () => dbOptions.getDbStats());

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Abrir PDF en aplicación externa
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('fs:openExternal', async (_: any, filePath: string) => {
  if (filePath) {
    await shell.openPath(filePath);
  }
  return true;
});

ipcMain.handle('sidecar:reconnect', async (_, name: string) => {
  if (name === 'Terapias') {
    terapiasSidecar.kill();
    terapiasSidecar.start();
  } else if (name === 'PDF') {
    pdfSidecar.kill();
    pdfSidecar.start();
  }
  return { ok: true };
});

