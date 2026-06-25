# ControlHub — Dashboard de Desarrollo 🚀
**Estado:** Todos los módulos listos | **Versión:** 3.2.0 | **Fecha:** 2026-06-24

---

## 🎯 Estado Actual — Módulos

| Módulo | Ruta | Archivo | Status | Acciones |
|--------|------|---------|--------|----------|
| **Dashboard** | `/` | `Dashboard.tsx` | ✅ Listo | Mejora UI, agregar gráficas |
| **Scanner** | `/` | `Scanner.tsx` | ✅ Producción | Optimizar progreso visual |
| **Reportes** | `/reports` | `Reports.tsx` | ✅ Producción | Agregar agregaciones |
| **Historial** | `/history` | `History.tsx` | ✅ Listo | Agregar opciones delete |
| **Terapias** | `/terapias` | `Terapias/` | ✅ Producción | Preview PDF pre-finalizar |
| **PDF Tools** | `/pdf-tools` | `PDFTools/` | ✅ Listo | **Modularizar (RULES.9)** |
| **Settings** | `/settings` | `Settings.tsx` | ✅ Producción | Agregar presets |

---

## 🔥 Comandos Útiles

```bash
# DESARROLLO
npm run dev              # Hot reload Vite + Electron

# BUILD
npm run build            # Producción sin instalador
npm run build:electron   # Producción + instalador NSIS

# TESTING
npm run test             # Vitest
npm run test:ui          # UI Vitest interactivo
npm run load-test        # Load test COTU (Node puro)

# VALIDACIÓN
npm run typecheck        # TypeScript check
```

---

## 📦 Módulo — Motor Scanner (localScanner.ts v3.3.0)

### Estado: ✅ Producción-Ready

**Características:**
- ✅ Capa 1: Identificación rápida por nombre
- ✅ Capa 2: Lectura contenido si Capa 1 falla
- ✅ OCR fallback: Tesseract si pdf-parse falla
- ✅ Pool de workers: p-limit con concurrencia
- ✅ Cache: Hash + mtime
- ✅ Cancelable: scanId único por escaneo
- ✅ Duplicados: Detección automática
- ✅ Estadísticas: ScanStats completo

**Archivo principal:** `src/app/utils/localScanner.ts`  
**Tipos:** `src/shared/types.ts` (Invoice, ScanResult, ScanStats)

**Caso de uso típico:**
```typescript
import { scanLocalDirectory } from './utils/localScanner';

const result = await scanLocalDirectory({
  basePath: 'D:/Facturas/Junio',
  scanDepth: 5,
  maxConcurrency: 10,
  dateRange: { start: '2026-06-01', end: '2026-06-30' }
});

console.log(result.totalInvoices); // 45
console.log(result.stats);         // ScanStats
```

---

## 📋 Módulo — Reportes (Reports.tsx)

### Estado: ✅ Producción-Ready

**Características:**
- ✅ Tabla filtrable (Mes, Año, Compañía)
- ✅ Búsqueda fuzzy (Fuse.js)
- ✅ Export CSV, XLSX, PDF
- ✅ Preview PDF inline (cotu:// protocol)
- ✅ Selector de sesión (currentScan ?? history[0])
- ✅ Paginación

**Archivo:** `src/app/pages/Reports.tsx`

**Mejoras potenciales:**
- [ ] Agregaciones: sum(montos) por mes/aseguradora
- [ ] Gráficas de distribución
- [ ] Download batch (múltiples sesiones)

---

## 📄 Módulo — Terapias (Terapias/)

### Estado: ✅ Producción-Ready

**Características:**
- ✅ Validación existencia archivo
- ✅ Paso 1: Word COM abre documento
- ✅ Paso 2: Genera PDF con regla SS
- ✅ Estructura: AÑO/MES/DÍA/PACIENTE
- ✅ Respaldo automático
- ✅ Historial de operaciones

**Sidecars:**
- `electron/sidecar/terapias_bridge.py` — Word COM
- `electron/sidecar/terapias_logic.py` — Reglas SS

**Configuración (settings.json):**
```json
{
  "terapiasDir": "C:/Users/.../Terapias",
  "terapiasSourceDir": "C:/Users/.../Terapias_SinProcesar"
}
```

**IPC Handlers:**
- `terapias:list_docs` — obtiene pendientes
- `terapias:prepare` — valida + abre Word
- `terapias:finalize` — PDF + backup

**Mejoras potenciales:**
- [ ] Preview PDF antes de finalizar
- [ ] Validación de fechas en nombre
- [ ] Historial con búsqueda

---

## 🛠️ Módulo — PDF Tools (PDFTools/)

### Estado: ✅ Listo (Requiere modularización RULES.9)

**22 herramientas implementadas:**
1. Merge PDFs ✅
2. Split PDF ✅
3. Extract pages ✅
4. Compress PDF ✅
5. Extract images ✅
6. Extract text ✅
7. Add watermark ✅
8. Remove watermark ✅
9. Rotate pages ✅
10. Add annotations ✅
11. Remove annotations ✅
12. PDF to images ✅
13. PDF to Word ✅
14. PDF to Excel ✅
15. PDF to PPT ✅
16. Office to PDF ✅
17. Images to PDF ✅
18. Sign PDF ✅
19. Verify signature ✅
20. Encrypt PDF ✅
21. Decrypt PDF ✅
22. OCR PDF ✅

**Sidecar:** `electron/sidecar/pdf_bridge.py`

**Arquitectura actual:** Todo en `PDFTools.tsx` (monolítico)

**Arquitectura recomendada (RULES.9):**
```
PDFTools/
├── components/
│   ├── MergePdfs.tsx
│   ├── SplitPdf.tsx
│   ├── CompressPdf.tsx
│   ├── ExtractText.tsx
│   ├── AddWatermark.tsx
│   ├── PdfToWord.tsx
│   └── ... (una por herramienta)
├── hooks/
│   ├── usePdfOperation.ts (lógica IPC común)
│   ├── useFileSelection.ts
│   └── usePdfPreview.ts
└── PDFTools.tsx (contenedor)
```

**TAREA RECOMENDADA:**
```bash
# Modularizar PDFTools siguiendo RULES.9
# Cada herramienta en su propio componente
# Hooks reutilizables para lógica común IPC
```

---

## ⚙️ Módulo — Settings (Settings.tsx)

### Estado: ✅ Producción-Ready

**Campos configurables:**
- **Scanner**
  - `scanDepth` — profundidad recursión (1-10)
  - `baseScannableFolder` — ruta base
  - `customCompanies` — aseguradoras custom
  
- **Terapias**
  - `terapiasDir` — destino procesado
  - `terapiasSourceDir` — origen sin procesar
  
- **Tools**
  - `tesseractPath` — ruta Tesseract (opcional)
  - `operatorName` — usuario actual
  
- **UI**
  - `theme` — claro/oscuro
  - `visibleColumns` — columnas en Reports

**Validadores:** `src/app/config/validation.ts`

**Persistencia:** `db:saveSettings` → `settings.json`

**Mejoras potenciales:**
- [ ] Presets por clínica estándar
- [ ] Export/import de configuración
- [ ] Validación automática de rutas

---

## 🗄️ Persistencia — Estado

### Archivos de datos

| Archivo | Propósito | Ubicación | Handler IPC |
|---------|-----------|-----------|-------------|
| `settings.json` | Configuración usuario | `userData/` | `db:saveSettings` |
| `database.json` | Historial escaneos | `userData/` | `db:saveScan` |
| `electron-store` | Flags migración | userData/ | (rara) |

### Estructura settings.json
```json
{
  "scanDepth": 5,
  "baseScannableFolder": "C:/Users/.../Facturas",
  "customCompanies": ["ALLIANZ", "AURORA", "POSITIVA"],
  "terapiasDir": "C:/Users/.../Terapias",
  "terapiasSourceDir": "C:/Users/.../Terapias_SinProcesar",
  "theme": "dark",
  "operatorName": "Dr. González",
  "visibleColumns": {
    "invoiceNumber": true,
    "company": true,
    "amount": true,
    "date": true
  }
}
```

### Estructura database.json
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

---

## 🧩 Arquitectura IPC — Resumen

### Flujo Típico
```
React Component
  ↓ (await)
electronAPI.handler(params)
  ↓ (contextBridge)
preload.ts
  ↓ (ipcRenderer.invoke)
main.ts ipcMain.handle()
  ↓ (IPC handler)
Sidecar Python / File I/O / Electron API
  ↓ (return JSON)
React re-renders
```

### Protocolo Sidecar (stdin/stdout)
```json
// Enviar
{ "command": "merge", "files": [...], "output": "..." }

// Recibir
{ "success": true, "output": "path/to/merged.pdf" }
```

### Auto-restart Sidecars
- **maxRestarts:** 3
- **Backoff exponencial:** (2^attempt) * 100ms
- **Límite de reintentos:** 3
- Si muere: rechaza pendientes, auto-reinicia en siguiente invocación

---

## 🔒 Tipado — Referencia

### Tipos principales
```typescript
// src/shared/types.ts

interface Invoice {
  id: string;
  invoiceNumber: string;      // COTU
  company: string;            // Aseguradora
  month: string;              // MM
  year: string;               // YYYY
  amount: number;             // COP
  date: string;               // DD/MM/YYYY
  filePath: string;           // Ruta PDF
  patient?: string;           // Opcional
  nit?: string;               // Opcional
  policyNo?: string;          // Opcional
  identification?: string;    // Opcional
}

interface ScanResult {
  id: string;
  timestamp: string;          // ISO 8601
  basePath: string;
  totalInvoices: number;
  invoices: Invoice[];
  stats: ScanStats;
  scanDuration: number;       // ms
}

interface ScanStats {
  totalFilesProcessed: number;
  amountExtractionSuccess: number;
  amountExtractionFailed: number;
  invoicesIdentifiedByLayer1: number;
  invoicesIdentifiedByLayer2: number;
  skippedDuplicates: number;
}

interface Settings {
  scanDepth: number;
  baseScannableFolder: string;
  terapiasDir: string;
  terapiasSourceDir: string;
  theme: 'light' | 'dark';
  visibleColumns: ColumnSettings;
  operatorName: string;
}
```

---

## 🚀 Flujos Rápidos

### Flujo A: Escanear Facturas
```
1. Abre Scanner (/). 
2. Selecciona carpeta raíz (D:\FACTURAS)
3. Configura filtros (fecha, profundidad)
4. Click "Escanear"
5. Sistema recorre PDFs, extrae COTU + montos
6. Genera sesión con estadísticas
7. Click "Ver Reportes" → tabla filtrable
8. Exporta CSV/XLSX/PDF
```

### Flujo B: Procesar Terapias
```
1. Abre Terapias (/terapias)
2. Sistema valida documentos Word pendientes
3. Usuario elige documento
4. Click "Abrir en Word" (Paso 1)
5. Usuario edita en Word
6. Click "Finalizar" (Paso 2)
7. Sistema genera PDF con regla SS
8. Crea estructura AÑO/MES/DÍA/PACIENTE
9. Respaldo automático
```

### Flujo C: Herramienta PDF
```
1. Abre PDF Tools (/pdf-tools)
2. Elige herramienta (ej: Merge, Compress, OCR)
3. Selecciona archivo(s) de entrada
4. Configura parámetros (calidad, salida, etc.)
5. Click "Procesar"
6. Descarga resultado
```

---

## 🎓 Documentación de Referencia

| Documento | Propósito |
|-----------|-----------|
| **CONTEXT.md** | Arquitectura técnica, flujos IPC, sidecars |
| **RULES.md** | Convenciones de desarrollo, persistencia |
| **README.md** | Onboarding público, requisitos |
| **MÓDULOS_LISTOS.md** | Este análisis completo |
| **src/electron.d.ts** | API Electron tipada |
| **src/shared/types.ts** | Tipos compartidos (fuente única) |

---

## 🎯 Próximos Pasos — Plan de Trabajo

### Priority 1 (Modularización RULES.9)
- [ ] **PDFTools:** Dividir en componentes individuales
- [ ] **Hooks:** usePdfOperation, useFileSelection, usePdfPreview
- [ ] Tests unitarios para herramientas PDF

### Priority 2 (UI/UX)
- [ ] Dashboard: Gráficas recharts
- [ ] Scanner: Progreso en tiempo real
- [ ] Reports: Agregaciones por mes/aseguradora
- [ ] Terapias: Preview PDF antes de finalizar

### Priority 3 (Nuevas Features)
- [ ] Exportación batch (múltiples sesiones en ZIP)
- [ ] Búsqueda avanzada en Reportes
- [ ] Historial de terapias procesadas
- [ ] Presets de configuración

---

## 📞 Necesitas Ayuda?

**Para iniciar desarrollo:**
```bash
npm install
npm run dev
```

**Para validar tipado:**
```bash
npm run typecheck
```

**Para testear:**
```bash
npm run test
```

**¿Cuál es tu próximo módulo?** 🎯
