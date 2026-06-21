import { useState, useCallback } from "react";
import { Upload, Trash2, ArrowUp, ArrowDown, FileText, X } from "lucide-react";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { toast } from "sonner";
import { cn } from "../ui/utils";

// ====== INTERFACE ======
interface FileDropZoneProps {
  // Modo de funcionamiento
  multiple?: boolean;                    // default: false (single-file mode)
  compact?: boolean;                     // default: false
  disabled?: boolean;                    // default: false
  
  // Callbacks
  onFiles: (paths: string[]) => void;    // Siempre recibe array de rutas
  onRemove?: (index: number) => void;    // Solo en multiple=true
  onReorder?: (fromIndex: number, direction: 1 | -1) => void;  // Solo en multiple=true
  onClear?: () => void;                  // Para limpiar en single-file
  
  // Contenido - SIEMPRE UN ARRAY, NUNCA MIXTO
  files: Array<{ name: string; path: string }>;  // [] | [{name, path}] | [{...}, {...}]
  
  // Configuración
  accept?: string;
  defaultPath?: string;
  className?: string;
}

// ====== COMPONENT ======
export function FileDropZone({
  multiple = false,
  compact = false,
  disabled = false,
  onFiles,
  onRemove,
  onReorder,
  onClear,
  files,
  accept,
  defaultPath,
  className,
}: FileDropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  // ====== HANDLE DROP - SEGURIDAD OBLIGATORIA ======
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      if (disabled) return;
      setIsOver(false);

      const droppedFiles = Array.from(e.dataTransfer.files).map(f => (f as any).path);
      if (droppedFiles.length === 0) return;

      const accepted: string[] = [];
      let hadRejection = false;

      // SEGURIDAD OBLIGATORIA EN TODOS LOS MODOS
      for (const filePath of droppedFiles) {
        try {
          const result = await window.electronAPI.security.validateAndRegisterDroppedFile(filePath);
          if (result.ok) {
            accepted.push(filePath);
          } else {
            hadRejection = true;
            const fileName = filePath.split(/\\|\//).pop() || filePath;
            toast.error(`${fileName}: ${result.error}`);
          }
        } catch (err: any) {
          hadRejection = true;
          const fileName = filePath.split(/\\|\//).pop() || filePath;
          toast.error(`${fileName}: Error validando archivo`);
          continue;
        }
      }

      if (accepted.length > 0) {
        onFiles(accepted);
        if (hadRejection) {
          toast.success(`${accepted.length} archivo${accepted.length === 1 ? '' : 's'} cargado${accepted.length === 1 ? '' : 's'} correctamente.`);
        }
      }
    },
    [onFiles, disabled]
  );

  // ====== HANDLE CLICK (FILE SELECTOR) ======
  const handleClick = useCallback(async () => {
    if (disabled) return;
    const filters = accept ? [{ name: "Archivos", extensions: accept.replace(/\./g, '').split(',') }] : [];
    const path = await window.electronAPI.selectFile({ filters, defaultPath });
    if (path) onFiles([path]);
  }, [accept, defaultPath, disabled, onFiles]);

  // ====== RENDER: COMPACT MODE (SINGLE-FILE) ======
  if (compact && !multiple) {
    const file = files.length > 0 ? files[0] : null;

    return (
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer min-h-[120px]",
          isOver ? "border-primary bg-primary/5" : "border-border hover:border-slate-300 dark:hover:border-slate-700",
          file && "border-primary bg-primary/5",
          disabled && "opacity-50 cursor-not-allowed border-slate-100 dark:border-slate-900",
          className
        )}
        onClick={handleClick}
      >
        {file ? (
          <div className="flex items-center gap-4 w-full px-2">
            <div className="p-2.5 rounded-xl bg-muted text-muted-foreground shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate uppercase tracking-tight">{file.name}</p>
              <p className="text-xs font-bold text-primary uppercase">Listo para organizar</p>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className={cn("w-6 h-6", isOver ? "text-primary" : "text-muted-foreground")} />
            <p className="text-xs font-bold text-muted-foreground text-center">
              {isOver ? "¡Suéltalo!" : <>Arrastra el archivo o <span className="text-primary underline decoration-2 underline-offset-2">selecciona</span></>}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ====== RENDER: STANDARD/MULTIPLE MODE ======
  return (
    <div className="space-y-4 w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border border-dashed rounded-lg p-8 flex flex-col items-center justify-center transition-all duration-200 group cursor-pointer min-h-[180px]",
          isOver ? "border-primary bg-primary/5 scale-[0.99]" : "border-border hover:border-primary/40 hover:bg-accent/5",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onClick={handleClick}
      >
        <div
          className={cn(
            "p-4 rounded-lg bg-muted mb-3 transition-transform group-hover:scale-110",
            isOver && "bg-primary text-primary-foreground"
          )}
        >
          <Upload className={cn("w-8 h-8", isOver ? "text-primary-foreground" : "text-[#64748B]")} />
        </div>
        <p className="text-base font-bold text-foreground text-center">
          {isOver ? "¡Suéltalo ahora!" : <>Arrastra {multiple ? "archivos" : "un archivo"} aquí o <span className="text-primary underline decoration-1 underline-offset-4">selecciona</span></>}
        </p>
        <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-[0.2em]">{accept}</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">
            Seleccionados ({files.length})
          </label>
          <ScrollArea className={cn("w-full rounded-lg border border-border bg-muted/10 p-1", multiple ? 'h-40' : 'h-auto')}>
            <div className="space-y-1">
              {files.map((file: { name: string; path: string }, idx: number) => (
                <div key={idx} className="group flex items-center gap-3 p-2 bg-card rounded border border-border shadow-sm">
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground font-bold text-[10px]">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate text-foreground">{file.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{file.path}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {multiple && onReorder && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(idx, -1);
                          }}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded"
                          disabled={idx === files.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorder(idx, 1);
                          }}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove?.(idx);
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
