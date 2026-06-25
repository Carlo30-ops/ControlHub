
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import Terapias from "../index";
import { useData } from "../../../contexts/DataContext";
import { terapiasService } from "../../../services/terapiasService";
import { toast } from "sonner";
import { RouterProvider, createMemoryRouter } from "react-router";

// Mock de dependencias
vi.mock("../../../contexts/DataContext", () => ({
  useData: vi.fn(),
}));
vi.mock("../../../services/terapiasService", () => ({
  terapiasService: {
    listDocuments: vi.fn(),
    autoDetectWord: vi.fn(),
    prepareDocument: vi.fn(),
    finalizeDocument: vi.fn(),
    searchPatients: vi.fn(),
    loadHistory: vi.fn(),
    checkStatus: vi.fn(),
  },
}));
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const mockElectronAPI = {
  selectDirectory: vi.fn(() => Promise.resolve("C:\\mock\\path")),
  listFiles: vi.fn(() => Promise.resolve([])),
  shell: {
    revealInFolder: vi.fn(),
    openPath: vi.fn(),
  },
  terapias: {
    listDocs: vi.fn(() => Promise.resolve({ ok: true, files: [] })),
    prepare: vi.fn(() => Promise.resolve({ ok: true })),
    finalize: vi.fn(() => Promise.resolve({ ok: true })),
    getHistory: vi.fn(() => Promise.resolve({ ok: true, history: [] })),
    searchPatient: vi.fn(() => Promise.resolve({ ok: true, results: [] })),
    ping: vi.fn(() => Promise.resolve({ ok: true, status: "ready" })),
    checkWord: vi.fn(() => Promise.resolve({ ok: true, message: "Word disponible" })),
  },
};

Object.defineProperty(window, "electronAPI", {
  value: mockElectronAPI,
  writable: true,
});

describe("Terapias Component", () => {
  const mockSettings = {
    terapiasDir: "C:\\terapias\\origen",
    terapiasBaseDest: "C:\\terapias\\destino",
    terapiasBackup: "C:\\terapias\\backup",
  };

  const mockedUseData = useData as unknown as { mockReturnValue: (value: any) => void };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(terapiasService, "checkStatus").mockResolvedValue({
      ping: true,
      word: true,
      wordMessage: "Word disponible",
      loading: false,
      error: null,
    });
    vi.spyOn(terapiasService, "listDocuments").mockResolvedValue([]);
    vi.spyOn(terapiasService, "loadHistory").mockResolvedValue([]);
    vi.spyOn(terapiasService, "autoDetectWord").mockResolvedValue([]);
    vi.spyOn(terapiasService, "searchPatients").mockResolvedValue([]);
    mockedUseData.mockReturnValue({
      settings: mockSettings,
      updateSettings: vi.fn(),
      sidecarStatus: { Terapias: "running" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () =>
    render(
      <RouterProvider router={createMemoryRouter([
        { path: "/terapias", element: <Terapias /> },
      ], { initialEntries: ["/terapias"] })} />
    );

  // Test 1: Renderizado inicial y estado del motor
  it("should render correctly and display engine status", async () => {
    renderComponent();
    expect(screen.getByText("Organizador de Terapias")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
      expect(screen.getByText("Word disponible")).toBeInTheDocument();
    });
    expect(terapiasService.checkStatus).toHaveBeenCalled();
    expect(terapiasService.listDocuments).toHaveBeenCalledWith(mockSettings.terapiasDir);
    expect(terapiasService.loadHistory).toHaveBeenCalled();
  });

  // Test 2: Manejo de carpetas no configuradas
  it("should show a warning if source directory is not configured", () => {
    mockedUseData.mockReturnValue({
      settings: { ...mockSettings, terapiasDir: "" },
      updateSettings: vi.fn(),
      sidecarStatus: { Terapias: "running" },
    });
    renderComponent();
    expect(screen.getByText(/Configura la carpeta origen/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Configurar origen/i })).toBeInTheDocument();
  });

  // Test 3: Selección de carpeta origen
  it("should allow selecting a new source directory", async () => {
    mockedUseData.mockReturnValue({
      settings: { ...mockSettings, terapiasDir: "" },
      updateSettings: vi.fn(),
      sidecarStatus: { Terapias: "running" },
    });
    renderComponent();

    const configButtons = screen.getAllByRole("button", { name: /Configurar origen/i });
    fireEvent.click(configButtons[0]);

    await waitFor(() => {
      expect(mockElectronAPI.selectDirectory).toHaveBeenCalled();
      expect(useData().updateSettings).toHaveBeenCalledWith({
        terapiasDir: "C:\\mock\\path",
      });
    });
  });

  // Test 4: handleAutoDetectWord - sin documentos
  it("should display error toast if no Word documents are found during auto-detection", async () => {
    vi.spyOn(terapiasService, "autoDetectWord").mockResolvedValue([]);
    renderComponent();
    await waitFor(() => expect(screen.getByText("Motor listo")).toBeInTheDocument());

    const autoDetectButton = screen.getByRole("button", { name: /Buscar Word en carpeta/i });
    fireEvent.click(autoDetectButton);

    await waitFor(() => {
      expect(terapiasService.autoDetectWord).toHaveBeenCalledWith(mockSettings.terapiasDir);
      expect(toast.error).toHaveBeenCalledWith("No se encontró ningún documento Word en la carpeta origen");
    });
  });

  // Test 5: handleAutoDetectWord - un documento
  it("should set filename and show success toast if one Word document is found", async () => {
    const mockFile = { name: "documento.docx", path: "", modified: 0, size: 0 };
    vi.spyOn(terapiasService, "autoDetectWord").mockResolvedValue([mockFile]);
    renderComponent();
    await waitFor(() => expect(screen.getByText("Motor listo")).toBeInTheDocument());

    const autoDetectButton = screen.getByRole("button", { name: /Buscar Word en carpeta/i });
    fireEvent.click(autoDetectButton);

    await waitFor(() => {
      expect(terapiasService.autoDetectWord).toHaveBeenCalledWith(mockSettings.terapiasDir);
      expect(screen.getAllByText("documento.docx").length).toBeGreaterThan(0);
      expect(toast.success).toHaveBeenCalledWith("Archivo detectado: documento.docx");
    });
  });

  // Test 6: handleAutoDetectWord - múltiples documentos (abre picker)
  it("should open the document picker if multiple Word documents are found", async () => {
    const mockFiles = [
      { name: "doc1.docx", path: "", modified: 0, size: 0 },
      { name: "doc2.docx", path: "", modified: 0, size: 0 },
    ];
    vi.spyOn(terapiasService, "autoDetectWord").mockResolvedValue(mockFiles);
    renderComponent();
    await waitFor(() => expect(screen.getByText("Motor listo")).toBeInTheDocument());

    const autoDetectButton = screen.getByRole("button", { name: /Buscar Word en carpeta/i });
    fireEvent.click(autoDetectButton);

    await waitFor(() => {
      expect(terapiasService.autoDetectWord).toHaveBeenCalledWith(mockSettings.terapiasDir);
      expect(screen.getByRole("heading", { name: /Seleccionar Documento/i })).toBeInTheDocument();
      expect(screen.getAllByText("doc1.docx").length).toBeGreaterThan(0);
      expect(screen.getAllByText("doc2.docx").length).toBeGreaterThan(0);
    });
  });

  // Test 7: Input de nombre de paciente y validación SS
  it("should show SS alert if input name does not contain SS code", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));

    await waitFor(() => {
      expect(screen.getByText(/Código SS no detectado/i)).toBeInTheDocument();
      expect(screen.getByText(/PACIENTE_DESCONOCIDO/i)).toBeInTheDocument();
    });
  });

  // Test 8: Continuar sin SS
  it("should proceed with PACIENTE_DESCONOCIDO if 'Continuar sin SS' is clicked", async () => {
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento_sin_ss.docx"]);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));

    await waitFor(() => {
      expect(screen.getByText(/Código SS no detectado/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Continuar sin SS/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
      expect(screen.getByText("PACIENTE_DESCONOCIDO")).toBeInTheDocument();
    });
  });

  // Test 9: Flujo de preparación exitoso
  it("should successfully prepare document and move to step 2", async () => {
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento_con_ss.docx"]);
    vi.spyOn(terapiasService, "prepareDocument").mockResolvedValue({
      ok: true,
      doc_path: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.docx",
      patient: "Maria Delgado",
      folder: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado",
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 SS Maria Delgado" },
    });

    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y MOVER/i }));

    await waitFor(() => {
      expect(terapiasService.prepareDocument).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Archivo organizado y Word abierto");
      expect(screen.getByText("Paso 2: Finalización")).toBeInTheDocument();
      expect(screen.getByText("Paciente en proceso")).toBeInTheDocument();
    });
  });

  // Test 10: Flujo de finalización exitoso
  it("should successfully finalize document, generate PDF and backup original", async () => {
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento_con_ss.docx"]);
    vi.spyOn(terapiasService, "prepareDocument").mockResolvedValue({
      ok: true,
      doc_path: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.docx",
      patient: "Maria Delgado",
      folder: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado",
    });
    vi.spyOn(terapiasService, "finalizeDocument").mockResolvedValue({
      ok: true,
      pdf_path: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.pdf",
    });
    vi.spyOn(terapiasService, "listDocuments").mockResolvedValue([]); // Para el fetchDocs después de finalizar
    vi.spyOn(terapiasService, "loadHistory").mockResolvedValue([]); // Para el fetchHistory después de finalizar

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    // Paso 1
    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 SS Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));
    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y MOVER/i }));

    // Paso 2
    await waitFor(() => {
      expect(screen.getByText("Paso 2: Finalización")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /GENERAR PDF Y FINALIZAR/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Finalización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y CONVERTIR/i }));

    await waitFor(() => {
      expect(terapiasService.finalizeDocument).toHaveBeenCalledWith(
        "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.docx",
        mockSettings.terapiasBackup,
        "Maria Delgado"
      );
      expect(toast.success).toHaveBeenCalledWith("PDF generado y archivo original respaldado");
      expect(mockElectronAPI.shell.revealInFolder).toHaveBeenCalledWith("C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.pdf");
      expect(screen.getByText("Paso 1: Preparación")).toBeInTheDocument(); // Vuelve al paso 1
    });
  });

  // Test 11: Manejo de errores en prepareDocument
  it("should show error toast if prepareDocument fails", async () => {
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento.docx"]);
    vi.spyOn(terapiasService, "prepareDocument").mockResolvedValue({
      ok: false,
      error: "Error de prueba al preparar",
      doc_path: null,
      patient: null,
      folder: null,
    });
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 SS Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y MOVER/i }));

    await waitFor(() => {
      expect(terapiasService.prepareDocument).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Error: Error de prueba al preparar");
      expect(screen.getByText("Paso 1: Preparación")).toBeInTheDocument();
    });
  });

  // Test 12: Manejo de errores en finalizeDocument
  it("should show error toast if finalizeDocument fails", async () => {
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento_con_ss.docx"]);
    vi.spyOn(terapiasService, "prepareDocument").mockResolvedValue({
      ok: true,
      doc_path: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.docx",
      patient: "Maria Delgado",
      folder: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado",
    });
    vi.spyOn(terapiasService, "finalizeDocument").mockResolvedValue({
      ok: false,
      error: "Error de prueba al finalizar",
    });

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    // Paso 1
    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 SS Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));
    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y MOVER/i }));

    // Paso 2
    await waitFor(() => {
      expect(screen.getByText("Paso 2: Finalización")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /GENERAR PDF Y FINALIZAR/i }));

    await waitFor(() => {
      expect(screen.getByText("Confirmar Finalización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y CONVERTIR/i }));

    await waitFor(() => {
      expect(terapiasService.finalizeDocument).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("Error al finalizar: Error de prueba al finalizar");
      expect(screen.getByText("Paso 2: Finalización")).toBeInTheDocument(); // Permanece en paso 2 si falla
    });
  });

  // Test 13: Comportamiento del buscador de pacientes
  it("should search for patients and display results", async () => {
    const mockSearchResults = [
      { name: "Maria Delgado", path: "C:\\path\\Maria Delgado", lastModified: 1678886400 },
    ];
    vi.spyOn(terapiasService, "searchPatients").mockResolvedValue(mockSearchResults);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Buscar paciente antiguo...");
    fireEvent.change(searchInput, { target: { value: "Maria" } });

    await waitFor(() => {
      expect(terapiasService.searchPatients).toHaveBeenCalledWith("Maria", mockSettings.terapiasDir, mockSettings.terapiasBaseDest);
      expect(screen.getByText("Maria Delgado")).toBeInTheDocument();
    });
  });

  // Test 14: Abrir carpeta de paciente desde resultados de búsqueda
  it("should open patient folder when clicking on a search result", async () => {
    const mockSearchResults = [
      { name: "Maria Delgado", path: "C:\\path\\Maria Delgado", lastModified: 1678886400 },
    ];
    vi.spyOn(terapiasService, "searchPatients").mockResolvedValue(mockSearchResults);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Buscar paciente antiguo...");
    fireEvent.change(searchInput, { target: { value: "Maria" } });

    await waitFor(() => {
      expect(screen.getByText("Maria Delgado")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Maria Delgado"));

    await waitFor(() => {
      expect(mockElectronAPI.shell.openPath).toHaveBeenCalledWith("C:\\path\\Maria Delgado");
      expect(screen.queryByText("Maria Delgado")).not.toBeInTheDocument(); // Results should clear
    });
  });

  // Test 15: Carga del historial
  it("should load and display history entries", async () => {
    const mockHistory = [
      {
        date: new Date().toISOString(),
        patient: "Paciente Historial 1",
        filename: "pdf1.pdf",
        pdfPath: "C:\\path\\pdf1.pdf",
        backupPath: "C:\\backup\\doc1.docx",
      },
    ];
    vi.spyOn(terapiasService, "loadHistory").mockResolvedValue(mockHistory);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Historial de Operaciones/i }));

    await waitFor(() => {
      expect(screen.getByText("Paciente Historial 1")).toBeInTheDocument();
    });
  });

  // Test 16: Cancelar operación actual
  it("should reset to step 1 when 'CANCELAR OPERACIÓN ACTUAL' is clicked", async () => {
    // Simulate being in Step 2
    vi.spyOn(terapiasService, "prepareDocument").mockResolvedValue({
      ok: true,
      doc_path: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado\\documento_con_ss.docx",
      patient: "Maria Delgado",
      folder: "C:\\terapias\\destino\\2026\\06-JUNIO\\25 DE JUNIO\\Maria Delgado",
    });
    vi.spyOn(mockElectronAPI, "listFiles").mockResolvedValue(["documento_con_ss.docx"]);

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    // Trigger Paso 1 to move to Paso 2
    fireEvent.change(screen.getByPlaceholderText("Ej: Control 15-05 SS Maria Delgado"), {
      target: { value: "Control 15-05 SS Maria Delgado" },
    });
    fireEvent.click(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i }));
    await waitFor(() => {
      expect(screen.getByText("Confirmar Organización")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /CONFIRMAR Y MOVER/i }));
    
    await waitFor(() => {
      expect(screen.getByText("Paso 2: Finalización")).toBeInTheDocument();
    });

    // Click Cancel
    fireEvent.click(screen.getByRole("button", { name: /CANCELAR OPERACIÓN ACTUAL/i }));

    await waitFor(() => {
      expect(screen.getByText("Paso 1: Preparación")).toBeInTheDocument();
      expect(screen.queryByText("Paciente en proceso")).not.toBeInTheDocument();
      expect(screen.queryByText("Confirmar Organización")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /PREPARAR Y ABRIR WORD/i })).toBeInTheDocument();
    });
  });

  // Test 17: Atajo de teclado Ctrl+O para auto-detección
  it("should trigger auto-detection with Ctrl+O shortcut", async () => {
    vi.spyOn(terapiasService, "autoDetectWord").mockResolvedValue([]);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "o", ctrlKey: true });

    await waitFor(() => {
      expect(terapiasService.autoDetectWord).toHaveBeenCalled();
    });
  });

  // Test 18: Atajo de teclado F5 para refrescar documentos
  it("should refresh documents with F5 shortcut", async () => {
    vi.spyOn(terapiasService, "listDocuments").mockResolvedValue([]);
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Motor listo")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "F5" });

    await waitFor(() => {
      expect(terapiasService.listDocuments).toHaveBeenCalled();
    });
  });

  // Test 19: Atajo de teclado Ctrl+F para enfocar buscador
  it("should focus search input with Ctrl+F shortcut", async () => {
    renderComponent();
    const searchInput = (await screen.findAllByPlaceholderText("Buscar paciente antiguo..."))[0];
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });

    await waitFor(() => {
      expect(searchInput).toHaveFocus();
    });
  });

});
