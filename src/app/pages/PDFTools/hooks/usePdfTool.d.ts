import { FileInfo } from '../../../types';
interface PdfToolResult {
    ok: boolean;
    message?: string;
    error?: string;
    path?: string;
    warning?: string;
    pdf_profile?: string;
    engine?: string;
}
interface PdfToolParams {
    password?: string;
    confirmPassword?: string;
    splitRanges?: string;
    extractPages?: string;
    deletePagesInput?: string;
    pageOrder?: number[];
    compressLevel?: number | string;
    rotateAngle?: string;
    rotatePages?: string;
    cropRect?: {
        x0: number;
        y0: number;
        x1: number;
        y1: number;
    };
    pageNumberPos?: string;
    pageNumberStart?: string;
    wmText?: string;
    wmOpacity?: number[];
    wmAngle?: string;
    wmImage?: {
        path: string;
    } | null;
    dpi?: string;
    ocrLang?: string;
}
/**
 * Hook that provides the core PDF tool execution logic.
 * It mirrors the previous `executeAction` implementation but is isolated
 * so UI components can call it without re‑implementing the switch.
 */
export declare function usePdfTool(): {
    isProcessing: boolean;
    result: PdfToolResult | null;
    execute: (activeTool: any, files: FileInfo[], outputPath: string, extraParams?: PdfToolParams) => Promise<void>;
};
export {};
