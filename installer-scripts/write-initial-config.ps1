param(
  [string]$InstallDir,
  [string]$Documents,
  [string]$TesseractPath
)
$o = @{
  terapiasDir = Join-Path $Documents 'TERAPIAS\DOCUMENTOS PARA ARMAR'
  terapiasBackup = Join-Path $Documents 'TERAPIAS\BACKUP'
  terapiasProcessed = Join-Path $Documents 'TERAPIAS\PROCESADOS'
}
if ($TesseractPath -and $TesseractPath.Trim() -ne '') { $o.tesseractPath = $TesseractPath }
$json = $o | ConvertTo-Json -Depth 10
$outPath = Join-Path $InstallDir 'initial-config.json'
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.Encoding]::UTF8)
Write-Output "WROTE:$outPath"
