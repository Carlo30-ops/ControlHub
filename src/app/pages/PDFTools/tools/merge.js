import { toast } from "sonner";
/**
 * Ejecuta la herramienta de 'merge' sobre varios PDFs.
 *
 * @param api         API de electron PDF tools.
 * @param inputPaths  Array de rutas de los PDFs a combinar.
 * @param outputDir   Ruta del archivo PDF resultante.
 * @param params      Parámetros adicionales (no usados aquí).
 * @returns           Objeto con éxito o error.
 */
export async function execute(api, inputPaths, outputDir, params) {
    try {
        const res = await api.merge({ inputs: inputPaths, output: outputDir });
        return { ok: true, output: res?.output };
    }
    catch (e) {
        const msg = e?.message ?? "Error inesperado al combinar PDFs";
        toast.error(msg);
        return { ok: false, error: msg };
    }
}
