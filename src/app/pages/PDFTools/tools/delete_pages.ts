import { FileInfo } from '../../../types';

/** Delete specific pages from a PDF */
export async function deletePages(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.deletePages({ input, output: outputPath, pages: params.deletePagesInput });
}
