/**
 * Constantes centralizadas para la aplicación
 */

export * from './colors';

// Meses del año en español
export const MONTHS_ORDER = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

// Formatos de fecha
export const DATE_FORMATS = {
  DISPLAY: "DD/MM/YYYY",
  ISO: "YYYY-MM-DD",
  MONTH_YEAR: "MMMM YYYY",
} as const;

// Límites de paginación
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;

// Umbrales de formateo de moneda
export const CURRENCY_THRESHOLDS = {
  BILLION: 1_000_000_000,
  MILLION: 1_000_000,
  THOUSAND: 1_000,
} as const;
