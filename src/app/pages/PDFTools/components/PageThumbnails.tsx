import React, { useEffect, useState } from "react";
import { cn } from "../../../components/ui/utils";
import { ImageIcon, RotateCw, X, GripVertical } from "lucide-react";

interface PageThumbnail {
  page_index: number;
  page_number: number;
  thumb_path: string;
}

interface PageThumbnailsProps {
  filePath: string;
  selectedPages?: Set<number>;
  onTogglePage?: (pageNumber: number) => void;
  onRotatePage?: (pageNumber: number) => void;
  onDeletePage?: (pageNumber: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  showActions?: boolean;
  draggable?: boolean;
  className?: string;
}

export const PageThumbnails: React.FC<PageThumbnailsProps> = ({
  filePath,
  selectedPages = new Set(),
  onTogglePage,
  onRotatePage,
  onDeletePage,
  onReorder,
  showActions = false,
  draggable = false,
  className
}) => {
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const loadThumbnails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.electronAPI.pdfTools.pageThumbnails({
          input: filePath,
          dpi: 72
        });
        if (res.ok && res.thumbnails) {
          setThumbnails(res.thumbnails);
        } else {
          setError(res.error || "Error al cargar miniaturas");
        }
      } catch (e) {
        setError("Error al cargar miniaturas");
        console.error("Thumbnails error", e);
      } finally {
        setLoading(false);
      }
    };
    loadThumbnails();
  }, [filePath]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorder) {
      onReorder(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Cargando miniaturas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-center text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4", className)}>
      {thumbnails.map((thumb, idx) => {
        const isSelected = selectedPages.has(thumb.page_number);
        
        return (
          <div
            key={thumb.page_index}
            draggable={draggable}
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative group rounded-xl border-2 transition-all cursor-pointer overflow-hidden",
              isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              draggable && "cursor-move",
              draggedIndex === idx && "opacity-50 scale-95"
            )}
            onClick={() => onTogglePage?.(thumb.page_number)}
          >
            <img
              src={`pdfthumb://${thumb.thumb_path.split(/[\\/]/).pop()}`}
              alt={`Página ${thumb.page_number}`}
              className="w-full aspect-[3/4] object-cover"
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-2 text-xs font-bold">
              Página {thumb.page_number}
            </div>

            {draggable && (
              <div className="absolute top-2 left-2 p-1.5 bg-white/90 rounded-lg">
                <GripVertical className="w-4 h-4 text-gray-700" />
              </div>
            )}

            {showActions && (
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onRotatePage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(thumb.page_number);
                    }}
                    className="p-1.5 bg-white/90 rounded-lg hover:bg-white transition-colors"
                  >
                    <RotateCw className="w-4 h-4 text-gray-700" />
                  </button>
                )}
                {onDeletePage && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePage(thumb.page_number);
                    }}
                    className="p-1.5 bg-red-500/90 rounded-lg hover:bg-red-500 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>
            )}

            {isSelected && (
              <div className="absolute top-2 left-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
