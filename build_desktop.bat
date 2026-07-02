@echo off
echo =======================================================
echo          ControlHub - Generador de instalador Windows
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Cerrando instancias previas de ControlHub...
taskkill /F /IM "ControlHub.exe" /T >nul 2>&1

echo [1.5/4] Verificando Node.js y npm...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró Node.js en PATH.
    echo Instala Node.js y vuelve a ejecutar este script.
    pause
    exit /b 1
)
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] No se encontró npm en PATH.
    echo Instala Node.js (incluye npm) y vuelve a ejecutar este script.
    pause
    exit /b 1
)

echo [2/4] Verificando recursos necesarios...
if not exist "python-embed\python.exe" (
    echo [ERROR] No se encontró el runtime Python embebido en python-embed\python.exe.
    echo Asegúrate de que la carpeta python-embed exista con python.exe y librerías necesarias.
    pause
    exit /b 1
)

if not exist "electron\sidecar\pdf_bridge.py" (
    echo [ERROR] No se encontró el sidecar PDF: electron\sidecar\pdf_bridge.py.
    pause
    exit /b 1
)

if not exist "electron\sidecar\terapias_bridge.py" (
    echo [ERROR] No se encontró el sidecar Terapias: electron\sidecar\terapias_bridge.py.
    pause
    exit /b 1
)

echo [3/4] Limpiando release/win-unpacked anterior...
if exist "release\win-unpacked" rmdir /s /q "release\win-unpacked"

echo [4/4] Compilando y empaquetando...
call npm run build:electron

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Falló la compilación. Verifique Node.js, dependencias y el runtime Python embebido.
    pause
    exit /b %errorlevel%
)

if not exist "release\win-unpacked\resources\python-embed\python.exe" (
    echo [ERROR] El instalador generado no contiene python-embed\python.exe.
    pause
    exit /b 1
)

if not exist "release\win-unpacked\resources\sidecar\pdf_bridge.py" (
    echo [ERROR] El instalador generado no contiene resources\sidecar\pdf_bridge.py.
    pause
    exit /b 1
)

if not exist "release\win-unpacked\resources\sidecar\terapias_bridge.py" (
    echo [ERROR] El instalador generado no contiene resources\sidecar\terapias_bridge.py.
    pause
    exit /b 1
)

echo [5/5] Copiando utilitario de instalación de Tesseract a release...
if exist "install_tesseract.bat" (
    copy /Y "install_tesseract.bat" "release\" >nul
    if errorlevel 1 (
        echo [WARNING] No se pudo copiar install_tesseract.bat a release\.
    ) else (
        echo [OK] install_tesseract.bat copiado a release\.
    )
) else (
    echo [WARNING] No se encontró install_tesseract.bat para copiar a release\.
)

echo [EXITO] Instalador generado en la carpeta release.
explorer "%~dp0release"
pause
