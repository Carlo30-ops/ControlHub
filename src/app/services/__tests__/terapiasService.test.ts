import { describe, it, expect, vi, beforeEach } from "vitest";
import { terapiasService } from "../terapiasService";

// Mock the global electronAPI object
const mockElectronAPI = {
  terapias: {
    listDocs: vi.fn(),
    prepare: vi.fn(),
    finalize: vi.fn(),
    searchPatient: vi.fn(),
    getHistory: vi.fn(),
    ping: vi.fn(),
    checkWord: vi.fn(),
  },
};

const globalWindow = globalThis as any;
if (!globalWindow.window) {
  globalWindow.window = globalWindow;
}

Object.defineProperty(globalWindow.window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

describe("TerapiasService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test for listDocuments
  it("should call electronAPI.terapias.listDocs and return file metadata", async () => {
    const mockFiles = [
      { name: "doc1.docx", path: "C:\\docs\\doc1.docx", modified: 123, size: 456 },
    ];
    mockElectronAPI.terapias.listDocs.mockResolvedValue({ ok: true, files: mockFiles });

    const result = await terapiasService.listDocuments("C:\\source");
    expect(mockElectronAPI.terapias.listDocs).toHaveBeenCalled();
    expect(result).toEqual(mockFiles);
  });

  it("should throw an error if electronAPI.terapias.listDocs is not available", async () => {
    const originalListDocs = window.electronAPI.terapias.listDocs;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.listDocs = undefined;
    await expect(terapiasService.listDocuments("C:\\source")).rejects.toThrow("Electron API no disponible");
    window.electronAPI.terapias.listDocs = originalListDocs;
  });

  it("should throw an error if listDocs returns !ok", async () => {
    mockElectronAPI.terapias.listDocs.mockResolvedValue({ ok: false, error: "Test error" });
    await expect(terapiasService.listDocuments("C:\\source")).rejects.toThrow("Error listando documentos");
  });

  // Test for autoDetectWord
  it("should call electronAPI.terapias.listDocs for autoDetectWord and return file metadata", async () => {
    const mockFiles = [
      { name: "auto1.docx", path: "C:\\docs\\auto1.docx", modified: 123, size: 456 },
    ];
    mockElectronAPI.terapias.listDocs.mockResolvedValue({ ok: true, files: mockFiles });

    const result = await terapiasService.autoDetectWord("C:\\source");
    expect(mockElectronAPI.terapias.listDocs).toHaveBeenCalled();
    expect(result).toEqual(mockFiles);
  });

  it("should throw an error if autoDetectWord returns !ok", async () => {
    mockElectronAPI.terapias.listDocs.mockResolvedValue({ ok: false, error: "Auto-detect error" });
    await expect(terapiasService.autoDetectWord("C:\\source")).rejects.toThrow("Auto-detect error");
  });

  // Test for prepareDocument
  it("should call electronAPI.terapias.prepare and return preparation result", async () => {
    const mockForm = {
      inputName: "Test SS Patient",
      filename: "test.docx",
      baseDest: "C:\\dest",
      backup: "C:\\backup",
    };
    const mockPrepareResult = {
      ok: true,
      doc_path: "C:\\dest\\test.docx",
      patient: "Test Patient",
      folder: "C:\\dest\\Test Patient",
    };
    mockElectronAPI.terapias.prepare.mockResolvedValue(mockPrepareResult);

    const result = await terapiasService.prepareDocument(mockForm, "C:\\source");
    expect(mockElectronAPI.terapias.prepare).toHaveBeenCalledWith({
      input_name: mockForm.inputName,
      filename: mockForm.filename,
      base_dest: mockForm.baseDest,
      backup: mockForm.backup,
      source_dir: "C:\\source",
    });
    expect(result).toEqual(mockPrepareResult);
  });

  it("should throw an error if electronAPI.terapias.prepare is not available", async () => {
    const originalPrepare = window.electronAPI.terapias.prepare;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.prepare = undefined;
    await expect(terapiasService.prepareDocument({} as any, "")).rejects.toThrow("Electron API no disponible");
    window.electronAPI.terapias.prepare = originalPrepare;
  });

  // Test for finalizeDocument
  it("should call electronAPI.terapias.finalize and return finalization result", async () => {
    const mockFinalizeResult = { ok: true, pdf_path: "C:\\dest\\test.pdf" };
    mockElectronAPI.terapias.finalize.mockResolvedValue(mockFinalizeResult);

    const result = await terapiasService.finalizeDocument("C:\\temp.docx", "C:\\backup", "Patient Name");
    expect(mockElectronAPI.terapias.finalize).toHaveBeenCalledWith({
      doc_path: "C:\\temp.docx",
      backup: "C:\\backup",
      patient: "Patient Name",
    });
    expect(result).toEqual(mockFinalizeResult);
  });

  it("should throw an error if electronAPI.terapias.finalize is not available", async () => {
    const originalFinalize = window.electronAPI.terapias.finalize;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.finalize = undefined;
    await expect(terapiasService.finalizeDocument("", "", "")).rejects.toThrow("Electron API no disponible");
    window.electronAPI.terapias.finalize = originalFinalize;
  });

  // Test for searchPatients
  it("should call electronAPI.terapias.searchPatient and return search results", async () => {
    const mockSearchResults = [
      { name: "Patient A", path: "C:\\patients\\A", lastModified: 100 },
    ];
    mockElectronAPI.terapias.searchPatient.mockResolvedValue({ ok: true, results: mockSearchResults });

    const result = await terapiasService.searchPatients("query", "C:\\source", "C:\\dest");
    expect(mockElectronAPI.terapias.searchPatient).toHaveBeenCalledWith({
      query: "query",
      source_dir: "C:\\source",
      dest_root: "C:\\dest",
    });
    expect(result).toEqual(mockSearchResults);
  });

  it("should return empty array if searchPatient returns !ok", async () => {
    mockElectronAPI.terapias.searchPatient.mockResolvedValue({ ok: false, error: "Search error" });
    await expect(terapiasService.searchPatients("query", "C:\\source")).rejects.toThrow("Error buscando pacientes: Error: Search error");
  });

  // Test for loadHistory
  it("should call electronAPI.terapias.getHistory and return history entries", async () => {
    const mockHistory = [
      { date: "2026-01-01", patient: "P1", filename: "f1.pdf", pdfPath: "/p1", backupPath: "/b1" },
    ];
    mockElectronAPI.terapias.getHistory.mockResolvedValue({ ok: true, history: mockHistory });

    const result = await terapiasService.loadHistory();
    expect(mockElectronAPI.terapias.getHistory).toHaveBeenCalled();
    expect(result).toEqual(mockHistory);
  });

  it("should return empty array if electronAPI.terapias.getHistory is not available", async () => {
    const originalGetHistory = window.electronAPI.terapias.getHistory;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.getHistory = undefined;
    const result = await terapiasService.loadHistory();
    expect(result).toEqual([]);
    window.electronAPI.terapias.getHistory = originalGetHistory;
  });

  it("should return empty array if getHistory returns !ok", async () => {
    mockElectronAPI.terapias.getHistory.mockResolvedValue({ ok: false, error: "History error" });
    const result = await terapiasService.loadHistory();
    expect(result).toEqual([]);
  });

  // Test for checkStatus
  it("should call electronAPI.terapias.ping and checkWord and return combined status", async () => {
    mockElectronAPI.terapias.ping.mockResolvedValue({ ok: true, status: "ready" });
    mockElectronAPI.terapias.checkWord.mockResolvedValue({ ok: true, message: "Word is good" });

    const result = await terapiasService.checkStatus();
    expect(mockElectronAPI.terapias.ping).toHaveBeenCalled();
    expect(mockElectronAPI.terapias.checkWord).toHaveBeenCalled();
    expect(result).toEqual({
      ping: true,
      word: true,
      wordMessage: "Word is good",
      loading: false,
      error: null,
    });
  });

  it("should return error status if electronAPI.terapias.ping or checkWord are not available", async () => {
    const originalPing = window.electronAPI.terapias.ping;
    const originalCheckWord = window.electronAPI.terapias.checkWord;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.ping = undefined;
    // @ts-expect-error we are intentionally setting this to undefined for testing
    window.electronAPI.terapias.checkWord = undefined;

    const result = await terapiasService.checkStatus();
    expect(result).toEqual({
      ping: false,
      word: false,
      wordMessage: "API no disponible",
      loading: false,
      error: "Electron API no disponible",
    });
    window.electronAPI.terapias.ping = originalPing;
    window.electronAPI.terapias.checkWord = originalCheckWord;
  });

  it("should return error status if ping fails", async () => {
    mockElectronAPI.terapias.ping.mockRejectedValue(new Error("Ping failed"));
    mockElectronAPI.terapias.checkWord.mockResolvedValue({ ok: true });

    const result = await terapiasService.checkStatus();
    expect(result).toEqual({
      ping: false,
      word: false,
      wordMessage: "",
      loading: false,
      error: "Ping failed",
    });
  });

  it("should return error status if checkWord fails", async () => {
    mockElectronAPI.terapias.ping.mockResolvedValue({ ok: true });
    mockElectronAPI.terapias.checkWord.mockRejectedValue(new Error("Word check failed"));

    const result = await terapiasService.checkStatus();
    expect(result).toEqual({
      ping: true,
      word: false,
      wordMessage: "",
      loading: false,
      error: "Word check failed",
    });
  });
});
