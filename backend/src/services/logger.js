/**
 * Structured Logging Service
 * 
 * Provides structured, JSON-formatted logging for production environments.
 * Supports multiple log levels, file rotation, and external integrations.
 * 
 * @module services/logger
 */

const fs = require('fs');
const path = require('path');
const env = require('../config/environment');

// Log levels with numeric values for filtering
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const LEVEL_COLORS = {
    error: '\x1b[31m', // Red
    warn: '\x1b[33m',  // Yellow
    info: '\x1b[36m',  // Cyan
    http: '\x1b[35m',  // Magenta
    debug: '\x1b[37m', // White
};
const RESET = '\x1b[0m';

// Current log level from environment
const currentLevel = LOG_LEVELS[env.logging.level] ?? LOG_LEVELS.info;

// Ensure log directory exists
const logDir = path.dirname(env.logging.filePath);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Format log entry as JSON
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} JSON formatted log entry
 */
function formatJson(level, message, meta = {}) {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
        service: 'company-hr-backend',
        environment: env.nodeEnv,
    });
}

/**
 * Format log entry for console (human-readable)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} Formatted log entry
 */
function formatConsole(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const color = LEVEL_COLORS[level] || '';
    const levelStr = level.toUpperCase().padEnd(5);
    
    let output = `${timestamp} ${color}[${levelStr}]${RESET} ${message}`;
    
    if (Object.keys(meta).length > 0) {
        output += ` ${JSON.stringify(meta)}`;
    }
    
    return output;
}

/**
 * Write to log file
 * @param {string} entry - Log entry to write
 */
function writeToFile(entry) {
    try {
        fs.appendFileSync(env.logging.filePath, entry + '\n');
    } catch (error) {
        console.error('Failed to write to log file:', error.message);
    }
}

/**
 * Core logging function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 */
function log(level, message, meta = {}) {
    if (LOG_LEVELS[level] > currentLevel) {
        return;
    }

    const jsonEntry = formatJson(level, message, meta);
    
    // Write to file in JSON format
    writeToFile(jsonEntry);
    
    // Output to console (human-readable in development, JSON in production)
    if (env.isDevelopment) {
        console.log(formatConsole(level, message, meta));
    } else if (env.logging.format === 'json') {
        console.log(jsonEntry);
    } else {
        console.log(formatConsole(level, message, meta));
    }
}

/**
 * Create logger instance with optional default context
 * @param {Object} defaultContext - Default metadata to include in all logs
 * @returns {Object} Logger instance
 */
function createLogger(defaultContext = {}) {
    return {
        error: (message, meta = {}) => log('error', message, { ...defaultContext, ...meta }),
        warn: (message, meta = {}) => log('warn', message, { ...defaultContext, ...meta }),
        info: (message, meta = {}) => log('info', message, { ...defaultContext, ...meta }),
        http: (message, meta = {}) => log('http', message, { ...defaultContext, ...meta }),
        debug: (message, meta = {}) => log('debug', message, { ...defaultContext, ...meta }),
    };
}

// Default logger instance
const logger = createLogger();

/**
 * Express HTTP request logging middleware
 */
function httpLogger() {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Log response after it's sent
        res.on('finish', () => {
            const duration = Date.now() - startTime;
            
            logger.http('HTTP Request', {
                method: req.method,
                url: req.originalUrl,
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent'),
                userId: req.user?.id,
                contentLength: res.get('Content-Length'),
            });
        });
        
        next();
    };
}

/**
 * Express error logging middleware
 */
function errorLogger() {
    return (err, req, res, next) => {
        logger.error('Unhandled Error', {
            error: err.message,
            stack: env.isDevelopment ? err.stack : undefined,
            method: req.method,
            url: req.originalUrl,
            userId: req.user?.id,
            body: env.isDevelopment ? req.body : undefined,
        });
        
        next(err);
    };
}

/**
 * Log application startup
 * @param {Object} config - Startup configuration
 */
function logStartup(config) {
    logger.info('Application Starting', {
        nodeVersion: process.version,
        platform: process.platform,
        environment: env.nodeEnv,
        port: config.port,
        features: {
            auditLog: env.compliance.auditLogEnabled,
            twoFactor: env.twoFactor.enabled,
            multiTenant: env.multiTenant.enabled,
        },
    });
}

/**
 * Log application shutdown
 * @param {string} reason - Shutdown reason
 */
function logShutdown(reason) {
    logger.info('Application Shutting Down', {
        reason,
        uptime: process.uptime(),
    });
}

module.exports = {
    ...logger,
    createLogger,
    httpLogger,
    errorLogger,
    logStartup,
    logShutdown,
    LOG_LEVELS,
};
