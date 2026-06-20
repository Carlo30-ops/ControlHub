@echo off
echo =======================================================
echo          ControlHub - Generador de instalador Windows
echo =======================================================
echo.

cd /d "%~dp0"

echo [1/3] Cerrando instancias previas de ControlHub...
taskkill /F /IM "ControlHub.exe" /T >nul 2>&1

echo [2/3] Limpiando release/win-unpacked anterior...
if exist "release\win-unpacked" rmdir /s /q "release\win-unpacked"

echo [3/3] Compilando y empaquetando...
call npm run build:electron

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion. Verifique Node.js y dependencias.
    pause
    exit /b %errorlevel%
)

echo [EXITO] Instalador generado en la carpeta release.
explorer "%~dp0release"
pause
