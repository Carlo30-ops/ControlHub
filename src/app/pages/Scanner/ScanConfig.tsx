import { FolderOpen, HardDrive, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "../../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/popover";
import { Calendar as CalendarIcon } from "lucide-react";

interface ScanConfigProps {
  scanType: "day" | "week" | "month" | "year" | "custom";
  setScanType: (type: "day" | "week" | "month" | "year" | "custom") => void;
  startDate: Date | undefined;
  setStartDate: (date: Date | undefined) => void;
  endDate: Date | undefined;
  setEndDate: (date: Date | undefined) => void;
  basePath: string;
  setBasePath: (path: string) => void;
  selectedFiles: string | null;
  setSelectedFiles: (path: string | null) => void;
  useLocalScanner: boolean;
  setUseLocalScanner: (value: boolean) => void;
  autoWatch: boolean;
  setAutoWatch: (value: boolean) => void;
  settings: any;
  onSelectDirectory: () => void;
}

export function ScanConfig({
  scanType,
  setScanType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  basePath,
  setBasePath,
  selectedFiles,
  setSelectedFiles,
  useLocalScanner,
  setUseLocalScanner,
  autoWatch,
  setAutoWatch,
  settings,
  onSelectDirectory,
}: ScanConfigProps) {
  return (
    <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="p-8 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">Configuración del Escaneo</CardTitle>
            <CardDescription className="text-base font-medium text-muted-foreground">Define el origen y el rango de tiempo de búsqueda</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        <div className="space-y-3">
          <Label className="text-sm font-bold">Tipo de Escaneo</Label>
          <Select value={scanType} onValueChange={(val: any) => setScanType(val)}>
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Selecciona tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Día específico</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Mes actual</SelectItem>
              <SelectItem value="year">Año actual</SelectItem>
              <SelectItem value="custom">Rango personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(scanType === "custom" || scanType === "day") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-bold">Fecha Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-12 rounded-xl justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP", { locale: es }) : "Selecciona fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            {scanType === "custom" && (
              <div className="space-y-3">
                <Label className="text-sm font-bold">Fecha Fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-xl justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP", { locale: es }) : "Selecciona fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}

        <Separator />

        <div className="space-y-3">
          <Label className="text-sm font-bold">Carpeta a Escanear</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                value={basePath}
                onChange={(e) => setBasePath(e.target.value)}
                placeholder="Ruta de la carpeta..."
                className="w-full h-12 px-4 rounded-xl border border-border bg-muted/50 text-foreground font-bold"
                readOnly
              />
            </div>
            <Button onClick={onSelectDirectory} className="h-12 px-6 rounded-xl font-bold">
              <FolderOpen className="w-4 h-4 mr-2" />
              Seleccionar
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-bold">Usar Escáner Local</Label>
              <p className="text-xs text-muted-foreground">Escaneo directo en el sistema de archivos</p>
            </div>
            <Switch checked={useLocalScanner} onCheckedChange={setUseLocalScanner} />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-bold">Auto-Watch</Label>
              <p className="text-xs text-muted-foreground">Detectar nuevos archivos automáticamente</p>
            </div>
            <Switch checked={autoWatch} onCheckedChange={setAutoWatch} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
