import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from '@/app/components/ui/alert-dialog';
import { toast } from 'sonner';
/**
 * Muestra el resultado de la herramienta ejecutada.
 * `result` proviene del hook `usePdfTool` y contiene información del archivo
 * generado, mensajes y posibles warnings.
 */
export default function ResultView({ result, onOpen, }) {
    if (!result)
        return null;
    const handleOpen = () => {
        if (result?.path) {
            onOpen(result.path);
        }
        else {
            toast.error('No hay ruta de archivo disponible');
        }
    };
    const mainMessage = useMemo(() => (result.ok ? result.message ?? '' : result.error ?? ''), [result]);
    const warningMessage = useMemo(() => result.warning ?? '', [result]);
    return (_jsx(AlertDialog, { open: true, onOpenChange: () => { }, children: _jsxs(AlertDialogContent, { children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { children: result.ok ? 'Éxito' : 'Error' }), _jsxs(AlertDialogDescription, { children: [mainMessage, warningMessage && (_jsxs("div", { className: "mt-2 text-sm text-yellow-600", children: ["\u26A0\uFE0F ", warningMessage] }))] })] }), _jsxs(AlertDialogFooter, { children: [result.ok && result.path && (_jsx(AlertDialogAction, { onClick: handleOpen, children: "Abrir carpeta" })), _jsx(Button, { variant: "secondary", onClick: () => toast.info('Cerrando resultado'), children: "Cerrar" })] })] }) }));
}
