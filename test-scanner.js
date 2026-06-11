import { scanLocalDirectory } from './src/app/utils/localScanner.ts';
import * as path from 'path';

// Mock window.electronAPI needed since this is a pure Node.js test script 
// and `localScanner.ts` is meant to be run in the Renderer process
global.window = {
  electronAPI: {
    readDirectory: async (dirPath) => {
      const fs = require('fs');
      const arrayOfFiles = [];
      const getAllFiles = function(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        files.forEach(function(file) {
          const fullPath = path.join(dir, file);
          if (fs.statSync(fullPath).isDirectory()) {
            getAllFiles(fullPath);
          } else {
            arrayOfFiles.push(fullPath);
          }
        });
      };
      getAllFiles(dirPath);
      return arrayOfFiles;
    }
  }
};

async function testScanner() {
  console.log("=== Testing COTU Analytics Engine ===");
  
  // We'll scan the project's own PROYECTO EJEMPLO directory which mock invoices or just the scr directory to see if it processes files.
  const testDir = path.resolve(__dirname, 'test_facturas');
  
  const dateRange = {
    start: new Date('2020-01-01'),
    end: new Date('2030-01-01')
  };
  
  console.log(`Scanning directory: ${testDir}`);
  
  const result = await scanLocalDirectory(
    testDir, 
    dateRange, 
    (prog) => console.log(`Progress: ${prog.current}/${prog.total} files`)
  );
  
  console.log("\n=== Scan Results ===");
  console.log(`Time taken: ${result.duration.toFixed(2)} ms`);
  console.log(`Invoices found: ${result.invoices.length}`);
  
  if (result.invoices.length > 0) {
    console.log("First invoice data:");
    console.log(JSON.stringify(result.invoices[0], null, 2));
  } else {
    console.log("No COTU invoices found in the test directory. Check the regex logic.");
  }
}

testScanner().catch(console.error);
