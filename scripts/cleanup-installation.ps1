<#
Script de limpieza/desinstalación para ControlHub
Uso:
  - DryRun (por defecto muestra acciones):
      powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\cleanup-installation.ps1 -DryRun
  - Ejecutar limpieza real (elimina carpetas y ejecuta el desinstalador si existe):
      powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\cleanup-installation.ps1 -InstallDir "C:\Ruta\A\Instalacion" -RemoveUserData
Parámetros:
  -InstallDir: Ruta de instalación (por defecto la usada por `verify-installer.ps1` en TEMP)
  -RemoveUserData: Si se pasa, elimina las carpetas de usuario en Documentos (TERAPIAS)
  -DryRun: Modo seguro que solo imprime acciones
Qué hace:
  - Ejecuta `uninstall.exe` en la carpeta de instalación si existe (intenta modo silencioso)
  - Borra `initial-config.json` y carpeta de instalación si no hay desinstalador
  - Opcionalmente elimina las carpetas de usuario creadas en Documentos
#>
param(
    [string]$InstallDir,
    [switch]$RemoveUserData,
    [switch]$DryRun
)

if (-not $InstallDir) {
    $InstallDir = Join-Path $env:TEMP "ControlHubTestInstall"
}

$documents = [Environment]::GetFolderPath('MyDocuments')
$terapiasDir = Join-Path $documents 'TERAPIAS'
$terapiasDocs = Join-Path $terapiasDir 'DOCUMENTOS PARA ARMAR'
$terapiasBackup = Join-Path $terapiasDir 'BACKUP'
$terapiasProcessed = Join-Path $terapiasDir 'PROCESADOS'
$initialConfig = Join-Path $InstallDir 'initial-config.json'
$uninstallerExe = Join-Path $InstallDir 'uninstall.exe'

Write-Host "InstallDir: $InstallDir"
Write-Host "Uninstaller candidate: $uninstallerExe"

function Do-Run([string]$cmd, [string[]]$args) {
    Write-Host "Ejecutando: $cmd $($args -join ' ')"
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $cmd
        $psi.Arguments = $args -join ' '
        $psi.UseShellExecute = $false
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        $out = $p.StandardOutput.ReadToEnd()
        $err = $p.StandardError.ReadToEnd()
        $p.WaitForExit()
        return @{ ExitCode = $p.ExitCode; Out = $out; Err = $err }
    } catch {
        return @{ ExitCode = 1; Out = ''; Err = $_.ToString() }
    }
}

if ($DryRun) {
    Write-Host "DRY RUN: acciones que se ejecutarían:" -ForegroundColor Yellow
    if (Test-Path $uninstallerExe) { Write-Host " - Ejecutar desinstalador: $uninstallerExe /S" }
    else { Write-Host " - No se encuentra uninstall.exe; se eliminaría la carpeta: $InstallDir" }
    Write-Host " - Borrar archivo: $initialConfig (si existe)"
    if ($RemoveUserData) {
        Write-Host " - Eliminar carpetas de usuario:" -ForegroundColor Yellow
        Write-Host "   - $terapiasDir"
        Write-Host "   - $terapiasDocs"
        Write-Host "   - $terapiasBackup"
        Write-Host "   - $terapiasProcessed"
    }
    exit 0
}

# Ejecutar desinstalador si existe
if (Test-Path $uninstallerExe) {
    Write-Host "Se ha encontrado un desinstalador: $uninstallerExe"
    $res = Do-Run $uninstallerExe @('/S')
    Write-Host "Salida: exit=$($res.ExitCode)"; if ($res.Out) { Write-Host $res.Out }
    if ($res.ExitCode -ne 0) { Write-Host "Advertencia: el desinstalador devolvió código $($res.ExitCode)" -ForegroundColor Yellow }
} else {
    Write-Host "No se encontró uninstall.exe; eliminando carpeta de instalación: $InstallDir"
    try {
        Remove-Item -LiteralPath $initialConfig -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Carpeta de instalación eliminada (si existía)."
    } catch {
        Write-Error "Error al eliminar carpeta de instalación: $_"
    }
}

# Eliminar carpetas de usuario si se solicita
if ($RemoveUserData) {
    Write-Host "Eliminando datos de usuario (carpetas TERAPIAS)..."
    foreach ($p in @($terapiasProcessed, $terapiasBackup, $terapiasDocs, $terapiasDir)) {
        if (Test-Path $p) {
            try {
                Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
                Write-Host ("Eliminado: " + $p)
            } catch {
                Write-Host ("No se pudo eliminar " + $p + ": " + ($_.ToString())) -ForegroundColor Yellow
            }
        } else {
            Write-Host "No existe: $p"
        }
    }
}

Write-Host "Limpieza completada." -ForegroundColor Green
