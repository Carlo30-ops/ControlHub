import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  FolderOpen, 
  RefreshCw,
  Files,
  FileStack,
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
  Layers,
  AlertTriangle,
  Cpu,
  Heart
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Separator } from "../../components/ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "../../components/ui/breadcrumb";
import { Switch } from "../../components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Slider } from "../../components/ui/slider";
import { FileDropZone } from "../../components/shared/FileDropZone";
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
  { id: 'merge', category: 'Organizar', name: 'Unir PDFs', desc: 'Combina varios archivos en uno solo', icon: <Files className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'split', category: 'Organizar', name: 'Dividir PDF', desc: 'Separa un PDF en varios archivos', icon: <Split className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'extract', category: 'Organizar', name: 'Extraer Páginas', desc: 'Obtén solo las páginas que necesitas', icon: <Scissors className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'delete_pages', category: 'Organizar', name: 'Eliminar Páginas', desc: 'Quita páginas específicas del documento', icon: <Eraser className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'reorder_pages', category: 'Organizar', name: 'Ordenar Páginas', desc: 'Cambia el orden de las hojas', icon: <ListOrdered className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  
  // Optimizar
  { id: 'compress', category: 'Optimizar', name: 'Comprimir', desc: 'Reduce el peso de tus archivos', icon: <Minimize2 className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'rotate', category: 'Optimizar', name: 'Rotar', desc: 'Gira las páginas de tus documentos', icon: <RotateCw className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'crop', category: 'Optimizar', name: 'Recortar', desc: 'Ajusta los márgenes del documento', icon: <Crop className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'repair', category: 'Optimizar', name: 'Reparar PDF', desc: 'Intenta recuperar archivos dañados', icon: <Wrench className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'add_page_numbers', category: 'Optimizar', name: 'Numerar Páginas', desc: 'Inserta números de página', icon: <Hash className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },

  // Contenido
  { id: 'watermark', category: 'Contenido', name: 'Marca de Agua Texto', desc: 'Añade texto de fondo', icon: <Type className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'watermark_image', category: 'Contenido', name: 'Marca de Agua Imagen', desc: 'Añade un logo de fondo', icon: <ImageIcon className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'jpg_to_pdf', category: 'Contenido', name: 'JPG a PDF', desc: 'Imágenes a documento PDF', icon: <ImagePlus className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.jpg,.jpeg,.png' },
  { id: 'pdf_to_jpg', category: 'Contenido', name: 'PDF a JPG', desc: 'Páginas a imágenes individuales', icon: <FileImage className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },
  { id: 'html_to_pdf', category: 'Contenido', name: 'HTML a PDF', desc: 'Web local a documento PDF', icon: <Globe className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.html' },

  // Seguridad
  { id: 'protect', category: 'Seguridad', name: 'Proteger PDF', desc: 'Cifra con contraseña', icon: <Lock className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'unlock', category: 'Seguridad', name: 'Desbloquear PDF', desc: 'Quita la contraseña', icon: <Unlock className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
  { id: 'ocr', category: 'Seguridad', name: 'OCR (Buscable)', desc: 'Reconocimiento de texto', icon: <Search className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf' },

  // Convertir
  { id: 'w2p', category: 'Convertir', name: 'Word a PDF', desc: 'Doc a PDF profesional', icon: <FileText className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.docx,.doc', newExt: '.pdf' },
  { id: 'p2w', category: 'Convertir', name: 'PDF a Word', desc: 'PDF a Doc editable', icon: <FileType className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pdf', newExt: '.docx' },
  { id: 'e2p', category: 'Convertir', name: 'Excel a PDF', desc: 'Xls a PDF', icon: <FileExcel className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.xlsx,.xls', newExt: '.pdf' },
  { id: 'pp2p', category: 'Convertir', name: 'PPT a PDF', desc: 'Ppt a PDF', icon: <Presentation className="w-5 h-5" />, color: 'bg-muted text-muted-foreground', accept: '.pptx,.ppt', newExt: '.pdf' },
];

export default function PDFTools() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'selector' | 'active' | 'queue' | 'result'>('selector');
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ 
    ok: boolean; 
    message?: string; 
    error?: string; 
    path?: string;
    warning?: string;
    pdf_profile?: string;
    engine?: string;
  } | null>(null);
  const [finalOutputPath, setFinalOutputPath] = useState("");

  // --- Common States ---
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [output, setOutput] = useState("");
  const [askBeforeSave, setAskBeforeSave] = useState(true);
  const [incomingFile, setIncomingFile] = useState<FileInfo | null>(null);
  const fileQueueRef = useRef<FileInfo[]>([]);
  const [, setQueueTick] = useState(0);
  const fileQueue = fileQueueRef.current;
  const [searchTerm, setSearchTerm] = useState('');

  const setQueueFiles = (nextFiles: FileInfo[]) => {
    fileQueueRef.current = nextFiles;
    setQueueTick((tick) => tick + 1);
  };

  const handleQueueReorder = (idx: number, dir: number) => {
    const next = [...fileQueueRef.current];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setQueueFiles(next);
  };

  const handleQueueRemove = (idx: number) => {
    const next = [...fileQueueRef.current];
    next.splice(idx, 1);
    setQueueFiles(next);
    if (next.length === 0) {
      setView('active');
    }
  };
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    window.electronAPI.security.syncActiveFiles(files.map(f => f.path));
    return () => {
      window.electronAPI.security.syncActiveFiles([]);
    };
  }, [files]);

  const filteredTools = useMemo(() => {
    return TOOLS.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.desc.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const stateRef = useRef({
    view,
    searchTerm,
    showConfirm,
    showDiscardConfirm,
    isProcessing,
    files,
    output,
    finalOutputPath,
    result,
    activeTool,
    filteredTools
  });

  useEffect(() => {
    stateRef.current = {
      view,
      searchTerm,
      showConfirm,
      showDiscardConfirm,
      isProcessing,
      files,
      output,
      finalOutputPath,
      result,
      activeTool,
      filteredTools
    };
  });

  useEffect(() => {
    if (view === 'selector' && searchRef.current) {
      searchRef.current.focus();
    }
  }, [view]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        view,
        searchTerm,
        showConfirm,
        showDiscardConfirm,
        isProcessing,
        files,
        output,
        finalOutputPath,
        result,
        activeTool,
        filteredTools
      } = stateRef.current;

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );

      // --- AlertDialog Confirmation override (when confirm dialog is open) ---
      if (showConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          executeAction(finalOutputPath);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowConfirm(false);
        }
        return;
      }

      if (showDiscardConfirm) {
        if (e.key === 'Enter') {
          e.preventDefault();
          setView('selector');
          setShowDiscardConfirm(false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowDiscardConfirm(false);
        }
        return;
      }

      // --- View-specific event handling ---
      if (view === 'selector') {
        if (e.key === 'Escape') {
          if (isInput && activeEl === searchRef.current) {
            e.preventDefault();
            setSearchTerm('');
            searchRef.current.blur();
          }
        } else if (e.key === 'Enter') {
          if (isInput && activeEl === searchRef.current && searchTerm.trim() !== '') {
            if (filteredTools.length > 0) {
              e.preventDefault();
              resetToolState(filteredTools[0]);
            }
          }
        }
        // TODO: Implement keyboard Arrow keys navigation (ArrowUp/ArrowDown/ArrowLeft/ArrowRight)
        // for navigating between filtered cards inside the grid.
      } else if (view === 'active' && activeTool) {
        if (e.key === 'Escape') {
          if (isInput) {
            e.preventDefault();
            (activeEl as HTMLElement).blur();
            return;
          }
          e.preventDefault();
          if (files.length > 0 || fileQueueRef.current.length > 0) {
            setShowDiscardConfirm(true);
          } else {
            setView('selector');
          }
        } else if (e.key === 'Enter') {
          if (isInput) {
            return; // Protect configurations inputs: Enter does not trigger execution
          }
          const isDisabled = isProcessing || files.length === 0 || !output;
          if (!isDisabled) {
            e.preventDefault();
            handleActionRequest();
          }
        }
      } else if (view === 'result' && activeTool && result) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setView('selector');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleOpenFolder(result.path);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Detect file coming from Reports via navigation
  useEffect(() => {
    if (location.state?.fileToProcess) {
      const path = location.state.fileToProcess;
      const fileInfo = getFileInfo(path);
      setIncomingFile(fileInfo);

      if (view === 'active' && activeTool) {
        // Tool already active, load directly
        const isMultiple = activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf';
        if (isMultiple) {
          setFiles(prev => {
            const exists = prev.some(f => f.path === fileInfo.path);
            return exists ? prev : [...prev, fileInfo];
          });
          toast.success(`Añadido a ${activeTool.name}`);
        } else {
          setFiles([fileInfo]);
          toast.success(`Cargado en ${activeTool.name}`);
          const base = path.substring(0, path.lastIndexOf('.'));
          if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
            setOutput(path.substring(0, path.lastIndexOf('\\')));
          } else {
            setOutput(`${base}${activeTool.newExt || '_procesado.pdf'}`);
          }
        }
        setIncomingFile(null);
      } else {
        // No active tool yet, just keep the file in incomingFile
        toast.success('Archivo listo. Selecciona una herramienta.');
      }
      // Clean navigation state so effect runs only once
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate, view, activeTool]);
  
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
  const [compressLevel, setCompressLevel] = useState("ebook");
  const [rotateAngle, setRotateAngle] = useState("90");
  const [rotatePages, setRotatePages] = useState("");

  // --- Helpers ---
  const getFileInfo = (path: string): FileInfo => ({
    path,
    name: path.split(/[\\/]/).pop() || "",
  });

// Helper to generate default output filename based on source file and tool
const smartOutputName = (srcFile: FileInfo, tool: ToolConfig): string => {
  const base = srcFile.path.substring(0, srcFile.path.lastIndexOf('.'));
  return `${base}${tool.newExt || '_procesado.pdf'}`;
};


  const handleOpenFolder = (path?: string) => {
    if (path) {
      const folder = path.substring(0, path.lastIndexOf("\\"));
      window.electronAPI.shell.openPath(folder || path);
    }
  };

  const resetToolState = (tool: ToolConfig | null) => {
    const file = incomingFile;
    setIncomingFile(null); // clear after using
    const initialFiles = file ? [file] : [];
    setFiles(initialFiles);
    setOutput('');
    if (initialFiles.length > 0 && tool) {
      const path = initialFiles[0].path;
      const base = path.substring(0, path.lastIndexOf('.'));
      if (tool.id === 'split' || tool.id === 'pdf_to_jpg') {
        setOutput(path.substring(0, path.lastIndexOf('\\')));
      } else {
        setOutput(`${base}${tool.newExt || '_procesado.pdf'}`);
      }
    }
    // Reset tool‑specific states
    setSplitRanges('');
    setExtractPages('');
    setDeletePagesInput('');
    setPageOrder([]);
    setCropRect({ x0: 0, y0: 0, x1: 595, y1: 842 });
    setPageNumberPos('bottom-center');
    setPageNumberStart('1');
    setWatermarkText('CONFIDENCIAL');
    setWatermarkOpacity([0.3]);
    setWatermarkAngle('45');
    setWatermarkImage(null);
    setDpi('150');
    setPassword('');
    setConfirmPassword('');
    setOcrLang('spa');
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

  const executeAction = async (providedOutput?: string) => {
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
      const api = window.electronAPI.pdfTools;
      const finalOutput = providedOutput || finalOutputPath; // prioritize provided param

      switch (activeTool.id) {
        case 'merge':
          res = await api.merge({ files: files.map(f => f.path), output: finalOutput });
          successMsg = "PDFs unidos correctamente";
          break;
        case 'split':
          res = await api.split({ input: files[0].path, output_dir: finalOutput, ranges: splitRanges });
          successMsg = "PDF dividido correctamente";
          break;
        case 'extract':
          res = await api.extract({ input: files[0].path, output: finalOutput, pages: extractPages });
          successMsg = "Páginas extraídas correctamente";
          break;
        case 'delete_pages':
          res = await api.deletePages({ input: files[0].path, output: finalOutput, pages: deletePagesInput });
          successMsg = "Páginas eliminadas correctamente";
          break;
        case 'reorder_pages':
          res = await api.reorderPages({ input: files[0].path, output: finalOutput, order: pageOrder });
          successMsg = "Orden de páginas actualizado";
          break;
        case 'compress':
          res = await api.compress({ input: files[0].path, output: finalOutput, level: compressLevel });
          successMsg = "PDF comprimido correctamente";
          break;
        case 'rotate':
          res = await api.rotate({ input: files[0].path, output: finalOutput, angle: parseInt(rotateAngle), pages: rotatePages });
          successMsg = "Páginas rotadas correctamente";
          break;
        case 'crop':
          res = await api.crop({ input: files[0].path, output: finalOutput, rect: [cropRect.x0, cropRect.y0, cropRect.x1, cropRect.y1] });
          successMsg = "PDF recortado correctamente";
          break;
        case 'repair':
          res = await api.repair({ input: files[0].path, output: finalOutput });
          successMsg = "PDF reparado";
          break;
        case 'add_page_numbers':
          res = await api.addPageNumbers({ input: files[0].path, output: finalOutput, position: pageNumberPos, start: parseInt(pageNumberStart) });
          successMsg = "Números de página insertados";
          break;
        case 'watermark':
          res = await api.watermark({ input: files[0].path, output: finalOutput, text: wmText, opacity: wmOpacity[0], angle: parseInt(wmAngle) });
          successMsg = "Marca de agua de texto añadida";
          break;
        case 'watermark_image':
          res = await api.watermarkImage({ input: files[0].path, output: finalOutput, image: wmImage?.path, opacity: wmOpacity[0] });
          successMsg = "Marca de agua de imagen añadida";
          break;
        case 'jpg_to_pdf':
          res = await api.jpgToPdf({ images: files.map(f => f.path), output: finalOutput });
          successMsg = "Imágenes convertidas a PDF";
          break;
        case 'pdf_to_jpg':
          res = await api.pdfToJpg({ input: files[0].path, output_dir: finalOutput, dpi: parseInt(dpi) });
          successMsg = "Páginas convertidas a JPG";
          break;
        case 'html_to_pdf':
          res = await api.htmlToPdf({ input: files[0].path, output: finalOutput });
          successMsg = "HTML convertido a PDF";
          break;
        case 'protect':
          res = await api.protect({ input: files[0].path, output: finalOutput, password });
          successMsg = "PDF protegido con contraseña";
          break;
        case 'unlock':
          res = await api.unlock({ input: files[0].path, output: finalOutput, password });
          successMsg = "Contraseña eliminada del PDF";
          break;
        case 'ocr':
          res = await api.ocr({ input: files[0].path, output: finalOutput, lang: ocrLang });
          successMsg = "OCR completado, el PDF ahora es buscable";
          break;
        case 'w2p': res = await api.wordToPdf({ input: files[0].path, output: finalOutput }); break;
        case 'p2w': res = await api.pdfToWord({ input: files[0].path, output: finalOutput }); break;
        case 'e2p': res = await api.excelToPdf({ input: files[0].path, output: finalOutput }); break;
        case 'pp2p': res = await api.pptToPdf({ input: files[0].path, output: finalOutput }); break;
      }

      if (res.ok) {
        setResult({
          ok: true,
          message: successMsg,
          path: res.output || (res.outputs && res.outputs[0]),
          warning: res.warning,
          pdf_profile: res.pdf_profile,
          engine: res.engine,
        });
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
      setFinalOutputPath("");
      }
  };

  // Cargar info del PDF para herramientas que lo necesiten
  useEffect(() => {
    if (activeTool?.id === 'reorder_pages' && files.length === 1) {
      const getMeta = async () => {
        const meta = await window.electronAPI.parsePdf(files[0].path, 1);
        if (meta && meta.numPages) {
          setPageOrder(Array.from({ length: meta.numPages }, (_, i) => i + 1));
        }
      };
      getMeta();
    }
    
    // Fix #3: Cargar dimensiones para el recorte
    if (activeTool?.id === 'crop' && files.length === 1) {
      const getInfo = async () => {
        const res = await window.electronAPI.pdfTools.getPageInfo({ input: files[0].path });
        if (res.ok && res.pages && res.pages.length > 0) {
          const p = res.pages[0];
          setCropRect({ x0: 0, y0: 0, x1: p.width, y1: p.height });
          toast.info(`Dimensiones detectadas: ${p.width}x${p.height} pts`);
        }
      };
      getInfo();
    }
  }, [activeTool, files]);

  const handleActionRequest = async () => {
  if (!activeTool) return;
  // If askBeforeSave is enabled, prompt for destination before any confirmation modal
  if (askBeforeSave) {
    const srcFile = files[0];
    const suggested = srcFile ? smartOutputName(srcFile, activeTool) : "resultado.pdf";
    // For tools that output a directory (split, pdf_to_jpg), select directory instead of file
    const isDir = activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg';
    if (isDir) {
      const dir = await window.electronAPI.selectDirectory();
      if (!dir) {
        return; // user cancelled
      }
      setFinalOutputPath(dir);
      executeAction(dir);
      return;
    }
    // Otherwise, select a file with appropriate extension
    const ext = (activeTool.newExt || "pdf").replace(/^\./, "");
    const result = await window.electronAPI.selectSavePath({
      defaultPath: suggested,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
    });
    if (!result) {
      return; // user cancelled save dialog
    }
    setFinalOutputPath(result);
    // Directly execute without confirmation modal
    executeAction(result);
    return;
  }
  // askBeforeSave is false: output holds only filename (or path if previously set)
  if (output && files[0]) {
    const srcDir = files[0].path.substring(0, files[0].path.lastIndexOf("\\"));
    const fullPath = `${srcDir}\\${output}`;
    setFinalOutputPath(fullPath);
  }
  if (activeTool?.needsConfirm) {
    setShowConfirm(true);
  } else {
    executeAction(finalOutputPath);
  }
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

    const displayedGroups = categoryOrder.reduce((acc, cat) => {
      const tools = filteredTools.filter(t => t.category === cat);
      if (tools.length) acc[cat] = tools;
      return acc;
    }, {} as Record<Category, ToolConfig[]>);

    return (
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">PDF Tools <Badge variant="outline" className="ml-2 border-primary/30 text-primary font-bold">V2.0</Badge></h1>
          <p className="text-muted-foreground font-medium text-base">22 herramientas profesionales de procesamiento local</p>
        </div>

        {/* Search bar */}
        <Input
          ref={searchRef}
          placeholder="Buscar herramienta..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="mb-4 w-full"
        />

        {incomingFile && !activeTool && (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary shadow-sm">
            <span className="mr-2">📄</span>
            <span>Archivo desde Reportes: <span className="font-semibold">{incomingFile.name}</span>. Elige una herramienta para continuar.</span>
          </div>
        )}

        {Object.entries(displayedGroups).map(([cat, tools]) => (
          <div key={cat} className="space-y-4">
            <div className="flex items-center gap-4">
              <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{cat}</h2>
              <Separator className="flex-1 opacity-20" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tools.map((tool) => (
                <Card 
                  key={tool.id} 
                  className="group cursor-pointer hover:border-primary/40 hover:bg-accent/5 transition-all duration-200 border-border bg-card rounded-lg overflow-hidden"
                  onClick={() => resetToolState(tool)}
                >
                  <CardContent className="p-4 flex items-start gap-4 h-full">
                    <div className={cn("p-2 rounded-lg bg-muted text-[#64748B] group-hover:bg-accent group-hover:text-foreground transition-colors shrink-0")}>
                      {tool.icon}
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{tool.name}</h3>
                      <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">{tool.desc}</p>
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

  // VISTA B: Cola de reordenación
  if (view === 'queue' && activeTool) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20 px-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => setView('active')}
        >
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>

        <Breadcrumb className="my-4">
          <BreadcrumbItem>
            <BreadcrumbLink href="/pdf-tools">PDF Tools</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{activeTool.name}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Reordenar cola</BreadcrumbPage>
          </BreadcrumbItem>
        </Breadcrumb>

        <div className="rounded-3xl border border-border bg-card p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Reordena tu cola de archivos</h2>
            <p className="text-sm text-muted-foreground">Arrastra varias entradas antes de procesarlas en secuencia. Usa los controles para ajustar el orden de procesamiento.</p>
          </div>

          <ScrollArea className="h-72 rounded-3xl border border-border bg-muted/10 p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {fileQueue.map((file, idx) => (
                <div key={file.path} className="relative rounded-xl border border-border bg-card overflow-hidden group cursor-default">
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden">
                    {thumbs[file.path] ? (
                      <img src={thumbs[file.path]} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>
                  <div className="p-2 text-[10px] font-bold truncate text-foreground">{file.name}</div>
                  <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded"
                      disabled={idx === 0}
                      onClick={(e) => { e.stopPropagation(); handleQueueReorder(idx, -1); }}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded"
                      disabled={idx === fileQueue.length - 1}
                      onClick={(e) => { e.stopPropagation(); handleQueueReorder(idx, 1); }}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded text-destructive hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); handleQueueRemove(idx); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Archivos en cola: <span className="font-semibold text-foreground">{fileQueue.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="h-12 px-5 rounded-lg bg-primary text-primary-foreground font-bold"
                onClick={() => {
                  if (fileQueue.length === 0) return;
                  setFiles([fileQueue[0]]);
                  setQueueFiles(fileQueue.slice(1));
                  setView('active');
                }}
              >
                Confirmar orden y continuar
              </Button>
              <Button
                variant="secondary"
                className="h-12 px-5 rounded-lg"
                onClick={() => {
                  setQueueFiles([]);
                  setView('active');
                }}
              >
                Cancelar cola
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA B: Herramienta Activa
  if (view === 'active' && activeTool) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20 px-4">
        {/* Botón Volver con confirmación */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (files.length > 0 || fileQueue.length > 0) {
              setShowDiscardConfirm(true);
            } else {
              setView('selector');
            }
          }}
        >
          <ChevronLeft className="w-4 h-4" /> Volver al selector
        </Button>

        {/* Breadcrumb de navegación */}
        <Breadcrumb className="my-4">
          <BreadcrumbItem>
            <BreadcrumbLink href="/pdf-tools">PDF Tools</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{activeTool.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </Breadcrumb>

        {/* Switch “Preguntar antes de descargar” */}
        <div className="flex items-center justify-end mb-2">
          <span className="text-sm font-medium mr-2">Preguntar antes de descargar</span>
          <Switch checked={askBeforeSave} onCheckedChange={setAskBeforeSave} />
        </div>

        <Card className="border-border bg-card shadow-sm rounded-lg overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border p-6 text-center">
            <div className={cn("mx-auto w-12 h-12 rounded-lg flex items-center justify-center bg-muted text-[#64748B] mb-3")}>
              {activeTool.icon}
            </div>
            <CardTitle className="text-2xl font-bold">{activeTool.name}</CardTitle>
            <CardDescription className="text-sm font-medium">{activeTool.desc}</CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            {/* DropZone Unificada */}
            <FileDropZone 
              multiple={activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf'}
              accept={activeTool.accept}
              files={files}
              onFiles={(newPaths: string[]) => {
                  const newFiles = newPaths.filter(Boolean).map(p => getFileInfo(p));
                  if (newFiles.length === 0) return;
                  if (activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf') {
                    setFiles(prev => [...prev, ...newFiles]);
                    if (!output) {
                      const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("\\"));
                      setOutput(`${base}\\Resultado_${Date.now()}${activeTool.newExt || '.pdf'}`);
                    }
                  } else if (newFiles.length > 1) {
                    setQueueFiles(newFiles);
                    const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("."));
                    if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
                      setOutput(newPaths[0].substring(0, newPaths[0].lastIndexOf("\\")));
                    } else {
                      setOutput(`${base}${activeTool.newExt || (activeTool.id === 'extract' ? '_extraido.pdf' : activeTool.id === 'delete_pages' ? '_editado.pdf' : activeTool.id === 'compress' ? '_comprimido.pdf' : activeTool.id === 'ocr' ? '_ocr.pdf' : '_procesado.pdf')}`);
                    }
                    setView('queue');
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
              onRemove={(idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx))}
              onReorder={handleReorder}
            />

            {/* Controles Específicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
              {activeTool.id === 'split' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rangos (ej: 1-3, 4-z)</label>
                  <Input value={splitRanges} onChange={e => setSplitRanges(e.target.value)} placeholder="Ej: 1-5, 6-10" className="h-10 rounded-md" />
                </div>
              )}
              {activeTool.id === 'extract' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Páginas a extraer</label>
                  <Input value={extractPages} onChange={e => setExtractPages(e.target.value)} placeholder="Ej: 1, 3, 5-8" className="h-10 rounded-md" />
                </div>
              )}
              {activeTool.id === 'delete_pages' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Páginas a eliminar</label>
                  <Input value={deletePagesInput} onChange={e => setDeletePagesInput(e.target.value)} placeholder="Ej: 2, 5" className="h-10 rounded-md border-destructive/30" />
                </div>
              )}
              {activeTool.id === 'reorder_pages' && pageOrder.length > 0 && (
                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                    Orden de páginas <span>{pageOrder.length} páginas detectadas</span>
                  </label>
                  <ScrollArea className="h-40 rounded-md border border-border bg-muted/20 p-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {pageOrder.map((page, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-card rounded border border-border group">
                          <span className="text-xs font-medium text-foreground">Hoja {page}</span>
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nivel de compresión</label>
                  <Select value={compressLevel} onValueChange={setCompressLevel}>
                    <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast" className="font-medium">Máxima Velocidad (Limpieza)</SelectItem>
                      <SelectItem value="screen" className="font-medium">Baja (72 DPI - Web)</SelectItem>
                      <SelectItem value="ebook" className="font-medium">Media (150 DPI - Email)</SelectItem>
                      <SelectItem value="printer" className="font-medium">Alta (300 DPI - Impresión)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeTool.id === 'rotate' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ángulo</label>
                    <Select value={rotateAngle} onValueChange={setRotateAngle}>
                      <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="90" className="font-medium">90° Derecha</SelectItem>
                        <SelectItem value="180" className="font-medium">180° Invertir</SelectItem>
                        <SelectItem value="270" className="font-medium">90° Izquierda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Páginas</label>
                    <Input value={rotatePages} onChange={e => setRotatePages(e.target.value)} placeholder="Vacío = todas" className="h-10 rounded-md" />
                  </div>
                </>
              )}
              {activeTool.id === 'crop' && (
                <div className="md:col-span-2 grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground text-center block">X0 (Left)</label>
                    <Input type="number" value={cropRect.x0} onChange={e => setCropRect({...cropRect, x0: parseInt(e.target.value)})} className="h-9 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground text-center block">Y0 (Bottom)</label>
                    <Input type="number" value={cropRect.y0} onChange={e => setCropRect({...cropRect, y0: parseInt(e.target.value)})} className="h-9 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground text-center block">X1 (Right)</label>
                    <Input type="number" value={cropRect.x1} onChange={e => setCropRect({...cropRect, x1: parseInt(e.target.value)})} className="h-9 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground text-center block">Y1 (Top)</label>
                    <Input type="number" value={cropRect.y1} onChange={e => setCropRect({...cropRect, y1: parseInt(e.target.value)})} className="h-9 text-center" />
                  </div>
                </div>
              )}
              {activeTool.id === 'add_page_numbers' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Posición</label>
                    <Select value={pageNumberPos} onValueChange={setPageNumberPos}>
                      <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-center" className="font-medium">Abajo Centro</SelectItem>
                        <SelectItem value="bottom-right" className="font-medium">Abajo Derecha</SelectItem>
                        <SelectItem value="top-center" className="font-medium">Arriba Centro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">N° Inicial</label>
                    <Input type="number" value={pageNumberStart} onChange={e => setPageNumberStart(e.target.value)} className="h-10 rounded-md" />
                  </div>
                </>
              )}
              {activeTool.id === 'watermark' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Texto</label>
                    <Input value={wmText} onChange={e => setWatermarkText(e.target.value)} className="h-10 rounded-md font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ángulo (°)</label>
                    <Input type="number" value={wmAngle} onChange={e => setWatermarkAngle(e.target.value)} className="h-10 rounded-md" />
                  </div>
                  <div className="md:col-span-2 space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Opacidad ({Math.round(wmOpacity[0] * 100)}%)</label>
                    </div>
                    <Slider value={wmOpacity} onValueChange={setWatermarkOpacity} min={0.1} max={1.0} step={0.05} />
                  </div>
                </>
              )}
              {activeTool.id === 'watermark_image' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Imagen (PNG/JPG)</label>
                    <FileDropZone 
                      className="min-h-[80px] p-2"
                      accept=".png,.jpg,.jpeg"
                      files={wmImage ? [wmImage] : []}
                      onFiles={(paths: string[]) => setWatermarkImage(getFileInfo(paths[0]))}
                      onRemove={() => setWatermarkImage(null)}
                    />
                  </div>
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Opacidad ({Math.round(wmOpacity[0] * 100)}%)</label>
                    </div>
                    <Slider value={wmOpacity} onValueChange={setWatermarkOpacity} min={0.1} max={1.0} step={0.05} />
                  </div>
                </>
              )}
              {activeTool.id === 'pdf_to_jpg' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Resolución (DPI)</label>
                  <Select value={dpi} onValueChange={setDpi}>
                    <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="72" className="font-medium">72 DPI (Web)</SelectItem>
                      <SelectItem value="150" className="font-medium">150 DPI (Email)</SelectItem>
                      <SelectItem value="300" className="font-medium">300 DPI (Calidad)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {activeTool.id === 'protect' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña</label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-10 rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confirmar</label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-10 rounded-md" />
                  </div>
                </>
              )}
              {activeTool.id === 'unlock' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contraseña Actual</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-10 rounded-md" />
                </div>
              )}
              {activeTool.id === 'ocr' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Idioma OCR</label>
                  <Select value={ocrLang} onValueChange={setOcrLang}>
                    <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spa" className="font-medium">Español (spa)</SelectItem>
                      <SelectItem value="eng" className="font-medium">Inglés (eng)</SelectItem>
                      <SelectItem value="spa+eng" className="font-medium">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {!askBeforeSave && (
                <div className="md:col-span-2 space-y-2 mt-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {['split', 'pdf_to_jpg'].includes(activeTool.id) ? 'Carpeta de destino' : 'Ruta de salida'}
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={output ? output.split('\\').pop() : ''}
                      onChange={e => setOutput(e.target.value)}
                      className="h-10 rounded-md bg-muted/20 border-border"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-10 px-4 rounded-md font-bold"
                      onClick={async () => {
                        const path = ['split', 'pdf_to_jpg'].includes(activeTool.id)
                          ? await window.electronAPI.selectDirectory()
                          : await window.electronAPI.selectFile();
                        if (path) setOutput(path);
                      }}
                    >
                      <FolderOpen className="w-4 h-4 mr-2" /> Explorar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Button 
              className={cn("w-full h-14 rounded-lg text-lg font-bold transition-all active:scale-[0.98] group mt-4 bg-primary text-primary-foreground hover:opacity-90")} 
              disabled={isProcessing || files.length === 0 || !output}
              onClick={handleActionRequest}
            >
              {isProcessing ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="group-hover:scale-110 transition-transform">{activeTool.icon}</span>
                  <span className="uppercase tracking-wide">EJECUTAR OPERACIÓN</span>
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Modal de Confirmación */}
        <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
          <AlertDialogContent className="rounded-lg border-border bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">¿Confirmas la operación?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                <p>Vas a <strong>{activeTool.name.toLowerCase()}</strong> el archivo:</p>
                <div className="p-3 bg-muted/30 rounded border border-border">
                  <p className="font-bold text-foreground truncate text-sm">{files[0]?.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-tight truncate">{files[0]?.path}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-md text-xs font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className={cn("rounded-md text-xs font-bold bg-primary text-primary-foreground")}
                onClick={() => executeAction(finalOutputPath)}
              >
                Sí, continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modal de Confirmación de Descarte */}
        <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
          <AlertDialogContent className="rounded-lg border-border bg-card">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold">¿Deseas volver?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4 pt-2">
                Hay archivos cargados. ¿Deseas volver y perder la cola actual?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel className="rounded-md text-xs font-bold">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="rounded-md text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setView('selector');
                  setShowDiscardConfirm(false);
                }}
              >
                Sí, volver
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
      <div className="max-w-3xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 pb-20 px-4">
        <div className="text-center space-y-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground">{activeTool.name} completado</h2>
            <p className="text-muted-foreground font-medium mt-1">El archivo se ha procesado exitosamente</p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button size="lg" className="h-12 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base gap-3" onClick={() => handleOpenFolder(result.path)}>
              <FolderOpen className="w-5 h-5" /> ABRIR CARPETA
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6 rounded-lg font-bold border-border" onClick={() => setView('active')}>
              <RefreshCw className="w-4 h-4 mr-2" /> REPETIR
            </Button>
          </div>
        </div>

        {/* Info de procesamiento */}
        {(result.warning || result.pdf_profile || result.engine) && (
          <div className="space-y-2">
            {result.warning && (
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm font-medium">{result.warning}</p>
              </div>
            )}
            {(result.pdf_profile || result.engine) && (
              <div className="flex flex-wrap gap-2 justify-center">
                {result.pdf_profile && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                    <FileText className="w-3 h-3" />
                    {result.pdf_profile}
                  </span>
                )}
                {result.engine && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
                    <Cpu className="w-3 h-3" />
                    {result.engine}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Banner para enviar a Terapias si el resultado es Word */}
        {result.path?.toLowerCase().endsWith('.docx') && (
          <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-4 duration-700">
            <div className="p-4 rounded-xl bg-primary/10 text-primary">
              <Heart className="w-8 h-8" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-lg font-bold text-foreground">¿Enviar a Terapias?</h4>
              <p className="text-sm text-muted-foreground font-medium">Hemos detectado que el resultado es un documento Word. Puedes enviarlo directamente al organizador de terapias.</p>
            </div>
            <Button 
              size="lg" 
              className="h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-3"
              onClick={() => navigate('/terapias', { state: { preloadedDoc: result.path } })}
            >
              ENVIAR A TERAPIAS <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        <Separator className="opacity-20" />

        <div className="space-y-6">
          <h3 className="text-lg font-bold text-foreground flex items-center gap-3">
            <ArrowRight className="w-5 h-5 text-primary" /> ¿Qué quieres hacer ahora?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {otherTools.map(tool => (
              <Card 
                key={tool.id} 
                className="group cursor-pointer hover:border-primary/40 hover:bg-accent/5 transition-all border-border bg-card rounded-lg"
                onClick={() => resetToolState(tool)}
              >
                <CardContent className="p-5 space-y-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-muted text-[#64748B] group-hover:text-primary transition-colors")}>
                    {tool.icon}
                  </div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{tool.name}</h4>
                </CardContent>
              </Card>
            ))}
          </div>
          <Button variant="link" className="w-full text-muted-foreground hover:text-primary font-bold text-xs" onClick={() => setView('selector')}>
            Volver a todas las herramientas
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
