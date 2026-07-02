const fs = require('fs');
const script = [
  'Name "Test"',
  'OutFile "temp_test1.exe"',
  'Section',
  '  FileOpen $0 "$EXEDIR\\test.json" w',
  '  FileWrite $0 "  ""terapiasDir"": ""test"",\\r\\n"',
  '  FileClose $0',
  'SectionEnd'
].join('\r\n');
fs.writeFileSync('temp-test1.nsi', script, 'utf8');
console.log('WROTE:');
console.log(script);
console.log('--- BYTES ---');
console.log(fs.readFileSync('temp-test1.nsi','hex'));
