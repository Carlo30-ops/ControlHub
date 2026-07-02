const fs=require('fs');
const s=fs.readFileSync('scripts\\verify-installer.ps1','utf8');
const lines=s.split(/\r?\n/);
let balance=0;
for(let i=0;i<lines.length;i++){
  const l=lines[i];
  for(const ch of l){ if(ch==='{') balance++; if(ch==='}') balance--; }
  if(balance<0) console.log('Negative balance at line', i+1);
}
console.log('Final balance', balance);
