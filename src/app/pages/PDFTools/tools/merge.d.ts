/**
 * Ejecuta la herramienta de 'merge' sobre varios PDFs.
 *
 * @param api         API de electron PDF tools.
 * @param inputPaths  Array de rutas de los PDFs a combinar.
 * @param outputDir   Ruta del archivo PDF resultante.
 * @param params      Parámetros adicionales (no usados aquí).
 * @returns           Objeto con éxito o error.
 */
export declare function execute(api: any, inputPaths: string[], outputDir: string, params: any): Promise<{
    ok: boolean;
    output?: string;
    error?: string;
}>;
