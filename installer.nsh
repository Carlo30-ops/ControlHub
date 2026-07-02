; Script NSIS personalizado para ControlHub
; Crea carpetas necesarias para terapias, instala Tesseract OCR y configura rutas por defecto

!macro customInstall
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
    StrCpy $TESSERACT_PATH "$PROGRAMFILES64\Tesseract-OCR\tesseract.exe"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\TESSERACT-OCR\tesseract.exe"
    StrCpy $TESSERACT_PATH "$PROGRAMFILES\Tesseract-OCR\tesseract.exe"
  ${Else}
    StrCpy $TESSERACT_PATH ""
  ${EndIf}
  
  ; Crear archivo de configuración inicial con rutas por defecto
  FileOpen $0 "$INSTDIR\initial-config.json" w
  FileWrite $0 '{'
  FileWrite $0 '$n  "terapiasDir": "$DOCUMENTS\\TERAPIAS\\DOCUMENTOS PARA ARMAR",'
  FileWrite $0 '$n  "terapiasBackup": "$DOCUMENTS\\TERAPIAS\\BACKUP",'
  FileWrite $0 '$n  "terapiasProcessed": "$DOCUMENTS\\TERAPIAS\\PROCESADOS"'
  
  ${If} $TESSERACT_PATH != ""
    FileWrite $0 ','
    FileWrite $0 '$n  "tesseractPath": "$TESSERACT_PATH"'
  ${EndIf}
  
  FileWrite $0 '$n}'
  FileClose $0
  
  ; Mostrar mensaje final
  ${If} $TESSERACT_PATH != ""
    MessageBox MB_OK|MB_ICONINFORMATION "ControlHub se ha instalado correctamente.$\n$\nCarpetas creadas:$\n- Documentos\TERAPIAS$\n- OneDrive\Documentos\TERAPIAS (si disponible)$\n$\nTesseract OCR instalado y configurado.$\n$\nLa aplicación está lista para usar."
  ${Else}
    MessageBox MB_OK|MB_ICONINFORMATION "ControlHub se ha instalado correctamente.$\n$\nCarpetas creadas:$\n- Documentos\TERAPIAS$\n- OneDrive\Documentos\TERAPIAS (si disponible)$\n$\nADVERTENCIA: Tesseract OCR no se pudo instalar. La función OCR no estará disponible. Ejecuta install_tesseract.bat manualmente si lo necesitas."
  ${EndIf}
!macroend

!macro customUnInstall
  ; No eliminamos las carpetas de terapias al desinstalar para preservar datos del usuario
  ; Tampoco eliminamos Tesseract OCR ya que puede ser usado por otras aplicaciones
  
  ; Eliminar archivo de configuración inicial
  Delete "$INSTDIR\initial-config.json"
!macroend
