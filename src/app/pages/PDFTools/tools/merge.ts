import { FileInfo } from '../../../types';
import { z } from 'zod';
import { AppError, ErrorType } from '../../../utils/errorHandler';

interface MergeParams {
  preserveBookmarks?: boolean;
  renumberPages?: boolean;
}

export async function merge(api: any, files: FileInfo[], outputPath: string, params: MergeParams = {}) {
  const mergeSchema = z.object({
    files: z.array(z.object({ path: z.string().min(1) })).min(2, 'Se requieren al menos 2 archivos para fusionar'),
    outputPath: z.string().min(1, 'Se requiere una ruta de salida').regex(/\.pdf$/i, 'El archivo de salida debe tener extensión .pdf'),
    params: z.object({
      preserveBookmarks: z.boolean().optional(),
      renumberPages: z.boolean().optional(),
    }).optional(),
  });

  const validation = mergeSchema.safeParse({ files, outputPath, params });
  if (!validation.success) {
    throw new AppError(ErrorType.MERGE_INPUT, validation.error.message);
  }
  const inputs = validation.data.files.map((f: any) => f.path);
  const mergedParams = validation.data.params ?? {};

  // Verificar duplicados (validación adicional no cubierta por Zod)
  const uniqueInputs = new Set(inputs);
  if (uniqueInputs.size !== inputs.length) {
    throw new AppError(ErrorType.MERGE_INPUT, 'Se detectaron archivos duplicados en la lista');
  }

  return await api.merge({ 
    files: inputs, 
    output: outputPath,
    preserve_bookmarks: params.preserveBookmarks ?? true,
    renumber_pages: params.renumberPages ?? false
  });
}
