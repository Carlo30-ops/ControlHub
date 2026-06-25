import { Progress } from "../../components/ui/progress";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";

interface ScanProgressProps {
  isScanning: boolean;
  progress: number;
  scanStatus: string;
}

export function ScanProgress({ isScanning, progress, scanStatus }: ScanProgressProps) {
  if (!isScanning) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-bold">Progreso</Label>
        <Badge variant="outline">{progress.toFixed(0)}%</Badge>
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-xs text-muted-foreground">{scanStatus}</p>
    </div>
  );
}
