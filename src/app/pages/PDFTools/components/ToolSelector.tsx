// ToolSelector with lazy-loaded ToolConfigForm
import React, { useState, lazy, Suspense } from 'react';
import { ToolConfig } from '@/types';
import { cn } from '@/components/ui/utils';

// Lazy import del formulario de configuración de herramientas
const LazyToolConfigForm = lazy(() => import('./ToolConfigForm'));

/**
 * Selector de herramientas que carga de forma perezosa el formulario de configuración
 * correspondiente al tool seleccionado.
 */
export default function ToolSelector({ tools, onSelect }: { tools: ToolConfig[]; onSelect: (tool: ToolConfig) => void }) {
  const [selectedTool, setSelectedTool] = useState<ToolConfig | null>(null);

  const handleSelect = (tool: ToolConfig) => {
    setSelectedTool(tool);
    onSelect(tool);
  };

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', 'p-4')}>
      {tools.map((tool) => (
        <button
          key={tool.id}
          className={cn('flex flex-col items-center p-4 rounded-lg border hover:shadow-lg transition', tool.color)}
          onClick={() => handleSelect(tool)}
        >
          {tool.icon}
          <span className="mt-2 font-medium">{tool.name}</span>
          <span className="text-sm text-muted-foreground">{tool.desc}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * Renderiza el formulario de configuración cuando hay una herramienta seleccionada.
 * Se usa React.Suspense para mostrar un placeholder mientras se carga.
 */
export function ToolConfigPanel({ selectedTool, params, onChange }: { selectedTool: ToolConfig | null; params: Record<string, any>; onChange: (key: string, value: any) => void }) {
  if (!selectedTool) return null;
  return (
    <Suspense fallback={<div className="p-4">Cargando configuración...</div>}>
      <LazyToolConfigForm activeTool={selectedTool} params={params} onChange={onChange} />
    </Suspense>
  );
}
