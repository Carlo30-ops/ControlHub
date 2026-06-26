import { FileInfo } from '../../../types';

export async function rotate(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.rotate({
    input,
    output: outputPath,
    angle: parseInt(params.rotateAngle ?? '90'),
    pages: params.rotatePages,
  });
}
