import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn, ChildProcess } from 'child_process';
import chokidar, { FSWatcher } from 'chokidar';
import Store from 'electron-store';
import Tesseract from 'tesseract.js';
import { dbOptions } from './database';
import { WorkerPool } from './workerPool';

// Allowed file extensions for dropped files
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.html']);
// ─────────────────────────────────────────────────────────────────────────────
// main.ts — Proceso principal de Electron — ControlHub v1.0.0
// ─────────────────────────────────────────────────────────────────────────────

const store = new Store();
const DEFAULT_TERAPIAS_DIR = (store.get('settings.terapiasDir') as string) || path.join(
  os.homedir(),
  "OneDrive",
  "Documentos 1",
  "TERAPIAS",
  "DOCUMENTOS PARA ARMAR"
);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app?.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let win: BrowserWindowType | null;
let globalWatcher: FSWatcher | null = null;
// Security allowlists for IPC path validation
const registeredDroppedPaths = new Set<string>(); // real paths validated via validateAndRegisterDroppedFile
const CONTROLHUB_TEMP_DIR = path.join(os.tmpdir(), 'controlhub-pdftools');

// C4: Config allowlist — únicamente estas claves pueden ser leídas/escritas desde el renderer vía config:get/config:set
const ALLOWED_CONFIG_KEYS = ['settings.terapiasDir', 'terapias.baseDest', 'terapias.backup'];

/**
 * Validate a candidate file path for IPC operations.
 * Returns true if the path is allowed according to the allowlist rules.
 */
function validateOperationPath(candidatePath: string, isOutput: boolean): boolean {
  try {
    const resolved = path.resolve(candidatePath);
    const realPath = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    const normalize = (p: string) => path.normalize(p).toLowerCase();
    const normResolved = normalize(realPath);

    if (!isOutput) {
      // Input: must be explicitly allowed or be a subpath of an approved dialog directory
      if (sessionAllowedFiles.has(normResolved)) return true;
      for (const approved of dialogApprovedPaths) {
        const approvedNorm = normalize(approved);
        if (normResolved === approvedNorm) return true;
        const rel = path.relative(approvedNorm, normResolved);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) return true;
      }
      return false;
    } else {
      // Output: subpath of an approved dialog directory or the exclusive temp folder
      for (const approved of dialogApprovedPaths) {
        const approvedNorm = normalize(approved);
        const rel = path.relative(approvedNorm, normResolved);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) return true;
      }
      const tempNorm = normalize(CONTROLHUB_TEMP_DIR);
      const relTemp = path.relative(tempNorm, normResolved);
      if (!relTemp.startsWith('..') && !path.isAbsolute(relTemp)) return true;
      return false;
    }
  } catch {
    return false;
  }
}

const dialogApprovedPaths = new Set<string>(); // paths selected via native dialogs
const sessionAllowedFiles = new Set<string>(); // active allowlist synced with UI

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

const SIDECAR_DEFAULT_TIMEOUT_MS = 30000; // 30 segundos (fallback global)

const SIDECAR_COMMAND_TIMEOUTS: Record<string, number> = {
  // Operaciones rápidas / Metadatos (10s - 15s)
  'ping': 10000,
  'get_page_info': 15000,
  
  // Operaciones de carga estándar (30s)
  'merge': 30000,
  'extract': 30000,
  'delete_pages': 30000,
  'reorder_pages': 30000,
  'rotate': 30000,
  'crop': 30000,
  'repair': 30000,
  'add_page_numbers': 30000,
  'watermark': 30000,
  'watermark_image': 30000,
  'protect': 30000,
  'unlock': 30000,

  // Operaciones de procesamiento intermedio (60s)
  'compress': 60000,
  'split': 60000,
  'jpg_to_pdf': 60000,
  'html_to_pdf': 60000,

  // Operaciones de conversión pesada y OCR (2m - 5m)
  'pdf_to_jpg': 120000,
  'word_to_pdf': 120000,
  'excel_to_pdf': 120000,
  'ppt_to_pdf': 120000,
  'pdf_to_word': 300000,   // 5 minutos
  'ocr': 300000,           // 5 minutos
};

class SidecarManager {
  private process: ChildProcess | null = null;
  private name: string;
  private scriptPath: string;
  private pendingResolvers = new Map<string, (value: any) => void>();
  private requestIdCounter = 0;
  private stdoutBuffer: string = "";
  private stderrBuffer: string = "";
  private restartAttempts: number = 0;
  private readonly maxRestarts: number = 0; // disabled automatic restarts per user request
  private readonly backoffTimes: number[] = [2000, 4000, 8000];
  private status: 'running' | 'closed' | 'stalled' | 'reconnecting' | 'failed' | 'ok' | 'unknown' = 'unknown';

  constructor(name: string, scriptPath: string) {
    this.name = name;
    this.scriptPath = scriptPath;
  }

  private setStatus(newStatus: 'running' | 'closed' | 'stalled' | 'reconnecting' | 'failed' | 'ok' | 'unknown') {
    this.status = newStatus;
    if (win) {
      win.webContents.send('sidecar:status', { name: this.name, status: newStatus });
    }
  }

  start() {
    console.log(`[Sidecar] proceso ${this.name} activo`);
    const pythonExe = getPythonExecutable();
    this.process = spawn(pythonExe, [this.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    // Reset restart attempts on successful start
    this.restartAttempts = 0;
    this.setStatus('running');

    this.process.stdout?.on("data", (data) => {
      const out = data.toString();
      // Log raw stdout for debugging
      console.log(`[Sidecar] ${this.name} STDOUT:`, out);
      this.stdoutBuffer += out;
      let lineEndIndex;
      while ((lineEndIndex = this.stdoutBuffer.indexOf("\n")) !== -1) {
        const line = this.stdoutBuffer.slice(0, lineEndIndex).trim();
        this.stdoutBuffer = this.stdoutBuffer.slice(lineEndIndex + 1);
        
        if (line) {
          try {
            const parsed = JSON.parse(line);
            const id = parsed.id?.toString();
            
            if (id && this.pendingResolvers.has(id)) {
              const resolver = this.pendingResolvers.get(id);
              this.pendingResolvers.delete(id);
              if (resolver) resolver(parsed);
            } else {
              // Fallback: Si no hay ID, tomamos el primer resolver (retrocompatibilidad o error)
              console.warn(`[Sidecar] ${this.name}: Respuesta recibida sin ID o ID no encontrado: ${id}`);
              const firstId = this.pendingResolvers.keys().next().value;
              if (firstId) {
                const resolver = this.pendingResolvers.get(firstId);
                this.pendingResolvers.delete(firstId);
                if (resolver) resolver(parsed);
              }
            }
          } catch {
            console.error(`[Sidecar] ${this.name}: error de parseo en comunicación`);
          }
        }
      }
    });

    this.process.stderr?.on("data", (data) => {
      const errMsg = data.toString();
      this.stderrBuffer += errMsg;
      console.error(`[Sidecar] ${this.name} STDERR:`, errMsg);
    });

    this.process.on("error", (err) => {
      console.error(`[${this.name}] Error al iniciar el proceso:`, err);
    });

    this.process.on("close", (code) => {
      console.log(`[${this.name}] Proceso finalizado con código ${code}`);
      // If process exited with error, output captured buffers
      if (code !== 0) {
        console.error(`[${this.name}] STDERR BUFFER:\n${this.stderrBuffer}`);
        console.error(`[${this.name}] STDOUT BUFFER:\n${this.stdoutBuffer}`);
      }
      // Reject any pending resolvers to avoid hanging promises
      if (this.pendingResolvers.size > 0) {
        const err = new Error(`Sidecar ${this.name} closed unexpectedly with code ${code}`);
        this.pendingResolvers.forEach((resolver) => {
          resolver({ ok: false, error: err.message });
        });
        this.pendingResolvers.clear();
      }
      this.process = null;
      // Automatic reconnection logic
      if (code !== 0 && this.restartAttempts < this.maxRestarts) {
        const backoff = this.backoffTimes[this.restartAttempts] || 8000;
        this.restartAttempts++;
        this.setStatus('reconnecting');
        setTimeout(() => this.start(), backoff);
      } else {
        // final failure
        this.setStatus(code === 0 ? 'closed' : 'failed');
        this.restartAttempts = 0; // reset on final state
      }
    });
  }

  send(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.status === 'stalled') {
        return reject(new Error(`El módulo ${this.name} se encuentra bloqueado debido a una tarea anterior que superó el tiempo límite. Por favor, haz clic en el botón de reconectar en la barra lateral para reiniciar el servicio.`));
      }
      if (!this.process) {
        return reject(new Error(`El proceso Python ${this.name} no está iniciado.`));
      }

      const id = (++this.requestIdCounter).toString();
      payload.id = id;

      const cmd = payload.cmd || "";
      const timeoutMs = SIDECAR_COMMAND_TIMEOUTS[cmd] || SIDECAR_DEFAULT_TIMEOUT_MS;

      const timer = setTimeout(() => {
        if (this.pendingResolvers.has(id)) {
          this.pendingResolvers.delete(id);
          this.setStatus('stalled');
          reject(new Error(`Timeout: La operación '${cmd}' en el sidecar ${this.name} tardó más de ${timeoutMs / 1000}s. El servicio ha sido marcado como atascado.`));
        }
      }, timeoutMs);
      
      this.pendingResolvers.set(id, (value) => {
        clearTimeout(timer);
        resolve(value);
      });

      try {
        this.process.stdin?.write(JSON.stringify(payload) + "\n");
      } catch (writeErr) {
        clearTimeout(timer);
        this.pendingResolvers.delete(id);
        reject(new Error(`Failed to write to sidecar ${this.name}: ${writeErr}`));
      }
    });
  }

  kill() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.setStatus('closed');
  }
}

// Instancias de Sidecar
const getSidecarPath = (fileName: string) => {
  if (app?.isPackaged) {
    // En producción, los archivos están en la carpeta 'resources/sidecar'
    return path.join(process.resourcesPath, 'sidecar', fileName);
  }
  // En desarrollo, buscamos relativo al archivo actual
  const devPath = path.join(__dirname, `sidecar/${fileName}`);
  if (fs.existsSync(devPath)) return devPath;
  
  // Fallback para estructuras alternativas en desarrollo
  return path.join(__dirname, `../electron/sidecar/${fileName}`);
};

const getPythonExecutable = () => {
  if (app?.isPackaged) {
    return path.join(process.resourcesPath, 'python-embed', 'python.exe');
  }
  return path.join(process.cwd(), 'python-embed', 'python.exe');
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
  const sourceDir = store.get('settings.terapiasDir', DEFAULT_TERAPIAS_DIR) as string;
  return terapiasSidecar.send({ cmd: 'list_docs', data: { source_dir: sourceDir } });
});
ipcMain.handle('terapias:prepare', (_, data) => {
  const sourceDir = store.get('settings.terapiasDir', DEFAULT_TERAPIAS_DIR) as string;
  return terapiasSidecar.send({ cmd: 'prepare', data: { ...data, source_dir: sourceDir } });
});
ipcMain.handle('terapias:finalize', (_, data) => {
  return terapiasSidecar.send({ cmd: 'finalize', data });
});
ipcMain.handle('terapias:get_history', () => {
  return terapiasSidecar.send({ cmd: 'get_history' });
});
ipcMain.handle('terapias:search_patient', (_, data) => {
  return terapiasSidecar.send({ cmd: 'search_patient', data });
});

// IPC Handlers para PDF Tools
ipcMain.handle('pdf:ping', () => pdfSidecar.send({ cmd: 'ping' }));
// Wrapper to validate input paths before delegating to sidecar
const validatePdfHandler = (cmd: string, data: any) => {
  // For operations that include input paths, check them
  if (data && data.input) {
    if (!validateOperationPath(data.input, false)) {
      throw new Error(`Invalid input path for ${cmd}`);
    }
  }
  // For output directories, validate as output
  if (data && data.output_dir) {
    if (!validateOperationPath(data.output_dir, true)) {
      throw new Error(`Invalid output directory for ${cmd}`);
    }
  }
  // For single‑file output paths, validate as output
  if (data && data.output) {
    if (!validateOperationPath(data.output, true)) {
      throw new Error(`Invalid output path for ${cmd}`);
    }
  }
  return pdfSidecar.send({ cmd, data });
};
ipcMain.handle('pdf:merge', (_, data) => validatePdfHandler('merge', data));
ipcMain.handle('pdf:compress', (_, data) => validatePdfHandler('compress', data));
ipcMain.handle('pdf:split', (_, data) => validatePdfHandler('split', data));
ipcMain.handle('pdf:rotate', (_, data) => validatePdfHandler('rotate', data));
ipcMain.handle('pdf:extract', (_, data) => validatePdfHandler('extract', data));
ipcMain.handle('pdf:word_to_pdf', (_, data) => validatePdfHandler('word_to_pdf', data));
ipcMain.handle('pdf:pdf_to_word', (_, data) => validatePdfHandler('pdf_to_word', data));
ipcMain.handle('pdf:excel_to_pdf', (_, data) => validatePdfHandler('excel_to_pdf', data));
ipcMain.handle('pdf:ppt_to_pdf', (_, data) => validatePdfHandler('ppt_to_pdf', data));
// Additional handlers
ipcMain.handle('pdf:delete_pages', (_, data) => validatePdfHandler('delete_pages', data));
ipcMain.handle('pdf:reorder_pages', (_, data) => validatePdfHandler('reorder_pages', data));
ipcMain.handle('pdf:watermark', (_, data) => validatePdfHandler('watermark', data));
ipcMain.handle('pdf:watermark_image', (_, data) => validatePdfHandler('watermark_image', data));
ipcMain.handle('pdf:crop', (_, data) => validatePdfHandler('crop', data));
ipcMain.handle('pdf:add_page_numbers', (_, data) => validatePdfHandler('add_page_numbers', data));
ipcMain.handle('pdf:jpg_to_pdf', (_, data) => validatePdfHandler('jpg_to_pdf', data));
ipcMain.handle('pdf:pdf_to_jpg', (_, data) => validatePdfHandler('pdf_to_jpg', data));
ipcMain.handle('pdf:html_to_pdf', (_, data) => validatePdfHandler('html_to_pdf', data));
ipcMain.handle('pdf:protect', (_, data) => validatePdfHandler('protect', data));
ipcMain.handle('pdf:unlock', (_, data) => validatePdfHandler('unlock', data));
ipcMain.handle('pdf:repair', (_, data) => validatePdfHandler('repair', data));
ipcMain.handle('pdf:ocr', async (_, data) => {
  let tesseractPath = store.get('tesseractPath') as string;
  
  // C5: Validación de seguridad real — si tesseractPath está configurado, validarlo antes de usar
  if (tesseractPath) {
    const validationResult = await validateTesseractPath(tesseractPath);
    if (!validationResult.ok) {
      return { ok: false, error: `Tesseract inválido: ${validationResult.error}` };
    }
  }
  
  const extended = { ...data, tesseract_path: tesseractPath };
  return validatePdfHandler('ocr', extended);
});
ipcMain.handle('pdf:get_page_info', (_, data) => validatePdfHandler('get_page_info', data));

// IPC Handler para OCR Fallback (Main Process)
ipcMain.handle('ocr:extractText', async (_, pdfPath: string) => {
  console.log('[MAIN] Iniciando OCR Fallback para:', pdfPath);
  const tempDir = path.join(os.tmpdir(), 'controlhub-ocr');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    // 1. Convertir página 1 del PDF a JPG usando el sidecar
    const res = await pdfSidecar.send({ 
      cmd: 'pdf_to_jpg', 
      data: { input: pdfPath, output_dir: tempDir, dpi: 300 } 
    });

    if (!res.ok || !res.outputs || res.outputs.length === 0) {
      throw new Error(res.error || 'Fallo al convertir PDF a imagen');
    }

    const imgPath = res.outputs[0];
    
    // 2. Extraer texto con Tesseract en el Main Process
    const { data: { text } } = await Tesseract.recognize(imgPath, 'spa');
    
    // 3. Limpiar archivo temporal
    fs.unlinkSync(imgPath);
    
    return text;
  } catch (err: any) {
    console.error('[MAIN-OCR] Error:', err);
    return "";
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// C5: Validación de Tesseract — Función interna reutilizable
// ─────────────────────────────────────────────────────────────────────────────
async function validateTesseractPath(exePath: string): Promise<{ ok: boolean; error?: string }> {
  const { execFile } = await import('child_process');
  const path_module = await import('path');

  try {
    // 1. Verificar que el archivo existe
    if (!fs.existsSync(exePath)) {
      return { ok: false, error: 'Archivo no encontrado' };
    }

    // 2. Verificar que el nombre del archivo es tesseract.exe (case-insensitive)
    const baseName = path_module.default.basename(exePath).toLowerCase();
    if (baseName !== 'tesseract.exe') {
      return { ok: false, error: 'El archivo debe ser tesseract.exe' };
    }

    // 3. Ejecutar con --version y timeout 5s, capturando salida
    return new Promise((resolve) => {
      const child = execFile(exePath, ['--version'], { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          if ((error as any).code === 'ETIMEDOUT') {
            return resolve({ ok: false, error: 'Tiempo de espera agotado al validar el ejecutable' });
          }
          return resolve({ ok: false, error: 'No se puede ejecutar el binario' });
        }

        // 4. Verificar que la salida contiene 'tesseract'
        const output = (stdout + stderr).toLowerCase();
        if (output.includes('tesseract')) {
          return resolve({ ok: true });
        } else {
          return resolve({ ok: false, error: 'El ejecutable no responde como Tesseract OCR' });
        }
      });
    });
  } catch (err: any) {
    return { ok: false, error: 'Error al validar el ejecutable' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Configuración Persistente
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('config:get', (_, key) => {
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    console.warn(`[CONFIG] Intento de lectura de clave no permitida: "${key}"`);
    return undefined;
  }
  return store.get(key);
});

ipcMain.handle('config:set', (_, key, value) => {
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    throw new Error(
      `Clave no permitida: "${key}". Claves permitidas: ${ALLOWED_CONFIG_KEYS.join(', ')}`
    );
  }
  return store.set(key, value);
});

// C5: Handler IPC para validar Tesseract (capa fina que reutiliza validateTesseractPath)
ipcMain.handle('tesseract:validate', async (_, exePath: string) => {
  return validateTesseractPath(exePath);
});

// IPC Handlers para Dashboard
ipcMain.handle('dashboard:stats', async () => {
  try {
    const sourceDir = store.get('settings.terapiasDir', DEFAULT_TERAPIAS_DIR) as string;
    
    // Verificación asíncrona de existencia
    try {
      await fs.promises.access(sourceDir, fs.constants.F_OK);
    } catch {
      return { pendingDocs: 0 };
    }
    
    const files = await fs.promises.readdir(sourceDir);
    const docxFiles = files.filter(f => f.toLowerCase().endsWith('.docx') || f.toLowerCase().endsWith('.doc'));
    
    return { pendingDocs: docxFiles.length };
  } catch (err) {
    console.error('[Dashboard Stats Error]', err);
    return { pendingDocs: 0 };
  }
});

ipcMain.handle('fs:readPdfAsBase64', async (_: any, pdfPath: string) => {
  try {
    if (!validateOperationPath(pdfPath, false)) {
      return { success: false, error: 'Invalid PDF path' };
    }
    const buffer = await fs.promises.readFile(pdfPath);
    return { success: true, data: buffer.toString('base64') };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Ventana principal
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
  if (!app) return;
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || '', 'icon.png'),
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
    win?.webContents.openDevTools();
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
    // Ensure exclusive temp directory exists for output operations
    fs.mkdirSync(CONTROLHUB_TEMP_DIR, { recursive: true });
    createWindow();
  }
});

// Fix #10: Limpiar el pool de Workers al cerrar la app
app?.on('before-quit', async () => {
  pdfWorkerPool?.terminate().catch(() => {});
  pdfWorkerPool = null;
  terapiasSidecar.kill();
  pdfSidecar.kill();
  for (const timer of watcherDebounceMap.values()) clearTimeout(timer);
  watcherDebounceMap.clear();
});

app?.whenReady()?.then(async () => {
  terapiasSidecar.start();
  pdfSidecar.start();
  // Ensure exclusive temp directory exists for output operations
  fs.mkdirSync(CONTROLHUB_TEMP_DIR, { recursive: true });
  createWindow();
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Seleccionar directorio
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:selectDirectory', async () => {
  if (!win) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openDirectory']
  });
  if (canceled || filePaths.length === 0) return null;
  const dirPath = filePaths[0];
  store.set('settings.terapiasDir', dirPath);
  // Register approved directory path
  dialogApprovedPaths.add(path.resolve(dirPath));
  return dirPath;
});

ipcMain.handle('dialog:selectFile', async (_, options) => {
  if (!win) return null;
  const filters = Array.isArray(options) ? options : options?.filters;
  const defaultPath = options?.defaultPath;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: filters || [],
    defaultPath
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  // Register approved file path
  dialogApprovedPaths.add(path.resolve(filePath));
  return filePath;
});

// IPC handler for Save Dialog
ipcMain.handle('dialog-save-path', async (_, options) => {
  const result = await dialog.showSaveDialog(options);
  if (!result.canceled && result.filePath) {
    dialogApprovedPaths.add(path.resolve(result.filePath));
  }
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('fs:listFiles', async (_, dirPath, extensions) => {
  try {
    if (!fs.existsSync(dirPath)) return [];
    const files = await fs.promises.readdir(dirPath);
    return files.filter(f => 
      extensions.some((ext: string) => f.toLowerCase().endsWith(ext.toLowerCase()))
    );
  } catch (err) {
    console.error('[fs:listFiles] Error:', err);
    return [];
  }
});

ipcMain.handle('shell:openPath', (_, targetPath) => {
  // Validate output path
  if (!validateOperationPath(targetPath, true)) {
    throw new Error('Invalid output path for shell:openPath');
  }
  shell.openPath(targetPath);
});

ipcMain.handle('open-file', async (_, filePath: string) => {
  try {
    if (!filePath) return { ok: false, error: 'Ruta no proporcionada' };
    // Validate input path (must be allowed)
    if (!validateOperationPath(filePath, false)) {
      return { ok: false, error: 'Invalid file path' };
    }
    await shell.openPath(filePath);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('reveal-in-folder', async (_, filePath: string) => {
  try {
    if (!filePath) return { ok: false, error: 'Ruta no proporcionada' };
    if (!validateOperationPath(filePath, false)) {
      return { ok: false, error: 'Invalid file path' };
    }
    shell.showItemInFolder(filePath);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Leer directorio con filtros
// Fix #3: Acepta `scanId` — si se recibe 'fs:cancelScan' con ese ID,
//         la traversal se detiene en el próximo punto de control async.
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('fs:readDirectory', async (
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

          await getAllFiles(fullPath, currentDepth + 1);
        } else {
          totalFilesScanned++;
          if (entry.name.toLowerCase().endsWith('.pdf')) {
            let stat: fs.Stats;
            try {
              stat = await fs.promises.stat(fullPath);
            } catch {
              continue;
            }
            arrayOfFiles.push({ filePath: fullPath, mtimeMs: stat.mtimeMs });
          }
        }
      }
    };

    await getAllFiles(dirPath, 0);
    return { files: arrayOfFiles, totalScanned: totalFilesScanned };
  } catch (err) {
    console.error('Error reading directory:', err);
    return { files: [], totalScanned: 0 };
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Cancelar escaneo en curso
// Fix #3: Al eliminar el scanId, la traversal se detiene en el próximo await
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('fs:cancelScan', async (_: any, scanId: string) => {
  activeScanIds.delete(scanId);
  return true;
});

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Parsear PDF para extraer texto
// Fix #10: Usa el WorkerPool en vez de crear un Worker nuevo por cada PDF
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('fs:parsePdf', async (_: any, pdfPath: string, maxPages?: number) => {
  console.log('[MAIN] Entrando a fs:parsePdf para:', pdfPath);
  if (!pdfWorkerPool) {
    const workerPath = path.join(__dirname, 'pdfWorker.js');
    const cpuCount = os.cpus().length;
    const poolSize = Math.min(5, cpuCount);
    pdfWorkerPool = new WorkerPool(poolSize, workerPath);
    console.log(`[main] PDF WorkerPool inicializado con ${poolSize} workers (CPUs: ${cpuCount}).`);
  }
  const result = await pdfWorkerPool.parsePdf(pdfPath, maxPages);
  console.log('[MAIN] parsePdf resultado para:', pdfPath, 
    '| texto length:', result?.text?.length ?? 0);
  if (result && result.text) {
    console.log('[DEBUG-MAIN] Texto extraído del PDF:', result.text.substring(0, 800));
  }
  return result;
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
ipcMain.handle('security:validateAndRegisterDroppedFile', async (_, filePath: string) => {
  if (!filePath) return { ok: false, error: 'No path provided' };
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return { ok: false, error: 'File does not exist or is not a regular file' };
    }
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return { ok: false, error: `Extension ${ext} not allowed` };
    }
    const real = fs.realpathSync(filePath);
    registeredDroppedPaths.add(real);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('security:syncActiveFiles', async (_, paths: string[]) => {
  if (!Array.isArray(paths)) return { ok: false, error: 'Invalid input' };
  const accepted: string[] = [];
  for (const p of paths) {
    const resolved = path.resolve(p);
    if (registeredDroppedPaths.has(resolved)) {
      accepted.push(resolved);
      continue;
    }
    // Check if subpath of any dialog approved path
    for (const approved of dialogApprovedPaths) {
      const rel = path.relative(approved, resolved);
      if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
        accepted.push(resolved);
        break;
      }
    }
  }
  sessionAllowedFiles.clear();
  accepted.forEach(r => sessionAllowedFiles.add(r));
  return { ok: true, accepted: accepted.length };
});

ipcMain.handle('fs:openExternal', async (_: any, filePath: string) => {
  if (filePath) {
    if (!validateOperationPath(filePath, false)) {
      throw new Error('Invalid path for fs:openExternal');
    }
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
