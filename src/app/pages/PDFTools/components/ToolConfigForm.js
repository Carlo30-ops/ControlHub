import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Input } from '@/app/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { setError as setFieldError, clearError as clearFieldError, validateNotEmpty as validateFieldNotEmpty } from "../utils/validation";
/**
 * Renderiza los campos de configuración específicos para la herramienta activa.
 * Incluye validaciones básicas y muestra mensajes de error al usuario.
 */
export default function ToolConfigForm({ activeTool, params, onChange, }) {
    const [errors, setErrors] = useState({});
    // Helper functions using imported utilities
    const setError = (field, msg) => setFieldError(setErrors, field, msg);
    const clearError = (field) => clearFieldError(setErrors, field);
    const validateNotEmpty = (field, value, label) => validateFieldNotEmpty(setErrors, field, value, label);
    if (!activeTool)
        return null;
    // Render specific fields based on tool id – extend as needed.
    switch (activeTool.id) {
        case 'split':
            return (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium", children: "Rangos de divisi\u00F3n" }), _jsx(Input, { placeholder: "e.g. 1-3,5-7", value: params.splitRanges || '', onChange: (e) => {
                            onChange('splitRanges', e.target.value);
                            validateNotEmpty('splitRanges', e.target.value, 'Rangos de división');
                        } }), errors.splitRanges && _jsx("p", { className: "text-sm text-destructive", children: errors.splitRanges })] }));
        case 'compress':
            return (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium", children: "Nivel de compresi\u00F3n" }), _jsxs(Select, { onValueChange: (v) => {
                            onChange('compressLevel', v);
                            validateNotEmpty('compressLevel', v, 'Nivel de compresión');
                        }, defaultValue: params.compressLevel || 'ebook', children: [_jsx(SelectTrigger, { className: "w-full", children: _jsx(SelectValue, { placeholder: "Selecciona nivel" }) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "screen", children: "Screen" }), _jsx(SelectItem, { value: "ebook", children: "Ebook" }), _jsx(SelectItem, { value: "printer", children: "Printer" }), _jsx(SelectItem, { value: "prepress", children: "Prepress" })] })] }), errors.compressLevel && _jsx("p", { className: "text-sm text-destructive", children: errors.compressLevel })] }));
        case 'rotate':
            return (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "block text-sm font-medium", children: "\u00C1ngulo" }), _jsx(Input, { type: "number", min: "0", max: "360", value: params.rotateAngle || '', onChange: (e) => {
                            onChange('rotateAngle', e.target.value);
                            validateNotEmpty('rotateAngle', e.target.value, 'Ángulo');
                        } }), errors.rotateAngle && _jsx("p", { className: "text-sm text-destructive", children: errors.rotateAngle }), _jsx("label", { className: "block text-sm font-medium", children: "P\u00E1ginas (opcional)" }), _jsx(Input, { placeholder: "e.g. 1,3-5", value: params.rotatePages || '', onChange: (e) => onChange('rotatePages', e.target.value) })] }));
        // Add other cases as needed …
        default:
            return null;
    }
}
