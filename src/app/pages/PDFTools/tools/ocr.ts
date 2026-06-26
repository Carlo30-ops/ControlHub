import { FileInfo } from '../../../types';

/** Perform OCR on a PDF */
export async function ocr(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.ocr({ input, output: outputPath, lang: params.ocrLang });
}
