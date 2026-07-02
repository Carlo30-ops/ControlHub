Name "Test"
OutFile "temp_test1.exe"
Section
  FileOpen $0 "$EXEDIR\test.json" w
  FileWrite $0 "  ""terapiasDir"": ""test"",\r\n"
  FileClose $0
SectionEnd