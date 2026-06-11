# ControlHub v1.0.0 — Unified Suite

ControlHub es una aplicación de escritorio unificada diseñada para la gestión eficiente de documentos, análisis de facturas y organización de tareas. Construida sobre Electron y alimentada por motores de procesamiento en Python, ofrece una experiencia de usuario moderna y fluida con una estética "Modern Glass".

## 🚀 Módulos Principales

### 📊 Escáner & Analytics
- Análisis inteligente de facturas y documentos COTU.
- Extracción de datos en tiempo real y visualización de estadísticas.
- Historial de escaneos persistente.

### 📄 PDF Tools (23 herramientas)
- **Organizar:** Unir, Dividir, Extraer, Eliminar y Reordenar páginas.
- **Optimizar:** Compresión, Rotación, Recorte y Reparación.
- **Contenido:** Marcas de agua (texto/imagen), Numeración, OCR (Buscable).
- **Seguridad:** Cifrado con contraseña y desbloqueo.
- **Convertir:** Conversión bidireccional con Office (Word, Excel, PPT) e Imágenes.

### 🏥 Organizador de Terapias
- Puente directo con procesos de lógica de negocio para la organización de sesiones y reportes.

---

## 🛠️ Stack Tecnológico

- **Frontend:** React 18 + TypeScript + TailwindCSS v4 + Shadcn UI.
- **Desktop:** Electron + IPC Bridge.
- **Motores Backend:** Python 3.12 (Sidecars).
- **Librerías Clave:** 
  - `pikepdf` & `PyMuPDF` (Procesamiento PDF)
  - `pdf2docx` (Conversión)
  - `pytesseract` (OCR)
  - `electron-store` (Persistencia)

---

## 💻 Desarrollo

### Requisitos
- **Node.js:** v18 o superior.
- **Python:** v3.10 o superior (para desarrollo).
- **Tesseract OCR:** Instalado en el sistema (C:\Program Files\Tesseract-OCR).

### Instalación
1. Clonar el repositorio.
2. Instalar dependencias de Node:
   ```bash
   npm install
   ```
3. Instalar dependencias de Python (Sidecars):
   ```bash
   pip install pikepdf pymupdf pdf2docx pytesseract pywin32
   ```

### Ejecución
```bash
npm run dev
```

### Build (Producción)
Para generar el instalador auto-suficiente (.exe) con Python embebido:
```bash
npm run build:electron
```

---

## 📦 Distribución
El instalador generado en `release/ControlHub Setup 1.0.0.exe` es totalmente auto-suficiente e incluye un entorno de Python embebido con todas las dependencias necesarias.
