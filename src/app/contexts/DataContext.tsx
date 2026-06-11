import { createContext, useContext, useState, ReactNode, useEffect } from "react";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  company: string;
  month: string;
  year: string;
  detail: string;
  filePath: string;
  amount: number; // 0 si no fue posible extraer
  date: string;
}

export interface ScanStats {
  totalFilesProcessed: number;
  skippedByExtension: number;
  skippedByDateRange: number;
  skippedDuplicates: number;
  duplicatesLog: { invoiceNumber: string; keptPath: string; discardedPath: string }[];
  amountExtractionFailed: number;
  amountExtractionSuccess: number;
}

export interface ScanResult {
  id: string;
  timestamp: string;
  type: "day" | "week" | "month" | "year" | "custom";
  dateRange: { start: string; end: string };
  basePath: string;
  totalInvoices: number;
  invoices: Invoice[];
  exportPath?: string;
  scanDuration: number;
  stats?: ScanStats; // estadísticas de escaneo (opcional para compatibilidad con historial antiguo)
}

export interface Settings {
  columns: {
    invoiceNumber: boolean;
    company: boolean;
    month: boolean;
    year: boolean;
    detail: boolean;
    filePath: boolean;
    amount: boolean;
  };
  scanning: {
    onlyCotuFolders: boolean;
    ignoreSystemFolders: boolean;
    maxDepth: number;
  };
  display: {
    rowsPerPage: number;
    compactMode: boolean;
  };
  // Aseguradoras adicionales definidas por el usuario
  customInsurers: { name: string; aliases: string }[];
}

interface DataContextType {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  history: ScanResult[];
  addToHistory: (result: ScanResult) => void;
  deleteFromHistory: (id: string) => void;
  clearHistory: () => void;
  /** Fix #11: Reduce el historial a los últimos `keepCount` escaneos */
  trimHistory: (keepCount: number) => Promise<void>;
  currentScan: ScanResult | null;
  setCurrentScan: (scan: ScanResult | null) => void;
  sidecarStatus: Record<string, 'running' | 'closed' | 'unknown'>;
  checkSidecars: () => Promise<void>;
  reconnectSidecar: (name: string) => Promise<void>;
}

const defaultSettings: Settings = {
  columns: {
    invoiceNumber: true,
    company: true,
    month: true,
    year: true,
    detail: true,
    filePath: false,
    amount: false,
  },
  scanning: {
    onlyCotuFolders: true,
    ignoreSystemFolders: true,
    maxDepth: 10,
  },
  display: {
    rowsPerPage: 100,
    compactMode: false,
  },
  customInsurers: [],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem("ordertrack-settings");
    if (!saved) return defaultSettings;
    // Merge con defaultSettings para garantizar que nuevas keys existan
    const parsed = JSON.parse(saved);
    return {
      ...defaultSettings,
      ...parsed,
      columns: { ...defaultSettings.columns, ...parsed.columns },
      scanning: { ...defaultSettings.scanning, ...parsed.scanning },
      display: { ...defaultSettings.display, ...parsed.display },
      customInsurers: parsed.customInsurers ?? [],
    };
  });

  const [history, setHistory] = useState<ScanResult[]>([]);

  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);

  const [sidecarStatus, setSidecarStatus] = useState<Record<string, 'running' | 'closed' | 'unknown'>>({
    Terapias: 'unknown',
    PDF: 'unknown',
  });

  // Cargar historial y settings asincronamente desde DB (o localStorage en fallback)
  useEffect(() => {
    const initData = async () => {
      if (window.electronAPI?.getSettings) {
        try {
          const savedSettings = await window.electronAPI.getSettings();
          if (savedSettings) {
            setSettings(prev => ({
              ...prev,
              ...savedSettings,
              columns: { ...prev.columns, ...(savedSettings.columns || {}) },
              scanning: { ...prev.scanning, ...(savedSettings.scanning || {}) },
              display: { ...prev.display, ...(savedSettings.display || {}) },
              customInsurers: savedSettings.customInsurers ?? prev.customInsurers,
            }));
          }
        } catch (err) {
          console.error('[DataContext] Error cargando settings desde IPC:', err);
        }
      }

      if (window.electronAPI?.getHistory) {
        try {
          const savedHistory = await window.electronAPI.getHistory();
          setHistory(savedHistory || []);
          if (currentScan === null && savedHistory?.length > 0) {
            setCurrentScan(savedHistory[0]);
          }
        } catch (err) {
          console.error('[DataContext] Error cargando historial desde IPC:', err);
        }
      } else {
        const saved = localStorage.getItem("ordertrack-history");
        if (saved) {
          try {
            const parsed: ScanResult[] = JSON.parse(saved);
            setHistory(parsed);
            if (currentScan === null && parsed.length > 0) setCurrentScan(parsed[0]);
          } catch (err) {
            console.error('[DataContext] Error parseando historial de localStorage:', err);
          }
        }
      }
    };
    initData();
    
    // Suscribirse a eventos de Sidecar Status
    if ((window as any).electronAPI?.onSidecarStatus) {
      (window as any).electronAPI.onSidecarStatus((data: any) => {
        setSidecarStatus(prev => ({
          ...prev,
          [data.name]: data.status === 'running' ? 'running' : 'closed'
        }));
      });
    }

    // Ping inicial para conocer estado actual
    checkSidecars();

    return () => {
      if ((window as any).electronAPI?.offSidecarStatus) {
        (window as any).electronAPI.offSidecarStatus();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkSidecars = async () => {
    if (!(window as any).electronAPI) return;
    
    // Intentar ping a Terapias
    try {
      const resT = await (window as any).electronAPI.terapias.ping();
      setSidecarStatus(prev => ({ ...prev, Terapias: resT.ok ? 'running' : 'closed' }));
    } catch {
      setSidecarStatus(prev => ({ ...prev, Terapias: 'closed' }));
    }

    // Intentar ping a PDF
    try {
      const resP = await (window as any).electronAPI.pdfTools.ping();
      setSidecarStatus(prev => ({ ...prev, PDF: resP.ok ? 'running' : 'closed' }));
    } catch {
      setSidecarStatus(prev => ({ ...prev, PDF: 'closed' }));
    }
  };

  const reconnectSidecar = async (name: string) => {
    if (!(window as any).electronAPI) return;
    setSidecarStatus(prev => ({ ...prev, [name]: 'unknown' }));
    await (window as any).electronAPI.reconnectSidecar(name);
    // Esperar un poco y chequear
    setTimeout(checkSidecars, 1500);
  };

  useEffect(() => {
    localStorage.setItem("ordertrack-settings", JSON.stringify(settings));
    if (window.electronAPI?.saveSettings) {
      window.electronAPI.saveSettings(settings).catch((err) => {
        console.error('[DataContext] Error guardando settings en IPC:', err);
      });
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
      columns: { ...prev.columns, ...(newSettings.columns || {}) },
      scanning: { ...prev.scanning, ...(newSettings.scanning || {}) },
      display: { ...prev.display, ...(newSettings.display || {}) },
      customInsurers: newSettings.customInsurers ?? prev.customInsurers,
    }));
  };

  const addToHistory = async (result: ScanResult) => {
    if (window.electronAPI?.saveScan) {
      try {
        const updated = await window.electronAPI.saveScan(result);
        setHistory(updated);
      } catch (err) {
        console.error('[DataContext] Error guardando escaneo en IPC, usando fallback localStorage:', err);
        // Fallback a localStorage si IPC falla
        setHistory((prev) => {
          const updated = [result, ...prev].slice(0, 100);
          localStorage.setItem("ordertrack-history", JSON.stringify(updated));
          return updated;
        });
      }
    } else {
      setHistory((prev) => {
        const updated = [result, ...prev].slice(0, 100);
        localStorage.setItem("ordertrack-history", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const deleteFromHistory = async (id: string) => {
    if (window.electronAPI?.deleteScan) {
      try {
        const updated = await window.electronAPI.deleteScan(id);
        setHistory(updated);
      } catch (err) {
        console.error('[DataContext] Error eliminando escaneo en IPC, usando fallback localStorage:', err);
        setHistory((prev) => {
          const updated = prev.filter((s) => s.id !== id);
          localStorage.setItem("ordertrack-history", JSON.stringify(updated));
          return updated;
        });
      }
    } else {
      setHistory((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        localStorage.setItem("ordertrack-history", JSON.stringify(updated));
        return updated;
      });
    }
  };

  const clearHistory = async () => {
    if (window.electronAPI?.clearHistory) {
      try {
        await window.electronAPI.clearHistory();
        setHistory([]);
      } catch (err) {
        console.error('[DataContext] Error limpiando historial en IPC:', err);
        localStorage.removeItem("ordertrack-history");
        setHistory([]);
      }
    } else {
      localStorage.removeItem("ordertrack-history");
      setHistory([]);
    }
  };

  // Fix #11: Trim de historial — conservar solo los últimos N escaneos
  const trimHistory = async (keepCount: number): Promise<void> => {
    if (window.electronAPI?.trimHistory) {
      try {
        const updated = await window.electronAPI.trimHistory(keepCount);
        setHistory(updated);
      } catch (err) {
        console.error('[DataContext] Error en trimHistory IPC:', err);
      }
    } else {
      // Fallback localStorage
      setHistory(prev => {
        const trimmed = prev.slice(0, keepCount);
        localStorage.setItem('ordertrack-history', JSON.stringify(trimmed));
        return trimmed;
      });
    }
  };

  return (
    <DataContext.Provider
      value={{
        settings,
        updateSettings,
        history,
        addToHistory,
        deleteFromHistory,
        clearHistory,
        trimHistory,
        currentScan,
        setCurrentScan,
        sidecarStatus,
        checkSidecars,
        reconnectSidecar,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within DataProvider");
  }
  return context;
}
