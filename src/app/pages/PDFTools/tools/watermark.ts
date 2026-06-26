import { FileInfo } from '../../../types';

/** Apply a textual watermark */
export async function watermark(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  return await api.watermark({
    input,
    output: outputPath,
    text: params.wmText,
    opacity: params.wmOpacity?.[0] ?? 0.3,
    angle: parseInt(params.wmAngle ?? '45'),
  });
}
