// ─────────────────────────────────────────────────────────────────────────────
// logger.ts — Sistema de logging centralizado
// Reemplaza console.log disperso con niveles de log condicionales
// ─────────────────────────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Configuración: cambiar a 'debug' para ver todos los logs en desarrollo
// En producción, solo se muestran errores
const IS_BROWSER = typeof window !== 'undefined' && typeof window.location !== 'undefined';
const IS_DEV = IS_BROWSER ? !window.location.protocol.includes('file') : false;
const CURRENT_LOG_LEVEL: LogLevel = IS_DEV ? 'debug' : 'error';

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = CURRENT_LOG_LEVEL) {
    this.level = level;
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

  // Método para cambiar el nivel de log en runtime
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Exportar instancia singleton
export const logger = new Logger();

// Exportar tipo para uso en componentes
export type { LogLevel };
