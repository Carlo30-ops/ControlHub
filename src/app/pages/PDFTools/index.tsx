import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { executeTool } from "./tools/executeTool";
import { usePdfTool } from "./hooks/usePdfTool";
import { useFileQueue, FileInfo } from "./hooks/useFileQueue";
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
  Heart,
  Circle
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
import { PageThumbnails } from "./components/PageThumbnails";
import { DocumentGrid } from "./components/DocumentGrid";
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

// TODO: Refactor component logic to use these hooks (Phase 2 modularization).

// --- Types & Constants ---

interface QueuedFile extends FileInfo {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  outputPath?: string;
  errorMessage?: string;
  progress?: number; // 0-100
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
  { id: 'merge', category: 'Organizar', name: 'Unir PDFs', desc: 'Combina varios archivos en uno solo', icon: <Files className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'split', category: 'Organizar', name: 'Dividir PDF', desc: 'Separa un PDF en varios archivos', icon: <Split className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'extract', category: 'Organizar', name: 'Extraer Páginas', desc: 'Obtén solo las páginas que necesitas', icon: <Scissors className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'delete_pages', category: 'Organizar', name: 'Eliminar Páginas', desc: 'Quita páginas específicas del documento', icon: <Eraser className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'reorder_pages', category: 'Organizar', name: 'Ordenar Páginas', desc: 'Cambia el orden de las hojas', icon: <ListOrdered className="w-6 h-6" />, color: '', accept: '.pdf' },
  
  // Optimizar
  { id: 'compress', category: 'Optimizar', name: 'Comprimir', desc: 'Reduce el peso de tus archivos', icon: <Minimize2 className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'rotate', category: 'Optimizar', name: 'Rotar', desc: 'Gira las páginas de tus documentos', icon: <RotateCw className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'crop', category: 'Optimizar', name: 'Recortar', desc: 'Ajusta los márgenes del documento', icon: <Crop className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'repair', category: 'Optimizar', name: 'Reparar PDF', desc: 'Intenta recuperar archivos dañados', icon: <Wrench className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'add_page_numbers', category: 'Optimizar', name: 'Numerar Páginas', desc: 'Inserta números de página', icon: <Hash className="w-6 h-6" />, color: '', accept: '.pdf' },

  // Contenido
  { id: 'watermark', category: 'Contenido', name: 'Marca de Agua Texto', desc: 'Añade texto de fondo', icon: <Type className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'watermark_image', category: 'Contenido', name: 'Marca de Agua Imagen', desc: 'Añade un logo de fondo', icon: <ImageIcon className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'jpg_to_pdf', category: 'Contenido', name: 'JPG a PDF', desc: 'Imágenes a documento PDF', icon: <ImagePlus className="w-6 h-6" />, color: '', accept: '.jpg,.jpeg,.png' },
  { id: 'pdf_to_jpg', category: 'Contenido', name: 'PDF a JPG', desc: 'Páginas a imágenes individuales', icon: <FileImage className="w-6 h-6" />, color: '', accept: '.pdf' },
  { id: 'html_to_pdf', category: 'Contenido', name: 'HTML a PDF', desc: 'Web local a documento PDF', icon: <Globe className="w-6 h-6" />, color: '', accept: '.html' },

  // Seguridad
  { id: 'protect', category: 'Seguridad', name: 'Proteger PDF', desc: 'Cifra con contraseña', icon: <Lock className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'unlock', category: 'Seguridad', name: 'Desbloquear PDF', desc: 'Quita la contraseña', icon: <Unlock className="w-6 h-6" />, color: '', accept: '.pdf', needsConfirm: true },
  { id: 'ocr', category: 'Seguridad', name: 'OCR (Buscable)', desc: 'Reconocimiento de texto', icon: <Search className="w-6 h-6" />, color: '', accept: '.pdf' },

  // Convertir
  { id: 'w2p', category: 'Convertir', name: 'Word a PDF', desc: 'Doc a PDF profesional', icon: <FileText className="w-6 h-6" />, color: '', accept: '.docx,.doc', newExt: '.pdf' },
  { id: 'p2w', category: 'Convertir', name: 'PDF a Word', desc: 'PDF a Doc editable', icon: <FileType className="w-6 h-6" />, color: '', accept: '.pdf', newExt: '.docx' },
  { id: 'e2p', category: 'Convertir', name: 'Excel a PDF', desc: 'Xls a PDF', icon: <FileExcel className="w-6 h-6" />, color: '', accept: '.xlsx,.xls', newExt: '.pdf' },
  { id: 'pp2p', category: 'Convertir', name: 'PPT a PDF', desc: 'Ppt a PDF', icon: <Presentation className="w-6 h-6" />, color: '', accept: '.pptx,.ppt', newExt: '.pdf' },
];

export default function PDFTools() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<'selector' | 'active' | 'queue' | 'processing' | 'result'>('selector');
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [finalOutputPath, setFinalOutputPath] = useState("");

  // --- Common States ---
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [output, setOutput] = useState("");
  const [askBeforeSave, setAskBeforeSave] = useState(true);
  const [incomingFile, setIncomingFile] = useState<FileInfo | null>(null);

  // --- Hooks Integration ---
  const { fileQueueRef, setQueueFiles, handleQueueReorder, handleQueueRemove, fileQueue } = useFileQueue([]);
  const { isProcessing, result, execute } = usePdfTool();
  
  // --- Sequential Queue Processing States ---
  const [processingQueue, setProcessingQueue] = useState<QueuedFile[]>([]);
  const [processingStats, setProcessingStats] = useState({ 
    completed: 0, 
    failed: 0, 
    currentIndex: -1 
  });
  const processingRef = useRef<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // --- Sequential Processing Function ---
  const processQueueSequentially = async (queue: FileInfo[]) => {
    if (processingRef.current || !activeTool) return;
    processingRef.current = true;

    const queuedFiles: QueuedFile[] = queue.map((f, i) => ({
      ...f,
      id: `${i}-${f.path}`,
      status: 'pending' as const,
    }));
    
    setProcessingQueue(queuedFiles);
    setView('processing');
    setProcessingStats({ completed: 0, failed: 0, currentIndex: -1 });

    for (let i = 0; i < queuedFiles.length; i++) {
      const qFile = queuedFiles[i];
      
      // Update current processing file
      setProcessingQueue(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'processing' as const } : f
      ));
      setProcessingStats(prev => ({ ...prev, currentIndex: i }));

      try {
        // Prepare output path
        const base = qFile.path.substring(0, qFile.path.lastIndexOf('.'));
        let finalOutput = '';

        if (['split', 'pdf_to_jpg'].includes(activeTool.id)) {
          finalOutput = qFile.path.substring(0, qFile.path.lastIndexOf('\\'));
        } else if (activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf') {
          // Multi-file tools: use provided output from form
          finalOutput = output || `${base}${activeTool.newExt || '_procesado.pdf'}`;
        } else {
          // Single-file tools: create unique output per file
          finalOutput = `${base}${activeTool.newExt || '_procesado.pdf'}`;
          // Execute the operation using centralized executor
          const api = window.electronAPI.pdfTools;
          const execParams = {
            password,
            confirmPassword,
            splitRanges,
            extractPages,
            deletePagesInput,
            pageOrder,
            compressLevel: parseInt(compressLevel) || 1,
            rotateAngle,
            rotatePages,
            cropRect,
            pageNumberPos,
            pageNumberStart,
            wmText,
            wmOpacity,
            wmAngle,
            wmImage: wmImage ? { path: wmImage.path } : null,
            dpi,
            ocrLang,
            preserveBookmarks,
            renumberPages,
            namingPattern,
          };
          const { res, successMsg } = await executeTool(api, activeTool, [qFile], finalOutput, execParams);
          if (res?.ok) {
            setProcessingQueue(prev => prev.map((f, idx) => 
              idx === i ? {
                ...f,
                status: 'completed' as const,
                outputPath: res.output || (res.outputs && res.outputs[0]),
                progress: 100
              } : f
            ));
            setProcessingStats(prev => ({ ...prev, completed: prev.completed + 1 }));
            toast.success(`✓ ${qFile.name} procesado`);
          } else {
            setProcessingQueue(prev => prev.map((f, idx) => 
              idx === i ? {
                ...f,
                status: 'error' as const,
                errorMessage: res.error,
                progress: 0
              } : f
            ));
            setProcessingStats(prev => ({ ...prev, failed: prev.failed + 1 }));
            toast.error(`✗ ${qFile.name}: ${res.error}`);
          }
        }
      } catch (err: any) {
        setProcessingQueue(prev => prev.map((f, idx) => 
          idx === i ? { 
            ...f, 
            status: 'error' as const,
            errorMessage: err.message,
            progress: 0
          } : f
        ));
        setProcessingStats(prev => ({ ...prev, failed: prev.failed + 1 }));
        toast.error(`✗ ${qFile.name}: ${err.message}`);
      }
    }

    processingRef.current = false;
    setProcessingStats(prev => ({ ...prev, currentIndex: -1 }));
  };

  useEffect(() => {
    // syncActiveFiles no existe en window.electronAPI, se elimina la llamada para evitar crash.
    // window.electronAPI.security.syncActiveFiles(files.map(f => f.path));
    return () => {
      // window.electronAPI.security.syncActiveFiles([]);
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
    console.log('PDFTools useEffect location.state initial:', location.state);
    const navState = location.state as { fileToProcess?: string; filesToProcess?: string[]; preferredToolId?: ToolId } | null;
    const paths = navState?.filesToProcess?.length
      ? navState.filesToProcess
      : navState?.fileToProcess
      ? [navState.fileToProcess]
      : [];
    console.log('PDFTools useEffect computed paths:', paths);

    if (paths.length === 0) return;

    const validFiles = paths
      .map(getFileInfo)
      .filter(file => !!file.path);

    const preferredTool = navState?.preferredToolId
      ? TOOLS.find(tool => tool.id === navState.preferredToolId)
      : null;

    if (preferredTool) {
      if (validFiles.length > 1) {
        setQueueFiles(validFiles);
        setIncomingFile(null);
        resetToolState(preferredTool);
        setView('queue');
        toast.success(`Escaneo cargado en ${preferredTool.name} con ${validFiles.length} archivos.`);
      } else if (validFiles.length === 1) {
        setQueueFiles([]);
        setIncomingFile(validFiles[0]);
        resetToolState(preferredTool);
        setView('active');
        toast.success(`Archivo cargado en ${preferredTool.name}.`);
      }
    } else {
      if (validFiles.length > 1) {
        setIncomingFile(validFiles[0]);
        setQueueFiles(validFiles.slice(1));
        toast.success(`Archivos listos para PDF Tools. Selecciona una herramienta.`);
      } else if (validFiles.length === 1) {
        setIncomingFile(validFiles[0]);
        setQueueFiles([]);
        toast.success(`Archivo listo para PDF Tools. Selecciona una herramienta.`);
      }
    }

    navigate(location.pathname, { replace: true, state: {} });
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
  const [preserveBookmarks, setPreserveBookmarks] = useState(true);
  const [renumberPages, setRenumberPages] = useState(false);
  const [namingPattern, setNamingPattern] = useState("part");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [documentThumbnails, setDocumentThumbnails] = useState<Record<string, string>>({});
  const [documentMetadata, setDocumentMetadata] = useState<Record<string, { pageCount?: number }>>({});

  // Cargar miniaturas de documentos para merge
  useEffect(() => {
    if (activeTool?.id === 'merge' && files.length > 0) {
      const loadThumbnails = async () => {
        for (const file of files) {
          if (documentThumbnails[file.path]) continue;
          try {
            console.log('Loading thumbnail for:', file.path);
            const res = await window.electronAPI.pdfTools.pdfThumbnail({
              input: file.path,
              dpi: 100,
            });
            console.log('Thumbnail response:', res);
            if (res.ok && res.thumb_path) {
              const thumbName = res.thumb_path?.split(/[\\/]/).pop();
              console.log('Thumbnail name:', thumbName);
              if (thumbName) {
                const thumbUrl = `pdfthumb://${thumbName}`;
                console.log('Thumbnail URL:', thumbUrl);
                setDocumentThumbnails(prev => ({
                  ...prev,
                  [file.path]: thumbUrl,
                }));
                if (res.page_count) {
                  setDocumentMetadata(prev => ({
                    ...prev,
                    [file.path]: { pageCount: res.page_count }
                  }));
                }
              }
            }
          } catch (err) {
            console.error('Error loading thumbnail for', file.path, err);
          }
        }
      };
      loadThumbnails();
    }
  }, [activeTool?.id, files]);

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
    setSelectedPages(new Set());
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

    const extraParams = {
      password,
      confirmPassword,
      splitRanges,
      extractPages,
      deletePagesInput,
      pageOrder,
      compressLevel: parseInt(compressLevel) || 1,
      rotateAngle,
      rotatePages,
      cropRect,
      pageNumberPos,
      pageNumberStart,
      wmText,
      wmOpacity,
      wmAngle,
      wmImage: wmImage ? { path: wmImage.path } : null,
      dpi,
      ocrLang,
    };

    await execute(activeTool, files, providedOutput || finalOutputPath, extraParams);
    if (result?.ok) {
      setView('result');
    }
    setShowConfirm(false);
    setFinalOutputPath("");
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
  
  // Validación de tamaño de archivos (usando size de FileInfo si está disponible)
  const MAX_FILE_SIZE_MB = 50;
  for (const file of files) {
    if (file.size) {
      const sizeMB = parseFloat(file.size) / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB) {
        toast.warning(`Archivo grande: ${file.name} (${sizeMB.toFixed(1)} MB). La operación puede tardar más.`);
      }
    }
  }
  
  // If askBeforeSave is enabled, prompt for destination before any confirmation modal
  if (askBeforeSave) {
    const srcFile = files[0];
    const suggested = srcFile ? smartOutputName(srcFile, activeTool) : "resultado.pdf";
    // For tools that output a directory (split, pdf_to_jpg), select directory instead of file
    const isDir = activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg';
    if (isDir) {
      // For split, allow selecting a file to use as base name, then extract directory
      if (activeTool.id === 'split') {
        const ext = (activeTool.newExt || "pdf").replace(/^\./, "");
        const result = await window.electronAPI.selectSavePath({
          defaultPath: suggested,
          filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
        });
        if (!result) {
          return; // user cancelled save dialog
        }
        setFinalOutputPath(result);
        executeAction(result);
        return;
      }
      // For pdf_to_jpg, still select directory
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
                    <FileText className="w-10 h-10 text-muted-foreground" />
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

  // VISTA C: Herramienta Activa
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
            {/* DocumentGrid para merge, FileDropZone para otras herramientas */}
            {activeTool.id === 'merge' ? (
              <DocumentGrid
                documents={files.map((f) => ({
                  id: f.path,
                  name: f.name,
                  path: f.path,
                  thumbnail: documentThumbnails[f.path],
                  size: f.size,
                  pageCount: documentMetadata[f.path]?.pageCount
                }))}
                onAdd={async () => {
                  const filters = activeTool.accept ? [{ name: "Archivos", extensions: activeTool.accept.replace(/\./g, '').split(',') }] : [];
                  const paths = await window.electronAPI.selectFiles({ filters });
                  if (paths && paths.length > 0) {
                    const newFiles = paths.filter(Boolean).map(p => getFileInfo(p));
                    setFiles(prev => [...prev, ...newFiles]);
                    if (!output && paths[0]) {
                      const base = paths[0].substring(0, paths[0].lastIndexOf("\\"));
                      setOutput(`${base}\\Resultado_${Date.now()}.pdf`);
                    }
                  }
                }}
                onAddFiles={(paths) => {
                  const newFiles = paths.filter(Boolean).map(p => getFileInfo(p));
                  setFiles(prev => [...prev, ...newFiles]);
                  if (!output && paths[0]) {
                    const base = paths[0].substring(0, paths[0].lastIndexOf("\\"));
                    setOutput(`${base}\\Resultado_${Date.now()}.pdf`);
                  }
                }}
                onRemove={(id) => {
                  setFiles(prev => prev.filter(f => f.path !== id));
                }}
                onReorder={(fromIndex, toIndex) => {
                  console.log('onReorder called:', { fromIndex, toIndex });
                  setFiles(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(fromIndex, 1);
                    next.splice(toIndex, 0, moved);
                    console.log('Files reordered:', next.map(f => f.name));
                    return next;
                  });
                }}
                onSort={(direction) => {
                  setFiles(prev => {
                    const sorted = [...prev].sort((a, b) => {
                      const cmp = a.name.localeCompare(b.name);
                      return direction === 'asc' ? cmp : -cmp;
                    });
                    return sorted;
                  });
                }}
              />
            ) : (
              <FileDropZone 
                multiple={activeTool.id === 'jpg_to_pdf'}
                accept={activeTool.accept}
                files={files}
                onFiles={(newPaths: string[]) => {
                    const newFiles = newPaths.filter(Boolean).map(p => getFileInfo(p));
                    if (newFiles.length === 0) return;
                    if (activeTool.id === 'jpg_to_pdf') {
                      setFiles(prev => [...prev, ...newFiles]);
                      if (!output) {
                        const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("\\"));
                        setOutput(`${base}\\Resultado_${Date.now()}${activeTool.newExt || '.pdf'}`);
                      }
                    } else if (newFiles.length > 1) {
                      // Multiple files for single-file tool: start sequential processing
                      setQueueFiles(newFiles);
                      const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("."));
                      if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
                        setOutput(newPaths[0].substring(0, newPaths[0].lastIndexOf("\\")));
                      } else {
                        setOutput(`${base}${activeTool.newExt || (activeTool.id === 'extract' ? '_extraido.pdf' : activeTool.id === 'delete_pages' ? '_editado.pdf' : activeTool.id === 'compress' ? '_comprimido.pdf' : activeTool.id === 'ocr' ? '_ocr.pdf' : '_procesado.pdf')}`);
                      }
                      // Auto-start processing after a brief delay for UX
                      setTimeout(() => processQueueSequentially(newFiles), 500);
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
            )}

            {/* Controles Específicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
              {activeTool.id === 'merge' && (
                <>
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Switch 
                      checked={preserveBookmarks} 
                      onCheckedChange={setPreserveBookmarks}
                      id="preserve-bookmarks"
                    />
                    <div className="space-y-0.5">
                      <label htmlFor="preserve-bookmarks" className="text-sm font-medium cursor-pointer">Preservar marcadores</label>
                      <p className="text-xs text-muted-foreground">Mantiene los bookmarks de los PDFs originales</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 bg-muted/30 rounded-lg">
                    <Switch 
                      checked={renumberPages} 
                      onCheckedChange={setRenumberPages}
                      id="renumber-pages"
                    />
                    <div className="space-y-0.5">
                      <label htmlFor="renumber-pages" className="text-sm font-medium cursor-pointer">Renumerar páginas</label>
                      <p className="text-xs text-muted-foreground">Reinicia la numeración en cada archivo</p>
                    </div>
                  </div>
                </>
              )}
              {activeTool.id === 'split' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rangos (ej: 1-3, 4-z)</label>
                    <Input value={splitRanges} onChange={e => setSplitRanges(e.target.value)} placeholder="Ej: 1-5, 6-10" className="h-10 rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Patrón de nombres</label>
                    <Select value={namingPattern} onValueChange={setNamingPattern}>
                      <SelectTrigger className="h-10 rounded-md font-medium text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="part" className="font-medium">Part (part_1_1-3.pdf)</SelectItem>
                        <SelectItem value="range" className="font-medium">Range (split_1_to_3.pdf)</SelectItem>
                        <SelectItem value="custom" className="font-medium">Custom (split_001.pdf)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-3 col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selección visual de páginas</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPages(new Set());
                            setSplitRanges('');
                          }}
                          className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive"
                        >
                          Limpiar selección
                        </Button>
                      </div>
                      <PageThumbnails
                        filePath={files[0].path}
                        selectedPages={selectedPages}
                        onTogglePage={(pageNumber) => {
                          setSelectedPages(prev => {
                            const next = new Set(prev);
                            if (next.has(pageNumber)) {
                              next.delete(pageNumber);
                            } else {
                              next.add(pageNumber);
                            }
                            
                            // Convertir selección a formato de rangos automáticamente
                            const pages = Array.from(next).sort((a, b) => a - b);
                            if (pages.length === 0) {
                              setSplitRanges('');
                            } else {
                              const ranges: string[] = [];
                              let start = pages[0];
                              for (let i = 1; i < pages.length; i++) {
                                if (pages[i] !== pages[i-1] + 1) {
                                  ranges.push(start === pages[i-1] ? `${start}` : `${start}-${pages[i-1]}`);
                                  start = pages[i];
                                }
                              }
                              ranges.push(start === pages[pages.length-1] ? `${start}` : `${start}-${pages[pages.length-1]}`);
                              setSplitRanges(ranges.join(', '));
                            }
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              {activeTool.id === 'extract' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Páginas a extraer</label>
                    <Input value={extractPages} onChange={e => setExtractPages(e.target.value)} placeholder="Ej: 1, 3, 5-8" className="h-10 rounded-md" />
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selección visual</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const pages = Array.from(selectedPages).sort((a, b) => a - b);
                            setExtractPages(pages.join(', '));
                          }}
                        >
                          Aplicar selección
                        </Button>
                      </div>
                      <PageThumbnails
                        filePath={files[0].path}
                        selectedPages={selectedPages}
                        onTogglePage={(pageNumber) => {
                          setSelectedPages(prev => {
                            const next = new Set(prev);
                            if (next.has(pageNumber)) {
                              next.delete(pageNumber);
                            } else {
                              next.add(pageNumber);
                            }
                            return next;
                          });
                        }}
                      />
                    </div>
                  )}
                </>
              )}
              {activeTool.id === 'delete_pages' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Páginas a eliminar</label>
                    <Input value={deletePagesInput} onChange={e => setDeletePagesInput(e.target.value)} placeholder="Ej: 2, 5" className="h-10 rounded-md border-destructive/30" />
                  </div>
                  {files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selección visual</label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const pages = Array.from(selectedPages).sort((a, b) => a - b);
                            setDeletePagesInput(pages.join(', '));
                          }}
                        >
                          Aplicar selección
                        </Button>
                      </div>
                      <PageThumbnails
                        filePath={files[0].path}
                        selectedPages={selectedPages}
                        onTogglePage={(pageNumber) => {
                          setSelectedPages(prev => {
                            const next = new Set(prev);
                            if (next.has(pageNumber)) {
                              next.delete(pageNumber);
                            } else {
                              next.add(pageNumber);
                            }
                            return next;
                          });
                        }}
                        onDeletePage={(pageNumber) => {
                          const currentPages = deletePagesInput ? deletePagesInput.split(',').map(p => p.trim()) : [];
                          if (!currentPages.includes(pageNumber.toString())) {
                            currentPages.push(pageNumber.toString());
                            setDeletePagesInput(currentPages.join(', '));
                          }
                        }}
                        showActions={true}
                      />
                    </div>
                  )}
                </>
              )}
              {activeTool.id === 'reorder_pages' && pageOrder.length > 0 && (
                <div className="md:col-span-2 space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex justify-between">
                    Orden de páginas <span>{pageOrder.length} páginas detectadas</span>
                  </label>
                  {files.length > 0 && (
                    <PageThumbnails
                      filePath={files[0].path}
                      draggable={true}
                      onReorder={(fromIndex, toIndex) => {
                        const next = [...pageOrder];
                        const [moved] = next.splice(fromIndex, 1);
                        next.splice(toIndex, 0, moved);
                        setPageOrder(next);
                      }}
                    />
                  )}
                </div>
              )}
              {activeTool.id === 'compress' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nivel de compresión</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setCompressLevel('screen')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-center",
                        compressLevel === 'screen'
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-border hover:border-orange-300 bg-card"
                      )}
                    >
                      <div className="text-2xl mb-1">🔥</div>
                      <div className="font-bold text-sm">Máxima</div>
                      <div className="text-xs text-muted-foreground mt-1">Para web</div>
                    </button>
                    <button
                      onClick={() => setCompressLevel('ebook')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-center",
                        compressLevel === 'ebook'
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-border hover:border-orange-300 bg-card"
                      )}
                    >
                      <div className="text-2xl mb-1">⚖️</div>
                      <div className="font-bold text-sm">Recomendada</div>
                      <div className="text-xs text-muted-foreground mt-1">Balance ideal</div>
                    </button>
                    <button
                      onClick={() => setCompressLevel('printer')}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all text-center",
                        compressLevel === 'printer'
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-border hover:border-orange-300 bg-card"
                      )}
                    >
                      <div className="text-2xl mb-1">📄</div>
                      <div className="font-bold text-sm">Baja</div>
                      <div className="text-xs text-muted-foreground mt-1">Para imprimir</div>
                    </button>
                  </div>
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
                  {files.length > 0 && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rotación visual</label>
                      <PageThumbnails
                        filePath={files[0].path}
                        selectedPages={selectedPages}
                        onTogglePage={(pageNumber) => {
                          setSelectedPages(prev => {
                            const next = new Set(prev);
                            if (next.has(pageNumber)) {
                              next.delete(pageNumber);
                            } else {
                              next.add(pageNumber);
                            }
                            return next;
                          });
                        }}
                        onRotatePage={(pageNumber) => {
                          const currentPages = rotatePages ? rotatePages.split(',').map(p => p.trim()) : [];
                          if (!currentPages.includes(pageNumber.toString())) {
                            currentPages.push(pageNumber.toString());
                            setRotatePages(currentPages.join(', '));
                          }
                        }}
                        showActions={true}
                      />
                    </div>
                  )}
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
                    {activeTool.id === 'pdf_to_jpg' ? 'Carpeta de destino' : 'Ruta de salida'}
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
                        let path;
                        if (activeTool.id === 'split') {
                          const ext = (activeTool.newExt || "pdf").replace(/^\./, "");
                          const suggested = files[0] ? smartOutputName(files[0], activeTool) : "resultado.pdf";
                          path = await window.electronAPI.selectSavePath({
                            defaultPath: suggested,
                            filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
                          });
                        } else if (activeTool.id === 'pdf_to_jpg') {
                          path = await window.electronAPI.selectDirectory();
                        } else {
                          path = await window.electronAPI.selectFile();
                        }
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

  // VISTA C: Progreso de Cola Secuencial
  if (view === 'processing' && activeTool) {
    const progressPercent = processingQueue.length > 0 
      ? Math.round(((processingStats.completed + processingStats.failed) / processingQueue.length) * 100)
      : 0;

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4">
        <div className="rounded-3xl border border-border bg-card p-6 space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Procesando cola</h2>
            <p className="text-sm text-muted-foreground">{activeTool.name} — {processingStats.completed + processingStats.failed} de {processingQueue.length} archivos</p>
          </div>

          {/* Barra de progreso general */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-muted-foreground">Progreso general</span>
              <span className="text-foreground">{progressPercent}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Lista de archivos con estado */}
          <ScrollArea className="h-96 rounded-2xl border border-border bg-muted/10 p-3">
            <div className="space-y-2">
              {processingQueue.map((file, idx) => {
                const isCurrentFile = idx === processingStats.currentIndex;
                const statusIcon = 
                  file.status === 'pending' ? <Circle className="w-4 h-4 text-muted-foreground" /> :
                  file.status === 'processing' ? <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" /> :
                  file.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                  <AlertCircle className="w-4 h-4 text-destructive" />;

                return (
                  <div 
                    key={file.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      isCurrentFile ? "border-primary/50 bg-primary/5" : "border-border bg-card",
                      file.status === 'error' && "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1">{statusIcon}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate mt-1">{file.path}</p>
                        {file.errorMessage && (
                          <p className="text-[11px] text-destructive mt-2 line-clamp-2">{file.errorMessage}</p>
                        )}
                        {file.outputPath && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 truncate">✓ {file.outputPath.split('\\').pop()}</p>
                        )}
                      </div>
                      {file.status === 'completed' && file.outputPath && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={() => handleOpenFolder(file.outputPath)}
                          title="Abrir archivo"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Estadísticas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
              <div className="text-2xl font-bold text-emerald-600">{processingStats.completed}</div>
              <div className="text-[10px] font-semibold text-emerald-600/70 uppercase tracking-wide mt-1">Completados</div>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center">
              <div className="text-2xl font-bold text-destructive">{processingStats.failed}</div>
              <div className="text-[10px] font-semibold text-destructive/70 uppercase tracking-wide mt-1">Errores</div>
            </div>
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="text-2xl font-bold text-blue-600">{processingQueue.length - processingStats.completed - processingStats.failed}</div>
              <div className="text-[10px] font-semibold text-blue-600/70 uppercase tracking-wide mt-1">Pendientes</div>
            </div>
          </div>

          {/* Botones de acción */}
          {processingStats.currentIndex === -1 && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                className="flex-1 h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold"
                onClick={() => {
                  setView('active');
                  setProcessingQueue([]);
                  setQueueFiles([]);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> PROCESAR MÁS ARCHIVOS
              </Button>
              <Button
                variant="secondary"
                className="flex-1 h-12 px-6 rounded-lg"
                onClick={() => {
                  setView('selector');
                  setProcessingQueue([]);
                  setQueueFiles([]);
                  resetToolState(null);
                }}
              >
                VOLVER AL INICIO
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VISTA D: Resultado
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
