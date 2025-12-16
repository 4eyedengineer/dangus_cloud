/**
 * Simple logger for services that don't have access to fastify
 * Matches pino log format for consistency
 */

const LOG_LEVELS = {
  debug: 20,
  info: 30,
  warn: 40,
  error: 50
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.info;

function formatLog(level, msg, extra = {}) {
  const timestamp = Date.now();
  const base = {
    level: LOG_LEVELS[level],
    time: timestamp,
    msg
  };
  return JSON.stringify({ ...base, ...extra });
}

export const logger = {
  debug(msg, extra) {
    if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
      console.log(formatLog('debug', msg, extra));
    }
  },
  info(msg, extra) {
    if (CURRENT_LEVEL <= LOG_LEVELS.info) {
      console.log(formatLog('info', msg, extra));
    }
  },
  warn(msg, extra) {
    if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
      console.warn(formatLog('warn', msg, extra));
    }
  },
  error(msg, extra) {
    if (CURRENT_LEVEL <= LOG_LEVELS.error) {
      console.error(formatLog('error', msg, extra));
    }
  }
};

export default logger;
