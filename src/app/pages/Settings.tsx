import { useState, useEffect } from "react";
import { useLocation } from "react-router";
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

  const location = useLocation();

  useEffect(() => {
    const target = location.state?.scrollTo as string | undefined;
    if (target) {
      const el = document.getElementById(target);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.state]);

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
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Configuración</h1>
          <p className="text-muted-foreground mt-1 font-medium text-lg">Personaliza el motor de auditoría y la interfaz</p>
        </div>
        <div className="p-3 rounded-2xl bg-muted text-muted-foreground">
           <SettingsIcon className="w-8 h-8" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Apariencia Glass */}
          <Card className="bg-card shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg"><Monitor className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-bold">Apariencia del Sistema</CardTitle>
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
          <Card id="scanning" className="bg-card shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg"><ScanSearch className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-bold">Motor de Escaneo</CardTitle>
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
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Profundidad de Búsqueda</label>
                  <Select value={settings.scanning.maxDepth.toString()} onValueChange={(v) => updateSettings({ scanning: { ...settings.scanning, maxDepth: parseInt(v) } })}>
                    <SelectTrigger className="h-12 rounded-xl font-bold bg-muted/50"><SelectValue /></SelectTrigger>
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
          <Card className="bg-card shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg"><Building2 className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-bold">Aseguradoras Personalizadas</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex flex-col md:flex-row gap-4 p-6 bg-muted/30 rounded-2xl border border-border">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Nombre Oficial</Label>
                  <Input placeholder="Ej: Sura" value={newInsurerName} onChange={(e) => setNewInsurerName(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex-[2] space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Alias (separados por coma)</Label>
                  <Input placeholder="Ej: suramericana, seguros sura" value={newInsurerAliases} onChange={(e) => setNewInsurerAliases(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="flex items-end">
                  <Button onClick={() => {
                    if (!newInsurerName) return;
                    updateSettings({ customInsurers: [...(settings.customInsurers || []), { name: newInsurerName, aliases: newInsurerAliases }] });
                    setNewInsurerName(""); setNewInsurerAliases(""); toast.success("Agregada");
                  }} className="h-11 rounded-xl bg-primary text-primary-foreground px-6 font-bold hover:bg-primary/90">
                    <Plus className="w-4 h-4 mr-2" /> AGREGAR
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                 {settings.customInsurers?.map((ins, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-card rounded-xl border border-border group transition-all">
                       <div>
                          <p className="font-bold text-foreground uppercase tracking-tight">{ins.name}</p>
                          <p className="text-xs font-medium text-muted-foreground">{ins.aliases}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10" onClick={() => {
                         const newList = [...settings.customInsurers]; newList.splice(idx, 1);
                         updateSettings({ customInsurers: newList }); toast.success("Eliminada");
                       }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                 ))}
              </div>
            </CardContent>
          </Card>

          {/* Rutas del Sistema */}
          <Card id="terapias" className="bg-card shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-muted-foreground shadow-lg"><HardDrive className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-bold">Rutas del Sistema</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Ruta de Terapias</Label>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input 
                    value={settings.terapiasDir || "Sin configurar (usando home)"} 
                    disabled 
                    className="flex-1 h-12 rounded-xl bg-muted/50 border-border text-muted-foreground font-bold"
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
                    className="h-12 px-6 rounded-xl font-bold border-border bg-card shrink-0"
                  >
                    Cambiar carpeta...
                  </Button>
                </div>
              </div>

              <Separator className="opacity-50" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Motor OCR (Tesseract)</Label>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary">REQUERIDO PARA PDF ESCANEADOS</Badge>
                </div>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input 
                    value={settings.tesseractPath || "No detectado (se buscará en PATH)"} 
                    disabled 
                    className="flex-1 h-12 rounded-xl bg-muted/50 border-border text-muted-foreground font-bold"
                  />
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      try {
                        const newPath = await window.electronAPI.selectFile({
                          filters: [{ name: "Ejecutables", extensions: ["exe"] }],
                          defaultPath: "C:\\Program Files\\Tesseract-OCR"
                        });
                        if (newPath) {
                          const base = newPath.split(/[\\/]/).pop()?.toLowerCase();
                          if (base !== 'tesseract.exe') {
                            toast.error('El archivo seleccionado no es tesseract.exe');
                            return;
                          }
                          try {
                            if (window.electronAPI?.tesseract?.validate) {
                              const result = await window.electronAPI.tesseract.validate(newPath);
                              if (!result?.ok) {
                                toast.error(result?.error || 'Validación de Tesseract fallida');
                                return;
                              }
                            } else {
                              toast.error('No se puede validar Tesseract (API no disponible)');
                              return;
                            }
                          } catch (err) {
                            toast.error((err as unknown as Error)?.message || 'Error al validar Tesseract');
                            return;
                          }
                          updateSettings({ tesseractPath: newPath });
                          toast.success('Ruta de Tesseract actualizada', {
                            description: newPath,
                          });
                        }
                      } catch (err) {
                        toast.error("Error al seleccionar el ejecutable");
                      }
                    }}
                    className="h-12 px-6 rounded-xl font-bold border-border bg-card shrink-0"
                  >
                    Localizar tesseract.exe
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Perfil del Operador */}
          <Card className="bg-card border-border shadow-md rounded-2xl overflow-hidden">
            <CardHeader className="p-8 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-muted text-muted-foreground"><User className="w-5 h-5" /></div>
                <CardTitle className="text-xl font-bold">Perfil del Operador</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Nombre del Operador</Label>
                  <Input 
                    value={operatorName} 
                    onChange={(e) => setOperatorName(e.target.value)} 
                    placeholder="Ej: Usuario Admin"
                    className="h-12 rounded-xl bg-muted/50 border-border font-bold text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Correo Electrónico</Label>
                  <Input 
                    type="email"
                    value={operatorEmail} 
                    onChange={(e) => setOperatorEmail(e.target.value)} 
                    placeholder="Ej: admin@cotu.com"
                    className="h-12 rounded-xl bg-muted/50 border-border font-bold text-foreground"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={() => {
                    updateSettings({ operatorName, operatorEmail });
                    toast.success("Perfil del operador guardado con éxito");
                  }}
                  className="h-12 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md"
                >
                  Guardar Cambios
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           {/* Almacenamiento Glass */}
           <Card className="bg-card shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="p-6 border-b border-border">
                 <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" /> Base de Datos Local
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-8">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-muted/50 text-center">
                       <p className="text-2xl font-bold">{dbStats?.count || history.length}</p>
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Sesiones</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-muted/50 text-center">
                       <p className="text-2xl font-bold">{dbStats?.sizeMB.toFixed(1) || '0.0'} MB</p>
                       <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tamaño</p>
                    </div>
                 </div>

                 <Button variant="outline" className="w-full h-12 rounded-xl font-bold border-destructive/20 text-destructive hover:bg-destructive/10" onClick={handleTrimHistory} disabled={isTrimming || history.length <= 50}>
                    <Scissors className="w-4 h-4 mr-2" /> REDUCIR HISTORIAL (TOP 50)
                 </Button>
              </CardContent>
           </Card>

           {/* Columnas Visibles */}
           <Card className="bg-card shadow-md rounded-2xl overflow-hidden">
              <CardHeader className="p-6 border-b border-border">
                 <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-primary" /> Tabla y Reportes
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

interface ThemeButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}

function ThemeButton({ active, onClick, icon, label, desc }: ThemeButtonProps) {
  return (
    <button onClick={onClick} className={cn("p-6 rounded-2xl border-2 transition-all text-left space-y-3 group", active ? "border-primary bg-primary/5 shadow-lg" : "border-border hover:border-border/80")}>
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110", active ? "bg-primary text-primary-foreground shadow-xl" : "bg-muted text-muted-foreground")}>
          {icon}
       </div>
       <div>
          <p className="font-bold text-foreground uppercase tracking-tight text-sm">{label}</p>
          <p className="text-xs font-medium text-muted-foreground">{desc}</p>
       </div>
    </button>
  );
}

interface SettingSwitchProps {
  label: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SettingSwitch({ label, desc, checked, onCheckedChange }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="font-bold text-foreground uppercase tracking-tight text-sm">{label}</p>
        <p className="text-xs font-medium text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="scale-90" />
    </div>
  );
}

interface ColumnSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ColumnSwitch({ label, checked, onChange }: ColumnSwitchProps) {
  return (
    <div className="flex items-center justify-between px-2 py-1">
       <span className="text-xs font-bold text-muted-foreground">{label}</span>
       <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}
