import { useState, useEffect, useRef, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  Search,
  Loader2,
  FolderOpen,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  DollarSign,
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
} from "../utils/localScanner";
import { ScanStats } from "../../shared/types";
import { useData } from "../contexts/DataContext";
import { useNavigate, useLocation } from "react-router";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

export function Scanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToHistory, setCurrentScan, settings, updateSettings } = useData();
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
    // Leer la carpeta seleccionada desde settings (migrado desde localStorage)
    const saved = validateStringSetting(settings?.lastScanPath);
    if (saved) {
      setSelectedFiles(saved);
      const folderName = saved.split(/[\\\/]/).pop() || saved;
      setBasePath(folderName);
    }
    if (window.electronAPI?.onFolderUpdated) {
      // @ts-ignore
      window.electronAPI.onFolderUpdated((data: any) => {
        setNewFilesCount(prev => prev + 1);
        toast.info("Nuevos PDFs detectados", {
          description: "Se recomienda re-escanear para actualizar datos.",
          duration: 5000,
        });
      });
    }
    return () => {
      if (window.electronAPI?.offFolderUpdated) window.electronAPI.offFolderUpdated();
    };
  }, []);

  useEffect(() => {
    if (autoWatch && selectedFiles) {
      window.electronAPI?.startWatch(selectedFiles);
    } else {
      window.electronAPI?.stopWatch();
    }
  }, [autoWatch, selectedFiles]);

  const examplePaths = getExamplePaths();
  const isLocalScanSupported = isFileSystemAccessSupported();

  const handleSelectDirectory = useCallback(async () => {
    try {
      const dirPath = await selectDirectoryFiles();
      if (dirPath) {
        setSelectedFiles(dirPath);
        const folderName = dirPath.split(/[\\\/]/).pop() || "Carpeta seleccionada";
        setBasePath(folderName);
        if (updateSettings) updateSettings({ lastScanPath: dirPath });
        setLastStats(null);
        setLastInvoiceCount(null);
        toast.success(`Carpeta seleccionada: ${folderName}`);
      }
    } catch (error) {
      toast.error("Error al seleccionar directorio");
    }
  }, []);

  useEffect(() => {
    if (location.state?.autoSelect) {
      navigate(location.pathname, { replace: true, state: {} });
      handleSelectDirectory();
    }
  }, [location.state, location.pathname, navigate, handleSelectDirectory]);

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
            applyDateFilter: false, // <--- CAMBIADO: Mostrar todo por defecto
          }
        );
        console.log('[SCAN] Resultado crudo de scanLocalDirectory:', 
          JSON.stringify({ invoiceCount: result?.invoices?.length, stats: result?.stats }));
        invoices = result.invoices;
        duration = result.duration;
        stats = result.stats;
      } else {
        const result = await scanInvoices(scanType, dateRange, basePath || "Demo");
        invoices = result.invoices;
        duration = result.duration;
      }

      console.log('[SCAN] Total invoices guardados:', invoices.length);
      if (invoices.length > 0) {
        console.log('[SCAN] Primer invoice:', JSON.stringify(invoices[0]));
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
          <h1 className="text-2xl font-bold text-foreground tracking-tight text-left">Escáner de Facturas</h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">Búsqueda y extracción inteligente de metadatos COTU</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center md:justify-end">
          <Badge variant="outline" className="h-7 text-xs font-bold border-border bg-muted/40 uppercase tracking-widest">
            <Layers className="w-3 h-3 mr-1.5 text-primary" />
            Niveles: {settings.scanning.maxDepth}
          </Badge>
          {settings.scanning.onlyCotuFolders && (
            <Badge className="h-7 text-xs font-bold bg-muted text-muted-foreground border-none uppercase tracking-widest">Solo COTU</Badge>
          )}
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => navigate('/settings', { state: { scrollTo: 'scanning' } })}>
            <HardDrive className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
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
            <CardContent className="p-8 space-y-10">
              {/* Folder Selector estilo DropZone */}
              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                   <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Carpeta de origen</label>
                   <button onClick={() => setUseLocalScanner(!useLocalScanner)} className="text-xs font-bold text-primary uppercase hover:underline">
                      {useLocalScanner ? "Usar Datos Demo" : "Volver a Local"}
                   </button>
                </div>

                <div 
                  onClick={handleSelectDirectory}
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer min-h-[180px]",
                    selectedFiles ? "border-primary bg-primary/5" : "border-border hover:border-border/80"
                  )}
                >
                  <div className={cn(
                    "p-4 rounded-2xl bg-muted mb-4 group-hover:scale-110 transition-transform",
                    selectedFiles && "bg-primary text-primary-foreground"
                  )}>
                    <Upload className={cn("w-8 h-8", selectedFiles ? "text-primary-foreground" : "text-muted-foreground")} />
                  </div>
                  {selectedFiles ? (
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground truncate max-w-md uppercase tracking-tight">{selectedFiles.split(/[\\/]/).pop()}</p>
                      <p className="text-xs font-mono text-muted-foreground mt-1 truncate max-w-sm mx-auto">{selectedFiles}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-muted-foreground text-center uppercase tracking-tight">
                       Selecciona la carpeta de facturas
                    </p>
                  )}
                </div>

                {selectedFiles && (
                  <div className="flex items-center justify-between px-4 py-3 bg-primary/5 rounded-2xl border border-primary/10">
                    <div className="flex items-center gap-2">
                       {/* convención: verde = validado */}
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                       <span className="text-xs font-bold text-primary uppercase tracking-widest">Carpeta Validada</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label htmlFor="autowatch" className="text-xs font-bold text-muted-foreground uppercase">Monitoreo en vivo</label>
                      <Switch id="autowatch" checked={autoWatch} onCheckedChange={setAutoWatch} className="scale-90" />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground ml-2">Periodo de Análisis</label>
                  <Select value={scanType} onValueChange={(v: any) => setScanType(v)}>
                    <SelectTrigger className="h-14 rounded-2xl font-bold bg-muted/50 border-border">
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
                <div className="p-8 rounded-2xl bg-primary/10 border border-primary/20 space-y-6 animate-in zoom-in duration-500">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                       <span className="text-xl font-bold text-primary uppercase tracking-tight">{scanStatus}</span>
                    </div>
                    <span className="text-3xl font-bold text-primary">{Math.round(progress)}%</span>
                  </div>
                  <div className="relative h-4 bg-muted rounded-full overflow-hidden shadow-inner">
                    <div className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {newFilesCount > 0 && (
                <div className="flex justify-center mb-4">
                  <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-full animate-bounce shadow-md">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {newFilesCount} archivos nuevos detectados — Re-escanear
                  </Badge>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  onClick={handleScan} 
                  disabled={isScanning || (!selectedFiles && useLocalScanner)} 
                  className="flex-1 h-20 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-2xl shadow-md transition-all active:scale-[0.98] gap-4"
                >
                  {isScanning ? <Loader2 className="w-8 h-8 animate-spin" /> : <Search className="w-8 h-8" />}
                  {isScanning ? "ESCANEO EN PROCESO..." : "INICIAR ESCANEO"}
                </Button>
                {isScanning && (
                  <Button onClick={() => abortControllerRef.current?.abort()} variant="destructive" className="h-20 w-20 rounded-2xl shadow-md transition-all">
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
             <Card className="bg-emerald-500/10 border border-emerald-500/20 shadow-xl rounded-2xl overflow-hidden animate-in slide-in-from-right-10 duration-700">
                <CardHeader className="bg-emerald-500/10 border-b border-emerald-500/20 p-6">
                   <CardTitle className="text-lg font-bold flex items-center gap-2 uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" /> Resultado Final
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                   <div className="grid grid-cols-2 gap-4">
                      <StatMini label="Facturas" val={lastInvoiceCount} color="text-emerald-600" />
                      <StatMini label="Analizados" val={lastStats.totalFilesProcessed} color="text-primary" />
                      <StatMini label="Duplicados" val={lastStats.skippedDuplicates} color="text-orange-600" />
                      <StatMini label="Omitidos" val={lastStats.skippedByDateRange} color="text-muted-foreground" />
                   </div>
                   
                   <Separator className="opacity-50" />
                   
                   <div className="space-y-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Efectividad de Lectura</p>
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg">
                            <DollarSign className="w-5 h-5" />
                         </div>
                         <div className="flex-1">
                            <div className="flex justify-between text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                               <span>Montos OK</span>
                               <span>{Math.round((lastStats.amountExtractionSuccess / lastInvoiceCount) * 100)}%</span>
                            </div>
                            <Progress value={(lastStats.amountExtractionSuccess / lastInvoiceCount) * 100} className="h-1.5" />
                         </div>
                      </div>
                   </div>

                   <Button className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md gap-3" onClick={() => navigate('/reports')}>
                      VER REPORTE DETALLADO <ChevronRight className="w-5 h-5" />
                   </Button>
                </CardContent>
             </Card>
           )}

           {/* Info del Motor */}
           <Card className="bg-card border-border rounded-2xl shadow-md overflow-hidden">
              <CardHeader className="p-6 border-b border-border">
                 <CardTitle className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Motor de Extracción V3.1</CardTitle>
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
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground ml-2">{label}</label>
      <Popover>
        <PopoverTrigger asChild>
          <button className="w-full h-14 rounded-2xl border border-border bg-muted/50 backdrop-blur-sm flex items-center px-5 font-bold text-sm hover:bg-muted/80 transition-all">
            <CalendarIcon className="mr-3 h-5 w-5 text-primary" />
            {date ? format(date, "dd MMM yyyy", { locale: es }) : "Fecha"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-border" align="start">
          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StatMini({ label, val, color }: any) {
  return (
    <div className="bg-card p-4 rounded-2xl border border-border text-center shadow-sm">
      <p className={cn("text-2xl font-bold tracking-tighter", color)}>{val}</p>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
    </div>
  );
}

function FeatureItem({ icon, text }: any) {
  return (
    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
      <div className="p-1.5 rounded-lg bg-muted text-muted-foreground">{icon}</div>
      <span>{text}</span>
    </div>
  );
}
