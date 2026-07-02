const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const pythonEmbedDir = path.join(root, 'python-embed');
const pythonExecutable = path.join(pythonEmbedDir, 'python.exe');

const error = (message) => {
  console.error('[ERROR] ' + message);
  process.exit(1);
};

const parsePyenvCfg = (cfgPath) => {
  const content = fs.readFileSync(cfgPath, 'utf8');
  return content.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return acc;
    const [key, ...rest] = trimmed.split('=');
    acc[key.trim()] = rest.join('=').trim();
    return acc;
  }, {});
};

const copyIfMissing = (sourceRoot, targetRoot, fileName) => {
  const targetPath = path.join(targetRoot, fileName);
  if (fs.existsSync(targetPath)) return true;
  const sourcePath = path.join(sourceRoot, fileName);
  if (!fs.existsSync(sourcePath)) return false;
  fs.copyFileSync(sourcePath, targetPath);
  return true;
};

if (!fs.existsSync(pythonEmbedDir)) {
  error('No se encontró la carpeta python-embed. El instalador completo requiere el runtime Python embebido en `ControlHub/python-embed`.');
}

if (!fs.existsSync(pythonExecutable)) {
  error('No se encontró python.exe dentro de python-embed. Asegúrate de que `ControlHub/python-embed/python.exe` exista.');
}

const requiredFiles = ['python.exe', 'pythonw.exe'];

const cfgPath = path.join(pythonEmbedDir, 'pyvenv.cfg');
let homePython = null;
let pythonVersion = null;
if (fs.existsSync(cfgPath)) {
  const cfg = parsePyenvCfg(cfgPath);
  if (cfg.home) {
    homePython = cfg.home;
  }
  if (cfg.version) {
    const [major, minor] = cfg.version.split('.').slice(0, 2);
    pythonVersion = `${major}${minor}`;
  }
}

const homePythonRoot = (() => {
  if (!homePython) return null;
  const candidate = path.join(homePython, 'Lib');
  if (fs.existsSync(candidate)) {
    return homePython;
  }
  const maybeRoot = path.dirname(homePython);
  if (fs.existsSync(path.join(maybeRoot, 'Lib'))) {
    return maybeRoot;
  }
  return null;
})();

const versionDll = (() => {
  try {
    const versionOutput = execFileSync(pythonExecutable, ['-c', "import sys; print(f'{sys.version_info[0]}{sys.version_info[1]}')"], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return `python${versionOutput}.dll`;
  } catch {
    return pythonVersion ? `python${pythonVersion}.dll` : null;
  }
})();

const copyDirectoryRecursive = (source, dest, options = {}) => {
  if (!fs.existsSync(source)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (options.skip?.some((pattern) => {
      if (pattern instanceof RegExp) {
        return pattern.test(srcPath);
      }
      return srcPath.includes(pattern);
    })) {
      continue;
    }

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, options);
    } else if (entry.isFile()) {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
};

const copyStdlibFromHomePython = (homeRoot) => {
  const sourceLib = path.join(homeRoot, 'Lib');
  const destLib = path.join(pythonEmbedDir, 'Lib');
  if (!fs.existsSync(sourceLib)) {
    error(`No se encontró la carpeta Lib en ${sourceLib}.`);
  }
  console.log(`[INFO] Copiando la biblioteca estándar de Python desde ${sourceLib} a ${destLib}...`);
  copyDirectoryRecursive(sourceLib, destLib, {
    skip: [/\\__pycache__$/, /\\tests?$/, /\\idlelib$/, /\\tkinter$/],
  });
};

if (!versionDll) {
  error('No se pudo determinar el nombre del DLL de versión de Python. Asegúrate de que pyvenv.cfg tenga la clave version o que python.exe funcione.');
}

requiredFiles.push('python3.dll', versionDll, 'vcruntime140.dll', 'vcruntime140_1.dll');

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.join(pythonEmbedDir, file)));
if (missingFiles.length > 0) {
  if (!homePythonRoot) {
    error(`Faltan archivos críticos en python-embed: ${missingFiles.join(', ')}. No se encontró la ruta base en pyvenv.cfg para copiar desde una instalación de Python existente.`);
  }

  const sourceRoot = homePythonRoot;
  missingFiles.forEach((file) => {
    if (!copyIfMissing(sourceRoot, pythonEmbedDir, file)) {
      error(`Faltan archivos críticos en python-embed: ${missingFiles.join(', ')}. No se pudo copiar ${file} desde ${sourceRoot}.`);
    }
    console.log(`[INFO] Copiado ${file} desde ${sourceRoot} a python-embed.`);
  });
}

const encodingDir = path.join(pythonEmbedDir, 'Lib', 'encodings');
if (!fs.existsSync(encodingDir)) {
  if (!homePythonRoot) {
    error('El runtime Python embebido parece incompleto: falta Lib\\encodings y no hay una instalación de Python disponible para copiarlo.');
  }
  copyStdlibFromHomePython(homePythonRoot);
}

try {
  const env = { ...process.env, PYTHONHOME: pythonEmbedDir, PYTHONPATH: path.join(pythonEmbedDir, 'Lib', 'site-packages') };
  const version = execFileSync(pythonExecutable, ['-c', "import sys, json, encodings; print('python-embed OK');"], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  }).toString().trim();
  if (!version.includes('python-embed OK')) {
    throw new Error('La comprobación de python-embed no devolvió el resultado esperado.');
  }
  console.log(`python-embed funciona correctamente: ${version}`);
} catch (e) {
  error(`python-embed no se puede ejecutar correctamente. Error: ${e.message}`);
}

console.log('python-embed verificado correctamente.');
