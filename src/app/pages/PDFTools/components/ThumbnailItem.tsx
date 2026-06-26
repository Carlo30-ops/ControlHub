// src/app/pages/PDFTools/components/ThumbnailItem.tsx
import React, { useEffect, useState } from "react";
import { cn } from "../../ui/utils";
import { ImageIcon } from "lucide-react";

interface ThumbnailItemProps {
  file: { path: string; name: string };
  className?: string;
}

export const ThumbnailItem: React.FC<ThumbnailItemProps> = ({ file, className }) => {
  const [thumbPath, setThumbPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadThumb = async () => {
      setLoading(true);
      try {
        const res = await window.electronAPI.pdfTools.pdfThumbnail({
          input: file.path,
          dpi: 150,
        });
        if (res.ok && res.thumb_path) {
          setThumbPath(res.thumb_path);
        }
      } catch (e) {
        console.error("Thumbnail error", e);
      } finally {
        setLoading(false);
      }
    };
    loadThumb();
  }, [file.path]);

  return (
    <div className={cn("relative rounded-xl border border-border bg-card overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <span className="text-xs text-muted-foreground">Cargando...</span>
        </div>
      )}
      {thumbPath ? (
        <img
          src={"file://" + thumbPath}
          alt={file.name}
          className="object-cover w-full h-full"
        />
      ) : (
        <div className="aspect-[3/4] bg-muted flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-2 text-[10px] font-bold truncate text-foreground bg-black/30 absolute bottom-0 left-0 right-0">
        {file.name}
      </div>
    </div>
  );
};
