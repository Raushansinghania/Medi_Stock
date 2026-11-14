/**
 * Simple structured console logger with timestamps and log levels
 */
const LogLevel = {
  INFO: '\x1b[36m[INFO]\x1b[0m',
  SUCCESS: '\x1b[32m[SUCCESS]\x1b[0m',
  WARN: '\x1b[33m[WARN]\x1b[0m',
  ERROR: '\x1b[31m[ERROR]\x1b[0m',
  DEBUG: '\x1b[35m[DEBUG]\x1b[0m',
};

const formatTime = () => new Date().toISOString();

const logger = {
  info: (msg, ...args) => {
    console.log(`${LogLevel.INFO} [${formatTime()}] ${msg}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`${LogLevel.SUCCESS} [${formatTime()}] ${msg}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`${LogLevel.WARN} [${formatTime()}] ${msg}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`${LogLevel.ERROR} [${formatTime()}] ${msg}`, ...args);
  },
  debug: (msg, ...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`${LogLevel.DEBUG} [${formatTime()}] ${msg}`, ...args);
    }
  },
};

module.exports = logger;
