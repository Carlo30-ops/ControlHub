import { FileInfo } from '../../../types';

/** Apply an image watermark to a PDF */
export async function watermark_image(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.watermarkImage({
    input,
    output: outputPath,
    image: params.wmImage?.path,
    opacity: params.wmOpacity?.[0] ?? 0.3,
  });
}
