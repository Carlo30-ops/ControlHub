/**
 * Sistema de manejo de errores centralizado
 * Proporciona tipos de errores personalizados y funciones para manejar errores de forma consistente
 */

import { logger } from './logger';

export enum ErrorType {
  // Errores de sistema de archivos
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  
  // Errores de PDF
  PDF_PARSE_ERROR = 'PDF_PARSE_ERROR',
  PDF_CORRUPTED = 'PDF_CORRUPTED',
  PDF_PASSWORD_PROTECTED = 'PDF_PASSWORD_PROTECTED',
  
  // Errores de OCR
  OCR_ERROR = 'OCR_ERROR',
  OCR_ENGINE_NOT_FOUND = 'OCR_ENGINE_NOT_FOUND',
  OCR_TIMEOUT = 'OCR_TIMEOUT',
  
  // Errores de red/IPC
  IPC_ERROR = 'IPC_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Errores de validación
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Errores de configuración
  CONFIG_ERROR = 'CONFIG_ERROR',
  SETTINGS_ERROR = 'SETTINGS_ERROR',
  
  // Errores específicos de PDFTools Merge
  MERGE_INPUT = 'MERGE_INPUT',
  MERGE_RUNTIME = 'MERGE_RUNTIME',
  
  // Errores generales
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly context?: Record<string, unknown>;
  public readonly originalError?: Error;

  constructor(
    type: ErrorType,
    message: string,
    context?: Record<string, unknown>,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.context = context;
    this.originalError = originalError;
  }
}

/**
 * Maneja un error de forma centralizada, registrándolo y retornando un mensaje de error apropiado
 */
export function handleError(error: unknown, context?: string): string {
  if (error instanceof AppError) {
    logger.error(`[${context || 'App'}] ${error.type}: ${error.message}`, error.context);
    return error.message;
  }

  if (error instanceof Error) {
    logger.error(`[${context || 'App'}] ${error.message}`, error);
    return error.message;
  }

  if (typeof error === 'string') {
    logger.error(`[${context || 'App'}] ${error}`);
    return error;
  }

  logger.error(`[${context || 'App'}] Unknown error:`, error);
  return 'Error desconocido';
}

/**
 * Wrapper para funciones asíncronas que maneja errores de forma centralizada
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string,
  defaultValue?: T
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, context);
    return defaultValue;
  }
}

/**
 * Crea un error de tipo específico
 */
export function createError(
  type: ErrorType,
  message: string,
  context?: Record<string, unknown>,
  originalError?: Error
): AppError {
  return new AppError(type, message, context, originalError);
}

/**
 * Verifica si un error es de un tipo específico
 */
export function isErrorType(error: unknown, type: ErrorType): boolean {
  return error instanceof AppError && error.type === type;
}
