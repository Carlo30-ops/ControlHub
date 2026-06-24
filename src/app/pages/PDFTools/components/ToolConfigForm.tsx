import React, { useState } from 'react';
import { ToolConfig } from '@/app/types';
import { Input } from '@/app/components/ui/input';
import { Slider } from '@/app/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

/**
 * Renderiza los campos de configuración específicos para la herramienta activa.
 * Incluye validaciones básicas y muestra mensajes de error al usuario.
 */
export default function ToolConfigForm({
  activeTool,
  params,
  onChange,
}: {
  activeTool: ToolConfig | null;
  params: Record<string, any>;
  onChange: (key: string, value: any) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!activeTool) return null;

  const setError = (field: string, msg: string) =>
    setErrors((prev) => ({ ...prev, [field]: msg }));
  const clearError = (field: string) =>
    setErrors((prev) => {
      const { [field]: _, ...rest } = prev;
      return rest;
    });

  const validateNotEmpty = (field: string, value: any, label: string) => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      setError(field, `${label} es obligatorio`);
      return false;
    }
    clearError(field);
    return true;
  };

  // Render specific fields based on tool id – extend as needed.
  switch (activeTool.id) {
    case 'split':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Rangos de división</label>
          <Input
            placeholder="e.g. 1-3,5-7"
            value={params.splitRanges || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onChange('splitRanges', e.target.value);
              validateNotEmpty('splitRanges', e.target.value, 'Rangos de división');
            }}
          />
          {errors.splitRanges && <p className="text-sm text-destructive">{errors.splitRanges}</p>}
        </div>
      );
    case 'compress':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Nivel de compresión</label>
          <Select
            onValueChange={(v: string) => {
              onChange('compressLevel', v);
              validateNotEmpty('compressLevel', v, 'Nivel de compresión');
            }}
            defaultValue={params.compressLevel || 'ebook'}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="screen">Screen</SelectItem>
              <SelectItem value="ebook">Ebook</SelectItem>
              <SelectItem value="printer">Printer</SelectItem>
              <SelectItem value="prepress">Prepress</SelectItem>
            </SelectContent>
          </Select>
          {errors.compressLevel && <p className="text-sm text-destructive">{errors.compressLevel}</p>}
        </div>
      );
    case 'rotate':
      return (
        <div className="space-y-2">
          <label className="block text-sm font-medium">Ángulo</label>
          <Input
            type="number"
            min="0"
            max="360"
            value={params.rotateAngle || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onChange('rotateAngle', e.target.value);
              validateNotEmpty('rotateAngle', e.target.value, 'Ángulo');
            }}
          />
          {errors.rotateAngle && <p className="text-sm text-destructive">{errors.rotateAngle}</p>}
          <label className="block text-sm font-medium">Páginas (opcional)</label>
          <Input
            placeholder="e.g. 1,3-5"
            value={params.rotatePages || ''}
            onChange={(e) => onChange('rotatePages', e.target.value)}
          />
        </div>
      );
    // Add other cases as needed …
    default:
      return null;
  }
}
