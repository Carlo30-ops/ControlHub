import { FileInfo } from '../../../types';

export async function merge(api: any, files: FileInfo[], outputPath: string, params: any = {}) {
  const inputs = files.map(f => f.path);
  
  // Validaciones frontend
  if (inputs.length === 0) {
    throw new Error('No se proporcionaron archivos para fusionar');
  }
  
  if (inputs.length === 1) {
    throw new Error('Se requieren al menos 2 archivos para fusionar');
  }
  
  // Verificar duplicados
  const uniqueInputs = new Set(inputs);
  if (uniqueInputs.size !== inputs.length) {
    throw new Error('Se detectaron archivos duplicados en la lista');
  }
  
  return await api.merge({ 
    files: inputs, 
    output: outputPath,
    preserve_bookmarks: params.preserveBookmarks ?? true,
    renumber_pages: params.renumberPages ?? false
  });
}
