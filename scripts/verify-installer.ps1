<#
Verificación del instalador ControlHub
Uso:
  - DryRun (por defecto pruebas sin ejecutar instalador):
      powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-installer.ps1 -DryRun
  - Ejecutar la instalación (requiere UAC si el instalador pide elevación):
      powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-installer.ps1
Lo que hace:
  - Intenta ejecutar el instalador con /S /D=<ruta_temp>
  - Verifica la existencia de las carpetas en Documentos
  - Verifica que se creó `initial-config.json` en la carpeta de instalación y que contiene las claves esperadas
  - Imprime un resumen y devuelve código de salida (0 = OK, >0 = fallo)
#>
param(
    [switch]$DryRun
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$installerPath = Join-Path $scriptRoot "..\release\ControlHub Setup 3.2.0.exe" | Resolve-Path -ErrorAction SilentlyContinue
if (-not $installerPath) {
    Write-Error "Instalador no encontrado en release\ControlHub Setup 3.2.0.exe. Construye el instalador primero."
    exit 2
}
$installerPath = $installerPath.Path
$installDir = Join-Path $env:TEMP "ControlHubTestInstall"
$documents = [Environment]::GetFolderPath('MyDocuments')
$terapiasDir = Join-Path $documents 'TERAPIAS'
$terapiasDocs = Join-Path $terapiasDir 'DOCUMENTOS PARA ARMAR'
$terapiasBackup = Join-Path $terapiasDir 'BACKUP'
$terapiasProcessed = Join-Path $terapiasDir 'PROCESADOS'
$initialConfig = Join-Path $installDir 'initial-config.json'

Write-Host "Installer: $installerPath"
Write-Host "Target install dir: $installDir"
Write-Host "Documents: $documents"

# Compose arguments: NSIS silent + destination
$argD = "/D=$installDir"
$args = "/S $argD"

if ($DryRun) {
    Write-Host "DRY RUN: no se ejecutará el instalador. Comando que se ejecutaría:" -ForegroundColor Yellow
    Write-Host ('Start-Process -FilePath "' + $installerPath + '" -ArgumentList "' + $args + '" -Wait -Verb runas') -ForegroundColor Yellow
    Write-Host 'Comprobaciones que realizara el script tras la instalacion (simuladas):' -ForegroundColor Cyan
    Write-Host " - Existencia: $terapiasDir"
    Write-Host " - Existencia: $terapiasDocs"
    Write-Host " - Existencia: $terapiasBackup"
    Write-Host " - Existencia: $terapiasProcessed"
    Write-Host " - Archivo: $initialConfig"
    exit 0
}

# Ejecutar instalador
Write-Host "Ejecutando instalador..."
try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $installerPath
    $psi.Arguments = $args
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $psi.WorkingDirectory = Split-Path $installerPath
    $proc = [System.Diagnostics.Process]::Start($psi)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $code = $proc.ExitCode
    if ($stdout) { Write-Host $stdout }
    if ($stderr) { Write-Host $stderr -ForegroundColor Red }
} catch {
    Write-Error "Fallo al iniciar el instalador: $_"
    exit 3
}

Write-Host "Instalador finalizó con código: $code"

# Verificaciones post-instalación
$errors = @()

if (-not (Test-Path $terapiasDir)) { $errors += "Carpeta faltante: $terapiasDir" }
if (-not (Test-Path $terapiasDocs)) { $errors += "Carpeta faltante: $terapiasDocs" }
if (-not (Test-Path $terapiasBackup)) { $errors += "Carpeta faltante: $terapiasBackup" }
if (-not (Test-Path $terapiasProcessed)) { $errors += "Carpeta faltante: $terapiasProcessed" }

if (-not (Test-Path $initialConfig)) {
    $errors += "Archivo initial-config.json no encontrado en $installDir"
} else {
    try {
        $raw = Get-Content $initialConfig -Raw -ErrorAction Stop
        try {
            $json = $raw | ConvertFrom-Json -ErrorAction Stop
        } catch {
            # Intentar reparar barras invertidas no escapadas: convertir "\" -> "\\" antes de parsear
            $fixed = $raw -replace '\\', '\\\\'
            try {
                $json = $fixed | ConvertFrom-Json -ErrorAction Stop
                Write-Host "Aviso: se reparó JSON reemplazando backslashes para parseo" -ForegroundColor Yellow
            } catch {
                throw $_
            }
        }
        $required = @('terapiasDir','terapiasBackup','terapiasProcessed')
        foreach ($k in $required) {
            if (-not $json.PSObject.Properties.Name -contains $k) { $errors += "Clave JSON faltante: $k" }
        }
        if ($json.tesseractPath) { Write-Host "Tesseract detectado en initial-config.json: $($json.tesseractPath)" }
    } catch {
        $errors += "Error al parsear ${initialConfig}: $($_)"
    }
}

# Si el JSON contiene la ruta terapiasDir, verificarla; en caso contrario comprobar rutas por defecto
if ($json -and $json.terapiasDir) {
    $configured = $json.terapiasDir
    if (-not (Test-Path $configured)) {
        # también comprobar CommonDocuments (Public) y Documents del usuario
        $common = [Environment]::GetFolderPath('CommonDocuments')
        if (-not (Test-Path $configured) -and ($configured -like "*$common*" -or -not (Test-Path $configured))) {
            # no existente
            $errors += "Carpeta faltante (según initial-config.json): $configured"
        }
    }
} else {
    # comprobaciones por defecto: verificar si existen en Documentos del usuario o en CommonDocuments
    $commonDocs = [Environment]::GetFolderPath('CommonDocuments')
    if (-not (Test-Path $terapiasDir) -and -not (Test-Path (Join-Path $commonDocs 'TERAPIAS'))) { $errors += "Carpeta faltante: $terapiasDir" }
    if (-not (Test-Path $terapiasDocs) -and -not (Test-Path (Join-Path $commonDocs 'TERAPIAS\DOCUMENTOS PARA ARMAR'))) { $errors += "Carpeta faltante: $terapiasDocs" }
    if (-not (Test-Path $terapiasBackup) -and -not (Test-Path (Join-Path $commonDocs 'TERAPIAS\BACKUP'))) { $errors += "Carpeta faltante: $terapiasBackup" }
    if (-not (Test-Path $terapiasProcessed) -and -not (Test-Path (Join-Path $commonDocs 'TERAPIAS\PROCESADOS'))) { $errors += "Carpeta faltante: $terapiasProcessed" }
}

if ($errors.Count -eq 0) {
    Write-Host "Verificacion completada: OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Verificacion completada: FALLO" -ForegroundColor Red
    foreach ($e in $errors) { Write-Host (' - ' + $e) }
    exit 4
}
