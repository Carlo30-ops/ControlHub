Name "Test"
OutFile "test.exe"
Section
  FileOpen $0 "$EXEDIR\\test.txt" w
  FileWrite $0 "  \"terapiasDir\": \"foo\",$\r$\n"
  FileClose $0
SectionEnd
