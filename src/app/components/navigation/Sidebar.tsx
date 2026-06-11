import { NavLink } from "react-router";
import {
  LayoutDashboard,
  ScanSearch,
  FileText,
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
import logoUrl from "../../../assets/logo.png";

const navigation = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Escáner", path: "/scanner", icon: ScanSearch },
  { name: "Reportes", path: "/reports", icon: FileText },
  { name: "Historial", path: "/history", icon: History },
  { name: "PDF Tools", path: "/pdf-tools", icon: FileText, badge: "V2.0" },
  { name: "Terapias", path: "/terapias", icon: Heart },
  { name: "Configuración", path: "/settings", icon: Settings },
];

export function Sidebar() {
  const { sidecarStatus, checkSidecars, reconnectSidecar } = useData();

  return (
    <aside className="w-72 bg-white/50 dark:bg-slate-950/40 backdrop-blur-2xl border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl z-50">

      {/* Logo Premium */}
      <div className="p-8 border-b border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="ControlHub" className="h-10 w-auto object-contain" />
          <div>
            <h1 className="font-black text-xl text-slate-900 dark:text-white tracking-tighter">
              ControlHub
            </h1>
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
              Unified Suite
            </p>
          </div>
        </div>
      </div>

      {/* Navegación con Estilo Unificado */}
      <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 group relative",
                  isActive
                    ? "bg-blue-600 text-white shadow-xl shadow-blue-500/20 scale-[1.02]"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900/50 hover:text-slate-900 dark:hover:text-white"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-slate-400 group-hover:text-blue-500")} />
                  <span className="font-bold text-sm flex-1 tracking-tight">{item.name}</span>
                  {item.badge && (
                    <Badge className={cn("text-[9px] font-black px-1.5 h-4 border-none", isActive ? "bg-white/20 text-white" : "bg-blue-500/10 text-blue-500")}>
                      {item.badge}
                    </Badge>
                  )}
                  {isActive && (
                    <div className="absolute right-2 w-1.5 h-6 bg-white/30 rounded-full animate-in fade-in zoom-in duration-500" />
                  )}
                  {!isActive && (
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-slate-300" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Perfil de Usuario (Cristal) */}
      <div className="p-6 border-t border-slate-100 dark:border-slate-800/50 space-y-4">
        
        {/* Sidecar Status Indicator */}
        <div className="px-2 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Servicios</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="w-5 h-5 hover:bg-slate-100 dark:hover:bg-slate-800" 
              onClick={checkSidecars}
              title="Re-conectar servicios"
            >
              <RefreshCw className="w-3 h-3 text-slate-400" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(sidecarStatus).map(([name, status]) => (
              <div 
                key={name}
                onClick={() => status === 'closed' && reconnectSidecar(name)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-300",
                  status === 'closed' && "cursor-pointer hover:bg-red-500/10",
                  status === 'running' 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                    : "bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400"
                )}
                title={status === 'closed' ? `Click para intentar re-conectar ${name}` : `${name} en ejecución`}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  status === 'running' ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                )} />
                <span className="text-[9px] font-black uppercase tracking-tight">{name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/30 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-900 dark:text-white truncate uppercase tracking-tight">
              Usuario Admin
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 truncate">
              admin@cotu.com
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
