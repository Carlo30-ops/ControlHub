import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ToolSelector with lazy-loaded ToolConfigForm
import { useState, lazy, Suspense } from 'react';
import { cn } from '../../../components/ui/utils';
// Lazy import del formulario de configuración de herramientas
const LazyToolConfigForm = lazy(() => import('./ToolConfigForm'));
/**
 * Selector de herramientas que carga de forma perezosa el formulario de configuración
 * correspondiente al tool seleccionado.
 */
export default function ToolSelector({ tools, onSelect }) {
    const [selectedTool, setSelectedTool] = useState(null);
    const handleSelect = (tool) => {
        setSelectedTool(tool);
        onSelect(tool);
    };
    return (_jsx("div", { className: cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', 'p-4'), children: tools.map((tool) => (_jsxs("button", { className: cn('flex flex-col items-center p-4 rounded-lg border hover:shadow-lg transition', tool.color), onClick: () => handleSelect(tool), children: [tool.icon, _jsx("span", { className: "mt-2 font-medium", children: tool.name }), _jsx("span", { className: "text-sm text-muted-foreground", children: tool.desc })] }, tool.id))) }));
}
/**
 * Renderiza el formulario de configuración cuando hay una herramienta seleccionada.
 * Se usa React.Suspense para mostrar un placeholder mientras se carga.
 */
export function ToolConfigPanel({ selectedTool, params, onChange }) {
    if (!selectedTool)
        return null;
    return (_jsx(Suspense, { fallback: _jsx("div", { className: "p-4", children: "Cargando configuraci\u00F3n..." }), children: _jsx(LazyToolConfigForm, { activeTool: selectedTool, params: params, onChange: onChange }) }));
}
