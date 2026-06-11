@echo off
echo =======================================================
echo          Generador de Ejecutable COTU Analytics
echo =======================================================
echo.
echo Iniciando proceso de compilacion para el entorno web (Vite)...
echo Y posterior empaquetado para Escritorio Windows (Electron Builder)...
echo.

cd /d "%~dp0"

echo [1/3] Limpiando procesos en segundo plano de COTU Analytics...
taskkill /F /IM "COTU Analytics.exe" /T >nul 2>&1

echo [2/3] Limpiando antigua carpeta de compilacion (release/win-unpacked)...
if exist "release\win-unpacked" rmdir /s /q "release\win-unpacked"

echo [3/3] Compilando y empaquetando...
call npm run build:electron

echo.
if %errorlevel% neq 0 (
    echo [ERROR] Hubo un problema compilando el proyecto. Asegurese de tener Node.js instalado y reiniciar el PC si recien lo instalo.
    pause
    exit /b %errorlevel%
)

echo [EXITO] Compilacion completada con exito.
echo Abriendo la carpeta 'release' donde se encuentra el .exe...
echo.

explorer "%~dp0release"

pause
