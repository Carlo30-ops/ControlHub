import { FileInfo } from '../../../types';

/** Attempt to repair a corrupted PDF */
export async function repair(api: any, files: FileInfo[], outputPath: string) {
  const input = files[0]?.path ?? '';
  return await api.repair({ input, output: outputPath });
}
