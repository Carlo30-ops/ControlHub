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
import { ScanResult } from "../../shared/types";
import { exportDataAsExcel } from "../utils/excelWrapper";
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
    if (!window.electronAPI?.exportFile) { toast.error("Exportación no disponible"); return; }

    setIsExporting(true);
    try {
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
    const timestamp = formatDate(new Date(), "dd-MM-yyyy_HH-mm");
    const { content, filename } = await exportDataAsExcel(summaryData, `historial_cotu_${timestamp}`);
    const result = await window.electronAPI.exportFile({
      defaultFilename: filename,
      content,
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
        <div className="w-20 h-20 rounded-2xl bg-muted text-muted-foreground flex items-center justify-center">
          <HistoryIcon className="w-10 h-10" />
        </div>
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-3xl font-bold text-foreground uppercase tracking-tight">Sin Historial</h2>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Aún no hay escaneos guardados. Completa tu primer escaneo para ver el historial aquí.
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => navigate("/scanner")}
          className="h-14 px-10 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md gap-3"
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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Historial Auditado</h1>
          <div className="flex items-center gap-3 mt-2">
             <Badge variant="outline" className="font-bold text-[10px] uppercase border-border bg-muted/40">{history.length} Sesiones</Badge>
             <Badge className="font-bold text-[10px] uppercase bg-muted text-muted-foreground border-none">{totalFacturas.toLocaleString()} Facturas Totales</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 px-5 rounded-xl font-bold border-border bg-card gap-2"
            onClick={handleExportHistory}
            disabled={isExporting}
          >
            <Download className="w-4 h-4 text-primary" />
            {isExporting ? "Exportando..." : "Exportar Excel"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="h-12 px-5 rounded-xl font-bold text-destructive hover:bg-destructive/10 gap-2">
                <Trash2 className="w-4 h-4" />
                Vaciar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-border">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-bold uppercase">¿Confirmar limpieza?</AlertDialogTitle>
                <AlertDialogDescription className="font-medium text-muted-foreground">
                  Esta acción eliminará permanentemente todos los registros del historial. No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-3">
                <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearHistory} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                  Sí, eliminar todo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Buscar por ruta, tipo, factura o aseguradora..."
          className="h-14 pl-12 rounded-2xl bg-muted/50 border-border shadow-lg font-bold"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHistory.map((scan) => {
          const index = history.findIndex((item) => item.id === scan.id);
          const topCompanies = getTopCompanies(scan);
          return (
            <Card
              key={scan.id}
              className="bg-card border-border shadow-md rounded-2xl hover:border-primary/50 hover:shadow-lg transition-all duration-300 group overflow-hidden"
              onClick={() => handleViewReport(scan)}
            >
              <CardHeader className="pb-4 bg-muted/40 border-b border-border">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                       <Badge variant="secondary" className="font-bold text-[9px] uppercase bg-muted text-muted-foreground border-none px-1.5">{scanTypeLabels[scan.type]}</Badge>
                       <Badge variant="outline" className="font-bold text-[9px] uppercase border-border">SESIÓN #{history.length - index}</Badge>
                    </div>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                      {scan.totalInvoices} Facturas
                    </CardTitle>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                   <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                     <Calendar className="w-3.5 h-3.5 text-primary" />
                     <span>{format(new Date(scan.timestamp), "dd MMM yyyy, HH:mm", { locale: es })}</span>
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-muted/50 p-2 rounded-lg border border-border">
                     <FolderOpen className="w-3 h-3 shrink-0" />
                     <span className="truncate">{scan.basePath}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold text-muted-foreground">{(scan.scanDuration / 1000).toFixed(1)}s</span>
                   </div>
                   <div className="flex gap-1.5">
                      {scan.stats && scan.stats.skippedDuplicates > 0 && (
                        <Badge variant="outline" className="text-[9px] font-bold text-orange-500 border-orange-500/20 bg-orange-500/5 px-1.5 h-5 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950/30">
                          {scan.stats.skippedDuplicates} DUPLICADOS
                        </Badge>
                      )}
                      {scan.stats && scan.stats.amountExtractionSuccess > 0 && (
                        <Badge variant="outline" className="text-[9px] font-bold text-emerald-500 border-emerald-500/20 bg-emerald-500/5 px-1.5 h-5 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/30">
                          {scan.stats.amountExtractionSuccess} MONTO OK
                        </Badge>
                      )}
                   </div>
                </div>

                {topCompanies.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Building2 className="w-3 h-3 text-muted-foreground" />
                    {topCompanies.map((c) => (
                      <span key={c} className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter bg-muted px-1.5 py-0.5 rounded-md">{c}</span>
                    ))}
                  </div>
                )}

                <div className="pt-4 flex items-center gap-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-10 rounded-xl font-bold hover:bg-primary/10 hover:text-primary justify-between group/btn"
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
                        className="h-10 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => { e.stopPropagation(); setDeletingId(scan.id); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl border-border">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="font-bold uppercase">¿Eliminar sesión?</AlertDialogTitle>
                        <AlertDialogDescription className="font-medium text-muted-foreground">
                          Se borrará este registro de auditoría permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold" onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSingle(scan.id)} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">Eliminar</AlertDialogAction>
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
        <div className="py-16 text-center rounded-2xl border border-dashed border-border bg-muted/40">
          <Search className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Sin coincidencias</p>
          <p className="text-xs font-medium text-muted-foreground mt-2">Ajusta el término de búsqueda para ver sesiones auditadas.</p>
        </div>
      )}
    </div>
  );
}
