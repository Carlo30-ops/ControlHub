import { FileInfo } from '../../../types';

/** Convert a JPG/PNG image to PDF */
export async function jpg_to_pdf(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.jpgToPdf({ input, output: outputPath });
}
