/**
 * Request Logging Middleware
 * Logs all incoming requests with detailed information
 */

const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Get log file path based on date
const getLogFilePath = () => {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `requests-${date}.log`);
};

// Format log entry
const formatLogEntry = (req, res, responseTime) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    fileId: req.body?.fileId || req.params?.fileId || null,
    fileSize: req.file?.size || null,
  };

  return JSON.stringify(logEntry) + '\n';
};

// Request logger middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Capture response finish event
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const logEntry = formatLogEntry(req, res, responseTime);

    // Write to log file
    fs.appendFile(getLogFilePath(), logEntry, (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      }
    });

    // Console log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${responseTime}ms`);
    }
  });

  next();
};

// Error logger
const logError = (err, req) => {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
  };

  const errorLogPath = path.join(logsDir, `errors-${new Date().toISOString().split('T')[0]}.log`);
  
  fs.appendFile(errorLogPath, JSON.stringify(errorEntry) + '\n', (writeErr) => {
    if (writeErr) {
      console.error('Error writing to error log:', writeErr);
    }
  });
};

// Log file operations
const logFileOperation = (operation, fileId, details = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    fileId,
    ...details,
  };

  const operationsLogPath = path.join(logsDir, `operations-${new Date().toISOString().split('T')[0]}.log`);
  
  fs.appendFile(operationsLogPath, JSON.stringify(logEntry) + '\n', (err) => {
    if (err) {
      console.error('Error writing to operations log:', err);
    }
  });
};

module.exports = {
  requestLogger,
  logError,
  logFileOperation,
};
