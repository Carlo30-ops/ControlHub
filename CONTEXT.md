# CONTEXT.md — ControlHub

> Documento técnico para IAs y sesiones nuevas. **No es documentación de usuario.**
> Última revisión contra código: 2026-06-23. Versión app: **3.2.0** (`package.json`).
> Repositorio standalone — proyectos de referencia (COTU Analytics, Organizador robusto) ya integrados y eliminados del workspace.

---

## 1. Descripción del proyecto

**ControlHub** es una aplicación de escritorio Windows para operaciones documentales en un entorno clínico/administrativo colombiano:

| Módulo | Función |
|--------|---------|
| **Escáner / Analytics (COTU)** | Recorre carpetas, identifica PDFs de facturas COTU, extrae número COTU, aseguradora, montos, fechas; genera reportes exportables |
| **Reportes / Historial** | Tabla filtrable, export CSV/XLSX/PDF, historial de sesiones de escaneo |
| **Terapias** | Flujo Word → edición → PDF con regla SS, estructura `Año/Mes/Día/Paciente`, respaldo |
| **PDF Tools** | 22 herramientas PDF vía sidecar Python (merge, split, OCR, conversiones Office, etc.) |
| **Dashboard** | KPIs del escaneo activo + contador de docs Word pendientes en carpeta terapias |
| **Settings** | Columnas visibles, profundidad de escaneo, aseguradoras custom, operador, rutas |

**Origen:** fusión histórica de **COTU Analytics** (escáner/facturas) + **Organizador robusto** (terapias Word→PDF) + módulo **PDF Tools** propio. Los proyectos fuente ya fueron absorbidos; este repositorio es el producto único.

### Stack completo

| Capa | Tecnología | Versión (package.json) |
|------|------------|------------------------|
| Runtime desktop | Electron | ^40.6.0 |
| UI | React + TypeScript | React ^18.3.1, TS ^5.5.3 |
| Routing | React Router (hash) | ^7.13.0 |
| Build | Vite + esbuild | Vite ^6.3.5 |
| Estilos | Tailwind CSS v4 + Radix/shadcn | tailwindcss ^4.1.12 |
| PDF parsing (Node) | pdf-parse | ^1.1.1 |
| Watcher | chokidar | ^5.0.0 |
| Concurrencia escaneo | p-limit | ^7.3.0 |
| OCR fallback | tesseract.js (main process) | ^5.1.0 |
| Config runtime | electron-store (solo flags de migración) + settings.json / database.json | ^11.0.2 |
| Sidecars | Python embebido (win32com, pikepdf, PyMuPDF, pytesseract) | `python-embed/` |
| Empaquetado | electron-builder + NSIS | ^26.8.1 |
| Load test CLI | tsx + pdf-parse | tsx ^4.22.4 (dev) |

**Plataforma objetivo:** Windows 10/11. Rutas hardcodeadas a OneDrive/Tesseract en varios puntos — **no portable cross-platform sin trabajo**.

---

## 2. Arquitectura

```mermaid
flowchart TB
  subgraph renderer [Renderer — React]
    Pages[Pages: Scanner, Reports, Terapias, PDFTools...]
    DC[DataContext]
    LS[localScanner.ts v3.3]
    Pages --> DC
    Pages --> LS
    LS -->|electronAPI| Preload
  end

  subgraph preload [Preload — contextBridge]
    Preload[preload.ts → window.electronAPI]
  end

  subgraph main [Main Process — electron/main.ts]
    IPC[ipcMain handlers]
    WP[WorkerPool]
    PW[pdfWorker.ts UtilityProcess]
    DB[database.ts JSON]
    ES[electron-store migración]
    TW[SidecarManager Terapias]
    PS[SidecarManager PDF]
    OCR[Tesseract.js OCR fallback]
    CH[chokidar watcher]
    IPC --> WP --> PW
    IPC --> DB
    IPC --> ES
    IPC --> TW
    IPC --> PS
    IPC --> OCR
    IPC --> CH
  end

  subgraph python [Sidecars Python — stdin/stdout JSON]
    TB[terapias_bridge.py]
    PB[pdf_bridge.py]
    TL[terapias_logic.py]
    TW --> TB --> TL
    PS --> PB
  end

  Preload --> IPC
  PW -->|pdf-parse| PDFLib[pdf-parse npm]
  PB -->|pikepdf fitz win32com| PyLibs[Python libs]
```

### Flujo COTU (escaneo de facturas)

```text
Usuario elige carpeta
  → localScanner.scanLocalDirectory()
  → IPC fs:readDirectory (main, cancelable por scanId)
  → por carpeta COTU: identifyInvoicePdf() [capa 1 nombre, capa 2 contenido]
  → IPC fs:parsePdf → WorkerPool → pdfWorker → pdf-parse
  → [fallback] IPC ocr:extractText → sidecar pdf_to_jpg + Tesseract
  → extracción regex: COTU, monto COP, aseguradora, fechas
  → DataContext.addToHistory + setCurrentScan
  → IPC db:saveScan → database.json
  → navigate("/reports")
```

### Flujo Terapias

```text
Terapias UI → IPC terapias:list_docs
  → [Paso 1] Validación existencia vía IPC fs:listFiles
  → Helper getFinalPathPreview (previsualización ruta AÑO/MES/DÍA)
  → IPC terapias:prepare (mueve + abre Word)
  → terapias_bridge.py (Word COM persistente)
  → terapias_logic.py (SS, sanitize_filename, build_folder_structure)
  → [Paso 2] IPC terapias:finalize (PDF + backup)
  → log rotativo ~/Documents/TERAPIAS/organizar_log.txt
```

### Flujo PDF Tools

```text
PDFTools UI → IPC pdf:* (22 handlers)
  → pdf_bridge.py (pikepdf, PyMuPDF, subprocess, pytesseract)
  → respuesta JSON al renderer
```

### Protocolo custom

- `cotu://pdf?path=...` — sirve PDFs locales para preview en `<iframe>` sin abrir explorador.

### Comunicación sidecar

- **Protocolo:** una línea JSON por request/response en stdin/stdout.
- **SidecarManager:** cola FIFO de Promises; si el proceso muere, rechaza pendientes.
- **Auto-restart:** `maxRestarts = 3` — habilitado con backoff exponencial (P10) y límite de intentos.

---

## 3. Estructura de archivos clave

```
ControlHub/
├── CONTEXT.md                    ← documentación técnica (este archivo)
├── README.md                     ← onboarding público
├── package.json                  ← versión, scripts, deps
├── vite.config.ts                ← build React + Electron, manualChunks
├── scripts/
│   └── loadTest.ts               ← load test CLI (Node puro, sin Electron)
├── electron/
│   ├── main.ts                   ← IPC, sidecars, watcher, OCR, ventana
│   ├── preload.ts                ← contextBridge → electronAPI
│   ├── pdfWorker.ts              ← UtilityProcess: readFile + pdf-parse
│   ├── workerPool.ts             ← pool UtilityProcess
│   ├── database.ts               ← persistencia JSON userData
│   └── sidecar/
│       ├── terapias_bridge.py    ← IPC Python terapias
│       ├── terapias_logic.py     ← reglas SS/carpetas
│       ├── pdf_bridge.py         ← 22 comandos PDF
│       └── tests/                ← suites Python
├── src/
│   ├── main.tsx                  ← entry React
│   ├── electron.d.ts             ← tipos electronAPI
│   ├── shared/types.ts           ← fuente única de tipos de dominio
│   ├── app/
│   │   ├── App.tsx               ← ThemeProvider + DataProvider + Router
│   │   ├── routes.tsx            ← hash router, lazy routes
│   │   ├── config/validation.ts  ← validadores de settings
│   │   ├── contexts/             ← DataContext, ThemeContext
│   │   ├── components/           ← layouts, navigation, ui (solo usados)
│   │   ├── pages/                ← Scanner, Reports, Terapias, PDFTools...
│   │   └── utils/
│   │       ├── localScanner.ts   ← motor COTU v3.3.0
│   │       └── mockData.ts       ← modo demo (Scanner)
│   └── tests/                    ← Vitest
├── python-embed/                 ← Python embebido producción (gitignored)
└── public/                       ← iconos estáticos
```

---

## 4. Problemas conocidos y su estado

| ID | Problema | Clasificación | Estado |
|----|----------|---------------|--------|
| P01 | `profiler:save` IPC eliminado de main.ts pero preload expone `reportProfilerData` y DataContext lo invoca al unmount | **Confirmado** | ✅ RESUELTO — Código profiler eliminado y limpieza de hooks |
| P02 | Optional chaining en filtros de Compañía y Año en Reports.tsx. activeScan cae a history[0] cuando currentScan es nulo. | **Confirmado** | ✅ RESUELTO — Unificación de activeScan (currentScan ?? history[0]) |
| P03 | Tipos centralizados en `src/shared/types.ts` | **Confirmado** | ✅ RESUELTO — fuente única importada en DataContext, localScanner, database, páginas |
| P04 | Triple persistencia settings/history: `localStorage` (`ordertrack-*`), `database.json` IPC, `electron-store` | **Confirmado** | **Corregido** — Triple persistencia unificada; `updateSettings` restaurada tras regresión |
| P05 | Claves terapias fragmentadas: `settings.terapiasDir` vs `terapiasSourceDir`; Settings solo escribe la primera; Terapias sincroniza ambas; main.ts IPC terapias lee `terapiasSourceDir` | **Confirmado** | ✅ RESUELTO — Unificación de claves de configuración y sincronización |
| P06 | IPC `pdf:pdf_to_excel` / `pdf:pdf_to_ppt` registrados en main.ts; **no implementados** en pdf_bridge.py; **no expuestos** en UI PDFTools | **Confirmado** | ✅ RESUELTO — Handlers huérfanos eliminados |
| P07 | `electron/pdfTools/*.js` (libreoffice, ghostscript, qpdf) existen pero no importados en main.ts | **Confirmado** | ✅ RESUELTO — Carpeta inexistente/eliminada |
| P08 | `electron.d.ts` incompleto → ~50 usos de `(window as any).electronAPI` pese al comentario "Fix #9 elimina @ts-ignore" | **Confirmado** | ✅ RESUELTO — Tipado completo y eliminación de (window as any) |
| P09 | Implementado getFinalPathPreview, validación de archivo en carpeta origen via listFiles, diálogo de confirmación muestra Ruta Final completa AÑO/MES/DÍA/PACIENTE. | **Confirmado** | ✅ RESUELTO — Paridad con Organizador robusto y validación SS |
| P10 | Sidecar auto-restart deshabilitado (`maxRestarts=0`); sidecar caído requiere click manual en Sidebar | **Confirmado** | ✅ RESUELTO — auto-restart con límite 3 y backoff exponencial |
| P11 | Rutas duplicadas `/` y `/dashboard` → mismo componente | **Confirmado** | **Corregido** — Eliminada ruta `/dashboard` |
| P12 | Suspense doble: routes.tsx + MainLayout.tsx | **Confirmado** | ✅ RESUELTO — Consolidado en routes.tsx |
| P13 | Dashboard empty state muestra `MOCK_DASHBOARD_DATA` difuminado detrás del overlay | **Confirmado** | ✅ RESUELTO — Implementado empty state limpio y eliminación de mock data |
| P14 | README dice v1.0.0 y "23 herramientas PDF"; package.json v3.2.0; UI tiene **22** tools | **Confirmado** | **Corregido** — Sidebar agrupado por dominios e iconos actualizados |
| P15 | `dialog:selectDirectory` IPC en main.ts no expuesto en preload; UI usa `select-directory` | **Confirmado** | ✅ RESUELTO — Handler alineado y expuesto en preload |
| P16 | `html2canvas`, `pdf-lib` en package.json/vite chunks; **sin imports en src/** | **Confirmado** | ✅ RESUELTO — `html-to-image` removido (no se usaba); `jsPDF` reemplazado por render HTML→PDF en el sidecar Python (`pdf_bridge.py`) para reducir el bundle y unificar renderizado; dependencia removida de `package.json`. |
| P17 | Tesseract ruta fija `C:\Program Files\Tesseract-OCR\tesseract.exe` en pdf_bridge.py | **Confirmado** | ✅ RESUELTO — Detección dinámica y configuración de ruta en Settings; `settings.tesseractPath` ahora se lee desde AppSettings y electron-store. |
| P18 | Race en DataContext init: `currentScan === null` check en línea 237 usa state stale del closure inicial | **Probable** | ✅ DESCARTADO — Riesgo puramente teórico. `currentScan` solo se setea por `initData` al arranque o por acción del usuario; no hay procesos paralelos que lo modifiquen en esa ventana. |
| P19 | SidecarManager: requests concurrentes comparten cola FIFO pero **sin correlación request/response** si Python responde fuera de orden | **Confirmado** | ✅ RESUELTO — Correlación por ID incremental en SidecarManager y bridges |
| P20 | Memory leak `pdfTextCache`: Descartado por evidencia empírica. Fase full mostró Δ Heap = -11.63 MB (GC activo). | **Descartado** | ✅ DESCARTADO — El cache se limpia automáticamente al inicio de cada sesión vía `pdfTextCache.clear()` en `scanLocalDirectory`. |
| P21 | `load-test` fase `full` reprocesa los mismos 100 PDFs de baseline | **Confirmado** | Diseño actual — no es bug, es decisión de medición |
| P22 | main.ts load test embebido rompió sintaxis | **Confirmado** | **Corregido** — eliminado; script en `scripts/loadTest.ts`. |
| P23 | Optional chaining en filtros de Compañía y Año en Reports.tsx. activeScan cae a history[0] cuando currentScan es nulo. | **Probable** | ✅ RESUELTO — Fix (aplicar en Reports) |
| P24 | Tests: solo 2 suites Python sidecar; **cero** tests Electron/React/E2E | **Confirmado** | ✅ RESUELTO — Suite de tests Vitest para localScanner implementada |
| P25 | Operador default distinto: Sidebar "Operador ControlHub" vs DataContext default "Usuario Admin" | **Confirmado** | ✅ RESUELTO — Unificado operador y consumo centralizado de settings |
| P26 | Rendimiento Parsing PDF: No es cuello de botella. 37ms promedio, 0 errores en 67 archivos. | **Optimizado** | Comportamiento esperado |
| P27 | Virtualización de tablas | Baja Prioridad | ✅ DESCARTADO — `Reports.tsx` renderiza solo `paginatedInvoices`, no `filteredInvoices`. `rowsPerPage` viene de `settings.display.rowsPerPage` y `paginatedInvoices = sortedInvoices.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)`, por lo que la tabla nunca intenta renderizar todas las filas a la vez. Dataset real máximo = 67 filas; virtualización no aporta mejora significativa ni justifica la complejidad adicional. |
| P28 | Selector de sesión en Reportes (dropdown con fecha, N facturas y ruta) | **Nuevo** | ✅ RESUELTO — Implementado dropdown en Reports.tsx |
| P29 | Auto-detección de Word en carpeta origen (Terapias) | **Nuevo** | ✅ RESUELTO — Botón "Buscar Word en carpeta" con selección inteligente |
| P30 | Validación de código SS en nombre de entrada (Terapias) | **Nuevo** | ✅ RESUELTO — Diálogo de advertencia y normalización de PACIENTE_DESCONOCIDO |
| P31 | Terapias no auto-detecta archivos Word al entrar al módulo — `fetchDocs` useEffect con dependencias incorrectas | **Confirmado** | ✅ RESUELTO — settings.terapiasDir agregado a dependencias del useEffect en Terapias/index.tsx |
| P32 | `incomingFile` en PDFTools era variable de módulo fuera del ciclo React | **Confirmado** | ✅ RESUELTO — Migrado a useState; banner visible cuando llega archivo sin herramienta activa |
| P33 | Pre-probe de resolución de ruta para escaneo por día y rango personalizado — `scanLocalDirectory()` llamaba a `fs:readDirectory` directamente sin pre-probe. No existía código que resolviera la subcarpeta AÑO/MES/DÍA antes de iniciar la traversal; `applyDateFilter` corría post-proceso sobre el árbol completo. | **Confirmado** | ✅ RESUELTO — `resolveTargetDayFolder()` y `resolveTargetRangeFolder()` implementadas en localScanner.ts con patrones: mes (MM-NOMBRE, MM-DE NOMBRE, MM. NOMBRE, MM NOMBRE), día (DD DE NOMBRE, DD NOMBRE, DD); rango usa mes/año cuando aplica. Búsqueda combinatoria → fallback full scan. Logs: `[PRE-PROBE] resolved to:` o `no match found`. |
| P34 | Reportes PDF preview puede fallar por allowlist de IPC si la carpeta escaneada no está registrada como aprobada. | **Confirmado** | ✅ RESUELTO — añadido `security:registerApprovedDirectory` en el renderer y main; `window.electronAPI.security.registerApprovedDirectory` ahora asegura que la carpeta raíz escaneada se permita para preview de PDF en Reports. |
| P35 | Settings sin anclas — imposible navegar a sección específica | **Confirmado** | ✅ RESUELTO — ids scanning/terapias + scroll por location.state (evita conflicto con createHashRouter) |
| P34 | Dashboard mostraba solo contador de Terapias, sin acceso a docs individuales | **Confirmado** | ✅ RESUELTO — Lista hasta 3 docs clickeables con preloadedDoc; fallback silencioso si listDocs falla |
| P35 | Claves legacy ordertrack-* y cotu-last-path en localStorage sin respaldo IPC | **Confirmado** | ✅ RESUELTO — Migrado theme y lastScanPath a AppSettings; eliminado todo localStorage del renderer |
| P36 | ThemeProvider por encima de DataProvider — useData() fallaba en runtime | **Confirmado** | ✅ RESUELTO — Invertido orden en App.tsx: DataProvider envuelve ThemeProvider |
| P37 | Cero atajos de teclado globales y en Terapias | **Confirmado** | ✅ RESUELTO — Globales Ctrl+1..5/H en MainLayout; Ctrl+O/F5/Ctrl+F en Terapias |
| P38 | `handle_compress` sin fallback fitz — sin GS el resultado era compresión básica | **Confirmado** | ✅ RESUELTO — Cadena GS → fitz → pikepdf; mejor compresión sin Ghostscript |
| P39 | `finally` defensivo faltante en conversiones COM (`word_to_pdf`, `excel_to_pdf`, `ppt_to_pdf`) | **Confirmado** | ✅ RESUELTO — finally defensivo en los 3 handlers COM |
| P40 | `handle_crop` usaba primera página como referencia — páginas mixtas se desplazaban | **Confirmado** | ✅ RESUELTO — Cropbox absoluto con clamp por página |
| P41 | `handle_pdf_to_word` sin detección de tipo PDF — mismo motor para todo | **Confirmado** | ✅ RESUELTO — Clasificador 5D (_classify_pdf): texto, imágenes, trazos, formularios, columnas; strategy_order según perfil |
| P42 | `handle_pdf_to_word` sin detección de PDF protegido | **Confirmado** | ✅ RESUELTO — _is_pdf_protected antes de intentar conversión |
| P43 | `handle_pdf_to_word` sin validación post-conversión — .docx vacío devolvía ok:True | **Confirmado** | ✅ RESUELTO — _validate_docx valida existencia y tamaño mínimo |
| P44 | `warning` del sidecar silenciado en UI — usuario no sabía que usó fallback | **Confirmado** | ✅ RESUELTO — warning en banner amarillo, pdf_profile y engine como chips en vista resultado |
| P45 | `handle_split`, `handle_jpg_to_pdf`, `handle_rotate`, `handle_delete_pages`, `handle_reorder_pages` sin finally ni validaciones | **Confirmado** | ✅ RESUELTO — finally defensivo + validación de inputs y outputs en los 5 handlers |
| P46 | `handle_watermark`, `handle_watermark_image`, `handle_extract`, `handle_add_page_numbers`, `handle_ocr` sin finally | **Confirmado** | ✅ RESUELTO — finally defensivo + validaciones en los 5 handlers |
| P47 | `_ok_result` definida dos veces en `handle_pdf_to_word` — versión sin `pdf_profile` quedaba muerta | **Confirmado** | ✅ RESUELTO — Unificada en una sola definición con pdf_profile opcional |
| P48 | `pythoncom.CoUninitialize()` llamado dos veces en happy path de `handle_pdf_to_word` | **Confirmado** | ✅ RESUELTO — finally externo como único responsable de CoUninitialize |
| P49 | FileDropZone modo múltiple sin preview visual — solo lista de texto | **Confirmado** | ✅ RESUELTO — Grid de cards con thumbnail via pdfthumb:// protocolo |
| P50 | Sin protocolo para servir imágenes PNG locales al renderer | **Confirmado** | ✅ RESUELTO — Protocolo pdfthumb:// registrado en whenReady |
| P51 | Sin IPC para thumbnail de PDF | **Confirmado** | ✅ RESUELTO — handle_pdf_thumbnail en pdf_bridge.py + IPC pdf:pdf_thumbnail |
| P52 | UI resultado no mostraba warning ni motor usado | **Confirmado** | ✅ RESUELTO — Banner amarillo warning + chips pdf_profile y engine |
| P53 | Cola automática multi-archivo en herramientas single-file — pendiente | **Nuevo** | ✅ RESUELTO — Procesamiento secuencial con UI de progreso por archivo |
| P55 | `isContentEditable` no existe en tipo `Element` — MainLayout.tsx y Terapias/index.tsx | **Confirmado** | ✅ RESUELTO — cast a `(document.activeElement as HTMLElement)?.isContentEditable` |
| P56 | `className` no aceptado en raíz de `<Select>` Radix UI — Reports.tsx | **Confirmado** | ✅ RESUELTO — envuelto en `<div className="...">` |
| P57 | `err` tipado como `{}` sin propiedad `message` — Settings.tsx | **Confirmado** | ✅ RESUELTO — cast a `(err as Error)?.message` |
| P58 | Persistencia dual: `settings.json` + `electron-store` para `terapiasDir`/`tesseractPath`/rutas Terapias | **Confirmado** | ✅ RESUELTO — `settings.json` como fuente única; migración one-time `migration.electronStoreSettings` en main; `electron-store` solo flags de migración |
| P59 | Pre-probe duplicado en `Scanner.tsx` y `localScanner.ts`; abort silencioso si falla resolución por día | **Confirmado** | ✅ RESUELTO — pre-probe solo en `localScanner.ts`; fallback a full scan + toast en Scanner |
| P60 | `config.getAll`/`setAll`/`delete` expuestos en preload sin handlers en main | **Confirmado** | ✅ RESUELTO — eliminados del preload |

---

## 5. Decisiones de arquitectura tomadas

| Decisión | Razón | Alternativas descartadas |
|----------|-------|--------------------------|
| **Electron + React** | Unificar COTU (ya Electron) + Terapias + PDF en una shell; UI moderna | Mantener Organizador Tkinter separado; Tauri [no evaluado en repo] |
| **Hash router** (`createHashRouter`) | Electron carga `file://` o dev server; hash evita problemas de pathname | BrowserRouter — problemas con file protocol |
| **Sidecars Python persistentes** | Word COM (`win32com`) requiere proceso vivo; conversiones PDF pesadas fuera del main | Invocar Python por subprocess por operación (más lento); portar todo a Node (Word COM imposible) |
| **pdf-parse en UtilityProcess pool** | No bloquear main; reutilizar workers (Fix #10) | parsePdf sync en main; subprocess por PDF |
| **JSON línea a línea con sidecars** | Simple, debuggeable | gRPC, named pipes — overkill |
| **electron-store + database.json** | Historial en JSON; settings en `settings.json`; electron-store solo para flags de migración one-time | Triple persistencia con localStorage — unificada en v3.2+ |
| **DataContext monolítico** | Herencia COTU; suficiente para escala actual | Redux/Zustand — no adoptado |
| **Lazy routes + Suspense** | Reducir bundle inicial | Import estático — bundle más grande |
| **Load test como CLI Node** (`scripts/loadTest.ts` + pdf-parse) | Aísla benchmark de Electron; evita romper main | Load test embebido en main con `--run-load-test` — **descartado tras incidente sintaxis** |
| **Python embebido en extraResources** | Deploy sin Python del sistema |
| **OCR en main (Tesseract.js) + pdf_to_jpg sidecar** | Fallback cuando pdf-parse no extrae texto |
| **Generación de PDF (renderer → sidecar HTML→PDF)** | Reemplazado `jsPDF` en el renderer por render HTML frente al sidecar Python (`html_to_pdf`) para reducir el bundle, reutilizar la cadena de herramientas PDF existente y mantener fidelidad de layout en Windows empaquetado. | Mantener `jsPDF` en el renderer (aumenta bundle y duplicación de motores de PDF) |

---

## 6. Deuda técnica priorizada

Ordenada por **impacto real en producción/uso diario**, no severidad teórica:

1. **P13** — ✅ RESUELTO: Implementación de empty state limpio en Dashboard.
2. **P17** — ✅ RESUELTO: Tesseract path configurable y detección dinámica.
3. **P19** — ✅ RESUELTO: Correlación request/response por ID en sidecars.
4. **P28** — ✅ RESUELTO: Selector de sesión en Reportes.
5. **P29 + P30** — ✅ RESUELTO: Paridad operativa y seguridad en Terapias.
6. **P12 + P25** — ✅ RESUELTO: Limpieza de UI (Suspense y Operador).
7. **P15** — ✅ RESUELTO: Handler dialog:selectDirectory alineado y expuesto en preload.
8. **P07 + P16** — ✅ RESUELTO: Eliminación de código y dependencias muertas; `jsPDF` reemplazado por render HTML→PDF en el sidecar y eliminado de `package.json`.
9. **P20** — ✅ DESCARTADO: Memory leak pdfTextCache no existe.
10. **P27** — Virtualización de tablas (Baja prioridad)
11. **P31** — ✅ RESUELTO: Auto-detect Word al montar Terapias (useEffect dependencia fix).
12. **P32** — ✅ RESUELTO: Puente Reportes → PDF Tools (P32)
13. **P33** — ✅ RESUELTO: Settings anclas → `#scanning`, `#terapias` (P33)
14. **P34** — ✅ RESUELTO: Dashboard → Terapias doc pre-seleccionado (P34)
15. **P35/P36** — ✅ RESUELTO: Deprecar ordertrack-* y orden providers App.tsx (P35, P36)
16. **P37** — ✅ RESUELTO: Atajos de teclado globales y en Terapias (P37)

---

## 7. Convenciones del proyecto

### Naming

| Ámbito | Patrón | Ejemplo |
|--------|--------|---------|
| IPC main | `namespace:action` | `fs:parsePdf`, `terapias:prepare`, `pdf:merge` |
| Sidecar cmd | snake en JSON `cmd` | `{ cmd: 'list_docs', data: {...} }` |
| React pages | PascalCase archivo + export | `Scanner.tsx` → `export function Scanner` |
| Context hooks | `useData()`, `useTheme()` |
| localStorage legacy | prefijo `ordertrack-` | `ordertrack-settings`, `ordertrack-history`, `ordertrack-theme` |
| Scanner path cache | `cotu-last-path` |
| IDs escaneo | UUID v4 | `scanId` para cancelación |

### Tipos

- **Fuente única:** `src/shared/types.ts` — Invoice, ScanResult, AppSettings, ScanStats, etc.
- **Tipos IPC:** `src/electron.d.ts` complementa el contrato preload.

### Manejo de errores

| Capa | Patrón |
|------|--------|
| Sidecar Python | `{ ok: false, error: "..." }` en JSON stdout |
| IPC main | try/catch → `{ success: false, error }` o rethrow |
| Renderer | `toast.error()` (sonner) + console.error |
| parsePdf worker | `{ success: false, error }` → localScanner marca `parseError: true` |
| Sidecar caído | Sidebar chip rojo; click → `sidecar:reconnect` |

### Patrones IPC

```typescript
// Preload — contextBridge, no nodeIntegration
contextBridge.exposeInMainWorld('electronAPI', { ... });

// Renderer — preferir window.electronAPI, realidad: (window as any).electronAPI
await window.electronAPI.parsePdf(path, 1);

// Main — ipcMain.handle (async, retorna Promise)
ipcMain.handle('fs:parsePdf', async (_, pdfPath, maxPages) => { ... });

// Eventos main → renderer
win.webContents.send('scan-progress', payload);
// Preload: ipcRenderer.on + callback registrado
```

### Sidecar

- Un request = un JSON + `\n` a stdin.
- Una response = un JSON + `\n` en stdout.
- stderr reservado para logs; stdout **solo JSON** (sidecars redirigen print accidental a stderr).

### Routing

- Hash paths: `/`, `/scanner`, `/reports`, `/history`, `/pdf-tools`, `/terapias`, `/settings`
- Navegación programática post-escaneo: `navigate("/reports")` tras 1s
- State: `{ autoSelect: true }` en Scanner para abrir selector de carpeta

---

## 8. Comandos esenciales

Ejecutar desde `ControlHub/`:

```bash
# Desarrollo — Vite dev server + Electron (hot reload renderer)
npm run dev

# Build producción — React dist/ + Electron dist-electron (NO empaqueta instalador)
npm run build

# Build + instalador NSIS Windows
npm run build:electron

# Preview del bundle Vite (sin Electron)
npm run preview

# Load test PDF parsing — Node puro, sin Electron
npm run load-test
# → escanea FACTURA DE MUESTRA/
# → escribe metrics/loadtest_<timestamp>.json + .md

# Diagnóstico manual de un PDF — usar load-test o escaneo real
```

**Notas no obvias:**
- `npm run build` compila **tres** targets Vite: renderer, main+pdfWorker, preload.
- `npm run dev` abre DevTools automáticamente (`main.ts` → `openDevTools()`).
- Load test requiere carpeta local `FACTURA DE MUESTRA/` con PDFs (gitignored; crear manualmente para benchmarks).
- Python sidecars en dev usan `python-embed/python.exe` relativo a cwd.
- Sidecar tests: [INCIERTO] `pytest electron/sidecar/tests/` — no hay script npm definido.

---

## 9. Lo que NO hacer

Decisiones ya evaluadas y **descartadas** — no re-proponer sin justificación nueva:

| ❌ No hacer | Por qué |
|-------------|---------|
| **Embeber load test en `electron/main.ts`** | Rompió el build (jun 2026). Usar `scripts/loadTest.ts`. |
| **Usar `ts-node` para scripts** | Se eligió `tsx` — más ligero, ya en devDependencies. |
| Migrar a BrowserRouter | Roto con Electron file protocol. |
| nodeIntegration: true en renderer | Violación de seguridad; preload + contextIsolation es el patrón actual. |
| Reemplazar sidecars Python por Node para Word/Terapias | Word COM requiere pywin32 en Windows. |
| Unificar todo en SQLite ahora | Migración grande; JSON + trimHistory funciona para escala actual — evaluar SQLite solo si crece el historial |
| Habilitar auto-restart sidecar sin límite | Auto-restart habilitado con `maxRestarts=3` y backoff exponencial (P10) |
| Duplicar lógica COTU en otro módulo | `localScanner.ts` es el único motor; no crear segundo scanner. |
| Importar código Electron desde `scripts/loadTest.ts` | Load test debe ser Node puro + pdf-parse. |
| Usar `electron/pdfTools/*.js` sin cablear | Código legacy no conectado; implementar en sidecar o eliminar. |
| Confiar en README para versión/arquitectura | README dice v1.0.0; fuente de verdad: `package.json` + este CONTEXT.md. |
| Recrear proyectos fuente separados (COTU Analytics, Organizador Tkinter) | Ya fusionados en ControlHub; mantener un solo repositorio. |
| Proponer fusión con apps Tkinter | Ya fusionado en Electron; Organizador queda como referencia UX. |
| Añadir `profiler:save` placeholder vacío | Fue anti-patrón del incidente load test; implementar completo o eliminar referencias. |

---

## 10. Apéndice: estado de build (2026-06-19)

- `npm run build` — **OK** (renderer + main + preload)
- `electron/main.ts` — **OK** (load test embebido eliminado)
- `npm run load-test` — **implementado, no ejecutado en CI** [INCIERTO en pipelines]

---

## 11. Estado del producto y pendientes

**Veredicto:** ControlHub cumple el objetivo de unificar COTU + Terapias + PDF Tools. El núcleo COTU supera la referencia original; Terapias tiene paridad operativa; PDF Tools es extensión propia (22 herramientas).

**Pendientes activos:**

No hay issues de alta prioridad abiertas.

| Prioridad | Tarea |
|-----------|-------|
| Baja | Virtualización de tablas (P27) |

**Completados recientemente:**

| Issue | Descripción |
|-------|-------------|
| P53 | ✅ Cola automática multi-archivo con procesamiento secuencial |

---

## 12. Comparativa histórica vs proyectos fuente

> Los proyectos originales ya no existen como repos separados; esta tabla documenta el grado de paridad alcanzado.

### COTU Analytics → ControlHub

| Capacidad | Referencia | ControlHub |
|-----------|------------|------------|
| Escaneo COTU | ✅ | ✅ + OCR, NIT/paciente, duplicados |
| Dashboard | LineChart | AreaChart + KPIs comparativos |
| Export | CSV/XLSX/PDF | ✅ |
| Watcher | ✅ | ✅ |
| Worker pool PDF | ✅ | ✅ |

### Organizador robusto → Terapias

| Capacidad | Organizador | ControlHub |
|-----------|-------------|------------|
| Regla SS + estructura carpetas | ✅ | ✅ (`terapias_logic.py`) |
| Word → PDF | ✅ | ✅ sidecar persistente |
| Historial + búsqueda paciente | ✅ vistas separadas | ✅ en una página |
| Confirmación pre-movimiento | ✅ | ✅ (P09) |
| Diálogo falta SS | ✅ | ✅ (P30) |
| Selector multi-doc | ✅ | ✅ (Auto-Word P29) |
| Atajos teclado (`Ctrl+O`, `F5`, `Ctrl+F`) | ✅ | ✅ (P37) |
| Config unificada (word_path, etc.) | ✅ | ✅ — `settings.json` vía `db:saveSettings` |
| Tests automatizados | 5 suites | 2 Python + Vitest |

### PDF Tools (módulo propio)

- **22 herramientas** en UI (no 23).
- **22 herramientas a nivel producción. Todos los handlers tienen finally defensivo, 
   validación de inputs/outputs y errores descriptivos. handle_pdf_to_word incluye 
   clasificador de contenido 5D y selección automática de motor.**
- Sidecar `pdf_bridge.py` con pikepdf, PyMuPDF, win32com, pytesseract.

---

## 13. Fricciones de navegación — estado

| Problema | Impacto | Estado |
|----------|---------|--------|
| Módulos COTU vs sidecars desconectados | Alto | ✅ RESUELTO — puente Reportes→PDF Tools implementado |
| Reportes sin selector de sesión | Alto | ✅ RESUELTO (P28) |
| Ruta duplicada `/` y `/dashboard` | Bajo | ✅ RESUELTO (P11) |
| Iconos ambiguos Reportes vs PDF Tools | Medio | ✅ RESUELTO — `BarChart3` / `FileStack` |
| Scanner → Settings genérico | Medio | ✅ RESUELTO — anclas `#scanning` / `#terapias` (P35) |
| Suspense doble | Bajo | ✅ RESUELTO (P12) |
| Branding legacy `ordertrack-*` | Bajo | ✅ RESUELTO — Migración one-time a AppSettings/database.json |
| Atajos teclado globales y Terapias | Medio | ✅ RESUELTO (P37) — Ctrl+1..5/H global; Ctrl+O/F5/Ctrl+F en Terapias |

---

## 14. Changelog de sesiones recientes

### 2026-06-23 — Persistencia unificada, pre-probe y limpieza IPC
- P58: `settings.json` como única fuente para `terapiasDir`, `tesseractPath`, `terapiasBaseDest`, `terapiasBackup`. Migración one-time desde electron-store en `main.ts`. UI usa solo `updateSettings`/`saveSettings`.
- P59: Eliminado pre-probe duplicado en `Scanner.tsx`. `localScanner.ts` hace fallback a full scan con `preProbeFallback` + toast de aviso.
- P60: Eliminados `config.getAll`/`setAll`/`delete` del preload (sin handlers).
- `npm run typecheck` — 0 errores. `npm run test` — 11/11 OK.

### 2026-06-22 — P33/P34 v3: Integración targetDate en Scanner y allowlist de preview PDF
- P33 v1: Patrones iniciales MM/DD para escaneo por fecha.
- P33 v2: Agregados patrones con espacio simple (`MM NOMBRE_MES`, `DD NOMBRE_MES`).
- P33 v3 (hoy):
  - `resolveTargetDayFolder()` con logging exhaustivo (12+ logs por ciclo) para diagnosticar por qué falla pre-probe.
  - `resolveTargetRangeFolder()` mejorado para resolver mes/año cuando se usa rango personalizado, evitando traversal completa en la mayoría de casos.
  - `Scanner.tsx`: agregado `targetDate: scanType === 'day' && startDate ? startDate : undefined` en opciones de `scanLocalDirectory`.
  - Ahora el escaneo por día invoca correctamente `resolveTargetDayFolder()` desde localScanner.ts y reduce el árbol leído antes de aplicar filtros.
  - P34: previsualización PDF en Reports estabilizada registrando la carpeta raíz escaneada con `security:registerApprovedDirectory` antes de solicitar `fs:readPdfAsBase64`.
- Problemas abiertos: barra de progreso se congela en casos de fallback a full scan silencioso; necesita validación con logs en DevTools.
- `npm run typecheck` — 0 errores. Build limpio.

### 2026-06-21 — PDF Tools: thumbnails, protocolo pdfthumb, UI resultado
- P49/P50/P51: FileDropZone modo múltiple con grid de cards y thumbnails 
  via nuevo protocolo pdfthumb:// y handler handle_pdf_thumbnail.
- P52: Vista resultado — warning en amarillo, chips pdf_profile y engine.
- P53: Cola multi-archivo con UI reordenación — en progreso.
- Build limpio confirmado post-sesión.

### 2026-06-22 — P53 cerrado y documentación unificada
- P53 implementado: cola automática multi-archivo con procesamiento secuencial, UI de progreso por archivo y estado individual.
- P54: puente Reportes→PDF Tools implementado; envía escaneo activo como cola de archivos y preselecciona herramienta desde selector en Reports.
- P10: habilitado auto-restart para Sidecars Terapias/PDF con `maxRestarts=3` y backoff exponencial; Sidebar distingue `reconnecting`, `failed` y `closed`.
- P16: corregido — `html-to-image` removido (importaba `toPng` pero nunca se usaba); `jsPDF` convertido a dynamic import en `handleExportPDF()` para lazy-loading; `html2canvas.esm` (201KB) ahora es chunk separado que se carga solo cuando usuario exporta PDF.

- P53 Docs eliminados: solo se conserva CONTEXT.md como fuente de verdad.
- Regla añadida: toda documentación nueva va a CONTEXT.md; no se crean archivos markdown por feature individual.
- P35: Agregada migración one-time de legacy `ordertrack-*` y `cotu-last-path` desde `localStorage` a AppSettings (`settings.json`) y `database.json`; marca de migración `migration.legacyLocalStorage` guardada en electron-store.
- Build limpio confirmado post-sesión.

### 2026-06-21 — PDF Tools: hardening completo de motores
- P38: compress con cadena GS → fitz → pikepdf.
- P39: finally defensivo en word_to_pdf, excel_to_pdf, ppt_to_pdf.
- P40: crop con cropbox absoluto y clamp por página.
- P41/P42/P43/P47/P48: handle_pdf_to_word — clasificador 5D, detección protección, validación .docx, COM balanceado, _ok_result unificada.
- P44: UI resultado — warning en amarillo, chips pdf_profile y engine.
- P45: split, jpg_to_pdf, rotate, delete_pages, reorder_pages — finally + validaciones input/output.
- P46: watermark, watermark_image, extract, add_page_numbers, ocr — finally + validaciones.
- Build limpio confirmado post-sesión.

### 2026-06-21 — Sesión de mejoras y limpieza
- P32: `incomingFile` migrado a useState en PDFTools; banner de archivo recibido desde Reportes.
- P33: Anclas Settings — ids `scanning`/`terapias` + scroll por `location.state.scrollTo`.
- P34: Dashboard muestra hasta 3 docs Word pendientes clickeables con pre-selección en Terapias.
- P35/P36: Eliminado todo localStorage del renderer; `theme` y `lastScanPath` migrados a AppSettings vía IPC. Fix orden providers App.tsx.
- P37: Atajos globales `Ctrl+1..5`, `Ctrl+H` en MainLayout; `Ctrl+O`, `F5`, `Ctrl+F` en Terapias.
- Build limpio confirmado post-sesión.

### 2026-06-18 — PDF Tools UX

- Nuevo flujo `handleActionRequest` con `askBeforeSave`: diálogo de carpeta antes de ejecutar.
- Switch **"Preguntar antes de descargar"** en la UI.
- Breadcrumb de navegación dentro del módulo.
- Cola de archivos (`fileQueueRef`) para múltiples PDFs en secuencia.
- Helper `smartOutputName` para nombres de salida consistentes.
- Uso de `selectDirectory` en lugar de `selectSavePath` inexistente.
- Variable `finalOutput` unificada en el `switch` de `executeAction`.

### 2026-06-19 — PDF Tools: 9 fixes en `index.tsx` ✅

1. **`incomingFile`** se limpia en `resetToolState` tras usarse.
2. **`split` / `pdf_to_jpg`** usan `selectDirectory()` (salida multi-archivo).
3. **Filtro de extensión dinámico** según `activeTool.newExt`.
4. **Shorthand `{ finalOutput }` → `{ output: finalOutput }`** en 19 casos del payload API (backend esperaba clave `output`).
5. **Campo "Ruta de salida" oculto** cuando `askBeforeSave` está activo.
6. **Botón Ejecutar** con `disabled` correcto en modo `askBeforeSave`.
7. **Buscador de herramientas** con autofocus al entrar al selector.
8. **Atajos** Enter ejecuta, Escape vuelve atrás.
9. **`AlertDialog`** reemplaza `window.confirm` al salir con archivos cargados.

**Lección operativa:** verificar builds con timestamps y hashes reales; no confiar en logs reciclados.

**Pendiente manual:** probar cada herramienta, especialmente `split`, `pdf_to_jpg` y el toggle `askBeforeSave`.

### 2026-06-19 — TypeScript + sidecar `pdf_bridge.py` ✅

**Renderer:**
- `DataContext.tsx` — API correcta (`saveScan`, `deleteScan`, etc.) en lugar de `saveHistory` inexistente.
- `Scanner.tsx` — `ScanStats` importado desde `shared/types`.
- `Settings.tsx` — interfaces tipadas para props de switches.
- `Terapias/index.tsx` — fallback `step.patient ?? ""`, tipado en `DropZoneSimple`.
- `localScanner.ts` — eliminada validación redundante de `parsePdf`.

**Sidecar Python:**
- **PDF→Word:** Word COM + fallback pdf2docx.
- **Comprimir:** campo `engine` (`pikepdf-fast`, `pikepdf-fallback`, `ghostscript`).
- **Marca de agua texto/imagen:** centrado real, opacidad alpha, rotación libre.
- **OCR:** progreso `OCR_PROGRESS:N` en stderr, limpieza `try/finally`.
- **HTML→PDF:** advertencia de limitaciones en respuesta.
- **Crop:** escala proporcional si páginas difieren de la primera.

### 2026-06-19 — Limpieza del repositorio

- Eliminados proyectos fuente externos (COTU Analytics, Organizador robusto, `scrips/`).
- Eliminado `analisis y mejora.md` — contenido consolidado en este documento.
- Eliminados artefactos locales (`compressed.pdf`, `merged.pdf`, stubs `src/electron/`).
- Preparación para GitHub: `.gitignore`, README, LICENSE, CONTRIBUTING.

---

## 15. Lógica de negocio COTU

> Contrato funcional del escáner. Implementación en `src/app/utils/localScanner.ts` y tipos en `src/shared/types.ts`.

### Entidades

| Entidad | Campos clave | Persistencia |
|---------|---------------|--------------|
| **Invoice** | `id`, `invoiceNumber` (regex COTU), `company`, `month`, `year`, `detail`, `filePath`, `amount` | Dentro de ScanResult |
| **ScanResult** | `id`, `invoices[]`, `stats`, `scanPath`, `timestamp` | `database.json` vía IPC |
| **AppSettings** | `columns`, `scanning`, `display`, `customInsurers`, `terapiasDir`, `operatorName`, `terapiasBaseDest`, `terapiasBackup`, `tesseractPath`, `theme`, `lastScanPath` | `settings.json` vía IPC `db:saveSettings` |

### Reglas de escaneo (`scanLocalDirectory`)

- Ignora carpetas sistema: `.git`, `node_modules`, `$RECYCLE.BIN`, etc.
- Scoring en 2 capas: nombre de archivo → contenido PDF (pdf-parse + OCR fallback).
- Extracción regex: número COTU, monto COP, aseguradora (lista configurable), fechas.
- Al finalizar: `addToHistory` → `setCurrentScan` → navegación a `/reports`.

### Dashboard

- KPIs y gráficos con Recharts (AreaChart tendencia, BarChart por año, PieChart aseguradoras).
- Sin API REST — todo client-side + IPC.
- Empty state limpio cuando no hay `currentScan` (sin datos mock).

### Terapias (reglas en `terapias_logic.py`)

- Código SS en nombre de archivo; estructura `AÑO/MES/DÍA/PACIENTE`.
- Confirmación pre-movimiento con preview de ruta final.
- Word → PDF vía sidecar persistente con backup.
## Modularización de PDFTools

---

## 12. Comparativa histórica vs proyectos fuente

> Los proyectos originales ya no existen como repos separados; esta tabla documenta el grado de paridad alcanzado.

### COTU Analytics → ControlHub

| Capacidad | Referencia | ControlHub |
|-----------|------------|------------|
| Escaneo COTU | ✅ | ✅ + OCR, NIT/paciente, duplicados |
| Dashboard | LineChart | AreaChart + KPIs comparativos |
| Export | CSV/XLSX/PDF | ✅ |
| Watcher | ✅ | ✅ |
| Worker pool PDF | ✅ | ✅ |

### Organizador robusto → Terapias

| Capacidad | Organizador | ControlHub |
|-----------|-------------|------------|
| Regla SS + estructura carpetas | ✅ | ✅ (`terapias_logic.py`) |
| Word → PDF | ✅ | ✅ sidecar persistente |
| Historial + búsqueda paciente | ✅ vistas separadas | ✅ en una página |
| Confirmación pre-movimiento | ✅ | ✅ (P09) |
| Diálogo falta SS | ✅ | ✅ (P30) |
| Selector multi-doc | ✅ | ✅ (Auto-Word P29) |
| Atajos teclado (`Ctrl+O`, `F5`, `Ctrl+F`) | ✅ | ✅ (P37) |
| Config unificada (word_path, etc.) | ✅ | ✅ — `settings.json` vía `db:saveSettings` |
| Tests automatizados | 5 suites | 2 Python + Vitest |

### PDF Tools (módulo propio)

- **22 herramientas** en UI (no 23).
- **22 herramientas a nivel producción. Todos los handlers tienen finally defensivo, 
   validación de inputs/outputs y errores descriptivos. handle_pdf_to_word incluye 
   clasificador de contenido 5D y selección automática de motor.**
- Sidecar `pdf_bridge.py` con pikepdf, PyMuPDF, win32com, pytesseract.

---

## 13. Fricciones de navegación — estado

| Problema | Impacto | Estado |
|----------|---------|--------|
| Módulos COTU vs sidecars desconectados | Alto | ✅ RESUELTO — puente Reportes→PDF Tools implementado |
| Reportes sin selector de sesión | Alto | ✅ RESUELTO (P28) |
| Ruta duplicada `/` y `/dashboard` | Bajo | ✅ RESUELTO (P11) |
| Iconos ambiguos Reportes vs PDF Tools | Medio | ✅ RESUELTO — `BarChart3` / `FileStack` |
| Scanner → Settings genérico | Medio | ✅ RESUELTO — anclas `#scanning` / `#terapias` (P35) |
| Suspense doble | Bajo | ✅ RESUELTO (P12) |
| Branding legacy `ordertrack-*` | Bajo | ✅ RESUELTO — Migración one-time a AppSettings/database.json |
| Atajos teclado globales y Terapias | Medio | ✅ RESUELTO (P37) — Ctrl+1..5/H global; Ctrl+O/F5/Ctrl+F en Terapias |

---

## 14. Changelog de sesiones recientes

### 2026-06-23 — Persistencia unificada, pre-probe y limpieza IPC
- P58: `settings.json` como única fuente para `terapiasDir`, `tesseractPath`, `terapiasBaseDest`, `terapiasBackup`. Migración one-time desde electron-store en `main.ts`. UI usa solo `updateSettings`/`saveSettings`.
- P59: Eliminado pre-probe duplicado en `Scanner.tsx`. `localScanner.ts` hace fallback a full scan con `preProbeFallback` + toast de aviso.
- P60: Eliminados `config.getAll`/`setAll`/`delete` del preload (sin handlers).
- `npm run typecheck` — 0 errores. `npm run test` — 11/11 OK.

### 2026-06-22 — P33/P34 v3: Integración targetDate en Scanner y allowlist de preview PDF
- P33 v1: Patrones iniciales MM/DD para escaneo por fecha.
- P33 v2: Agregados patrones con espacio simple (`MM NOMBRE_MES`, `DD NOMBRE_MES`).
- P33 v3 (hoy):
  - `resolveTargetDayFolder()` con logging exhaustivo (12+ logs por ciclo) para diagnosticar por qué falla pre-probe.
  - `resolveTargetRangeFolder()` mejorado para resolver mes/año cuando se usa rango personalizado, evitando traversal completa en la mayoría de casos.
  - `Scanner.tsx`: agregado `targetDate: scanType === 'day' && startDate ? startDate : undefined` en opciones de `scanLocalDirectory`.
  - Ahora el escaneo por día invoca correctamente `resolveTargetDayFolder()` desde localScanner.ts y reduce el árbol leído antes de aplicar filtros.
  - P34: previsualización PDF en Reports estabilizada registrando la carpeta raíz escaneada con `security:registerApprovedDirectory` antes de solicitar `fs:readPdfAsBase64`.
- Problemas abiertos: barra de progreso se congela en casos de fallback a full scan silencioso; necesita validación con logs en DevTools.
- `npm run typecheck` — 0 errores. Build limpio.

### 2026-06-21 — PDF Tools: thumbnails, protocolo pdfthumb, UI resultado
- P49/P50/P51: FileDropZone modo múltiple con grid de cards y thumbnails 
  via nuevo protocolo pdfthumb:// y handler handle_pdf_thumbnail.
- P52: Vista resultado — warning en amarillo, chips pdf_profile y engine.
- P53: Cola multi-archivo con UI reordenación — en progreso.
- Build limpio confirmado post-sesión.

### 2026-06-22 — P53 cerrado y documentación unificada
- P53 implementado: cola automática multi-archivo con procesamiento secuencial, UI de progreso por archivo y estado individual.
- P54: puente Reportes→PDF Tools implementado; envía escaneo activo como cola de archivos y preselecciona herramienta desde selector en Reports.
- P10: habilitado auto-restart para Sidecars Terapias/PDF con `maxRestarts=3` y backoff exponencial; Sidebar distingue `reconnecting`, `failed` y `closed`.
- P16: corregido — `html-to-image` removido (importaba `toPng` pero nunca se usaba); `jsPDF` convertido a dynamic import en `handleExportPDF()` para lazy-loading; `html2canvas.esm` (201KB) ahora es chunk separado que se carga solo cuando usuario exporta PDF.

- P53 Docs eliminados: solo se conserva CONTEXT.md como fuente de verdad.
- Regla añadida: toda documentación nueva va a CONTEXT.md; no se crean archivos markdown por feature individual.
- P35: Agregada migración one-time de legacy `ordertrack-*` y `cotu-last-path` desde `localStorage` a AppSettings (`settings.json`) y `database.json`; marca de migración `migration.legacyLocalStorage` guardada en electron-store.
- Build limpio confirmado post-sesión.

### 2026-06-21 — PDF Tools: hardening completo de motores
- P38: compress con cadena GS → fitz → pikepdf.
- P39: finally defensivo en word_to_pdf, excel_to_pdf, ppt_to_pdf.
- P40: crop con cropbox absoluto y clamp por página.
- P41/P42/P43/P47/P48: handle_pdf_to_word — clasificador 5D, detección protección, validación .docx, COM balanceado, _ok_result unificada.
- P44: UI resultado — warning en amarillo, chips pdf_profile y engine.
- P45: split, jpg_to_pdf, rotate, delete_pages, reorder_pages — finally + validaciones input/output.
- P46: watermark, watermark_image, extract, add_page_numbers, ocr — finally + validaciones.
- Build limpio confirmado post-sesión.

### 2026-06-21 — Sesión de mejoras y limpieza
- P32: `incomingFile` migrado a useState en PDFTools; banner de archivo recibido desde Reportes.
- P33: Anclas Settings — ids `scanning`/`terapias` + scroll por `location.state.scrollTo`.
- P34: Dashboard muestra hasta 3 docs Word pendientes clickeables con pre-selección en Terapias.
- P35/P36: Eliminado todo localStorage del renderer; `theme` y `lastScanPath` migrados a AppSettings vía IPC. Fix orden providers App.tsx.
- P37: Atajos globales `Ctrl+1..5`, `Ctrl+H` en MainLayout; `Ctrl+O`, `F5`, `Ctrl+F` en Terapias.
- Build limpio confirmado post-sesión.

### 2026-06-18 — PDF Tools UX

- Nuevo flujo `handleActionRequest` con `askBeforeSave`: diálogo de carpeta antes de ejecutar.
- Switch **"Preguntar antes de descargar"** en la UI.
- Breadcrumb de navegación dentro del módulo.
- Cola de archivos (`fileQueueRef`) para múltiples PDFs en secuencia.
- Helper `smartOutputName` para nombres de salida consistentes.
- Uso de `selectDirectory` en lugar de `selectSavePath` inexistente.
- Variable `finalOutput` unificada en el `switch` de `executeAction`.

### 2026-06-19 — PDF Tools: 9 fixes en `index.tsx` ✅

1. **`incomingFile`** se limpia en `resetToolState` tras usarse.
2. **`split` / `pdf_to_jpg`** usan `selectDirectory()` (salida multi-archivo).
3. **Filtro de extensión dinámico** según `activeTool.newExt`.
4. **Shorthand `{ finalOutput }` → `{ output: finalOutput }`** en 19 casos del payload API (backend esperaba clave `output`).
5. **Campo "Ruta de salida" oculto** cuando `askBeforeSave` está activo.
6. **Botón Ejecutar** con `disabled` correcto en modo `askBeforeSave`.
7. **Buscador de herramientas** con autofocus al entrar al selector.
8. **Atajos** Enter ejecuta, Escape vuelve atrás.
9. **`AlertDialog`** reemplaza `window.confirm` al salir con archivos cargados.

**Lección operativa:** verificar builds con timestamps y hashes reales; no confiar en logs reciclados.

**Pendiente manual:** probar cada herramienta, especialmente `split`, `pdf_to_jpg` y el toggle `askBeforeSave`.

### 2026-06-19 — TypeScript + sidecar `pdf_bridge.py` ✅

**Renderer:**
- `DataContext.tsx` — API correcta (`saveScan`, `deleteScan`, etc.) en lugar de `saveHistory` inexistente.
- `Scanner.tsx` — `ScanStats` importado desde `shared/types`.
- `Settings.tsx` — interfaces tipadas para props de switches.
- `Terapias/index.tsx` — fallback `step.patient ?? ""`, tipado en `DropZoneSimple`.
- `localScanner.ts` — eliminada validación redundante de `parsePdf`.

**Sidecar Python:**
- **PDF→Word:** Word COM + fallback pdf2docx.
- **Comprimir:** campo `engine` (`pikepdf-fast`, `pikepdf-fallback`, `ghostscript`).
- **Marca de agua texto/imagen:** centrado real, opacidad alpha, rotación libre.
- **OCR:** progreso `OCR_PROGRESS:N` en stderr, limpieza `try/finally`.
- **HTML→PDF:** advertencia de limitaciones en respuesta.
- **Crop:** escala proporcional si páginas difieren de la primera.

### 2026-06-19 — Limpieza del repositorio

- Eliminados proyectos fuente externos (COTU Analytics, Organizador robusto, `scrips/`).
- Eliminado `analisis y mejora.md` — contenido consolidado en este documento.
- Eliminados artefactos locales (`compressed.pdf`, `merged.pdf`, stubs `src/electron/`).
- Preparación para GitHub: `.gitignore`, README, LICENSE, CONTRIBUTING.

---

## 15. Lógica de negocio COTU

> Contrato funcional del escáner. Implementación en `src/app/utils/localScanner.ts` y tipos en `src/shared/types.ts`.

### Entidades

| Entidad | Campos clave | Persistencia |
|---------|---------------|--------------|
| **Invoice** | `id`, `invoiceNumber` (regex COTU), `company`, `month`, `year`, `detail`, `filePath`, `amount` | Dentro de ScanResult |
| **ScanResult** | `id`, `invoices[]`, `stats`, `scanPath`, `timestamp` | `database.json` vía IPC |
| **AppSettings** | `columns`, `scanning`, `display`, `customInsurers`, `terapiasDir`, `operatorName`, `terapiasBaseDest`, `terapiasBackup`, `tesseractPath`, `theme`, `lastScanPath` | `settings.json` vía IPC `db:saveSettings` |

### Reglas de escaneo (`scanLocalDirectory`)

- Ignora carpetas sistema: `.git`, `node_modules`, `$RECYCLE.BIN`, etc.
- Scoring en 2 capas: nombre de archivo → contenido PDF (pdf-parse + OCR fallback).
- Extracción regex: número COTU, monto COP, aseguradora (lista configurable), fechas.
- Al finalizar: `addToHistory` → `setCurrentScan` → navegación a `/reports`.

### Dashboard

- KPIs y gráficos con Recharts (AreaChart tendencia, BarChart por año, PieChart aseguradoras).
- Sin API REST — todo client-side + IPC.
- Empty state limpio cuando no hay `currentScan` (sin datos mock).

### Terapias (reglas en `terapias_logic.py`)

- Código SS en nombre de archivo; estructura `AÑO/MES/DÍA/PACIENTE`.
- Confirmación pre-movimiento con preview de ruta final.
- Word → PDF vía sidecar persistente con backup.
## Modularización de PDFTools

- **Hooks creados**: `useFileQueue.ts`, `usePdfTool.ts`
- **Componentes creados**: `ToolSelector.tsx`, `FileDropZoneWrapper.tsx`, `ToolConfigForm.tsx`, `ProcessingQueue.tsx`, `ResultView.tsx`
- **Propósito**: separar la lógica de cola, ejecución de herramientas y UI en archivos dedicados para mejorar mantenibilidad y pruebas.
- **Documentación**: actualizado en `CONTEXT.md` y `RULES.md` para reflejar la nueva arquitectura.
- **Componentes creados**:
  - `ToolSelector.tsx` – selector de herramientas.
- `FileDropZone.tsx` – zona de arrastre con integración de hook (renombrado desde FileDropZoneWrapper).
- `ToolConfigForm.tsx` – formulario de parámetros por herramienta.
- `ProcessingQueue.tsx` – vista y gestión de la cola de archivos.
- `ResultView.tsx` – muestra resultados y acciones post‑ejecución.

- **Hooks creados** ya documentados en la sección anterior.
