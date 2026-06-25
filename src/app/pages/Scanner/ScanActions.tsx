import { Search, X, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";

interface ScanActionsProps {
  isScanning: boolean;
  canStart: boolean;
  onStart: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}

export function ScanActions({ isScanning, canStart, onStart, onCancel, onRefresh }: ScanActionsProps) {
  return (
    <div className="flex gap-3">
      {isScanning ? (
        <Button onClick={onCancel} variant="destructive" className="flex-1 h-12 rounded-xl font-bold">
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
      ) : (
        <Button onClick={onStart} disabled={!canStart} className="flex-1 h-12 rounded-xl font-bold">
          <Search className="w-4 h-4 mr-2" />
          Iniciar Escaneo
        </Button>
      )}
      <Button onClick={onRefresh} variant="outline" className="h-12 px-6 rounded-xl font-bold">
        <RefreshCw className="w-4 h-4 mr-2" />
        Refrescar
      </Button>
    </div>
  );
}
