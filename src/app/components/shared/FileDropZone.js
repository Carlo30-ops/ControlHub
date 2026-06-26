import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useCallback, useEffect } from "react";
import { Upload, Trash2, ArrowUp, ArrowDown, FileText, X } from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import { cn } from "../ui/utils";
// ====== COMPONENT ======
export function FileDropZone({ multiple = false, compact = false, disabled = false, onFiles, onRemove, onReorder, onClear, files, accept, defaultPath, className, }) {
    const [isOver, setIsOver] = useState(false);
    const [thumbs, setThumbs] = useState({});
    const [selectedIndex, setSelectedIndex] = useState(-1);
    // ====== HANDLE DROP - SEGURIDAD OBLIGATORIA ======
    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        if (disabled)
            return;
        setIsOver(false);
        const droppedFiles = Array.from(e.dataTransfer.files).map(f => window.electronAPI.getPathForFile(f));
        if (droppedFiles.length === 0)
            return;
        const accepted = [];
        let hadRejection = false;
        // SEGURIDAD OBLIGATORIA EN TODOS LOS MODOS
        for (const filePath of droppedFiles) {
            try {
                const result = await window.electronAPI.security.validateAndRegisterDroppedFile(filePath);
                if (result.ok) {
                    accepted.push(filePath);
                }
                else {
                    hadRejection = true;
                    const fileName = filePath.split(/\\|\//).pop() || filePath;
                    toast.error(`${fileName}: ${result.error}`);
                }
            }
            catch (err) {
                hadRejection = true;
                const fileName = filePath.split(/\\|\//).pop() || filePath;
                toast.error(`${fileName}: ${err?.message || 'Error validando archivo'}`);
                continue;
            }
        }
        if (accepted.length > 0) {
            // Combine existing session files with newly accepted ones to avoid clearing previous allowlist
            const existingPaths = files.map(f => f.path);
            const combined = Array.from(new Set([...existingPaths, ...accepted]));
            try {
                await window.electronAPI.security.syncActiveFiles(combined);
            }
            catch (err) {
                console.warn('Failed to sync active files:', err);
            }
            onFiles(accepted);
            if (hadRejection) {
                toast.success(`${accepted.length} archivo${accepted.length === 1 ? '' : 's'} cargado${accepted.length === 1 ? '' : 's'} correctamente.`);
            }
        }
    }, [onFiles, disabled]);
    // ====== HANDLE CLICK (FILE SELECTOR) ======
    const handleClick = useCallback(async () => {
        if (disabled)
            return;
        const filters = accept ? [{ name: "Archivos", extensions: accept.replace(/\./g, '').split(',') }] : [];
        const path = await window.electronAPI.selectFile({ filters, defaultPath });
        if (path)
            onFiles([path]);
    }, [accept, defaultPath, disabled, onFiles]);
    useEffect(() => {
        if (!multiple)
            return;
        files.forEach(async (file) => {
            if (thumbs[file.path])
                return;
            console.log('[THUMB DEBUG] Solicitando thumbnail para:', file.path);
            try {
                const res = await window.electronAPI.pdfTools.pdfThumbnail({
                    input: file.path,
                    dpi: 100,
                });
                if (res.ok && res.thumb_path) {
                    const thumbName = res.thumb_path?.split(/[\\/]/).pop();
                    if (!thumbName) {
                        console.log('[THUMB DEBUG] thumbName vacío, abortando');
                        return;
                    }
                    setThumbs((prev) => ({
                        ...prev,
                        [file.path]: `pdfthumb://${thumbName}`,
                    }));
                }
                else {
                    console.log('[THUMB DEBUG] res.ok es false o falta thumb_path:', res);
                }
            }
            catch (err) {
                console.log('[THUMB DEBUG] Excepción capturada:', err);
            }
        });
    }, [files, multiple, thumbs]);
    // ====== KEYBOARD NAVIGATION ======
    useEffect(() => {
        if (!multiple || files.length === 0)
            return;
        const handleKeyDown = (e) => {
            if (disabled)
                return;
            // Flecha arriba: seleccionar archivo anterior
            if (e.key === 'ArrowUp' && selectedIndex > 0) {
                e.preventDefault();
                setSelectedIndex(selectedIndex - 1);
            }
            // Flecha abajo: seleccionar siguiente archivo
            else if (e.key === 'ArrowDown' && selectedIndex < files.length - 1) {
                e.preventDefault();
                setSelectedIndex(selectedIndex + 1);
            }
            // Delete/Backspace: eliminar archivo seleccionado
            else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIndex >= 0) {
                e.preventDefault();
                onRemove?.(selectedIndex);
                setSelectedIndex(Math.max(0, selectedIndex - 1));
            }
            // Escape: deseleccionar
            else if (e.key === 'Escape') {
                e.preventDefault();
                setSelectedIndex(-1);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [multiple, files, selectedIndex, disabled, onRemove]);
    // ====== RENDER: COMPACT MODE (SINGLE-FILE) ======
    if (compact && !multiple) {
        const file = files.length > 0 ? files[0] : null;
        return (_jsx("div", { onDragOver: (e) => { e.preventDefault(); if (!disabled)
                setIsOver(true); }, onDragLeave: () => setIsOver(false), onDrop: handleDrop, className: cn("relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer min-h-[120px]", isOver ? "border-primary bg-primary/5" : "border-border hover:border-slate-300 dark:hover:border-slate-700", file && "border-primary bg-primary/5", disabled && "opacity-50 cursor-not-allowed border-slate-100 dark:border-slate-900", className), onClick: handleClick, children: file ? (_jsxs("div", { className: "flex items-center gap-4 w-full px-2", children: [_jsx("div", { className: "p-2.5 rounded-xl bg-muted text-muted-foreground shrink-0", children: _jsx(FileText, { className: "w-5 h-5" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-bold text-foreground truncate uppercase tracking-tight", children: file.name }), _jsx("p", { className: "text-xs font-bold text-primary uppercase", children: "Listo para organizar" })] }), !disabled && (_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10", onClick: (e) => {
                            e.stopPropagation();
                            onClear?.();
                        }, children: _jsx(X, { className: "w-4 h-4" }) }))] })) : (_jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx(Upload, { className: cn("w-6 h-6", isOver ? "text-primary" : "text-muted-foreground") }), _jsx("p", { className: "text-xs font-bold text-muted-foreground text-center", children: isOver ? "¡Suéltalo!" : _jsxs(_Fragment, { children: ["Arrastra el archivo o ", _jsx("span", { className: "text-primary underline decoration-2 underline-offset-2", children: "selecciona" })] }) })] })) }));
    }
    // ====== RENDER: STANDARD/MULTIPLE MODE ======
    return (_jsxs("div", { className: "space-y-4 w-full", children: [_jsxs("div", { onDragOver: (e) => { e.preventDefault(); if (!disabled)
                    setIsOver(true); }, onDragLeave: () => setIsOver(false), onDrop: handleDrop, className: cn("relative border border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all duration-200 group cursor-pointer min-h-[180px]", isOver ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/40 hover:bg-accent/5", disabled && "opacity-50 cursor-not-allowed", className), onClick: handleClick, children: [_jsx("div", { className: cn("p-4 rounded-lg bg-muted mb-3 transition-transform group-hover:scale-110", isOver && "bg-primary text-primary-foreground"), children: _jsx(Upload, { className: cn("w-8 h-8", isOver ? "text-primary-foreground" : "text-[#64748B]") }) }), _jsx("p", { className: "text-base font-bold text-foreground text-center", children: isOver ? "¡Suéltalo ahora!" : _jsxs(_Fragment, { children: ["Arrastra ", multiple ? "archivos" : "un archivo", " aqu\u00ED o ", _jsx("span", { className: "text-primary underline decoration-1 underline-offset-4", children: "selecciona" })] }) }), _jsx("p", { className: "text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-[0.2em]", children: accept })] }), files.length > 0 && (_jsxs("div", { className: "space-y-2 animate-in fade-in slide-in-from-top-1 duration-300", children: [_jsxs("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1", children: ["Seleccionados (", files.length, ")"] }), _jsx(ScrollArea, { className: cn("w-full rounded-lg border border-border bg-muted/10 p-1", multiple ? 'h-64' : 'h-auto'), children: multiple ? (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-1", children: files.map((file, idx) => (_jsxs("div", { className: "relative rounded-xl border border-border bg-card overflow-hidden group cursor-default", children: [_jsx("div", { className: "aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden", children: thumbs[file.path] ? (_jsx("img", { src: thumbs[file.path], className: "w-full h-full object-cover" })) : (_jsx(FileText, { className: "w-10 h-10 text-muted-foreground" })) }), _jsx("div", { className: "p-2 text-[10px] font-bold truncate text-foreground", children: file.name }), _jsx(Button, { variant: "ghost", size: "icon", className: "absolute top-1.5 right-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100", onClick: (e) => {
                                            e.stopPropagation();
                                            onRemove?.(idx);
                                        }, children: _jsx(X, { className: "w-4 h-4" }) })] }, idx))) })) : (_jsx("div", { className: "space-y-1 p-1", children: files.map((file, idx) => (_jsxs("div", { className: cn("group flex items-center gap-3 p-2 bg-card rounded border border-border shadow-sm cursor-pointer transition-colors", selectedIndex === idx && "ring-2 ring-primary bg-primary/5"), onClick: () => setSelectedIndex(idx), children: [_jsx("div", { className: "w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px]", children: idx + 1 }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-xs font-bold truncate text-foreground", children: file.name }), _jsx("p", { className: "text-[9px] text-muted-foreground truncate", children: file.path })] }), _jsxs("div", { className: "flex items-center gap-0.5", children: [multiple && onReorder && (_jsxs(_Fragment, { children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded", disabled: idx === 0, onClick: (e) => {
                                                            e.stopPropagation();
                                                            onReorder(idx, -1);
                                                        }, children: _jsx(ArrowUp, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded", disabled: idx === files.length - 1, onClick: (e) => {
                                                            e.stopPropagation();
                                                            onReorder(idx, 1);
                                                        }, children: _jsx(ArrowDown, { className: "w-3.5 h-3.5" }) })] })), _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded text-destructive hover:bg-destructive/10", onClick: (e) => {
                                                    e.stopPropagation();
                                                    onRemove?.(idx);
                                                }, children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }, idx))) })) })] }))] }));
}
