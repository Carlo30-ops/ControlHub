import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from "react";
import { Invoice, ScanResult, AppSettings as Settings } from "../../shared/types";
import { logger } from "../utils/logger";

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
  sidecarStatus: Record<string, 'running' | 'closed' | 'failed' | 'reconnecting' | 'stalled' | 'unknown'>;
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
  tesseractPath: "",
  terapiasBaseDest: "",
  terapiasBackup: "",
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  const [history, setHistory] = useState<ScanResult[]>([]);
  const [currentScan, setCurrentScan] = useState<ScanResult | null>(null);
  const [sidecarStatus, setSidecarStatus] = useState<Record<string, 'running' | 'closed' | 'failed' | 'reconnecting' | 'stalled' | 'unknown'>>({
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
      const migrationKey = 'migration.legacyLocalStorage';
      let migratedSettings: Partial<Settings> = {};
      let shouldPersistSettings = false;

      if (window.electronAPI?.config?.get) {
        try {
          const migrated = await window.electronAPI.config.get(migrationKey);
          if (!migrated) {
            const legacySettingsRaw = localStorage.getItem('ordertrack-settings');
            const legacyThemeRaw = localStorage.getItem('ordertrack-theme');
            const legacyLastPath = localStorage.getItem('cotu-last-path');
            const legacyHistoryRaw = localStorage.getItem('ordertrack-history');

            if (legacySettingsRaw) {
              try {
                const parsed = JSON.parse(legacySettingsRaw) as any;
                if (parsed && typeof parsed === 'object') {
                  if (typeof parsed.theme === 'string') {
                    migratedSettings.theme = parsed.theme as 'light' | 'dark';
                  }
                  if (typeof parsed.lastScanPath === 'string') {
                    migratedSettings.lastScanPath = parsed.lastScanPath;
                  }
                  if (parsed.columns && typeof parsed.columns === 'object') {
                    migratedSettings.columns = { ...migratedSettings.columns, ...parsed.columns } as any;
                  }
                  if (parsed.scanning && typeof parsed.scanning === 'object') {
                    migratedSettings.scanning = { ...migratedSettings.scanning, ...parsed.scanning } as any;
                  }
                  if (parsed.display && typeof parsed.display === 'object') {
                    migratedSettings.display = { ...migratedSettings.display, ...parsed.display } as any;
                  }
                  if (Array.isArray(parsed.customInsurers)) {
                    migratedSettings.customInsurers = parsed.customInsurers;
                  }
                  if (typeof parsed.operatorName === 'string') {
                    migratedSettings.operatorName = parsed.operatorName;
                  }
                  if (typeof parsed.operatorEmail === 'string') {
                    migratedSettings.operatorEmail = parsed.operatorEmail;
                  }
                }
              } catch (err) {
                logger.warn('[DataContext] Error parsing legacy ordertrack-settings:', err);
              }
            }

            if (legacyThemeRaw && (legacyThemeRaw === 'light' || legacyThemeRaw === 'dark')) {
              migratedSettings.theme = legacyThemeRaw;
            }
            if (legacyLastPath) {
              migratedSettings.lastScanPath = legacyLastPath;
            }

            if (legacyHistoryRaw) {
              try {
                const parsedHistory = JSON.parse(legacyHistoryRaw);
                if (Array.isArray(parsedHistory) && window.electronAPI?.saveScan) {
                  for (const candidate of parsedHistory) {
                    if (candidate && typeof candidate === 'object' && typeof candidate.id === 'string') {
                      // Save each legacy scan into database.json via IPC.
                      // If the scan object is invalid, skip it silently.
                      await window.electronAPI.saveScan(candidate as any);
                    }
                  }
                }
              } catch (err) {
                logger.warn('[DataContext] Error parsing legacy ordertrack-history:', err);
              }
            }

            if (Object.keys(migratedSettings).length > 0 || legacyLastPath || legacyHistoryRaw || legacySettingsRaw || legacyThemeRaw) {
              shouldPersistSettings = true;
            }

            try {
              localStorage.removeItem('ordertrack-settings');
              localStorage.removeItem('ordertrack-theme');
              localStorage.removeItem('ordertrack-history');
              localStorage.removeItem('cotu-last-path');
            } catch {
              // localStorage removal is best-effort; do not fail startup.
            }

            try {
              await window.electronAPI.config.set(migrationKey, true);
            } catch (err) {
              logger.warn('[DataContext] Error setting legacy migration flag:', err);
            }
          }
        } catch (err) {
          logger.warn('[DataContext] Error checking legacy migration flag:', err);
        }
      }

      if (window.electronAPI?.getSettings) {
        try {
          const savedSettings = await window.electronAPI.getSettings();

          const mergedSettings = {
            ...defaultSettings,
            ...(savedSettings || {}),
            ...migratedSettings,
          } as Settings;

          mergedSettings.columns = {
            ...defaultSettings.columns,
            ...(savedSettings?.columns || {}),
            ...(migratedSettings.columns || {}),
          };
          mergedSettings.scanning = {
            ...defaultSettings.scanning,
            ...(savedSettings?.scanning || {}),
            ...(migratedSettings.scanning || {}),
          };
          mergedSettings.display = {
            ...defaultSettings.display,
            ...(savedSettings?.display || {}),
            ...(migratedSettings.display || {}),
          };
          mergedSettings.customInsurers = migratedSettings.customInsurers ?? savedSettings?.customInsurers ?? defaultSettings.customInsurers;

          setSettings(mergedSettings);

          if (shouldPersistSettings && window.electronAPI.saveSettings) {
            await window.electronAPI.saveSettings(mergedSettings);
          }
        } catch (err) {
          logger.error('[DataContext] Error cargando settings desde IPC:', err);
        }
      }

      if (window.electronAPI?.getHistory) {
        try {
          const savedHistory = await window.electronAPI.getHistory();
          if (savedHistory && Array.isArray(savedHistory)) {
            setHistory(savedHistory);
          }
        } catch (err) {
          logger.error('[DataContext] Error cargando historial desde IPC:', err);
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
        let uiStatus: 'running' | 'closed' | 'failed' | 'reconnecting' | 'stalled' | 'unknown' = 'unknown';
        if (data.status === 'running' || data.status === 'ok') {
          uiStatus = 'running';
        } else if (data.status === 'stalled') {
          uiStatus = 'stalled';
        } else if (data.status === 'reconnecting') {
          uiStatus = 'reconnecting';
        } else if (data.status === 'failed') {
          uiStatus = 'failed';
        } else if (data.status === 'closed') {
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
        window.electronAPI.saveSettings(updated).catch(err => logger.error('[DataContext] Error saving settings via IPC:', err));
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
        logger.error('[DataContext] Error in addToHistory IPC:', err);
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
        logger.error('[DataContext] Error in deleteFromHistory IPC:', err);
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
        logger.error('[DataContext] Error in clearHistory IPC:', err);
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
        logger.error('[DataContext] Error in trimHistory IPC:', err);
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
