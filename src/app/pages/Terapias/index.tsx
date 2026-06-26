import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
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
import { FileDropZone } from "../../components/shared/FileDropZone";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";
import { logger } from "../../utils/logger";
import { terapiasService, SidecarStatus } from "../../services/terapiasService";

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

const getFinalPathPreview = (base: string, patient: string) => {
  const hoy = new Date();
  const meses = [
    "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
    "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"
  ];
  const mesNombre = `${(hoy.getMonth() + 1).toString().padStart(2, '0')}- ${meses[hoy.getMonth()]}`;
  const diaNombre = `${hoy.getDate().toString().padStart(2, '0')} DE ${meses[hoy.getMonth()]}`;
  return `${base}\\${hoy.getFullYear()}\\${mesNombre}\\${diaNombre}\\${patient}`;
};

export default function Terapias() {
  const location = useLocation();
  const navigate = useNavigate();
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
  const [pickerMode, setPickerMode] = useState<'select' | 'prepare'>('select');
  
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSSAlertOpen, setIsSSAlertOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{
    filename: string;
    inputName: string;
    patient: string;
    destination: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const inputNameRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasSourceDir = sourceDir.trim().length > 0;
  const engineReady = !status.loading && status.ping === true;
  const interactionsLocked = !hasSourceDir || !engineReady || isProcessing;

  const handleAutoDetectWord = async () => {
    if (!sourceDir.trim()) {
      toast.error("Configura primero la carpeta origen");
      return;
    }

    setIsListing(true);
    try {
      const files = await terapiasService.autoDetectWord(sourceDir);
      setAvailableDocs(files ?? []);
      if (!files || files.length === 0) {
        toast.error("No se encontró ningún documento Word en la carpeta origen");
      } else if (files.length === 1) {
        setForm(prev => ({ ...prev, filename: files[0].name }));
        toast.success(`Archivo detectado: ${files[0].name}`);
      } else {
        setPickerMode('select');
        setIsPickerOpen(true);
      }
    } catch (err) {
      toast.error("Error crítico al buscar archivos");
    } finally {
      setIsListing(false);
    }
  };

  const fetchDocs = async (dir: string = sourceDir) => {
    if (!dir.trim()) {
      setAvailableDocs([]);
      return;
    }

    setIsListing(true);
    try {
      const docs = await terapiasService.listDocuments(dir);
      const safeDocs = docs ?? [];
      setAvailableDocs(safeDocs);
      if (safeDocs.length > 0 && !form.filename) {
        setForm(prev => ({ ...prev, filename: safeDocs[0].name }));
      }
    } catch (err) {
      logger.error("Error listing docs:", err);
    } finally {
      setIsListing(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const history = await terapiasService.loadHistory();
      setHistory(history);
    } catch (err) {
      logger.error("Error fetching history:", err);
    }
  };

// Added function to handle prepare with skip SS, moved before useEffect to avoid TDZ
async function handlePrepareWithSkipSS() {
  setIsSSAlertOpen(false);
  const patientName = getPatientFromInput(form.inputName); // Will be PACIENTE_DESCONOCIDO

  // Step 1: Find Word document using terapias:listDocs (consistent with rest of module)
  let filename = form.filename;
  if (!filename) {
    const docs = await terapiasService.listDocuments(sourceDir);
    if (docs.length === 0) {
      toast.error("No se encontró ningún documento Word en la carpeta configurada.");
      return;
    }
    if (docs.length > 1) {
      setAvailableDocs(docs);
      setPickerMode('prepare');
      setIsPickerOpen(true);
      return;
    }
    filename = docs[0].name;
  }

  setConfirmData({
    filename,
    inputName: form.inputName,
    patient: patientName,
    destination: getFinalPathPreview(form.baseDest, patientName)
  });
  setIsConfirmOpen(true);
}

useEffect(() => {

  useEffect(() => {
    if (location.pathname !== "/terapias") return;

    const handler = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const isInputFocused = activeTag === "INPUT" || activeTag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.ctrlKey && e.key.toLowerCase() === "o") {
        if (!isInputFocused) {
          e.preventDefault();
          handleAutoDetectWord();
        }
      }

      if (e.key === "F5") {
        if (!isInputFocused) {
          e.preventDefault();
          fetchDocs();
        }
      }

      if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // --- Gestión de velocidad: Aceptar con Enter en todos los diálogos ---
      if (e.key === "Enter") {
        if (isSSAlertOpen) {
          e.preventDefault();
          handlePrepareWithSkipSS();
          return;
        }

        if (isConfirmOpen) {
          e.preventDefault();
          executePrepare();
          return;
        }

        if (isPickerOpen) {
          if (availableDocs.length > 0) {
            e.preventDefault();
            const doc = availableDocs[0];
            setForm(prev => ({ ...prev, filename: doc.name }));
            setIsPickerOpen(false);
            if (pickerMode === 'prepare') {
              const patientName = getPatientFromInput(form.inputName);
              setConfirmData({
                filename: doc.name,
                inputName: form.inputName,
                patient: patientName,
                destination: getFinalPathPreview(form.baseDest, patientName)
              });
              setIsConfirmOpen(true);
            }
          }
          return;
        }

        if (isFinalizeConfirmOpen) {
          e.preventDefault();
          setIsFinalizeConfirmOpen(false);
          handleFinalize();
          return;
        }

        // Si estamos en Paso 2 y no hay inputs enfocados, Enter abre la confirmación de finalización
        if (step.current === 2 && !isInputFocused && !interactionsLocked && !isProcessing) {
          e.preventDefault();
          setIsFinalizeConfirmOpen(true);
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    location.pathname,
    handleAutoDetectWord,
    fetchDocs,
    isSSAlertOpen,
    isConfirmOpen,
    isPickerOpen,
    isFinalizeConfirmOpen,
    availableDocs,
    pickerMode,
    form,
    step.current,
    interactionsLocked,
    isProcessing,
    // handlePrepareWithSkipSS moved above, safe to reference now
    handlePrepareWithSkipSS,
    executePrepare,
    handleFinalize
  ]);

  // Detectar estados de navegación (Dashboard -> Terapias o PDF Tools -> Terapias)
  useEffect(() => {
    const processState = async () => {
      if (location.state?.autoSearch && engineReady) {
        handleAutoDetectWord();
        toast.info("Búsqueda automática de documentos iniciada");
      }
      
      if (location.state?.preloadedDoc) {
        const path = location.state.preloadedDoc;
        const name = path.split(/[\\/]/).pop() || "";
        setForm(prev => ({ ...prev, filename: name }));
        toast.success(`Documento precargado: ${name}`);
      }

      if (location.state?.autoSearch || location.state?.preloadedDoc) {
        // Limpiar state de navegación
        window.history.replaceState({}, '');
        navigate(location.pathname, { replace: true, state: {} });
      }
    };

    if (!status.loading) {
      processState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, engineReady, status.loading]);

  const hasSSCode = (input: string): boolean => {
    return /\d*SS\s+\S+/.test(input);
  };

  const getPatientFromInput = (input: string) => {
    const parts = input.trim().split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i].toUpperCase();
      if (p === "SS" || p.endsWith("SS")) {
        if (i === parts.length - 1) {
          return parts.slice(0, i).join(" ").trim() || "PACIENTE_DESCONOCIDO";
        } else {
          return parts.slice(i + 1).join(" ").trim() || "PACIENTE_DESCONOCIDO";
        }
      }
    }
    return "PACIENTE_DESCONOCIDO";
  };

  const checkStatus = async (activeSource: string) => {
    setStatus((prev: SidecarStatus) => ({ ...prev, loading: true, error: null }));
    try {
      const serviceStatus = await terapiasService.checkStatus(settings.wordExecutablePath);
      
      setStatus({
        ping: serviceStatus.ping,
        word: serviceStatus.word,
        wordMessage: serviceStatus.wordMessage,
        loading: false,
        error: serviceStatus.error
      });
      
      if (serviceStatus.ping) {
        fetchDocs(activeSource);
        fetchHistory();
      }
    } catch (err: any) {
      setStatus((prev: SidecarStatus) => ({ 
        ...prev, 
        loading: false, 
        ping: false,
        error: "No se pudo conectar con el motor Python." 
      }));
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
      const results = await terapiasService.searchPatients(query, sourceDir, form.baseDest);
      setSearchResults(results);
    } catch (err) {
      logger.error("Error searching patient:", err);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const activeSource = settings.terapiasDir || "";
    setSourceDir(activeSource);
    setForm(prev => ({
      ...prev,
      baseDest: settings.terapiasBaseDest || prev.baseDest,
      backup: settings.terapiasBackup || prev.backup,
    }));

    // Registrar directorios en la lista de permitidos de seguridad para evitar bloqueos de IPC
    if (window.electronAPI?.security?.registerApprovedDirectory) {
      if (settings.terapiasDir) {
        window.electronAPI.security.registerApprovedDirectory(settings.terapiasDir).catch(err => {
          logger.error("Error registering source directory:", err);
        });
      }
      if (settings.terapiasBaseDest) {
        window.electronAPI.security.registerApprovedDirectory(settings.terapiasBaseDest).catch(err => {
          logger.error("Error registering base dest directory:", err);
        });
      }
      if (settings.terapiasBackup) {
        window.electronAPI.security.registerApprovedDirectory(settings.terapiasBackup).catch(err => {
          logger.error("Error registering backup directory:", err);
        });
      }
    }

    if (activeSource) {
      checkStatus(activeSource);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.terapiasDir, settings.terapiasBaseDest, settings.terapiasBackup, settings.wordExecutablePath]);

  useEffect(() => {
    if (sidecarStatus.Terapias === 'running' && sourceDir.trim()) {
      // Si el sidecar se reconecta, re-verificar Word
      checkStatus(sourceDir);
    }
  }, [sidecarStatus.Terapias, sourceDir]);

  const handleSelectFolder = (field: "baseDest" | "backup" | "sourceDir") => async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      if (field === "sourceDir") {
        setSourceDir(path);
        updateSettings({ terapiasDir: path });
        fetchDocs(path);
      } else if (field === "baseDest") {
        setForm(prev => ({ ...prev, baseDest: path }));
        updateSettings({ terapiasBaseDest: path });
      } else {
        setForm(prev => ({ ...prev, backup: path }));
        updateSettings({ terapiasBackup: path });
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

    // Validación de SS (Seguridad Social)
    if (!hasSSCode(form.inputName)) {
      setIsSSAlertOpen(true);
      return;
    }

    const patientName = getPatientFromInput(form.inputName);

    // Paso 1: Buscar archivo Word usando terapias:listDocs (consistente con el resto del módulo)
    let filename = form.filename;
    
    if (!filename) {
      const docs = await terapiasService.listDocuments(sourceDir);
      if (docs.length === 0) {
        toast.error("No se encontró ningún documento Word en la carpeta configurada.");
        return;
      }
      if (docs.length > 1) {
        setAvailableDocs(docs);
        setPickerMode('prepare');
        setIsPickerOpen(true);
        return;
      }
      filename = docs[0].name;
    } else {
      // Validar que el archivo seleccionado exista en la carpeta origen
      const docs = await terapiasService.listDocuments(sourceDir);
      const exists = docs.some(doc => doc.name === filename);
      if (!exists) {
        toast.error("El archivo seleccionado no se encuentra en la carpeta origen configurada.");
        return;
      }
    }

    // Preparar datos para confirmación con ruta completa
    setConfirmData({
      filename,
      inputName: form.inputName,
      patient: patientName,
      destination: getFinalPathPreview(form.baseDest, patientName)
    });
    setIsConfirmOpen(true);
  };


  const executePrepare = async () => {
    if (!confirmData) return;
    
    setIsConfirmOpen(false);
    setIsProcessing(true);
    try {
      const res = await terapiasService.prepareDocument({
        inputName: confirmData.inputName,
        filename: confirmData.filename,
        baseDest: form.baseDest,
        backup: form.backup,
      }, sourceDir);
      
      if (res.ok) {
        setForm(prev => ({ ...prev, filename: confirmData.filename }));
        setPrepareResult(res);
        setStep({
          current: 2,
          docPath: res.doc_path || null,
          patient: res.patient || null,
          folder: res.folder || null
        });

        // Registrar el nuevo directorio del paciente en la lista de permitidos
        if (window.electronAPI?.security?.registerApprovedDirectory && res.folder) {
          window.electronAPI.security.registerApprovedDirectory(res.folder).catch(err => {
            logger.error("Error registering patient folder:", err);
          });
        }

        toast.success("Archivo organizado y Word abierto");
      } else {
        toast.error("Error: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error crítico en la organización");
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
      const res = await terapiasService.finalizeDocument(step.docPath || "", form.backup, step.patient ?? "");
      
      if (res.ok) {
        toast.success("PDF generado y archivo original respaldado");
        
        // Registrar directorios en allowlist ANTES de llamar revealInFolder
        if (window.electronAPI?.security?.registerApprovedDirectory) {
          const foldersToRegister = [
            step.folder,
            res.pdf_path ? res.pdf_path.substring(0, res.pdf_path.lastIndexOf('\\')) : null,
            form.baseDest || null,
          ].filter(Boolean) as string[];

          await Promise.all(
            foldersToRegister.map(f =>
              window.electronAPI.security.registerApprovedDirectory(f).catch(() => {})
            )
          );
        }

        // Revelar en carpeta automáticamente
        if (res.pdf_path) {
          window.electronAPI.shell.revealInFolder(res.pdf_path);
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Organizador de Terapias</h1>
          <div className="flex items-center gap-3 mt-1 font-medium">
            <Badge variant="outline" className="text-xs font-bold border-border">SOURCE</Badge>
            <span className="font-mono text-xs uppercase text-muted-foreground">{sourceDir || "Origen no configurado"}</span>
          </div>
        </div>
        
        {/* Buscador Inteligente */}
        <div className="relative w-full md:w-80">
          <div className="relative group">
            <SearchIcon className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
              isSearching ? "text-primary animate-pulse" : "text-muted-foreground group-focus-within:text-primary"
            )} />
            <Input 
              ref={searchInputRef}
              placeholder="Buscar paciente antiguo..." 
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              disabled={!engineReady}
              className="pl-10 h-10 rounded-xl bg-card border-border font-bold focus:ring-2 focus:ring-primary/20"
            />
          </div>
          
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card border-border rounded-2xl shadow-md z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="p-2 divide-y divide-slate-100 dark:divide-slate-800">
                {searchResults.map((res, i) => (
                  <button 
                    key={i} 
                    className="w-full p-3 text-left hover:bg-muted/50 flex items-center gap-3 group transition-colors"
                    onClick={() => {
                      window.electronAPI.shell?.openPath(res.path);
                      setSearchResults([]);
                    }}
                  >
                    <div className="p-2 rounded-lg bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FolderOpen className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{res.name}</p>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Modificado: {formatRelativeDate(res.lastModified)}</p>
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
              <Badge 
                variant={status.word ? "outline" : "destructive"} 
                className={cn("gap-1.5 font-bold border-none", status.word ? "bg-emerald-500/10 text-emerald-600" : "")}
                title={status.wordMessage || (settings.wordExecutablePath ? `Ruta: ${settings.wordExecutablePath}` : "Configura Word en Settings")}
              >
                {status.word ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                {status.word ? "Word disponible" : "Word ausente"}
              </Badge>
            </div>
          )}
          <Button variant="outline" size="icon" onClick={() => checkStatus(sourceDir)} disabled={status.loading} className="h-10 w-10 rounded-xl border-border bg-card">
            <RefreshCw className={cn("w-4 h-4", status.loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      {(!hasSourceDir || (!status.loading && !engineReady)) && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 flex flex-col md:flex-row md:items-center gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Flujo bloqueado</p>
            <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground mt-1">
              {!hasSourceDir
                ? "Configura la carpeta origen desde settings.terapiasDir para iniciar el Paso 1."
                : !status.word
                  ? "Microsoft Word no está disponible en este equipo."
                  : "El motor de Terapias no está disponible. Reintenta la conexión antes de continuar."}
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
            "bg-card border-border shadow-md rounded-2xl overflow-hidden transition-all duration-500",
            step.current === 1 ? "ring-2 ring-primary/50" : "opacity-50 grayscale-[0.5]"
          )}>
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-muted text-muted-foreground">
                      <SearchIcon className="w-5 h-5" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Paso 1: Preparación</CardTitle>
                  </div>
                  <CardDescription className="text-base font-medium">Busca el archivo base y prepara la carpeta del paciente</CardDescription>
                </div>
                {step.current > 1 && <div className="p-2 rounded-full bg-emerald-500 text-white shadow-lg"><CheckCircle2 className="w-6 h-6" /></div>}
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {/* Nueva Zona de Drop para Selección (estilo PDF Tools) */}
              <div className="space-y-4">
                 <div className="flex items-center justify-between ml-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Documento Word a procesar</label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleAutoDetectWord}
                      disabled={interactionsLocked || isListing}
                      className="h-8 rounded-lg font-bold text-[10px] uppercase tracking-wider text-primary hover:bg-primary/10 gap-2"
                    >
                      <SearchIcon className={cn("w-3.5 h-3.5", isListing ? "animate-spin" : "")} />
                      Buscar Word en carpeta
                    </Button>
                 </div>
                 <FileDropZone 
                   multiple={false}
                   compact={true}
                   files={form.filename ? [{ name: form.filename, path: sourceDir + "\\" + form.filename }] : []}
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
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground ml-2">Nombre del Paciente / Entrada</label>
                  <Input 
                    ref={inputNameRef}
                    placeholder="Ej: Control 15-05 SS Maria Delgado" 
                    value={form.inputName}
                    onChange={e => setForm(prev => ({ ...prev, inputName: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter" && form.inputName && !interactionsLocked) {
                        e.preventDefault();
                        handlePrepare();
                      }
                    }}
                    disabled={step.current !== 1 || interactionsLocked}
                    className="h-12 rounded-xl bg-card border-border font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground ml-2">Destino de Almacenamiento</label>
                  <div className="flex gap-2">
                    <Input readOnly value={form.baseDest} placeholder="Selecciona destino..." className="h-12 rounded-xl bg-muted/40 border-border text-xs font-bold text-muted-foreground" />
                    <Button variant="secondary" className="h-12 w-12 rounded-xl" onClick={handleSelectFolder("baseDest")} disabled={step.current !== 1 || interactionsLocked}>
                      <FolderOpen className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {step.current === 1 && (
                <>
                  <Button 
                    className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base shadow-sm"
                    disabled={interactionsLocked || !form.inputName}
                    onClick={handlePrepare}
                  >
                    {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <><ChevronRight className="w-6 h-6" /> PREPARAR Y ABRIR WORD</>}
                  </Button>

                  <Dialog open={isSSAlertOpen} onOpenChange={setIsSSAlertOpen}>
                    <DialogContent
                      className="rounded-2xl border-border bg-card shadow-md"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePrepareWithSkipSS();
                        }
                      }}
                    >
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                          <AlertCircle className="w-6 h-6 text-amber-500" />
                          Código SS no detectado
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium pt-4 text-muted-foreground">
                          El nombre ingresado no contiene un código SS válido. La carpeta del paciente se creará como <span className="font-bold text-foreground">PACIENTE_DESCONOCIDO</span>. ¿Deseas continuar de todas formas?
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="pt-4 flex gap-2">
                        <Button 
                          variant="outline" 
                          className="rounded-xl font-bold flex-1" 
                          onClick={() => {
                            setIsSSAlertOpen(false);
                            setTimeout(() => inputNameRef.current?.focus(), 100);
                          }}
                        >
                          Corregir nombre
                        </Button>
                        <Button 
                          className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold flex-1" 
                          onClick={handlePrepareWithSkipSS}
                        >
                          Continuar sin SS
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                    <AlertDialogContent
                      className="rounded-2xl border-border bg-card border-border shadow-md"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          executePrepare();
                        }
                      }}
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Confirmar Organización</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium space-y-4 pt-4 text-muted-foreground">
                          <p>Se creará la estructura de carpetas y se moverá el archivo seleccionado.</p>
                          <div className="p-4 rounded-2xl bg-muted border-border space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase text-muted-foreground">Paciente Extraído</span>
                              <span className="text-xs font-bold text-foreground">{confirmData?.patient}</span>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold uppercase text-muted-foreground">Archivo Origen</span>
                              <span className="text-xs font-mono text-muted-foreground truncate ml-4 max-w-[200px]">{confirmData?.filename}</span>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-start">
                              <span className="text-xs font-bold uppercase text-muted-foreground shrink-0 mt-1">Ruta Final</span>
                              <span className="text-xs font-mono text-primary text-right break-all ml-4">{confirmData?.destination}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-[10px] leading-relaxed text-muted-foreground">
                              El sistema organizará el archivo en: <span className="font-bold text-primary">{confirmData?.destination}\[AÑO]\[MES]\[DÍA]\{confirmData?.patient}\</span>
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="pt-4">
                        <AlertDialogCancel className="rounded-xl font-bold">Corregir datos</AlertDialogCancel>
                        <AlertDialogAction 
                          className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold" 
                          onClick={executePrepare}
                        >
                          CONFIRMAR Y MOVER
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog open={isPickerOpen} onOpenChange={setIsPickerOpen}>
                    <AlertDialogContent
                      className="max-w-2xl rounded-2xl border-border bg-card border-border shadow-md"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && availableDocs.length > 0) {
                          e.preventDefault();
                          e.stopPropagation();
                          const doc = availableDocs[0];
                          setForm(prev => ({ ...prev, filename: doc.name }));
                          setIsPickerOpen(false);
                          if (pickerMode === 'prepare') {
                            const patientName = getPatientFromInput(form.inputName);
                            setConfirmData({
                              filename: doc.name,
                              inputName: form.inputName,
                              patient: patientName,
                              destination: getFinalPathPreview(form.baseDest, patientName)
                            });
                            setIsConfirmOpen(true);
                          }
                        }
                      }}
                    >
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold">Seleccionar Documento</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm font-medium pt-4 text-muted-foreground">
                          Se han encontrado varios archivos Word en la carpeta origen. Por favor, selecciona el que deseas procesar para <strong>{getPatientFromInput(form.inputName)}</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="max-h-[400px] overflow-y-auto pr-2 py-4">
                        <div className="grid grid-cols-1 gap-3">
                          {availableDocs.map((doc) => (
                            <button
                              key={doc.name}
                              onClick={() => {
                                setForm(prev => ({ ...prev, filename: doc.name }));
                                setIsPickerOpen(false);
                                if (pickerMode === 'prepare') {
                                  const patientName = getPatientFromInput(form.inputName);
                                  setConfirmData({
                                    filename: doc.name,
                                    inputName: form.inputName,
                                    patient: patientName,
                                    destination: getFinalPathPreview(form.baseDest, patientName)
                                  });
                                  setIsConfirmOpen(true);
                                }
                              }}
                              className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                            >
                              <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                <FileText className="w-5 h-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-foreground truncate">{doc.name}</p>
                                <div className="flex items-center gap-4 mt-1 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatRelativeDate(doc.modified)}</span>
                                  <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {formatSize(doc.size)}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </CardContent>
          </Card>

          {/* PASO 2: Finalización */}
          <Card className={cn(
            "bg-card border-border shadow-md rounded-2xl overflow-hidden transition-all duration-500",
            step.current === 2 ? "ring-2 ring-emerald-500" : "opacity-30 pointer-events-none"
          )}>
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-bold">Paso 2: Finalización</CardTitle>
                  <CardDescription className="text-base font-medium">Genera el PDF final y respalda el documento editable</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {step.current === 2 && (
                <div className="p-6 bg-muted/10 rounded-2xl border border-border flex items-center gap-6 animate-in zoom-in duration-500">
                  <div className="p-4 rounded-2xl bg-secondary text-secondary-foreground shadow-lg">
                    <User className="w-10 h-10" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Paciente en proceso</p>
                    <p className="text-2xl font-bold text-foreground truncate">{step.patient}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate italic font-medium">Editando ahora en Microsoft Word...</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground ml-2">Carpeta de Respaldo Histórico</label>
                <div className="flex gap-2">
                  <Input readOnly value={form.backup} placeholder="Ruta para copias Word..." className="h-12 rounded-xl bg-muted/40 border-border font-bold text-muted-foreground" />
                  <Button variant="secondary" className="h-12 px-6 rounded-xl font-bold" onClick={handleSelectFolder("backup")} disabled={interactionsLocked || step.current !== 2}>
                    <HistoryIcon className="w-4 h-4 mr-2" /> Cambiar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <AlertDialog open={isFinalizeConfirmOpen} onOpenChange={setIsFinalizeConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      className="w-full h-16 rounded-2xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold text-xl shadow-sm gap-3 active:scale-[0.98] transition-all"
                      disabled={interactionsLocked || step.current !== 2 || !step.docPath || !form.backup}
                      onClick={() => setIsFinalizeConfirmOpen(true)}
                    >
                      {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <><Download className="w-6 h-6" /> GENERAR PDF Y FINALIZAR</>}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-2xl border-border bg-card border-border shadow-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-bold">Confirmar Finalización</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-medium space-y-4 pt-4 text-muted-foreground">
                        <div className="p-4 rounded-2xl bg-muted border-border space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Paciente</span>
                            <span className="text-xs font-bold text-foreground">{step.patient}</span>
                          </div>
                          <Separator className="bg-border/50" />
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Archivo Word</span>
                            <span className="text-xs font-mono text-muted-foreground truncate ml-4 max-w-[200px]">{form.filename}</span>
                          </div>
                          <Separator className="bg-border/50" />
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold uppercase text-muted-foreground">Destino PDF</span>
                            <span className="text-xs font-mono text-muted-foreground truncate ml-4 max-w-[200px]">{step.folder}</span>
                          </div>
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-bold px-2">※ Asegúrate de haber guardado tus cambios en Word antes de continuar.</p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                      <AlertDialogCancel className="rounded-xl font-bold" onClick={() => setIsFinalizeConfirmOpen(false)}>Volver a Word</AlertDialogCancel>
                      <AlertDialogAction className="rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground font-bold" disabled={interactionsLocked || step.current !== 2 || !step.docPath || !form.backup} onClick={() => { setIsFinalizeConfirmOpen(false); handleFinalize(); }}>CONFIRMAR Y CONVERTIR</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Button variant="ghost" className="h-10 font-bold text-muted-foreground hover:text-red-500 hover:bg-red-500/10" disabled={interactionsLocked} onClick={() => setStep({ current: 1, docPath: null, patient: null, folder: null })}>
                  CANCELAR OPERACIÓN ACTUAL
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Sección de Historial */}
          <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen} className="space-y-4">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full h-12 rounded-2xl justify-between px-6 border-border bg-card font-bold text-xs uppercase tracking-widest text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Historial de Operaciones
                </div>
                <Badge variant="secondary" className="font-bold">{history.length}</Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.slice(0, 10).map((entry, i) => (
                  <Card key={i} className="bg-card border-border rounded-2xl overflow-hidden group hover:border-primary/50 transition-all">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-muted dark:bg-slate-900 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{entry.patient}</p>
                        <p className="text-xs font-bold text-muted-foreground uppercase">{new Date(entry.date).toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => window.electronAPI.shell.openPath(entry.pdfPath)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {history.length === 0 && (
                  <div className="col-span-full py-10 text-center space-y-3">
                    <HistoryIcon className="w-10 h-10 text-muted-foreground mx-auto" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sin registros recientes</p>
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Lateral Info Unificado */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="bg-card border-border rounded-2xl shadow-xl overflow-hidden">
            <CardHeader className="p-6 border-b border-border">
              <CardTitle className="text-lg font-bold flex items-center gap-3 text-foreground">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Info className="w-5 h-5" />
                </div>
                GUÍA RÁPIDA
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <GuideStep num="1" text="Busca archivos en la carpeta de entrada configurada arriba." />
              <GuideStep num="2" text="El motor creará la estructura AÑO/MES/DÍA automáticamente." />
              <GuideStep num="3" text="Completa el archivo en Word y guárdalo antes de finalizar." />

              <div className="rounded-2xl border border-border p-4 bg-muted/50">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">Atajos de teclado</p>
                <div className="space-y-3">
                  <ShortcutRow combo="Ctrl+O" description="Buscar Word en la carpeta origen" />
                  <ShortcutRow combo="F5" description="Refrescar la lista de documentos disponibles" />
                  <ShortcutRow combo="Ctrl+F" description="Enfocar el buscador de pacientes" />
                </div>
              </div>
              
              {prepareResult && prepareResult.ok && (
                <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-4 animate-in slide-in-from-right-4 duration-500">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted-foreground mb-1 tracking-widest">CARPETA CREADA</p>
                    <p className="text-xs font-mono break-all text-muted-foreground bg-muted dark:bg-slate-900/50 p-3 rounded-xl border border-border font-bold">{prepareResult.folder}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full h-11 rounded-xl font-bold border-border hover:bg-accent text-foreground transition-all gap-2"
                    onClick={() => window.electronAPI.shell?.openPath(prepareResult.folder)}
                  >
                    <FolderOpen className="w-4 h-4" /> Abrir en Explorador
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {availableDocs.length > 0 && step.current === 1 && (
            <Card className="bg-card border-border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="p-6 border-b border-border">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                  PENDIENTES <Badge className="bg-primary text-primary-foreground font-bold">{availableDocs.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-80">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {availableDocs.map(doc => (
                      <div 
                        key={doc.name} 
                        className="w-full px-6 py-4 flex items-center gap-3 group transition-colors hover:bg-primary/5"
                      >
                        <div 
                          className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                          onClick={() => {
                            if (interactionsLocked || step.current !== 1) return;
                            setForm(f => ({ ...f, filename: doc.name }));
                          }}
                        >
                          <div className="p-2 rounded-lg bg-muted dark:bg-slate-900 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-muted-foreground dark:text-muted-foreground truncate group-hover:text-primary transition-colors">{doc.name}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs font-bold text-muted-foreground uppercase">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatRelativeDate(doc.modified)}</span>
                              <span className="flex items-center gap-1"><Download className="w-3 h-3" /> {formatSize(doc.size)}</span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 rounded-lg font-bold text-xs gap-2 opacity-0 group-hover:opacity-100 transition-all border-border shrink-0"
                          disabled={interactionsLocked || step.current !== 1}
                          onClick={() => {
                            if (interactionsLocked || step.current !== 1) return;
                            window.electronAPI.shell.openFile(`${sourceDir}\\${doc.name}`);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5 text-primary" /> 
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

function ShortcutRow({ combo, description }: { combo: string; description: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-card p-3 text-xs font-semibold text-foreground">
      <span className="text-muted-foreground">{description}</span>
      <span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">{combo}</span>
    </div>
  );
}

function GuideStep({ num, text }: { num: string, text: string }) {
  return (
    <div className="flex gap-4">
      <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 font-bold text-sm border border-primary/20">{num}</div>
      <p className="text-xs font-medium text-muted-foreground dark:text-muted-foreground leading-relaxed pt-1">{text}</p>
    </div>
  );
}

interface DropZoneSimpleProps {
  file: { name: string; path: string } | null;
  onFiles: (paths: string[]) => void;
  accept?: string;
  disabled?: boolean;
  onClear?: () => void;
  defaultPath?: string;
}

function DropZoneSimple({ file, onFiles, accept, disabled, onClear, defaultPath }: DropZoneSimpleProps) {
  const [isOver, setIsOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsOver(false);
    const paths = Array.from(e.dataTransfer.files).map(f =>
      window.electronAPI.getPathForFile(f)
    );
    if (paths.length > 0) onFiles(paths);
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
      className={cn(
        "relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer min-h-[120px]",
        isOver ? "border-primary bg-primary/5" : "border-border hover:border-slate-300 dark:hover:border-slate-700",
        file && "border-primary bg-primary/5",
        disabled && "opacity-50 cursor-not-allowed border-slate-100 dark:border-slate-900"
      )}
      onClick={async () => {
        if (disabled) return;
        const filters = accept ? [{ name: "Documentos", extensions: accept.replace(/\./g, '').split(',') }] : [];
        const path = await window.electronAPI.selectFile({ filters, defaultPath });
        if (path) onFiles([path]);
      }}
    >
      {file ? (
        <div className="flex items-center gap-4 w-full px-2">
          <div className="p-2.5 rounded-xl bg-muted text-muted-foreground shrink-0">
             <FileText className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate uppercase tracking-tight">{file.name}</p>
            <p className="text-xs font-bold text-primary uppercase">Listo para organizar</p>
          </div>
          {!disabled && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onClear?.(); }}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className={cn("w-6 h-6", isOver ? "text-primary" : "text-muted-foreground")} />
          <p className="text-xs font-bold text-muted-foreground text-center">
             {isOver ? "¡Suéltalo!" : <>Arrastra el Word o <span className="text-primary underline decoration-2 underline-offset-2">selecciona</span></>}
          </p>
        </div>
      )}
    </div>
  );
}
