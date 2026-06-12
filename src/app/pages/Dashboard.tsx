import { useState, useEffect, useCallback, useMemo } from "react";
import { useData } from "../contexts/DataContext";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigate } from "react-router";
import {
  TrendingUp,
  FileText,
  Building2,
  DollarSign,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Heart,
  History,
  ChevronRight,
  BarChart2
} from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import { Badge } from "../components/ui/badge";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "../components/ui/utils";

const COLORS = [
  "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#ef4444", "#14b8a6", "#f97316", "#a855f7",
  "#84cc16", "#64748b",
];

import { DashboardData, MOCK_DASHBOARD_DATA } from "../utils/mockAnalytics";

function calcChange(current: number, prev: number | null): { text: string; positive: boolean | null } {
  if (prev === null || prev === 0) return { text: "—", positive: null };
  const pct = ((current - prev) / prev) * 100;
  return { text: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, positive: pct >= 0 };
}

function formatCOP(value: number): string {
  if (value === 0) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString("es-CO")}`;
}

const renderCustomPieLabel = ({
  cx, cy, midAngle, innerRadius, outerRadius, percent,
}: any) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function Dashboard() {
  const navigate = useNavigate();
  const { history, currentScan } = useData();
  const [stats, setStats] = useState({ pendingDocs: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await (window as any).electronAPI?.dashboard?.getStats?.();
      if (res) setStats(res);
    } catch (err) {
      console.error("Error fetching dashboard stats:", err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStats();
    // Re-trigger data computation by forcing state update
    setTimeout(() => setIsRefreshing(false), 600);
  }, [fetchStats]);

  const dashboardData = useMemo(() => {
    const activeInvoices = currentScan?.invoices ?? (history.length > 0 ? history[0].invoices : null);
    const prevInvoices = history.length >= 2 ? history[1].invoices : null;

    if (!activeInvoices) return null;

    const totalInvoices = activeInvoices.length;
    const prevTotal = prevInvoices ? prevInvoices.length : null;

    const companyStats = activeInvoices.reduce((acc: Record<string, number>, invoice) => {
      acc[invoice.company] = (acc[invoice.company] || 0) + 1;
      return acc;
    }, {});

    const prevCompanySet = prevInvoices ? new Set(prevInvoices.map((i) => i.company)).size : null;
    const uniqueCompanies = new Set(activeInvoices.map((i) => i.company)).size;

    const topCompanies = Object.entries(companyStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 12)
      .map(([name, value]) => ({ name: name.split(" ")[0], value, fullName: name }));

    const sortedEntries = Object.entries(companyStats).sort(([, a], [, b]) => b - a);
    const top8 = sortedEntries.slice(0, 8);
    const rest = sortedEntries.slice(8);
    const companyPieData = top8.map(([name, value]) => ({
      name: name.split(" ")[0],
      fullName: name,
      value,
    }));
    if (rest.length > 0) {
      const othersTotal = rest.reduce((sum, [, v]) => sum + v, 0);
      companyPieData.push({ name: "Otros", fullName: "Otras aseguradoras", value: othersTotal });
    }

    const [topCompanyEntry] = Object.entries(companyStats).sort(([, a], [, b]) => b - a);

    const yearStats = activeInvoices.reduce((acc: Record<string, number>, invoice) => {
      acc[invoice.year] = (acc[invoice.year] || 0) + 1;
      return acc;
    }, {});

    const yearData = Object.entries(yearStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({ name, value }));

    const MONTHS_ORDER = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const monthlyData: Record<string, { month: string; invoices: number; sortKey: number }> = {};
    activeInvoices.forEach((invoice) => {
      const key = `${invoice.year}-${invoice.month}`;
      if (!monthlyData[key]) {
        const mi = MONTHS_ORDER.findIndex(m => m.toLowerCase() === invoice.month.toLowerCase());
        monthlyData[key] = { month: invoice.month.substring(0, 3), invoices: 0, sortKey: parseInt(invoice.year) * 100 + mi };
      }
      monthlyData[key].invoices += 1;
    });

    const monthlyTrend = Object.values(monthlyData)
      .sort((a, b) => a.sortKey - b.sortKey)
      .slice(-8)
      .map(({ month, invoices }) => ({ month, invoices }));

    const totalAmount = activeInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const activeScan = currentScan ?? (history.length > 0 ? history[0] : null);
    const amountSuccess = activeScan?.stats?.amountExtractionSuccess ?? activeInvoices.filter(i => i.amount > 0).length;
    const amountFailed = activeScan?.stats?.amountExtractionFailed ?? activeInvoices.filter(i => i.amount === 0).length;
    const extractionRate = (amountSuccess + amountFailed) > 0
      ? Math.round((amountSuccess / (amountSuccess + amountFailed)) * 100)
      : null;

    let prevTopCompany: string | null = null;
    if (prevInvoices && prevInvoices.length > 0) {
      const prevCompanyStats = prevInvoices.reduce((acc: Record<string, number>, invoice) => {
        acc[invoice.company] = (acc[invoice.company] || 0) + 1;
        return acc;
      }, {});
      const sortedPrev = Object.entries(prevCompanyStats).sort(([, a], [, b]) => b - a);
      if (sortedPrev.length > 0) {
        prevTopCompany = sortedPrev[0][0];
      }
    }

    return {
      totalInvoices,
      uniqueCompanies,
      topCompanyName: topCompanyEntry ? topCompanyEntry[0] : "N/A",
      topCompanyCount: topCompanyEntry ? Number(topCompanyEntry[1]) : 0,
      totalAmount,
      topCompanies,
      companyPieData,
      yearData,
      monthlyTrend,
      prevTotal,
      prevCompanies: prevCompanySet,
      amountSuccess,
      amountFailed,
      extractionRate,
      prevTopCompany,
    };
  }, [currentScan, history]);

  const isEmpty = !dashboardData;
  const activeData = dashboardData || MOCK_DASHBOARD_DATA;

  return (
    <div className={cn("relative w-full transition-all duration-500", isEmpty && "h-[calc(100vh-140px)] flex items-center justify-center overflow-hidden")}>
      <div className={cn(
        "transition-all duration-700 w-full",
        isEmpty ? "blur-md opacity-20 grayscale pointer-events-none select-none scale-[0.98] h-full overflow-hidden" : "blur-0 opacity-100 scale-100"
      )}>
        <DashboardView 
          data={activeData} 
          historyLength={history.length} 
          pendingDocs={stats.pendingDocs}
          onNavigate={navigate}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {isEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-50 animate-in fade-in zoom-in duration-500">
           <div className="max-w-xl w-full p-12 rounded-[40px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-white dark:border-slate-800 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] flex flex-col items-center space-y-8 text-center">
              <div className="w-24 h-24 rounded-3xl bg-blue-500 text-white flex items-center justify-center shadow-2xl shadow-blue-500/40 rotate-3 transition-transform">
                <FileText className="w-12 h-12" />
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard en Espera</h2>
                <p className="text-slate-500 dark:text-slate-400 text-lg font-medium leading-relaxed">
                  Detectamos que aún no has procesado facturas. <br/>
                  Realiza tu primer escaneo para activar las métricas inteligentes.
                </p>
              </div>
              <div className="w-full pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/scanner", { state: { autoSelect: true } })} 
                  className="w-full h-20 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xl shadow-2xl shadow-blue-500/30 gap-4 group active:scale-[0.98] transition-all"
                >
                  <Search className="w-8 h-8 group-hover:scale-110 transition-transform" />
                  INICIAR ESCANEO DE FACTURAS
                  <ChevronRight className="w-6 h-6 opacity-50" />
                </Button>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-6">
                  Sincronizado con Motor @COTU-ANALYTICS V3.2
                </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

interface DashboardViewProps {
  data: DashboardData;
  historyLength: number;
  pendingDocs: number;
  onNavigate: (path: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

interface QuickActionCardProps {
  title: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

function DashboardView({ data, historyLength, pendingDocs, onNavigate, onRefresh, isRefreshing }: DashboardViewProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tooltipStyle = isDark
    ? { backgroundColor: "rgba(15,23,42,0.97)", border: "1px solid #334155", borderRadius: "12px", color: "#f1f5f9" }
    : { backgroundColor: "rgba(255,255,255,0.97)", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#0f172a" };
  const gridStroke = isDark ? "#1e293b" : "#e2e8f0";

  const kpis = [
    {
      title: "Total Facturas",
      value: data.totalInvoices.toLocaleString("es-CO"),
      subtitle: data.prevTotal !== null ? `vs ${data.prevTotal} anterior` : "escaneo actual",
      icon: FileText,
      change: calcChange(data.totalInvoices, data.prevTotal),
      color: "from-blue-600 to-cyan-500",
    },
    {
      title: "Aseguradoras",
      value: data.uniqueCompanies.toString(),
      subtitle: `Top: ${data.topCompanyName.split(" ")[0]}`,
      icon: Building2,
      change: calcChange(data.uniqueCompanies, data.prevCompanies),
      color: "from-emerald-600 to-teal-500",
    },
    {
      title: "Top Compañía",
      value: data.topCompanyName.split(" ")[0],
      subtitle: `${data.topCompanyCount} facturas`,
      icon: TrendingUp,
      change: { 
        text: data.prevTopCompany ? `vs ${data.prevTopCompany.split(" ")[0]} anterior` : "liderando", 
        positive: data.prevTopCompany ? (data.topCompanyName === data.prevTopCompany) : null 
      },
      color: "from-purple-600 to-pink-500",
    },
    {
      title: "Monto Total",
      value: formatCOP(data.totalAmount),
      subtitle: data.totalAmount > 0 ? "extraído de PDFs" : "montos no disponibles",
      icon: DollarSign,
      change: { text: "", positive: null },
      color: "from-orange-600 to-red-500",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      {/* Header Premium */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Dashboard Central</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-lg">Análisis ejecutivo y estado de módulos</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 px-6 rounded-2xl font-bold border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/40 backdrop-blur-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} /> Actualizar Datos
          </Button>
        </div>
      </div>

      {/* Accesos Rápidos Estilo PDF Tools */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <QuickActionCard 
            title="Terapias" 
            label={`${pendingDocs} documentos`}
            desc="Pendientes por procesar"
            icon={<Heart className="w-6 h-6" />}
            color="bg-pink-500"
            onClick={() => onNavigate('/terapias')}
          />
          <QuickActionCard 
            title="PDF Tools" 
            label="Motores V2.0"
            desc="Manipulación profesional"
            icon={<FileText className="w-6 h-6" />}
            color="bg-blue-500"
            onClick={() => onNavigate('/pdf-tools')}
          />
          <QuickActionCard 
            title="Escáner" 
            label="OCR Inteligente"
            desc="Extracción masiva"
            icon={<Search className="w-6 h-6" />}
            color="bg-emerald-500"
            onClick={() => onNavigate('/scanner')}
          />
          <QuickActionCard 
            title="Historial" 
            label="Base Local"
            desc="Consulta de reportes"
            icon={<History className="w-6 h-6" />}
            color="bg-purple-500"
            onClick={() => onNavigate('/history')}
          />
      </div>

      <Separator className="opacity-50" />

      {/* KPI Cards Estilo Glass */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const hasChange = kpi.change.text && kpi.change.positive !== null;
          return (
            <Card key={kpi.title} className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{kpi.title}</p>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</h3>
                  </div>
                  <div className={cn("p-3 rounded-xl text-white shadow-lg bg-gradient-to-br group-hover:scale-110 transition-transform", kpi.color)}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  {hasChange && (
                    <Badge variant={kpi.change.positive ? "outline" : "destructive"} className={cn("h-6 text-[11px] font-black border-none", kpi.change.positive ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
                      {kpi.change.positive ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                      {kpi.change.text}
                    </Badge>
                  )}
                  <span className="text-[11px] font-medium text-slate-500 truncate">{kpi.subtitle}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        {/* Tendencia Mensual — AreaChart con gradiente */}
        <Card className="lg:col-span-2 bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Tendencia Mensual</h3>
              <p className="text-sm text-slate-500 font-medium">Volumen de facturación histórico</p>
            </div>
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-500">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="areaGradientBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#94a3b8" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [value.toLocaleString("es-CO"), "Facturas"]}
                />
                <Area
                  type="monotone"
                  dataKey="invoices"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#areaGradientBlue)"
                  dot={{ r: 5, fill: "#3b82f6", strokeWidth: 2, stroke: isDark ? "#0f172a" : "#fff" }}
                  activeDot={{ r: 7, strokeWidth: 0, fill: "#60a5fa" }}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top Aseguradoras — PieChart con tooltip enriquecido */}
        <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
          <div className="mb-6 text-center">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Top Aseguradoras</h3>
            <p className="text-sm text-slate-500 font-medium">Distribución por volumen</p>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.companyPieData}
                  cx="50%" cy="50%"
                  innerRadius={60} outerRadius={80}
                  paddingAngle={6}
                  dataKey="value"
                  label={renderCustomPieLabel}
                  labelLine={false}
                >
                  {data.companyPieData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-none outline-none" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number, _name: string, props: any) => [
                    `${value.toLocaleString("es-CO")} facturas`,
                    props.payload?.fullName ?? props.name
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Distribución por Año — BarChart horizontal (yearData activado) */}
      {data.yearData.length > 0 && (
        <Card className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Distribución por Año</h3>
              <p className="text-sm text-slate-500 font-medium">Volumen histórico acumulado</p>
            </div>
            <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-500">
              <BarChart2 className="w-6 h-6" />
            </div>
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.yearData} layout="vertical" barCategoryGap="30%">
                <defs>
                  <linearGradient id="barGradientPurple" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(val) => val.toLocaleString()} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} width={45} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [value.toLocaleString("es-CO"), "Facturas"]}
                />
                <Bar dataKey="value" fill="url(#barGradientPurple)" radius={[0, 6, 6, 0]} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
      
      {/* Banner de Calidad (Look de resultado PDF Tools) */}
      <div className="p-10 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 shadow-xl flex flex-col md:flex-row items-center gap-10">
        <div className="relative w-40 h-40 flex items-center justify-center shrink-0">
           <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-emerald-500/5" />
              <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={439.82} strokeDashoffset={439.82 - (439.82 * (data.extractionRate || 0)) / 100} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" strokeLinecap="round" />
           </svg>
           <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400">{data.extractionRate}%</span>
              <span className="text-[10px] font-black text-emerald-600/60 uppercase tracking-widest">Calidad OCR</span>
           </div>
        </div>
        <div className="flex-1 space-y-6">
           <div className="space-y-2">
             <h3 className="text-2xl font-black text-slate-900 dark:text-white">Efectividad del Motor Inteligente</h3>
             <p className="text-slate-500 dark:text-slate-400 font-medium">Precisión de extracción de montos y metadatos en facturas COTU detectadas.</p>
           </div>
           <div className="flex flex-wrap gap-10">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Documentos Exitosos</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xl font-bold">{data.amountSuccess}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fallas de Lectura</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xl font-bold">{data.amountFailed}</span>
                </div>
              </div>
              <div className="flex-1" />
              <Button size="lg" className="h-14 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-lg shadow-emerald-500/20 gap-2" onClick={() => onNavigate('/scanner')}>
                OPTIMIZAR ESCANEO <ChevronRight className="w-5 h-5" />
              </Button>
           </div>
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({ title, label, desc, icon, color, onClick }: QuickActionCardProps) {
  return (
    <Card
      className="bg-white/50 dark:bg-slate-950/40 backdrop-blur-md border-slate-200 dark:border-slate-800 shadow-lg hover:border-blue-500/50 hover:shadow-2xl transition-all cursor-pointer group rounded-2xl overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-6 flex items-center gap-5">
        <div className={cn("p-3.5 rounded-2xl text-white shadow-xl group-hover:scale-110 group-hover:rotate-3 transition-transform", color)}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{title}</h3>
            <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-[9px] font-black px-1.5 h-4 border-none">{label}</Badge>
          </div>
          <p className="text-xs text-slate-500 font-medium truncate">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
