import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { executeTool } from "./tools/executeTool";
import { usePdfTool } from "./hooks/usePdfTool";
import { useFileQueue } from "./hooks/useFileQueue";
import { CheckCircle2, AlertCircle, FileText, FolderOpen, RefreshCw, Files, Split, Scissors, Minimize2, RotateCw, Trash2, ArrowUp, ArrowDown, FileType, FileJson as FileExcel, Presentation, ExternalLink, ChevronLeft, ArrowRight, Eraser, ListOrdered, Crop, Wrench, Hash, Type, Image as ImageIcon, ImagePlus, FileImage, Globe, Lock, Unlock, Search, AlertTriangle, Cpu, Heart, Circle } from "lucide-react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "../../components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "../../components/ui/utils";
const TOOLS = [
    // Organizar
    { id: 'merge', category: 'Organizar', name: 'Unir PDFs', desc: 'Combina varios archivos en uno solo', icon: _jsx(Files, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'split', category: 'Organizar', name: 'Dividir PDF', desc: 'Separa un PDF en varios archivos', icon: _jsx(Split, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'extract', category: 'Organizar', name: 'Extraer Páginas', desc: 'Obtén solo las páginas que necesitas', icon: _jsx(Scissors, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'delete_pages', category: 'Organizar', name: 'Eliminar Páginas', desc: 'Quita páginas específicas del documento', icon: _jsx(Eraser, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'reorder_pages', category: 'Organizar', name: 'Ordenar Páginas', desc: 'Cambia el orden de las hojas', icon: _jsx(ListOrdered, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    // Optimizar
    { id: 'compress', category: 'Optimizar', name: 'Comprimir', desc: 'Reduce el peso de tus archivos', icon: _jsx(Minimize2, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'rotate', category: 'Optimizar', name: 'Rotar', desc: 'Gira las páginas de tus documentos', icon: _jsx(RotateCw, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'crop', category: 'Optimizar', name: 'Recortar', desc: 'Ajusta los márgenes del documento', icon: _jsx(Crop, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'repair', category: 'Optimizar', name: 'Reparar PDF', desc: 'Intenta recuperar archivos dañados', icon: _jsx(Wrench, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'add_page_numbers', category: 'Optimizar', name: 'Numerar Páginas', desc: 'Inserta números de página', icon: _jsx(Hash, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    // Contenido
    { id: 'watermark', category: 'Contenido', name: 'Marca de Agua Texto', desc: 'Añade texto de fondo', icon: _jsx(Type, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'watermark_image', category: 'Contenido', name: 'Marca de Agua Imagen', desc: 'Añade un logo de fondo', icon: _jsx(ImageIcon, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'jpg_to_pdf', category: 'Contenido', name: 'JPG a PDF', desc: 'Imágenes a documento PDF', icon: _jsx(ImagePlus, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.jpg,.jpeg,.png' },
    { id: 'pdf_to_jpg', category: 'Contenido', name: 'PDF a JPG', desc: 'Páginas a imágenes individuales', icon: _jsx(FileImage, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    { id: 'html_to_pdf', category: 'Contenido', name: 'HTML a PDF', desc: 'Web local a documento PDF', icon: _jsx(Globe, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.html' },
    // Seguridad
    { id: 'protect', category: 'Seguridad', name: 'Proteger PDF', desc: 'Cifra con contraseña', icon: _jsx(Lock, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'unlock', category: 'Seguridad', name: 'Desbloquear PDF', desc: 'Quita la contraseña', icon: _jsx(Unlock, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', needsConfirm: true },
    { id: 'ocr', category: 'Seguridad', name: 'OCR (Buscable)', desc: 'Reconocimiento de texto', icon: _jsx(Search, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf' },
    // Convertir
    { id: 'w2p', category: 'Convertir', name: 'Word a PDF', desc: 'Doc a PDF profesional', icon: _jsx(FileText, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.docx,.doc', newExt: '.pdf' },
    { id: 'p2w', category: 'Convertir', name: 'PDF a Word', desc: 'PDF a Doc editable', icon: _jsx(FileType, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pdf', newExt: '.docx' },
    { id: 'e2p', category: 'Convertir', name: 'Excel a PDF', desc: 'Xls a PDF', icon: _jsx(FileExcel, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.xlsx,.xls', newExt: '.pdf' },
    { id: 'pp2p', category: 'Convertir', name: 'PPT a PDF', desc: 'Ppt a PDF', icon: _jsx(Presentation, { className: "w-5 h-5" }), color: 'bg-muted text-muted-foreground', accept: '.pptx,.ppt', newExt: '.pdf' },
];
export default function PDFTools() {
    const location = useLocation();
    const navigate = useNavigate();
    const [view, setView] = useState('selector');
    const [activeTool, setActiveTool] = useState(null);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [finalOutputPath, setFinalOutputPath] = useState("");
    // --- Common States ---
    const [files, setFiles] = useState([]);
    const [output, setOutput] = useState("");
    const [askBeforeSave, setAskBeforeSave] = useState(true);
    const [incomingFile, setIncomingFile] = useState(null);
    // --- Hooks Integration ---
    const { fileQueueRef, setQueueFiles, handleQueueReorder, handleQueueRemove, fileQueue } = useFileQueue([]);
    const { isProcessing, result, execute } = usePdfTool();
    // --- Sequential Queue Processing States ---
    const [processingQueue, setProcessingQueue] = useState([]);
    const [processingStats, setProcessingStats] = useState({
        completed: 0,
        failed: 0,
        currentIndex: -1
    });
    const processingRef = useRef(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchRef = useRef(null);
    // --- Sequential Processing Function ---
    const processQueueSequentially = async (queue) => {
        if (processingRef.current || !activeTool)
            return;
        processingRef.current = true;
        const queuedFiles = queue.map((f, i) => ({
            ...f,
            id: `${i}-${f.path}`,
            status: 'pending',
        }));
        setProcessingQueue(queuedFiles);
        setView('processing');
        setProcessingStats({ completed: 0, failed: 0, currentIndex: -1 });
        for (let i = 0; i < queuedFiles.length; i++) {
            const qFile = queuedFiles[i];
            // Update current processing file
            setProcessingQueue(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));
            setProcessingStats(prev => ({ ...prev, currentIndex: i }));
            try {
                // Prepare output path
                const base = qFile.path.substring(0, qFile.path.lastIndexOf('.'));
                let finalOutput = '';
                if (['split', 'pdf_to_jpg'].includes(activeTool.id)) {
                    finalOutput = qFile.path.substring(0, qFile.path.lastIndexOf('\\'));
                }
                else if (activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf') {
                    // Multi-file tools: use provided output from form
                    finalOutput = output || `${base}${activeTool.newExt || '_procesado.pdf'}`;
                }
                else {
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
                    };
                    const { res, successMsg } = await executeTool(api, activeTool, [qFile], finalOutput, execParams);
                    if (res?.ok) {
                        setProcessingQueue(prev => prev.map((f, idx) => idx === i ? {
                            ...f,
                            status: 'completed',
                            outputPath: res.output || (res.outputs && res.outputs[0]),
                            progress: 100
                        } : f));
                        setProcessingStats(prev => ({ ...prev, completed: prev.completed + 1 }));
                        toast.success(`✓ ${qFile.name} procesado`);
                    }
                    else {
                        setProcessingQueue(prev => prev.map((f, idx) => idx === i ? {
                            ...f,
                            status: 'error',
                            errorMessage: res.error,
                            progress: 0
                        } : f));
                        setProcessingStats(prev => ({ ...prev, failed: prev.failed + 1 }));
                        toast.error(`✗ ${qFile.name}: ${res.error}`);
                    }
                }
            }
            catch (err) {
                setProcessingQueue(prev => prev.map((f, idx) => idx === i ? {
                    ...f,
                    status: 'error',
                    errorMessage: err.message,
                    progress: 0
                } : f));
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
        return TOOLS.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.desc.toLowerCase().includes(searchTerm.toLowerCase()));
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
        const handleKeyDown = (e) => {
            const { view, searchTerm, showConfirm, showDiscardConfirm, isProcessing, files, output, finalOutputPath, result, activeTool, filteredTools } = stateRef.current;
            const activeEl = document.activeElement;
            const isInput = activeEl && (activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.isContentEditable);
            // --- AlertDialog Confirmation override (when confirm dialog is open) ---
            if (showConfirm) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    executeAction(finalOutputPath);
                }
                else if (e.key === 'Escape') {
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
                }
                else if (e.key === 'Escape') {
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
                }
                else if (e.key === 'Enter') {
                    if (isInput && activeEl === searchRef.current && searchTerm.trim() !== '') {
                        if (filteredTools.length > 0) {
                            e.preventDefault();
                            resetToolState(filteredTools[0]);
                        }
                    }
                }
                // TODO: Implement keyboard Arrow keys navigation (ArrowUp/ArrowDown/ArrowLeft/ArrowRight)
                // for navigating between filtered cards inside the grid.
            }
            else if (view === 'active' && activeTool) {
                if (e.key === 'Escape') {
                    if (isInput) {
                        e.preventDefault();
                        activeEl.blur();
                        return;
                    }
                    e.preventDefault();
                    if (files.length > 0 || fileQueueRef.current.length > 0) {
                        setShowDiscardConfirm(true);
                    }
                    else {
                        setView('selector');
                    }
                }
                else if (e.key === 'Enter') {
                    if (isInput) {
                        return; // Protect configurations inputs: Enter does not trigger execution
                    }
                    const isDisabled = isProcessing || files.length === 0 || !output;
                    if (!isDisabled) {
                        e.preventDefault();
                        handleActionRequest();
                    }
                }
            }
            else if (view === 'result' && activeTool && result) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    setView('selector');
                }
                else if (e.key === 'Enter') {
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
        const navState = location.state;
        const paths = navState?.filesToProcess?.length
            ? navState.filesToProcess
            : navState?.fileToProcess
                ? [navState.fileToProcess]
                : [];
        console.log('PDFTools useEffect computed paths:', paths);
        if (paths.length === 0)
            return;
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
            }
            else if (validFiles.length === 1) {
                setQueueFiles([]);
                setIncomingFile(validFiles[0]);
                resetToolState(preferredTool);
                setView('active');
                toast.success(`Archivo cargado en ${preferredTool.name}.`);
            }
        }
        else {
            if (validFiles.length > 1) {
                setIncomingFile(validFiles[0]);
                setQueueFiles(validFiles.slice(1));
                toast.success(`Archivos listos para PDF Tools. Selecciona una herramienta.`);
            }
            else if (validFiles.length === 1) {
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
    const [pageOrder, setPageOrder] = useState([]);
    const [cropRect, setCropRect] = useState({ x0: 0, y0: 0, x1: 595, y1: 842 }); // Default A4 approx in points
    const [pageNumberPos, setPageNumberPos] = useState("bottom-center");
    const [pageNumberStart, setPageNumberStart] = useState("1");
    const [wmText, setWatermarkText] = useState("CONFIDENCIAL");
    const [wmOpacity, setWatermarkOpacity] = useState([0.3]);
    const [wmAngle, setWatermarkAngle] = useState("45");
    const [wmImage, setWatermarkImage] = useState(null);
    const [dpi, setDpi] = useState("150");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [ocrLang, setOcrLang] = useState("spa");
    const [compressLevel, setCompressLevel] = useState("ebook");
    const [rotateAngle, setRotateAngle] = useState("90");
    const [rotatePages, setRotatePages] = useState("");
    // --- Helpers ---
    const getFileInfo = (path) => ({
        path,
        name: path.split(/[\\/]/).pop() || "",
    });
    // Helper to generate default output filename based on source file and tool
    const smartOutputName = (srcFile, tool) => {
        const base = srcFile.path.substring(0, srcFile.path.lastIndexOf('.'));
        return `${base}${tool.newExt || '_procesado.pdf'}`;
    };
    const handleOpenFolder = (path) => {
        if (path) {
            const folder = path.substring(0, path.lastIndexOf("\\"));
            window.electronAPI.shell.openPath(folder || path);
        }
    };
    const resetToolState = (tool) => {
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
            }
            else {
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
        setActiveTool(tool);
        if (tool)
            setView('active');
        else
            setView('selector');
    };
    // Reorder logic for multiple tools
    const handleReorder = (idx, dir) => {
        const next = [...files];
        const target = idx + dir;
        if (target < 0 || target >= next.length)
            return;
        [next[idx], next[target]] = [next[target], next[idx]];
        setFiles(next);
    };
    const executeAction = async (providedOutput) => {
        if (!activeTool)
            return;
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
        if (!activeTool)
            return;
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
        }
        else {
            executeAction(finalOutputPath);
        }
    };
    const otherTools = useMemo(() => TOOLS.filter(t => t.id !== activeTool?.id).sort(() => 0.5 - Math.random()).slice(0, 3), [activeTool]);
    // --- Views ---
    // VISTA A: Selector
    if (view === 'selector') {
        const grouped = TOOLS.reduce((acc, tool) => {
            if (!acc[tool.category])
                acc[tool.category] = [];
            acc[tool.category].push(tool);
            return acc;
        }, {});
        const categoryOrder = ['Organizar', 'Optimizar', 'Contenido', 'Seguridad', 'Convertir'];
        const displayedGroups = categoryOrder.reduce((acc, cat) => {
            const tools = filteredTools.filter(t => t.category === cat);
            if (tools.length)
                acc[cat] = tools;
            return acc;
        }, {});
        return (_jsxs("div", { className: "max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4", children: [_jsxs("div", { className: "space-y-1", children: [_jsxs("h1", { className: "text-3xl font-bold text-foreground tracking-tight", children: ["PDF Tools ", _jsx(Badge, { variant: "outline", className: "ml-2 border-primary/30 text-primary font-bold", children: "V2.0" })] }), _jsx("p", { className: "text-muted-foreground font-medium text-base", children: "22 herramientas profesionales de procesamiento local" })] }), _jsx(Input, { ref: searchRef, placeholder: "Buscar herramienta...", value: searchTerm, onChange: e => setSearchTerm(e.target.value), className: "mb-4 w-full" }), incomingFile && !activeTool && (_jsxs("div", { className: "mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary shadow-sm", children: [_jsx("span", { className: "mr-2", children: "\uD83D\uDCC4" }), _jsxs("span", { children: ["Archivo desde Reportes: ", _jsx("span", { className: "font-semibold", children: incomingFile.name }), ". Elige una herramienta para continuar."] })] })), Object.entries(displayedGroups).map(([cat, tools]) => (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("h2", { className: "text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground", children: cat }), _jsx(Separator, { className: "flex-1 opacity-20" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4", children: tools.map((tool) => (_jsx(Card, { className: "group cursor-pointer hover:border-primary/40 hover:bg-accent/5 transition-all duration-200 border-border bg-card rounded-lg overflow-hidden", onClick: () => resetToolState(tool), children: _jsxs(CardContent, { className: "p-4 flex items-start gap-4 h-full", children: [_jsx("div", { className: cn("p-2 rounded-lg bg-muted text-[#64748B] group-hover:bg-accent group-hover:text-foreground transition-colors shrink-0"), children: tool.icon }), _jsxs("div", { className: "space-y-0.5", children: [_jsx("h3", { className: "font-bold text-sm text-foreground group-hover:text-primary transition-colors", children: tool.name }), _jsx("p", { className: "text-[11px] text-muted-foreground leading-tight line-clamp-2", children: tool.desc })] })] }) }, tool.id))) })] }, cat)))] }));
    }
    // VISTA B: Cola de reordenación
    if (view === 'queue' && activeTool) {
        return (_jsxs("div", { className: "max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20 px-4", children: [_jsxs(Button, { variant: "ghost", size: "sm", className: "gap-2 text-muted-foreground hover:text-foreground", onClick: () => setView('active'), children: [_jsx(ChevronLeft, { className: "w-4 h-4" }), " Volver"] }), _jsxs(Breadcrumb, { className: "my-4", children: [_jsx(BreadcrumbItem, { children: _jsx(BreadcrumbLink, { href: "/pdf-tools", children: "PDF Tools" }) }), _jsx(BreadcrumbSeparator, {}), _jsx(BreadcrumbItem, { children: _jsx(BreadcrumbPage, { children: activeTool.name }) }), _jsx(BreadcrumbSeparator, {}), _jsx(BreadcrumbItem, { children: _jsx(BreadcrumbPage, { children: "Reordenar cola" }) })] }), _jsxs("div", { className: "rounded-3xl border border-border bg-card p-6 space-y-6", children: [_jsxs("div", { className: "space-y-2", children: [_jsx("h2", { className: "text-2xl font-bold text-foreground", children: "Reordena tu cola de archivos" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Arrastra varias entradas antes de procesarlas en secuencia. Usa los controles para ajustar el orden de procesamiento." })] }), _jsx(ScrollArea, { className: "h-72 rounded-3xl border border-border bg-muted/10 p-3", children: _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3", children: fileQueue.map((file, idx) => (_jsxs("div", { className: "relative rounded-xl border border-border bg-card overflow-hidden group cursor-default", children: [_jsx("div", { className: "aspect-[3/4] bg-muted flex items-center justify-center overflow-hidden", children: _jsx(FileText, { className: "w-10 h-10 text-muted-foreground" }) }), _jsx("div", { className: "p-2 text-[10px] font-bold truncate text-foreground", children: file.name }), _jsxs("div", { className: "absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded", disabled: idx === 0, onClick: (e) => { e.stopPropagation(); handleQueueReorder(idx, -1); }, children: _jsx(ArrowUp, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded", disabled: idx === fileQueue.length - 1, onClick: (e) => { e.stopPropagation(); handleQueueReorder(idx, 1); }, children: _jsx(ArrowDown, { className: "w-3.5 h-3.5" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-7 w-7 rounded text-destructive hover:bg-destructive/10", onClick: (e) => { e.stopPropagation(); handleQueueRemove(idx); }, children: _jsx(Trash2, { className: "w-3.5 h-3.5" }) })] })] }, file.path))) }) }), _jsxs("div", { className: "flex flex-col gap-3 md:flex-row md:items-center md:justify-between", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: ["Archivos en cola: ", _jsx("span", { className: "font-semibold text-foreground", children: fileQueue.length })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { className: "h-12 px-5 rounded-lg bg-primary text-primary-foreground font-bold", onClick: () => {
                                                if (fileQueue.length === 0)
                                                    return;
                                                setFiles([fileQueue[0]]);
                                                setQueueFiles(fileQueue.slice(1));
                                                setView('active');
                                            }, children: "Confirmar orden y continuar" }), _jsx(Button, { variant: "secondary", className: "h-12 px-5 rounded-lg", onClick: () => {
                                                setQueueFiles([]);
                                                setView('active');
                                            }, children: "Cancelar cola" })] })] })] })] }));
    }
    // VISTA C: Herramienta Activa
    if (view === 'active' && activeTool) {
        return (_jsxs("div", { className: "max-w-4xl mx-auto space-y-6 animate-in slide-in-from-left-4 duration-500 pb-20 px-4", children: [_jsxs(Button, { variant: "ghost", size: "sm", className: "gap-2 text-muted-foreground hover:text-foreground", onClick: () => {
                        if (files.length > 0 || fileQueue.length > 0) {
                            setShowDiscardConfirm(true);
                        }
                        else {
                            setView('selector');
                        }
                    }, children: [_jsx(ChevronLeft, { className: "w-4 h-4" }), " Volver al selector"] }), _jsxs(Breadcrumb, { className: "my-4", children: [_jsx(BreadcrumbItem, { children: _jsx(BreadcrumbLink, { href: "/pdf-tools", children: "PDF Tools" }) }), _jsx(BreadcrumbSeparator, {}), _jsx(BreadcrumbItem, { children: _jsx(BreadcrumbPage, { children: activeTool.name }) })] }), _jsxs("div", { className: "flex items-center justify-end mb-2", children: [_jsx("span", { className: "text-sm font-medium mr-2", children: "Preguntar antes de descargar" }), _jsx(Switch, { checked: askBeforeSave, onCheckedChange: setAskBeforeSave })] }), _jsxs(Card, { className: "border-border bg-card shadow-sm rounded-lg overflow-hidden", children: [_jsxs(CardHeader, { className: "bg-muted/30 border-b border-border p-6 text-center", children: [_jsx("div", { className: cn("mx-auto w-12 h-12 rounded-lg flex items-center justify-center bg-muted text-[#64748B] mb-3"), children: activeTool.icon }), _jsx(CardTitle, { className: "text-2xl font-bold", children: activeTool.name }), _jsx(CardDescription, { className: "text-sm font-medium", children: activeTool.desc })] }), _jsxs(CardContent, { className: "p-6 space-y-6", children: [_jsx(FileDropZone, { multiple: activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf', accept: activeTool.accept, files: files, onFiles: (newPaths) => {
                                        const newFiles = newPaths.filter(Boolean).map(p => getFileInfo(p));
                                        if (newFiles.length === 0)
                                            return;
                                        if (activeTool.id === 'merge' || activeTool.id === 'jpg_to_pdf') {
                                            setFiles(prev => [...prev, ...newFiles]);
                                            if (!output) {
                                                const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("\\"));
                                                setOutput(`${base}\\Resultado_${Date.now()}${activeTool.newExt || '.pdf'}`);
                                            }
                                        }
                                        else if (newFiles.length > 1) {
                                            // Multiple files for single-file tool: start sequential processing
                                            setQueueFiles(newFiles);
                                            const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("."));
                                            if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
                                                setOutput(newPaths[0].substring(0, newPaths[0].lastIndexOf("\\")));
                                            }
                                            else {
                                                setOutput(`${base}${activeTool.newExt || (activeTool.id === 'extract' ? '_extraido.pdf' : activeTool.id === 'delete_pages' ? '_editado.pdf' : activeTool.id === 'compress' ? '_comprimido.pdf' : activeTool.id === 'ocr' ? '_ocr.pdf' : '_procesado.pdf')}`);
                                            }
                                            // Auto-start processing after a brief delay for UX
                                            setTimeout(() => processQueueSequentially(newFiles), 500);
                                        }
                                        else {
                                            setFiles([newFiles[0]]);
                                            const base = newPaths[0].substring(0, newPaths[0].lastIndexOf("."));
                                            if (activeTool.id === 'split' || activeTool.id === 'pdf_to_jpg') {
                                                setOutput(newPaths[0].substring(0, newPaths[0].lastIndexOf("\\")));
                                            }
                                            else {
                                                setOutput(`${base}${activeTool.newExt || (activeTool.id === 'extract' ? '_extraido.pdf' : activeTool.id === 'delete_pages' ? '_editado.pdf' : activeTool.id === 'compress' ? '_comprimido.pdf' : activeTool.id === 'ocr' ? '_ocr.pdf' : '_procesado.pdf')}`);
                                            }
                                        }
                                    }, onRemove: (idx) => setFiles(prev => prev.filter((_, i) => i !== idx)), onReorder: handleReorder }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700", children: [activeTool.id === 'split' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Rangos (ej: 1-3, 4-z)" }), _jsx(Input, { value: splitRanges, onChange: e => setSplitRanges(e.target.value), placeholder: "Ej: 1-5, 6-10", className: "h-10 rounded-md" })] })), activeTool.id === 'extract' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "P\u00E1ginas a extraer" }), _jsx(Input, { value: extractPages, onChange: e => setExtractPages(e.target.value), placeholder: "Ej: 1, 3, 5-8", className: "h-10 rounded-md" })] })), activeTool.id === 'delete_pages' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "P\u00E1ginas a eliminar" }), _jsx(Input, { value: deletePagesInput, onChange: e => setDeletePagesInput(e.target.value), placeholder: "Ej: 2, 5", className: "h-10 rounded-md border-destructive/30" })] })), activeTool.id === 'reorder_pages' && pageOrder.length > 0 && (_jsxs("div", { className: "md:col-span-2 space-y-3", children: [_jsxs("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex justify-between", children: ["Orden de p\u00E1ginas ", _jsxs("span", { children: [pageOrder.length, " p\u00E1ginas detectadas"] })] }), _jsx(ScrollArea, { className: "h-40 rounded-md border border-border bg-muted/20 p-2", children: _jsx("div", { className: "grid grid-cols-2 sm:grid-cols-4 gap-2", children: pageOrder.map((page, idx) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-card rounded border border-border group", children: [_jsxs("span", { className: "text-xs font-medium text-foreground", children: ["Hoja ", page] }), _jsxs("div", { className: "flex gap-1", children: [_jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", disabled: idx === 0, onClick: () => {
                                                                                const next = [...pageOrder];
                                                                                [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
                                                                                setPageOrder(next);
                                                                            }, children: _jsx(ArrowUp, { className: "w-3 h-3" }) }), _jsx(Button, { variant: "ghost", size: "icon", className: "h-6 w-6", disabled: idx === pageOrder.length - 1, onClick: () => {
                                                                                const next = [...pageOrder];
                                                                                [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                                                                setPageOrder(next);
                                                                            }, children: _jsx(ArrowDown, { className: "w-3 h-3" }) })] })] }, idx))) }) })] })), activeTool.id === 'compress' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Nivel de compresi\u00F3n" }), _jsxs(Select, { value: compressLevel, onValueChange: setCompressLevel, children: [_jsx(SelectTrigger, { className: "h-10 rounded-md font-medium text-sm", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "fast", className: "font-medium", children: "M\u00E1xima Velocidad (Limpieza)" }), _jsx(SelectItem, { value: "screen", className: "font-medium", children: "Baja (72 DPI - Web)" }), _jsx(SelectItem, { value: "ebook", className: "font-medium", children: "Media (150 DPI - Email)" }), _jsx(SelectItem, { value: "printer", className: "font-medium", children: "Alta (300 DPI - Impresi\u00F3n)" })] })] })] })), activeTool.id === 'rotate' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "\u00C1ngulo" }), _jsxs(Select, { value: rotateAngle, onValueChange: setRotateAngle, children: [_jsx(SelectTrigger, { className: "h-10 rounded-md font-medium text-sm", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "90", className: "font-medium", children: "90\u00B0 Derecha" }), _jsx(SelectItem, { value: "180", className: "font-medium", children: "180\u00B0 Invertir" }), _jsx(SelectItem, { value: "270", className: "font-medium", children: "90\u00B0 Izquierda" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "P\u00E1ginas" }), _jsx(Input, { value: rotatePages, onChange: e => setRotatePages(e.target.value), placeholder: "Vac\u00EDo = todas", className: "h-10 rounded-md" })] })] })), activeTool.id === 'crop' && (_jsxs("div", { className: "md:col-span-2 grid grid-cols-4 gap-3", children: [_jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-[10px] font-bold uppercase text-muted-foreground text-center block", children: "X0 (Left)" }), _jsx(Input, { type: "number", value: cropRect.x0, onChange: e => setCropRect({ ...cropRect, x0: parseInt(e.target.value) }), className: "h-9 text-center" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-[10px] font-bold uppercase text-muted-foreground text-center block", children: "Y0 (Bottom)" }), _jsx(Input, { type: "number", value: cropRect.y0, onChange: e => setCropRect({ ...cropRect, y0: parseInt(e.target.value) }), className: "h-9 text-center" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-[10px] font-bold uppercase text-muted-foreground text-center block", children: "X1 (Right)" }), _jsx(Input, { type: "number", value: cropRect.x1, onChange: e => setCropRect({ ...cropRect, x1: parseInt(e.target.value) }), className: "h-9 text-center" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-[10px] font-bold uppercase text-muted-foreground text-center block", children: "Y1 (Top)" }), _jsx(Input, { type: "number", value: cropRect.y1, onChange: e => setCropRect({ ...cropRect, y1: parseInt(e.target.value) }), className: "h-9 text-center" })] })] })), activeTool.id === 'add_page_numbers' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Posici\u00F3n" }), _jsxs(Select, { value: pageNumberPos, onValueChange: setPageNumberPos, children: [_jsx(SelectTrigger, { className: "h-10 rounded-md font-medium text-sm", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "bottom-center", className: "font-medium", children: "Abajo Centro" }), _jsx(SelectItem, { value: "bottom-right", className: "font-medium", children: "Abajo Derecha" }), _jsx(SelectItem, { value: "top-center", className: "font-medium", children: "Arriba Centro" })] })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "N\u00B0 Inicial" }), _jsx(Input, { type: "number", value: pageNumberStart, onChange: e => setPageNumberStart(e.target.value), className: "h-10 rounded-md" })] })] })), activeTool.id === 'watermark' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Texto" }), _jsx(Input, { value: wmText, onChange: e => setWatermarkText(e.target.value), className: "h-10 rounded-md font-bold" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "\u00C1ngulo (\u00B0)" }), _jsx(Input, { type: "number", value: wmAngle, onChange: e => setWatermarkAngle(e.target.value), className: "h-10 rounded-md" })] }), _jsxs("div", { className: "md:col-span-2 space-y-3 pt-2", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsxs("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: ["Opacidad (", Math.round(wmOpacity[0] * 100), "%)"] }) }), _jsx(Slider, { value: wmOpacity, onValueChange: setWatermarkOpacity, min: 0.1, max: 1.0, step: 0.05 })] })] })), activeTool.id === 'watermark_image' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Imagen (PNG/JPG)" }), _jsx(FileDropZone, { className: "min-h-[80px] p-2", accept: ".png,.jpg,.jpeg", files: wmImage ? [wmImage] : [], onFiles: (paths) => setWatermarkImage(getFileInfo(paths[0])), onRemove: () => setWatermarkImage(null) })] }), _jsxs("div", { className: "space-y-3 pt-2", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsxs("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: ["Opacidad (", Math.round(wmOpacity[0] * 100), "%)"] }) }), _jsx(Slider, { value: wmOpacity, onValueChange: setWatermarkOpacity, min: 0.1, max: 1.0, step: 0.05 })] })] })), activeTool.id === 'pdf_to_jpg' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Resoluci\u00F3n (DPI)" }), _jsxs(Select, { value: dpi, onValueChange: setDpi, children: [_jsx(SelectTrigger, { className: "h-10 rounded-md font-medium text-sm", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "72", className: "font-medium", children: "72 DPI (Web)" }), _jsx(SelectItem, { value: "150", className: "font-medium", children: "150 DPI (Email)" }), _jsx(SelectItem, { value: "300", className: "font-medium", children: "300 DPI (Calidad)" })] })] })] })), activeTool.id === 'protect' && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Contrase\u00F1a" }), _jsx(Input, { type: "password", value: password, onChange: e => setPassword(e.target.value), className: "h-10 rounded-md" })] }), _jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Confirmar" }), _jsx(Input, { type: "password", value: confirmPassword, onChange: e => setConfirmPassword(e.target.value), className: "h-10 rounded-md" })] })] })), activeTool.id === 'unlock' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Contrase\u00F1a Actual" }), _jsx(Input, { type: "password", value: password, onChange: e => setPassword(e.target.value), className: "h-10 rounded-md" })] })), activeTool.id === 'ocr' && (_jsxs("div", { className: "space-y-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: "Idioma OCR" }), _jsxs(Select, { value: ocrLang, onValueChange: setOcrLang, children: [_jsx(SelectTrigger, { className: "h-10 rounded-md font-medium text-sm", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "spa", className: "font-medium", children: "Espa\u00F1ol (spa)" }), _jsx(SelectItem, { value: "eng", className: "font-medium", children: "Ingl\u00E9s (eng)" }), _jsx(SelectItem, { value: "spa+eng", className: "font-medium", children: "Ambos" })] })] })] })), !askBeforeSave && (_jsxs("div", { className: "md:col-span-2 space-y-2 mt-2", children: [_jsx("label", { className: "text-[10px] font-bold uppercase tracking-widest text-muted-foreground", children: ['split', 'pdf_to_jpg'].includes(activeTool.id) ? 'Carpeta de destino' : 'Ruta de salida' }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: output ? output.split('\\').pop() : '', onChange: e => setOutput(e.target.value), className: "h-10 rounded-md bg-muted/20 border-border" }), _jsxs(Button, { variant: "secondary", size: "sm", className: "h-10 px-4 rounded-md font-bold", onClick: async () => {
                                                                const path = ['split', 'pdf_to_jpg'].includes(activeTool.id)
                                                                    ? await window.electronAPI.selectDirectory()
                                                                    : await window.electronAPI.selectFile();
                                                                if (path)
                                                                    setOutput(path);
                                                            }, children: [_jsx(FolderOpen, { className: "w-4 h-4 mr-2" }), " Explorar"] })] })] }))] }), _jsx(Button, { className: cn("w-full h-14 rounded-lg text-lg font-bold transition-all active:scale-[0.98] group mt-4 bg-primary text-primary-foreground hover:opacity-90"), disabled: isProcessing || files.length === 0 || !output, onClick: handleActionRequest, children: isProcessing ? (_jsx(RefreshCw, { className: "w-6 h-6 animate-spin" })) : (_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("span", { className: "group-hover:scale-110 transition-transform", children: activeTool.icon }), _jsx("span", { className: "uppercase tracking-wide", children: "EJECUTAR OPERACI\u00D3N" })] })) })] })] }), _jsx(AlertDialog, { open: showConfirm, onOpenChange: setShowConfirm, children: _jsxs(AlertDialogContent, { className: "rounded-lg border-border bg-card", children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { className: "text-xl font-bold", children: "\u00BFConfirmas la operaci\u00F3n?" }), _jsxs(AlertDialogDescription, { className: "space-y-4 pt-2", children: [_jsxs("p", { children: ["Vas a ", _jsx("strong", { children: activeTool.name.toLowerCase() }), " el archivo:"] }), _jsxs("div", { className: "p-3 bg-muted/30 rounded border border-border", children: [_jsx("p", { className: "font-bold text-foreground truncate text-sm", children: files[0]?.name }), _jsx("p", { className: "text-[10px] text-muted-foreground mt-0.5 uppercase tracking-tight truncate", children: files[0]?.path })] })] })] }), _jsxs(AlertDialogFooter, { className: "gap-2", children: [_jsx(AlertDialogCancel, { className: "rounded-md text-xs font-bold", children: "Cancelar" }), _jsx(AlertDialogAction, { className: cn("rounded-md text-xs font-bold bg-primary text-primary-foreground"), onClick: () => executeAction(finalOutputPath), children: "S\u00ED, continuar" })] })] }) }), _jsx(AlertDialog, { open: showDiscardConfirm, onOpenChange: setShowDiscardConfirm, children: _jsxs(AlertDialogContent, { className: "rounded-lg border-border bg-card", children: [_jsxs(AlertDialogHeader, { children: [_jsx(AlertDialogTitle, { className: "text-xl font-bold", children: "\u00BFDeseas volver?" }), _jsx(AlertDialogDescription, { className: "space-y-4 pt-2", children: "Hay archivos cargados. \u00BFDeseas volver y perder la cola actual?" })] }), _jsxs(AlertDialogFooter, { className: "gap-2", children: [_jsx(AlertDialogCancel, { className: "rounded-md text-xs font-bold", children: "Cancelar" }), _jsx(AlertDialogAction, { className: "rounded-md text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90", onClick: () => {
                                            setView('selector');
                                            setShowDiscardConfirm(false);
                                        }, children: "S\u00ED, volver" })] })] }) })] }));
    }
    // VISTA C: Progreso de Cola Secuencial
    if (view === 'processing' && activeTool) {
        const progressPercent = processingQueue.length > 0
            ? Math.round(((processingStats.completed + processingStats.failed) / processingQueue.length) * 100)
            : 0;
        return (_jsx("div", { className: "max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20 px-4", children: _jsxs("div", { className: "rounded-3xl border border-border bg-card p-6 space-y-6", children: [_jsxs("div", { className: "text-center space-y-4", children: [_jsx("h2", { className: "text-2xl font-bold text-foreground", children: "Procesando cola" }), _jsxs("p", { className: "text-sm text-muted-foreground", children: [activeTool.name, " \u2014 ", processingStats.completed + processingStats.failed, " de ", processingQueue.length, " archivos"] })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center text-xs font-semibold", children: [_jsx("span", { className: "text-muted-foreground", children: "Progreso general" }), _jsxs("span", { className: "text-foreground", children: [progressPercent, "%"] })] }), _jsx("div", { className: "w-full h-3 rounded-full bg-muted overflow-hidden", children: _jsx("div", { className: "h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-300", style: { width: `${progressPercent}%` } }) })] }), _jsx(ScrollArea, { className: "h-96 rounded-2xl border border-border bg-muted/10 p-3", children: _jsx("div", { className: "space-y-2", children: processingQueue.map((file, idx) => {
                                const isCurrentFile = idx === processingStats.currentIndex;
                                const statusIcon = file.status === 'pending' ? _jsx(Circle, { className: "w-4 h-4 text-muted-foreground" }) :
                                    file.status === 'processing' ? _jsx(RefreshCw, { className: "w-4 h-4 text-blue-500 animate-spin" }) :
                                        file.status === 'completed' ? _jsx(CheckCircle2, { className: "w-4 h-4 text-emerald-500" }) :
                                            _jsx(AlertCircle, { className: "w-4 h-4 text-destructive" });
                                return (_jsx("div", { className: cn("p-4 rounded-xl border transition-all", isCurrentFile ? "border-primary/50 bg-primary/5" : "border-border bg-card", file.status === 'error' && "border-destructive/30 bg-destructive/5"), children: _jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "pt-1", children: statusIcon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-foreground truncate", children: file.name }), _jsx("p", { className: "text-[11px] text-muted-foreground truncate mt-1", children: file.path }), file.errorMessage && (_jsx("p", { className: "text-[11px] text-destructive mt-2 line-clamp-2", children: file.errorMessage })), file.outputPath && (_jsxs("p", { className: "text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 truncate", children: ["\u2713 ", file.outputPath.split('\\').pop()] }))] }), file.status === 'completed' && file.outputPath && (_jsx(Button, { variant: "ghost", size: "icon", className: "h-8 w-8 text-muted-foreground hover:text-foreground shrink-0", onClick: () => handleOpenFolder(file.outputPath), title: "Abrir archivo", children: _jsx(ExternalLink, { className: "w-4 h-4" }) }))] }) }, file.id));
                            }) }) }), _jsxs("div", { className: "grid grid-cols-3 gap-3", children: [_jsxs("div", { className: "p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-emerald-600", children: processingStats.completed }), _jsx("div", { className: "text-[10px] font-semibold text-emerald-600/70 uppercase tracking-wide mt-1", children: "Completados" })] }), _jsxs("div", { className: "p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-destructive", children: processingStats.failed }), _jsx("div", { className: "text-[10px] font-semibold text-destructive/70 uppercase tracking-wide mt-1", children: "Errores" })] }), _jsxs("div", { className: "p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center", children: [_jsx("div", { className: "text-2xl font-bold text-blue-600", children: processingQueue.length - processingStats.completed - processingStats.failed }), _jsx("div", { className: "text-[10px] font-semibold text-blue-600/70 uppercase tracking-wide mt-1", children: "Pendientes" })] })] }), processingStats.currentIndex === -1 && (_jsxs("div", { className: "flex flex-col sm:flex-row gap-3 pt-4", children: [_jsxs(Button, { className: "flex-1 h-12 px-6 rounded-lg bg-primary text-primary-foreground font-bold", onClick: () => {
                                    setView('active');
                                    setProcessingQueue([]);
                                    setQueueFiles([]);
                                }, children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), " PROCESAR M\u00C1S ARCHIVOS"] }), _jsx(Button, { variant: "secondary", className: "flex-1 h-12 px-6 rounded-lg", onClick: () => {
                                    setView('selector');
                                    setProcessingQueue([]);
                                    setQueueFiles([]);
                                    resetToolState(null);
                                }, children: "VOLVER AL INICIO" })] }))] }) }));
    }
    // VISTA D: Resultado
    if (view === 'result' && activeTool && result) {
        return (_jsxs("div", { className: "max-w-3xl mx-auto space-y-10 animate-in zoom-in-95 duration-500 pb-20 px-4", children: [_jsxs("div", { className: "text-center space-y-6", children: [_jsx("div", { className: "mx-auto w-20 h-20 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-sm", children: _jsx(CheckCircle2, { className: "w-10 h-10" }) }), _jsxs("div", { children: [_jsxs("h2", { className: "text-3xl font-bold text-foreground", children: [activeTool.name, " completado"] }), _jsx("p", { className: "text-muted-foreground font-medium mt-1", children: "El archivo se ha procesado exitosamente" })] }), _jsxs("div", { className: "flex flex-col sm:flex-row justify-center gap-3", children: [_jsxs(Button, { size: "lg", className: "h-12 px-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base gap-3", onClick: () => handleOpenFolder(result.path), children: [_jsx(FolderOpen, { className: "w-5 h-5" }), " ABRIR CARPETA"] }), _jsxs(Button, { size: "lg", variant: "outline", className: "h-12 px-6 rounded-lg font-bold border-border", onClick: () => setView('active'), children: [_jsx(RefreshCw, { className: "w-4 h-4 mr-2" }), " REPETIR"] })] })] }), (result.warning || result.pdf_profile || result.engine) && (_jsxs("div", { className: "space-y-2", children: [result.warning && (_jsxs("div", { className: "flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400", children: [_jsx(AlertTriangle, { className: "w-4 h-4 mt-0.5 shrink-0" }), _jsx("p", { className: "text-sm font-medium", children: result.warning })] })), (result.pdf_profile || result.engine) && (_jsxs("div", { className: "flex flex-wrap gap-2 justify-center", children: [result.pdf_profile && (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border", children: [_jsx(FileText, { className: "w-3 h-3" }), result.pdf_profile] })), result.engine && (_jsxs("span", { className: "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border", children: [_jsx(Cpu, { className: "w-3 h-3" }), result.engine] }))] }))] })), result.path?.toLowerCase().endsWith('.docx') && (_jsxs("div", { className: "p-6 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-bottom-4 duration-700", children: [_jsx("div", { className: "p-4 rounded-xl bg-primary/10 text-primary", children: _jsx(Heart, { className: "w-8 h-8" }) }), _jsxs("div", { className: "flex-1 text-center md:text-left", children: [_jsx("h4", { className: "text-lg font-bold text-foreground", children: "\u00BFEnviar a Terapias?" }), _jsx("p", { className: "text-sm text-muted-foreground font-medium", children: "Hemos detectado que el resultado es un documento Word. Puedes enviarlo directamente al organizador de terapias." })] }), _jsxs(Button, { size: "lg", className: "h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-3", onClick: () => navigate('/terapias', { state: { preloadedDoc: result.path } }), children: ["ENVIAR A TERAPIAS ", _jsx(ArrowRight, { className: "w-4 h-4" })] })] })), _jsx(Separator, { className: "opacity-20" }), _jsxs("div", { className: "space-y-6", children: [_jsxs("h3", { className: "text-lg font-bold text-foreground flex items-center gap-3", children: [_jsx(ArrowRight, { className: "w-5 h-5 text-primary" }), " \u00BFQu\u00E9 quieres hacer ahora?"] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4", children: otherTools.map(tool => (_jsx(Card, { className: "group cursor-pointer hover:border-primary/40 hover:bg-accent/5 transition-all border-border bg-card rounded-lg", onClick: () => resetToolState(tool), children: _jsxs(CardContent, { className: "p-5 space-y-3", children: [_jsx("div", { className: cn("w-9 h-9 rounded-lg flex items-center justify-center bg-muted text-[#64748B] group-hover:text-primary transition-colors"), children: tool.icon }), _jsx("h4", { className: "font-bold text-sm text-foreground group-hover:text-primary transition-colors", children: tool.name })] }) }, tool.id))) }), _jsx(Button, { variant: "link", className: "w-full text-muted-foreground hover:text-primary font-bold text-xs", onClick: () => setView('selector'), children: "Volver a todas las herramientas" })] })] }));
    }
    return null;
}
