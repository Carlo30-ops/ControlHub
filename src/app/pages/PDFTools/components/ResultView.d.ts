/**
 * Muestra el resultado de la herramienta ejecutada.
 * `result` proviene del hook `usePdfTool` y contiene información del archivo
 * generado, mensajes y posibles warnings.
 */
export default function ResultView({ result, onOpen, }: {
    result: {
        ok: boolean;
        message?: string;
        error?: string;
        path?: string;
        warning?: string;
        pdf_profile?: string;
        engine?: string;
    } | null;
    onOpen: (path?: string) => void;
}): import("react/jsx-runtime").JSX.Element | null;
