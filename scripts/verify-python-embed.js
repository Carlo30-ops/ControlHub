const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pythonEmbedDir = path.join(root, 'python-embed');
const pythonExecutable = path.join(pythonEmbedDir, 'python.exe');

const error = (message) => {
  console.error('[ERROR] ' + message);
  process.exit(1);
};

if (!fs.existsSync(pythonEmbedDir)) {
  error('No se encontró la carpeta python-embed. El instalador completo requiere el runtime Python embebido en `ControlHub/python-embed`.');
}

if (!fs.existsSync(pythonExecutable)) {
  error('No se encontró python.exe dentro de python-embed. Asegúrate de que `ControlHub/python-embed/python.exe` exista.');
}

console.log('python-embed verificado correctamente.');
