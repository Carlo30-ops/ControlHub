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
        const api = window.electronAPI.pdfTools;
        const finalOutput = outputPath;
        let res: any;
        let successMsg = "Operación completada";

        switch (activeTool.id) {
          case 'merge':
            res = await (api as any).merge({ files: files.map(f => f.path), output: finalOutput });
            successMsg = "PDFs unidos correctamente";
            break;
          case 'split':
            res = await (api as any).split({ input: files[0].path, output_dir: finalOutput, ranges: extraParams.splitRanges });
            successMsg = "PDF dividido correctamente";
            break;
          case 'extract':
            res = await (api as any).extract({ input: files[0].path, output: finalOutput, pages: extraParams.extractPages });
            successMsg = "Páginas extraídas correctamente";
            break;
          case 'delete_pages':
            res = await (api as any).deletePages({ input: files[0].path, output: finalOutput, pages: extraParams.deletePagesInput });
            successMsg = "Páginas eliminadas correctamente";
            break;
          case 'reorder_pages':
            res = await (api as any).reorderPages({ input: files[0].path, output: finalOutput, order: extraParams.pageOrder });
            successMsg = "Orden de páginas actualizado";
            break;
          case 'compress':
            res = await (api as any).compress({ input: files[0].path, output: finalOutput, level: extraParams.compressLevel });
            successMsg = "PDF comprimido correctamente";
            break;
          case 'rotate':
            res = await (api as any).rotate({ input: files[0].path, output: finalOutput, angle: parseInt(extraParams.rotateAngle || '0'), pages: extraParams.rotatePages });
            successMsg = "Páginas rotadas correctamente";
            break;
          case 'crop':
            res = await (api as any).crop({ input: files[0].path, output: finalOutput, rect: [extraParams.cropRect?.x0 || 0, extraParams.cropRect?.y0 || 0, extraParams.cropRect?.x1 || 0, extraParams.cropRect?.y1 || 0] });
            successMsg = "PDF recortado correctamente";
            break;
          case 'repair':
            res = await (api as any).repair({ input: files[0].path, output: finalOutput });
            successMsg = "PDF reparado";
            break;
          case 'add_page_numbers':
            res = await (api as any).addPageNumbers({ input: files[0].path, output: finalOutput, position: extraParams.pageNumberPos, start: parseInt(extraParams.pageNumberStart || '1') });
            successMsg = "Números de página insertados";
            break;
          case 'watermark':
            res = await (api as any).watermark({ input: files[0].path, output: finalOutput, text: extraParams.wmText, opacity: extraParams.wmOpacity?.[0], angle: parseInt(extraParams.wmAngle || '0') });
            successMsg = "Marca de agua de texto añadida";
            break;
          case 'watermark_image':
            res = await (api as any).watermarkImage({ input: files[0].path, output: finalOutput, image: extraParams.wmImage?.path, opacity: extraParams.wmOpacity?.[0] });
            successMsg = "Marca de agua de imagen añadida";
            break;
          case 'jpg_to_pdf':
            res = await (api as any).jpgToPdf({ images: files.map(f => f.path), output: finalOutput });
            successMsg = "Imágenes convertidas a PDF";
            break;
          case 'pdf_to_jpg':
            res = await (api as any).pdfToJpg({ input: files[0].path, output_dir: finalOutput, dpi: parseInt(extraParams.dpi || '150') });
            successMsg = "Páginas convertidas a JPG";
            break;
          case 'html_to_pdf':
            res = await (api as any).htmlToPdf({ input: files[0].path, output: finalOutput });
            successMsg = "HTML convertido a PDF";
            break;
          case 'protect':
            res = await (api as any).protect({ input: files[0].path, output: finalOutput, password: extraParams.password });
            successMsg = "PDF protegido con contraseña";
            break;
          case 'unlock':
            res = await (api as any).unlock({ input: files[0].path, output: finalOutput, password: extraParams.password });
            successMsg = "Contraseña eliminada del PDF";
            break;
          case 'ocr':
            res = await (api as any).ocr({ input: files[0].path, output: finalOutput, lang: extraParams.ocrLang });
            successMsg = "OCR completado, el PDF ahora es buscable";
            break;
          case 'w2p':
            res = await (api as any).wordToPdf({ input: files[0].path, output: finalOutput });
            successMsg = "Word convertido a PDF";
            break;
          case 'p2w':
            res = await (api as any).pdfToWord({ input: files[0].path, output: finalOutput });
            successMsg = "PDF convertido a Word";
            break;
          case 'e2p':
            res = await (api as any).excelToPdf({ input: files[0].path, output: finalOutput });
            successMsg = "Excel convertido a PDF";
            break;
          case 'pp2p':
            res = await (api as any).pptToPdf({ input: files[0].path, output: finalOutput });
            successMsg = "PowerPoint convertido a PDF";
            break;
          default:
            const methodName = activeTool.id as keyof typeof api;
            if (typeof api[methodName] === 'function') {
              res = await (api as any)[methodName]({ input: files[0].path, output: finalOutput, ...extraParams });
            }
        }

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
