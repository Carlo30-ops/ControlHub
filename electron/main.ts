import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
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
import { logger } from './logger';

// Suppress known Node deprecation warnings from legacy punycode usage in transitive dependencies.
// The warning is noisy and does not affect app behavior.
process.on('warning', (warning: any) => {
  if (warning.code === 'DEP0040' || /punycode/i.test(warning.message)) {
    return;
  }
  logger.warn(warning.name + ':', warning.message);
});

// Allowed file extensions for dropped files
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.html']);
// ─────────────────────────────────────────────────────────────────────────────
// main.ts — Proceso principal de Electron — ControlHub v3.2.0
// ─────────────────────────────────────────────────────────────────────────────

const store = new Store();

// Registrar esquemas de protocolo custom como privilegiados antes de app.whenReady()
try {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'pdfthumb', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
    { scheme: 'cotu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }
  ]);
} catch (e) {
  // Ignorar si ya fueron registrados
}


function computeDefaultTerapiasDir(): string {
  const home = os.homedir();
  const defaultCandidates = [
    path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
    path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
    path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS'),
    path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS'),
  ];

  return defaultCandidates[0];
}

async function getTerapiasCandidates(): Promise<string[]> {
  const dbSettings = await getAppSettings();
  const customCandidates = dbSettings?.terapiasCandidatePaths as string[] | undefined;
  if (customCandidates && customCandidates.length > 0) {
    return customCandidates;
  }

  const home = os.homedir();
  return [
    path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
    path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS', 'DOCUMENTOS PARA ARMAR'),
    path.join(home, 'OneDrive', 'Documentos 1', 'TERAPIAS'),
    path.join(home, 'OneDrive', 'Documentos', 'TERAPIAS'),
  ];
}

async function getAppSettings(): Promise<any> {
  try {
    return await dbOptions.getSettings();
  } catch (err) {
    logger.error('[MAIN] Error cargando AppSettings:', err);
    return {};
  }
}

async function getActiveTerapiasDir(): Promise<string> {
  const dbSettings = await getAppSettings();
  const settingsDir = dbSettings?.terapiasDir as string | undefined;
  if (settingsDir && settingsDir.trim().length > 0) {
    return settingsDir;
  }

  const candidates = await getTerapiasCandidates();
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return computeDefaultTerapiasDir();
}

function getDefaultTesseractPath(): string | undefined {
  const candidates = [
    path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Tesseract-OCR', 'tesseract.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Tesseract-OCR', 'tesseract.exe'),
    path.join(process.env['ProgramW6432'] || 'C:\\Program Files', 'Tesseract-OCR', 'tesseract.exe'),
    path.join(os.homedir(), 'AppData', 'Local', 'Tesseract-OCR', 'tesseract.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const envPath = process.env.PATH || '';
  const separator = process.platform === 'win32' ? ';' : ':';
  for (const entry of envPath.split(separator)) {
    const candidate = path.join(entry, process.platform === 'win32' ? 'tesseract.exe' : 'tesseract');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function getActiveTesseractPath(): Promise<string | undefined> {
  const dbSettings = await getAppSettings();
  const settingsPath = dbSettings?.tesseractPath as string | undefined;
  if (settingsPath && settingsPath.trim().length > 0) {
    return settingsPath;
  }
  return getDefaultTesseractPath();
}

/** Migra claves legacy de electron-store → settings.json (one-time). */
async function migrateElectronStoreToSettings(): Promise<void> {
  const migrationKey = 'migration.electronStoreSettings';
  if (store.get(migrationKey)) return;

  const settings = await dbOptions.getSettings();
  const updated = { ...settings };
  let changed = false;

  const storeTerapiasDir = store.get('settings.terapiasDir') as string | undefined;
  const storeTesseract = store.get('settings.tesseractPath') as string | undefined;
  const legacyTesseract = store.get('tesseractPath') as string | undefined;
  const baseDest = store.get('terapias.baseDest') as string | undefined;
  const backup = store.get('terapias.backup') as string | undefined;

  if (!updated.terapiasDir && storeTerapiasDir?.trim()) {
    updated.terapiasDir = storeTerapiasDir;
    changed = true;
  }
  if (!updated.tesseractPath && (storeTesseract?.trim() || legacyTesseract?.trim())) {
    updated.tesseractPath = storeTesseract?.trim() ? storeTesseract : legacyTesseract;
    changed = true;
  }
  if (!updated.terapiasBaseDest && baseDest?.trim()) {
    updated.terapiasBaseDest = baseDest;
    changed = true;
  }
  if (!updated.terapiasBackup && backup?.trim()) {
    updated.terapiasBackup = backup;
    changed = true;
  }

  if (changed) {
    await dbOptions.saveSettings(updated);
    logger.info('[MAIN] Configuración migrada de electron-store a settings.json');
  }

  store.delete('settings.terapiasDir');
  store.delete('settings.tesseractPath');
  store.delete('tesseractPath');
  store.delete('terapias.baseDest');
  store.delete('terapias.backup');
  store.set(migrationKey, true);
}

/** Carga configuración inicial del instalador si existe (one-time). */
async function loadInitialConfig(): Promise<void> {
  const loadKey = 'migration.initialConfig';
  if (store.get(loadKey)) return;

  // Buscar archivo initial-config.json en el directorio de instalación
  const installDir = app.getAppPath();
  const initialConfigPath = path.join(installDir, '..', 'initial-config.json');
  
  if (!fs.existsSync(initialConfigPath)) {
    store.set(loadKey, true);
    return;
  }

  try {
    const initialConfig = JSON.parse(fs.readFileSync(initialConfigPath, 'utf-8'));
    const settings = await dbOptions.getSettings();
    const updated = { ...settings };
    let changed = false;

    if (initialConfig.terapiasDir && !updated.terapiasDir) {
      updated.terapiasDir = initialConfig.terapiasDir;
      changed = true;
    }
    if (initialConfig.terapiasBackup && !updated.terapiasBackup) {
      updated.terapiasBackup = initialConfig.terapiasBackup;
      changed = true;
    }
    if (initialConfig.terapiasProcessed && !updated.terapiasProcessed) {
      updated.terapiasProcessed = initialConfig.terapiasProcessed;
      changed = true;
    }
    if (initialConfig.tesseractPath && !updated.tesseractPath) {
      updated.tesseractPath = initialConfig.tesseractPath;
      changed = true;
    }

    if (changed) {
      await dbOptions.saveSettings(updated);
      logger.info('[MAIN] Configuración inicial cargada desde initial-config.json');
    }

    // Eliminar archivo de configuración inicial después de cargarlo
    fs.unlinkSync(initialConfigPath);
  } catch (err) {
    logger.error('[MAIN] Error cargando configuración inicial:', err);
  }

  store.set(loadKey, true);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app?.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public');

let win: BrowserWindowType | null;
let globalWatcher: FSWatcher | null = null;
// Security allowlists for IPC path validation
const registeredDroppedPaths = new Set<string>(); // real paths validated via validateAndRegisterDroppedFile
const CONTROLHUB_TEMP_DIR = path.join(os.tmpdir(), 'controlhub-pdftools');

// C4: Config allowlist — solo flags de migración one-time (settings viven en settings.json vía db:*)
const ALLOWED_CONFIG_KEYS = ['migration.legacyLocalStorage'];

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
      // Output: subpath of an approved dialog directory OR subpath of input file directories
      for (const approved of dialogApprovedPaths) {
        const approvedNorm = normalize(approved);
        const rel = path.relative(approvedNorm, normResolved);
        if (!rel.startsWith('..') && !path.isAbsolute(rel)) return true;
      }
      
      // Allow output in same directory as input files (for auto-generated output paths)
      for (const allowedFile of sessionAllowedFiles) {
        const allowedDir = path.dirname(allowedFile);
        const allowedDirNorm = normalize(allowedDir);
        const rel = path.relative(allowedDirNorm, normResolved);
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

// Evitar que promesas no manejadas terminen el proceso sin traza
process.on('unhandledRejection', (reason) => {
  logger.warn('[MAIN] Unhandled Promise Rejection:', reason);
});

// ─────────────────────────────────────────────────────────────────────────────
// Sidecar Manager: Gestión unificada de procesos Python
// ─────────────────────────────────────────────────────────────────────────────

const SIDECAR_DEFAULT_TIMEOUT_MS = 30000; // 30 segundos (fallback global)

const SIDECAR_COMMAND_TIMEOUTS: Record<string, number> = {
  // Operaciones rápidas / Metadatos (10s - 15s)
  'ping': 10000,
  'get_page_info': 15000,
  'pdf_thumbnail': 15000,
  'page_thumbnails': 30000,
  
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

  // Comandos del sidecar Terapias
  'check_word': 15000,
  'list_docs': 15000,
  'prepare': 30000,
  'finalize': 60000,
  'get_history': 10000,
  'search_patient': 30000,
};

// Validación de payload para sidecar
interface SidecarPayload {
  id?: string;
  cmd?: string;
  data?: any;
}

function validateSidecarPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, error: 'Payload must be an object' };
  }

  if (!payload.cmd || typeof payload.cmd !== 'string') {
    return { valid: false, error: 'Payload must have a valid cmd field' };
  }

  const validCommands = Object.keys(SIDECAR_COMMAND_TIMEOUTS);
  if (!validCommands.includes(payload.cmd)) {
    return { valid: false, error: `Unknown command: ${payload.cmd}. Valid commands: ${validCommands.join(', ')}` };
  }

  // Validar que data sea un objeto si está presente
  if (payload.data !== undefined && typeof payload.data !== 'object') {
    return { valid: false, error: 'Payload data must be an object if present' };
  }

  // Validar longitud de strings para prevenir ataques de inyección
  const maxStringLength = 10000;
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === 'string' && value.length > maxStringLength) {
      return { valid: false, error: `Field ${key} exceeds maximum length of ${maxStringLength} characters` };
    }
  }

  return { valid: true };
}

class SidecarManager {
  private process: ChildProcess | null = null;
  private name: string;
  private scriptPath: string;
  private pendingResolvers = new Map<string, (value: any) => void>();
  private requestIdCounter = 0;
  private stdoutBuffer: string = "";
  private stderrBuffer: string = "";
  private restartAttempts: number = 0;
  private readonly maxRestarts: number = 3; // enable automatic restarts with bounded retries
  private readonly backoffTimes: number[] = [2000, 4000, 8000];
  private status: 'running' | 'closed' | 'stalled' | 'reconnecting' | 'failed' | 'ok' | 'unknown' = 'unknown';
  private commandTimestamps = new Map<string, { cmd: string; startTime: number; inputPath: string }>();

  constructor(name: string, scriptPath: string) {
    this.name = name;
    this.scriptPath = scriptPath;
  }

  private setStatus(newStatus: 'running' | 'closed' | 'stalled' | 'reconnecting' | 'failed' | 'ok' | 'unknown') {
    this.status = newStatus;
    // Envío defensivo: comprobar que la ventana y webContents no estén destruidos
    try {
      if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.webContents.send('sidecar:status', { name: this.name, status: newStatus });
      } else {
        logger.warn(`[Sidecar] ${this.name}: ventana no disponible, omitido envío de status:`, newStatus);
      }
    } catch (err) {
      logger.warn(`[Sidecar] ${this.name}: fallo al enviar status (ventana puede estar destruida):`, err);
    }
  }

  start() {
    logger.debug(`[Sidecar] proceso ${this.name} activo`);
    const pythonExe = getPythonExecutable();
    if (!pythonExe) {
      logger.error(`[${this.name}] No se pudo iniciar porque no se encontró el runtime Python embebido.`);
      this.setStatus('failed');
      return;
    }

    this.process = spawn(pythonExe, [this.scriptPath], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    // Reset restart attempts on successful start
    this.restartAttempts = 0;
    this.setStatus('running');

    this.process.stdout?.on("data", (data) => {
      const out = data.toString();
      // Log raw stdout for debugging
      logger.debug(`[Sidecar] ${this.name} STDOUT:`, out);
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
              logger.warn(`[Sidecar] ${this.name}: Respuesta recibida sin ID o ID no encontrado: ${id}`);
              const firstId = this.pendingResolvers.keys().next().value;
              if (firstId) {
                const resolver = this.pendingResolvers.get(firstId);
                this.pendingResolvers.delete(firstId);
                if (resolver) resolver(parsed);
              }
            }
          } catch {
            logger.error(`[Sidecar] ${this.name}: error de parseo en comunicación`);
          }
        }
      }
    });

    this.process.stderr?.on("data", (data) => {
      const errMsg = data.toString();
      this.stderrBuffer += errMsg;
      logger.error(`[Sidecar] ${this.name} STDERR:`, errMsg);
      
      // Parsear mensajes de progreso de stderr
      const lines = errMsg.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('MERGE_PROGRESS:')) {
          try {
            const progressData = trimmed.replace('MERGE_PROGRESS:', '');
            const parts = progressData.split('|');
            if (parts.length !== 2) continue;
            
            const [current, pages] = parts;
            const currentParts = current.split('/');
            if (currentParts.length !== 2) continue;
            
            const [currentIdx, total] = currentParts;
            const currentNum = parseInt(currentIdx);
            const totalNum = parseInt(total);
            const pagesNum = parseInt(pages);
            
            // Validar que sean números válidos
            if (isNaN(currentNum) || isNaN(totalNum) || isNaN(pagesNum)) continue;
            if (currentNum < 0 || totalNum < 0 || pagesNum < 0) continue;
            
            // Enviar evento de progreso al renderer
            if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
              win.webContents.send('pdf:progress', {
                current: currentNum,
                total: totalNum,
                pages: pagesNum
              });
            }
          } catch (err) {
            logger.warn(`[Sidecar] Error parseando progreso:`, err);
          }
        }
      }
    });

    this.process.on("error", (err) => {
      logger.error(`[${this.name}] Error al iniciar el proceso:`, err);
    });

    this.process.on("close", (code) => {
      logger.debug(`[${this.name}] Proceso finalizado con código ${code}`);
      // If process exited with error, output captured buffers
      if (code !== 0) {
        logger.error(`[${this.name}] STDERR BUFFER:\n${this.stderrBuffer}`);
        logger.error(`[${this.name}] STDOUT BUFFER:\n${this.stdoutBuffer}`);
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

      // Validar payload antes de enviar
      const validation = validateSidecarPayload(payload);
      if (!validation.valid) {
        logger.error(`[Sidecar] ${this.name}: Payload validation failed: ${validation.error}`);
        return reject(new Error(`Payload validation failed: ${validation.error}`));
      }

      const id = (++this.requestIdCounter).toString();
      payload.id = id;

      const cmd = payload.cmd || "";
      const timeoutMs = SIDECAR_COMMAND_TIMEOUTS[cmd] || SIDECAR_DEFAULT_TIMEOUT_MS;

      // --- PDF-PERF: Capture input path for performance logging ---
      const inputPath = (payload.data?.input || payload.data?.inputs?.[0] || 'N/A') as string;
      const truncatedPath = typeof inputPath === 'string' && inputPath.length > 40 
        ? '...' + inputPath.slice(-40) 
        : inputPath;
      this.commandTimestamps.set(id, { cmd, startTime: Date.now(), inputPath: truncatedPath });

      const timer = setTimeout(() => {
        if (this.pendingResolvers.has(id)) {
          this.pendingResolvers.delete(id);
          // --- PDF-PERF: Log timeout event ---
          const timing = this.commandTimestamps.get(id);
          if (timing) {
            const duration = Date.now() - timing.startTime;
            logger.debug(`[PDF-PERF] ${this.name} cmd="${cmd}" duration=${duration}ms ok=false input="${timing.inputPath}" error="timeout"`);
            this.commandTimestamps.delete(id);
          }
          this.setStatus('stalled');
          reject(new Error(`Timeout: La operación '${cmd}' en el sidecar ${this.name} tardó más de ${timeoutMs / 1000}s. El servicio ha sido marcado como atascado.`));
        }
      }, timeoutMs);
      
      this.pendingResolvers.set(id, (value) => {
        clearTimeout(timer);
        
        // --- PDF-PERF: Log operation duration and result ---
        const timing = this.commandTimestamps.get(id);
        if (timing) {
          const duration = Date.now() - timing.startTime;
          let okStatus: 'true' | 'false' | 'unknown';
          if (value?.ok === true) {
            okStatus = 'true';
          } else if (value?.ok === false) {
            okStatus = 'false';
          } else {
            okStatus = 'unknown';
          }
          const errorMsg = okStatus !== 'true' && value?.error ? ` error="${value.error.substring(0, 50)}"` : '';
          logger.debug(`[PDF-PERF] ${this.name} cmd="${cmd}" duration=${duration}ms ok=${okStatus} input="${timing.inputPath}"${errorMsg}`);
          this.commandTimestamps.delete(id);
        }
        
        resolve(value);
      });

      try {
        this.process.stdin?.write(JSON.stringify(payload) + "\n");
      } catch (writeErr) {
        clearTimeout(timer);
        this.pendingResolvers.delete(id);
        // --- PDF-PERF: Clean up timing on write error ---
        this.commandTimestamps.delete(id);
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

  isRunning(): boolean {
    return this.status === 'running' || this.status === 'ok';
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

const getPythonExecutable = (): string | null => {
  const embeddedPython = path.join(
    app.isPackaged ? process.resourcesPath : process.cwd(),
    'python-embed',
    'python.exe'
  );

  if (fs.existsSync(embeddedPython)) {
    return embeddedPython;
  }

  if (!app.isPackaged) {
    return 'python';
  }

  logger.error(`[Sidecar] Python embebido no encontrado en ${embeddedPython}`);
  return null;
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
ipcMain.handle('terapias:check_word', async (_, wordExecutablePath?: string) => {
  const settings = await getAppSettings();
  const pathToUse = wordExecutablePath || settings.wordExecutablePath;
  logger.debug(`[terapias:check_word] wordExecutablePath param: ${wordExecutablePath}`);
  logger.debug(`[terapias:check_word] settings.wordExecutablePath: ${settings.wordExecutablePath}`);
  logger.debug(`[terapias:check_word] pathToUse: ${pathToUse}`);
  const result = await terapiasSidecar.send({ cmd: 'check_word', data: { word_executable_path: pathToUse } });
  logger.debug(`[terapias:check_word] result: ${JSON.stringify(result)}`);
  return result;
});
ipcMain.handle('terapias:list_docs', async (_, sourceDirOverride?: string) => {
  const sourceDir = sourceDirOverride || await getActiveTerapiasDir();
  return terapiasSidecar.send({ cmd: 'list_docs', data: { source_dir: sourceDir } });
});
ipcMain.handle('terapias:prepare', async (_, data) => {
  const sourceDir = await getActiveTerapiasDir();
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
ipcMain.handle('pdf:compress', async (_, data) => {
  const settings = await getAppSettings();
  return validatePdfHandler('compress', { ...data, ghostscript_path: settings.ghostscriptPath });
});
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
ipcMain.handle('pdf:pdf_thumbnail', (_, data) => pdfSidecar.send({ cmd: 'pdf_thumbnail', data }));
ipcMain.handle('pdf:page_thumbnails', (_, data) => pdfSidecar.send({ cmd: 'page_thumbnails', data }));
ipcMain.handle('pdf:html_to_pdf', (_, data) => validatePdfHandler('html_to_pdf', data));
ipcMain.handle('pdf:protect', (_, data) => validatePdfHandler('protect', data));
ipcMain.handle('pdf:unlock', (_, data) => validatePdfHandler('unlock', data));
ipcMain.handle('pdf:repair', (_, data) => validatePdfHandler('repair', data));
ipcMain.handle('pdf:ocr', async (_, data) => {
  const tesseractPath = await getActiveTesseractPath();

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

// IPC Handler para copiar archivos (usado por askBeforeSave)
ipcMain.handle('pdf:copyOutputFile', async (_, source: string, destination: string) => {
  try {
    fs.promises.copyFile(source, destination);
    // Eliminar archivo temporal después de copiar
    fs.promises.unlink(source).catch(() => {
      // Ignorar error si no se puede eliminar el temporal
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
});

// IPC Handler para OCR Fallback (Main Process)
ipcMain.handle('ocr:extractText', async (_, pdfPath: string) => {
  logger.debug('[MAIN] Iniciando OCR Fallback para:', pdfPath);
  const tempDir = path.join(os.tmpdir(), 'controlhub-ocr');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  let imgPath: string | null = null;

  try {
    // Validar que el archivo PDF existe
    if (!fs.existsSync(pdfPath)) {
      throw new Error(`Archivo PDF no existe: ${pdfPath}`);
    }

    // Validar que el sidecar esté disponible
    if (!pdfSidecar.isRunning()) {
      throw new Error('Sidecar PDF no está disponible para OCR fallback');
    }

    // 1. Convertir página 1 del PDF a JPG usando el sidecar
    // Solicitar al sidecar solo la primera página para OCR (reduce I/O y tiempo)
    const res = await pdfSidecar.send({ 
      cmd: 'pdf_to_jpg', 
      data: { input: pdfPath, output_dir: tempDir, dpi: 300, pages: [1] } 
    });

    if (!res.ok || !res.outputs || res.outputs.length === 0) {
      throw new Error(res.error || 'Fallo al convertir PDF a imagen');
    }

    imgPath = res.outputs[0];
    
    // Validar que la imagen se generó correctamente
    if (!imgPath || !fs.existsSync(imgPath)) {
      throw new Error(`Imagen generada no existe: ${imgPath}`);
    }

    // 2. Extraer texto con Tesseract en el Main Process
    // Pasar explícitamente `workerPath` para evitar que tesseract.js construya
    // una ruta relativa errónea durante el bundle (ver issue con worker-script).
    const workerOptions = (() => {
      try {
        // Preferir resolución de módulo (más fiable en dev y paquetes)
        return { workerPath: require.resolve('tesseract.js/src/worker/node/index.js') };
      } catch {
        // Fallback conservador relativo a __dirname
        return { workerPath: path.join(__dirname, '..', 'node_modules', 'tesseract.js', 'src', 'worker', 'node', 'index.js') };
      }
    })();

    logger.debug('[MAIN-OCR] Iniciando reconocimiento Tesseract para:', imgPath);
    const { data: { text } } = await Tesseract.recognize(imgPath, 'spa', workerOptions);
    
    // 3. Limpiar archivo temporal
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        fs.unlinkSync(imgPath);
        logger.debug('[MAIN-OCR] Archivo temporal eliminado:', imgPath);
      } catch (cleanupErr) {
        logger.warn('[MAIN-OCR] Error eliminando archivo temporal:', cleanupErr);
      }
    }
    
    return text;
  } catch (err: any) {
    logger.error('[MAIN-OCR] Error en OCR fallback:', {
      error: err.message,
      pdfPath,
      imgPath,
      stack: err.stack
    });

    // Intentar limpiar archivo temporal incluso en caso de error
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        fs.unlinkSync(imgPath);
      } catch (cleanupErr) {
        logger.warn('[MAIN-OCR] Error eliminando archivo temporal después de error:', cleanupErr);
      }
    }

    // Retornar string vacío en caso de error para mantener compatibilidad
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
    logger.warn(`[CONFIG] Intento de lectura de clave no permitida: "${key}"`);
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
    const sourceDir = await getActiveTerapiasDir();

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
    logger.error('[Dashboard Stats Error]', err);
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
  // Inicializar logger con estado de empaquetado
  logger.init(app.isPackaged);
  
  // Registrar protocolo pdfthumb:// para servir thumbnails
  protocol.handle('pdfthumb', async (request) => {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    
    try {
      const url = new URL(request.url);
      let rawName = url.hostname || '';
      if (!rawName || rawName === 'localhost') {
        rawName = url.pathname.replace(/^\//, '');
      }
      const filename = path.basename(rawName);
      
      // Seguridad: solo archivos que empiecen con pdfthumb_ y terminen en .png
      if (!filename.startsWith('pdfthumb_') || !filename.endsWith('.png')) {
        return new Response('Forbidden', { status: 403 });
      }
      const filePath = path.join(os.tmpdir(), filename);
      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
      }
      const buffer = fs.readFileSync(filePath);
      return new Response(buffer, {
        headers: { 'Content-Type': 'image/png' }
      });
    } catch (e) {
      return new Response('Error', { status: 500 });
    }
  });
  
  await migrateElectronStoreToSettings();
  
  // Leer configuración inicial del instalador si existe
  await loadInitialConfig();

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

ipcMain.handle('dialog:selectFiles', async (_, options) => {
  if (!win) return null;
  const filters = Array.isArray(options) ? options : options?.filters;
  const defaultPath = options?.defaultPath;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: filters || [],
    defaultPath
  });
  if (canceled || filePaths.length === 0) return null;
  // Register approved file paths
  filePaths.forEach(fp => dialogApprovedPaths.add(path.resolve(fp)));
  return filePaths;
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
    logger.error('[fs:listFiles] Error:', err);
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
              foundCount: arrayOfFiles.length,
              stage: 'exploring',
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
    logger.error('Error reading directory:', err);
    return { files: [], totalScanned: 0 };
  }
});

ipcMain.handle('fs:checkPath', async (_, targetPath: string) => {
  try {
    await fs.promises.access(targetPath, fs.constants.F_OK);
    return { exists: true };
  } catch {
    return { exists: false };
  }
});

// IPC: Check write access for a path (used by renderer via preload)
ipcMain.handle('fs:checkWriteAccess', async (_, targetPath: string) => {
  try {
    // Attempt to access with write permission flag
    await fs.promises.access(targetPath, fs.constants.W_OK);
    return { writable: true };
  } catch {
    return { writable: false };
  }
});

// IPC: Get system temp path (used by renderer for temporary files)
ipcMain.handle('system:getTempPath', async () => {
  return os.tmpdir();
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
  logger.debug('[MAIN] Entrando a fs:parsePdf para:', pdfPath);
  if (!pdfWorkerPool) {
    const workerPath = path.join(__dirname, 'pdfWorker.js');
    const cpuCount = os.cpus().length;
    const poolSize = Math.min(5, cpuCount);
    pdfWorkerPool = new WorkerPool(poolSize, workerPath);
    logger.info(`[main] PDF WorkerPool inicializado con ${poolSize} workers (CPUs: ${cpuCount}).`);
  }
  const result = await pdfWorkerPool.parsePdf(pdfPath, maxPages);
  logger.debug('[MAIN] parsePdf resultado para:', pdfPath, 
    '| texto length:', result?.text?.length ?? 0);
  if (result && result.text) {
    logger.debug('[DEBUG-MAIN] Texto extraído del PDF:', result.text.substring(0, 800));
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
    logger.error('Error exportando archivo:', err);
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

ipcMain.handle('security:registerApprovedDirectory', async (_, dirPath: string) => {
  if (!dirPath) return { ok: false, error: 'No path provided' };
  try {
    const resolved = path.resolve(dirPath);
    const stats = await fs.promises.stat(resolved);
    if (!stats.isDirectory()) {
      return { ok: false, error: 'El path no es una carpeta válida' };
    }
    dialogApprovedPaths.add(resolved);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
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
