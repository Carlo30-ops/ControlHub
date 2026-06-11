import { useState, useMemo } from "react";
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
  LayoutGrid
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
import { Invoice } from "../contexts/DataContext";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
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
  if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 text-slate-400 opacity-30" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1 text-blue-500" /> : <ChevronDown className="w-3 h-3 ml-1 text-blue-500" />;
}

export function Reports() {
  const navigate = useNavigate();
  const { currentScan, settings } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [previewPath, setPreviewPath] = useState<string | null>(null);

  const rowsPerPage = settings.display.rowsPerPage;

  const handleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const filteredInvoices = useMemo(() => {
    if (!currentScan) return [];
    const min = minAmount ? parseFloat(minAmount) : null;
    const max = maxAmount ? parseFloat(maxAmount) : null;

    return currentScan.invoices.filter((invoice) => {
      const matchesSearch = invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) || invoice.company.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCompany = companyFilter === "all" || invoice.company === companyFilter;
      const matchesYear = yearFilter === "all" || invoice.year === yearFilter;
      const matchesMonth = monthFilter === "all" || invoice.month === monthFilter;
      const matchesMin = min === null || invoice.amount >= min;
      const matchesMax = max === null || invoice.amount <= max;
      return matchesSearch && matchesCompany && matchesYear && matchesMonth && matchesMin && matchesMax;
    });
  }, [currentScan, searchQuery, companyFilter, yearFilter, monthFilter, minAmount, maxAmount]);

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

  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const hasFilters = searchQuery || companyFilter !== "all" || yearFilter !== "all" || monthFilter !== "all" || minAmount || maxAmount || sortKey !== null;

  if (!currentScan) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] space-y-6">
        <div className="w-24 h-24 rounded-3xl bg-white/50 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xl">
           <FileText className="w-10 h-10 text-slate-300" />
        </div>
        <div className="text-center">
           <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Sin resultados</h2>
           <p className="text-slate-500 font-medium">Realiza un escaneo para ver los reportes</p>
        </div>
        <Button onClick={() => navigate("/scanner")} className="h-12 px-6 rounded-xl font-bold bg-blue-600">Ir al Escáner</Button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      
      {/* PDF Preview Modal Glass */}
      <Dialog open={!!previewPath} onOpenChange={() => setPreviewPath(null)}>
        <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-2xl border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
          <DialogHeader className="px-8 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800/50">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><Eye className="w-5 h-5" /></div>
              <span className="font-black truncate uppercase tracking-tight">{previewPath?.split(/[\\/]/).pop()}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-4 bg-slate-100/30 dark:bg-slate-900/30">
            {previewPath && (
              <iframe src={`cotu://pdf?path=${encodeURIComponent(previewPath)}#toolbar=1`} className="w-full h-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner" />
            )}
          </div>
          <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
            <p className="text-[10px] font-mono text-slate-400 truncate max-w-md">{previewPath}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => (window as any).electronAPI.shell.openPath(previewPath!)}>
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
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Reportes y Auditoría</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-lg">Visualización y exportación de hallazgos COTU</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="h-12 px-5 rounded-xl font-bold bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" /> CSV
          </Button>
          <Button className="h-12 px-6 rounded-xl font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 gap-2">
            <Download className="w-4 h-4" /> EXCEL (.XLSX)
          </Button>
        </div>
      </div>

      {/* KPIs Glass */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
         <StatCard label="Total Facturas" val={filteredInvoices.length} icon={<FileText className="w-5 h-5" />} color="bg-blue-500" />
         <StatCard label="Aseguradoras" val={new Set(filteredInvoices.map(i => i.company)).size} icon={<LayoutGrid className="w-5 h-5" />} color="bg-purple-500" />
         <StatCard label="Monto Total" val={formatCOP(totalAmount)} icon={<DollarSign className="w-5 h-5" />} color="bg-emerald-500" isMoney />
         <StatCard label="Eficiencia" val={`${Math.round((filteredInvoices.filter(i => i.amount > 0).length / Math.max(filteredInvoices.length, 1)) * 100)}%`} icon={<TrendingUp className="w-5 h-5" />} color="bg-orange-500" />
      </div>

      {/* Filtros Glass */}
      <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500"><Filter className="w-5 h-5" /></div>
             <CardTitle className="text-xl font-black">Panel de Filtros</CardTitle>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-blue-500 font-bold hover:bg-blue-500/10">
              <X className="w-4 h-4 mr-2" /> LIMPIAR TODO
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Buscar por N° COTU o aseguradora..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-12 pl-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold" />
            </div>
            <SelectFilter value={companyFilter} onChange={setCompanyFilter} options={Array.from(new Set(currentScan.invoices.map(i => i.company)))} label="Compañía" />
            <SelectFilter value={monthFilter} onChange={setMonthFilter} options={MONTHS_ORDER} label="Mes" />
            <SelectFilter value={yearFilter} onChange={setYearFilter} options={Array.from(new Set(currentScan.invoices.map(i => i.year)))} label="Año" />
          </div>
        </CardContent>
      </Card>

      {/* Tabla Premium */}
      <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="p-8 border-b border-slate-100 dark:border-slate-800/50 flex flex-row items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-500 text-white shadow-lg"><FileBadge className="w-5 h-5" /></div>
              <CardTitle className="text-xl font-black">Resultados de la Auditoría</CardTitle>
           </div>
           <Badge variant="secondary" className="h-7 bg-blue-500/10 text-blue-600 font-black px-3 border-none">{filteredInvoices.length} FACTURAS</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
              <TableRow className="hover:bg-transparent border-slate-100 dark:border-slate-800">
                <SortableHead col="invoiceNumber" label="N° COTU" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHead col="company" label="ASEGURADORA" active={sortKey} dir={sortDir} onSort={handleSort} />
                <SortableHead col="day" label="DÍA" active={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="text-[10px] font-black uppercase text-slate-400 p-6">MES/AÑO</TableHead>
                <SortableHead col="amount" label="MONTO (COP)" active={sortKey} dir={sortDir} onSort={handleSort} />
                <TableHead className="text-[10px] font-black uppercase text-slate-400 p-6 text-right">ACCIONES</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.map((inv) => (
                <TableRow key={inv.id} className="group border-slate-100 dark:border-slate-800 hover:bg-blue-500/5 transition-colors">
                  <TableCell className="p-6 font-black text-blue-600 dark:text-blue-400 tabular-nums">{inv.invoiceNumber}</TableCell>
                  <TableCell className="p-6 font-bold text-slate-700 dark:text-slate-200">{inv.company}</TableCell>
                  <TableCell className="p-6 font-black text-center tabular-nums">{getDayFromDate(inv.date)}</TableCell>
                  <TableCell className="p-6">
                     <div className="flex flex-col">
                        <span className="text-xs font-bold">{inv.month}</span>
                        <span className="text-[10px] text-slate-400 font-black">{inv.year}</span>
                     </div>
                  </TableCell>
                  <TableCell className="p-6 font-mono font-black text-emerald-600 dark:text-emerald-400">
                     {inv.amount > 0 ? formatCOP(inv.amount) : <span className="text-slate-300 dark:text-slate-700">—</span>}
                  </TableCell>
                  <TableCell className="p-6 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-blue-500/10 text-blue-500" onClick={() => setPreviewPath(inv.filePath)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => (window as any).electronAPI.shell.openPath(inv.filePath)}>
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {totalPages > 1 && (
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex items-center justify-between">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
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
    <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-lg rounded-2xl overflow-hidden group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
             <div className={cn("p-2 rounded-lg text-white shadow-md group-hover:scale-110 transition-transform", color)}>{icon}</div>
          </div>
          <h3 className={cn("font-black tracking-tight truncate", isMoney ? "text-xl" : "text-3xl")}>{val}</h3>
       </CardContent>
    </Card>
  );
}

function SelectFilter({ value, onChange, options, label }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-12 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold">
          <SelectValue placeholder={`Seleccionar ${label}`} />
        </SelectTrigger>
        <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800 shadow-2xl">
          <SelectItem value="all" className="font-bold">Todos</SelectItem>
          {options.sort().map((o: string) => <SelectItem key={o} value={o} className="font-bold">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SortableHead({ col, label, active, dir, onSort }: any) {
  return (
    <TableHead className="p-6 cursor-pointer hover:bg-blue-500/5 transition-colors group" onClick={() => onSort(col)}>
       <div className="flex items-center gap-1">
          <span className={cn("text-[10px] font-black uppercase tracking-widest", active === col ? "text-blue-500" : "text-slate-400")}>{label}</span>
          <SortIcon col={col} sortKey={active} sortDir={dir} />
       </div>
    </TableHead>
  );
}
