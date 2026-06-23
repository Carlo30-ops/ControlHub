@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo   Generar Setup_GeneradorCOTU.exe (instalador con Inno Setup)
echo.

if not exist "dist\GeneradorCOTU.exe" (
    echo [ERROR] No existe dist\GeneradorCOTU.exe
    echo         Ejecuta antes: crear_instalador.bat
    pause
    exit /b 1
)

where iscc >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Inno Setup no esta en el PATH.
    echo         Instala desde https://jrsoftware.org/isinfo.php
    echo         y marca "Add Inno Setup to PATH".
    pause
    exit /b 1
)

echo Compilando instalador...
iscc instalador.iss
if errorlevel 1 (
    echo [ERROR] Fallo la compilacion.
    pause
    exit /b 1
)

echo.
echo   Listo: dist_installer\Setup_GeneradorCOTU.exe
echo.
start "" "dist_installer"
pause
