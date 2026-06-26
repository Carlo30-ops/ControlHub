import { FileInfo } from '../../../types';

/** Convert PDF pages to JPG images */
export async function pdf_to_jpg(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.pdfToJpg({
    input,
    output_dir: outputPath,
    dpi: parseInt(params.dpi ?? '150'),
  });
}
