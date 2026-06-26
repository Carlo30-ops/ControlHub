import { ToolConfig } from '../../../types';
/**
 * Selector de herramientas que carga de forma perezosa el formulario de configuración
 * correspondiente al tool seleccionado.
 */
export default function ToolSelector({ tools, onSelect }: {
    tools: ToolConfig[];
    onSelect: (tool: ToolConfig) => void;
}): import("react/jsx-runtime").JSX.Element;
/**
 * Renderiza el formulario de configuración cuando hay una herramienta seleccionada.
 * Se usa React.Suspense para mostrar un placeholder mientras se carga.
 */
export declare function ToolConfigPanel({ selectedTool, params, onChange }: {
    selectedTool: ToolConfig | null;
    params: Record<string, any>;
    onChange: (key: string, value: any) => void;
}): import("react/jsx-runtime").JSX.Element | null;
