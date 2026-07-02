Name "Test"
OutFile "test.exe"
!macro customInstall
  FileOpen $0 "$EXEDIR\\test.txt" w
  FileWrite $0 '  "terapiasDir": "$DOCUMENTS\\TERAPIAS\\DOCUMENTOS PARA ARMAR",$\r$\n'
  FileClose $0
!macroend
Section
  !insertmacro customInstall
SectionEnd
