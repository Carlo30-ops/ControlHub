import { FileInfo } from '../../../types';

export async function merge(api: any, files: FileInfo[], outputPath: string) {
  return await api.merge({ inputs: files.map(f => f.path), output: outputPath });
}
