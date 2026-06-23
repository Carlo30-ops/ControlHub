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
