// src/app/config/migration.ts
// Implements configuration migrations with version tracking.

import { SettingsSchema } from './types';
import { validateStringSetting } from './validation';

export const CURRENT_SCHEMA_VERSION = 1;

/**
 * Runs migration steps to bring stored settings up to date.
 * The function reads the current settings via the Electron config API,
 * applies necessary migrations, and persists the updated settings.
 */
export async function runConfigMigrations(): Promise<void> {
  // Retrieve all settings via IPC
  const allSettings: SettingsSchema = (await window.electronAPI?.config?.getAll?.()) || {};
  const storedVersion = typeof allSettings?.schemaVersion === 'number' ? allSettings.schemaVersion : 0;

  if (storedVersion >= CURRENT_SCHEMA_VERSION) {
    // Already up‑to‑date, no work needed.
    return;
  }

  // Migration 0: Clean legacy localStorage entry (cotu-last-path)
  if (storedVersion < 1) {
    try {
      // In previous version the path was stored in renderer's localStorage.
      // This migration clears it idempotently.
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('cotu-last-path');
      }
    } catch (e) {
      console.warn('Migration 0 failed to clean localStorage:', e);
    }
  }

  // Future migrations can be added here, incrementing the version each time.

  // Persist the new schema version together with any existing settings.
  const updated: SettingsSchema = {
    ...(allSettings || {}),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  } as SettingsSchema;
  await window.electronAPI?.config?.setAll?.(updated);
}
