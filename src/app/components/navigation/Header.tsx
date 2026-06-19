import { Moon, Sun, Bell, FileText, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";
import { useData } from "../../contexts/DataContext";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const { currentScan, settings } = useData();
  const operatorName = settings.operatorName?.trim() || "Usuario Admin";
  const operatorEmail = settings.operatorEmail?.trim() || "admin@cotu.com";
  const operatorInitials = operatorName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "UA";

  // ── Alertas derivadas del escaneo activo ──────────────────
  const duplicates = currentScan?.stats?.duplicatesLog ?? [];
  const invoicesSinMonto = currentScan
    ? currentScan.invoices.filter((i) => i.amount === 0).length
    : 0;
  const totalAlerts = duplicates.length + (invoicesSinMonto > 0 ? 1 : 0);

  // ── Tiempo relativo del último escaneo ────────────────────
  const lastScanAgo = currentScan
    ? formatDistanceToNow(new Date(currentScan.timestamp), { locale: es, addSuffix: true })
    : null;

  return (
    <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-6">

      {/* ── Izquierda: fecha + contexto del escaneo ── */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0">
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {currentScan && (
          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-border min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="text-xs text-muted-foreground font-medium shrink-0">
              <FileText className="w-3 h-3 inline mr-1 text-primary" />
              {currentScan.totalInvoices.toLocaleString("es-CO")} facturas
            </span>
            <span className="text-xs text-muted-foreground/60 truncate">
              · {lastScanAgo}
            </span>
          </div>
        )}
      </div>

      {/* ── Derecha: Bell + Tema + Usuario ── */}
      <div className="flex items-center gap-3 shrink-0">

        {/* Bell de alertas */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl hover:bg-muted relative"
            >
              <Bell className="w-5 h-5 text-[#64748B]" />
              {totalAlerts > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {totalAlerts > 9 ? "9+" : totalAlerts}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 overflow-hidden bg-card border-border">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Panel de Alertas
                {totalAlerts > 0 && (
                  <Badge variant="destructive" className="text-xs ml-auto">
                    {totalAlerts}
                  </Badge>
                )}
              </h3>
            </div>

            <div className="divide-y divide-border max-h-80 overflow-y-auto">
              {!currentScan ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay escaneo activo
                </div>
              ) : totalAlerts === 0 ? (
                <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground">Sin alertas detectadas</p>
                  <p className="text-xs text-muted-foreground">El escaneo no reportó duplicados ni facturas sin monto</p>
                </div>
              ) : (
                <>
                  {/* Alerta: facturas sin monto */}
                  {invoicesSinMonto > 0 && (
                    <div className="px-4 py-3 flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {invoicesSinMonto} factura{invoicesSinMonto > 1 ? "s" : ""} sin monto
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          No fue posible extraer el monto del PDF
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Alertas: duplicados */}
                  {duplicates.length > 0 && (
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Copy className="w-4 h-4 text-orange-500 shrink-0" />
                        <p className="text-sm font-medium text-foreground">
                          {duplicates.length} duplicado{duplicates.length > 1 ? "s" : ""} omitido{duplicates.length > 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {duplicates.map((d, i) => (
                          <div
                            key={i}
                            className="text-xs bg-orange-500/5 border border-orange-500/20 rounded-md px-2 py-1.5"
                          >
                            <span className="font-semibold text-orange-500">{d.invoiceNumber}</span>
                            <span className="text-muted-foreground ml-1 block truncate">
                              {d.discardedPath.split(/[/\\]/).slice(-2).join("/")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Toggle tema */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-xl hover:bg-muted"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 text-[#64748B]" />
          ) : (
            <Sun className="w-5 h-5 text-[#64748B]" />
          )}
        </Button>

        {/* Avatar usuario */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="rounded-xl hover:bg-muted p-2 transition-colors">
              <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground text-sm font-semibold">
                {operatorInitials}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <DropdownMenuItem className="font-bold truncate text-foreground">{operatorName}</DropdownMenuItem>
            <DropdownMenuItem className="text-muted-foreground truncate">{operatorEmail}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
