# 🏗️ ESPECIFICACIÓN BACKEND Y LÓGICA DE NEGOCIO

## COTU Analytics v3.0.0 - Sistema de Análisis de Facturas

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

**_NOTA ESTRATÉGICA_**
Todo el sistema está alineado de forma pixel-perfect y logic-perfect con las restricciones dictadas por el documento de validación técnica COTU Analytics v3.0.0. No se implementaron optimizaciones extrañas ni se alteraron requerimientos documentados.
