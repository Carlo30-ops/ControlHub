import React, { useState, useCallback } from "react";
import { cn } from "../../../components/ui/utils";
import { Plus, SortAsc, SortDesc, X, RotateCw, Maximize2, GripVertical, FileText } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

interface Document {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
  size?: number;
  pageCount?: number;
}

interface DocumentGridProps {
  documents: Document[];
  onAdd?: () => void;
  onAddFiles?: (files: string[]) => void;
  onRemove?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onRotate?: (id: string) => void;
  onPreview?: (id: string) => void;
  onSort?: (direction: 'asc' | 'desc') => void;
  className?: string;
}

export const DocumentGrid: React.FC<DocumentGridProps> = ({
  documents,
  onAdd,
  onAddFiles,
  onRemove,
  onReorder,
  onRotate,
  onPreview,
  onSort,
  className
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setHoverIndex(index);
    }
  }, [draggedIndex]);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const fromIndexString = e.dataTransfer.getData('text/plain');
    const fromIndex = fromIndexString !== "" ? parseInt(fromIndexString, 10) : draggedIndex;
    
    if (fromIndex !== null && !isNaN(fromIndex) && fromIndex !== dropIndex && onReorder) {
      onReorder(fromIndex, dropIndex);
    }
    setDraggedIndex(null);
    setHoverIndex(null);
  }, [draggedIndex, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setHoverIndex(null);
  }, []);

  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDraggingFile(true);
    }
  }, [draggedIndex]);

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
  }, []);

  const handleContainerDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    if (draggedIndex !== null) return;
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const filePaths: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const path = await window.electronAPI.getPathForFile(file);
        if (path) {
          const validated = await window.electronAPI.security.validateAndRegisterDroppedFile(path);
          if (validated) {
            filePaths.push(path);
          }
        }
      } catch (err) {
        console.error('Error processing dropped file:', err);
      }
    }

    if (filePaths.length > 0 && onAddFiles) {
      onAddFiles(filePaths);
    }
  }, [draggedIndex, onAddFiles]);

  const handleSort = useCallback((direction: 'asc' | 'desc') => {
    setSortDirection(direction);
    onSort?.(direction);
  }, [onSort]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div 
      className={cn("relative p-4 rounded-xl border border-border bg-card/50", className)}
      onDragOver={handleContainerDragOver}
      onDragLeave={handleContainerDragLeave}
      onDrop={handleContainerDrop}
    >
      {/* Botón flotante de agregar y ordenar */}
      {onAdd && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-medium">
              {documents.length} {documents.length === 1 ? 'archivo' : 'archivos'}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleSort(sortDirection === 'asc' ? 'desc' : 'asc')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              {sortDirection === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              {sortDirection === 'asc' ? 'A-Z' : 'Z-A'}
            </Button>
            <Button
              onClick={onAdd}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar archivos
            </Button>
          </div>
        </div>
      )}

      {/* Indicador de drag-and-drop de archivos */}
      {isDraggingFile && (
        <div className="absolute inset-0 border-2 border-dashed border-primary bg-primary/5 rounded-xl flex items-center justify-center z-30 pointer-events-none">
          <p className="text-base font-semibold text-primary">Suelta los archivos aquí</p>
        </div>
      )}

      {/* Grid de documentos con la visual actual de la app */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {documents.map((doc, idx) => {
          const sizeText = formatSize(doc.size);
          const pagesText = doc.pageCount ? `${doc.pageCount} pág.` : '';
          const metaText = [sizeText, pagesText].filter(Boolean).join(' - ');

          return (
            <div
              key={doc.id}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "relative group rounded-xl border-2 bg-card transition-all cursor-grab active:cursor-grabbing overflow-hidden flex flex-col justify-between",
                draggedIndex === idx ? "opacity-40 scale-95 border-primary" : "border-border hover:border-primary/50 hover:shadow-md",
                hoverIndex === idx && draggedIndex !== idx ? "scale-105 border-primary ring-2 ring-primary/20 shadow-lg z-10" : ""
              )}
            >
              {/* Miniatura */}
              <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden relative group/thumb">
                {doc.thumbnail ? (
                  <img src={doc.thumbnail} alt={doc.name} className="w-full h-full object-contain p-1" />
                ) : (
                  <div className="text-center p-4 flex flex-col items-center">
                    <FileText className="w-10 h-10 mb-2 text-muted-foreground stroke-[1.5]" />
                    <p className="text-xs text-muted-foreground font-medium">Cargando...</p>
                  </div>
                )}

                {/* Grip indicator */}
                <div className="absolute top-2 left-2 p-1 bg-background/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>

                {/* Acciones al hover */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  {onPreview && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded bg-background/80 hover:bg-background"
                      onClick={(e) => { e.stopPropagation(); onPreview(doc.id); }}
                      title="Previsualizar"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-foreground" />
                    </Button>
                  )}
                  {onRotate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded bg-background/80 hover:bg-background"
                      onClick={(e) => { e.stopPropagation(); onRotate(doc.id); }}
                      title="Rotar"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-foreground" />
                    </Button>
                  )}
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(e) => { e.stopPropagation(); onRemove(doc.id); }}
                      title="Eliminar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Pie con nombre y metadata */}
              <div className="p-2.5 bg-card border-t border-border">
                <p className="text-xs font-medium text-foreground truncate" title={doc.name}>
                  {doc.name}
                </p>
                {metaText && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {metaText}
                  </p>
                )}
              </div>

              {/* Número de orden */}
              <div className="absolute bottom-10 left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-xs">
                {idx + 1}
              </div>
            </div>
          );
        })}
      </div>

      {/* Estado vacío */}
      {documents.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mb-3 stroke-[1.5]" />
          <p className="text-base font-medium text-foreground">No hay archivos PDF</p>
          <p className="text-xs text-muted-foreground mb-4">Agrega documentos para organizarlos y unirlos</p>
          {onAdd && (
            <Button onClick={onAdd} variant="outline" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Agregar archivos
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
