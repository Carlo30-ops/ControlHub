import { FileInfo } from '../../../types';

export async function unlock(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.unlock({ input, output: outputPath, password: params.password });
}
