// src/app/config/pdfToolTimeouts.ts

/**
 * Centralized timeout configuration for PDF Tools sidecar commands.
 * Values are in milliseconds.
 */
export const TOOL_TIMEOUTS: Record<string, number> = {
  // Fast operations (≈10‑15s)
  ping: 10000,
  get_page_info: 15000,

  // Standard operations (≈30s)
  merge: 30000,
  extract: 30000,
  delete_pages: 30000,
  reorder_pages: 30000,
  rotate: 30000,
  crop: 30000,
  repair: 30000,
  add_page_numbers: 30000,
  watermark: 30000,
  watermark_image: 30000,
  protect: 30000,
  unlock: 30000,

  // Medium‑heavy operations (≈60s)
  compress: 60000,
  split: 60000,
  jpg_to_pdf: 60000,
  html_to_pdf: 60000,

  // Heavy conversions and OCR (2‑5 min)
  pdf_to_jpg: 120000,
  word_to_pdf: 120000,
  excel_to_pdf: 120000,
  ppt_to_pdf: 120000,
  pdf_to_word: 300000, // 5 min
  ocr: 300000, // 5 min
};

// Global fallback if a command is not listed above
export const DEFAULT_TIMEOUT_MS = 30000;
