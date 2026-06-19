# ControlHub

Suite de escritorio para Windows que unifica **análisis de facturas COTU**, **organización de documentos de terapias** y **22 herramientas PDF** en una sola aplicación Electron.

**Versión:** 3.2.0 · **Plataforma:** Windows 10/11

---

## Módulos

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | KPIs del escaneo activo y documentos Word pendientes |
| **Escáner** | Recorre carpetas, identifica PDFs COTU, extrae metadatos y montos |
| **Reportes** | Tabla filtrable, selector de sesión, export CSV/XLSX/PDF |
| **Historial** | Sesiones de escaneo guardadas |
| **Terapias** | Flujo Word → edición → PDF con regla SS y estructura `Año/Mes/Día/Paciente` |
| **PDF Tools** | Merge, split, OCR, compresión, conversión Office, marcas de agua, etc. |
| **Configuración** | Columnas, profundidad de escaneo, aseguradoras, rutas, Tesseract |

---

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS v4, Radix/shadcn
- **Desktop:** Electron 40, IPC + preload seguro
- **PDF parsing:** pdf-parse en UtilityProcess pool
- **Sidecars:** Python embebido (`python-embed/`) — Word COM, pikepdf, PyMuPDF, Tesseract
- **Build:** Vite 6 + electron-builder (NSIS)

---

## Requisitos

- **Node.js** 18+
- **Windows** 10/11
- **Tesseract OCR** (opcional, configurable en Settings)
- **Microsoft Word** (requerido para Terapias y conversión PDF→Word)

---

## Instalación y desarrollo

```bash
# Clonar e instalar dependencias Node
git clone https://github.com/Carlo30-ops/ControlHub.git
cd ControlHub
npm install

# Desarrollo (Vite + Electron, hot reload en renderer)
npm run dev

# Build de producción (sin instalador)
npm run build

# Build + instalador NSIS (.exe con Python embebido)
npm run build:electron

# Tests unitarios
npm run test

# Benchmark de parsing PDF (Node puro, requiere carpeta de muestras local)
npm run load-test
```

### Python (solo desarrollo sin embebido)

Si no usas `python-embed/`, instala dependencias del sidecar:

```bash
pip install -r requirements.txt
```

Dependencias principales: `pywin32`, `pikepdf`, `PyMuPDF`, `pdf2docx`, `pytesseract`.

---

## Estructura del proyecto

```
ControlHub/
├── electron/           # Main process, IPC, sidecars Python, worker pool
├── src/                # React UI (pages, contexts, components)
├── scripts/            # loadTest.ts y utilidades CLI
├── public/             # Iconos y assets estáticos
├── python-embed/       # Runtime Python embebido (no incluido en git)
├── CONTEXT.md          # Documentación técnica para desarrolladores/IAs
├── BUSINESS_LOGIC_SPEC.md  # Contrato lógica COTU
└── requirements.txt    # Dependencias Python del sidecar
```

---

## Documentación

| Archivo | Audiencia |
|---------|-----------|
| [CONTEXT.md](./CONTEXT.md) | Desarrolladores — arquitectura, IPC, problemas conocidos, changelog |
| [BUSINESS_LOGIC_SPEC.md](./BUSINESS_LOGIC_SPEC.md) | Lógica de negocio COTU (regex, scoring, entidades) |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Guía para contribuir |

---

## Distribución

El instalador generado en `release/` incluye Python embebido y sidecars. No requiere Python del sistema en el equipo destino.

---

## Licencia

MIT — ver [LICENSE](./LICENSE).
