# Guía de Instalación de ControlHub

## Resumen

El instalador de ControlHub ahora incluye configuraciones automáticas para facilitar la instalación en PCs que no se usan para programar.

## Características del Instalador

### 1. Creación Automática de Carpetas para Terapias

El instalador crea automáticamente las siguientes carpetas en el sistema del usuario:

- **Documentos\TERAPIAS\DOCUMENTOS PARA ARMAR** - Carpeta principal para organizar documentos
- **Documentos\TERAPIAS\PROCESADOS** - Carpeta para documentos procesados
- **Documentos\TERAPIAS\BACKUP** - Carpeta para copias de seguridad

Si el usuario tiene OneDrive configurado, también se crean las mismas carpetas en:
- **OneDrive\Documentos\TERAPIAS\** (y subcarpetas correspondientes)

### 2. Python Embebido

El instalador incluye un runtime de Python embebido (`python-embed`) con todas las dependencias necesarias preinstaladas:
- pywin32
- pikepdf
- PyMuPDF
- pdf2docx
- pytesseract
- Y otras dependencias requeridas

**No es necesario instalar Python por separado.**

### 3. Tesseract OCR (Automático)

Tesseract OCR es necesario para la funcionalidad de OCR (reconocimiento óptico de caracteres). 

**El instalador descarga e instala Tesseract OCR automáticamente durante el proceso de instalación:**
- Descarga Tesseract OCR v5.3.1 desde GitHub
- Lo instala en `C:\Program Files\Tesseract-OCR`
- Configura automáticamente ControlHub para usarlo
- Si ya está instalado, lo detecta y usa la instalación existente

**Nota:** Si la descarga falla (por ejemplo, sin conexión a internet), el instalador mostrará una advertencia. En ese caso, puedes ejecutar manualmente el script `install_tesseract.bat` incluido en la carpeta de instalación.

## Cómo Generar el Instalador

### Requisitos Previos

1. Node.js instalado
2. Dependencias de npm instaladas: `npm install`
3. Carpeta `python-embed` con el runtime Python embebido y dependencias

### Pasos para Generar

1. Ejecutar el script de compilación:
   ```batch
   build_desktop.bat
   ```

2. El instalador se generará en la carpeta `release/`
   - Archivo: `ControlHub Setup 3.2.0.exe` (o versión correspondiente)

## Instalación en un PC Nuevo

1. **Ejecutar el instalador**
   - Doble clic en `ControlHub Setup 3.2.0.exe`
   - Seguir el asistente de instalación
   - Elegir el directorio de instalación (por defecto: `C:\Program Files\ControlHub`)
   - El instalador descargará e instalará automáticamente Tesseract OCR (requiere conexión a internet)

2. **Verificar instalación**
   - El instalador crea automáticamente las carpetas en Documentos
   - Verificar que existan: `Documentos\TERAPIAS\DOCUMENTOS PARA ARMAR`
   - Tesseract OCR se instalará en `C:\Program Files\Tesseract-OCR`

3. **Iniciar ControlHub**
   - Usar el acceso directo en el escritorio o menú de inicio
   - La aplicación detectará automáticamente las carpetas creadas y Tesseract OCR
   - Todo estará configurado y listo para usar

## Configuración Inicial

Al primer inicio, ControlHub:
- Lee el archivo `initial-config.json` creado por el instalador
- Configura automáticamente las rutas de terapias
- Configura automáticamente la ruta de Tesseract OCR si se instaló correctamente
- Elimina el archivo de configuración inicial después de cargarlo

## Solución de Problemas

### Tesseract OCR no funciona

1. Verificar que Tesseract esté instalado en `C:\Program Files\Tesseract-OCR\tesseract.exe`
2. Ejecutar el script `install_tesseract.bat` desde la carpeta de instalación
3. Configurar manualmente la ruta en Configuración > OCR

### Carpetas de terapias no se crearon

1. Verificar permisos de escritura en la carpeta Documentos
2. Crear manualmente las carpetas:
   - `Documentos\TERAPIAS\DOCUMENTOS PARA ARMAR`
   - `Documentos\TERAPIAS\PROCESADOS`
   - `Documentos\TERAPIAS\BACKUP`
3. Configurar las rutas manualmente en Configuración > Terapias

### Errores de Python

El instalador incluye Python embebido, por lo que no debería haber errores. Si ocurren:
1. Verificar que la carpeta `python-embed` exista en el directorio de instalación
2. Reinstalar ControlHub

## Archivos del Instalador

- **installer.nsh** - Script NSIS personalizado para configuración post-instalación
- **install_tesseract.bat** - Script para descargar e instalar Tesseract OCR automáticamente
- **package.json** - Configuración de electron-builder con NSIS personalizado
- **electron/main.ts** - Código modificado para leer configuración inicial

## Notas Técnicas

- El instalador usa NSIS (Nullsoft Scriptable Install System)
- La configuración se guarda en `%APPDATA%\controlhub\settings.json`
- Las carpetas de terapias NO se eliminan al desinstalar para preservar datos del usuario
- Tesseract OCR tampoco se elimina al desinstalar (puede ser usado por otras aplicaciones)
