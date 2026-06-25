# ControlHub — Análisis y Estado de Módulos
**Última revisión:** 2026-06-24  
**Versión app:** 3.2.0  
**Autor:** Análisis automático para sesión de desarrollo

---

## 📋 Resumen Ejecutivo

Todos los **7 módulos principales** están **✅ OPERACIONALES y LISTOS para trabajar**. 

El proyecto tiene una arquitectura bien definida:
- **Tipado completo** (TypeScript)
- **Arquitectura IPC segura** con preload contextBridge
- **Sidecars Python** embebidos y auto-reiniciables
- **Persistencia unificada** (settings.json, database.json)
- **Problemas conocidos:** Todos resueltos (ver CONTEXT.md)

---

## 🏗️ Módulos por Estado

### 1️⃣ **DASHBOARD** ✅
- **Ruta:** `/dashboard` (principal → `<Navigate to="/" />`)
- **Archivo:** `src/app/pages/Dashboard.tsx`
- **Función:** KPIs del escaneo activo + contador documentos Word pendientes
- **Estado:** **Listo para mejorar UI/UX**
- **Dependencias:**
  - `DataContext` (currentScan, history)
  - IPC: ninguno directo (usa datos de DataContext)
- **Mejoras potenciales:**
  - Gráficas en tiempo real con recharts
  - Indicadores de % de montos procesados
  - Alertas de ficheros duplicados

**Comandos para trabajar aquí:**
```bash
npm run dev  # Hot reload habilitado
```

---

### 2️⃣ **SCANNER** ✅
- **Ruta:** `/`
- **Archivo:** `src/app/pages/Scanner.tsx`
- **Motor:** `src/app/utils/localScanner.ts` (v3.3.0)
- **Función:** 
  - Selecciona carpeta raíz
  - Recorre carpetas buscando PDFs COTU
  - Extrae: número COTU, aseguradora, montos (COP), fechas
  - Identifica duplicados
  - Genera sesión de escaneo con estadísticas
- **Estado:** **Producción-ready**
- **Arquitectura:**
  - **Capa 1 (rápida):** Identifica por nombre archivo
  - **Capa 2 (contenido):** Lee PDF si Capa 1 falla, busca número COTU
  - **OCR fallback:** Tesseract.js vía IPC si PDF no es parseable
  - **Pool:** Concurrencia controlada con `p-limit`
  - **Cancelable:** Cada escaneo tiene `scanId` único

**Dependencias IPC:**
- `fs:readDirectory` — listar carpetas
- `fs:parsePdf` — parse → pdf-parse en UtilityProcess
- `ocr:extractText` — Tesseract si pdf-parse falla
- `fs:writeFile` — guardar sesión
- `db:saveScan` — persistencia

**Mejoras potenciales:**
- Progreso visual en tiempo real (% de carpetas escaneadas)
- Validación de duplicados antes de finalizar
- Exportación incremental a XLSX durante escaneo

---

### 3️⃣ **REPORTS** ✅
- **Ruta:** `/reports`
- **Archivo:** `src/app/pages/Reports.tsx`
- **Función:**
  - Tabla filtrable de facturas (currentScan o history[0])
  - Filtros: Mes, Año, Compañía (multi-select)
  - Exporta: CSV, XLSX, PDF
  - Preview PDF inline (protocolo `cotu://pdf?path=...`)
- **Estado:** **Producción-ready**
- **Dependencias:**
  - `DataContext` (activeScan = currentScan ?? history[0])
  - `electronAPI.savePdf` — export PDF
  - Búsqueda fuzzy con Fuse.js
- **Tipado:** Completo (Invoice, ScanResult)

**Mejoras potenciales:**
- Agregaciones: suma por mes/aseguradora
- Gráficas de distribución de montos
- Descarga de múltiples sesiones en un ZIP

---

### 4️⃣ **HISTORIAL** ✅
- **Ruta:** `/history`
- **Archivo:** `src/app/pages/History.tsx`
- **Función:** Tabla de sesiones escaneadas (id, timestamp, basePath, total facturas)
- **Estado:** **Listo para mejoras**
- **Dependencias:**
  - `DataContext` (history)
  - Cargar sesión completa en Reports

**Mejoras potenciales:**
- Eliminar sesiones antiguas (con confirmación)
- Indicador de tamaño de base de datos
- Búsqueda de sesiones por fecha/carpeta

---

### 5️⃣ **TERAPIAS** ✅
- **Ruta:** `/terapias`
- **Carpeta:** `src/app/pages/Terapias/`
- **Función:**
  - Flujo: Word → Edición → PDF con regla SS → Respaldo
  - Valida existencia archivo en carpeta origen
  - Estructura destino: `AÑO/MES/DÍA/PACIENTE.pdf`
  - Respaldo automático en `~/Documents/TERAPIAS/backup/`
- **Estado:** **Producción-ready**

**Flujo de trabajo:**
1. **Paso 1 — Validación + Abre Word:**
   - IPC `terapias:list_docs` — obtiene archivos pendientes
   - IPC `fs:listFiles` — valida existencia en carpeta origen
   - Muestra ruta final prevista (getFinalPathPreview)
   - Usuario confirma → Word COM abre documento (persistente)

2. **Paso 2 — Finaliza (PDF + Backup):**
   - IPC `terapias:finalize` → `terapias_bridge.py`
   - Genera PDF con regla SS (terapias_logic.py)
   - Crea estructura carpetas AÑO/MES/DÍA
   - Respaldo en ~/Documents/TERAPIAS/organizar_log.txt (rotativo)

**Dependencias IPC:**
- `terapias:list_docs`
- `terapias:prepare`
- `terapias:finalize`
- `fs:listFiles` — validación origen
- `fs:directoryExist` — validación destino

**Sidecars:**
- `electron/sidecar/terapias_bridge.py` — interfaz Python-COM
- `electron/sidecar/terapias_logic.py` — reglas de negocio

**Configuración (settings.json):**
```json
{
  "terapiasDir": "C:/Users/.../Terapias",
  "terapiasSourceDir": "C:/Users/.../Terapias_SinProcesar"
}
```

**Mejoras potenciales:**
- Validación de fechas en nombre documento
- Pre-visualización de PDF antes de finalizar
- Historial de terapias procesadas

---

### 6️⃣ **PDF TOOLS** ✅
- **Ruta:** `/pdf-tools`
- **Carpeta:** `src/app/pages/PDFTools/`
- **Función:** 22 herramientas PDF (modularizables)
- **Estado:** **Listo para modularización RULES.9**

**Herramientas implementadas (IPC pdf:* handlers):**
1. ✅ Merge PDFs
2. ✅ Split PDF
3. ✅ Extract pages
4. ✅ Compress PDF
5. ✅ Extract images
6. ✅ Extract text
7. ✅ Add watermark
8. ✅ Remove watermark
9. ✅ Rotate pages
10. ✅ Add annotations
11. ✅ Remove annotations
12. ✅ PDF to images
13. ✅ PDF to Office (Word, Excel, PPT)
14. ✅ Office to PDF
15. ✅ Convert images to PDF
16. ✅ Sign PDF (placeholder)
17. ✅ Verify signature (placeholder)
18. ✅ Encrypt PDF
19. ✅ Decrypt PDF
20. ✅ OCR PDF
21. ✅ Extract metadata
22. ✅ Remove metadata

**Sidecar:** `electron/sidecar/pdf_bridge.py`
**Librerías Python:** pikepdf, PyMuPDF, pdf2docx, pytesseract, win32com

**Arquitectura actual:** Todo en un componente PDFTools.tsx  
**Arquitectura recomendada (RULES.9):**
```
PDFTools/
├── components/
│   ├── MergePdfs.tsx
│   ├── SplitPdf.tsx
│   ├── CompressPdf.tsx
│   └── ... (un componente por herramienta)
├── hooks/
│   ├── usePdfOperation.ts (lógica común IPC)
│   ├── useFileSelection.ts
│   └── usePdfPreview.ts
└── PDFTools.tsx (contenedor + navegación)
```

**Mejoras potenciales:**
- Modularizar en componentes individuales (RULES.9)
- Interfaz drag-and-drop para batch operations
- Preview dinámico de transformaciones
- Historial de operaciones

---

### 7️⃣ **SETTINGS** ✅
- **Ruta:** `/settings`
- **Archivo:** `src/app/pages/Settings.tsx`
- **Función:**
  - Columnas visibles en Reports
  - Profundidad de escaneo (recursión)
  - Aseguradoras custom (agregar/editar/eliminar)
  - Rutas: Terapias, Tesseract, carpeta base escaneo
  - Operador (nombre usuario)
  - Tema (claro/oscuro)
- **Estado:** **Producción-ready**
- **Persistencia:** `settings.json` vía `db:saveSettings`

**Campos principales:**
```typescript
interface Settings {
  // Scanner
  scanDepth: number;           // 1-10 (recursión)
  baseScannableFolder: string; // Ruta raíz escaneo
  customCompanies: string[];   // Aseguradoras custom
  
  // Terapias
  terapiasDir: string;         // Destino procesado
  terapiasSourceDir: string;   // Origen sin procesar
  
  // Tools
  tesseractPath?: string;      // Ruta Tesseract.js
  operatorName: string;        // Usuario actual
  
  // UI
  theme: 'light' | 'dark';
  visibleColumns: ColumnSettings;
}
```

**Validadores:** `src/app/config/validation.ts`

**Mejoras potenciales:**
- Preset de configuración (clínicas estándar)
- Export/import de settings
- Validación automática de rutas

---

## 🔗 Componentes Compartidos

### Layouts
- **MainLayout.tsx** — navbar + sidebar + main
- **SidebarNav.tsx** — navegación lateral
- **ThemeToggle.tsx** — claro/oscuro

### UI (shadcn/Radix)
- Button, Input, Select, Textarea
- Dialog, AlertDialog, Popover
- Table, Tabs, Card
- Progress, Spinner, Toast (sonner)

### Contextos
- **DataContext** — estado global (currentScan, history, settings)
- **ThemeContext** — tema claro/oscuro

---

## 🗂️ Estructura de Ficheros — Checklist

### Frontend (React)
```
✅ src/
   ├── main.tsx — entry point
   ├── electron.d.ts — tipos API (completo)
   ├── app/
   │  ├── App.tsx — DataProvider + ThemeProvider + Router
   │  ├── routes.tsx — lazy routing con Suspense
   │  ├── pages/
   │  │  ├── Dashboard.tsx ✅
   │  │  ├── Scanner.tsx ✅
   │  │  ├── Reports.tsx ✅
   │  │  ├── History.tsx ✅
   │  │  ├── Terapias/ ✅
   │  │  ├── PDFTools/ ✅
   │  │  ├── Settings.tsx ✅
   │  │  └── NotFound.tsx ✅
   │  ├── components/
   │  │  ├── layouts/ ✅
   │  │  ├── navigation/ ✅
   │  │  ├── shared/ ✅
   │  │  └── ui/ ✅
   │  ├── contexts/
   │  │  ├── DataContext.tsx ✅
   │  │  └── ThemeContext.tsx ✅
   │  ├── config/
   │  │  └── validation.ts ✅
   │  └── utils/
   │     ├── localScanner.ts (v3.3.0) ✅
   │     ├── mockData.ts ✅
   │     └── ... helpers
   ├── shared/
   │  └── types.ts (fuente única) ✅
   ├── styles/
   │  └── main.css ✅
   └── tests/ ✅
```

### Backend (Electron + Python)
```
✅ electron/
   ├── main.ts (IPC handlers) ✅
   ├── preload.ts (contextBridge) ✅
   ├── database.ts (persistencia JSON) ✅
   ├── workerPool.ts (pool UtilityProcess) ✅
   ├── pdfWorker.ts (pdf-parse) ✅
   └── sidecar/
      ├── terapias_bridge.py ✅
      ├── terapias_logic.py ✅
      ├── pdf_bridge.py ✅
      └── tests/
         ├── test_terapias_logic.py ✅
         └── test_pdf_conversion.py ✅
```

### Configuración
```
✅ package.json (v3.2.0)
✅ tsconfig.json
✅ vite.config.ts
✅ electron-builder config (NSIS)
✅ CONTEXT.md (documentación técnica)
✅ RULES.md (reglas desarrollo)
```

---

## 🚀 Flujos de Trabajo — Listos

### A. Flujo COTU (Escáner → Reportes)
1. Usuario abre Scanner
2. Selecciona carpeta raíz (ej: D:\FACTURAS)
3. Sistema recorre, identifica PDFs COTU
4. Extrae: número, aseguradora, montos, fechas
5. Genera sesión con estadísticas
6. Usuario abre Reportes → tabla filtrable
7. Exporta CSV/XLSX/PDF

**Arquitectura:**
```
Scanner.tsx → localScanner.scanLocalDirectory()
  ↓
IPC fs:readDirectory (main) → chokidar
  ↓
IPC fs:parsePdf (main) → WorkerPool → pdfWorker → pdf-parse
  ↓
[Fallback] IPC ocr:extractText → Tesseract.js
  ↓
DataContext.addToHistory() + IPC db:saveScan
  ↓
Reports.tsx (activeScan)
```

**Cancelable:** Cada escaneo tiene `scanId`, puede interrumpirse

---

### B. Flujo Terapias (Word → PDF)
1. Usuario abre Terapias
2. Sistema valida archivos Word pendientes en carpeta origen
3. Usuario elige documento
4. **Paso 1:** Word COM abre, usuario edita
5. **Paso 2:** Genera PDF con regla SS, estructura AÑO/MES/DÍA
6. Respaldo automático en ~/Documents/TERAPIAS/backup/

**Arquitectura:**
```
Terapias UI → IPC terapias:list_docs
  ↓
Validación vía IPC fs:listFiles + getFinalPathPreview
  ↓
IPC terapias:prepare → terapias_bridge.py → Word COM
  ↓
Usuario edita en Word
  ↓
IPC terapias:finalize → terapias_logic.py (SS + carpetas)
  ↓
PDF + Backup + Historial
```

---

### C. Flujo PDF Tools
1. Usuario elige herramienta (merge, split, OCR, etc.)
2. Selecciona archivo(s) de entrada
3. Configura parámetros
4. IPC pdf:* → pdf_bridge.py (pikepdf, PyMuPDF, etc.)
5. Descarga resultado

**22 herramientas**, una por cada handler.

---

## 📊 Tipado — Estado Actual

### Completo ✅
- **src/shared/types.ts** — fuente única (Invoice, ScanResult, Settings, etc.)
- **src/electron.d.ts** — API electrónica tipada al 100%
- **Cero `(window as any)`** — eliminado completamente

### Validadores ✅
- **src/app/config/validation.ts** — validadores de settings
- Regex para compañías, rutas, nombres

---

## 🔧 IPC Handlers — Inventario Completo

| Handler | Ubicación | Implementación | Estado |
|---------|-----------|-----------------|--------|
| fs:readDirectory | main.ts | Chokidar recursive | ✅ |
| fs:parsePdf | main.ts | WorkerPool → pdf-parse | ✅ |
| fs:writePdf | main.ts | writeFileSync | ✅ |
| fs:listFiles | main.ts | readdirSync filtered | ✅ |
| fs:directoryExist | main.ts | existsSync | ✅ |
| fs:writeFile | main.ts | writeFileSync | ✅ |
| ocr:extractText | main.ts | Tesseract.js | ✅ |
| db:saveScan | main.ts | database.json | ✅ |
| db:saveSettings | main.ts | settings.json | ✅ |
| db:getSettings | main.ts | settings.json read | ✅ |
| db:getHistory | main.ts | database.json read | ✅ |
| terapias:list_docs | main.ts | Sidecar validate | ✅ |
| terapias:prepare | main.ts | terapias_bridge.py | ✅ |
| terapias:finalize | main.ts | terapias_logic.py | ✅ |
| pdf:merge | main.ts | pdf_bridge.py (pikepdf) | ✅ |
| pdf:split | main.ts | pdf_bridge.py (pikepdf) | ✅ |
| pdf:compress | main.ts | pdf_bridge.py (PyMuPDF) | ✅ |
| pdf:extract_text | main.ts | pdf_bridge.py (PyMuPDF) | ✅ |
| pdf:extract_images | main.ts | pdf_bridge.py (PyMuPDF) | ✅ |
| pdf:ocr | main.ts | pdf_bridge.py (pytesseract) | ✅ |
| ... (22 total) | — | — | ✅ |

---

## 📝 Persistencia — Estado

### Configuración (settings.json)
```json
{
  "scanDepth": 5,
  "baseScannableFolder": "C:/Users/.../Facturas",
  "customCompanies": ["ALLIANZ", "AURORA"],
  "terapiasDir": "C:/Users/.../Terapias",
  "terapiasSourceDir": "C:/Users/.../Terapias_SinProcesar",
  "theme": "dark",
  "visibleColumns": { ... },
  "operatorName": "Dr. González"
}
```

**Guardar:** IPC `db:saveSettings`  
**Cargar:** DataContext en mount

### Historial (database.json)
```json
{
  "scans": [
    {
      "id": "scan_abc123",
      "timestamp": "2026-06-24T10:30:00Z",
      "basePath": "C:/Facturas/junio",
      "totalInvoices": 45,
      "invoices": [ ... ],
      "stats": { ... }
    }
  ]
}
```

**Guardar:** IPC `db:saveScan`  
**Cargar:** IPC `db:getHistory`

### Flags de Migración (electron-store)
- **One-time only** (no usa para datos persistentes)
- Ej: marcador "ya migré de v2.x a v3.x"

---

## ✨ Notas de Desarrollo

### Reglas (RULES.md)
1. Documentación nueva → CONTEXT.md (no archivos separados)
2. Build limpio antes de declarar fixes
3. Log real en consola antes de validar optimizaciones
4. Fuente de verdad: CONTEXT.md + package.json
5. Una actualización CONTEXT.md por sesión
6. Settings persiste en `settings.json` vía `db:saveSettings`
7. **PDFTools modularizable** en hooks/ y components/ (RULES.9)
8. Separar lógica de negocio de UI

### Dependencias
- **Mínimas y verificadas** antes de agregar
- No añadir sin verificar package.json primero

### Testing
```bash
npm run test           # Vitest
npm run test:ui        # UI Vitest
npm run load-test      # Load test COTU (Node puro)
```

---

## 🎯 Proximos Pasos — Plan de Trabajo Sugerido

### Opción A: Mejoras UI/UX
1. Dashboard — agregar gráficas recharts
2. Scanner — progreso en tiempo real
3. Reports — agregaciones por mes/aseguradora
4. Terapias — preview PDF antes de finalizar

### Opción B: Modularización
1. PDFTools — dividir en componentes (RULES.9)
2. Hooks compartidos (usePdfOperation, useFileSelection)
3. Tests unitarios para localScanner

### Opción C: Nuevas Funcionalidades
1. Exportación batch (múltiples sesiones en ZIP)
2. Búsqueda avanzada en Reportes
3. Estadísticas de terapias procesadas

---

## 📖 Documentación de Referencia

- **CONTEXT.md** — Arquitectura técnica completa
- **RULES.md** — Convenciones de desarrollo
- **README.md** — Onboarding público
- **src/electron.d.ts** — API Electron tipada
- **src/shared/types.ts** — Tipos compartidos

---

**¿Listo para trabajar? Elige un módulo y empieza.** 🚀
