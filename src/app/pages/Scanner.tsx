import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Search,
  Loader2,
  FolderOpen,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Copy,
  FileX,
  CalendarRange,
  Layers,
  ChevronRight,
  RefreshCw,
  X,
  Upload
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Calendar } from "../components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { Separator } from "../components/ui/separator";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { scanInvoices, getExamplePaths } from "../utils/mockData";
import {
  isFileSystemAccessSupported,
  selectDirectoryFiles,
  scanLocalDirectory,
  ScanStats,
} from "../utils/localScanner";
import { useData } from "../contexts/DataContext";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

export function Scanner() {
  const navigate = useNavigate();
  const { addToHistory, setCurrentScan, settings } = useData();
  const [scanType, setScanType] = useState<"day" | "week" | "month" | "year" | "custom">("month");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [basePath, setBasePath] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState("");
  const [useLocalScanner, setUseLocalScanner] = useState(true);
  const [autoWatch, setAutoWatch] = useState(false);
  const [lastStats, setLastStats] = useState<ScanStats | null>(null);
  const [lastInvoiceCount, setLastInvoiceCount] = useState<number | null>(null);
  const [newFilesCount, setNewFilesCount] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("cotu-last-path");
    if (saved) {
      setSelectedFiles(saved);
      const folderName = saved.split(/[\\/]/).pop() || saved;
      setBasePath(folderName);
    }

    if ((window as any).electronAPI?.onFolderUpdated) {
      // @ts-ignore
      (window as any).electronAPI.onFolderUpdated((data: any) => {
        setNewFilesCount(prev => prev + 1);
        toast.info("Nuevos PDFs detectados", {
          description: "Se recomienda re-escanear para actualizar datos.",
          duration: 5000,
        });
      });
    }

    return () => {
      if ((window as any).electronAPI?.offFolderUpdated) (window as any).electronAPI.offFolderUpdated();
    };
  }, []);

  useEffect(() => {
    if (autoWatch && selectedFiles) {
      (window as any).electronAPI?.startWatch(selectedFiles);
    } else {
      (window as any).electronAPI?.stopWatch();
    }
  }, [autoWatch, selectedFiles]);

  const examplePaths = getExamplePaths();
  const isLocalScanSupported = isFileSystemAccessSupported();

  const handleSelectDirectory = async () => {
    try {
      const dirPath = await selectDirectoryFiles();
      if (dirPath) {
        setSelectedFiles(dirPath);
        const folderName = dirPath.split(/[\\\/]/).pop() || "Carpeta seleccionada";
        setBasePath(folderName);
        localStorage.setItem("cotu-last-path", dirPath);
        setLastStats(null);
        setLastInvoiceCount(null);
        toast.success(`Carpeta seleccionada: ${folderName}`);
      }
    } catch (error) {
      toast.error("Error al seleccionar directorio");
    }
  };

  const handleScan = async () => {
    if (useLocalScanner && !selectedFiles) {
      toast.error("Por favor selecciona una carpeta");
      return;
    }
    if (scanType === "custom" && (!startDate || !endDate)) {
      toast.error("Selecciona un rango de fechas");
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setNewFilesCount(0);
    setLastStats(null);
    setLastInvoiceCount(null);
    setScanStatus("Inicializando...");

    try {
      let dateRange: { start: Date; end: Date };
      if (scanType === "custom" && startDate && endDate) {
        dateRange = { start: startDate, end: endDate };
      } else {
        const now = new Date();
        const start = new Date();
        switch (scanType) {
          case "day": start.setHours(0, 0, 0, 0); break;
          case "week": start.setDate(now.getDate() - 7); break;
          case "month": start.setMonth(now.getMonth() - 1); break;
          case "year": start.setFullYear(now.getFullYear() - 1); break;
        }
        dateRange = { start, end: now };
      }

      let invoices;
      let duration;
      let stats: ScanStats | undefined;

      if (useLocalScanner && selectedFiles) {
        setScanStatus("Analizando archivos...");
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const result = await scanLocalDirectory(
          selectedFiles,
          dateRange,
          (p) => {
            const pct = (p.current / Math.max(p.total, 1)) * 100;
            setProgress(Math.min(pct, 95));
            setScanStatus(`${p.currentFile} (${p.current}/${p.total})`);
          },
          {
            maxDepth: settings.scanning.maxDepth,
            onlyCotuFolders: settings.scanning.onlyCotuFolders,
            ignoreSystemFolders: settings.scanning.ignoreSystemFolders,
            customInsurers: settings.customInsurers,
            signal: abortController.signal,
          }
        );
        invoices = result.invoices;
        duration = result.duration;
        stats = result.stats;
      } else {
        const result = await scanInvoices(scanType, dateRange, basePath || "Demo");
        invoices = result.invoices;
        duration = result.duration;
      }

      setProgress(100);
      setScanStatus("¡Completado!");
      setLastStats(stats ?? null);
      setLastInvoiceCount(invoices.length);

      const scanResult = {
        id: `scan-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: scanType,
        dateRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
        },
        basePath: selectedFiles ?? basePath,
        totalInvoices: invoices.length,
        invoices,
        scanDuration: duration,
        stats,
      };

      addToHistory(scanResult);
      setCurrentScan(scanResult);

      toast.success(`Escaneo finalizado`, {
        description: `${invoices.length} facturas en ${(duration / 1000).toFixed(2)}s`,
      });

      setTimeout(() => { navigate("/reports"); }, 1000);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast.error("Error en el motor de escaneo");
      }
    } finally {
      setIsScanning(false);
      setProgress(0);
      setScanStatus("");
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight text-left">Escáner de Facturas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-lg">Búsqueda y extracción inteligente de metadatos COTU</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center md:justify-end">
          <Badge variant="outline" className="h-7 text-[10px] font-black border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40 uppercase tracking-widest">
            <Layers className="w-3 h-3 mr-1.5 text-blue-500" />
            Niveles: {settings.scanning.maxDepth}
          </Badge>
          {settings.scanning.onlyCotuFolders && (
            <Badge className="h-7 text-[10px] font-black bg-blue-500/10 text-blue-600 border-none uppercase tracking-widest">Solo COTU</Badge>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigate('/settings')}>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 p-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white shadow-lg">
                  <FolderOpen className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black">Configuración del Escaneo</CardTitle>
                  <CardDescription className="text-base font-medium text-slate-500">Define el origen y el rango de tiempo de búsqueda</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              {/* Folder Selector estilo DropZone */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Carpeta de origen</label>
                   <button onClick={() => setUseLocalScanner(!useLocalScanner)} className="text-[10px] font-black text-blue-500 uppercase hover:underline">
                      {useLocalScanner ? "Usar Datos Demo" : "Volver a Local"}
                   </button>
                </div>

                <div 
                  onClick={handleSelectDirectory}
                  className={cn(
                    "relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer min-h-[180px]",
                    selectedFiles ? "border-blue-500 bg-blue-500/5" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 mb-4 group-hover:scale-110 transition-transform",
                    selectedFiles && "bg-blue-500 text-white"
                  )}>
                    <Upload className={cn("w-8 h-8", selectedFiles ? "text-white" : "text-slate-400")} />
                  </div>
                  {selectedFiles ? (
                    <div className="text-center">
                      <p className="text-lg font-black text-slate-900 dark:text-white truncate max-w-md uppercase tracking-tight">{selectedFiles.split(/[\\/]/).pop()}</p>
                      <p className="text-xs font-mono text-slate-400 mt-1 truncate max-w-sm mx-auto">{selectedFiles}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-slate-600 dark:text-slate-400 text-center uppercase tracking-tight">
                       Selecciona la carpeta de facturas
                    </p>
                  )}
                </div>

                {selectedFiles && (
                  <div className="flex items-center justify-between px-4 py-3 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                    <div className="flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Carpeta Validada</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="autowatch" className="text-[10px] font-black text-slate-500 uppercase">Monitoreo en vivo</label>
                      <Switch id="autowatch" checked={autoWatch} onCheckedChange={setAutoWatch} className="scale-90" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Periodo de Análisis</label>
                  <Select value={scanType} onValueChange={(v: any) => setScanType(v)}>
                    <SelectTrigger className="h-14 rounded-2xl font-bold bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day" className="font-bold py-3">Último Día</SelectItem>
                      <SelectItem value="week" className="font-bold py-3">Última Semana</SelectItem>
                      <SelectItem value="month" className="font-bold py-3">Último Mes</SelectItem>
                      <SelectItem value="year" className="font-bold py-3">Último Año</SelectItem>
                      <SelectItem value="custom" className="font-bold py-3">Rango Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scanType === "custom" && (
                  <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-right-4">
                    <DatePicker label="Inicio" date={startDate} setDate={setStartDate} />
                    <DatePicker label="Fin" date={endDate} setDate={setEndDate} />
                  </div>
                )}
              </div>

              {isScanning && (
                <div className="p-8 rounded-3xl bg-blue-600/10 border border-blue-500/20 space-y-6 animate-in zoom-in duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                       <span className="text-xl font-black text-blue-600 uppercase tracking-tight">{scanStatus}</span>
                    </div>
                    <span className="text-3xl font-black text-blue-500">{Math.round(progress)}%</span>
                  </div>
                  <div className="relative h-4 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-blue-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(37,99,235,0.5)]" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {newFilesCount > 0 && (
                <div className="flex justify-center mb-4">
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-black py-2 px-6 rounded-full animate-bounce shadow-lg shadow-orange-500/30">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {newFilesCount} archivos nuevos detectados — Re-escanear
                  </Badge>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={handleScan} 
                  disabled={isScanning || (!selectedFiles && useLocalScanner)} 
                  className="flex-1 h-20 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-black text-2xl shadow-xl shadow-blue-500/30 transition-all active:scale-[0.98] gap-4"
                >
                  {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : <Search className="w-8 h-8" />}
                  {isScanning ? "ESCANEO EN PROCESO..." : "INICIAR ESCANEO"}
                </Button>
                {isScanning && (
                  <Button onClick={() => abortControllerRef.current?.abort()} variant="destructive" className="h-20 w-20 rounded-3xl shadow-xl transition-all">
                    <FileX className="w-8 h-8" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {/* Resumen Post-Escaneo */}
           {lastStats && lastInvoiceCount !== null && (
             <Card className="bg-emerald-500/10 border border-emerald-500/20 shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-right-10 duration-700">
                <CardHeader className="bg-emerald-500 text-white p-6">
                   <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-widest">
                      <CheckCircle2 className="w-5 h-5" /> Resultado Final
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <div className="grid grid-cols-2 gap-4">
                      <StatMini label="Facturas" val={lastInvoiceCount} color="text-emerald-600" />
                      <StatMini label="Analizados" val={lastStats.totalFilesProcessed} color="text-blue-600" />
                      <StatMini label="Duplicados" val={lastStats.skippedDuplicates} color="text-orange-600" />
                      <StatMini label="Omitidos" val={lastStats.skippedByDateRange} color="text-slate-400" />
                   </div>
                   
                   <Separator className="opacity-50" />
                   
                   <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efectividad de Lectura</p>
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                            <DollarSign className="w-5 h-5" />
                         </div>
                         <div className="flex-1">
                            <div className="flex justify-between text-sm font-black text-emerald-700 dark:text-emerald-400 mb-1">
                               <span>Montos OK</span>
                               <span>{Math.round((lastStats.amountExtractionSuccess / lastInvoiceCount) * 100)}%</span>
                            </div>
                            <Progress value={(lastStats.amountExtractionSuccess / lastInvoiceCount) * 100} className="h-1.5" />
                         </div>
                      </div>
                   </div>

                   <Button className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20 gap-3" onClick={() => navigate('/reports')}>
                      VER REPORTE DETALLADO <ChevronRight className="w-5 h-5" />
                   </Button>
                </CardContent>
             </Card>
           )}

           {/* Info del Motor */}
           <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
                 <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Motor de Extracción V3.1</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                 <FeatureItem icon={<FileX className="w-4 h-4" />} text="Auto-filtrado de sistema" />
                 <FeatureItem icon={<Layers className="w-4 h-4" />} text="Deep scan jerárquico" />
                 <FeatureItem icon={<Copy className="w-4 h-4" />} text="Trazabilidad de duplicados" />
                 <FeatureItem icon={<CalendarRange className="w-4 h-4" />} text="Filtro preciso de aseguradora" />
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function DatePicker({ label, date, setDate }: any) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <button className="w-full h-14 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center px-5 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all">
            <CalendarIcon className="mr-3 h-5 w-5 text-blue-500" />
            {date ? format(date, "dd MMM yyyy", { locale: es }) : "Fecha"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-slate-200 dark:border-slate-800" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StatMini({ label, val, color }: any) {
  return (
    <div className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-center shadow-sm">
      <p className={cn("text-2xl font-black tracking-tighter", color)}>{val}</p>
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function FeatureItem({ icon, text }: any) {
  return (
    <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-400">
      <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">{icon}</div>
      <span>{text}</span>
    </div>
  );
}
