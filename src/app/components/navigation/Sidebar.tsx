import { NavLink } from "react-router";
import {
  LayoutDashboard,
  ScanSearch,
  FileStack,
  History,
  Settings,
  BarChart3,
  User,
  Heart,
  ChevronRight,
  RefreshCw,
  Zap,
  ZapOff
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { useData } from "../../contexts/DataContext";

  const navigationGroups = [
    {
      title: "Auditoría COTU",
      items: [
        { name: "Dashboard", path: "/", icon: LayoutDashboard },
        { name: "Escáner", path: "/scanner", icon: ScanSearch },
        { name: "Reportes", path: "/reports", icon: BarChart3 },
        { name: "Historial", path: "/history", icon: History },
      ]
    },
    {
      title: "Gestión Documental",
      items: [
        { name: "Terapias", path: "/terapias", icon: Heart },
        { name: "PDF Tools", path: "/pdf-tools", icon: FileStack, badge: "V2.0" },
      ]
    },
    {
      title: "Sistema",
      items: [
        { name: "Configuración", path: "/settings", icon: Settings },
      ]
    }
  ];

  export function Sidebar() {
  const { sidecarStatus, checkSidecars, reconnectSidecar, settings } = useData();

  return (
    <aside className="w-72 bg-background border-r border-border flex flex-col z-50">

      {/* Logo Premium */}
      <div className="p-8 border-b border-border/50">
        <div className="flex items-center gap-4">
          <img src="/icon.png" alt="ControlHub" className="h-9 w-9 object-contain grayscale opacity-80" />
          <div>
            <h1 className="font-bold text-lg text-foreground tracking-tight">
              ControlHub
            </h1>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Unified Suite
            </p>
          </div>
        </div>
      </div>

      {/* Navegación Agrupada por Dominios */}
      <nav className="flex-1 p-6 space-y-8 overflow-y-auto scrollbar-hide">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <h3 className="px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group relative",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={cn("w-4.5 h-4.5", isActive ? "text-primary" : "text-[#64748B] group-hover:text-foreground")} />
                        <span className="font-medium text-sm flex-1">{item.name}</span>
                        {item.badge && (
                          <Badge className={cn("text-[10px] font-bold px-1.5 h-4 border-none", isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground")}>
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Perfil de Usuario (Cristal) */}
      <div className="p-6 border-t border-border/50 space-y-4">
        
        {/* Sidecar Status Indicator */}
        <div className="px-1 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Servicios</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-5 h-5 hover:bg-muted" 
              onClick={checkSidecars}
              title="Re-conectar servicios"
            >
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sidecarStatus).map(([name, status]) => {
              const isRetryable = status === 'closed' || status === 'stalled' || status === 'failed' || status === 'reconnecting';
              return (
                <div 
                  key={name}
                  onClick={() => isRetryable && reconnectSidecar(name)}
                  className={cn(
                    "flex items-center gap-2 px-2.5 py-1.5 rounded-md border transition-all duration-200",
                    status === 'running' && "bg-muted/50 border-border text-foreground",
                    status === 'reconnecting' && "cursor-pointer hover:bg-sky-500/10 border-sky-500/30 text-sky-500 bg-sky-500/5",
                    status === 'failed' && "cursor-pointer hover:bg-destructive/10 border-destructive/20 text-destructive bg-destructive/5",
                    status === 'stalled' && "cursor-pointer hover:bg-amber-500/10 border-amber-500/30 text-amber-500 bg-amber-500/5",
                    status === 'closed' && "cursor-pointer hover:bg-destructive/10 border-destructive/20 text-destructive",
                    status !== 'running' && status !== 'reconnecting' && status !== 'failed' && status !== 'stalled' && "border-border text-muted-foreground"
                  )}
                  title={
                    status === 'closed'
                      ? `Servicio cerrado. Click para intentar re-conectar ${name}`
                      : status === 'stalled'
                        ? `Servicio atascado por timeout. Click para reiniciar ${name}`
                        : status === 'failed'
                          ? `Servicio falló. Click para intentar reconectar ${name}`
                          : status === 'reconnecting'
                            ? `Servicio reconectando. Click para forzar reconexión ${name}`
                            : status === 'unknown'
                              ? `Estado desconocido de ${name}. Click para reconectar.`
                              : `${name} en ejecución`
                  }
                >
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    status === 'running' && "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                    status === 'stalled' && "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]",
                    status === 'reconnecting' && "bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]",
                    status === 'failed' && "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]",
                    status !== 'running' && status !== 'stalled' && status !== 'reconnecting' && status !== 'failed' && "bg-muted-foreground"
                  )} />
                  <span className="text-[9px] font-bold uppercase tracking-tight">{name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
          <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground truncate uppercase tracking-tight">
              {settings.operatorName}
            </p>
            <p className="text-[10px] font-medium text-muted-foreground truncate">
              {settings.operatorEmail}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
