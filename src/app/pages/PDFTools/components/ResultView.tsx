import React, { useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import { toast } from 'sonner';

/**
 * Muestra el resultado de la herramienta ejecutada.
 * `result` proviene del hook `usePdfTool` y contiene información del archivo
 * generado, mensajes y posibles warnings.
 */
export default function ResultView({
  result,
  onOpen,
}: {
  result: {
    ok: boolean;
    message?: string;
    error?: string;
    path?: string;
    warning?: string;
    pdf_profile?: string;
    engine?: string;
    original_size?: number;
    compressed_size?: number;
    reduction_percent?: number;
    total_pages?: number;
    files_merged?: number;
  } | null;
  onOpen: (path?: string) => void;
}) {
  if (!result) return null;

  const handleOpen = () => {
    if (result?.path) {
      onOpen(result.path);
    } else {
      toast.error('No hay ruta de archivo disponible');
    }
  };

  const mainMessage = useMemo(
    () => (result.ok ? result.message ?? '' : result.error ?? ''),
    [result]
  );

  const warningMessage = useMemo(() => result.warning ?? '', [result]);

  // Métricas de compresión
  const compressionMetrics = useMemo(() => {
    if (result.original_size && result.compressed_size && result.reduction_percent !== undefined) {
      const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      };
      
      return (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tamaño original:</span>
            <span className="font-medium">{formatSize(result.original_size)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tamaño comprimido:</span>
            <span className="font-medium">{formatSize(result.compressed_size)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Reducción:</span>
            <span className={`font-medium ${result.reduction_percent > 0 ? 'text-green-600' : 'text-yellow-600'}`}>
              {result.reduction_percent > 0 ? `-${result.reduction_percent}%` : `+${Math.abs(result.reduction_percent)}%`}
            </span>
          </div>
          {result.engine && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Motor:</span>
              <span className="font-medium text-xs uppercase">{result.engine}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  }, [result]);

  // Métricas de merge
  const mergeMetrics = useMemo(() => {
    if (result.total_pages && result.files_merged) {
      return (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Archivos fusionados:</span>
            <span className="font-medium">{result.files_merged}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Páginas totales:</span>
            <span className="font-medium">{result.total_pages}</span>
          </div>
        </div>
      );
    }
    return null;
  }, [result]);

  return (
    <AlertDialog open={true} onOpenChange={() => {}}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{result.ok ? 'Éxito' : 'Error'}</AlertDialogTitle>
          <AlertDialogDescription>
            {mainMessage}
            {warningMessage && (
              <div className="mt-2 text-sm text-yellow-600">⚠️ {warningMessage}</div>
            )}
            {compressionMetrics}
            {mergeMetrics}
            {result.pdf_profile && (
              <div className="mt-2 text-xs text-muted-foreground">
                Perfil PDF: <span className="font-medium">{result.pdf_profile}</span>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {result.ok && result.path && (
            <AlertDialogAction onClick={handleOpen}>Abrir carpeta</AlertDialogAction>
          )}
          <Button variant="secondary" onClick={() => toast.info('Cerrando resultado')}>
            Cerrar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
