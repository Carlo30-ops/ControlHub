; Script NSIS personalizado para ControlHub
; Crea carpetas necesarias para terapias, instala Tesseract OCR y configura rutas por defecto

!macro customInstall
  StrCpy $R0 ""
  ; Crear carpetas para terapias en Documentos del usuario
  CreateDirectory "$DOCUMENTS\TERAPIAS"
  CreateDirectory "$DOCUMENTS\TERAPIAS\DOCUMENTOS PARA ARMAR"
  CreateDirectory "$DOCUMENTS\TERAPIAS\PROCESADOS"
  CreateDirectory "$DOCUMENTS\TERAPIAS\BACKUP"
  
  ; Intentar crear carpetas en OneDrive si existe
  ${If} ${FileExists} "$PROFILE\OneDrive"
    CreateDirectory "$PROFILE\OneDrive\Documentos\TERAPIAS"
    CreateDirectory "$PROFILE\OneDrive\Documentos\TERAPIAS\DOCUMENTOS PARA ARMAR"
    CreateDirectory "$PROFILE\OneDrive\Documentos\TERAPIAS\PROCESADOS"
    CreateDirectory "$PROFILE\OneDrive\Documentos\TERAPIAS\BACKUP"
  ${EndIf}
  
  ; Verificar si Tesseract ya está instalado
  ${IfNot} ${FileExists} "$PROGRAMFILES\Tesseract-OCR\tesseract.exe"
    ${AndIfNot} ${FileExists} "$PROGRAMFILES64\Tesseract-OCR\tesseract.exe"
    
    ; Crear directorio temporal para descarga
    CreateDirectory "$TEMP\tesseract_install"
    
    ; Descargar Tesseract OCR usando PowerShell
    DetailPrint "Descargando Tesseract OCR..."
    nsExec::ExecToLog 'powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri https://github.com/UB-Mannheim/tesseract/releases/download/v5.3.1.20230401/tesseract-ocr-w64-setup-5.3.1.20230401.exe -OutFile \"$TEMP\tesseract_install\tesseract-setup.exe\""'
    Pop $0
    
    ${If} ${FileExists} "$TEMP\tesseract_install\tesseract-setup.exe"
      DetailPrint "Instalando Tesseract OCR..."
      ; Instalar Tesseract silenciosamente
      nsExec::ExecToLog '"$TEMP\tesseract_install\tesseract-setup.exe" /S /D="$PROGRAMFILES64\Tesseract-OCR"'
      Pop $0
      
      ; Esperar a que termine la instalación
      Sleep 10000
      
      ; Limpiar archivos temporales
      Delete "$TEMP\tesseract_install\tesseract-setup.exe"
      RMDir "$TEMP\tesseract_install"
    ${Else}
      DetailPrint "ADVERTENCIA: No se pudo descargar Tesseract OCR. La función OCR no estará disponible."
    ${EndIf}
  ${Else}
    DetailPrint "Tesseract OCR ya está instalado."
  ${EndIf}
  
  ; Determinar ruta de Tesseract para configuración
  ${If} ${FileExists} "$PROGRAMFILES64\TESSERACT-OCR\tesseract.exe"
    StrCpy $R0 "$PROGRAMFILES64\Tesseract-OCR\tesseract.exe"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\TESSERACT-OCR\tesseract.exe"
    StrCpy $R0 "$PROGRAMFILES\Tesseract-OCR\tesseract.exe"
  ${Else}
    ; Intentar detectar Tesseract en PATH si la instalación silenciosa no dejó el binario en las rutas esperadas
    SearchPath $R1 "tesseract.exe"
    ${If} $R1 != ""
      StrCpy $R0 "$R1"
    ${Else}
      StrCpy $R0 ""
    ${EndIf}
  ${EndIf}
  
  ; Crear archivo de configuración inicial con rutas por defecto usando PowerShell (genera JSON válido)
  StrCpy $R2 "$DOCUMENTS\\TERAPIAS\\DOCUMENTOS PARA ARMAR"
  StrCpy $R3 "$DOCUMENTS\\TERAPIAS\\BACKUP"
  StrCpy $R4 "$DOCUMENTS\\TERAPIAS\\PROCESADOS"
  SetOutPath "$INSTDIR"
  File /oname=write-initial-config.ps1 "${PROJECT_DIR}\installer-scripts\write-initial-config.ps1"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\\write-initial-config.ps1" -InstallDir "$INSTDIR" -Documents "$DOCUMENTS" -TesseractPath "$R0"'
  Delete "$INSTDIR\write-initial-config.ps1"
  
  ; Mostrar mensaje final
  ${If} $R0 != ""
    MessageBox MB_OK|MB_ICONINFORMATION "ControlHub se ha instalado correctamente.$\n$\nCarpetas creadas:$\n- Documentos\TERAPIAS$\n- OneDrive\Documentos\TERAPIAS (si disponible)$\n$\nTesseract OCR instalado y configurado.$\n$\nLa aplicación está lista para usar."
  ${Else}
    MessageBox MB_OK|MB_ICONINFORMATION "ControlHub se ha instalado correctamente.$\n$\nCarpetas creadas:$\n- Documentos\TERAPIAS$\n- OneDrive\Documentos\TERAPIAS (si disponible)$\n$\nADVERTENCIA: Tesseract OCR no se pudo instalar. La función OCR no estará disponible.$\n$\nPuedes ejecutar install_tesseract.bat manualmente desde la carpeta de instalación o desde release\install_tesseract.bat para intentar instalarlo de nuevo."
  ${EndIf}
!macroend

!macro customUnInstall
  ; No eliminamos las carpetas de terapias al desinstalar para preservar datos del usuario
  ; Tampoco eliminamos Tesseract OCR ya que puede ser usado por otras aplicaciones
  
  ; Eliminar archivo de configuración inicial
  Delete "$INSTDIR\initial-config.json"
!macroend
