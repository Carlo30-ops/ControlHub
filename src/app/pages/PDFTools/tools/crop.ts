import { FileInfo } from '../../../types';

/** Crop a PDF to the rectangle defined in params.cropRect */
export async function crop(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  const rect = [
    params.cropRect?.x0 ?? 0,
    params.cropRect?.y0 ?? 0,
    params.cropRect?.x1 ?? 595,
    params.cropRect?.y1 ?? 842,
  ];
  return await api.crop({ input, output: outputPath, rect });
}
