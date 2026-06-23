import { useState } from 'react';
import {
  LayoutDashboard,
  Scan,
  FileText,
  Building2,
  Settings,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FolderOpen,
  Download,
  Copy,
  ChevronRight,
  Plus,
  Palette,
  Folder,
  HardDrive,
  ChevronLeft
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Progress } from './components/ui/progress';
import { Checkbox } from './components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Separator } from './components/ui/separator';
import { Switch } from './components/ui/switch';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';

type Screen = 'dashboard' | 'scanner' | 'results' | 'reports' | 'config';

type InvoiceStatus = 'ENTREGADA' | 'PENDIENTE' | 'DEVUELTA';

interface Insurance {
  id: string;
  name: string;
  color: string;
  active: boolean;
  invoiceCount: number;
}

interface Invoice {
  id: string;
  fecha: string;
  numero: string;
  compania: string;
  fechaRefacturacion?: string;
  companiaRefacturada?: string;
  numeroRefactura?: string;
  estado: InvoiceStatus;
  observacion: string;
}

interface FolderNode {
  name: string;
  type: 'folder' | 'insurance';
  path: string;
  children?: FolderNode[];
  insuranceData?: Insurance;
}

const INSURANCES: Insurance[] = [
  { id: '1', name: 'ALFA', color: '#3B82F6', active: true, invoiceCount: 12 },
  { id: '2', name: 'ALLIANZ', color: '#0EA5E9', active: true, invoiceCount: 8 },
  { id: '3', name: 'AURORA', color: '#F97316', active: true, invoiceCount: 15 },
  { id: '4', name: 'AXXA COLPATRIA', color: '#EF4444', active: true, invoiceCount: 22 },
  { id: '5', name: 'BOLIVAR', color: '#DC2626', active: true, invoiceCount: 18 },
  { id: '6', name: 'CENFAR', color: '#10B981', active: true, invoiceCount: 5 },
  { id: '7', name: 'COLMENA', color: '#F59E0B', active: true, invoiceCount: 14 },
  { id: '8', name: 'COLSANITAS', color: '#06B6D4', active: true, invoiceCount: 20 },
  { id: '9', name: 'EQUIDAD', color: '#8B5CF6', active: true, invoiceCount: 11 },
  { id: '10', name: 'ESTADO', color: '#6366F1', active: true, invoiceCount: 9 },
  { id: '11', name: 'ESTADO SOAT', color: '#4F46E5', active: true, invoiceCount: 7 },
  { id: '12', name: 'HDII WTA LATAM S.A.S', color: '#EC4899', active: true, invoiceCount: 6 },
  { id: '13', name: 'LIBERTY (HDI SEGUROS COLOMBIA)', color: '#14B8A6', active: true, invoiceCount: 13 },
  { id: '14', name: 'MAPFRE', color: '#EF4444', active: true, invoiceCount: 19 },
  { id: '15', name: 'MEDIPORT', color: '#84CC16', active: true, invoiceCount: 4 },
  { id: '16', name: 'MUNDIAL', color: '#F59E0B', active: true, invoiceCount: 10 },
  { id: '17', name: 'POSITIVA', color: '#DC2626', active: true, invoiceCount: 16 },
  { id: '18', name: 'PREVISORA', color: '#0EA5E9', active: true, invoiceCount: 8 },
  { id: '19', name: 'SOAT SURA', color: '#059669', active: true, invoiceCount: 21 },
  { id: '20', name: 'SOLIDARIA', color: '#CA8A04', active: true, invoiceCount: 12 },
  { id: '21', name: 'SURA', color: '#059669', active: true, invoiceCount: 17 },
];

// Estructura de carpetas simulada
const createFolderStructure = (): FolderNode => {
  const currentYear = 2026;
  const previousYear = 2025;

  const createInsuranceFolders = (basePath: string): FolderNode[] => {
    return INSURANCES.map((insurance, idx) => ({
      name: insurance.name,
      type: 'insurance' as const,
      path: `${basePath}/${insurance.name}`,
      insuranceData: insurance
    }));
  };

  const createDayFolders = (monthPath: string, month: string, year: number): FolderNode[] => {
    const daysInMonth = month === '02 FEBRERO' ? 28 : 30;
    return Array.from({ length: Math.min(daysInMonth, 15) }, (_, i) => {
      const day = i + 1;
      const dayStr = day.toString().padStart(2, '0');
      const monthNames = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                          'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
      const monthName = monthNames[parseInt(month.split(' ')[0]) - 1];
      return {
        name: `${dayStr} ${monthName}`,
        type: 'folder' as const,
        path: `${monthPath}/${dayStr} ${monthName}`,
        children: createInsuranceFolders(`${monthPath}/${dayStr} ${monthName}`)
      };
    });
  };

  const createMonthFolders = (yearPath: string, year: number): FolderNode[] => {
    const months = [
      '01 ENERO', '02 FEBRERO', '03 MARZO', '04 ABRIL', '05 MAYO', '06 JUNIO',
      '07 JULIO', '08 AGOSTO', '09 SEPTIEMBRE', '10 OCTUBRE', '11 NOVIEMBRE', '12 DICIEMBRE'
    ];
    return months.slice(0, 4).map(month => ({
      name: month,
      type: 'folder' as const,
      path: `${yearPath}/${month}`,
      children: createDayFolders(`${yearPath}/${month}`, month, year)
    }));
  };

  return {
    name: 'FACTURACION',
    type: 'folder',
    path: 'C:/Users/factu/OneDrive/Desktop/FACTURACION',
    children: [
      {
        name: String(currentYear),
        type: 'folder',
        path: `C:/Users/factu/OneDrive/Desktop/FACTURACION/${currentYear}`,
        children: createMonthFolders(`C:/Users/factu/OneDrive/Desktop/FACTURACION/${currentYear}`, currentYear)
      },
      {
        name: String(previousYear),
        type: 'folder',
        path: `C:/Users/factu/OneDrive/Desktop/FACTURACION/${previousYear}`,
        children: createMonthFolders(`C:/Users/factu/OneDrive/Desktop/FACTURACION/${previousYear}`, previousYear)
      }
    ]
  };
};

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('dashboard');
  const [selectedInsurances, setSelectedInsurances] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>(INSURANCES);
  const [folderStructure] = useState<FolderNode>(createFolderStructure());
  const [currentPath, setCurrentPath] = useState<string[]>(['FACTURACION']);

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleScan = () => {
    if (selectedInsurances.size === 0) {
      toast.error('Selecciona al menos una aseguradora');
      return;
    }

    setScanning(true);
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setScanning(false);

          const mockInvoices: Invoice[] = Array.from(selectedInsurances).flatMap((insId) => {
            const insurance = insurances.find(i => i.id === insId);
            if (!insurance) return [];

            return Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
              id: `${insId}-${i}`,
              fecha: new Date().toLocaleDateString('es-CO'),
              numero: `COTU${Math.floor(Math.random() * 90000) + 10000}`,
              compania: insurance.name,
              estado: 'ENTREGADA' as InvoiceStatus,
              observacion: 'SIN NOVEDAD'
            }));
          });

          setInvoices(mockInvoices);
          setCurrentScreen('results');
          toast.success(`${mockInvoices.length} facturas escaneadas exitosamente`);
          return 100;
        }
        return prev + 5;
      });
    }, 100);
  };

  const copyToExcel = () => {
    const headers = ['FECHA DE LA FACTURA', 'N° FACTURA', 'COMPAÑÍA', 'FECHA DE REFACTURACIÓN',
                     'COMPAÑÍA REFACTURADA', 'N° DE REFACTURA', 'ESTADO', 'OBSERVACIÓN DE FACTURACIÓN'];

    const rows = invoices.map(inv => [
      inv.fecha,
      inv.numero,
      inv.compania,
      inv.fechaRefacturacion || '',
      inv.companiaRefacturada || '',
      inv.numeroRefactura || '',
      inv.estado,
      inv.observacion
    ]);

    const tsv = [headers, ...rows].map(row => row.join('\t')).join('\n');
    navigator.clipboard.writeText(tsv);
    toast.success('Datos copiados al portapapeles');
  };

  const totalScanned = invoices.length;
  const totalPending = invoices.filter(i => i.estado === 'PENDIENTE').length;
  const totalDelivered = invoices.filter(i => i.estado === 'ENTREGADA').length;
  const activeInsurances = insurances.filter(i => i.active).length;

  return (
    <div className="flex h-screen bg-background text-foreground dark">
      <Toaster />

      {/* Sidebar */}
      <aside className="w-60 border-r border-border flex flex-col"
             style={{ background: 'var(--sidebar)' }}>
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ArrowUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              ANTIGRAVITY
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <NavItem
            icon={<LayoutDashboard className="w-5 h-5" />}
            label="Dashboard"
            active={currentScreen === 'dashboard'}
            onClick={() => setCurrentScreen('dashboard')}
          />
          <NavItem
            icon={<Scan className="w-5 h-5" />}
            label="Escanear"
            active={currentScreen === 'scanner'}
            onClick={() => setCurrentScreen('scanner')}
          />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Reportes"
            active={currentScreen === 'reports'}
            onClick={() => setCurrentScreen('reports')}
          />
          <NavItem
            icon={<Building2 className="w-5 h-5" />}
            label="Aseguradoras"
            active={currentScreen === 'config'}
            onClick={() => setCurrentScreen('config')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Configuración"
            active={false}
            onClick={() => toast.info('Próximamente')}
          />
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-sm font-bold">
              AG
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Admin</div>
              <div className="text-xs text-muted-foreground">admin@antigravity.co</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-16 border-b border-border px-8 flex items-center justify-between backdrop-blur-sm bg-background/50 sticky top-0 z-10">
          <div>
            <h1 className="text-2xl font-bold">
              {currentScreen === 'dashboard' && 'Dashboard'}
              {currentScreen === 'scanner' && 'Escáner de Facturas'}
              {currentScreen === 'results' && 'Resultados del Escaneo'}
              {currentScreen === 'reports' && 'Reporte Diario'}
              {currentScreen === 'config' && 'Aseguradoras'}
            </h1>
            <p className="text-sm text-muted-foreground">{today}</p>
          </div>
        </header>

        {/* Content */}
        <div className="p-8">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              totalScanned={totalScanned}
              activeInsurances={activeInsurances}
              totalPending={totalPending}
              totalDelivered={totalDelivered}
              onScanClick={() => setCurrentScreen('scanner')}
            />
          )}

          {currentScreen === 'scanner' && (
            <ScannerScreen
              insurances={insurances}
              selectedInsurances={selectedInsurances}
              setSelectedInsurances={setSelectedInsurances}
              scanning={scanning}
              scanProgress={scanProgress}
              onScan={handleScan}
              folderStructure={folderStructure}
              currentPath={currentPath}
              setCurrentPath={setCurrentPath}
            />
          )}

          {currentScreen === 'results' && (
            <ResultsScreen
              invoices={invoices}
              setInvoices={setInvoices}
              insurances={insurances}
              onCopyToExcel={copyToExcel}
            />
          )}

          {currentScreen === 'reports' && (
            <ReportsScreen
              invoices={invoices}
              insurances={insurances}
              onCopyToExcel={copyToExcel}
            />
          )}

          {currentScreen === 'config' && (
            <ConfigScreen
              insurances={insurances}
              setInsurances={setInsurances}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent/5 hover:text-foreground'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </button>
  );
}

function DashboardScreen({
  totalScanned,
  activeInsurances,
  totalPending,
  totalDelivered,
  onScanClick
}: {
  totalScanned: number;
  activeInsurances: number;
  totalPending: number;
  totalDelivered: number;
  onScanClick: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-6">
        <StatCard
          title="Facturas escaneadas hoy"
          value={totalScanned}
          icon={<FileText className="w-6 h-6" />}
          color="from-primary to-primary/50"
        />
        <StatCard
          title="Aseguradoras activas"
          value={activeInsurances}
          icon={<Building2 className="w-6 h-6" />}
          color="from-accent to-accent/50"
        />
        <StatCard
          title="Pendientes"
          value={totalPending}
          icon={<Clock className="w-6 h-6" />}
          color="from-[#F59E0B] to-[#F59E0B]/50"
        />
        <StatCard
          title="Entregadas"
          value={totalDelivered}
          icon={<CheckCircle2 className="w-6 h-6" />}
          color="from-[#10B981] to-[#10B981]/50"
        />
      </div>

      {/* Action */}
      <div className="glass-card p-8 rounded-2xl text-center space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Scan className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Escanear nuevas facturas</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Inicia el proceso de escaneo automático de facturas desde las carpetas de las aseguradoras
        </p>
        <Button
          onClick={onScanClick}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
          size="lg"
        >
          <Scan className="w-5 h-5 mr-2" />
          Escanear carpeta
        </Button>
      </div>

      {/* Recent Activity */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-lg font-bold mb-4">Actividad reciente</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/20">
              <FolderOpen className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="font-medium">Escaneo completado</div>
                <div className="text-sm text-muted-foreground">
                  {15 - i * 5} facturas procesadas hace {i} hora{i > 1 ? 's' : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${color}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm text-muted-foreground">{title}</div>
    </div>
  );
}

function ScannerScreen({
  insurances,
  selectedInsurances,
  setSelectedInsurances,
  scanning,
  scanProgress,
  onScan,
  folderStructure,
  currentPath,
  setCurrentPath
}: {
  insurances: Insurance[];
  selectedInsurances: Set<string>;
  setSelectedInsurances: (s: Set<string>) => void;
  scanning: boolean;
  scanProgress: number;
  onScan: () => void;
  folderStructure: FolderNode;
  currentPath: string[];
  setCurrentPath: (path: string[]) => void;
}) {
  const toggleInsurance = (id: string) => {
    const newSet = new Set(selectedInsurances);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedInsurances(newSet);
  };

  const getCurrentFolder = (): FolderNode | null => {
    let current: FolderNode | null = folderStructure;
    for (let i = 1; i < currentPath.length; i++) {
      if (!current?.children) return null;
      current = current.children.find(c => c.name === currentPath[i]) || null;
      if (!current) return null;
    }
    return current;
  };

  const currentFolder = getCurrentFolder();
  const currentFolders = currentFolder?.children?.filter(c => c.type === 'folder') || [];
  const currentInsurances = currentFolder?.children?.filter(c => c.type === 'insurance') || [];

  const navigateToFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const navigateUp = () => {
    if (currentPath.length > 1) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  const navigateToIndex = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const availableInsurances = currentInsurances
    .map(node => node.insuranceData)
    .filter((ins): ins is Insurance => ins !== undefined);

  const toggleAll = () => {
    if (selectedInsurances.size === availableInsurances.length) {
      setSelectedInsurances(new Set());
    } else {
      setSelectedInsurances(new Set(availableInsurances.map(i => i.id)));
    }
  };

  const fullPath = currentFolder?.path || 'C:/Users/factu/OneDrive/Desktop/FACTURACION';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="glass-card p-4 rounded-xl">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <HardDrive className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">C:</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Users</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">factu</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">OneDrive</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Desktop</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
          {currentPath.map((part, index) => (
            <div key={index} className="flex items-center gap-2">
              <button
                onClick={() => navigateToIndex(index)}
                className={`hover:text-primary transition-colors ${
                  index === currentPath.length - 1 ? 'text-primary font-medium' : 'text-foreground'
                }`}
              >
                {part}
              </button>
              {index < currentPath.length - 1 && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={navigateUp}
          disabled={currentPath.length === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Atrás
        </Button>
        {currentInsurances.length > 0 && (
          <>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedInsurances.size === availableInsurances.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </Button>
            <div className="text-sm text-muted-foreground ml-auto">
              {selectedInsurances.size} de {availableInsurances.length} seleccionadas
            </div>
          </>
        )}
      </div>

      {/* Folders Grid */}
      {currentFolders.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Carpetas</h3>
          <div className="grid grid-cols-4 gap-3">
            {currentFolders.map((folder) => (
              <button
                key={folder.name}
                onClick={() => navigateToFolder(folder.name)}
                className="glass-card p-4 rounded-xl hover:border-primary border-2 border-transparent transition-all text-left group"
              >
                <div className="flex flex-col items-center gap-2">
                  <Folder className="w-12 h-12 text-primary group-hover:text-accent transition-colors" />
                  <div className="text-sm font-medium text-center truncate w-full">
                    {folder.name}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Insurance Grid */}
      {currentInsurances.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Aseguradoras disponibles</h3>
          <div className="grid grid-cols-3 gap-4">
            {availableInsurances.map((insurance) => (
              <div
                key={insurance.id}
                onClick={() => toggleInsurance(insurance.id)}
                className={`glass-card p-4 rounded-xl text-left transition-all border-2 cursor-pointer ${
                  selectedInsurances.has(insurance.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox checked={selectedInsurances.has(insurance.id)} readOnly />
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-bold mb-1 truncate"
                      style={{ color: insurance.color }}
                    >
                      {insurance.name}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {insurance.invoiceCount} facturas detectadas
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {currentFolders.length === 0 && currentInsurances.length === 0 && (
        <div className="glass-card p-12 rounded-2xl text-center">
          <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">Esta carpeta está vacía</p>
        </div>
      )}

      {/* Scan Button */}
      {currentInsurances.length > 0 && (
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <Button
            onClick={onScan}
            disabled={scanning || selectedInsurances.size === 0}
            className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity"
            size="lg"
          >
            <Scan className="w-5 h-5 mr-2" />
            {scanning ? 'Escaneando...' : 'Escanear seleccionadas'}
          </Button>

          {scanning && (
            <div className="space-y-2">
              <Progress value={scanProgress} className="h-2" />
              <div className="text-sm text-center text-muted-foreground">
                Procesando facturas... {scanProgress}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultsScreen({
  invoices,
  setInvoices,
  insurances,
  onCopyToExcel
}: {
  invoices: Invoice[];
  setInvoices: (invoices: Invoice[]) => void;
  insurances: Insurance[];
  onCopyToExcel: () => void;
}) {
  const updateInvoice = (id: string, field: keyof Invoice, value: any) => {
    setInvoices(invoices.map(inv =>
      inv.id === id ? { ...inv, [field]: value } : inv
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {invoices.length} facturas escaneadas
        </div>
        <Button
          onClick={onCopyToExcel}
          className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
        >
          <Copy className="w-4 h-4 mr-2" />
          Copiar al Excel
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr className="text-sm">
                <th className="text-left p-4 font-bold">FECHA DE LA FACTURA</th>
                <th className="text-left p-4 font-bold">N° FACTURA</th>
                <th className="text-left p-4 font-bold">COMPAÑÍA</th>
                <th className="text-left p-4 font-bold">FECHA DE REFACTURACIÓN</th>
                <th className="text-left p-4 font-bold">COMPAÑÍA REFACTURADA</th>
                <th className="text-left p-4 font-bold">N° DE REFACTURA</th>
                <th className="text-left p-4 font-bold">ESTADO</th>
                <th className="text-left p-4 font-bold">OBSERVACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const insurance = insurances.find(i => i.name === invoice.compania);
                return (
                  <tr key={invoice.id} className="border-b border-border/50 hover:bg-muted/5">
                    <td className="p-4 text-sm">{invoice.fecha}</td>
                    <td className="p-4 text-sm font-medium">{invoice.numero}</td>
                    <td className="p-4">
                      <span
                        className="text-sm font-bold"
                        style={{ color: insurance?.color }}
                      >
                        {invoice.compania}
                      </span>
                    </td>
                    <td className="p-4">
                      <input
                        type="date"
                        value={invoice.fechaRefacturacion || ''}
                        onChange={(e) => updateInvoice(invoice.id, 'fechaRefacturacion', e.target.value)}
                        className="bg-input border border-border rounded px-2 py-1 text-sm w-full"
                      />
                    </td>
                    <td className="p-4">
                      <Select
                        value={invoice.companiaRefacturada || ''}
                        onValueChange={(value) => updateInvoice(invoice.id, 'companiaRefacturada', value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {insurances.map(ins => (
                            <SelectItem key={ins.id} value={ins.name}>
                              <span style={{ color: ins.color }}>{ins.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                      <input
                        type="text"
                        value={invoice.numeroRefactura || ''}
                        onChange={(e) => updateInvoice(invoice.id, 'numeroRefactura', e.target.value)}
                        className="bg-input border border-border rounded px-2 py-1 text-sm w-full"
                        placeholder="N° Refactura"
                      />
                    </td>
                    <td className="p-4">
                      <Select
                        value={invoice.estado}
                        onValueChange={(value) => updateInvoice(invoice.id, 'estado', value as InvoiceStatus)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTREGADA">
                            <span className="text-[#10B981] font-medium">ENTREGADA</span>
                          </SelectItem>
                          <SelectItem value="PENDIENTE">
                            <span className="text-[#F59E0B] font-medium">PENDIENTE</span>
                          </SelectItem>
                          <SelectItem value="DEVUELTA">
                            <span className="text-[#EF4444] font-medium">DEVUELTA</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                      <input
                        type="text"
                        value={invoice.observacion}
                        onChange={(e) => updateInvoice(invoice.id, 'observacion', e.target.value)}
                        className="bg-input border border-border rounded px-2 py-1 text-sm w-full"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReportsScreen({
  invoices,
  insurances,
  onCopyToExcel
}: {
  invoices: Invoice[];
  insurances: Insurance[];
  onCopyToExcel: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <input
              type="date"
              value={new Date().toISOString().split('T')[0]}
              onChange={() => {}}
              className="bg-input border border-border rounded-lg px-4 py-2"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          <Button
            onClick={onCopyToExcel}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Copy className="w-4 h-4 mr-2" />
            COPIAR REPORTE
          </Button>
        </div>
      </div>

      {/* Report Title */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-2xl font-bold text-center mb-2">NOVEDADES FACTURACIÓN</h2>
        <p className="text-center text-muted-foreground">
          Reporte del día {new Date().toLocaleDateString('es-CO')}
        </p>
      </div>

      {/* Report Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/10">
              <tr className="text-sm">
                <th className="text-left p-4 font-bold">FECHA DE LA FACTURA</th>
                <th className="text-left p-4 font-bold">N° FACTURA</th>
                <th className="text-left p-4 font-bold">COMPAÑÍA</th>
                <th className="text-left p-4 font-bold">FECHA DE REFACTURACIÓN</th>
                <th className="text-left p-4 font-bold">COMPAÑÍA REFACTURADA</th>
                <th className="text-left p-4 font-bold">N° DE REFACTURA</th>
                <th className="text-left p-4 font-bold">ESTADO</th>
                <th className="text-left p-4 font-bold">OBSERVACIÓN DE FACTURACIÓN</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4 text-muted-foreground">
                      <FileText className="w-12 h-12 opacity-50" />
                      <div>No hay facturas escaneadas para hoy</div>
                      <div className="text-sm">Inicia un escaneo para generar el reporte</div>
                    </div>
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => {
                  const insurance = insurances.find(i => i.name === invoice.compania);
                  return (
                    <tr key={invoice.id} className="border-b border-border/50">
                      <td className="p-4 text-sm">{invoice.fecha}</td>
                      <td className="p-4 text-sm font-medium">{invoice.numero}</td>
                      <td className="p-4">
                        <span
                          className="text-sm font-bold"
                          style={{ color: insurance?.color }}
                        >
                          {invoice.compania}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{invoice.fechaRefacturacion || '-'}</td>
                      <td className="p-4">
                        {invoice.companiaRefacturada && (
                          <span
                            className="text-sm font-bold"
                            style={{
                              color: insurances.find(i => i.name === invoice.companiaRefacturada)?.color
                            }}
                          >
                            {invoice.companiaRefacturada}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-sm">{invoice.numeroRefactura || '-'}</td>
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                            invoice.estado === 'ENTREGADA'
                              ? 'bg-[#10B981]/10 text-[#10B981]'
                              : invoice.estado === 'PENDIENTE'
                              ? 'bg-[#F59E0B]/10 text-[#F59E0B]'
                              : 'bg-[#EF4444]/10 text-[#EF4444]'
                          }`}
                        >
                          {invoice.estado === 'ENTREGADA' && <CheckCircle2 className="w-3 h-3" />}
                          {invoice.estado === 'PENDIENTE' && <Clock className="w-3 h-3" />}
                          {invoice.estado === 'DEVUELTA' && <XCircle className="w-3 h-3" />}
                          {invoice.estado}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{invoice.observacion}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl text-center">
            <div className="text-3xl font-bold text-[#10B981] mb-2">
              {invoices.filter(i => i.estado === 'ENTREGADA').length}
            </div>
            <div className="text-sm text-muted-foreground">Entregadas</div>
          </div>
          <div className="glass-card p-6 rounded-2xl text-center">
            <div className="text-3xl font-bold text-[#F59E0B] mb-2">
              {invoices.filter(i => i.estado === 'PENDIENTE').length}
            </div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </div>
          <div className="glass-card p-6 rounded-2xl text-center">
            <div className="text-3xl font-bold text-[#EF4444] mb-2">
              {invoices.filter(i => i.estado === 'DEVUELTA').length}
            </div>
            <div className="text-sm text-muted-foreground">Devueltas</div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigScreen({
  insurances,
  setInsurances
}: {
  insurances: Insurance[];
  setInsurances: (insurances: Insurance[]) => void;
}) {
  const toggleInsurance = (id: string) => {
    setInsurances(insurances.map(ins =>
      ins.id === id ? { ...ins, active: !ins.active } : ins
    ));
  };

  const updateColor = (id: string, color: string) => {
    setInsurances(insurances.map(ins =>
      ins.id === id ? { ...ins, color } : ins
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="text-xl font-bold mb-2">Gestión de Aseguradoras</h2>
        <p className="text-sm text-muted-foreground">
          Activa o desactiva aseguradoras y personaliza sus colores
        </p>
      </div>

      {/* Insurances List */}
      <div className="grid gap-3">
        {insurances.map((insurance) => (
          <div
            key={insurance.id}
            className="glass-card p-4 rounded-xl flex items-center gap-4"
          >
            <Switch
              checked={insurance.active}
              onCheckedChange={() => toggleInsurance(insurance.id)}
            />
            <div className="flex-1">
              <div
                className="font-bold"
                style={{ color: insurance.color }}
              >
                {insurance.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {insurance.invoiceCount} facturas detectadas
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <input
                type="color"
                value={insurance.color}
                onChange={(e) => updateColor(insurance.id, e.target.value)}
                className="w-12 h-8 rounded border border-border cursor-pointer"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
