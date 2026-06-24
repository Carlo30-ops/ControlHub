import { useState, useMemo, useEffect } from "react";
import { useData } from "../contexts/DataContext";
import { useNavigate } from "react-router";
import {
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  X,
  FileBadge,
  DollarSign,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  FileImage,
  Copy,
  Eye,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  LayoutGrid,
  Clock,
  FolderOpen,
  FileStack
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "../components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { format as formatDate } from "date-fns";
import { es } from "date-fns/locale";
import { Invoice } from "../../shared/types";
import { exportDataAsExcel } from "../utils/excelWrapper";
import { cn } from "../components/ui/utils";

const MONTHS_ORDER = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type SortKey = "invoiceNumber" | "company" | "month" | "year" | "amount" | "day";
type SortDir = "asc" | "desc";

function formatCOP(value: number): string {
  if (!value || value === 0) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
  }).format(value);
}

function getDayFromDate(date: string): number {
  const parts = date.split("/");
  return parts.length === 3 ? parseInt(parts[0], 10) || 0 : 0;
}

function buildCSV(invoices: Invoice[], columns: any): string {
  const headers = [];
  if (columns.invoiceNumber) headers.push("N° Factura");
  if (columns.company) headers.push("Compañía");
  headers.push("Día", "Mes", "Año", "Fecha");
  if (columns.detail) headers.push("Detalle");
  if (columns.amount) headers.push("Monto");
  if (columns.filePath) headers.push("Ruta");

  const rows = invoices.map((inv) => {
    const cells = [];
    if (columns.invoiceNumber) cells.push(`"${inv.invoiceNumber}"`);
    if (columns.company) cells.push(`"${inv.company}"`);
    cells.push(`"${getDayFromDate(inv.date)}"`, `"${inv.month}"`, `"${inv.year}"`, `"${inv.date}"`);
    if (columns.detail) cells.push(`"${inv.detail.replace(/"/g, '""')}"`);
    if (columns.amount) cells.push(inv.amount || "0");
    if (columns.filePath) cells.push(`"${inv.filePath.replace(/"/g, '""')}"`);
    return cells.join(",");
  });

  return "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
}

function SortIcon({ col, sortKey, sortDir }: any) {
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-muted-foreground opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 text-primary" /> : <ChevronDown className="w-3 h-3 ml-1 text-primary" />;
}

export function Reports() {
  const navigate = useNavigate();
  const { currentScan, history, settings, setCurrentScan } = useData();

  const activeScan = useMemo(() => currentScan ?? (history.length > 0 ? history[0] : null), [currentScan, history]);

  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [selectedPdfTool, setSelectedPdfTool] = useState<string>("compress");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const clearFilters = () => {
    setSearchQuery("");
    setCompanyFilter("all");
    setYearFilter("all");
    setMonthFilter("all");
    setMinAmount("");
    setMaxAmount("");
    setSortKey(null);
    setSortDir("asc");
    setCurrentPage(1);
  };

  // Cuando se abre el visor, cargar el PDF como base64
  useEffect(() => {
    let cancelled = false;

    const loadPreview = async () => {
      if (!previewPath) {
        setPdfBase64(null);
        setPdfLoading(false);
        return;
      }

      setPdfLoading(true);
      setPdfBase64(null);

      try {
        const result: any = await window.electronAPI.readPdfAsBase64(previewPath);
        if (cancelled) return;

        if (result?.success && result.data) {
          setPdfBase64(result.data);
        } else {
          toast.error("Error al cargar el PDF: " + (result?.error || "Ruta inválida o archivo no encontrado"));
        }
      } catch (error: any) {
        if (cancelled) return;
        toast.error("Error al cargar el PDF: " + (error?.message || "Fallo de IPC"));
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
    };
  }, [previewPath]);

  const rowsPerPage = settings.display.rowsPerPage;

  const handleExportCSV = async () => {
    try {
      const csvContent = buildCSV(filteredInvoices, settings.columns);
      if (window.electronAPI?.exportFile) {
        const res = await window.electronAPI.exportFile({
          defaultFilename: `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.csv`,
          content: csvContent,
          filters: [{ name: "Archivo CSV", extensions: ["csv"] }],
        });
        if (res.success) toast.success("Reporte CSV exportado con éxito");
      } else {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV descargado");
      }
    } catch (err) {
      toast.error("Error al exportar CSV");
    }
  };

  const handleExportExcel = async () => {
  try {
    const data = filteredInvoices.map((inv) => ({
      "N° Factura": inv.invoiceNumber,
      "Compañía": inv.company,
      "Día": getDayFromDate(inv.date),
      "Mes": inv.month,
      "Año": inv.year,
      "Fecha": inv.date,
      "Detalle": inv.detail,
      "Monto (COP)": inv.amount,
      "Ruta": inv.filePath,
    }));
    const { content, filename } = await exportDataAsExcel(data, `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}`);
    if (window.electronAPI?.exportFile) {
      const res = await window.electronAPI.exportFile({
        defaultFilename: filename,
        content,
        filters: [{ name: "Libro de Excel", extensions: ["xlsx"] }],
      });
      if (res.success) toast.success("Reporte Excel exportado con éxito");
    } else {
      const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Excel descargado");
    }
  } catch (err) {
    toast.error("Error al exportar Excel");
  }
};
  const handleExportPDF = async () => {
    setIsExportingPDF(true);
    try {
      // Build a simple HTML report and send to the Python sidecar to render to PDF.
      const dateStr = formatDate(new Date(), "dd/MM/yyyy HH:mm:ss");
      const companyStats = filteredInvoices.reduce((acc: Record<string, { count: number; total: number }>, inv) => {
        if (!acc[inv.company]) acc[inv.company] = { count: 0, total: 0 };
        acc[inv.company].count += 1;
        acc[inv.company].total += inv.amount || 0;
        return acc;
      }, {});

      const rowsHtml = filteredInvoices.slice(0, 10).map(inv => `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.invoiceNumber}</td>
          <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.company}</td>
          <td style="padding:6px;border-bottom:1px solid #e6eef8">${inv.date}</td>
          <td style="padding:6px;border-bottom:1px solid #e6eef8;text-align:right">${inv.amount > 0 ? formatCOP(inv.amount) : '—'}</td>
        </tr>
      `).join('');

      const distributionHtml = Object.entries(companyStats)
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 8)
        .map(([name, d]) => `<li>${name}: ${d.count} facturas (${formatCOP(d.total)})</li>`)
        .join('');

      const html = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Reporte Analítico de Auditoría COTU</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color:#0f172a; }
            .header { margin:20px 0 }
            .metrics { margin:10px 0 }
            table { width:100%; border-collapse:collapse; margin-top:8px }
            th { text-align:left; padding:8px; background:#f8fafc }
            td { padding:6px }
          </style>
        </head>
        <body>
          <h1>REPORTE ANALÍTICO DE AUDITORÍA COTU</h1>
          <div class="header">Generado el: ${dateStr}</div>
          <h2>Métricas Clave</h2>
          <div class="metrics">
            <p>Total Facturas Auditadas: ${filteredInvoices.length}</p>
            <p>Monto Total: ${formatCOP(totalAmount)}</p>
            <p>Aseguradoras Detectadas: ${new Set(filteredInvoices.map(i => i.company)).size}</p>
            <p>Tasa de Extracción Correcta: ${filteredInvoices.length > 0 ? Math.round((filteredInvoices.filter(i => i.amount > 0).length / filteredInvoices.length) * 100) : 0}%</p>
          </div>
          <h2>Distribución por Aseguradora</h2>
          <ul>${distributionHtml}</ul>
          <h2>Detalle de Auditoría (muestra)</h2>
          <table>
            <thead>
              <tr><th>N° Factura</th><th>Aseguradora</th><th>Fecha</th><th style="text-align:right">Monto (COP)</th></tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          ${filteredInvoices.length > 10 ? `<p>... y ${filteredInvoices.length - 10} facturas más en el reporte general.</p>` : ''}
        </body>
        </html>
      `;

      const res = await window.electronAPI.pdfTools.htmlToPdf({ html });

      if (!res || !res.ok) {
        toast.error(`Error al generar PDF: ${res?.error || 'sidecar failure'}`);
        return;
      }

      // If sidecar returned base64 PDF, save it via exportFile (shows save dialog)
      if (res.pdf_base64) {
        const b64 = res.pdf_base64;
        const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        if (window.electronAPI?.exportFile) {
          const saved = await window.electronAPI.exportFile({
            defaultFilename: `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.pdf`,
            content: binary,
            filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
          });
          if (saved.success) toast.success('Reporte PDF exportado con éxito');
          else toast.error(saved.error || 'Cancelado');
        } else {
          const blob = new Blob([binary], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Reporte_Auditoria_COTU_${formatDate(new Date(), "yyyyMMdd")}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          toast.success('PDF descargado desde el navegador');
        }
      } else if (res.output) {
        // If sidecar wrote a file and returned a path, open it or show in folder
        if (window.electronAPI?.shell?.openPath) {
          await window.electronAPI.shell.openPath(res.output);
          toast.success('PDF generado en: ' + res.output);
        } else {
          toast.success('PDF generado: ' + res.output);
        }
      } else {
        toast.error('Respuesta inválida del sidecar PDF');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al generar el reporte PDF');
    } finally {
      setIsExportingPDF(false);
    }
  };

  const handleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const filteredInvoices = useMemo(() => {
    if (!activeScan) return [];
    const min = minAmount ? parseFloat(minAmount) : null;
    const max = maxAmount ? parseFloat(maxAmount) : null;

    return activeScan.invoices.filter((invoice) => {
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || invoice.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCompany = companyFilter === "all" || invoice.company === companyFilter;
      const matchesYear = yearFilter === "all" || invoice.year === yearFilter;
      const matchesMonth = monthFilter === "all" || invoice.month === monthFilter;
      const matchesMin = min === null || invoice.amount >= min;
      const matchesMax = max === null || invoice.amount <= max;
      return matchesSearch && matchesCompany && matchesYear && matchesMonth && matchesMin && matchesMax;
    });
  }, [activeScan, searchQuery, companyFilter, yearFilter, monthFilter, minAmount, maxAmount]);

  const sortedInvoices = useMemo(() => {
    if (!sortKey) return filteredInvoices;
    return [...filteredInvoices].sort((a, b) => {
      let aVal = a[sortKey as keyof Invoice] ?? "";
      let bVal = b[sortKey as keyof Invoice] ?? "";
      if (sortKey === "amount") { aVal = Number(aVal); bVal = Number(bVal); }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredInvoices, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedInvoices.length / rowsPerPage);
  const paginatedInvoices = sortedInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // REGLA 2: No contar duplicados en los totales del reporte
  const uniqueInvoices = useMemo(() => filteredInvoices.filter(inv => !inv.isDuplicate), [filteredInvoices]);
  const totalAmount = uniqueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  
  const hasFilters = searchQuery || companyFilter !== "all" || yearFilter !== "all" || monthFilter !== "all" || minAmount || maxAmount || sortKey !== null;

  if (!activeScan || activeScan.invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
          <FileText className="w-10 h-10" />
        </div>
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Sin Reportes Disponibles</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Aún no tienes facturas escaneadas. Realiza un escaneo primero para ver el reporte detallado.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate("/scanner")}
          className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md gap-3"
        >
          <Search className="w-5 h-5" />
          IR AL ESCÁNER
          <ChevronRight className="w-5 h-5 opacity-60" />
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* PDF Preview Modal Glass */}
      <Dialog open={!!previewPath} onOpenChange={() => setPreviewPath(null)}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 bg-card border-border rounded-2xl overflow-hidden shadow-lg">
          <DialogHeader className="px-8 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Eye className="w-5 h-5" /></div>
              <span className="font-bold truncate uppercase tracking-tight">{previewPath?.split(/[\\/]/).pop()}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-4 bg-muted/30">
            {pdfLoading && (
              <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground font-bold animate-pulse">Cargando PDF...</span>
              </div>
            )}
            {pdfBase64 && !pdfLoading && (
              <embed
                src={`data:application/pdf;base64,${pdfBase64}`}
                type="application/pdf"
                className="w-full h-full rounded-2xl border border-border shadow-inner"
              />
            )}
          </div>
          <div className="px-8 py-5 border-t border-border flex justify-between items-center bg-muted/50">
            <p className="text-xs font-mono text-muted-foreground truncate max-w-md">{previewPath}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => window.electronAPI.shell.openPath(previewPath!)}>
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir Sistema
              </Button>
              <Button size="sm" variant="secondary" className="rounded-xl font-bold" onClick={() => { navigator.clipboard.writeText(previewPath!); toast.success("Copiado"); }}>
                <Copy className="w-4 h-4 mr-2" /> Ruta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Reportes y Auditoría</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-muted-foreground font-medium text-lg">Visualización y exportación de hallazgos COTU</p>
            {history.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-4 bg-border mx-2" />
                <Select value={activeScan?.id} onValueChange={(val) => {
                  const s = history.find(h => h.id === val);
                  if (s) {
                    setCurrentScan(s);
                    toast.success("Cargada sesión del historial");
                  }
                }}>
                  <SelectTrigger className="w-[320px] h-9 bg-muted/40 border border-border/50 rounded-xl text-xs font-bold hover:bg-muted/60 transition-colors shadow-sm">
                    <div className="flex items-center gap-2 truncate">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <SelectValue placeholder="Cambiar sesión..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border shadow-2xl p-1 max-h-[400px]">
                    {history.map((scan) => (
                      <SelectItem key={scan.id} value={scan.id} className="rounded-xl py-3 focus:bg-primary/10">
                        <div className="flex flex-col gap-1.5 w-[280px]">
                          <div className="flex items-center justify-between">
                             <span className="font-bold text-foreground">
                               {formatDate(new Date(scan.timestamp), "dd MMMM yyyy", { locale: es })}
                             </span>
                             <Badge variant="outline" className="text-[9px] font-black h-4 px-1.5 border-primary/20 bg-primary/5 text-primary">
                               {scan.totalInvoices} FACS
                             </Badge>
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground bg-muted/50 p-1.5 rounded-md border border-border/30">
                             <FolderOpen className="w-2.5 h-2.5 shrink-0" />
                             <span className="truncate">{scan.basePath}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            variant="outline" 
            className="h-12 px-5 rounded-xl font-bold bg-muted/50 border-border gap-2"
            onClick={handleExportCSV}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> CSV
          </Button>
          <Button 
            className="h-12 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2"
            onClick={handleExportExcel}
          >
            <FileSpreadsheet className="w-4 h-4 text-primary-foreground" /> EXCEL (.XLSX)
          </Button>
          <Button 
            disabled={isExportingPDF}
            className="h-12 px-6 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm gap-2"
            onClick={handleExportPDF}
          >
            <Download className="w-4 h-4 text-primary-foreground" /> {isExportingPDF ? "EXPORTANDO..." : "PDF"}
          </Button>
        </div>
      </div>

      {/* KPIs Glass */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <StatCard label="Total Facturas" val={uniqueInvoices.length} icon={<FileText className="w-5 h-5" />} color="bg-muted text-muted-foreground" />
         <StatCard label="Aseguradoras" val={new Set(uniqueInvoices.map(i => i.company)).size} icon={<LayoutGrid className="w-5 h-5" />} color="bg-muted text-muted-foreground" />
         <StatCard label="Monto Total" val={formatCOP(totalAmount)} icon={<DollarSign className="w-5 h-5" />} color="bg-muted text-muted-foreground" isMoney />
         <StatCard label="Eficiencia" val={`${Math.round((uniqueInvoices.filter(i => i.amount > 0).length / Math.max(uniqueInvoices.length, 1)) * 100)}%`} icon={<TrendingUp className="w-5 h-5" />} color="bg-muted text-muted-foreground" />
      </div>

      {/* Filtros Glass */}
      <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-muted text-muted-foreground"><Filter className="w-5 h-5" /></div>
             <CardTitle className="text-lg font-bold">Panel de Filtros</CardTitle>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-primary font-bold hover:bg-primary/10">
              <X className="w-4 h-4 mr-2" /> LIMPIAR TODO
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por N° COTU o aseguradora..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-12 pl-12 rounded-xl bg-muted/50 border-border font-bold" />
            </div>
            <SelectFilter value={companyFilter} onChange={setCompanyFilter} options={Array.from(new Set(activeScan?.invoices?.map(i => i.company) || []))} label="Compañía" />
            <SelectFilter value={monthFilter} onChange={setMonthFilter} options={MONTHS_ORDER} label="Mes" />
            <SelectFilter value={yearFilter} onChange={setYearFilter} options={Array.from(new Set(activeScan?.invoices?.map(i => i.year) || []))} label="Año" />
          </div>
        </CardContent>
      </Card>

      {/* Tabla Premium */}
      <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
        <CardHeader className="p-8 border-b border-border flex flex-row items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg"><FileBadge className="w-5 h-5" /></div>
              <CardTitle className="text-lg font-bold">Resultados de la Auditoría</CardTitle>
           </div>
           <div className="flex gap-2 items-center">
              {filteredInvoices.length !== uniqueInvoices.length && (
                <Badge variant="outline" className="h-7 border-orange-200 text-orange-600 bg-orange-50 font-bold px-3 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
                  {filteredInvoices.length - uniqueInvoices.length} DUPLICADOS OCULTOS EN TOTALES
                </Badge>
              )}
              <Badge variant="secondary" className="h-7 bg-muted text-muted-foreground font-bold px-3 border-none">{uniqueInvoices.length} FACTURAS ÚNICAS</Badge>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 p-6 border-b border-border bg-muted/5 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <span className="text-sm font-semibold text-foreground">Enviar PDFs del escaneo activo a PDF Tools</span>
              <div className="w-full md:w-64">
                <Select value={selectedPdfTool} onValueChange={setSelectedPdfTool}>
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder="Selecciona herramienta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="merge">Unir PDFs</SelectItem>
                    <SelectItem value="compress">Comprimir</SelectItem>
                    <SelectItem value="rotate">Rotar</SelectItem>
                    <SelectItem value="ocr">OCR</SelectItem>
                    <SelectItem value="split">Dividir PDF</SelectItem>
                    <SelectItem value="extract">Extraer páginas</SelectItem>
                    <SelectItem value="pdf_to_jpg">PDF a JPG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="h-11 rounded-xl bg-primary text-primary-foreground font-bold"
              onClick={() => {
                if (!activeScan || activeScan.invoices.length === 0) {
                  toast.error('No hay facturas en el escaneo activo para enviar a PDF Tools.');
                  return;
                }

                const paths = activeScan.invoices
                  .map(inv => inv.invoicePdfPath || inv.filePath)
                  .filter((path): path is string => !!path);

                if (paths.length === 0) {
                  toast.error('No se encontraron rutas de PDF válidas en el escaneo activo.');
                  return;
                }

                console.log('Reports -> PDFTools navigate filesToProcess:', paths, 'preferredToolId:', selectedPdfTool);

                navigate('/pdf-tools', {
                  state: {
                    filesToProcess: paths,
                    preferredToolId: selectedPdfTool,
                  },
                });
              }}
            >
              Procesar escaneo en PDF Tools
            </Button>
          </div>
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent border-border">
                <SortableHead col="invoiceNumber" label="N° COTU" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHead col="company" label="ASEGURADORA" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHead col="day" label="DÍA" active={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="text-xs font-bold uppercase text-muted-foreground p-6">MES/AÑO</TableHead>
                <SortableHead col="amount" label="MONTO (COP)" active={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="text-xs font-bold uppercase text-muted-foreground p-6 text-right">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((inv) => (
                <TableRow key={inv.id} className="group border-border hover:bg-primary/5 transition-colors">
                  <TableCell className="p-6 font-bold text-primary tabular-nums">{inv.invoiceNumber}</TableCell>
                  <TableCell className="p-6 font-bold text-foreground">{inv.company}</TableCell>
                  <TableCell className="p-6 font-bold text-center tabular-nums">{getDayFromDate(inv.date)}</TableCell>
                  <TableCell className="p-6">
                     <div className="flex flex-col">
                        <span className="text-xs font-bold">{inv.month}</span>
                        <span className="text-xs text-muted-foreground font-bold">{inv.year}</span>
                     </div>
                  </TableCell>
                  <TableCell className="p-6 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                     {inv.amount > 0 ? formatCOP(inv.amount) : <span className="text-muted-foreground/30">—</span>}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10 text-primary" onClick={() => setPreviewPath(inv.filePath)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      {inv.filePath && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-9 w-9 rounded-xl hover:bg-blue-500/10 text-blue-600" 
                          title="Enviar a PDF Tools"
                          onClick={() => navigate('/pdf-tools', { state: { fileToProcess: inv.invoicePdfPath ?? inv.filePath, preferredToolId: selectedPdfTool } })}
                        >
                          <FileStack className="w-4 h-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-muted" onClick={() => window.electronAPI.shell.openPath(inv.filePath)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="p-8 border-t border-border bg-muted/30 flex items-center justify-between">
               <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
               <Pagination className="w-auto mx-0">
                  <PaginationContent>
                    <PaginationItem><PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p-1))} className="cursor-pointer rounded-xl font-bold" /></PaginationItem>
                    <PaginationItem><PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} className="cursor-pointer rounded-xl font-bold" /></PaginationItem>
                  </PaginationContent>
               </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, val, icon, color, isMoney }: any) {
  return (
    <Card className="bg-card border-border shadow-lg rounded-2xl overflow-hidden group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
             <div className={cn("p-2 rounded-lg shadow-md group-hover:scale-110 transition-transform", color)}>{icon}</div>
          </div>
          <h3 className={cn("font-bold tracking-tight truncate", isMoney ? "text-xl" : "text-3xl")}>{val}</h3>
       </CardContent>
    </Card>
  );
}

function SelectFilter({ value, onChange, options, label }: any) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 rounded-xl bg-muted/50 border-border font-bold">
          <SelectValue placeholder={`Seleccionar ${label}`} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-border shadow-lg">
          <SelectItem value="all" className="font-bold">Todos</SelectItem>
          {options.sort().map((o: string) => <SelectItem key={o} value={o} className="font-bold">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SortableHead({ col, label, active, dir, onSort }: any) {
  return (
    <TableHead className="p-6 cursor-pointer hover:bg-primary/5 transition-colors group" onClick={() => onSort(col)}>
       <div className="flex items-center gap-1">
          <span className={cn("text-xs font-bold uppercase tracking-widest", active === col ? "text-primary" : "text-muted-foreground")}>{label}</span>
          <SortIcon col={col} sortKey={active} sortDir={dir} />
       </div>
    </TableHead>
  );
}
