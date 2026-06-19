// src/app/pages/PDFTools/services/pdfServices.ts
// Pure service layer that forwards PDF tool requests to the Electron backend.
// The backend expects a strict payload key `{ output: finalOutput }` for most calls.
// For tools that output a directory (split, pdf_to_jpg) the key is `output_dir`.

export interface PdfServiceParams {
  input?: string;
  files?: string[];
  output?: string;
  output_dir?: string;
  ranges?: string;
  pages?: string;
  level?: string;
  angle?: number;
  order?: number[];
  rect?: [number, number, number, number];
  text?: string;
  opacity?: number;
  password?: string;
  lang?: string;
  dpi?: number;
  image?: string;
  // Additional future params can be added without breaking the API.
}

type PdfApi = typeof window.electronAPI.pdfTools;

/**
 * Helper that builds the strict payload expected by the backend.
 * It always includes the `output` key (or `output_dir` when appropriate).
 */
function buildPayload(params: PdfServiceParams, toolId: string): Record<string, any> {
  const base: Record<string, any> = {};
  if (params.input) base.input = params.input;
  if (params.files) base.files = params.files;
  if (params.ranges) base.ranges = params.ranges;
  if (params.pages) base.pages = params.pages;
  if (params.level) base.level = params.level;
  if (params.angle !== undefined) base.angle = params.angle;
  if (params.order) base.order = params.order;
  if (params.rect) base.rect = params.rect;
  if (params.text) base.text = params.text;
  if (params.opacity !== undefined) base.opacity = params.opacity;
  if (params.password) base.password = params.password;
  if (params.lang) base.lang = params.lang;
  if (params.dpi) base.dpi = params.dpi;
  if (params.image) base.image = params.image;

  // The backend distinguishes output vs output_dir based on the tool.
  if (toolId === 'split' || toolId === 'pdf_to_jpg') {
    if (params.output_dir) base.output_dir = params.output_dir;
  } else {
    if (params.output) base.output = params.output;
  }
  return base;
}

/**
 * Centralised PDF services object.
 * Each method returns the raw response from the backend (which follows
 * `{ ok: boolean, output?: string, outputs?: string[], error?: string }`).
 */
export const pdfServices = {
  merge: async (files: string[], output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.merge(buildPayload({ files, output }, 'merge'));
  },
  split: async (input: string, output_dir: string, ranges: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.split(buildPayload({ input, output_dir, ranges }, 'split'));
  },
  extract: async (input: string, output: string, pages: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.extract(buildPayload({ input, output, pages }, 'extract'));
  },
  deletePages: async (input: string, output: string, pages: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.deletePages(buildPayload({ input, output, pages }, 'delete_pages'));
  },
  reorderPages: async (input: string, output: string, order: number[]) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.reorderPages(buildPayload({ input, output, order }, 'reorder_pages'));
  },
  compress: async (input: string, output: string, level: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.compress(buildPayload({ input, output, level }, 'compress'));
  },
  rotate: async (input: string, output: string, angle: number, pages?: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.rotate(buildPayload({ input, output, angle, pages }, 'rotate'));
  },
  crop: async (input: string, output: string, rect: [number, number, number, number]) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.crop(buildPayload({ input, output, rect }, 'crop'));
  },
  repair: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.repair(buildPayload({ input, output }, 'repair'));
  },
  addPageNumbers: async (input: string, output: string, position: string, start: number) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.addPageNumbers(buildPayload({ input, output, position, start }, 'add_page_numbers'));
  },
  watermark: async (input: string, output: string, text: string, opacity: number, angle: number) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.watermark(buildPayload({ input, output, text, opacity, angle }, 'watermark'));
  },
  watermarkImage: async (input: string, output: string, image: string, opacity: number) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.watermarkImage(buildPayload({ input, output, image, opacity }, 'watermark_image'));
  },
  jpgToPdf: async (files: string[], output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.jpgToPdf(buildPayload({ files, output }, 'jpg_to_pdf'));
  },
  pdfToJpg: async (input: string, output_dir: string, dpi: number) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.pdfToJpg(buildPayload({ input, output_dir, dpi }, 'pdf_to_jpg'));
  },
  htmlToPdf: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.htmlToPdf(buildPayload({ input, output }, 'html_to_pdf'));
  },
  protect: async (input: string, output: string, password: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.protect(buildPayload({ input, output, password }, 'protect'));
  },
  unlock: async (input: string, output: string, password: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.unlock(buildPayload({ input, output, password }, 'unlock'));
  },
  ocr: async (input: string, output: string, lang: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.ocr(buildPayload({ input, output, lang }, 'ocr'));
  },
  wordToPdf: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.wordToPdf(buildPayload({ input, output }, 'w2p'));
  },
  pdfToWord: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.pdfToWord(buildPayload({ input, output }, 'p2w'));
  },
  excelToPdf: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.excelToPdf(buildPayload({ input, output }, 'e2p'));
  },
  pptToPdf: async (input: string, output: string) => {
    const api = (window.electronAPI.pdfTools as PdfApi);
    return api.pptToPdf(buildPayload({ input, output }, 'pp2p'));
  },
};
