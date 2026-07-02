const fs=require('fs');
const s=fs.readFileSync('scripts\\verify-installer.ps1','utf8');
const lines=s.split(/\r?\n/);
for(let i=0;i<lines.length;i++){
  const l=lines[i];
  if(l.includes('Write-Host " - $e"') || l.includes('foreach ($e in $errors)')){
    console.log('LINE',i+1, l);
    console.log('CODES', [...l].map(c=>c.charCodeAt(0)).join(','));
  }
}
console.log('TOTAL LINES', lines.length);
