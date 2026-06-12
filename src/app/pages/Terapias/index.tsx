import { useState, useEffect, useCallback } from "react";
import { useData } from "../../contexts/DataContext";
import { 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FolderOpen, 
  RefreshCw,
  History as HistoryIcon,
  Info,
  ChevronRight,
  Download,
  Upload,
  X,
  User,
  Heart,
  Clock,
  Calendar,
  ExternalLink,
  Search as SearchIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { ScrollArea } from "../../components/ui/scroll-area";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "../../components/ui/alert-dialog";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "../../components/ui/collapsible";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";

interface SidecarStatus {
  ping: boolean;
  word: boolean;
  wordMessage: string;
  loading: boolean;
  error: string | null;
}

interface FormState {
  inputName: string;
  filename: string;
  baseDest: string;
  backup: string;
}

interface StepState {
  current: 1 | 2;
  docPath: string | null;
  patient: string | null;
  folder: string | null;
}

interface FileMetadata {
  name: string;
  modified: number;
  size: number;
}

interface HistoryEntry {
  date: string;
  patient: string;
  filename: string;
  pdfPath: string;
  backupPath: string;
}

interface SearchResult {
  name: string;
  path: string;
  lastModified: number;
}

export default function Terapias() {
  const { settings, updateSettings, sidecarStatus } = useData();
  const [status, setStatus] = useState<SidecarStatus>({
    ping: false,
    word: false,
    wordMessage: "",
    loading: true,
    error: null
  });

  const [availableDocs, setAvailableDocs] = useState<FileMetadata[]>([]);
  const [isListing, setIsListing] = useState(false);
  const [sourceDir, setSourceDir] = useState<string>(settings.terapiasDir || "");

  const [form, setForm] = useState<FormState>({
    inputName: "",
    filename: "",
    baseDest: "",
    backup: ""
  });

  const [step, setStep] = useState<StepState>({
    current: 1,
    docPath: null,
    patient: null,
    folder: null
  });

  const [prepareResult, setPrepareResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const hasSourceDir = sourceDir.trim().length > 0;
  const engineReady = !status.loading && status.ping === true;
  const interactionsLocked = !hasSourceDir || !engineReady || isProcessing;

  const checkStatus = async (activeSourceDir = sourceDir) => {
    setStatus(prev => ({ ...prev, loading: true, error: null }));
    try {
      const pingRes = await (window as any).electronAPI.terapias.ping();
      const wordRes = await (window as any).electronAPI.terapias.checkWord();
      
      setStatus({
        ping: pingRes.ok,
        word: wordRes.ok,
        wordMessage: wordRes.message || wordRes.error,
        loading: false,
        error: null
      });
      
      if (pingRes.ok) {
        fetchDocs(activeSourceDir);
        fetchHistory();
      }
    } catch (err: any) {
      setStatus(prev => ({ 
        ...prev, 
        loading: false, 
        ping: false,
        error: "No se pudo conectar con el motor Python." 
      }));
    }
  };

  const fetchDocs = async (activeSourceDir = sourceDir) => {
    if (!activeSourceDir.trim()) {
      setAvailableDocs([]);
      return;
    }

    setIsListing(true);
    try {
      const res = await (window as any).electronAPI.terapias.listDocs();
      if (res.ok) {
        setAvailableDocs(res.files);
        if (res.files.length > 0 && !form.filename) {
          setForm(prev => ({ ...prev, filename: res.files[0].name }));
        }
      }
    } catch (err) {
      console.error("Error listing docs:", err);
    } finally {
      setIsListing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await (window as any).electronAPI.terapias.getHistory();
      if (res.ok) {
        setHistory(res.history);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3 || !engineReady) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await (window as any).electronAPI.terapias.searchPatient({
        query,
        dest_root: form.baseDest
      });
      if (res.ok) {
        setSearchResults(res.results);
      }
    } catch (err) {
      console.error("Error searching patient:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      const source = await (window as any).electronAPI.config.get("settings.terapiasDir");
      const dest = await (window as any).electronAPI.config.get("terapias.baseDest");
      const backup = await (window as any).electronAPI.config.get("terapias.backup");
      
      const activeSource = source || settings.terapiasDir || "";
      setSourceDir(activeSource);
      if (activeSource) {
        await (window as any).electronAPI.config.set("settings.terapiasDir", activeSource);
        await (window as any).electronAPI.config.set("terapiasSourceDir", activeSource);
      }
      
      if (dest) setForm(prev => ({ ...prev, baseDest: dest }));
      if (backup) setForm(prev => ({ ...prev, backup: backup }));
      return activeSource;
    };
    
    loadConfig().then((activeSource) => {
      // Solo disparar checkStatus si el sidecar no reporta estar activo globalmente
      if (sidecarStatus.Terapias !== 'running') {
        checkStatus(activeSource || "");
      } else {
        // Si ya está activo, actualizar estado local y listar datos
        setStatus(prev => ({ ...prev, ping: true, word: true, loading: false }));
        fetchDocs(activeSource || "");
        fetchHistory();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectFolder = (field: "baseDest" | "backup" | "sourceDir") => async () => {
    const path = await (window as any).electronAPI.selectDirectory();
    if (path) {
      if (field === "sourceDir") {
        setSourceDir(path);
        updateSettings({ terapiasDir: path });
        (window as any).electronAPI.config.set("settings.terapiasDir", path);
        (window as any).electronAPI.config.set("terapiasSourceDir", path);
        fetchDocs(path);
      } else {
        setForm(prev => ({ ...prev, [field]: path }));
        const configKey = field === "baseDest" ? "terapias.baseDest" : "terapias.backup";
        (window as any).electronAPI.config.set(configKey, path);
      }
    }
  };

  const handlePrepare = async () => {
    if (!engineReady) {
      toast.error("El motor de Terapias debe estar disponible");
      return;
    }

    if (status.word !== true) {
      toast.error("Microsoft Word no está disponible en este equipo.");
      return;
    }

    if (!form.inputName || !form.baseDest) {
      toast.error("Completa el nombre y selecciona el destino");
      return;
    }

    if (!sourceDir) {
      toast.error("Configura primero la carpeta origen de terapias");
      return;
    }

    // Paso 1: Buscar automáticamente el archivo Word en sourceDir
    const docFiles = await (window as any).electronAPI.listFiles(sourceDir, ['.docx', '.doc']);

    if (docFiles.length === 0) {
      toast.error("No se encontró ningún documento Word en la carpeta configurada.");
      return;
    }

    if (docFiles.length > 1) {
      toast.error("Hay más de un documento Word en la carpeta. Deja solo uno.");
      return;
    }

    const filename = docFiles[0];

    setIsProcessing(true);
    try {
      const res = await (window as any).electronAPI.terapias.prepare({
        input_name: form.inputName,
        filename: filename,
        base_dest: form.baseDest
      });
      
      if (res.ok) {
        setForm(prev => ({ ...prev, filename: filename }));
        setPrepareResult(res);
        setStep({
          current: 2,
          docPath: res.doc_path,
          patient: res.patient,
          folder: res.folder
        });
        toast.success("Archivo movido y Word abierto para edición");
      } else {
        toast.error("Error: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error crítico en el Paso 1");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!engineReady) {
      toast.error("El motor de Terapias y Microsoft Word deben estar disponibles");
      return;
    }

    if (!step.docPath || !form.backup) {
      toast.error("Falta la ruta del documento o la carpeta de respaldo");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await (window as any).electronAPI.terapias.finalize({
        doc_path: step.docPath,
        backup: form.backup,
        patient: step.patient
      });
      
      if (res.ok) {
        toast.success("PDF generado y archivo original respaldado");
        
        // Revelar en carpeta automáticamente
        if (res.pdf_path) {
          (window as any).electronAPI.shell.revealInFolder(res.pdf_path);
        }

        setPrepareResult(null);
        setStep({ current: 1, docPath: null, patient: null, folder: null });
        setForm(prev => ({ ...prev, inputName: "", filename: "" }));
        fetchDocs(sourceDir);
        fetchHistory();
      } else {
        toast.error("Error al finalizar: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error crítico en el Paso 2");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatRelativeDate = (timestamp: number) => {
    const now = Date.now();
    const diff = now - (timestamp * 1000);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "hace un momento";
    if (mins < 60) return `hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `hace ${hours} h`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header Unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Organizador de Terapias</h1>
          <div className="flex items-center gap-3 mt-1 font-medium">
            <Badge variant="outline" className="text-[10px] font-black border-slate-200 dark:border-slate-800">SOURCE</Badge>
            <span className="font-mono text-xs uppercase text-slate-500">{sourceDir || "Origen no configurado"}</span>
          </div>
        </div>
        
        {/* Buscador Inteligente */}
        <div className="relative w-full md:w-80">
          <div className="relative group">
            <SearchIcon className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              isSearching ? "text-blue-500 animate-pulse" : "text-slate-400 group-focus-within:text-blue-500"
            )} />
            <Input 
              placeholder="Buscar paciente antiguo..." 
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              disabled={!engineReady}
              className="pl-10 h-10 rounded-xl bg-white/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 font-bold focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-2 divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map((res, i) => (
                  <button 
                    key={i} 
                    className="w-full p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center gap-3 group transition-colors"
                    onClick={() => {
                      (window as any).electronAPI.shell?.openPath(res.path);
                      setSearchResults([]);
                    }}
                  >
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 dark:text-white truncate">{res.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Modificado: {formatRelativeDate(res.lastModified)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {!status.loading && (
            <div className="flex gap-2 mr-2">
              <Badge variant={status.ping ? "outline" : "destructive"} className={cn("gap-1.5 font-bold border-none", status.ping ? "bg-emerald-500/10 text-emerald-600" : "")}>
                {status.ping ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                Motor listo
              </Badge>
              <Badge variant={status.word ? "outline" : "destructive"} className={cn("gap-1.5 font-bold border-none", status.word ? "bg-blue-500/10 text-blue-600" : "")}>
                {status.word ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {status.word ? "Word disponible" : "Word ausente"}
              </Badge>
            </div>
          )}
          <Button variant="outline" size="icon" onClick={checkStatus} disabled={status.loading} className="h-10 w-10 rounded-xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-sm">
            <RefreshCw className={cn("w-4 h-4", status.loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      {(!hasSourceDir || (!status.loading && !engineReady)) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex flex-col md:flex-row md:items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-amber-700 dark:text-amber-400 uppercase tracking-wide">Flujo bloqueado</p>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">
              {!hasSourceDir
                ? "Configura la carpeta origen desde settings.terapiasDir para iniciar el Paso 1."
                : "El motor de Terapias o Microsoft Word no esta disponible. Reintenta la conexion antes de continuar."}
            </p>
          </div>
          <Button variant="outline" className="rounded-xl font-bold" onClick={handleSelectFolder("sourceDir")}>
            <FolderOpen className="w-4 h-4 mr-2" /> Configurar origen
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Flujo Principal */}
        <div className="lg:col-span-8 space-y-8">
          {/* PASO 1: Selección y Preparación */}
          <Card className={cn(
            "bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500",
            step.current === 1 ? "ring-2 ring-blue-500/50" : "opacity-50 grayscale-[0.5]"
          )}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 p-8">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-500 text-white shadow-lg">
                      <SearchIcon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-2xl font-black">Paso 1: Preparación</CardTitle>
                  </div>
                  <CardDescription className="text-base font-medium">Busca el archivo base y prepara la carpeta del paciente</CardDescription>
                </div>
                {step.current > 1 && <div className="p-2 rounded-full bg-emerald-500 text-white shadow-lg"><CheckCircle2 className="w-6 h-6" /></div>}
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Nueva Zona de Drop para Selección (estilo PDF Tools) */}
              <div className="space-y-4">
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Documento Word a procesar</label>
                 <DropZoneSimple 
                   file={form.filename ? { name: form.filename, path: sourceDir + "\\" + form.filename } : null}
                   onFiles={(paths) => {
                     const name = paths[0].split(/[\\/]/).pop() || "";
                     setForm(prev => ({ ...prev, filename: name }));
                   }}
                   onClear={() => setForm(prev => ({ ...prev, filename: "" }))}
                   accept=".docx,.doc"
                   disabled={step.current !== 1 || interactionsLocked}
                   defaultPath={sourceDir || ""}
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Nombre del Paciente / Entrada</label>
                  <Input 
                    placeholder="Ej: Control 15-05 SS Maria Delgado" 
                    value={form.inputName}
                    onChange={e => setForm(prev => ({ ...prev, inputName: e.target.value }))}
                    disabled={step.current !== 1 || interactionsLocked}
                    className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Destino de Almacenamiento</label>
                  <div className="flex gap-2">
                    <Input readOnly value={form.baseDest} placeholder="Selecciona destino..." className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-xs" />
                    <Button variant="secondary" className="h-12 w-12 rounded-xl" onClick={handleSelectFolder("baseDest")} disabled={step.current !== 1 || interactionsLocked}>
                      <FolderOpen className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {step.current === 1 && (
                <Button 
                  className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xl shadow-xl shadow-blue-500/20 gap-3 active:scale-[0.98] transition-all"
                  disabled={interactionsLocked || !form.inputName}
                  onClick={handlePrepare}
                >
                  {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <><ChevronRight className="w-6 h-6" /> PREPARAR Y ABRIR WORD</>}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* PASO 2: Finalización */}
          <Card className={cn(
            "bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden transition-all duration-500",
            step.current === 2 ? "ring-2 ring-emerald-500 shadow-emerald-500/10" : "opacity-30 pointer-events-none"
          )}>
            <CardHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 p-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black">Paso 2: Finalización</CardTitle>
                  <CardDescription className="text-base font-medium">Genera el PDF final y respalda el documento editable</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {step.current === 2 && (
                <div className="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center gap-6 animate-in zoom-in duration-500">
                  <div className="p-4 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                    <User className="w-10 h-10" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70 mb-1">Paciente en proceso</p>
                    <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 truncate">{step.patient}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate italic">Editando ahora en Microsoft Word...</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Carpeta de Respaldo Histórico</label>
                <div className="flex gap-2">
                  <Input readOnly value={form.backup} placeholder="Ruta para copias Word..." className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800" />
                  <Button variant="secondary" className="h-12 px-6 rounded-xl font-bold" onClick={handleSelectFolder("backup")} disabled={interactionsLocked || step.current !== 2}>
                    <HistoryIcon className="w-4 h-4 mr-2" /> Cambiar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl shadow-xl shadow-emerald-500/20 gap-3 active:scale-[0.98] transition-all"
                      disabled={interactionsLocked || step.current !== 2 || !step.docPath || !form.backup}
                    >
                      {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <><Download className="w-6 h-6" /> GENERAR PDF Y FINALIZAR</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black">Confirmar Finalización</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-medium space-y-4 pt-4 text-slate-500 dark:text-slate-400">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400">Paciente</span>
                            <span className="text-xs font-black text-slate-900 dark:text-white">{step.patient}</span>
                          </div>
                          <Separator className="bg-slate-200/50 dark:bg-slate-800/50" />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400">Archivo Word</span>
                            <span className="text-[10px] font-mono text-slate-500 truncate ml-4 max-w-[200px]">{form.filename}</span>
                          </div>
                          <Separator className="bg-slate-200/50 dark:bg-slate-800/50" />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase text-slate-400">Destino PDF</span>
                            <span className="text-[10px] font-mono text-emerald-600 truncate ml-4 max-w-[200px]">{step.folder}</span>
                          </div>
                        </div>
                        <p className="text-xs text-orange-500 font-bold px-2">※ Asegúrate de haber guardado tus cambios en Word antes de continuar.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                      <AlertDialogCancel className="rounded-xl font-bold">Volver a Word</AlertDialogCancel>
                      <AlertDialogAction className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black" disabled={interactionsLocked || step.current !== 2 || !step.docPath || !form.backup} onClick={handleFinalize}>CONFIRMAR Y CONVERTIR</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button variant="ghost" className="h-10 font-bold text-slate-400 hover:text-red-500 hover:bg-red-500/10" disabled={interactionsLocked} onClick={() => setStep({ current: 1, docPath: null, patient: null, folder: null })}>
                  CANCELAR OPERACIÓN ACTUAL
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sección de Historial */}
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen} className="space-y-4">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-2xl justify-between px-6 border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-sm font-black text-xs uppercase tracking-widest text-slate-500">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Historial de Operaciones
                </div>
                <Badge variant="secondary" className="font-black">{history.length}</Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.slice(0, 10).map((entry, i) => (
                  <Card key={i} className="bg-white/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden group hover:border-blue-500/50 transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{entry.patient}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(entry.date).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-blue-500/10 hover:text-blue-500" onClick={() => (window as any).electronAPI.shell.openPath(entry.pdfPath)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {history.length === 0 && (
                  <div className="col-span-full py-10 text-center space-y-3">
                    <HistoryIcon className="w-10 h-10 text-slate-200 mx-auto" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sin registros recientes</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Lateral Info Unificado */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
            <CardHeader className="bg-blue-500 text-white p-6">
              <CardTitle className="text-lg font-black flex items-center gap-2">
                <Info className="w-5 h-5" /> GUÍA RÁPIDA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <GuideStep num="1" text="Busca archivos en la carpeta de entrada configurada arriba." />
              <GuideStep num="2" text="El motor creará la estructura AÑO/MES/DÍA automáticamente." />
              <GuideStep num="3" text="Completa el archivo en Word y guárdalo antes de finalizar." />
              
              {prepareResult && prepareResult.ok && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">CARPETA CREADA</p>
                    <p className="text-[11px] font-mono break-all text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">{prepareResult.folder}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl font-bold bg-white dark:bg-slate-950 border-emerald-500/30 hover:bg-emerald-500 text-emerald-600 hover:text-white transition-all gap-2"
                    onClick={() => (window as any).electronAPI.shell?.openPath(prepareResult.folder)}
                  >
                    <FolderOpen className="w-4 h-4" /> Abrir en Explorador
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {availableDocs.length > 0 && step.current === 1 && (
            <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center justify-between">
                  PENDIENTES <Badge className="bg-blue-500 font-black">{availableDocs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-80">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {availableDocs.map(doc => (
                      <div 
                        key={doc.name} 
                        className="w-full px-6 py-4 flex items-center gap-3 group transition-colors hover:bg-blue-500/5"
                      >
                        <div 
                          className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                          onClick={() => {
                            if (interactionsLocked || step.current !== 1) return;
                            setForm(f => ({ ...f, filename: doc.name }));
                          }}
                        >
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-600 dark:text-slate-300 truncate group-hover:text-blue-500 transition-colors">{doc.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-[9px] font-bold text-slate-400 uppercase">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatRelativeDate(doc.modified)}</span>
                              <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {formatSize(doc.size)}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 rounded-lg font-bold text-[10px] gap-2 opacity-0 group-hover:opacity-100 transition-all border-slate-200 dark:border-slate-800 shrink-0"
                          disabled={interactionsLocked || step.current !== 1}
                          onClick={() => {
                            if (interactionsLocked || step.current !== 1) return;
                            (window as any).electronAPI.shell.openFile(`${sourceDir}\\${doc.name}`);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-500" /> 
                          Abrir Word original
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function GuideStep({ num, text }: { num: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="h-7 w-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 font-black text-sm border border-blue-500/20">{num}</div>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed pt-1">{text}</p>
    </div>
  );
}

function DropZoneSimple({ file, onFiles, accept, disabled, onClear, defaultPath }: any) {
  const [isOver, setIsOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsOver(false);
    const paths = Array.from(e.dataTransfer.files).map(f => (f as any).path);
    if (paths.length > 0) onFiles(paths);
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer min-h-[120px]",
        isOver ? "border-blue-500 bg-blue-500/5" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
        file && "border-blue-500 bg-blue-500/5",
        disabled && "opacity-50 cursor-not-allowed border-slate-100 dark:border-slate-900"
      )}
      onClick={async () => {
        if (disabled) return;
        const filters = accept ? [{ name: "Documentos", extensions: accept.replace(/\./g, '').split(',') }] : [];
        const path = await (window as any).electronAPI.selectFile({ filters, defaultPath });
        if (path) onFiles([path]);
      }}
    >
      {file ? (
        <div className="flex items-center gap-4 w-full px-2">
          <div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-lg shrink-0">
             <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">{file.name}</p>
            <p className="text-[10px] font-bold text-blue-500 uppercase">Listo para organizar</p>
          </div>
          {!disabled && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onClear?.(); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className={cn("w-6 h-6", isOver ? "text-blue-500" : "text-slate-300")} />
          <p className="text-xs font-bold text-slate-500 text-center">
             {isOver ? "¡Suéltalo!" : <>Arrastra el Word o <span className="text-blue-500 underline decoration-2 underline-offset-2">selecciona</span></>}
          </p>
        </div>
      )}
    </div>
  );
}
