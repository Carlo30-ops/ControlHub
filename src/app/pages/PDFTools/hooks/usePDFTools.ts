// src/app/pages/PDFTools/hooks/usePDFTools.ts
import { useState, useCallback } from "react";
import { pdfServices } from "../services/pdfServices";
import { toast } from "sonner";

/**
 * Central hook that encapsulates the state machine for PDFTools.
 * It mirrors the logic that previously lived inside PDFTools component
 * but without any JSX, making the component pure UI.
 */
export function usePDFTools() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string; path?: string } | null>(null);
  const [finalOutputPath, setFinalOutputPath] = useState<string>("");

  /** Execute an action based on the active tool.
   *  `toolId` matches the identifiers used in pdfServices.
   *  `params` are the tool‑specific arguments.
   */
  const executeAction = useCallback(
    async (toolId: string, params: Record<string, any>, providedOutput?: string) => {
      setIsProcessing(true);
      setResult(null);
      try {
        // Prioritise a user‑provided output path (from save dialog)
        const outputPath = providedOutput || finalOutputPath;
        // Append output path to params based on backend expectations
        if (toolId === "split" || toolId === "pdf_to_jpg") {
          params.output_dir = outputPath;
        } else {
          params.output = outputPath;
        }
        // Dispatch to the correct service method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const service: any = (pdfServices as any)[toolId];
        if (!service) {
          throw new Error(`Unsupported tool: ${toolId}`);
        }
        const res = await service(params);
        if (res.ok) {
          setResult({ ok: true, message: "Operación completada", path: res.output || (res.outputs && res.outputs[0]) });
          toast.success("Operación completada");
        } else {
          setResult({ ok: false, error: res.error });
          toast.error(`Error: ${res.error}`);
        }
      } catch (err: any) {
        setResult({ ok: false, error: err.message });
        toast.error(`Error crítico: ${err.message}`);
      } finally {
        setIsProcessing(false);
        setFinalOutputPath("");
      }
    },
    [finalOutputPath]
  );

  return {
    isProcessing,
    result,
    setFinalOutputPath,
    executeAction,
  };
}
