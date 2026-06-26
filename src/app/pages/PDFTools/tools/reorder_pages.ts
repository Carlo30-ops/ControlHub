import { FileInfo } from '../../../types';

export async function reorder_pages(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.reorderPages({ input, output: outputPath, order: params.pageOrder });
}
