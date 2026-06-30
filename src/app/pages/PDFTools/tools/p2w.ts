import { FileInfo } from '../../../types';

/** Convert PDF to Word document */
export async function p2w(api: any, files: FileInfo[], outputPath: string, params: any) {
  const input = files[0]?.path ?? '';
  
  // Validaciones frontend
  if (!input) {
    throw new Error('No se proporcionó archivo para convertir');
  }
  
  if (!outputPath) {
    throw new Error('No se proporcionó ruta de salida');
  }
  
  // Validar que el archivo de salida tenga extensión .docx
  if (!outputPath.toLowerCase().endsWith('.docx')) {
    throw new Error('El archivo de salida debe tener extensión .docx');
  }
  
  // Parámetros opcionales
  const tesseractPath = params?.tesseractPath;
  
  return await api.pdfToWord({ 
    input, 
    output: outputPath,
    tesseract_path: tesseractPath
  });
}
