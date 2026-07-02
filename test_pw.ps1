$  = @{
  terapiasDir = 'C:\Users\Public\Documents\TERAPIAS\DOCUMENTOS PARA ARMAR'
  terapiasBackup = 'C:\Users\Public\Documents\TERAPIAS\BACKUP'
  terapiasProcessed = 'C:\Users\Public\Documents\TERAPIAS\PROCESADOS'
  tesseractPath = 'C:\Program Files\Tesseract-OCR\tesseract.exe'
}
 | ConvertTo-Json -Depth 10 | Out-File -FilePath pwtest.json -Encoding UTF8
Get-Content pwtest.json -Raw
