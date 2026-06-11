const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const logDir = path.join(app.getPath("userData"), "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "app.log");

function log(operation, status, params, error = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    status,
    params,
    error: error ? (error.message || String(error)) : null,
  };

  const line = `[${timestamp}] [${operation.toUpperCase()}] [${status.toUpperCase()}] Params: ${JSON.stringify(params)}${error ? ` | Error: ${error.message || error}` : ""}\n`;
  
  console.log(line.trim());
  
  try {
    fs.appendFileSync(logFile, line);
  } catch (err) {
    console.error("Failed to write to log file:", err);
  }
}

module.exports = {
  log,
  logDir,
};
