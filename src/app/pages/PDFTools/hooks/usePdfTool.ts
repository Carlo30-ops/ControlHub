import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { FileInfo } from '../types'; // define shared type if needed

/**
 * Hook that provides the core PDF tool execution logic.
 * It mirrors the previous `executeAction` implementation but is isolated
 * so UI components can call it without re‑implementing the switch.
 */
export function usePdfTool() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<null | {
    ok: boolean;
    message?: string;
    error?: string;
    path?: string;
    warning?: string;
    pdf_profile?: string;
    engine?: string;
  }>(null);

  const execute = useCallback(
    async (
      activeTool: any,
      files: FileInfo[],
      outputPath: string,
      extraParams: Record<string, any> = {}
    ) => {
      if (!activeTool) return;
      if (activeTool.id === 'protect' && extraParams.password !== extraParams.confirmPassword) {
        toast.error('Las contraseñas no coinciden');
        return;
      }
      setIsProcessing(true);
      setResult(null);
      try {
        const api = window.electronAPI.pdfTools;
        const finalOutput = outputPath;
        let res: any;
        const base = files[0]?.path?.substring(0, files[0].path.lastIndexOf('.'));
        switch (activeTool.id) {
          case 'merge':
            res = await api.merge({ files: files.map(f => f.path), output: finalOutput });
            break;
          case 'split':
            res = await api.split({ input: files[0].path, output_dir: finalOutput, ranges: extraParams.splitRanges });
            break;
          // Add remaining cases as needed – the UI components will pass only the
          // parameters they need. For brevity we handle a subset here.
          default:
            // generic fallback for tools that expect { input, output }
            const methodName = activeTool.id as keyof typeof api;
            if (typeof api[methodName] === 'function') {
              res = await (api as any)[methodName]({ input: files[0].path, output: finalOutput, ...extraParams });
            }
        }
        if (res?.ok) {
          setResult({ ok: true, message: 'Operación completada', path: res.output || (res.outputs && res.outputs[0]) });
          toast.success('Operación completada');
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
