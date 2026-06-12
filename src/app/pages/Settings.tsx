import { useState, useEffect } from "react";
import { useData } from "../contexts/DataContext";
import type { DbStats } from "../../electron.d";
import { useTheme } from "../contexts/ThemeContext";
import {
  Settings as SettingsIcon,
  Columns,
  ScanSearch,
  Monitor,
  Moon,
  Sun,
  Layers,
  Building2,
  Plus,
  Trash2,
  HardDrive,
  Scissors,
  CheckCircle2,
  LayoutGrid,
  Database,
  User
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { cn } from "../components/ui/utils";

export function Settings() {
  const { settings, updateSettings, history, trimHistory } = useData();
  const { theme, setTheme } = useTheme();

  const [newInsurerName, setNewInsurerName] = useState("");
  const [newInsurerAliases, setNewInsurerAliases] = useState("");
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [isTrimming, setIsTrimming] = useState(false);
  const TRIM_KEEP = 50;

  const [operatorName, setOperatorName] = useState(settings.operatorName || "");
  const [operatorEmail, setOperatorEmail] = useState(settings.operatorEmail || "");

  useEffect(() => {
    if (settings.operatorName) setOperatorName(settings.operatorName);
    if (settings.operatorEmail) setOperatorEmail(settings.operatorEmail);
  }, [settings.operatorName, settings.operatorEmail]);

  useEffect(() => {
    if (window.electronAPI?.getDbStats) {
      window.electronAPI.getDbStats().then(setDbStats).catch(console.error);
    }
  }, [history]);

  const handleTrimHistory = async () => {
    setIsTrimming(true);
    try {
      await trimHistory(TRIM_KEEP);
      if (window.electronAPI?.getDbStats) {
        const stats = await window.electronAPI.getDbStats();
        setDbStats(stats);
      }
      toast.success(`Historial reducido`);
    } catch (err: any) {
      toast.error('Error al reducir historial');
    } finally {
      setIsTrimming(false);
    }
  };

  const handleColumnToggle = (column: string, value: boolean) => {
    updateSettings({ columns: { ...settings.columns, [column]: value } });
  };

  const handleScanningToggle = (setting: string, value: boolean) => {
    updateSettings({ scanning: { ...settings.scanning, [setting]: value } });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Configuración</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-lg">Personaliza el motor de auditoría y la interfaz</p>
        </div>
        <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
           <SettingsIcon className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Apariencia Glass */}
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500 text-white shadow-lg"><Monitor className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-black">Apariencia del Sistema</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <ThemeButton active={theme === "light"} onClick={() => setTheme("light")} icon={<Sun className="w-6 h-6" />} label="Modo Claro" desc="Interfaz luminosa" />
                <ThemeButton active={theme === "dark"} onClick={() => setTheme("dark")} icon={<Moon className="w-6 h-6" />} label="Modo Oscuro" desc="Alta concentración" />
              </div>
            </CardContent>
          </Card>

          {/* Motor de Escaneo Glass */}
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500 text-white shadow-lg"><ScanSearch className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-black">Motor de Escaneo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="space-y-4">
                  <SettingSwitch 
                    label="Solo Carpetas COTU" 
                    desc="Filtra archivos que contengan la palabra clave en su ruta" 
                    checked={settings.scanning.onlyCotuFolders} 
                    onCheckedChange={(c) => handleScanningToggle("onlyCotuFolders", c)}
                  />
                  <Separator className="opacity-50" />
                  <SettingSwitch 
                    label="Ignorar Sistema" 
                    desc="Excluye node_modules, .git y carpetas ocultas" 
                    checked={settings.scanning.ignoreSystemFolders} 
                    onCheckedChange={(c) => handleScanningToggle("ignoreSystemFolders", c)}
                  />
               </div>

               <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Profundidad de Búsqueda</label>
                  <Select value={settings.scanning.maxDepth.toString()} onValueChange={(v) => updateSettings({ scanning: { ...settings.scanning, maxDepth: parseInt(v) } })}>
                    <SelectTrigger className="h-12 rounded-xl font-bold bg-white/50 dark:bg-slate-900/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5" className="font-bold">5 niveles (Superficial)</SelectItem>
                      <SelectItem value="10" className="font-bold">10 niveles (Equilibrado)</SelectItem>
                      <SelectItem value="20" className="font-bold">20 niveles (Extremo)</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
            </CardContent>
          </Card>

          {/* Aseguradoras Glass */}
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-lg"><Building2 className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-black">Aseguradoras Personalizadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col md:flex-row gap-4 p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                <div className="flex-1 space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Nombre Oficial</Label>
                  <Input placeholder="Ej: Sura" value={newInsurerName} onChange={(e) => setNewInsurerName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex-[2] space-y-2">
                  <Label className="text-[10px] font-black uppercase text-slate-400">Alias (separados por coma)</Label>
                  <Input placeholder="Ej: suramericana, seguros sura" value={newInsurerAliases} onChange={(e) => setNewInsurerAliases(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => {
                    if (!newInsurerName) return;
                    updateSettings({ customInsurers: [...(settings.customInsurers || []), { name: newInsurerName, aliases: newInsurerAliases }] });
                    setNewInsurerName(""); setNewInsurerAliases(""); toast.success("Agregada");
                  }} className="h-11 rounded-xl bg-emerald-600 px-6 font-bold">
                    <Plus className="w-4 h-4 mr-2" /> AGREGAR
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                 {settings.customInsurers?.map((ins, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800 group transition-all hover:border-emerald-500/30">
                       <div>
                          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{ins.name}</p>
                          <p className="text-[10px] font-medium text-slate-500">{ins.aliases}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10" onClick={() => {
                         const newList = [...settings.customInsurers]; newList.splice(idx, 1);
                         updateSettings({ customInsurers: newList }); toast.success("Eliminada");
                       }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 ))}
              </div>
            </CardContent>
          </Card>

          {/* Rutas del Sistema */}
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500 text-white shadow-lg"><HardDrive className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-black">Rutas del Sistema</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ruta de Terapias</Label>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input 
                    value={settings.terapiasDir || "Sin configurar (usando home)"} 
                    disabled 
                    className="flex-1 h-12 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-500 font-bold"
                  />
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        const newPath = await window.electronAPI.selectDirectory();
                        if (newPath) {
                          updateSettings({ terapiasDir: newPath });
                          toast.success(`Carpeta de terapias cambiada con éxito`, {
                            description: newPath,
                          });
                        }
                      } catch (err) {
                        toast.error("Error al seleccionar la carpeta");
                      }
                    }}
                    className="h-12 px-6 rounded-xl font-bold border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 shrink-0"
                  >
                    Cambiar carpeta...
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Perfil del Operador */}
          <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
            <CardHeader className="p-8 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-505 bg-indigo-600 text-white shadow-lg"><User className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-black">Perfil del Operador</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nombre del Operador</Label>
                  <Input 
                    value={operatorName} 
                    onChange={(e) => setOperatorName(e.target.value)} 
                    placeholder="Ej: Usuario Admin"
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Correo Electrónico</Label>
                  <Input 
                    type="email"
                    value={operatorEmail} 
                    onChange={(e) => setOperatorEmail(e.target.value)} 
                    placeholder="Ej: admin@cotu.com"
                    className="h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={() => {
                    updateSettings({ operatorName, operatorEmail });
                    toast.success("Perfil del operador guardado con éxito");
                  }}
                  className="h-12 px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-500/20"
                >
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {/* Almacenamiento Glass */}
           <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800/50">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-500" /> Base de Datos Local
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 text-center">
                       <p className="text-2xl font-black">{dbStats?.count || history.length}</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sesiones</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 text-center">
                       <p className="text-2xl font-black">{dbStats?.sizeMB.toFixed(1) || '0.0'} MB</p>
                       <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tamaño</p>
                    </div>
                 </div>

                 <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-red-200 text-red-600 hover:bg-red-500/10" onClick={handleTrimHistory} disabled={isTrimming || history.length <= 50}>
                    <Scissors className="w-4 h-4 mr-2" /> REDUCIR HISTORIAL (TOP 50)
                 </Button>
              </CardContent>
           </Card>

           {/* Columnas Visibles */}
           <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-3xl overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-100 dark:border-slate-800/50">
                 <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-orange-500" /> Tabla y Reportes
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                 <ColumnSwitch label="N° Factura" checked={settings.columns.invoiceNumber} onChange={(v) => handleColumnToggle("invoiceNumber", v)} />
                 <ColumnSwitch label="Compañía" checked={settings.columns.company} onChange={(v) => handleColumnToggle("company", v)} />
                 <ColumnSwitch label="Monto" checked={settings.columns.amount} onChange={(v) => handleColumnToggle("amount", v)} />
                 <ColumnSwitch label="Mes / Año" checked={settings.columns.month} onChange={(v) => handleColumnToggle("month", v)} />
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

function ThemeButton({ active, onClick, icon, label, desc }: any) {
  return (
    <button onClick={onClick} className={cn("p-6 rounded-2xl border-2 transition-all text-left space-y-3 group", active ? "border-blue-600 bg-blue-500/5 shadow-lg" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700")}>
       <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", active ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30" : "bg-slate-100 dark:bg-slate-800 text-slate-500")}>
          {icon}
       </div>
       <div>
          <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">{label}</p>
          <p className="text-[11px] font-medium text-slate-500">{desc}</p>
       </div>
    </button>
  );
}

function SettingSwitch({ label, desc, checked, onCheckedChange }: any) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-sm">{label}</p>
        <p className="text-[11px] font-medium text-slate-500">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-90" />
    </div>
  );
}

function ColumnSwitch({ label, checked, onChange }: any) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
       <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{label}</span>
       <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}
