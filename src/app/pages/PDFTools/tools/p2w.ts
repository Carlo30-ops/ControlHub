import { FileInfo } from '../../../types';

/** Convert PDF to Word document */
export async function p2w(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.pdfToWord({ input, output: outputPath });
}
