Name "Test"
OutFile "test.exe"
Section
  FileOpen $0 "$EXEDIR\\test.txt" w
  FileWrite $0 "A ""B"" C"
  FileClose $0
SectionEnd
