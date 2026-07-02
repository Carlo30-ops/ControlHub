@echo off
echo =======================================================
echo   Instalador de Tesseract OCR para ControlHub
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando si Tesseract ya esta instalado...
if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" (
    echo [INFO] Tesseract ya esta instalado en C:\Program Files\Tesseract-OCR
    echo.
    set TESS_PATH=C:\Program Files\Tesseract-OCR
    goto :configurar
)

if exist "C:\Program Files (x86)\Tesseract-OCR\tesseract.exe" (
    echo [INFO] Tesseract ya esta instalado en C:\Program Files (x86)\Tesseract-OCR
    echo.
    set TESS_PATH=C:\Program Files (x86)\Tesseract-OCR
    goto :configurar
)

echo [2/4] Descargando Tesseract OCR v5.3.1...
echo Esto puede tardar varios minutos dependiendo de tu conexion...
echo.

set TESSERACT_URL=https://github.com/UB-Mannheim/tesseract/releases/download/v5.3.1.20230401/tesseract-ocr-w64-setup-5.3.1.20230401.exe
set TEMP_DIR=%TEMP%\tesseract_install

if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"

powershell -Command "Invoke-WebRequest -Uri '%TESSERACT_URL%' -OutFile '%TEMP_DIR%\tesseract-setup.exe'"

if not exist "%TEMP_DIR%\tesseract-setup.exe" (
    echo [ERROR] No se pudo descargar Tesseract. Verifica tu conexion a internet.
    pause
    exit /b 1
)

echo [3/4] Instalando Tesseract OCR...
echo Se instalara en C:\Program Files\Tesseract-OCR
"%TEMP_DIR%\tesseract-setup.exe" /S /D="C:\Program Files\Tesseract-OCR"

echo Esperando a que termine la instalacion...
timeout /t 10 /nobreak >nul

if exist "C:\Program Files\Tesseract-OCR\tesseract.exe" (
    echo [OK] Tesseract instalado correctamente.
    set TESS_PATH=C:\Program Files\Tesseract-OCR
) else (
    echo [ERROR] La instalacion de Tesseract fallo.
    pause
    exit /b 1
)

:configurar
echo [4/4] Configurando ControlHub...
echo.

set CONFIG_FILE=%APPDATA%\controlhub\settings.json
if not exist "%APPDATA%\controlhub" mkdir "%APPDATA%\controlhub"

if exist "%CONFIG_FILE%" (
    echo [INFO] Archivo de configuracion existente encontrado.
    echo Se actualizara la ruta de Tesseract.
    powershell -Command "(Get-Content '%CONFIG_FILE%' -Raw) -replace '\"tesseractPath\"[^\}]*', '\"tesseractPath\": \"%TESS_PATH%\\tesseract.exe\"' | Set-Content '%CONFIG_FILE%'"
) else (
    echo [INFO] Creando nuevo archivo de configuracion.
    echo {> "%CONFIG_FILE%"
    echo   "tesseractPath": "%TESS_PATH%\\tesseract.exe">> "%CONFIG_FILE%"
    echo }>> "%CONFIG_FILE%"
)

echo.
echo =======================================================
echo [EXITO] Tesseract OCR instalado y configurado.
echo Ruta: %TESS_PATH%\tesseract.exe
echo =======================================================
echo.

:: Limpiar archivos temporales
if exist "%TEMP_DIR%" rmdir /s /q "%TEMP_DIR%"

pause
