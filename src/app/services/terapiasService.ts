/**
 * Servicio de Terapias - Lógica de negocio separada de la UI
 * Maneja operaciones de preparación, finalización y búsqueda de terapias
 */

export interface FormState {
  inputName: string;
  filename: string;
  baseDest: string;
  backup: string;
}

export interface StepState {
  current: number;
  docPath: string | null;
  patient: string | null;
  folder: string | null;
}

export interface FileMetadata {
  name: string;
  path: string;
  modified: number;
  size: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  filename: string;
  patient: string;
  destination: string;
  status: 'completed' | 'failed';
}

export interface SearchResult {
  id: string;
  name: string;
  path: string;
  matchedFields: string[];
}

export interface PrepareResult {
  docPath: string | null;
  patient: string | null;
  folder: string | null;
  metadata?: unknown;
}

export interface SidecarStatus {
  ping: boolean;
  word: boolean;
  wordMessage: string;
  loading: boolean;
  error: string | null;
}

export interface TerapiasService {
  listDocuments(sourceDir: string): Promise<FileMetadata[]>;
  prepareDocument(form: FormState, sourceDir: string): Promise<PrepareResult>;
  finalizeDocument(prepareResult: PrepareResult, outputPath: string, backupPath: string): Promise<void>;
  searchPatients(query: string, sourceDir: string): Promise<SearchResult[]>;
  loadHistory(): Promise<HistoryEntry[]>;
  checkStatus(): Promise<SidecarStatus>;
}

class TerapiasServiceImpl implements TerapiasService {
  async listDocuments(sourceDir: string): Promise<FileMetadata[]> {
    if (!window.electronAPI?.terapias?.listDocs) {
      throw new Error('Electron API no disponible');
    }

    try {
      const res = await window.electronAPI.terapias.listDocs();
      if (!res.ok) {
        throw new Error('Error listando documentos');
      }
      return res.files.map((f: any) => ({
        name: f.name || '',
        path: f.path || '',
        modified: f.modified || 0,
        size: f.size || 0,
      }));
    } catch (error) {
      throw new Error(`Error listando documentos: ${error}`);
    }
  }

  async prepareDocument(form: FormState, sourceDir: string): Promise<PrepareResult> {
    if (!window.electronAPI?.terapias?.prepare) {
      throw new Error('Electron API no disponible');
    }

    try {
      const result = await window.electronAPI.terapias.prepare({
        input_name: form.inputName,
        filename: form.filename,
        base_dest: form.baseDest,
        backup: form.backup,
        source_dir: sourceDir,
      });

      return {
        docPath: result.doc_path || null,
        patient: result.patient || null,
        folder: result.folder || null,
        metadata: result.metadata,
      };
    } catch (error) {
      throw new Error(`Error preparando documento: ${error}`);
    }
  }

  async finalizeDocument(prepareResult: PrepareResult, outputPath: string, backupPath: string): Promise<void> {
    if (!window.electronAPI?.terapias?.finalize) {
      throw new Error('Electron API no disponible');
    }

    try {
      await window.electronAPI.terapias.finalize({
        output_path: outputPath,
        backup_path: backupPath,
        patient_name: prepareResult.patient || '',
      });
    } catch (error) {
      throw new Error(`Error finalizando documento: ${error}`);
    }
  }

  async searchPatients(query: string, sourceDir: string): Promise<SearchResult[]> {
    if (!window.electronAPI?.terapias?.searchPatient) {
      throw new Error('Electron API no disponible');
    }

    try {
      const result = await window.electronAPI.terapias.searchPatient({
        query,
        source_dir: sourceDir,
      });

      return (result.results || []).map((r: any) => ({
        id: r.id || '',
        name: r.name || '',
        path: r.path || '',
        matchedFields: r.matched_fields || [],
      }));
    } catch (error) {
      throw new Error(`Error buscando pacientes: ${error}`);
    }
  }

  async loadHistory(): Promise<HistoryEntry[]> {
    if (!window.electronAPI?.terapias?.getHistory) {
      return [];
    }

    try {
      const result = await window.electronAPI.terapias.getHistory();
      return (result.history || []).map((h: any) => ({
        id: h.id || '',
        timestamp: h.timestamp || 0,
        filename: h.filename || '',
        patient: h.patient || '',
        destination: h.destination || '',
        status: h.status || 'completed',
      }));
    } catch (error) {
      console.error('Error cargando historial:', error);
      return [];
    }
  }

  async checkStatus(): Promise<SidecarStatus> {
    if (!window.electronAPI?.terapias?.ping || !window.electronAPI?.terapias?.checkWord) {
      return {
        ping: false,
        word: false,
        wordMessage: 'API no disponible',
        loading: false,
        error: 'Electron API no disponible',
      };
    }

    try {
      const pingRes = await window.electronAPI.terapias.ping();
      const wordRes = await window.electronAPI.terapias.checkWord();

      return {
        ping: pingRes.ok,
        word: wordRes.ok,
        wordMessage: wordRes.message || '',
        loading: false,
        error: null,
      };
    } catch (error) {
      return {
        ping: false,
        word: false,
        wordMessage: '',
        loading: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

export const terapiasService = new TerapiasServiceImpl();
