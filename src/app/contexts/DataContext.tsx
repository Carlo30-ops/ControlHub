import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from "react";
import { Invoice, ScanResult, AppSettings as Settings } from "../../shared/types";

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
  sidecarStatus: Record<string, 'running' | 'closed' | 'stalled' | 'unknown'>;
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
    amount: true, // <--- CAMBIADO: Visible por defecto
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
  operatorName: "Usuario Admin",
  operatorEmail: "admin@cotu.com",
  terapiasDir: "",
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [history, setHistory] = useState<ScanResult[]>([]);
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [sidecarStatus, setSidecarStatus] = useState<Record<string, 'running' | 'closed' | 'stalled' | 'unknown'>>({
    Terapias: 'unknown',
    PDF: 'unknown',
  });

  const checkSidecars = useCallback(async () => {
    if (!window.electronAPI) return;
    
    // Intentar ping a Terapias
    try {
      const resT = await window.electronAPI.terapias.ping();
      setSidecarStatus(prev => ({ ...prev, Terapias: resT.ok ? 'running' : 'closed' }));
    } catch {
      setSidecarStatus(prev => ({ ...prev, Terapias: 'closed' }));
    }

    // Intentar ping a PDF
    try {
      const resP = await window.electronAPI.pdfTools.ping();
      setSidecarStatus(prev => ({ ...prev, PDF: resP.ok ? 'running' : 'closed' }));
    } catch {
      setSidecarStatus(prev => ({ ...prev, PDF: 'closed' }));
    }
  }, []);

  const reconnectSidecar = useCallback(async (name: string) => {
    if (!window.electronAPI) return;
    setSidecarStatus(prev => ({ ...prev, [name]: 'unknown' }));
    await window.electronAPI.reconnectSidecar(name);
    // Esperar un poco y chequear
    setTimeout(checkSidecars, 1500);
  }, [checkSidecars]);

  // Cargar historial y settings asincronamente desde DB (o localStorage en fallback)
  useEffect(() => {
    const initData = async () => {
      // Limpieza idempotente de claves legacy en localStorage
      try {
        localStorage.removeItem('cotu-last-path');
      } catch {
        /* ignore */
      }

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
              terapiasDir: savedSettings.terapiasDir || prev.terapiasDir,
            }));
          }
        } catch (err) {
          console.error('[DataContext] Error cargando settings desde IPC:', err);
        }
      }

      if (window.electronAPI?.getHistory) {
        try {
          const savedHistory = await window.electronAPI.getHistory();
          if (savedHistory && Array.isArray(savedHistory)) {
            setHistory(savedHistory);
          }
        } catch (err) {
          console.error('[DataContext] Error cargando historial desde IPC:', err);
        }
      }
      
      checkSidecars();
    };

    initData();
  }, [checkSidecars]);

  // Suscribirse a las actualizaciones de estado en tiempo real del Sidecar
  useEffect(() => {
    if (window.electronAPI?.onSidecarStatus) {
      window.electronAPI.onSidecarStatus((data: { name: string; status: string }) => {
        let uiStatus: 'running' | 'closed' | 'stalled' | 'unknown' = 'unknown';
        if (data.status === 'running' || data.status === 'ok') {
          uiStatus = 'running';
        } else if (data.status === 'stalled') {
          uiStatus = 'stalled';
        } else if (data.status === 'closed' || data.status === 'failed') {
          uiStatus = 'closed';
        }
        setSidecarStatus(prev => ({ ...prev, [data.name]: uiStatus }));
      });
      return () => {
        if (window.electronAPI?.offSidecarStatus) {
          window.electronAPI.offSidecarStatus();
        }
      };
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = {
        ...prev,
        ...newSettings,
        columns: { ...prev.columns, ...(newSettings.columns || {}) },
        scanning: { ...prev.scanning, ...(newSettings.scanning || {}) },
        display: { ...prev.display, ...(newSettings.display || {}) },
      };
      
      // Persistir vía IPC
      if (window.electronAPI?.saveSettings) {
        window.electronAPI.saveSettings(updated).then(saved => {
          if (saved) {
            localStorage.removeItem("ordertrack-settings");
          }
        });
      }
      return updated;
    });
  }, []);

  const addToHistory = useCallback(async (result: ScanResult) => {
    if (window.electronAPI?.saveScan) {
      try {
        const next = await window.electronAPI.saveScan(result);
        setHistory(next);
      } catch (err) {
        console.error('[DataContext] Error in addToHistory IPC:', err);
      }
    } else {
      setHistory(prev => [result, ...prev]);
    }
  }, []);

  const deleteFromHistory = useCallback(async (id: string) => {
    if (window.electronAPI?.deleteScan) {
      try {
        const next = await window.electronAPI.deleteScan(id);
        setHistory(next);
      } catch (err) {
        console.error('[DataContext] Error in deleteFromHistory IPC:', err);
      }
    } else {
      setHistory(prev => prev.filter(item => item.id !== id));
    }
  }, []);

  const clearHistory = useCallback(async () => {
    if (window.electronAPI?.clearHistory) {
      try {
        await window.electronAPI.clearHistory();
        setHistory([]);
      } catch (err) {
        console.error('[DataContext] Error in clearHistory IPC:', err);
      }
    } else {
      setHistory([]);
    }
  }, []);

  const trimHistory = useCallback(async (keepCount: number) => {
    if (window.electronAPI?.trimHistory) {
      try {
        const next = await window.electronAPI.trimHistory(keepCount);
        setHistory(next);
      } catch (err) {
        console.error('[DataContext] Error in trimHistory IPC:', err);
      }
    } else {
      setHistory(prev => prev.slice(0, keepCount));
    }
  }, []);

  const contextValue = useMemo(() => ({
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
  }), [
    settings,
    updateSettings,
    history,
    addToHistory,
    deleteFromHistory,
    clearHistory,
    trimHistory,
    currentScan,
    sidecarStatus,
    checkSidecars,
    reconnectSidecar,
  ]);

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
}
