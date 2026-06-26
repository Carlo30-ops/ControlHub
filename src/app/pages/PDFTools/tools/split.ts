import { FileInfo } from '../../../types';

/** Split PDF into multiple files based on page ranges */
export async function split(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.split({ input, output_dir: outputPath, ranges: params.splitRanges });
}
