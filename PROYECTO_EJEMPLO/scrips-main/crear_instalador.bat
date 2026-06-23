@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ============================================
echo   Generador COTU - Crear instalador
echo ============================================
echo.

:: Comprobar que existe el .spec
if not exist "generador_facturas_cotu.spec" (
    echo [ERROR] No se encuentra generador_facturas_cotu.spec
    pause
    exit /b 1
)

:: Comprobar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Python en el PATH.
    echo         Instala Python 3.11 o 3.12 desde python.org
    echo         y marca "Add Python to PATH".
    pause
    exit /b 1
)
echo [OK] Python detectado:
python --version
echo.

:: 1) Dependencias del proyecto
echo [1/3] Instalando dependencias (pandas, openpyxl)...
pip install -q -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Fallo al instalar requirements.txt
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas.
echo.

:: 2) PyInstaller
echo [2/3] Instalando PyInstaller...
pip install -q pyinstaller
if errorlevel 1 (
    echo [ERROR] Fallo al instalar PyInstaller
    pause
    exit /b 1
)
echo [OK] PyInstaller listo.
echo.

:: 3) Generar ejecutable
echo [3/3] Generando GeneradorCOTU.exe (puede tardar 1-2 min)...
if exist "dist" rmdir /s /q dist 2>nul
if exist "build" rmdir /s /q build 2>nul
pyinstaller --noconfirm --clean generador_facturas_cotu.spec
if errorlevel 1 (
    echo [ERROR] Fallo PyInstaller. Ejecuta este .bat desde CMD (no desde Cursor)
    echo         o pausa OneDrive si la carpeta esta sincronizada.
    pause
    exit /b 1
)

echo.
echo ============================================
echo   LISTO. Ejecutable generado:
echo   dist\GeneradorCOTU.exe
echo ============================================
echo.

:: Opcional: Inno Setup
where iscc >nul 2>&1
if not errorlevel 1 (
    echo [Extra] Creando instalador con Inno Setup...
    iscc instalador.iss
    if not errorlevel 1 (
        echo [OK] Instalador: dist_installer\Setup_GeneradorCOTU.exe
        start "" "dist_installer"
    )
) else (
    echo Para generar Setup_GeneradorCOTU.exe instala Inno Setup
    echo desde https://jrsoftware.org/isinfo.php
    echo.
)

echo Para llevar al otro PC:
echo   - Ejecutable portable: dist\GeneradorCOTU.exe
echo   - Instalador (si usaste Inno): dist_installer\Setup_GeneradorCOTU.exe
echo.
start "" "dist"
pause
