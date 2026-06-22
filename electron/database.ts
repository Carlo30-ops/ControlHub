import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { DuplicateEntry, ScanStats, Invoice, ScanResult } from '../src/shared/types';

// ─────────────────────────────────────────────────────────────────────────────
// database.ts — Persistencia local JSON para COTU Analytics
// Fix #6:  I/O completamente asíncrono (fs.promises)
// Fix #8:  DuplicateEntry unificado (keptPath / discardedPath)
// Fix #11: MAX_SCANS reducido de 10.000 → 200 scans por defecto
//           + monitoreo de tamaño + trim configurable
// ─────────────────────────────────────────────────────────────────────────────

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface DbStats {
    count: number;
    sizeMB: number;
    path: string;
}

// ── Configuración ────────────────────────────────────────────────────────────

/**
 * Fix #11: Límite conservador de escaneos almacenados.
 * Cada ScanResult puede contener miles de Invoice — 10.000 scans era
 * un riesgo real de database.json de varios GB.
 * Con 200 scans y ~500 facturas promedio: ~100 MB máximo estimado.
 */
const MAX_SCANS = 200;

/** Umbral de advertencia en MB. Se loguea en consola si se excede. */
const WARN_SIZE_MB = 50;

// Rutas de datos
const DB_PATH = path.join(app.getPath('userData'), 'database.json');
const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

/** Valores por defecto para settings.json (incluye campos migrados desde localStorage) */
const DEFAULT_SETTINGS = {
    columns: {
        invoiceNumber: true,
        company: true,
        month: true,
        year: true,
        detail: true,
        filePath: false,
        amount: true,
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
    operatorName: 'Usuario Admin',
    operatorEmail: 'admin@cotu.com',
    terapiasDir: '',
    tesseractPath: '',
    // Campos añadidos en la migración: tema y carpeta reciente
    theme: 'dark',
    lastScanPath: '',
};

// ── Helpers de I/O async ─────────────────────────────────────────────────────

async function readDB(): Promise<ScanResult[]> {
    try {
        await fs.promises.access(DB_PATH);
        const data = await fs.promises.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data) as ScanResult[];
    } catch {
        return [];
    }
}

async function writeDB(data: ScanResult[]): Promise<void> {
    try {
        const json = JSON.stringify(data, null, 2);
        // Fix #11: advertir si el archivo supera el umbral
        const sizeMB = Buffer.byteLength(json, 'utf-8') / (1024 * 1024);
        if (sizeMB > WARN_SIZE_MB) {
            console.warn(
                `[database] ⚠️  database.json supera ${WARN_SIZE_MB} MB (actual: ${sizeMB.toFixed(1)} MB). ` +
                `Considera usar db:trimHistory para liberar espacio.`
            );
        }
        await fs.promises.writeFile(DB_PATH, json, 'utf-8');
    } catch (error) {
        console.error('[database] Error escribiendo DB:', error);
    }
}

async function readSettings(): Promise<any> {
    try {
        await fs.promises.access(SETTINGS_PATH);
        const data = await fs.promises.readFile(SETTINGS_PATH, 'utf-8');
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function writeSettings(settings: any): Promise<void> {
    try {
        await fs.promises.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (error) {
        console.error('[database] Error escribiendo Settings:', error);
    }
}

// ── API pública ───────────────────────────────────────────────────────────────

export const dbOptions = {
    getHistory: async (): Promise<ScanResult[]> => {
        return readDB();
    },

    saveScan: async (scan: ScanResult): Promise<ScanResult[]> => {
        const history = await readDB();
        // Fix #11: límite conservador
        const updated = [scan, ...history].slice(0, MAX_SCANS);
        await writeDB(updated);
        return updated;
    },

    deleteScan: async (id: string): Promise<ScanResult[]> => {
        const history = await readDB();
        const updated = history.filter(scan => scan.id !== id);
        await writeDB(updated);
        return updated;
    },

    clearHistory: async (): Promise<ScanResult[]> => {
        await writeDB([]);
        return [];
    },

    // Fix #11: Limpiar escaneos más antiguos, conservando solo los últimos N
    trimOldScans: async (keepCount: number): Promise<ScanResult[]> => {
        const history = await readDB();
        if (history.length <= keepCount) return history;
        const trimmed = history.slice(0, keepCount);
        await writeDB(trimmed);
        console.log(`[database] Historial reducido: ${history.length} → ${trimmed.length} escaneos.`);
        return trimmed;
    },

    // Fix #11: Estadísticas del archivo de base de datos
    getDbStats: async (): Promise<DbStats> => {
        try {
            const stat = await fs.promises.stat(DB_PATH);
            const history = await readDB();
            return {
                count: history.length,
                sizeMB: stat.size / (1024 * 1024),
                path: DB_PATH,
            };
        } catch {
            return { count: 0, sizeMB: 0, path: DB_PATH };
        }
    },

    getSettings: async (): Promise<any> => {
        const s = await readSettings();
        return s ?? DEFAULT_SETTINGS;
    },

    saveSettings: async (settings: any): Promise<any> => {
        await writeSettings(settings);
        return settings;
    },
};
