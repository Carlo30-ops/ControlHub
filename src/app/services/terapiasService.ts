/**
 * Servicio de Terapias - Lógica de negocio separada de la UI
 * Maneja operaciones de preparación, finalización y búsqueda de terapias
 */
import { logger } from "../utils/logger";

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
  date: string;
  patient: string;
  filename: string;
  pdfPath: string;
  backupPath: string;
}

export interface SearchResult {
  name: string;
  path: string;
  lastModified: number;
}

export interface PrepareResult {
  ok: boolean;
  doc_path: string | null;
  patient: string | null;
  folder: string | null;
  pdf_path?: string;
  error?: string;
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
  autoDetectWord(sourceDir: string): Promise<FileMetadata[]>;
  prepareDocument(form: FormState, sourceDir: string): Promise<PrepareResult>;
  finalizeDocument(outputPath: string, backupPath: string, patientName: string): Promise<{ ok: boolean; pdf_path?: string; error?: string }>;
  searchPatients(query: string, sourceDir: string, destRoot?: string): Promise<SearchResult[]>;
  loadHistory(): Promise<HistoryEntry[]>;
  checkStatus(): Promise<SidecarStatus>;
}

class TerapiasServiceImpl implements TerapiasService {
  private normalizeFileMetadata(files: unknown[]): FileMetadata[] {
    if (!Array.isArray(files)) {
      return [];
    }

    return files.map((file: any) => ({
      name: String(file?.name ?? ""),
      path: String(file?.path ?? ""),
      modified: Number(file?.modified ?? 0),
      size: Number(file?.size ?? 0),
    }));
  }

  private isWordDocument(filename: string): boolean {
    return /\.(docx?|DOCX?)$/.test(filename);
  }

  async listDocuments(sourceDir: string): Promise<FileMetadata[]> {
    if (!window.electronAPI?.terapias?.listDocs) {
      throw new Error('Electron API no disponible');
    }

    try {
      const res = await window.electronAPI.terapias.listDocs();
      if (!res.ok) {
        throw new Error('Error listando documentos');
      }
      return this.normalizeFileMetadata(res.files);
    } catch (error) {
      throw new Error(`Error listando documentos: ${error}`);
    }
  }

  async autoDetectWord(sourceDir: string): Promise<FileMetadata[]> {
    if (!window.electronAPI?.terapias?.listDocs) {
      throw new Error('Electron API no disponible');
    }

    try {
      const res = await window.electronAPI.terapias.listDocs();
      if (!res.ok) {
        throw new Error(res.error || 'Error al buscar archivos');
      }
      return this.normalizeFileMetadata(res.files).filter((file) => this.isWordDocument(file.name));
    } catch (error) {
      throw new Error(`Error en auto-detección: ${error}`);
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
        ok: result.ok || false,
        doc_path: result.doc_path || null,
        patient: result.patient || null,
        folder: result.folder || null,
        pdf_path: result.pdf_path as string | undefined,
        error: result.error as string | undefined,
      };
    } catch (error) {
      throw new Error(`Error preparando documento: ${error}`);
    }
  }

  async finalizeDocument(outputPath: string, backupPath: string, patientName: string): Promise<{ ok: boolean; pdf_path?: string; error?: string }> {
    if (!window.electronAPI?.terapias?.finalize) {
      throw new Error('Electron API no disponible');
    }

    try {
      const result = await window.electronAPI.terapias.finalize({
        doc_path: outputPath,
        backup: backupPath,
        patient: patientName,
      });

      return {
        ok: result.ok || false,
        pdf_path: result.pdf_path as string | undefined,
        error: result.error as string | undefined,
      };
    } catch (error) {
      throw new Error(`Error finalizando documento: ${error}`);
    }
  }

  async searchPatients(query: string, sourceDir: string, destRoot?: string): Promise<SearchResult[]> {
    if (!window.electronAPI?.terapias?.searchPatient) {
      throw new Error('Electron API no disponible');
    }

    try {
      const result = await window.electronAPI.terapias.searchPatient({
        query,
        source_dir: sourceDir,
        dest_root: destRoot,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Error en búsqueda de pacientes');
      }

      return (result.results || []).map((r: any) => ({
        name: r.name || '',
        path: r.path || '',
        lastModified: r.last_modified || r.lastModified || 0,
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
        date: h.date || new Date(h.timestamp || 0).toISOString(),
        patient: h.patient || '',
        filename: h.filename || '',
        pdfPath: h.pdf_path || h.pdfPath || h.destination || '',
        backupPath: h.backup_path || h.backupPath || '',
      }));
    } catch (error) {
      console.error('Error cargando historial:', error);
      return [];
    }
  }

  async checkStatus(wordExecutablePath?: string): Promise<SidecarStatus> {
    if (!window.electronAPI?.terapias?.ping || !window.electronAPI?.terapias?.checkWord) {
      logger.warn("Electron API terapias no disponible");
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
      let wordRes: { ok: boolean; word_installed?: boolean; message?: string; error?: string } = {
        ok: false,
      };
      let wordError: string | null = null;

      try {
        wordRes = await window.electronAPI.terapias.checkWord(wordExecutablePath);
      } catch (error) {
        wordError = error instanceof Error ? error.message : String(error);
        logger.error("Error en checkWord:", wordError);
      }

      if (!pingRes) {
        logger.warn("Respuesta nula de ping");
        return {
          ping: false,
          word: false,
          wordMessage: wordRes.message || '',
          loading: false,
          error: 'Respuesta inválida del sidecar',
        };
      }

      // Interpretar word_installed correctamente, con fallback a ok si word_installed no está definido
      const wordInstalled = wordRes.word_installed !== false;
      const wordIsOk = wordRes.ok === true && wordInstalled;
      
      const status = {
        ping: pingRes.ok === true,
        word: wordIsOk,
        wordMessage: wordRes.message || '',
        loading: false,
        error: wordIsOk ? null : (wordRes.error || wordError),
      };
      
      logger.debug(`Terapias status: ping=${status.ping}, word=${status.word}, wordMessage=${status.wordMessage}`);
      return status;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      logger.error("Error en checkStatus:", errorMsg);
      return {
        ping: false,
        word: false,
        wordMessage: '',
        loading: false,
        error: errorMsg,
      };
    }
  }
}

export const terapiasService = new TerapiasServiceImpl();
