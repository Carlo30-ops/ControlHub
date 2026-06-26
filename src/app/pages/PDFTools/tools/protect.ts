import { FileInfo } from '../../../types';

/** Protect a PDF with a password */
export async function protect(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.protect({ input, output: outputPath, password: params.password });
}
