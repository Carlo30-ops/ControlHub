import { FileInfo } from '../../../types';

/** Convert Excel workbook to PDF */
export async function e2p(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.excelToPdf({ input, output: outputPath });
}
