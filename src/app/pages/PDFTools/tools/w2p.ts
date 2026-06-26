import { FileInfo } from '../../../types';

/** Convert Word document to PDF */
export async function w2p(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.wordToPdf({ input, output: outputPath });
}
