import { useState, useCallback, useMemo, useEffect } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FolderOpen, 
  RefreshCw,
  Files,
  Split,
  Scissors,
  Minimize2,
  RotateCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileType,
  FileJson as FileExcel,
  Presentation,
  Info,
  Upload,
  FolderPlus,
  X,
  ExternalLink,
  ChevronLeft,
  ArrowRight,
  Eraser,
  ListOrdered,
  Crop,
  Wrench,
  Hash,
  Type,
  Image as ImageIcon,
  ImagePlus,
  FileImage,
  Globe,
  Lock,
  Unlock,
  Search,
  Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Slider } from "../../components/ui/slider";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";

// --- Types & Constants ---
interface FileInfo {
  path: string;
  name: string;
  size?: string;
}

type ToolId = 
  | 'merge' | 'split' | 'extract' | 'delete_pages' | 'reorder_pages'
  | 'compress' | 'rotate' | 'crop' | 'repair' | 'add_page_numbers'
  | 'watermark' | 'watermark_image' | 'jpg_to_pdf' | 'pdf_to_jpg' | 'html_to_pdf'
  | 'protect' | 'unlock' | 'ocr'
  | 'w2p' | 'p2w' | 'e2p' | 'pp2p';

type Category = 'Organizar' | 'Optimizar' | 'Contenido' | 'Seguridad' | 'Convertir';

interface ToolConfig {
  id: ToolId;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  accept: string;
  category: Category;
  newExt?: string;
  needsConfirm?: boolean;
}

const TOOLS: ToolConfig[] = [
  // Organizar
  { id: 'merge', category: 'Organizar', name: 'Unir PDFs', desc: 'Combina varios archivos en uno solo', icon: <Files className="w-6 h-6" />, color: 'bg-blue-500', accept: '.pdf' },
  { id: 'split', category: 'Organizar', name: 'Dividir PDF', desc: 'Separa un PDF en varios archivos', icon: <Split className="w-6 h-6" />, color: 'bg-emerald-500', accept: '.pdf', needsConfirm: true },
  { id: 'extract', category: 'Organizar', name: 'Extraer Páginas', desc: 'Obtén solo las páginas que necesitas', icon: <Scissors className="w-6 h-6" />, color: 'bg-purple-500', accept: '.pdf' },
  { id: 'delete_pages', category: 'Organizar', name: 'Eliminar Páginas', desc: 'Quita páginas específicas del documento', icon: <Eraser className="w-6 h-6" />, color: 'bg-red-500', accept: '.pdf', needsConfirm: true },
  { id: 'reorder_pages', category: 'Organizar', name: 'Ordenar Páginas', desc: 'Cambia el orden de las hojas', icon: <ListOrdered className="w-6 h-6" />, color: 'bg-indigo-500', accept: '.pdf' },
  
  // Optimizar
  { id: 'compress', category: 'Optimizar', name: 'Comprimir', desc: 'Reduce el peso de tus archivos', icon: <Minimize2 className="w-6 h-6" />, color: 'bg-orange-500', accept: '.pdf', needsConfirm: true },
  { id: 'rotate', category: 'Optimizar', name: 'Rotar', desc: 'Gira las páginas de tus documentos', icon: <RotateCw className="w-6 h-6" />, color: 'bg-indigo-500', accept: '.pdf', needsConfirm: true },
  { id: 'crop', category: 'Optimizar', name: 'Recortar', desc: 'Ajusta los márgenes del documento', icon: <Crop className="w-6 h-6" />, color: 'bg-cyan-500', accept: '.pdf' },
  { id: 'repair', category: 'Optimizar', name: 'Reparar PDF', desc: 'Intenta recuperar archivos dañados', icon: <Wrench className="w-6 h-6" />, color: 'bg-slate-500', accept: '.pdf' },
  { id: 'add_page_numbers', category: 'Optimizar', name: 'Numerar Páginas', desc: 'Inserta números de página', icon: <Hash className="w-6 h-6" />, color: 'bg-blue-400', accept: '.pdf' },

  // Contenido
  { id: 'watermark', category: 'Contenido', name: 'Marca de Agua Texto', desc: 'Añade texto de fondo', icon: <Type className="w-6 h-6" />, color: 'bg-pink-500', accept: '.pdf' },
  { id: 'watermark_image', category: 'Contenido', name: 'Marca de Agua Imagen', desc: 'Añade un logo de fondo', icon: <ImageIcon className="w-6 h-6" />, color: 'bg-rose-500', accept: '.pdf' },
  { id: 'jpg_to_pdf', category: 'Contenido', name: 'JPG a PDF', desc: 'Imágenes a documento PDF', icon: <ImagePlus className="w-6 h-6" />, color: 'bg-orange-600', accept: '.jpg,.jpeg,.png' },
  { id: 'pdf_to_jpg', category: 'Contenido', name: 'PDF a JPG', desc: 'Páginas a imágenes individuales', icon: <FileImage className="w-6 h-6" />, color: 'bg-amber-500', accept: '.pdf' },
  { id: 'html_to_pdf', category: 'Contenido', name: 'HTML a PDF', desc: 'Web local a documento PDF', icon: <Globe className="w-6 h-6" />, color: 'bg-sky-600', accept: '.html' },

  // Seguridad
  { id: 'protect', category: 'Seguridad', name: 'Proteger PDF', desc: 'Cifra con contraseña', icon: <Lock className="w-6 h-6" />, color: 'bg-violet-600', accept: '.pdf', needsConfirm: true },
  { id: 'unlock', category: 'Seguridad', name: 'Desbloquear PDF', desc: 'Quita la contraseña', icon: <Unlock className="w-6 h-6" />, color: 'bg-purple-600', accept: '.pdf', needsConfirm: true },
  { id: 'ocr', category: 'Seguridad', name: 'OCR (Buscable)', desc: 'Reconocimiento de texto', icon: <Search className="w-6 h-6" />, color: 'bg-emerald-600', accept: '.pdf' },

  // Convertir
  { id: 'w2p', category: 'Convertir', name: 'Word a PDF', desc: 'Doc a PDF profesional', icon: <FileText className="w-6 h-6" />, color: 'bg-blue-600', accept: '.docx,.doc', newExt: '.pdf' },
  { id: 'p2w', category: 'Convertir', name: 'PDF a Word', desc: 'PDF a Doc editable', icon: <FileType className="w-6 h-6" />, color: 'bg-indigo-600', accept: '.pdf', newExt: '.docx' },
  { id: 'e2p', category: 'Convertir', name: 'Excel a PDF', desc: 'Xls a PDF', icon: <FileExcel className="w-6 h-6" />, color: 'bg-emerald-600', accept: '.xlsx,.xls', newExt: '.pdf' },
  { id: 'pp2p', category: 'Convertir', name: 'PPT a PDF', desc: 'Ppt a PDF', icon: <Presentation className="w-6 h-6" />, color: 'bg-orange-600', accept: '.pptx,.ppt', newExt: '.pdf' },
];

export default function PDFTools() {
  const [view, setView] = useState<'selector' | 'active' | 'result'>('selector');
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string; path?: string } | null>(null);

  // --- Common States ---
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [output, setOutput] = useState("");
  
  // --- Tool Specific States ---
  const [splitRanges, setSplitRanges] = useState("");
  const [extractPages, setExtractPages] = useState("");
  const [deletePagesInput, setDeletePagesInput] = useState("");
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [cropRect, setCropRect] = useState({ x0: 0, y0: 0, x1: 595, y1: 842 }); // Default A4 approx in points
  const [pageNumberPos, setPageNumberPos] = useState("bottom-center");
  const [pageNumberStart, setPageNumberStart] = useState("1");
  const [wmText, setWatermarkText] = useState("CONFIDENCIAL");
  const [wmOpacity, setWatermarkOpacity] = useState([0.3]);
  const [wmAngle, setWatermarkAngle] = useState("45");
  const [wmImage, setWatermarkImage] = useState<FileInfo | null>(null);
  const [dpi, setDpi] = useState("150");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ocrLang, setOcrLang] = useState("spa");

  // --- Helpers ---
  const getFileInfo = (path: string): FileInfo => ({
    path,
    name: path.split(/[\\/]/).pop() || "",
  });

  const handleOpenFolder = (path?: string) => {
    if (path) {
      const folder = path.substring(0, path.lastIndexOf("\\"));
      (window as any).electronAPI.shell.openPath(folder || path);
    }
  };

  const resetToolState = (tool: ToolConfig | null) => {
    setFiles([]);
    setOutput("");
    setSplitRanges("");
    setExtractPages("");
    setDeletePagesInput("");
    setPageOrder([]);
    setCropRect({ x0: 0, y0: 0, x1: 595, y1: 842 });
    setPageNumberPos("bottom-center");
    setPageNumberStart("1");
    setWatermarkText("CONFIDENCIAL");
    setWatermarkOpacity([0.3]);
    setWatermarkAngle("45");
    setWatermarkImage(null);
    setDpi("150");
    setPassword("");
    setConfirmPassword("");
    setOcrLang("spa");
    setResult(null);
    setActiveTool(tool);
    if (tool) setView('active');
    else setView('selector');
  };

  // Reorder logic for multiple tools
  const handleReorder = (idx: number, dir: number) => {
    const next = [...files];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setFiles(next);
  };

  const executeAction = async () => {
    if (!activeTool) return;
    
    // Validaciones básicas
    if (activeTool.id === 'protect' && password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsProcessing(true);
    setResult(null);
    try {
      let res: any;
      let successMsg = "Operación completada";
      const api = (window as any).electronAPI.pdfTools;

      switch (activeTool.id) {
        case 'merge':
          res = await api.merge({ files: files.map(f => f.path), output });
          successMsg = "PDFs unidos correctamente";
          break;
        case 'split':
          res = await api.split({ input: files[0].path, output_dir: output, ranges: splitRanges });
          successMsg = "PDF dividido correctamente";
          break;
        case 'extract':
          res = await api.extract({ input: files[0].path, output, pages: extractPages });
          successMsg = "Páginas extraídas correctamente";
          break;
        case 'delete_pages':
          res = await api.deletePages({ input: files[0].path, output, pages: deletePagesInput });
          successMsg = "Páginas eliminadas correctamente";
          break;
        case 'reorder_pages':
          res = await api.reorderPages({ input: files[0].path, output, order: pageOrder });
          successMsg = "Orden de páginas actualizado";
          break;
        case 'compress':
          res = await api.compress({ input: files[0].path, output, level: compressLevel });
          successMsg = "PDF comprimido correctamente";
          break;
        case 'rotate':
          res = await api.rotate({ input: files[0].path, output, angle: parseInt(rotateAngle), pages: rotatePages });
          successMsg = "Páginas rotadas correctamente";
          break;
        case 'crop':
          res = await api.crop({ input: files[0].path, output, rect: [cropRect.x0, cropRect.y0, cropRect.x1, cropRect.y1] });
          successMsg = "PDF recortado correctamente";
          break;
        case 'repair':
          res = await api.repair({ input: files[0].path, output });
          successMsg = "PDF reparado";
          break;
        case 'add_page_numbers':
          res = await api.addPageNumbers({ input: files[0].path, output, position: pageNumberPos, start: parseInt(pageNumberStart) });
          successMsg = "Números de página insertados";
          break;
        case 'watermark':
          res = await api.watermark({ input: files[0].path, output, text: wmText, opacity: wmOpacity[0], angle: parseInt(wmAngle) });
          successMsg = "Marca de agua de texto añadida";
          break;
        case 'watermark_image':
          res = await api.watermarkImage({ input: files[0].path, output, image: wmImage?.path, opacity: wmOpacity[0] });
          successMsg = "Marca de agua de imagen añadida";
          break;
        case 'jpg_to_pdf':
          res = await api.jpgToPdf({ images: files.map(f => f.path), output });
          successMsg = "Imágenes convertidas a PDF";
          break;
        case 'pdf_to_jpg':
          res = await api.pdfToJpg({ input: files[0].path, output_dir: output, dpi: parseInt(dpi) });
          successMsg = "Páginas convertidas a JPG";
          break;
        case 'html_to_pdf':
          res = await api.htmlToPdf({ input: files[0].path, output });
          successMsg = "HTML convertido a PDF";
          break;
        case 'protect':
          res = await api.protect({ input: files[0].path, output, password });
          successMsg = "PDF protegido con contraseña";
          break;
        case 'unlock':
          res = await api.unlock({ input: files[0].path, output, password });
          successMsg = "Contraseña eliminada del PDF";
          break;
        case 'ocr':
          res = await api.ocr({ input: files[0].path, output, lang: ocrLang });
          successMsg = "OCR completado, el PDF ahora es buscable";
          break;
        case 'w2p': res = await api.wordToPdf({ input: files[0].path, output }); break;
        case 'p2w': res = await api.pdfToWord({ input: files[0].path, output }); break;
        case 'e2p': res = await api.excelToPdf({ input: files[0].path, output }); break;
        case 'pp2p': res = await api.pptToPdf({ input: files[0].path, output }); break;
      }

      if (res.ok) {
        setResult({ ok: true, message: successMsg, path: res.output || (res.outputs && res.outputs[0]) });
        setView('result');
        toast.success(successMsg);
      } else {
        setResult({ ok: false, error: res.error });
        toast.error("Error: " + res.error);
      }
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
      toast.error("Error crítico: " + err.message);
    } finally {
      setIsProcessing(false);
      setShowConfirm(false);
    }
  };

  // Cargar info del PDF para herramientas que lo necesiten
  useEffect(() => {
    if (activeTool?.id === 'reorder_pages' && files.length === 1) {
      const getMeta = async () => {
        const meta = await (window as any).electronAPI.parsePdf(files[0].path, 1);
        if (meta && meta.pageCount) {
          setPageOrder(Array.from({ length: meta.pageCount }, (_, i) => i + 1));
        }
      };
      getMeta();
    }
    
    // Fix #3: Cargar dimensiones para el recorte
    if (activeTool?.id === 'crop' && files.length === 1) {
      const getInfo = async () => {
        const res = await (window as any).electronAPI.pdfTools.getPageInfo({ input: files[0].path });
        if (res.ok && res.pages && res.pages.length > 0) {
          const p = res.pages[0];
          setCropRect({ x0: 0, y0: 0, x1: p.width, y1: p.height });
          toast.info(`Dimensiones detectadas: ${p.width}x${p.height} pts`);
        }
      };
      getInfo();
    }
  }, [activeTool, files]);

  const handleActionRequest = () => {
    if (activeTool?.needsConfirm) setShowConfirm(true);
    else executeAction();
  };

  const otherTools = useMemo(() => 
    TOOLS.filter(t => t.id !== activeTool?.id).sort(() => 0.5 - Math.random()).slice(0, 3),
    [activeTool]
  );

  // --- Views ---

  // VISTA A: Selector
  if (view === 'selector') {
    const grouped = TOOLS.reduce((acc, tool) => {
      if (!acc[tool.category]) acc[tool.category] = [];
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<Category, ToolConfig[]>);

    const categoryOrder: Category[] = ['Organizar', 'Optimizar', 'Contenido', 'Seguridad', 'Convertir'];

    return (
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
        <div className="text-center space-y-2">
          <h1 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight">PDF Tools <Badge className="ml-2 bg-blue-500 text-white font-bold">V2.0</Badge></h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">22 herramientas profesionales de procesamiento local</p>
        </div>
        
        {categoryOrder.map((cat) => (
          <div key={cat} className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black uppercase tracking-[0.2em] text-slate-400">{cat}</h2>
              <Separator className="flex-1 opacity-50" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {grouped[cat].map((tool) => (
                <Card 
                  key={tool.id} 
                  className="group cursor-pointer hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 overflow-hidden border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/20"
                  onClick={() => resetToolState(tool)}
                >
                  <CardContent className="p-5 flex items-start gap-4 h-full">
                    <div className={cn("p-2.5 rounded-xl text-white shadow-lg shrink-0", tool.color)}>
                      {tool.icon}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{tool.name}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2">{tool.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // VISTA B: Herramienta Activa
  if (view === 'active' && activeTool) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20">
        <Button variant="ghost" className="gap-2 text-slate-500 hover:text-slate-900 dark:hover:text-white" onClick={() => setView('selector')}>
          <ChevronLeft className="w-4 h-4" /> Volver al selector
        </Button>

        <Card className="shadow-2xl border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-md overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 p-8 text-center">
            <div className={cn("mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl mb-4", activeTool.color)}>
              {activeTool.icon}
            </div>
            <CardTitle className="text-3xl font-black">{activeTool.name}</CardTitle>
            <CardDescription className="text-base font-medium">{activeTool.desc}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 space-y-8">
            {/* DropZone Unificada */}
            <DropZone 
              multiple={activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf'}
              accept={activeTool.accept}
              files={files}
              onFiles={(newPaths) => {
                const newFiles = newPaths.map(p => getFileInfo(p));
                if (activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf') {
                  setFiles(prev => [...prev, ...newFiles]);
                  if (!output) {
                    const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("\\"));
                    setOutput(`${base}\\Resultado_${Date.now()}${activeTool.newExt || '.pdf'}`);
                  }
                } else {
                  setFiles([newFiles[0]]);
                  const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("."));
                  if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
                    setOutput(newPaths[0].substring(0, newPaths[0].lastIndexOf("\\")));
                  } else {
                    setOutput(`${base}${activeTool.newExt || (activeTool.id === 'extract' ? '_extraido.pdf' : activeTool.id === 'delete_pages' ? '_editado.pdf' : activeTool.id === 'compress' ? '_comprimido.pdf' : activeTool.id === 'ocr' ? '_ocr.pdf' : '_procesado.pdf')}`);
                  }
                }
              }}
              onRemove={(idx) => setFiles(prev => prev.filter((_, i) => i !== idx))}
              onReorder={handleReorder}
            />

            {/* Controles Específicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
              {activeTool.id === 'split' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Rangos (ej: 1-3, 4-z)</label>
                  <Input value={splitRanges} onChange={e => setSplitRanges(e.target.value)} placeholder="Ej: 1-5, 6-10" className="h-12 rounded-xl" />
                </div>
              )}
              {activeTool.id === 'extract' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Páginas a extraer</label>
                  <Input value={extractPages} onChange={e => setExtractPages(e.target.value)} placeholder="Ej: 1, 3, 5-8" className="h-12 rounded-xl" />
                </div>
              )}
              {activeTool.id === 'delete_pages' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Páginas a eliminar (ej: 2, 4, 6-8)</label>
                  <Input value={deletePagesInput} onChange={e => setDeletePagesInput(e.target.value)} placeholder="Ej: 2, 5" className="h-12 rounded-xl border-red-500/30" />
                </div>
              )}
              {activeTool.id === 'reorder_pages' && pageOrder.length > 0 && (
                <div className="md:col-span-2 space-y-3">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex justify-between">
                    Orden de páginas <span>{pageOrder.length} páginas detectadas</span>
                  </label>
                  <ScrollArea className="h-48 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {pageOrder.map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm group">
                          <span className="text-xs font-bold text-slate-500">Hoja {page}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => {
                              const next = [...pageOrder];
                              [next[idx], next[idx-1]] = [next[idx-1], next[idx]];
                              setPageOrder(next);
                            }}><ArrowUp className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === pageOrder.length - 1} onClick={() => {
                              const next = [...pageOrder];
                              [next[idx], next[idx+1]] = [next[idx+1], next[idx]];
                              setPageOrder(next);
                            }}><ArrowDown className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
              {activeTool.id === 'compress' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Nivel de compresión</label>
                  <Select value={compressLevel} onValueChange={setCompressLevel}>
                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast" className="font-bold">Máxima Velocidad (Limpieza)</SelectItem>
                      <SelectItem value="screen" className="font-bold">Baja (72 DPI - Web)</SelectItem>
                      <SelectItem value="ebook" className="font-bold">Media (150 DPI - Email)</SelectItem>
                      <SelectItem value="printer" className="font-bold">Alta (300 DPI - Impresión)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeTool.id === 'rotate' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Ángulo</label>
                    <Select value={rotateAngle} onValueChange={setRotateAngle}>
                      <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90" className="font-bold">90° Derecha</SelectItem>
                        <SelectItem value="180" className="font-bold">180° Invertir</SelectItem>
                        <SelectItem value="270" className="font-bold">90° Izquierda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Páginas (vacío = todas)</label>
                    <Input value={rotatePages} onChange={e => setRotatePages(e.target.value)} placeholder="Ej: 1, 3" className="h-12 rounded-xl" />
                  </div>
                </>
              )}
              {activeTool.id === 'crop' && (
                <div className="md:col-span-2 grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 text-center block">X0 (Left)</label>
                    <Input type="number" value={cropRect.x0} onChange={e => setCropRect({...cropRect, x0: parseInt(e.target.value)})} className="h-10 text-center" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 text-center block">Y0 (Bottom)</label>
                    <Input type="number" value={cropRect.y0} onChange={e => setCropRect({...cropRect, y0: parseInt(e.target.value)})} className="h-10 text-center" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 text-center block">X1 (Right)</label>
                    <Input type="number" value={cropRect.x1} onChange={e => setCropRect({...cropRect, x1: parseInt(e.target.value)})} className="h-10 text-center" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 text-center block">Y1 (Top)</label>
                    <Input type="number" value={cropRect.y1} onChange={e => setCropRect({...cropRect, y1: parseInt(e.target.value)})} className="h-10 text-center" />
                  </div>
                  <p className="col-span-4 text-[10px] text-slate-400 italic text-center font-medium">Dimensiones en puntos PDF (1pt = 0.35mm). A4 standard: 595 x 842 pt.</p>
                </div>
              )}
              {activeTool.id === 'add_page_numbers' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Posición</label>
                    <Select value={pageNumberPos} onValueChange={setPageNumberPos}>
                      <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-center" className="font-bold">Abajo Centro</SelectItem>
                        <SelectItem value="bottom-right" className="font-bold">Abajo Derecha</SelectItem>
                        <SelectItem value="top-center" className="font-bold">Arriba Centro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">N° Inicial</label>
                    <Input type="number" value={pageNumberStart} onChange={e => setPageNumberStart(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                </>
              )}
              {activeTool.id === 'watermark' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Texto</label>
                    <Input value={wmText} onChange={e => setWatermarkText(e.target.value)} className="h-12 rounded-xl font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Ángulo (°)</label>
                    <Input type="number" value={wmAngle} onChange={e => setWatermarkAngle(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                  <div className="md:col-span-2 space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Opacidad ({Math.round(wmOpacity[0] * 100)}%)</label>
                    </div>
                    <Slider value={wmOpacity} onValueChange={setWatermarkOpacity} min={0.1} max={1.0} step={0.05} />
                  </div>
                </>
              )}
              {activeTool.id === 'watermark_image' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Imagen (PNG/JPG)</label>
                    <DropZone 
                      className="min-h-[100px] p-4"
                      accept=".png,.jpg,.jpeg"
                      files={wmImage ? [wmImage] : []}
                      onFiles={(paths) => setWatermarkImage(getFileInfo(paths[0]))}
                      onRemove={() => setWatermarkImage(null)}
                    />
                  </div>
                  <div className="space-y-6 pt-4">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-400">Opacidad ({Math.round(wmOpacity[0] * 100)}%)</label>
                    </div>
                    <Slider value={wmOpacity} onValueChange={setWatermarkOpacity} min={0.1} max={1.0} step={0.05} />
                  </div>
                </>
              )}
              {activeTool.id === 'pdf_to_jpg' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Resolución (DPI)</label>
                  <Select value={dpi} onValueChange={setDpi}>
                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="72" className="font-bold">72 DPI (Web)</SelectItem>
                      <SelectItem value="150" className="font-bold">150 DPI (Recomendado)</SelectItem>
                      <SelectItem value="300" className="font-bold">300 DPI (Alta Calidad)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeTool.id === 'protect' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contraseña</label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-400">Confirmar</label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-12 rounded-xl" />
                  </div>
                </>
              )}
              {activeTool.id === 'unlock' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Contraseña Actual</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-xl" />
                </div>
              )}
              {activeTool.id === 'ocr' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Idioma Tesseract</label>
                  <Select value={ocrLang} onValueChange={setOcrLang}>
                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spa" className="font-bold">Español (spa)</SelectItem>
                      <SelectItem value="eng" className="font-bold">Inglés (eng)</SelectItem>
                      <SelectItem value="spa+eng" className="font-bold">Ambos (spa + eng)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="md:col-span-2 space-y-2 mt-4">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {['split', 'pdf_to_jpg'].includes(activeTool.id) ? 'Carpeta de destino' : 'Ruta de salida'}
                </label>
                <div className="flex gap-2">
                  <Input value={output} onChange={e => setOutput(e.target.value)} className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50" />
                  <Button variant="secondary" className="h-12 px-6 rounded-xl font-bold" onClick={async () => {
                    const path = ['split', 'pdf_to_jpg'].includes(activeTool.id) 
                      ? await (window as any).electronAPI.selectDirectory()
                      : await (window as any).electronAPI.selectFile();
                    if (path) setOutput(path);
                  }}>
                    <FolderOpen className="w-4 h-4 mr-2" /> Explorar
                  </Button>
                </div>
              </div>
            </div>

            <Button 
              className={cn("w-full h-16 rounded-2xl text-xl font-black shadow-lg transition-all active:scale-[0.98] group mt-6", activeTool.color, "hover:opacity-90")} 
              disabled={isProcessing || files.length === 0 || !output}
              onClick={handleActionRequest}
            >
              {isProcessing ? (
                <RefreshCw className="w-8 h-8 animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="group-hover:scale-110 transition-transform">{activeTool.icon}</span>
                  <span className="uppercase tracking-wider">{activeTool.name} AHORA</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Modal de Confirmación */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-black">¿Confirmas la operación?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p>Vas a <strong>{activeTool.name.toLowerCase()}</strong> el archivo:</p>
                <div className="p-4 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{files[0]?.name}</p>
                  <p className="text-xs text-slate-500 mt-1 uppercase tracking-tight">{files[0]?.path}</p>
                </div>
                {activeTool.id === 'delete_pages' && (
                  <p className="text-red-500 font-bold">Aviso: Se eliminarán permanentemente las páginas {deletePagesInput} de la copia resultante.</p>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction className={cn("rounded-xl font-bold text-white", activeTool.color)} onClick={executeAction}>
                Sí, continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // VISTA C: Resultado
  if (view === 'result' && activeTool && result) {
    return (
      <div className="max-w-4xl mx-auto space-y-12 animate-in zoom-in-95 duration-500 pb-20">
        <div className="text-center space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/20 animate-bounce">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white">{activeTool.name} completado</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mt-2">El archivo se ha procesado exitosamente</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button size="lg" className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg gap-3 shadow-xl" onClick={() => handleOpenFolder(result.path)}>
              <FolderOpen className="w-6 h-6" /> ABRIR CARPETA DE DESTINO
            </Button>
            <Button size="lg" variant="outline" className="h-14 px-8 rounded-2xl font-bold border-2 border-slate-200 dark:border-slate-800" onClick={() => setView('active')}>
              <RefreshCw className="w-5 h-5 mr-2" /> REPETIR OPERACIÓN
            </Button>
          </div>
        </div>

        <Separator className="opacity-50" />

        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <ArrowRight className="w-6 h-6 text-blue-500" /> ¿Qué quieres hacer ahora?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherTools.map(tool => (
              <Card 
                key={tool.id} 
                className="group cursor-pointer hover:border-blue-500/50 hover:shadow-lg transition-all border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40"
                onClick={() => resetToolState(tool)}
              >
                <CardContent className="p-6 space-y-3">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", tool.color)}>
                    {tool.icon}
                  </div>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">{tool.name}</h4>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="link" className="w-full text-slate-400 hover:text-blue-500 font-bold" onClick={() => setView('selector')}>
            Volver a todas las herramientas
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

// --- Component: DropZone ---
function DropZone({ multiple, onFiles, accept, files, onRemove, onReorder, className }: any) {
  const [isOver, setIsOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map(f => (f as any).path);
    if (droppedFiles.length > 0) onFiles(droppedFiles);
  }, [onFiles]);

  return (
    <div className="space-y-4 w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all duration-300 group cursor-pointer min-h-[240px]",
          isOver ? "border-blue-500 bg-blue-500/5 scale-[0.99]" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
          className
        )}
        onClick={async () => {
          const filters = accept ? [{ name: "Archivos", extensions: accept.replace(/\./g, '').split(',') }] : [];
          const path = await (window as any).electronAPI.selectFile(filters);
          if (path) onFiles([path]);
        }}
      >
        <div className={cn(
          "p-5 rounded-2xl bg-slate-100 dark:bg-slate-900 mb-4 transition-transform group-hover:scale-110",
          isOver && "bg-blue-500 text-white"
        )}>
          <Upload className={cn("w-10 h-10", isOver ? "text-white" : "text-slate-400")} />
        </div>
        <p className="text-lg font-bold text-slate-700 dark:text-slate-300 text-center">
          {isOver ? "¡Suéltalo ahora!" : <>Arrastra {multiple ? "tus archivos" : "un archivo"} aquí o <span className="text-blue-500 underline decoration-2 underline-offset-4">selecciona</span></>}
        </p>
        <p className="text-xs font-black text-slate-400 mt-2 uppercase tracking-[0.3em]">{accept}</p>
      </div>

      {files && files.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
            Seleccionados ({files.length})
          </label>
          <ScrollArea className={cn("w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10 p-2", multiple ? 'h-48' : 'h-auto')}>
            <div className="space-y-2">
              {files.map((file: FileInfo, idx: number) => (
                <div key={idx} className="group flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500 font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate text-slate-700 dark:text-slate-200">{file.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">{file.path}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {multiple && onReorder && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); onReorder(idx, -1); }}>
                          <ArrowUp className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" disabled={idx === files.length - 1} onClick={(e) => { e.stopPropagation(); onReorder(idx, 1); }}>
                          <ArrowDown className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-500/10" onClick={(e) => { e.stopPropagation(); onRemove(idx); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
