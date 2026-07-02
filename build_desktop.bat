@echo off
setlocal enabledelayedexpansion
echo =======================================================
echo          ControlHub - Generador de instalador Windows
echo =======================================================
echo.

cd /d "%~dp0"

echo [0/7] Limpiando artefactos anteriores...
if exist "release\ControlHub Setup 3.2.0.exe" del /F /Q "release\ControlHub Setup 3.2.0.exe"
if exist "release\ControlHub Setup 3.2.0.__uninstaller.exe" del /F /Q "release\ControlHub Setup 3.2.0.__uninstaller.exe"
if exist "release\controlhub-3.2.0-x64.nsis.7z" del /F /Q "release\controlhub-3.2.0-x64.nsis.7z"
if exist "release\latest.yml" del /F /Q "release\latest.yml"
if exist "release\win-unpacked" rmdir /S /Q "release\win-unpacked"
if exist "release\installer.nsi" del /F /Q "release\installer.nsi"
if exist "release\ControlHub-Install-Instructions.doc" del /F /Q "release\ControlHub-Install-Instructions.doc"
echo.

echo [1/7] Cerrando instancias previas de ControlHub...
taskkill /F /IM "ControlHub.exe" /T >nul 2>&1
echo.

echo [2/7] Verificando Node.js y npm...
where node >nul 2>nul
if errorlevel 1 goto node_missing
where npm >nul 2>nul
if errorlevel 1 goto npm_missing
echo.
goto node_check_done

:node_missing
    echo [ERROR] No se encontró Node.js en PATH.
    echo Instala Node.js y vuelve a ejecutar este script.
    pause
    exit /b 1

:npm_missing
    echo [ERROR] No se encontró npm en PATH.
    echo Instala Node.js (incluye npm) y vuelve a ejecutar este script.
    pause
    exit /b 1

:node_check_done

echo [3/7] Verificando recursos necesarios...
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
echo.

echo [4/7] Compilando y empaquetando...
call npm run build:electron
if %errorlevel% neq 0 (
    echo [ERROR] Falló la compilación. Verifique Node.js, dependencias y el runtime Python embebido.
    pause
    exit /b %errorlevel%
)
echo.

echo [5/7] Verificando artefactos de salida...
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
echo.

echo [6/7] Copiando utilitario de instalación de Tesseract a release...
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
echo.

echo [7/7] Ejecutando verificación final del instalador...
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path \"$env:TEMP\\ControlHubTestInstall\") { Remove-Item -Recurse -Force \"$env:TEMP\\ControlHubTestInstall\" }"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-installer.ps1
if %errorlevel% neq 0 (
    echo [ERROR] La verificación del instalador falló.
    pause
    exit /b %errorlevel%
)
echo [EXITO] Instalador generado y verificado correctamente.
explorer "%~dp0release"
pause
endlocal
