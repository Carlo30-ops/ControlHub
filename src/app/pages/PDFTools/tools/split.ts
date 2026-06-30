import { FileInfo } from '../../../types';

/** Split PDF into multiple files based on page ranges */
export async function split(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  
  // Validaciones frontend
  if (!input) {
    throw new Error('No se proporcionó archivo para dividir');
  }
  
  if (!params.splitRanges || !params.splitRanges.trim()) {
    throw new Error('No se especificaron rangos de páginas');
  }
  
  // Validar formato de rangos básico
  const rangePattern = /^(\d+(-\d+|-z)?)(,\s*\d+(-\d+|-z)?)*$/;
  if (!rangePattern.test(params.splitRanges.trim())) {
   throw new Error('Formato de rangos inválido. Usa: "1-3, 5, 7-z"');
  }
  
  return await api.split({
    input,
    output_dir: outputPath,
    ranges: params.splitRanges,
    naming_pattern: params.namingPattern ?? 'part'
  });
}
