// ─────────────────────────────────────────────────────────────────────────────
// logger.ts — Sistema de logging para el proceso principal de Electron
// Reemplaza console.log disperso con niveles de log condicionales
// ─────────────────────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuración: en desarrollo (no empaquetado) mostrar todo, en producción solo errores
// Se inicializa después de que app esté disponible
let IS_DEV = true;
let CURRENT_LOG_LEVEL: LogLevel = 'debug';

class ElectronLogger {
  private level: LogLevel;

  constructor(level: LogLevel = CURRENT_LOG_LEVEL) {
    this.level = level;
  }

  // Método para inicializar el logger con el estado de app
  init(isPackaged: boolean): void {
    IS_DEV = !isPackaged;
    CURRENT_LOG_LEVEL = IS_DEV ? 'debug' : 'error';
    this.level = CURRENT_LOG_LEVEL;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new ElectronLogger();
