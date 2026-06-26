import { useState, useCallback } from 'react';
import { toast } from 'sonner';
/**
 * Hook that provides the core PDF tool execution logic.
 * It mirrors the previous `executeAction` implementation but is isolated
 * so UI components can call it without re‑implementing the switch.
 */
export function usePdfTool() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);
    const execute = useCallback(async (activeTool, files, outputPath, extraParams = {}) => {
        if (!activeTool)
            return;
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
            }
            else {
                setResult({ ok: false, error: res?.error || 'Error desconocido' });
                toast.error('Error: ' + (res?.error || 'desconocido'));
            }
        }
        catch (e) {
            setResult({ ok: false, error: e.message });
            toast.error('Error crítico: ' + e.message);
        }
        finally {
            setIsProcessing(false);
        }
    }, []);
    return { isProcessing, result, execute };
}
