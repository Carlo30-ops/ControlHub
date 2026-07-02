Name "Test"
OutFile "test.exe"
Section
  FileOpen $0 "$EXEDIR\\test.txt" w
  FileWrite $0 '{'
  FileWrite $0 '$\r$\n'
  FileWrite $0 '  "terapiasDir": "$DOCUMENTS\\TERAPIAS\\DOCUMENTOS PARA ARMAR",'
  FileWrite $0 '$\r$\n'
  FileWrite $0 '  "terapiasBackup": "$DOCUMENTS\\TERAPIAS\\BACKUP",'
  FileWrite $0 '$\r$\n'
  FileWrite $0 '  "terapiasProcessed": "$DOCUMENTS\\TERAPIAS\\PROCESADOS"'
  FileWrite $0 '$\r$\n'
  FileWrite $0 ','
  FileWrite $0 '$\r$\n'
  FileWrite $0 '  "tesseractPath": "$R0"'
  FileWrite $0 '$\r$\n'
  FileWrite $0 '}'
  FileClose $0
SectionEnd
