import { FileInfo } from '../../../types';

/** Extract specific pages from a PDF */
export async function extract(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.extract({ input, output: outputPath, pages: params.extractPages });
}
