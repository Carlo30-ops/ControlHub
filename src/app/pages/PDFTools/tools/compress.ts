import { FileInfo } from '../../../types';

/** Compress a PDF to reduce its size */
export async function compress(api: any, files: FileInfo[], outputPath: string, params: any) {
  return await api.compress({ input: files[0]?.path ?? '', output: outputPath, level: params.compressLevel });
}
