import { useMemo, useState } from "react";
import { useData } from "../contexts/DataContext";
import { useNavigate } from "react-router";
import {
  Trash2,
  FileText,
  Calendar,
  FolderOpen,
  Clock,
  Zap,
  Building2,
  ChevronRight,
  Download,
  Search,
  ExternalLink,
  ChevronLeft,
  History as HistoryIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { ScrollArea } from "../components/ui/scroll-area";
import { Separator } from "../components/ui/separator";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScanResult } from "../contexts/DataContext";
import * as XLSX from "xlsx";
import { format as formatDate } from "date-fns";
import { cn } from "../components/ui/utils";

const scanTypeLabels = {
  day: "Día",
  week: "Semana",
  month: "Mes",
  year: "Año",
  custom: "Personalizado",
};

export function History() {
  const navigate = useNavigate();
  const { history, clearHistory, deleteFromHistory, setCurrentScan } = useData();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleClearHistory = () => {
    clearHistory();
    toast.success("Historial eliminado correctamente");
  };

  const handleDeleteSingle = (id: string) => {
    deleteFromHistory(id);
    toast.success("Escaneo eliminado");
    setDeletingId(null);
  };

  const handleViewReport = (scan: ScanResult) => {
    setCurrentScan(scan);
    navigate("/reports");
  };

  const handleExportHistory = async () => {
    if (!history.length) { toast.error("No hay datos"); return; }
    if (!(window as any).electronAPI?.exportFile) { toast.error("Exportación no disponible"); return; }

    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();
      const summaryData = history.map((scan, index) => ({
        "#": history.length - index,
        "Tipo": scanTypeLabels[scan.type],
        "Fecha Escaneo": format(new Date(scan.timestamp), "dd/MM/yyyy HH:mm", { locale: es }),
        "Total Facturas": scan.totalInvoices,
        "Ruta Base": scan.basePath,
        "Duración (s)": (scan.scanDuration / 1000).toFixed(2),
        "Archivos": scan.stats?.totalFilesProcessed ?? "—",
        "Duplicados": scan.stats?.skippedDuplicates ?? 0,
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen Escaneos");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const timestamp = formatDate(new Date(), "dd-MM-yyyy_HH-mm");

      const result = await (window as any).electronAPI.exportFile({
        defaultFilename: `historial_cotu_${timestamp}.xlsx`,
        content: new Uint8Array(excelBuffer),
        filters: [{ name: "Excel", extensions: ["xlsx"] }],
      });

      if (result.success) toast.success("Historial exportado");
    } catch (err: any) {
      toast.error("Error al generar Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const getTopCompanies = (scan: ScanResult, limit = 3): string[] => {
    const stats: Record<string, number> = {};
    scan.invoices.forEach((inv) => { stats[inv.company] = (stats[inv.company] || 0) + 1; });
    return Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name]) => name.split(" ")[0]);
  };

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return history;

    return history.filter((scan) => {
      const matchesSession =
        scan.basePath.toLowerCase().includes(query) ||
        scan.type.toLowerCase().includes(query) ||
        scanTypeLabels[scan.type].toLowerCase().includes(query);

      const matchesInvoice = scan.invoices.some((invoice) =>
        invoice.invoiceNumber.toLowerCase().includes(query) ||
        invoice.company.toLowerCase().includes(query)
      );

      return matchesSession || matchesInvoice;
    });
  }, [history, searchQuery]);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-in fade-in duration-500">
        <div className="w-20 h-20 rounded-3xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
          <HistoryIcon className="w-10 h-10" />
        </div>
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Sin Historial</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            Aún no hay escaneos guardados. Completa tu primer escaneo para ver el historial aquí.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate("/scanner")}
          className="h-14 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-xl shadow-purple-500/20 gap-3"
        >
          <Search className="w-5 h-5" />
          INICIAR ESCANEO
          <ChevronRight className="w-5 h-5 opacity-60" />
        </Button>
      </div>
    );
  }

  const totalFacturas = history.reduce((s, h) => s + h.totalInvoices, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Historial Auditado</h1>
          <div className="flex items-center gap-3 mt-2">
             <Badge variant="outline" className="font-black text-[10px] uppercase border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/40">{history.length} Sesiones</Badge>
             <Badge className="font-black text-[10px] uppercase bg-blue-500/10 text-blue-500 border-none">{totalFacturas.toLocaleString()} Facturas Totales</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 px-5 rounded-xl font-bold border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-sm gap-2"
            onClick={handleExportHistory}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 text-emerald-500" />
            {isExporting ? "Exportando..." : "Exportar Excel"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-12 px-5 rounded-xl font-bold text-red-500 hover:bg-red-500/10 gap-2">
                <Trash2 className="w-4 h-4" />
                Vaciar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-black uppercase">¿Confirmar limpieza?</AlertDialogTitle>
                <AlertDialogDescription className="font-medium text-slate-500">
                  Esta acción eliminará permanentemente todos los registros del historial. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700 rounded-xl font-bold">
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por ruta, tipo, factura o aseguradora..."
          className="h-14 pl-12 rounded-2xl bg-white/60 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 shadow-lg font-bold"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHistory.map((scan) => {
          const index = history.findIndex((item) => item.id === scan.id);
          const topCompanies = getTopCompanies(scan);
          return (
            <Card
              key={scan.id}
              className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl hover:border-blue-500/50 hover:shadow-2xl transition-all duration-300 group overflow-hidden"
              onClick={() => handleViewReport(scan)}
            >
              <CardHeader className="pb-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                       <Badge variant="secondary" className="font-black text-[9px] uppercase bg-blue-500/10 text-blue-500 border-none px-1.5">{scanTypeLabels[scan.type]}</Badge>
                       <Badge variant="outline" className="font-black text-[9px] uppercase border-slate-200 dark:border-slate-700">SESIÓN #{history.length - index}</Badge>
                    </div>
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                      {scan.totalInvoices} Facturas
                    </CardTitle>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
                     <Calendar className="w-3.5 h-3.5 text-blue-500" />
                     <span>{format(new Date(scan.timestamp), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                     <FolderOpen className="w-3 h-3 shrink-0" />
                     <span className="truncate">{scan.basePath}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-black text-slate-500">{(scan.scanDuration / 1000).toFixed(1)}s</span>
                   </div>
                   <div className="flex gap-1.5">
                      {scan.stats && scan.stats.skippedDuplicates > 0 && (
                        <Badge variant="outline" className="text-[9px] font-black text-orange-500 border-orange-500/20 bg-orange-500/5 px-1.5 h-5">
                          {scan.stats.skippedDuplicates} DUPLICADOS
                        </Badge>
                      )}
                      {scan.stats && scan.stats.amountExtractionSuccess > 0 && (
                        <Badge variant="outline" className="text-[9px] font-black text-emerald-500 border-emerald-500/20 bg-emerald-500/5 px-1.5 h-5">
                          {scan.stats.amountExtractionSuccess} MONTO OK
                        </Badge>
                      )}
                   </div>
                </div>

                {topCompanies.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Building2 className="w-3 h-3 text-slate-400" />
                    {topCompanies.map((c) => (
                      <span key={c} className="text-[9px] font-black text-slate-400 uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">{c}</span>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-10 rounded-xl font-bold hover:bg-blue-500/10 hover:text-blue-500 justify-between group/btn"
                    onClick={(e) => { e.stopPropagation(); handleViewReport(scan); }}
                  >
                    Ver Reporte
                    <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-all" />
                  </Button>
                  
                  <AlertDialog open={deletingId === scan.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                        onClick={(e) => { e.stopPropagation(); setDeletingId(scan.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl border-slate-200 dark:border-slate-800">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase">¿Eliminar sesión?</AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-slate-500">
                          Se borrará este registro de auditoría permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold" onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSingle(scan.id)} className="bg-red-600 hover:bg-red-700 rounded-xl font-bold">Eliminar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredHistory.length === 0 && (
        <div className="py-16 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-950/30">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Sin coincidencias</p>
          <p className="text-xs font-medium text-slate-500 mt-2">Ajusta el término de búsqueda para ver sesiones auditadas.</p>
        </div>
      )}
    </div>
  );
}
