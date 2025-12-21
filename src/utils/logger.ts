import winston, { format, Logger as WinstonLogger } from 'winston';
import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

// Create logs directory if it doesn't exist
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const { combine, timestamp, printf, colorize, align, json } = format;

// Define log format
interface LogEntry {
  level: string;
  message: string;
  timestamp?: string;
  requestId?: string;
  [key: string]: any;
}

// Request ID middleware
export const requestIdMiddleware = (req: Request, res: Response, next: () => void) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', requestId);
  (req as any).id = requestId;
  next();
};

// Request logger middleware
export const requestLogger = (req: Request, res: Response, next: () => void) => {
  const start = Date.now();
  const { method, originalUrl, body, query, params } = req;
  const requestId = (req as any).id || 'unknown';

  // Skip logging for health checks
  if (originalUrl === '/health') {
    return next();
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const logMessage = `${method} ${originalUrl} ${statusCode} - ${duration}ms`;
    
    const logData: any = {
      requestId,
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.ips || req.connection.remoteAddress,
    };

    if (Object.keys(query).length > 0) {
      logData.query = query;
    }

    if (Object.keys(params).length > 0) {
      logData.params = params;
    }

    // Log request body for non-GET requests and non-file uploads
    if (method !== 'GET' && !originalUrl.includes('upload')) {
      logData.body = body;
    }

    if (statusCode >= 500) {
      logger.error(logMessage, logData);
    } else if (statusCode >= 400) {
      logger.warn(logMessage, logData);
    } else {
      logger.info(logMessage, logData);
    }
  });

  next();
};

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const { requestId, ...restMeta } = meta as LogEntry;
  const metaString = Object.keys(restMeta).length ? `\n${JSON.stringify(restMeta, null, 2)}` : '';
  return `${timestamp} [${level}] ${requestId ? `[${requestId}] ` : ''}${message}${metaString}`;
});

// Create the logger instance
const logger = winston.createLogger({
  level: config.isDevelopment ? 'debug' : 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    config.isDevelopment ? colorize() : format.simple(),
    config.isDevelopment ? devFormat : json(),
    align()
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: format.combine(
        format((info) => {
          if (info.stack) {
            info.message = `${info.message}\n${info.stack}`;
            delete info.stack;
          }
          return info;
        })()
      ),
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
      tailable: true,
    })
  ],
  exitOnError: false,
  handleExceptions: true,
  handleRejections: true,
});

// Add request ID to all logs
const originalLog = logger.log;
logger.log = function(level: string, message: string, meta?: any) {
  const req = global.__currentRequest || {};
  const requestId = (req as any).id || 'system';
  
  const metaWithRequestId = {
    ...(meta || {}),
    requestId,
  };
  
  return originalLog.call(this, level, message, metaWithRequestId);
} as WinstonLogger['log'];

// Create a stream for morgan logging
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  }
};

// Log unhandled exceptions
process.on('unhandledRejection', (reason: Error | any) => {
  logger.error('Unhandled Rejection:', {
    error: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack,
  });
  // Don't exit in production, let the process manager handle it
  if (config.isDevelopment) {
    process.exit(1);
  }
});

export { logger };
