const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

function getQpdfPath() {
  if (process.env.QPDF_PATH) {
    return process.env.QPDF_PATH;
  }
  try {
    const settingsPath = path.join(app.getPath("userData"), "settings.json");
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const settings = JSON.parse(data);
      if (settings && settings.qpdfPath) {
        return settings.qpdfPath;
      }
    }
  } catch (err) {
    console.error("Error reading qpdf path from settings:", err);
  }
  return "qpdf";
}

function runQpdf(args) {
  return new Promise((resolve, reject) => {
    const qpdfCommand = getQpdfPath();
    const formattedCmd = `"${qpdfCommand}" ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`;
    
    const { log } = require("../utils/logger");
    // Logueamos el comando que se va a ejecutar
    log("qpdf:exec", "info", { command: formattedCmd });

    execFile(qpdfCommand, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const errorMsg = stderr || error.message;
        log("qpdf:exec", "error", { command: formattedCmd }, errorMsg);
        reject(new Error(`qpdf error: ${errorMsg}`));
      } else {
        if (stderr) {
          log("qpdf:exec", "warning", { command: formattedCmd, stderr });
        } else {
          log("qpdf:exec", "success", { command: formattedCmd });
        }
        resolve();
      }
    });
  });
}

async function checkPdfValid(inputPath) {
  return new Promise((resolve) => {
    const qpdfCommand = getQpdfPath();
    execFile(qpdfCommand, ["--check", inputPath], { windowsHide: true }, (error) => {
      resolve(!error);
    });
  });
}

async function mergePdfsNative(inputPaths, outputPath) {
  if (!Array.isArray(inputPaths) || inputPaths.length < 2) {
    throw new Error("Se requieren al menos dos PDFs para unir.");
  }

  // Validación de archivos
  for (const p of inputPaths) {
    const isValid = await checkPdfValid(p);
    if (!isValid) {
      throw new Error(`El archivo no es un PDF válido o está corrupto: ${path.basename(p)}`);
    }
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPaths[0]), `unido_${timestamp}.pdf`);

  const args = ["--empty", "--pages"];
  for (const p of inputPaths) {
    args.push(p, "1-z");
  }
  args.push("--", outPath);

  await runQpdf(args);
  return outPath;
}

async function splitPdfNative(inputPath, ranges, outputDir) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!Array.isArray(ranges) || ranges.length === 0) {
    throw new Error("Debes indicar al menos un rango de páginas.");
  }

  const dir = outputDir || path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const timestamp = Math.floor(Date.now() / 1000);
  const outputs = [];

  for (const range of ranges) {
    const safeRange = String(range).trim();
    if (!safeRange) continue;
    const outPath = path.join(dir, `${baseName}_${timestamp}_${safeRange.replace(/[^0-9\-]/g, "")}.pdf`);
    const args = [inputPath, "--pages", inputPath, safeRange, "--", outPath];
    await runQpdf(args);
    outputs.push(outPath);
  }

  return outputs;
}

async function protectPdfNative(inputPath, outputPath, password) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!password) {
    throw new Error("Debes indicar una contraseña.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `protegido_${timestamp}.pdf`);
  const args = ["--encrypt", password, password, "256", "--", inputPath, outPath];
  await runQpdf(args);
  return outPath;
}

async function getPageCount(inputPath) {
  return new Promise((resolve, reject) => {
    const qpdfCommand = getQpdfPath();
    execFile(qpdfCommand, ["--show-npages", inputPath], { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Error al obtener número de páginas: ${stderr || error.message}`));
      } else {
        const count = parseInt(stdout.trim(), 10);
        if (isNaN(count)) {
          reject(new Error("No se pudo determinar el número de páginas."));
        } else {
          resolve(count);
        }
      }
    });
  });
}

async function extractPagesNative(inputPath, ranges, outputPath) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!ranges || ranges.trim() === "") {
    throw new Error("Debes indicar el rango de páginas a extraer.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `extraido_${timestamp}.pdf`);

  const safeRanges = ranges.replace(/end/gi, "z");
  const args = [inputPath, "--pages", ".", safeRanges, "--", outPath];
  
  await runQpdf(args);
  
  const pageCount = await getPageCount(outPath);
  return { filePath: outPath, pageCount };
}

async function rotatePdfNative(inputPath, angle, ranges, outputPath) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!angle || !["90", "180", "270"].includes(String(angle))) {
    throw new Error("Ángulo de rotación no válido. Debe ser 90, 180 o 270.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `rotado_${timestamp}.pdf`);

  // qpdf input.pdf --rotate=angle:range -- output.pdf
  // Si no hay rango, se asume 1-z (todas)
  const safeRange = (ranges || "1-z").replace(/end/gi, "z");
  const args = [inputPath, `--rotate=${angle}:${safeRange}`, "--", outPath];

  await runQpdf(args);
  return outPath;
}

async function unlockPdfNative(inputPath, outputPath, password) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `desbloqueado_${timestamp}.pdf`);
  const args = [];
  if (password) {
    args.push(`--password=${password}`);
  }
  args.push("--decrypt", inputPath, outPath);
  await runQpdf(args);
  return outPath;
}

async function deletePagesNative(inputPath, pagesToDelete, outputPath) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!pagesToDelete || pagesToDelete.trim() === "") {
    throw new Error("Debes indicar las páginas a eliminar.");
  }

  const totalPages = await getPageCount(inputPath);
  const toDelete = new Set();
  const parts = pagesToDelete.split(",");
  for (const part of parts) {
    const range = part.trim().split("-");
    if (range.length === 1) {
      const p = parseInt(range[0], 10);
      if (!isNaN(p)) toDelete.add(p);
    } else if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = range[1].toLowerCase() === "z" || range[1].toLowerCase() === "end" ? totalPages : parseInt(range[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          toDelete.add(i);
        }
      }
    }
  }

  const toKeep = [];
  let startRange = null;
  for (let i = 1; i <= totalPages; i++) {
    if (!toDelete.has(i)) {
      if (startRange === null) {
        startRange = i;
      }
    } else {
      if (startRange !== null) {
        if (startRange === i - 1) {
          toKeep.push(`${startRange}`);
        } else {
          toKeep.push(`${startRange}-${i - 1}`);
        }
        startRange = null;
      }
    }
  }
  if (startRange !== null) {
    if (startRange === totalPages) {
      toKeep.push(`${startRange}`);
    } else {
      toKeep.push(`${startRange}-z`);
    }
  }

  if (toKeep.length === 0) {
    throw new Error("No puedes eliminar todas las páginas del PDF.");
  }

  const keepRangeStr = toKeep.join(",");
  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `eliminado_${timestamp}.pdf`);
  const args = [inputPath, "--pages", ".", keepRangeStr, "--", outPath];
  await runQpdf(args);
  return outPath;
}

async function repairPdfNative(inputPath, outputPath) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `reparado_${timestamp}.pdf`);
  const args = [inputPath, outPath];
  await runQpdf(args);
  return outPath;
}

async function reorderPagesNative(inputPath, newOrderArray, outputPath) {
  if (!inputPath) {
    throw new Error("No se ha proporcionado el PDF de entrada.");
  }
  if (!Array.isArray(newOrderArray) || newOrderArray.length === 0) {
    throw new Error("Debes proporcionar el nuevo orden de las páginas.");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `reordenado_${timestamp}.pdf`);
  const pageStr = newOrderArray.join(",");
  const args = [inputPath, "--pages", ".", pageStr, "--", outPath];
  await runQpdf(args);
  return outPath;
}

module.exports = {
  mergePdfsNative,
  splitPdfNative,
  protectPdfNative,
  extractPagesNative,
  getPageCount,
  rotatePdfNative,
  unlockPdfNative,
  deletePagesNative,
  repairPdfNative,
  reorderPagesNative,
};


