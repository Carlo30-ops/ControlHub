import { useState, useEffect, useCallback } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FolderOpen, 
  RefreshCw,
  Search,
  History,
  Info,
  ChevronRight,
  Download,
  Upload,
  X,
  User,
  Heart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ScrollArea } from "../../components/ui/scroll-area";
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

interface FileInfo {
  path: string;
  name: string;
}

const DEFAULT_SOURCE = "C:\\Users\\factu\\OneDrive\\Documentos 1\\TERAPIAS\\DOCUMENTOS PARA ARMAR";

export default function Terapias() {
  const [status, setStatus] = useState<SidecarStatus>({
    ping: false,
    word: false,
    wordMessage: "",
    loading: true,
    error: null
  });

  const [availableDocs, setAvailableDocs] = useState<string[]>([]);
  const [isListing, setIsListing] = useState(false);
  const [sourceDir, setSourceDir] = useState<string>(DEFAULT_SOURCE);

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

  const checkStatus = async () => {
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
      
      if (pingRes.ok) fetchDocs();
    } catch (err: any) {
      setStatus(prev => ({ 
        ...prev, 
        loading: false, 
        ping: false,
        error: "No se pudo conectar con el motor Python." 
      }));
    }
  };

  const fetchDocs = async () => {
    setIsListing(true);
    try {
      const res = await (window as any).electronAPI.terapias.listDocs();
      if (res.ok) {
        setAvailableDocs(res.files);
        if (res.files.length > 0 && !form.filename) {
          setForm(prev => ({ ...prev, filename: res.files[0] }));
        }
      }
    } catch (err) {
      console.error("Error listing docs:", err);
    } finally {
      setIsListing(false);
    }
  };

  useEffect(() => {
    const loadConfig = async () => {
      const dest = await (window as any).electronAPI.config.get("terapias.baseDest");
      const backup = await (window as any).electronAPI.config.get("terapias.backup");
      const source = await (window as any).electronAPI.config.get("terapiasSourceDir");
      if (dest) setForm(prev => ({ ...prev, baseDest: dest }));
      if (backup) setForm(prev => ({ ...prev, backup: backup }));
      if (source) setSourceDir(source);
    };
    loadConfig();
    checkStatus();
  }, []);

  const handleSelectFolder = (field: "baseDest" | "backup" | "sourceDir") => async () => {
    const path = await (window as any).electronAPI.selectDirectory();
    if (path) {
      if (field === "sourceDir") {
        setSourceDir(path);
        (window as any).electronAPI.config.set("terapiasSourceDir", path);
        fetchDocs();
      } else {
        setForm(prev => ({ ...prev, [field]: path }));
        const configKey = field === "baseDest" ? "terapias.baseDest" : "terapias.backup";
        (window as any).electronAPI.config.set(configKey, path);
      }
    }
  };

  const handlePrepare = async () => {
    if (!form.inputName || !form.filename || !form.baseDest) {
      toast.error("Completa el nombre, selecciona un archivo y destino");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await (window as any).electronAPI.terapias.prepare({
        input_name: form.inputName,
        filename: form.filename,
        base_dest: form.baseDest
      });
      
      if (res.ok) {
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
    if (!step.docPath || !form.backup) {
      toast.error("Falta la ruta del documento o la carpeta de respaldo");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await (window as any).electronAPI.terapias.finalize({
        doc_path: step.docPath,
        backup: form.backup
      });
      
      if (res.ok) {
        toast.success("PDF generado y archivo original respaldado");
        setPrepareResult(null);
        setStep({ current: 1, docPath: null, patient: null, folder: null });
        setForm(prev => ({ ...prev, inputName: "", filename: "" }));
        fetchDocs();
      } else {
        toast.error("Error al finalizar: " + res.error);
      }
    } catch (err: any) {
      toast.error("Error crítico en el Paso 2");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header Unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Organizador de Terapias</h1>
          <div className="flex items-center gap-3 mt-1 font-medium">
            <Badge variant="outline" className="text-[10px] font-black border-slate-200 dark:border-slate-800">SOURCE</Badge>
            <span className="font-mono text-xs uppercase text-slate-500">{sourceDir}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800" onClick={handleSelectFolder("sourceDir")}>
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
            </Button>
          </div>
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
                      <Search className="w-5 h-5" />
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
                   disabled={step.current !== 1}
                 />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Nombre del Paciente / Entrada</label>
                  <Input 
                    placeholder="Ej: Control 15-05 SS Maria Delgado" 
                    value={form.inputName}
                    onChange={e => setForm(prev => ({ ...prev, inputName: e.target.value }))}
                    disabled={step.current !== 1}
                    className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-2">Destino de Almacenamiento</label>
                  <div className="flex gap-2">
                    <Input readOnly value={form.baseDest} placeholder="Selecciona destino..." className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-xs" />
                    <Button variant="secondary" className="h-12 w-12 rounded-xl" onClick={handleSelectFolder("baseDest")} disabled={step.current !== 1}>
                      <FolderOpen className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {step.current === 1 && (
                <Button 
                  className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xl shadow-xl shadow-blue-500/20 gap-3 active:scale-[0.98] transition-all"
                  disabled={isProcessing || !status.ping || !form.filename || !form.inputName}
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
                  <Button variant="secondary" className="h-12 px-6 rounded-xl font-bold" onClick={handleSelectFolder("backup")}>
                    <History className="w-4 h-4 mr-2" /> Cambiar
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <Button 
                  className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xl shadow-xl shadow-emerald-500/20 gap-3 active:scale-[0.98] transition-all"
                  disabled={isProcessing}
                  onClick={handleFinalize}
                >
                  {isProcessing ? <RefreshCw className="w-8 h-8 animate-spin" /> : <><Download className="w-6 h-6" /> GENERAR PDF Y FINALIZAR</>}
                </Button>
                
                <Button variant="ghost" className="h-10 font-bold text-slate-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => setStep({ current: 1, docPath: null, patient: null, folder: null })}>
                  CANCELAR OPERACIÓN ACTUAL
                </Button>
              </div>
            </CardContent>
          </Card>
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
                <ScrollArea className="h-64">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {availableDocs.map(doc => (
                      <button 
                        key={doc} 
                        className="w-full px-6 py-4 text-left hover:bg-blue-500/5 transition-colors flex items-center gap-3 group"
                        onClick={() => setForm(f => ({ ...f, filename: doc }))}
                      >
                        <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate flex-1">{doc}</span>
                        <ChevronRight className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                      </button>
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

function DropZoneSimple({ file, onFiles, accept, disabled, onClear }: any) {
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
        const path = await (window as any).electronAPI.selectFile(filters);
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
