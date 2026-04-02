const fs = require("fs");
const path = require("path");
 
const logDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
 
const logger = {
  error: (message, metadata = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message,
      ...metadata,
      env: process.env.NODE_ENV,
    };
 
    // Log to file
    const logFile = path.join(logDir, "error.log");
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
 
    // Log to console in development
    if (process.env.NODE_ENV !== "production") {
      console.error("[ERROR]", message, metadata);
    }
  },
 
  warn: (message, metadata = {}) => {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "WARN",
      message,
      ...metadata,
    };
 
    const logFile = path.join(logDir, "warn.log");
    fs.appendFileSync(logFile, JSON.stringify(entry) + "\n");
 
    if (process.env.NODE_ENV !== "production") {
      console.warn("[WARN]", message, metadata);
    }
  },
 
  info: (message, metadata = {}) => {
    if (process.env.LOG_LEVEL !== "info") return;
 
    const entry = {
      timestamp: new Date().toISOString(),
      level: "INFO",
      message,
      ...metadata,
    };
 
    console.log("[INFO]", message, metadata);
  },
};
 
module.exports = logger;
 