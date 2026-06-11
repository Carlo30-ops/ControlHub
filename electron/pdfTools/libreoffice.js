const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

function runSoffice(args) {
  return new Promise((resolve, reject) => {
    const sofficeCommand = process.env.LIBREOFFICE_PATH || "soffice";
    const formattedCmd = `"${sofficeCommand}" ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`;
    
    const { log } = require("../utils/logger");
    log("soffice:exec", "info", { command: formattedCmd });

    execFile(sofficeCommand, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const errorMsg = stderr || error.message;
        log("soffice:exec", "error", { command: formattedCmd }, errorMsg);
        reject(new Error(`LibreOffice error: ${errorMsg}`));
      } else {
        if (stderr) {
          log("soffice:exec", "warning", { command: formattedCmd, stderr });
        } else {
          log("soffice:exec", "success", { command: formattedCmd });
        }
        resolve();
      }
    });
  });
}

async function isNativePdf(inputPath) {
  return new Promise((resolve) => {
    const qpdfCommand = process.env.QPDF_PATH || "qpdf";
    execFile(qpdfCommand, ["--show-pages", inputPath], { windowsHide: true }, (error, stdout) => {
      if (error) {
        resolve(false); 
      } else {
        resolve(stdout.toLowerCase().includes("font"));
      }
    });
  });
}

async function pdfToWordNative(inputPath, outputDir) {
  const outDir = outputDir || path.dirname(inputPath);
  const timestamp = Math.floor(Date.now() / 1000);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const tempOutPath = path.join(outDir, `${baseName}.docx`);
  const finalOutPath = path.join(outDir, `convertido_${timestamp}.docx`);

  const isNative = await isNativePdf(inputPath);
  const args = ["--headless", "--convert-to", "docx"];
  
  if (isNative) {
    args.push("--infilter=writer_pdf_import");
  }
  
  args.push(inputPath, "--outdir", outDir);

  await runSoffice(args);
  
  if (fs.existsSync(tempOutPath)) {
    const stats = fs.statSync(tempOutPath);
    if (stats.size === 0) {
      throw new Error("El archivo convertido está vacío.");
    }
    fs.renameSync(tempOutPath, finalOutPath);
  } else {
    throw new Error("No se generó el archivo de salida .docx.");
  }
  return finalOutPath;
}

async function wordToPdfNative(inputPath, outputDir) {
  const outDir = outputDir || path.dirname(inputPath);
  const timestamp = Math.floor(Date.now() / 1000);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const tempOutPath = path.join(outDir, `${baseName}.pdf`);
  const finalOutPath = path.join(outDir, `${baseName}_${timestamp}.pdf`);

  await runSoffice(["--headless", "--convert-to", "pdf", inputPath, "--outdir", outDir]);
  
  if (fs.existsSync(tempOutPath)) {
    fs.renameSync(tempOutPath, finalOutPath);
  } else {
    throw new Error("No se generó el archivo PDF de salida. Verifica que LibreOffice esté correctamente instalado y la ruta configurada.");
  }
  return finalOutPath;
}

module.exports = {
  pdfToWordNative,
  wordToPdfNative,
};

