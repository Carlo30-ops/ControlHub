# ControlHub — Checklist de Tareas por Módulo

**Fecha:** 2026-06-24 | **Versión:** 3.2.0 | **Estado:** Todos listos ✅

---

## 📊 Resumen Rápido

| Módulo | Producción | Listo para | Mejoras |
|--------|:----------:|:----------:|:-------:|
| **Dashboard** | ✅ | Trabajar | Gráficas |
| **Scanner** | ✅ | Trabajar | Progreso visual |
| **Reports** | ✅ | Trabajar | Agregaciones |
| **History** | ✅ | Trabajar | Búsqueda, delete |
| **Terapias** | ✅ | Trabajar | Preview PDF |
| **PDF Tools** | ✅ | Trabajar | **Modularizar** |
| **Settings** | ✅ | Trabajar | Presets |

---

## 🎯 Tarea 1 — Modularizar PDF Tools (RULES.9)

**Prioridad:** 🔥 Alta  
**Esfuerzo:** ⏱️ 2-3 horas  
**Archivo actual:** `src/app/pages/PDFTools/PDFTools.tsx`

### Qué hacer:

```
PDFTools/ (crear carpeta si no existe)
├── components/
│   ├── MergePdfs.tsx          ← Nueva
│   ├── SplitPdf.tsx           ← Nueva
│   ├── CompressPdf.tsx        ← Nueva
│   ├── ExtractText.tsx        ← Nueva
│   ├── AddWatermark.tsx       ← Nueva
│   ├── PdfToWord.tsx          ← Nueva
│   ├── PdfToExcel.tsx         ← Nueva
│   ├── PdfToPpt.tsx           ← Nueva
│   ├── OfficeToPdf.tsx        ← Nueva
│   ├── ImagesToPdf.tsx        ← Nueva
│   ├── RotatePages.tsx        ← Nueva
│   ├── ExtractImages.tsx      ← Nueva
│   ├── PdfToImages.tsx        ← Nueva
│   ├── AddAnnotations.tsx     ← Nueva
│   ├── RemoveAnnotations.tsx  ← Nueva
│   ├── SignPdf.tsx            ← Nueva
│   ├── VerifySignature.tsx    ← Nueva
│   ├── EncryptPdf.tsx         ← Nueva
│   ├── DecryptPdf.tsx         ← Nueva
│   ├── OcrPdf.tsx             ← Nueva
│   ├── ExtractMetadata.tsx    ← Nueva
│   └── RemoveMetadata.tsx     ← Nueva
├── hooks/
│   ├── usePdfOperation.ts     ← Nueva (lógica IPC común)
│   ├── useFileSelection.ts    ← Nueva
│   └── usePdfPreview.ts       ← Nueva
└── PDFTools.tsx               ← Refactor (contenedor)
```

### Checklist:

- [ ] Crear carpeta `src/app/pages/PDFTools/` (si no existe)
- [ ] Crear `components/` y `hooks/`
- [ ] Extraer `usePdfOperation.ts` (lógica común IPC pdf:*)
- [ ] Extraer `useFileSelection.ts` (selección archivo, validación)
- [ ] Extraer `usePdfPreview.ts` (preview inline)
- [ ] Crear componente por herramienta (22 total)
- [ ] Refactor PDFTools.tsx (solo navegación + contenedor)
- [ ] Tests unitarios para hooks
- [ ] Build limpio (`npm run build`)
- [ ] Actualizar CONTEXT.md

**Referencia de código:**
```typescript
// hooks/usePdfOperation.ts (ejemplo)
export function usePdfOperation(operation: string) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const execute = async (params: PdfOperationParams) => {
    setLoading(true);
    try {
      const res = await window.electronAPI[`pdf:${operation}`](params);
      setResult(res.output);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, result };
}
```

---

## 🎯 Tarea 2 — Dashboard: Agregar Gráficas

**Prioridad:** 🟡 Media  
**Esfuerzo:** ⏱️ 1-2 horas  
**Archivo:** `src/app/pages/Dashboard.tsx`

### Qué hacer:

- [ ] Agregar `LineChart` (montos por mes, últimas 12 meses)
- [ ] Agregar `PieChart` (distribución aseguradoras)
- [ ] Agregar `BarChart` (facturas por mes)
- [ ] KPI: % de extracción de montos (exitosa vs fallida)
- [ ] KPI: Duplicados detectados
- [ ] KPI: Documentos Word pendientes (contador Terapias)

**Deps ya instaladas:**
```json
"recharts": "^2.15.2"
```

**Datos disponibles:**
```typescript
// Desde DataContext
const { currentScan, history, settings } = useContext(DataContext);

// currentScan tiene:
currentScan.stats.totalInvoices
currentScan.stats.amountExtractionSuccess
currentScan.stats.amountExtractionFailed
currentScan.stats.skippedDuplicates
```

### Checklist:

- [ ] Importar recharts (LineChart, PieChart, BarChart)
- [ ] Graficar ingresos por mes (últimos 12 meses de history)
- [ ] Graficar distribución aseguradoras (currentScan)
- [ ] KPI: % extracción exitosa
- [ ] KPI: Duplicados
- [ ] KPI: Docs Word pendientes
- [ ] Responsive layout (Tailwind grid)
- [ ] Build limpio
- [ ] Tests visuales

---

## 🎯 Tarea 3 — Scanner: Progreso en Tiempo Real

**Prioridad:** 🟡 Media  
**Esfuerzo:** ⏱️ 1.5 horas  
**Archivo:** `src/app/pages/Scanner.tsx`

### Qué hacer:

- [ ] Agregar barra de progreso (Progress component)
- [ ] Mostrar % completado (carpetas escaneadas / total)
- [ ] Contador: "45 de 150 carpetas..."
- [ ] Log en vivo: últimas 3 carpetas procesadas
- [ ] Tiempo restante estimado
- [ ] Botón "Cancelar escaneo" (implementado ya en scanId)

**Componentes disponibles:**
```typescript
import { Progress } from "@/components/ui/progress";
```

### Checklist:

- [ ] State: `scannedFolders`, `totalFolders`, `elapsedTime`
- [ ] useEffect: Update progress durante scan
- [ ] Mostrar barra Progress (Tailwind w-full)
- [ ] Log de últimas 3 carpetas
- [ ] Estimación tiempo restante (math)
- [ ] Botón cancel → scanId abort
- [ ] Build limpio

---

## 🎯 Tarea 4 — Reports: Agregaciones

**Prioridad:** 🟡 Media  
**Esfuerzo:** ⏱️ 1.5 horas  
**Archivo:** `src/app/pages/Reports.tsx`

### Qué hacer:

- [ ] Sumar montos por mes (tabla adicional)
- [ ] Sumar montos por aseguradora (tabla adicional)
- [ ] Mostrar en footer de tabla principal
- [ ] Gráfica de distribución (pie chart)

**Datos disponibles:**
```typescript
const activeScan = currentScan ?? history[0];
const invoicesByMonth = activeScan.invoices.reduce((acc, inv) => {
  acc[inv.month] = (acc[inv.month] || 0) + inv.amount;
  return acc;
}, {});
```

### Checklist:

- [ ] Función: `aggregateByMonth(invoices)`
- [ ] Función: `aggregateByCompany(invoices)`
- [ ] Tabla footer con totales
- [ ] Pie chart con recharts
- [ ] Responsive
- [ ] Build limpio

---

## 🎯 Tarea 5 — Terapias: Preview PDF

**Prioridad:** 🟡 Media  
**Esfuerzo:** ⏱️ 2 horas  
**Archivo:** `src/app/pages/Terapias/`

### Qué hacer:

- [ ] Modal o Dialog que muestre preview PDF (antes de Paso 2)
- [ ] Vía protocolo `cotu://pdf?path=...`
- [ ] Botones: "Confirmar" (Paso 2) o "Cancelar" (editar más)
- [ ] Mostrar ruta final AÑO/MES/DÍA/PACIENTE

### Checklist:

- [ ] Crear componente `PdfPreviewModal.tsx`
- [ ] IPC `terapias:finalize` (pero no guardar)
- [ ] Mock PDF para preview
- [ ] Dialog + Cancel/Confirm
- [ ] Actualizar flujo Terapias
- [ ] Build limpio

---

## 🎯 Tarea 6 — History: Opciones Avanzadas

**Prioridad:** 🟢 Baja  
**Esfuerzo:** ⏱️ 1 hora  
**Archivo:** `src/app/pages/History.tsx`

### Qué hacer:

- [ ] Buscar sesión por fecha / carpeta
- [ ] Botón delete sesión (con confirmación AlertDialog)
- [ ] Mostrar tamaño datos (bytes / MB)
- [ ] Ordenar por fecha (desc por defecto)

### Checklist:

- [ ] Input search (fecha o basePath)
- [ ] Filter + Fuse.js
- [ ] Botón delete → IPC db:deleteScan
- [ ] AlertDialog confirmación
- [ ] Tamaño sesión (JSON.stringify).length
- [ ] Build limpio

---

## 🎯 Tarea 7 — Settings: Presets

**Prioridad:** 🟢 Baja  
**Esfuerzo:** ⏱️ 1 hora  
**Archivo:** `src/app/pages/Settings.tsx`

### Qué hacer:

- [ ] Select predefinido: "Clínica Estándar", "Hospital", "Consultorio"
- [ ] Cada preset carga rutas + columnas recomendadas
- [ ] Botón "Aplicar Preset"
- [ ] Opción "Guardar como Preset"

### Checklist:

- [ ] Definir presets (tipos const)
- [ ] Select component
- [ ] Aplicar preset → updateSettings
- [ ] Guardar preset personalizado
- [ ] Build limpio

---

## 🎯 Tarea 8 — Testing Unitarios

**Prioridad:** 🟢 Baja  
**Esfuerzo:** ⏱️ 2 horas  
**Test framework:** Vitest

### Qué hacer:

- [ ] Test `localScanner.ts` (identificación, deduplicación)
- [ ] Test `aggregations` (suma por mes/aseguradora)
- [ ] Test `validation.ts` (rutas, configuración)
- [ ] Test hooks `usePdfOperation`, `useFileSelection`

### Checklist:

- [ ] Crear `src/tests/localScanner.test.ts`
- [ ] Crear `src/tests/aggregations.test.ts`
- [ ] Crear `src/tests/hooks.test.ts`
- [ ] `npm run test`
- [ ] Cobertura > 80%

---

## 📋 Flujo de Trabajo Recomendado

### Sesión 1 — Modularización PDF Tools
1. Crear estructura de carpetas
2. Extraer hooks reutilizables
3. Dividir componentes
4. Tests
5. Commit & push

### Sesión 2 — Mejoras Dashboard
1. Agregar gráficas
2. KPIs
3. Layout responsivo
4. Tests visuales
5. Commit & push

### Sesión 3 — Mejoras Scanner
1. Barra de progreso
2. Log en vivo
3. Estimación de tiempo
4. Tests
5. Commit & push

### Sesión 4 — Agregaciones Reports
1. Funciones de agregación
2. Tablas de resumen
3. Gráficas pie chart
4. Tests
5. Commit & push

### Sesión 5 — Features menores
1. Terapias preview
2. History opciones
3. Settings presets
4. Tests
5. Final commit

---

## 🚀 Cómo Empezar Ahora Mismo

```bash
# 1. Instalar dependencias (si no lo hiciste)
npm install

# 2. Iniciar desarrollo
npm run dev

# 3. Abrir http://localhost:5173

# 4. Elegir un módulo (Tarea 1-5) y empezar

# 5. Validar
npm run typecheck   # TypeScript
npm run test        # Tests
npm run build       # Build limpio

# 6. Actualizar CONTEXT.md cuando termines
```

---

## 📚 Referencias Rápidas

**Componentes UI:**
- Button, Input, Select, Dialog, AlertDialog
- Progress, Card, Tabs, Table
- Importar de `@/components/ui/*`

**Contextos:**
- DataContext → `currentScan`, `history`, `settings`, `updateSettings()`
- ThemeContext → `theme`, `setTheme()`

**IPC Handlers:**
- `window.electronAPI.parsePdf()`
- `window.electronAPI.db.saveScan()`
- `window.electronAPI.pdf.merge()`
- Ver `src/electron.d.ts` para lista completa

**Tipos:**
- Importar de `@/shared/types.ts`
- Invoice, ScanResult, Settings, ColumnSettings

---

## ✅ Checklist Final — Antes de Terminar Sesión

- [ ] Build limpio (`npm run build`)
- [ ] TypeScript sin errores (`npm run typecheck`)
- [ ] Tests pasan (`npm run test`)
- [ ] Actualizar CONTEXT.md (1 sola actualización por sesión)
- [ ] Git commit con mensaje claro
- [ ] Hot reload verificado (`npm run dev`)

---

**¿Cuál es tu primer módulo? ¡Empieza ahora!** 🚀
