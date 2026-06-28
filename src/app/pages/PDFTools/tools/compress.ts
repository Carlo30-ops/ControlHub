import { FileInfo } from '../../../types';

/** Compress a PDF to reduce its size */
export async function compress(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  
  // Validaciones frontend
  if (!input) {
    throw new Error('No se proporcionó archivo para comprimir');
  }
  
  if (!params.compressLevel) {
    throw new Error('No se especificó el nivel de compresión');
  }
  
  const validLevels = ['screen', 'ebook', 'printer'];
  if (!validLevels.includes(params.compressLevel)) {
    throw new Error(`Nivel de compresión inválido: ${params.compressLevel}`);
  }
  
  return await api.compress({ 
    input, 
    output: outputPath, 
    level: params.compressLevel 
  });
}
