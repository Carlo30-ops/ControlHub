import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FileInfo } from '../../../types'; // define shared type if needed

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
  cropRect?: { x0: number; y0: number; x1: number; y1: number };
  pageNumberPos?: string;
  pageNumberStart?: string;
  wmText?: string;
  wmOpacity?: number[];
  wmAngle?: string;
  wmImage?: { path: string } | null;
  dpi?: string;
  ocrLang?: string;
}

/**
 * Hook that provides the core PDF tool execution logic.
 * It mirrors the previous `executeAction` implementation but is isolated
 * so UI components can call it without re‑implementing the switch.
 */
export function usePdfTool() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<null | PdfToolResult>(null);

  const execute = useCallback(
    async (
      activeTool: any,
      files: FileInfo[],
      outputPath: string,
      extraParams: PdfToolParams = {}
    ) => {
      if (!activeTool) return;
      if (activeTool.id === 'protect' && extraParams.password !== extraParams.confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }
      setIsProcessing(true);
      setResult(null);
      try {
        const finalOutput = outputPath;
        // Delegated execution to external module
        const { executeTool } = await import('../tools/executeTool');
        const { res, successMsg } = await executeTool(window.electronAPI.pdfTools, activeTool, files, finalOutput, extraParams);

        if (res?.ok) {
          setResult({
            ok: true,
            message: successMsg,
            path: res.output || (res.outputs && res.outputs[0]),
            warning: res.warning,
            pdf_profile: res.pdf_profile,
            engine: res.engine,
          });
          toast.success(successMsg);
        } else {
          setResult({ ok: false, error: res?.error || 'Error desconocido' });
          toast.error('Error: ' + (res?.error || 'desconocido'));
        }
      } catch (e: any) {
        setResult({ ok: false, error: e.message });
        toast.error('Error crítico: ' + e.message);
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  return { isProcessing, result, execute };
}
