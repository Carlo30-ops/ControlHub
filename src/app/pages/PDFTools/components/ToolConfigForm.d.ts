import { ToolConfig } from '@/app/types';
/**
 * Renderiza los campos de configuración específicos para la herramienta activa.
 * Incluye validaciones básicas y muestra mensajes de error al usuario.
 */
export default function ToolConfigForm({ activeTool, params, onChange, }: {
    activeTool: ToolConfig | null;
    params: Record<string, any>;
    onChange: (key: string, value: any) => void;
}): import("react/jsx-runtime").JSX.Element | null;
