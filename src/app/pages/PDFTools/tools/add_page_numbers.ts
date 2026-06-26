import { FileInfo } from '../../../types';

/** Add page numbers to a PDF */
export async function add_page_numbers(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.addPageNumbers({
    input,
    output: outputPath,
    position: params.pageNumberPos,
    start: parseInt(params.pageNumberStart ?? '1'),
  });
}
