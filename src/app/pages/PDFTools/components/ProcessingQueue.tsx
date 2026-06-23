import React from 'react';
import { QueuedFile } from '@/app/pages/PDFTools/hooks/useFileQueue';
import { Button } from '@/app/components/ui/button';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  queue: QueuedFile[];
  onReorder: (idx: number, dir: number) => void;
  onRemove: (idx: number) => void;
}

export default function ProcessingQueue({ queue, onReorder, onRemove }: Props) {
  if (queue.length === 0) return null;
  return (
    <div className="space-y-2">
      {queue.map((file, idx) => (
        <div key={file.id} className="flex items-center justify-between p-2 border rounded">
          <div>
            <span className="font-medium">{file.name}</span>
            <span className="ml-2 text-sm text-muted-foreground">{file.status}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="sm" onClick={() => onReorder(idx, -1)} disabled={idx === 0}>
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onReorder(idx, 1)} disabled={idx === queue.length - 1}>
              <ArrowDown className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={() => onRemove(idx)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
