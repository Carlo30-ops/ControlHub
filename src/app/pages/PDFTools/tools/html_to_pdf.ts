import { FileInfo } from '../../../types';

export async function html_to_pdf(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.htmlToPdf({ input, output: outputPath });
}
