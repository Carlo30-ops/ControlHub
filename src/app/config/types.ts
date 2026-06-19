export interface SettingsSchema {
  /** Path to the last scanned folder */
  lastScanPath?: string;
  /** Schema version for migration tracking */
  schemaVersion?: number;
  // Allow additional keys for future settings
  [key: string]: unknown;
}
