# 🏗️ ESPECIFICACIÓN BACKEND Y LÓGICA DE NEGOCIO

## COTU Analytics v3.2.0 - Sistema de Análisis de Facturas

---

## 1. VISIÓN GENERAL DEL SISTEMA

### 1.1 Tipo de Aplicación

- Categoría: Dashboard Analítico de Gestión de Facturas
- Propósito: Escanear directorios locales para extraer metadatos de facturas COTU
- Usuario: Single-user (sin autenticación visible)
- Arquitectura: Frontend-first con persistencia local

## 2. MODELO DE DATOS IMPLEMENTADO

### 2.1 Entidad: Invoice (Factura)

Implementado en `src/app/contexts/DataContext.tsx` y `src/app/utils/localScanner.ts`:

- `id`: Generado con "invoice-{timestamp}-{random}"
- `invoiceNumber`: Extraído de Regex /COTU[\s\-_]\*(\d{4,8})/i
- `company`: Extraído heurísticamente (Prioridad lista de aseguradoras)
- `month`, `year`, `detail`, `filePath`, `amount`: Mapeo exacto.

### 2.2 Entidad: ScanResult

- Almacena historial iterativo.
- Calculo exacto de `totalInvoices`, `dateRange`, `scanDuration`.
- Persistido a `ordertrack-history`.

### 2.3 Entidad: Settings

- Persistido a `ordertrack-settings`.
- Valores `columns`, `scanning`, `display`.

## 3. PROCESAMIENTO CRITICO Y REGLAS DE NEGOCIO

### Escáner Local Activo (`scanLocalDirectory`)

- Ignora carpetas críticas: '.git', 'node_modules', '$RECYCLE.BIN', etc.
- Simula progreso hasta el 90%.
- Al finalizar, guarda resultados bajo la función estricta `addToHistory`.

### Dashboard y Limitaciones

- Recharts utilizado para generación de KPIs ("Tendencia Mensual", "Distribución por Año", "Top Aseguradoras").
- Generación local; Sin API REST implementada (Aplicación Client-side Desktop Port).

## 4. CAMBIOS EN V3.2 (Refactorización Junio 2026)
### 4.1 Dashboard — Ghost State
- Si no hay datos, se muestra MOCK_DASHBOARD_DATA con blur/opacity/grayscale
- CTA central con botón de escaneo premium
### 4.2 Unificación de Interfaces
- `Invoice`, `ScanResult`, `ScanStats` estandarizadas en DataContext.tsx
- Compatible con contratos de @cotu-analytics** y @COTU_Analytics**
### 4.3 Mejoras de Gráficas
- `LineChart` reemplazado por `AreaChart` con gradiente azul en Tendencia Mensual
- `yearData` BarChart horizontal activado (distribución por año)
- Tooltip enriquecido en PieChart con nombre completo de aseguradora
### 4.4 Fixes Críticos
- Dark mode reactivo: `useTheme()` en DashboardView (eliminado snapshot DOM)
- `window.location.reload()` eliminado: reemplazado por re-fetch IPC
- `DEFAULT_TERAPIAS_DIR` dinámico via `os.homedir()`
- Empty states en Reports.tsx e History.tsx

**_NOTA ESTRATÉGICA_**
Todo el sistema está alineado de forma pixel-perfect y logic-perfect con las restricciones dictadas por el documento de validación técnica COTU Analytics v3.2.0. No se implementaron optimizaciones extrañas ni se alteraron requerimientos documentados.
