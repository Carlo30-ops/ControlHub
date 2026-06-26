import { FileInfo } from '../../../types';

/** Convert PowerPoint presentation to PDF */
export async function pp2p(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.pptToPdf({ input, output: outputPath });
}
