const { execFile } = require("child_process");
const path = require("path");

function runGs(args) {
  return new Promise((resolve, reject) => {
    const gsCommand = process.env.GS_PATH || (process.platform === "win32" ? "gswin64c" : "gs");
    const formattedCmd = `"${gsCommand}" ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`;
    
    const { log } = require("../utils/logger");
    log("gs:exec", "info", { command: formattedCmd });

    execFile(gsCommand, args, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) {
        const errorMsg = stderr || error.message;
        log("gs:exec", "error", { command: formattedCmd }, errorMsg);
        reject(new Error(`Ghostscript error: ${errorMsg}`));
      } else {
        if (stderr) {
          log("gs:exec", "warning", { command: formattedCmd, stderr });
        } else {
          log("gs:exec", "success", { command: formattedCmd });
        }
        resolve();
      }
    });
  });
}

async function compressPdfNative(inputPath, outputPath, profile = "/ebook") {
  const timestamp = Math.floor(Date.now() / 1000);
  const outPath = outputPath || path.join(path.dirname(inputPath), `comprimido_${timestamp}.pdf`);

  const args = [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${profile}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    "-dEmbedAllFonts=true",
    "-dSubsetFonts=true",
    `-sOutputFile=${outPath}`,
    inputPath,
  ];

  await runGs(args);
  return outPath;
}

async function pdfToImageNative(inputPath, outputDir, format = "png", dpi = 150) {
  if (!inputPath) throw new Error("No se ha proporcionado el PDF de entrada.");
  const dir = outputDir || path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const timestamp = Math.floor(Date.now() / 1000);
  
  const extension = format === "png" ? "png" : "jpg";
  const device = format === "png" ? "png16m" : "jpeg";
  const outPattern = path.join(dir, `${baseName}_${timestamp}_p%d.${extension}`);

  const args = [
    `-sDEVICE=${device}`,
    `-r${dpi}`,
    "-dNOPAUSE",
    "-dBATCH",
    "-dQUIET",
    "-dTextAlphaBits=4",
    "-dGraphicsAlphaBits=4",
    `-sOutputFile=${outPattern}`,
    inputPath,
  ];

  await runGs(args);
  return dir;
}

module.exports = {
  compressPdfNative,
  pdfToImageNative,
};

